/*global describe, it, define: true */
'use strict';

var assert = require('assert'),
    path = require('path'),
    amodro = require('../amodro-node'),
    createLoader = amodro.createLoader,
    define = amodro.define,
    sourceDir = path.join(__dirname, 'source');

describe('basic', function() {
  it('a-b-c', function(done) {
    var loader = createLoader({
      baseUrl: path.join(sourceDir, 'a-b-c')
    });

    loader(['a'], function(a) {
      assert.equal(a.name, 'a');
      assert.equal(a.b.name, 'b');
      assert.equal(a.b.c.name, 'c');
      done();
    }).catch(function(err) {
      done(err);
    });
  });

  it('inline', function(done) {
    var loader = createLoader();

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

    loader(['foo', 'bar', 'baz'], function(foo, bar, baz) {
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

  it('inline-circular', function(done) {
    var loader = createLoader();

    define('a', ['b', 'require'], function (b, require) {
      return {
        name: 'a',
        getB: function () {
          return require('b');
        }
      };
    });

    define('b', ['a', 'require'], function (a, require) {
      return {
        name: 'b',
        getA: function () {
          return require('a');
        }
      };
    });

    define('c', ['require', 'exports', 'd'], function (require, exports) {
      exports.name = 'c',
      exports.d = require('d');
    });

    define('d', ['require', 'exports', 'c'], function (require, exports) {
      exports.name = 'd',
      exports.c = require('c');
    });

    loader(['a', 'c', 'd'], function (a, c, d) {
      var b = a.getB();
      assert.equal('a', a.name);
      assert.equal('b', b.name);
      assert.equal('a', b.getA().name);
      assert.equal('c', c.name);
      assert.equal('d', c.d.name);
      assert.equal('d', d.name);
      assert.equal('c', d.c.name);
      done();
    }).catch(function(err) {
      done(err);
    });
  });
});
