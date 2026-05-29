module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},6846,a=>{"use strict";var b=a.i(5246),c=a.i(12259);let d=new Set(["password","password_hash","token","cookie","cookies","authorization","auth","secret"]),e=null,f=new Map;function g(a,b=500){return a.length<=b?a:`${a.slice(0,b)}...`}function h(a){return null==a?null:"string"==typeof a?g(a):"number"==typeof a||"boolean"==typeof a?a:Array.isArray(a)?a.slice(0,25).map(h):"object"==typeof a?Object.fromEntries(Object.entries(a).filter(([a])=>!d.has(a.toLowerCase())).slice(0,50).map(([a,b])=>[a,h(b)])):String(a)}function i(a){return a?{id:a.id,name:a.full_name,email:a.email,roles:a.roles}:null}async function j(){try{let a=await (0,b.headers)(),c=a.get("x-forwarded-for");return{ipAddress:a.get("cf-connecting-ip")??(c?c.split(",")[0]?.trim():null)??null,userAgent:a.get("user-agent")}}catch{return{ipAddress:null,userAgent:null}}}async function k(){e||(e=(async()=>{await (0,c.execute)(`
        CREATE TABLE IF NOT EXISTS activity_log (
          id            TEXT PRIMARY KEY,
          created_at    TEXT NOT NULL DEFAULT (datetime('now')),
          actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          actor_name    TEXT,
          actor_roles   TEXT,
          module        TEXT NOT NULL,
          action        TEXT NOT NULL,
          entity_type   TEXT,
          entity_id     TEXT,
          entity_label  TEXT,
          summary       TEXT NOT NULL,
          details_json  TEXT,
          status        TEXT NOT NULL DEFAULT 'success',
          ip_address    TEXT,
          user_agent    TEXT
        )
      `),await (0,c.execute)(`
        CREATE TABLE IF NOT EXISTS activity_log_config (
          fitur_href   TEXT PRIMARY KEY,
          group_name   TEXT NOT NULL,
          title        TEXT NOT NULL,
          log_create   INTEGER NOT NULL DEFAULT 1,
          log_update   INTEGER NOT NULL DEFAULT 1,
          log_delete   INTEGER NOT NULL DEFAULT 1,
          updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
          updated_by   TEXT REFERENCES users(id) ON DELETE SET NULL
        )
      `),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_actor_user_id ON activity_log(actor_user_id)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_module ON activity_log(module)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_entity_id ON activity_log(entity_id)");try{await (0,c.execute)(`
          INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
          VALUES ('Master Data', 'Log Aktivitas', '/dashboard/pengaturan/log-aktivitas', 'ClipboardList', '["admin"]', 1, 9)
        `),await (0,c.execute)(`
          INSERT OR IGNORE INTO activity_log_config (
            fitur_href, group_name, title, log_create, log_update, log_delete, updated_at
          )
          SELECT href, group_name, title, 1, 1, 1, datetime('now')
          FROM fitur_akses
          WHERE href IS NOT NULL
            AND TRIM(href) <> ''
        `)}catch{}})().catch(a=>{throw e=null,a})),await e}async function l(a,b){if(!a||!b)return!0;let d=`${a}:${b}`,e=f.get(d);if(e&&e.expiresAt>Date.now())return e.values[b];await k();let g=await (0,c.queryOne)(`SELECT log_create, log_update, log_delete
     FROM activity_log_config
     WHERE fitur_href = ?`,[a]),h=g?{create:1===g.log_create,update:1===g.log_update,delete:1===g.log_delete}:{create:!0,update:!0,delete:!0},i=Date.now()+6e4;return f.set(`${a}:create`,{expiresAt:i,values:h}),f.set(`${a}:update`,{expiresAt:i,values:h}),f.set(`${a}:delete`,{expiresAt:i,values:h}),h[b]}async function m(){return await k(),(0,c.query)(`SELECT fitur_href, group_name, title, log_create, log_update, log_delete, updated_at, updated_by
     FROM activity_log_config
     ORDER BY group_name ASC, title ASC`)}async function n(a,b,d){await k();let e=await (0,c.queryOne)(`SELECT fitur_href, group_name, title, log_create, log_update, log_delete, updated_at, updated_by
     FROM activity_log_config
     WHERE fitur_href = ?`,[a]);if(!e)throw Error("Konfigurasi log fitur tidak ditemukan.");let g={create:b.create??1===e.log_create,update:b.update??1===e.log_update,delete:b.delete??1===e.log_delete};await (0,c.execute)(`UPDATE activity_log_config
     SET log_create = ?, log_update = ?, log_delete = ?, updated_at = datetime('now'), updated_by = ?
     WHERE fitur_href = ?`,[+!!g.create,+!!g.update,+!!g.delete,d,a]);let h=Date.now()+6e4,i={create:g.create,update:g.update,delete:g.delete};f.set(`${a}:create`,{expiresAt:h,values:i}),f.set(`${a}:update`,{expiresAt:h,values:i}),f.set(`${a}:delete`,{expiresAt:h,values:i})}async function o(a){try{var b,d;if(await k(),!await l(a.fiturHref,a.logKind))return;let e=a.requestInfo??await j(),f=a.actor??null;await (0,c.execute)(`INSERT INTO activity_log (
        id, created_at, actor_user_id, actor_name, actor_roles, module, action,
        entity_type, entity_id, entity_label, summary, details_json, status,
        ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},88283,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(13095);let f=()=>({total:0,keluar_bulan_ini:0,masuk_bulan_ini:0,jenis_kelamin:{L:0,P:0},jenjang:{SLTP:0,SLTA:0,KULIAH:0,SADESA:0,TIDAK_SEKOLAH:0,LAINNYA:0,detail:{}},kelas_sekolah:{},marhalah:{},distribusi_kamar:{},santri_kamar:{}});async function g(a){let b="AND UPPER(TRIM(COALESCE(s.asrama, ''))) <> 'AL-BAGHORY'",c=a&&"SEMUA"!==a?"AND s.asrama = ?":"",e=a&&"SEMUA"!==a?[a]:[],g=new Date,h=new Date(g.getFullYear(),g.getMonth(),1).toISOString(),[i,j,k]=await Promise.all([(0,d.query)(`
      SELECT s.id, s.nama_lengkap, s.nis, s.jenis_kelamin, s.kategori_santri, s.sekolah, s.kelas_sekolah,
             s.asrama, s.kamar, s.created_at,
             m.nama AS marhalah_nama, k.nama_kelas
      FROM santri s
      LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
      LEFT JOIN kelas k ON k.id = rp.kelas_id
      LEFT JOIN marhalah m ON m.id = k.marhalah_id
      WHERE s.status_global = 'aktif' ${b} ${c}
    `,e),(0,d.queryOne)(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN s.jenis_kelamin = 'L' THEN 1 ELSE 0 END) AS L,
        SUM(CASE WHEN s.jenis_kelamin = 'P' THEN 1 ELSE 0 END) AS P,
        SUM(CASE WHEN s.created_at >= ? THEN 1 ELSE 0 END) AS masuk
      FROM santri s
      WHERE s.status_global = 'aktif' ${b} ${c}
    `,[h,...e]),(0,d.queryOne)(`
      SELECT COUNT(*) AS total FROM riwayat_surat rs
      JOIN santri s ON s.id = rs.santri_id
      WHERE rs.jenis_surat = 'BERHENTI' AND rs.created_at >= ?
      ${b}
      ${c}
    `,[h,...e])]);if(!i.length)return f();let l=f();return l.total=j?.total??i.length,l.jenis_kelamin.L=j?.L??0,l.jenis_kelamin.P=j?.P??0,l.masuk_bulan_ini=j?.masuk??0,l.keluar_bulan_ini=k?.total??0,i.forEach(a=>{let b=function(a,b){if("SADESA"===b)return"SADESA";if(!a)return"TIDAK_SEKOLAH";let c=a.toUpperCase();return c.includes("MTS")||c.includes("SMP")?"SLTP":c.includes("MA")||c.includes("SMA")||c.includes("SMK")?"SLTA":c.includes("KULIAH")||c.includes("UNIVERSITAS")||c.includes("ST")?"KULIAH":"LAINNYA"}(a.sekolah,a.kategori_santri);l.jenjang[b]++;let c="SADESA"===a.kategori_santri?"SADESA":a.sekolah?a.sekolah.toUpperCase():"TIDAK SEKOLAH";l.jenjang.detail[c]=(l.jenjang.detail[c]||0)+1;let d=a.kelas_sekolah?a.kelas_sekolah.toUpperCase():"BELUM SET";l.kelas_sekolah[d]=(l.kelas_sekolah[d]||0)+1;let e=a.marhalah_nama||"BELUM MASUK KELAS";l.marhalah[e]=(l.marhalah[e]||0)+1;let f=a.asrama||"LAINNYA",g=a.kamar||"?";l.distribusi_kamar[f]||(l.distribusi_kamar[f]={}),l.distribusi_kamar[f][g]=(l.distribusi_kamar[f][g]||0)+1,l.santri_kamar[f]||(l.santri_kamar[f]={}),l.santri_kamar[f][g]||(l.santri_kamar[f][g]=[]),l.santri_kamar[f][g].push({id:a.id,nama_lengkap:a.nama_lengkap,nis:a.nis,kelas_pesantren:a.nama_kelas||null,sekolah:a.sekolah,kelas_sekolah:a.kelas_sekolah})}),l}(0,e.ensureServerEntryExports)([g]),(0,c.registerServerReference)(g,"40ead15f3ed9eec71c9b8fa5a47438b861279e7bf5",null),a.s([],15342),a.i(15342),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"40ead15f3ed9eec71c9b8fa5a47438b861279e7bf5",()=>g],88283)}];

//# sourceMappingURL=_c5b53533._.js.map