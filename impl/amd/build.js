'use strict';
var fs = require('fs'),
    path = require('path'),
    loadRegExp = /\/\/INSERT ([\w\/\.-]+)/g,
    dir = path.join(__dirname, 'parts'),
    mainFilePath = path.join(dir, 'main.js'),
    mainContents = fs.readFileSync(mainFilePath, 'utf8'),
    transformNoLog = require('../../build/transform-nolog'),
    args = process.argv.slice(2);

var hasOwn = Object.prototype.hasOwnProperty;
function hasProp(obj, prop) {
    return hasOwn.call(obj, prop);
}

// Options passed to build command via CLI arguments, of the form name=value.
var options = {};
args.forEach(function(arg) {
  var pair = arg.split('=');
  if (pair.length === 2) {
    var value = pair[1];
    if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    }
    options[pair[0]] = value;
  }
});

/*
../../../support/prim.js
prim-to-promise.js
../../../lifecycle.js
../../../support/normalize-alias.js
../../../support/normalize-dot.js
../../../support/plugins.js
fetch.js
requirejs-to-amodro.js
suffix.js
 */

// Permutations of the builds
var permutations = {
  // The default one used for running node tests by default.
  'amodro-test-node': {
  },

  // The default one used for running node tests by default, with debug logging.
  'amodro-test-node-debug': {
    keepLog: true
  },

  // For browser with promise support, no requirejs compatibility, only script
  // tag and worker support.
  'amodro': {
    '../../../support/prim.js': '',
    'prim-to-promise.js': '',
    'fetch.js': 'fetch/browser-script-worker.js',
    'requirejs-to-amodro.js': '',
    'suffix.js': ''
  },

  // For browser with promise support, no requirejs compatibility, only script
  // tag and worker support. With debug logging.
  'amodro-debug': {
    keepLog: true,
    '../../../support/prim.js': '',
    'prim-to-promise.js': '',
    'fetch.js': 'fetch/browser-script-worker.js',
    'requirejs-to-amodro.js': '',
    'suffix.js': ''
  },

  // Base amodro, with some requirejs api support and includes prim.
  'amodro-requirejs-prim': {
    'fetch.js': 'fetch/browser-script-worker.js',
    'suffix.js': ''
  }
};

Object.keys(permutations).forEach(function(key) {
  var mapping = permutations[key];

  var transform = function(filePath, contents) {
    return contents;
  };

  if (!mapping.keepLog) {
    transform = transformNoLog;
  }

  var contents = transform(mainFilePath, mainContents);

  //Inline file contents
  contents = contents.replace(loadRegExp, function (match, fileName) {
    if (hasProp(mapping, fileName)) {
      fileName = mapping[fileName];
      if (fileName === '') {
        return '';
      }
    }

    var filePath = path.join(dir, fileName);
    var text = transform(filePath, fs.readFileSync(filePath, 'utf8'));
    return text;
  });

  // Write the file.
  var outPath = path.join(__dirname, key + '.js');
  fs.writeFileSync(outPath, contents, 'utf8');
});
