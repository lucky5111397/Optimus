const fs = require('fs/promises');
const path = require('path');
const { parseCode } = require('./parser');

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '.cache',
  '.vscode',
  '.idea',
  'out',
  'bin',
  'obj',
  'target',
  'vendor'
]);

const IGNORED_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '.env.staging',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
]);

const SENSITIVE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.(pem|key|pkcs12|pfx|p12|cert|crt|der)$/i,
  /id_rsa/i,
  /id_ecdsa/i,
  /id_ed25519/i,
  /credentials\.json$/i,
  /serviceAccount.*\.json$/i,
  /token.*\.json$/i
];

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.tgz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.iso',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac',
  '.pyc', '.class', '.o', '.obj'
]);

/**
 * Checks whether a file or directory is sensitive and must be excluded.
 */
function isSensitive(name) {
  if (IGNORED_FILES.has(name)) return true;
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(name)) return true;
  }
  return false;
}

/**
 * Recursively scans a directory and returns a flat list of file metadata.
 * @param {string} rootPath - The base directory to start scanning.
 * @param {string} currentPath - The current directory being scanned relative to root.
 * @returns {Promise<Array>} List of file metadata objects.
 */
async function scanDirectory(rootPath, currentPath = '') {
  let results = [];
  const fullPath = path.join(rootPath, currentPath);
  
  // Strict containment verification: ensure fullPath is within rootPath
  const resolvedRoot = path.resolve(rootPath);
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  const resolvedFull = path.resolve(fullPath);

  if (resolvedFull !== resolvedRoot && !resolvedFull.startsWith(rootWithSep)) {
    console.warn(`Skipping path outside root boundary: ${resolvedFull}`);
    return results;
  }

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    for (const entry of entries) {
      // 1. Skip symlinks completely to prevent directory traversal and filesystem escapes
      if (entry.isSymbolicLink()) {
        continue;
      }

      // 2. Skip ignored or git directories
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.git')) {
          continue;
        }
      }

      // 3. Skip sensitive files
      if (isSensitive(entry.name)) {
        continue;
      }

      const relativePath = path.join(currentPath, entry.name).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        const subResults = await scanDirectory(rootPath, relativePath);
        results = results.concat(subResults);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        
        // Block ts/tsx as requested by project rules
        if (ext === '.ts' || ext === '.tsx') {
          continue;
        }

        const filePath = path.join(fullPath, entry.name);
        const stat = await fs.stat(filePath);
        
        let symbols = null;
        
        // Extract AST metadata for supported JS/JSX files under 1MB
        const isSupportedSource = ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs';
        if (isSupportedSource && !BINARY_EXTENSIONS.has(ext)) {
          try {
            if (stat.size < 1024 * 1024) {
              const code = await fs.readFile(filePath, 'utf8');
              symbols = parseCode(code, relativePath);
            }
          } catch (readErr) {
            console.warn(`Could not parse AST for file: ${relativePath}`);
          }
        }

        results.push({
          path: relativePath,
          name: entry.name,
          extension: ext,
          size: stat.size,
          lastModified: stat.mtime,
          symbols: symbols
        });
      }
    }
  } catch (error) {
    console.error(`Failed to scan directory ${fullPath}:`, error.message);
  }

  return results;
}

/**
 * Converts a flat array of file metadata into a hierarchical directory tree for explorer navigation.
 * @param {Array} files - Flat list of scanned file metadata.
 * @returns {Array} Nested tree of directory and file nodes.
 */
function buildFileTree(files) {
  const root = { name: '', type: 'directory', children: [] };

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current.children.push({
          name: part,
          path: file.path,
          type: 'file',
          extension: file.extension,
          size: file.size,
          symbols: file.symbols
        });
      } else {
        let dir = current.children.find(c => c.name === part && c.type === 'directory');
        if (!dir) {
          const currentDirPath = parts.slice(0, i + 1).join('/');
          dir = {
            name: part,
            path: currentDirPath,
            type: 'directory',
            children: []
          };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  }

  // Sort directories first, then files alphabetically
  function sortNodes(nodes) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.type === 'directory' && node.children) {
        sortNodes(node.children);
      }
    }
  }

  sortNodes(root.children);
  return root.children;
}

/**
 * Indexes a cloned repository workspace.
 * @param {string} workspacePath - Absolute path to the cloned repository.
 * @returns {Promise<Object>} The indexed structure with files, fileTree, symbols, and dependencies.
 */
async function indexRepository(workspacePath) {
  const files = await scanDirectory(workspacePath);
  
  // Sort files deterministically by relative path
  files.sort((a, b) => a.path.localeCompare(b.path));

  // Build hierarchical tree for CodebaseExplorer UI
  const fileTree = buildFileTree(files);

  // Extract all global dependencies and symbols
  const allDependencies = [];
  const allSymbols = [];
  const seenSymbols = new Set();
  const seenDeps = new Set();

  for (const f of files) {
    if (f.symbols) {
      // 1. Process imports into dependencies
      if (Array.isArray(f.symbols.imports)) {
        for (const imp of f.symbols.imports) {
          const depKey = `${f.path}:${imp.source}`;
          if (!seenDeps.has(depKey)) {
            seenDeps.add(depKey);
            allDependencies.push({
              file: f.path,
              source: imp.source,
              specifiers: imp.specifiers || [],
              line: imp.line || 1
            });
          }
        }
      }

      // 2. Process functions into symbols
      if (Array.isArray(f.symbols.functions)) {
        for (const fn of f.symbols.functions) {
          const fnName = typeof fn === 'string' ? fn : fn.name;
          const fnLine = typeof fn === 'object' && fn.line ? fn.line : 1;
          const symKey = `function:${fnName}:${f.path}:${fnLine}`;
          if (!seenSymbols.has(symKey)) {
            seenSymbols.add(symKey);
            allSymbols.push({
              type: 'function',
              name: fnName,
              file: f.path,
              line: fnLine
            });
          }
        }
      }

      // 3. Process classes into symbols
      if (Array.isArray(f.symbols.classes)) {
        for (const cls of f.symbols.classes) {
          const clsName = typeof cls === 'string' ? cls : cls.name;
          const clsLine = typeof cls === 'object' && cls.line ? cls.line : 1;
          const symKey = `class:${clsName}:${f.path}:${clsLine}`;
          if (!seenSymbols.has(symKey)) {
            seenSymbols.add(symKey);
            allSymbols.push({
              type: 'class',
              name: clsName,
              file: f.path,
              line: clsLine
            });
          }
        }
      }
    }
  }

  // Sort symbols and dependencies deterministically
  allSymbols.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
  allDependencies.sort((a, b) => a.file.localeCompare(b.file) || a.source.localeCompare(b.source));

  return {
    fileCount: files.length,
    symbolCount: allSymbols.length,
    files,
    fileTree,
    dependencies: allDependencies,
    symbols: allSymbols
  };
}

module.exports = {
  indexRepository,
  buildFileTree,
  scanDirectory
};


