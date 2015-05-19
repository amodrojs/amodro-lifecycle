amodro.fetch = function(normalizedId, location, lifecycle) {
    return new Promise(function(resolve, reject) {
      require('fs').readFile(location, 'utf8', function(err, text) {
        // Simulate browser evaluation on script load.
        amodro.exec(text);
        lifecycle.execCompleted(normalizedId);

        if (err) {
          reject(err);
        } else {
          // Do not return the text as it has already been handled.
          resolve('');
        }
      });
    });
};
