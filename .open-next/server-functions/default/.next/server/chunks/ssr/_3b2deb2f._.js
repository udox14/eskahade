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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},9343,a=>{"use strict";var b=a.i(18558),c=a.i(12259);let d=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama, urutan FROM marhalah ORDER BY urutan"),["marhalah-list"],{tags:["marhalah"],revalidate:86400}),e=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama"),["mapel-list"],{tags:["mapel"],revalidate:86400}),f=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel ORDER BY nama"),["mapel-all"],{tags:["mapel"],revalidate:86400}),g=(0,b.unstable_cache)(async()=>(0,c.queryOne)("SELECT * FROM tahun_ajaran WHERE is_active = 1 LIMIT 1"),["tahun-ajaran-aktif"],{tags:["tahun-ajaran"],revalidate:3600}),h=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM tahun_ajaran ORDER BY id DESC"),["tahun-ajaran-list"],{tags:["tahun-ajaran"],revalidate:3600}),i=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM biaya_settings ORDER BY tahun_angkatan DESC"),["biaya-settings"],{tags:["biaya-settings"],revalidate:86400}),j=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama_lengkap, gelar FROM data_guru ORDER BY nama_lengkap"),["data-guru"],{tags:["data-guru"],revalidate:3600});a.s(["getCachedBiayaSettings",0,i,"getCachedDataGuru",0,j,"getCachedMapelAll",0,f,"getCachedMapelList",0,e,"getCachedMarhalahList",0,d,"getCachedTahunAjaranAktif",0,g,"getCachedTahunAjaranList",0,h])},3038,a=>{"use strict";var b=a.i(12259),c=a.i(53058);let d=null,e=[{key:"quran",label:"Hafalan Al-Qur'an"},{key:"hadits",label:"Hafalan Hadits"},{key:"jurumiyah",label:"Hafalan Jurumiyah"},{key:"amtsilah",label:"Hafalan Amtsilah"},{key:"alfiyah",label:"Hafalan Alfiyah"}],f=[{number:1,name:"Al-Fatihah",ayahCount:7},{number:2,name:"Al-Baqarah",ayahCount:286},{number:3,name:"Ali Imran",ayahCount:200},{number:4,name:"An-Nisa",ayahCount:176},{number:5,name:"Al-Ma'idah",ayahCount:120},{number:6,name:"Al-An'am",ayahCount:165},{number:7,name:"Al-A'raf",ayahCount:206},{number:8,name:"Al-Anfal",ayahCount:75},{number:9,name:"At-Taubah",ayahCount:129},{number:10,name:"Yunus",ayahCount:109},{number:11,name:"Hud",ayahCount:123},{number:12,name:"Yusuf",ayahCount:111},{number:13,name:"Ar-Ra'd",ayahCount:43},{number:14,name:"Ibrahim",ayahCount:52},{number:15,name:"Al-Hijr",ayahCount:99},{number:16,name:"An-Nahl",ayahCount:128},{number:17,name:"Al-Isra",ayahCount:111},{number:18,name:"Al-Kahf",ayahCount:110},{number:19,name:"Maryam",ayahCount:98},{number:20,name:"Taha",ayahCount:135},{number:21,name:"Al-Anbiya",ayahCount:112},{number:22,name:"Al-Hajj",ayahCount:78},{number:23,name:"Al-Mu'minun",ayahCount:118},{number:24,name:"An-Nur",ayahCount:64},{number:25,name:"Al-Furqan",ayahCount:77},{number:26,name:"Ash-Shu'ara",ayahCount:227},{number:27,name:"An-Naml",ayahCount:93},{number:28,name:"Al-Qasas",ayahCount:88},{number:29,name:"Al-Ankabut",ayahCount:69},{number:30,name:"Ar-Rum",ayahCount:60},{number:31,name:"Luqman",ayahCount:34},{number:32,name:"As-Sajdah",ayahCount:30},{number:33,name:"Al-Ahzab",ayahCount:73},{number:34,name:"Saba",ayahCount:54},{number:35,name:"Fatir",ayahCount:45},{number:36,name:"Yasin",ayahCount:83},{number:37,name:"As-Saffat",ayahCount:182},{number:38,name:"Sad",ayahCount:88},{number:39,name:"Az-Zumar",ayahCount:75},{number:40,name:"Ghafir",ayahCount:85},{number:41,name:"Fussilat",ayahCount:54},{number:42,name:"Ash-Shura",ayahCount:53},{number:43,name:"Az-Zukhruf",ayahCount:89},{number:44,name:"Ad-Dukhan",ayahCount:59},{number:45,name:"Al-Jathiyah",ayahCount:37},{number:46,name:"Al-Ahqaf",ayahCount:35},{number:47,name:"Muhammad",ayahCount:38},{number:48,name:"Al-Fath",ayahCount:29},{number:49,name:"Al-Hujurat",ayahCount:18},{number:50,name:"Qaf",ayahCount:45},{number:51,name:"Adh-Dhariyat",ayahCount:60},{number:52,name:"At-Tur",ayahCount:49},{number:53,name:"An-Najm",ayahCount:62},{number:54,name:"Al-Qamar",ayahCount:55},{number:55,name:"Ar-Rahman",ayahCount:78},{number:56,name:"Al-Waqi'ah",ayahCount:96},{number:57,name:"Al-Hadid",ayahCount:29},{number:58,name:"Al-Mujadilah",ayahCount:22},{number:59,name:"Al-Hashr",ayahCount:24},{number:60,name:"Al-Mumtahanah",ayahCount:13},{number:61,name:"As-Saff",ayahCount:14},{number:62,name:"Al-Jumu'ah",ayahCount:11},{number:63,name:"Al-Munafiqun",ayahCount:11},{number:64,name:"At-Taghabun",ayahCount:18},{number:65,name:"At-Talaq",ayahCount:12},{number:66,name:"At-Tahrim",ayahCount:12},{number:67,name:"Al-Mulk",ayahCount:30},{number:68,name:"Al-Qalam",ayahCount:52},{number:69,name:"Al-Haqqah",ayahCount:52},{number:70,name:"Al-Ma'arij",ayahCount:44},{number:71,name:"Nuh",ayahCount:28},{number:72,name:"Al-Jinn",ayahCount:28},{number:73,name:"Al-Muzzammil",ayahCount:20},{number:74,name:"Al-Muddaththir",ayahCount:56},{number:75,name:"Al-Qiyamah",ayahCount:40},{number:76,name:"Al-Insan",ayahCount:31},{number:77,name:"Al-Mursalat",ayahCount:50},{number:78,name:"An-Naba",ayahCount:40},{number:79,name:"An-Nazi'at",ayahCount:46},{number:80,name:"Abasa",ayahCount:42},{number:81,name:"At-Takwir",ayahCount:29},{number:82,name:"Al-Infitar",ayahCount:19},{number:83,name:"Al-Mutaffifin",ayahCount:36},{number:84,name:"Al-Inshiqaq",ayahCount:25},{number:85,name:"Al-Buruj",ayahCount:22},{number:86,name:"At-Tariq",ayahCount:17},{number:87,name:"Al-A'la",ayahCount:19},{number:88,name:"Al-Ghashiyah",ayahCount:26},{number:89,name:"Al-Fajr",ayahCount:30},{number:90,name:"Al-Balad",ayahCount:20},{number:91,name:"Ash-Shams",ayahCount:15},{number:92,name:"Al-Lail",ayahCount:21},{number:93,name:"Ad-Duha",ayahCount:11},{number:94,name:"Ash-Sharh",ayahCount:8},{number:95,name:"At-Tin",ayahCount:8},{number:96,name:"Al-Alaq",ayahCount:19},{number:97,name:"Al-Qadr",ayahCount:5},{number:98,name:"Al-Bayyinah",ayahCount:8},{number:99,name:"Az-Zalzalah",ayahCount:8},{number:100,name:"Al-Adiyat",ayahCount:11},{number:101,name:"Al-Qari'ah",ayahCount:11},{number:102,name:"At-Takathur",ayahCount:8},{number:103,name:"Al-Asr",ayahCount:3},{number:104,name:"Al-Humazah",ayahCount:9},{number:105,name:"Al-Fil",ayahCount:5},{number:106,name:"Quraysh",ayahCount:4},{number:107,name:"Al-Ma'un",ayahCount:7},{number:108,name:"Al-Kawthar",ayahCount:3},{number:109,name:"Al-Kafirun",ayahCount:6},{number:110,name:"An-Nasr",ayahCount:3},{number:111,name:"Al-Masad",ayahCount:5},{number:112,name:"Al-Ikhlas",ayahCount:4},{number:113,name:"Al-Falaq",ayahCount:5},{number:114,name:"An-Nas",ayahCount:6}],g=["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"],h=new Map(f.map((a,b)=>[a.name.toLowerCase(),g[b]]));function i(a){return g[a.number-1]||a.name}function j(a){return h.get(String(a||"").toLowerCase())||a}function k(a){return e.some(b=>b.key===a)}async function l(){d??=m().catch(a=>{throw d=null,a}),await d}async function m(){await (0,b.execute)(`
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
  `),await (0,b.execute)(`
    CREATE TABLE IF NOT EXISTS nilai_harian_detail (
      id TEXT PRIMARY KEY,
      sesi_id TEXT NOT NULL REFERENCES nilai_harian_sesi(id) ON DELETE CASCADE,
      riwayat_pendidikan_id TEXT NOT NULL REFERENCES riwayat_pendidikan(id) ON DELETE CASCADE,
      nilai INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(sesi_id, riwayat_pendidikan_id)
    )
  `),await (0,b.execute)(`
    CREATE TABLE IF NOT EXISTS hafalan_paket (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jenis TEXT NOT NULL,
      nama TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(jenis, nama)
    )
  `),await (0,b.execute)(`
    CREATE TABLE IF NOT EXISTS hafalan_paket_marhalah (
      paket_id INTEGER NOT NULL REFERENCES hafalan_paket(id) ON DELETE CASCADE,
      marhalah_id INTEGER NOT NULL REFERENCES marhalah(id) ON DELETE CASCADE,
      jenis TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (paket_id, marhalah_id),
      UNIQUE(jenis, marhalah_id)
    )
  `),await (0,b.execute)(`
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
  `),await (0,b.execute)(`
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
  `),await (0,b.execute)(`
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
  `),await (0,b.execute)("CREATE INDEX IF NOT EXISTS idx_nilai_harian_sesi_kelas ON nilai_harian_sesi(kelas_id, mapel_id, tanggal)"),await (0,b.execute)("CREATE INDEX IF NOT EXISTS idx_nilai_harian_detail_sesi ON nilai_harian_detail(sesi_id)");try{await (0,b.execute)("ALTER TABLE hafalan_bab ADD COLUMN parent_id INTEGER REFERENCES hafalan_bab(id) ON DELETE CASCADE")}catch(a){if(!String(a?.message||"").toLowerCase().includes("duplicate column name"))throw a}try{await (0,b.execute)("ALTER TABLE hafalan_bab ADD COLUMN paket_id INTEGER REFERENCES hafalan_paket(id)")}catch(a){if(!String(a?.message||"").toLowerCase().includes("duplicate column name"))throw a}for(let a of["ALTER TABLE hafalan_progress ADD COLUMN santri_id TEXT REFERENCES santri(id)","ALTER TABLE hafalan_progress ADD COLUMN kelas_id TEXT REFERENCES kelas(id)","ALTER TABLE hafalan_progress ADD COLUMN marhalah_id INTEGER REFERENCES marhalah(id)"])try{await (0,b.execute)(a)}catch(a){if(!String(a?.message||"").toLowerCase().includes("duplicate column name"))throw a}await (0,b.execute)(`
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
  `),await (0,b.execute)(`
    INSERT OR IGNORE INTO hafalan_paket (jenis, nama)
    SELECT DISTINCT hb.jenis, COALESCE(m.nama, 'Marhalah ' || hb.marhalah_id)
    FROM hafalan_bab hb
    LEFT JOIN marhalah m ON m.id = hb.marhalah_id
    WHERE hb.paket_id IS NULL
  `),await (0,b.execute)(`
    INSERT OR IGNORE INTO hafalan_paket_marhalah (paket_id, marhalah_id, jenis)
    SELECT hp.id, hb.marhalah_id, hb.jenis
    FROM hafalan_bab hb
    JOIN marhalah m ON m.id = hb.marhalah_id
    JOIN hafalan_paket hp ON hp.jenis = hb.jenis AND hp.nama = m.nama
    WHERE hb.paket_id IS NULL
    GROUP BY hp.id, hb.marhalah_id, hb.jenis
  `),await (0,b.execute)(`
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
  `),await (0,b.execute)("CREATE INDEX IF NOT EXISTS idx_hafalan_paket_lookup ON hafalan_paket(jenis, is_active, nama)"),await (0,b.execute)("CREATE INDEX IF NOT EXISTS idx_hafalan_paket_marhalah_lookup ON hafalan_paket_marhalah(jenis, marhalah_id)"),await (0,b.execute)("CREATE INDEX IF NOT EXISTS idx_hafalan_bab_lookup ON hafalan_bab(jenis, marhalah_id, is_active, urutan)"),await (0,b.execute)("CREATE INDEX IF NOT EXISTS idx_hafalan_bab_paket ON hafalan_bab(paket_id, jenis, is_active, urutan)"),await (0,b.execute)("CREATE INDEX IF NOT EXISTS idx_hafalan_bab_parent ON hafalan_bab(parent_id)"),await (0,b.execute)("CREATE INDEX IF NOT EXISTS idx_hafalan_blok_bab ON hafalan_blok(bab_id, is_active, urutan)"),await (0,b.execute)("CREATE INDEX IF NOT EXISTS idx_hafalan_progress_riwayat ON hafalan_progress(riwayat_pendidikan_id)"),await (0,b.execute)("CREATE INDEX IF NOT EXISTS idx_hafalan_progress_santri ON hafalan_progress(santri_id, blok_id)"),await (0,b.execute)("CREATE INDEX IF NOT EXISTS idx_hafalan_progress_scope ON hafalan_progress(marhalah_id, kelas_id)"),await (0,b.execute)(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan, is_bottomnav, bottomnav_urutan)
    VALUES
      ('Akademik', 'Nilai Harian', '/dashboard/guru/nilai-harian', 'BookOpen', '["admin","sekpen","akademik","guru"]', 1, 8, 1, 3),
      ('Akademik', 'Hafalan', '/dashboard/guru/hafalan', 'ClipboardCheck', '["admin","sekpen","akademik","guru"]', 1, 9, 1, 4),
      ('Master Data', 'Master Hafalan', '/dashboard/master/hafalan', 'Database', '["admin"]', 1, 11, 0, 0)
  `)}async function n(a){if(!a)return null;let c=await (0,b.queryOne)("SELECT source_type, source_ref_id FROM users WHERE id = ?",[a.id]);if(c?.source_type!=="guru")return null;let d=Number(c.source_ref_id);return Number.isFinite(d)&&d>0?d:null}async function o(a){await l();let d=a??await (0,c.getSession)();if(!d)return[];if((0,c.isAdmin)(d)||(0,c.hasAnyRole)(d,["sekpen","akademik"]))return p(await (0,b.query)(`
      SELECT k.id, k.nama_kelas, k.marhalah_id, m.nama AS marhalah_nama,
             k.tahun_ajaran_id, ta.nama AS tahun_ajaran_nama
      FROM kelas k
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
      LEFT JOIN marhalah m ON m.id = k.marhalah_id
    `));let e=await n(d);return e?p(await (0,b.query)(`
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
  `,[e,e,e,e])):[]}function p(a){return[...a].sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}async function q(a,b){return!!a&&!!b&&(!!((0,c.isAdmin)(a)||(0,c.hasAnyRole)(a,["sekpen","akademik"]))||(await o(a)).some(a=>a.id===b))}async function r(a){let c=await (0,b.query)(`
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
  `,[a]);return c.length>0?c:(0,b.query)(`
    SELECT rp.id AS riwayat_id, s.id AS santri_id, s.nis, s.nama_lengkap AS nama
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.kelas_id = ?
      AND lower(trim(COALESCE(s.status_global, 'aktif'))) NOT IN ('arsip', 'alumni', 'keluar')
    ORDER BY s.nama_lengkap
  `,[a])}a.s(["HAFALAN_TYPES",0,e,"QURAN_SURAHS",0,f,"canAccessKelas",()=>q,"displayQuranSurahTitle",()=>j,"ensureGuruFeatureSchema",()=>l,"getAccessibleKelasForSession",()=>o,"getGuruIdForSession",()=>n,"getQuranSurahArabicName",()=>i,"getSantriForKelas",()=>r,"isHafalanType",()=>k])}];

//# sourceMappingURL=_3b2deb2f._.js.map