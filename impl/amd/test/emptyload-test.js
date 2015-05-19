require('./tester')(module.id, function (loader, define, assert, done) {
  'use strict';

  return loader([], function() {
    assert.equal(true, true);
    done();
  });
});
