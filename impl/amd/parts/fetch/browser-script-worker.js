/*jshint strict: false, browser: true */
/*global amodro, importScripts */

amodro.createXhr = function(normalizedId, location, responseType) {
  return new XMLHttpRequest();
};

// Only use XHR calls for non .js files. This might need to be revisited if
// for example a text! plugin asks for a .js file?
amodro.useXhr = function(normalizedId, location) {
  return !/\.js$/.test(location);
};

amodro.xhrFetch = function(normalizedId, location, responseType) {
  return new Promise(function(resolve, reject) {
    var xhr = amodro.createXhr(normalizedId, location, responseType);
    if (responseType) {
      xhr.responseType = responseType;
    }

    xhr.open('GET', location, true);

    xhr.onreadystatechange = function (evt) {
        var status, err;
        //Do not explicitly handle errors, those should be
        //visible via console output in the browser.
        if (xhr.readyState === 4) {
            status = xhr.status;
            if (status > 399 && status < 600) {
                //An http 4xx or 5xx error. Signal an error.
                err = new Error(location + ' HTTP status: ' + status);
                err.xhr = xhr;
                reject(err);
            } else {
                resolve(responseType ? xhr.response : xhr.responseText);
            }
        }
    };
    xhr.send(null);
  });
};

if (typeof importScripts === 'function') {

  amodro.scriptFetch = function(normalizedId, location, lifecycle) {
    return new Promise(function(resolve, reject) {
      try {
        importScripts(location);
      } catch (e) {
        reject(e);
      }
      lifecycle.execCompleted(normalizedId);
      resolve();
    });
  };

} else {

  amodro.scriptFetch = function(normalizedId, location, lifecycle) {
    return new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.setAttribute('data-amodromodule', normalizedId);
      script.type = amodro.scriptType || 'text/javascript';
      script.charset = 'utf-8';
      script.async = true;

      script.addEventListener('load', function () {
          lifecycle.execCompleted(normalizedId);
          resolve();
      }, false);
      script.addEventListener('error', function (err) {
          err.requireModules = [normalizedId];
          reject(err);
      }, false);

      script.src = location;

      document.head.appendChild(script);
    });
  };

}

amodro.fetch = function(normalizedId, location, lifecycle) {
  if (amodro.useXhr(normalizedId, location)) {
    return amodro.xhrFetch(normalizedId, location);
  } else {
    return amodro.scriptFetch(normalizedId, location, lifecycle);
  }
};
