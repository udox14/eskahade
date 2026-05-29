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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},86529,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(18558);async function h(){try{let a,b=await (0,e.getSession)();if(!b)return{mapel:[],kelas:[],marhalah:[]};let c=await (0,d.query)("SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama"),f=await (0,d.query)("SELECT id, nama FROM marhalah ORDER BY urutan");return a=(0,e.hasAnyRole)(b,["admin","sekpen","akademik"])?await (0,d.query)(`
        SELECT k.id, k.nama_kelas, k.marhalah_id, m.nama AS marhalah_nama
        FROM kelas k
        LEFT JOIN marhalah m ON m.id = k.marhalah_id
        JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
        ORDER BY k.nama_kelas
      `):(0,e.hasRole)(b,"wali_kelas")?await (0,d.query)(`
        SELECT k.id, k.nama_kelas, k.marhalah_id, m.nama AS marhalah_nama
        FROM kelas k
        LEFT JOIN marhalah m ON m.id = k.marhalah_id
        JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
        WHERE k.wali_kelas_id = ?
        ORDER BY k.nama_kelas
      `,[b.id]):[],{mapel:c,kelas:a,marhalah:f}}catch(a){return{mapel:[],kelas:[],marhalah:[],error:a?.message||String(a)}}}async function i(a){return(await (0,d.query)(`
    SELECT rp.id, s.nis, s.nama_lengkap
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `,[a])).map(a=>({riwayat_id:a.id,nis:a.nis,nama:a.nama_lengkap}))}async function j(a,b,c){return(await (0,d.query)(`
    SELECT rp.id AS riwayat_id, s.nis, s.nama_lengkap, na.nilai
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    LEFT JOIN nilai_akademik na ON na.riwayat_pendidikan_id = rp.id 
         AND na.mapel_id = ? AND na.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `,[b,c,a])).map(a=>({riwayat_id:a.riwayat_id,nis:a.nis,nama:a.nama_lengkap,nilai:a.nilai??0}))}async function k(a,b,c){let h=await (0,e.getSession)();return c.length?(await (0,d.batch)(c.map(c=>({sql:`INSERT INTO nilai_akademik (id, riwayat_pendidikan_id, mapel_id, semester, nilai)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(riwayat_pendidikan_id, mapel_id, semester) DO UPDATE SET nilai = excluded.nilai`,params:[(0,d.generateId)(),c.riwayat_id,b,a,c.nilai]}))),await (0,f.logActivity)({actor:(0,f.actorFromSession)(h),module:"akademik_nilai_input",action:"update",fiturHref:"/dashboard/akademik/nilai/input",logKind:"update",entityType:"nilai_mapel_batch",entityId:`${b}:${a}`,entityLabel:`Nilai mapel ${b}`,summary:`Menyimpan nilai mapel untuk ${c.length} santri`,details:{mapel_id:b,semester:a,total_santri:c.length}}),(0,g.revalidatePath)("/dashboard/akademik/nilai"),{success:!0,count:c.length}):{error:"Tidak ada data."}}async function l(a,b,c,h){let j=await (0,e.getSession)(),k=await i(a),l=new Map;k.forEach(a=>l.set(String(a.nis).trim(),a.riwayat_id));let m=new Map;h.forEach(a=>m.set(a.nama.toUpperCase().trim(),a.id));let n=[],o=[],p=[],q=[];if(c.forEach((a,c)=>{let d=String(a.NIS||a.nis||"").trim(),e=l.get(d);if(!e)return void q.push(`Baris ${c+2}: NIS '${d}' tidak ditemukan.`);Object.keys(a).forEach(c=>{let d=c.toUpperCase().trim(),f=m.get(d);if(f){let d=Number(a[c]);!isNaN(d)&&d>=0&&d<=100&&n.push({riwayatId:e,mapelId:f,semester:b,nilai:d})}});let f=b=>{let c=Number(a[b]||a[b.toLowerCase()]);return isNaN(c)?80:Math.min(100,Math.max(0,c))};(void 0!==a.KEDISIPLINAN||void 0!==a.IBADAH)&&o.push({riwayatId:e,semester:b,kedisiplinan:f("KEDISIPLINAN"),kebersihan:f("KEBERSIHAN"),kesopanan:f("KESOPANAN"),ibadah:f("IBADAH"),kemandirian:f("KEMANDIRIAN")});let g=String(a["CATATAN WALI KELAS"]||a.catatan_wali_kelas||"").trim();g&&p.push({riwayatId:e,semester:b,catatan:g})}),q.length>0)return{error:`Ditemukan masalah:
${q.slice(0,5).join("\n")}`};let r=[];if(n.length>0&&r.push(...n.map(a=>({sql:`INSERT INTO nilai_akademik (id, riwayat_pendidikan_id, mapel_id, semester, nilai)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(riwayat_pendidikan_id, mapel_id, semester) DO UPDATE SET nilai = excluded.nilai`,params:[(0,d.generateId)(),a.riwayatId,a.mapelId,a.semester,a.nilai]}))),o.length>0&&r.push(...o.map(a=>({sql:`INSERT INTO nilai_akhlak (id, riwayat_pendidikan_id, semester, kedisiplinan, kebersihan, kesopanan, ibadah, kemandirian)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET
              kedisiplinan = excluded.kedisiplinan, kebersihan = excluded.kebersihan,
              kesopanan = excluded.kesopanan, ibadah = excluded.ibadah, kemandirian = excluded.kemandirian`,params:[(0,d.generateId)(),a.riwayatId,a.semester,a.kedisiplinan,a.kebersihan,a.kesopanan,a.ibadah,a.kemandirian]}))),p.length>0)for(let a of p)await (0,d.execute)(`
        INSERT INTO ranking (id, riwayat_pendidikan_id, semester, catatan_wali_kelas)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET catatan_wali_kelas = excluded.catatan_wali_kelas
      `,[(0,d.generateId)(),a.riwayatId,a.semester,a.catatan]);return r.length>0&&await (0,d.batch)(r),await (0,f.logActivity)({actor:(0,f.actorFromSession)(j),module:"akademik_nilai_input",action:"update",fiturHref:"/dashboard/akademik/nilai/input",logKind:"update",entityType:"nilai_import_batch",entityId:`${a}:${b}`,entityLabel:"Import nilai menyeluruh",summary:`Import nilai menyeluruh untuk ${c.length} baris`,details:{kelas_id:a,semester:b,total_rows:c.length,nilai_akademik:n.length,nilai_kepribadian:o.length,catatan_wali:p.length,mapel_count:h.length}}),(0,g.revalidatePath)("/dashboard/akademik/nilai"),(0,g.revalidatePath)("/dashboard/laporan/rapor"),{success:!0}}async function m(a,b){return(await (0,d.query)(`
    SELECT rp.id AS riwayat_id, s.nis, s.nama_lengkap,
           na.kedisiplinan, na.kebersihan, na.kesopanan, na.ibadah, na.kemandirian
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    LEFT JOIN nilai_akhlak na ON na.riwayat_pendidikan_id = rp.id AND na.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `,[b,a])).map(a=>({riwayat_id:a.riwayat_id,nis:a.nis,nama:a.nama_lengkap,kedisiplinan:a.kedisiplinan??80,kebersihan:a.kebersihan??80,kesopanan:a.kesopanan??80,ibadah:a.ibadah??80,kemandirian:a.kemandirian??80}))}async function n(a,b){let c=await (0,e.getSession)();return b.length?(await (0,d.batch)(b.map(b=>({sql:`INSERT INTO nilai_akhlak (id, riwayat_pendidikan_id, semester, kedisiplinan, kebersihan, kesopanan, ibadah, kemandirian)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET
            kedisiplinan = excluded.kedisiplinan, kebersihan = excluded.kebersihan,
            kesopanan = excluded.kesopanan, ibadah = excluded.ibadah, kemandirian = excluded.kemandirian`,params:[(0,d.generateId)(),b.riwayat_id,a,b.kedisiplinan,b.kebersihan,b.kesopanan,b.ibadah,b.kemandirian]}))),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"akademik_nilai_input",action:"update",fiturHref:"/dashboard/akademik/nilai/input",logKind:"update",entityType:"nilai_kepribadian_batch",entityId:`kepribadian:${a}`,entityLabel:"Nilai kepribadian",summary:`Menyimpan nilai kepribadian untuk ${b.length} santri`,details:{semester:a,total_santri:b.length}}),(0,g.revalidatePath)("/dashboard/laporan/rapor"),{success:!0}):{error:"Tidak ada data."}}async function o(a,b){return(await (0,d.query)(`
    SELECT rp.id AS riwayat_id, s.nis, s.nama_lengkap, r.catatan_wali_kelas
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id AND r.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `,[b,a])).map(a=>({riwayat_id:a.riwayat_id,nis:a.nis,nama:a.nama_lengkap,catatan_wali_kelas:a.catatan_wali_kelas??""}))}async function p(a,b){let c=await (0,e.getSession)();if(!b.length)return{error:"Tidak ada data."};for(let c of b)await (0,d.execute)(`
      INSERT INTO ranking (id, riwayat_pendidikan_id, semester, catatan_wali_kelas)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET catatan_wali_kelas = excluded.catatan_wali_kelas
    `,[(0,d.generateId)(),c.riwayat_id,a,c.catatan]);return await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"akademik_nilai_input",action:"update",fiturHref:"/dashboard/akademik/nilai/input",logKind:"update",entityType:"catatan_wali_batch",entityId:`catatan:${a}`,entityLabel:"Catatan wali kelas",summary:`Menyimpan catatan wali kelas untuk ${b.length} santri`,details:{semester:a,total_santri:b.length}}),(0,g.revalidatePath)("/dashboard/laporan/rapor"),{success:!0}}(0,a.i(13095).ensureServerEntryExports)([h,i,j,k,l,m,n,o,p]),(0,c.registerServerReference)(h,"006e3176820d78bb7d2df4af4b32fed1f6cc2a330f",null),(0,c.registerServerReference)(i,"40bb82b13ae1e11a5d5b1a77fa83fe2e42e968afad",null),(0,c.registerServerReference)(j,"70eb076fe29fbd5646c263c85bcdc7c9e4f0ad92f8",null),(0,c.registerServerReference)(k,"703a249af6369bfc9d7c918e1c18c61bfbd5611a6b",null),(0,c.registerServerReference)(l,"78dd5608f1c9858c2fb4ffb152b5091516493bca41",null),(0,c.registerServerReference)(m,"60b221c9074536d761b5ecfeeaf95b45292d5ebe22",null),(0,c.registerServerReference)(n,"608b583d9aed934849d656737bcd47ea39b9f255d3",null),(0,c.registerServerReference)(o,"6004abb8ed876fc40e9e4014aeb747effbb34b8db7",null),(0,c.registerServerReference)(p,"60d193e121a1700d8742d1b958821647b543af0df3",null),a.s([],40768),a.i(40768),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"006e3176820d78bb7d2df4af4b32fed1f6cc2a330f",()=>h,"40bb82b13ae1e11a5d5b1a77fa83fe2e42e968afad",()=>i,"6004abb8ed876fc40e9e4014aeb747effbb34b8db7",()=>o,"608b583d9aed934849d656737bcd47ea39b9f255d3",()=>n,"60b221c9074536d761b5ecfeeaf95b45292d5ebe22",()=>m,"60d193e121a1700d8742d1b958821647b543af0df3",()=>p,"703a249af6369bfc9d7c918e1c18c61bfbd5611a6b",()=>k,"70eb076fe29fbd5646c263c85bcdc7c9e4f0ad92f8",()=>j,"78dd5608f1c9858c2fb4ffb152b5091516493bca41",()=>l],86529)}];

//# sourceMappingURL=_e58951de._.js.map