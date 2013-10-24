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
    // Provide a neat set of reduced polygons: we start with the crappiest
    // resolution that usually consists of only two points. This version is
    // usually dropped. Then we set a new error limit of half the accuracy of
    // the last one. If error is zero, no reduction was done and the list is
    // complete.
    for (var error=Infinity;error>0;error=error*0.5) {
      // In google maps, we are unable to zoom way below this level, but before
      // anyone complains, I shall stack the unabreviated geometry on top of
      // the list.
      error*=(error>=5e-6);
      var simplified_GeoJSON=utils.simplify(utils.clone(GeoJSON),error);
      if (error<Infinity || simplified_GeoJSON.error==0)
        emit(id, {GeoJSON:simplified_GeoJSON});
      error=simplified_GeoJSON.error;
    }
  };
  var val={doc:{_id:doc._id, type:doc.type}};
  for (var field in doc) {
    // fields with lowecase letters are english and kind of 'internal'
    if (field.search(/^[A-Z]/)==-1) continue;
    if (field.search("GeoJSON")!=-1) continue;
    val.doc[field]=doc[field];
  }
  emit(id, val);
}
