'use strict';

var SymbolTable = require('./symbol-table.js'),
    resolved = {},
    unresolved = {},
    seen = [],

TypeInference = {
  print: function() {
    console.log('Unresolved');
    console.log(unresolved);
    console.log('\nResolved');
    console.log(resolved);
  },

  addKnownType: function(symID, type) {
    var node = resolved[symID],
        symbol;
    if (!node) {
      node = resolved[symID] = {
        ID: symID,
        type: null,
        returnType: null
      };
    }
    if (node.type !== null && node.type !== type) {
      throw new Error('Cannot use a ' + node.type + ' as a ' + type);
    }
    symbol = SymbolTable.getSymbol(symID);
    symbol.data.type = type;
    node.type = type;
  },

  addKnownReturnType: function(symID, returnType) {
    var node = resolved[symID],
        symbol;
    if (!node) {
      node = resolved[symID] = {
        ID: symID,
        type: null,
        returnType: null
      };
    }
    if (node.returnType !== null && node.returnType !== returnType) {
      throw new Error('Must return a ' + node.returnType + ', not a ' + returnType);
    }
    symbol = SymbolTable.getSymbol(symID);
    symbol.data.returnType = returnType;
    node.returnType = returnType;
  },

  addTypeDependency: function(unresolvedID, dependentID) {
    var node = unresolved[unresolvedID];
    if (!node) {
      node = unresolved[unresolvedID] = {
        ID: unresolvedID,
        type: [],
        returnType: []
      };
    }
    if (node.type.indexOf(dependentID) === -1) {
      node.type.push(dependentID);
    }
  },

  addReturnTypeDependency: function(unresolvedID, dependentID) {
    var node = unresolved[unresolvedID];
    if (!node) {
      node = unresolved[unresolvedID] = {
        ID: unresolvedID,
        type: [],
        returnType: []
      };
    }
    if (node.returnType.indexOf(dependentID) === -1) {
      node.returnType.push(dependentID);
    }
  },

  resolve: function(node) {
    if (!node) {
      for (var id in unresolved) {
        TypeInference.resolve(unresolved[id]);
      }
    } else if (seen.indexOf(node.ID) === -1) {
      seen.push(node.ID);
      var isFunction = node.ID.indexOf('FN') === 0 || node.ID.indexOf('LA') === 0,
          type = (isFunction) ? '(' : null,
          returnType = null;
      node.type.forEach(function(id) {
        var resolvedNode = resolved[id],
            unresolvedNode = unresolved[id],
            newType;
        if (resolvedNode) {
          newType = resolvedNode.type;
        } else if (unresolvedNode) {
          TypeInference.resolve(unresolvedNode);
          resolvedNode = resolved[id];
          if (!resolvedNode || !resolvedNode.type) {
            throw new Error('Unable to determine type for ' + id);
          }
          newType = resolvedNode.type;
        } else {
          throw new Error('Unable to determine type for ' + id);
        }

        if (isFunction) {
          // Compile the parameters into a type
          if (type.length > 1) {
            type += ',';
          }
          type += newType;
        } else {
          if (type && newType !== type) {
            throw new Error('Conflicting types: ' + type + ', ' + newType);
          }
          type = newType;
        }
      });

      if (isFunction) {
        type += ')->';
      }

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
          } else if (!resolvedNode || !resolvedNode.type) {
            throw new Error('Unable to determine type for ' + id);
          } else {
            newReturnType = resolvedNode.type;
          }
        } else {
          throw new Error('Unable to determine type for ' + id);
        }

        if (returnType && newReturnType !== returnType) {
          throw new Error('Conflicting types: ' + returnType + ', ' + newReturnType);
        }
        returnType = newReturnType;
      });

      if (!type && !returnType) {
        throw new Error('Unable to determine type for ' + node.ID);
      }
      if (isFunction) {
        returnType = returnType || 'void';
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
        returnType: returnType
      };
      delete unresolved[node.ID];

      // Save the changes to the actual symbol
      var symbol = SymbolTable.getSymbol(node.ID);
      symbol.data.type = type;
      symbol.data.returnType = type;
    }
  }
};

module.exports = TypeInference;
