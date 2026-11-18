'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Bank, Plus, PencilSimple, UsersThree, Info, Warning } from '@phosphor-icons/react'
import {
  getPaymentChannelSettingsAction,
  savePaymentChannelSettingsAction,
  saveTransferAccountAction,
  setTransferAccountActiveAction,
  saveVerifierScopesAction,
  type PaymentChannelSettingsData,
} from './payment-channel-actions'
import type { PaymentChannelMode } from '@/lib/finance/transfer-config'

const rupiah = (n: number) => 'Rp' + n.toLocaleString('id-ID')

const MODES: Array<{ value: PaymentChannelMode; title: string; description: string }> = [
  { value: 'TRANSFER', title: 'Transfer bank saja', description: 'Wali transfer ke rekening Koperasi lalu mengunggah bukti. Petugas memeriksa dan menyetujui.' },
  { value: 'BRIVA', title: 'BRIVA saja', description: 'Wali membayar ke nomor Virtual Account BRI. Status terkonfirmasi otomatis dari bank.' },
  { value: 'BOTH', title: 'Keduanya', description: 'Wali memilih sendiri cara bayar saat checkout.' },
]

const inputClass = 'w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-50'

export default function PaymentChannelTab({ canMutate }: { canMutate: boolean }) {
  const [data, setData] = useState<PaymentChannelSettingsData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = () => startTransition(async () => {
    try { setData(await getPaymentChannelSettingsAction()); setLoadError(null) }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Gagal memuat pengaturan.') }
  })
  useEffect(load, [])

  if (loadError) return <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800">{loadError}</div>
  if (!data) return <div className="p-6 text-sm text-slate-500">Memuat pengaturan jalur pembayaran…</div>

  const editable = canMutate && data.canConfigure
  return (
    <div className="space-y-6">
      {!data.canConfigure && (
        <p className="text-xs text-slate-500">Hanya Admin atau Admin Koperasi yang dapat mengubah pengaturan ini.</p>
      )}
      <ChannelSettingsCard data={data} editable={editable} onSaved={load} busy={isPending} />
      <AccountsCard data={data} editable={editable} onSaved={load} />
      <VerifierCard data={data} editable={editable} onSaved={load} />
    </div>
  )
}

