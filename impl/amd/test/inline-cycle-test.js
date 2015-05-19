require('./tester')(module.id, function (loader, define, assert, done) {
  'use strict';

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

  return loader(['a', 'c', 'd'], function (a, c, d) {
    var b = a.getB();
    assert.equal('a', a.name);
    assert.equal('b', b.name);
    assert.equal('a', b.getA().name);
    assert.equal('c', c.name);
    assert.equal('d', c.d.name);
    assert.equal('d', d.name);
    assert.equal('c', d.c.name);
    done();
  });
});
