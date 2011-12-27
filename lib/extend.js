
if (typeof Object.prototype.extend == 'undefined') {
  Object.defineProperty(Object.prototype, "extend", {
    enumerable: false,
    value: function(from) {
      var props = Object.getOwnPropertyNames(from);
      var dest = this;
      for (var x in props) {
        if (!(props[x] in dest)) {
          var destination = Object.getOwnPropertyDescriptor(from, props[x])
          Object.defineProperty(dest, props[x], destination)
        }
      }
      return this
    }
  })
}