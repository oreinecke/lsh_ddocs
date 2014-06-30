Couch-GIS
=========

A simple [CouchDB](http://couchdb.apache.org/) application to display and edit
geo-spatial data that links to ordinary JSON documents. It uses the Google Maps
API and works well with [LibreOffice](http://www.libreoffice.org/) Calc for
bulk document editing, and [Quantum GIS](http://qgis.org/en/site/) for shape
import/export.

Installation
------------

To install, push the couchgis directory into your couchdb using
[erica](https://github.com/benoitc/erica):

```
$ erica push couchgis http://localhost:5984/db
==> couchgis (push)
==> Successfully pushed. You can browse it at: http://localhost:5984/db/_design/couchgis-v1.0/index.html
```

If you don't have erica installed, use the compiled design document that is
shipped with every release (how nice of me!). Just unzip and post the json
file:

```
$ gzip -dc couchgis-v1.0.json.gz | curl -XPOST localhost:5984/db \
  -HContent-type:application/json -d@-
```

Or, if you don't even have gzip or curl or a shell, just replicate from
http://lsh1908.selfhost.eu:5984/release, where just the design docs without any
actual data are available from about 12 - 6 p.m. each workday except Friday.

Document Structure
------------------

The following easy-to-read JSON document demonstrates reserved properties and
some conventions:

```json
{
  "_id": "ab45", "_rev": "2-8945",
  "GeoJSON_clone": "e4af",
  "type": "Vegetation",
  "time": "2003/05/02-2004 & 2001",
  "Vegetation": "Coniferous Woodland",
  "Area"             : 20.0,
  "Net Area"         : 19.3,
  "Use by Area": {
    "Hunting Ground" : 17.0,
    "Logging"        :  2.3
  }
}
```

Fields that contain actual document content must start with a capital letter.
This isn't as much of a problem in German as it is in English. Any other field
is suspected to be internal by default (which might probably be a bad design
decision).

Reserved fields are:

###`doc._id` and `doc._rev`

CouchDB creates these automatically, so I do not recommend ever trying to set
them when uploading/editing documents.

###`doc.GeoJSON` or `doc.GeoJSON_clone`

The former must be set to a valid [GeoJSON][1] object and the latter to one or
more ids of existing documents that all have the `GeoJSON` property (there is
no way to follow a chain of ids). Needless to say, using both at the same time
makes no sense and results in a document validation error.

I introduced the geometry clone because I was blown away by how people working
with GIS databases either use duplicate geometries for two rows of the property
table (Seriously! The same geometry was drawn twice!!!), or are working around
that problem by using more and more columns for the same property at a
different time.

Multiple geometry clones may be separated by comma/space/ampersand/semicolon.
These documents may be listed twice or more in the map page, but are only
exported once as a table row.

`doc.GeoJSON.type` is restricted to Point, LineString, Polygon,
MultiLineString, MultiPolygon. It could make sense, and it would be easy, to
add MultiPoint and GeometryCollection. I will get to it as soon as I need
those. On the other hand, neither Feature nor FeatureCollection will ever be
needed. Actual document content is already stored one level above.

`doc.GeoJSON.crs` must be a [named CRS][2] and so far I have introduced a
couple of coordinate reference systems in [here](couchgis/views/lib/utils.js)
to which you can set `doc.GeoJSON.crs.properties.name`:
- EPSG:31469
- urn:ogc:def:crs:EPSG::31468
- urn:ogc:def:crs:EPSG::3397
- etc. Actually there's more.

ArcGIS seems to stick to legacy identifiers and QGIS uses OGC CRS URNs, so I
just check for EPSG and one or two colons and a bunch of digits.

[1]: http://geojson.org/geojson-spec.html
[2]: http://geojson.org/geojson-spec.html#named-crs

###`doc.type`

Documents have to give at least a tiny bit of explanation on what we can expect
to find in them. Or vice versa, if we look for certain information, it should
be obvious which document type covers it. Hence the above document is a very
very bad examble, since "Use by Area" should surely go to some different
document type.

###`doc[doc.type]`

It is nice to have that property set, because it yields a meaningful title
almost all the time. And I can not think of any case where it wouldn't make
sense to have it set.

###`doc.time`

In every table that I had to review, date information was a mess. There's
always a column for day/month/year, probably with one of them missing, and the
year had either four or two digits. Or worse, somehow a start and end date was
given as `MONTH_BEG` `YEAR_BEG` `DAY_END` or whatever.

[Dates or a ranges of dates](couchgis/views/lib/ranges.js) are expressed as a
string as such:
- Dates can be given in DD.MM.YYYY, YYYY.MM.DD, YYYY/MM/DD, DD/MM/YYYY i.e. I
  only expect the year to be four digits, the digits to be separated by either
  a slash or a dot, and I don't care about the order as long as it follows
  hierarchy.
- Date intervals are written as `"<date> - <date>"` ("to" or something would
  hinder internationalization even more).
- If the day is left out, `"03/2004"` equals `"01/03/2004 - 31/03/2004"`, ditto
  for months.
- If the entire date is left out, it is treated as +/- infinity. `"- 03/2004"`
  then amounts to any date before and including 31/03/2004.
- Multiple ranges may be separated by comma/ampersand/semicolon. I do no
  guarantee any predictable behaviour if ranges overlap, because for
  performance reasons I assume they don't.
- Spaces and leading zeros are ignored. Use them in the documents for clarity
  but avoid typing them in a search.

How to Filter Documents
-----------------------

The [map page](couchgis/_attachments/map.html) filter form should be able to
explain itself pretty much. And where it isn't clear just try to figure out
what it does. The application does not try _that_ hard to be mean to you or to
ruin your day.

Some notes include (you should probably have the map page open to know what
these are refering to):
- Where it says "Text" (below the map) or any of the document's fields, it
  actually means _case insensitive regular expression pattern_ by default. This
  allows for instance to select documents with `doc.Vegetation` matching
  woodland or swamp by typing `woodland|swamp`.
- Selecting a field and filtering for an empty string just checks if the field
  is present in the document.
- "Text" itself may be used to check if the pattern is matched by any of the
  fields. Because I for instance can hardly remember where a particular info
  had been placed.
- Where it says "Funktion" it actually means _eerily modified javascript
  expression_. I give some examples using the document from the top:

```javascript
  Area >= 15            // Yes it is doc['Area']>=15!!
  'Net Area' >=15       // Tricky field names are placed in single quotes.
  'Area' !== 'Net Area' // It does not hurt to quote simple fields.
  'Use by Area'.Logging > 'Use by Area'.'Hunting Ground' // The dot descends into objects.
  Vegetation.length > 5 // You can still access for instance String().length.
  Vegetation.match("woodland", "i")    // Double quotes are still strings.
  sum('Use by Area') != 'Net Area'     // I've provided a couple of accumulators.
  min('Use by Area').field==="Logging" // min()/max() return a field/value pair.
  (function average(o) {return sum(o)/count(o);})('Use by Area')>15
                        // This doesn't make much sense here, but feel free
                        // to define functions if it implies less typing.
```

###Spatial Relations

As of version 1.0.7, there's rudimentary support for so-called _spatial
relations_. That means, given a fixed geometry, you can check what other
geometry either lies inside, intersects or circumfences it. After you figured
out your fixed geometry, click on 'Auswahl merken', and then a button presents
itself for each relation. I have the following to add to this:

- Each geometry relates to itself by default.
- You might encounter glitches because of my sloppy implementation: For
  instance, I do not check for intersecting line segments, and the algorithm
  gets confused by identical points, and there's probably more.
- You might want to select the documents as tightly as possible (and the
  interface encurages to do so), that are about to be filtered geometrically.
  I've tried my best to make the filter perform as fast as possible, but
  there's of course limitations with JavaScript.

How Document Editing Works
--------------------------

The [upload page](couchgis/_attachments/upload.html) covers editing and
uploading new documents. Accepted formats are GeoJSON Feature/FeatureCollection
and the ghastly Microsoft Excel 2003 XML Table. Not surprisingly, the form
pretty much explains itself, and even if documents have been deleted or messed
up, there's always a revert button. Also you can review the data that is going
to be uploaded.

In CouchDB creating new or changing documents is more or less the same, as soon
as the Bulk Document API is in use. The application works with, and extends its
principle in some way.

- If neither `_id` nor `_rev` exists, a new document will be attached.
- If `_id` and `_rev` match an existing document, the application will update
  its fields with the ones specified in the uploaded data. Unmentioned fields
  are left untouched. If you want to delete a field, set its cell to an empty
  string or `null` or `undefined`.
- Nothing will be done if `_rev` doesn't match. This is for your own safety!!!
- If `_deleted` exists and equals `true` (in LibreOffice Calc, this amounts to
  typing `=TRUE()` in a cell), it deletes the document. It has to be this
  annoying because it is for your own safety as well!!!

###Tabular Document Representation

All software mentioned at the beginning can not cope with nested objects, so
they have to be converted into a flat-hierarchy representation. The example
document would be exported into a GeoJSON Feature like this:

```json
{
  "type": "Feature",
  "crs": {
     "type": "name",
     "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" }
  },
  "geometry" : { "type" : "Polygon", "coordinates": [...] },
  "properties" : {
    "_id": "ab45", "_rev": "2-8945",
    "GeoJSON_clone": "e4af",
    "type": "Vegetation",
    "time": "2001, 02.05.2003-2004",
    "Vegetation": "Coniferous Woodland",
    "Area"                       : 20.0,
    "Net Area"                   : 19.3,
    "Use by Area.Hunting Ground" : 17.0,
    "Use by Area.Logging"        :  2.3
  }
}
```

The good thing is that, inversely, the application is capable of building
nested objects from this notation by adhering to a few simple rules:
- The dot marks the end of a field and the beginning of a nested field:
  `{"a.b":true} -> {a:{b:true}}`
- Leading/Trailing spaces/newlines/tabs are stripped to enable formatting:
  `{"some field .\n a property":true} -> {"some field":{"a property":true}}`
- Anything single-quoted is used as-is to allow dots and spaces in field names:
  `{" ' some field' . ' a prop. '":true} -> {" some field":{" a prop. ":true}}`
- _Single_ single quotes are nevertheless used as-is, if they are in the middle
  of the name: `{"some object . object's field":true} -> {"some
  object":{"object's field":true}}`
- At the end, empty objects are scratched from the new document:
  `{"obj.prop":"null", "obj.field":"undefined"} -> {}`
