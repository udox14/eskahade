'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
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

const rupiah = (n: number) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID')

const MODES: Array<{ value: PaymentChannelMode; title: string; description: string }> = [
  {
    value: 'TRANSFER',
    title: 'Transfer bank saja',
    description: 'Wali transfer ke rekening Koperasi lalu mengunggah bukti. Petugas memeriksa dan menyetujui.',
  },
  {
    value: 'BRIVA',
    title: 'BRIVA saja',
    description: 'Wali membayar ke nomor Virtual Account BRI. Status terkonfirmasi otomatis dari bank.',
  },
  {
    value: 'BOTH',
    title: 'Keduanya',
    description: 'Wali memilih sendiri cara bayar (BRIVA atau Transfer) saat pembayaran.',
  },
]

const inputClass =
  'min-h-[38px] w-full text-xs text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500'

export default function PaymentChannelTab({
  canMutate,
  refreshSeq = 0,
}: {
  canMutate: boolean
  refreshSeq?: number
}) {
  const [data, setData] = useState<PaymentChannelSettingsData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        setData(await getPaymentChannelSettingsAction())
        setLoadError(null)
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Gagal memuat pengaturan jalur pembayaran.')
      }
    })
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshSeq])

  if (loadError) {
    return (
      <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
        {loadError}
      </div>
    )
  }
  if (!data) {
    return <div className="p-6 text-xs text-slate-500">Memuat pengaturan jalur pembayaran…</div>
  }

  const editable = canMutate && data.canConfigure
  const settingsKey = `${data.mode}-${data.transferFee}-${data.uniqueCodeMax}-${data.proofDeadlineHours}-${data.feeDeductEnabled}`

  return (
    <div className="space-y-5">
      {!data.canConfigure && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <Info className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span>Hanya Admin atau Admin Koperasi yang dapat mengubah pengaturan jalur pembayaran.</span>
        </div>
      )}
      <ChannelSettingsCard
        key={settingsKey}
        data={data}
        editable={editable}
        onSaved={load}
        busy={isPending}
      />
      <AccountsCard data={data} editable={editable} onSaved={load} />
      <VerifierCard data={data} editable={editable} onSaved={load} />
    </div>
  )
}

