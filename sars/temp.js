'use strict';

var Symbol = require('../symbol.js'),
    SymbolTable = require('../symbol-table.js'),
    SymbolTypes = SymbolTable.SymbolTypes;

var Temp = function(type, createTemp) {
  // Make sure temps are not created during the type inference pass
  if (createTemp) {
    // Generate a temporary variable
    var tempVar = new Symbol({
      ID: SymbolTable().genSymID(SymbolTypes.Temp),
      type: SymbolTypes.Temp,
      data: {
        type: type
      }
    });
    tempVar.value = '$' + tempVar.ID;
    tempVar = SymbolTable().addSymbol(tempVar);

    this.ID = tempVar.ID;
    this.identifier = tempVar.value;
  }
  this.type = type;
};

module.exports = Temp;
