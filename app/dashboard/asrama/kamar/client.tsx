'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Crown, MapPin, School, Users } from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { getKamarDetail, mutasiKamarDalamAsrama, getKamarOverview, updateKetuaKamarLangsung } from './actions'

type KetuaInfo = {
  nomor_kamar: string
  santri_id: string
  nama_lengkap: string
} | null

type RoomMember = {
  id: string
  nis: string
  asrama: string | null
  kamar: string | null
  nama_lengkap: string
  sekolah: string | null
  kelas_sekolah: string | null
  kab_kota: string | null
  nama_kelas: string | null
  alamat_ringkas: string
}
type RoomCard = {
  nomor_kamar: string
  blok: string | null
  kuota: number
  reserved_baru: number
  total_anggota: number
  ketua: KetuaInfo
  pembina_nama: string | null
}

type Demografi = {
  totalSantri: number
  totalKamar: number
  ketuaTerisi: number
  belumBerkamar: number
  topSekolah: Array<{ label: string; total: number }>
  topKota: Array<{ label: string; total: number }>
}

type OverviewResult =
  | {
      error: string
      asramaOptions: string[]
      currentAsrama: string
      rooms: RoomCard[]
      demografi: Demografi
    }
  | {
      asramaOptions: string[]
      currentAsrama: string
      rooms: RoomCard[]
      demografi: Demografi
    }