function ChannelSettingsCard({
  data,
  editable,
  onSaved,
  busy,
}: {
  data: PaymentChannelSettingsData
  editable: boolean
  onSaved: () => void
  busy: boolean
}) {
  const [mode, setMode] = useState<PaymentChannelMode>(data.mode)
  const [feeInput, setFeeInput] = useState<string>(String(data.transferFee))
  const [uniqueMaxInput, setUniqueMaxInput] = useState<string>(String(data.uniqueCodeMax))
  const [deadlineInput, setDeadlineInput] = useState<string>(String(data.proofDeadlineHours))
  const [deduct, setDeduct] = useState(data.feeDeductEnabled)
  const [saving, setSaving] = useState(false)

  const brivaSelected = mode === 'BRIVA' || mode === 'BOTH'
  const noAccount = !data.accounts.some((a) => a.is_active)
  const parsedUniqueMax = parseInt(uniqueMaxInput, 10) || 0

  const save = async () => {
    const fee = Math.max(0, parseInt(feeInput.replace(/\D/g, ''), 10) || 0)
    const uniqueMax = parseInt(uniqueMaxInput.replace(/\D/g, ''), 10) || 0
    const deadline = parseInt(deadlineInput.replace(/\D/g, ''), 10) || 0

    if (uniqueMax < 99 || uniqueMax > 999) {
      toast.error('Batas kode unik harus antara 99 dan 999.')
      return
    }
    if (deadline < 1 || deadline > 168) {
      toast.error('Batas unggah bukti harus antara 1 dan 168 jam.')
      return
    }

    setSaving(true)
    const res = await savePaymentChannelSettingsAction({
      mode,
      transferFee: fee,
      uniqueCodeMax: uniqueMax,
      proofDeadlineHours: deadline,
      feeDeductEnabled: deduct,
    })
    setSaving(false)
    if (res.success) {
      toast.success('Pengaturan jalur pembayaran disimpan.')
      onSaved()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-5">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Jalur Pembayaran di Portal Wali</h3>
        <p className="mt-1 text-xs text-slate-500">
          Menentukan cara bayar yang terlihat oleh wali. Pembayaran yang sedang berjalan tidak terpengaruh.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Mode jalur pembayaran">
        {MODES.map((option) => (
          <label
            key={option.value}
            className={`flex gap-3 rounded-xl border p-3.5 transition-colors cursor-pointer ${
              mode === option.value
                ? 'border-emerald-600 bg-emerald-50/60'
                : 'border-slate-200 hover:border-slate-300'
            } ${!editable ? 'cursor-not-allowed opacity-80' : ''}`}
          >
            <input
              type="radio"
              name="channel-mode"
              className="mt-1 accent-emerald-700"
              disabled={!editable}
              checked={mode === option.value}
              onChange={() => setMode(option.value)}
            />
            <span>
              <span className="block text-xs font-semibold text-slate-900">{option.title}</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{option.description}</span>
            </span>
          </label>
        ))}
      </div>

      {brivaSelected && !data.brivaGateOpen && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <Warning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" weight="bold" aria-hidden="true" />
          <span>
            BRIVA belum aktif di server (integrasi BRI belum dibuka). Selama itu wali melihat BRIVA sebagai &quot;belum
            tersedia&quot;{mode === 'BOTH' ? ' dan tetap bisa membayar lewat transfer' : ''}.
          </span>
        </div>
      )}

      {mode !== 'BRIVA' && noAccount && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <Warning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" weight="bold" aria-hidden="true" />
          <span>Belum ada rekening tujuan aktif. Tambahkan rekening di bawah sebelum mengaktifkan transfer.</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-700">Biaya admin Koperasi per transfer</span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">Rp</span>
            <input
              type="text"
              inputMode="numeric"
              disabled={!editable}
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value.replace(/\D/g, ''))}
              className={`${inputClass} pl-9 font-semibold tabular-nums`}
            />
          </div>
          <span className="mt-1 block text-[11px] text-slate-500">
            Pendapatan Koperasi. Rp0 berarti gratis. BRIVA: {rupiah(data.brivaFee)} (diatur di tab BRIVA &amp; Koperasi).
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-700">Kode unik maksimal (99–999)</span>
          <input
            type="text"
            inputMode="numeric"
            disabled={!editable}
            value={uniqueMaxInput}
            onChange={(e) => setUniqueMaxInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
            className={`${inputClass} font-semibold tabular-nums`}
          />
          <span className="mt-1 block text-[11px] text-slate-500">
            Sistem menambahkan Rp1–{rupiah(parsedUniqueMax)} agar tiap transfer mudah dikenali. Dicatat sebagai
            pendapatan Koperasi.
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-700">Batas unggah bukti (jam)</span>
          <input
            type="text"
            inputMode="numeric"
            disabled={!editable}
            value={deadlineInput}
            onChange={(e) => setDeadlineInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
            className={`${inputClass} font-semibold tabular-nums`}
          />
          <span className="mt-1 block text-[11px] text-slate-500">
            Pembayaran tanpa bukti setelah batas ini dibatalkan otomatis (1–168 jam).
          </span>
        </label>
      </div>

      <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 accent-emerald-700"
          disabled={!editable}
          checked={deduct}
          onChange={(e) => setDeduct(e.target.checked)}
        />
        <span>
          <strong className="font-semibold text-slate-900">
            Izinkan wali memilih &quot;potong biaya admin dari nominal&quot;
          </strong>
          <span className="mt-0.5 block text-[11px] text-slate-500">
            Hanya berlaku untuk Uang Jajan atau cicilan (misalnya USPP). Tagihan tetap seperti SPP selalu dibayar penuh.
          </span>
        </span>
      </label>

      {editable && (
        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || busy}
            className="min-h-[38px] rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Menyimpan…' : 'Simpan Pengaturan'}
          </button>
        </div>
      )}
    </section>
  )
}

type AccountDraft = {
  id?: string | null
  bankName: string
  accountNumber: string
  accountHolder: string
  notes: string
  sortOrder: number
}
const emptyDraft: AccountDraft = { bankName: '', accountNumber: '', accountHolder: '', notes: '', sortOrder: 0 }

