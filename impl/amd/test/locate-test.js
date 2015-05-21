require('./tester')(module.id, function (loader, define, assert, done) {
  'use strict';

  loader.config({
    baseUrl: 'aceofbase',
    locations: {
      'a/b/': 'some/child/b',
      'a/b': 'some/root/b',
      'g/': 'nothing/but/a/',
      'j': 'http://j.com/js/j'
    }
  });

  assert.equal('aceofbase/some/child/b/c.js', loader.locate('a/b/c', 'js'));
  assert.equal('aceofbase/some/root/b.html', loader.locate('a/b', 'html'));
  assert.equal('aceofbase/nothing/but/a/h', loader.locate('g/h'));
  assert.equal('aceofbase/g.css', loader.locate('g', 'css'));
  assert.equal('http://j.com/js/j', loader.locate('j'));
  assert.equal('http://j.com/js/j/k.json', loader.locate('j/k', 'json'));
  done();
});
