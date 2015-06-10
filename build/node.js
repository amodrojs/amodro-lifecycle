#!/usr/bin/env node
'use strict';
var fs = require('fs'),
    path = require('path'),
    lifecyclePath = path.join(__dirname, '..', 'lifecycle.js'),
    contents = fs.readFileSync(path.join(__dirname, 'node-pre.txt'), 'utf8') +
               fs.readFileSync(lifecyclePath, 'utf8') +
               fs.readFileSync(path.join(__dirname, 'node-post.txt'), 'utf8'),
    transformNoLog = require('./transform-nolog');

fs.writeFileSync(path.join(__dirname, '..', 'lifecycle-node-debug.js'),
                 contents, 'utf8');

contents = transformNoLog(lifecyclePath, contents);

fs.writeFileSync(path.join(__dirname, '..', 'lifecycle-node.js'),
                 contents, 'utf8');
