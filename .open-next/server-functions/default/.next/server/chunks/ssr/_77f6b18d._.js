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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},55636,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(18558);async function h(){return(0,d.queryOne)("SELECT id, nama FROM ehb_event WHERE is_active = 1 LIMIT 1")}async function i(a){return(0,d.query)(`
        SELECT DISTINCT j.tanggal, j.sesi_id, s.label, s.jam_group, s.waktu_mulai, s.waktu_selesai
        FROM ehb_jadwal j
        JOIN ehb_sesi s ON s.id = j.sesi_id
        WHERE j.ehb_event_id = ?
        ORDER BY j.tanggal, s.nomor_sesi
    `,[a])}async function j(a,b,c,e){let f=await (0,d.query)("SELECT id, nomor_ruangan, nama_ruangan, jenis_kelamin FROM ehb_ruangan WHERE ehb_event_id = ? ORDER BY nomor_ruangan",[a]),g=await (0,d.query)(`
        SELECT 
            p.ruangan_id,
            COUNT(s.id) as jumlah_peserta,
            GROUP_CONCAT(DISTINCT k.nama_kelas) as kelas_list
        FROM ehb_plotting_santri p
        JOIN santri s ON s.id = p.santri_id
        JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        JOIN kelas k ON k.id = rp.kelas_id
        JOIN ehb_jadwal j ON j.kelas_id = k.id AND j.tanggal = ? AND j.sesi_id = ?
        WHERE p.ehb_event_id = ? AND p.jam_group = ?
        GROUP BY p.ruangan_id
    `,[b,c,a,e]),h={};return g.forEach(a=>{h[a.ruangan_id]=a}),f.map(a=>({...a,jumlah_peserta:h[a.id]?.jumlah_peserta||0,kelas_list:h[a.id]?.kelas_list||""})).filter(a=>a.jumlah_peserta>0)}async function k(a,b,c,e,f){return(0,d.query)(`
        SELECT 
            p.nomor_kursi, s.id as santri_id, s.nama_lengkap, s.nis, 
            k.nama_kelas, m.nama as marhalah_nama,
            COALESCE(a.status_absen, 'H') as status_absen
        FROM ehb_plotting_santri p
        JOIN santri s ON s.id = p.santri_id
        JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        JOIN kelas k ON k.id = rp.kelas_id
        JOIN marhalah m ON m.id = k.marhalah_id
        JOIN ehb_jadwal j ON j.kelas_id = k.id AND j.tanggal = ? AND j.sesi_id = ?
        LEFT JOIN ehb_absensi a ON a.santri_id = s.id AND a.tanggal = ? AND a.sesi_id = ? AND a.ehb_event_id = ?
        WHERE p.ruangan_id = ? AND p.jam_group = ? AND p.ehb_event_id = ?
        ORDER BY p.nomor_kursi
    `,[c,e,c,e,a,b,f,a])}async function l(a,b,c,h,i){let j=await (0,e.getSession)();if(!j)return{error:"Unauthorized"};try{let e=["H","A","I","S"].includes(i)?i:"H";return await (0,d.execute)(`
            INSERT INTO ehb_absensi (ehb_event_id, santri_id, tanggal, sesi_id, status_absen)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(ehb_event_id, santri_id, tanggal, sesi_id)
            DO UPDATE SET status_absen = excluded.status_absen
        `,[a,h,b,c,e]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(j),module:"ehb_absensi",action:"update",fiturHref:"/dashboard/ehb/absensi",logKind:"update",entityType:"ehb_absensi",entityId:`${a}:${b}:${c}:${h}`,entityLabel:"Absensi peserta EHB",summary:`Menyimpan absensi peserta EHB: ${e}`,details:{event_id:a,tanggal:b,sesi_id:c,santri_id:h,status:e}}),(0,g.revalidatePath)("/dashboard/ehb/absensi"),(0,g.revalidatePath)("/dashboard/ehb/susulan"),{success:!0}}catch(a){return{error:a.message}}}(0,a.i(13095).ensureServerEntryExports)([h,i,j,k,l]),(0,c.registerServerReference)(h,"00964c6fb9dd4b838c8500b176ecc373dc9d71eebf",null),(0,c.registerServerReference)(i,"409e5f4d31d97aaae6a3864949d503aa81c2ccfb81",null),(0,c.registerServerReference)(j,"78663c7ddd7d569f9947329624e4c8091a215d47ae",null),(0,c.registerServerReference)(k,"7cdfdcc0619f61f80e3c06976b6bd14a8fdba227a7",null),(0,c.registerServerReference)(l,"7c16c8d75da56a873ef710bff0e3f706976921beca",null),a.s([],78858),a.i(78858),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"00964c6fb9dd4b838c8500b176ecc373dc9d71eebf",()=>h,"409e5f4d31d97aaae6a3864949d503aa81c2ccfb81",()=>i,"78663c7ddd7d569f9947329624e4c8091a215d47ae",()=>j,"7c16c8d75da56a873ef710bff0e3f706976921beca",()=>l,"7cdfdcc0619f61f80e3c06976b6bd14a8fdba227a7",()=>k],55636)}];

//# sourceMappingURL=_77f6b18d._.js.map