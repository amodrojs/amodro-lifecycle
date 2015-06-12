/*jshint evil: true */
/*global describe, it, Promise: true */
'use strict';

var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    Lifecycle = require('../lifecycle-node'),
    sourceDir = path.join(__dirname, 'source');

if (typeof Promise === 'undefined') {
  var Promise = require('../support/prim');
}

var overrides = {
  locate: function(id) {
    // sync
    return this.baseUrl + '/' + id + '.js';
  },

  fetch: function(id, refId, location) {
    // async
    return new Promise(function(resolve, reject) {
      fs.readFile(location, 'utf8', function(err, text) {
        if (err) {
          reject(err);
        } else {
          resolve(text);
        }
      });
    });
  },

  translate: function(normalizedId, location, source) {
    // sync
    var deps = [];
    var depRegExp = /need\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    var match;
    while ((match = depRegExp.exec(source))) {
      deps.push(match[1]);
    }

    var modified = 'lifecycle.registry["' + normalizedId + '"] = {' +
    'deps: ' + JSON.stringify(deps) + ', ' +
    'factory: function(need) {\n' + source + '\n}};';

    return modified;
  },

  instantiate: function(normalizedId, deps, factory) {
    // sync
    var need = function(id) {
      var fullId = this.normalize(id, normalizedId);
      return this.getModule(fullId);
    }.bind(this);

    return factory(need);
  }
};

Object.keys(overrides).forEach(function(key) {
  Lifecycle.prototype[key] = overrides[key];
});

describe('basic', function() {
  it('a-b-c', function(done) {
    var lc = new Lifecycle();
    lc.baseUrl = path.join(sourceDir, 'a-b-c');

    lc.use('a').then(function(a) {
      assert.equal(a.name, 'a');
      assert.equal(a.b.name, 'b');
      assert.equal(a.b.c.name, 'c');
      done();
    }).catch(function(err) {
      done(err);
    });
  });
});
