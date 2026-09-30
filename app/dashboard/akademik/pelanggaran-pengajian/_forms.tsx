'use client'

import { useEffect, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  Loader2,
  Plus,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { toWibDateTimeLocalValue } from '@/lib/date/wib'
import { inferSession, SESSION_LABELS } from '@/lib/pengajian-violations/session'
import type {
  Filters,
  Incident,
  Options,
  Santri,
  Tab,
  ViolationType,
} from '@/lib/pengajian-violations/types'
import {
  attachIncidentPhoto,
  cancelIncident,
  saveIncident,
  saveType,
  searchSantri,
} from './actions'
import { EvidenceCamera, EvidenceDraft } from './_camera'
import {
  button,
  Combobox,
  control,
  ErrorMessage,
  Field,
  Modal,
  primary,
  StudentIdentity,
} from './_components'

export function FilterModal({
  value,
  options,
  tab,
  detail = false,
  onApply,
  onClose,
}: {
  value: Filters
  options: Options
  tab: Tab
  detail?: boolean
  onApply: (f: Filters) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState('')

  const set = (key: keyof Filters, val: string) =>
    setDraft((d) => ({ ...d, [key]: val || undefined }))

  const select = (
    key: keyof Filters,
    label: string,
    items: { id: string; name: string }[]
  ) => (
    <Field label={label}>
      <select
        className={control}
        value={String(draft[key] ?? '')}
        onChange={(e) => set(key, e.target.value)}
      >
        <option value="">Semua</option>
        {items.map((r) => (
          <option value={r.id} key={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </Field>
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (draft.start && draft.end && draft.start > draft.end) {
      setError('Tanggal awal harus sebelum tanggal akhir.')
      return
    }
    if (draft.min != null && draft.max != null && draft.min > draft.max) {
      setError('Batas minimum melebihi maksimum.')
      return
    }
    onApply(draft)
  }

  const sorts = detail
    ? [
        { id: 'time', name: 'Waktu Kejadian' },
        { id: 'type', name: 'Jenis Pelanggaran' },
      ]
    : tab === 'rekap'
    ? [
        { id: 'count', name: 'Jumlah Kejadian' },
        { id: 'name', name: 'Nama Santri' },
        { id: 'last', name: 'Kejadian Terakhir' },
      ]
    : [
        { id: 'time', name: 'Waktu Kejadian' },
        { id: 'name', name: 'Nama Santri' },
        { id: 'type', name: 'Jenis Pelanggaran' },
        { id: 'actor', name: 'Pencatat' },
      ]

  return (
    <Modal
      title="Filter & Urutkan Data"
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            className={button}
            onClick={() => {
              setDraft({
                status: 'active',
                sort: tab === 'rekap' ? 'count' : 'time',
                direction: 'desc',
                search: value.search,
              })
              setError('')
            }}
          >
            Reset Default
          </button>
          <button form="pengajian-filter" className={primary} type="submit">
            Terapkan Filter
          </button>
        </div>
      }
    >
      <form id="pengajian-filter" className="space-y-5" onSubmit={submit}>
        {error && <ErrorMessage message={error} />}

        {/* Section 1: Rentang Tanggal */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Rentang Waktu
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Dari Tanggal">
              <input
                type="date"
                className={control}
                value={draft.start ?? ''}
                onChange={(e) => set('start', e.target.value)}
              />
            </Field>
            <Field label="Sampai Tanggal">
              <input
                type="date"
                className={control}
                value={draft.end ?? ''}
                onChange={(e) => set('end', e.target.value)}
              />
            </Field>
          </div>
        </div>

        {/* Section 2: Target Santri (hanya pada tampilan utama) */}
        {!detail && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Lokasi & Kelas Santri
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {select('asrama', 'Asrama', [
                ...options.asramas.filter(Boolean).map((id) => ({ id, name: id })),
                { id: '__unassigned__', name: 'Belum ditempatkan' },
              ])}
              {select(
                'kamar',
                'Kamar',
                options.kamars.map((id) => ({ id, name: id }))
              )}
              {select('gender', 'Jenis Kelamin', [
                { id: 'L', name: 'Putra' },
                { id: 'P', name: 'Putri' },
              ])}
              {select('kelasId', 'Kelas Pengajian', options.classes)}
            </div>
          </div>
        )}

        {/* Section 3: Parameter Pelanggaran */}
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Parameter Pelanggaran
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {select(
              'typeId',
              'Jenis Pelanggaran',
              options.types.map((t) => ({
                id: t.id,
                name: t.name + (t.active ? '' : ' (nonaktif)'),
              }))
            )}
            {select(
              'session',
              'Sesi Pengajian',
              Object.entries(SESSION_LABELS).map(([id, name]) => ({ id, name }))
            )}
            {select('actorId', 'Pencatat', options.actors)}
            {tab === 'riwayat' && (
              <Field label="Status Catatan">
                <select
                  className={control}
                  value={draft.status ?? 'active'}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      status: e.target.value as Filters['status'],
                    }))
                  }
                >
                  <option value="active">Catatan Aktif Saja</option>
                  <option value="cancelled">Dibatalkan Saja</option>
                  <option value="all">Semua Status</option>
                </select>
              </Field>
            )}
          </div>
        </div>

        {/* Batas Jumlah untuk Rekap */}
        {tab === 'rekap' && !detail && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Jumlah Kejadian
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {(['min', 'max'] as const).map((key) => (
                <Field
                  label={key === 'min' ? 'Jumlah Minimum' : 'Jumlah Maksimum'}
                  key={key}
                >
                  <input
                    className={control}
                    type="number"
                    min={0}
                    step={1}
                    value={draft[key] ?? ''}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [key]: e.target.value === '' ? undefined : Number(e.target.value),
                      }))
                    }
                  />
                </Field>
              ))}
            </div>
          </div>
        )}

        {/* Section 4: Pengurutan */}
        {tab !== 'analitik' && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Pengurutan
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {select('sort', 'Urut Berdasarkan', sorts)}
              <Field label="Arah Urutan">
                <select
                  className={control}
                  value={draft.direction ?? 'desc'}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      direction: e.target.value as Filters['direction'],
                    }))
                  }
                >
                  <option value="desc">Menurun / Terbaru / Z–A</option>
                  <option value="asc">Menaik / Terlama / A–Z</option>
                </select>
              </Field>
            </div>
          </div>
        )}

        {!detail && (
          <p className="text-[11px] leading-relaxed text-slate-400 border-t border-slate-100 pt-3">
            Asrama, kamar, dan kelas mengikuti penempatan santri saat ini. Rekap dan analitik hanya menghitung catatan aktif.
          </p>
        )}
      </form>
    </Modal>
  )
}

