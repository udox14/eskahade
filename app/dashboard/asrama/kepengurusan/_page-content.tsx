'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { Loader2, Plus, Save, Trash2, UserCog, Users } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { getKepengurusanAsramaData, saveKepengurusanAsrama } from './actions'

type GuruOption = { id: number; nama: string }
type PersonDraft = {
  localId: string
  source: 'guru' | 'manual'
  guru_id: number | ''
  nama: string
}
type PembinaKamarDraft = PersonDraft & { kamar: string }

function makePersonDraft(row?: { guru_id: number | null; nama: string } | null): PersonDraft {
  return {
    localId: crypto.randomUUID(),
    source: row?.guru_id ? 'guru' : 'manual',
    guru_id: row?.guru_id ?? '',
    nama: row?.nama ?? '',
  }
}

function makePembinaKamarDraft(kamar: string, row?: { guru_id: number | null; nama: string } | null): PembinaKamarDraft {
  return { ...makePersonDraft(row), kamar }
}

function PersonEditor({
  value,
  guruOptions,
  onChange,
  removable,
  onRemove,
}: {
  value: PersonDraft
  guruOptions: GuruOption[]
  onChange: (next: PersonDraft) => void
  removable?: boolean
  onRemove?: () => void
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-2">
        {(['guru', 'manual'] as const).map((source) => (
          <button
            key={source}
            type="button"
            onClick={() => onChange({ ...value, source, guru_id: '', nama: '' })}
            className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
              value.source === source ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            {source === 'guru' ? 'Pilih Guru' : 'Input Manual'}
          </button>
        ))}
      </div>
      <div className="mt-3">
        {value.source === 'guru' ? (
          <select
            value={value.guru_id}
            onChange={(event) => {
              const guruId = event.target.value ? Number(event.target.value) : ''
              const selected = guruOptions.find((guru) => guru.id === guruId)
              onChange({ ...value, guru_id: guruId, nama: selected?.nama ?? '' })
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">-- Pilih Guru --</option>
            {guruOptions.map((guru) => (
              <option key={guru.id} value={guru.id}>
                {guru.nama}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={value.nama}
            onChange={(event) => onChange({ ...value, nama: event.target.value })}
            placeholder="Nama pengurus"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}
      </div>
      {removable && onRemove ? (
        <button type="button" onClick={onRemove} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-red-600">
          <Trash2 className="h-3 w-3" /> Hapus
        </button>
      ) : null}
    </div>
  )
}

export default function PageContent({ userRole, asramaBinaan }: { userRole: string; asramaBinaan: string | null }) {
  const [asramaOptions, setAsramaOptions] = useState<string[]>([])
  const [selectedAsrama, setSelectedAsrama] = useState(asramaBinaan ?? '')
  const [guruOptions, setGuruOptions] = useState<GuruOption[]>([])
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

  const isAdmin = userRole === 'admin'

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

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      <DashboardPageHeader
        title="Kepengurusan Asrama"
        description="Atur struktur pengurus inti, sekretaris, bendahara, dan pembina kamar untuk tiap asrama."
        action={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {isAdmin ? (
              <select
                value={selectedAsrama}
                onChange={(event) => {
                  const next = event.target.value
                  setSelectedAsrama(next)
                  load(next)
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 sm:min-w-64"
              >
                {asramaOptions.map((asrama) => (
                  <option key={asrama} value={asrama}>
                    {asrama}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
                Asrama binaan: {selectedAsrama || asramaBinaan || '-'}
              </div>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={pending || loading || !selectedAsrama}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:bg-slate-300"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">Pembina Kamar</p>
          <p className="mt-2 text-3xl font-black text-indigo-800">{filledSummary.pembinaKamar}/{roomOptions.length}</p>
        </div>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-500">Sekretaris</p>
          <p className="mt-2 text-3xl font-black text-emerald-800">{filledSummary.sekretaris}</p>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-500">Bendahara</p>
          <p className="mt-2 text-3xl font-black text-amber-800">{filledSummary.bendahara}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Kamar Terdeteksi</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{roomOptions.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-slate-600" />
                <h2 className="text-lg font-black text-slate-900">Pengurus Inti</h2>
              </div>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Pembina Asrama</p>
                <PersonEditor value={inti.pembina_asrama} guruOptions={guruOptions} onChange={(next) => setInti((prev) => ({ ...prev, pembina_asrama: next }))} />
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Rois / Roisah</p>
                <PersonEditor value={inti.rois} guruOptions={guruOptions} onChange={(next) => setInti((prev) => ({ ...prev, rois: next }))} />
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Wakil Rois / Roisah</p>
                <PersonEditor value={inti.wakil_rois} guruOptions={guruOptions} onChange={(next) => setInti((prev) => ({ ...prev, wakil_rois: next }))} />
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-600" />
                  <h2 className="text-lg font-black text-slate-900">Sekretaris</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSekretaris((prev) => [...prev, makePersonDraft()])}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"
                >
                  <Plus className="h-3 w-3" /> Tambah
                </button>
              </div>
              <div className="space-y-3 p-5">
                {sekretaris.map((item) => (
                  <PersonEditor
                    key={item.localId}
                    value={item}
                    guruOptions={guruOptions}
                    onChange={(next) => setSekretaris((prev) => prev.map((row) => row.localId === item.localId ? next : row))}
                    removable={sekretaris.length > 1}
                    onRemove={() => setSekretaris((prev) => prev.filter((row) => row.localId !== item.localId))}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-600" />
                  <h2 className="text-lg font-black text-slate-900">Bendahara</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setBendahara((prev) => [...prev, makePersonDraft()])}
                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-700"
                >
                  <Plus className="h-3 w-3" /> Tambah
                </button>
              </div>
              <div className="space-y-3 p-5">
                {bendahara.map((item) => (
                  <PersonEditor
                    key={item.localId}
                    value={item}
                    guruOptions={guruOptions}
                    onChange={(next) => setBendahara((prev) => prev.map((row) => row.localId === item.localId ? next : row))}
                    removable={bendahara.length > 1}
                    onRemove={() => setBendahara((prev) => prev.filter((row) => row.localId !== item.localId))}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-black text-slate-900">Pembina Kamar</h2>
              <p className="mt-1 text-sm text-slate-500">Jumlah baris mengikuti kamar yang sudah terdeteksi di asrama ini.</p>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-3">
              {pembinaKamar.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-12 text-center text-sm text-slate-400">
                  Belum ada kamar terdeteksi. Atur kamar dulu di fitur Kamar atau Perpindahan Kamar.
                </div>
              ) : (
                pembinaKamar.map((item) => (
                  <div key={item.kamar}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Kamar {item.kamar}</p>
                    <PersonEditor
                      value={item}
                      guruOptions={guruOptions}
                      onChange={(next) => setPembinaKamar((prev) => prev.map((row) => row.kamar === item.kamar ? { ...next, kamar: row.kamar } : row))}
                    />
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
