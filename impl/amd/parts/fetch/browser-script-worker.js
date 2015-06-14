/*jshint strict: false, browser: true */
/*global llProtoModifiers, importScripts, hasProp */
llProtoModifiers.push(function (proto) {

  proto.createXhr = function(normalizedId, location, responseType) {
    return new XMLHttpRequest();
  };

  proto.useScript = function(normalizedId, refId, location) {
    return hasProp(this.isScriptLocation, location);
  };

  proto.xhrFetch = function(normalizedId, refId, location, responseType) {
    return new Promise(function(resolve, reject) {
      var xhr = this.createXhr(normalizedId, location, responseType);
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
    }.bind(this));
  };

  if (typeof importScripts === 'function') {

    proto.scriptFetch = function(normalizedId, refId, location) {
      return new Promise(function(resolve, reject) {
        try {
          importScripts(location);
        } catch (e) {
          reject(e);
        }
        this.execCompleted(normalizedId);
        resolve();
      }.bind(this));
    };

  } else {

    proto.createScriptNode = function(config, normalizedId, refId, location) {
        var script = document.createElement('script');
        script.type = config.scriptType || 'text/javascript';
        script.charset = 'utf-8';
        script.async = true;
        return script;
    };

    proto.scriptFetch = function(normalizedId, refId, location) {
      return new Promise(function(resolve, reject) {
        var script = this.createScriptNode(this.config,
                                           normalizedId, refId, location);

        if (refId) {
          script.setAttribute('data-amodroref', refId);
        }

        script.setAttribute('data-amodromodule', normalizedId);

        script.addEventListener('load', function () {
            this.execCompleted(normalizedId);
            resolve();
        }.bind(this), false);
        script.addEventListener('error', function (err) {
            var e = new Error('Load failed: ' + normalizedId +
                              ': ' + script.src);
            e.moduleId = normalizedId;
            reject(e);
        }, false);

        script.src = location;

        document.head.appendChild(script);
      }.bind(this));
    };

  }

  proto.amodroFetch = function(normalizedId, refId, location) {
    if (this.useScript(normalizedId, refId, location)) {
      return this.scriptFetch(normalizedId, refId, location);
    } else {
      return this.xhrFetch(normalizedId, refId, location);
    }
  };
});

