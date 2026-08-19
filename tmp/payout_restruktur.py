import io, re

p = 'app/dashboard/keuangan-terpusat/payout/_payout-client.tsx'
s = io.open(p, encoding='utf-8').read()


def rep(old, new, label):
    global s
    if old not in s:
        raise SystemExit('GAGAL, anchor tidak ketemu: %s' % label)
    s = s.replace(old, new, 1)
    print('  ok :', label)


# ---------- impor komponen ----------
rep("""  ConfirmAction, EmptyState, FINANCE_FIELD_CLASS, FinanceTour, MetricCard, ResultBanner, SectionPanel, StatusBadge,
  useFinanceTour, type FinanceResult, type TourStep,""",
    """  ConfirmAction, EmptyState, FINANCE_FIELD_CLASS, FinanceModal, FinanceTabs, FinanceTour, MetricCard,
  ResultBanner, SectionPanel, StatusBadge, useFinanceTour, type FinanceResult, type TourStep,""",
    'impor FinanceTabs & FinanceModal')

# ---------- state ----------
rep("""  const [showRecipient, setShowRecipient] = useState(false)""",
    """  /**
   * Satu state untuk seluruh dialog. Sebelumnya form pengajuan dan form rekening
   * selalu terbuka di layar, dan panel impor Excel dirender di dasar halaman -
   * ratusan baris jauh dari tombol yang membukanya.
   */
  const [modal, setModal] = useState<'ajukan' | 'impor-payout' | 'rekening' | 'impor-rekening' | null>(null)
  /** Tab pertama selalu pekerjaan harian; data setup menyusul di tab kedua. */
  const [tab, setTab] = useState<'antrean' | 'rekening'>('antrean')""",
    'state modal & tab')

rep("  const [importMode, setImportMode] = useState<'recipients' | 'payouts' | null>(null)\n", '', 'buang importMode')

rep("""  function closeRecipientForm() {
    setShowRecipient(false)
    setRecipientDraft(emptyRecipientDraft)
  }""",
    """  function tutupModal() {
    setModal(null)
    setRecipientDraft(emptyRecipientDraft)
  }""", 'tutupModal')

# ---------- tab bar + panel antrean ----------
rep("""    <ResultBanner result={result} onDismiss={() => setResult(null)} />

    <div className="grid gap-4 lg:grid-cols-2">
      <SectionPanel
        title="Ajukan payout"
        description="Anda berperan sebagai maker. Pemeriksa dan pelaksana harus orang lain."
        action={capabilities.create ? <button type="button" onClick={() => setImportMode(mode => mode === 'payouts' ? null : 'payouts')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold"><FileXls className="h-4 w-4" />{importMode === 'payouts' ? 'Tutup impor' : 'Impor Excel'}</button> : null}
      >
        <form data-tour="create" className="grid gap-3 p-4" action={form => {""",
    """    <ResultBanner result={result} onDismiss={() => setResult(null)} />

    <FinanceTabs
      label="Kelompok pekerjaan payout"
      active={tab}
      onChange={id => setTab(id as 'antrean' | 'rekening')}
      tabs={[
        { id: 'antrean', label: 'Antrean pencairan', hint: 'Pekerjaan harian: setujui dan bayar', badge: counts.submitted + counts.checked },
        { id: 'rekening', label: 'Rekening penerima', hint: 'Data setup, jarang berubah', badge: recipients.filter(row => row.status === 'PENDING_VERIFICATION').length },
      ]}
    />

    {tab === 'rekening' ? <>
      <SectionPanel
        title="Rekening penerima"
        description="Rekening baru wajib diverifikasi petugas lain sebelum bisa menerima transfer."
        action={capabilities.configure ? <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setModal('rekening')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold"><UserPlus className="h-4 w-4" />Daftarkan rekening</button>
          <button type="button" onClick={() => setModal('impor-rekening')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold"><FileXls className="h-4 w-4" />Impor Excel</button>
        </div> : null}
      >
        <div data-tour="recipients">
          <div className="divide-y divide-slate-100">
            {recipients.length ? recipients.map(row => {
              return <article key={row.id} className="flex flex-col gap-2 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <strong className="block break-words text-slate-800">{row.name}</strong>
                  <span className="block font-mono text-[11px] text-slate-500">{row.account_number_masked || 'Tanpa rekening'}</span>
                  <span className="text-[11px] text-slate-400">{row.recipient_type}{row.asrama_scope ? ` · ${row.asrama_scope}` : ''}</span>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <StatusBadge tone={row.status === 'ACTIVE' ? 'emerald' : row.status === 'PENDING_VERIFICATION' ? 'amber' : 'slate'}>
                    {row.status === 'ACTIVE' ? 'Siap dipakai' : row.status === 'PENDING_VERIFICATION' ? 'Belum diverifikasi' : row.status}
                  </StatusBadge>
                  {row.status === 'PENDING_VERIFICATION' ? <button disabled={!capabilities.check || pending} onClick={() => act(() => verifyRecipientAction(row.id), 'Rekening diverifikasi dan siap dipakai.')} className="min-h-9 rounded-lg border border-slate-200 px-3 font-bold disabled:opacity-50">Verifikasi</button> : null}
                </div>
              </article>
            }) : <EmptyState icon={Bank} title="Belum ada rekening penerima" description="Daftarkan rekening pengelola makan, laundry, atau guru sebelum mengajukan pencairan." />}
          </div>
        </div>
      </SectionPanel>
    </> : null}

    <FinanceModal
      open={modal === 'ajukan'}
      title="Ajukan pencairan"
      description="Anda berperan sebagai maker. Yang menyetujui harus orang lain."
      onClose={tutupModal}>
        <form data-tour="create" className="grid gap-3" action={form => {
          setModal(null)""",
    'tab bar + panel rekening + buka modal ajukan')

