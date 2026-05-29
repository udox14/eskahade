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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},3208,a=>{"use strict";function b(a,c="start"){let d=a.trim();return new Date(d?`${d}${"end"===c?"T23:59:59.999+07:00":"T00:00:00+07:00"}`:"")}function c(a){let b=a.trim();if(!b)return new Date("");if(/[zZ]$|[+\-]\d{2}:\d{2}$/.test(b))return new Date(b);let c=16===b.length?`${b}:00`:b;return new Date(`${c}+07:00`)}a.s(["parseWibDate",()=>b,"parseWibDateTime",()=>c])},34924,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(3208),h=a.i(18558),i=a.i(13095);let j="/dashboard/asrama/santri-kembali";async function k(){let a=await (0,e.getSession)();return a&&(0,e.hasAnyRole)(a,["admin","pengurus_asrama","dewan_santri"])?a:null}async function l(){let a=await (0,e.getSession)();return a&&(0,e.hasRole)(a,"pengurus_asrama")?a.asrama_binaan??null:null}async function m(){let a=await (0,e.getSession)();return a?{role:a.role,asrama_binaan:(0,e.hasRole)(a,"pengurus_asrama")?a.asrama_binaan??null:null,isAdmin:(0,e.isAdmin)(a)}:null}async function n(){let a=await l();return a?[a]:(await (0,d.query)(`
    SELECT DISTINCT asrama
    FROM santri
    WHERE status_global = 'aktif'
      AND asrama IS NOT NULL
      AND asrama != ''
    ORDER BY asrama
  `)).map(a=>a.asrama)}async function o(a){if(!await k())return{rows:[],total:0,overdueTotal:0,hasMore:!1};let b=await l(),c=["p.jenis = 'PULANG'","p.status = 'AKTIF'","p.tgl_kembali_aktual IS NULL"],e=[],f=Math.min(Math.max(a.limit??30,1),100),g=Math.max(a.offset??0,0),h=b||a.asrama;h&&"SEMUA"!==h&&(c.push("s.asrama = ?"),e.push(h));let i=a.search?.trim();i&&(c.push("(s.nama_lengkap LIKE ? OR s.nis LIKE ? OR s.kamar LIKE ?)"),e.push(`%${i}%`,`%${i}%`,`%${i}%`));let j=c.join(" AND "),[m,n]=await Promise.all([(0,d.queryOne)(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN p.tgl_selesai_rencana < ? THEN 1 ELSE 0 END) AS overdueTotal
      FROM perizinan p
      JOIN santri s ON s.id = p.santri_id
      WHERE ${j}
    `,[new Date().toISOString(),...e]),(0,d.query)(`
    SELECT
      p.id,
      p.santri_id,
      p.alasan,
      p.pemberi_izin,
      p.tgl_mulai,
      p.tgl_selesai_rencana,
      p.created_at,
      s.nama_lengkap AS nama,
      s.nis,
      s.asrama,
      s.kamar,
      s.foto_url
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE ${j}
    ORDER BY p.tgl_selesai_rencana ASC, s.asrama, s.kamar, s.nama_lengkap
    LIMIT ? OFFSET ?
    `,[...e,f+1,g])]);return{rows:n.slice(0,f),total:m?.total??0,overdueTotal:m?.overdueTotal??0,hasMore:n.length>f}}async function p(a,b){let c=await k();if(!c)return{error:"Akses ditolak"};let e=await (0,d.queryOne)(`
    SELECT p.id, p.jenis, p.status, p.tgl_selesai_rencana, s.asrama, s.nama_lengkap
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE p.id = ?
  `,[a]);if(!e)return{error:"Data izin tidak ditemukan."};if("PULANG"!==e.jenis)return{error:"Hanya izin pulang yang bisa ditandai dari fitur ini."};if("AKTIF"!==e.status)return{error:"Izin ini sudah selesai."};let i=await l();if(i&&e.asrama!==i)return{error:"Pengurus asrama hanya bisa menandai santri asramanya."};let m=(0,g.parseWibDate)(b,"start");if(Number.isNaN(m.getTime()))return{error:"Waktu datang tidak valid."};let n=m>new Date(e.tgl_selesai_rencana),o=n?"AKTIF":"KEMBALI";return(await (0,d.execute)(`
    UPDATE perizinan
    SET status = ?, tgl_kembali_aktual = ?
    WHERE id = ?
  `,[o,m.toISOString(),a]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"asrama_santri_kembali",action:"update",fiturHref:j,logKind:"update",entityType:"perizinan",entityId:a,entityLabel:e.nama_lengkap||a,summary:`Menandai santri kembali ${e.nama_lengkap||a}`,details:{waktu_datang:m.toISOString(),status_final:o,telat:n}}),(0,h.revalidatePath)(j),(0,h.revalidatePath)("/dashboard/keamanan/perizinan"),(0,h.revalidatePath)("/dashboard/keamanan/perizinan/verifikasi-telat"),n)?{success:!0,telat:!0,message:"Santri ditandai datang terlambat dan masuk verifikasi telat."}:{success:!0,telat:!1,message:"Santri sudah ditandai kembali."}}(0,i.ensureServerEntryExports)([m,n,o,p]),(0,c.registerServerReference)(m,"005606b1e4f3f1c0a88100312ebfdc211aae7746bb",null),(0,c.registerServerReference)(n,"00aea61e6d587749d6a02af75ab81453f11ec221d4",null),(0,c.registerServerReference)(o,"40fbd6484352d32aa2b3467fcf5d0817fcf8eb9f0a",null),(0,c.registerServerReference)(p,"608fa2a8380c497dce40a1c0ce2f55c1db3f0be67c",null),a.s([],21120),a.i(21120),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"005606b1e4f3f1c0a88100312ebfdc211aae7746bb",()=>m,"00aea61e6d587749d6a02af75ab81453f11ec221d4",()=>n,"40fbd6484352d32aa2b3467fcf5d0817fcf8eb9f0a",()=>o,"608fa2a8380c497dce40a1c0ce2f55c1db3f0be67c",()=>p],34924)}];

//# sourceMappingURL=_4964085d._.js.map