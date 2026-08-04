/**
 * codemod-remove-polyfill.js
 * 
 * Replaces all `import browser from 'webextension-polyfill'` 
 * with `import browser from '@/lib/browser-compat'` across the automa-source codebase.
 * 
 * Usage: node codemod-remove-polyfill.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '..', 'src');

// Patterns to match (covers all known import styles)
const patterns = [
  // ES import default
  /import\s+browser\s+from\s+['"]webextension-polyfill['"]\s*;?/g,
  // ES import with destructuring (rare but possible)
  /import\s+\{[^}]*\}\s+from\s+['"]webextension-polyfill['"]\s*;?/g,
  // ES import namespace
  /import\s+\*\s+as\s+browser\s+from\s+['"]webextension-polyfill['"]\s*;?/g,
];

const replacement = "import browser from '@/lib/browser-compat';";

function walkDir(dir) {
  const results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file === 'node_modules' || file === 'dist' || file === 'build' || file === '.git') continue;
      results.push(...walkDir(fullPath));
    } else if (/\.(js|vue|ts|mjs)$/.test(file)) {
      results.push(fullPath);
    }
  }
  return results;
}

let totalFiles = 0;
let modifiedFiles = 0;
const changedFiles = [];

const files = walkDir(srcDir);

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  for (const pattern of patterns) {
    pattern.lastIndex = 0; // reset regex state
    if (pattern.test(content)) {
      pattern.lastIndex = 0;
      content = content.replace(pattern, replacement);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    modifiedFiles++;
    changedFiles.push(path.relative(srcDir, filePath));
  }
  totalFiles++;
}

console.log(`\nCodemod complete!`);
console.log(`  Scanned: ${totalFiles} files`);
console.log(`  Modified: ${modifiedFiles} files\n`);

if (changedFiles.length > 0) {
  console.log('Changed files:');
  changedFiles.forEach(f => console.log(`  ✓ ${f}`));
}
