'use strict';

var Temp = require('./temp.js');

var Func = function(args, symbol, createTemp) {
  Temp.call(this, symbol.data.returnType, createTemp);
  this.args = args;
  if (!symbol.data.returnType && symbol.data.type) {
    var matches = symbol.data.type.match(/<(.+)>/);
    if (matches) {
      this.type = matches[1];
    }
  }
  if (this.type && this.type.indexOf('<') === 0) {
    this.returnType = this.type.match(/<(.+)>/)[1];
  }
};

module.exports = Func;
