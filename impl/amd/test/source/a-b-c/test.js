require('../../tester')(module.id, function (loader, define, assert, done) {
  return loader(['a'], function(a) {
    assert.equal(a.name, 'a');
    assert.equal(a.b.name, 'b');
    assert.equal(a.b.c.name, 'c');
    done();
  });
});
