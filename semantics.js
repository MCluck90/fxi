'use strict';

var Stack = require('./semantic-stack.js'),
    SymbolTable = require('./symbol-table.js'),

    Identifier = require('./sars/identifier.js');

var Semantics = {
  enabled: false,

  /**
   * Pushes an identifier on to the action stack
   * @param {string} identifier
   */
  iPush: function(identifier) {
    if (!this.enabled) {
      return;
    }

    var symbol = SymbolTable().findSymbol(identifier);
    if (symbol) {
      Stack.action.push(new Identifier(symbol));
    } else {
      Stack.action.push(new Identifier(identifier));
    }
  }
};

module.exports = Semantics;
