'use strict';

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
   * identifier "=" expression ";"
   * fn_declaration
   */
  variable_declaration: function(depthCheck) {
    if (depthCheck) {
      return tokens.currentToken.type === TokenTypes.IDENTIFIER ||
             this.fn_declaration(true);
    }

    var nextToken = tokens.peek();
    if (nextToken.type === TokenTypes.ASSIGNMENT) {
      checkTokenType(TokenTypes.IDENTIFIER);
      checkLexeme('=');
      this.expression();
      checkLexeme(';');
    } else if (nextToken.type === TokenTypes.ARROW) {
      this.fn_declaration();
    } else {
      checkTokenType(TokenTypes.IDENTIFIER);
      throw new Error('Expected assignment or arrow, found ' + tokens.currentToken.lexeme);
    }
  },

  /**
   * identifier lambda
   */
  fn_declaration: function(depthCheck) {
    if (depthCheck) {
      return tokens.currentToken.type === TokenTypes.IDENTIFIER;
    }

    checkTokenType(TokenTypes.IDENTIFIER);
    this.lambda();
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
    while (this.parameter_list(true)) {
      this.parameter_list();
    }
    checkLexeme(')');
    checkLexeme('{');
    while (this.statement(true)) {
      this.statement();
    }
    // statement
    checkLexeme('}');
  },

  /**
   * identifier { "," identifier }
   */
  parameter_list: function(depthCheck) {
    if (depthCheck) {
      return tokens.currentToken.type === TokenTypes.IDENTIFIER;
    }

    checkTokenType(TokenTypes.IDENTIFIER);
    while (tokens.currentToken.lexeme === ',') {
      checkLexeme(',');
      checkTokenType(TokenTypes.IDENTIFIER);
    }
  },

  /**
   * "{" { statement } "}"
   * variable_declaration
   * expression ";"
   * "if" "(" expression ")" statement [ "else" statement ]
   * "while" "(" expression ")" statement
   * "rtn" [ expression ] ";"
   * "write" expression ";"
   * "read" expression ";"
   */
  statement: function(depthCheck) {
    var lexeme = tokens.currentToken.lexeme;
    if (depthCheck) {
      return lexeme === '{' ||
             this.variable_declaration(true) ||
             this.expression(true) ||
             lexeme === 'if' ||
             lexeme === 'while' ||
             lexeme === 'rtn' ||
             lexeme === 'write' ||
             lexeme === 'read';
    }

    if (lexeme === '{') {
      checkLexeme('{');
      while (this.statement(true)) {
        this.statement();
      }
    } else if (this.variable_declaration(true)) {
      this.variable_declaration();
    } else if (this.expression(true)) {
      this.expression();
      checkLexeme(';');
    } else if (lexeme === 'if') {
      checkLexeme('if');
      checkLexeme('(');
      this.expression();
      checkLexeme(')');
      this.statement();
      if (tokens.currentToken.lexeme === 'else') {
        checkLexeme('else');
        this.statement();
      }
    } else if (lexeme === 'while') {
      checkLexeme('while');
      checkLexeme('(');
      this.expression();
      checkLexeme(')');
      this.statement();
    } else if (lexeme === 'rtn') {
      checkLexeme('rtn');
      if (this.expression(true)) {
        this.expression();
      }
      checkLexeme(';');
    } else if (lexeme === 'write') {
      checkLexeme('write');
      this.expression();
      checkLexeme(';');
    } else if (lexeme === 'read') {
      checkLexeme('read');
      checkTokenType(TokenTypes.IDENTIFIER);
      checkLexeme(';');
    } else {
      throw new Error('Invalid statement');
    }
  },

  /**
   * "(" expression ")" [ exp_z ]
   * "true" [ exp_z ]
   * "false" [ exp_z ]
   * number_literal [ exp_z ]
   * character_literal [ exp_z ]
   * "atoi" "(" expression ")" [ exp_z ]
   * "itoa" "(" expression ")" [ exp_z ]
   * identifier [ fn_call ] [ exp_z ]
   */
  expression: function(depthCheck) {
    var token = tokens.currentToken,
        lexeme = token.lexeme;
    if (depthCheck) {
      return lexeme === '(' ||
             lexeme === 'true' ||
             lexeme === 'false' ||
             token.type === TokenTypes.NUMBER ||
             token.type === TokenTypes.CHARACTER ||
             lexeme === 'atoi' ||
             lexeme === 'itoa' ||
             token.type === TokenTypes.IDENTIFIER;
    }

    if (lexeme === '(') {
      checkLexeme('(');
      this.expression();
      checkLexeme(')');
    } else if (lexeme === 'true') {
      checkLexeme('true');
    } else if (lexeme === 'false') {
      checkLexeme('false');
    } else if (token.type === TokenTypes.NUMBER) {
      checkTokenType(TokenTypes.NUMBER);
    } else if (token.type === TokenTypes.CHARACTER) {
      checkTokenType(TokenTypes.CHARACTER);
    } else if (lexeme === 'atoi') {
      checkLexeme('atoi');
      checkLexeme('(');
      this.expression();
      checkLexeme(')');
    } else if (lexeme === 'itoa') {
      checkLexeme('itoa');
      checkLexeme('(');
      this.expression();
      checkLexeme(')');
    } else if (token.type === TokenTypes.IDENTIFIER) {
      checkTokenType(TokenTypes.IDENTIFIER);
      if (this.fn_call(true)) {
        this.fn_call();
      }
    } else {
      throw new Error('Invalid expression');
    }

    if (this.exp_z(true)) {
      this.exp_z();
    }
  },

  /**
   * "=" expression
   * "&&" expression
   * "||" expression
   * "==" expression
   * "!=" expression
   * "<=" expression
   * ">=" expression
   * "<" expression
   * ">" expression
   * "+" expression
   * "-" expression
   * "*" expression
   * "/" expression
   */
  exp_z: function(depthCheck) {
    var type = tokens.currentToken.type,
        isCorrectType = type === TokenTypes.ASSIGNMENT ||
                        type === TokenTypes.BOOLEAN ||
                        type === TokenTypes.RELATIONAL ||
                        type === TokenTypes.MATH;
    if (depthCheck) {
      return isCorrectType;
    }

    if (isCorrectType) {
      tokens.nextToken();
      this.expression();
    } else {
      throw new Error('Expected assignment, boolean expression, or math expression');
    }
  },

  /**
   * "(" [ arg_list ] ")"
   */
  fn_call: function(depthCheck) {
    if (depthCheck) {
      return tokens.currentToken.lexeme === '(';
    }

    checkLexeme('(');
    if (this.arg_list(true)) {
      this.arg_list();
    }
    checkLexeme(')');
  },

  /**
   * expression { "," expression }
   */
  arg_list: function(depthCheck) {
    if (depthCheck) {
      return this.expression(true);
    }

    this.expression();
    while (tokens.currentToken.lexeme === ',') {
      checkLexeme(',');
      this.expression();
    }
  }
};

module.exports = Syntax;
