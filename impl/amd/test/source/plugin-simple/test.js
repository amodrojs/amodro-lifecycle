require('../../tester')(module.id, function (loader, define, assert, done) {
  return loader(['earth', 'prime/earth'], function(earth, primeEarth) {
    assert.equal("a", earth.getA().name);
    assert.equal("c", earth.getC().name);
    assert.equal("b", earth.getB().name);
    assert.equal("aPrime", primeEarth.getA().name);
    assert.equal("cPrime", primeEarth.getC().name);
    assert.equal("bPrime", primeEarth.getB().name);
    done();
  });
});