function KamarStatusBadge({ isi, kuota }: { isi: number; kuota: number }) {
  if (isi === 0) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Kosong</span>
  if (isi > kuota) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">Over</span>
  if (isi === kuota) return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-600">Penuh</span>
  return <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-600">Normal</span>
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'slate' | 'indigo' | 'green' | 'amber'
}) {
  const toneClass = {
    slate: 'text-slate-800',
    indigo: 'text-indigo-700',
    green: 'text-green-600',
    amber: 'text-amber-600',
  }

  return (
    <div className="rounded-xl border bg-white p-4 text-center shadow-sm">
      <p className={`text-2xl font-black ${toneClass[tone]}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  )
}

function MutasiSelect({
  currentRoom,
  rooms,
  disabled,
  onSubmit,
}: {
  currentRoom: string
  rooms: string[]
  disabled: boolean
  onSubmit: (targetRoom: string) => void
}) {
  const [value, setValue] = useState('')

  useEffect(() => {
    queueMicrotask(() => setValue(''))
  }, [currentRoom, rooms])

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
      >
        <option value="">Pilih kamar</option>
        {rooms
          .filter((room) => room !== currentRoom)
          .map((room) => (
            <option key={room} value={room}>
              Kamar {room}
            </option>
          ))}
      </select>
      <button
        type="button"
        disabled={disabled || !value}
        onClick={() => {
          if (!value) return
          onSubmit(value)
          setValue('')
        }}
        className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700 disabled:bg-slate-300"
      >
        Mutasi
      </button>
    </div>
  )
}

export default function KamarClient({
  userRole,
  asramaBinaan,
}: {
  userRole: string
  asramaBinaan: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selectedAsrama, setSelectedAsrama] = useState(asramaBinaan ?? '')
  const [asramaOptions, setAsramaOptions] = useState<string[]>([])
  const [rooms, setRooms] = useState<RoomCard[]>([])
  const [demografi, setDemografi] = useState<Demografi>({
    totalSantri: 0,
    totalKamar: 0,
    ketuaTerisi: 0,
    belumBerkamar: 0,
    topSekolah: [],
    topKota: [],
  })
  const [selectedRoom, setSelectedRoom] = useState<(RoomCard & { members: RoomMember[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const selectedKamar = searchParams.get('kamar')

  const setKamarQuery = useCallback((kamar: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (kamar) params.set('kamar', kamar)
    else params.delete('kamar')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const load = useCallback(
    async (targetAsrama?: string) => {
      setLoading(true)
      const result = (await getKamarOverview(targetAsrama || selectedAsrama || asramaBinaan)) as OverviewResult
      if ('error' in result) {
        toast.error(result.error)
        setLoading(false)
        return
      }

      setAsramaOptions(result.asramaOptions)
      setSelectedAsrama(result.currentAsrama)
      setRooms(result.rooms)
      setDemografi(result.demografi)
      if (selectedKamar && !result.rooms.some((room) => room.nomor_kamar === selectedKamar)) {
        setKamarQuery(null)
        setSelectedRoom(null)
      }
      setLoading(false)
    },
    [asramaBinaan, selectedAsrama, selectedKamar, setKamarQuery]
  )

  useEffect(() => {
    queueMicrotask(() => {
      void load(asramaBinaan ?? selectedAsrama)
    })
  }, [asramaBinaan, load, selectedAsrama])

  const roomNames = useMemo(() => rooms.map((room) => room.nomor_kamar), [rooms])
  const ringkasanKamar = useMemo(() => {
    const kamarTerisi = rooms.filter((room) => room.total_anggota > 0).length
    const kamarTanpaKetua = rooms.filter((room) => room.total_anggota > 0 && !room.ketua).length
    const kamarTanpaPembina = rooms.filter((room) => room.total_anggota > 0 && !room.pembina_nama).length
    return { kamarTerisi, kamarTanpaKetua, kamarTanpaPembina }
  }, [rooms])

  useEffect(() => {
    let cancelled = false

    const loadDetail = async () => {
      if (!selectedKamar || !selectedAsrama) {
        setSelectedRoom(null)
        return
      }

      setLoadingDetail(true)
      const result = await getKamarDetail(selectedAsrama, selectedKamar)
      if (cancelled) return

      if ('error' in result) {
        toast.error(result.error)
        setSelectedRoom(null)
        setSelectedMemberId(null)
        setKamarQuery(null)
        setLoadingDetail(false)
        return
      }

      setSelectedRoom(result.room)
      setSelectedMemberId((prev) => result.room.members.some((member: RoomMember) => member.id === prev) ? prev : result.room.members[0]?.id ?? null)
      setLoadingDetail(false)
    }

    loadDetail()
    return () => { cancelled = true }
  }, [selectedAsrama, selectedKamar, setKamarQuery])

  const isAdmin = userRole === 'admin'

  const handleSetKetua = (nomorKamar: string, santriId: string | null) => {
    startTransition(async () => {
      const result = await updateKetuaKamarLangsung({
        asrama: selectedAsrama,
        nomorKamar,
        santriId,
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success(santriId ? 'Ketua kamar diperbarui' : 'Ketua kamar dibersihkan')
      await load(selectedAsrama)
    })
  }

  const handleMutasi = (santriId: string, kamarTujuan: string) => {
    startTransition(async () => {
      const result = await mutasiKamarDalamAsrama({
        asrama: selectedAsrama,
        santriId,
        kamarTujuan,
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success(`Santri dipindah ke kamar ${kamarTujuan}`)
      await load(selectedAsrama)
    })
  }

  if (selectedKamar) {
    return (
      <div className="mx-auto max-w-7xl space-y-5 pb-20">
        <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => setKamarQuery(null)}
              className="mb-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            >
              <ArrowLeft className="h-4 w-4" /> Kembali ke daftar kamar
            </button>
            <DashboardPageHeader
              title={`Kamar ${selectedRoom?.nomor_kamar || selectedKamar}`}
              description={`Asrama ${selectedAsrama}${selectedRoom?.blok ? ` - Blok ${selectedRoom.blok}` : ''}`}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard label="Anggota" value={selectedRoom?.total_anggota || 0} tone="slate" />
            <SummaryCard label="Ketua" value={selectedRoom?.ketua ? 1 : 0} tone="amber" />
            <SummaryCard label="Pembina" value={selectedRoom?.pembina_nama ? 1 : 0} tone="green" />
          </div>
        </div>

        {loadingDetail || !selectedRoom ? (
          <div className="flex justify-center py-20">
            <Users className="h-8 w-8 animate-pulse text-slate-300" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ketua Kamar</p>
                <div className="mt-2 space-y-3">
                  <p className="text-lg font-black text-slate-800">{selectedRoom.ketua?.nama_lengkap || 'Belum ditentukan'}</p>
                  <select
                    value={selectedRoom.ketua?.santri_id || ''}
                    onChange={(event) => handleSetKetua(selectedRoom.nomor_kamar, event.target.value || null)}
                    disabled={pending}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                  >
                    <option value="">-- Pilih Ketua Kamar --</option>
                    {selectedRoom.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.nama_lengkap}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pembina Kamar</p>
                <p className="mt-2 text-lg font-black text-slate-800">{selectedRoom.pembina_nama || 'Belum diatur'}</p>
              </div>
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</p>
                <div className="mt-2 flex items-center gap-2">
                  <KamarStatusBadge
                    isi={selectedRoom.total_anggota}
                    kuota={Math.max(0, selectedRoom.kuota - (selectedRoom.reserved_baru ?? 0))}
                  />
                  <span className="text-sm font-semibold text-slate-600">
                    {selectedRoom.total_anggota}/{Math.max(0, selectedRoom.kuota - (selectedRoom.reserved_baru ?? 0))} efektif
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="border-b bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Nama</th>
                    <th className="px-4 py-3 text-left">Kelas</th>
                    <th className="px-4 py-3 text-left">Sekolah</th>
                    <th className="px-4 py-3 text-left">Kelas Sekolah</th>
                    <th className="px-4 py-3 text-left">Kab/Kota</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedRoom.members.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-slate-400">Belum ada anggota di kamar ini.</td>
                    </tr>
                  ) : (
                    selectedRoom.members.map((member) => {
                      const isKetua = selectedRoom.ketua?.santri_id === member.id
                      const isSelected = selectedMemberId === member.id
                      return (
                        <tr
                          key={member.id}
                          onClick={() => setSelectedMemberId(member.id)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              {isKetua ? <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> : null}
                              <div>
                                <p className="font-semibold text-slate-800">{member.nama_lengkap}</p>
                                <p className="text-xs text-slate-400">{member.nis}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{member.nama_kelas || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">{member.sekolah || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">{member.kelas_sekolah || '-'}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                              <MapPin className="h-3.5 w-3.5" />
                              {member.alamat_ringkas}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isKetua ? (
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700">Ketua</span>
                              ) : null}
                              {isSelected ? (
                                <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-bold text-indigo-700">Dipilih</span>
                              ) : (
                                <span className="text-xs text-slate-400">Klik baris untuk sorot</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <MutasiSelect
                              currentRoom={selectedRoom.nomor_kamar}
                              rooms={roomNames}
                              disabled={pending}
                              onSubmit={(targetRoom) => handleMutasi(member.id, targetRoom)}
                            />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-20">
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <DashboardPageHeader
          title="Kamar Asrama"
          description="Pantau kamar, lihat penghuni, ubah ketua kamar, dan mutasi santri dalam satu asrama."
          className="flex-1"
        />
        {isAdmin ? (
          <select
            value={selectedAsrama}
            onChange={(event) => {
              const next = event.target.value
              setSelectedAsrama(next)
              load(next)
            }}
            className="sm:w-56 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {asramaOptions.map((asrama) => (
              <option key={asrama} value={asrama}>
                {asrama}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Asrama binaan: {selectedAsrama || asramaBinaan || '-'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total Kamar" value={demografi.totalKamar} tone="slate" />
        <SummaryCard label="Total Santri" value={demografi.totalSantri} tone="indigo" />
        <SummaryCard label="Kamar Terisi" value={ringkasanKamar.kamarTerisi} tone="green" />
        <SummaryCard label="Belum Berkamar" value={demografi.belumBerkamar} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <School className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Sebaran Sekolah</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {demografi.topSekolah.length > 0 ? demografi.topSekolah.map((item) => (
              <span key={item.label} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {item.label} ({item.total})
              </span>
            )) : <span className="text-sm text-slate-400">Belum ada data sekolah.</span>}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Ringkasan Kamar</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Kamar tanpa ketua</span>
              <span className="font-black text-slate-800">{ringkasanKamar.kamarTanpaKetua}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Kamar tanpa pembina</span>
              <span className="font-black text-slate-800">{ringkasanKamar.kamarTanpaPembina}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Kab/Kota terbanyak</span>
              <span className="font-black text-slate-800">{demografi.topKota[0]?.label || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Users className="h-8 w-8 animate-pulse text-slate-300" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center text-slate-400">
          Belum ada kamar yang bisa ditampilkan untuk asrama ini.
        </div>
      ) : (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-4 border-b bg-slate-50">
            <h2 className="font-bold text-slate-800">Daftar Kamar</h2>
            <p className="text-sm text-slate-500">Klik card untuk membuka detail kamar.</p>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rooms.map((room) => {
              const kuotaEfektif = Math.max(0, room.kuota - (room.reserved_baru ?? 0))
              return (
                <button
                  key={room.nomor_kamar}
                  type="button"
                  onClick={() => setKamarQuery(room.nomor_kamar)}
                  className="border rounded-xl bg-slate-50/50 hover:border-slate-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-white rounded-t-xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-black text-slate-800">Kamar {room.nomor_kamar}</span>
                      {room.blok ? (
                        <span className="text-[9px] bg-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded">
                          Blok {room.blok}
                        </span>
                      ) : null}
                      <KamarStatusBadge isi={room.total_anggota} kuota={kuotaEfektif} />
                    </div>
                    <span className="text-xs font-bold text-slate-600">{room.total_anggota}/{kuotaEfektif}</span>
                  </div>
                  <div className="px-3 py-2 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ketua</p>
                        <p className="text-xs font-semibold text-slate-700 truncate">{room.ketua?.nama_lengkap || 'Belum ditentukan'}</p>
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pembina</p>
                        <p className="text-xs font-semibold text-slate-700 truncate">{room.pembina_nama || 'Belum diatur'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{room.total_anggota} penghuni aktif</span>
                      <span>{room.reserved_baru ? `Reserve ${room.reserved_baru}` : 'Tanpa reserve'}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

