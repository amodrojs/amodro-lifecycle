'use strict';
var fs = require('fs'),
    path = require('path'),
    loadRegExp = /\/\/INSERT ([\w\/\.-]+)/g,
    dir = path.join(__dirname, 'parts'),
    contents = fs.readFileSync(path.join(dir, 'main.js'), 'utf8');

//Inline file contents
contents = contents.replace(loadRegExp, function (match, fileName) {
  var text = fs.readFileSync(path.join(dir, fileName), 'utf8');
  return text;
});

//Set the isOpto flag to true
fs.writeFileSync(path.join(__dirname, 'amodro-node.js'), contents, 'utf8');
