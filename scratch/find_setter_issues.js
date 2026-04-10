import fs from 'fs';
import path from 'path';

function walk(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      walk(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

// Find all onValueChange callbacks that pass v to a setter without null guard
const pattern = /onValueChange=\{[^}]*set\w+\(v\)[^}]*\}/g;
const files = walk('app');

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('onValueChange') && line.match(/set\w+\(v\)/) && !line.includes('v ??') && !line.includes('v ||') && !line.includes('if (v)')) {
      console.log(`  ${file}:${i+1}: ${line.trim()}`);
    }
  }
}
