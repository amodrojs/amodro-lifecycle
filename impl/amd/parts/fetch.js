/*global amodro */
amodro.fetch = function(normalizedId, refId, location, lifecycle) {
  'use strict';
  var jsSuffixRegExp = /\.js$/;

  return new Promise(function(resolve, reject) {
    require('fs').readFile(location, 'utf8', function(err, text) {
      // If a JS script, simulate browser evaluation on script load, where
      // the text is not visible to the loader.
      if (jsSuffixRegExp.test(location)) {
        amodro.evaluate(text);
        lifecycle.execCompleted(normalizedId);
        text = '';
      }

      if (err) {
        reject(err);
      } else {
        // Do not return the text as it has already been handled.
        resolve(text);
      }
    });
  });
};
