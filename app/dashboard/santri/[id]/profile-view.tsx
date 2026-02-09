'use client'
import { useState } from 'react'
import { getRiwayatAkademik, getRiwayatPelanggaran, getRiwayatPerizinan, getRiwayatSPP } from './actions'
import { User, BookOpen, ShieldAlert, Loader2, ChevronDown, ChevronRight, Home, School, MapPin, Clock, CreditCard, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

const BULAN_LIST = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

export function SantriProfileView({ santri }: { santri: any }) {
  // Tambah tab 'keuangan'
  const [activeTab, setActiveTab] = useState<'biodata' | 'akademik' | 'keamanan' | 'izin' | 'keuangan'>('biodata')
  
  const [dataAkademik, setDataAkademik] = useState<any[] | null>(null)
  const [dataPelanggaran, setDataPelanggaran] = useState<any[] | null>(null)
  const [dataIzin, setDataIzin] = useState<any[] | null>(null)
  const [dataSPP, setDataSPP] = useState<any[] | null>(null) // State Baru
  const [loading, setLoading] = useState(false)

  const loadAkademik = async () => {
    if (dataAkademik) return
    setLoading(true)
    const res = await getRiwayatAkademik(santri.id)
    setDataAkademik(res)
    setLoading(false)
  }

  const loadPelanggaran = async () => {
    if (dataPelanggaran) return
    setLoading(true)
    const res = await getRiwayatPelanggaran(santri.id)
    setDataPelanggaran(res)
    setLoading(false)
  }

  const loadIzin = async () => {
    if (dataIzin) return
    setLoading(true)
    const res = await getRiwayatPerizinan(santri.id)
    setDataIzin(res)
    setLoading(false)
  }

  const loadKeuangan = async () => {
    if (dataSPP) return
    setLoading(true)
    const res = await getRiwayatSPP(santri.id)
    setDataSPP(res)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* TABS NAVIGATION */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2 shadow-sm overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('biodata')} className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'biodata' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <User className="w-4 h-4" /> Biodata
        </button>
        <button onClick={() => { setActiveTab('akademik'); loadAkademik(); }} className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'akademik' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <BookOpen className="w-4 h-4" /> Akademik
        </button>
        <button onClick={() => { setActiveTab('keamanan'); loadPelanggaran(); }} className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'keamanan' ? 'border-red-600 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <ShieldAlert className="w-4 h-4" /> Kedisiplinan
        </button>
        <button onClick={() => { setActiveTab('izin'); loadIzin(); }} className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'izin' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <MapPin className="w-4 h-4" /> Izin
        </button>
        <button onClick={() => { setActiveTab('keuangan'); loadKeuangan(); }} className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'keuangan' ? 'border-orange-600 text-orange-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <CreditCard className="w-4 h-4" /> Keuangan
        </button>
      </div>

      {/* CONTENT AREA */}
      <div className="bg-white p-6 rounded-b-xl rounded-tr-xl border shadow-sm min-h-[400px]">
        
        {/* --- TAB 1: BIODATA --- */}
        {activeTab === 'biodata' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
              <User className="w-5 h-5 text-green-600"/> Identitas Santri
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-5">
                <InfoRow label="NIS / NIK" value={`${santri.nis} / ${santri.nik || '-'}`} />
                <InfoRow label="Nama Lengkap" value={santri.nama_lengkap} isBold />
                <InfoRow label="Jenis Kelamin" value={santri.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} />
                <InfoRow label="TTL" value={`${santri.tempat_lahir || ''}, ${santri.tanggal_lahir || ''}`} />
                <InfoRow label="Orang Tua" value={`Ayah: ${santri.nama_ayah} | Ibu: ${santri.nama_ibu || '-'}`} />
              </div>
              
              <div className="space-y-5">
                <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                  <h4 className="text-xs font-bold text-green-700 uppercase mb-2 flex items-center gap-1"><Home className="w-3 h-3"/> Asrama</h4>
                  <p className="text-sm font-medium text-gray-800">
                    {santri.asrama ? `${santri.asrama} - Kamar ${santri.kamar || '?'}` : '-'}
                  </p>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <h4 className="text-xs font-bold text-blue-700 uppercase mb-2 flex items-center gap-1"><School className="w-3 h-3"/> Sekolah Formal</h4>
                  <p className="text-sm font-medium text-gray-800">
                    {santri.sekolah ? `${santri.sekolah} - Kelas ${santri.kelas_sekolah || ''}` : '-'}
                  </p>
                </div>

                <InfoRow label="Alamat" value={santri.alamat || '-'} />
                
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Status</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${
                    santri.status_global === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {santri.status_global?.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 2: AKADEMIK --- */}
        {activeTab === 'akademik' && (
          <div className="space-y-4 animate-in fade-in">
            {loading && !dataAkademik ? (
              <LoadingState />
            ) : dataAkademik?.length === 0 ? (
              <EmptyState text="Belum ada riwayat pendidikan tercatat." />
            ) : (
              dataAkademik?.map((item: any) => (
                <AccordionAkademik key={item.id} data={item} />
              ))
            )}
          </div>
        )}

        {/* --- TAB 3: KEAMANAN --- */}
        {activeTab === 'keamanan' && (
          <div className="animate-in fade-in">
             {loading && !dataPelanggaran ? (
              <LoadingState />
            ) : dataPelanggaran?.length === 0 ? (
              <EmptyState text="Alhamdulillah, santri ini disiplin." />
            ) : (
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-700 border-b">
                    <tr>
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Kategori</th>
                      <th className="px-4 py-3">Deskripsi</th>
                      <th className="px-4 py-3 text-center">Poin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dataPelanggaran?.map((p: any) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {format(new Date(p.tanggal), 'dd/MM/yyyy', { locale: id })}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-gray-100">
                            {p.jenis}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{p.deskripsi}</td>
                        <td className="px-4 py-3 text-center font-bold text-red-600">+{p.poin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --- TAB 4: PERIZINAN --- */}
        {activeTab === 'izin' && (
          <div className="animate-in fade-in">
             {loading && !dataIzin ? (
              <LoadingState />
            ) : dataIzin?.length === 0 ? (
              <EmptyState text="Belum ada riwayat perizinan." />
            ) : (
              <div className="space-y-3">
                {dataIzin?.map((p: any) => (
                  <div key={p.id} className={`p-4 rounded-lg border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${p.status === 'AKTIF' ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
                    <div className="flex gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        p.jenis === 'PULANG' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {p.jenis === 'PULANG' ? <Home className="w-5 h-5"/> : <MapPin className="w-5 h-5"/>}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-800 text-sm">
                            {p.jenis === 'PULANG' ? 'IZIN PULANG' : 'KELUAR KOMPLEK'}
                          </span>
                          {p.status === 'AKTIF' ? (
                            <span className="text-[10px] bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full font-bold">SEDANG KELUAR</span>
                          ) : (
                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">SUDAH KEMBALI</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 italic">"{p.alasan}"</p>
                        <p className="text-[10px] text-gray-400 mt-1">Oleh: {p.pemberi_izin}</p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right text-xs bg-gray-50 p-2 rounded w-full sm:w-auto">
                      <p className="text-gray-500 mb-1">Berangkat: {format(new Date(p.tgl_mulai), 'dd MMM yyyy HH:mm', { locale: id })}</p>
                      {p.tgl_kembali_aktual ? (
                        <p className="text-green-600 font-bold">Tiba: {format(new Date(p.tgl_kembali_aktual), 'dd MMM yyyy HH:mm', { locale: id })}</p>
                      ) : (
                        <p className="text-red-500 font-medium">Rencana: {format(new Date(p.tgl_selesai_rencana), 'dd MMM yyyy HH:mm', { locale: id })}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 5: KEUANGAN / SPP (BARU) --- */}
        {activeTab === 'keuangan' && (
          <div className="animate-in fade-in">
            {loading && !dataSPP ? (
              <LoadingState />
            ) : dataSPP?.length === 0 ? (
              <EmptyState text="Belum ada data pembayaran SPP." />
            ) : (
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-orange-50 text-orange-800 border-b border-orange-100">
                    <tr>
                      <th className="px-4 py-3">Bulan / Tahun</th>
                      <th className="px-4 py-3 text-right">Nominal</th>
                      <th className="px-4 py-3">Tanggal Bayar</th>
                      <th className="px-4 py-3">Penerima</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dataSPP?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold text-gray-800">
                          {BULAN_LIST[item.bulan - 1]} {item.tahun}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-700">
                          Rp {item.nominal_bayar.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {format(new Date(item.tanggal_bayar), 'dd MMMM yyyy HH:mm', { locale: id })}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {item.penerima?.full_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <CheckCircle className="w-3 h-3"/> LUNAS
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// --- SUB COMPONENTS ---
function InfoRow({ label, value, isBold }: { label: string, value: string, isBold?: boolean }) {
  return <div className="flex flex-col border-b border-gray-100 pb-2"><span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">{label}</span><span className={`text-gray-900 ${isBold ? 'font-bold text-lg' : 'font-medium'}`}>{value}</span></div>
}
function LoadingState() { return <div className="py-20 flex flex-col items-center justify-center text-gray-400"><Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-600"/> Mengambil data...</div> }
function EmptyState({ text }: { text: string }) { return <div className="py-16 text-center text-gray-400 italic bg-gray-50 rounded-lg border border-dashed">{text}</div> }
function AccordionAkademik({ data }: { data: any }) {
  const [isOpen, setIsOpen] = useState(false)
  const nilaiS1 = data.nilai_detail?.filter((n: any) => n.semester === 1) || []
  const nilaiS2 = data.nilai_detail?.filter((n: any) => n.semester === 2) || []
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-md bg-white">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 text-left">
        <div className="flex items-center gap-4"><div className={`p-2 rounded-lg ${isOpen ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}><BookOpen className="w-5 h-5"/></div><div><h4 className="font-bold text-gray-800 text-base">{data.kelas?.nama_kelas}</h4><p className="text-xs text-gray-500 mt-0.5 font-medium">{data.kelas?.tahun_ajaran?.nama} • {data.status_riwayat}</p></div></div>
        <div className="flex items-center gap-6"><div className="text-right hidden sm:block bg-gray-50 px-3 py-1 rounded border border-gray-100"><p className="text-[10px] text-gray-400 uppercase font-bold">Rata-rata</p><p className="font-bold text-blue-600 text-lg">{data.ranking?.rata_rata || '-'}</p></div>{isOpen ? <ChevronDown className="w-5 h-5 text-gray-400"/> : <ChevronRight className="w-5 h-5 text-gray-400"/>}</div>
      </button>
      {isOpen && (
        <div className="p-5 bg-gray-50 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-2">
          <div className="bg-white p-4 rounded-lg border shadow-sm"><h5 className="font-bold text-xs text-blue-600 uppercase mb-3 border-b pb-2">Semester 1</h5><ul className="space-y-2 text-sm">{nilaiS1.map((n:any,i:number)=><li key={i} className="flex justify-between border-b border-gray-50 pb-1"><span>{n.mapel.nama}</span><span className="font-bold">{n.nilai}</span></li>)}</ul></div>
          <div className="bg-white p-4 rounded-lg border shadow-sm"><h5 className="font-bold text-xs text-green-600 uppercase mb-3 border-b pb-2">Semester 2</h5><ul className="space-y-2 text-sm">{nilaiS2.map((n:any,i:number)=><li key={i} className="flex justify-between border-b border-gray-50 pb-1"><span>{n.mapel.nama}</span><span className="font-bold">{n.nilai}</span></li>)}</ul></div>
        </div>
      )}
    </div>
  )
}