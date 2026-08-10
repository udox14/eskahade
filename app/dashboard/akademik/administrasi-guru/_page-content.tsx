'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckSquare2,
  Download,
  FileText,
  Loader2,
  Printer,
  Search,
  Square,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { useReactToPrint } from '@/lib/pdf/client'
import { getAdministrasiGuruBundle, getGuruAdministrasiOptions } from './actions'
import {
  buildAdministrasiPages,
  safeDocumentFilename,
  teacherDisplayName,
} from './_document-model'
import { AdministrasiPrintDocument, ADMINISTRASI_PRINT_CSS } from './_print-document'
import type {
  AdministrasiBundle,
  AdministrasiKind,
  GuruAdministrasiOption,
} from './types'

const KIND_OPTIONS: Array<{ id: AdministrasiKind; label: string; detail: string }> = [
  { id: 'absensi', label: 'Rekap Absensi', detail: '1 lembar per chunk kelas' },
  { id: 'hafalan', label: 'Catatan Hafalan', detail: '3 lembar identik per chunk kelas' },
  { id: 'nilai', label: 'Rekap Nilai', detail: '1 lembar per chunk kelas' },
]

function optionLabel(guru: GuruAdministrasiOption) {
  const name = [guru.nama_lengkap, guru.gelar].filter(Boolean).join(', ')
  return `${name} — ${guru.kelas.join(', ')}`
}

export default function AdministrasiGuruPageContent() {
  const [guruOptions, setGuruOptions] = useState<GuruAdministrasiOption[]>([])
  const [selectedGuru, setSelectedGuru] = useState('')
  const [selectedKinds, setSelectedKinds] = useState<AdministrasiKind[]>(['absensi', 'hafalan', 'nilai'])
  const [bundle, setBundle] = useState<AdministrasiBundle | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingBundle, setLoadingBundle] = useState(false)
  const [exportingWord, setExportingWord] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    getGuruAdministrasiOptions()
      .then(data => { if (active) setGuruOptions(data) })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Daftar guru gagal dimuat.'))
      .finally(() => { if (active) setLoadingOptions(false) })
    return () => { active = false }
  }, [])

  const pages = useMemo(
    () => bundle ? buildAdministrasiPages(bundle, selectedKinds) : [],
    [bundle, selectedKinds]
  )

  const filename = bundle ? safeDocumentFilename(bundle) : 'Administrasi-Guru'
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: filename,
    filename: `${filename}.pdf`,
    pageStyle: ADMINISTRASI_PRINT_CSS,
    pdfOptions: {
      printBackground: true,
      preferCSSPageSize: true,
      landscape: true,
    },
    onPrintError: (_location, error) => {
      toast.error(error instanceof Error ? error.message : 'Dokumen gagal dicetak.')
    },
  })

  function toggleKind(kind: AdministrasiKind) {
    setSelectedKinds(current => {
      if (current.includes(kind)) {
        if (current.length === 1) {
          toast.error('Minimal satu jenis blanko harus dipilih.')
          return current
        }
        return current.filter(item => item !== kind)
      }
      return [...current, kind]
    })
  }

  async function loadBundle() {
    if (!selectedGuru) {
      toast.error('Pilih guru terlebih dahulu.')
      return
    }
    setLoadingBundle(true)
    setBundle(null)
    try {
      const result = await getAdministrasiGuruBundle(Number(selectedGuru))
      setBundle(result)
      toast.success(`${result.kelas.length} kelas siap dicetak.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bundle administrasi gagal dimuat.')
    } finally {
      setLoadingBundle(false)
    }
  }

  async function downloadWord() {
    if (!bundle) return
    setExportingWord(true)
    try {
      const { downloadAdministrasiGuruDocx } = await import('./_docx-export')
      await downloadAdministrasiGuruDocx(bundle, selectedKinds)
      toast.success('Dokumen Word berhasil dibuat.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Dokumen Word gagal dibuat.')
    } finally {
      setExportingWord(false)
    }
  }

  const totalStudents = bundle?.kelas.reduce((sum, kelas) => sum + kelas.santri.length, 0) ?? 0

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-20">
      <style>{ADMINISTRASI_PRINT_CSS}</style>
      <DashboardPageHeader
        title="Cetak Administrasi Guru"
        description="Pilih guru, tentukan blanko, lalu cetak satu bundle untuk seluruh kelas yang diajarnya."
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
          <div>
            <label htmlFor="guru-administrasi" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Pilih Guru
            </label>
            <select
              id="guru-administrasi"
              value={selectedGuru}
              disabled={loadingOptions}
              onChange={event => { setSelectedGuru(event.target.value); setBundle(null) }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
            >
              <option value="">{loadingOptions ? 'Memuat daftar guru...' : '-- Pilih guru pengajar --'}</option>
              {guruOptions.map(guru => <option key={guru.id} value={guru.id}>{optionLabel(guru)}</option>)}
            </select>
            {!loadingOptions && guruOptions.length === 0 ? (
              <p className="mt-2 text-sm text-amber-700">Belum ada guru yang terhubung ke kelas pada tahun ajaran aktif.</p>
            ) : null}
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Jenis Blanko</div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {KIND_OPTIONS.map(option => {
                const checked = selectedKinds.includes(option.id)
                return (
                  <button
                    type="button"
                    key={option.id}
                    onClick={() => toggleKind(option.id)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${checked ? 'border-indigo-300 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {checked ? <CheckSquare2 className="h-5 w-5 shrink-0 text-indigo-600" /> : <Square className="h-5 w-5 shrink-0" />}
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{option.label}</span>
                      <span className="block text-[11px] text-slate-500">{option.detail}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">F4 landscape · 45 santri per halaman · seluruh dokumen memakai Arial Narrow</p>
          <button
            type="button"
            disabled={loadingBundle || !selectedGuru}
            onClick={loadBundle}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingBundle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loadingBundle ? 'Menyiapkan...' : 'Tampilkan Bundle'}
          </button>
        </div>
      </section>

      {bundle ? (
        <>
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black text-emerald-950">
                  <FileText className="h-5 w-5" /> {teacherDisplayName(bundle)}
                </h2>
                <p className="mt-1 text-sm text-emerald-800">
                  {bundle.kelas.length} kelas · {totalStudents} santri · {pages.length} halaman bundle
                </p>
                <p className="mt-1 text-xs text-emerald-700">{bundle.kelas.map(kelas => kelas.nama_kelas).join(' · ')}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => handlePrint()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800"
                >
                  <Printer className="h-4 w-4" /> Cetak / PDF
                </button>
                <button
                  type="button"
                  disabled={exportingWord}
                  onClick={downloadWord}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-white px-5 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
                >
                  {exportingWord ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {exportingWord ? 'Membuat Word...' : 'Unduh Word'}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-100 p-3 shadow-inner">
            <div className="mb-3 flex items-center justify-between px-1 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> Preview siap cetak</span>
              <span>Geser horizontal jika layar sempit</span>
            </div>
            <div className="max-h-[75vh] overflow-auto rounded-xl">
              <div ref={printRef}>
                <AdministrasiPrintDocument pages={pages} />
              </div>
            </div>
          </section>
        </>
      ) : null}
    </main>
  )
}
