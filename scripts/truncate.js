const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'styles', 'style.css');
const lines = fs.readFileSync(cssPath, 'utf8').split('\n');
const cleaned = lines.slice(0, 1403).join('\n') + '\n';
fs.writeFileSync(cssPath, cleaned);
console.log(`Truncated from ${lines.length} lines to 1403 lines.`);
