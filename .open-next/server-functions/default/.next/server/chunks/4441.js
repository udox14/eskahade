"use strict";exports.id=4441,exports.ids=[4441],exports.modules={1501:(a,b,c)=>{c.d(b,{cK:()=>g,n:()=>i});var d=c(23755),e=c(48445),f=c(55743);async function g(a,b){if(!a)return!1;if((0,d.qc)(a))return!0;let c=(0,d.XV)(a);if(0===c.length)return!1;try{return await (0,e.kO)(b,c,a.id)}catch(a){return console.error("[feature] canAccessFeatureForSession ERROR untuk",b,"-",a?.message),!1}}async function h(a,b,c="read"){return"read"===c?g(a,b):(0,f.Yf)(a,b,c)}async function i(a,b="read"){let c=await (0,d.Ht)();return c?await h(c,a,b)?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},23189:(a,b,c)=>{c.d(b,{$z:()=>t,CV:()=>k,Gz:()=>p,Op:()=>q,VF:()=>l,dr:()=>n,iH:()=>m,q2:()=>g,xK:()=>h,z3:()=>s});var d=c(44916),e=c(46100);let f=null,g=[{key:"quran",label:"Hafalan Al-Qur'an"},{key:"hadits",label:"Hafalan Hadits"},{key:"jurumiyah",label:"Hafalan Jurumiyah"},{key:"amtsilah",label:"Hafalan Amtsilah"},{key:"alfiyah",label:"Hafalan Alfiyah"}],h=[{number:1,name:"Al-Fatihah",ayahCount:7},{number:2,name:"Al-Baqarah",ayahCount:286},{number:3,name:"Ali Imran",ayahCount:200},{number:4,name:"An-Nisa",ayahCount:176},{number:5,name:"Al-Ma'idah",ayahCount:120},{number:6,name:"Al-An'am",ayahCount:165},{number:7,name:"Al-A'raf",ayahCount:206},{number:8,name:"Al-Anfal",ayahCount:75},{number:9,name:"At-Taubah",ayahCount:129},{number:10,name:"Yunus",ayahCount:109},{number:11,name:"Hud",ayahCount:123},{number:12,name:"Yusuf",ayahCount:111},{number:13,name:"Ar-Ra'd",ayahCount:43},{number:14,name:"Ibrahim",ayahCount:52},{number:15,name:"Al-Hijr",ayahCount:99},{number:16,name:"An-Nahl",ayahCount:128},{number:17,name:"Al-Isra",ayahCount:111},{number:18,name:"Al-Kahf",ayahCount:110},{number:19,name:"Maryam",ayahCount:98},{number:20,name:"Taha",ayahCount:135},{number:21,name:"Al-Anbiya",ayahCount:112},{number:22,name:"Al-Hajj",ayahCount:78},{number:23,name:"Al-Mu'minun",ayahCount:118},{number:24,name:"An-Nur",ayahCount:64},{number:25,name:"Al-Furqan",ayahCount:77},{number:26,name:"Ash-Shu'ara",ayahCount:227},{number:27,name:"An-Naml",ayahCount:93},{number:28,name:"Al-Qasas",ayahCount:88},{number:29,name:"Al-Ankabut",ayahCount:69},{number:30,name:"Ar-Rum",ayahCount:60},{number:31,name:"Luqman",ayahCount:34},{number:32,name:"As-Sajdah",ayahCount:30},{number:33,name:"Al-Ahzab",ayahCount:73},{number:34,name:"Saba",ayahCount:54},{number:35,name:"Fatir",ayahCount:45},{number:36,name:"Yasin",ayahCount:83},{number:37,name:"As-Saffat",ayahCount:182},{number:38,name:"Sad",ayahCount:88},{number:39,name:"Az-Zumar",ayahCount:75},{number:40,name:"Ghafir",ayahCount:85},{number:41,name:"Fussilat",ayahCount:54},{number:42,name:"Ash-Shura",ayahCount:53},{number:43,name:"Az-Zukhruf",ayahCount:89},{number:44,name:"Ad-Dukhan",ayahCount:59},{number:45,name:"Al-Jathiyah",ayahCount:37},{number:46,name:"Al-Ahqaf",ayahCount:35},{number:47,name:"Muhammad",ayahCount:38},{number:48,name:"Al-Fath",ayahCount:29},{number:49,name:"Al-Hujurat",ayahCount:18},{number:50,name:"Qaf",ayahCount:45},{number:51,name:"Adh-Dhariyat",ayahCount:60},{number:52,name:"At-Tur",ayahCount:49},{number:53,name:"An-Najm",ayahCount:62},{number:54,name:"Al-Qamar",ayahCount:55},{number:55,name:"Ar-Rahman",ayahCount:78},{number:56,name:"Al-Waqi'ah",ayahCount:96},{number:57,name:"Al-Hadid",ayahCount:29},{number:58,name:"Al-Mujadilah",ayahCount:22},{number:59,name:"Al-Hashr",ayahCount:24},{number:60,name:"Al-Mumtahanah",ayahCount:13},{number:61,name:"As-Saff",ayahCount:14},{number:62,name:"Al-Jumu'ah",ayahCount:11},{number:63,name:"Al-Munafiqun",ayahCount:11},{number:64,name:"At-Taghabun",ayahCount:18},{number:65,name:"At-Talaq",ayahCount:12},{number:66,name:"At-Tahrim",ayahCount:12},{number:67,name:"Al-Mulk",ayahCount:30},{number:68,name:"Al-Qalam",ayahCount:52},{number:69,name:"Al-Haqqah",ayahCount:52},{number:70,name:"Al-Ma'arij",ayahCount:44},{number:71,name:"Nuh",ayahCount:28},{number:72,name:"Al-Jinn",ayahCount:28},{number:73,name:"Al-Muzzammil",ayahCount:20},{number:74,name:"Al-Muddaththir",ayahCount:56},{number:75,name:"Al-Qiyamah",ayahCount:40},{number:76,name:"Al-Insan",ayahCount:31},{number:77,name:"Al-Mursalat",ayahCount:50},{number:78,name:"An-Naba",ayahCount:40},{number:79,name:"An-Nazi'at",ayahCount:46},{number:80,name:"Abasa",ayahCount:42},{number:81,name:"At-Takwir",ayahCount:29},{number:82,name:"Al-Infitar",ayahCount:19},{number:83,name:"Al-Mutaffifin",ayahCount:36},{number:84,name:"Al-Inshiqaq",ayahCount:25},{number:85,name:"Al-Buruj",ayahCount:22},{number:86,name:"At-Tariq",ayahCount:17},{number:87,name:"Al-A'la",ayahCount:19},{number:88,name:"Al-Ghashiyah",ayahCount:26},{number:89,name:"Al-Fajr",ayahCount:30},{number:90,name:"Al-Balad",ayahCount:20},{number:91,name:"Ash-Shams",ayahCount:15},{number:92,name:"Al-Lail",ayahCount:21},{number:93,name:"Ad-Duha",ayahCount:11},{number:94,name:"Ash-Sharh",ayahCount:8},{number:95,name:"At-Tin",ayahCount:8},{number:96,name:"Al-Alaq",ayahCount:19},{number:97,name:"Al-Qadr",ayahCount:5},{number:98,name:"Al-Bayyinah",ayahCount:8},{number:99,name:"Az-Zalzalah",ayahCount:8},{number:100,name:"Al-Adiyat",ayahCount:11},{number:101,name:"Al-Qari'ah",ayahCount:11},{number:102,name:"At-Takathur",ayahCount:8},{number:103,name:"Al-Asr",ayahCount:3},{number:104,name:"Al-Humazah",ayahCount:9},{number:105,name:"Al-Fil",ayahCount:5},{number:106,name:"Quraysh",ayahCount:4},{number:107,name:"Al-Ma'un",ayahCount:7},{number:108,name:"Al-Kawthar",ayahCount:3},{number:109,name:"Al-Kafirun",ayahCount:6},{number:110,name:"An-Nasr",ayahCount:3},{number:111,name:"Al-Masad",ayahCount:5},{number:112,name:"Al-Ikhlas",ayahCount:4},{number:113,name:"Al-Falaq",ayahCount:5},{number:114,name:"An-Nas",ayahCount:6}],i=["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"],j=new Map(h.map((a,b)=>[a.name.toLowerCase(),i[b]]));function k(a){return i[a.number-1]||a.name}function l(a){return j.get(String(a||"").toLowerCase())||a}function m(a){return g.some(b=>b.key===a)}async function n(){f??=o().catch(a=>{throw f=null,a}),await f}async function o(){await (0,d.g7)(`
    CREATE TABLE IF NOT EXISTS nilai_harian_sesi (
      id TEXT PRIMARY KEY,
      kelas_id TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
      mapel_id INTEGER NOT NULL REFERENCES mapel(id),
      guru_id INTEGER REFERENCES data_guru(id),
      tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id),
      tanggal TEXT NOT NULL,
      nama_sesi TEXT NOT NULL,
      kkm INTEGER NOT NULL DEFAULT 0,
      deskripsi TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `),await (0,d.g7)(`
    CREATE TABLE IF NOT EXISTS nilai_harian_detail (
      id TEXT PRIMARY KEY,
      sesi_id TEXT NOT NULL REFERENCES nilai_harian_sesi(id) ON DELETE CASCADE,
      riwayat_pendidikan_id TEXT NOT NULL REFERENCES riwayat_pendidikan(id) ON DELETE CASCADE,
      nilai INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(sesi_id, riwayat_pendidikan_id)
    )
  `),await (0,d.g7)(`
    CREATE TABLE IF NOT EXISTS hafalan_paket (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jenis TEXT NOT NULL,
      nama TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(jenis, nama)
    )
  `),await (0,d.g7)(`
    CREATE TABLE IF NOT EXISTS hafalan_paket_marhalah (
      paket_id INTEGER NOT NULL REFERENCES hafalan_paket(id) ON DELETE CASCADE,
      marhalah_id INTEGER NOT NULL REFERENCES marhalah(id) ON DELETE CASCADE,
      jenis TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (paket_id, marhalah_id),
      UNIQUE(jenis, marhalah_id)
    )
  `),await (0,d.g7)(`
    CREATE TABLE IF NOT EXISTS hafalan_bab (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jenis TEXT NOT NULL,
      marhalah_id INTEGER NOT NULL REFERENCES marhalah(id),
      paket_id INTEGER REFERENCES hafalan_paket(id),
      parent_id INTEGER REFERENCES hafalan_bab(id) ON DELETE CASCADE,
      judul TEXT NOT NULL,
      urutan INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `),await (0,d.g7)(`
    CREATE TABLE IF NOT EXISTS hafalan_blok (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bab_id INTEGER NOT NULL REFERENCES hafalan_bab(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      deskripsi TEXT,
      urutan INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `),await (0,d.g7)(`
    CREATE TABLE IF NOT EXISTS hafalan_progress (
      id TEXT PRIMARY KEY,
      blok_id INTEGER NOT NULL REFERENCES hafalan_blok(id) ON DELETE CASCADE,
      riwayat_pendidikan_id TEXT NOT NULL REFERENCES riwayat_pendidikan(id) ON DELETE CASCADE,
      santri_id TEXT REFERENCES santri(id),
      kelas_id TEXT REFERENCES kelas(id),
      marhalah_id INTEGER REFERENCES marhalah(id),
      guru_id INTEGER REFERENCES data_guru(id),
      status TEXT NOT NULL DEFAULT 'hafal',
      tanggal_setor TEXT NOT NULL DEFAULT (date('now')),
      updated_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(blok_id, riwayat_pendidikan_id)
    )
  `),await (0,d.g7)("CREATE INDEX IF NOT EXISTS idx_nilai_harian_sesi_kelas ON nilai_harian_sesi(kelas_id, mapel_id, tanggal)"),await (0,d.g7)("CREATE INDEX IF NOT EXISTS idx_nilai_harian_detail_sesi ON nilai_harian_detail(sesi_id)");try{await (0,d.g7)("ALTER TABLE hafalan_bab ADD COLUMN parent_id INTEGER REFERENCES hafalan_bab(id) ON DELETE CASCADE")}catch(a){if(!String(a?.message||"").toLowerCase().includes("duplicate column name"))throw a}try{await (0,d.g7)("ALTER TABLE hafalan_bab ADD COLUMN paket_id INTEGER REFERENCES hafalan_paket(id)")}catch(a){if(!String(a?.message||"").toLowerCase().includes("duplicate column name"))throw a}for(let a of["ALTER TABLE hafalan_progress ADD COLUMN santri_id TEXT REFERENCES santri(id)","ALTER TABLE hafalan_progress ADD COLUMN kelas_id TEXT REFERENCES kelas(id)","ALTER TABLE hafalan_progress ADD COLUMN marhalah_id INTEGER REFERENCES marhalah(id)"])try{await (0,d.g7)(a)}catch(a){if(!String(a?.message||"").toLowerCase().includes("duplicate column name"))throw a}await (0,d.g7)(`
    UPDATE hafalan_progress
    SET santri_id = (
        SELECT rp.santri_id
        FROM riwayat_pendidikan rp
        WHERE rp.id = hafalan_progress.riwayat_pendidikan_id
        LIMIT 1
      ),
      kelas_id = (
        SELECT rp.kelas_id
        FROM riwayat_pendidikan rp
        WHERE rp.id = hafalan_progress.riwayat_pendidikan_id
        LIMIT 1
      ),
      marhalah_id = (
        SELECT k.marhalah_id
        FROM riwayat_pendidikan rp
        JOIN kelas k ON k.id = rp.kelas_id
        WHERE rp.id = hafalan_progress.riwayat_pendidikan_id
        LIMIT 1
      )
    WHERE santri_id IS NULL
  `),await (0,d.g7)(`
    INSERT OR IGNORE INTO hafalan_paket (jenis, nama)
    SELECT DISTINCT hb.jenis, COALESCE(m.nama, 'Marhalah ' || hb.marhalah_id)
    FROM hafalan_bab hb
    LEFT JOIN marhalah m ON m.id = hb.marhalah_id
    WHERE hb.paket_id IS NULL
  `),await (0,d.g7)(`
    INSERT OR IGNORE INTO hafalan_paket_marhalah (paket_id, marhalah_id, jenis)
    SELECT hp.id, hb.marhalah_id, hb.jenis
    FROM hafalan_bab hb
    JOIN marhalah m ON m.id = hb.marhalah_id
    JOIN hafalan_paket hp ON hp.jenis = hb.jenis AND hp.nama = m.nama
    WHERE hb.paket_id IS NULL
    GROUP BY hp.id, hb.marhalah_id, hb.jenis
  `),await (0,d.g7)(`
    UPDATE hafalan_bab
    SET paket_id = (
      SELECT hp.id
      FROM hafalan_paket hp
      JOIN marhalah m ON m.id = hafalan_bab.marhalah_id
      WHERE hp.jenis = hafalan_bab.jenis
        AND hp.nama = m.nama
      LIMIT 1
    )
    WHERE paket_id IS NULL
  `),await (0,d.g7)("CREATE INDEX IF NOT EXISTS idx_hafalan_paket_lookup ON hafalan_paket(jenis, is_active, nama)"),await (0,d.g7)("CREATE INDEX IF NOT EXISTS idx_hafalan_paket_marhalah_lookup ON hafalan_paket_marhalah(jenis, marhalah_id)"),await (0,d.g7)("CREATE INDEX IF NOT EXISTS idx_hafalan_bab_lookup ON hafalan_bab(jenis, marhalah_id, is_active, urutan)"),await (0,d.g7)("CREATE INDEX IF NOT EXISTS idx_hafalan_bab_paket ON hafalan_bab(paket_id, jenis, is_active, urutan)"),await (0,d.g7)("CREATE INDEX IF NOT EXISTS idx_hafalan_bab_parent ON hafalan_bab(parent_id)"),await (0,d.g7)("CREATE INDEX IF NOT EXISTS idx_hafalan_blok_bab ON hafalan_blok(bab_id, is_active, urutan)"),await (0,d.g7)("CREATE INDEX IF NOT EXISTS idx_hafalan_progress_riwayat ON hafalan_progress(riwayat_pendidikan_id)"),await (0,d.g7)("CREATE INDEX IF NOT EXISTS idx_hafalan_progress_santri ON hafalan_progress(santri_id, blok_id)"),await (0,d.g7)("CREATE INDEX IF NOT EXISTS idx_hafalan_progress_scope ON hafalan_progress(marhalah_id, kelas_id)"),await (0,d.g7)(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan, is_bottomnav, bottomnav_urutan)
    VALUES
      ('Akademik', 'Nilai Harian', '/dashboard/guru/nilai-harian', 'BookOpen', '["admin","sekpen","akademik","guru"]', 1, 8, 1, 3),
      ('Akademik', 'Hafalan', '/dashboard/guru/hafalan', 'ClipboardCheck', '["admin","sekpen","akademik","guru"]', 1, 9, 1, 4),
      ('Master Data', 'Master Hafalan', '/dashboard/master/hafalan', 'Database', '["admin"]', 1, 11, 0, 0)
  `)}async function p(a){if(!a)return null;let b=await (0,d.Zy)("SELECT source_type, source_ref_id FROM users WHERE id = ?",[a.id]);if(b?.source_type!=="guru")return null;let c=Number(b.source_ref_id);return Number.isFinite(c)&&c>0?c:null}async function q(a){await n();let b=a??await (0,e.Ht)();if(!b)return[];if((0,e.qc)(b)||(0,e.pX)(b,["sekpen","akademik"]))return r(await (0,d.P)(`
      SELECT k.id, k.nama_kelas, k.marhalah_id, m.nama AS marhalah_nama,
             k.tahun_ajaran_id, ta.nama AS tahun_ajaran_nama
      FROM kelas k
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
      LEFT JOIN marhalah m ON m.id = k.marhalah_id
    `));let c=await p(b);return c?r(await (0,d.P)(`
    SELECT DISTINCT k.id, k.nama_kelas, k.marhalah_id, m.nama AS marhalah_nama,
           k.tahun_ajaran_id, ta.nama AS tahun_ajaran_nama
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN kelas_jadwal_guru_mingguan kj ON kj.kelas_id = k.id AND kj.guru_id = ?
    WHERE kj.id IS NOT NULL
       OR k.guru_shubuh_id = ?
       OR k.guru_ashar_id = ?
       OR k.guru_maghrib_id = ?
    ORDER BY k.nama_kelas
  `,[c,c,c,c])):[]}function r(a){return[...a].sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}async function s(a,b){return!!a&&!!b&&(!!((0,e.qc)(a)||(0,e.pX)(a,["sekpen","akademik"]))||(await q(a)).some(a=>a.id===b))}async function t(a){let b=await (0,d.P)(`
    SELECT rp.id AS riwayat_id, s.id AS santri_id, s.nis, s.nama_lengkap AS nama
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.kelas_id = ?
      AND lower(trim(COALESCE(s.status_global, 'aktif'))) NOT IN ('arsip', 'alumni', 'keluar')
      AND (
        lower(trim(COALESCE(rp.status_riwayat, 'aktif'))) IN ('aktif', 'active', '')
        OR NOT EXISTS (
          SELECT 1
          FROM riwayat_pendidikan active_rp
          JOIN santri active_s ON active_s.id = active_rp.santri_id
          WHERE active_rp.kelas_id = rp.kelas_id
            AND lower(trim(COALESCE(active_rp.status_riwayat, 'aktif'))) IN ('aktif', 'active', '')
            AND lower(trim(COALESCE(active_s.status_global, 'aktif'))) NOT IN ('arsip', 'alumni', 'keluar')
        )
      )
    ORDER BY s.nama_lengkap
  `,[a]);return b.length>0?b:(0,d.P)(`
    SELECT rp.id AS riwayat_id, s.id AS santri_id, s.nis, s.nama_lengkap AS nama
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.kelas_id = ?
      AND lower(trim(COALESCE(s.status_global, 'aktif'))) NOT IN ('arsip', 'alumni', 'keluar')
    ORDER BY s.nama_lengkap
  `,[a])}},40560:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(47408).A)("loader-circle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]])},45502:(a,b,c)=>{c.d(b,{F:()=>g,S:()=>h});var d=c(23755),e=c(1501),f=c(91970);async function g(a){let b=await (0,d.Ht)();b||(0,f.redirect)("/login");let c=(0,d.XV)(b);if(c.includes("admin"))return b;let g=!1;try{g=await (0,e.cK)(b,a)}catch(c){return console.error("[guard] canAccessHref ERROR untuk",a,"-",c?.message),console.error("[guard] PERINGATAN: pastikan migration 0011_fitur_akses.sql sudah dijalankan di D1!"),b}return console.log("[guard] href:",a,"| roles:",c,"| allowed:",g),g||(0,f.redirect)("/dashboard"),b}async function h(a=[]){let b=await (0,d.Ht)();return b||(0,f.redirect)("/login"),a.length>0&&((0,d.XV)(b).some(b=>a.includes(b))||(0,f.redirect)("/dashboard")),b}},55743:(a,b,c)=>{c.d(b,{HA:()=>j,Yf:()=>h,ZW:()=>i,hj:()=>g});var d=c(44075),e=c(23755);function f(a){return{fitur_href:a.fitur_href,role:a.role,can_create:1===a.can_create,can_update:1===a.can_update,can_delete:1===a.can_delete}}async function g(){try{return(await (0,d.P)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       ORDER BY fitur_href, role`)).map(f)}catch(a){return console.error("[crud] getCrudPermissionsForAdmin ERROR:",a?.message),[]}}async function h(a,b,c){if(!a)return!1;if((0,e.qc)(a))return!0;let f=(0,e.XV)(a);if(0===f.length)return!1;let g=f.map(()=>"?").join(",");try{let a=await (0,d.Zy)(`SELECT 1 AS allowed
       FROM role_fitur_crud_permission
       WHERE fitur_href = ?
         AND role IN (${g})
         AND ${"create"===c?"can_create":"update"===c?"can_update":"can_delete"} = 1
       LIMIT 1`,[b,...f]);return a?.allowed===1}catch(a){return console.error("[crud] canCrudForSession ERROR:",a?.message),!1}}async function i(a,b){return h(await (0,e.Ht)(),a,b)}async function j(a,b){let c=await (0,e.Ht)(),d=await h(c,a,b);return c?d?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},84009:(a,b,c)=>{c.d(b,{DashboardPageHeader:()=>f});var d=c(48249),e=c(33191);function f({title:a,description:b,action:c,className:f}){return(0,d.jsxs)("div",{className:(0,e.cn)("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",f),children:[(0,d.jsxs)("div",{className:"min-w-0",children:[(0,d.jsx)("h1",{className:"text-2xl font-bold leading-tight text-slate-900 sm:text-[1.75rem]",children:a}),(0,d.jsx)("p",{className:"mt-1 text-sm leading-5 text-slate-500",children:b})]}),c?(0,d.jsx)("div",{className:"w-full sm:w-auto sm:shrink-0",children:c}):null]})}}};