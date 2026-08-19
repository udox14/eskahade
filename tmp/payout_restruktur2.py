import io

p = 'app/dashboard/keuangan-terpusat/payout/_payout-client.tsx'
s = io.open(p, encoding='utf-8').read()


def rep(old, new, label):
    global s
    if old not in s:
        raise SystemExit('GAGAL, anchor tidak ketemu: %s' % label)
    s = s.replace(old, new, 1)
    print('  ok :', label)


# 1. Tutup modal rekening, dan buang daftar rekening yang kini duplikat
#    (versi tab sudah dipasang di tahap 1).
a = s.index('          </form> : null}\n')
b = s.index('      </SectionPanel>\n    </div>\n', a) + len('      </SectionPanel>\n    </div>\n')
s = s[:a] + '          </form>\n    </FinanceModal>\n' + s[b:]
print('  ok : tutup modal rekening + buang daftar duplikat')

# 2. Kedua BulkImport masuk modal, bukan dirender di dasar halaman
rep("    {importMode === 'recipients' ? <BulkImport<Omit<RecipientImportRow, 'row'>>",
    """    <FinanceModal
      open={modal === 'impor-rekening'}
      title="Impor massal rekening penerima"
      size="xl"
      onClose={tutupModal}>
      <BulkImport<Omit<RecipientImportRow, 'row'>>""", 'buka modal impor rekening')

rep("""      onSubmit={values => importRecipientsAction(values)}
    /> : null}""",
    """      onSubmit={values => importRecipientsAction(values)}
      />
    </FinanceModal>""", 'tutup modal impor rekening')

rep("    {importMode === 'payouts' ? <BulkImport<Omit<PayoutImportRow, 'row'>>",
    """    <FinanceModal
      open={modal === 'impor-payout'}
      title="Impor massal pengajuan pencairan"
      size="xl"
      onClose={tutupModal}>
      <BulkImport<Omit<PayoutImportRow, 'row'>>""", 'buka modal impor payout')

rep("""      onSubmit={values => importPayoutsAction(values)}
    /> : null}""",
    """      onSubmit={values => importPayoutsAction(values)}
      />
    </FinanceModal>""", 'tutup modal impor payout')

# 3. Antrean jadi isi tab pertama, dengan tombol aksi utama di kepala panel
rep("""    <SectionPanel
      title="Antrean payout"
      description="Setiap kartu menunjukkan tahap saat ini dan tindakan yang menunggu."
      action={<div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
        <button onClick={() => setStatusFilter('ACTIVE')} className={`min-h-9 rounded-md px-3 ${statusFilter === 'ACTIVE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Berjalan</button>
        <button onClick={() => setStatusFilter('ALL')} className={`min-h-9 rounded-md px-3 ${statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Semua ({payouts.length})</button>
      </div>}
    >""",
    """    {tab === 'antrean' ? <>
    <SectionPanel
      title="Antrean pencairan"
      description="Setiap baris menunjukkan tahap saat ini dan tindakan yang menunggu."
      action={<div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
          <button onClick={() => setStatusFilter('ACTIVE')} className={`min-h-9 rounded-md px-3 ${statusFilter === 'ACTIVE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Berjalan</button>
          <button onClick={() => setStatusFilter('ALL')} className={`min-h-9 rounded-md px-3 ${statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Semua ({payouts.length})</button>
        </div>
        {capabilities.create ? <>
          <button type="button" onClick={() => setModal('impor-payout')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold"><FileXls className="h-4 w-4" />Impor Excel</button>
          <button type="button" onClick={() => setModal('ajukan')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white"><PaperPlaneTilt className="h-4 w-4" />Ajukan pencairan</button>
        </> : null}
      </div>}
    >""", 'panel antrean + tombol aksi utama')

rep("""description={statusFilter === 'ACTIVE' ? 'Semua pencairan sudah dibayar atau dibatalkan.' : 'Ajukan payout pertama lewat formulir di atas.'} />}""",
    """description={statusFilter === 'ACTIVE' ? 'Semua pencairan sudah dibayar atau dibatalkan.' : 'Tekan "Ajukan pencairan" untuk membuat yang pertama.'} />}""",
    'teks empty state')

rep("""    <BulkActionBar count={chosenCheck.length} noun="pencairan" onClear={() => setSelected(new Set())}>""",
    """    <BulkActionBar count={chosenCheck.length} noun="pencairan" onClear={() => setSelected(new Set())}>""",
    'BulkActionBar (tetap)')

rep("""    </BulkActionBar>
""", """    </BulkActionBar>
    </> : null}
""", 'tutup tab antrean')

# 4. Modal eksekusi manual memakai cangkang bersama
a = s.index("    {/* Eksekusi manual butuh nomor bukti")
b = s.index("    </div> : null}\n", a) + len("    </div> : null}\n")
s = s[:a] + """    {/* Nomor bukti wajib; dulu diminta lewat window.prompt yang tidak dapat divalidasi. */}
    <FinanceModal
      open={Boolean(executeTarget)}
      title="Catat pembayaran pencairan"
      description={executeTarget ? `Isi hanya setelah dana benar-benar dikirim ke ${executeTarget.name} sebesar ${rupiah(executeTarget.amount)}.` : ''}
      onClose={() => setExecuteTarget(null)}
      footer={<div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setExecuteTarget(null)} className="min-h-11 rounded-lg border border-slate-200 text-sm font-bold text-slate-700">Batal</button>
        <button type="button" disabled={pending || (executeTarget?.reference.trim().length ?? 0) < 3} onClick={() => {
          const target = executeTarget!
          setExecuteTarget(null)
          act(() => payPayoutAction({ id: target.id, reference: target.reference.trim() }), 'Pembayaran pencairan tercatat dan jurnal diposting.')
        }} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-50">Simpan pembayaran</button>
      </div>}>
      <label className="block text-xs font-bold text-slate-800">Nomor referensi transfer atau kuitansi
        <input autoFocus value={executeTarget?.reference ?? ''} onChange={event => setExecuteTarget(target => target ? { ...target, reference: event.target.value } : target)} placeholder="Contoh: TRF20260813001" className={`mt-1.5 ${field}`} />
        <span className="mt-1 block text-[11px] font-normal text-slate-500">Nomor ini dipakai saat mencocokkan saldo dengan rekening koran di akhir bulan.</span>
      </label>
    </FinanceModal>
""" + s[b:]
print('  ok : modal eksekusi manual memakai FinanceModal')

io.open(p, 'w', encoding='utf-8').write(s)
print('tahap 2 selesai')
