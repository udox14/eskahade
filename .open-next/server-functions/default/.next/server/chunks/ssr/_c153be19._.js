module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"006f4c55239f4a20efcdddda1e3014433a5c909281",null),a.s(["signOut",()=>f])},40968,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259);function e(a,b){let c=String(b).padStart(2,"0"),d=new Date(a,b,0).getDate();return{start:`${a}-${c}-01`,end:`${a}-${c}-${String(d).padStart(2,"0")} 23:59:59`}}async function f(a,b){let{start:c,end:f}=e(a,b),g=await (0,d.query)(`
    SELECT
      asrama,
      COUNT(*)                                                             AS total_santri,
      COALESCE(SUM(saldo_tabungan), 0)                                     AS total_saldo,
      SUM(CASE WHEN COALESCE(saldo_tabungan,0) > 0 THEN 1 ELSE 0 END)     AS punya_saldo,
      SUM(CASE WHEN COALESCE(saldo_tabungan,0) = 0 THEN 1 ELSE 0 END)     AS tidak_punya_saldo
    FROM santri
    WHERE status_global = 'aktif' AND asrama IS NOT NULL
    GROUP BY asrama ORDER BY asrama
  `,[]),h=new Map((await (0,d.query)(`
    SELECT
      s.asrama,
      COALESCE(SUM(CASE WHEN tl.jenis='MASUK'  THEN tl.nominal ELSE 0 END),0) AS masuk,
      COALESCE(SUM(CASE WHEN tl.jenis='KELUAR' THEN tl.nominal ELSE 0 END),0) AS keluar,
      COUNT(DISTINCT CASE WHEN tl.jenis='MASUK' THEN tl.santri_id END)        AS cnt_masuk
    FROM tabungan_log tl
    INNER JOIN santri s ON s.id = tl.santri_id AND s.status_global = 'aktif'
    WHERE tl.created_at >= ? AND tl.created_at <= ?
    GROUP BY s.asrama
  `,[c,f])).map(a=>[a.asrama,a]));return g.map(a=>{let b=h.get(a.asrama);return{...a,masuk_bulan_ini:b?.masuk??0,keluar_bulan_ini:b?.keluar??0,santri_topup_bulan_ini:b?.cnt_masuk??0}})}async function g(){return(await (0,d.query)(`SELECT DISTINCT asrama FROM santri
     WHERE status_global='aktif' AND asrama IS NOT NULL ORDER BY asrama`)).map(a=>a.asrama)}async function h(a){return(await (0,d.query)(`SELECT DISTINCT kamar FROM santri WHERE asrama=? AND status_global='aktif'
     ORDER BY CAST(kamar AS INTEGER), kamar`,[a])).map(a=>a.kamar)}async function i(a){let{tahun:b,bulan:c,asrama:f,kamar:g,search:h,page:i=1,filterSaldo:j="SEMUA"}=a,{start:k,end:l}=e(b,c),m=["s.status_global='aktif'"],n=[];f&&(m.push("s.asrama=?"),n.push(f)),g&&(m.push("s.kamar=?"),n.push(g)),h&&(m.push("(s.nama_lengkap LIKE ? OR s.nis LIKE ?)"),n.push(`%${h}%`,`%${h}%`)),"PUNYA"===j&&m.push("COALESCE(s.saldo_tabungan,0) > 0"),"KOSONG"===j&&m.push("COALESCE(s.saldo_tabungan,0) = 0");let o=m.join(" AND "),p=await (0,d.queryOne)(`SELECT COUNT(*) AS total FROM santri s WHERE ${o}`,n),q=p?.total??0;if(0===q)return{rows:[],total:0,page:1,totalPages:0,pageSize:30};let r=await (0,d.query)(`SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
            COALESCE(s.saldo_tabungan,0) AS saldo
     FROM santri s WHERE ${o}
     ORDER BY s.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
     LIMIT ? OFFSET ?`,[...n,30,(i-1)*30]);if(!r.length)return{rows:[],total:q,page:i,totalPages:Math.ceil(q/30),pageSize:30};let s=r.map(a=>a.id),t=s.map(()=>"?").join(","),u=new Map((await (0,d.query)(`SELECT santri_id,
       COALESCE(SUM(CASE WHEN jenis='MASUK'  THEN nominal ELSE 0 END),0) AS masuk,
       COALESCE(SUM(CASE WHEN jenis='KELUAR' THEN nominal ELSE 0 END),0) AS keluar,
       MAX(CASE WHEN jenis='MASUK'  THEN created_at END) AS terakhir_masuk,
       MAX(CASE WHEN jenis='KELUAR' THEN created_at END) AS terakhir_keluar
     FROM tabungan_log
     WHERE santri_id IN (${t}) AND created_at>=? AND created_at<=?
     GROUP BY santri_id`,[...s,k,l])).map(a=>[a.santri_id,a]));return{rows:r.map(a=>{let b=u.get(a.id);return{...a,masuk_bulan_ini:b?.masuk??0,keluar_bulan_ini:b?.keluar??0,terakhir_masuk:b?.terakhir_masuk??null,terakhir_keluar:b?.terakhir_keluar??null}}),total:q,page:i,totalPages:Math.ceil(q/30),pageSize:30}}async function j(a,b,c){let{start:f,end:g}=e(b,c);return(0,d.query)(`SELECT tl.id, tl.jenis, tl.nominal, tl.keterangan,
            tl.created_at, u.full_name AS admin_nama
     FROM tabungan_log tl
     LEFT JOIN users u ON u.id=tl.created_by
     WHERE tl.santri_id=? AND tl.created_at>=? AND tl.created_at<=?
     ORDER BY tl.created_at DESC`,[a,f,g])}(0,a.i(13095).ensureServerEntryExports)([f,g,h,i,j]),(0,c.registerServerReference)(f,"6068b899ba87837e1edd9bea091cc8b7a091599dea",null),(0,c.registerServerReference)(g,"007a42539159b1431686bb3577e6979899bae22902",null),(0,c.registerServerReference)(h,"400366f45a60ef11bf2b4ad36a44170740be4d4db0",null),(0,c.registerServerReference)(i,"40b99cd83edabde6a109a6011156014abf9639f685",null),(0,c.registerServerReference)(j,"706192e63d94262d9706c0a72fb4af3ee6a2332547",null),a.s([],56462),a.i(56462),a.s(["006f4c55239f4a20efcdddda1e3014433a5c909281",()=>b.signOut,"007a42539159b1431686bb3577e6979899bae22902",()=>g,"400366f45a60ef11bf2b4ad36a44170740be4d4db0",()=>h,"40b99cd83edabde6a109a6011156014abf9639f685",()=>i,"6068b899ba87837e1edd9bea091cc8b7a091599dea",()=>f,"706192e63d94262d9706c0a72fb4af3ee6a2332547",()=>j],40968)}];

//# sourceMappingURL=_c153be19._.js.map