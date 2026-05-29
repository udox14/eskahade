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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},53457,a=>{"use strict";let b=["AL-BAGHORY"];function c(a){return b.includes((a||"").trim().toUpperCase())}["AL-FALAH","AS-SALAM","BAHAGIA","ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4","AL-BAGHORY"].filter(a=>!b.includes(a)),a.s(["isAsramaTanpaKamar",()=>c])},3208,a=>{"use strict";function b(a,c="start"){let d=a.trim();return new Date(d?`${d}${"end"===c?"T23:59:59.999+07:00":"T00:00:00+07:00"}`:"")}function c(a){let b=a.trim();if(!b)return new Date("");if(/[zZ]$|[+\-]\d{2}:\d{2}$/.test(b))return new Date(b);let c=16===b.length?`${b}:00`:b;return new Date(`${c}+07:00`)}a.s(["parseWibDate",()=>b,"parseWibDateTime",()=>c])},32034,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(53457),g=a.i(6846),h=a.i(3208),i=a.i(18558);async function j(){let a=await (0,e.getSession)();return a?{role:a.role,asrama_binaan:a.asrama_binaan??null}:null}async function k(){let a=await (0,d.getDB)();try{await a.prepare("ALTER TABLE absen_malam_v2 ADD COLUMN keterangan TEXT").run()}catch{}}async function l(a){return(0,f.isAsramaTanpaKamar)(a)?[]:(await (0,d.query)(`SELECT DISTINCT kamar
     FROM santri
     WHERE status_global = 'aktif' AND asrama = ?
     ORDER BY CAST(kamar AS INTEGER), kamar`,[a])).map(a=>a.kamar)}async function m(a,b,c){if(await k(),!await (0,e.getSession)()||(0,f.isAsramaTanpaKamar)(a))return[];let g=await (0,d.query)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar, s.foto_url
    FROM santri s
    WHERE s.asrama = ? AND s.kamar = ? AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `,[a,b]);if(!g.length)return[];let h=g.map(a=>a.id),i=h.map(()=>"?").join(","),j=[],l=[];try{j=await (0,d.query)(`SELECT santri_id, status, keterangan FROM absen_malam_v2 WHERE tanggal = ? AND santri_id IN (${i})`,[c,...h])}catch{}try{l=await (0,d.query)(`SELECT p.id, p.santri_id, p.jenis, p.alasan, p.tgl_selesai_rencana FROM perizinan p
       WHERE p.status = 'AKTIF'
         AND p.tgl_kembali_aktual IS NULL
         AND p.tgl_mulai <= ?
         AND p.tgl_selesai_rencana >= ?
         AND p.santri_id IN (${i})`,[c,c,...h])}catch{}let m={},n={};j.forEach(a=>{m[a.santri_id]=a.status,n[a.santri_id]=a.keterangan||""});let o=new Map(l.map(a=>[a.santri_id,a]));return g.map(a=>({...a,status:o.has(a.id)?"IZIN":m[a.id]||"HADIR",keterangan:o.has(a.id)?"":n[a.id]||"",is_izin:o.has(a.id),izin_id:o.get(a.id)?.id??null,izin_jenis:o.get(a.id)?.jenis??null,izin_alasan:o.get(a.id)?.alasan??null,izin_batas:o.get(a.id)?.tgl_selesai_rencana??null}))}async function n(a,b){await k();let c=await (0,e.getSession)();if(!c||!(0,e.hasAnyRole)(c,["admin","pengurus_asrama"]))return{error:"Unauthorized"};let f=(0,h.parseWibDate)(b,"start");if(Number.isNaN(f.getTime()))return{error:"Tanggal kembali tidak valid."};let j=(await (0,d.query)(`
    SELECT
      p.id,
      p.jenis,
      p.status,
      p.tgl_selesai_rencana,
      p.tgl_kembali_aktual,
      s.nama_lengkap,
      s.asrama
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE p.santri_id = ?
      AND p.status = 'AKTIF'
      AND p.tgl_kembali_aktual IS NULL
      AND p.tgl_mulai <= ?
      AND p.tgl_selesai_rencana >= ?
    ORDER BY p.tgl_selesai_rencana ASC
    LIMIT 1
  `,[a,b,b]))[0];if(!j)return{error:"Izin aktif santri ini tidak ditemukan atau sudah ditandai kembali."};if("PULANG"!==j.jenis)return{error:"Yang bisa ditandai kembali dari absen malam hanya izin pulang."};if((0,e.hasRole)(c,"pengurus_asrama")&&c.asrama_binaan&&j.asrama!==c.asrama_binaan)return{error:"Pengurus asrama hanya bisa menandai santri asramanya."};let l=f>new Date(j.tgl_selesai_rencana),m=l?"AKTIF":"KEMBALI",n=await (0,d.getDB)();return(await n.batch([n.prepare(`
      UPDATE perizinan
      SET status = ?, tgl_kembali_aktual = ?
      WHERE id = ?
    `).bind(m,f.toISOString(),j.id),n.prepare(`
      DELETE FROM absen_malam_v2
      WHERE tanggal = ? AND santri_id = ?
    `).bind(b,a)]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"asrama_absen_malam",action:"update",fiturHref:"/dashboard/asrama/absen-malam",logKind:"update",entityType:"perizinan",entityId:j.id,entityLabel:j.nama_lengkap||a,summary:`Menandai santri kembali dari absen malam ${j.nama_lengkap||a}`,details:{tanggal_absen:b,waktu_datang:f.toISOString(),status_final:m,telat:l}}),(0,i.revalidatePath)("/dashboard/asrama/absen-malam"),(0,i.revalidatePath)("/dashboard/asrama/santri-kembali"),(0,i.revalidatePath)("/dashboard/keamanan/perizinan"),(0,i.revalidatePath)("/dashboard/keamanan/perizinan/verifikasi-telat"),l)?{success:!0,telat:!0,message:"Santri ditandai datang terlambat dan masuk verifikasi telat."}:{success:!0,telat:!1,message:"Santri sudah ditandai kembali."}}async function o(a,b){await k();let c=await (0,e.getSession)();if(!c||!(0,e.hasAnyRole)(c,["admin","pengurus_asrama"]))return{error:"Unauthorized"};let f=a.map(a=>a.santri_id),h=f.length?await (0,d.query)(`SELECT DISTINCT asrama, kamar
         FROM santri
         WHERE id IN (${f.map(()=>"?").join(",")})`,f):[],j=a.map(a=>({...a,status:"ALFA"===a.status?"ALFA":"HADIR",keterangan:(a.keterangan||"").trim()})),l=j.filter(a=>"ALFA"===a.status||a.keterangan),m=j.filter(a=>"ALFA"!==a.status&&!a.keterangan).map(a=>a.santri_id),n=await (0,d.getDB)(),o=[];for(let a=0;a<m.length;a+=100){let c=m.slice(a,a+100);o.push(n.prepare(`DELETE FROM absen_malam_v2 WHERE tanggal = ? AND santri_id IN (${c.map(()=>"?").join(",")})`).bind(b,...c))}for(let a of l)o.push(n.prepare(`
      INSERT INTO absen_malam_v2 (santri_id, tanggal, status, keterangan, created_by)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(santri_id, tanggal) DO UPDATE SET
        status = excluded.status,
        keterangan = excluded.keterangan,
        created_by = excluded.created_by
    `).bind(a.santri_id,b,a.status,a.keterangan||null,c.id));for(let a=0;a<o.length;a+=100)await n.batch(o.slice(a,a+100));return await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"asrama_absen_malam",action:"update",fiturHref:"/dashboard/asrama/absen-malam",logKind:"update",entityType:"absen_malam_batch",entityId:b,entityLabel:b,summary:`Menyimpan absen malam ${a.length} santri`,details:{tanggal:b,count:a.length,alfa_count:j.filter(a=>"ALFA"===a.status).length,keterangan_count:j.filter(a=>a.keterangan).length,scope:h}}),(0,i.revalidatePath)("/dashboard/asrama/absen-malam"),{success:!0,saved:l.length}}(0,a.i(13095).ensureServerEntryExports)([j,l,m,n,o]),(0,c.registerServerReference)(j,"000def3520f688211cc2dd8ba427e6809be7255cc7",null),(0,c.registerServerReference)(l,"408e218d2375224221c00c6b1c3e12cc42df193a6d",null),(0,c.registerServerReference)(m,"704ffd4dc78a6b4189da064f8b3df0c3455a5e8297",null),(0,c.registerServerReference)(n,"6085cfa2b0ef56fefebf8c73cc9da2427ab9b65120",null),(0,c.registerServerReference)(o,"6058c735a9341ad66accc03652d7b993455d5d4db9",null),a.s([],54264),a.i(54264),a.s(["000def3520f688211cc2dd8ba427e6809be7255cc7",()=>j,"003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"408e218d2375224221c00c6b1c3e12cc42df193a6d",()=>l,"6058c735a9341ad66accc03652d7b993455d5d4db9",()=>o,"6085cfa2b0ef56fefebf8c73cc9da2427ab9b65120",()=>n,"704ffd4dc78a6b4189da064f8b3df0c3455a5e8297",()=>m],32034)}];

//# sourceMappingURL=_c5e2d16f._.js.map