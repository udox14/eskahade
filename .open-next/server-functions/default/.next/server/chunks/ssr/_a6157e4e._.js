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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},13750,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(13095);let g=["shubuh","ashar","maghrib"];async function h(){try{await (0,d.execute)(`
      CREATE TABLE IF NOT EXISTS pengajian_libur_sesi (
        tanggal    TEXT NOT NULL,
        sesi       TEXT NOT NULL,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (tanggal, sesi)
      )
    `)}catch{}}function i(a){return/^\d{4}-\d{2}-\d{2}$/.test(String(a||""))?String(a):""}function j(a,b){let c=i(a),d=i(b);return c||d?c&&d?c<=d?{start:c,end:d}:{start:d,end:c}:{start:c||d,end:d||c}:{start:"",end:""}}async function k(){let a=await (0,e.getSession)();if(!a)return{role:"guest",filter:null};let b=a.role;if((0,e.hasRole)(a,"pengurus_asrama"))return{role:b,type:"ASRAMA",value:a.asrama_binaan};if((0,e.hasRole)(a,"wali_kelas")){let c=await (0,d.queryOne)(`
      SELECT k.id FROM kelas k
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
      WHERE k.wali_kelas_id = ? LIMIT 1
    `,[a.id]);return{role:b,type:"KELAS",value:c?.id}}return{role:b,type:"GLOBAL",value:null}}async function l(a,b,c,e,f="",i=""){await h();let m=await k(),n=j(f,i),o=`
    SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
           rp.id AS riwayat_id,
           k.nama_kelas
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    WHERE s.status_global = 'aktif'
  `,p=[];if("ASRAMA"===m.type){if(!m.value)return[];o+=" AND s.asrama = ?",p.push(m.value)}else if("KELAS"===m.type){if(!m.value)return[];o+=" AND rp.kelas_id = ?",p.push(m.value)}b&&"ASRAMA"!==m.type&&(o+=" AND s.asrama = ?",p.push(b)),e&&(o+=" AND s.kamar = ?",p.push(e)),c&&"KELAS"!==m.type&&(o+=" AND rp.kelas_id = ?",p.push(c)),a&&(o+=" AND s.nama_lengkap LIKE ?",p.push(`%${a}%`)),o+=" ORDER BY s.nama_lengkap LIMIT 100";let q=await (0,d.query)(o,p);if(!q.length)return[];let r=q.map(a=>a.riwayat_id),s=r.map(()=>"?").join(","),t=n.start&&n.end?"AND tanggal >= ? AND tanggal <= ?":"",u=n.start&&n.end?[n.start,n.end]:[],v=await (0,d.query)(`
    SELECT riwayat_pendidikan_id, shubuh, ashar, maghrib
    FROM absensi_harian
    WHERE riwayat_pendidikan_id IN (${s})
      ${t}
      AND (
        shubuh IN ('A','S','I')
        OR ashar IN ('A','S','I')
        OR maghrib IN ('A','S','I')
      )
  `,[...r,...u]),w=0;if(n.start&&n.end){let a=await (0,d.query)(`
      SELECT tanggal, sesi
      FROM pengajian_libur_sesi
      WHERE tanggal >= ? AND tanggal <= ?
    `,[n.start,n.end]);w=function(a,b,c){if(!a||!b)return 0;let d=new Date(`${a}T00:00:00`),e=new Date(`${b}T00:00:00`),f=0;for(;d<=e;){let a=d.toISOString().split("T")[0];g.forEach(b=>{!function(a,b){let c=new Date(`${a}T00:00:00`).getDay();return 2===c&&"maghrib"===b||4===c&&"maghrib"===b||5===c&&("shubuh"===b||"ashar"===b)}(a,b)&&!c.has(`${a}-${b}`)&&f++}),d.setDate(d.getDate()+1)}return f}(n.start,n.end,new Set(a.map(a=>`${a.tanggal}-${a.sesi}`)))}return q.map(a=>{let b=v.filter(b=>b.riwayat_pendidikan_id===a.riwayat_id),c=0,d=0,e=0;b.forEach(a=>{"S"===a.shubuh&&c++,"I"===a.shubuh&&d++,"A"===a.shubuh&&e++,"S"===a.ashar&&c++,"I"===a.ashar&&d++,"A"===a.ashar&&e++,"S"===a.maghrib&&c++,"I"===a.maghrib&&d++,"A"===a.maghrib&&e++});let f=w>0?Math.max(w-c-d-e,0):0;return{id:a.id,nama:a.nama_lengkap,nis:a.nis,info_asrama:`${a.asrama||"-"} - Kamar ${a.kamar||"-"}`,info_kelas:a.nama_kelas||"-",total_h:f,total_s:c,total_i:d,total_a:e,total_masalah:c+d+e}}).sort((a,b)=>b.total_a-a.total_a)}async function m(a,b="",c=""){let e=await (0,d.queryOne)("SELECT id FROM riwayat_pendidikan WHERE santri_id = ? AND status_riwayat = 'aktif'",[a]);if(!e)return[];let f=j(b,c),g=f.start&&f.end?"AND tanggal >= ? AND tanggal <= ?":"",h=f.start&&f.end?[e.id,f.start,f.end]:[e.id];return(0,d.query)(`
    SELECT tanggal, shubuh, ashar, maghrib
    FROM absensi_harian
    WHERE riwayat_pendidikan_id = ?
      ${g}
      AND (
        shubuh IN ('A','S','I')
        OR ashar IN ('A','S','I')
        OR maghrib IN ('A','S','I')
      )
    ORDER BY tanggal DESC
  `,h)}async function n(){return{kelas:(await (0,d.query)(`
    SELECT k.id, k.nama_kelas
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
  `)).sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}}(0,f.ensureServerEntryExports)([k,l,m,n]),(0,c.registerServerReference)(k,"007c3a70e06d6cb1bf579f9bdbf0540f1ae76d63b6",null),(0,c.registerServerReference)(l,"7e62bdb5416c3bca7ec5fffa0999081d65c6af8de3",null),(0,c.registerServerReference)(m,"70e0b837d303aeb6373a2359cbac33cccfc36c0d7a",null),(0,c.registerServerReference)(n,"000b6f60a4dfc47adbb9f820a91fe688a4eef1c8b1",null),a.s([],24719),a.i(24719),a.s(["000b6f60a4dfc47adbb9f820a91fe688a4eef1c8b1",()=>n,"003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"007c3a70e06d6cb1bf579f9bdbf0540f1ae76d63b6",()=>k,"70e0b837d303aeb6373a2359cbac33cccfc36c0d7a",()=>m,"7e62bdb5416c3bca7ec5fffa0999081d65c6af8de3",()=>l],13750)}];

//# sourceMappingURL=_a6157e4e._.js.map