'use strict';

var expect = require('expect.js'),
    Symbol = require('../symbol.js'),
    SymbolTable = require('../symbol-table.js'),
    SymbolTypes = SymbolTable.SymbolTypes,
    TypeInference = require('../type-inference.js'),
    typeState,
    symbolIDs;

function createSymbol(id, value, type, returnType, symbolType) {
  value = value || '$' + id;
  return SymbolTable().addSymbol(new Symbol({
    ID: id,
    value: value,
    type: symbolType || SymbolTypes.LocalVar,
    data: {
      type: type,
      returnType: returnType
    }
  }));
}

function getRandomID() {
  var prefixes = ['AB', 'CD', 'EF', 'GH', 'IJ'],
      prefixIndex = Math.floor(Math.random() * prefixes.length),
      idNumber = Math.floor(Math.random() * 1000) + 100,
      id = prefixes[prefixIndex] + idNumber;
  while (symbolIDs[id]) {
    prefixIndex = Math.floor(Math.random() * prefixes.length);
    idNumber = Math.floor(Math.random() * 1000) + 100;
    id = prefixes[prefixIndex] + idNumber;
  }
  symbolIDs[id] = true;
  return id;
}

function getRandomScalar() {
  var scalarTypes = ['int', 'char', 'bool'],
      index = Math.floor(Math.random() * scalarTypes.length);
  return scalarTypes[index];
}

function getRandomFunction(numOfParams) {
  if (numOfParams === undefined) {
    numOfParams = Math.floor(Math.random() * 5);
  }
  var functionType = '(';
  for (var i = 0; i < numOfParams; i++) {
    if (functionType.length > 1) {
      functionType += ',';
    }
    functionType += getRandomScalar();
  }
  functionType += ')->' + getRandomScalar();
  return functionType;
}

function getRandomType() {
  if (Math.random() < 0.5) {
    return getRandomScalar();
  } else {
    return getRandomFunction(Math.floor(Math.random() * 5));
  }
}

