# Grammar

```
// Comments can occur at any point in the code
comment ::= "//" anything
  | "/*" anything "*/"
  ;

keyword ::= "atoi"
  | "else"
  | "false"
  | "if"
  | "itoa"
  | "main"
  | "read"
  | "rtn"
  | "true"
  | "while"
  | "write"
  ;

character_literal ::= "\'" character "\'"
  ;

character ::= [ "\" ] printable_ascii
  ;

number_literal ::= [ "+" | "-" ] number
  ;

number ::= "0"
  | "1" { number_z }
  | "2" { number_z }
  | "3" { number_z }
  | "4" { number_z }
  | "5" { number_z }
  | "6" { number_z }
  | "7" { number_z }
  | "8" { number_z }
  | "9" { number_z }
  ;

number_z ::= "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  ;

type ::= "bool"
  | "int"
  | "char"
  | "void"
  | "(" type ")" "->" type
  ;
```

## Start

```
program ::= { fn_declaration } "main" lambda
  ;
```

## Declarations

```
variable_declaration ::= identifier [ type_declaration ] "=" expression ";"
  | fn_declaration
  ;

fn_declaration ::= identifier lambda
  ;

type_declaration ::= "<" type ">"
  ;

lambda ::= "=>" "(" [ parameter_list ] ")" "{" { statement } "}"
  ;

parameter_list ::= parameter { "," parameter }
  ;

parameter ::= identifier [ type_declaration ]
  ;
```

## Statement

```
statement ::= "{" { statement } "}"
  | variable_declaration
  | expression ";"
  | "if" "(" expression ")" statement [ "else" statement ]
  | "while" "(" expression ")" statement
  | "rtn" lambda
  | "rtn" [ expression ] ";"
  | "write" expression ";"
  | "read" identifier ";"
  ;
```

## Expression

```
expression ::= "(" expression ")" [ exp_z ]
  | "true" [ exp_z ]
  | "false" [ exp_z ]
  | number_literal [ exp_z ]
  | character_literal [ exp_z ]
  | "atoi" "(" expression ")" [ exp_z ]
  | "itoa" "(" expression ")" [ exp_z ]
  | identifier [ fn_call ] [ exp_z ]
  ;

exp_z ::= "=" expression
  | "&&" expression
  | "||" expression
  | "==" expression
  | "!=" expression
  | "<=" expression
  | ">=" expression
  | "<" expression
  | ">" expression
  | "+" expression
  | "-" expression
  | "*" expression
  | "/" expression
  ;

fn_call ::= "(" [ arg_list ] ")"
  ;

arg_list ::= argument { "," argument }
  ;

argument ::= lambda
  | expression
  ;
```
