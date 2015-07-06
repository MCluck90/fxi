'use strict';

var SymbolTable = require('./symbol-table.js'),
    resolved = {},
    unresolved = {},
    seen = [],

TypeInference = {
  enabled: false,

  /**
   * States that the type of a symbol is known
   * @param {string} symID  Symbol ID for the known symbol
   * @param {string} type   Type of the symbol
   */
  addKnownType: function(symID, type) {
    if (!this.enabled) {
      return;
    }

    var node = resolved[symID],
        symbol = SymbolTable.getSymbol(symID);
    if (!node) {
      node = resolved[symID] = {
        ID: symID,
        type: null,
        returnType: null,
        value: symbol.value
      };
    }

    if (node.type !== null && node.type !== type) {
      // Ignore mismatching for now, will be reported in semantics
      return;
    }

    symbol = SymbolTable.getSymbol(symID);
    symbol.data.type = type;
    node.type = type;

    var unresolvedNode = unresolved[symID];
    if (unresolvedNode) {
      if (unresolvedNode.returnType.length === 0) {
        delete unresolved[symID];
      } else {
        unresolvedNode.type = [];
      }
    }
  },

  /**
   * States that the return type for a symbol is known
   * @param {string} symID      Symbol ID for the known symbol
   * @param {string} returnType Return type of the symbol
   */
  addKnownReturnType: function(symID, returnType) {
    if (!this.enabled) {
      return;
    }

    var node = resolved[symID],
        symbol = SymbolTable.getSymbol(symID);
    if (!node) {
      node = resolved[symID] = {
        ID: symID,
        type: null,
        returnType: null,
        value: symbol.value
      };
    }

    if (node.returnType !== null && node.returnType !== returnType) {
      // Ignore mismatching for now, will be reported in semantics
      return;
    }

    symbol.data.returnType = returnType;
    node.returnType = returnType;

    var unresolvedNode = unresolved[symID];
    if (unresolvedNode) {
      if (unresolvedNode.type.length === 0) {
        delete unresolved[symID];
      } else {
        unresolvedNode.returnType = [];
      }
    }
  },

  /**
   * Adds a type dependency to a symbol
   * This is also used for parameters as a functions type string
   * is a combination of it's parameters and it's return type
   * @param {string} unresolvedID   Symbol whos type is not yet known
   * @param {string} dependentID    Symbol whos type will determine the type of unresolvedID
   */
  addTypeDependency: function(unresolvedID, dependentID) {
    if (!this.enabled) {
      return;
    }

    // If the dependent is already known, use that
    var resolvedNode = resolved[dependentID];
    if (resolvedNode && resolvedNode.type) {
      this.addKnownType(unresolvedID, resolvedNode.type);
      return;
    }

    var node = unresolved[unresolvedID],
        symbol = SymbolTable.getSymbol(unresolvedID);
    if (!node) {
      node = unresolved[unresolvedID] = {
        ID: unresolvedID,
        type: [],
        returnType: [],
        value: symbol.value
      };
    }
    if (node.type.indexOf(dependentID) === -1) {
      node.type.push(dependentID);
    }
  },

  /**
   * Adds a return type dependency to a symbol
   * @param {string} unresolvedID   Symbol whos type is not yet known
   * @param {string} dependentID    Symbol whos type will determine the type of unresolvedID
   */
  addReturnTypeDependency: function(unresolvedID, dependentID) {
    if (!this.enabled) {
      return;
    }

    // If the dependent is already known, use that
    var resolvedNode = resolved[dependentID];
    if (resolvedNode && resolvedNode.type) {
      this.addKnownReturnType(unresolvedID, resolvedNode.type);
      return;
    }

    var node = unresolved[unresolvedID],
        symbol = SymbolTable.getSymbol(unresolvedID);
    if (!node) {
      node = unresolved[unresolvedID] = {
        ID: unresolvedID,
        type: [],
        returnType: [],
        value: symbol.value
      };
    }
    if (node.returnType.indexOf(dependentID) === -1) {
      node.returnType.push(dependentID);
    }
  },

  /**
   * Resolves the types for all known symbols
   * @param {Node} node Current node to resolve
   */
  resolve: function(node) {
    if (!this.enabled) {
      return;
    }

    if (!node) {
      for (var id in unresolved) {
        TypeInference.resolve(unresolved[id]);
      }
    } else if (seen.indexOf(node.ID) === -1) {
      seen.push(node.ID);
      var isFunction = node.ID.indexOf('FN') === 0 || node.ID.indexOf('LA') === 0,
          type = (isFunction) ? '(' : null,
          returnType;

      // Check through each of it's type dependencies
      // to determine the type of the symbol
      node.type.forEach(function(id) {
        var resolvedNode = resolved[id],
            unresolvedNode = unresolved[id],
            newType;
        if (resolvedNode) {
          newType = resolvedNode.type;
        } else if (unresolvedNode) {
          TypeInference.resolve(unresolvedNode);
          resolvedNode = resolved[id];
          if (resolvedNode && resolvedNode.type) {
            newType = resolvedNode.type;
          }
        } else {
          // Could not determine type, will be reported in semantics
          return;
        }

        if (isFunction) {
          // Compile the parameters into a type
          if (type.length > 1) {
            type += ',';
          }
          type += newType;
        } else {
          if (type && newType !== type) {
            // Type mismatched, will be reported in semantics
            return;
          }
          type = newType;
        }
      });

      if (isFunction) {
        type += ')->';
      }

      // Check through each of it's return type dependencies
      // to determine the return type of the symbol
      node.returnType.forEach(function(id) {
        var resolvedNode = resolved[id],
            unresolvedNode = unresolved[id],
            newReturnType;
        if (resolvedNode) {
          newReturnType = resolvedNode.type;
        } else if (unresolvedNode) {
          TypeInference.resolve(unresolvedNode);
          resolvedNode = resolved[id];
          if (id === node.ID) {
            // Does it recurse on itself? Create a recursive return type
            newReturnType = '...';
          } else if (resolvedNode && resolvedNode.type) {
            newReturnType = resolvedNode.type;
          } else {
            // Could not determine type, will be reported in semantics
            return;
          }
        } else {
          //throw new Error('Unable to determine type for ' + unresolvedNode.value);
          return;
        }

        if (returnType && newReturnType !== returnType) {
          // Type mismatched, will be reported in semantics
          return;
        }
        returnType = newReturnType;
      });

      if (!type && !returnType) {
        // Could not determine type, will be reported in semantics
        return;
      }

      if (isFunction) {
        if (returnType === '...') {
          // Recursive data type
          type += returnType;
          returnType = type;
        } else {
          type += returnType;
        }
      }

      resolved[node.ID] = {
        ID: node.ID,
        type: type,
        returnType: returnType,
        value: node.value
      };
      delete unresolved[node.ID];

      // Save the changes to the actual symbol
      var symbol = SymbolTable.getSymbol(node.ID);
      symbol.data.type = type;
      symbol.data.returnType = returnType;
    }
  }
};

module.exports = TypeInference;
