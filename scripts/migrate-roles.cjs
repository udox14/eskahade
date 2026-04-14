// Migration script to update session.role checks to multi-role helpers
const fs = require('fs');
const path = require('path');

const BASE = 'c:\\DATA\\eskahade\\app\\dashboard';

// Files that use session.role and need migration
const files = [
  'surat-santri/actions.ts',
  'santri/[id]/page.tsx',
  'santri/page.tsx',
  'santri/export/actions.ts',
  'pengaturan/fitur-akses/page.tsx',
  'pengaturan/fitur-akses/actions.ts',
  'pengaturan/perpulangan-periode/actions.ts',
  'master/santri-tools/actions.ts',
  'keamanan/perizinan/actions.ts',
  'keamanan/rekap-asrama/actions.ts',
  'keamanan/actions.ts',
  'asrama/perpindahan-kamar/page.tsx',
  'asrama/perpindahan-kamar/actions.ts',
  'asrama/perpulangan/actions.ts',
  'asrama/perpulangan/monitoring/actions.ts',
  'asrama/perpulangan/monitoring/_page-content.tsx',
  'asrama/absen-malam/actions.ts',
  'asrama/absen-berjamaah/actions.ts',
  'asrama/layanan/actions.ts',
  'asrama/spp/actions.ts',
  'asrama/uang-jajan/actions.ts',
  'asrama/status-setoran/actions.ts',
  'asrama/absen-sakit/actions.ts',
  'dewan-santri/setoran/actions.ts',
  'akademik/leger/actions.ts',
  'akademik/absensi/rekap/actions.ts',
  'akademik/grading/actions.ts',
  'akademik/upk/manajemen/page.tsx',
];

let totalChanges = 0;

for (const relPath of files) {
  const fullPath = path.join(BASE, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  const original = content;
  let fileChanges = 0;

  // 1. Add import if file uses getSession but doesn't import helpers
  const needsHelpers = /session\.role|session\?\.role/.test(content);
  if (!needsHelpers) {
    console.log(`SKIP (no session.role): ${relPath}`);
    continue;
  }

  // Check if already imports from session
  const hasSessionImport = /from ['"]@\/lib\/auth\/session['"]/.test(content);
  const hasHelpersImport = /hasRole|hasAnyRole|isAdmin/.test(content) && hasSessionImport;

  if (!hasHelpersImport) {
    if (hasSessionImport) {
      // Add helpers to existing import
      content = content.replace(
        /import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/auth\/session['"]/,
        (match, imports) => {
          const existing = imports.trim();
          // Don't add if already there
          if (existing.includes('hasRole')) return match;
          return `import { ${existing}, hasRole, hasAnyRole, isAdmin } from '@/lib/auth/session'`;
        }
      );
    } else {
      // Add new import line after 'use server' or at top
      if (content.includes("'use server'")) {
        content = content.replace(
          "'use server'",
          "'use server'\n\nimport { hasRole, hasAnyRole, isAdmin } from '@/lib/auth/session'"
        );
      } else {
        content = `import { hasRole, hasAnyRole, isAdmin } from '@/lib/auth/session'\n${content}`;
      }
    }
  }

  // 2. Replace patterns (ordered from most specific to least)

  // Pattern: !['a','b','c'].includes(session.role)
  content = content.replace(
    /!\s*\[([^\]]+)\]\.includes\(session\.role\)/g,
    (match, roles) => {
      fileChanges++;
      return `!hasAnyRole(session, [${roles}])`;
    }
  );

  // Pattern: ['a','b','c'].includes(session.role)  
  content = content.replace(
    /\[([^\]]+)\]\.includes\(session\.role\)/g,
    (match, roles) => {
      fileChanges++;
      return `hasAnyRole(session, [${roles}])`;
    }
  );

  // Pattern: ['a','b','c'].includes(session?.role ?? '')
  content = content.replace(
    /\[([^\]]+)\]\.includes\(session\?\.\s*role\s*\?\?\s*''\)/g,
    (match, roles) => {
      fileChanges++;
      return `hasAnyRole(session, [${roles}])`;
    }
  );

  // Pattern: session.role === 'admin' or session?.role === 'admin'
  content = content.replace(
    /session\??\.role\s*===\s*'admin'/g,
    () => { fileChanges++; return `isAdmin(session)`; }
  );

  // Pattern: session.role !== 'admin' or session?.role !== 'admin'
  content = content.replace(
    /session\??\.role\s*!==\s*'admin'/g,
    () => { fileChanges++; return `!isAdmin(session)`; }
  );

  // Pattern: session.role === 'xxx' or session?.role === 'xxx'
  content = content.replace(
    /session\??\.role\s*===\s*'([^']+)'/g,
    (match, role) => {
      fileChanges++;
      return `hasRole(session, '${role}')`;
    }
  );

  // Pattern: session.role !== 'xxx' or session?.role !== 'xxx'
  content = content.replace(
    /session\??\.role\s*!==\s*'([^']+)'/g,
    (match, role) => {
      fileChanges++;
      return `!hasRole(session, '${role}')`;
    }
  );

  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    totalChanges += fileChanges;
    console.log(`UPDATED (${fileChanges} changes): ${relPath}`);
  } else {
    console.log(`NO CHANGE: ${relPath}`);
  }
}

console.log(`\nDone! Total changes: ${totalChanges}`);
