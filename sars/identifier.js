'use strict';

var Symbol = require('../symbol.js');

var Identifier = function(identifier) {
  if (identifier instanceof Symbol) {
    var symbol = identifier;
    this.ID = symbol.ID;
    this.identifier = symbol.value;
    this.type = symbol.data.type;
  } else if (typeof identifier === 'string') {
    this.identifier = identifier;
  } else {
    console.error(identifier);
    throw new Error('Unknown type of identifier');
  }
};

module.exports = Identifier;
