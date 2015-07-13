'use strict';

/*******
TODO: What about nodes not explicitly entered?
Example: true, false, numbers, etc.
*******/

/**
 * Parses out the parts of a function type or returns the type
 * @param {string} typeString
 * @returns {string|object} String if it's not a function.
                            Otherwise, an object containing the parts
 */
function parseFunctionType(typeString) {
  if (!typeString) {
    return null;
  }

  var hasArrow = typeString.indexOf('->') !== -1,
      hasParameters = typeString.indexOf('(') !== -1 &&
                      typeString.indexOf(')') !== -1,
      isFunction = hasArrow && hasParameters;
  if (!isFunction) {
    return typeString;
  }

  // Remove whitespace from type string
  typeString = typeString.replace(/ /g, '');

  var parenCount = 1,
      parameters = [],
      returnType,
      startReturnTypeIndex,
      parameterType = '';

  // Skip the starting parenthese
  for (var i = 1, len = typeString.length; i < len; i++) {
    var character = typeString[i];
    if (character === '(') {
      parenCount++;
    } else if (character === ')') {
      parenCount--;
    }
    if (parenCount === 0) {
      // Make sure any trailing parameters are taken care of
      if (parameterType) {
        parameters.push(parameterType);
      }

      // Account for the arrow
      startReturnTypeIndex = i + 3;
      break;
    }

    if (parenCount > 1 || character !== ',') {
      parameterType += character;
    } else {
      parameters.push(parameterType);
      parameterType = '';
    }
  }

  // Parse out the return type
  returnType = typeString.substring(startReturnTypeIndex);

  return {
    type: typeString,
    parameters: parameters,
    returnType: returnType
  };
}

var Symbol = require('./symbol.js'),
    SymbolTable = require('./symbol-table.js'),
    SymbolTypes = SymbolTable.SymbolTypes,
    resolved = {},
    unresolved = {},
    seen = [],

