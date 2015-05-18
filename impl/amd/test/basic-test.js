/*global describe, it */
'use strict';

var assert = require('assert'),
    path = require('path'),
    amodro = require('../amodro-node'),
    sourceDir = path.join(__dirname, 'source');

describe('basic', function() {
  it('a-b-c', function(done) {
    amodro.config({
      baseUrl: path.join(sourceDir, 'a-b-c')
    });

    amodro(['a'], function(a) {
      assert.equal(a.name, 'a');
      assert.equal(a.b.name, 'b');
      assert.equal(a.b.c.name, 'c');
      done();
    }).catch(function(err) {
      done(err);
    });
  });
});
