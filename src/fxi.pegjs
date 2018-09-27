// FXI Grammar
// ===========

// Entry point
Program = _ (FunctionDeclaration _)*

// Optional whitespace
_ = [ \t\r\n]*

// Declares a variable
VariableDeclaration
	= Identifier _ TypeDeclaration _ ("=" _ Expression)? _ ";"
	/ Identifier _ TypeDeclaration? _ "=" _ Expression _ ";"

// Declares a function
FunctionDeclaration = Identifier _ Lambda

// Declares a type
TypeDeclaration = "<" _ Type _ ">"

// Used for variables and function names
Identifier = [_a-zA-Z]+[_a-zA-Z0-9]*

// An anonymous function
Lambda = "=>" _ "(" _ ParameterList? _ ")" _ Block

// List of parameters for a function
ParameterList = Parameter _ ("," _ Parameter)*

// A single parameter
Parameter = Identifier (TypeDeclaration)?

// A block containing a sequence of statements
Block = "{" _ (Statement _)* "}"

// A single line of work
Statement 
	= Block
	/ VariableDeclaration _ ";"
	/ Expression _ ";"
	/ "if" _ "(" _ Expression _ ")" _ Statement (_ "else" _ Statement _)?
	/ "while" _ "(" Expression _ ")" _ Statement
	/ "rtn" _ (Expression)? _ ";"
	/ "write" _ Expression _ ";"
	/ "read" _ Identifier _ ";"

// Produces a value
Expression
	= "(" _ Expression _ ")" _ ExpressionZ?
	/ BooleanLiteral _ ExpressionZ?
	/ IntegerLiteral _ ExpressionZ?
	/ CharacterLiteral _ ExpressionZ?
	/ Identifier _ FunctionCall? _ ExpressionZ?
	/ Lambda

// Chains together different kinds of expressions, allowing for easier precedence
ExpressionZ
	= "=" _ Expression
	/ "&&" _ Expression
	/ "||" _ Expression
	/ "==" _ Expression
	/ "!=" _ Expression
	/ "<=" _ Expression
	/ ">=" _ Expression
	/ "<" _ Expression
	/ ">" _ Expression
	/ "+" _ Expression
	/ "-" _ Expression
	/ "*" _ Expression
	/ "/" _ Expression

// When a function is called
FunctionCall = "(" _ ArgumentList? _ ")"

// Arguments to a function
ArgumentList = Expression (_ "," _ Expression)*

// Any of the possible types
Type
	= "bool"
	/ "int"
	/ "char"
	/ "void"
	/ "(" _ ( Type (_ "," _ Type)*)? _ ")" _ "->" _ Type

// Boolean values
BooleanLiteral = "true" / "false"

// Number values
IntegerLiteral = [+-]? Integer

Integer
	= "0"
	/ [123456789] IntegerZ*

IntegerZ = [0123456789]

// Character values
CharacterLiteral = "'" Character "'"
Character = "\\"? [^\r\n]