TypeInference = {
  enabled: false,

  /**
   * Resets the type inference system
   */
  reset: function() {
    resolved = {};
    unresolved = {};
    seen = [];
  },

  /**
   * Returns the current state of the type inference system
   * Used for debugging
   */
  _getState: function() {
    return {
      resolved: resolved,
      unresolved: unresolved,
      seen: seen
    };
  },

  /**
   * Sets the type for a given node
   * @param {string} nodeID
   * @param {string} type
   */
  addKnownType: function(nodeID, type) {
    if (!this.enabled) {
      return;
    }

    var resolvedNode = resolved[nodeID],
        unresolvedNode = unresolved[nodeID],
        isFunctionType = type.indexOf('->') !== -1;

    if (resolvedNode && resolvedNode.type) {
      // Type is already known, nothing to do here
      return;
    }

    if (isFunctionType) {
      // If it's a function type, parse out the parameters
      var parsedType = parseFunctionType(type);

      // Ignore the type if the return type is known and conflicts
      // or if the number of inferred parameters conflicts
      var invalidParameters,
          invalidReturnType;
      if (!resolvedNode) {
        invalidParameters = false;
        invalidReturnType = false;
      } else {
        invalidParameters = resolvedNode.params && resolvedNode.params.length !== parsedType.parameters.length;
        invalidReturnType = resolvedNode.returnType && resolvedNode.returnType !== parsedType.returnType;
      }
      if (invalidParameters || invalidReturnType) {
        return;
      }

      if (!resolvedNode) {
        resolvedNode = resolved[nodeID] = {
          ID: nodeID,
          type: null,
          params: [],
          returnType: null
        };
      }

      resolvedNode.type = parsedType.type;
      resolvedNode.returnType = parsedType.returnType;
      resolvedNode.isFunction = true;
      resolvedNode.isScalar = false;

      // Generate parameters from the parameter types
      for (var i = 0, len = parsedType.parameters.length; i < len; i++) {
        var paramType = parsedType.parameters[i],
            unresolvedParam = unresolvedNode && unresolvedNode.params && unresolvedNode.params[i];
        if (unresolvedParam) {
          TypeInference.addKnownType(unresolvedParam, paramType);
          resolvedNode.params.push(unresolvedParam);
        } else {
          var paramID = SymbolTable().genSymID(SymbolTypes.Param),
              parameter = SymbolTable().addSymbol(new Symbol({
                ID: paramID,
                value: '$' + paramID,
                type: SymbolTypes.Param,
                data: {
                  type: paramType
                }
              }));
          TypeInference.addKnownType(parameter.ID, paramType);
          resolvedNode.params.push(parameter.ID);
        }
      }

      // If there are any unresolved dependencies, assign them
      if (!unresolvedNode) {
        return;
      }

      var typeDependencies = unresolvedNode.type || [],
          returnTypeDependencies = unresolvedNode.returnType || [];

      // Remove unresolved node to prevent circular type setting
      delete unresolved[nodeID];

      typeDependencies.forEach(function(childID) {
        TypeInference.addKnownType(childID, parsedType.type);
      });
      returnTypeDependencies.forEach(function(childID) {
        TypeInference.addKnownType(childID, parsedType.returnType);
      });
    } else { // Scalar type
      // If the node has parameters or return type dependencies, ignore new type
      if (unresolvedNode) {
        var hasParams = unresolvedNode.params && unresolvedNode.params.length,
            hasReturnType = unresolvedNode.returnType && unresolvedNode.returnType.length;
        if (hasParams || hasReturnType) {
          return;
        }
      }

      resolvedNode = resolved[nodeID] = {
        ID: nodeID,
        type: type,
        isScalar: true,
        isFunction: false
      };

      // Apply the type to any type dependencies
      if (unresolvedNode) {
        var typeDependencies = unresolvedNode.type || [];

        // Remove the unresolved node to prevent circular type deducing
        delete unresolved[nodeID];

        typeDependencies.forEach(function(childID) {
          TypeInference.addKnownType(childID, type);
        });
      }
    }

    /**
    Q. What if a type is already known?
      A: Ignore the new type.

    Q: What if it's a function type?
      A: Parse out the type and mark as a function.

      Q: Should parameters be parsed out?
        A: Yes.

      Q: Should the return type be parsed out?
        A: Yes.

      Q: What if the return type is known and the new return type conflicts?
        A: Ignore the new type.

    Q: What if type was previously unknown?
      A: Mark it as known.

      Q: i.e. what if it has type dependencies?
        A: If the dependencies type isn't known, invert the dependency
           so that the child now takes on the type of the parent.

    Q: What if there are return type dependencies?
      A: If the dependencies type isn't known, invert the dependency
         so that the child now takes on the return type of the parent.

      Q: ... but the new type is a scalar?
        A: Ignore the new type.

    Q: What if type was known to be a scalar but new type is a function?
      A: Ignore the new type.

    Q: After a type is known, can it be changed?
      A: No.

    Q: What if the type is a scalar?
      A: Assign the new type.

      Q: ... but it has parameters?
        A: Ignore the new type.

      Q: ... but it has return type dependencies?
        A: Ignore the new type.
    **/
  },

  /**
   * Sets the return type for a given node
   * @param {string} nodeID
   * @param {string} returnType
   */
  addKnownReturnType: function(nodeID, returnType) {
    if (!this.enabled) {
      return;
    }
  },

  /**
   * Applies a type dependency between two nodes
   * @param {string} parentID
   * @param {string} childID
   */
  addTypeDependency: function(parentID, childID) {
    if (!this.enabled) {
      return;
    }

    // If the type of the child is already known, just use that
    var resolvedChild = resolved[childID];
    if (resolvedChild && resolvedChild.type) {
      this.addKnownType(parentID, resolvedChild.type);
      return;
    }

    var resolvedNode = resolved[parentID],
        unresolvedNode = unresolved[parentID];

    if (resolvedNode && resolvedNode.type) {
      // Type of parent is already known, apply to child
      this.addKnownType(childID, resolvedNode.type);
      return;
    }

    if (!unresolvedNode) {
      unresolvedNode = unresolved[parentID] = {
        ID: parentID,
        type: null,
        params: null,
        returnType: null
      };
    }

    unresolvedNode.type = unresolvedNode.type || [];
    if (unresolvedNode.type.indexOf(childID) === -1) {
      unresolvedNode.type.push(childID);
    }
    /**
    Q: What if the type is already known?
      A: Flip the dependency, apply the known type to the child.

    Q: What if type of child is already known?
      A: Add known type.
    **/
  },

  /**
   * Applies a type dependency between two nodes
   * @param {string} parentID
   * @param {string} childID
   */
  addReturnTypeDependency: function(parentID, childID) {
    if (!this.enabled) {
      return;
    }
  },

  /**
   * Adds an existing parameter to a given node
   * Used with function declarations
   * @param {string} parentID
   * @param {string} paramID
   */
  addExistingParameter: function(parentID, paramID) {
    if (!this.enabled) {
      return;
    }
  },

  /**
   * Generates a new parameter for a given node
   * Applies a type dependency between the new node and the dependency
   * @param {string} parentID
   * @param {string} dependencyID
   */
  addNewParameter: function(parentID, dependencyID) {
    if (!this.enabled) {
      return;
    }
  },

  /**
   * Resolves all types
   * @param {string} [nodeID]
   */
  resolve: function(nodeID) {
    if (!this.enabled) {
      return;
    }
  }
};

module.exports = TypeInference;
