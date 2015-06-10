    require.toUrl = function(idPlusExt) {
      var ext,
          index = idPlusExt.lastIndexOf('.'),
          segment = idPlusExt.split('/')[0],
          isRelative = segment === '.' || segment === '..';

      //Have a file extension alias, and it is not the
      //dots from a relative path.
      if (index !== -1 && (!isRelative || index > 1)) {
          ext = idPlusExt.substring(index + 1, idPlusExt.length);
          idPlusExt = idPlusExt.substring(0, index);
      }

      var id = instance.top.normalize(idPlusExt, refId);
      return require.locate(id, ext);
    };
