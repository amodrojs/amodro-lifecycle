require('../../tester')(module.id, function (loader, define, assert, done) {
  return loader(['foo'], function(foo) {

    assert.equal('foo', foo.name);
    assert.equal('bar', foo.bar.name);
    assert.equal('baz', foo.baz.name);
    assert.equal('bar', foo.baz.bar.name);

    done();
  });
});
