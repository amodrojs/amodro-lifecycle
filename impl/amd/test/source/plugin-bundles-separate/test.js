require('../../tester')(module.id, function (loader, define, assert, done) {
  loader.config({
    paths: {
      'text': '../lib/text'
    },
    bundles: {
        'main': ['text!template.html']
    }
  });

  return loader(['text!template.html', 'text!second.html'],
  function(template, secondTemplate) {
    assert.equal('main template', template);
    assert.equal('second template', secondTemplate);
    done();
  });
});

