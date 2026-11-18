'use client'

import { useState } from 'react'
import { syncLegacyPaymentsChunkAction } from './billing-actions'

const MAX_ROUNDS = 100

/**
 * Peringatan pembayaran modul lama + tombol sinkronisasi sekali klik.
 * Server memproses per potong kecil; komponen ini mengulang sampai selesai
 * atau tidak ada kemajuan lagi (sisa kasus memang perlu diperiksa manusia).
 */
export function LegacySyncNotice({ count, canSync, onUpdated }: { count: number; canSync: boolean; onUpdated: () => void }) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<{ tone: 'ok' | 'warn'; text: string; errors: string[] } | null>(null)

  async function run() {
    if (running) return
    setRunning(true); setResult(null)
    let synced = 0, failed = 0, remaining = count
    let errors: string[] = []
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const r = await syncLegacyPaymentsChunkAction()
        synced += r.synced; failed += r.failed; remaining = r.remaining
        if (r.errors.length) errors = r.errors
        setProgress(`Menyinkronkan… ${synced} pembayaran tercatat, sisa ${remaining}.`)
        if (r.processed === 0 || r.synced === 0 || remaining === 0) break
      }
      setResult(remaining === 0
        ? { tone: 'ok', text: `Selesai. ${synced} pembayaran modul lama sudah tercatat di Keuangan Baru.`, errors: [] }
        : { tone: 'warn', text: `${synced} pembayaran tercatat. Masih ada ${remaining} kasus${failed ? ` (${failed} gagal)` : ''} yang tidak bisa diselesaikan otomatis dan perlu diperiksa di Rekonsiliasi.`, errors })
    } catch (error) {
      setResult({ tone: 'warn', text: `${synced} pembayaran sempat tercatat, lalu proses terhenti: ${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}. Klik lagi untuk melanjutkan.`, errors })
    } finally {
      setRunning(false); setProgress(''); onUpdated()
    }
  }

  if (count <= 0 && !result) return null
  return (
    <div role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      {count > 0 && <>
        <p>
          <span className="font-semibold">Perlu Pemeriksaan:</span> {count} pembayaran yang dicatat di modul lama (Asrama/SPP, Non-SPP, PSB) belum tercatat di Keuangan Baru.
          Selama belum tercatat, tagihan bulan itu ditahan supaya wali tidak membayar dua kali.
        </p>
        {canSync && <div className="mt-2 flex flex-wrap items-center gap-3">
          <button type="button" disabled={running} onClick={run}
            className="min-h-11 rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60">
            {running ? 'Memproses…' : 'Sinkronkan pembayaran modul lama'}
          </button>
          {progress && <span className="text-xs">{progress}</span>}
        </div>}
      </>}
      {result && <div className={`mt-2 text-sm ${result.tone === 'ok' ? 'text-emerald-800' : 'text-amber-900'}`}>
        <p>{result.text}</p>
        {result.errors.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs">{result.errors.map(e => <li key={e}>{e}</li>)}</ul>}
      </div>}
    </div>
  )
}
