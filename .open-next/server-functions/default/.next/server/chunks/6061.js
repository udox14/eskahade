"use strict";exports.id=6061,exports.ids=[6061],exports.modules={1501:(a,b,c)=>{c.d(b,{cK:()=>g,n:()=>i});var d=c(23755),e=c(48445),f=c(55743);async function g(a,b){if(!a)return!1;if((0,d.qc)(a))return!0;let c=(0,d.XV)(a);if(0===c.length)return!1;try{return await (0,e.kO)(b,c,a.id)}catch(a){return console.error("[feature] canAccessFeatureForSession ERROR untuk",b,"-",a?.message),!1}}async function h(a,b,c="read"){return"read"===c?g(a,b):(0,f.Yf)(a,b,c)}async function i(a,b="read"){let c=await (0,d.Ht)();return c?await h(c,a,b)?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},4719:(a,b,c)=>{c.r(b),c.d(b,{"00412ff9fefe976069e110b5046bf517ce1f21ed43":()=>d.C,"00467391b8a49a5236b4e49901cb84273cb17ee85e":()=>r,"4029f65c0b3eed83c09657baf3610c43815070b1a6":()=>z,"403c24049afd1a21da2722eed8889b8c021ea125b3":()=>y,"408b4ebcafc672b5c874441f40a7caf4b265a05843":()=>s,"408f73d6acc263d12bd28964d65d0b79c4e4ea82ac":()=>t,"7c80fcd4b475666c06fa4934800b458f353d5ff7d4":()=>x,"7cc90dc57dd95ef155b7258f75a8153bd95293046a":()=>u,"7e6ae31e18348614c19e5b63837142f56908f747ed":()=>v,"7ee0f6ca15511e8b69171cb5e9fc2384d8da7ca304":()=>w});var d=c(38052),e=c(95349),f=c(44916),g=c(46100),h=c(89773),i=c(42650),j=c(89337);let k="/dashboard/ehb/absensi-menghafal",l="__TANPA_BLOK__",m=["H","A","I","S"];async function n(){await (0,f.g7)(`
    CREATE TABLE IF NOT EXISTS ehb_absensi_menghafal (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      santri_id      TEXT NOT NULL REFERENCES santri(id),
      tanggal        TEXT NOT NULL,
      sesi_id        INTEGER NOT NULL REFERENCES ehb_sesi(id),
      status_absen   TEXT NOT NULL,
      asrama         TEXT,
      blok           TEXT,
      kamar          TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT,
      UNIQUE(ehb_event_id, santri_id, tanggal, sesi_id)
    )
  `),await (0,f.g7)("CREATE INDEX IF NOT EXISTS idx_ehb_absensi_menghafal_event ON ehb_absensi_menghafal(ehb_event_id)"),await (0,f.g7)("CREATE INDEX IF NOT EXISTS idx_ehb_absensi_menghafal_santri ON ehb_absensi_menghafal(santri_id)"),await (0,f.g7)("CREATE INDEX IF NOT EXISTS idx_ehb_absensi_menghafal_jadwal ON ehb_absensi_menghafal(tanggal, sesi_id)"),await (0,f.g7)("CREATE INDEX IF NOT EXISTS idx_ehb_absensi_menghafal_status ON ehb_absensi_menghafal(status_absen)"),await (0,f.g7)("CREATE INDEX IF NOT EXISTS idx_ehb_absensi_menghafal_asrama_kamar ON ehb_absensi_menghafal(asrama, blok, kamar)")}function o(a,b="WHERE"){let c=String(a||"").split(",").map(a=>a.trim()).filter(Boolean);return 0===c.length?{sql:`${b} 1 = 0`,params:[]}:{sql:`${b} kj.jam_group NOT IN (${c.map(()=>"?").join(",")})`,params:c}}function p(a){return String(a??"").trim()||"Tanpa Blok"}function q(a){return String(a??"").trim()||l}async function r(){return(0,f.Zy)("SELECT id, nama FROM ehb_event WHERE is_active = 1 LIMIT 1")}async function s(a){await n();let b=await (0,g.Ht)();if(!b)return[];if((0,g.hf)(b,"pengurus_asrama")&&!(0,g.qc)(b)){if(!b.asrama_binaan)return[];let c=await (0,f.Zy)(`
      SELECT
        s.asrama,
        COUNT(DISTINCT COALESCE(NULLIF(TRIM(kc.blok), ''), '${l}')) AS jumlah_blok,
        COUNT(DISTINCT TRIM(COALESCE(s.kamar, ''))) AS jumlah_kamar,
        COUNT(DISTINCT s.id) AS jumlah_santri
      FROM santri s
      JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
      JOIN kelas k ON k.id = rp.kelas_id
      JOIN ehb_kelas_jam kj ON kj.kelas_id = k.id AND kj.ehb_event_id = ?
      LEFT JOIN kamar_config kc ON kc.asrama = s.asrama AND kc.nomor_kamar = TRIM(COALESCE(s.kamar, ''))
      WHERE s.status_global = 'aktif'
        AND s.asrama = ?
        AND s.kamar IS NOT NULL
        AND TRIM(s.kamar) <> ''
      GROUP BY s.asrama
      LIMIT 1
    `,[a,b.asrama_binaan]);return c?[c]:[]}return(0,f.P)(`
    SELECT
      s.asrama,
      COUNT(DISTINCT COALESCE(NULLIF(TRIM(kc.blok), ''), '${l}')) AS jumlah_blok,
      COUNT(DISTINCT TRIM(COALESCE(s.kamar, ''))) AS jumlah_kamar,
      COUNT(DISTINCT s.id) AS jumlah_santri
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    JOIN ehb_kelas_jam kj ON kj.kelas_id = k.id AND kj.ehb_event_id = ?
    LEFT JOIN kamar_config kc ON kc.asrama = s.asrama AND kc.nomor_kamar = TRIM(COALESCE(s.kamar, ''))
    WHERE s.status_global = 'aktif'
      AND s.asrama IS NOT NULL
      AND TRIM(s.asrama) <> ''
      AND s.kamar IS NOT NULL
      AND TRIM(s.kamar) <> ''
    GROUP BY s.asrama
    ORDER BY s.asrama
  `,[a])}async function t(a){return(0,f.P)(`
    SELECT DISTINCT
      j.tanggal,
      j.sesi_id,
      s.nomor_sesi,
      s.label,
      s.jam_group,
      s.waktu_mulai,
      s.waktu_selesai
    FROM ehb_jadwal j
    JOIN ehb_sesi s ON s.id = j.sesi_id
    WHERE j.ehb_event_id = ?
      AND s.nomor_sesi BETWEEN 1 AND 4
    ORDER BY j.tanggal, s.nomor_sesi
  `,[a])}async function u(a,b,c,d,e){await n();let g=o(d,"AND");return(await (0,f.P)(`
    SELECT
      NULLIF(TRIM(kc.blok), '') AS blok,
      COUNT(DISTINCT s.asrama || ':' || TRIM(COALESCE(s.kamar, ''))) AS jumlah_kamar,
      COUNT(DISTINCT s.id) AS jumlah_santri
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    JOIN ehb_kelas_jam kj ON kj.kelas_id = k.id AND kj.ehb_event_id = ?
    LEFT JOIN kamar_config kc ON kc.asrama = s.asrama AND kc.nomor_kamar = TRIM(COALESCE(s.kamar, ''))
    WHERE s.status_global = 'aktif'
      AND s.asrama = ?
      AND s.kamar IS NOT NULL AND TRIM(s.kamar) <> ''
      ${g.sql}
    GROUP BY NULLIF(TRIM(kc.blok), '')
    ORDER BY CASE WHEN blok IS NULL THEN 1 ELSE 0 END, blok
  `,[a,e,...g.params])).map(a=>({blok_key:q(a.blok),blok_label:p(a.blok),jumlah_kamar:Number(a.jumlah_kamar??0),jumlah_santri:Number(a.jumlah_santri??0)}))}async function v(a,b,c,d,e,g){await n();let h=o(d,"AND");return(await (0,f.P)(`
    SELECT
      s.asrama,
      TRIM(COALESCE(s.kamar, '')) AS kamar,
      NULLIF(TRIM(kc.blok), '') AS blok,
      COUNT(DISTINCT s.id) AS jumlah_santri,
      GROUP_CONCAT(DISTINCT k.nama_kelas) AS kelas_list
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    JOIN ehb_kelas_jam kj ON kj.kelas_id = k.id AND kj.ehb_event_id = ?
    LEFT JOIN kamar_config kc ON kc.asrama = s.asrama AND kc.nomor_kamar = TRIM(COALESCE(s.kamar, ''))
    WHERE s.status_global = 'aktif'
      AND s.asrama = ?
      AND s.kamar IS NOT NULL AND TRIM(s.kamar) <> ''
      ${h.sql}
      AND ${g===l?"(kc.blok IS NULL OR TRIM(kc.blok) = '')":"TRIM(kc.blok) = ?"}
    GROUP BY s.asrama, TRIM(COALESCE(s.kamar, '')), NULLIF(TRIM(kc.blok), '')
    ORDER BY s.asrama, CAST(TRIM(COALESCE(s.kamar, '')) AS INTEGER), TRIM(COALESCE(s.kamar, ''))
  `,[a,e,...h.params,...g===l?[]:[g]])).map(a=>({asrama:a.asrama,kamar:a.kamar,blok_key:q(a.blok),blok_label:p(a.blok),jumlah_santri:Number(a.jumlah_santri??0),kelas_list:a.kelas_list||""}))}async function w(a,b,c,d,e,g){await n();let h=o(d,"AND");return(0,f.P)(`
    SELECT
      s.id AS santri_id,
      s.nama_lengkap,
      s.nis,
      s.asrama,
      TRIM(COALESCE(s.kamar, '')) AS kamar,
      NULLIF(TRIM(kc.blok), '') AS blok,
      k.nama_kelas,
      m.nama AS marhalah_nama,
      kj.jam_group,
      COALESCE(a.status_absen, 'H') AS status_absen
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    JOIN ehb_kelas_jam kj ON kj.kelas_id = k.id AND kj.ehb_event_id = ?
    LEFT JOIN kamar_config kc ON kc.asrama = s.asrama AND kc.nomor_kamar = TRIM(COALESCE(s.kamar, ''))
    LEFT JOIN ehb_absensi_menghafal a
      ON a.santri_id = s.id
     AND a.ehb_event_id = ?
     AND a.tanggal = ?
     AND a.sesi_id = ?
    WHERE s.status_global = 'aktif'
      AND s.asrama = ?
      AND TRIM(COALESCE(s.kamar, '')) = ?
      ${h.sql}
    ORDER BY s.nama_lengkap
  `,[a,a,b,c,e,g,...h.params])}async function x(a,b,c,d,e){await n();let j=await (0,g.Ht)();if(!j)return{error:"Unauthorized"};try{let l=m.includes(e)?e:"H",n=await (0,f.Zy)(`
      SELECT s.asrama, s.kamar, kc.blok, s.nama_lengkap
      FROM santri s
      LEFT JOIN kamar_config kc ON kc.asrama = s.asrama AND kc.nomor_kamar = TRIM(COALESCE(s.kamar, ''))
      WHERE s.id = ?
      LIMIT 1
    `,[d]);if((0,g.hf)(j,"pengurus_asrama")&&!(0,g.qc)(j)&&j.asrama_binaan!==n?.asrama)return{error:"Anda hanya boleh mengabsen asrama binaan Anda"};return await (0,f.g7)(`
      INSERT INTO ehb_absensi_menghafal (ehb_event_id, santri_id, tanggal, sesi_id, status_absen, asrama, blok, kamar, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(ehb_event_id, santri_id, tanggal, sesi_id)
      DO UPDATE SET
        status_absen = excluded.status_absen,
        asrama = excluded.asrama,
        blok = excluded.blok,
        kamar = excluded.kamar,
        updated_at = datetime('now')
    `,[a,d,b,c,l,n?.asrama??null,n?.blok??null,n?.kamar??null]),await (0,h.logActivity)({actor:(0,h.actorFromSession)(j),module:"ehb_absensi_menghafal",action:"update",fiturHref:k,logKind:"update",entityType:"ehb_absensi_menghafal",entityId:`${a}:${b}:${c}:${d}`,entityLabel:n?.nama_lengkap||"Absensi menghafal EHB",summary:`Menyimpan absensi menghafal EHB: ${l}`,details:{event_id:a,tanggal:b,sesi_id:c,santri_id:d,status:l}}),(0,i.revalidatePath)(k),(0,i.revalidatePath)("/dashboard/ehb/absensi-menghafal/rekap"),{success:!0}}catch(a){return{error:a.message}}}async function y(a){await n();let b=await (0,g.Ht)(),c=["a.ehb_event_id = ?","a.status_absen IN ('A', 'I', 'S')","sesi.nomor_sesi BETWEEN 1 AND 4"],d=[a.eventId];if(b&&(0,g.hf)(b,"pengurus_asrama")&&!(0,g.qc)(b)){if(!b.asrama_binaan)return[];c.push("COALESCE(a.asrama, s.asrama) = ?"),d.push(b.asrama_binaan)}return a.tanggal&&(c.push("a.tanggal = ?"),d.push(a.tanggal)),a.sesiId&&(c.push("a.sesi_id = ?"),d.push(a.sesiId)),a.blokKey&&(a.blokKey===l?c.push("(a.blok IS NULL OR TRIM(a.blok) = '')"):(c.push("TRIM(a.blok) = ?"),d.push(a.blokKey))),a.kamar&&(c.push("TRIM(COALESCE(a.kamar, '')) = ?"),d.push(a.kamar)),a.status&&["A","I","S"].includes(a.status)&&(c.push("a.status_absen = ?"),d.push(a.status)),(0,f.P)(`
    SELECT
      a.santri_id,
      s.nama_lengkap,
      s.nis,
      COALESCE(a.asrama, s.asrama) AS asrama,
      COALESCE(a.kamar, s.kamar) AS kamar,
      a.blok,
      k.nama_kelas,
      m.nama AS marhalah_nama,
      kj.jam_group,
      a.status_absen,
      a.tanggal,
      a.sesi_id,
      sesi.nomor_sesi,
      sesi.label AS sesi_label,
      sesi.waktu_mulai,
      sesi.waktu_selesai,
      a.updated_at,
      a.created_at
    FROM ehb_absensi_menghafal a
    JOIN santri s ON s.id = a.santri_id
    JOIN ehb_sesi sesi ON sesi.id = a.sesi_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN ehb_kelas_jam kj ON kj.kelas_id = k.id AND kj.ehb_event_id = a.ehb_event_id
    WHERE ${c.join(" AND ")}
    ORDER BY a.tanggal DESC, sesi.nomor_sesi, COALESCE(a.asrama, s.asrama), COALESCE(a.blok, ''), COALESCE(a.kamar, ''), s.nama_lengkap
  `,d)}async function z(a){await n();let b=await (0,g.Ht)(),c=b&&(0,g.hf)(b,"pengurus_asrama")&&!(0,g.qc)(b)?b.asrama_binaan:null,d=c?[c]:[],[e,h,i,j]=await Promise.all([t(a),(0,f.P)(`
      SELECT DISTINCT j.tanggal
      FROM ehb_jadwal j
      JOIN ehb_sesi s ON s.id = j.sesi_id
      WHERE j.ehb_event_id = ? AND s.nomor_sesi BETWEEN 1 AND 4
      ORDER BY j.tanggal DESC
    `,[a]),(0,f.P)(`
      SELECT blok
      FROM (
        SELECT DISTINCT NULLIF(TRIM(blok), '') AS blok
        FROM kamar_config
        WHERE 1 = 1 ${c?"AND asrama = ?":""}
      ) daftar_blok
      ORDER BY CASE WHEN blok IS NULL THEN 1 ELSE 0 END, blok
    `,d),(0,f.P)(`
      SELECT DISTINCT TRIM(kamar) AS kamar
      FROM santri
      WHERE status_global = 'aktif'
        AND kamar IS NOT NULL
        AND TRIM(kamar) <> ''
        ${c?"AND asrama = ?":""}
      ORDER BY CAST(TRIM(kamar) AS INTEGER), TRIM(kamar)
    `,d)]);return{sesiList:e,tanggalList:h.map(a=>a.tanggal),blokList:i.map(a=>({blok_key:q(a.blok),blok_label:p(a.blok)})),kamarList:j.map(a=>a.kamar)}}(0,j.D)([r,s,t,u,v,w,x,y,z]),(0,e.A)(r,"00467391b8a49a5236b4e49901cb84273cb17ee85e",null),(0,e.A)(s,"408b4ebcafc672b5c874441f40a7caf4b265a05843",null),(0,e.A)(t,"408f73d6acc263d12bd28964d65d0b79c4e4ea82ac",null),(0,e.A)(u,"7cc90dc57dd95ef155b7258f75a8153bd95293046a",null),(0,e.A)(v,"7e6ae31e18348614c19e5b63837142f56908f747ed",null),(0,e.A)(w,"7ee0f6ca15511e8b69171cb5e9fc2384d8da7ca304",null),(0,e.A)(x,"7c80fcd4b475666c06fa4934800b458f353d5ff7d4",null),(0,e.A)(y,"403c24049afd1a21da2722eed8889b8c021ea125b3",null),(0,e.A)(z,"4029f65c0b3eed83c09657baf3610c43815070b1a6",null)},10316:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(47408).A)("search",[["path",{d:"m21 21-4.34-4.34",key:"14j7rj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}]])},17104:(a,b,c)=>{c.d(b,{P:()=>e});var d=c(99829);let e=(0,d.createServerReference)("00467391b8a49a5236b4e49901cb84273cb17ee85e",d.callServer,void 0,d.findSourceMapURL,"getActiveEventLight")},31675:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(47408).A)("triangle-alert",[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]])},40560:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(47408).A)("loader-circle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]])},45502:(a,b,c)=>{c.d(b,{F:()=>g,S:()=>h});var d=c(23755),e=c(1501),f=c(91970);async function g(a){let b=await (0,d.Ht)();b||(0,f.redirect)("/login");let c=(0,d.XV)(b);if(c.includes("admin"))return b;let g=!1;try{g=await (0,e.cK)(b,a)}catch(c){return console.error("[guard] canAccessHref ERROR untuk",a,"-",c?.message),console.error("[guard] PERINGATAN: pastikan migration 0011_fitur_akses.sql sudah dijalankan di D1!"),b}return console.log("[guard] href:",a,"| roles:",c,"| allowed:",g),g||(0,f.redirect)("/dashboard"),b}async function h(a=[]){let b=await (0,d.Ht)();return b||(0,f.redirect)("/login"),a.length>0&&((0,d.XV)(b).some(b=>a.includes(b))||(0,f.redirect)("/dashboard")),b}},52742:(a,b,c)=>{c.d(b,{G9:()=>m,H2:()=>o,LV:()=>i,g1:()=>k,jS:()=>l,mf:()=>p,oC:()=>j,pl:()=>h,rZ:()=>n});let d=["Minggu","Senin","Selasa","Rabu","Kamis","Jum'at","Sabtu"],e=d.map(a=>a.toUpperCase()),f=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"],g=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];function h(a){let[b,c,d]=a.split("-").map(Number);return new Date(b,c-1,d)}function i(a){let b=a.getFullYear(),c=String(a.getMonth()+1).padStart(2,"0"),d=String(a.getDate()).padStart(2,"0");return`${b}-${c}-${d}`}function j(a,b){if(!a||!b)return[];let c=[],d=h(a),e=h(b);for(;d<=e;)c.push(i(d)),d.setDate(d.getDate()+1);return c}function k(a,b=!1){return(b?e:d)[h(a).getDay()]}function l(a,b=!0){let c=h(a),d=`${c.getDate()} ${f[c.getMonth()]}`;return b?`${d} ${c.getFullYear()}`:d}function m(a,b=!1){return`${k(a,b)}, ${l(a)}`}function n(a,b=!0){let c=h(a),d=`${c.getDate()}-${g[c.getMonth()]}`;return b?`${d}-${String(c.getFullYear()).slice(-2)}`:d}function o(a,b){return a&&b?`${l(a,!1)} - ${l(b)}`:""}function p(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",dateStyle:"medium",timeStyle:"short"}).format(new Date)}},55743:(a,b,c)=>{c.d(b,{HA:()=>k,Yf:()=>i,ZW:()=>j,hj:()=>h});var d=c(44075),e=c(23755),f=c(65926);function g(a){return{fitur_href:a.fitur_href,role:a.role,can_create:1===a.can_create,can_update:1===a.can_update,can_delete:1===a.can_delete}}async function h(){try{return(await (0,d.P)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       ORDER BY fitur_href, role`)).map(g)}catch(a){return console.error("[crud] getCrudPermissionsForAdmin ERROR:",a?.message),[]}}async function i(a,b,c){if(!a)return!1;if((0,e.qc)(a))return!0;let g=(0,e.XV)(a);if(0===g.length)return!1;try{return(await (0,d.P)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       WHERE fitur_href = ?
         AND ${"create"===c?"can_create":"update"===c?"can_update":"can_delete"} = 1`,[b])).some(a=>(0,f.Q)([a.role],g))}catch(a){return console.error("[crud] canCrudForSession ERROR:",a?.message),!1}}async function j(a,b){return i(await (0,e.Ht)(),a,b)}async function k(a,b){let c=await (0,e.Ht)(),d=await i(c,a,b);return c?d?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},72987:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(47408).A)("chevron-left",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]])},75154:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(47408).A)("calendar",[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]])},77949:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(47408).A)("clipboard-list",[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"M12 11h4",key:"1jrz19"}],["path",{d:"M12 16h4",key:"n85exb"}],["path",{d:"M8 11h.01",key:"1dfujw"}],["path",{d:"M8 16h.01",key:"18s6g9"}]])}};