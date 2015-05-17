var tokens = require('./scanner.js'),
    TokenTypes = tokens.TokenTypes;

/**
 * Verify that the current token matches the given lexeme
 * Moves to the next token after performing the check
 * @param {string}  lexeme
 * @param {strin[]} options Other possible options
 * @return {Token} The token that was checked
 */
function checkLexeme(lexeme, options) {
  if (tokens.currentToken.lexeme !== lexeme) {
    if (lexeme === '}' && tokens.currentToken.lexeme === undefined) {
      throw new Error('Missing ending curly brace');
    }

    var message = 'Expected \'' + lexeme + '\'';
    if (options && options.length) {
      for (var i = 0, len = options.length; i < len; i++) {
        var opt = options[i],
            hasSpace = opt.indexOf(' ') > -1;
        message += ', ';
        if (i === len - 1) {
          message += 'or ';
        }
        if (!hasSpace) {
          message += '\'';
        }
        message += opt;
        if (!hasSpace) {
          message += '\'';
        }
      }
    }

    throw new SyntaxError(message + ', found ' + tokens.currentToken.lexeme);
  }
  var prevToken = tokens.currentToken;
  tokens.nextToken();
  return prevToken;
}

/**
 * Verifies that the current token type matches the given type
 * Moves to the next token after performing the check
 * @param {TokenType} type
 * @return {Token} The token that was checked
 */
function checkTokenType(type) {
  if (tokens.currentToken.type !== type) {
    throw new SyntaxError(
      'Expected a ' + type.toLowerCase() +
      ', found ' + tokens.currentToken.lexeme
    );
  }
  var prevToken = tokens.currentToken;
  tokens.nextToken();
  return prevToken;
}

var Syntax = {
  checkSyntax: function() {
    this.program();
  },

  /**
   * { fn_declaration } "main" lambda
   */
  program: function() {
    while (this.fn_declaration(true)) {
      this.fn_declaration();
    }

    checkLexeme('main');
    this.lambda();
  },

  /**
   * identifier lambda
   */
  fn_declaration: function(depthCheck) {
    if (depthCheck) {
      return false;
    }
  },

  /**
   * "=>" "(" [ parameter_list ] ")" "{" { statement } "}"
   */
  lambda: function(depthCheck) {
    if (depthCheck) {
      return tokens.currentToken.type === TokenTypes.ARROW;
    }

    checkLexeme('=>');
    checkLexeme('(');
    // parameter_list
    checkLexeme(')');
    checkLexeme('{');
    // statement
    checkLexeme('}');
  }
};

module.exports = Syntax;
