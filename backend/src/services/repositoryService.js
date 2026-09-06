const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const Repository = require('../models/Repository');
const RepositoryBranch = require('../models/RepositoryBranch');
const { indexRepository } = require('../context/indexer');

const WORKSPACES_DIR = path.resolve(__dirname, '..', '..', 'workspaces');

/**
 * Scrubs access tokens and sensitive credentials from error strings and logs.
 */
function scrubTokens(str, token) {
  if (typeof str !== 'string') return str;
  let result = str;
  if (token && typeof token === 'string' && token.length > 5) {
    result = result.split(token).join('[REDACTED_TOKEN]');
  }
  result = result.replace(/gh[pousr]_[A-Za-z0-9_]{36,}/g, '[REDACTED_TOKEN]');
  result = result.replace(/github_pat_[A-Za-z0-9_]{50,}/g, '[REDACTED_TOKEN]');
  result = result.replace(/(https?:\/\/)[^/@\s]+:[^/@\s]+@/g, '$1[REDACTED_CREDS]@');
  return result;
}

/**
 * Spawns a child process safely without shell interpolation and returns a promise.
 */
function spawnPromise(command, args, options) {
  return new Promise((resolve, reject) => {
    // Force shell to false to prevent shell injection vulnerabilities
    const safeOptions = { ...options, shell: false };
    const proc = spawn(command, args, safeOptions);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      reject(err);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}: ${stderr.trim()}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Clones and indexes a repository in the background.
 */
async function cloneAndIndexRepository(repoDoc, branchDoc, githubToken) {
  const repoIdStr = repoDoc._id.toString();
  const branchName = branchDoc.name;
  
  // Validate repoIdStr strictly to prevent directory traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(repoIdStr)) {
    throw new Error('Invalid repository ID for workspace path');
  }

  // Strict path containment check
  const resolvedRoot = path.resolve(WORKSPACES_DIR);
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  const workspacePath = path.resolve(resolvedRoot, repoIdStr);

  if (workspacePath !== resolvedRoot && !workspacePath.startsWith(rootWithSep)) {
    throw new Error('Directory traversal detected in workspace path');
  }

  // Sanitize repo path to prevent traversal
  const safeOwner = repoDoc.owner.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeName = repoDoc.name.replace(/[^a-zA-Z0-9_.-]/g, '');

  let gitExists = false;
  try {
    const gitStat = await fs.stat(path.join(workspacePath, '.git'));
    gitExists = gitStat.isDirectory();
  } catch (e) {
    gitExists = false;
  }

  try {
    // Update status to IMPORTING
    repoDoc.status = 'IMPORTING';
    await repoDoc.save();

    const gitHelperConfig = [
      '-c', 'credential.helper=',
      '-c', 'credential.helper=!f() { echo username=oauth2; echo "password=$GITHUB_TOKEN"; }; f'
    ];

    if (gitExists) {
      // Reuse existing workspace: fetch updated branch and checkout
      await spawnPromise('git', [...gitHelperConfig, 'fetch', 'origin', branchName, '--depth', '1'], {
        cwd: workspacePath,
        env: { ...process.env, GITHUB_TOKEN: githubToken }
      });

      await spawnPromise('git', ['checkout', '-B', branchName, 'FETCH_HEAD'], {
        cwd: workspacePath,
        env: { ...process.env }
      });
    } else {
      // Ensure workspaces dir exists
      await fs.mkdir(workspacePath, { recursive: true });

      // Clone repository securely without exposing token in command line args
      const repoUrl = `https://github.com/${safeOwner}/${safeName}.git`;
      const gitArgs = [
        ...gitHelperConfig,
        'clone',
        '--branch', branchName,
        '--single-branch',
        '--depth', '1',
        repoUrl,
        '.'
      ];

      await spawnPromise('git', gitArgs, {
        cwd: workspacePath,
        env: { ...process.env, GITHUB_TOKEN: githubToken }
      });
    }

    // 3. Update status to INDEXING
    repoDoc.status = 'INDEXING';
    await repoDoc.save();
    
    branchDoc.indexStatus = 'INDEXING';
    await branchDoc.save();

    // 4. Index the repository
    const indexData = await indexRepository(workspacePath);

    // 5. Save index metadata and update status
    branchDoc.fileIndex = indexData;
    branchDoc.indexStatus = 'READY';
    branchDoc.lastIndexed = new Date();
    await branchDoc.save();

    repoDoc.status = 'READY';
    repoDoc.errorMessage = '';
    await repoDoc.save();

  } catch (error) {
    console.error(`Failed to clone/index repo ${repoDoc.owner}/${repoDoc.name}:`, scrubTokens(error.message, githubToken));
    
    const sanitizedError = scrubTokens(error.message || 'Clone failed', githubToken);

    repoDoc.status = 'FAILED';
    repoDoc.errorMessage = sanitizedError;
    await repoDoc.save();
    
    branchDoc.indexStatus = 'FAILED';
    await branchDoc.save();
    
    // Clean up workspace on failure ONLY IF it was newly created
    if (!gitExists) {
      try {
        await fs.rm(workspacePath, { recursive: true, force: true });
      } catch (rmError) {
        console.error(`Failed to clean up workspace ${workspacePath}:`, rmError.message);
      }
    }
  }
}

module.exports = {
  cloneAndIndexRepository,
  scrubTokens
};

