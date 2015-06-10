/*jshint strict: false */
/*global it, define: true */
var assert = require('assert'),
    path = require('path'),
    logDebug = process.env.LOGDEBUG === '1',
    amodro = require('../' +
             (logDebug ? 'amodro-test-node-debug' : 'amodro-test-node')),
    createLoader = amodro.createLoader,
    define = amodro.define,
    sourceDir = path.join(__dirname, 'source');

module.exports = function(testPath, fn) {
  var testSuffix,
      parts = testPath.split('/'),
      sourceIndex = parts.lastIndexOf('source');

  if (sourceIndex === -1) {
    testSuffix = path.basename(testPath);
  } else {
    testSuffix = parts.splice(sourceIndex + 1).join('/');
  }

  //describe(testSuffix, function() {
    it(testSuffix, function(done) {
      var result;

      try {
        result = fn(createLoader({
          baseUrl: path.join(sourceDir, path.dirname(testSuffix))
        }), define, assert, done);
      } catch (e) {
        return done(e);
      }

      if (result && result.then) {
        result.catch(function(err) {
          done(err);
        });
      }
    });
  //});
};
