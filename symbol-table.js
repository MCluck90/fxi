'use strict';

var Symbol = require('./symbol.js'),
    symID = 100,
    SymbolTypes = {
      Fn: 'Fn',
      Lambda: 'Lambda',
      Param: 'Param',
      LocalVar: 'LocalVar',
      FreeVar: 'FreeVar',
      NumberLiteral: 'NumberLiteral',
      CharacterLiteral: 'CharacterLiteral',
      BooleanLiteral: 'BooleanLiteral',
      Temp: 'Temp'
    },
    typeToLetter = {},
    allSymbols = {},
    currentScope,
    SymbolTable;

// What should be prepended to the symbol IDs
typeToLetter[SymbolTypes.Fn]                = 'FN';
typeToLetter[SymbolTypes.Param]             = 'PA';
typeToLetter[SymbolTypes.Lambda]            = 'LA';
typeToLetter[SymbolTypes.LocalVar]          = 'LV';
typeToLetter[SymbolTypes.FreeVar]           = 'FV';
typeToLetter[SymbolTypes.NumberLiteral]     = 'NU';
typeToLetter[SymbolTypes.CharacterLiteral]  = 'CH';
typeToLetter[SymbolTypes.BooleanLiteral]    = 'BO';
typeToLetter[SymbolTypes.Temp]              = 'TE';

/**
 * Generates built-in values and types
 */
function createBuiltIns() {
  SymbolTable().addLiteral({
    type: SymbolTypes.BooleanLiteral,
    value: 'true',
    data: {
      type: 'bool'
    }
  });

  SymbolTable().addLiteral({
    type: SymbolTypes.BooleanLiteral,
    value: 'false',
    data: {
      type: 'bool'
    }
  });
}

/**
 * Returns the symbol with the matching ID
 * @param {string} id
 * @returns {Symbol}
 */
function getSymbol(id) {
  if (!allSymbols[id]) {
    throw new Error('No symbol matching ID: ' + id);
  }
  return allSymbols[id];
}

/**
 * Determines if the given symbol is a literal
 * @param {Symbol|string} type  Either a symbol or a symbol type string
 * @returns {bool}
 */
function isLiteral(type) {
  type = type.type || type;

  return type === SymbolTypes.CharacterLiteral ||
         type === SymbolTypes.NumberLiteral ||
         type === SymbolTypes.BooleanLiteral;
}

/**
 * Checks to see if a symbol matches any of the given types
 * @param {Symbol}          symbol
 * @param {string|string[]} types   Array of types or a single type
 */
function isType(symbol, types) {
  if (typeof symbol === 'string') {
    symbol = getSymbol(symbol);
  }
  if (typeof types === 'string') {
    // In case the user only wants to check one type
    return symbol.type === types;
  }

  for (var i = 0, len = types.length; i < len; i++) {
    if (symbol.type === types[i]) {
      return true;
    }
  }
  return false;
}

/**
 * Sorts keys based on length
 * @param {string}  a
 * @param {string}  b
 * @returns {number}
 */
function _sortKeysOnLength(a, b) {
  if (a.length < b.length) {
    return -1;
  } else if (a.length === b.length) {
    return 0;
  } else {
    return 1;
  }
}

/**
 * Tracks and generates SymbolTypes
 * @param {SymbolTable?}  parent  Parent scope
 * @param {Symbol?}       symbol  Symbol matching the current scope
 */
SymbolTable = function(parent, symbol) {
  this.enabled = (parent) ? parent.enabled : true;
  this._parent = parent;
  this._symbols = {};
  // Used for tracking anonymous functions
  this._lambdaCount = 0;
  this._lambdaIDs = [];
  this.symbol = symbol;
};

