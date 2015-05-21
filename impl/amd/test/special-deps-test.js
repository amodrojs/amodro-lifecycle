require('./tester')(module.id, function (loader, define, assert, done) {
  'use strict';

  define('foo', function(require, exports, module) {
    require('exports').name = 'foo';
    require('require')('exports').related = require('module').config().related;
  });

  loader.config({
    config: {
      foo: {
        related: 'bar'
      }
    }
  });

  return loader(['foo'], function (foo) {
    assert.equal('foo', foo.name);
    assert.equal('bar', foo.related);
    done();
  });

});