# ---------- tutup modal ajukan, buka panel antrean ----------
rep("""          <button disabled={!capabilities.create || pending || !readyRecipients.length} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">Ajukan payout</button>
          {!capabilities.create ? <p className="text-[11px] text-slate-500">Akun Anda tidak memiliki kewenangan mengajukan payout.</p> : null}
        </form>
      </SectionPanel>
""",
    """          <button disabled={!capabilities.create || pending || !readyRecipients.length} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">Ajukan pencairan</button>
          {!capabilities.create ? <p className="text-[11px] text-slate-500">Akun Anda tidak memiliki kewenangan mengajukan pencairan.</p> : null}
        </form>
    </FinanceModal>
""", 'tutup modal ajukan')

# ---------- form rekening lama -> isi modal ----------
rep("""      <SectionPanel
        title="Rekening penerima"
        description="Rekening baru wajib diverifikasi petugas lain sebelum bisa menerima transfer."
        action={capabilities.configure ? <div className="flex flex-wrap gap-2">
          <button onClick={() => showRecipient ? closeRecipientForm() : setShowRecipient(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold"><UserPlus className="h-4 w-4" />{showRecipient ? 'Tutup' : 'Tambah'}</button>
          <button type="button" onClick={() => setImportMode(mode => mode === 'recipients' ? null : 'recipients')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold"><FileXls className="h-4 w-4" />{importMode === 'recipients' ? 'Tutup impor' : 'Impor Excel'}</button>
        </div> : null}
      >
        <div data-tour="recipients">
          {showRecipient ? <form className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-4" action={form => {
            const account = recipientDraft.account.replace(/\\s/g, '')
            closeRecipientForm()""",
    """    <FinanceModal
      open={modal === 'rekening'}
      title="Daftarkan rekening penerima"
      description="Nomor rekening disimpan terenkripsi dan hanya ditampilkan tersamar setelah disimpan."
      size="lg"
      onClose={tutupModal}>
          <form className="grid gap-3" action={form => {
            const account = recipientDraft.account.replace(/\\s/g, '')
            tutupModal()""",
    'form rekening jadi isi modal')

print('tahap 1 selesai')
io.open(p, 'w', encoding='utf-8').write(s)