SymbolTable.prototype = {
  /**
   * Creates a new scope and attaches it to a symbol
   * @param {Symbol}  symbol
   * @returns {SymbolTable}
   */
  createScope: function(symbol) {
    if (!this.enabled) {
      return symbol.innerScope;
    }

    symbol.innerScope = new SymbolTable(currentScope, symbol);
    return symbol.innerScope;
  },

  /**
   * Sets the current scope
   * @param {Symbol|SymbolTable}  scope
   */
  setScope: function(scope) {
    if (scope instanceof Symbol) {
      var symbol = scope;
      if (!symbol.innerScope) {
        symbol.innerScope = this.createScope(symbol);
      }
      currentScope = symbol.innerScope;
    } else if (scope instanceof SymbolTable) {
      currentScope = scope;
    } else {
      console.error(scope);
      throw new Error('Attempting to set scope as non-scope: ' + scope);
    }

    currentScope.enabled = this.enabled;
  },

  /**
   * Return to the parent scope
   * @returns {bool} Returns true if the scope changed
   */
  exitScope: function() {
    if (currentScope._parent) {
      currentScope = currentScope._parent;
      return true;
    }

    return false;
  },

  /**
   * Sets the current scope to the global scope
   */
  returnToGlobal: function() {
    while (currentScope._parent) {
      this.exitScope();
    }
  },

  /**
   * Returns the global scope
   * @returns {SymbolTable}
   */
  getGlobal: function() {
    var scope = currentScope;
    while (scope._parent) {
      scope = scope._parent;
    }
    return scope;
  },

  /**
   * Adds a symbol to the table
   * @param {Symbol}  symbol
   * @returns {Symbol} Returns the symbol
   */
  addSymbol: function(symbol) {
    if (!(symbol instanceof Symbol)) {
      console.error(symbol);
      throw new Error('Attempting to add non-symbol to table: ' + symbol);
    }

    var isAnonymousFunction = (symbol.type === SymbolTypes.Lambda);
    if (!this.enabled) {
      if (isAnonymousFunction) {
        var lambdaID = this._lambdaIDs[this._lambdaCount];
        if (!lambdaID) {
          throw new Error('Unable to retrieve lambda: ' + symbol.value);
        }
        return allSymbols[lambdaID];
      } else {
        return this.findSymbol(symbol.value);
      }
    }

    // If it might be a free variable, find out for sure. Otherwise, don't add it
    var freeVar;
    if (symbol.type === SymbolTypes.FreeVar) {
      freeVar = this.findSymbol(symbol.value);
      if (!freeVar) {
        // Doesn't exist, don't add it
        return null;
      } else if (freeVar.scope === this) {
        // Don't worry about adding it
        return freeVar;
      }
    }

    if (!symbol.ID) {
      symbol.ID = this.genSymID(symbol);
    }

    if (isAnonymousFunction) {
      symbol.value = '=>' + symbol.ID;
    } else if (symbol.type === SymbolTypes.Temp) {
      symbol.value = '$' + symbol.ID;
    } else if (symbol.type !== SymbolTypes.Param) {
      // It's a free variable, mark it as such
      freeVar = this.findSymbol(symbol.value);
      if (freeVar) {
        freeVar.data.isFreeVar = true;
        symbol.type = SymbolTypes.FreeVar;
        symbol.data.original = freeVar;
        if (freeVar.data.type) {
          symbol.data.type = freeVar.data.type;
        }
      }
    }

    symbol.scope = currentScope;
    if (this._symbols[symbol.value]) {
      symbol.isDuplicate = true;
    }
    this._symbols[symbol.value] = symbol;
    allSymbols[symbol.ID] = symbol;

    // If it's a lambda, store it in a special place to be retrieved later
    if (symbol.type === SymbolTypes.Lambda) {
      this._lambdaIDs.push(symbol.ID);
      this._lambdaCount++;
    }
    return symbol;
  },

  /**
   * Adds a literal value to the global scope
   * @param {Symbol}  symbol
   * @returns {Symbol} Returns the symbol
   */
  addLiteral: function(symbol) {
    symbol.value = symbol.value.toString();
    var existingLiteral = this.findLiteral(symbol.value);
    if (existingLiteral) {
      return existingLiteral;
    }

    return this.getGlobal().addSymbol(symbol);
  },

  /**
   * Finds a symbol with a matching value
   */
  findSymbol: function(value) {
    if (this._symbols[value]) {
      return this._symbols[value];
    } else if (this._parent) {
      return this._parent.findSymbol(value);
    } else {
      return null;
    }
  },

  /**
   * Find a literal value
   * @param {string} value  Ex: 1, 'c', etc.
   * @returns {Symbol?}  Return the matching symbol or null
   */
  findLiteral: function(value) {
    value = value.toString();
    var globalScope = this.getGlobal(),
        symbol = globalScope._symbols[value];
    if (isLiteral(symbol)) {
      return symbol;
    }
    return null;
  },

  /**
   * Generates a unique symbol ID
   * @param {Symbol|string} symbol  A symbol or a symbol type string
   * @returns {string}
   */
  genSymID: function(symbol) {
    if (symbol.ID) {
      return symbol.ID;
    }

    var type = symbol.type || symbol;
    if (!this.enabled && (type !== SymbolTypes.Temp || isLiteral(symbol))) {
      return typeToLetter[type] + symID++;
    }
    return typeToLetter[type] + symID++;
  },

  /**
   * Resets the symbol table
   * @param {bool}  [isRoot=true] If true, generates a new table
   */
  reset: function(isRoot) {
    isRoot = (isRoot === undefined);
    for (var name in this._symbols) {
      var symbol = this._symbols[name];
      if (symbol.innerScope) {
        symbol.innerScope.reset(false);
      }

      delete this._symbols[name];
    }
    this._lambdaCount = 0;

    if (isRoot) {
      currentScope = new SymbolTable();
      createBuiltIns();
    }
  },

  /**
   * Prints out the entire symbol table
   */
  print: function() {
    var name;
    if (this.symbol) {
      console.log('');
      name = this.symbol.value;
    } else {
      name = 'Global';
    }

    console.log('== ' + name + ' ==');
    var nestedScopes = [];
    Object.keys(this._symbols).sort().forEach(function(value) {
      console.log(value + ':');
      var symbol = this[value],
          symbolKeys = Object.keys(symbol).sort();
      symbolKeys.forEach(function(key) {
        if (key.toLowerCase().indexOf('scope') > -1) {
          if (key === 'innerScope') {
            nestedScopes.push(symbol.innerScope);
          }
          return;
        } else if (key === 'data') {
          var dataKeys = Object.keys(symbol.data).sort(_sortKeysOnLength);
          if (dataKeys.length > 0) {
            console.log('  data: ');
            dataKeys.forEach(function(dataKey) {
              var val = symbol.data[dataKey];
              if (val instanceof Symbol) {
                val = val.ID;
              }
              console.log('    ' + dataKey + ': ' + val);
            });
          }
        } else {
          console.log('  ' + key + ': ' + symbol[key]);
        }
      });
    }, this._symbols);

    nestedScopes.forEach(function(scope) {
      scope.print();
    });
  }
};

currentScope = new SymbolTable();

module.exports = function() {
  return currentScope;
};
module.exports.SymbolTypes = SymbolTypes;
module.exports.getSymbol = getSymbol;
module.exports.isLiteral = isLiteral;
module.exports.isType = isType;
