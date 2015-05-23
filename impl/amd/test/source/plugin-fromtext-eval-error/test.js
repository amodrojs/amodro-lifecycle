require('../../tester')(module.id, function (loader, define, assert, done) {

  loader.config({
    paths: {
        'refine': '../plugin-fromtext/refine'
    }
  });

  return loader(['refine!a'], function() {
    done(new Error('This test should go to the errback'));
  }, function(err) {
    var message = err + '';
    assert.equal(-1, message.indexOf('timeout'));
    done();
  });
});

