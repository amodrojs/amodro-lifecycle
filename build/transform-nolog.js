'use strict';

var esprima = require('esprima'),
    logDefinition = 'function log(';

//From an esprima example for traversing its ast.
function traverse(object, visitor) {
  var key, child;

  if (!object) {
    return;
  }

  if (visitor.call(null, object) === false) {
    return false;
  }
  for (key in object) {
    if (object.hasOwnProperty(key)) {
      child = object[key];
      if (typeof child === 'object' && child !== null) {
        if (traverse(child, visitor) === false) {
          return false;
        }
      }
    }
  }
}



module.exports = function transformNoLog(filePath, contents) {
  var ranges = [];

  if (contents.indexOf(logDefinition) !== -1) {
    var astRoot =  esprima.parse(contents, {
      range: true
    });

    traverse(astRoot, function (node) {
      if (node.type === 'FunctionDeclaration' &&
          node.id.type === 'Identifier' &&
          (node.id.name === 'log' || node.id.name === 'fslog')) {
        ranges.push(node.range);
      } else if (node.type === 'ExpressionStatement' &&
          node.expression.type === 'CallExpression' &&
          node.expression.callee.type === 'Identifier' &&
          (node.expression.callee.name === 'log' ||
           node.expression.callee.name === 'fslog')) {
        ranges.push(node.range);
      }
    });
  }

  // Go in reverse order to the matches, so that the indices stay correct as
  // ranges are removed.
  for (var i = ranges.length -1; i > -1; i--) {
    var range = ranges[i];
    contents = contents.substring(0, range[0]) +
               contents.substring(range[1] + 1);
  }

  return contents;
};

