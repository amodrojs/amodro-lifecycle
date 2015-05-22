require('../../tester')(module.id, function (loader, define, assert, done) {
  return loader(['sub/modA1', 'sub/plugin!modB1'],
    function (modAName, modBName) {
      assert.equal(true, /normalized/i.test(modAName));
      assert.equal(true, /normalized/i.test(modBName));
    done();
  });
});


