module.exports=[59398,a=>{"use strict";var b=a.i(12259),c=a.i(53058);function d(a){return{fitur_href:a.fitur_href,role:a.role,can_create:1===a.can_create,can_update:1===a.can_update,can_delete:1===a.can_delete}}async function e(){try{return(await (0,b.query)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       ORDER BY fitur_href, role`)).map(d)}catch(a){return console.error("[crud] getCrudPermissionsForAdmin ERROR:",a?.message),[]}}async function f(a,d,e){if(!a)return!1;if((0,c.isAdmin)(a))return!0;let f=(0,c.getEffectiveRoles)(a);if(0===f.length)return!1;let g=f.map(()=>"?").join(",");try{let a=await (0,b.queryOne)(`SELECT 1 AS allowed
       FROM role_fitur_crud_permission
       WHERE fitur_href = ?
         AND role IN (${g})
         AND ${"create"===e?"can_create":"update"===e?"can_update":"can_delete"} = 1
       LIMIT 1`,[d,...f]);return a?.allowed===1}catch(a){return console.error("[crud] canCrudForSession ERROR:",a?.message),!1}}async function g(a,b){return f(await (0,c.getSession)(),a,b)}async function h(a,b){let d=await (0,c.getSession)(),e=await f(d,a,b);return d?e?d:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}a.s(["assertCrud",()=>h,"canCrud",()=>g,"canCrudForSession",()=>f,"getCrudPermissionsForAdmin",()=>e])},4552,a=>{"use strict";var b=a.i(53058),c=a.i(54645),d=a.i(59398);async function e(a,d){if(!a)return!1;if((0,b.isAdmin)(a))return!0;let e=(0,b.getEffectiveRoles)(a);if(0===e.length)return!1;try{return await (0,c.canAccessHref)(d,e,a.id)}catch(a){return console.error("[feature] canAccessFeatureForSession ERROR untuk",d,"-",a?.message),!1}}async function f(a,b,c="read"){return"read"===c?e(a,b):(0,d.canCrudForSession)(a,b,c)}async function g(a,c="read"){let d=await (0,b.getSession)();return d?await f(d,a,c)?d:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}a.s(["assertFeature",()=>g,"canAccessFeatureForSession",()=>e])},37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},9343,a=>{"use strict";var b=a.i(18558),c=a.i(12259);let d=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama, urutan FROM marhalah ORDER BY urutan"),["marhalah-list"],{tags:["marhalah"],revalidate:86400}),e=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama"),["mapel-list"],{tags:["mapel"],revalidate:86400}),f=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel ORDER BY nama"),["mapel-all"],{tags:["mapel"],revalidate:86400}),g=(0,b.unstable_cache)(async()=>(0,c.queryOne)("SELECT * FROM tahun_ajaran WHERE is_active = 1 LIMIT 1"),["tahun-ajaran-aktif"],{tags:["tahun-ajaran"],revalidate:3600}),h=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM tahun_ajaran ORDER BY id DESC"),["tahun-ajaran-list"],{tags:["tahun-ajaran"],revalidate:3600}),i=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM biaya_settings ORDER BY tahun_angkatan DESC"),["biaya-settings"],{tags:["biaya-settings"],revalidate:86400}),j=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama_lengkap, gelar FROM data_guru ORDER BY nama_lengkap"),["data-guru"],{tags:["data-guru"],revalidate:3600});a.s(["getCachedBiayaSettings",0,i,"getCachedDataGuru",0,j,"getCachedMapelAll",0,f,"getCachedMapelList",0,e,"getCachedMarhalahList",0,d,"getCachedTahunAjaranAktif",0,g,"getCachedTahunAjaranList",0,h])},65930,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(18558),e=a.i(12259),f=a.i(4552),g=a.i(53058),h=a.i(6846),i=a.i(9343),j=a.i(13095);let k="/dashboard/asrama/kepengurusan";async function l(){let a=await (0,e.getDB)();await a.batch([a.prepare(`
      CREATE TABLE IF NOT EXISTS kamar_config (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        asrama        TEXT NOT NULL,
        nomor_kamar   TEXT NOT NULL,
        kuota         INTEGER NOT NULL DEFAULT 10,
        reserved_baru INTEGER NOT NULL DEFAULT 0,
        blok          TEXT,
        created_at    TEXT DEFAULT (datetime('now')),
        UNIQUE(asrama, nomor_kamar)
      )
    `)])}async function m(){await l(),await (0,e.execute)(`
    CREATE TABLE IF NOT EXISTS asrama_kepengurusan (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      asrama      TEXT NOT NULL,
      jabatan_key TEXT NOT NULL,
      kamar       TEXT,
      guru_id     INTEGER REFERENCES data_guru(id),
      nama        TEXT NOT NULL,
      urutan      INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT
    )
  `),await (0,e.execute)(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_asrama_pengurus_inti_unique
    ON asrama_kepengurusan(asrama, jabatan_key)
    WHERE kamar IS NULL AND jabatan_key IN ('pembina_asrama', 'rois', 'wakil_rois')
  `),await (0,e.execute)(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_asrama_pengurus_pembina_kamar_unique
    ON asrama_kepengurusan(asrama, kamar)
    WHERE jabatan_key = 'pembina_kamar'
  `)}async function n(a){await m();let b=await (0,f.assertFeature)(k);if("error"in b)return b;let c=String(a??"").trim();if(!(0,g.isAdmin)(b)){if(!(0,g.hasRole)(b,"pengurus_asrama"))return{error:"Unauthorized"};if(!b.asrama_binaan)return{error:"Asrama binaan akun belum diset"};if(c&&c!==b.asrama_binaan)return{error:"Anda hanya boleh mengelola asrama binaan Anda"}}return{session:b,requestedAsrama:c}}async function o(a){return(0,g.isAdmin)(a)?(await (0,e.query)(`
    SELECT DISTINCT asrama
    FROM santri
    WHERE status_global = 'aktif'
      AND asrama IS NOT NULL
      AND TRIM(asrama) <> ''
    ORDER BY asrama
  `)).map(a=>a.asrama):a.asrama_binaan?[a.asrama_binaan]:[]}async function p(a){let b=await n(a);if("error"in b)return{error:b.error,asramaOptions:[],currentAsrama:"",guruOptions:[],sadesaOptions:[],roomOptions:[],inti:{pembina_asrama:null,rois:null,wakil_rois:null},sekretaris:[],bendahara:[],pembinaKamar:[]};let c=await o(b.session),d=b.requestedAsrama||c[0]||"",f=(await (0,i.getCachedDataGuru)()).map(a=>({id:Number(a.id),nama:String(a.nama_lengkap)})),g=(d?await (0,e.query)(`
    SELECT id, nama_lengkap, asrama, kamar
    FROM santri
    WHERE status_global = 'aktif'
      AND kategori_santri = 'SADESA'
      AND asrama = ?
    ORDER BY nama_lengkap
  `,[d]):[]).map(a=>({id:a.id,nama:a.nama_lengkap,asrama:a.asrama,kamar:a.kamar}));if(!d)return{asramaOptions:c,currentAsrama:"",guruOptions:f,sadesaOptions:g,roomOptions:[],inti:{pembina_asrama:null,rois:null,wakil_rois:null},sekretaris:[],bendahara:[],pembinaKamar:[]};let[h,j]=await Promise.all([(0,e.query)(`SELECT id, jabatan_key, kamar, guru_id, nama, urutan
       FROM asrama_kepengurusan
       WHERE asrama = ?
       ORDER BY jabatan_key, urutan, nama`,[d]),(0,e.query)(`SELECT nomor_kamar
       FROM (
         SELECT nomor_kamar FROM kamar_config WHERE asrama = ?
         UNION
         SELECT TRIM(kamar) AS nomor_kamar
         FROM santri
         WHERE status_global = 'aktif'
           AND asrama = ?
           AND kamar IS NOT NULL
           AND TRIM(kamar) <> ''
       )
       ORDER BY CAST(nomor_kamar AS INTEGER), nomor_kamar`,[d,d])]),k=new Map(h.filter(a=>["pembina_asrama","rois","wakil_rois"].includes(a.jabatan_key)).map(a=>[a.jabatan_key,a])),l=h.filter(a=>"sekretaris"===a.jabatan_key),m=h.filter(a=>"bendahara"===a.jabatan_key),p=new Map(h.filter(a=>"pembina_kamar"===a.jabatan_key&&a.kamar).map(a=>[a.kamar,a])),q=[...j.map(a=>a.nomor_kamar)].sort((a,b)=>a.localeCompare(b,void 0,{numeric:!0,sensitivity:"base"}));return{asramaOptions:c,currentAsrama:d,guruOptions:f,sadesaOptions:g,roomOptions:q,inti:{pembina_asrama:k.get("pembina_asrama")??null,rois:k.get("rois")??null,wakil_rois:k.get("wakil_rois")??null},sekretaris:l,bendahara:m,pembinaKamar:q.map(a=>p.get(a)??null)}}async function q(a){let b=await n(a.asrama);if("error"in b)return b;let c=b.requestedAsrama;if(!c)return{error:"Asrama wajib dipilih"};let f=new Map((await (0,i.getCachedDataGuru)()).map(a=>[Number(a.id),String(a.nama_lengkap)])),g=new Set((await (0,e.query)(`SELECT nomor_kamar
     FROM (
       SELECT nomor_kamar FROM kamar_config WHERE asrama = ?
       UNION
       SELECT TRIM(kamar) AS nomor_kamar
       FROM santri
       WHERE status_global = 'aktif'
         AND asrama = ?
         AND kamar IS NOT NULL
         AND TRIM(kamar) <> ''
     )`,[c,c])).map(a=>a.nomor_kamar)),j=[{sql:"DELETE FROM asrama_kepengurusan WHERE asrama = ?",params:[c]}],l=(a,b,d,e)=>{let g;if(!b)return;let h=(g=b.guru_id?Number(b.guru_id):null)&&f.has(g)?{guru_id:g,nama:f.get(g)}:{guru_id:null,nama:String(b.nama??"").trim()};h.nama&&j.push({sql:`
        INSERT INTO asrama_kepengurusan (asrama, jabatan_key, kamar, guru_id, nama, urutan, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `,params:[c,a,e??null,h.guru_id,h.nama,d]})};return l("pembina_asrama",a.inti.pembina_asrama,1),l("rois",a.inti.rois,2),l("wakil_rois",a.inti.wakil_rois,3),a.sekretaris.forEach((a,b)=>l("sekretaris",a,b+1)),a.bendahara.forEach((a,b)=>l("bendahara",a,b+1)),a.pembinaKamar.forEach((a,b)=>{let c=String(a.kamar??"").trim();c&&g.has(c)&&l("pembina_kamar",a,b+1,c)}),await (0,e.batch)(j),await (0,h.logActivity)({actor:(0,h.actorFromSession)(b.session),module:"asrama_kepengurusan",action:"update",fiturHref:k,logKind:"update",entityType:"asrama_kepengurusan",entityId:c,entityLabel:c,summary:`Memperbarui kepengurusan asrama ${c}`,details:{sekretaris_count:a.sekretaris.length,bendahara_count:a.bendahara.length,pembina_kamar_count:a.pembinaKamar.filter(a=>String(a.nama??"").trim()||a.guru_id).length,inti:{pembina_asrama:a.inti.pembina_asrama?.nama||null,rois:a.inti.rois?.nama||null,wakil_rois:a.inti.wakil_rois?.nama||null}}}),(0,d.revalidatePath)(k),(0,d.revalidatePath)("/dashboard/asrama/kamar"),{success:!0}}(0,j.ensureServerEntryExports)([p,q]),(0,c.registerServerReference)(p,"40af9982e37aa0ed1e0d1bdb5a2bda20b2c4f0bf3f",null),(0,c.registerServerReference)(q,"4026f56db298d2949098392f32be7b556b046187f4",null),a.s([],28887),a.i(28887),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"4026f56db298d2949098392f32be7b556b046187f4",()=>q,"40af9982e37aa0ed1e0d1bdb5a2bda20b2c4f0bf3f",()=>p],65930)}];

//# sourceMappingURL=_a3207736._.js.map