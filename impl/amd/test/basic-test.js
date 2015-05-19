/*global describe, it, define: true */
'use strict';

var assert = require('assert'),
    path = require('path'),
    amodro = require('../amodro-node'),
    createLoader = amodro.createLoader,
    define = amodro.define,
    sourceDir = path.join(__dirname, 'source');

describe('basic', function() {
  // it('a-b-c', function(done) {
  //   var l = createLoader({
  //     baseUrl: path.join(sourceDir, 'a-b-c')
  //   });

  //   l(['a'], function(a) {
  //     assert.equal(a.name, 'a');
  //     assert.equal(a.b.name, 'b');
  //     assert.equal(a.b.c.name, 'c');
  //     done();
  //   }).catch(function(err) {
  //     done(err);
  //   });
  // });

  it('inline', function(done) {
    var l = createLoader({
      baseUrl: path.join(sourceDir, 'a-b-c')
    });

    define('foo', {
      name: 'foo'
    });

    define('bar', [], function() {
      return {
        name: 'bar'
      };
    });

    define('baz', ['require', 'exports', 'module', './bar'],
    function (require, exports, module) {
      var bar = require('./bar');

      exports.name = 'baz';
      exports.barName = bar.name;

      exports.callIt = function (callback) {
        require(['./bar'], function (bar) {
            callback(bar);
        });
      };
    });

    l(['foo', 'bar', 'baz'], function(foo, bar, baz) {
      assert.equal('foo', foo.name);
      assert.equal('bar', bar.name);
      assert.equal('baz', baz.name);
      assert.equal('bar', baz.barName);
      baz.callIt(function (bar) {
        assert.equal('bar', bar.name);
        done();
      });
    }).catch(function(err) {
      done(err);
    });
  });
});
