"use strict";exports.id=2667,exports.ids=[2667],exports.modules={19366:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(47408).A)("printer",[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]])},22707:(a,b,c)=>{c.r(b),c.d(b,{"0007c6be2f7183f638f5b07196990561906eaaf4b4":()=>v,"001481991cc56fe624a4a401bf0fed0e63cb34df13":()=>t,"00412ff9fefe976069e110b5046bf517ce1f21ed43":()=>d.C,"007c0efb51e42aec69a1d5af5b1160a46369721c1d":()=>D,"00b5df288c751eeeadd723de31cf9a7ac3e7b3c7f1":()=>s,"400e416c75da1269d756c03d620af3eab5d03b966d":()=>A,"40191aeb71f789b71c00ab9e9599c1041d48354250":()=>z,"404f03683cdd99832c4c6ec627e8b3c01e5bd4214c":()=>y,"407f3313d93201de1218357921a71a3ec28f4dd0cc":()=>u,"409b360bcd6e2106662fca23ec46dcb4b7a9b13755":()=>x,"409c2dcc4800bf474d6a2127f27289ca10e95d1b1e":()=>E,"60a4a01532bf292a0676b7fdbe0067c6aacc3ac642":()=>B,"708c15317a046d222242044258471bf1cf4d68481f":()=>w,"78f306b9a7062cda2e8a89496330f7fd600a3556c8":()=>C});var d=c(38052),e=c(95349),f=c(44916),g=c(47703),h=c(46100),i=c(89773),j=c(42650),k=c(98168),l=c(47888);async function m(){await (0,l.Az)();try{await (0,f.g7)("ALTER TABLE kelas ADD COLUMN tempat TEXT")}catch(a){if(!String(a?.message||"").toLowerCase().includes("duplicate column name"))throw a}try{await (0,f.g7)("ALTER TABLE kelas ADD COLUMN grade TEXT")}catch(a){if(!String(a?.message||"").toLowerCase().includes("duplicate column name"))throw a}try{await (0,f.g7)("ALTER TABLE kelas ADD COLUMN baru_lama TEXT")}catch(a){if(!String(a?.message||"").toLowerCase().includes("duplicate column name"))throw a}}function n(a){let b=Number(a||0);return Number.isFinite(b)&&b>0?b:null}function o(a){let b=new Map;for(let c of a||[]){if(!c||!["shubuh","ashar","maghrib"].includes(c.sesi)||!Number.isInteger(c.hariIndex)||c.hariIndex<0||c.hariIndex>6)continue;let a=n(c.guruId);a&&b.set(`${c.sesi}|${c.hariIndex}`,{sesi:c.sesi,hariIndex:c.hariIndex,guruId:a})}return Array.from(b.values()).sort((a,b)=>a.sesi===b.sesi?a.hariIndex-b.hariIndex:["shubuh","ashar","maghrib"].indexOf(a.sesi)-["shubuh","ashar","maghrib"].indexOf(b.sesi))}async function p(a){let b=await (0,l.Oo)(a.map(a=>a.id)),c=await (0,l.lO)(a.map(a=>a.id)),d=new Map,e=new Map;for(let a of b)d.has(a.kelas_id)||d.set(a.kelas_id,[]),d.get(a.kelas_id).push(a);for(let a of c){let b=e.get(a.kelas_id)||{};b[a.sesi]={group_key:a.group_key,tempat:a.tempat},e.set(a.kelas_id,b)}return a.map(a=>({...a,weekly_rules:d.get(a.id)||[],gabungan:e.get(a.id)||{}}))}async function q(){return(0,f.P)(`
    SELECT
      k.id,
      k.nama_kelas,
      k.tahun_ajaran_id,
      m.nama as marhalah_nama,
      gs.id as guru_shubuh_id,
      gs.nama_lengkap as guru_shubuh_nama,
      ga.id as guru_ashar_id,
      ga.nama_lengkap as guru_ashar_nama,
      gm.id as guru_maghrib_id,
      gm.nama_lengkap as guru_maghrib_nama,
      k.wali_kelas_id,
      u.full_name as wali_kelas_nama
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    LEFT JOIN data_guru gs ON k.guru_shubuh_id = gs.id
    LEFT JOIN data_guru ga ON k.guru_ashar_id = ga.id
    LEFT JOIN data_guru gm ON k.guru_maghrib_id = gm.id
    LEFT JOIN users u ON k.wali_kelas_id = u.id
  `)}async function r(a){let b=await q(),c=await (0,l.Oo)(b.map(a=>a.id)),d=await (0,l.lO)(b.map(a=>a.id)),e=new Map((await (0,k.Km)()).map(a=>[Number(a.id),a.nama_lengkap])),f=new Map(b.map(a=>[a.id,{...a}])),g=new Map,h=new Map;for(let a of c)g.has(a.kelas_id)||g.set(a.kelas_id,[]),g.get(a.kelas_id).push(a);for(let a of d)h.set(`${a.kelas_id}|${a.sesi}`,a.group_key);for(let b of a){let a=f.get(b.kelasId);if(a)for(let c of(a.guru_shubuh_id=n(b.shubuhId),a.guru_ashar_id=n(b.asharId),a.guru_maghrib_id=n(b.maghribId),a.guru_shubuh_nama=a.guru_shubuh_id&&e.get(a.guru_shubuh_id)||null,a.guru_ashar_nama=a.guru_ashar_id&&e.get(a.guru_ashar_id)||null,a.guru_maghrib_nama=a.guru_maghrib_id&&e.get(a.guru_maghrib_id)||null,g.set(b.kelasId,o(b.weeklyRules).map(a=>({kelas_id:b.kelasId,sesi:a.sesi,hari_index:a.hariIndex,guru_id:Number(a.guruId),guru_nama:e.get(Number(a.guruId))||null}))),["shubuh","ashar","maghrib"])){let a=String(b.gabungan?.[c]?.groupKey||"").trim(),d=`${b.kelasId}|${c}`;a?h.set(d,a):h.delete(d)}}let i=Array.from(g.entries()).flatMap(([a,b])=>b.map(b=>({...b,kelas_id:a}))),j=(0,l.Dw)(i),m=new Map;for(let a of f.values())for(let b of["shubuh","ashar","maghrib"])for(let c=0;c<=6;c+=1){if((0,l.dL)(c,b))continue;let d=(0,l.Xn)(a,c,j)[b];if(!d.id||!d.nama)continue;let e=h.get(`${a.id}|${b}`),f=e?`gabungan:${b}:${e}`:`kelas:${a.id}`,g=`${c}|${b}|${d.id}`,i=m.get(g);if(i&&i.kelasId!==f)return{error:`Bentrok jadwal ${d.nama} pada sesi ${b} antara kelas ${i.kelasNama} dan ${a.nama_kelas}.`};m.set(g,{kelasId:f,kelasNama:e?`Gabungan ${e}`:a.nama_kelas,guruNama:d.nama})}return null}async function s(){await m();let a=await p(await q()),b=await (0,k.Km)();return{kelasList:a.sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"})),guruList:b}}async function t(){await m();let[a,b,c]=await Promise.all([(0,k.Km)(),(0,k.vf)(),D()]);return{guruList:a,marhalahList:b,waliUserList:c}}async function u(a){await m();let b=[],c=a&&"SEMUA"!==a?(b.push(Number(a)),"AND k.marhalah_id = ?"):"",d=await (0,f.P)(`
    SELECT
      k.id,
      k.nama_kelas,
      k.tahun_ajaran_id,
      m.nama as marhalah_nama,
      gs.id as guru_shubuh_id,
      gs.nama_lengkap as guru_shubuh_nama,
      ga.id as guru_ashar_id,
      ga.nama_lengkap as guru_ashar_nama,
      gm.id as guru_maghrib_id,
      gm.nama_lengkap as guru_maghrib_nama,
      k.wali_kelas_id,
      u.full_name as wali_kelas_nama
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    LEFT JOIN data_guru gs ON k.guru_shubuh_id = gs.id
    LEFT JOIN data_guru ga ON k.guru_ashar_id = ga.id
    LEFT JOIN data_guru gm ON k.guru_maghrib_id = gm.id
    LEFT JOIN users u ON k.wali_kelas_id = u.id
    WHERE 1=1 ${c}
  `,b);return(await p(d)).sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}async function v(){await m();let a=await (0,f.P)(`
    SELECT
      k.id,
      k.nama_kelas,
      m.nama as marhalah_nama,
      ta.nama as tahun_ajaran_nama,
      k.tempat,
      k.grade,
      k.baru_lama,
      k.jenis_kelamin,
      gs.nama_lengkap as guru_shubuh_nama,
      ga.nama_lengkap as guru_ashar_nama,
      gm.nama_lengkap as guru_maghrib_nama,
      k.guru_shubuh_id,
      k.guru_ashar_id,
      k.guru_maghrib_id,
      SUM(CASE WHEN s.status_global = 'aktif' AND s.jenis_kelamin = 'L' THEN 1 ELSE 0 END) as total_putra,
      SUM(CASE WHEN s.status_global = 'aktif' AND s.jenis_kelamin = 'P' THEN 1 ELSE 0 END) as total_putri,
      SUM(CASE WHEN s.status_global = 'aktif' THEN 1 ELSE 0 END) as total_santri,
      SUM(CASE
        WHEN s.status_global = 'aktif'
         AND (s.kategori_santri = 'SADESA'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%MTS%'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%SMP%')
        THEN 1 ELSE 0 END) as jumlah_sltp,
      SUM(CASE
        WHEN s.status_global = 'aktif'
         AND (UPPER(COALESCE(s.sekolah, '')) LIKE '%MA%'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%SMA%'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%SMK%')
        THEN 1 ELSE 0 END) as jumlah_slta,
      SUM(CASE
        WHEN s.status_global = 'aktif'
         AND (UPPER(COALESCE(s.sekolah, '')) LIKE '%KULIAH%'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%UNIVERSITAS%'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%ST%')
        THEN 1 ELSE 0 END) as jumlah_kuliah,
      SUM(CASE
        WHEN s.status_global = 'aktif'
         AND COALESCE(TRIM(s.sekolah), '') = ''
        THEN 1 ELSE 0 END) as jumlah_tidak_sekolah
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    LEFT JOIN data_guru gs ON k.guru_shubuh_id = gs.id
    LEFT JOIN data_guru ga ON k.guru_ashar_id = ga.id
    LEFT JOIN data_guru gm ON k.guru_maghrib_id = gm.id
    LEFT JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN santri s ON s.id = rp.santri_id
    GROUP BY
      k.id, k.nama_kelas, m.nama, ta.nama, k.tempat, k.grade, k.baru_lama, k.jenis_kelamin,
      gs.nama_lengkap, ga.nama_lengkap, gm.nama_lengkap, k.guru_shubuh_id, k.guru_ashar_id, k.guru_maghrib_id
  `),b=await (0,l.Oo)(a.map(a=>a.id)),c=(0,l.Dw)(b);return a.map(a=>{let b,d=(0,l.Bl)(a,c,{separator:"\n"});return{...a,guru_shubuh_nama:d.shubuh,guru_ashar_nama:d.ashar,guru_maghrib_nama:d.maghrib,tingkat_label:(b=[{label:"SLTP",value:Number(a.jumlah_sltp||0)},{label:"SLTA",value:Number(a.jumlah_slta||0)},{label:"KULIAH",value:Number(a.jumlah_kuliah||0)},{label:"TIDAK SEKOLAH",value:Number(a.jumlah_tidak_sekolah||0)}].sort((a,b)=>b.value-a.value),b[0]?.value?b[0].label:"-"),lp_label:"L"===a.jenis_kelamin?"Pa":"P"===a.jenis_kelamin?"Pi":"C",bl_label:a.baru_lama||"-"}}).sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}async function w(a,b,c){let d=await (0,h.Ht)();return await (0,f.g7)("INSERT INTO data_guru (nama_lengkap, gelar, kode_guru) VALUES (?, ?, ?)",[a,b,c]),await (0,i.logActivity)({actor:(0,i.actorFromSession)(d),module:"master_wali_kelas",action:"create",fiturHref:"/dashboard/master/wali-kelas",logKind:"create",entityType:"data_guru",entityLabel:a,summary:`Menambahkan data guru ${a}`,details:{gelar:b,kode_guru:c||null}}),(0,j.revalidateTag)("data-guru","everything"),(0,j.revalidatePath)("/dashboard/master/wali-kelas"),{success:!0}}async function x(a){await m();let b=await (0,h.Ht)(),c=await (0,f.Zy)("SELECT nama_lengkap, gelar, kode_guru FROM data_guru WHERE id = ?",[a]);return c?await (0,f.Zy)(`
      SELECT id
      FROM kelas
      WHERE guru_shubuh_id = ? OR guru_ashar_id = ? OR guru_maghrib_id = ?
      LIMIT 1
    `,[a,a,a])?{error:"Guru ini masih terdaftar sebagai pengajar default di salah satu kelas."}:await (0,f.Zy)("SELECT id FROM kelas_jadwal_guru_mingguan WHERE guru_id = ? LIMIT 1",[a])?{error:"Guru ini masih dipakai pada pembagian jadwal mingguan."}:(await (0,f.g7)("DELETE FROM data_guru WHERE id = ?",[a]),await (0,i.logActivity)({actor:(0,i.actorFromSession)(b),module:"master_wali_kelas",action:"delete",fiturHref:"/dashboard/master/wali-kelas",logKind:"delete",entityType:"data_guru",entityId:String(a),entityLabel:c.nama_lengkap||String(a),summary:`Menghapus data guru ${c.nama_lengkap||a}`,details:{gelar:c.gelar,kode_guru:c.kode_guru}}),(0,j.revalidateTag)("data-guru","everything"),(0,j.revalidatePath)("/dashboard/master/wali-kelas"),{success:!0}):{error:"Guru tidak ditemukan."}}async function y(a){await m();let b=await (0,h.Ht)();if(!a.length)return{error:"Tidak ada data."};let c=a.map(()=>"?").join(",");return(await (0,f.P)(`SELECT id FROM kelas WHERE guru_shubuh_id IN (${c}) OR guru_ashar_id IN (${c}) OR guru_maghrib_id IN (${c}) LIMIT 1`,[...a,...a,...a])).length>0?{error:"Beberapa guru masih terdaftar sebagai pengajar default aktif di kelas."}:(await (0,f.P)(`SELECT id FROM kelas_jadwal_guru_mingguan WHERE guru_id IN (${c}) LIMIT 1`,a)).length>0?{error:"Beberapa guru masih dipakai pada pembagian jadwal mingguan."}:(await (0,f.g7)(`DELETE FROM data_guru WHERE id IN (${c})`,a),await (0,i.logActivity)({actor:(0,i.actorFromSession)(b),module:"master_wali_kelas",action:"delete",fiturHref:"/dashboard/master/wali-kelas",logKind:"delete",entityType:"data_guru_batch",entityId:"hapus-massal",entityLabel:"Hapus guru massal",summary:`Menghapus ${a.length} data guru`,details:{count:a.length}}),(0,j.revalidateTag)("data-guru","everything"),(0,j.revalidatePath)("/dashboard/master/wali-kelas"),{success:!0,count:a.length})}async function z(a){let b=await (0,h.Ht)();if(!a.length)return{error:"Data kosong."};let c=new Set((await (0,f.P)("SELECT nama_lengkap FROM data_guru")).map(a=>a.nama_lengkap.toLowerCase().trim())),d=[],e=0;for(let b of a){let a=String(b.NAMA||b["NAMA LENGKAP"]||b.nama||"").trim(),f=String(b.GELAR||b.gelar||"").trim(),g=String(b.KODE||b.kode||"").trim();if(!a||c.has(a.toLowerCase())){e+=1;continue}d.push([a,f,g]),c.add(a.toLowerCase())}return d.length?(await (0,f.vA)(d.map(a=>({sql:"INSERT INTO data_guru (nama_lengkap, gelar, kode_guru) VALUES (?, ?, ?)",params:a}))),await (0,i.logActivity)({actor:(0,i.actorFromSession)(b),module:"master_wali_kelas",action:"create",fiturHref:"/dashboard/master/wali-kelas",logKind:"create",entityType:"data_guru_batch",entityId:"import",entityLabel:"Import guru massal",summary:`Import guru massal: ${d.length} ditambahkan`,details:{count:d.length,skipped:e}}),(0,j.revalidateTag)("data-guru","everything"),(0,j.revalidatePath)("/dashboard/master/wali-kelas"),{success:!0,count:d.length,skipped:e}):{error:`Semua data dilewati (${e} duplikat atau kosong).`}}async function A(a){await m();let b=await (0,h.Ht)();if(!a.length)return{error:"Tidak ada data."};let c=await r(a);if(c?.error)return c;let d=a.map(a=>({sql:`
      UPDATE kelas
      SET guru_shubuh_id = ?, guru_ashar_id = ?, guru_maghrib_id = ?, wali_kelas_id = ?
      WHERE id = ?
    `,params:[n(a.shubuhId),n(a.asharId),n(a.maghribId),a.waliKelasId||null,a.kelasId]}));for(let b of(await (0,f.vA)(d),a)){await (0,f.g7)("DELETE FROM kelas_jadwal_guru_mingguan WHERE kelas_id = ?",[b.kelasId]);let a=o(b.weeklyRules);a.length>0&&await (0,f.vA)(a.map(a=>({sql:`
          INSERT INTO kelas_jadwal_guru_mingguan (kelas_id, sesi, hari_index, guru_id, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `,params:[b.kelasId,a.sesi,a.hariIndex,Number(a.guruId)]})));let c=await (0,f.Zy)("SELECT tahun_ajaran_id FROM kelas WHERE id = ?",[b.kelasId]);await (0,l._p)(b.kelasId,c?.tahun_ajaran_id??null,["shubuh","ashar","maghrib"].map(a=>({sesi:a,groupKey:b.gabungan?.[a]?.groupKey||null,tempat:b.gabungan?.[a]?.tempat||null})))}return(0,j.revalidatePath)("/dashboard/master/wali-kelas"),(0,j.revalidatePath)("/dashboard/master/wali-kelas/cetak"),(0,j.revalidatePath)("/dashboard/akademik/absensi-guru"),(0,j.revalidatePath)("/dashboard/akademik/absensi-guru/rekap"),(0,j.revalidatePath)("/dashboard/akademik/absensi/cetak-blanko"),await (0,i.logActivity)({actor:(0,i.actorFromSession)(b),module:"master_wali_kelas",action:"update",fiturHref:"/dashboard/master/wali-kelas",logKind:"update",entityType:"kelas_batch",entityId:"jadwal-batch",entityLabel:"Jadwal wali kelas",summary:`Memperbarui jadwal mengajar ${a.length} kelas`,details:{count:a.length}}),{success:!0,count:a.length}}async function B(a,b){await m();let c=await (0,h.Ht)();return await (0,f.g7)("UPDATE kelas SET wali_kelas_id = ? WHERE id = ?",[b,a]),await (0,i.logActivity)({actor:(0,i.actorFromSession)(c),module:"master_wali_kelas",action:"update",fiturHref:"/dashboard/master/wali-kelas",logKind:"update",entityType:"kelas",entityId:a,entityLabel:a,summary:"Memperbarui wali kelas",details:{user_id:b}}),(0,j.revalidatePath)("/dashboard/master/wali-kelas"),{success:!0}}async function C(a,b,c,d){await m();let e=await (0,h.Ht)();return await (0,f.g7)("UPDATE kelas SET guru_shubuh_id = ?, guru_ashar_id = ?, guru_maghrib_id = ? WHERE id = ?",[b,c,d,a]),await (0,i.logActivity)({actor:(0,i.actorFromSession)(e),module:"master_wali_kelas",action:"update",fiturHref:"/dashboard/master/wali-kelas",logKind:"update",entityType:"kelas",entityId:a,entityLabel:a,summary:"Memperbarui guru kelas",details:{guru_shubuh_id:b,guru_ashar_id:c,guru_maghrib_id:d}}),(0,j.revalidatePath)("/dashboard/master/wali-kelas"),{success:!0}}async function D(){return(0,f.P)(`
    SELECT id, full_name
    FROM users
    WHERE role IN ('wali_kelas', 'sekpen')
       OR EXISTS (
         SELECT 1
         FROM json_each(COALESCE(users.roles, '[]'))
         WHERE value IN ('wali_kelas', 'sekpen')
       )
    ORDER BY full_name
  `)}async function E(a){let b,c=await (0,h.Ht)(),d=await (0,f.Zy)("SELECT id, nama_lengkap FROM data_guru WHERE id = ?",[a]);if(!d)return{error:"Data guru tidak ditemukan."};let e=(b=d.nama_lengkap.toLowerCase().replace(/[^a-z0-9]/g,""),`${b}@sukahideng.or.id`),k=await (0,f.Zy)("SELECT id, role, roles, source_type, source_ref_id FROM users WHERE email = ?",[e]);if(k){let a=[k.role];try{if(k.roles){let b=JSON.parse(k.roles);Array.isArray(b)&&b.length>0&&(a=b)}}catch{}return a.includes("guru")||a.push("guru"),await (0,f.g7)(`UPDATE users
       SET roles = ?,
           source_type = CASE WHEN source_type IS NULL AND source_ref_id IS NULL THEN 'guru' ELSE source_type END,
           source_ref_id = CASE WHEN source_type IS NULL AND source_ref_id IS NULL THEN ? ELSE source_ref_id END,
           updated_at = datetime('now')
       WHERE id = ?`,[JSON.stringify(a),String(d.id),k.id]),{success:!0,email:e}}let l=await (0,g.E)("eskahade2026");return await (0,f.g7)(`INSERT INTO users (id, email, password_hash, full_name, role, roles, source_type, source_ref_id)
     VALUES (?, ?, ?, ?, 'guru', ?, 'guru', ?)`,[crypto.randomUUID(),e,l,d.nama_lengkap,JSON.stringify(["guru"]),String(d.id)]),await (0,i.logActivity)({actor:(0,i.actorFromSession)(c),module:"master_wali_kelas",action:"create",fiturHref:"/dashboard/master/wali-kelas",logKind:"create",entityType:"user",entityLabel:d.nama_lengkap,summary:`Membuat akun guru otomatis untuk ${d.nama_lengkap}`,details:{email:e,guru_id:a}}),(0,j.revalidatePath)("/dashboard/master/wali-kelas"),{success:!0,email:e}}(0,c(89337).D)([s,t,u,v,w,x,y,z,A,B,C,D,E]),(0,e.A)(s,"00b5df288c751eeeadd723de31cf9a7ac3e7b3c7f1",null),(0,e.A)(t,"001481991cc56fe624a4a401bf0fed0e63cb34df13",null),(0,e.A)(u,"407f3313d93201de1218357921a71a3ec28f4dd0cc",null),(0,e.A)(v,"0007c6be2f7183f638f5b07196990561906eaaf4b4",null),(0,e.A)(w,"708c15317a046d222242044258471bf1cf4d68481f",null),(0,e.A)(x,"409b360bcd6e2106662fca23ec46dcb4b7a9b13755",null),(0,e.A)(y,"404f03683cdd99832c4c6ec627e8b3c01e5bd4214c",null),(0,e.A)(z,"40191aeb71f789b71c00ab9e9599c1041d48354250",null),(0,e.A)(A,"400e416c75da1269d756c03d620af3eab5d03b966d",null),(0,e.A)(B,"60a4a01532bf292a0676b7fdbe0067c6aacc3ac642",null),(0,e.A)(C,"78f306b9a7062cda2e8a89496330f7fd600a3556c8",null),(0,e.A)(D,"007c0efb51e42aec69a1d5af5b1160a46369721c1d",null),(0,e.A)(E,"409c2dcc4800bf474d6a2127f27289ca10e95d1b1e",null)},40560:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(47408).A)("loader-circle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]])},84009:(a,b,c)=>{c.d(b,{DashboardPageHeader:()=>f});var d=c(48249),e=c(33191);function f({title:a,description:b,action:c,className:f}){return(0,d.jsxs)("div",{className:(0,e.cn)("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",f),children:[(0,d.jsxs)("div",{className:"min-w-0",children:[(0,d.jsx)("h1",{className:"text-2xl font-bold leading-tight text-slate-900 sm:text-[1.75rem]",children:a}),(0,d.jsx)("p",{className:"mt-1 text-sm leading-5 text-slate-500",children:b})]}),c?(0,d.jsx)("div",{className:"w-full sm:w-auto sm:shrink-0",children:c}):null]})}},98168:(a,b,c)=>{c.d(b,{CE:()=>g,KV:()=>j,Km:()=>k,dI:()=>i,tD:()=>h,vf:()=>f});var d=c(42650),e=c(44916);let f=(0,d.unstable_cache)(async()=>(0,e.P)("SELECT id, nama, urutan FROM marhalah ORDER BY urutan"),["marhalah-list"],{tags:["marhalah"],revalidate:86400}),g=(0,d.unstable_cache)(async()=>(0,e.P)("SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama"),["mapel-list"],{tags:["mapel"],revalidate:86400}),h=(0,d.unstable_cache)(async()=>(0,e.P)("SELECT id, nama FROM mapel ORDER BY nama"),["mapel-all"],{tags:["mapel"],revalidate:86400}),i=(0,d.unstable_cache)(async()=>(0,e.Zy)("SELECT * FROM tahun_ajaran WHERE is_active = 1 LIMIT 1"),["tahun-ajaran-aktif"],{tags:["tahun-ajaran"],revalidate:3600}),j=(0,d.unstable_cache)(async()=>(0,e.P)("SELECT * FROM tahun_ajaran ORDER BY id DESC"),["tahun-ajaran-list"],{tags:["tahun-ajaran"],revalidate:3600});(0,d.unstable_cache)(async()=>(0,e.P)("SELECT * FROM biaya_settings ORDER BY tahun_angkatan DESC"),["biaya-settings"],{tags:["biaya-settings"],revalidate:86400});let k=(0,d.unstable_cache)(async()=>(0,e.P)("SELECT id, nama_lengkap, gelar FROM data_guru ORDER BY nama_lengkap"),["data-guru"],{tags:["data-guru"],revalidate:3600})}};