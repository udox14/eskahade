'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Crown, Home, MapPin, School } from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { mutasiKamarDalamAsrama, getKamarOverview, updateKetuaKamarLangsung } from './actions'

type KetuaInfo = {
  nomor_kamar: string
  santri_id: string
  nama_lengkap: string
} | null

type RoomMember = {
  id: string
  nis: string
  nama_lengkap: string
  asrama: string | null
  kamar: string | null
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
  members: RoomMember[]
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

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone: 'emerald' | 'blue' | 'amber' | 'slate'
}) {
  const tones = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    blue: 'bg-sky-50 border-sky-200 text-sky-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
  }

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
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
    setValue('')
  }, [currentRoom, rooms])

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-50"
      >
        <option value="">Pindah ke...</option>
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
        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200"
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
  const [selectedKamar, setSelectedKamar] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

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
      setSelectedKamar((prev) => {
        const stillExists = result.rooms.some((room) => room.nomor_kamar === prev)
        return stillExists ? prev : result.rooms[0]?.nomor_kamar || ''
      })
      setLoading(false)
    },
    [asramaBinaan, selectedAsrama]
  )

  useEffect(() => {
    load(asramaBinaan ?? selectedAsrama)
  }, [asramaBinaan, load])

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.nomor_kamar === selectedKamar) ?? null,
    [rooms, selectedKamar]
  )

  const roomNames = useMemo(() => rooms.map((room) => room.nomor_kamar), [rooms])
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      <DashboardPageHeader
        title="Kamar Asrama"
        description="Pantau semua kamar, lihat anggota kamar, tentukan ketua kamar, dan lakukan mutasi kamar dalam satu asrama."
        action={
          isAdmin ? (
            <select
              value={selectedAsrama}
              onChange={(event) => {
                const next = event.target.value
                setSelectedAsrama(next)
                setSelectedKamar('')
                load(next)
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 sm:min-w-64"
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
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Santri" value={demografi.totalSantri} tone="emerald" />
        <StatCard label="Total Kamar" value={demografi.totalKamar} tone="blue" />
        <StatCard label="Ketua Terisi" value={demografi.ketuaTerisi} tone="amber" />
        <StatCard label="Belum Berkamar" value={demografi.belumBerkamar} tone="slate" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-slate-700">
            <School className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-black uppercase tracking-wider">Demografi Singkat</h2>
          </div>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Sebaran Sekolah</p>
              <div className="flex flex-wrap gap-2">
                {demografi.topSekolah.length > 0 ? (
                  demografi.topSekolah.map((item) => (
                    <span
                      key={item.label}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                    >
                      {item.label} ({item.total})
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">Belum ada data sekolah.</span>
                )}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Sebaran Kab/Kota</p>
              <div className="flex flex-wrap gap-2">
                {demografi.topKota.length > 0 ? (
                  demografi.topKota.map((item) => (
                    <span
                      key={item.label}
                      className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700"
                    >
                      {item.label} ({item.total})
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">Belum ada data domisili.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-slate-700">
            <Home className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-black uppercase tracking-wider">Info Pengelolaan</h2>
          </div>
          <div className="space-y-3 text-sm text-slate-600">
            <p>Ketua kamar di halaman ini memakai tabel yang sama dengan fitur perpindahan kamar, jadi perubahan di sini langsung terbaca di sana.</p>
            <p>Mutasi kamar di halaman ini hanya berlaku dalam satu asrama. Draft perpindahan kamar untuk santri yang dipindah akan dibersihkan agar datanya tetap sinkron.</p>
            <p>Pembina kamar diambil dari fitur Kepengurusan Asrama, jadi perubahan pengurus di sana langsung tampil juga di sini.</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">Daftar Kamar</h2>
            <p className="text-sm text-slate-500">Klik salah satu card untuk membuka detail anggota kamar.</p>
          </div>
          {pending || loading ? <span className="text-xs font-semibold text-slate-400">Memuat data...</span> : null}
        </div>

        {rooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center text-slate-400">
            Belum ada kamar yang bisa ditampilkan untuk asrama ini.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room) => {
              const active = room.nomor_kamar === selectedKamar
              return (
                <button
                  key={room.nomor_kamar}
                  type="button"
                  onClick={() => setSelectedKamar(room.nomor_kamar)}
                  className={`rounded-3xl border p-5 text-left transition ${
                    active
                      ? 'border-emerald-300 bg-emerald-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Kamar</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-900">{room.nomor_kamar}</h3>
                      {room.blok ? (
                        <p className="mt-1 text-xs font-semibold text-indigo-600">Blok {room.blok}</p>
                      ) : null}
                    </div>
                    <div className="rounded-2xl bg-slate-900 px-3 py-2 text-center text-white">
                      <p className="text-[10px] uppercase tracking-wider text-slate-300">Anggota</p>
                      <p className="text-xl font-black">{room.total_anggota}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl bg-white/80 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ketua Kamar</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {room.ketua?.nama_lengkap || 'Belum ditentukan'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pembina</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {room.pembina_nama || 'Belum diatur'}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedRoom ? (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Detail Kamar</p>
              <h2 className="mt-1 text-2xl font-black text-slate-900">
                Kamar {selectedRoom.nomor_kamar}
                {selectedRoom.blok ? ` - Blok ${selectedRoom.blok}` : ''}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedRoom.total_anggota} anggota, ketua saat ini: {selectedRoom.ketua?.nama_lengkap || 'belum ditentukan'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Pembina kamar: <span className="font-bold text-slate-800">{selectedRoom.pembina_nama || 'Belum diatur'}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3">Sekolah</th>
                  <th className="px-4 py-3">Kelas Sekolah</th>
                  <th className="px-4 py-3">Kab/Kota</th>
                  <th className="px-4 py-3">Ketua</th>
                  <th className="px-4 py-3">Mutasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedRoom.members.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-slate-400">
                      Belum ada anggota di kamar ini.
                    </td>
                  </tr>
                ) : (
                  selectedRoom.members.map((member) => {
                    const isKetua = selectedRoom.ketua?.santri_id === member.id
                    return (
                      <tr key={member.id} className={isKetua ? 'bg-amber-50/60' : 'bg-white'}>
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
                          <div className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                            <MapPin className="h-3.5 w-3.5" />
                            {member.alamat_ringkas}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleSetKetua(selectedRoom.nomor_kamar, isKetua ? null : member.id)}
                            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                              isKetua
                                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {isKetua ? 'Lepas Ketua' : 'Jadikan Ketua'}
                          </button>
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
        </div>
      ) : null}
    </div>
  )
}
