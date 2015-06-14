/*jshint browser: true, strict: false */
/*global amodro*/
if (typeof document !== 'undefined' &&
    document.querySelector &&
    !amodro._lifecycle.config.skipScriptAttrLoad) {
  var tag = document
            .querySelector('[data-baseurl],[data-serial],[data-parallel');
  if (tag) {
    var baseUrl = tag.dataset.baseurl;
    if (baseUrl) {
      amodro.config({ baseUrl: baseUrl });
    }

    var parallel = tag.dataset.parallel;
    if (parallel) {
      amodro(parallel.split(','));
    }

    var serial = tag.dataset.serial;
    if (serial) {
      var serial = serial.split(',');
      (function serialFn() {
        var id = serial.shift();
        if (id) {
          amodro([id], serialFn);
        }
      }());
    }
  }
}
