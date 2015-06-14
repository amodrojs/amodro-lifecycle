require('../../tester')(module.id, function (loader, define, assert, done) {

  loader.config({
    after: {
      locate: function(result, normalizedId, suggestedExtension) {
        return result.replace(/a\.js/, 'c.js').replace(/b\.js/, 'd.js');
      }
    }
  });

  return loader(['a', 'b'], function(a, b) {
    assert.equal(a.name, 'c');
    assert.equal(b.name, 'd');
    done();
  });
});
