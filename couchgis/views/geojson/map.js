// Emit GeoJSON, simplified GeoJSON for
// faster drawing and associated documents.

function(doc) {
  var utils=require('views/lib/utils');
  var id=doc["GeoJSON" in doc?"_id":"GeoJSON_clone"];
  // abort if no GeoJSON is set at all
  if (id==null) return;
  if (id===doc._id) {
    // I need a copy that can be modified
    var GeoJSON=utils.clone(doc.GeoJSON);
    utils.toWGS84(GeoJSON);
    utils.bbox(GeoJSON);
    // Provide a neat set of reduced polygons: we allow an infinite error at
    // the beginning, and then set the new error limit to half the accuracy of
    // the last simplification. If error is zero, no reduction was done and the
    // list is complete.
    for (var error=Infinity;error>0;error=error*0.5) {
      // In google maps, we are unable to zoom way below this level, but before
      // anyone complains, I shall stack the unabreviated geometry on top of
      // the list.
      error*=(error>=5e-6);
      var simplified_GeoJSON=utils.stripLastCoord(utils.simplify(utils.clone(GeoJSON),error));
      emit([id,+Number(simplified_GeoJSON.error).toExponential(1)], {GeoJSON:simplified_GeoJSON});
      error=simplified_GeoJSON.error;
    }
  }
  var ranges=require('views/lib/ranges');
  if (!doc.type) return;
  var val={doc:{
    _id:doc._id,
    _rev:doc._rev,
    type:doc.type,
    time:ranges.toRanges(doc.time),
    GeoJSON_clone:doc.GeoJSON_clone
  }};
  for (var field in doc) {
    // fields with lowecase letters are english and kind of 'internal'
    if (!/^[A-ZÄÖÜ]/.test(field)) continue;
    if (/^GeoJSON/.test(field)) continue;
    val.doc[field]=doc[field];
  }
  var ids=id.replace(/(^)?[\s,;&]+($)?/g,'').split(/[\s,;&]+/);
  while (ids.length) emit([ids.shift(),doc._id], val);
}
