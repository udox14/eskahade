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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},14534,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(18558);function h(a){return a.trim().toLowerCase().replace(/\s+/g," ")}function i(a=[]){return a.map((a,b)=>"string"==typeof a?{marhalah_nama:a,seat_parity:b%2==0?"odd":"even"}:{marhalah_nama:a.marhalah_nama,seat_parity:"even"===a.seat_parity?"even":"odd"})}function j(a,b){let c=b.findIndex(b=>h(b.marhalah_nama)===h(a.marhalah_nama));return -1===c?b.length+a.marhalah_urutan:c}function k(a,b){let c=b.find(b=>h(b.marhalah_nama)===h(a));return c?.seat_parity??"even"}async function l(){await (0,d.execute)(`
    CREATE TABLE IF NOT EXISTS ehb_plotting_preference (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      order_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(ehb_event_id)
    )
  `)}function m(a){if(!a||"object"!=typeof a||Array.isArray(a))return{};let b={};for(let[c,d]of Object.entries(a))Array.isArray(d)&&(b[c]=i(d.filter(Boolean)));return b}async function n(a){await l();let b=await (0,d.queryOne)("SELECT order_json FROM ehb_plotting_preference WHERE ehb_event_id = ?",[a]);if(!b?.order_json)return{};try{return m(JSON.parse(b.order_json))}catch{return{}}}async function o(a,b){await l(),await (0,d.execute)(`
    INSERT INTO ehb_plotting_preference (ehb_event_id, order_json, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(ehb_event_id) DO UPDATE SET
      order_json = excluded.order_json,
      updated_at = datetime('now')
  `,[a,JSON.stringify(m(b))])}async function p(a){let b=await (0,d.query)(`
    SELECT 
      s.jenis_kelamin,
      kj.jam_group,
      COUNT(s.id) as total_santri,
      SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END) as terplot,
      COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN p.ruangan_id END) as ruangan_terpakai
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN ehb_kelas_jam kj ON kj.kelas_id = rp.kelas_id AND kj.ehb_event_id = ?
    JOIN kelas k ON k.id = rp.kelas_id
    JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN ehb_plotting_santri p ON p.santri_id = s.id AND p.ehb_event_id = ? AND p.jam_group = kj.jam_group
    WHERE (
      s.status_global = 'aktif'
      OR (s.status_global = 'nonaktif_sementara' AND s.kelas_sekolah = '9')
    ) AND m.nama NOT LIKE '%Mutaqaddimah%'
    GROUP BY s.jenis_kelamin, kj.jam_group
  `,[a,a]),c=await (0,d.query)(`
    SELECT jenis_kelamin, SUM(kapasitas) as total_kapasitas, COUNT(id) as total_ruangan
    FROM ehb_ruangan
    WHERE ehb_event_id = ?
    GROUP BY jenis_kelamin
  `,[a]),e=await (0,d.query)(`
    SELECT jenis_kelamin, kapasitas, nomor_ruangan
    FROM ehb_ruangan
    WHERE ehb_event_id = ?
    ORDER BY jenis_kelamin, kapasitas DESC, nomor_ruangan ASC
  `,[a]),f=await (0,d.query)(`
    SELECT DISTINCT jam_group FROM ehb_kelas_jam WHERE ehb_event_id = ?
  `,[a]),g=await (0,d.query)(`
    SELECT
      kj.jam_group,
      m.nama AS marhalah_nama,
      m.urutan AS marhalah_urutan,
      COUNT(DISTINCT s.id) AS total_santri
    FROM ehb_kelas_jam kj
    JOIN kelas k ON k.id = kj.kelas_id
    JOIN marhalah m ON m.id = k.marhalah_id
    JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
    JOIN santri s ON s.id = rp.santri_id
    WHERE kj.ehb_event_id = ?
      AND (
        s.status_global = 'aktif'
        OR (s.status_global = 'nonaktif_sementara' AND s.kelas_sekolah = '9')
      )
      AND m.nama NOT LIKE '%Mutaqaddimah%'
    GROUP BY kj.jam_group, m.nama, m.urutan
    ORDER BY kj.jam_group, m.urutan, m.nama
  `,[a]),h=await n(a);return{status:b,kapasitas:c,kapasitasDetail:e,jamGroups:f.map(a=>a.jam_group),marhalahOrders:g,plottingPreferences:h}}async function q(a,b){let c=await (0,e.getSession)();return c?(await o(a,b),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"ehb_ruangan_plotting",action:"update",fiturHref:"/dashboard/ehb/ruangan/plotting",logKind:"update",entityType:"ehb_plotting_preference",entityId:String(a),entityLabel:"Preferensi plotting EHB",summary:"Menyimpan preferensi urutan plotting EHB",details:{order_by_jam_group:b}}),(0,g.revalidatePath)("/dashboard/ehb/ruangan/plotting"),{success:!0}):{error:"Unauthorized"}}async function r(a){let b=await (0,e.getSession)();return b?(await (0,d.execute)("DELETE FROM ehb_plotting_santri WHERE ehb_event_id = ?",[a]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"ehb_ruangan_plotting",action:"delete",fiturHref:"/dashboard/ehb/ruangan/plotting",logKind:"delete",entityType:"ehb_plotting_santri_batch",entityId:String(a),entityLabel:"Plotting ruangan EHB",summary:"Mereset plotting peserta EHB"}),(0,g.revalidatePath)("/dashboard/ehb/ruangan/plotting"),(0,g.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0}):{error:"Unauthorized"}}async function s(a,b={}){let c=await (0,e.getSession)();if(!c)return{error:"Unauthorized"};try{let e=(await (0,d.query)("SELECT DISTINCT jam_group FROM ehb_kelas_jam WHERE ehb_event_id = ?",[a])).map(a=>a.jam_group);if(0===e.length)return{error:"Belum ada mapping kelas ke jam group. Atur dulu di menu Jadwal EHB."};b.orderByJamGroup&&await o(a,m(b.orderByJamGroup));let h=await (0,d.query)("SELECT id, nomor_ruangan, kapasitas FROM ehb_ruangan WHERE ehb_event_id = ? AND jenis_kelamin = 'L' ORDER BY nomor_ruangan",[a]),l=await (0,d.query)("SELECT id, nomor_ruangan, kapasitas FROM ehb_ruangan WHERE ehb_event_id = ? AND jenis_kelamin = 'P' ORDER BY nomor_ruangan",[a]);if(0===h.length&&0===l.length)return{error:"Belum ada ruangan yang dikonfigurasi."};await (0,d.execute)("DELETE FROM ehb_plotting_santri WHERE ehb_event_id = ?",[a]);let n=[],p=async(c,f)=>{if(0!==f.length)for(let g of e){let e=i(b.orderByJamGroup?.[g]??[]),h=await (0,d.query)(`
          SELECT
            s.id as santri_id,
            s.nama_lengkap,
            k.nama_kelas,
            m.urutan as marhalah_urutan,
            m.nama as marhalah_nama
          FROM santri s
          JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
          JOIN ehb_kelas_jam kj ON kj.kelas_id = rp.kelas_id AND kj.ehb_event_id = ? AND kj.jam_group = ?
          JOIN kelas k ON k.id = rp.kelas_id
          JOIN marhalah m ON m.id = k.marhalah_id
          WHERE (
              s.status_global = 'aktif'
              OR (s.status_global = 'nonaktif_sementara' AND s.kelas_sekolah = '9')
            )
            AND s.jenis_kelamin = ?
            AND m.nama NOT LIKE '%Mutaqaddimah%'
          ORDER BY m.urutan ASC, k.nama_kelas ASC, s.nama_lengkap ASC
        `,[a,g,c]);if(0===h.length)continue;let l=[...h].sort((a,b)=>(function(a,b,c){let d=j(a,c),e=j(b,c);if(d!==e)return d-e;let f=a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"});return 0!==f?f:a.nama_lengkap.localeCompare(b.nama_lengkap)})(a,b,e)),m=l.filter(a=>"odd"===k(a.marhalah_nama,e)),o=l.filter(a=>"even"===k(a.marhalah_nama,e));for(let b of f){let c=1;for(;c<=b.kapasitas&&(m.length>0||o.length>0);){let d;if(!(d=c%2==1?m.shift():o.shift())){c++;continue}n.push({sql:"INSERT INTO ehb_plotting_santri (ehb_event_id, ruangan_id, santri_id, nomor_kursi, jam_group) VALUES (?, ?, ?, ?, ?)",params:[a,b.id,d.santri_id,c,g]}),c++}}}};return await p("L",h),await p("P",l),n.length>0&&await (0,d.batch)(n),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"ehb_ruangan_plotting",action:"update",fiturHref:"/dashboard/ehb/ruangan/plotting",logKind:"update",entityType:"ehb_plotting_santri_batch",entityId:String(a),entityLabel:"Plotting ruangan EHB",summary:"Melakukan auto plotting peserta EHB",details:{total_assignment:n.length,jam_groups:e.length,order_by_jam_group:b.orderByJamGroup??{}}}),(0,g.revalidatePath)("/dashboard/ehb/ruangan/plotting"),(0,g.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0,count:n.length}}catch(a){return console.error("Auto Plotting Error:",a),{error:"Terjadi kesalahan sistem saat plotting: "+(a instanceof Error?a.message:"Unknown error")}}}async function t(a){return(0,d.query)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.jenis_kelamin, k.nama_kelas, kj.jam_group
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN ehb_kelas_jam kj ON kj.kelas_id = rp.kelas_id AND kj.ehb_event_id = ?
    JOIN kelas k ON k.id = rp.kelas_id
    JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN ehb_plotting_santri p ON p.santri_id = s.id AND p.ehb_event_id = ?
    WHERE (
      s.status_global = 'aktif'
      OR (s.status_global = 'nonaktif_sementara' AND s.kelas_sekolah = '9')
    ) AND p.id IS NULL AND m.nama NOT LIKE '%Mutaqaddimah%'
    ORDER BY s.jenis_kelamin, k.nama_kelas, s.nama_lengkap
  `,[a,a])}(0,a.i(13095).ensureServerEntryExports)([p,q,r,s,t]),(0,c.registerServerReference)(p,"40cd07af2c04dde6e4a6df380d825e642ba98e23b5",null),(0,c.registerServerReference)(q,"600606f024c7891e3fad890cd0c6ff00fa6f25bdd0",null),(0,c.registerServerReference)(r,"40328311a3bc5470401b3528d64392c103f124e369",null),(0,c.registerServerReference)(s,"60a1817fc0a44d1e936da43b24dd28f4e7190fd616",null),(0,c.registerServerReference)(t,"40cada89c2e3a31b096ec13a43bb25da3a7a6ea978",null);var u=a.i(50138);a.s([],86926),a.i(86926),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"00cfff6f15bab62302ac30dfafb57c9c8656dc7314",()=>u.getActiveEventLight,"40328311a3bc5470401b3528d64392c103f124e369",()=>r,"40cada89c2e3a31b096ec13a43bb25da3a7a6ea978",()=>t,"40cd07af2c04dde6e4a6df380d825e642ba98e23b5",()=>p,"600606f024c7891e3fad890cd0c6ff00fa6f25bdd0",()=>q,"60a1817fc0a44d1e936da43b24dd28f4e7190fd616",()=>s],14534)}];

//# sourceMappingURL=_69bb8d91._.js.map