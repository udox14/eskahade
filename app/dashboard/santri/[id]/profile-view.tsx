'use client'

import { useState } from 'react'
import { User, MapPin, Calendar, School, Home, BookOpen, AlertTriangle, Clock, CreditCard, Wallet, Trophy, CheckCircle, XCircle, AlertCircle, Users, Utensils, Shirt } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

// Pastikan export function (Named Export)
export function SantriProfileView({ 
  santri, 
  akademik, 
  pelanggaran, 
  perizinan, 
  spp, 
  tabungan 
}: any) {
  const [activeTab, setActiveTab] = useState<'PROFIL' | 'AKADEMIK' | 'KEUANGAN' | 'DISIPLIN'>('PROFIL')

  return (
    <div className="space-y-6">
      
      {/* 1. KARTU IDENTITAS UTAMA */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden relative">
         <div className="h-32 bg-gradient-to-r from-green-600 to-emerald-800"></div>
         <div className="px-8 pb-8">
            <div className="flex flex-col md:flex-row gap-6 items-start -mt-12">
               
               {/* FOTO PROFIL (FIX: Portrait & Rounded Corners) */}
               {/* Mengganti rounded-full menjadi rounded-xl dan menyesuaikan tinggi agar portrait */}
               <div className="w-32 h-40 md:w-40 md:h-52 rounded-xl border-4 border-white shadow-lg bg-gray-200 overflow-hidden flex-shrink-0 relative">
                  {santri.foto_url ? (
                    <img src={santri.foto_url} alt={santri.nama_lengkap} className="w-full h-full object-cover"/>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100"><User className="w-16 h-16 opacity-50"/></div>
                  )}
               </div>

               {/* INFO NAMA */}
               <div className="flex-1 pt-2 md:pt-14">
                  <h2 className="text-3xl font-bold text-gray-900">{santri.nama_lengkap}</h2>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm">
                      <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium border border-blue-100 font-mono">NIS: {santri.nis}</span>
                      <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium border border-green-100">{santri.info_kelas}</span>
                      <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium border border-gray-200">{santri.asrama} - {santri.kamar}</span>
                  </div>
               </div>
            </div>
         </div>

         {/* TAB NAVIGATION */}
         <div className="flex border-t px-8 overflow-x-auto scrollbar-hide">
            <TabButton active={activeTab==='PROFIL'} onClick={()=>setActiveTab('PROFIL')} icon={User} label="Biodata Lengkap" />
            <TabButton active={activeTab==='AKADEMIK'} onClick={()=>setActiveTab('AKADEMIK')} icon={BookOpen} label="Akademik" />
            <TabButton active={activeTab==='KEUANGAN'} onClick={()=>setActiveTab('KEUANGAN')} icon={CreditCard} label="Keuangan" />
            <TabButton active={activeTab==='DISIPLIN'} onClick={()=>setActiveTab('DISIPLIN')} icon={AlertTriangle} label="Kedisiplinan" />
         </div>
      </div>

      {/* 2. KONTEN TABS */}
      
      {/* --- TAB PROFIL (LENGKAP) --- */}
      {activeTab === 'PROFIL' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
           
           {/* KOLOM 1: DATA PRIBADI */}
           <div className="bg-white p-6 rounded-xl border shadow-sm space-y-5">
              <h3 className="font-bold text-gray-800 border-b pb-3 flex items-center gap-2 text-lg">
                <User className="w-5 h-5 text-blue-600"/> Informasi Pribadi
              </h3>
              
              <div className="space-y-4">
                <InfoRow label="NIS (Nomor Induk Santri)" value={santri.nis} isMono />
                <InfoRow label="NIK" value={santri.nik} isMono />
                <InfoRow label="Nama Lengkap" value={santri.nama_lengkap} isBold />
                <InfoRow label="Jenis Kelamin" value={santri.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} />
                <InfoRow 
                    label="Tempat, Tanggal Lahir" 
                    value={`${santri.tempat_lahir || '-'}, ${santri.tanggal_lahir ? format(new Date(santri.tanggal_lahir), 'dd MMMM yyyy', {locale:id}) : '-'}`} 
                />
                <div className="pt-2">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Alamat Lengkap</p>
                    <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100 leading-relaxed">
                        {santri.alamat || 'Alamat belum diisi.'}
                    </p>
                </div>
                <InfoRow 
                    label="Status Santri" 
                    value={
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${santri.status_global === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {santri.status_global?.toUpperCase()}
                        </span>
                    } 
                    isCustom 
                />
                <InfoRow label="Tahun Masuk" value={santri.tahun_masuk} />
              </div>
           </div>

           {/* KOLOM 2: KELUARGA & PONDOK */}
           <div className="bg-white p-6 rounded-xl border shadow-sm space-y-5">
              <h3 className="font-bold text-gray-800 border-b pb-3 flex items-center gap-2 text-lg">
                <School className="w-5 h-5 text-green-600"/> Keluarga & Institusi
              </h3>
              
              <div className="space-y-4">
                 <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 space-y-3">
                    <p className="text-xs font-bold text-orange-800 uppercase flex items-center gap-2"><Users className="w-4 h-4"/> Data Orang Tua</p>
                    <InfoRow label="Nama Ayah" value={santri.nama_ayah} />
                    <InfoRow label="Nama Ibu" value={santri.nama_ibu} />
                 </div>

                 <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">
                    <p className="text-xs font-bold text-blue-800 uppercase flex items-center gap-2"><School className="w-4 h-4"/> Pendidikan Formal</p>
                    <InfoRow label="Sekolah" value={santri.sekolah} />
                    <InfoRow label="Kelas Sekolah" value={santri.kelas_sekolah} />
                 </div>

                 <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 space-y-3">
                    <p className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-2"><Home className="w-4 h-4"/> Data Pondok</p>
                    <InfoRow label="Asrama" value={santri.asrama} />
                    <InfoRow label="Kamar" value={santri.kamar} />
                    <InfoRow label="Kelas Diniyah" value={santri.info_kelas} isBold />
                    
                    {/* INFO KATERING & LAUNDRY YANG BARU DITAMBAHKAN */}
                    <div className="pt-2 mt-2 border-t border-emerald-100 space-y-3">
                        <InfoRow 
                            label={<span className="flex items-center gap-1.5"><Utensils className="w-3.5 h-3.5"/> Tempat Makan</span>} 
                            value={santri.nama_tempat_makan || 'Belum diatur'} 
                        />
                        <InfoRow 
                            label={<span className="flex items-center gap-1.5"><Shirt className="w-3.5 h-3.5"/> Tempat Cuci</span>} 
                            value={santri.nama_tempat_mencuci || 'Belum diatur'} 
                        />
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* --- TAB AKADEMIK --- */}
      {activeTab === 'AKADEMIK' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
           {akademik.length === 0 ? <EmptyState text="Belum ada riwayat pendidikan."/> : akademik.map((riwayat: any) => (
             <div key={riwayat.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="bg-blue-50 p-4 border-b border-blue-100 flex justify-between items-center">
                   <div>
                      <h3 className="font-bold text-blue-900 text-lg">{riwayat.kelas?.nama_kelas}</h3>
                      <p className="text-xs text-blue-600 font-medium">{riwayat.kelas?.marhalah?.nama} • {riwayat.kelas?.tahun_ajaran?.nama || 'Tahun Ajar Aktif'}</p>
                   </div>
                   {riwayat.ranking?.[0] && (
                     <div className="text-right bg-white px-3 py-1 rounded-lg border border-blue-100 shadow-sm">
                        <span className="text-sm font-bold text-orange-600 flex items-center gap-1 justify-end"><Trophy className="w-4 h-4"/> Rank {riwayat.ranking[0].ranking_kelas}</span>
                        <span className="text-xs text-gray-500 block">Rata-rata: {riwayat.ranking[0].rata_rata}</span>
                     </div>
                   )}
                </div>
                
                {/* Tabel Nilai */}
                {riwayat.nilai_detail.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                       <thead className="bg-gray-50 text-gray-600 font-bold border-b"><tr><th className="p-3 pl-6">Mata Pelajaran</th><th className="p-3 w-32 text-center">Semester 1</th><th className="p-3 w-32 text-center">Semester 2</th></tr></thead>
                       <tbody className="divide-y">
                          {/* Grouping nilai per mapel */}
                          {Array.from(new Set(riwayat.nilai_detail.map((n:any) => n.mapel?.nama))).map((mapelNama: any) => {
                              const s1 = riwayat.nilai_detail.find((n:any) => n.mapel?.nama === mapelNama && n.semester === 1)?.nilai
                              const s2 = riwayat.nilai_detail.find((n:any) => n.mapel?.nama === mapelNama && n.semester === 2)?.nilai
                              return (
                                <tr key={mapelNama} className="hover:bg-gray-50">
                                    <td className="p-3 pl-6 font-medium text-gray-700">{mapelNama}</td>
                                    <td className="p-3 text-center font-mono">{s1 || '-'}</td>
                                    <td className="p-3 text-center font-mono">{s2 || '-'}</td>
                                </tr>
                              )
                          })}
                       </tbody>
                    </table>
                  </div>
                ) : <div className="p-8 text-center text-gray-400 text-sm italic">Belum ada data nilai di kelas ini.</div>}
             </div>
           ))}
        </div>
      )}

      {/* --- TAB KEUANGAN --- */}
      {activeTab === 'KEUANGAN' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
           {/* SPP */}
           <div className="bg-white rounded-xl border shadow-sm overflow-hidden h-fit">
              <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex justify-between items-center">
                  <h3 className="font-bold text-emerald-900 flex items-center gap-2"><CreditCard className="w-5 h-5"/> Riwayat SPP</h3>
                  <span className="text-xs bg-white text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">{spp.length} Transaksi</span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {spp.length === 0 ? <EmptyState text="Belum ada pembayaran SPP."/> : (
                  <table className="w-full text-sm text-left">
                     <thead className="bg-gray-50 font-bold text-gray-600 sticky top-0"><tr><th className="p-3">Periode</th><th className="p-3 text-right">Nominal</th><th className="p-3 text-right">Tgl Bayar</th></tr></thead>
                     <tbody className="divide-y">
                        {spp.map((s:any) => (
                           <tr key={s.id} className="hover:bg-gray-50">
                              <td className="p-3 font-medium text-gray-800">{s.bulan}/{s.tahun}</td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-600">Rp {s.nominal_bayar.toLocaleString()}</td>
                              <td className="p-3 text-right text-xs text-gray-500">{format(new Date(s.tanggal_bayar), 'dd/MM/yy', {locale:id})}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
                )}
              </div>
           </div>

           {/* TABUNGAN */}
           <div className="bg-white rounded-xl border shadow-sm overflow-hidden h-fit">
              <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center">
                  <h3 className="font-bold text-orange-900 flex items-center gap-2"><Wallet className="w-5 h-5"/> Mutasi Tabungan</h3>
                  <span className="text-xs bg-white text-orange-700 px-2 py-0.5 rounded font-bold border border-orange-200">{tabungan.length} Mutasi</span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {tabungan.length === 0 ? <EmptyState text="Belum ada transaksi tabungan."/> : (
                  <table className="w-full text-sm text-left">
                     <thead className="bg-gray-50 font-bold text-gray-600 sticky top-0"><tr><th className="p-3">Ket</th><th className="p-3 text-right">Nominal</th><th className="p-3 text-right">Tgl</th></tr></thead>
                     <tbody className="divide-y">
                        {tabungan.map((t:any) => (
                           <tr key={t.id} className="hover:bg-gray-50">
                              <td className="p-3 flex items-center gap-2">
                                 {t.jenis==='MASUK'?<CheckCircle className="w-4 h-4 text-green-500"/>:<XCircle className="w-4 h-4 text-red-500"/>}
                                 <span className="truncate max-w-[120px]">{t.keterangan}</span>
                              </td>
                              <td className={`p-3 text-right font-mono font-bold ${t.jenis==='MASUK'?'text-green-600':'text-red-600'}`}>
                                 {t.jenis==='MASUK'?'+':'-'} {t.nominal.toLocaleString()}
                              </td>
                              <td className="p-3 text-right text-xs text-gray-500">{format(new Date(t.created_at), 'dd/MM', {locale:id})}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
                )}
              </div>
           </div>
        </div>
      )}

      {/* --- TAB DISIPLIN --- */}
      {activeTab === 'DISIPLIN' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
           {/* PERIZINAN */}
           <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="bg-purple-50 p-4 border-b border-purple-100"><h3 className="font-bold text-purple-900 flex items-center gap-2"><Clock className="w-5 h-5"/> Riwayat Izin</h3></div>
              <div className="divide-y max-h-80 overflow-y-auto">
                 {perizinan.length===0?<EmptyState text="Belum ada riwayat izin."/>:perizinan.map((p:any)=>(
                    <div key={p.id} className="p-4 hover:bg-gray-50 transition-colors">
                       <div className="flex justify-between mb-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${p.status==='KEMBALI'?'bg-green-50 text-green-700 border-green-200':'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>{p.status}</span>
                          <span className="text-xs text-gray-500">{format(new Date(p.created_at), 'dd MMM yyyy', {locale:id})}</span>
                       </div>
                       <p className="font-medium text-gray-800 text-sm mb-1">{p.alasan}</p>
                       <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3"/> {p.jenis}</p>
                    </div>
                 ))}
              </div>
           </div>
           
           {/* PELANGGARAN */}
           <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="bg-red-50 p-4 border-b border-red-100"><h3 className="font-bold text-red-900 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Riwayat Pelanggaran</h3></div>
              <div className="divide-y max-h-80 overflow-y-auto">
                 {pelanggaran.length===0?<EmptyState text="Alhamdulillah, nihil pelanggaran."/>:pelanggaran.map((p:any)=>(
                    <div key={p.id} className="p-4 hover:bg-gray-50 transition-colors">
                       <div className="flex justify-between mb-2">
                          <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100 text-xs">+{p.poin} Poin</span>
                          <span className="text-xs text-gray-500">{format(new Date(p.tanggal), 'dd MMM yyyy', {locale:id})}</span>
                       </div>
                       <p className="font-medium text-gray-800 text-sm mb-1">{p.deskripsi}</p>
                       <p className="text-xs text-gray-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {p.jenis}</p>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
    return (
        <button onClick={onClick} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap outline-none ${active ? 'border-green-600 text-green-700 bg-green-50/30' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            <Icon className={`w-4 h-4 ${active ? 'text-green-600' : 'text-gray-400'}`}/> {label}
        </button>
    )
}

function InfoRow({ label, value, isBold, isMono, isCustom }: any) {
    if (isCustom) {
        return <div className="flex justify-between border-b border-gray-100 pb-2 last:border-0"><span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{label}</span>{value}</div>
    }
    return <div className="flex justify-between border-b border-gray-100 pb-2 last:border-0"><span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{label}</span><span className={`text-sm text-gray-900 text-right ${isBold ? 'font-bold' : 'font-medium'} ${isMono ? 'font-mono' : ''}`}>{value || '-'}</span></div>
}

function EmptyState({ text }: any) {
    return <div className="p-10 text-center text-gray-400 italic text-sm border-2 border-dashed border-gray-100 rounded-lg m-4">{text}</div>
}