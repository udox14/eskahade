import io, re

p = 'app/dashboard/keuangan-terpusat/operasi/_operations-client.tsx'
s = io.open(p, encoding='utf-8').read()


def cut(start, end, label, keep_end=True):
    global s
    a = s.find(start)
    if a < 0:
        print('  LEWAT (awal):', label); return
    b = s.find(end, a)
    if b < 0:
        print('  LEWAT (akhir):', label); return
    s = s[:a] + (s[b:] if keep_end else s[b + len(end):])
    print('  potong:', label)


def rep(old, new, label):
    global s
    if old not in s:
        print('  LEWAT:', label); return
    s = s.replace(old, new, 1)
    print('  ganti :', label)


# --- impor aksi ---
for name in ['approveReopenAction,', 'importBankAction,', 'manualMatchBankAction,']:
    s2 = s.replace('  %s\n' % name, '', 1)
    print(('  ok   : buang impor ' if s2 != s else '  LEWAT impor ') + name)
    s = s2
rep("  reviewLateTopupAction,", "  recordReconciliationAction,\n  reviewLateTopupAction,", 'tambah impor aksi rekonsiliasi')

# --- tipe data ---
rep("""  imports: any[]
  bankTransactions: any[]
  journalCandidates: any[]""",
    """  reconciliationTargets: Array<{ accountId: string; code: string; label: string; systemTotalRupiah: number }>
  reconciliationChecks: any[]
  staff: any[]""", 'tipe data')

# --- turunan mutasi bank ---
cut("  const unmatched = data.bankTransactions.filter(", "  const ", 'turunan unmatched/filteredTransactions')
s2 = re.sub(r"  const candidatesFor = [^\n]*\n(?:.*?\n)*?  \}\n", "", s, count=1)
print(('  ok   : ' if s2 != s else '  LEWAT: ') + 'candidatesFor')
s = s2
s = re.sub(r"    const exact = data\.journalCandidates[^\n]*\n", "", s)
s = re.sub(r"    return exact\.length \? exact : data\.journalCandidates\n", "", s)

# --- kartu metrik mutasi ---
s = re.sub(r'      <MetricCard label="Mutasi belum cocok"[^\n]*\n', '', s)

# --- panel riwayat impor ---
cut('      <SectionPanel title="Riwayat impor mutasi"', '    </section> : null}', 'panel riwayat impor')

# --- seluruh tab rekonsiliasi lama -> checklist baru ---
cut('      <SectionPanel title="Impor mutasi bank"', '      <SectionPanel title="Posting settlement gateway"', 'panel impor + pencocokan')

BARU = '''      <SectionPanel
        title="Cocokkan saldo dengan rekening koran"
        description="Bandingkan saldo menurut pembukuan dengan saldo akhir di rekening koran, satu baris per rekening kas. Selisih wajib dijelaskan sebelum periode boleh ditutup.">
        <div id="reconciliation" className="scroll-mt-24 divide-y divide-slate-100">
          {data.reconciliationTargets.map(target => {
            const existing = data.reconciliationChecks.find((row: any) => row.bank_account_label === target.label)
            return <form key={target.accountId}
              action={form => mutate(() => recordReconciliationAction(form), 'Hasil pencocokan tersimpan.')}
              className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <input type="hidden" name="period" value={data.defaultPeriod} />
              <input type="hidden" name="bankLabel" value={target.label} />
              <input type="hidden" name="systemTotal" value={target.systemTotalRupiah} />
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <span className="text-xs font-bold text-slate-800">{target.label}</span>
                  <p className="mt-1 text-xs text-slate-500">Menurut pembukuan</p>
                  <strong className="block tabular-nums text-slate-900">{rupiah(target.systemTotalRupiah)}</strong>
                </div>
                <label className="text-xs font-bold text-slate-800">Saldo di rekening koran
                  <div className="mt-1"><RupiahInput name="statementTotal" defaultValue={Number(existing?.statement_total_rupiah ?? target.systemTotalRupiah)} /></div>
                </label>
                <label className="text-xs font-bold text-slate-800">Catatan bila ada selisih
                  <input name="note" defaultValue={existing?.note || ''} placeholder="Contoh: biaya admin bank belum dibukukan" className={`mt-1 ${field}`} />
                </label>
              </div>
              <div className="flex items-center gap-3">
                {existing ? <StatusBadge tone={Number(existing.difference_rupiah) === 0 ? 'emerald' : 'amber'}>
                  {Number(existing.difference_rupiah) === 0 ? 'Cocok' : `Selisih ${rupiah(existing.difference_rupiah)}`}
                </StatusBadge> : <StatusBadge tone="slate">Belum dicek</StatusBadge>}
                <button disabled={!data.capabilities.configure || pending}
                  className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">Simpan</button>
              </div>
            </form>
          })}
        </div>
        <p className="border-t border-slate-100 px-4 py-3 text-[11px] leading-5 text-slate-500">
          Impor rekening koran dan pencocokan otomatis per baris dihapus. Hasilnya tetap harus diperiksa manusia,
          dan yang benar-benar bisa dinilai pengurus adalah satu angka total per rekening.
        </p>
      </SectionPanel>

'''
rep('      <SectionPanel title="Posting settlement gateway"', BARU + '      <SectionPanel title="Posting settlement gateway"', 'panel checklist baru')

io.open(p, 'w', encoding='utf-8').write(s)
print('selesai')
