'use strict';
/* Prints brace depth at each top-level `function`/`})();` line for a JS part. */
const fs = require('fs');
const path = process.argv[2];
const src = fs.readFileSync(path, 'utf8');

let d = 0, line = 1, i = 0, q = null, last = '';
const marks = [];
while (i < src.length) {
  const c = src[i];
  if (c === '\n') { line++; last = '\n'; i++; continue; }
  if (q) {
    if (c === '\\') { i += 2; continue; }
    if (c === q) q = null;
    i++; continue;
  }
  if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
  if (c === '/' && src[i + 1] === '*') {
    i += 2;
    while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
    i += 2; continue;
  }
  if (c === '"' || c === "'" || c === '`') { q = c; i++; last = 's'; continue; }
  if (c === '/') {
    if (last === '' || last === '\n' || '(,=:[!&|?{};\n+-*%~^<>'.includes(last)) {
      i++;
      let cls = false;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') cls = true;
        else if (src[i] === ']') cls = false;
        else if (src[i] === '/' && !cls) { i++; break; }
        else if (src[i] === '\n') break;
        i++;
      }
      last = 'r'; continue;
    }
    last = '/'; i++; continue;
  }
  if (c === '{') { d++; marks.push(line); }
  else if (c === '}') {
    d--; marks.pop();
    if (d < 0) console.log('EXTRA } at line ' + line);
  }
  if (!/\s/.test(c)) last = c;
  i++;
}
console.log('FINAL DEPTH =', d);
if (d > 0) console.log('UNCLOSED opens at lines:', marks.join(', '));