function ChannelSettingsCard({ data, editable, onSaved, busy }: { data: PaymentChannelSettingsData; editable: boolean; onSaved: () => void; busy: boolean }) {
  const [mode, setMode] = useState<PaymentChannelMode>(data.mode)
  const [fee, setFee] = useState(data.transferFee)
  const [uniqueMax, setUniqueMax] = useState(data.uniqueCodeMax)
  const [deadline, setDeadline] = useState(data.proofDeadlineHours)
  const [deduct, setDeduct] = useState(data.feeDeductEnabled)
  const [saving, setSaving] = useState(false)
  const brivaSelected = mode === 'BRIVA' || mode === 'BOTH'
  const noAccount = !data.accounts.some(a => a.is_active)

  const save = async () => {
    setSaving(true)
    const res = await savePaymentChannelSettingsAction({ mode, transferFee: fee, uniqueCodeMax: uniqueMax, proofDeadlineHours: deadline, feeDeductEnabled: deduct })
    setSaving(false)
    if (res.success) { toast.success('Pengaturan jalur pembayaran disimpan.'); onSaved() }
    else toast.error(res.error)
  }

  return (
    <section className="bg-white p-5 rounded-xl border border-slate-200 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Jalur pembayaran di Portal Wali</h3>
        <p className="text-xs text-slate-500 mt-1">Menentukan cara bayar yang terlihat oleh wali. Pembayaran yang sedang berjalan tidak terpengaruh.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Mode jalur pembayaran">
        {MODES.map(option => (
          <label key={option.value} className={`flex gap-3 p-3 rounded-lg border cursor-pointer ${mode === option.value ? 'border-emerald-600 bg-emerald-50/60' : 'border-slate-200'} ${!editable ? 'cursor-not-allowed opacity-80' : ''}`}>
            <input type="radio" name="channel-mode" className="mt-1 accent-emerald-700" disabled={!editable}
              checked={mode === option.value} onChange={() => setMode(option.value)} />
            <span>
              <span className="block text-sm font-semibold text-slate-800">{option.title}</span>
              <span className="block text-xs text-slate-500 mt-0.5">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
      {brivaSelected && !data.brivaGateOpen && (
        <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
          <Warning className="w-4 h-4 shrink-0 mt-0.5" weight="bold" />
          <span>BRIVA belum dibuka di server (integrasi BRI belum aktif). Selama itu wali melihat BRIVA sebagai &quot;belum tersedia&quot;{mode === 'BOTH' ? ' dan tetap bisa membayar lewat transfer' : ''}.</span>
        </div>
      )}
      {mode !== 'BRIVA' && noAccount && (
        <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
          <Warning className="w-4 h-4 shrink-0 mt-0.5" weight="bold" />
          <span>Belum ada rekening tujuan aktif. Tambahkan rekening di bawah sebelum mengaktifkan transfer.</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="block text-xs font-semibold text-slate-700 mb-1">Biaya admin Koperasi per transfer</span>
          <div className="relative">
            <span className="absolute left-3 top-2 text-sm text-slate-400">Rp</span>
            <input type="number" min={0} step={500} disabled={!editable} value={fee}
              onChange={e => setFee(Math.max(0, parseInt(e.target.value, 10) || 0))} className={inputClass + ' pl-9 font-mono'} />
          </div>
          <span className="block text-[11px] text-slate-500 mt-1">Pendapatan Koperasi. Rp0 berarti tanpa biaya admin. BRIVA: {rupiah(data.brivaFee)} (diatur di tab BRIVA).</span>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-slate-700 mb-1">Kode unik maksimal</span>
          <input type="number" min={99} max={999} disabled={!editable} value={uniqueMax}
            onChange={e => setUniqueMax(parseInt(e.target.value, 10) || 0)} className={inputClass + ' font-mono'} />
          <span className="block text-[11px] text-slate-500 mt-1">Sistem menambahkan Rp1–{rupiah(uniqueMax || 0)} agar setiap transfer mudah dikenali. Kode unik dicatat sebagai pendapatan Koperasi.</span>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-slate-700 mb-1">Batas unggah bukti (jam)</span>
          <input type="number" min={1} max={168} disabled={!editable} value={deadline}
            onChange={e => setDeadline(parseInt(e.target.value, 10) || 0)} className={inputClass + ' font-mono'} />
          <span className="block text-[11px] text-slate-500 mt-1">Pembayaran tanpa bukti setelah batas ini dibatalkan otomatis.</span>
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" className="mt-1 accent-emerald-700" disabled={!editable} checked={deduct} onChange={e => setDeduct(e.target.checked)} />
        <span>
          Izinkan wali memilih &quot;potong biaya admin dari nominal&quot;
          <span className="block text-xs text-slate-500">Hanya berlaku untuk Uang Jajan atau cicilan (misalnya USPP). Tagihan tetap seperti SPP selalu dibayar penuh.</span>
        </span>
      </label>
      {editable && (
        <div className="flex justify-end">
          <button type="button" onClick={save} disabled={saving || busy}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50">
            {saving ? 'Menyimpan…' : 'Simpan pengaturan'}
          </button>
        </div>
      )}
    </section>
  )
}

type AccountDraft = { id?: string | null; bankName: string; accountNumber: string; accountHolder: string; notes: string; sortOrder: number }
const emptyDraft: AccountDraft = { bankName: '', accountNumber: '', accountHolder: '', notes: '', sortOrder: 0 }

function AccountsCard({ data, editable, onSaved }: { data: PaymentChannelSettingsData; editable: boolean; onSaved: () => void }) {
  const [draft, setDraft] = useState<AccountDraft | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!draft) return
    setSaving(true)
    const res = await saveTransferAccountAction(draft)
    setSaving(false)
    if (res.success) { toast.success('Rekening disimpan.'); setDraft(null); onSaved() }
    else toast.error(res.error)
  }
  const toggle = async (id: string, active: boolean) => {
    const res = await setTransferAccountActiveAction(id, active)
    if (res.success) { toast.success(active ? 'Rekening diaktifkan.' : 'Rekening dinonaktifkan.'); onSaved() }
    else toast.error(res.error)
  }

  return (
    <section className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Bank className="w-4 h-4 text-emerald-700" /> Rekening tujuan transfer</h3>
          <p className="text-xs text-slate-500 mt-1">Wali memilih salah satu rekening aktif. Mengubah rekening tidak mengubah pembayaran yang sudah dibuat.</p>
        </div>
        {editable && !draft && (
          <button type="button" onClick={() => setDraft({ ...emptyDraft, sortOrder: data.accounts.length + 1 })}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 border border-emerald-200 rounded-lg hover:bg-emerald-50">
            <Plus className="w-3.5 h-3.5" weight="bold" /> Tambah rekening
          </button>
        )}
      </div>

      {draft && (
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Bank</span>
              <input className={inputClass} value={draft.bankName} placeholder="Contoh: BSI" onChange={e => setDraft({ ...draft, bankName: e.target.value })} /></label>
            <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Nomor rekening</span>
              <input className={inputClass + ' font-mono'} inputMode="numeric" value={draft.accountNumber} onChange={e => setDraft({ ...draft, accountNumber: e.target.value })} /></label>
            <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Atas nama</span>
              <input className={inputClass} value={draft.accountHolder} onChange={e => setDraft({ ...draft, accountHolder: e.target.value })} /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Catatan untuk wali (opsional)</span>
              <input className={inputClass} value={draft.notes} placeholder="Contoh: bisa dari bank apa saja" onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
            <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Urutan</span>
              <input type="number" min={0} className={inputClass} value={draft.sortOrder} onChange={e => setDraft({ ...draft, sortOrder: parseInt(e.target.value, 10) || 0 })} /></label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDraft(null)} className="px-3 py-2 text-xs font-semibold text-slate-600 rounded-lg hover:bg-slate-100">Batal</button>
            <button type="button" onClick={save} disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan rekening'}</button>
          </div>
        </div>
      )}

      {data.accounts.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada rekening.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
          {data.accounts.map(account => (
            <li key={account.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-800">{account.bank_name} · <span className="font-mono">{account.account_number}</span></div>
                <div className="text-xs text-slate-500">a.n. {account.account_holder}{account.notes ? ` — ${account.notes}` : ''}</div>
              </div>
              <span className={`text-xs ${account.is_active ? 'text-emerald-700' : 'text-slate-400'}`}>{account.is_active ? 'Aktif' : 'Nonaktif'}</span>
              {editable && (
                <div className="flex gap-1">
                  <button type="button" aria-label={`Ubah rekening ${account.bank_name}`} onClick={() => setDraft({ id: account.id, bankName: account.bank_name, accountNumber: account.account_number, accountHolder: account.account_holder, notes: account.notes || '', sortOrder: account.sort_order })}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"><PencilSimple className="w-4 h-4" /></button>
                  <button type="button" onClick={() => toggle(account.id, !account.is_active)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
                    {account.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function VerifierCard({ data, editable, onSaved }: { data: PaymentChannelSettingsData; editable: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const covered = new Set(data.verifiers.flatMap(v => v.asrama))
  const uncovered = data.asramaOptions.filter(a => !covered.has(a))

  const start = (userId: string, current: string[]) => { setEditing(userId); setSelected(current) }
  const save = async () => {
    if (!editing) return
    setSaving(true)
    const res = await saveVerifierScopesAction({ userId: editing, asrama: selected })
    setSaving(false)
    if (res.success) { toast.success('Pembagian tugas disimpan.'); setEditing(null); onSaved() }
    else toast.error(res.error)
  }

  return (
    <section className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><UsersThree className="w-4 h-4 text-emerald-700" /> Pembagian tugas petugas verifikasi</h3>
        <p className="text-xs text-slate-500 mt-1">Petugas Koperasi hanya melihat dan memeriksa bukti transfer dari asrama yang ditugaskan. Admin, Bendahara, dan Admin Koperasi melihat semua asrama.</p>
      </div>
      {uncovered.length > 0 && (
        <div className="flex gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Belum ada petugas untuk: <span className="font-semibold">{uncovered.join(', ')}</span>. Bukti dari asrama ini hanya bisa diperiksa Admin/Bendahara/Admin Koperasi.</span>
        </div>
      )}
      {data.verifiers.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada pengguna dengan peran Petugas Koperasi. Tambahkan lewat Pengaturan Pengguna.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
          {data.verifiers.map(verifier => (
            <li key={verifier.id} className="p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800">{verifier.full_name}</div>
                  <div className="text-xs text-slate-500">{verifier.asrama.length ? verifier.asrama.join(', ') : 'Belum ada asrama'}</div>
                </div>
                {editable && editing !== verifier.id && (
                  <button type="button" onClick={() => start(verifier.id, verifier.asrama)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">Atur asrama</button>
                )}
              </div>
              {editing === verifier.id && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {data.asramaOptions.map(asrama => {
                      const checked = selected.includes(asrama)
                      return (
                        <label key={asrama} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${checked ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-700'}`}>
                          <input type="checkbox" className="accent-emerald-700" checked={checked}
                            onChange={() => setSelected(checked ? selected.filter(a => a !== asrama) : [...selected, asrama])} />
                          {asrama}
                        </label>
                      )
                    })}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-600 rounded-lg hover:bg-slate-100">Batal</button>
                    <button type="button" onClick={save} disabled={saving} className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan'}</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
