const fs = require('node:fs');

function loadKeymap(filePath) {
  const mapping = new Map();
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line.startsWith('mapping.')) continue;
    const [, value] = line.split('=', 2);
    const [instrument, , characters = ''] = value.split(',', 3);
    mapping.set(Number(instrument), Array.from(characters));
  }
  return (instrument, key) => {
    const value = mapping.get(instrument)?.[key + 4];
    return value ? `/// ${value}` : null;
  };
}

module.exports = { loadKeymap };
