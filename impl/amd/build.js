'use strict';
var fs = require('fs'),
    path = require('path'),
    loadRegExp = /\/\/INSERT ([\w\/\.-]+)/g,
    dir = path.join(__dirname, 'parts'),
    mainFilePath = path.join(dir, 'main.js'),
    contents = fs.readFileSync(mainFilePath, 'utf8'),
    transformNoLog = require('../../build/transform-nolog'),
    args = process.argv.slice(2);

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

var transform = function(filePath, contents) {
  return contents;
};

if (!options.log) {
  transform = transformNoLog;
}

contents = transform(mainFilePath, contents);

var lifecycleContents;

//Inline file contents
contents = contents.replace(loadRegExp, function (match, fileName) {
  var filePath = path.join(dir, fileName);
  if (fileName.indexOf('lifecycle.js') !== -1) {
    lifecycleContents = contents;
  }
  var text = transform(filePath, fs.readFileSync(filePath, 'utf8'));
  return text;
});

// AMD loader
fs.writeFileSync(path.join(__dirname, 'amodro-node.js'), contents, 'utf8');