describe('Type Inference', function() {
  beforeEach(function() {
    symbolIDs = {};
    SymbolTable().enabled = true;
    SymbolTable().returnToGlobal();
    SymbolTable().reset();
    expect(Object.keys(SymbolTable().getAllSymbols())).to.have.length(2); // bools

    TypeInference.enabled = true;
    TypeInference.reset();
    typeState = TypeInference._getState();
    expect(typeState.resolved).to.be.empty();
    expect(typeState.unresolved).to.be.empty();
    expect(typeState.seen).to.be.empty();
  });

  describe('addKnownType', function() {
    it('should add a resolved node with the matching ID', function() {
      var id = getRandomID(),
          type = getRandomType();
      createSymbol(id);
      expect(typeState.resolved).to.be.empty();
      TypeInference.addKnownType(id, type);
      expect(typeState.resolved).to.have.key(id);
      expect(typeState.resolved[id].ID).to.be(id);
    });

    describe('Scalar Types', function() {
      it('should set the type of a node when the type is a scalar', function() {
        var id = getRandomID(),
            type = getRandomScalar();

        createSymbol(id);
        TypeInference.addKnownType(id, type);
        expect(typeState.resolved[id].type).to.be(type);
      });

      it('should mark the node as a scalar when a scalar type is given', function() {
        var id = getRandomID(),
            type = getRandomScalar(),
            node;
        createSymbol(id);
        TypeInference.addKnownType(id, type);
        node = typeState.resolved[id];
        expect(node.isScalar).to.be(true);
      });

      it('should mark the node as a non-function when a scalar type is given', function() {
        var id = getRandomID(),
            type = getRandomScalar(),
            node;
        createSymbol(id);
        TypeInference.addKnownType(id, type);
        node = typeState.resolved[id];
        expect(node.isFunction).to.be(false);
      });
    }); // Scalar Types

    describe('Function Types', function() {
      it('should set the type of a node when the type is a function', function() {
        var id = getRandomID(),
            type = getRandomFunction(),
            node;
        createSymbol(id);
        TypeInference.addKnownType(id, type);
        node = typeState.resolved[id];
        expect(node.type).to.be(type);
      });

      it('should create 1 parameter when the type contains 1 parameter', function() {
        var numOfParams = 1,
            id = getRandomID(),
            type = getRandomFunction(numOfParams),
            node;

        createSymbol(id);
        TypeInference.addKnownType(id, type);
        node = typeState.resolved[id];
        expect(node.params).to.have.length(numOfParams);
      });

      it('should create 2 parameters when the type contains 2 parameters', function() {
        var numOfParams = 2,
            id = getRandomID(),
            type = getRandomFunction(numOfParams),
            node;

        createSymbol(id);
        TypeInference.addKnownType(id, type);
        node = typeState.resolved[id];
        expect(node.params).to.have.length(numOfParams);
      });

      it('should create 50 parameters when the type contains 50 parameters', function() {
        var numOfParams = 50,
            id = getRandomID(),
            type = getRandomFunction(numOfParams),
            node;

        createSymbol(id);
        TypeInference.addKnownType(id, type);
        node = typeState.resolved[id];
        expect(node.params).to.have.length(numOfParams);
      });

      it('should create a resolved node with a matching type for each parameter', function() {
        var numOfParams = 10,
            params = [],
            id = getRandomID(),
            type = '(',
            node;
        for (var i = 0; i < numOfParams; i++) {
          params.push(getRandomScalar());
        }
        type += params.join(',') + ')->' + getRandomScalar();

        createSymbol(id);
        TypeInference.addKnownType(id, type);
        node = typeState.resolved[id];

        for (var i = 0; i < numOfParams; i++) {
          var paramID = node.params[i],
              paramType = params[i],
              paramNode = typeState.resolved[paramID];
          expect(typeState.resolved).to.have.key(paramID);
          expect(paramNode).to.be.an(Object);
          expect(paramNode.type).to.be(paramType);
        }
      });

      it('should create a function node for a function parameter', function() {
        var id = getRandomID(),
            paramType = getRandomFunction(),
            type = '(' + paramType + ')->' + getRandomType(),
            paramID,
            paramNode;

        createSymbol(id);
        TypeInference.addKnownType(id, type);
        paramID = typeState.resolved[id].params[0];
        expect(typeState.resolved).to.have.key(paramID);
        paramNode = typeState.resolved[paramID];
        expect(paramNode.type).to.be(paramType);
        expect(paramNode.isFunction).to.be(true);
      });
    }); // Function Types

    describe('Type Dependencies', function() {
      it('should destroy the matching unresolved node', function() {
        var parentID = getRandomID(),
            childID = getRandomID(),
            type = getRandomType();

        createSymbol(parentID);
        createSymbol(childID);

        TypeInference.addTypeDependency(parentID, childID);
        expect(typeState.unresolved).to.have.key(parentID);
        TypeInference.addKnownType(parentID, type);
        expect(typeState.unresolved).to.not.have.key(parentID);
      });

      it('should set the type for 1 unknown type dependency', function() {
        var parentID = getRandomID(),
            childID = getRandomID(),
            type = getRandomType();

        createSymbol(parentID);
        createSymbol(childID);

        TypeInference.addTypeDependency(parentID, childID);
        TypeInference.addKnownType(parentID, type);
        expect(typeState.resolved).to.have.key(childID);
        expect(typeState.resolved[childID].type).to.be(type);
      });

      it('should set the type for 2 unknown type dependencies', function() {
        var numOfChildren = 2,
            parentID = getRandomID(),
            childIDs = [],
            type = getRandomType();

        createSymbol(parentID);
        for (var i = 0; i < numOfChildren; i++) {
          var id = getRandomID();
          childIDs.push(id);
          createSymbol(id);
          TypeInference.addTypeDependency(parentID, id);
        }

        TypeInference.addKnownType(parentID, type);

        for (var i = 0; i < numOfChildren; i++) {
          var id = childIDs[i];
          expect(typeState.resolved).to.have.key(id);
          expect(typeState.resolved[id].type).to.be(type);
        }
      });

      it('should set the type for 50 unknown type dependencies', function() {
        var numOfChildren = 50,
            parentID = getRandomID(),
            childIDs = [],
            type = getRandomType();

        createSymbol(parentID);
        for (var i = 0; i < numOfChildren; i++) {
          var id = getRandomID();
          childIDs.push(id);
          createSymbol(id);
          TypeInference.addTypeDependency(parentID, id);
        }

        TypeInference.addKnownType(parentID, type);

        for (var i = 0; i < numOfChildren; i++) {
          var id = childIDs[i];
          expect(typeState.resolved).to.have.key(id);
          expect(typeState.resolved[id].type).to.be(type);
        }
      });

      it('should not override known type for dependency', function() {
        var parentID = getRandomID(),
            childID = getRandomID(),
            parentType = getRandomType(),
            childType = getRandomType(),
            childNode,
            parentNode;

        while (childType === parentType) {
          childType = getRandomType();
        }

        createSymbol(parentID);
        createSymbol(childID);

        TypeInference.addTypeDependency(parentID, childID);

        TypeInference.addKnownType(childID, childType);
        childNode = typeState.resolved[childID];
        expect(typeState.resolved).to.have.key(childID);
        expect(typeState.resolved).to.not.have.key(parentID);
        expect(childNode.type).to.be(childType);

        TypeInference.addKnownType(parentID, parentType);
        parentNode = typeState.resolved[parentID];
        childNode = typeState.resolved[childID];
        expect(typeState.resolved).to.have.key(childID);
        expect(typeState.resolved).to.have.key(parentID);
        expect(parentNode.type).to.be(parentType);
        expect(childNode.type).to.be(childType);
        expect(childNode.type).to.not.be(parentNode.type);
      });
    });
  }); // addKnownType

  describe('addKnownReturnType', function() {
    it('should add a resolved node with the matching ID', function() {
      var id = getRandomID(),
          returnType = getRandomType();

      createSymbol(id);
      expect(typeState.resolved).to.be.empty();
      TypeInference.addKnownReturnType(id, returnType);
      expect(typeState.resolved).to.have.key(id);
      expect(typeState.resolved[id].ID).to.be(id);
    });

    it('should set the return type when the given type is a scalar', function() {
      var id = getRandomID(),
          returnType = getRandomScalar(),
          node;
      createSymbol(id);
      TypeInference.addKnownReturnType(id, returnType);
      node = typeState.resolved[id];
      expect(node.returnType).to.be(returnType);
    });

    it('should set the return type when the given type is a function', function() {
      var id = getRandomID(),
          returnType = getRandomFunction(),
          node;
      createSymbol(id);
      TypeInference.addKnownReturnType(id, returnType);
      node = typeState.resolved[id];
      expect(node.returnType).to.be(returnType);
    });

    it('should not a set a return type if the type is known to be a scalar', function() {
      var id = getRandomID(),
          type = getRandomScalar(),
          returnType = getRandomType(),
          node;

      createSymbol(id);
      TypeInference.addKnownType(id, type);
      node = typeState.resolved[id];
      expect(node.isScalar).to.be(true);
      TypeInference.addKnownReturnType(id, returnType);
      node = typeState.resolved[id];
      expect(node.isScalar).to.be(true);
      expect(node.returnType).to.be(null);
    });

    describe('Return Type Dependencies', function() {
      it('should not destroy the matching unresolved node', function() {
        var parentID = getRandomID(),
            childID = getRandomID(),
            type = getRandomType();

        createSymbol(parentID);
        createSymbol(childID);

        TypeInference.addReturnTypeDependency(parentID, childID);
        expect(typeState.unresolved).to.have.key(parentID);
        TypeInference.addKnownReturnType(parentID, type);
        expect(typeState.unresolved).to.have.key(parentID);
      });

      it('should set the type for 1 unknown return type dependency', function() {
        var parentID = getRandomID(),
            childID = getRandomID(),
            type = getRandomType();

        createSymbol(parentID);
        createSymbol(childID);

        TypeInference.addReturnTypeDependency(parentID, childID);
        TypeInference.addKnownReturnType(parentID, type);
        expect(typeState.resolved).to.have.key(childID);
        expect(typeState.resolved[childID].type).to.be(type);
      });

      it('should set the type for 2 unknown return type dependencies', function() {
        var numOfChildren = 2,
            parentID = getRandomID(),
            childIDs = [],
            type = getRandomType();

        createSymbol(parentID);
        for (var i = 0; i < numOfChildren; i++) {
          var id = getRandomID();
          childIDs.push(id);
          createSymbol(id);
          TypeInference.addReturnTypeDependency(parentID, id);
        }

        TypeInference.addKnownReturnType(parentID, type);

        for (var i = 0; i < numOfChildren; i++) {
          var id = childIDs[i];
          expect(typeState.resolved).to.have.key(id);
          expect(typeState.resolved[id].type).to.be(type);
        }
      });

      it('should set the type for 50 unknown return type dependencies', function() {
        var numOfChildren = 50,
            parentID = getRandomID(),
            childIDs = [],
            type = getRandomType();

        createSymbol(parentID);
        for (var i = 0; i < numOfChildren; i++) {
          var id = getRandomID();
          childIDs.push(id);
          createSymbol(id);
          TypeInference.addReturnTypeDependency(parentID, id);
        }

        TypeInference.addKnownReturnType(parentID, type);

        for (var i = 0; i < numOfChildren; i++) {
          var id = childIDs[i];
          expect(typeState.resolved).to.have.key(id);
          expect(typeState.resolved[id].type).to.be(type);
        }
      });

      it('should not override known type for dependency', function() {
        var parentID = getRandomID(),
            childID = getRandomID(),
            parentType = getRandomType(),
            childType = getRandomType(),
            childNode,
            parentNode;

        while (childType === parentType) {
          childType = getRandomType();
        }

        createSymbol(parentID);
        createSymbol(childID);

        TypeInference.addReturnTypeDependency(parentID, childID);

        TypeInference.addKnownType(childID, childType);
        childNode = typeState.resolved[childID];
        expect(typeState.resolved).to.have.key(childID);
        expect(typeState.resolved).to.not.have.key(parentID);
        expect(childNode.type).to.be(childType);

        TypeInference.addKnownReturnType(parentID, parentType);
        parentNode = typeState.resolved[parentID];
        childNode = typeState.resolved[childID];
        expect(typeState.resolved).to.have.key(childID);
        expect(typeState.resolved).to.have.key(parentID);
        expect(parentNode.returnType).to.be(parentType);
        expect(childNode.type).to.be(childType);
        expect(childNode.type).to.not.be(parentNode.returnType);
      });
    });
  }); // addKnownReturnType

  describe('addTypeDependency', function() {
    it('should create an unresolved node with the parent ID', function() {
      var parentID = getRandomID(),
          childID = getRandomID();

      createSymbol(parentID);
      createSymbol(childID);

      expect(typeState.unresolved).to.be.empty();
      TypeInference.addTypeDependency(parentID, childID);
      expect(typeState.unresolved).to.have.key(parentID);
      expect(typeState.unresolved[parentID].ID).to.be(parentID);
    });

    it('should add a type dependency to the parent node', function() {
      var parentID = getRandomID(),
          childID = getRandomID(),
          node;

      createSymbol(parentID);
      createSymbol(childID);
      TypeInference.addTypeDependency(parentID, childID);
      node = typeState.unresolved[parentID];
      expect(node.type).to.have.length(1);
      expect(node.type).to.contain(childID);
    });

    it('should add the same dependency only once', function() {
      var parentID = getRandomID(),
          childID = getRandomID(),
          node;

      createSymbol(parentID);
      createSymbol(childID);
      TypeInference.addTypeDependency(parentID, childID);
      node = typeState.unresolved[parentID];
      expect(node.type).to.have.length(1);
      TypeInference.addTypeDependency(parentID, childID);
      expect(node.type).to.have.length(1);
    });

    describe('Known Types', function() {
      it('should add a known type if the child\'s type is known', function() {
        var parentID = getRandomID(),
            childID = getRandomID(),
            childType = getRandomType();

        createSymbol(parentID);
        createSymbol(childID);
        TypeInference.addKnownType(childID, childType);
        TypeInference.addTypeDependency(parentID, childID);
        expect(typeState.unresolved).to.not.have.key(parentID);
        expect(typeState.resolved).to.have.key(parentID);
        expect(typeState.resolved[parentID].type).to.be(childType);
      });

      it('should not override the known type if the child\'s type is known', function() {
        var parentID = getRandomID(),
            childID = getRandomID(),
            parentType = getRandomType(),
            childType = getRandomType(),
            parentNode,
            childNode;
        while (childType === parentType) {
          childType = getRandomType();
        }

        createSymbol(parentID);
        createSymbol(childID);
        TypeInference.addKnownType(parentID, parentType);
        TypeInference.addKnownType(childID, childType);
        TypeInference.addTypeDependency(parentID, childID);
        parentNode = typeState.resolved[parentID];
        childNode = typeState.resolved[childID];
        expect(parentNode.type).to.be(parentType);
        expect(childNode.type).to.be(childType);
        expect(parentType).to.not.be(childType);
      });

      it('should apply the type to the child if the parent\'s type is known', function() {
        var parentID = getRandomID(),
            childID = getRandomID(),
            parentType = getRandomType();

        createSymbol(parentID);
        createSymbol(childID);
        TypeInference.addKnownType(parentID, parentType);
        TypeInference.addTypeDependency(parentID, childID);
        expect(typeState.resolved).to.have.key(childID);
        expect(typeState.resolved[childID].type).to.be(parentType);
      });
    }); // Known Types
  }); // addTypeDependency

  describe('addReturnTypeDependency', function() {
    it('should create an unresolved node with a matching ID', function() {
      var parentID = getRandomID(),
          childID = getRandomID();

      createSymbol(parentID);
      createSymbol(childID);
      expect(typeState.unresolved).to.not.have.key(parentID);
      TypeInference.addReturnTypeDependency(parentID, childID);
      expect(typeState.unresolved).to.have.key(parentID);
      expect(typeState.unresolved[parentID].ID).to.be(parentID);
    });

    it('should add a return type dependency to the parent node', function() {
      var parentID = getRandomID(),
          childID = getRandomID(),
          node;

      createSymbol(parentID);
      createSymbol(childID);
      TypeInference.addReturnTypeDependency(parentID, childID);
      node = typeState.unresolved[parentID];
      expect(node.returnType).to.have.length(1);
      expect(node.returnType).to.contain(childID);
    });

    it('should add the same dependency only once', function() {
      var parentID = getRandomID(),
          childID = getRandomID(),
          node;
      createSymbol(parentID);
      createSymbol(childID);
      TypeInference.addReturnTypeDependency(parentID, childID);
      node = typeState.unresolved[parentID];
      expect(node.returnType).to.have.length(1);

      TypeInference.addReturnTypeDependency(parentID, childID);
      node = typeState.unresolved[parentID];
      expect(node.returnType).to.have.length(1);
    });

    describe('Known Types', function() {
      it('should add a known return type if the child\'s type is known', function() {
        var parentID = getRandomID(),
            childID = getRandomID(),
            childType = getRandomType();

        createSymbol(parentID);
        createSymbol(childID);
        TypeInference.addKnownType(childID, childType);
        TypeInference.addReturnTypeDependency(parentID, childID);
        expect(typeState.unresolved).to.not.have.key(parentID);
        expect(typeState.resolved).to.have.key(parentID);
        expect(typeState.resolved[parentID].returnType).to.be(childType);
      });

      it('should not add a dependency if the type has been resolved to a scalar', function() {
        var parentID = getRandomID(),
            childID = getRandomID(),
            parentType = getRandomScalar();

        createSymbol(parentID);
        createSymbol(childID);
        TypeInference.addKnownType(parentID, parentType);
        TypeInference.addReturnTypeDependency(parentID, childID);
        expect(typeState.unresolved).to.not.have.key(parentID);
      });

      it('should apply the return type to the child if the return type is known', function() {
        var parentID = getRandomID(),
            childID = getRandomID(),
            returnType = getRandomType();

        createSymbol(parentID);
        createSymbol(childID);
        TypeInference.addKnownReturnType(parentID, returnType);
        TypeInference.addReturnTypeDependency(parentID, childID);
        expect(typeState.resolved).to.have.key(childID);
        expect(typeState.resolved[childID].type).to.be(returnType);
      });

      it('should not change any types if the return type is known and the child\'s type is known', function() {
        var parentID = getRandomID(),
            childID = getRandomID(),
            parentType = getRandomType(),
            childType = getRandomType(),
            parentNode,
            childNode;
        while (childType === parentType) {
          childType = getRandomType();
        }
        createSymbol(parentID);
        createSymbol(childID);
        TypeInference.addKnownReturnType(parentID, parentType);
        TypeInference.addKnownType(childID, childType);
        parentNode = typeState.resolved[parentID];
        childNode = typeState.resolved[childID];
        expect(parentNode.returnType).to.be(parentType);
        expect(childNode.type).to.be(childType);
        TypeInference.addReturnTypeDependency(parentID, childID);
        parentNode = typeState.resolved[parentID];
        childNode = typeState.resolved[childID];
        expect(parentNode.returnType).to.be(parentType);
        expect(childNode.type).to.be(childType);
      });
    }); // Known Types
  }); // addReturnTypeDependency

  describe('addExistingParameter', function() {
    it('should add a parameter to the unresolved function node', function() {
      var functionID = getRandomID(),
          paramID = getRandomID(),
          node;
      createSymbol(functionID);
      createSymbol(paramID);
      TypeInference.addExistingParameter(functionID, paramID);
      expect(typeState.unresolved).to.have.key(functionID);
      node = typeState.unresolved[functionID];
      expect(node.params).to.have.length(1);
      expect(node.params[0]).to.be(paramID);
    });

    it('should fail if the function type is known', function() {
      var functionID = getRandomID(),
          paramID = getRandomID(),
          type = getRandomFunction();
      createSymbol(functionID);
      createSymbol(paramID);
      TypeInference.addKnownType(functionID, paramID);
      expect(function() {
        TypeInference.addExistingParameter(functionID, paramID);
      }).to.throwError();
    });
  }); // addExistingParameter

  describe('resolve', function() {
    it('should automatically insert all known types as resolved nodes', function() {
      var allSymbols = SymbolTable().getAllSymbols(),
          knownTypes = Object.keys(allSymbols).filter(function(id) {
            return allSymbols[id].data.type;
          }).map(function(id) {
            return {
              ID: id,
              type: allSymbols[id].data.type
            };
          });
      expect(knownTypes).to.not.be.empty();
      knownTypes.forEach(function(symbol) {
        expect(typeState.resolved).to.not.have.key(symbol.ID);
      });
      TypeInference.resolve();
      knownTypes.forEach(function(symbol) {
        expect(typeState.resolved).to.have.key(symbol.ID);
        expect(typeState.resolved[symbol.ID].type).to.be(symbol.type);
      });
    });

    it('should complete even if a circular dependency is made', function() {
      var parentID = getRandomID(),
          childID = getRandomID();
      createSymbol(parentID);
      createSymbol(childID);
      TypeInference.addTypeDependency(parentID, childID);
      TypeInference.addTypeDependency(childID, parentID);
      TypeInference.resolve();
    });

    describe('Basic Resolution', function() {
      describe('Child Type Known', function() {
        describe('Type', function() {
          it('should resolve the parent\'s type to the child\'s type', function() {
            var parentID = getRandomID(),
                childID = getRandomID(),
                childType = getRandomType(),
                parentNode,
                childNode;

            createSymbol(parentID);
            createSymbol(childID);
            TypeInference.addTypeDependency(parentID, childID);
            TypeInference.addKnownType(childID, childType);

            TypeInference.resolve();

            expect(typeState.resolved).to.have.key(parentID);
            parentNode = typeState.resolved[parentID];
            childNode = typeState.resolved[childID];
            expect(childNode.type).to.be(childType);
            expect(parentNode.type).to.be(childNode.type);
          });

          it('should resolve the grandparent\'s type to the child\'s type', function() {
            var grandparentID = getRandomID(),
                parentID = getRandomID(),
                childID = getRandomID(),
                childType = getRandomType(),
                grandparentNode,
                childNode;

            createSymbol(grandparentID);
            createSymbol(parentID);
            createSymbol(childID);
            TypeInference.addTypeDependency(grandparentID, parentID);
            TypeInference.addTypeDependency(parentID, childID);
            TypeInference.addKnownType(childID, childType);

            TypeInference.resolve();

            expect(typeState.resolved).to.have.key(grandparentID);
            grandparentNode = typeState.resolved[grandparentID];
            childNode = typeState.resolved[childID];
            expect(childNode.type).to.be(childType);
            expect(grandparentNode.type).to.be(childNode.type);
          });

          it('should resolve the great-grandparent\'s type to the child\'s type', function() {
            var greatGrandparentID = getRandomID(),
                grandparentID = getRandomID(),
                parentID = getRandomID(),
                childID = getRandomID(),
                childType = getRandomType(),
                greatGrandparentNode,
                childNode;

            createSymbol(greatGrandparentID);
            createSymbol(grandparentID);
            createSymbol(parentID);
            createSymbol(childID);
            TypeInference.addTypeDependency(greatGrandparentID, grandparentID);
            TypeInference.addTypeDependency(grandparentID, parentID);
            TypeInference.addTypeDependency(parentID, childID);
            TypeInference.addKnownType(childID, childType);

            TypeInference.resolve();

            expect(typeState.resolved).to.have.key(greatGrandparentID);
            greatGrandparentNode = typeState.resolved[greatGrandparentID];
            childNode = typeState.resolved[childID];
            expect(childNode.type).to.be(childType);
            expect(greatGrandparentNode.type).to.be(childNode.type);
          });
        }); // Type

        describe('Return Type', function() {
          it('should resolve the parent\'s type to the child\'s type', function() {
            var parentID = getRandomID(),
                childID = getRandomID(),
                childType = getRandomType(),
                parentNode,
                childNode;

            createSymbol(parentID);
            createSymbol(childID);
            TypeInference.addReturnTypeDependency(parentID, childID);
            TypeInference.addKnownType(childID, childType);

            TypeInference.resolve();

            expect(typeState.resolved).to.have.key(parentID);
            parentNode = typeState.resolved[parentID];
            childNode = typeState.resolved[childID];
            expect(childNode.type).to.be(childType);
            expect(parentNode.returnType).to.be(childNode.type);
          });

          it('should resolve the grandparent\'s type to the child\'s type', function() {
            var grandparentID = getRandomID(),
                parentID = getRandomID(),
                childID = getRandomID(),
                childType = getRandomType(),
                grandparentNode,
                childNode;

            createSymbol(grandparentID);
            createSymbol(parentID);
            createSymbol(childID);
            TypeInference.addReturnTypeDependency(grandparentID, parentID);
            TypeInference.addTypeDependency(parentID, childID);
            TypeInference.addKnownType(childID, childType);

            TypeInference.resolve();

            expect(typeState.resolved).to.have.key(grandparentID);
            grandparentNode = typeState.resolved[grandparentID];
            childNode = typeState.resolved[childID];
            expect(childNode.type).to.be(childType);
            expect(grandparentNode.returnType).to.be(childNode.type);
          });

          it('should resolve the great-grandparent\'s type to the child\'s type', function() {
            var greatGrandparentID = getRandomID(),
                grandparentID = getRandomID(),
                parentID = getRandomID(),
                childID = getRandomID(),
                childType = getRandomType(),
                greatGrandparentNode,
                childNode;

            createSymbol(greatGrandparentID);
            createSymbol(grandparentID);
            createSymbol(parentID);
            createSymbol(childID);
            TypeInference.addReturnTypeDependency(greatGrandparentID, grandparentID);
            TypeInference.addTypeDependency(grandparentID, parentID);
            TypeInference.addTypeDependency(parentID, childID);
            TypeInference.addKnownType(childID, childType);

            TypeInference.resolve();

            expect(typeState.resolved).to.have.key(greatGrandparentID);
            greatGrandparentNode = typeState.resolved[greatGrandparentID];
            childNode = typeState.resolved[childID];
            expect(childNode.type).to.be(childType);
            expect(greatGrandparentNode.returnType).to.be(childNode.type);
          });
        }); // Return Type
      }); // Child Type Known

      describe('Child Type Unknown', function() {
        describe('Type', function() {
          it('should not resolve the parent\'s type', function() {
            var parentID = getRandomID(),
                childID = getRandomID(),
                childType = getRandomType(),
                parentNode,
                childNode;

            createSymbol(parentID);
            createSymbol(childID);
            TypeInference.addTypeDependency(parentID, childID);

            TypeInference.resolve();

            expect(typeState.resolved).to.not.have.key(parentID);
          });

          it('should not resolve the grandparent\'s type', function() {
            var grandparentID = getRandomID(),
                parentID = getRandomID(),
                childID = getRandomID(),
                childType = getRandomType(),
                grandparentNode,
                childNode;

            createSymbol(parentID);
            createSymbol(childID);
            TypeInference.addTypeDependency(grandparentID, parentID);
            TypeInference.addTypeDependency(parentID, childID);

            TypeInference.resolve();

            expect(typeState.resolved).to.not.have.key(grandparentID);
          });

          it('should not resolve the great-grandparent\'s type', function() {
            var greatGrandparentID = getRandomID(),
                grandparentID = getRandomID(),
                parentID = getRandomID(),
                childID = getRandomID(),
                childType = getRandomType(),
                greatGrandparentNode,
                childNode;

            createSymbol(parentID);
            createSymbol(childID);
            TypeInference.addTypeDependency(greatGrandparentID, grandparentID);
            TypeInference.addTypeDependency(grandparentID, parentID);
            TypeInference.addTypeDependency(parentID, childID);

            TypeInference.resolve();

            expect(typeState.resolved).to.not.have.key(greatGrandparentID);
          });
        }); // Type

        describe('Return Type', function() {
          it('should not resolve the parent\'s type', function() {
            var parentID = getRandomID(),
                childID = getRandomID(),
                childType = getRandomType(),
                parentNode,
                childNode;

            createSymbol(parentID);
            createSymbol(childID);
            TypeInference.addReturnTypeDependency(parentID, childID);

            TypeInference.resolve();

            expect(typeState.resolved).to.not.have.key(parentID);
          });

          it('should not resolve the grandparent\'s type', function() {
            var grandparentID = getRandomID(),
                parentID = getRandomID(),
                childID = getRandomID(),
                childType = getRandomType(),
                grandparentNode,
                childNode;

            createSymbol(parentID);
            createSymbol(childID);
            TypeInference.addReturnTypeDependency(grandparentID, parentID);
            TypeInference.addTypeDependency(parentID, childID);

            TypeInference.resolve();

            expect(typeState.resolved).to.not.have.key(grandparentID);
          });

          it('should not resolve the great-grandparent\'s type', function() {
            var greatGrandparentID = getRandomID(),
                grandparentID = getRandomID(),
                parentID = getRandomID(),
                childID = getRandomID(),
                childType = getRandomType(),
                greatGrandparentNode,
                childNode;

            createSymbol(parentID);
            createSymbol(childID);
            TypeInference.addReturnTypeDependency(greatGrandparentID, grandparentID);
            TypeInference.addTypeDependency(grandparentID, parentID);
            TypeInference.addTypeDependency(parentID, childID);

            TypeInference.resolve();

            expect(typeState.resolved).to.not.have.key(greatGrandparentID);
          });
        }); // Return Type
      }); // Child Type Unknown

      describe('Sibling Known', function() {
        describe('Type', function() {
          it('should resolve a childs type to it\'s siblings type when the type cannot be resolved', function() {
            var parentID = getRandomID(),
                childID = getRandomID(),
                siblingID = getRandomID(),
                siblingType = getRandomType();

            createSymbol(parentID);
            createSymbol(childID);
            createSymbol(siblingID);

            TypeInference.addTypeDependency(parentID, childID);
            TypeInference.addTypeDependency(parentID, siblingID);
            TypeInference.addKnownType(siblingID, siblingType);
            TypeInference.resolve();
            expect(typeState.resolved).to.have.key(childID);
            expect(typeState.resolved[childID].type).to.be(siblingType);
          });

          it('should not overwrite a childs type if it\'s siblings type is known', function() {
            var parentID = getRandomID(),
                childID = getRandomID(),
                siblingID = getRandomID(),
                childType = getRandomType(),
                siblingType = getRandomType();
            while (siblingType === childType) {
              siblingType = getRandomType();
            }

            createSymbol(parentID);
            createSymbol(childID);
            createSymbol(siblingID);

            TypeInference.addTypeDependency(parentID, childID);
            TypeInference.addTypeDependency(parentID, siblingID);
            TypeInference.addKnownType(childID, childType);
            TypeInference.addKnownType(siblingID, siblingType);
            TypeInference.resolve();
            expect(typeState.resolved[childID].type).to.be(childType);
            expect(typeState.resolved[siblingID].type).to.be(siblingType);
          });

          it('should assign first child\'s type to parent', function() {
            var parentID = getRandomID(),
                childID = getRandomID(),
                siblingID = getRandomID(),
                childType = getRandomType(),
                siblingType = getRandomType();
            while (siblingType === childType) {
              siblingType = getRandomType();
            }

            createSymbol(parentID);
            createSymbol(childID);
            createSymbol(siblingID);

            TypeInference.addTypeDependency(parentID, childID);
            TypeInference.addTypeDependency(parentID, siblingID);
            TypeInference.addKnownType(childID, childType);
            TypeInference.addKnownType(siblingID, siblingType);
            TypeInference.resolve();
            expect(typeState.resolved[parentID].type).to.be(childType);
          });
        }); // Type

        describe('Return Type', function() {
          it('should resolve a childs type to it\'s siblings type when the type cannot be resolved', function() {
            var parentID = getRandomID(),
                childID = getRandomID(),
                siblingID = getRandomID(),
                siblingType = getRandomType();

            createSymbol(parentID);
            createSymbol(childID);
            createSymbol(siblingID);

            TypeInference.addReturnTypeDependency(parentID, childID);
            TypeInference.addReturnTypeDependency(parentID, siblingID);
            TypeInference.addKnownType(siblingID, siblingType);
            TypeInference.resolve();
            expect(typeState.resolved).to.have.key(childID);
            expect(typeState.resolved[childID].type).to.be(siblingType);
          });

          it('should not overwrite a childs type if it\'s siblings type is known', function() {
            var parentID = getRandomID(),
                childID = getRandomID(),
                siblingID = getRandomID(),
                childType = getRandomType(),
                siblingType = getRandomType();
            while (siblingType === childType) {
              siblingType = getRandomType();
            }

            createSymbol(parentID);
            createSymbol(childID);
            createSymbol(siblingID);

            TypeInference.addReturnTypeDependency(parentID, childID);
            TypeInference.addReturnTypeDependency(parentID, siblingID);
            TypeInference.addKnownType(childID, childType);
            TypeInference.addKnownType(siblingID, siblingType);
            TypeInference.resolve();
            expect(typeState.resolved[childID].type).to.be(childType);
            expect(typeState.resolved[siblingID].type).to.be(siblingType);
          });

          it('should assign first child\'s type to parent', function() {
            var parentID = getRandomID(),
                childID = getRandomID(),
                siblingID = getRandomID(),
                childType = getRandomType(),
                siblingType = getRandomType();
            while (siblingType === childType) {
              siblingType = getRandomType();
            }

            createSymbol(parentID);
            createSymbol(childID);
            createSymbol(siblingID);

            TypeInference.addReturnTypeDependency(parentID, childID);
            TypeInference.addReturnTypeDependency(parentID, siblingID);
            TypeInference.addKnownType(childID, childType);
            TypeInference.addKnownType(siblingID, siblingType);
            TypeInference.resolve();
            expect(typeState.resolved[parentID].returnType).to.be(childType);
          });
        }); // Return Type
      }); // Sibling Known
    }); // Basic Resolution

    describe('Symbol Table', function() {
      it('should save a scalar type of a known symbol to the symbol table', function() {
        var id = getRandomID(),
            type = getRandomScalar(),
            symbol;
        createSymbol(id);
        TypeInference.addKnownType(id, type);
        TypeInference.resolve();
        symbol = SymbolTable.getSymbol(id);
        expect(symbol).to.be.ok();
        expect(symbol.data.type).to.be(type);
        expect(symbol.data.isScalar).to.be(true);
      });

      it('should save a function type of a known symbol to the symbol table', function() {
        var id = getRandomID(),
            type = getRandomFunction(),
            symbol;
        createSymbol(id);
        TypeInference.addKnownType(id, type);
        TypeInference.resolve();
        symbol = SymbolTable.getSymbol(id);
        expect(symbol).to.be.ok();
        expect(symbol.data.type).to.be(type);
        expect(symbol.data.isFunction).to.be(true);
      });

      it('should save the return type to a symbol when a function type is set', function() {
        var id = getRandomID(),
            returnType = getRandomScalar(),
            type = '()->' + returnType,
            symbol;
        createSymbol(id);
        TypeInference.addKnownType(id, type);
        TypeInference.resolve();
        symbol = SymbolTable.getSymbol(id);
        expect(symbol).to.be.ok();
        expect(symbol.data.returnType).to.be(returnType);
      });

      it('should save zero parameters when the inferred type has no parameters', function() {
        var id = getRandomID(),
            type = getRandomFunction(0),
            symbol;
        createSymbol(id);
        TypeInference.addKnownType(id, type);
        TypeInference.resolve();
        symbol = SymbolTable.getSymbol(id);
        expect(symbol).to.be.ok();
        expect(symbol.data.params).to.be.empty();
      });

      it('should save one parameter when the inferred type takes one parameter', function() {
        var id = getRandomID(),
            type = getRandomFunction(1),
            symbol;
        createSymbol(id);
        TypeInference.addKnownType(id, type);
        TypeInference.resolve();
        symbol = SymbolTable.getSymbol(id);
        expect(symbol).to.be.ok();
        expect(symbol.data.params).to.have.length(1);
      });

      it('should save two parameters when the inferred type takes two parameters', function() {
        var id = getRandomID(),
            type = getRandomFunction(2),
            symbol;
        createSymbol(id);
        TypeInference.addKnownType(id, type);
        TypeInference.resolve();
        symbol = SymbolTable.getSymbol(id);
        expect(symbol).to.be.ok();
        expect(symbol.data.params).to.have.length(2);
      });

      it('should not set type if type could not be inferred', function() {
        var parentID = getRandomID(),
            childID = getRandomID(),
            parentSymbol,
            childSymbol;
        createSymbol(parentID);
        createSymbol(childID);
        TypeInference.addTypeDependency(parentID, childID);
        TypeInference.resolve();
        parentSymbol = SymbolTable.getSymbol(parentID);
        childSymbol = SymbolTable.getSymbol(childID);
        expect(typeState.resolved).to.not.have.keys([parentID, childID]);
        expect(parentSymbol.data.type).to.not.be.ok();
        expect(childSymbol.data.type).to.not.be.ok();
      });

      it('should not set return type if type could not be inferred', function() {
        var parentID = getRandomID(),
            childID = getRandomID(),
            parentSymbol,
            childSymbol;
        createSymbol(parentID);
        createSymbol(childID);
        TypeInference.addReturnTypeDependency(parentID, childID);
        TypeInference.resolve();
        parentSymbol = SymbolTable.getSymbol(parentID);
        childSymbol = SymbolTable.getSymbol(childID);
        expect(typeState.resolved).to.not.have.keys([parentID, childID]);
        expect(parentSymbol.data.returnType).to.not.be.ok();
        expect(childSymbol.data.returnType).to.not.be.ok();
      });
    }); // Symbol Table

    describe('Advanced Resolution', function() {
      it('should fail to resolve type if no known types are given', function() {
        var parentID = getRandomID(),
            childID = getRandomID();
        createSymbol(parentID);
        createSymbol(childID);
        TypeInference.addTypeDependency(parentID, childID);
        TypeInference.resolve();
        expect(typeState.resolved).to.not.have.keys([parentID, childID]);
      });

      it('should fail to resolve type if children types are not known', function() {
        var grandparentID = getRandomID(),
            parentID = getRandomID(),
            childID = getRandomID();
        createSymbol(grandparentID);
        createSymbol(parentID);
        createSymbol(childID);
        TypeInference.addTypeDependency(grandparentID, parentID);
        TypeInference.addTypeDependency(parentID, childID);
        TypeInference.resolve();
        expect(typeState.resolved).to.not.have.keys([grandparentID, parentID, childID]);
      });

      it('should fail to resolve type if grandchildren types are not known', function() {
        var greatGrandparentID = getRandomID(),
            grandparentID = getRandomID(),
            parentID = getRandomID(),
            childID = getRandomID();
        createSymbol(greatGrandparentID);
        createSymbol(grandparentID);
        createSymbol(parentID);
        createSymbol(childID);
        TypeInference.addTypeDependency(greatGrandparentID, grandparentID);
        TypeInference.addTypeDependency(grandparentID, parentID);
        TypeInference.addTypeDependency(parentID, childID);
        TypeInference.resolve();
        expect(typeState.resolved).to.not.have.keys([
          greatGrandparentID,
          grandparentID,
          parentID,
          childID
        ]);
      });

      it('should determine type from one known parameter', function() {
        var functionID = getRandomID(),
            paramID = getRandomID(),
            paramType = getRandomType(),
            returnType = getRandomType(),
            expectedType = '(' + paramType + ')->' + returnType;
        createSymbol(functionID);
        createSymbol(paramID);
        TypeInference.addExistingParameter(functionID, paramID);
        TypeInference.addKnownReturnType(functionID, returnType);
        TypeInference.addKnownType(paramID, paramType);
        TypeInference.resolve();
        expect(typeState.resolved).to.have.key(functionID);
        expect(typeState.resolved[functionID].type).to.be(expectedType);
      });
    }); // Advanced Resolution
  }); // resolve
});
