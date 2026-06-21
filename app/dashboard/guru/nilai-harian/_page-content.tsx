'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CalendarDays, ClipboardList, Loader2, Save, Table2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { Button, NativeSelect, TextInput, NumberInput, Textarea, SegmentedControl, Paper } from '@mantine/core'
import {
  getNilaiHarianInitialData,
  getNilaiHarianInputData,
  getNilaiHarianRekap,
  getNilaiHarianSesi,
  simpanNilaiHarian,
} from './actions'

type TabKey = 'input' | 'rekap'

function todayLocal() {
  return new Date().toISOString().slice(0, 10)
}

export default function NilaiHarianContent() {
  const [tab, setTab] = useState<TabKey>('input')
  const [kelasList, setKelasList] = useState<any[]>([])
  const [mapelList, setMapelList] = useState<any[]>([])
  const [kelasId, setKelasId] = useState('')
  const [mapelId, setMapelId] = useState('')
  const [sesiList, setSesiList] = useState<any[]>([])
  const [sesiId, setSesiId] = useState('')
  const [tanggal, setTanggal] = useState(todayLocal())
  const [namaSesi, setNamaSesi] = useState('Ulangan Harian 1')
  const [kkm, setKkm] = useState(70)
  const [deskripsi, setDeskripsi] = useState('')
  const [santri, setSantri] = useState<any[]>([])
  const [nilai, setNilai] = useState<Record<string, number>>({})
  const [rekap, setRekap] = useState<any>({ sesi: [], santri: [], nilai: {} })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getNilaiHarianInitialData().then(data => {
      setKelasList(data.kelas)
      setMapelList(data.mapel)
      if (data.kelas.length === 1) setKelasId(data.kelas[0].id)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!kelasId) return
    getNilaiHarianSesi(kelasId, mapelId ? Number(mapelId) : undefined).then(setSesiList)
    getNilaiHarianInputData(kelasId, sesiId || undefined).then(data => {
      setSantri(data.santri)
      setNilai(data.nilai)
    })
  }, [kelasId, mapelId, sesiId])

  useEffect(() => {
    if (!kelasId || tab !== 'rekap') return
    getNilaiHarianRekap(kelasId, mapelId ? Number(mapelId) : undefined).then(setRekap)
  }, [kelasId, mapelId, tab])

  const selectedSesi = useMemo(() => sesiList.find(s => s.id === sesiId), [sesiList, sesiId])

  useEffect(() => {
    if (!selectedSesi) return
    setMapelId(String(selectedSesi.mapel_id))
    setTanggal(selectedSesi.tanggal)
    setNamaSesi(selectedSesi.nama_sesi)
    setKkm(Number(selectedSesi.kkm || 0))
    setDeskripsi(selectedSesi.deskripsi || '')
  }, [selectedSesi])

  const resetSesi = () => {
    setSesiId('')
    setNamaSesi('Ulangan Harian 1')
    setTanggal(todayLocal())
    setKkm(70)
    setDeskripsi('')
    setNilai({})
  }

  const handleSave = async () => {
    if (!kelasId || !mapelId) return toast.warning('Pilih kelas dan mapel terlebih dahulu.')
    setSaving(true)
    const res = await simpanNilaiHarian({
      kelasId,
      mapelId: Number(mapelId),
      sesiId: sesiId || null,
      tanggal,
      namaSesi,
      kkm,
      deskripsi,
      nilai: santri.map(row => ({ riwayatId: row.riwayat_id, nilai: nilai[row.riwayat_id] ?? 0 })),
    })
    setSaving(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success('Nilai harian disimpan')
    setSesiId(res.sesiId)
    setSesiList(await getNilaiHarianSesi(kelasId, Number(mapelId)))
  }

  return (
    <div className="space-y-5 pb-20">
      <DashboardPageHeader
        title="Nilai Harian"
        description="Input sesi penilaian harian dan lihat rekap nilai per santri."
      />

      <Paper withBorder p="md" radius="lg">
        <div className="grid gap-3 md:grid-cols-3">
          {kelasList.length > 1 && (
            <NativeSelect
              label="Kelas"
              value={kelasId}
              onChange={e => setKelasId(e.target.value)}
              data={[{ label: 'Pilih kelas', value: '' }, ...kelasList.map(k => ({ label: k.nama_kelas, value: k.id }))]}
            />
          )}
          {kelasList.length === 1 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-xs font-bold uppercase text-emerald-600">Kelas</p>
              <p className="font-semibold text-emerald-900">{kelasList[0].nama_kelas}</p>
            </div>
          )}
          <NativeSelect
            label="Mapel"
            value={mapelId}
            onChange={e => setMapelId(e.target.value)}
            data={[{ label: 'Pilih mapel', value: '' }, ...mapelList.map(m => ({ label: m.nama, value: String(m.id) }))]}
          />
          <div className="flex flex-col justify-end">
            <SegmentedControl
              value={tab}
              onChange={v => setTab(v as TabKey)}
              data={[{ label: 'Input', value: 'input' }, { label: 'Rekap', value: 'rekap' }]}
              fullWidth
            />
          </div>
        </div>
      </Paper>

      {loading ? (
        <Paper withBorder p="xl" className="text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></Paper>
      ) : !kelasId ? (
        <Paper withBorder p="xl" className="text-center text-slate-400">Belum ada kelas yang bisa diakses.</Paper>
      ) : tab === 'input' ? (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <Paper withBorder p="md" radius="lg">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold text-slate-800"><ClipboardList className="h-4 w-4 text-emerald-600" /> Sesi</h2>
              <Button onClick={resetSesi} variant="subtle" color="teal" size="compact-xs">Baru</Button>
            </div>
            <NativeSelect
              value={sesiId}
              onChange={e => setSesiId(e.target.value)}
              data={[{ label: 'Sesi baru', value: '' }, ...sesiList.map(s => ({ label: `${s.nama_sesi} - ${s.tanggal}`, value: s.id }))]}
              mb="sm"
            />
            <div className="space-y-3">
              <TextInput
                value={namaSesi}
                onChange={e => setNamaSesi(e.target.value)}
                placeholder="Ulangan Harian 1"
              />
              <TextInput
                type="date"
                value={tanggal}
                onChange={e => setTanggal(e.target.value)}
              />
              <NumberInput
                value={kkm}
                onChange={v => setKkm(Number(v || 0))}
                placeholder="KKM"
                min={0}
                max={100}
              />
              <Textarea
                value={deskripsi}
                onChange={e => setDeskripsi(e.target.value)}
                placeholder="Deskripsi opsional"
                minRows={3}
              />
            </div>
          </Paper>

          <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
            <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
              <h2 className="flex items-center gap-2 font-bold text-slate-800"><BookOpen className="h-4 w-4 text-emerald-600" /> Daftar Nilai</h2>
              <Button onClick={handleSave} loading={saving} disabled={!mapelId} color="teal" size="sm" leftSection={!saving ? <Save className="h-4 w-4"/> : undefined}>
                Simpan
              </Button>
            </div>
            <div className="space-y-3 p-3 md:hidden">
              {santri.map((row, idx) => (
                <div key={row.riwayat_id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase text-slate-400">No. {idx + 1}</p>
                      <p className="truncate font-semibold text-slate-800">{row.nama}</p>
                      <p className="text-xs text-slate-400">{row.nis || '-'}</p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      inputMode="numeric"
                      value={nilai[row.riwayat_id] ?? 0}
                      onChange={e => setNilai(prev => ({ ...prev, [row.riwayat_id]: Number(e.target.value || 0) }))}
                      className="h-12 w-24 shrink-0 rounded-lg border border-slate-200 text-center text-lg font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              ))}
              {santri.length > 0 && (
                <Button onClick={handleSave} loading={saving} disabled={!mapelId} color="teal" radius="xl" size="md" fullWidth leftSection={!saving ? <Save className="h-4 w-4"/> : undefined} className="sticky bottom-16 z-10 shadow-lg">
                  Simpan Nilai
                </Button>
              )}
              {santri.length === 0 && <div className="py-12 text-center text-slate-400">Belum ada santri aktif.</div>}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-white text-xs text-slate-500">
                  <tr><th className="w-14 px-3 py-2 text-center">No</th><th className="px-3 py-2 text-left">Santri</th><th className="w-32 px-3 py-2 text-center">Nilai</th></tr>
                </thead>
                <tbody className="divide-y">
                  {santri.map((row, idx) => (
                    <tr key={row.riwayat_id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center text-xs text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2"><p className="font-semibold text-slate-800">{row.nama}</p><p className="text-xs text-slate-400">{row.nis || '-'}</p></td>
                      <td className="px-3 py-2">
                        <input type="number" min={0} max={100} inputMode="numeric" value={nilai[row.riwayat_id] ?? 0} onChange={e => setNilai(prev => ({ ...prev, [row.riwayat_id]: Number(e.target.value || 0) }))} className="h-10 w-full rounded-lg border border-slate-200 text-center font-bold text-emerald-700" />
                      </td>
                    </tr>
                  ))}
                  {santri.length === 0 && <tr><td colSpan={3} className="py-12 text-center text-slate-400">Belum ada santri aktif.</td></tr>}
                </tbody>
              </table>
            </div>
          </Paper>
        </div>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
          <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-3 font-bold text-slate-800">
            <Table2 className="h-4 w-4 text-emerald-600" /> Rekap Nilai Harian
          </div>
          <div className="space-y-3 p-3 md:hidden">
            {rekap.santri.map((row: any) => (
              <div key={row.riwayat_id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-3">
                  <p className="font-semibold text-slate-900">{row.nama}</p>
                  <p className="text-xs text-slate-400">{row.nis || '-'}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {rekap.sesi.map((s: any) => (
                    <div key={s.id} className="rounded-lg bg-slate-50 p-2">
                      <p className="truncate text-xs font-bold text-slate-700">{s.nama_sesi}</p>
                      <p className="text-[10px] text-slate-400">{s.tanggal}</p>
                      <p className="mt-1 text-lg font-black text-emerald-700">{rekap.nilai[`${row.riwayat_id}:${s.id}`] ?? '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {rekap.sesi.length === 0 && <div className="p-12 text-center text-slate-400">Belum ada sesi nilai harian.</div>}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-white text-slate-500">
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left">Santri</th>
                  {rekap.sesi.map((s: any) => <th key={s.id} className="px-3 py-2 text-center"><CalendarDays className="mx-auto mb-1 h-3 w-3" />{s.nama_sesi}<br /><span className="font-normal">{s.tanggal}</span></th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rekap.santri.map((row: any) => (
                  <tr key={row.riwayat_id}>
                    <td className="sticky left-0 bg-white px-3 py-2 font-semibold">{row.nama}</td>
                    {rekap.sesi.map((s: any) => <td key={s.id} className="px-3 py-2 text-center font-mono">{rekap.nilai[`${row.riwayat_id}:${s.id}`] ?? '-'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {rekap.sesi.length === 0 && <div className="p-12 text-center text-slate-400">Belum ada sesi nilai harian.</div>}
          </div>
        </Paper>
      )}
    </div>
  )
}
