const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

/**
 * Parses a JavaScript/JSX file and extracts structural symbols.
 * @param {string} code - The source code to parse.
 * @param {string} filePath - The path of the file (for error logging).
 * @returns {Object} Extracted metadata (functions, classes, imports, exports).
 */
function parseCode(code, filePath) {
  const result = {
    functions: [],
    classes: [],
    imports: [],
    exports: []
  };

  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'classProperties',
        'objectRestSpread',
        'optionalChaining',
        'nullishCoalescingOperator'
      ],
      errorRecovery: true // Don't fail completely on minor syntax errors
    });

    traverse(ast, {
      FunctionDeclaration(path) {
        if (path.node.id && path.node.id.name) {
          result.functions.push({
            name: path.node.id.name,
            line: path.node.loc?.start?.line || 1
          });
        }
      },
      VariableDeclarator(path) {
        // Look for Arrow Functions and Function Expressions assigned to variables
        if (
          path.node.init && 
          (path.node.init.type === 'ArrowFunctionExpression' || path.node.init.type === 'FunctionExpression') &&
          path.node.id && path.node.id.name
        ) {
          result.functions.push({
            name: path.node.id.name,
            line: path.node.loc?.start?.line || 1
          });
        }
      },
      ClassDeclaration(path) {
        if (path.node.id && path.node.id.name) {
          result.classes.push({
            name: path.node.id.name,
            line: path.node.loc?.start?.line || 1
          });
        }
      },
      CallExpression(path) {
        if (path.node.callee.name === 'require' && path.node.arguments.length > 0) {
          const arg = path.node.arguments[0];
          if (arg.type === 'StringLiteral') {
            result.imports.push({
              source: arg.value,
              specifiers: [],
              line: path.node.loc?.start?.line || 1
            });
          }
        }
      },
      ImportDeclaration(path) {
        const source = path.node.source.value;
        const specifiers = (path.node.specifiers || []).map(s => s.local?.name || s.imported?.name).filter(Boolean);
        result.imports.push({
          source,
          specifiers,
          line: path.node.loc?.start?.line || 1
        });
      },
      ExportNamedDeclaration(path) {
        if (path.node.declaration) {
          const decl = path.node.declaration;
          if (decl.type === 'FunctionDeclaration' && decl.id) {
            result.exports.push({
              name: decl.id.name,
              line: decl.loc?.start?.line || 1
            });
          } else if (decl.type === 'ClassDeclaration' && decl.id) {
            result.exports.push({
              name: decl.id.name,
              line: decl.loc?.start?.line || 1
            });
          } else if (decl.type === 'VariableDeclaration') {
            decl.declarations.forEach(d => {
              if (d.id && d.id.name) {
                result.exports.push({
                  name: d.id.name,
                  line: d.loc?.start?.line || 1
                });
              }
            });
          }
        } else if (Array.isArray(path.node.specifiers)) {
          path.node.specifiers.forEach(s => {
            const expName = s.exported?.name || s.local?.name;
            if (expName) {
              result.exports.push({
                name: expName,
                line: s.loc?.start?.line || 1
              });
            }
          });
        }
      },
      ExportDefaultDeclaration(path) {
        let name = 'default';
        if (path.node.declaration && path.node.declaration.id && path.node.declaration.id.name) {
          name = path.node.declaration.id.name;
        }
        result.exports.push({
          name: `default (${name})`,
          line: path.node.loc?.start?.line || 1
        });
      }
    });

  } catch (error) {
    // Only log if it's a severe failure that wasn't recovered
    console.warn(`Failed to parse file ${filePath}: ${error.message}`);
  }

  return result;
}

module.exports = {
  parseCode
};
