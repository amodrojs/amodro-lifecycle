/*jshint strict: false */
/*global llProtoModifiers, amodro */
llProtoModifiers.push(function (proto) {
  proto.amodroFetch = function(normalizedId, refId, location) {
    var jsSuffixRegExp = /\.js$/;

    return new Promise(function(resolve, reject) {
      require('fs').readFile(location, 'utf8', function(err, text) {
        // If a JS script, simulate browser evaluation on script load, where
        // the text is not visible to the loader.
        if (jsSuffixRegExp.test(location)) {
          amodro.evaluate(text);
          this.execCompleted(normalizedId);
          text = '';
        }

        if (err) {
          reject(err);
        } else {
          // Do not return the text as it has already been handled.
          resolve(text);
        }
      }.bind(this));
    }.bind(this));
  };
});