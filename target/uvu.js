'use strict';

var SymbolTable = require('../symbol-table.js'),

    _quads = [],
    _currentQuad = {},
    _lastICodeLabel = '',
    _lastComment = '';

/**
 * Turns an ICode quad into an object
 * @param {string[]}  quad  Array of strings containing an ICode instruction
 * @returns {QuadObj}
 */
function icodeToObject(quad) {
  return {
    label: quad[0],
    instruction: quad[1],
    arg1: quad[2],
    arg2: quad[3],
    arg3: quad[4],
    comment: quad[5]
  };
}

function pushQuad(opts) {
  opts.args = opts.args || [];
  if (opts.args[0] !== undefined && opts.args[0] !== null) {
    opts.args[0] = opts.args[0].toString();
  }
  if (opts.args[1] !== undefined && opts.args[0] !== null) {
    opts.args[1] = opts.args[1].toString();
  }

  // Automatically use labels from icode
  if (!opts.label && _currentQuad.label !== _lastICodeLabel) {
    opts.label = _currentQuad.label;
    opts.comment = _currentQuad.comment || opts.comment;
    _lastICodeLabel = _currentQuad.label;
  }
  if (_currentQuad.comment !== _lastComment && !opts.commentForce) {
    opts.comment = _currentQuad.comment;
    _lastComment = opts.comment;
  }

  _quads.push([
    opts.label        || '',
    opts.instruction  || '',
    opts.args[0]      || '',
    opts.args[1]      || '',
    opts.comment      || ''
  ]);
}

// Generates code for UVU ASM
var UVU = {
  compile: function(icode) {
    _quads = [];

    for (var i = 0, len = icode.length; i < len; i++) {
      var quad = icodeToObject(icode[i]);
      _currentQuad = quad;

      try {
        this[quad.instruction](quad);
      } catch(e) {
        if (!this[quad.instruction]) {
          e.message = quad.instruction + ' not yet implemented';
        }
        throw e;
      }
    }

    return _quads.map(function(quad) {
      if (!quad[1]) {
        // No instruction? Must be only a comment
        return '\t\t; ' + quad[quad.length - 1];
      }
      var result = '';
      for (var i = 0, len = quad.length; i < len; i++) {
        var attr = quad[i];
        if (i === 1) {
          result += '\t';
        }
        if (i >= 1) {
          result += '\t';
        }
        if (i === len - 1 && attr.length) {
          result += '; ';
        }

        result += attr;
        // Put commas between arguments
        if (i > 1 && i < 3 && attr.length && quad[i + 1].length) {
          result += ',';
        }
      }
      return result;
    }).join('\n');
  },

  /**
   * Initialize literals etc.
   */
  INIT: function() {
    // Generate literal values
    SymbolTable.getLiterals().forEach(function(symbol) {
      var dataType = symbol.data.type;
      if (dataType === 'char' || dataType === 'int') {
        pushQuad({
          label: symbol.ID,
          instruction: (dataType === 'char') ? '.BYT' : '.INT',
          args: [symbol.value]
        });
      } else if (dataType === 'bool') {
        pushQuad({
          label: symbol.ID,
          instruction: '.INT',
          args: [ (symbol.value === 'true') ? 1 : 0 ]
        });
      } else {
        throw new Error('Unknown literal type: ' + dataType);
      }
    });
  },

  /*********
   *  I/O  *
   *********/
  WRITE: function(quad) {
    var dataType = quad.arg1,
        argID = quad.arg2,
        instruction,
        trapCode;

    if (dataType !== 'char' && dataType !== 'int') {
      throw new Error(dataType + ' not yet implemented');
    }

    if (dataType === 'char') {
      instruction = 'LDB';
      trapCode = 3;
    } else {
      instruction = 'LDR';
      trapCode = 1;
    }

    pushQuad({
      instruction: instruction,
      args: ['R7', argID]
    });

    pushQuad({
      instruction: 'TRP',
      args: [trapCode]
    });
  },

  EXIT: function() {
    pushQuad({
      comment: 'Exit program',
      instruction: 'TRP',
      args: [0]
    });
  }
};

module.exports = UVU;
