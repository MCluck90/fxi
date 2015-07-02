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
    unresolved = {};

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
  resolve: function() {
    var unresolvedIDs = Object.keys(unresolved);
    while (unresolvedIDs.length) {
      var nodeID = unresolvedIDs[unresolvedIDs.length - 1],
          node = unresolved[nodeID],
          typeDependencies = node.type,
          returnTypeDependencies = node.returnType,
          newType = null,
          newReturnType = null;
      for (var i = 0; i < typeDependencies.length; i++) {
        var typeID = typeDependencies[i];
        if (!resolved[typeID]) {
          continue;
        }
        if (!resolved[typeID].type) {
          console.log('Warn: Unresolved type in resolved set -> ' + typeID);
          continue;
        }
        var resolvedType = resolved[typeID].type;
        if (nodeID.indexOf('FN') === 0) {
          newType = newType || '(';
          if (newType.length > 1) {
            newType += ',';
          }
          newType += resolvedType;
        } else {
          if (newType && resolvedType !== newType) {
            throw new Error('Conflicting types: ' + newType + ', ' + resolvedType);
          }
          newType = resolvedType;
        }
      }
      for (var i = 0; i < returnTypeDependencies.length; i++) {
        var returnTypeID = returnTypeDependencies[i];
        if (!resolved[returnTypeID]) {
          continue;
        }
        if (!resolved[returnTypeID].type) {
          console.log('Warn: Unresolved return type in resolved set -> ' + returnTypeID);
          continue;
        }
        var resolvedReturnType = resolved[returnTypeID].type;
        if (newReturnType && resolvedReturnType !== newReturnType) {
          throw new Error('Conflicting types: ' + newReturnType + ', ' + resolvedReturnType);
        }
        newReturnType = resolvedReturnType;
      }

      if ((newType || !typeDependencies.length) && (newReturnType || !returnTypeDependencies.length)) {
        if (nodeID.indexOf('FN') === 0) {
          newType += ')->' + newReturnType;
        }
        resolved[nodeID] = {
          type: newType,
          returnType: newReturnType
        };
        delete unresolved[nodeID];
        unresolvedIDs.pop();
      }
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
TypeInference.addKnownType('CH001', 'char');
console.log('<Pre-Resolve>');
TypeInference.print();
console.log('</Pre-Resolve>\n\n');
TypeInference.resolve();
console.log('<Post-Resolve>');
TypeInference.print();
console.log('</Post-Resolve>');

module.exports = TypeInference;
