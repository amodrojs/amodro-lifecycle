require('../../tester')(module.id, function (loader, define, assert, done) {
  return loader(['bar', 'baz'], function (bar, baz) {

    assert.equal('bar', bar.name);
    assert.equal('baz', baz.name);
    assert.equal('bar', baz.bar.name);

    done();
  });
});
