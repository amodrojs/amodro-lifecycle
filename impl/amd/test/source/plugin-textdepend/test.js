require('../../tester')(module.id, function (loader, define, assert, done) {

  loader.config({
    locations: {
      text: '../lib/text'
    }
  });

  return loader(['textDepend!a'], function(textValue) {
    assert.equal('hello world', textValue);
    done();
  });
});
