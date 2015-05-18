/*jshint evil: true */
/*global Promise: true */
'use strict';
var fs = require('fs'),
    path = require('path');

if (typeof Promise === 'undefined') {
  var Promise = require('./support/prim');
}

var lifecyclePath = path.join(__dirname, 'lifecycle.js');
var lifecycleSource = fs.readFileSync(lifecyclePath, 'utf8');
eval(lifecycleSource + 'module.exports = Lifecycle');
