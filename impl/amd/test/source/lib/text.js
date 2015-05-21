define(function () {
  function jsEscape(content) {
    return content.replace(/(['\\])/g, '\\$1')
      .replace(/[\f]/g, '\\f')
      .replace(/[\b]/g, '\\b')
      .replace(/[\n]/g, '\\n')
      .replace(/[\t]/g, '\\t')
      .replace(/[\r]/g, '\\r')
      .replace(/[\u2028]/g, '\\u2028')
      .replace(/[\u2029]/g, '\\u2029');
  }

  return {
    locateDetectExtension: true,

    translate: function(loader, normalizedId, location, source) {
      source = 'define(function() {\n' +
               'return \'' + jsEscape(source) + '\';\n' +
               '});';

      //Add in helpful debug line
      source += '\r\n//@ sourceURL=' + location;
      return source;
    }
  };
});
