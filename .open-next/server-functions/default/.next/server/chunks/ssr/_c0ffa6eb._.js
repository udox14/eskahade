module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"005289e5d664eb30fe22168a654a1891fa9b9f59a3",null),a.s(["signOut",()=>f])},91633,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(18558);async function g(){let a=await (0,e.getSession)();return a?.role==="pengurus_asrama"?a.asrama_binaan??null:null}async function h(a){return await (0,d.queryOne)(`SELECT nominal, tahun_kalender FROM spp_settings
     WHERE tahun_kalender = ? AND is_active = 1
     ORDER BY id DESC LIMIT 1`,[a])??{nominal:7e4,tahun_kalender:a}}async function i(a,b){let c=1===b?12:b-1,e=1===b?a-1:a,f=await (0,d.query)(`
    WITH
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
      nominal_asrama AS (
        SELECT s2.asrama, SUM(sl.nominal_bayar) AS total_nominal
        FROM spp_log sl
        INNER JOIN santri s2 ON s2.id = sl.santri_id AND s2.status_global = 'aktif'
        WHERE sl.tahun = ? AND sl.bulan = ?
        GROUP BY s2.asrama
      )
    SELECT
      s.asrama,
      COUNT(*)                                                                          AS total_santri,
      SUM(s.bebas_spp)                                                                  AS bebas_spp,
      COUNT(*) - SUM(s.bebas_spp)                                                       AS wajib_bayar,
      SUM(CASE WHEN s.bebas_spp = 0 AND bi.santri_id IS NOT NULL THEN 1 ELSE 0 END)    AS bayar_bulan_ini,
      SUM(CASE WHEN s.bebas_spp = 0 AND bl.santri_id IS NOT NULL
                                    AND bi.santri_id IS NULL  THEN 1 ELSE 0 END)        AS bayar_tunggakan_lalu,
      COALESCE(na.total_nominal, 0)                                                     AS total_nominal
    FROM santri s
    LEFT JOIN bayar_ini      bi ON bi.santri_id = s.id
    LEFT JOIN bayar_lalu     bl ON bl.santri_id = s.id
    LEFT JOIN nominal_asrama na ON na.asrama    = s.asrama
    WHERE s.status_global = 'aktif'
    GROUP BY s.asrama, na.total_nominal
    ORDER BY s.asrama
  `,[a,b,e,c,a,b]),g=new Map((await (0,d.query)(`SELECT asrama, tanggal_terima, nama_penyetor, jumlah_aktual
     FROM spp_setoran WHERE tahun = ? AND bulan = ?`,[a,b])).map(a=>[a.asrama,a]));return f.map(a=>{let b=Math.max(0,a.wajib_bayar-a.bayar_bulan_ini),c=a.wajib_bayar>0?Math.round(a.bayar_bulan_ini/a.wajib_bayar*100):0,d=g.get(a.asrama);return{...a,penunggak:b,persentase:c,tanggal_setor:d?.tanggal_terima??null,nama_penyetor:d?.nama_penyetor??null,jumlah_aktual:d?.jumlah_aktual??null}})}async function j(a,b,c,g,h){let i=await (0,e.getSession)();return await (0,d.batch)([{sql:"DELETE FROM spp_setoran WHERE asrama = ? AND tahun = ? AND bulan = ?",params:[a,b,c]},{sql:`INSERT INTO spp_setoran (id, asrama, bulan, tahun, tanggal_terima, penerima_id, jumlah_aktual, nama_penyetor)
            VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?)`,params:[(0,d.generateId)(),a,c,b,i?.id??null,g,h]}]),(0,f.revalidatePath)("/dashboard/asrama/spp/monitoring"),{success:!0}}async function k(){return(await h(new Date().getFullYear())).nominal}async function l(a){let b=new Date().getFullYear(),c=new Date().getMonth()+1,e=a&&"SEMUA"!==a?"AND s.asrama = ?":"",f=[b,c,c];a&&"SEMUA"!==a&&f.push(a);let g=await (0,d.queryOne)(`
    SELECT COUNT(*) AS penunggak
    FROM santri s
    WHERE s.status_global = 'aktif'
      AND s.bebas_spp = 0
      ${e}
      AND (
        SELECT COUNT(DISTINCT sl.bulan)
        FROM spp_log sl
        WHERE sl.santri_id = s.id
          AND sl.tahun = ?
          AND sl.bulan BETWEEN 1 AND ?
      ) < ?
  `,f);return g?.penunggak??0}async function m(a,b){let c=new Date().getMonth()+1,e=a<new Date().getFullYear()?12:c,f=b&&"SEMUA"!==b?"AND s.asrama = ?":"";return(await (0,d.query)(`
    WITH
      bayar_tahun AS (
        SELECT santri_id, COUNT(*) AS jumlah_bayar
        FROM spp_log
        WHERE tahun = ? AND bulan BETWEEN 1 AND ?
        GROUP BY santri_id
      ),
      bayar_bulan_ini AS (
        SELECT DISTINCT santri_id
        FROM spp_log
        WHERE tahun = ? AND bulan = ?
      )
    SELECT
      s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.bebas_spp,
      CAST(s.kamar AS INTEGER) AS kamar_num,
      COALESCE(bt.jumlah_bayar, 0) AS jumlah_bayar,
      CASE WHEN bbi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS bulan_ini_lunas
    FROM santri s
    LEFT JOIN bayar_tahun bt ON bt.santri_id = s.id
    LEFT JOIN bayar_bulan_ini bbi ON bbi.santri_id = s.id
    WHERE s.status_global = 'aktif' ${f}
    ORDER BY s.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
  `,[a,e,a,c,...b&&"SEMUA"!==b?[b]:[]])).map(a=>({...a,bulan_ini_lunas:1===a.bulan_ini_lunas,jumlah_tunggakan:a.bebas_spp?0:Math.max(0,e-(a.jumlah_bayar??0)),kamar_num:a.kamar_num||999}))}async function n(a,b){return(0,d.query)("SELECT id, bulan, tahun, nominal_bayar, tanggal_bayar FROM spp_log WHERE santri_id = ? AND tahun = ?",[a,b])}async function o(a,b,c,g){let h=await (0,e.getSession)(),i=c.map(()=>"?").join(",");return(await (0,d.query)(`SELECT bulan FROM spp_log WHERE santri_id = ? AND tahun = ? AND bulan IN (${i})`,[a,b,...c])).length>0?{error:"Beberapa bulan sudah dibayar sebelumnya."}:(await (0,d.batch)(c.map(c=>({sql:`INSERT INTO spp_log (id, santri_id, tahun, bulan, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
          VALUES (?, ?, ?, ?, ?, ?, 'Pembayaran Manual', date('now'))`,params:[(0,d.generateId)(),a,b,c,g,h?.id??null]}))),(0,f.revalidatePath)("/dashboard/asrama/spp"),{success:!0})}async function p(a){let b=await (0,e.getSession)();return a.length?(await (0,d.batch)(a.map(a=>({sql:`INSERT INTO spp_log (id, santri_id, bulan, tahun, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
          VALUES (?, ?, ?, ?, ?, ?, 'Pembayaran Cepat', date('now'))`,params:[(0,d.generateId)(),a.santriId,a.bulan,a.tahun,a.nominal,b?.id??null]}))),(0,f.revalidatePath)("/dashboard/asrama/spp"),{success:!0,count:a.length}):{error:"Tidak ada data."}}(0,a.i(13095).ensureServerEntryExports)([g,h,i,j,k,l,m,n,o,p]),(0,c.registerServerReference)(g,"0073fbb23f030675c1e23f773b1ec79a0594350da1",null),(0,c.registerServerReference)(h,"40e12d973752177d8c8e8e3ea5e00f77454e2fc01a",null),(0,c.registerServerReference)(i,"60e37fc8dbb40188306c89117f7058cc0da4317145",null),(0,c.registerServerReference)(j,"7c32babbf317713a63e1f2cc9f31b8d7c58bcc3806",null),(0,c.registerServerReference)(k,"00e889fdfff22e184a27e79e807b8235e6020c2f18",null),(0,c.registerServerReference)(l,"40d490a0cafc487b60c403029bcaa04161128e2fbe",null),(0,c.registerServerReference)(m,"60bc356fd22762d5087caef6d72b0467d8f587bab7",null),(0,c.registerServerReference)(n,"60e14c3a1abb5981500f686fe8dc460d749c9ff700",null),(0,c.registerServerReference)(o,"7882230cf2e0c773ed71ff289aeb1d81ad25836dbc",null),(0,c.registerServerReference)(p,"40427ccbb7acba9a76b8741d8448a0fe44f772abc4",null),a.s([],41531),a.i(41531),a.s(["005289e5d664eb30fe22168a654a1891fa9b9f59a3",()=>b.signOut,"0073fbb23f030675c1e23f773b1ec79a0594350da1",()=>g,"40e12d973752177d8c8e8e3ea5e00f77454e2fc01a",()=>h,"60e37fc8dbb40188306c89117f7058cc0da4317145",()=>i,"7c32babbf317713a63e1f2cc9f31b8d7c58bcc3806",()=>j],91633)}];

//# sourceMappingURL=_c0ffa6eb._.js.map