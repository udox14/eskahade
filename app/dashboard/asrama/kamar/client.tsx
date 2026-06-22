'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Crown, LogOut, MapPin, MessageCircle, Phone, Save, School, Users, X } from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import {
  batalTandaiSantriKeluarDariKamar,
  getKamarDetail,
  mutasiKamarDalamAsrama,
  getKamarOverview,
  tandaiSantriKeluarDariKamar,
  updateKetuaKamarLangsung,
  updateNomorWaOrtuBatchKamar,
} from './actions'

type KetuaInfo = {
  nomor_kamar: string
  santri_id: string
  nama_lengkap: string
} | null

type RoomMember = {
  id: string
  nis: string
  foto_url: string | null
  asrama: string | null
  kamar: string | null
  nama_lengkap: string
  sekolah: string | null
  kelas_sekolah: string | null
  no_wa_ortu: string | null
  kab_kota: string | null
  nama_kelas: string | null
  kategori_santri: string
  kategori_efektif: string
  alamat_ringkas: string
  pending_keluar: {
    id: string
    tanggal_tandai: string | null
    catatan: string | null
  } | null
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

function cleanWaNumber(value: string | null | undefined) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}

function waHref(value: string | null | undefined) {
  const cleaned = cleanWaNumber(value)
  return cleaned ? `https://wa.me/${cleaned}` : ''
}