export function IncidentForm({
  row,
  options,
  onClose,
  onSaved,
}: {
  row?: Incident
  options: Options
  onClose: () => void
  onSaved: () => void
}) {
  const [student, setStudent] = useState<{
    id: string
    nama_lengkap: string
    nis: string
    foto_url: string | null
    asrama: string | null
    kamar: string | null
  } | null>(
    row
      ? {
          id: row.santri_id,
          nama_lengkap: row.nama_lengkap,
          nis: row.nis,
          foto_url: row.foto_url,
          asrama: row.asrama,
          kamar: row.kamar,
        }
      : null
  )

  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState<Santri[]>([])
  const [searching, setSearching] = useState(false)

  const [typeId, setTypeId] = useState(row?.type_id ?? '')
  const [date, setDate] = useState(toWibDateTimeLocalValue(row?.occurred_at ?? new Date()))
  const [manualSession, setManualSession] = useState(row?.session ?? '')
  const automaticSession = inferSession(date)
  const sesi = automaticSession || manualSession
  const [note, setNote] = useState(row?.note ?? '')
  const [reason, setReason] = useState('')

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [photo, setPhoto] = useState<File | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [incidentSaved, setIncidentSaved] = useState(false)
  const [ids] = useState(() => ({
    id: row?.id ?? crypto.randomUUID(),
    requestId: crypto.randomUUID(),
  }))

  useEffect(() => {
    let alive = true
    const timeout = setTimeout(async () => {
      if (student || search.trim().length < 2) {
        if (alive) setMatches([])
        return
      }
      setSearching(true)
      const response = await searchSantri(search).catch(() => ({
        error: 'Pencarian gagal.',
        data: undefined,
      }))
      if (alive) {
        setSearching(false)
        if (response.data) {
          setMatches(response.data)
          setError('')
        } else {
          setError(response.error)
          setMatches([])
        }
      }
    }, 250)
    return () => {
      alive = false
      clearTimeout(timeout)
    }
  }, [search, student])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!student || !typeId || !sesi) {
      setError('Pilih santri, jenis pelanggaran, dan sesi pengajian.')
      return
    }
    setBusy(true)
    setError('')
    let saved = incidentSaved

    try {
      if (!incidentSaved) {
        const response = await saveIncident({
          ...ids,
          santriId: student.id,
          typeId,
          occurredAt: date,
          session: sesi,
          note,
          reason,
          version: row?.version,
        })
        if (response.error) {
          setError(response.error)
          return
        }
        setIncidentSaved(true)
        saved = true
      }

      if (photo) {
        const attachment = new FormData()
        attachment.set('photo', photo)
        const response = await attachIncidentPhoto(ids.id, ids.requestId, attachment)
        if (response.error) {
          setError(`Catatan sudah tersimpan. Foto belum berhasil disimpan: ${response.error}`)
          return
        }
      }

      toast.success(row ? 'Catatan berhasil dikoreksi.' : 'Pelanggaran berhasil dicatat.')
      onSaved()
    } catch {
      setError(
        saved
          ? 'Catatan sudah tersimpan. Unggah foto terputus; coba simpan foto lagi atau lanjut tanpa foto.'
          : 'Penyimpanan gagal. Coba lagi dengan formulir yang sama.'
      )
    } finally {
      setBusy(false)
    }
  }

  const types = options.types
    .filter((t) => t.active || t.id === row?.type_id)
    .map((t) => ({ id: t.id, name: t.name + (t.active ? '' : ' (nonaktif)') }))

  return (
    <>
      <Modal
        title={row ? 'Koreksi Catatan Pelanggaran' : 'Catat Pelanggaran Pengajian'}
        busy={busy}
        onClose={incidentSaved ? onSaved : onClose}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              className={button}
              type="button"
              disabled={busy}
              onClick={incidentSaved ? onSaved : onClose}
            >
              {incidentSaved ? 'Lanjut Tanpa Foto' : 'Batal'}
            </button>
            {student && (
              <button
                form="pengajian-incident"
                className={primary}
                disabled={busy || !types.length}
                type="submit"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menyimpan…</span>
                  </>
                ) : incidentSaved ? (
                  'Coba Simpan Foto'
                ) : row ? (
                  'Simpan Koreksi'
                ) : (
                  'Simpan Pelanggaran'
                )}
              </button>
            )}
          </div>
        }
      >
        <form
          id="pengajian-incident"
          onSubmit={submit}
          className="space-y-5"
          aria-busy={busy}
        >
          {error && <ErrorMessage message={error} />}

          {/* ─────────────────────────────────────────────────────────────
              TAHAP 1: PEMILIHAN SANTRI (Clean Autocomplete / Card)
             ───────────────────────────────────────────────────────────── */}
          {student ? (
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl">
              <div className="flex items-center gap-3 min-w-0">
                <SantriPhotoAvatar
                  src={student.foto_url}
                  alt={student.nama_lengkap}
                  name={student.nama_lengkap}
                  size="md"
                  clickable={false}
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {student.nama_lengkap}
                  </p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    NIS: {student.nis} · {student.asrama || 'Non-Asrama'}
                    {student.kamar ? ` / ${student.kamar}` : ''}
                  </p>
                </div>
              </div>

              {!row && (
                <button
                  type="button"
                  disabled={busy || incidentSaved}
                  className="shrink-0 text-xs text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shadow-2xs transition cursor-pointer"
                  onClick={() => {
                    setStudent(null)
                    setSearch('')
                    setMatches([])
                  }}
                >
                  Ganti Santri
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="santri-search-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                >
                  Cari Santri
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="santri-search-input"
                    disabled={busy}
                    autoComplete="off"
                    autoFocus
                    className={control + ' pl-9'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ketik Nama Lengkap atau NIS santri..."
                  />
                  {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    </div>
                  )}
                </div>
              </div>

              {/* Search Results List */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-400 block">
                  {search.trim().length >= 2
                    ? `Hasil Pencarian (${matches.length})`
                    : 'Ketik minimal 2 karakter untuk mencari santri'}
                </span>

                {matches.length > 0 && (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-white">
                    {matches.map((s) => (
                      <button
                        disabled={busy}
                        type="button"
                        key={s.id}
                        className="w-full text-left p-3 hover:bg-emerald-50/50 flex items-center justify-between transition cursor-pointer"
                        onClick={() => setStudent(s)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <SantriPhotoAvatar
                            src={s.foto_url}
                            alt={s.nama_lengkap}
                            name={s.nama_lengkap}
                            size="sm"
                            clickable={false}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {s.nama_lengkap}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              NIS: {s.nis} · {s.asrama || 'Non-Asrama'}
                              {s.kamar ? ` / ${s.kamar}` : ''}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                          Pilih
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {search.trim().length >= 2 && !matches.length && !searching && (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
                    <p className="text-xs text-slate-500">
                      Tidak ada santri aktif dalam cakupan akses Anda.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAHAP 2: RINCIAN PELANGGARAN
             ───────────────────────────────────────────────────────────── */}
          {student && (
            <>
              <fieldset disabled={incidentSaved} className="min-w-0 space-y-4">
                <Field label="Jenis Pelanggaran">
                  <Combobox
                    disabled={busy || incidentSaved}
                    label="Jenis pelanggaran"
                    value={typeId}
                    onChange={setTypeId}
                    items={types}
                  />
                </Field>

                {!types.length && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>
                      Belum ada jenis pelanggaran aktif. Hubungi sekpen atau admin untuk mengatur master data jenis.
                    </span>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Tanggal & Jam Kejadian (WIB)">
                    <input
                      required
                      disabled={busy}
                      type="datetime-local"
                      className={control}
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value)
                        setManualSession('')
                      }}
                    />
                  </Field>

                  <Field label="Sesi Pengajian">
                    <select
                      disabled={busy || !!automaticSession}
                      required
                      className={control}
                      value={sesi}
                      onChange={(e) =>
                        setManualSession(e.target.value as typeof manualSession)
                      }
                    >
                      <option value="">Pilih sesi</option>
                      {Object.entries(SESSION_LABELS).map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                      {automaticSession
                        ? 'Sesi otomatis terdeteksi dari waktu kejadian.'
                        : 'Di luar jam pengajian otomatis. Pilih sesi secara manual.'}
                    </p>
                  </Field>
                </div>

                <Field label="Catatan Tambahan (Opsional)">
                  <textarea
                    disabled={busy}
                    className={control}
                    rows={3}
                    maxLength={2000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Kronologi atau keterangan singkat kejadian..."
                  />
                </Field>

                {row && (
                  <Field label="Alasan Koreksi *">
                    <textarea
                      required
                      disabled={busy}
                      className={control}
                      rows={2}
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Wajib diisi: alasan perubahan atau koreksi catatan..."
                    />
                  </Field>
                )}
              </fieldset>

              {!row && (
                <EvidenceDraft
                  file={photo}
                  disabled={busy || incidentSaved}
                  onCapture={() => setCameraOpen(true)}
                  onRemove={() => setPhoto(null)}
                />
              )}
            </>
          )}
        </form>
      </Modal>

      {cameraOpen && (
        <EvidenceCamera
          onClose={() => setCameraOpen(false)}
          onUse={(file) => {
            setPhoto(file)
            setCameraOpen(false)
          }}
        />
      )}
    </>
  )
}

export function CancelForm({
  row,
  onClose,
  onSaved,
}: {
  row: Incident
  onClose: () => void
  onSaved: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [id] = useState(() => crypto.randomUUID())

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const r = await cancelIncident(row.id, row.version, reason, id)
      if (r.error) {
        setError(r.error)
      } else {
        toast.success('Catatan dibatalkan; histori tetap tersimpan.')
        onSaved()
      }
    } catch {
      setError('Pembatalan gagal. Silakan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Batalkan Catatan Pelanggaran"
      busy={busy}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2.5">
          <button className={button} disabled={busy} onClick={onClose}>
            Batal
          </button>
          <button
            form="pengajian-cancel"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-2xs hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Memproses…</span>
              </>
            ) : (
              'Batalkan Catatan'
            )}
          </button>
        </div>
      }
    >
      <form id="pengajian-cancel" className="space-y-4" onSubmit={submit}>
        {error && <ErrorMessage message={error} />}

        {/* Student identity banner */}
        <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl">
          <StudentIdentity student={row} large placement />
        </div>

        {/* Warning callout */}
        <div className="rounded-xl border border-rose-200/80 bg-rose-50/60 p-4 text-xs text-rose-900 space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-rose-950 text-sm">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            Pembatalan Kejadian: {row.type_name}
          </p>
          <p className="leading-relaxed text-slate-600">
            Catatan ini akan ditandai sebagai dibatalkan dan tidak lagi dihitung dalam statistik maupun rekapitulasi. Namun, riwayat audit kejadian ini tetap tersimpan permanen.
          </p>
        </div>

        <Field label="Alasan Pembatalan *">
          <textarea
            required
            disabled={busy}
            maxLength={500}
            className={control}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tuliskan alasan pembatalan catatan ini secara jelas..."
          />
        </Field>
      </form>
    </Modal>
  )
}

export function Settings({
  options,
  canCreate,
  canUpdate,
  onClose,
  onSaved,
}: {
  options: Options
  canCreate: boolean
  canUpdate: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const fresh = () => ({
    id: crypto.randomUUID(),
    name: '',
    description: '',
    position: options.types.length + 1,
    active: 1,
    version: 1,
  })

  const [draft, setDraft] = useState<ViolationType>(fresh)
  const [editing, setEditing] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const r = await saveType(draft)
      if (r.error) {
        setError(r.error)
      } else {
        toast.success('Jenis pelanggaran disimpan.')
        setDraft(fresh())
        setEditing(false)
        setFormOpen(false)
        onSaved()
      }
    } catch {
      setError('Pengaturan gagal disimpan.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={
        formOpen
          ? editing
            ? 'Ubah Jenis Pelanggaran'
            : 'Tambah Jenis Pelanggaran'
          : 'Pengaturan Jenis Pelanggaran'
      }
      busy={busy}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2.5">
          <button
            className={button}
            disabled={busy}
            onClick={() => (formOpen ? setFormOpen(false) : onClose())}
          >
            {formOpen ? 'Kembali' : 'Tutup'}
          </button>
          {formOpen && (
            <button
              form="pengajian-type"
              className={primary}
              type="submit"
              disabled={busy || !(editing ? canUpdate : canCreate)}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyimpan…</span>
                </>
              ) : (
                'Simpan Jenis'
              )}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {formOpen ? (
          <form id="pengajian-type" className="space-y-4" onSubmit={submit}>
            {error && <ErrorMessage message={error} />}

            <Field label="Nama Jenis Pelanggaran *">
              <input
                required
                disabled={busy}
                maxLength={120}
                className={control}
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Contoh: Mengantuk / Tidur"
              />
            </Field>

            <Field label="Deskripsi">
              <textarea
                disabled={busy}
                className={control}
                rows={2}
                maxLength={1000}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Penjelasan atau ketentuan jenis pelanggaran..."
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Urutan Tampilan *">
                <input
                  required
                  disabled={busy}
                  className={control}
                  type="number"
                  min={0}
                  step={1}
                  value={draft.position}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, position: Number(e.target.value) }))
                  }
                />
              </Field>

              <Field label="Status Keaktifan *">
                <select
                  disabled={busy}
                  className={control}
                  value={draft.active}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, active: Number(e.target.value) }))
                  }
                >
                  <option value={1}>Aktif</option>
                  <option value={0}>Nonaktif</option>
                </select>
              </Field>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {options.types.length} Jenis Pelanggaran Terdaftar
              </span>

              {canCreate && (
                <button
                  type="button"
                  className={primary}
                  onClick={() => {
                    setDraft(fresh())
                    setEditing(false)
                    setError('')
                    setFormOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  <span>Tambah Jenis</span>
                </button>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Jenis nonaktif tetap tersedia dalam histori kejadian sebelumnya, namun tidak dapat dipilih untuk pencatatan kejadian baru.
            </p>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto bg-white">
              {options.types.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 p-3.5 hover:bg-slate-50 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 truncate">
                        {t.name}
                      </span>
                      {t.active ? (
                        <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          Nonaktif
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Urutan: {t.position}
                      {t.description ? ` · ${t.description}` : ''}
                    </p>
                  </div>

                  {canUpdate && (
                    <button
                      type="button"
                      className="shrink-0 text-xs text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer"
                      onClick={() => {
                        setDraft(t)
                        setEditing(true)
                        setError('')
                        setFormOpen(true)
                      }}
                    >
                      Ubah
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
