'use strict';

var Temp = require('./temp.js');

var Func = function(args, symbol, createTemp) {
  Temp.call(this, symbol.data.returnType, createTemp);
  this.args = args;
  if (!symbol.data.returnType && symbol.data.type) {
    var types = symbol.data.type.split('->');
    if (types) {
      this.type = types[types.length - 1];
    }
  }
  if (this.type && this.type.indexOf('->') > 0) {
    var types = this.type.split('->');
    this.returnType = types[types.length - 1];
  }
};

module.exports = Func;
