require('../../tester')(module.id, function (loader, define, assert, done) {
  return loader(['nameOnly!'], function(nameOnly) {
    assert.equal('nameOnly', nameOnly.name);
    done();
  });
});
