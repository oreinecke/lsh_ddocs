// Yields docs that have an associated GeoJSON bbox
// intersecting with the one specified in req.query.

function(head, req) {
  start({headers:{'Content-Type':'application/json;charset=utf-8'}});
  var options=JSON.parse(req.query.options || '{}');
  // initialize to false if none provided
  var bbox=options.bbox || false;
  // allow reduced polygons to deviate up to this amount
  var error=options.error || 0.0;
  // we need to limit output and server load
  var limit=Infinity;
  if ('limit' in options) limit=options.limit;
  if (!limit) return '{}\n';
  function pass() {return true;}
  function fail() {return false;}
  // Use function variables to work around useless repetition:
  // i) Check if we have to read more items.
  var proceed=pass;
  if (limit!==Infinity) proceed=function() {
    return (--limit);
  };
  // ii) This is a crude optionial check for similar geometry.
  var similarity=Infinity;
  if ('similarity' in options) similarity=options.similarity;
  var bbox_is_similar=pass;
  if (similarity!==Infinity) {
    similarity*=similarity;
    var bbox_0=bbox[0], bbox_1=bbox[1],
        bbox_2=bbox[2], bbox_3=bbox[3];
    bbox_is_similar=function(bbox2) {
      var d0=bbox_0-bbox2[0], d1=bbox_1-bbox2[1],
          d2=bbox_2-bbox2[2], d3=bbox_3-bbox2[3];
      return d0*d0+d1*d1<=similarity && d2*d2+d3*d3<=similarity;
    };
  }
  // iii) Check if bboxes intersect.
  var inside_bbox=function(bbox2) {
    if (!bbox || !bbox2) return (inside_bbox=pass)();
    var bbox_0=bbox[0], bbox_1=bbox[1],
        bbox_2=bbox[2], bbox_3=bbox[3];
    switch(options.relation) {
    case "within":
      bbox_0+=5e-7; bbox_2-=5e-7;
      bbox_1+=5e-7; bbox_3-=5e-7;
      inside_bbox=function(bbox2) {
        return (bbox2[0]<=bbox_0&&bbox_2<=bbox2[2]&&
                bbox2[1]<=bbox_1&&bbox_3<=bbox2[3]);
      };
      break;
    case "contains":
      bbox_0-=5e-7; bbox_2+=5e-7;
      bbox_1-=5e-7; bbox_3+=5e-7;
      inside_bbox=function(bbox2) {
        return (bbox_0<=bbox2[0]&&bbox2[2]<=bbox_2&&
                bbox_1<=bbox2[1]&&bbox2[3]<=bbox_3);
      };
      break;
    default:
      inside_bbox=function(bbox2) {
        return (bbox_0<=bbox2[2]&&bbox2[0]<=bbox_2&&
                bbox_1<=bbox2[3]&&bbox2[1]<=bbox_3);
      };
      break;
    }
    return inside_bbox(bbox2);
  };
  // iv) Check spatial relation with req.body.GeoJSON.
  var relates=pass;
  if ('relation' in options && req.body!=="undefined" && !bbox) {
    var related_GeoJSON = JSON.parse(req.body).GeoJSON;
    var utils = require('views/lib/utils');
    var flip_sideness=options.relation==="intersects";
    if ( /within|intersects/.test(options.relation) ) {
      var points=[];
      utils.stripLastCoord(related_GeoJSON);
      utils.eachPoint(related_GeoJSON, function(point, type) {
        if ( flip_sideness && type!=="Polygon" && type!=="MultiPolygon")
          point.exclude_from_boundary=true;
        points.push(point);
      });
      relates=function(GeoJSON) {
        utils.unstripLastCoord(GeoJSON);
        var last_point, inside=flip_sideness;
        for (var p=points.length-1;p!==-1;p--) {
          var point=points[p];
          inside=utils.pointInPolygon(GeoJSON, point, last_point, inside);
          if (!inside) return false;
          else if (inside===0.5) {
            inside=flip_sideness;
            last_point=undefined;
            if ( point.exclude_from_boundary )
              return false;
          } else last_point=point;
        }
        return true;
      };
    }
    var related_GeoJSON_outside=relates;
    var related_Polygons=function(type, relation) {
      if ( !/contains|intersects/.test(relation) ) return;
      relates=fail;
      var inspect_types=/^(Multi)?Polygon$/;
      if (inspect_types.test(type)) return related_GeoJSON;
      if (type!=="GeometryCollection") return;
      var geometries=[];
      for (var g=0;g<related_GeoJSON.geometries.length;g++)
        if (inspect_types.test(related_GeoJSON.geometries[g].type))
          geometries.push(related_GeoJSON.geometries[g]);
      if (geometries.length) return {
        type:"GeometryCollection",
        geometries:geometries
      };
    }(related_GeoJSON.type, options.relation);
    if (related_Polygons) {
      utils.unstripLastCoord(related_Polygons);
      var point_outside={message:"Point outside related polygons."};
      relates=function(GeoJSON) {
        var last_point, inside=flip_sideness;
        try { utils.eachPoint(GeoJSON, function(point, type) {
          inside=utils.pointInPolygon(related_Polygons, point, last_point, inside);
          if (!inside) throw point_outside;
          else if (inside===0.5) {
            inside=flip_sideness;
            last_point=undefined;
            if ( flip_sideness && type!=="Polygon" && type!=="MultiPolygon" )
              throw point_outside;
          } else last_point=point;
        }); } catch (err) {
          if (err===point_outside) return false;
          throw err;
        }
        return true;
      };
    }
    var outside_related_Polygons=relates;
    if ( options.relation==="intersects" ) {
      if (outside_related_Polygons===fail) relates=function(GeoJSON) {
        return !related_GeoJSON_outside(GeoJSON);
      }; else relates=function(GeoJSON) {
        return !outside_related_Polygons(GeoJSON) || !related_GeoJSON_outside(GeoJSON);
      };
    }
  }
  // v) Send comma and newline as we reach the 2nd item.
  var send_separator=function() {
    send_separator=function() {send(',\n');};
  };
  send('{');
  var row;
  while (row=getRow()) {
    var GeoJSON=row.value.GeoJSON;
    var bbox2=GeoJSON.bbox;
    if (!inside_bbox(bbox2) || !bbox_is_similar(bbox2) || !relates(GeoJSON))
      continue;
    var errors=GeoJSON.errors || [GeoJSON.error];
    delete GeoJSON.errors;
    for (var e=(error?0:errors.length-1); e<errors.length; e++) {
      if (errors[e]<=error) {
        GeoJSON.error=errors[e];
        break;
      }
    }
    send_separator();
    send('"'+row.id+'":{"GeoJSON":{"bbox":['+GeoJSON.bbox+'],"error":'+GeoJSON.error+'}}');
    if (!proceed()) break;
  }
  return '}\n';
  // Uncomment this next line as soon as any(more) trouble arises: for some
  // reason, the list crashes if rows are left after the function returned.
  // This happens only if keys are specified in the request body.
  // if (/"keys"/.test(req.body)) while (getRow());
}

