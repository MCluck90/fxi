'use strict';

const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const filename = (argv._[0]) ? path.join(process.cwd(), argv._[0]) : null;
const parser = require('./parser');

if (!filename || argv.h || argv.help) {
  var helpText = path.join(__dirname, 'help.txt');
  console.log(fs.readFileSync(helpText).toString());
  return;
}

const contents = fs.readFileSync(filename).toString();
const tokens = parser.parse(contents);
console.log(JSON.stringify(tokens, null, 2));