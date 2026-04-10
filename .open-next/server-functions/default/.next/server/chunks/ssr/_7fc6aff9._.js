module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"005289e5d664eb30fe22168a654a1891fa9b9f59a3",null),a.s(["signOut",()=>f])},13750,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058);async function f(){let a=await (0,e.getSession)();if(!a)return{role:"guest",filter:null};let b=a.role;if("pengurus_asrama"===b)return{role:b,type:"ASRAMA",value:a.asrama_binaan};if("wali_kelas"===b){let c=await (0,d.queryOne)("SELECT id FROM kelas WHERE wali_kelas_id = ?",[a.id]);return{role:b,type:"KELAS",value:c?.id}}return{role:b,type:"GLOBAL",value:null}}async function g(a,b,c,e){let g=await f(),h=`
    SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
           rp.id AS riwayat_id,
           k.nama_kelas
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    WHERE s.status_global = 'aktif'
  `,i=[];if("ASRAMA"===g.type){if(!g.value)return[];h+=" AND s.asrama = ?",i.push(g.value)}else if("KELAS"===g.type){if(!g.value)return[];h+=" AND rp.kelas_id = ?",i.push(g.value)}b&&"ASRAMA"!==g.type&&(h+=" AND s.asrama = ?",i.push(b)),e&&(h+=" AND s.kamar = ?",i.push(e)),c&&"KELAS"!==g.type&&(h+=" AND rp.kelas_id = ?",i.push(c)),a&&(h+=" AND s.nama_lengkap LIKE ?",i.push(`%${a}%`)),h+=" ORDER BY s.nama_lengkap LIMIT 100";let j=await (0,d.query)(h,i);if(!j.length)return[];let k=j.map(a=>a.riwayat_id),l=k.map(()=>"?").join(","),m=await (0,d.query)(`
    SELECT riwayat_pendidikan_id, shubuh, ashar, maghrib
    FROM absensi_harian
    WHERE riwayat_pendidikan_id IN (${l})
      AND (shubuh != 'H' OR ashar != 'H' OR maghrib != 'H')
  `,k);return j.map(a=>{let b=m.filter(b=>b.riwayat_pendidikan_id===a.riwayat_id),c=0,d=0,e=0;return b.forEach(a=>{"S"===a.shubuh&&c++,"I"===a.shubuh&&d++,"A"===a.shubuh&&e++,"S"===a.ashar&&c++,"I"===a.ashar&&d++,"A"===a.ashar&&e++,"S"===a.maghrib&&c++,"I"===a.maghrib&&d++,"A"===a.maghrib&&e++}),{id:a.id,nama:a.nama_lengkap,nis:a.nis,info_asrama:`${a.asrama||"-"} - Kamar ${a.kamar||"-"}`,info_kelas:a.nama_kelas||"-",total_s:c,total_i:d,total_a:e,total_masalah:c+d+e}}).sort((a,b)=>b.total_a-a.total_a)}async function h(a){let b=await (0,d.queryOne)("SELECT id FROM riwayat_pendidikan WHERE santri_id = ? AND status_riwayat = 'aktif'",[a]);return b?(0,d.query)(`
    SELECT tanggal, shubuh, ashar, maghrib
    FROM absensi_harian
    WHERE riwayat_pendidikan_id = ?
      AND (shubuh != 'H' OR ashar != 'H' OR maghrib != 'H')
    ORDER BY tanggal DESC
  `,[b.id]):[]}async function i(){return{kelas:(await (0,d.query)("SELECT id, nama_kelas FROM kelas")).sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}}(0,a.i(13095).ensureServerEntryExports)([f,g,h,i]),(0,c.registerServerReference)(f,"0014da9c74422a6bef477eac5945ba8f55a39b8feb",null),(0,c.registerServerReference)(g,"78026a46a4e09c896abd3ba1f7b605be7d3c47a027",null),(0,c.registerServerReference)(h,"4007b802e7e6ec6beab8b439c4ff4fb817a4c78f0a",null),(0,c.registerServerReference)(i,"00a4d16884b5c7a85060e3f688bd644cb2cd08172d",null),a.s([],24719),a.i(24719),a.s(["0014da9c74422a6bef477eac5945ba8f55a39b8feb",()=>f,"005289e5d664eb30fe22168a654a1891fa9b9f59a3",()=>b.signOut,"00a4d16884b5c7a85060e3f688bd644cb2cd08172d",()=>i,"4007b802e7e6ec6beab8b439c4ff4fb817a4c78f0a",()=>h,"78026a46a4e09c896abd3ba1f7b605be7d3c47a027",()=>g],13750)}];

//# sourceMappingURL=_7fc6aff9._.js.map