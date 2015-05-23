require('../../tester')(module.id, function (loader, define, assert, done) {
  loader.config({
    locations: {
      refine: '../plugin-fromText/refine',
      text: '../lib/text'
    },
    alias: {
      '*': {
        r: 'refine'
      }
    }
  });

  return loader(['delegated!r!a'], function (a) {
    assert.equal('a', a.name);
    done();
  });
});
