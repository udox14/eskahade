'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Ban, KeyRound, Loader2, Plus, QrCode, Save, Search, Trash2, Unlock, UploadCloud,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import type { PortalBank, PortalPaymentChannels } from '@/lib/portal/data'
import {
  hapusQris, resetPortalPassword, savePortalBanks, searchPortalCredential, setPortalActive,
  uploadQris, type PortalCredentialRow,
} from './actions'

export default function PageContent({ initialChannels }: { initialChannels: PortalPaymentChannels }) {
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Pengaturan Portal Ortu"
        description="Kelola rekening tujuan transfer, QRIS, dan akses login orang tua."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <BankSection initialBanks={initialChannels.banks} />
        <QrisSection initialUrl={initialChannels.qris_url} />
      </div>
      <CredentialSection />
    </div>
  )
}

// ── Rekening bank ────────────────────────────────────────────

function BankSection({ initialBanks }: { initialBanks: PortalBank[] }) {
  const [banks, setBanks] = useState<PortalBank[]>(initialBanks)
  const [saving, setSaving] = useState(false)

  function updateBank(index: number, field: keyof PortalBank, value: string) {
    setBanks(prev => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)))
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    const res = await savePortalBanks(banks)
    setSaving(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success('Daftar rekening tersimpan.')
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-600'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">Rekening Tujuan Transfer</h2>
      <p className="mt-1 text-xs text-slate-500">
        Rekening yang ditampilkan ke orang tua pada wizard pembayaran.
      </p>

      <div className="mt-4 space-y-3">
        {banks.map((bank, index) => (
          <div key={bank.id || index} className="rounded-xl border border-slate-200 p-3 space-y-2">
            <div className="flex gap-2">
              <input
                value={bank.bank}
                onChange={e => updateBank(index, 'bank', e.target.value)}
                placeholder="Nama bank (BSI, BRI…)"
                className={inputCls}
              />
              <button
                onClick={() => setBanks(prev => prev.filter((_, i) => i !== index))}
                className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 text-rose-600 hover:bg-rose-100"
                aria-label="Hapus rekening"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <input
              value={bank.nomor}
              onChange={e => updateBank(index, 'nomor', e.target.value)}
              placeholder="Nomor rekening"
              className={inputCls}
            />
            <input
              value={bank.atas_nama}
              onChange={e => updateBank(index, 'atas_nama', e.target.value)}
              placeholder="Atas nama"
              className={inputCls}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setBanks(prev => [...prev, { id: '', bank: '', nomor: '', atas_nama: '' }])}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah Rekening
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Simpan Rekening
        </button>
      </div>
    </div>
  )
}

// ── QRIS ─────────────────────────────────────────────────────

function QrisSection({ initialUrl }: { initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl)
  const [busy, setBusy] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || busy) return
    setBusy(true)
    const formData = new FormData()
    formData.set('qris', file)
    const res = await uploadQris(formData)
    setBusy(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    setUrl(res.url)
    toast.success('QRIS tersimpan.')
  }

  async function handleDelete() {
    if (busy) return
    if (!window.confirm('Hapus gambar QRIS? Metode QRIS akan hilang dari wizard ortu.')) return
    setBusy(true)
    const res = await hapusQris()
    setBusy(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    setUrl(null)
    toast.success('QRIS dihapus.')
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">QRIS Pesantren</h2>
      <p className="mt-1 text-xs text-slate-500">
        Jika diunggah, metode QRIS aktif di wizard pembayaran ortu.
      </p>

      <div className="mt-4">
        {url ? (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="QRIS" className="mx-auto max-h-64 rounded-xl border border-slate-200" />
            <button
              onClick={handleDelete}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus QRIS
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-10 hover:bg-slate-100">
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={busy} />
            {busy ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : <QrCode className="w-6 h-6 text-slate-400" />}
            <span className="text-xs font-bold text-slate-600">
              {busy ? 'Mengunggah…' : 'Unggah gambar QRIS'}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <UploadCloud className="w-3 h-3" /> PNG/JPG maks 3MB
            </span>
          </label>
        )}
      </div>
    </div>
  )
}

// ── Kredensial ortu ──────────────────────────────────────────

function CredentialSection() {
  const [keyword, setKeyword] = useState('')
  const [rows, setRows] = useState<PortalCredentialRow[]>([])
  const [searching, setSearching] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    if (searching || keyword.trim().length < 2) return
    setSearching(true)
    const res = await searchPortalCredential(keyword)
    setSearching(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    setRows(res.rows ?? [])
  }

  async function handleReset(row: PortalCredentialRow) {
    if (busyId) return
    if (!window.confirm(`Reset password portal untuk ${row.nama_lengkap}? Ortu login lagi memakai password default (NIS / tanggal lahir).`)) return
    setBusyId(row.santri_id)
    const res = await resetPortalPassword(row.santri_id)
    setBusyId(null)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success('Password direset ke default.')
    handleSearch()
  }

  async function handleToggleActive(row: PortalCredentialRow) {
    if (busyId) return
    const blocking = row.punya_kredensial === 1 && Number(row.is_active) === 1
    const next = row.punya_kredensial === 0 ? false : !blocking ? true : false
    setBusyId(row.santri_id)
    const res = await setPortalActive(row.santri_id, next)
    setBusyId(null)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success(next ? 'Akses portal dibuka.' : 'Akses portal diblokir.')
    handleSearch()
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">Akun Login Ortu</h2>
      <p className="mt-1 text-xs text-slate-500">
        Ortu login dengan NIS anak. Password awal: NIS atau tanggal lahir (TGLBLNTHN). Cari santri untuk
        reset password atau blokir akses.
      </p>

      <form onSubmit={handleSearch} className="mt-4 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="Cari nama atau NIS santri…"
            className="w-full text-sm outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searching || keyword.trim().length < 2}
          className="rounded-xl bg-emerald-700 px-5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cari'}
        </button>
      </form>

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-400">
                <th className="py-2 pr-3">Santri</th>
                <th className="py-2 pr-3">Status Akun</th>
                <th className="py-2 pr-3">Login Terakhir</th>
                <th className="py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const punya = row.punya_kredensial === 1
                const blocked = punya && Number(row.is_active) === 0
                const busy = busyId === row.santri_id
                return (
                  <tr key={row.santri_id} className="border-b border-slate-100">
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-slate-900">{row.nama_lengkap}</p>
                      <p className="text-[11px] text-slate-500">
                        NIS {row.nis || '-'}{row.asrama ? ` • ${row.asrama}` : ''}
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      {blocked ? (
                        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">Diblokir</span>
                      ) : punya ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                          {Number(row.must_change_password) === 1 ? 'Password default' : 'Aktif'}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">Belum pernah login</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-xs text-slate-500">
                      {row.last_login_at ? row.last_login_at.slice(0, 16).replace('T', ' ') : '-'}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1.5">
                        {punya && (
                          <button
                            disabled={busy}
                            onClick={() => handleReset(row)}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <KeyRound className="w-3 h-3" /> Reset
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => handleToggleActive(row)}
                          className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-50 ${
                            blocked
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          {blocked ? <Unlock className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                          {blocked ? 'Buka' : 'Blokir'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
