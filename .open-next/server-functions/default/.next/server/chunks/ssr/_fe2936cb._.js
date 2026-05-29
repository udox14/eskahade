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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},16400,a=>{"use strict";var b=a.i(53058);let c="SADESA",d="SADESA",e=["AL-FALAH","AS-SALAM","BAHAGIA","ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4","AL-BAGHORY"];function f(a){return a?(0,b.isAdmin)(a)?{kind:"ADMIN",lockedUnit:null,defaultUnit:e[0]}:(0,b.hasRole)(a,"pengurus_asrama")&&a.asrama_binaan?{kind:"ASRAMA",lockedUnit:a.asrama_binaan,defaultUnit:a.asrama_binaan}:(0,b.hasRole)(a,"dewan_santri")?{kind:"SADESA",lockedUnit:c,defaultUnit:c}:null:null}function g(a){return String(a??"").trim().toUpperCase()===c}function h(a){return String(a??"").trim().toUpperCase()===d}a.s(["ASRAMA_LIST",0,e,"SADESA_CATEGORY",0,d,"SADESA_UNIT",0,c,"getSppScope",()=>f,"isSadesaCategory",()=>h,"isSadesaUnit",()=>g])},91633,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(18558),g=a.i(16400);function h(a){if(!a||!(0,e.hasAnyRole)(a,["admin","dewan_santri"]))throw Error("Akses ditolak")}async function i(){return!await (0,e.getSession)(),null}async function j(a){return await (0,d.queryOne)(`SELECT nominal, tahun_kalender FROM spp_settings
     WHERE tahun_kalender = ? AND is_active = 1
     ORDER BY id DESC LIMIT 1`,[a])??{nominal:7e4,tahun_kalender:a}}async function k(){let a=await (0,d.queryOne)("SELECT value FROM app_settings WHERE key = 'spp_tagihan_mulai'"),b=a?.value??"2026-01",[c,e]=b.split("-").map(Number);return{tahun:Number.isFinite(c)?c:2026,bulan:Number.isFinite(e)?e:1,value:b}}async function l(){h(await (0,e.getSession)());let a=await (0,d.queryOne)(`SELECT nama
     FROM tahun_ajaran
     WHERE is_active = 1
     ORDER BY id DESC
     LIMIT 1`);return{tahunAjaranNama:a?.nama??null}}async function m(a){let b=await (0,e.getSession)();try{if(h(b),!/^\d{4}-(0[1-9]|1[0-2])$/.test(a))return{error:"Periode mulai tagihan tidak valid."};return await (0,d.execute)(`INSERT INTO app_settings (key, value, updated_at)
       VALUES ('spp_tagihan_mulai', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,[a]),(0,f.revalidatePath)("/dashboard/dewan-santri/setoran"),(0,f.revalidatePath)("/dashboard/asrama/spp"),{success:!0}}catch(a){return{error:a?.message||"Gagal menyimpan awal tagihan."}}}async function n(a,b){h(await (0,e.getSession)());let c=await k(),f=100*a+b<100*c.tahun+c.bulan,i=1===b?12:b-1,j=1===b?a-1:a,l=await (0,d.query)(`
    WITH
      base_santri AS (
        SELECT
          id,
          bebas_spp,
          CASE
            WHEN kategori_santri = ? THEN ?
            ELSE COALESCE(asrama, 'LAINNYA')
          END AS unit_setor
        FROM santri
        WHERE status_global = 'aktif'
      ),
      bayar_ini AS (
        SELECT DISTINCT santri_id
        FROM spp_log
        WHERE tahun = ? AND bulan = ?
      ),
      bayar_lalu AS (
        SELECT DISTINCT santri_id
        FROM spp_log
        WHERE tahun = ? AND bulan = ?
      ),
      nominal_unit AS (
        SELECT bs.unit_setor, SUM(sl.nominal_bayar) AS total_nominal
        FROM base_santri bs
        JOIN spp_log sl ON sl.santri_id = bs.id
        WHERE sl.tahun = ? AND sl.bulan = ?
        GROUP BY bs.unit_setor
      )
    SELECT
      bs.unit_setor,
      COUNT(*) AS total_santri,
      SUM(bs.bebas_spp) AS bebas_spp,
      COUNT(*) - SUM(bs.bebas_spp) AS wajib_bayar,
      SUM(CASE WHEN bs.bebas_spp = 0 AND bi.santri_id IS NOT NULL THEN 1 ELSE 0 END) AS bayar_bulan_ini,
      SUM(CASE WHEN bs.bebas_spp = 0 AND bl.santri_id IS NOT NULL AND bi.santri_id IS NULL THEN 1 ELSE 0 END) AS bayar_tunggakan_lalu,
      COALESCE(nu.total_nominal, 0) AS total_nominal
    FROM base_santri bs
    LEFT JOIN bayar_ini bi ON bi.santri_id = bs.id
    LEFT JOIN bayar_lalu bl ON bl.santri_id = bs.id
    LEFT JOIN nominal_unit nu ON nu.unit_setor = bs.unit_setor
    GROUP BY bs.unit_setor, nu.total_nominal
    ORDER BY CASE WHEN bs.unit_setor = ? THEN 1 ELSE 0 END, bs.unit_setor
  `,[g.SADESA_CATEGORY,g.SADESA_UNIT,a,b,j,i,a,b,g.SADESA_UNIT]),m=new Map((await (0,d.query)(`SELECT COALESCE(NULLIF(TRIM(unit_setor), ''), asrama) AS effective_unit_setor,
            tanggal_terima,
            nama_penyetor,
            jumlah_aktual
     FROM spp_setoran
     WHERE tahun = ? AND bulan = ?`,[a,b])).map(a=>[a.effective_unit_setor||"",a]));return l.map(a=>{let b=m.get(a.unit_setor),c=f?0:Math.max(0,a.wajib_bayar-a.bayar_bulan_ini),d=f||a.wajib_bayar<=0?0:Math.round(a.bayar_bulan_ini/a.wajib_bayar*100);return{unit_setor:a.unit_setor,total_santri:a.total_santri,bebas_spp:a.bebas_spp,wajib_bayar:f?0:a.wajib_bayar,bayar_bulan_ini:f?0:a.bayar_bulan_ini,bayar_tunggakan_lalu:f?0:a.bayar_tunggakan_lalu,penunggak:c,total_nominal:f?0:a.total_nominal,persentase:d,tanggal_setor:b?.tanggal_terima??null,nama_penyetor:b?.nama_penyetor??null,jumlah_aktual:b?.jumlah_aktual??null,belum_ada_tagihan:f,is_sadesa:a.unit_setor===g.SADESA_UNIT}})}async function o(a,b,c,i,j){let k=await (0,e.getSession)();try{h(k);let e=String(a??"").trim().toUpperCase();if(!e)return{error:"Unit setor tidak valid."};return await (0,d.batch)([{sql:`UPDATE spp_setoran
              SET unit_setor = asrama,
                  jenis_unit_setor = CASE
                    WHEN UPPER(TRIM(asrama)) = ? THEN 'SADESA'
                    ELSE 'ASRAMA'
                  END
              WHERE unit_setor IS NULL OR TRIM(unit_setor) = ''`,params:[g.SADESA_UNIT]},{sql:`INSERT INTO spp_setoran (id, asrama, unit_setor, jenis_unit_setor, bulan, tahun, tanggal_terima, penerima_id, jumlah_aktual, nama_penyetor)
              VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)
              ON CONFLICT(unit_setor, bulan, tahun) DO UPDATE SET
                asrama = excluded.asrama,
                jenis_unit_setor = excluded.jenis_unit_setor,
                tanggal_terima = excluded.tanggal_terima,
                penerima_id = excluded.penerima_id,
                jumlah_aktual = excluded.jumlah_aktual,
                nama_penyetor = excluded.nama_penyetor`,params:[(0,d.generateId)(),e,e,e===g.SADESA_UNIT?"SADESA":"ASRAMA",c,b,k?.id??null,i,j]}]),(0,f.revalidatePath)("/dashboard/dewan-santri/setoran"),(0,f.revalidatePath)("/dashboard/asrama/status-setoran"),(0,f.revalidatePath)("/dashboard/asrama/spp"),{success:!0}}catch(a){return{error:a?.message||"Gagal menyimpan setoran."}}}(0,a.i(13095).ensureServerEntryExports)([i,j,k,l,m,n,o]),(0,c.registerServerReference)(i,"00d89a428a49d314ea46cf8ccfc211849a9ca585d3",null),(0,c.registerServerReference)(j,"40882448769d5d4931f33e649fdc592fe6c8794a25",null),(0,c.registerServerReference)(k,"00126b2fa20f9aaeba9dd87a60b76b382c5f5acdb3",null),(0,c.registerServerReference)(l,"000583a5d07bd1dfc3b763a963dd4da6385616adda",null),(0,c.registerServerReference)(m,"40093e88957b08b02eec3c7d377133c2253195ecf6",null),(0,c.registerServerReference)(n,"60852e4166973a1be4beeb2782cc93b6a68811d6da",null),(0,c.registerServerReference)(o,"7cfec6ff02a842e1502c927c997631a5eac7101d79",null),a.s([],41531),a.i(41531),a.s(["000583a5d07bd1dfc3b763a963dd4da6385616adda",()=>l,"00126b2fa20f9aaeba9dd87a60b76b382c5f5acdb3",()=>k,"003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"00d89a428a49d314ea46cf8ccfc211849a9ca585d3",()=>i,"40093e88957b08b02eec3c7d377133c2253195ecf6",()=>m,"40882448769d5d4931f33e649fdc592fe6c8794a25",()=>j,"60852e4166973a1be4beeb2782cc93b6a68811d6da",()=>n,"7cfec6ff02a842e1502c927c997631a5eac7101d79",()=>o],91633)}];

//# sourceMappingURL=_fe2936cb._.js.map