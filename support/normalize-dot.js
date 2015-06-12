function dotNormalize(id, refId, returnArray) {
  var idParts = id.split('/'),
      refParts = refId && refId.split('/');

  if (idParts[0].charAt(0) === '.') {
    if (refId) {
      //Convert refId to array, and lop off the last part,
      //so that . matches that 'directory' and not name of the
      // refId's module. For instance, refId of
      // 'one/two/three', maps to 'one/two/three.js', but we want the
      // directory, 'one/two' for this normalization.
      idParts = refParts.slice(0, refParts.length - 1)
                  .concat(idParts);
    } else if (idParts[0].indexOf('./') === 0) {
      // Just trim it off, already at the top of the module ID space.
      idParts[0] = idParts[0].substring(2);
    } else if (idParts[0] !== '.') {
      throw new Error('Invalid ID, oustide of the module ID space: ' +
                      id);
    }
  }

  // Trim dots, and throw if the dot is outside the ID space.
  var i, part;
  for (i = 0; i < idParts.length; i++) {
    part = idParts[i];
    if (part === '.') {
      idParts.splice(i, 1);
      i -= 1;
    } else if (part === '..') {
      // If at the start, or previous value is still ..,
      // keep them so that when converted to a path it may
      // still work when converted to a path, even though
      // as an ID it is less than ideal. In larger point
      // releases, may be better to just kick out an error.
      if (i === 0) {
        throw new Error('Cannot resolve ID segment: ' +
                         idParts.join('/') +
                         ', .. is outside module ID space');
      } else if (i > 0) {
        idParts.splice(i - 1, 2);
        i -= 2;
      }
    }
  }

  return returnArray ? idParts: idParts.join('/');
}
