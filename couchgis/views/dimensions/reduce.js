// Unify bboxes for viewport initialization.
// Also unify time ranges as general info.

function(keys, values) {
  ;function lesser(a, b) {
    // Do not expand to -infinity, because
    // these are covered by any range anyway.
    if (!a.length) return b;
    if (!b.length) return a;
    for (var d=0;d<3;d++) {
      if (d===a.length) return a;
      if (d===b.length) return b;
      if (a[d]<b[d]) return a;
      if (a[d]>b[d]) return b;
    }
    return a;
  }
  ;function greater(a, b) {
    if (!a.length) return b;
    if (!b.length) return a;
    for (var d=0;d<3;d++) {
      if (d===a.length) return a;
      if (d===b.length) return b;
      if (a[d]>b[d]) return a;
      if (a[d]<b[d]) return b;
    }
    return a;
  }
  var value=values.pop();
  var bbox=value.bbox;
  var range=value.ranges;
  range={begin:range[0].begin, end:range[range.length-1].end};
  while ( value=values.pop() ) {
    var ranges=value.ranges;
    range.begin=lesser(range.begin,ranges[0].begin);
    range.end=greater(range.end,ranges[ranges.length-1].end);
    var bbox2=value.bbox;
    if (!bbox) bbox=bbox2;
    if (!bbox || !bbox2) continue;
    bbox[0]=(bbox[0]<bbox2[0]?bbox:bbox2)[0];
    bbox[1]=(bbox[1]<bbox2[1]?bbox:bbox2)[1];
    bbox[2]=(bbox[2]>bbox2[2]?bbox:bbox2)[2];
    bbox[3]=(bbox[3]>bbox2[3]?bbox:bbox2)[3];
  }
  return {bbox:bbox, ranges:[range]};
}
