"use strict";exports.id=789,exports.ids=[789],exports.modules={1501:(a,b,c)=>{c.d(b,{cK:()=>g,n:()=>i});var d=c(23755),e=c(48445),f=c(55743);async function g(a,b){if(!a)return!1;if((0,d.qc)(a))return!0;let c=(0,d.XV)(a);if(0===c.length)return!1;try{return await (0,e.kO)(b,c,a.id)}catch(a){return console.error("[feature] canAccessFeatureForSession ERROR untuk",b,"-",a?.message),!1}}async function h(a,b,c="read"){return"read"===c?g(a,b):(0,f.Yf)(a,b,c)}async function i(a,b="read"){let c=await (0,d.Ht)();return c?await h(c,a,b)?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},45502:(a,b,c)=>{c.d(b,{F:()=>g,S:()=>h});var d=c(23755),e=c(1501),f=c(91970);async function g(a){let b=await (0,d.Ht)();b||(0,f.redirect)("/login");let c=(0,d.XV)(b);if(c.includes("admin"))return b;let g=!1;try{g=await (0,e.cK)(b,a)}catch(c){return console.error("[guard] canAccessHref ERROR untuk",a,"-",c?.message),console.error("[guard] PERINGATAN: pastikan migration 0011_fitur_akses.sql sudah dijalankan di D1!"),b}return console.log("[guard] href:",a,"| roles:",c,"| allowed:",g),g||(0,f.redirect)("/dashboard"),b}async function h(a=[]){let b=await (0,d.Ht)();return b||(0,f.redirect)("/login"),a.length>0&&((0,d.XV)(b).some(b=>a.includes(b))||(0,f.redirect)("/dashboard")),b}},47703:(a,b,c)=>{c.d(b,{B:()=>g,E:()=>f});let d="SHA-256",e="PBKDF2";async function f(a){let b=new TextEncoder,c=crypto.getRandomValues(new Uint8Array(16)),f=await crypto.subtle.importKey("raw",b.encode(a),{name:e},!1,["deriveBits"]),g=Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:e,salt:c,iterations:1e5,hash:d},f,256))),h=Array.from(c).map(a=>a.toString(16).padStart(2,"0")).join(""),i=g.map(a=>a.toString(16).padStart(2,"0")).join("");return`${h}:${i}`}async function g(a,b){try{let[c,f]=b.split(":");if(!c||!f)return!1;let g=new Uint8Array(c.match(/.{2}/g).map(a=>parseInt(a,16))),h=new TextEncoder,i=await crypto.subtle.importKey("raw",h.encode(a),{name:e},!1,["deriveBits"]),j=await crypto.subtle.deriveBits({name:e,salt:g,iterations:1e5,hash:d},i,256);return Array.from(new Uint8Array(j)).map(a=>a.toString(16).padStart(2,"0")).join("")===f}catch{return!1}}},47888:(a,b,c)=>{c.d(b,{Az:()=>k,Bl:()=>A,Dw:()=>t,Hz:()=>n,Io:()=>y,Oo:()=>s,Rw:()=>v,Xn:()=>u,_p:()=>p,dL:()=>q,fQ:()=>o,kM:()=>w,lJ:()=>r,lO:()=>m});var d=c(44916),e=c(87821);let f=["shubuh","ashar","maghrib"],g={0:"Ahad",1:"Sen",2:"Sel",3:"Rab",4:"Kam",5:"Jum",6:"Sab"},h=[1,2,3,4,5,6,0],i=new Map(h.map((a,b)=>[a,b])),j=null;async function k(){j??=l().catch(a=>{throw j=null,a}),await j}async function l(){for(let a of(await (0,d.g7)(`
    CREATE TABLE IF NOT EXISTS kelas_jadwal_guru_mingguan (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      kelas_id    TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
      sesi        TEXT NOT NULL,
      hari_index  INTEGER NOT NULL,
      guru_id     INTEGER NOT NULL REFERENCES data_guru(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(kelas_id, sesi, hari_index)
    )
  `),await (0,d.g7)(`
    CREATE INDEX IF NOT EXISTS idx_kelas_jadwal_guru_mingguan_lookup
    ON kelas_jadwal_guru_mingguan(kelas_id, sesi, hari_index)
  `),await (0,d.g7)(`
    CREATE INDEX IF NOT EXISTS idx_kelas_jadwal_guru_mingguan_guru
    ON kelas_jadwal_guru_mingguan(guru_id, sesi, hari_index)
  `),await (0,d.g7)(`
    CREATE TABLE IF NOT EXISTS kelas_gabungan_pengajian (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      group_key        TEXT NOT NULL,
      nama             TEXT NOT NULL,
      sesi             TEXT NOT NULL,
      tempat           TEXT,
      tahun_ajaran_id  INTEGER REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tahun_ajaran_id, sesi, group_key)
    )
  `),await (0,d.g7)(`
    CREATE TABLE IF NOT EXISTS kelas_gabungan_pengajian_anggota (
      group_id    INTEGER NOT NULL REFERENCES kelas_gabungan_pengajian(id) ON DELETE CASCADE,
      kelas_id    TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (group_id, kelas_id)
    )
  `),await (0,d.g7)(`
    CREATE INDEX IF NOT EXISTS idx_kelas_gabungan_pengajian_lookup
    ON kelas_gabungan_pengajian(tahun_ajaran_id, sesi, group_key)
  `),await (0,d.g7)(`
    CREATE INDEX IF NOT EXISTS idx_kelas_gabungan_pengajian_anggota_kelas
    ON kelas_gabungan_pengajian_anggota(kelas_id)
  `),["ALTER TABLE absensi_guru ADD COLUMN guru_shubuh_id_snapshot INTEGER REFERENCES data_guru(id)","ALTER TABLE absensi_guru ADD COLUMN guru_shubuh_nama_snapshot TEXT","ALTER TABLE absensi_guru ADD COLUMN guru_ashar_id_snapshot INTEGER REFERENCES data_guru(id)","ALTER TABLE absensi_guru ADD COLUMN guru_ashar_nama_snapshot TEXT","ALTER TABLE absensi_guru ADD COLUMN guru_maghrib_id_snapshot INTEGER REFERENCES data_guru(id)","ALTER TABLE absensi_guru ADD COLUMN guru_maghrib_nama_snapshot TEXT"]))try{await (0,d.g7)(a)}catch(a){if(!String(a?.message||"").toLowerCase().includes("duplicate column name"))throw a}await (0,e.p)()}async function m(a){await k();let b=(a||[]).filter(Boolean),c=b.length>0?`WHERE a.kelas_id IN (${b.map(()=>"?").join(",")})`:"";return(0,d.P)(`
    SELECT
      g.id,
      g.group_key,
      g.nama,
      g.sesi,
      g.tempat,
      g.tahun_ajaran_id,
      a.kelas_id,
      k.nama_kelas
    FROM kelas_gabungan_pengajian g
    JOIN kelas_gabungan_pengajian_anggota a ON a.group_id = g.id
    JOIN kelas k ON k.id = a.kelas_id
    ${c}
    ORDER BY g.sesi, g.group_key, k.nama_kelas
  `,b)}function n(a){let b=new Map;for(let c of a)b.set(`${c.kelas_id}|${c.sesi}`,c);return b}function o(a){let b=new Map;for(let c of a)b.has(c.id)||b.set(c.id,[]),b.get(c.id).push(c);for(let a of b.values())a.sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}));return b}async function p(a,b,c){for(let e of(await k(),c)){if(!f.includes(e.sesi))continue;await (0,d.g7)(`
      DELETE FROM kelas_gabungan_pengajian_anggota
      WHERE kelas_id = ?
        AND group_id IN (SELECT id FROM kelas_gabungan_pengajian WHERE sesi = ? AND tahun_ajaran_id IS ?)
    `,[a,e.sesi,b]);let c=String(e.groupKey||"").trim().replace(/\s+/g," ");if(!c)continue;let g=String(e.tempat||"").trim()||null;await (0,d.g7)(`
      INSERT INTO kelas_gabungan_pengajian (group_key, nama, sesi, tempat, tahun_ajaran_id, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(tahun_ajaran_id, sesi, group_key) DO UPDATE SET
        nama = excluded.nama,
        tempat = COALESCE(excluded.tempat, kelas_gabungan_pengajian.tempat),
        updated_at = excluded.updated_at
    `,[c,c,e.sesi,g,b]);let h=await (0,d.P)(`
      SELECT id
      FROM kelas_gabungan_pengajian
      WHERE tahun_ajaran_id IS ? AND sesi = ? AND group_key = ?
      LIMIT 1
    `,[b,e.sesi,c]),i=h[0]?.id;i&&await (0,d.g7)(`
      INSERT OR IGNORE INTO kelas_gabungan_pengajian_anggota (group_id, kelas_id)
      VALUES (?, ?)
    `,[i,a])}await (0,d.g7)(`
    DELETE FROM kelas_gabungan_pengajian
    WHERE id NOT IN (SELECT DISTINCT group_id FROM kelas_gabungan_pengajian_anggota)
  `)}function q(a,b){return 2===a&&"maghrib"===b||4===a&&"maghrib"===b||5===a&&("shubuh"===b||"ashar"===b)}function r(a){return(a instanceof Date,new Date(a)).getDay()}async function s(a){await k();let b=(a||[]).filter(Boolean),c=b.length>0?`WHERE r.kelas_id IN (${b.map(()=>"?").join(",")})`:"";return(0,d.P)(`
    SELECT
      r.id,
      r.kelas_id,
      r.sesi,
      r.hari_index,
      r.guru_id,
      g.nama_lengkap as guru_nama
    FROM kelas_jadwal_guru_mingguan r
    JOIN data_guru g ON g.id = r.guru_id
    ${c}
    ORDER BY r.kelas_id, r.sesi, r.hari_index
  `,b)}function t(a){return new Map(a.map(a=>[`${a.kelas_id}|${a.sesi}|${a.hari_index}`,a]))}function u(a,b,c){let d={};for(let e of f){let f=c.get(`${a.id}|${e}|${b}`);if(f){d[e]={id:f.guru_id,nama:f.guru_nama??null,source:"override"};continue}d[e]="shubuh"===e?{id:a.guru_shubuh_id??null,nama:a.guru_shubuh_nama??null,source:"default"}:"ashar"===e?{id:a.guru_ashar_id??null,nama:a.guru_ashar_nama??null,source:"default"}:{id:a.guru_maghrib_id??null,nama:a.guru_maghrib_nama??null,source:"default"}}return d}function v(a,b,c){return u(a,r(b),c)}function w(a,b,c){return b.map(b=>({tanggal:b,hari_index:r(b),guru:v(a,b,c)}))}function x(a,b,c,d){let e=d?.skipStructuralLibur??!0,f=new Map;for(let d of h){if(e&&q(d,b))continue;let g=u(a,d,c)[b];if(!g.id||!g.nama)continue;let h=`${g.id}`;f.has(h)||f.set(h,{nama:g.nama,hari:[]}),f.get(h).hari.push(d)}return 0===f.size?"-":Array.from(f.values()).map(a=>`${a.nama} (${function(a){let b=[...a].sort((a,b)=>(i.get(a)??0)-(i.get(b)??0)),c=[];for(let a of b){let b=i.get(a)??0,d=c[c.length-1];if(!d){c.push([a]);continue}let e=d[d.length-1];b===(i.get(e)??0)+1?d.push(a):c.push([a])}return c.map(a=>{let b=g[a[0]],c=g[a[a.length-1]];return 1===a.length?b:`${b}-${c}`}).join(", ")}(a.hari)})`).join(", ")}function y(a,b,c){return{shubuh:x(a,"shubuh",b,c),ashar:x(a,"ashar",b,c),maghrib:x(a,"maghrib",b,c)}}function z(a,b,c,d){let e=d?.skipStructuralLibur??!0,f=d?.separator??"\n",g=new Set,i=[];for(let d of h){if(e&&q(d,b))continue;let f=u(a,d,c)[b];if(!f.id||!f.nama)continue;let h=`${f.id}`;g.has(h)||(g.add(h),i.push(f.nama))}return i.length>0?i.join(f):"-"}function A(a,b,c){return{shubuh:z(a,"shubuh",b,c),ashar:z(a,"ashar",b,c),maghrib:z(a,"maghrib",b,c)}}},55743:(a,b,c)=>{c.d(b,{HA:()=>k,Yf:()=>i,ZW:()=>j,hj:()=>h});var d=c(44075),e=c(23755),f=c(65926);function g(a){return{fitur_href:a.fitur_href,role:a.role,can_create:1===a.can_create,can_update:1===a.can_update,can_delete:1===a.can_delete}}async function h(){try{return(await (0,d.P)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       ORDER BY fitur_href, role`)).map(g)}catch(a){return console.error("[crud] getCrudPermissionsForAdmin ERROR:",a?.message),[]}}async function i(a,b,c){if(!a)return!1;if((0,e.qc)(a))return!0;let g=(0,e.XV)(a);if(0===g.length)return!1;try{return(await (0,d.P)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       WHERE fitur_href = ?
         AND ${"create"===c?"can_create":"update"===c?"can_update":"can_delete"} = 1`,[b])).some(a=>(0,f.Q)([a.role],g))}catch(a){return console.error("[crud] canCrudForSession ERROR:",a?.message),!1}}async function j(a,b){return i(await (0,e.Ht)(),a,b)}async function k(a,b){let c=await (0,e.Ht)(),d=await i(c,a,b);return c?d?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},87821:(a,b,c)=>{c.d(b,{p:()=>h});var d=c(44916),e=c(47703);async function f(a,b,c,e){let f=function(a,b){try{if(a){let b=JSON.parse(a);if(Array.isArray(b)&&b.length>0)return b}}catch{}return b?[b]:[]}(c,b);for(let a of e)f.includes(a)||f.push(a);await (0,d.P)("UPDATE users SET roles = ?, updated_at = datetime('now') WHERE id = ?",[JSON.stringify(f),a])}async function g(a){let b,c=await (0,d.Zy)("SELECT id, nama_lengkap FROM data_guru WHERE id = ?",[a]);if(!c)return null;let g=await (0,d.Zy)(`SELECT id, role, roles
     FROM users
     WHERE lower(trim(full_name)) = lower(trim(?))
       AND (
         role IN ('wali_kelas', 'sekpen')
         OR EXISTS (
           SELECT 1
           FROM json_each(COALESCE(users.roles, '[]'))
           WHERE value IN ('wali_kelas', 'sekpen')
         )
       )
     LIMIT 1`,[c.nama_lengkap]);if(g)return await f(g.id,g.role,g.roles,["guru"]),g.id;let h=(b=c.nama_lengkap.toLowerCase().replace(/[^a-z0-9]/g,""),`${b}@sukahideng.or.id`),i=await (0,d.Zy)("SELECT id, role, roles, source_type, source_ref_id FROM users WHERE email = ? LIMIT 1",[h]);if(i)return await f(i.id,i.role,i.roles,["wali_kelas","guru"]),i.source_type||i.source_ref_id||await (0,d.P)("UPDATE users SET source_type = ?, source_ref_id = ?, updated_at = datetime('now') WHERE id = ?",["guru",String(c.id),i.id]),i.id;let j=crypto.randomUUID(),k=await (0,e.E)("eskahade2026");return await (0,d.P)(`INSERT INTO users (id, email, password_hash, full_name, role, roles, source_type, source_ref_id)
     VALUES (?, ?, ?, ?, 'wali_kelas', ?, 'guru', ?)`,[j,h,k,c.nama_lengkap,JSON.stringify(["wali_kelas","guru"]),String(c.id)]),j}async function h(a){let b=a?.filter(Boolean)??[],c=b.length>0?`WHERE k.id IN (${b.map(()=>"?").join(",")}) AND k.guru_maghrib_id IS NOT NULL AND k.wali_kelas_id IS NULL`:"WHERE k.guru_maghrib_id IS NOT NULL AND k.wali_kelas_id IS NULL",e=await (0,d.P)(`
    SELECT k.id as kelas_id, k.guru_maghrib_id
    FROM kelas k
    ${c}
  `,b),f=[];for(let a of e){let b=await g(Number(a.guru_maghrib_id));b&&f.push({sql:"UPDATE kelas SET wali_kelas_id = ? WHERE id = ?",params:[b,a.kelas_id]})}return f.length>0&&await (0,d.vA)(f),{synced:f.length}}}};