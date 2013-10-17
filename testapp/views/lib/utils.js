// Apply action to every [[x1,y1],..].

exports.eachCoords=function(GeoJSON, action) {
  ;function apply_action(obj) {
    if (typeof(obj)!="object") return;
    // ignore sets of unconnected points
    if (obj.type=="Point" || obj.type=="MultiPoint") return;
    if (obj.coordinates) {
      var c=obj.coordinates;
      // LineString
      if (typeof(c[0][0])=="number") action(c);
      // Polygon/MultiLineString
      else if (typeof(c[0][0][0])=="number")
        for (var i=0;i<c.length;i++) action(c[i]);
      // MultiPolygon
      else if (typeof(c[0][0][0][0])=="number")
        for (var i=0;i<c.length;i++)
        for (var j=0;j<c[i].length;j++) action(c[i][j]);
    } else for (var field in obj) {
      if (["geometries", "features", "geometry"].indexOf(field)!=-1)
        apply_action(obj[field]);
      if (field.search(/^[0-9]+$/)>=0)
        apply_action(obj[field]);
    }
  }
  apply_action(GeoJSON);
};

// Apply action to every [x,y].

exports.eachPoint=function(GeoJSON, action) {
  ;function apply_action(obj) {
    if (typeof(obj)!="object") return;
    if (typeof(obj[0])=="number")
      action(obj);
    else for (var field in obj) {
      if (["geometries", "coordinates", "features", "geometry"].indexOf(field)!=-1)
        apply_action(obj[field]);
      if (field.search(/^[0-9]+$/)>=0)
        apply_action(obj[field]);
    }
  }
  apply_action(GeoJSON);
};

// Clone GeoJSON and handle arrays properly.

exports.clone=function(GeoJSON) {
  if (GeoJSON==null || typeof(GeoJSON)!="object")
    return GeoJSON;
  if (Array.isArray(GeoJSON)) {
    var array=[];
    for (var i=0;i<GeoJSON.length;i++)
      array.push(exports.clone(GeoJSON[i]));
    return array;
  }
  var object={};
  for (var prop in GeoJSON)
    object[prop]=exports.clone(GeoJSON[prop]);
  return object;
}

// Calculate a bounding box.

exports.bbox=function(GeoJSON) {
  var bbox=[Infinity,Infinity,-Infinity,-Infinity];
  exports.eachPoint(GeoJSON, function(coord) {
    bbox[0]=(bbox[0]<coord[0])?bbox[0]:coord[0];
    bbox[1]=(bbox[1]<coord[1])?bbox[1]:coord[1];
    bbox[2]=(bbox[2]>coord[0])?bbox[2]:coord[0];
    bbox[3]=(bbox[3]>coord[1])?bbox[3]:coord[1];
  });
  return bbox;
};

// Also define some kind of 'importance' here to choose
// what items to draw first. We use the bbox circumfence
// and we'll see how this goes.

exports.size=function(GeoJSON) {
  return (GeoJSON.bbox[2]-GeoJSON.bbox[0])+(GeoJSON.bbox[3]-GeoJSON.bbox[1]);
};

// Transform to WGS84.

exports.toWGS84=function(GeoJSON) {
  try {
    var EPSG=GeoJSON.crs.properties.name.match(/EPSG::([0-9]+)/);
    var projector=require('./proj4js/core')("EPSG:"+EPSG[1]);
    exports.eachPoint(GeoJSON, function(coord) {
      var newCoord=projector.inverse(coord);
      coord[0]=newCoord[0];
      coord[1]=newCoord[1];
    });
    // write crs according to GeoJSON spec
    GeoJSON.crs.properties.name="urn:ogc:def:crs:OGC:1.3:CRS84";
  } catch(e) {
    GeoJSON.crs=e;
  }
};

// Simplify LineStrings and Polygons for a given maximum
// deviation and store the actual error as GeoJSON.error.

exports.simplify=function(GeoJSON, error) {
  GeoJSON.error=0;
  // some vector algebra
  ;function dot(u,v) { return u[0]*v[0]+u[1]*v[1]; }
  ;function mul(u,m) { return [u[0]*m, u[1]*m]; }
  ;function add(u,v) { return [u[0]+v[0],u[1]+v[1]]; }
  ;function sub(u,v) { return [u[0]-v[0],u[1]-v[1]]; }
  // blah blah recursively yada yada
  ;function inspect_coords(coords, i, k) {
    // Return index and distance of furthest point.
    // Return no index if distance is below error.
    var j=function() {
      var result={error:0};
      if (i+1==k) return result;
      var a=coords[i];
      var c=coords[k];
      var d=sub(c,a);
      for (var j=i+1;j<k;j++) {
        var b=coords[j], e;
        var a_b=dot(sub(b,a),d);
        var b_c=dot(sub(b,c),d);
        // check if b falls outside the line segment a-c.
        // an aquidistanc line then looks like this:
        //  ____b___
        // /        \ I.e. draw circles with the same
        // | a -- c | radius at a,b and join them with
        // \________/ tangent lines. Ignore arcs within.
        if (a_b<=0) e=dot(sub(b,a),sub(b,a));
        else if (b_c<=0) e=dot(sub(c,b),sub(c,b));
        // e = b - (a*((b-a)*(c-a))+c*((b-a)*(c-a)))/(d*d);
        // if we had operator overloading in JS (luckily we have not)
        else e=sub(b, mul( add( mul(a,b_c),
                                mul(c,a_b) ), 1.0/dot(d,d)) );
        var e2=dot(e,e);
        if (e2>result.error*result.error) {
          result.error=Math.sqrt(e2);
          if (e2>error*error) result.index=j;
        }
      }
      return result;
    }();
    if (j.index) {
      inspect_coords(i, j.index);
      inspect_coords(j.index, k);
    } else {
      if (j.error>GeoJSON.error)
        GeoJSON.error=j.error;
      for (var j=i+1;j<k;j++) coords[j]=null;
    }
  }
  exports.eachCoords(GeoJSON, function(coords) {
    if (coords.length<=2) return;
    inspect_coords(0,coords.length-1);
    // remove nulls from coords
    for (var j; (j=coords.indexOf(null))>=0; coords.splice(j,1));
  });
};
