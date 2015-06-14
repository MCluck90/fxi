'use strict';

var Literal = function(type, value, id) {
  this.type = type;
  this.value = value;
  this.identifier = value;
  this.ID = id;
};

module.exports = Literal;
