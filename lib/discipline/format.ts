export function incidentLabel(jenis:string) {
 const labels:Record<string,string>={ALFA_PENGAJIAN:'Alfa Pengajian',ALFA_BERJAMAAH:'Alfa Berjamaah',RINGAN:'Ringan',SEDANG:'Sedang',BERAT:'Berat'}
 return labels[jenis]??jenis
}
export function sessionLabel(sesi:string,jenis:string,source:string) {
 if(sesi==='maghrib'&&(source==='pengajian'||jenis==='ALFA_PENGAJIAN'))return 'Malam'
 return sesi.charAt(0).toUpperCase()+sesi.slice(1)
}
