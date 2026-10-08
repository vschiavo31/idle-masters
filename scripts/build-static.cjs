const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = ['index.html', 'game.js', 'local-data.js', 'bestiary-ui.js', 'dofus-bestiary-1-40.json', 'dofus-equipment-1-40.json', 'dofus-item-sets.json'];
const output = path.join(root, 'dist');
fs.mkdirSync(output, { recursive: true });
for (const file of files) fs.copyFileSync(path.join(root, file), path.join(output, file));
console.log('Static game packaged: ' + files.length + ' files');
