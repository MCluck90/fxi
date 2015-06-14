'use strict';

var Symbol = require('../symbol.js');

var Scope = function(symbol) {
  if (!(symbol instanceof Symbol)) {
    throw new Error('Expected Symbol, got ' + symbol);
  }

  this.ID = symbol.ID;
  this.symbol = symbol;
  this.type = symbol.data.type;
  this.returnType = symbol.data.returnType;
  this.params = symbol.data.params;
};

module.exports = Scope;
