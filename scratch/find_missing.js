import fs from 'fs';
import path from 'path';

function walk(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      walk(fullPath, results);
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      results.push(fullPath);
    }
  }
  return results;
}

const hookPattern = /\b(useState|useEffect|useRef|useCallback|useMemo|useContext|useReducer)\b/;
const stylePattern = /<style/;
const styledJsxPattern = /styled-jsx/;
const clientOnlyPattern = /client-only/;
const toastPattern = /\btoast\b/;
const useReactToPrint = /useReactToPrint/;
const useConfirm = /useConfirm/;
const useRouter = /useRouter|usePathname|useSearchParams/;

const dirs = ['app', 'components', 'lib'];
const files = [];
for (const d of dirs) {
  if (fs.existsSync(d)) walk(d, files);
}

const missing = [];

for (const file of files) {
  if (!file.endsWith('.tsx')) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  const firstLine = lines[0] || '';
  const secondLine = lines[1] || '';
  const hasUseClient = firstLine.includes('use client') || secondLine.includes('use client');
  
  if (!hasUseClient) {
    const reasons = [];
    if (hookPattern.test(content)) reasons.push('hooks');
    if (stylePattern.test(content)) reasons.push('<style>');
    if (styledJsxPattern.test(content)) reasons.push('styled-jsx');
    if (useReactToPrint.test(content)) reasons.push('useReactToPrint');
    if (useConfirm.test(content)) reasons.push('useConfirm');
    if (useRouter.test(content)) reasons.push('useRouter');
    
    if (reasons.length > 0) {
      missing.push({ file, reason: reasons.join(', ') });
    }
  }
}

if (missing.length === 0) {
  console.log('All files OK - no missing "use client" directives found.');
} else {
  console.log(`Found ${missing.length} files missing "use client":`);
  for (const m of missing) {
    console.log(`  ${m.file} (${m.reason})`);
  }
}
