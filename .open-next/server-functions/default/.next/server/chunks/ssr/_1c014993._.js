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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},53457,a=>{"use strict";let b=["AL-BAGHORY"];function c(a){return b.includes((a||"").trim().toUpperCase())}["AL-FALAH","AS-SALAM","BAHAGIA","ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4","AL-BAGHORY"].filter(a=>!b.includes(a)),a.s(["isAsramaTanpaKamar",()=>c])},40968,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53457);function f(a,b){let c=String(b).padStart(2,"0"),d=new Date(a,b,0).getDate();return{start:`${a}-${c}-01`,end:`${a}-${c}-${String(d).padStart(2,"0")} 23:59:59`}}async function g(a,b){let{start:c,end:e}=f(a,b),g=await (0,d.query)(`
    SELECT
      asrama,
      COUNT(*)                                                             AS total_santri,
      COALESCE(SUM(saldo_uang_jajan), 0)                                  AS total_saldo_jajan,
      COALESCE(SUM(saldo_tabungan), 0)                                    AS total_saldo_tabungan,
      SUM(CASE WHEN COALESCE(saldo_uang_jajan,0) > 0 THEN 1 ELSE 0 END)   AS punya_saldo,
      SUM(CASE WHEN COALESCE(saldo_uang_jajan,0) = 0 THEN 1 ELSE 0 END)   AS tidak_punya_saldo
    FROM santri
    WHERE status_global = 'aktif' AND asrama IS NOT NULL AND asrama != 'AL-BAGHORY'
    GROUP BY asrama ORDER BY asrama
  `,[]),h=new Map((await (0,d.query)(`
    SELECT
      s.asrama,
      COALESCE(SUM(CASE WHEN tl.jenis='MASUK' AND COALESCE(tl.dompet,'JAJAN')='JAJAN' THEN tl.nominal ELSE 0 END),0) AS masuk,
      COALESCE(SUM(CASE WHEN tl.jenis='KELUAR' AND COALESCE(tl.dompet,'JAJAN')='JAJAN' THEN tl.nominal ELSE 0 END),0) AS keluar,
      COALESCE(SUM(CASE WHEN tl.source='AUTO_POTONG' THEN tl.nominal ELSE 0 END),0) AS auto,
      COUNT(DISTINCT CASE WHEN tl.jenis='MASUK' AND COALESCE(tl.dompet,'JAJAN')='JAJAN' THEN tl.santri_id END)        AS cnt_masuk
    FROM tabungan_log tl
    INNER JOIN santri s ON s.id = tl.santri_id AND s.status_global = 'aktif'
    WHERE tl.created_at >= ? AND tl.created_at <= ?
    GROUP BY s.asrama
  `,[c,e])).map(a=>[a.asrama,a]));return g.map(a=>{let b=h.get(a.asrama);return{...a,total_saldo:(a.total_saldo_jajan??0)+(a.total_saldo_tabungan??0),masuk_bulan_ini:b?.masuk??0,keluar_bulan_ini:b?.keluar??0,auto_bulan_ini:b?.auto??0,santri_topup_bulan_ini:b?.cnt_masuk??0}})}async function h(){return(await (0,d.query)(`SELECT DISTINCT asrama FROM santri
     WHERE status_global='aktif' AND asrama IS NOT NULL AND asrama != 'AL-BAGHORY' ORDER BY asrama`)).map(a=>a.asrama)}async function i(a){return(0,e.isAsramaTanpaKamar)(a)?[]:(await (0,d.query)(`SELECT DISTINCT kamar FROM santri WHERE asrama=? AND status_global='aktif'
     ORDER BY CAST(kamar AS INTEGER), kamar`,[a])).map(a=>a.kamar)}async function j(a){let{tahun:b,bulan:c,asrama:e,kamar:g,search:h,page:i=1,filterSaldo:j="SEMUA"}=a,{start:k,end:l}=f(b,c),m=["s.status_global='aktif'"],n=[];m.push("s.asrama != 'AL-BAGHORY'"),e&&(m.push("s.asrama=?"),n.push(e)),g&&(m.push("s.kamar=?"),n.push(g)),h&&(m.push("(s.nama_lengkap LIKE ? OR s.nis LIKE ?)"),n.push(`%${h}%`,`%${h}%`)),"PUNYA"===j&&m.push("COALESCE(s.saldo_uang_jajan,0) > 0"),"KOSONG"===j&&m.push("COALESCE(s.saldo_uang_jajan,0) = 0");let o=m.join(" AND "),p=await (0,d.queryOne)(`SELECT COUNT(*) AS total FROM santri s WHERE ${o}`,n),q=p?.total??0;if(0===q)return{rows:[],total:0,page:1,totalPages:0,pageSize:30};let r=await (0,d.query)(`SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
            COALESCE(s.saldo_uang_jajan,0) AS saldo,
            COALESCE(s.saldo_tabungan,0) AS saldo_tabungan
     FROM santri s WHERE ${o}
     ORDER BY s.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
     LIMIT ? OFFSET ?`,[...n,30,(i-1)*30]);if(!r.length)return{rows:[],total:q,page:i,totalPages:Math.ceil(q/30),pageSize:30};let s=r.map(a=>a.id),t=s.map(()=>"?").join(","),u=new Map((await (0,d.query)(`SELECT santri_id,
       COALESCE(SUM(CASE WHEN jenis='MASUK' AND COALESCE(dompet,'JAJAN')='JAJAN' THEN nominal ELSE 0 END),0) AS masuk,
       COALESCE(SUM(CASE WHEN jenis='KELUAR' AND COALESCE(dompet,'JAJAN')='JAJAN' THEN nominal ELSE 0 END),0) AS keluar,
       COALESCE(SUM(CASE WHEN source='AUTO_POTONG' THEN nominal ELSE 0 END),0) AS auto,
       MAX(CASE WHEN jenis='MASUK' AND COALESCE(dompet,'JAJAN')='JAJAN' THEN created_at END) AS terakhir_masuk,
       MAX(CASE WHEN jenis='KELUAR' AND COALESCE(dompet,'JAJAN')='JAJAN' THEN created_at END) AS terakhir_keluar
     FROM tabungan_log
     WHERE santri_id IN (${t}) AND created_at>=? AND created_at<=?
     GROUP BY santri_id`,[...s,k,l])).map(a=>[a.santri_id,a]));return{rows:r.map(a=>{let b=u.get(a.id);return{...a,masuk_bulan_ini:b?.masuk??0,keluar_bulan_ini:b?.keluar??0,auto_bulan_ini:b?.auto??0,terakhir_masuk:b?.terakhir_masuk??null,terakhir_keluar:b?.terakhir_keluar??null}}),total:q,page:i,totalPages:Math.ceil(q/30),pageSize:30}}async function k(a,b,c){let{start:e,end:g}=f(b,c);return(0,d.query)(`SELECT tl.id, tl.jenis, tl.nominal,
            COALESCE(tl.dompet, 'JAJAN') AS dompet,
            COALESCE(tl.source, 'MANUAL') AS source,
            tl.keterangan,
            tl.created_at, u.full_name AS admin_nama
     FROM tabungan_log tl
     LEFT JOIN users u ON u.id=tl.created_by
     WHERE tl.santri_id=? AND tl.created_at>=? AND tl.created_at<=?
     ORDER BY tl.created_at DESC`,[a,e,g])}(0,a.i(13095).ensureServerEntryExports)([g,h,i,j,k]),(0,c.registerServerReference)(g,"607ba960d97c73990dd52b6c726f4652a3308688cf",null),(0,c.registerServerReference)(h,"0082c5d3f8c51cf43482eefdf93f4a6d6186f19ee3",null),(0,c.registerServerReference)(i,"4043292efb30f85778a97b9c2aa4a2c71a209775df",null),(0,c.registerServerReference)(j,"403e744845ab924e8eaf3bafd87a328c67a050c196",null),(0,c.registerServerReference)(k,"701dbf753053876f17fdb28b0e2524b67c813472ef",null),a.s([],56462),a.i(56462),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"0082c5d3f8c51cf43482eefdf93f4a6d6186f19ee3",()=>h,"403e744845ab924e8eaf3bafd87a328c67a050c196",()=>j,"4043292efb30f85778a97b9c2aa4a2c71a209775df",()=>i,"607ba960d97c73990dd52b6c726f4652a3308688cf",()=>g,"701dbf753053876f17fdb28b0e2524b67c813472ef",()=>k],40968)}];

//# sourceMappingURL=_1c014993._.js.map