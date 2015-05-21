require('../../tester')(module.id, function (loader, define, assert, done) {

  loader.config({
    config: {
      'refine!b': {
        color: 'blue'
      },
      'refine!c': {
        color: 'cyan'
      }
    }
  });

  //The refine plugin changes the word refine into define.
  define('refine!c', function (require, exports, module) {
    return {
      name: 'c',
      color: module.config().color
    };
  });

  return loader(['refine!b', 'refine!c'], function(b, c) {
    assert.equal('b', b.name);
    assert.equal('blue', b.color);
    assert.equal('c', c.name);
    assert.equal('cyan', c.color);
    done();
  });
});
