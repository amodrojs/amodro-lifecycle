/*jshint strict: false, browser: true */
/*global amodro, require: true, requirejs: true */
var require, requirejs;
(function() {
  var jsSuffixRegExp = /\.js$/,
      skipDataMain = false,
      contexts = {};

  var oldConfig = amodro.config;
  amodro.config = function(cfg) {
    if (cfg.skipDataMain) {
      skipDataMain = true;
    }

    return oldConfig.call(amodro, cfg);
  };

  var req = function(deps, callback, errback, alt) {
    var config;

    if (typeof deps === 'string') {
      return amodro(deps);
    }

    if (!Array.isArray(deps)) {
      config = deps;
      deps = callback;
      callback = errback;
      errback = alt;
    }

    var instance = amodro;
    if (config) {
      var context = config.context;
      if (context) {
        if (contexts.hasOwnProperty(context)) {
          instance = contexts[context];
        } else {
          instance = contexts[context] = amodro.createLoader();
        }
      }
      instance.config(config);
    }

    if (deps) {
      instance(deps, callback, errback).catch(function(err) {
        console.error(err);
      });
    }

    return instance;
  };

  req.toUrl = amodro.toUrl;
  req.defined = amodro.defined;
  req.specified = amodro.specified;
  req.config = function(cfg) {
    amodro.config(cfg);
    return req;
  };
  req.isBrowser = typeof document !== 'undefined' &&
                  typeof navigator !== 'undefined';

  var bootstrapConfig;

  var type = typeof require;
  if (type === 'undefined') {
    require = req;
  } else if (type !== 'function') {
    bootstrapConfig = require;
    require = req;
  }

  type = typeof requirejs;
  if (type === 'undefined') {
    requirejs = req;
  } else if (type !== 'function') {
    bootstrapConfig = requirejs;
    requirejs = req;
  }

  if (bootstrapConfig) {
    amodro.config(bootstrapConfig);
  }

  if (!skipDataMain &&
      typeof document !== 'undefined' && document.querySelector) {
    var dataMain = document.querySelector('script[data-main]');
    dataMain = dataMain && dataMain.getAttribute('data-main');
    if (dataMain) {
      //Strip off any trailing .js since dataMain is now
      //like a module name.
      dataMain = dataMain.replace(jsSuffixRegExp, '');

      if (!bootstrapConfig || !bootstrapConfig.baseUrl) {
        //Pull off the directory of data-main for use as the
        //baseUrl.
        var src = dataMain.split('/');
        dataMain = src.pop();
        var subPath = src.length ? src.join('/')  + '/' : './';

        amodro.config({baseUrl: subPath});
      }

      amodro([dataMain]);
    }
  }


}());
