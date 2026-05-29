"use strict";exports.id=7364,exports.ids=[7364],exports.modules={10666:(a,b,c)=>{c.d(b,{Z:()=>e});var d=c(99829);let e=(0,d.createServerReference)("4048fb77ccd4516c94c408c2683b74e50befc89d0b",d.callServer,void 0,d.findSourceMapURL,"getSesiList")},44156:(a,b,c)=>{c.d(b,{P:()=>e});var d=c(99829);let e=(0,d.createServerReference)("0074bb16663b54cb3bac90a453cb0350f65ce781e6",d.callServer,void 0,d.findSourceMapURL,"getActiveEventLight")},45522:(a,b,c)=>{c.d(b,{SK:()=>m,Sm:()=>j,Y3:()=>f,eJ:()=>l,gk:()=>e,xn:()=>k});var d=c(44916);function e(a){return"P"===String(a||"").toUpperCase()?"P":"L"}function f(a){return"senior"===String(a||"").toLowerCase()?"senior":"junior"}function g(a){if(!Array.isArray(a))return[];let b=new Set;for(let c of a){let a=Number(c);Number.isInteger(a)&&a>0&&b.add(a)}return Array.from(b).sort((a,b)=>a-b)}function h(a){if(!a)return[];try{return g(JSON.parse(a))}catch{return g(a.split(",").map(a=>a.trim()).filter(Boolean))}}function i(a){return JSON.stringify(g(a))}async function j(){try{await (0,d.g7)("ALTER TABLE ehb_pengawas ADD COLUMN jenis_kelamin TEXT NOT NULL DEFAULT 'L'")}catch{}await (0,d.g7)(`
    CREATE TABLE IF NOT EXISTS ehb_pengawas_config (
      ehb_event_id                 INTEGER PRIMARY KEY REFERENCES ehb_event(id) ON DELETE CASCADE,
      senior_allowed_sesi          TEXT,
      senior_blocked_sesi          TEXT,
      senior_avoid_last_session    INTEGER NOT NULL DEFAULT 1,
      updated_at                   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)}async function k(a){var b;return await j(),(b=await (0,d.Zy)(`
    SELECT senior_allowed_sesi, senior_blocked_sesi, senior_avoid_last_session
    FROM ehb_pengawas_config
    WHERE ehb_event_id = ?
  `,[a]))?{senior_allowed_sesi:h(b.senior_allowed_sesi),senior_blocked_sesi:h(b.senior_blocked_sesi),senior_avoid_last_session:0!==b.senior_avoid_last_session}:{senior_allowed_sesi:[],senior_blocked_sesi:[],senior_avoid_last_session:!0}}async function l(a,b){await j();let c=await k(a),e={senior_allowed_sesi:g(b.senior_allowed_sesi??c.senior_allowed_sesi),senior_blocked_sesi:g(b.senior_blocked_sesi??c.senior_blocked_sesi),senior_avoid_last_session:"boolean"==typeof b.senior_avoid_last_session?b.senior_avoid_last_session:c.senior_avoid_last_session};return await (0,d.g7)(`
    INSERT INTO ehb_pengawas_config (
      ehb_event_id, senior_allowed_sesi, senior_blocked_sesi, senior_avoid_last_session, updated_at
    )
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(ehb_event_id) DO UPDATE SET
      senior_allowed_sesi = excluded.senior_allowed_sesi,
      senior_blocked_sesi = excluded.senior_blocked_sesi,
      senior_avoid_last_session = excluded.senior_avoid_last_session,
      updated_at = datetime('now')
  `,[a,i(e.senior_allowed_sesi),i(e.senior_blocked_sesi),+!!e.senior_avoid_last_session]),e}function m(a,b,c){return a.senior_allowed_sesi.length>0&&!a.senior_allowed_sesi.includes(b)?`Pengawas senior hanya boleh di sesi ${a.senior_allowed_sesi.join(", ")}.`:a.senior_blocked_sesi.includes(b)?`Pengawas senior tidak boleh diplot di sesi ${b}.`:a.senior_avoid_last_session&&c?"Pengawas senior tidak boleh diplot di sesi terakhir pada hari tersebut.":null}},87502:(a,b,c)=>{c.d(b,{$J:()=>z,HY:()=>v,I$:()=>n,PD:()=>j,QZ:()=>o,X0:()=>k,Yk:()=>p,ZD:()=>r,b$:()=>q,cd:()=>x,nK:()=>w,nP:()=>s,qX:()=>l,vX:()=>t,wP:()=>m,ww:()=>y});var d=c(95349),e=c(44916),f=c(46100),g=c(89773),h=c(42650),i=c(45522);async function j(){return(0,e.Zy)("SELECT id, nama FROM ehb_event WHERE is_active = 1 LIMIT 1")}async function k(a){await (0,i.Sm)();try{return await (0,e.P)(`
            SELECT p.*,
                (SELECT COUNT(*) FROM ehb_jadwal_pengawas jp WHERE jp.pengawas_id = p.id) as total_tugas
            FROM ehb_pengawas p
            WHERE p.ehb_event_id = ?
            ORDER BY p.nama_pengawas
        `,[a])}catch(a){return console.error("DB ERROR in getPengawasList:",a.message),{__error:"getPengawasList: "+a.message}}}async function l(){try{return await (0,e.P)("SELECT id, nama_lengkap as nama FROM data_guru ORDER BY nama_lengkap")}catch(a){return console.error("DB ERROR in getGuruList:",a.message),{__error:"getGuruList: "+a.message}}}async function m(){try{return await (0,e.P)(`
            SELECT id, nama_lengkap as nama, nis, asrama, kamar, jenis_kelamin
            FROM santri
            WHERE status_global = 'aktif'
              AND kategori_santri = 'SADESA'
            ORDER BY nama_lengkap
        `)}catch(a){return console.error("DB ERROR in getSadesaList:",a.message),{__error:"getSadesaList: "+a.message}}}async function n(a,b){await (0,i.Sm)();let c=await (0,f.Ht)();if(!c)return{error:"Unauthorized"};if(0===b.length)return{error:"Data kosong"};let d=b.map(b=>({sql:"INSERT INTO ehb_pengawas (ehb_event_id, guru_id, nama_pengawas, tag, jenis_kelamin) VALUES (?, ?, ?, ?, ?)",params:[a,b.guru_id||null,b.nama_pengawas,(0,i.Y3)(b.tag),(0,i.gk)(b.jenis_kelamin)]}));return await (0,e.vA)(d),await (0,g.Mx)({actor:(0,g.CF)(c),module:"ehb_pengawas",action:"create",fiturHref:"/dashboard/ehb/pengawas",logKind:"create",entityType:"ehb_pengawas_batch",entityId:String(a),entityLabel:"Pengawas EHB",summary:`Menambahkan ${b.length} pengawas EHB`,details:{event_id:a,total_pengawas:b.length}}),(0,h.revalidatePath)("/dashboard/ehb/pengawas"),{success:!0}}async function o(a,b){await (0,i.Sm)();let c=await (0,f.Ht)();return c?(await (0,e.g7)("UPDATE ehb_pengawas SET nama_pengawas = ?, tag = ?, jenis_kelamin = ? WHERE id = ?",[b.nama_pengawas,(0,i.Y3)(b.tag),(0,i.gk)(b.jenis_kelamin),a]),await (0,g.Mx)({actor:(0,g.CF)(c),module:"ehb_pengawas",action:"update",fiturHref:"/dashboard/ehb/pengawas",logKind:"update",entityType:"ehb_pengawas",entityId:String(a),entityLabel:b.nama_pengawas,summary:`Memperbarui pengawas ${b.nama_pengawas}`,details:{tag:(0,i.Y3)(b.tag),jenis_kelamin:(0,i.gk)(b.jenis_kelamin)}}),(0,h.revalidatePath)("/dashboard/ehb/pengawas"),{success:!0}):{error:"Unauthorized"}}async function p(a){await (0,i.Sm)();let b=await (0,f.Ht)();if(!b)return{error:"Unauthorized"};let c=await (0,e.Zy)("SELECT nama_pengawas FROM ehb_pengawas WHERE id = ?",[a]);return await (0,e.g7)("DELETE FROM ehb_jadwal_pengawas WHERE pengawas_id = ?",[a]),await (0,e.g7)("DELETE FROM ehb_pengawas WHERE id = ?",[a]),await (0,g.Mx)({actor:(0,g.CF)(b),module:"ehb_pengawas",action:"delete",fiturHref:"/dashboard/ehb/pengawas",logKind:"delete",entityType:"ehb_pengawas",entityId:String(a),entityLabel:c?.nama_pengawas??`Pengawas ${a}`,summary:`Menghapus pengawas ${c?.nama_pengawas??a}`}),(0,h.revalidatePath)("/dashboard/ehb/pengawas"),{success:!0}}async function q(a){return await (0,i.Sm)(),(0,e.P)(`
        SELECT jp.*, p.nama_pengawas, p.tag, p.jenis_kelamin as pengawas_jenis_kelamin, r.nomor_ruangan, r.nama_ruangan, r.jenis_kelamin,
               s.nomor_sesi, s.label as sesi_label, s.jam_group
        FROM ehb_jadwal_pengawas jp
        JOIN ehb_pengawas p ON p.id = jp.pengawas_id
        JOIN ehb_ruangan r ON r.id = jp.ruangan_id
        JOIN ehb_sesi s ON s.id = jp.sesi_id
        WHERE jp.ehb_event_id = ?
        ORDER BY jp.tanggal, s.nomor_sesi, r.nomor_ruangan
    `,[a])}async function r(a){return(0,e.P)("SELECT * FROM ehb_sesi WHERE ehb_event_id = ? ORDER BY nomor_sesi",[a])}async function s(a){return(await (0,e.P)("SELECT DISTINCT tanggal FROM ehb_jadwal WHERE ehb_event_id = ? ORDER BY tanggal",[a])).map(a=>a.tanggal)}async function t(a){return(0,e.P)("SELECT * FROM ehb_ruangan WHERE ehb_event_id = ? ORDER BY nomor_ruangan",[a])}async function u(a,b){let c=await (0,e.Zy)(`
        SELECT MAX(s.nomor_sesi) as max_sesi
        FROM ehb_jadwal j
        JOIN ehb_sesi s ON s.id = j.sesi_id
        WHERE j.ehb_event_id = ? AND j.tanggal = ?
    `,[a,b]);return Number(c?.max_sesi||0)}async function v(a,b,c,d,j,k){await (0,i.Sm)();let l=await (0,f.Ht)();if(!l)return{error:"Unauthorized"};let m=await (0,e.Zy)(`
        SELECT
            p.nama_pengawas,
            p.tag,
            p.jenis_kelamin as pengawas_jenis_kelamin,
            r.jenis_kelamin as ruangan_jenis_kelamin,
            s.nomor_sesi
        FROM ehb_pengawas p
        JOIN ehb_ruangan r ON r.id = ?
        JOIN ehb_sesi s ON s.id = ?
        WHERE p.id = ?
    `,[d,k,c]);if(!m)return{error:"Data pengawas, ruangan, atau sesi tidak ditemukan."};let n=(0,i.gk)(m.pengawas_jenis_kelamin),o=(0,i.gk)(m.ruangan_jenis_kelamin);if("P"===n&&"P"!==o)return{error:"Pengawas perempuan hanya boleh diplot di ruangan perempuan."};if("senior"===(0,i.Y3)(m.tag)){let b=await u(a,j),c=await (0,i.xn)(a),d=(0,i.SK)(c,m.nomor_sesi,b>0&&m.nomor_sesi===b);if(d)return{error:d}}try{return b?await (0,e.g7)("UPDATE ehb_jadwal_pengawas SET pengawas_id = ? WHERE id = ?",[c,b]):await (0,e.g7)(`
                INSERT INTO ehb_jadwal_pengawas (ehb_event_id, pengawas_id, ruangan_id, tanggal, sesi_id)
                VALUES (?, ?, ?, ?, ?)
            `,[a,c,d,j,k]),await (0,g.Mx)({actor:(0,g.CF)(l),module:"ehb_pengawas",action:b?"update":"create",fiturHref:"/dashboard/ehb/pengawas",logKind:b?"update":"create",entityType:"ehb_jadwal_pengawas",entityId:b?String(b):`${a}:${c}:${d}:${j}:${k}`,entityLabel:"Jadwal pengawas EHB",summary:`${b?"Memperbarui":"Menambahkan"} jadwal pengawas manual`,details:{event_id:a,pengawas_id:c,ruangan_id:d,tanggal:j,sesi_id:k}}),(0,h.revalidatePath)("/dashboard/ehb/pengawas"),{success:!0}}catch(a){if(a.message?.includes("UNIQUE"))return{error:"Pengawas ini sudah bertugas di sesi yang sama, atau ruangan sudah terisi."};return{error:a.message}}}async function w(a){await (0,i.Sm)();let b=await (0,f.Ht)();return b?(await (0,e.g7)("DELETE FROM ehb_jadwal_pengawas WHERE id = ?",[a]),await (0,g.Mx)({actor:(0,g.CF)(b),module:"ehb_pengawas",action:"delete",fiturHref:"/dashboard/ehb/pengawas",logKind:"delete",entityType:"ehb_jadwal_pengawas",entityId:String(a),entityLabel:"Jadwal pengawas EHB",summary:"Menghapus jadwal pengawas manual"}),(0,h.revalidatePath)("/dashboard/ehb/pengawas"),{success:!0}):{error:"Unauthorized"}}async function x(a,b){await (0,i.Sm)();let c=await (0,e.Zy)("SELECT * FROM ehb_pengawas WHERE id = ?",[b]);return c?{pengawas:c,tugas:await (0,e.P)(`
        SELECT jp.tanggal, s.label as sesi_label, s.waktu_mulai, s.waktu_selesai, r.nomor_ruangan, r.jenis_kelamin
        FROM ehb_jadwal_pengawas jp
        JOIN ehb_sesi s ON s.id = jp.sesi_id
        JOIN ehb_ruangan r ON r.id = jp.ruangan_id
        WHERE jp.pengawas_id = ?
        ORDER BY jp.tanggal, s.nomor_sesi
    `,[b])}:null}async function y(a){return(0,i.xn)(a)}async function z(a,b){await (0,i.Sm)();let c=await (0,f.Ht)();if(!c)return{error:"Unauthorized"};let d=await (0,i.eJ)(a,b);return await (0,g.Mx)({actor:(0,g.CF)(c),module:"ehb_pengawas",action:"update",fiturHref:"/dashboard/ehb/pengawas",logKind:"update",entityType:"ehb_pengawas_config",entityId:String(a),entityLabel:"Rule senior pengawas EHB",summary:"Memperbarui rule pengawas senior EHB",details:d}),(0,h.revalidatePath)("/dashboard/ehb/pengawas"),(0,h.revalidatePath)("/dashboard/ehb/pengawas/plotting"),{success:!0,config:d}}(0,c(89337).D)([j,k,l,m,n,o,p,q,r,s,t,v,w,x,y,z]),(0,d.A)(j,"0074bb16663b54cb3bac90a453cb0350f65ce781e6",null),(0,d.A)(k,"403ee453b6affdc39f4a4e37cd17cc25436a1165ae",null),(0,d.A)(l,"005053851c6f11fd9623f89274ca56428c3e076f5a",null),(0,d.A)(m,"0094d1c84c6a5a6c7075756c75e0b576cdec5e0790",null),(0,d.A)(n,"60bb262846b75e3d4e56a5ad27e9ab5cd69aaf53cf",null),(0,d.A)(o,"606d1f205426eb55e21145315b2de1b3f107accbcd",null),(0,d.A)(p,"400ea7a38d3f5965675025ee667682996837b596bd",null),(0,d.A)(q,"40e295e0388465b7b548e8b318d82c930a50f59367",null),(0,d.A)(r,"4048fb77ccd4516c94c408c2683b74e50befc89d0b",null),(0,d.A)(s,"40a3da288a3d21fcf408b701cb9501571cfa264dd3",null),(0,d.A)(t,"4043262f4cbc3cb4dc571d7bd261d5494be9a8248e",null),(0,d.A)(v,"7e2eeec25bb13278ccbced47629ab8a12388bb74e9",null),(0,d.A)(w,"40c2d70fcf0a30a47bcd373dcd89efee05f0d01fc2",null),(0,d.A)(x,"60cb68f60c92c58a7fc4e8863de9a4183fdc0838e8",null),(0,d.A)(y,"40f39b5d25c85dccb86660c43554dbb37dc4e9e426",null),(0,d.A)(z,"60dc66068ded4b60c132a58a73f71e754a535c2512",null)}};