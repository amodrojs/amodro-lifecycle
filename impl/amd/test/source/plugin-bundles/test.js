require('../../tester')(module.id, function (loader, define, assert, done) {
  loader.config({
    bundles: {
        'main': ['text', 'text!template.html']
    }
  });

  return loader(['text!template.html'], function(template) {
    assert.equal('main template', template);
    done();
  });
});
