'use strict';

var fs = require('fs'),
    line = '',
    lineNumber = 0,
    endOfFile = false,
    EOF_TOKEN = {},
    stream;

var TokenTypes = {};
[
  'NUMBER',      'CHARACTER',   'KEYWORD',
  'PUNCTUATION', 'IDENTIFIER',  'MATH',
  'RELATIONAL',  'BOOLEAN',     'ASSIGNMENT',
  'BLOCK',       'PARENTHESES', 'ARROW',
  'TYPE',        'UNKNOWN',     'EOF'].forEach(function(type) {
  TokenTypes[type] = type;
});
EOF_TOKEN.type = TokenTypes.EOF;

var Scanner = {
  TokenTypes: TokenTypes,

  /**
   * Initializes the tokenizer
   * @param {string}    filePath  Path to the file to tokenize
   * @param {function}  cb        Will run after the file is open
   */
  init: function(filePath, cb) {
    line = '';
    lineNumber = 0;
    endOfFile = false;
    this.currentToken = {
      type: null,
      lexeme: null
    };
    stream = fs.createReadStream(filePath);
    stream.once('readable', function() {
      Scanner.nextToken();
      Scanner.nextToken();
      cb();
    });
  },

  // The most recently parsed token
  currentToken: { type: null, lexeme: null, lineNumber: 0 },

  // Represents the next token in the stream
  _next: { type: null, lexeme: null, lineNumber: 0 },

  /**
   * Grab the next token without destroying the current token
   */
  peek: function() {
    return this._next;
  },

  /**
   * Parse and retrieve the next token
   */
  nextToken: function() {
    if (endOfFile) {
      this.currentToken = EOF_TOKEN;
      return this.currentToken;
    }

    this.currentToken = this._next;

    var lastOfLine = false;
    while (line.length === 0) {
      var c = '';
      while (c !== '\n' && c !== null) {
        line += c;
        c = stream.read(1);
        c = (c) ? c.toString() : c;
      }
      lineNumber++;

      lastOfLine = (c === '\n');

      if (c === null) {
        if (!endOfFile) {
          EOF_TOKEN.lineNumber = lineNumber;
          endOfFile = true;
        }
        if (line.length === 0) {
          this._next = EOF_TOKEN;
          return this.currentToken;
        }
      }

      // Strip out multi-line comments
      if (line.indexOf('/*') > -1) {
        var split = line.split('/*'),
            comment = (split[1] || '  ').split('');
        line = split[0];
        while (comment.join('') !== '*/') {
          comment.shift();
          c = stream.read(1);
          if (!c) {
            throw new Error('Unterminated multi-comment comment');
          }
          c = c.toString();
          if (c === '\n') {
            lineNumber++;
          }

          comment.push(c);
        }
      }

      // Strip starting whitespace and comments
      line = line.split('//')[0];
      line = line.replace(/^[\s]+/, '');
    }

    var tokenLineNumber = (lastOfLine) ? lineNumber - 1 : lineNumber,

        // Need it for checking against identifiers
        keywordsPattern = /^(atoi|else|false|if|itoa|main|read|rtn|true|while|write)/,
        patterns = [
          {
            type: TokenTypes.NUMBER,
            pattern: /^([-+]?([1-9][0-9]+|[0-9]))/
          },
          {
            type: TokenTypes.CHARACTER,
            pattern: /^'(\\[\x20-\x7E]|[\x20-\x7E]|[\x00-\x1F])'/
          },
          {
            type: TokenTypes.TYPE,
            pattern: /^(bool|char|int)/
          },
          {
            type: TokenTypes.IDENTIFIER,
            pattern: /^([a-zA-Z_][a-zA-Z0-9_]*)/,
            createToken: function(input) {
              var keywordMatch = input.match(keywordsPattern);
              if (keywordMatch && keywordMatch[0].length === input.length) {
                return {
                  type: TokenTypes.KEYWORD,
                  lexeme: input
                };
              } else {
                return {
                  type: TokenTypes.IDENTIFIER,
                  lexeme: input
                };
              }
            }
          },
          {
            type: TokenTypes.KEYWORD,
            pattern: keywordsPattern
          },
          {
            type: TokenTypes.ARROW,
            pattern: /^(=>)/
          },
          {
            type: TokenTypes.PUNCTUATION,
            pattern: /^(;|,|\.)/
          },
          {
            type: TokenTypes.MATH,
            pattern: /^(\+|-|\*|\/|\^)/
          },
          {
            type: TokenTypes.RELATIONAL,
            pattern: /^(<=|>=|==|<|>)/
          },
          {
            type: TokenTypes.BOOLEAN,
            pattern: /^(&&|\|\||!=)/
          },
          {
            type: TokenTypes.ASSIGNMENT,
            pattern: /^(=)/
          },
          {
            type: TokenTypes.BLOCK,
            pattern: /^({|})/
          },
          {
            type: TokenTypes.PARENTHESES,
            pattern: /^(\(|\))/
          }
      ],
      matches = null,
      i, len;

    len = patterns.length;
    for (i = 0; i < len; i++) {
      matches = line.match(patterns[i].pattern);
      if (matches) {
        break;
      }
    }

    if (matches) {
      if (patterns[i].createToken) {
        this._next = patterns[i].createToken(matches[1]);
      } else {
        this._next = {
          type: patterns[i].type,
          lexeme: matches[1]
        };
      }
      line = line.substr(matches[0].length).replace(/^[\s]+/, '');
    } else {
      this._next = {
        type: TokenTypes.UNKNOWN,
        lexeme: line[0]
      };
      line = line.substr(1).replace(/^[\s]+/, '');
    }

    this._next.lineNumber = tokenLineNumber;
    return this.currentToken;
  }
};
module.exports = Scanner;
