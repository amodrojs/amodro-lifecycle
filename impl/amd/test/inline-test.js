require('./tester')(module.id, function (loader, define, assert, done) {
  'use strict';

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

  return loader(['foo', 'bar', 'baz'], function(foo, bar, baz) {
    assert.equal('foo', foo.name);
    assert.equal('bar', bar.name);
    assert.equal('baz', baz.name);
    assert.equal('bar', baz.barName);
    baz.callIt(function (bar) {
      assert.equal('bar', bar.name);
      done();
    });
  });
});
