// A simple differential index list compression library: compresses
// a list of indexes such as [2,4,5,6,8,11] into a presumably more
// efficient pattern that reads 0-2-1-1-3-1-1-2-1.

exports.compress=function(list) {
  list.sort(function(a,b) {return a-b;});
  var prefix=(list[0]?[0,list[0]]:[]);
  for (var index=0;index<list.length;index+=2) {
    var count=0, skip=0;
    do skip=list[index+(++count)]-list[index]-count;
    while (index+count<list.length && !skip);
    list.splice(index, count, count, skip);
  }
  list.pop();
  return prefix.concat(list).join('-');
};

exports.decompress=function(string) {
  string=string.split('-');
  var list=[];
  var index=0;
  while (string.length) {
    var count=parseInt(string.shift());
    while (count--) list.push(index++);
    index+=parseInt(string.shift());
  }
  return list;
};
