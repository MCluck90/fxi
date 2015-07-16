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
      var symbolParameters = SymbolTable.getSymbol(nodeID).data.params || [];
      for (var i = 0, len = parsedType.parameters.length; i < len; i++) {
        var paramType = parsedType.parameters[i],
            unresolvedParam = unresolvedNode && unresolvedNode.params && unresolvedNode.params[i],
            knownParameter = symbolParameters[i];
        if (unresolvedParam) {
          TypeInference.addKnownType(unresolvedParam, paramType);
          resolvedNode.params.push(unresolvedParam);
        } else if (knownParameter) {
          TypeInference.addKnownType(knownParameter.ID, paramType);
          resolvedNode.params.push(knownParameter.ID);
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
        returnType: null,
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

    var unresolvedNode = unresolved[nodeID],
        resolvedNode = resolved[nodeID];
    if (resolvedNode && (resolvedNode.returnType || resolvedNode.isScalar)) {
      // Return type is already known or it's a scalar
      // no need to set a return type
      return;
    }

    if (!resolvedNode) {
      resolvedNode = resolved[nodeID] = {
        ID: nodeID,
        type: null,
        params: [],
        returnType: null
      };

      if (unresolvedNode && unresolvedNode.params) {
        resolvedNode.params = unresolvedNode.params;
      }
    }

    resolvedNode.isFunction = true;
    resolvedNode.isScalar = false;
    resolvedNode.returnType = returnType;

    // Apply return type to any return type dependencies
    if (unresolvedNode) {
      var returnTypeDependencies = unresolvedNode.returnType || [];
      delete unresolved[nodeID];
      returnTypeDependencies.forEach(function(childID) {
        TypeInference.addKnownType(childID, returnType);
      });
    }

    /**
    Q: What if return type is already known?
      A: Ignore new type.

    Q: What if type is known to be scalar?
      A: Ignore new type.

    Q: Can a return type be known without knowing parameters?
      A: No. Return type will be inferred after function call, where parameters will be inferred.

    Q: After a return type is known, can it be changed?
      A: No.
    **/
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

    var resolvedChild = resolved[childID];
    if (resolvedChild && resolvedChild.type) {
      this.addKnownReturnType(parentID, resolvedChild.type);
      return;
    }

    var unresolvedNode = unresolved[parentID],
        resolvedNode = resolved[parentID];
    if (resolvedNode) {
      if (resolvedNode.returnType) {
        this.addKnownType(childID, resolvedNode.returnType);
        return;
      } else if (resolvedNode.isScalar) {
        return;
      }
    } else if (unresolvedNode && unresolvedNode.isScalar) {
      return;
    }

    if (!unresolvedNode) {
      unresolvedNode = unresolved[parentID] = {
        ID: parentID,
        type: null,
        params: [],
        returnType: null
      };
    }

    unresolvedNode.isFunction = true;
    unresolvedNode.isScalar = false;
    unresolvedNode.returnType = unresolvedNode.returnType || [];
    if (unresolvedNode.returnType.indexOf(childID) === -1) {
      unresolvedNode.returnType.push(childID);
    }

    /**
    Q: What if the child type is already known?
      A: Apply the known type.

    Q: What if return type is known?
      A: Ignore new type.

    Q: What if type is known to be a scalar?
      A: Ignore new type.

    Q: What if the return type is already known?
      A: Flip the dependency, apply the known type to the child.
    **/
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

    if (resolved[parentID]) {
      throw new Error('Attempt to add parameter to known function');
    }

    var unresolvedNode = unresolved[parentID];
    if (!unresolvedNode) {
      unresolvedNode = unresolved[parentID] = {
        type: null,
        params: [],
        returnType: null
      };
    }
    unresolvedNode.params = unresolvedNode.params || [];
    unresolvedNode.params.push(paramID);
  },

  /**
   * Adds a dependency to the nth parameter of a function
   * @param {string} funcID   Symbol ID for the function
   * @param {number} index    Index of the parameter
   * @param {string} childID  Symbol ID for the dependency
   */
  addParameterDependency: function(funcID, index, childID) {
    if (!this.enabled) {
      return;
    }

    var resolvedNode = resolved[funcID];
    if (resolvedNode) {
      if (resolvedNode.params && index < resolvedNode.params.length) {
        this.addTypeDependency(resolvedNode.params[i], childID);
      }
      return;
    }

    var unresolvedNode = unresolved[funcID];
    if (!unresolvedNode) {
      unresolvedNode = unresolved[funcID] = {
        type: null,
        params: null,
        returnType: null
      };
    }

    unresolvedNode.params = unresolvedNode.params || [];
    if (unresolvedNode.lockedParams && index > unresolvedNode.params.length) {
      return;
    }
  },

  /**
   * Ensures no more parameters will be added to a function
   * @param {string} funcID Symbol ID of the function to lock
   */
  lockParameters: function(funcID) {
    if (!this.enabled || resolved[funcID]) {
      return;
    }

    var unresolvedNode = unresolved[funcID];
    if (!unresolvedNode) {
      unresolvedNode = unresolved[funcID] = {
        type: null,
        params: null,
        returnType: null
      };
    }

    unresolvedNode.lockedParams = true;
  },

  /**
   * Resolves all types
   * @param {string} [nodeID]
   */
  resolve: function(nodeID) {
    if (!this.enabled) {
      return;
    }

    if (!nodeID) {
      // Add known types from SymbolTable
      var allSymbols = SymbolTable().getAllSymbols(),
          knownSymbols = Object.keys(allSymbols).filter(function(symID) {
            return allSymbols[symID].data.type || allSymbols[symID].data.returnType;
          }).map(function(symID) {
            return {
              ID: symID,
              type: allSymbols[symID].data.type,
              returnType: allSymbols[symID].data.returnType
            };
          });
      knownSymbols.forEach(function(symbolNode) {
        if (symbolNode.type) {
          TypeInference.addKnownType(symbolNode.ID, symbolNode.type);
        }
        if (symbolNode.returnType) {
          TypeInference.addKnownReturnType(symbolNode.ID, symbolNode.returnType);
        }
      });

      Object.keys(unresolved).forEach(this.resolve.bind(this));

      // Assign known types to symbols
      Object.keys(resolved).forEach(function(symID) {
        var resolvedNode = resolved[symID],
            symbol = SymbolTable.getSymbol(symID);
        symbol.data.type = resolvedNode.type || null;
        symbol.data.returnType = resolvedNode.returnType || null;
        if (resolvedNode.params) {
          var possibleType = '(';
          symbol.data.params = resolvedNode.params.map(function(paramID) {
            if (!resolved[paramID]) {
              possibleType = null;
            } else if (possibleType) {
              if (possibleType.length > 1) {
                possibleType += ',';
              }
              possibleType += resolved[paramID].type;
            }
            return SymbolTable.getSymbol(paramID);
          });

          if (possibleType && !resolvedNode.type && resolvedNode.returnType) {
            possibleType += ')->' + resolvedNode.returnType;
            resolvedNode.type = symbol.data.type = possibleType;
          }
        } else {
          symbol.data.params = null;
        }
        symbol.data.isScalar = resolvedNode.isScalar;
        symbol.data.isFunction = resolvedNode.isFunction;
      });
    } else if (unresolved[nodeID] && seen.indexOf(nodeID) === -1) {
      seen.push(nodeID);
      var unresolvedNode = unresolved[nodeID],
          result = {
            type: null,
            params: null,
            returnType: null,
            isFunction: null,
            isScalar: null
          };

      if (unresolvedNode) {
        // Unresolved children should be resolved if type is found
        var typeDependencies = unresolvedNode.type || [],
            returnTypeDependencies = unresolvedNode.returnType || [],
            unresolvedTypeChildren = [],
            unresolvedReturnTypeChildren = [];
        typeDependencies.forEach(function(childID) {
          TypeInference.resolve(childID);
          var resolvedChild = resolved[childID];
          if (!resolvedChild) {
            unresolvedTypeChildren.push(childID);
          } else if (!result.type && resolvedChild.type) {
            result.type = resolvedChild.type;
          }
        });
        returnTypeDependencies.forEach(function(childID) {
          TypeInference.resolve(childID);
          var resolvedChild = resolved[childID];
          if (!resolvedChild) {
            unresolvedReturnTypeChildren.push(childID);
          } else if (!result.returnType && resolvedChild.type) {
            result.returnType = resolvedChild.type;
          }
        });

        if (!result.type) {
          if (!unresolvedNode.params || !result.returnType) {
            return;
          }

          result.type = '(';
          for (var i = 0, len = unresolvedNode.params.length; i < len; i++) {
            var paramID = unresolvedNode.params[i],
                resolvedParam;
            TypeInference.resolve(paramID);
            resolvedParam = resolved[paramID];
            if (!resolvedParam) {
              return;
            }
            if (result.type.length > 1) {
              result.type += ',';
            }
            result.type += resolvedParam.type;
          }
          result.type += ')->' + result.returnType;
        }

        if (result.type) {
          unresolvedTypeChildren.forEach(function(childID) {
            TypeInference.addKnownType(childID, result.type);
          });
          this.addKnownType(nodeID, result.type);
        }
        if (result.returnType) {
          unresolvedTypeChildren.forEach(function(childID) {
            TypeInference.addKnownType(childID, result.returnType);
          });
          this.addKnownReturnType(nodeID, result.returnType);
        }
      }
      /**
      Q: What if the node is not in the system?
        A: Ignore it.

      Q: If a type is known, do we check it's dependencies?
        A: Yes. Resolve dependencies with known type.

        Q: Do such dependencies exist?
          A: No. If the type is known then dependencies are already processed.

      Q: What if the type dependencies disagree?
        A: Don't worry about it.

        Q: Should the first resolved type be the definitive type?
          A: Yes.

        Q: Should the most common type be the final type?
          A: No.

      Q: What if the type resolves to a function?
        A: Then process it as a function. Give it parameters and a return type.

        Q: Will dependencies always have parameters and a return type?
          A: Yes.

        Q: Can the same parameters be used?
          A: Yes(?). Just generate new parameters. Won't hurt anything.

        Q: Will new parameters have to be made?
          A: Yes. Will happen automatically through addKnownType.

        Q: What if the parameters couldn't be resolved?
          A: If type is not known, do not mark it as known.

        Q: Should resolved parameters be added as dependencies to own parameters?
          A: No.

        Q: What if return types don't resolve to the same type?
          A: Doesn't matter. Take the first one.
      **/
    }
  }
};

module.exports = TypeInference;
