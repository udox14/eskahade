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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},9343,a=>{"use strict";var b=a.i(18558),c=a.i(12259);let d=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama, urutan FROM marhalah ORDER BY urutan"),["marhalah-list"],{tags:["marhalah"],revalidate:86400}),e=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama"),["mapel-list"],{tags:["mapel"],revalidate:86400}),f=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel ORDER BY nama"),["mapel-all"],{tags:["mapel"],revalidate:86400}),g=(0,b.unstable_cache)(async()=>(0,c.queryOne)("SELECT * FROM tahun_ajaran WHERE is_active = 1 LIMIT 1"),["tahun-ajaran-aktif"],{tags:["tahun-ajaran"],revalidate:3600}),h=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM tahun_ajaran ORDER BY id DESC"),["tahun-ajaran-list"],{tags:["tahun-ajaran"],revalidate:3600}),i=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM biaya_settings ORDER BY tahun_angkatan DESC"),["biaya-settings"],{tags:["biaya-settings"],revalidate:86400}),j=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama_lengkap, gelar FROM data_guru ORDER BY nama_lengkap"),["data-guru"],{tags:["data-guru"],revalidate:3600});a.s(["getCachedBiayaSettings",0,i,"getCachedDataGuru",0,j,"getCachedMapelAll",0,f,"getCachedMapelList",0,e,"getCachedMarhalahList",0,d,"getCachedTahunAjaranAktif",0,g,"getCachedTahunAjaranList",0,h])},36533,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(9343),f=a.i(53058),g=a.i(6846),h=a.i(18558);async function i(){return(0,d.query)("SELECT id, nama, is_active FROM tahun_ajaran ORDER BY id DESC")}async function j(a){let b=await (0,f.getSession)();if(!b)return[];let c=a;if(!c){let a=await (0,e.getCachedTahunAjaranAktif)();c=a?.id}let g=`
    SELECT k.id, k.nama_kelas, m.nama AS marhalah_nama
    FROM kelas k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE k.tahun_ajaran_id = ?
  `,h=[c];return!(0,f.hasAnyRole)(b,["admin","sekpen","akademik"])&&(0,f.hasRole)(b,"wali_kelas")&&(g+=" AND k.wali_kelas_id = ?",h.push(b.id)),(await (0,d.query)(g,h)).sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}async function k(a,b){let c=await (0,e.getCachedMapelList)();if(!c.length)return{mapel:[],siswa:[]};let f=await (0,d.query)(`
    SELECT rp.id,
           s.id AS santri_id, s.nama_lengkap, s.nis,
           r.jumlah_nilai, r.rata_rata, r.ranking_kelas
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id AND r.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
    LIMIT 1000
  `,[b,a]);if(!f.length)return{mapel:c,siswa:[]};let g=f.map(a=>a.id),h=g.map(()=>"?").join(","),i=await (0,d.query)(`
    SELECT riwayat_pendidikan_id, mapel_id, nilai
    FROM nilai_akademik
    WHERE riwayat_pendidikan_id IN (${h}) AND semester = ?
    LIMIT 5000
  `,[...g,b]),j=f.map(a=>{let b={};return c.forEach(c=>{let d=i.find(b=>b.riwayat_pendidikan_id===a.id&&b.mapel_id===c.id);b[c.id]=d?d.nilai:0}),{id:a.id,riwayat_id:a.id,nis:a.nis||"-",nama:a.nama_lengkap||"Tanpa Nama",nilai:b,jumlah:a.jumlah_nilai||0,rata:a.rata_rata||0,rank:a.ranking_kelas||"-"}});return j.sort((a,b)=>a.nama.localeCompare(b.nama)),{mapel:c,siswa:j}}async function l(a,b){let c=await (0,f.getSession)(),{mapel:e,siswa:i}=await k(a,b);if(!i.length)return{error:"Tidak ada siswa"};let j=e.length||10,l=i.map(a=>{let c=0;Object.values(a.nilai).forEach(a=>{c+=Number(a)||0});let d=Number((c/j).toFixed(2));return{riwayat_pendidikan_id:a.riwayat_id,semester:b,jumlah_nilai:c,rata_rata:d}});l.sort((a,b)=>b.rata_rata-a.rata_rata);for(let a=0;a<l.length;a++){var m;let b=l[a],c=(m=b.rata_rata)>=86?"Mumtaz":m>=76?"Jayyid Jiddan":m>=66?"Jayyid":m>=56?"Maqbul":"Dhoif";await (0,d.execute)(`
      INSERT INTO ranking (id, riwayat_pendidikan_id, semester, jumlah_nilai, rata_rata, ranking_kelas, predikat)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET
        jumlah_nilai = excluded.jumlah_nilai,
        rata_rata = excluded.rata_rata,
        ranking_kelas = excluded.ranking_kelas,
        predikat = excluded.predikat
    `,[(0,d.generateId)(),b.riwayat_pendidikan_id,b.semester,b.jumlah_nilai,b.rata_rata,a+1,c])}return await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"akademik_leger",action:"update",fiturHref:"/dashboard/akademik/leger",logKind:"update",entityType:"ranking_batch",entityId:`${a}:${b}`,entityLabel:`Leger semester ${b}`,summary:`Menghitung dan menyimpan leger untuk ${l.length} santri`,details:{kelas_id:a,semester:b,total_santri:l.length,total_mapel:j}}),(0,h.revalidatePath)("/dashboard/akademik/leger"),{success:!0}}(0,a.i(13095).ensureServerEntryExports)([i,j,k,l]),(0,c.registerServerReference)(i,"00b230bbad46a9a987226b438c7ea89fa60ad85309",null),(0,c.registerServerReference)(j,"407099d924c138db959a1f79f9ada30379b0a2cd28",null),(0,c.registerServerReference)(k,"60844b67e69ebebebf9c344d5615bba982373b8ad1",null),(0,c.registerServerReference)(l,"60a08ded5c69ccc75818317fc49cdd4ed72c93917e",null),a.s([],66266),a.i(66266),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"00b230bbad46a9a987226b438c7ea89fa60ad85309",()=>i,"407099d924c138db959a1f79f9ada30379b0a2cd28",()=>j,"60844b67e69ebebebf9c344d5615bba982373b8ad1",()=>k,"60a08ded5c69ccc75818317fc49cdd4ed72c93917e",()=>l],36533)}];

//# sourceMappingURL=_550fc9e5._.js.map