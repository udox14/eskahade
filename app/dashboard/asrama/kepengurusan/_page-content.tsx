'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { Loader2, Plus, Save, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { getKepengurusanAsramaData, saveKepengurusanAsrama } from './actions'

type GuruOption = { id: number; nama: string }
type SadesaOption = { id: string; nama: string; asrama: string | null; kamar: string | null }
type PersonDraft = {
  localId: string
  source: 'guru' | 'sadesa'
  guru_id: number | ''
  nama: string
}
type PembinaKamarDraft = PersonDraft & { kamar: string }

function makePersonDraft(row?: { guru_id: number | null; nama: string } | null): PersonDraft {
  return {
    localId: crypto.randomUUID(),
    source: row?.guru_id ? 'guru' : 'sadesa',
    guru_id: row?.guru_id ?? '',
    nama: row?.nama ?? '',
  }
}

function makePembinaKamarDraft(kamar: string, row?: { guru_id: number | null; nama: string } | null): PembinaKamarDraft {
  return { ...makePersonDraft(row), kamar }
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
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

function PersonInput({
  value,
  guruOptions,
  sadesaOptions,
  onChange,
}: {
  value: PersonDraft
  guruOptions: GuruOption[]
  sadesaOptions: SadesaOption[]
  onChange: (next: PersonDraft) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center">
      <select
        value={value.source}
        onChange={(event) => onChange({ ...value, source: event.target.value as 'guru' | 'sadesa', guru_id: '', nama: '' })}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="guru">Guru</option>
        <option value="sadesa">SADESA</option>
      </select>
      {value.source === 'guru' ? (
        <select
          value={value.guru_id}
          onChange={(event) => {
            const guruId = event.target.value ? Number(event.target.value) : ''
            const selected = guruOptions.find((guru) => guru.id === guruId)
            onChange({ ...value, guru_id: guruId, nama: selected?.nama ?? '' })
          }}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">-- Pilih Guru --</option>
            {guruOptions.map((guru) => (
              <option key={guru.id} value={guru.id}>
                {guru.nama}
              </option>
            ))}
          </select>
      ) : (
        <select
          value={value.nama}
          onChange={(event) => {
            const selected = sadesaOptions.find((item) => item.id === event.target.value)
            onChange({ ...value, nama: selected?.nama ?? '' })
          }}
          className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">-- Pilih SADESA --</option>
          {sadesaOptions.map((santri) => (
            <option key={santri.id} value={santri.id}>
              {santri.nama}{santri.kamar ? ` · Kamar ${santri.kamar}` : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

export default function PageContent({ userRole, asramaBinaan }: { userRole: string; asramaBinaan: string | null }) {
  const [asramaOptions, setAsramaOptions] = useState<string[]>([])
  const [selectedAsrama, setSelectedAsrama] = useState(asramaBinaan ?? '')
  const [guruOptions, setGuruOptions] = useState<GuruOption[]>([])
  const [sadesaOptions, setSadesaOptions] = useState<SadesaOption[]>([])
  const [roomOptions, setRoomOptions] = useState<string[]>([])
  const [inti, setInti] = useState({
    pembina_asrama: makePersonDraft(),
    rois: makePersonDraft(),
    wakil_rois: makePersonDraft(),
  })
  const [sekretaris, setSekretaris] = useState<PersonDraft[]>([])
  const [bendahara, setBendahara] = useState<PersonDraft[]>([])
  const [pembinaKamar, setPembinaKamar] = useState<PembinaKamarDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  const isAdminLikeRead = userRole === 'admin' || userRole === 'tester'

  const load = useCallback(async (targetAsrama?: string) => {
    setLoading(true)
    const result = await getKepengurusanAsramaData(targetAsrama || selectedAsrama || asramaBinaan)
    if ('error' in result) {
      toast.error(result.error)
      setLoading(false)
      return
    }

    setAsramaOptions(result.asramaOptions)
    setSelectedAsrama(result.currentAsrama)
    setGuruOptions(result.guruOptions)
    setSadesaOptions(result.sadesaOptions ?? [])
    setRoomOptions(result.roomOptions)
    setInti({
      pembina_asrama: makePersonDraft(result.inti.pembina_asrama),
      rois: makePersonDraft(result.inti.rois),
      wakil_rois: makePersonDraft(result.inti.wakil_rois),
    })
    setSekretaris(result.sekretaris.length ? result.sekretaris.map((row: any) => makePersonDraft(row)) : [makePersonDraft()])
    setBendahara(result.bendahara.length ? result.bendahara.map((row: any) => makePersonDraft(row)) : [makePersonDraft()])
    setPembinaKamar(result.roomOptions.map((kamar, index) => makePembinaKamarDraft(kamar, result.pembinaKamar[index])))
    setLoading(false)
  }, [asramaBinaan, selectedAsrama])

  useEffect(() => {
    load(asramaBinaan ?? selectedAsrama)
  }, [asramaBinaan, load])

  const filledSummary = useMemo(() => ({
    sekretaris: sekretaris.filter((item) => item.nama.trim()).length,
    bendahara: bendahara.filter((item) => item.nama.trim()).length,
    pembinaKamar: pembinaKamar.filter((item) => item.nama.trim()).length,
  }), [bendahara, pembinaKamar, sekretaris])

  const submit = () => {
    startTransition(async () => {
      const serializePerson = (item: PersonDraft) => ({
        guru_id: item.guru_id === '' ? null : Number(item.guru_id),
        nama: item.nama,
        source: item.source,
      })

      const result = await saveKepengurusanAsrama({
        asrama: selectedAsrama,
        inti: {
          pembina_asrama: serializePerson(inti.pembina_asrama),
          rois: serializePerson(inti.rois),
          wakil_rois: serializePerson(inti.wakil_rois),
        },
        sekretaris: sekretaris.map(serializePerson),
        bendahara: bendahara.map(serializePerson),
        pembinaKamar: pembinaKamar.map((item) => ({
          ...serializePerson(item),
          kamar: item.kamar,
        })),
      })

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success('Kepengurusan asrama disimpan')
      await load(selectedAsrama)
    })
  }

  const intiRows = [
    { key: 'pembina_asrama', label: 'Pembina Asrama', value: inti.pembina_asrama },
    { key: 'rois', label: 'Rois / Roisah', value: inti.rois },
    { key: 'wakil_rois', label: 'Wakil Rois / Roisah', value: inti.wakil_rois },
  ] as const

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-20">
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <DashboardPageHeader
          title="Kepengurusan Asrama"
          description="Atur pengurus inti, sekretaris, bendahara, dan pembina kamar per asrama."
          className="flex-1"
        />
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          {isAdminLikeRead ? (
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
              Asrama binaan: {selectedAsrama || asramaBinaan || '-'} · Pilihan pengurus dari Guru atau SADESA
            </div>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={pending || loading || !selectedAsrama}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:bg-slate-300"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Pembina Kamar" value={`${filledSummary.pembinaKamar}/${roomOptions.length}`} tone="indigo" />
        <SummaryCard label="Sekretaris" value={filledSummary.sekretaris} tone="green" />
        <SummaryCard label="Bendahara" value={filledSummary.bendahara} tone="amber" />
        <SummaryCard label="Kamar Terdeteksi" value={roomOptions.length} tone="slate" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Users className="h-8 w-8 animate-pulse text-slate-300" />
        </div>
      ) : (
        <>
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-4 border-b bg-slate-50">
              <h2 className="font-bold text-slate-800">Pengurus Inti</h2>
              <p className="text-sm text-slate-500">Struktur utama kepengurusan asrama.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white border-b text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Jabatan</th>
                    <th className="px-4 py-3 text-left">Pengurus</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {intiRows.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.label}</td>
                      <td className="px-4 py-3">
                        <PersonInput
                          value={row.value}
                          guruOptions={guruOptions}
                          sadesaOptions={sadesaOptions}
                          onChange={(next) => setInti((prev) => ({ ...prev, [row.key]: next }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-4 border-b bg-slate-50 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-800">Sekretaris</h2>
                <p className="text-sm text-slate-500">Bisa diisi lebih dari satu orang.</p>
              </div>
              <button
                type="button"
                onClick={() => setSekretaris((prev) => [...prev, makePersonDraft()])}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"
              >
                <Plus className="h-3 w-3" /> Tambah
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white border-b text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left w-16">No</th>
                    <th className="px-4 py-3 text-left">Pengurus</th>
                    <th className="px-4 py-3 text-left w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sekretaris.map((item, index) => (
                    <tr key={item.localId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-500">{index + 1}</td>
                      <td className="px-4 py-3">
                        <PersonInput
                          value={item}
                          guruOptions={guruOptions}
                          sadesaOptions={sadesaOptions}
                          onChange={(next) => setSekretaris((prev) => prev.map((row) => row.localId === item.localId ? next : row))}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSekretaris((prev) => prev.length > 1 ? prev.filter((row) => row.localId !== item.localId) : prev)}
                          disabled={sekretaris.length <= 1}
                          className="inline-flex items-center gap-1 text-xs font-bold text-red-600 disabled:text-slate-300"
                        >
                          <Trash2 className="h-3 w-3" /> Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-4 border-b bg-slate-50 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-800">Bendahara</h2>
                <p className="text-sm text-slate-500">Bisa diisi lebih dari satu orang.</p>
              </div>
              <button
                type="button"
                onClick={() => setBendahara((prev) => [...prev, makePersonDraft()])}
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-700"
              >
                <Plus className="h-3 w-3" /> Tambah
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white border-b text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left w-16">No</th>
                    <th className="px-4 py-3 text-left">Pengurus</th>
                    <th className="px-4 py-3 text-left w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bendahara.map((item, index) => (
                    <tr key={item.localId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-500">{index + 1}</td>
                      <td className="px-4 py-3">
                        <PersonInput
                          value={item}
                          guruOptions={guruOptions}
                          sadesaOptions={sadesaOptions}
                          onChange={(next) => setBendahara((prev) => prev.map((row) => row.localId === item.localId ? next : row))}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setBendahara((prev) => prev.length > 1 ? prev.filter((row) => row.localId !== item.localId) : prev)}
                          disabled={bendahara.length <= 1}
                          className="inline-flex items-center gap-1 text-xs font-bold text-red-600 disabled:text-slate-300"
                        >
                          <Trash2 className="h-3 w-3" /> Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-4 border-b bg-slate-50">
              <h2 className="font-bold text-slate-800">Pembina Kamar</h2>
              <p className="text-sm text-slate-500">Daftar mengikuti kamar yang sudah terdeteksi di asrama ini.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white border-b text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left w-28">Kamar</th>
                    <th className="px-4 py-3 text-left">Pembina</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pembinaKamar.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-16 text-center text-slate-400">
                        Belum ada kamar terdeteksi. Atur kamar dulu di fitur Kamar atau Perpindahan Kamar.
                      </td>
                    </tr>
                  ) : (
                    pembinaKamar.map((item) => (
                      <tr key={item.kamar} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-700">Kamar {item.kamar}</td>
                        <td className="px-4 py-3">
                          <PersonInput
                            value={item}
                            guruOptions={guruOptions}
                            sadesaOptions={sadesaOptions}
                            onChange={(next) => setPembinaKamar((prev) => prev.map((row) => row.kamar === item.kamar ? { ...next, kamar: row.kamar } : row))}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
