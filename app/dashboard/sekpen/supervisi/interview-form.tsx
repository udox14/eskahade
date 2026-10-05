'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useReactToPrint } from '@/lib/pdf/client'
import type { resolveDocumentLetterhead } from '@/lib/print/letterhead-server'
import { contextTime, contextBooks } from '@/lib/supervisi/context'
import type { Interview } from '@/lib/supervisi/types'
import { AutosaveQueue } from '@/lib/supervisi/autosave'
import {
  ITEMS,
  SECTIONS,
  SCALE,
  OPENING,
  GUIDANCE,
  CLOSING,
  isAnswered,
  completedCount,
  type Answer,
} from '@/lib/supervisi/instrument'
import { getInterview, getInterviewHistory, saveInterview } from './actions'
import { buttonClass, inputClass, secondaryClass } from '@/components/supervisi/styles'
import PrintView, { PRINT_CSS } from './print-view'
import IdentityEditor from './identity-editor'
import {
  ArrowLeft,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  Printer,
  WarningCircle,
  CircleNotch,
  Clock,
  Quotes,
  LockOpen,
} from '@phosphor-icons/react'

type History = Awaited<ReturnType<typeof getInterviewHistory>>

export default function InterviewForm({
  initial,
  history: initialHistory,
  letterhead,
}: {
  initial: Interview
  history: History
  letterhead: Awaited<ReturnType<typeof resolveDocumentLetterhead>>
}) {
  const router = useRouter()
  const [interview, setInterview] = useState(initial)
  const [answers, setAnswers] = useState(initial.answers)
  const [tanggal, setTanggal] = useState(initial.tanggal)
  const [position, setPosition] = useState(initial.editable ? 0 : 11)
  const [history, setHistory] = useState(initialHistory)
  const [, render] = useState(0)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  const [latest, setLatest] = useState<Interview | null>(null)
  const [printable, setPrintable] = useState(initial)
  const [printOpen, setPrintOpen] = useState(false)

  const [queue] = useState(
    () => new AutosaveQueue(initial.id, initial.revision, saveInterview, () => render((n) => n + 1))
  )
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const count = completedCount(answers)
  const editable = interview.editable && !busy

  const steps = useMemo(
    () => [
      { title: 'Identitas & Pembukaan', position: 0, complete: true },
      ...SECTIONS.map((s, i) => ({
        title: s.title,
        position: i + 1,
        complete: s.items.every((item) => isAnswered(item, answers[item.id])),
      })),
      { title: 'Review & Penutup', position: 11, complete: interview.status === 'selesai' },
    ],
    [answers, interview.status]
  )

  const currentStep = steps[position] || steps[0]
  const currentSection = position >= 1 && position <= 10 ? SECTIONS[position - 1] : null

  // Autosave setup
  useEffect(() => {
    queue.stopped = false
    const before = (e: BeforeUnloadEvent) => {
      if (queue.dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    const online = () => {
      void queue.flush()
    }
    window.addEventListener('beforeunload', before)
    window.addEventListener('online', online)

    const retry = setInterval(() => {
      if (queue.dirty && !queue.conflict) void queue.flush()
    }, 5000)

    return () => {
      queue.stopped = true
      window.removeEventListener('beforeunload', before)
      window.removeEventListener('online', online)
      clearInterval(retry)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [queue])

  function change(itemId: string, value: Answer, immediate = false) {
    if (!editable) return
    setAnswers((a) => ({ ...a, [itemId]: value }))
    queue.edit(itemId, value)
    if (timer.current) clearTimeout(timer.current)
    if (immediate) {
      void queue.flush()
    } else {
      timer.current = setTimeout(() => void queue.flush(), 600)
    }
  }

  function navigate(n: number) {
    if (busy) return
    if (timer.current) clearTimeout(timer.current)
    void queue.flush()
    setPosition(Math.max(0, Math.min(11, n)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function leave() {
    if (busy) return
    if (queue.dirty && !(await queue.flush())) {
      setError('Ada jawaban yang belum tersimpan. Tunggu penyimpanan selesai sebelum meninggalkan halaman.')
      return
    }
    router.push('/dashboard/sekpen/supervisi')
  }

  async function refresh() {
    const [i, h] = await Promise.all([getInterview(interview.id), getInterviewHistory(interview.id)])
    setInterview(i)
    setAnswers(i.answers)
    setTanggal(i.tanggal)
    setHistory(h)
    queue.revision = i.revision
  }

  async function finalize() {
    setBusy(true)
    setError('')
    try {
      if (!(await queue.flush())) {
        setError(queue.error || 'Jawaban belum tersimpan sepenuhnya.')
        return
      }
      const r = await saveInterview({
        id: interview.id,
        revision: queue.revision,
        operationId: crypto.randomUUID(),
        patch: {},
        action: 'submit',
      })
      if (!r.ok) {
        setError(r.error)
      } else {
        await refresh()
        setPosition(11)
      }
    } catch {
      setError('Hasil wawancara belum dapat diselesaikan. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  async function reopen() {
    setBusy(true)
    setError('')
    try {
      const r = await saveInterview({
        id: interview.id,
        revision: queue.revision,
        operationId: crypto.randomUUID(),
        patch: {},
        action: 'reopen',
        reason,
      })
      if (!r.ok) {
        setError(r.error)
      } else {
        await refresh()
        setReason('')
      }
    } catch {
      setError('Hasil wawancara belum dapat dibuka kembali.')
    } finally {
      setBusy(false)
    }
  }

  async function fetchLatest() {
    try {
      setLatest(await getInterview(interview.id))
    } catch {
      setError('Versi terbaru wawancara tidak dapat dimuat.')
    }
  }

  async function rebase() {
    if (!latest) return
    if (!latest.editable) {
      setError('Versi terbaru sudah terkunci oleh sistem atau admin.')
      return
    }
    const local = { ...(queue.inflight?.patch ?? {}), ...queue.pending }
    setAnswers({ ...latest.answers, ...local })
    setTanggal(queue.tanggal ?? queue.inflight?.tanggal ?? latest.tanggal)
    setInterview(latest)
    queue.rebase(latest.revision)
    setLatest(null)
    setError('')
    await queue.flush()
  }

  const print = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Supervisi-${interview.identity.guru_nama}-${tanggal}`,
    pageStyle: PRINT_CSS,
    pdfOptions: {
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      printBackground: true,
      preferCSSPageSize: true,
    },
    onBeforePrint: async () => {
      if (queue.dirty && !(await queue.flush())) {
        throw new Error('Jawaban belum tersimpan.')
      }
      const i = await getInterview(interview.id)
      setPrintable(i)
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    },
    onPrintError: () => {
      setError('PDF belum dapat dibuat. Pastikan jawaban tersimpan, lalu coba lagi.')
    },
  })

  async function showPrint() {
    setBusy(true)
    setError('')
    try {
      if (queue.dirty && !(await queue.flush())) {
        setError('Simpan seluruh jawaban terlebih dahulu sebelum mencetak dokumen.')
        return
      }
      setPrintable(await getInterview(interview.id))
      setPrintOpen(true)
    } catch {
      setError('Hasil cetak belum dapat dimuat.')
    } finally {
      setBusy(false)
    }
  }

  const progressPercentage = Math.round((count / 53) * 100)

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-28">
      {/* ── 1. TOP BAR NAVIGASI & AKSI ── */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={leave}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" weight="bold" />
          <span>Rekap Supervisi</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 transition shadow-2xs"
            disabled={busy || queue.saving}
            onClick={showPrint}
          >
            <Printer className="w-4 h-4 text-slate-500" weight="duotone" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* ── 2. HEADER WAWANCARA & GURU ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Instrumen Supervisi Pengajar
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  interview.status === 'selesai'
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                    : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                }`}
              >
                {interview.status === 'selesai' ? 'Selesai & Terkunci' : 'Draft Wawancara'}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
              {interview.identity.guru_nama}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Kelas {interview.identity.kelas_nama} · {interview.identity.kitab_nama} · {interview.identity.kegiatan_nama}
            </p>
          </div>

          {/* Indikator Status Autosave */}
          <div className="flex items-center gap-2 shrink-0">
            {queue.saving ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                <CircleNotch className="w-3.5 h-3.5 animate-spin text-slate-400" />
                <span>Menyimpan...</span>
              </span>
            ) : queue.dirty ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/60">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Belum tersimpan</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
                <Check className="w-3.5 h-3.5 text-emerald-600" weight="bold" />
                <span>Tersimpan otomatis</span>
              </span>
            )}
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
            <span>
              Kelengkapan: <strong className="text-slate-900">{count}</strong> dari 53 item terisi
            </span>
            <span className="font-mono text-slate-400">{progressPercentage}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                count === 53 ? 'bg-emerald-600' : 'bg-emerald-500'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Notifikasi Error / Conflict */}
      {(error || queue.error) && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-900 space-y-2">
          <div className="flex items-start gap-2">
            <WarningCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" weight="bold" />
            <span>{error || queue.error}</span>
          </div>
          {queue.conflict || error.startsWith('CONFLICT:') ? (
            <button
              type="button"
              onClick={fetchLatest}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-800 shadow-xs"
            >
              Bandingkan Versi Terbaru
            </button>
          ) : queue.dirty ? (
            <button
              type="button"
              onClick={() => void queue.flush()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-800 shadow-xs"
            >
              Coba Simpan Ulang
            </button>
          ) : null}
        </div>
      )}

      {/* Resolusi Konflik Rebase */}
      {latest && (
        <div className="p-5 rounded-2xl border border-amber-300 bg-white shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">
            Periksa Perubahan Sebelum Menyimpan Ulang
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Perubahan lokal Anda tetap dipertahankan. Menyimpan ulang akan memperbarui data untuk item yang Anda ubah tanpa menghapus pembaruan dari petugas lain.
          </p>
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border rounded-xl p-3 bg-slate-50/50">
            {Object.entries({ ...queue.inflight?.patch, ...queue.pending }).map(([id, a]) => (
              <div key={id} className="py-2.5 text-xs space-y-1">
                <p className="font-bold text-slate-800">{ITEMS.find((i) => i.id === id)?.label}</p>
                <p className="text-slate-500">
                  Versi terbaru: {latest.answers[id]?.text ?? (latest.answers[id]?.unknown ? `Tidak diketahui: ${latest.answers[id]?.note}` : latest.answers[id]?.score ?? 'Kosong')}
                </p>
                <p className="text-emerald-700 font-semibold">
                  Perubahan Anda: {a.text ?? (a.unknown ? `Tidak diketahui: ${a.note}` : a.score ?? 'Kosong')}
                </p>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={buttonClass}
            onClick={rebase}
            disabled={!latest.editable}
          >
            Simpan Ulang Perubahan Saya
          </button>
        </div>
      )}

      {/* ── 3. STEPPER 12 LANGKAH (CARD NAVIGATION) ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Langkah {position + 1} dari 12
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              {currentStep.title}
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={position === 0 || busy}
              onClick={() => navigate(position - 1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
              title="Langkah Sebelumnya"
            >
              <CaretLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={position === 11 || busy}
              onClick={() => navigate(position + 1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
              title="Langkah Berikutnya"
            >
              <CaretRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step Track Buttons */}
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 pt-1">
          {steps.map((s, idx) => {
            const isActive = position === idx
            return (
              <button
                key={s.title}
                type="button"
                onClick={() => navigate(s.position)}
                title={`${idx + 1}. ${s.title}`}
                className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : s.complete
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100/60'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200/70 border border-transparent'
                }`}
              >
                <span>{idx + 1}</span>
                {s.complete && !isActive && (
                  <Check className="w-3 h-3 text-emerald-600" weight="bold" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 4. KONTEN LANGKAH BERJALAN ── */}

      {/* ── LANGKAH 0: IDENTITAS & PEMBUKAAN ── */}
      {position === 0 && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Koreksi Identitas bila belum ada jawaban */}
          {interview.editable && Object.keys(answers).length === 0 && !queue.dirty && (
            <IdentityEditor
              interview={{ ...interview, revision: queue.revision }}
              onSaved={refresh}
              onBusyChange={setBusy}
            />
          )}

          {/* Rincian Identitas Pengajar & Pengajian */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              Identitas Pengajar & Agenda Pengajian
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Pengajar
                </span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                  {interview.identity.guru_nama}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Kelas Diniyah
                </span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                  {interview.identity.kelas_nama}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Kitab / Pelajaran
                </span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {contextBooks(interview.identity)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Waktu Sesi Pengajian
                </span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {contextTime(interview.identity)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Pewawancara
                </span>
                <span className="font-medium text-slate-800 mt-0.5 block">
                  {interview.identity.pewawancara}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Kegiatan Supervisi
                </span>
                <span className="font-medium text-slate-800 mt-0.5 block">
                  {interview.identity.kegiatan_nama}
                </span>
              </div>
            </div>

            {/* Tanggal Wawancara */}
            <div className="pt-3 border-t border-slate-100 max-w-xs">
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Tanggal Wawancara
              </label>
              <input
                type="date"
                disabled={!editable}
                className={inputClass}
                value={tanggal}
                onChange={(e) => {
                  setTanggal(e.target.value)
                  queue.setDate(e.target.value)
                  if (timer.current) clearTimeout(timer.current)
                  timer.current = setTimeout(() => void queue.flush(), 600)
                }}
                onBlur={() => void queue.flush()}
              />
            </div>
          </div>

          {/* Petunjuk & Kalimat Pembuka */}
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
              <Quotes className="w-4 h-4 text-emerald-600" weight="duotone" />
              <span>Petunjuk & Pembukaan Wawancara</span>
            </h3>

            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-700 leading-relaxed">
              {GUIDANCE.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>

            <div className="p-4 rounded-xl bg-white border border-emerald-200/70 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Sampaikan Kalimat Pembuka Ini Kepada Santri:
              </span>
              <p className="text-xs sm:text-sm italic text-slate-800 leading-relaxed">
                “{OPENING}”
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── LANGKAH 1-8: SEKSI PENILAIAN SKALA & URAIAN ── */}
      {currentSection && position >= 1 && position <= 8 && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Seksi {position} dari 8
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
              {currentSection.title}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Tanyakan pertanyaan berikut kepada kelompok santri, lalu tentukan skala kecenderungan atau catat rangkuman jawabannya.
            </p>
          </div>

          {/* Daftar Pertanyaan per Seksi */}
          <div className="space-y-4">
            {currentSection.items.map((item, idx) => {
              const answer = answers[item.id] ?? {}
              const complete = isAnswered(item, answer)

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border bg-white p-5 sm:p-6 shadow-sm space-y-4 transition-all ${
                    complete ? 'border-slate-200/90' : 'border-amber-200/70 bg-amber-50/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Pertanyaan {idx + 1} dari {currentSection.items.length}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        complete
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {complete ? (
                        <>
                          <Check className="w-3 h-3" weight="bold" />
                          <span>Terisi</span>
                        </>
                      ) : (
                        'Belum Terisi'
                      )}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                    {item.label}
                  </h3>

                  {/* KASUS 1: SKOR SKALA 1..4 */}
                  {item.kind === 'score' ? (
                    <div className="space-y-3 pt-2">
                      <p className="text-xs text-slate-500">
                        Pilih skala berdasarkan kecenderungan jawaban santri:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {SCALE.map((scaleLabel, scaleIdx) => {
                          const val = scaleIdx + 1
                          const isSelected = !answer.unknown && answer.score === val

                          return (
                            <button
                              key={scaleLabel}
                              type="button"
                              disabled={!editable}
                              onClick={() =>
                                change(item.id, { score: val, unknown: false }, true)
                              }
                              className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                                isSelected
                                  ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 shadow-xs ring-1 ring-emerald-600/30'
                                  : 'border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {val}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs sm:text-sm font-semibold block leading-tight">
                                  {scaleLabel}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      {/* Opsi Tidak Diketahui */}
                      <div className="pt-1">
                        <button
                          type="button"
                          disabled={!editable}
                          onClick={() =>
                            change(
                              item.id,
                              { unknown: true, score: null, note: answer.note ?? '' },
                              true
                            )
                          }
                          className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold transition ${
                            answer.unknown
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600/20'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-bold">Opsi: Tidak Diketahui</span>
                          <span className="text-slate-500 font-normal ml-1">
                            (pilih jika materi belum diajarkan atau tidak dapat dinilai)
                          </span>
                        </button>

                        {answer.unknown && (
                          <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 animate-in fade-in duration-150">
                            <label className="block text-xs font-bold text-slate-700">
                              Catatan Alasan Tidak Diketahui <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                              disabled={!editable}
                              maxLength={10000}
                              rows={3}
                              placeholder="Tuliskan alasan mengapa indikator ini tidak dapat dinilai..."
                              className={`${inputClass} text-xs`}
                              value={answer.note ?? ''}
                              onChange={(e) =>
                                change(item.id, { ...answer, note: e.target.value })
                              }
                              onBlur={() => void queue.flush()}
                            />
                            {!answer.note?.trim() && (
                              <p className="text-[11px] font-semibold text-rose-600">
                                Wajib mengisi catatan alasan tidak diketahui.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* KASUS 2: URAIAN JAWABAN TEKS */
                    <div className="space-y-2 pt-1">
                      <p className="text-xs text-slate-500">
                        Rangkum jawaban santri secara objektif tanpa menyebutkan nama santri:
                      </p>
                      <textarea
                        disabled={!editable}
                        maxLength={10000}
                        rows={4}
                        placeholder="Tuliskan rangkuman temuan atau jawaban santri..."
                        className={`${inputClass} text-xs sm:text-sm leading-relaxed`}
                        value={answer.text ?? ''}
                        onChange={(e) => change(item.id, { text: e.target.value })}
                        onBlur={() => void queue.flush()}
                      />
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Wajib diisi</span>
                        <span>{answer.text?.length ?? 0} / 10.000 karakter</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── LANGKAH 9 & 10: PERTANYAAN REFLEKTIF & CATATAN PEWAWANCARA ── */}
      {currentSection && (position === 9 || position === 10) && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Langkah {position + 1} dari 12
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
              {currentSection.title}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {position === 9
                ? 'Pertanyaan reflektif untuk menangkap aspirasi, kelebihan pengajar, dan hal yang perlu ditingkatkan.'
                : 'Catatan penting hasil wawancara untuk bahan pertimbangan pembinaan guru.'}
            </p>
          </div>

          <div className="space-y-4">
            {currentSection.items.map((item, idx) => {
              const answer = answers[item.id] ?? {}
              const complete = isAnswered(item, answer)

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border bg-white p-5 sm:p-6 shadow-sm space-y-3 transition-all ${
                    complete ? 'border-slate-200/90' : 'border-amber-200/70 bg-amber-50/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Bagian {idx + 1}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        complete
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {complete ? (
                        <>
                          <Check className="w-3 h-3" weight="bold" />
                          <span>Terisi</span>
                        </>
                      ) : (
                        'Belum Terisi'
                      )}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                    {item.label}
                  </h3>

                  <textarea
                    disabled={!editable}
                    maxLength={10000}
                    rows={4}
                    placeholder="Tuliskan rangkuman tanggapan..."
                    className={`${inputClass} text-xs sm:text-sm leading-relaxed`}
                    value={answer.text ?? ''}
                    onChange={(e) => change(item.id, { text: e.target.value })}
                    onBlur={() => void queue.flush()}
                  />

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Wajib diisi</span>
                    <span>{answer.text?.length ?? 0} / 10.000 karakter</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── LANGKAH 11: REVIEW & PENUTUP ── */}
      {position === 11 && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Review Hasil Wawancara & Penutup
            </h2>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <span className="font-bold text-slate-900 block mb-1">Pesan Penutup untuk Santri:</span>
              <p>{CLOSING}</p>
            </div>
          </div>

          {/* Ringkasan Pengisian per Seksi */}
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden divide-y divide-slate-100">
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ringkasan Pengisian 10 Seksi
              </span>
              <span className="text-xs font-bold text-emerald-700">
                {count} / 53 Selesai ({progressPercentage}%)
              </span>
            </div>

            {SECTIONS.map((s, si) => {
              const answeredItems = s.items.filter((i) => isAnswered(i, answers[i.id])).length
              const allDone = answeredItems === s.items.length

              return (
                <div key={s.title} className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                          allDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {si + 1}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">{s.title}</h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          allDone
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                            : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                        }`}
                      >
                        {answeredItems} / {s.items.length} item
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(si + 1)}
                        className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-0.5 ml-1"
                      >
                        <span>Ubah</span>
                        <CaretRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* List Ringkas Jawaban */}
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {s.items.map((it) => {
                      const ans = answers[it.id]
                      const filled = isAnswered(it, ans)
                      return (
                        <div
                          key={it.id}
                          className="p-2.5 rounded-xl bg-slate-50/70 text-xs flex items-start justify-between gap-3"
                        >
                          <span className="text-slate-700 font-medium line-clamp-1">{it.label}</span>
                          <span
                            className={`font-semibold shrink-0 ${
                              filled ? 'text-slate-900' : 'text-amber-700 italic'
                            }`}
                          >
                            {it.kind === 'text'
                              ? ans?.text
                                ? 'Terisi'
                                : 'Belum diisi'
                              : ans?.unknown
                                ? 'Tidak diketahui'
                                : ans?.score
                                  ? `Skor ${ans.score}`
                                  : 'Belum diisi'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Aksi Finalisasi Wawancara */}
          {interview.editable && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Finalisasi Wawancara</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Setelah wawancara diselesaikan, hasil akan dikunci secara permanen. Perubahan berikutnya memerlukan izin administrator untuk membuka kembali hasil.
              </p>

              <button
                type="button"
                disabled={busy || count !== 53 || queue.dirty || queue.saving || queue.conflict}
                onClick={finalize}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 text-sm shadow-sm transition disabled:opacity-50"
              >
                {busy && <CircleNotch className="w-4 h-4 animate-spin" />}
                <CheckCircle className="w-5 h-5" weight="bold" />
                <span>Selesaikan & Kunci Wawancara</span>
              </button>

              {count !== 53 && (
                <p className="text-xs text-center font-semibold text-amber-700">
                  Lengkapi {53 - count} item pertanyaan yang belum terisi untuk dapat menyelesaikan wawancara.
                </p>
              )}
            </div>
          )}

          {/* Admin: Buka Kembali Hasil */}
          {interview.admin && interview.status === 'selesai' && interview.activityOpen && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <LockOpen className="w-4 h-4 text-amber-600" weight="duotone" />
                <h4 className="text-xs sm:text-sm font-bold text-amber-900">
                  Buka Kembali Hasil untuk Koreksi (Admin)
                </h4>
              </div>
              <textarea
                className={`${inputClass} text-xs`}
                placeholder="Masukkan alasan membuka kembali wawancara untuk audit trail..."
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button
                type="button"
                className={`${buttonClass} text-xs py-2`}
                disabled={busy || !reason.trim()}
                onClick={reopen}
              >
                {busy && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
                <span>Konfirmasi Buka Kembali</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 5. RIWAYAT PERUBAHAN ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm">
        <details className="group">
          <summary className="cursor-pointer text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center justify-between list-none">
            <span>Riwayat Perubahan & Audit Trail</span>
            <CaretRight className="w-3.5 h-3.5 transition group-open:rotate-90" />
          </summary>
          <ul className="mt-4 space-y-3 border-l-2 border-slate-200 pl-4 text-xs">
            {history.map((h) => {
              const actionLabel =
                {
                  start: 'Mulai draft',
                  save: 'Simpan jawaban',
                  submit: 'Selesai',
                  reopen: 'Buka kembali',
                  identity: 'Koreksi identitas',
                }[h.action] ?? h.action

              return (
                <li key={h.id} className="space-y-0.5">
                  <p className="font-bold text-slate-800">
                    {actionLabel} · <span className="font-normal text-slate-600">{h.actor_name}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(h.created_at.replace(' ', 'T') + 'Z').toLocaleString('id-ID', {
                      timeZone: 'Asia/Jakarta',
                    })}{' '}
                    · Revisi {h.revision}
                  </p>
                  {h.reason && <p className="text-slate-600 italic">Alasan: {h.reason}</p>}
                </li>
              )
            })}
          </ul>
        </details>
      </div>

      {/* ── 6. MODAL / SECTION PRINT PREVIEW ── */}
      {printOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-slate-900 text-sm">Pratinjau Dokumen Cetak</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={buttonClass}
                onClick={() => void print()}
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Sekarang</span>
              </button>
              <button
                type="button"
                className={secondaryClass}
                onClick={() => setPrintOpen(false)}
              >
                Tutup
              </button>
            </div>
          </div>

          <div className="border rounded-xl p-4 bg-slate-50 overflow-x-auto">
            <PrintView
              ref={printRef}
              interview={printable}
              profile={letterhead.profile}
              mode={letterhead.mode}
            />
          </div>
        </div>
      )}

      {/* ── 7. STICKY BOTTOM NAVIGATION BAR ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-4 sm:px-6 py-3 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={position === 0 || busy}
            className={secondaryClass}
            onClick={() => navigate(position - 1)}
          >
            <CaretLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>

          <span className="text-xs font-semibold text-slate-500">
            {position === 0
              ? 'Langkah 1: Pembukaan'
              : position === 11
                ? 'Langkah 12: Review'
                : `Langkah ${position + 1}/12 · ${currentStep.title}`}
          </span>

          <button
            type="button"
            disabled={position === 11 || busy}
            className={buttonClass}
            onClick={() => navigate(position + 1)}
          >
            <span>{position === 10 ? 'Review & Selesai' : 'Lanjut'}</span>
            <CaretRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
