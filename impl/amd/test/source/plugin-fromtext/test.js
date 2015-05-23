require('../../tester')(module.id, function (loader, define, assert, done) {
  return loader(['refine!a'], function(a) {
    assert.equal('a', a.name);
    done();
  });
});
