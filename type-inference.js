'use strict';

var SymbolTable = require('./symbol-table.js');

function TypeNode(id, type, returnType) {
  this.ID = id;
  this.identifier = SymbolTable.getSymbol(id).value;
  this.type = type;
  this.returnType = returnType;
  this.typeEdges = [];
  this.returnTypeEdges = [];
}

var resolved = {},
    unresolved = {},
    seen = [];

var TypeInference = {
  print: function() {
    console.log('Unresolved');
    console.log(unresolved);
    console.log('\nResolved');
    console.log(resolved);
  },

  addKnownType: function(symID, type) {
    var node = resolved[symID];
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
    node.type = type;
  },

  addKnownReturnType: function(symID, returnType) {
    var node = resolved[symID];
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

  /**
   * TODO: Does not handle cycles
   */
  resolve: function(node) {
    if (!node) {
      for (var id in unresolved) {
        TypeInference.resolve(unresolved[id]);
      }
    } else if (seen.indexOf(node.ID) === -1) {
      seen.push(node.ID);
      var isFunction = node.ID.indexOf('FN') === 0,
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

      node.returnType.forEach(function(id) {
        var resolvedNode = resolved[id],
            unresolvedNode = unresolved[id],
            newReturnType;
        if (resolvedNode) {
          newReturnType = resolvedNode.type;
        } else if (unresolvedNode) {
          TypeInference.resolve(unresolvedNode);
          resolvedNode = resolved[id];
          if (!resolvedNode || !resolvedNode.type) {
            throw new Error('Unable to determine type for ' + id);
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
        type += ')->' + returnType;
      }
      resolved[node.ID] = {
        ID: node.ID,
        type: type,
        returnType: returnType
      };
      delete unresolved[node.ID];
    }
  }
};

TypeInference.addTypeDependency('FN001', 'PA001');
TypeInference.addKnownType('NU001', 'int');
TypeInference.addKnownType('PA001', 'int');
TypeInference.addReturnTypeDependency('FN001', 'PA001');
TypeInference.addKnownType('NU001', 'int');
TypeInference.addKnownType('PA001', 'int');
TypeInference.addKnownType('TE002', 'int');
TypeInference.addReturnTypeDependency('FN001', 'TE003');
TypeInference.addKnownType('NU002', 'int');
TypeInference.addKnownType('PA001', 'int');
TypeInference.addKnownType('TE004', 'int');
TypeInference.addReturnTypeDependency('FN001', 'TE004');
TypeInference.addKnownType('TE003', 'int');
TypeInference.addKnownType('TE005', 'int');
TypeInference.addKnownType('TE006', 'int');
TypeInference.addReturnTypeDependency('FN001', 'TE006');

//TypeInference.addReturnTypeDependency('FN002', 'FN002');
console.log('<Pre-Resolve>');
TypeInference.print();
console.log('</Pre-Resolve>\n\n');
TypeInference.resolve();
console.log('<Post-Resolve>');
TypeInference.print();
console.log('</Post-Resolve>');

module.exports = TypeInference;
