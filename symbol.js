'use strict';

function Symbol(options) {
  if (!options.type) {
    throw new Error('Must specify type for symbol');
  }

  for (var key in options) {
    this[key] = options[key];
  }
  this.data = this.data || {};
  this.data.type = this.data.type || null;
}

module.exports = Symbol;