function AccountsCard({
  data,
  editable,
  onSaved,
}: {
  data: PaymentChannelSettingsData
  editable: boolean
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<AccountDraft | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!draft) return
    setSaving(true)
    const res = await saveTransferAccountAction(draft)
    setSaving(false)
    if (res.success) {
      toast.success('Rekening tujuan berhasil disimpan.')
      setDraft(null)
      onSaved()
    } else {
      toast.error(res.error)
    }
  }

  const toggle = async (id: string, active: boolean) => {
    const res = await setTransferAccountActiveAction(id, active)
    if (res.success) {
      toast.success(active ? 'Rekening diaktifkan.' : 'Rekening dinonaktifkan.')
      onSaved()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Bank className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>Rekening Tujuan Transfer</span>
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Wali memilih salah satu rekening aktif. Mengubah rekening tidak mengubah pembayaran yang sudah dibuat.
          </p>
        </div>
        {editable && !draft && (
          <button
            type="button"
            onClick={() => setDraft({ ...emptyDraft, sortOrder: data.accounts.length + 1 })}
            className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" weight="bold" aria-hidden="true" />
            <span>Tambah Rekening</span>
          </button>
        )}
      </div>

      {draft && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Bank</span>
              <input
                className={inputClass}
                value={draft.bankName}
                placeholder="Contoh: BRI / BSI"
                onChange={(e) => setDraft({ ...draft, bankName: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Nomor Rekening</span>
              <input
                className={`${inputClass} font-mono`}
                inputMode="numeric"
                value={draft.accountNumber}
                onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Atas Nama</span>
              <input
                className={inputClass}
                value={draft.accountHolder}
                onChange={(e) => setDraft({ ...draft, accountHolder: e.target.value })}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Catatan untuk Wali (Opsional)</span>
              <input
                className={inputClass}
                value={draft.notes}
                placeholder="Contoh: bisa transfer dari bank mana saja"
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Urutan</span>
              <input
                type="number"
                min={0}
                className={`${inputClass} tabular-nums`}
                value={draft.sortOrder}
                onChange={(e) => setDraft({ ...draft, sortOrder: parseInt(e.target.value, 10) || 0 })}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="min-h-[36px] rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Menyimpan…' : 'Simpan Rekening'}
            </button>
          </div>
        </div>
      )}

      {data.accounts.length === 0 ? (
        <p className="text-xs text-slate-500">Belum ada rekening tujuan yang terdaftar.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
          {data.accounts.map((account) => (
            <li key={account.id} className="flex flex-wrap items-center gap-3 p-3.5 hover:bg-slate-50/50">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">
                  {account.bank_name} · <span className="font-mono">{account.account_number}</span>
                </div>
                <div className="text-xs text-slate-500">
                  a.n. {account.account_holder}
                  {account.notes ? ` — ${account.notes}` : ''}
                </div>
              </div>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  account.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {account.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
              {editable && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`Ubah rekening ${account.bank_name}`}
                    onClick={() =>
                      setDraft({
                        id: account.id,
                        bankName: account.bank_name,
                        accountNumber: account.account_number,
                        accountHolder: account.account_holder,
                        notes: account.notes || '',
                        sortOrder: account.sort_order,
                      })
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                  >
                    <PencilSimple className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(account.id, !account.is_active)}
                    className="min-h-[32px] rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
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

function VerifierCard({
  data,
  editable,
  onSaved,
}: {
  data: PaymentChannelSettingsData
  editable: boolean
  onSaved: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const covered = new Set(data.verifiers.flatMap((v) => v.asrama))
  const uncovered = data.asramaOptions.filter((a) => !covered.has(a))

  const start = (userId: string, current: string[]) => {
    setEditing(userId)
    setSelected(current)
  }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    const res = await saveVerifierScopesAction({ userId: editing, asrama: selected })
    setSaving(false)
    if (res.success) {
      toast.success('Pembagian tugas petugas verifikasi disimpan.')
      setEditing(null)
      onSaved()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <UsersThree className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          <span>Pembagian Tugas Petugas Verifikasi</span>
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Petugas Koperasi hanya melihat dan memeriksa bukti transfer dari asrama yang ditugaskan. Admin, Bendahara, dan
          Admin Koperasi melihat semua asrama.
        </p>
      </div>

      {uncovered.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <span>
            Belum ada petugas untuk: <strong className="text-slate-900">{uncovered.join(', ')}</strong>. Bukti dari
            asrama ini hanya bisa diperiksa Admin, Bendahara, atau Admin Koperasi.
          </span>
        </div>
      )}

      {data.verifiers.length === 0 ? (
        <p className="text-xs text-slate-500">
          Belum ada pengguna dengan peran Petugas Koperasi. Tambahkan lewat Pengaturan Pengguna.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
          {data.verifiers.map((verifier) => (
            <li key={verifier.id} className="p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{verifier.full_name}</div>
                  <div className="text-xs text-slate-500">
                    {verifier.asrama.length ? verifier.asrama.join(', ') : 'Belum ada asrama ditugaskan'}
                  </div>
                </div>
                {editable && editing !== verifier.id && (
                  <button
                    type="button"
                    onClick={() => start(verifier.id, verifier.asrama)}
                    className="min-h-[34px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Atur Asrama
                  </button>
                )}
              </div>

              {editing === verifier.id && (
                <div className="space-y-3 rounded-lg bg-slate-50 p-3">
                  <div className="flex flex-wrap gap-2">
                    {data.asramaOptions.map((asrama) => {
                      const checked = selected.includes(asrama)
                      return (
                        <label
                          key={asrama}
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                            checked
                              ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-900'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="accent-emerald-700"
                            checked={checked}
                            onChange={() =>
                              setSelected(checked ? selected.filter((a) => a !== asrama) : [...selected, asrama])
                            }
                          />
                          {asrama}
                        </label>
                      )
                    })}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="min-h-[34px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={save}
                      disabled={saving}
                      className="min-h-[34px] rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? 'Menyimpan…' : 'Simpan'}
                    </button>
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