function formatSekolahKelas(member: Pick<RoomMember, 'sekolah' | 'kelas_sekolah'>) {
  const sekolah = member.sekolah?.trim()
  const kelas = member.kelas_sekolah?.trim()
  if (sekolah && kelas) return `${sekolah}/${kelas}`
  return sekolah || kelas || '-'
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
  const [catatanKeluar, setCatatanKeluar] = useState('')
  const [keluarModalMember, setKeluarModalMember] = useState<RoomMember | null>(null)
  const [waModalOpen, setWaModalOpen] = useState(false)
  const [waDraftById, setWaDraftById] = useState<Record<string, string>>({})
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
  const selectedMember = useMemo(
    () => selectedRoom?.members.find((member) => member.id === selectedMemberId) ?? null,
    [selectedMemberId, selectedRoom]
  )
  const ringkasanKamar = useMemo(() => {
    const kamarTerisi = rooms.filter((room) => room.total_anggota > 0).length
    const kamarTanpaKetua = rooms.filter((room) => room.total_anggota > 0 && !room.ketua).length
    const kamarTanpaPembina = rooms.filter((room) => room.total_anggota > 0 && !room.pembina_nama).length
    return { kamarTerisi, kamarTanpaKetua, kamarTanpaPembina }
  }, [rooms])
  const selectedRoomBaruCount = useMemo(
    () => selectedRoom?.members.filter((member) => member.kategori_efektif === 'BARU').length ?? 0,
    [selectedRoom]
  )

  useEffect(() => {
    queueMicrotask(() => {
      setCatatanKeluar(selectedMember?.pending_keluar?.catatan || '')
    })
  }, [selectedMember?.id, selectedMember?.pending_keluar?.catatan])

  useEffect(() => {
    if (!waModalOpen || !selectedRoom) return
    setWaDraftById(
      Object.fromEntries(
        selectedRoom.members.map((member) => [member.id, member.no_wa_ortu || ''])
      )
    )
  }, [selectedRoom, waModalOpen])

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

  const refreshCurrentRoom = useCallback(async () => {
    await load(selectedAsrama)
    if (!selectedAsrama || !selectedKamar) return

    const detail = await getKamarDetail(selectedAsrama, selectedKamar)
    if ('error' in detail) {
      toast.error(detail.error)
      return
    }

    setSelectedRoom(detail.room)
    setSelectedMemberId((prev) =>
      detail.room.members.some((member: RoomMember) => member.id === prev)
        ? prev
        : detail.room.members[0]?.id ?? null
    )
  }, [load, selectedAsrama, selectedKamar])

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
      await refreshCurrentRoom()
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
      await refreshCurrentRoom()
    })
  }

  const handleTandaiKeluar = (member: RoomMember | null = selectedMember) => {
    if (!member) return
    startTransition(async () => {
      const result = await tandaiSantriKeluarDariKamar({
        asrama: selectedAsrama,
        santriId: member.id,
        catatan: catatanKeluar,
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success('Santri ditandai untuk diverifikasi dewan santri')
      setKeluarModalMember(null)
      setCatatanKeluar('')
      await refreshCurrentRoom()
    })
  }

  const handleBatalTandaiKeluar = (member: RoomMember | null = selectedMember) => {
    if (!member) return
    startTransition(async () => {
      const result = await batalTandaiSantriKeluarDariKamar({
        asrama: selectedAsrama,
        santriId: member.id,
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success('Tanda keluar dibatalkan')
      setKeluarModalMember(null)
      await refreshCurrentRoom()
    })
  }

  const openKeluarModal = (member: RoomMember) => {
    setSelectedMemberId(member.id)
    setCatatanKeluar(member.pending_keluar?.catatan || '')
    setKeluarModalMember(member)
  }

  const handleSaveWaBatch = () => {
    if (!selectedRoom) return
    startTransition(async () => {
      const result = await updateNomorWaOrtuBatchKamar({
        asrama: selectedAsrama,
        nomorKamar: selectedRoom.nomor_kamar,
        items: selectedRoom.members.map((member) => ({
          santriId: member.id,
          noWaOrtu: waDraftById[member.id] ?? '',
        })),
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success(`Nomor WA orang tua diperbarui untuk ${result.total} santri`)
      setWaModalOpen(false)
      await refreshCurrentRoom()
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Anggota" value={selectedRoom?.total_anggota || 0} tone="slate" />
            <SummaryCard label="Baru" value={selectedRoomBaruCount} tone="indigo" />
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
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ketua Kamar</p>
                <div className="mt-2 space-y-3">
                  <p className="text-lg font-black text-slate-800">{selectedRoom.ketua?.nama_lengkap || 'Belum ditentukan'}</p>
                  <p className="text-xs font-medium text-slate-400">Centang langsung dari tabel anggota.</p>
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
                    kuota={selectedRoom.kuota}
                  />
                  <span className="text-sm font-semibold text-slate-600">
                    {selectedRoom.total_anggota}/{selectedRoom.kuota} kuota fisik
                  </span>
                </div>
                {selectedRoom.reserved_baru ? (
                  <p className="mt-1 text-xs text-slate-400">
                    Reserve santri baru: {selectedRoom.reserved_baru} slot
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-slate-800">Daftar Santri Kamar {selectedRoom.nomor_kamar}</p>
                <p className="mt-0.5 text-xs text-slate-400">Nomor WA orang tua bisa dibuka langsung atau diperbarui sekaligus per kamar.</p>
              </div>
              <button
                type="button"
                onClick={() => setWaModalOpen(true)}
                disabled={pending || selectedRoom.members.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                <Phone className="h-4 w-4" />
                Edit WA Ortu
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
              <table className="w-full min-w-[1220px] text-sm">
                <thead className="border-b bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="w-20 px-4 py-3 text-center">Ketua</th>
                    <th className="px-4 py-3 text-left">Nama</th>
                    <th className="px-4 py-3 text-left">Kelas</th>
                    <th className="px-4 py-3 text-left">Sekolah/Kelas</th>
                    <th className="px-4 py-3 text-left">WA Orang Tua</th>
                    <th className="px-4 py-3 text-left">Kab/Kota</th>
                    <th className="w-44 px-4 py-3 text-left">Mutasi</th>
                    <th className="w-48 px-4 py-3 text-left">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedRoom.members.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center text-slate-400">Belum ada anggota di kamar ini.</td>
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
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isKetua}
                              disabled={pending}
                              aria-label={`Jadikan ${member.nama_lengkap} ketua kamar`}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => handleSetKetua(selectedRoom.nomor_kamar, event.target.checked ? member.id : null)}
                              className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              {isKetua ? <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> : null}
                              <SantriPhotoAvatar src={member.foto_url} alt={member.nama_lengkap} name={member.nama_lengkap} size="sm" />
                              <div>
                                <p className="font-semibold text-slate-800">{member.nama_lengkap}</p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-black ${
                                    member.kategori_efektif === 'BARU'
                                      ? 'bg-indigo-100 text-indigo-700'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {member.kategori_efektif || member.kategori_santri || 'REGULER'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{member.nama_kelas || '-'}</td>
                          <td className="px-4 py-3 font-semibold text-slate-600">{formatSekolahKelas(member)}</td>
                          <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                            {waHref(member.no_wa_ortu) ? (
                              <a
                                href={waHref(member.no_wa_ortu)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                {member.no_wa_ortu}
                              </a>
                            ) : (
                              <span className="text-xs font-semibold text-slate-300">Belum ada</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                              <MapPin className="h-3.5 w-3.5" />
                              {member.alamat_ringkas}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value=""
                              disabled={pending || roomNames.length <= 1}
                              aria-label={`Pindahkan ${member.nama_lengkap} ke kamar lain`}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => {
                                event.stopPropagation()
                                if (!event.target.value) return
                                handleMutasi(member.id, event.target.value)
                              }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <option value="">Pindah kamar</option>
                              {roomNames.filter((room) => room !== selectedRoom.nomor_kamar).map((room) => (
                                <option key={room} value={room}>Kamar {room}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => openKeluarModal(member)}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-rose-700 disabled:bg-rose-300"
                                >
                                  <LogOut className="h-3.5 w-3.5" />
                                  {member.pending_keluar ? 'Perbarui' : 'Tandai'}
                                </button>
                                {member.pending_keluar ? (
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => handleBatalTandaiKeluar(member)}
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:bg-slate-100"
                                  >
                                    Batal
                                  </button>
                                ) : null}
                              </div>
                              {member.pending_keluar ? (
                                <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-bold text-rose-700">
                                  Menunggu ACC
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {keluarModalMember ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
                <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
                  <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        {keluarModalMember.pending_keluar ? 'Perbarui Tanda Keluar' : 'Tandai Santri Keluar'}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">{keluarModalMember.nama_lengkap}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setKeluarModalMember(null)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Tutup modal tandai keluar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-2 px-5 py-4">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Alasan / Catatan Keluar
                    </label>
                    <textarea
                      value={catatanKeluar}
                      onChange={(event) => setCatatanKeluar(event.target.value)}
                      rows={5}
                      placeholder="Contoh: pindah pesantren, ikut orang tua, atau keterangan wali."
                      className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-rose-500"
                    />
                    {keluarModalMember.pending_keluar ? (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                        Santri ini sudah ditandai keluar dan masih menunggu ACC dewan santri.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setKeluarModalMember(null)}
                      disabled={pending}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:bg-slate-100"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTandaiKeluar(keluarModalMember)}
                      disabled={pending}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:bg-rose-300"
                    >
                      <LogOut className="h-4 w-4" />
                      {keluarModalMember.pending_keluar ? 'Perbarui Tanda' : 'Tandai Keluar'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {waModalOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
                <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
                  <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
                    <div>
                      <h3 className="text-base font-black text-slate-900">Edit WA Orang Tua</h3>
                      <p className="mt-0.5 text-xs text-slate-500">Kamar {selectedRoom.nomor_kamar} - {selectedRoom.members.length} santri</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWaModalOpen(false)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Tutup modal edit WA orang tua"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="overflow-y-auto px-5 py-4">
                    <div className="space-y-2">
                      {selectedRoom.members.map((member) => (
                        <div key={member.id} className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[1fr_220px] sm:items-center">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800">{member.nama_lengkap}</p>
                            <p className="mt-0.5 text-xs text-slate-400">{formatSekolahKelas(member)}</p>
                          </div>
                          <input
                            value={waDraftById[member.id] ?? ''}
                            onChange={(event) => setWaDraftById((prev) => ({ ...prev, [member.id]: event.target.value }))}
                            placeholder="08xxxxxxxxxx"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setWaModalOpen(false)}
                      disabled={pending}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:bg-slate-100"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveWaBatch}
                      disabled={pending}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:bg-emerald-300"
                    >
                      <Save className="h-4 w-4" />
                      Simpan Batch
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
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
              const kuotaFisik = Number(room.kuota ?? 0)
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
                      <KamarStatusBadge isi={room.total_anggota} kuota={kuotaFisik} />
                    </div>
                    <span className="text-xs font-bold text-slate-600">{room.total_anggota}/{kuotaFisik}</span>
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

