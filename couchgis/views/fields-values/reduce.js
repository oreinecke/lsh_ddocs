function reduce(keys, values, rereduce) {
  var result=values[0];
  for (var v=1;v<values.length;v++) {
    var value=values[v];
    result.count+=value.count;
    if (result.type==="number") {
      if (value.min<result.min) result.min=value.min;
      if (value.max>result.max) result.max=value.max;
    }
  }
  return result;
}