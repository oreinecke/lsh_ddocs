// Emits GeoJSON w/bbox and associated properties.

function(doc) {
  var id=doc["GeoJSON" in doc?"_id":"GeoJSON_clone"];
  // abort if no GeoJSON is set at all
  if (id==null) return;
  if (id===doc._id) {
//  I need a copy that can be modified
    var GeoJSON=JSON.parse(JSON.stringify(doc.GeoJSON));
    ;function update_bbox(obj) {
      if (typeof(obj)!="object") return;
      if (typeof(obj[0])=="number") {
        if (GeoJSON.bbox===undefined)
          GeoJSON.bbox=[obj[0],obj[1],obj[0],obj[1]];
        var bbox=GeoJSON.bbox;
        bbox[0]=(bbox[0]<obj[0])?bbox[0]:obj[0];
        bbox[1]=(bbox[1]<obj[1])?bbox[1]:obj[1];
        bbox[2]=(bbox[2]>obj[0])?bbox[2]:obj[0];
        bbox[3]=(bbox[3]>obj[1])?bbox[3]:obj[1];
      } else for (field in obj) {
        if (["geometries", "coordinates", "features", "geometry"].indexOf(field)!=-1)
          update_bbox(obj[field]);
        if (field.search(/^[0-9]+$/)>=0)
          update_bbox(obj[field]);
      }
    }
    update_bbox(GeoJSON);
    // I also decide on some kind of 'importance' here
    // to choose what items to draw first. We use the
    // bbox circumfence and we'll see how this goes.
    var size=(GeoJSON.bbox[2]-GeoJSON.bbox[0])+(GeoJSON.bbox[3]-GeoJSON.bbox[1])
    emit(id, {GeoJSON: GeoJSON, size: size});
  };
  var properties={_id:doc._id, type:doc.type};
  for (field in doc) {
    // fields with lowecase letters are english and kind of 'internal'
    if (field.search(/^[A-Z]/)==-1) continue;
    if (field.search("GeoJSON")!=-1) continue;
    properties[field]=doc[field];
  }
  emit(id, {doc:properties});
}
