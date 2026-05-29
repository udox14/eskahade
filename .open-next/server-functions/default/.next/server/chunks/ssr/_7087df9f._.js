module.exports=[59398,a=>{"use strict";var b=a.i(12259),c=a.i(53058);function d(a){return{fitur_href:a.fitur_href,role:a.role,can_create:1===a.can_create,can_update:1===a.can_update,can_delete:1===a.can_delete}}async function e(){try{return(await (0,b.query)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       ORDER BY fitur_href, role`)).map(d)}catch(a){return console.error("[crud] getCrudPermissionsForAdmin ERROR:",a?.message),[]}}async function f(a,d,e){if(!a)return!1;if((0,c.isAdmin)(a))return!0;let f=(0,c.getEffectiveRoles)(a);if(0===f.length)return!1;let g=f.map(()=>"?").join(",");try{let a=await (0,b.queryOne)(`SELECT 1 AS allowed
       FROM role_fitur_crud_permission
       WHERE fitur_href = ?
         AND role IN (${g})
         AND ${"create"===e?"can_create":"update"===e?"can_update":"can_delete"} = 1
       LIMIT 1`,[d,...f]);return a?.allowed===1}catch(a){return console.error("[crud] canCrudForSession ERROR:",a?.message),!1}}async function g(a,b){return f(await (0,c.getSession)(),a,b)}async function h(a,b){let d=await (0,c.getSession)(),e=await f(d,a,b);return d?e?d:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}a.s(["assertCrud",()=>h,"canCrud",()=>g,"canCrudForSession",()=>f,"getCrudPermissionsForAdmin",()=>e])},37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},78122,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(59398),g=a.i(6846),h=a.i(18558),i=a.i(13095);let j="/dashboard/keamanan/denda-buku-pribadi",k=null;async function l(){k??=m().catch(a=>{throw k=null,a}),await k}async function m(){await (0,d.execute)(`
    CREATE TABLE IF NOT EXISTS denda_buku_pribadi (
      id             TEXT PRIMARY KEY,
      santri_id      TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
      tanggal        TEXT NOT NULL,
      kehilangan_ke  INTEGER NOT NULL,
      nominal        INTEGER NOT NULL,
      status         TEXT NOT NULL DEFAULT 'BELUM_BAYAR',
      keterangan     TEXT,
      created_by     TEXT REFERENCES users(id),
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      paid_at        TEXT,
      paid_by        TEXT REFERENCES users(id)
    )
  `),await (0,d.execute)(`
    CREATE INDEX IF NOT EXISTS idx_denda_buku_pribadi_santri
    ON denda_buku_pribadi(santri_id, kehilangan_ke)
  `),await (0,d.execute)(`
    CREATE INDEX IF NOT EXISTS idx_denda_buku_pribadi_status
    ON denda_buku_pribadi(status, tanggal)
  `),await (0,d.execute)(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
    VALUES ('Perizinan & Disiplin', 'Denda Buku Pribadi', '${j}', 'Book', '["admin","dewan_santri"]', 1, 5)
  `),await (0,d.execute)(`
    INSERT INTO role_fitur_crud_permission
      (fitur_href, role, can_create, can_update, can_delete, created_at, updated_at)
    VALUES (?, ?, 0, 0, 1, datetime('now'), datetime('now'))
    ON CONFLICT(fitur_href, role) DO UPDATE SET
      can_delete = 1,
      updated_at = datetime('now')
  `,[j,"dewan_santri"])}async function n(a){await l();let b=a.trim();return b.length<2?[]:(0,d.query)(`
    SELECT id, nama_lengkap, nis, asrama, kamar
    FROM santri
    WHERE status_global = 'aktif'
      AND (nama_lengkap LIKE ? OR nis LIKE ?)
    ORDER BY nama_lengkap
    LIMIT 8
  `,[`%${b}%`,`%${b}%`])}async function o(){return await l(),(await (0,d.query)(`
    SELECT DISTINCT asrama
    FROM santri
    WHERE asrama IS NOT NULL AND asrama != ''
    ORDER BY asrama
  `)).map(a=>a.asrama)}async function p(a={}){let b,c,e,f,g,h;await l();let i=Math.max(1,Number(a.page||1)),j=Math.max(0,Number(a.pageSize??10)),{whereSql:k,values:m}=(b=[],c=[],e=a.search?.trim(),f=a.asrama?.trim(),g=a.tglAwal?.trim(),h=a.tglAkhir?.trim(),e&&(b.push("(s.nama_lengkap LIKE ? OR s.nis LIKE ? OR s.asrama LIKE ?)"),c.push(`%${e}%`,`%${e}%`,`%${e}%`)),f&&"SEMUA"!==f&&(b.push("s.asrama = ?"),c.push(f)),g&&(b.push("d.tanggal >= ?"),c.push(g)),h&&(b.push("d.tanggal <= ?"),c.push(h)),{whereSql:b.length>0?`WHERE ${b.join(" AND ")}`:"",values:c}),n=await (0,d.queryOne)(`
    SELECT COUNT(*) as total
    FROM (
      SELECT s.id
      FROM denda_buku_pribadi d
      JOIN santri s ON s.id = d.santri_id
      ${k}
      GROUP BY s.id
    ) t
  `,m),o=Number(n?.total||0),q=0===j?1:Math.max(1,Math.ceil(o/j)),r=Math.min(i,q),s=await (0,d.query)(`
    SELECT
      s.id as santri_id,
      s.nama_lengkap,
      s.nis,
      s.asrama,
      s.kamar,
      COUNT(d.id) as total_kasus,
      COALESCE(SUM(d.nominal), 0) as total_nominal,
      COALESCE(SUM(CASE WHEN d.status = 'BELUM_BAYAR' THEN d.nominal ELSE 0 END), 0) as total_belum_lunas,
      MAX(d.tanggal) as terakhir_hilang
    FROM denda_buku_pribadi d
    JOIN santri s ON s.id = d.santri_id
    ${k}
    GROUP BY s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar
    ORDER BY total_belum_lunas DESC, terakhir_hilang DESC, s.nama_lengkap
    ${0===j?"":"LIMIT ? OFFSET ?"}
  `,0===j?m:[...m,j,0===j?0:(r-1)*j]),t=await (0,d.queryOne)(`
    SELECT
      COUNT(DISTINCT santri_id) as total_santri,
      COUNT(*) as total_kasus,
      COALESCE(SUM(nominal), 0) as total_nominal,
      COALESCE(SUM(CASE WHEN status = 'BELUM_BAYAR' THEN nominal ELSE 0 END), 0) as total_belum_lunas
    FROM denda_buku_pribadi d
    JOIN santri s ON s.id = d.santri_id
    ${k}
  `,m),u={totalSantri:Number(t?.total_santri||0),totalKasus:Number(t?.total_kasus||0),totalNominal:Number(t?.total_nominal||0),totalBelumLunas:Number(t?.total_belum_lunas||0)};return{rows:s.map(a=>({...a,total_kasus:Number(a.total_kasus||0),total_nominal:Number(a.total_nominal||0),total_belum_lunas:Number(a.total_belum_lunas||0)})),stats:u,total:o,totalPages:q,page:r,pageSize:j}}async function q(a){return await l(),(0,d.query)(`
    SELECT
      d.id,
      d.santri_id,
      d.kehilangan_ke,
      d.nominal,
      d.status,
      d.tanggal,
      d.keterangan,
      d.created_at,
      d.paid_at,
      u.full_name as admin_nama,
      pu.full_name as paid_by_nama
    FROM denda_buku_pribadi d
    LEFT JOIN users u ON u.id = d.created_by
    LEFT JOIN users pu ON pu.id = d.paid_by
    WHERE d.santri_id = ?
    ORDER BY d.kehilangan_ke DESC
  `,[a])}async function r(a){await l();let b=await (0,d.queryOne)("SELECT MAX(kehilangan_ke) as terakhir FROM denda_buku_pribadi WHERE santri_id = ?",[a]),c=Number(b?.terakhir||0)+1;return{kehilanganKe:c,nominal:25e3*c}}async function s(a){let b=await (0,e.getSession)();if(!b)return{error:"Unauthorized"};await l();let c=String(a.get("santri_id")||""),f=String(a.get("tanggal")||"").trim(),i=String(a.get("keterangan")||"").trim(),k="1"===String(a.get("langsung_lunas")||""),m=Number(a.get("kehilangan_ke")||0);if(!c)return{error:"Pilih santri dulu."};if(!f)return{error:"Tanggal wajib diisi."};if(!Number.isInteger(m)||m<1)return{error:"Hilang ke harus berupa angka bulat minimal 1."};let n=25e3*m,o=k?`${f}T00:00:00.000Z`:null,p=k?b.id:null;await (0,d.execute)(`
    INSERT INTO denda_buku_pribadi
      (id, santri_id, tanggal, kehilangan_ke, nominal, status, keterangan, created_by, created_at, paid_at, paid_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,[(0,d.generateId)(),c,f,m,n,k?"LUNAS":"BELUM_BAYAR",i||null,b.id,(0,d.now)(),o,p]);let q=await (0,d.queryOne)("SELECT nama_lengkap FROM santri WHERE id = ?",[c]);return await (0,g.logActivity)({actor:(0,g.actorFromSession)(b),module:"keamanan_denda_buku_pribadi",action:"create",fiturHref:j,logKind:"create",entityType:"denda_buku_pribadi",entityId:`${c}:${m}`,entityLabel:q?.nama_lengkap||c,summary:`Mencatat denda buku pribadi untuk ${q?.nama_lengkap||c}`,details:{kehilangan_ke:m,nominal:n,tanggal:f,langsung_lunas:k,keterangan:i||null}}),(0,h.revalidatePath)(j),{success:!0,kehilanganKe:m,nominal:n}}async function t(a){let b=await (0,e.getSession)();if(!b)return{error:"Unauthorized"};await l();let c=await (0,d.queryOne)(`SELECT s.nama_lengkap, d.santri_id
     FROM denda_buku_pribadi d
     JOIN santri s ON s.id = d.santri_id
     WHERE d.id = ?`,[a]);return await (0,d.execute)(`
    UPDATE denda_buku_pribadi
    SET status = 'LUNAS', paid_at = ?, paid_by = ?
    WHERE id = ?
  `,[(0,d.now)(),b.id,a]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(b),module:"keamanan_denda_buku_pribadi",action:"update",fiturHref:j,logKind:"update",entityType:"denda_buku_pribadi",entityId:a,entityLabel:c?.nama_lengkap||c?.santri_id||a,summary:`Menandai denda buku pribadi lunas untuk ${c?.nama_lengkap||c?.santri_id||a}`}),(0,h.revalidatePath)(j),{success:!0}}async function u(a){let b=await (0,f.assertCrud)(j,"delete");if("error"in b)return b;await l();let c=await (0,d.queryOne)(`
    SELECT d.id, d.santri_id, s.nama_lengkap
    FROM denda_buku_pribadi d
    JOIN santri s ON s.id = d.santri_id
    WHERE d.id = ?
    LIMIT 1
  `,[a]);if(!c)return{error:"Record denda tidak ditemukan."};await (0,d.execute)("DELETE FROM denda_buku_pribadi WHERE id = ?",[a]);let e=await (0,d.query)(`
    SELECT id
    FROM denda_buku_pribadi
    WHERE santri_id = ?
    ORDER BY tanggal ASC, created_at ASC, id ASC
  `,[c.santri_id]);return e.length>0&&await (0,d.batch)(e.map((a,b)=>{let c=b+1;return{sql:`
            UPDATE denda_buku_pribadi
            SET kehilangan_ke = ?, nominal = ?
            WHERE id = ?
          `,params:[c,25e3*c,a.id]}})),await (0,g.logActivity)({actor:(0,g.actorFromSession)(b),module:"keamanan_denda_buku_pribadi",action:"delete",fiturHref:j,logKind:"delete",entityType:"denda_buku_pribadi",entityId:a,entityLabel:c.nama_lengkap,summary:`Menghapus denda buku pribadi ${c.nama_lengkap}`}),(0,h.revalidatePath)(j),{success:!0,nama:c.nama_lengkap}}(0,i.ensureServerEntryExports)([l,n,o,p,q,r,s,t,u]),(0,c.registerServerReference)(l,"00e1c90b95debbeb0c37f2b89cd9269acfb6b9103b",null),(0,c.registerServerReference)(n,"40e55320dd6244e1b6daf4630c3b9b15d942670cd0",null),(0,c.registerServerReference)(o,"00d6a8492d486f893511c165128b5b8d476ddfa230",null),(0,c.registerServerReference)(p,"4075df4eff5572b2f4b3bb4b2d3b1dd13184edfbd2",null),(0,c.registerServerReference)(q,"402e35401b225367a3953b9f744395962338b618d7",null),(0,c.registerServerReference)(r,"40ce2650f768e85b6f70f7e9f5540f46e403d1d507",null),(0,c.registerServerReference)(s,"40fb7c84acf281c1570a3512ea0a6be083b0e138e6",null),(0,c.registerServerReference)(t,"4005f0f75f6af584f78ba2e0b2f139806442e4691f",null),(0,c.registerServerReference)(u,"40aa5f2bc8df2280f553f6a823bbf6fc903b1091eb",null),a.s([],37672),a.i(37672),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"00d6a8492d486f893511c165128b5b8d476ddfa230",()=>o,"4005f0f75f6af584f78ba2e0b2f139806442e4691f",()=>t,"402e35401b225367a3953b9f744395962338b618d7",()=>q,"4075df4eff5572b2f4b3bb4b2d3b1dd13184edfbd2",()=>p,"40aa5f2bc8df2280f553f6a823bbf6fc903b1091eb",()=>u,"40ce2650f768e85b6f70f7e9f5540f46e403d1d507",()=>r,"40e55320dd6244e1b6daf4630c3b9b15d942670cd0",()=>n,"40fb7c84acf281c1570a3512ea0a6be083b0e138e6",()=>s],78122)}];

//# sourceMappingURL=_7087df9f._.js.map