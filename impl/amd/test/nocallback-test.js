require('./tester')(module.id, function (loader, define, assert, done) {
  'use strict';

  define('a', ['b'], function (b) {
    assert.equal('b', b.name);
    done();
  });

  define('b', {
    name: 'b'
  });

  return loader(['a']);
});
