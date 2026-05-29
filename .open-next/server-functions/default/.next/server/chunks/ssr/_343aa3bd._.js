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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},58031,91438,a=>{"use strict";var b=a.i(37936),c=a.i(12259),d=a.i(53058),e=a.i(6846),f=a.i(18558);function g(a){return"P"===String(a||"").toUpperCase()?"P":"L"}function h(a){return"senior"===String(a||"").toLowerCase()?"senior":"junior"}function i(a){if(!Array.isArray(a))return[];let b=new Set;for(let c of a){let a=Number(c);Number.isInteger(a)&&a>0&&b.add(a)}return Array.from(b).sort((a,b)=>a-b)}function j(a){if(!a)return[];try{return i(JSON.parse(a))}catch{return i(a.split(",").map(a=>a.trim()).filter(Boolean))}}function k(a){return JSON.stringify(i(a))}async function l(){try{await (0,c.execute)("ALTER TABLE ehb_pengawas ADD COLUMN jenis_kelamin TEXT NOT NULL DEFAULT 'L'")}catch{}await (0,c.execute)(`
    CREATE TABLE IF NOT EXISTS ehb_pengawas_config (
      ehb_event_id                 INTEGER PRIMARY KEY REFERENCES ehb_event(id) ON DELETE CASCADE,
      senior_allowed_sesi          TEXT,
      senior_blocked_sesi          TEXT,
      senior_avoid_last_session    INTEGER NOT NULL DEFAULT 1,
      updated_at                   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)}async function m(a){var b;return await l(),(b=await (0,c.queryOne)(`
    SELECT senior_allowed_sesi, senior_blocked_sesi, senior_avoid_last_session
    FROM ehb_pengawas_config
    WHERE ehb_event_id = ?
  `,[a]))?{senior_allowed_sesi:j(b.senior_allowed_sesi),senior_blocked_sesi:j(b.senior_blocked_sesi),senior_avoid_last_session:0!==b.senior_avoid_last_session}:{senior_allowed_sesi:[],senior_blocked_sesi:[],senior_avoid_last_session:!0}}async function n(a,b){await l();let d=await m(a),e={senior_allowed_sesi:i(b.senior_allowed_sesi??d.senior_allowed_sesi),senior_blocked_sesi:i(b.senior_blocked_sesi??d.senior_blocked_sesi),senior_avoid_last_session:"boolean"==typeof b.senior_avoid_last_session?b.senior_avoid_last_session:d.senior_avoid_last_session};return await (0,c.execute)(`
    INSERT INTO ehb_pengawas_config (
      ehb_event_id, senior_allowed_sesi, senior_blocked_sesi, senior_avoid_last_session, updated_at
    )
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(ehb_event_id) DO UPDATE SET
      senior_allowed_sesi = excluded.senior_allowed_sesi,
      senior_blocked_sesi = excluded.senior_blocked_sesi,
      senior_avoid_last_session = excluded.senior_avoid_last_session,
      updated_at = datetime('now')
  `,[a,k(e.senior_allowed_sesi),k(e.senior_blocked_sesi),+!!e.senior_avoid_last_session]),e}function o(a,b,c){return a.senior_allowed_sesi.length>0&&!a.senior_allowed_sesi.includes(b)?`Pengawas senior hanya boleh di sesi ${a.senior_allowed_sesi.join(", ")}.`:a.senior_blocked_sesi.includes(b)?`Pengawas senior tidak boleh diplot di sesi ${b}.`:a.senior_avoid_last_session&&c?"Pengawas senior tidak boleh diplot di sesi terakhir pada hari tersebut.":null}async function p(){return(0,c.queryOne)("SELECT id, nama FROM ehb_event WHERE is_active = 1 LIMIT 1")}async function q(a){await l();try{return await (0,c.query)(`
            SELECT p.*,
                (SELECT COUNT(*) FROM ehb_jadwal_pengawas jp WHERE jp.pengawas_id = p.id) as total_tugas
            FROM ehb_pengawas p
            WHERE p.ehb_event_id = ?
            ORDER BY p.nama_pengawas
        `,[a])}catch(a){return console.error("DB ERROR in getPengawasList:",a.message),{__error:"getPengawasList: "+a.message}}}async function r(){try{return await (0,c.query)("SELECT id, nama_lengkap as nama FROM data_guru ORDER BY nama_lengkap")}catch(a){return console.error("DB ERROR in getGuruList:",a.message),{__error:"getGuruList: "+a.message}}}async function s(){try{return await (0,c.query)(`
            SELECT id, nama_lengkap as nama, nis, asrama, kamar, jenis_kelamin
            FROM santri
            WHERE status_global = 'aktif'
              AND kategori_santri = 'SADESA'
            ORDER BY nama_lengkap
        `)}catch(a){return console.error("DB ERROR in getSadesaList:",a.message),{__error:"getSadesaList: "+a.message}}}async function t(a,b){await l();let i=await (0,d.getSession)();if(!i)return{error:"Unauthorized"};if(0===b.length)return{error:"Data kosong"};let j=b.map(b=>({sql:"INSERT INTO ehb_pengawas (ehb_event_id, guru_id, nama_pengawas, tag, jenis_kelamin) VALUES (?, ?, ?, ?, ?)",params:[a,b.guru_id||null,b.nama_pengawas,h(b.tag),g(b.jenis_kelamin)]}));return await (0,c.batch)(j),await (0,e.logActivity)({actor:(0,e.actorFromSession)(i),module:"ehb_pengawas",action:"create",fiturHref:"/dashboard/ehb/pengawas",logKind:"create",entityType:"ehb_pengawas_batch",entityId:String(a),entityLabel:"Pengawas EHB",summary:`Menambahkan ${b.length} pengawas EHB`,details:{event_id:a,total_pengawas:b.length}}),(0,f.revalidatePath)("/dashboard/ehb/pengawas"),{success:!0}}async function u(a,b){await l();let i=await (0,d.getSession)();return i?(await (0,c.execute)("UPDATE ehb_pengawas SET nama_pengawas = ?, tag = ?, jenis_kelamin = ? WHERE id = ?",[b.nama_pengawas,h(b.tag),g(b.jenis_kelamin),a]),await (0,e.logActivity)({actor:(0,e.actorFromSession)(i),module:"ehb_pengawas",action:"update",fiturHref:"/dashboard/ehb/pengawas",logKind:"update",entityType:"ehb_pengawas",entityId:String(a),entityLabel:b.nama_pengawas,summary:`Memperbarui pengawas ${b.nama_pengawas}`,details:{tag:h(b.tag),jenis_kelamin:g(b.jenis_kelamin)}}),(0,f.revalidatePath)("/dashboard/ehb/pengawas"),{success:!0}):{error:"Unauthorized"}}async function v(a){await l();let b=await (0,d.getSession)();if(!b)return{error:"Unauthorized"};let g=await (0,c.queryOne)("SELECT nama_pengawas FROM ehb_pengawas WHERE id = ?",[a]);return await (0,c.execute)("DELETE FROM ehb_jadwal_pengawas WHERE pengawas_id = ?",[a]),await (0,c.execute)("DELETE FROM ehb_pengawas WHERE id = ?",[a]),await (0,e.logActivity)({actor:(0,e.actorFromSession)(b),module:"ehb_pengawas",action:"delete",fiturHref:"/dashboard/ehb/pengawas",logKind:"delete",entityType:"ehb_pengawas",entityId:String(a),entityLabel:g?.nama_pengawas??`Pengawas ${a}`,summary:`Menghapus pengawas ${g?.nama_pengawas??a}`}),(0,f.revalidatePath)("/dashboard/ehb/pengawas"),{success:!0}}async function w(a){return await l(),(0,c.query)(`
        SELECT jp.*, p.nama_pengawas, p.tag, p.jenis_kelamin as pengawas_jenis_kelamin, r.nomor_ruangan, r.nama_ruangan, r.jenis_kelamin,
               s.nomor_sesi, s.label as sesi_label, s.jam_group
        FROM ehb_jadwal_pengawas jp
        JOIN ehb_pengawas p ON p.id = jp.pengawas_id
        JOIN ehb_ruangan r ON r.id = jp.ruangan_id
        JOIN ehb_sesi s ON s.id = jp.sesi_id
        WHERE jp.ehb_event_id = ?
        ORDER BY jp.tanggal, s.nomor_sesi, r.nomor_ruangan
    `,[a])}async function x(a){return(0,c.query)("SELECT * FROM ehb_sesi WHERE ehb_event_id = ? ORDER BY nomor_sesi",[a])}async function y(a){return(await (0,c.query)("SELECT DISTINCT tanggal FROM ehb_jadwal WHERE ehb_event_id = ? ORDER BY tanggal",[a])).map(a=>a.tanggal)}async function z(a){return(0,c.query)("SELECT * FROM ehb_ruangan WHERE ehb_event_id = ? ORDER BY nomor_ruangan",[a])}async function A(a,b){let d=await (0,c.queryOne)(`
        SELECT MAX(s.nomor_sesi) as max_sesi
        FROM ehb_jadwal j
        JOIN ehb_sesi s ON s.id = j.sesi_id
        WHERE j.ehb_event_id = ? AND j.tanggal = ?
    `,[a,b]);return Number(d?.max_sesi||0)}async function B(a,b,i,j,k,n){await l();let p=await (0,d.getSession)();if(!p)return{error:"Unauthorized"};let q=await (0,c.queryOne)(`
        SELECT
            p.nama_pengawas,
            p.tag,
            p.jenis_kelamin as pengawas_jenis_kelamin,
            r.jenis_kelamin as ruangan_jenis_kelamin,
            s.nomor_sesi
        FROM ehb_pengawas p
        JOIN ehb_ruangan r ON r.id = ?
        JOIN ehb_sesi s ON s.id = ?
        WHERE p.id = ?
    `,[j,n,i]);if(!q)return{error:"Data pengawas, ruangan, atau sesi tidak ditemukan."};let r=g(q.pengawas_jenis_kelamin),s=g(q.ruangan_jenis_kelamin);if("P"===r&&"P"!==s)return{error:"Pengawas perempuan hanya boleh diplot di ruangan perempuan."};if("senior"===h(q.tag)){let b=await A(a,k),c=o(await m(a),q.nomor_sesi,b>0&&q.nomor_sesi===b);if(c)return{error:c}}try{return b?await (0,c.execute)("UPDATE ehb_jadwal_pengawas SET pengawas_id = ? WHERE id = ?",[i,b]):await (0,c.execute)(`
                INSERT INTO ehb_jadwal_pengawas (ehb_event_id, pengawas_id, ruangan_id, tanggal, sesi_id)
                VALUES (?, ?, ?, ?, ?)
            `,[a,i,j,k,n]),await (0,e.logActivity)({actor:(0,e.actorFromSession)(p),module:"ehb_pengawas",action:b?"update":"create",fiturHref:"/dashboard/ehb/pengawas",logKind:b?"update":"create",entityType:"ehb_jadwal_pengawas",entityId:b?String(b):`${a}:${i}:${j}:${k}:${n}`,entityLabel:"Jadwal pengawas EHB",summary:`${b?"Memperbarui":"Menambahkan"} jadwal pengawas manual`,details:{event_id:a,pengawas_id:i,ruangan_id:j,tanggal:k,sesi_id:n}}),(0,f.revalidatePath)("/dashboard/ehb/pengawas"),{success:!0}}catch(a){if(a.message?.includes("UNIQUE"))return{error:"Pengawas ini sudah bertugas di sesi yang sama, atau ruangan sudah terisi."};return{error:a.message}}}async function C(a){await l();let b=await (0,d.getSession)();return b?(await (0,c.execute)("DELETE FROM ehb_jadwal_pengawas WHERE id = ?",[a]),await (0,e.logActivity)({actor:(0,e.actorFromSession)(b),module:"ehb_pengawas",action:"delete",fiturHref:"/dashboard/ehb/pengawas",logKind:"delete",entityType:"ehb_jadwal_pengawas",entityId:String(a),entityLabel:"Jadwal pengawas EHB",summary:"Menghapus jadwal pengawas manual"}),(0,f.revalidatePath)("/dashboard/ehb/pengawas"),{success:!0}):{error:"Unauthorized"}}async function D(a,b){await l();let d=await (0,c.queryOne)("SELECT * FROM ehb_pengawas WHERE id = ?",[b]);return d?{pengawas:d,tugas:await (0,c.query)(`
        SELECT jp.tanggal, s.label as sesi_label, s.waktu_mulai, s.waktu_selesai, r.nomor_ruangan, r.jenis_kelamin
        FROM ehb_jadwal_pengawas jp
        JOIN ehb_sesi s ON s.id = jp.sesi_id
        JOIN ehb_ruangan r ON r.id = jp.ruangan_id
        WHERE jp.pengawas_id = ?
        ORDER BY jp.tanggal, s.nomor_sesi
    `,[b])}:null}async function E(a){return m(a)}async function F(a,b){await l();let c=await (0,d.getSession)();if(!c)return{error:"Unauthorized"};let g=await n(a,b);return await (0,e.logActivity)({actor:(0,e.actorFromSession)(c),module:"ehb_pengawas",action:"update",fiturHref:"/dashboard/ehb/pengawas",logKind:"update",entityType:"ehb_pengawas_config",entityId:String(a),entityLabel:"Rule senior pengawas EHB",summary:"Memperbarui rule pengawas senior EHB",details:g}),(0,f.revalidatePath)("/dashboard/ehb/pengawas"),(0,f.revalidatePath)("/dashboard/ehb/pengawas/plotting"),{success:!0,config:g}}a.s(["ensurePengawasSchema",()=>l,"getPengawasRuleConfig",()=>m,"getSeniorRuleViolation",()=>o,"normalizeJenisKelamin",()=>g,"normalizePengawasTag",()=>h,"upsertPengawasRuleConfig",()=>n],91438),(0,a.i(13095).ensureServerEntryExports)([p,q,r,s,t,u,v,w,x,y,z,B,C,D,E,F]),(0,b.registerServerReference)(p,"0037af803b79cb33c71fccf091ebc764871f938432",null),(0,b.registerServerReference)(q,"40b78280816feadaecadbb23780c7d660b87c7b59e",null),(0,b.registerServerReference)(r,"007f28868931432fc59e59d227820c0e93ddfc499f",null),(0,b.registerServerReference)(s,"00b8bbf98abbd753c7e4604f3e5d6c10a4d74fb8cf",null),(0,b.registerServerReference)(t,"607fdadecdc4e9eaf5de41c9fb56756ca11e2bf3d4",null),(0,b.registerServerReference)(u,"60b39a51b88dbd204a688bd75d98c5ea194113adc7",null),(0,b.registerServerReference)(v,"40cb940c941b361e41012b6e6c72205cfc9771aa64",null),(0,b.registerServerReference)(w,"40c75412fbc184e04cddf8d733cd4f040632a37587",null),(0,b.registerServerReference)(x,"400573f21cf0ab5d6f8dd8d72d3a76d75b6b3c8a66",null),(0,b.registerServerReference)(y,"402c9d631e3370145da16421d66afabc51b7293200",null),(0,b.registerServerReference)(z,"40e3bc31e99a436b7642b8008125ad44f45e1973e7",null),(0,b.registerServerReference)(B,"7e9e1eea91694aa5bfd6c125a9318bed57be8fa17d",null),(0,b.registerServerReference)(C,"40a47db3e98e1919fde58222f80e09d708d8508761",null),(0,b.registerServerReference)(D,"600ea6048d951a7032dd665824f335e6c846c53728",null),(0,b.registerServerReference)(E,"40dab3ec71b86be9590b319b8c409c566488937e30",null),(0,b.registerServerReference)(F,"6075ef9b3ce1764d70a3bf35d1516a8b36df39016e",null),a.s(["addPengawas",()=>t,"deleteAssignment",()=>C,"deletePengawas",()=>v,"getActiveEventLight",()=>p,"getGuruList",()=>r,"getJadwalPengawasAll",()=>w,"getKartuPengawasData",()=>D,"getPengawasList",()=>q,"getPengawasRuleConfigForEvent",()=>E,"getRuanganList",()=>z,"getSadesaList",()=>s,"getSesiList",()=>x,"getTanggalList",()=>y,"saveAssignmentManual",()=>B,"savePengawasRuleConfigForEvent",()=>F,"updatePengawas",()=>u],58031)},79288,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(18558),h=a.i(91438);async function i(a){return(0,d.query)(`
        SELECT j.tanggal, j.sesi_id, s.nomor_sesi, s.jam_group
        FROM ehb_jadwal j
        JOIN ehb_sesi s ON s.id = j.sesi_id
        WHERE j.ehb_event_id = ?
        GROUP BY j.tanggal, j.sesi_id, s.nomor_sesi, s.jam_group
        ORDER BY j.tanggal, s.nomor_sesi
    `,[a])}async function j(a,b,c,e){let f=e.split(",").map(a=>a.trim()).filter(Boolean);if(0===f.length)return[];let g=f.map(()=>"?").join(", ");return(0,d.query)(`
        SELECT
            r.id,
            r.nomor_ruangan,
            r.jenis_kelamin,
            COUNT(DISTINCT s.id) as jumlah_peserta
        FROM ehb_ruangan r
        JOIN ehb_plotting_santri p
            ON p.ruangan_id = r.id
           AND p.ehb_event_id = ?
           AND p.jam_group IN (${g})
        JOIN santri s
            ON s.id = p.santri_id
        JOIN riwayat_pendidikan rp
            ON rp.santri_id = s.id
           AND rp.status_riwayat = 'aktif'
        WHERE r.ehb_event_id = ?
          AND EXISTS (
            SELECT 1
            FROM ehb_jadwal j
            WHERE j.kelas_id = rp.kelas_id
              AND j.tanggal = ?
              AND j.sesi_id = ?
              AND j.ehb_event_id = ?
          )
        GROUP BY r.id, r.nomor_ruangan, r.jenis_kelamin
        HAVING COUNT(DISTINCT s.id) > 0
        ORDER BY r.nomor_ruangan
    `,[a,...f,a,b,c,a])}async function k(a){await (0,h.ensurePengawasSchema)();let b=await (0,d.query)(`
        SELECT 
            COUNT(id) as total,
            SUM(CASE WHEN tag = 'senior' THEN 1 ELSE 0 END) as total_senior,
            SUM(CASE WHEN tag = 'junior' THEN 1 ELSE 0 END) as total_junior,
            SUM(CASE WHEN jenis_kelamin = 'P' THEN 1 ELSE 0 END) as total_perempuan,
            SUM(CASE WHEN jenis_kelamin = 'L' THEN 1 ELSE 0 END) as total_laki
        FROM ehb_pengawas WHERE ehb_event_id = ?
    `,[a]),c=await i(a),e=0;for(let b of c)e+=(await j(a,b.tanggal,b.sesi_id,b.jam_group)).length;let f=await (0,d.queryOne)("SELECT COUNT(*) as total FROM ehb_jadwal_pengawas WHERE ehb_event_id = ?",[a]);return{pengawas:b[0]||{total:0,total_senior:0,total_junior:0},slotDibutuhkan:e,terplot:f?.total||0}}async function l(a){await (0,h.ensurePengawasSchema)();let b=await (0,e.getSession)();return b?(await (0,d.execute)("DELETE FROM ehb_jadwal_pengawas WHERE ehb_event_id = ?",[a]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"ehb_pengawas_plotting",action:"delete",fiturHref:"/dashboard/ehb/pengawas/plotting",logKind:"delete",entityType:"ehb_jadwal_pengawas_batch",entityId:String(a),entityLabel:"Plotting pengawas EHB",summary:"Mereset plotting pengawas EHB"}),(0,g.revalidatePath)("/dashboard/ehb/pengawas"),(0,g.revalidatePath)("/dashboard/ehb/pengawas/plotting"),{success:!0}):{error:"Unauthorized"}}async function m(a){await (0,h.ensurePengawasSchema)();let b=await (0,e.getSession)();if(!b)return{error:"Unauthorized"};try{let c=await (0,d.query)(`
            SELECT id, tag, jenis_kelamin
            FROM ehb_pengawas
            WHERE ehb_event_id = ?
        `,[a]);if(0===c.length)return{error:"Belum ada pengawas terdaftar."};let e=await i(a);if(0===e.length)return{error:"Belum ada jadwal ujian yang terisi."};let k=await (0,h.getPengawasRuleConfig)(a);await (0,d.execute)("DELETE FROM ehb_jadwal_pengawas WHERE ehb_event_id = ?",[a]);let l=[],m=new Map,n=0;for(let b of e){let c=await j(a,b.tanggal,b.sesi_id,b.jam_group);m.set(`${b.tanggal}|${b.sesi_id}`,c),n+=c.length}if(0===n)return{error:"Belum ada ruangan yang aktif pada jadwal ujian. Plotting peserta atau jadwal kelas belum sinkron."};let o=Math.ceil(n/Math.max(c.length,1)),p={};c.forEach(a=>p[a.id]=0);let q={};c.forEach(a=>q[a.id]=[]);let r={},s={},t={};e.forEach(a=>{t[a.tanggal]||(t[a.tanggal]=[]),t[a.tanggal].push(a.nomor_sesi)});let u=(a,b,d,e,f)=>{let g=d%2;for(let i of c.map(a=>({...a,seed:Math.random()})).sort((a,b)=>a.seed-b.seed).sort((a,c)=>{let d=p[a.id]-p[c.id];if(0!==d)return d;let e=(r[`${b}|${a.id}`]||0)-(r[`${b}|${c.id}`]||0);if(0!==e)return e;let f=s[`${b}|${a.id}`],h=s[`${b}|${c.id}`],i=+(void 0!==f&&f!==g),j=+(void 0!==h&&h!==g);return i!==j?i-j:0})){let c=(0,h.normalizeJenisKelamin)(i.jenis_kelamin),j=(0,h.normalizePengawasTag)(i.tag),l=s[`${b}|${i.id}`];if(!("P"===c&&"P"!==a||f?.requiredGender&&c!==f.requiredGender||f?.disallowGender&&c===f.disallowGender)&&(f?.ignoreFairQuota||!(p[i.id]>=o))&&(f?.ignoreDayParity||void 0===l||l===g)){if(!("senior"===j&&(0,h.getSeniorRuleViolation)(k,d,e))&&!q[i.id].some(a=>a.tgl===b&&a.sesi===d)){if(!f?.ignoreBackToBack){let a=q[i.id].slice(-1)[0];if(a&&a.tgl===b&&d-a.sesi==1)continue}return i}}}return null},v=(a,b,c)=>{p[a]++,q[a].push({tgl:b,sesi:c});let d=`${b}|${a}`;r[d]=(r[d]||0)+1,void 0===s[d]&&(s[d]=c%2)};for(let b of e){let d=Math.max(...t[b.tanggal])===b.nomor_sesi,e=m.get(`${b.tanggal}|${b.sesi_id}`)||[];if(0===e.length)continue;let f=e.filter(a=>"P"===(0,h.normalizeJenisKelamin)(a.jenis_kelamin)).sort((a,b)=>a.nomor_ruangan-b.nomor_ruangan),g=e.filter(a=>"P"!==(0,h.normalizeJenisKelamin)(a.jenis_kelamin)).sort((a,b)=>a.nomor_ruangan-b.nomor_ruangan),i=c.filter(a=>{if("P"!==(0,h.normalizeJenisKelamin)(a.jenis_kelamin)||p[a.id]>=o||q[a.id].some(a=>a.tgl===b.tanggal&&a.sesi===b.nomor_sesi))return!1;let c=s[`${b.tanggal}|${a.id}`];return!(void 0!==c&&c!==b.nomor_sesi%2||"senior"===(0,h.normalizePengawasTag)(a.tag)&&(0,h.getSeniorRuleViolation)(k,b.nomor_sesi,d))&&!0}),j=Math.min(f.length,i.length),n=new Set(f.slice(0,j).map(a=>a.id));for(let c of[...g,...f.filter(a=>n.has(a.id)),...f.filter(a=>!n.has(a.id))]){let e=(0,h.normalizeJenisKelamin)(c.jenis_kelamin),f=n.has(c.id),g=u(e,b.tanggal,b.nomor_sesi,d,{requiredGender:f?"P":void 0,disallowGender:"P"!==e||f?void 0:"P"});if(g||(g=u(e,b.tanggal,b.nomor_sesi,d,{requiredGender:f?"P":void 0,disallowGender:"P"!==e||f?void 0:"P",ignoreFairQuota:!0})),g||(g=u(e,b.tanggal,b.nomor_sesi,d,{requiredGender:f?"P":void 0,disallowGender:"P"!==e||f?void 0:"P",ignoreDayParity:!0,ignoreFairQuota:!0})),g||(g=u(e,b.tanggal,b.nomor_sesi,d,{requiredGender:f?"P":void 0,disallowGender:"P"!==e||f?void 0:"P",ignoreBackToBack:!0,ignoreDayParity:!0,ignoreFairQuota:!0})),!g){let a=`ruangan ${c.nomor_ruangan}`;return{error:`Jumlah pengawas tidak mencukupi untuk memenuhi ${a} pada tanggal ${b.tanggal} sesi ${b.nomor_sesi}.`}}l.push({sql:"INSERT INTO ehb_jadwal_pengawas (ehb_event_id, pengawas_id, ruangan_id, tanggal, sesi_id) VALUES (?, ?, ?, ?, ?)",params:[a,g.id,c.id,b.tanggal,b.sesi_id]}),v(g.id,b.tanggal,b.nomor_sesi)}}return l.length>0&&await (0,d.batch)(l),await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"ehb_pengawas_plotting",action:"update",fiturHref:"/dashboard/ehb/pengawas/plotting",logKind:"update",entityType:"ehb_jadwal_pengawas_batch",entityId:String(a),entityLabel:"Plotting pengawas EHB",summary:"Melakukan auto plotting pengawas EHB",details:{total_assignment:l.length}}),(0,g.revalidatePath)("/dashboard/ehb/pengawas"),(0,g.revalidatePath)("/dashboard/ehb/pengawas/plotting"),{success:!0,count:l.length}}catch(a){return console.error("Auto Plotting Pengawas Error:",a),{error:"Terjadi kesalahan sistem: "+a.message}}}(0,a.i(13095).ensureServerEntryExports)([k,l,m]),(0,c.registerServerReference)(k,"40f4cb871ee9076612471050c7de90dc5e1944fdeb",null),(0,c.registerServerReference)(l,"408f0cdb536a7e816af48e51b55803888dec2f1bf3",null),(0,c.registerServerReference)(m,"40f51617ce0b01966ab6884dc7cb8a1e9a9e810c47",null);var n=a.i(58031);a.s([],30514),a.i(30514),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"0037af803b79cb33c71fccf091ebc764871f938432",()=>n.getActiveEventLight,"400573f21cf0ab5d6f8dd8d72d3a76d75b6b3c8a66",()=>n.getSesiList,"408f0cdb536a7e816af48e51b55803888dec2f1bf3",()=>l,"40dab3ec71b86be9590b319b8c409c566488937e30",()=>n.getPengawasRuleConfigForEvent,"40f4cb871ee9076612471050c7de90dc5e1944fdeb",()=>k,"40f51617ce0b01966ab6884dc7cb8a1e9a9e810c47",()=>m,"6075ef9b3ce1764d70a3bf35d1516a8b36df39016e",()=>n.savePengawasRuleConfigForEvent],79288)}];

//# sourceMappingURL=_343aa3bd._.js.map