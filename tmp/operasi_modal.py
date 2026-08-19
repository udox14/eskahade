import io

p = 'app/dashboard/keuangan-terpusat/operasi/_operations-client.tsx'
s = io.open(p, encoding='utf-8').read()


def rep(old, new, label):
    global s
    if old not in s:
        raise SystemExit('GAGAL anchor: %s' % label)
    s = s.replace(old, new, 1)
    print('  ok :', label)


# --- state modal ---
rep("  const [confirmReopen, setConfirmReopen] = useState(false)",
    """  const [confirmReopen, setConfirmReopen] = useState(false)
  /** Satu state untuk semua dialog di halaman ini. */
  const [modal, setModal] = useState<'settlement' | 'tagihan' | 'impor-tagihan' | null>(null)""",
    'state modal')

# --- Settlement: panel -> modal ---
rep("""      <SectionPanel title="Posting settlement gateway" description="Catat pencairan dana gateway ke rekening bank. Bruto harus sama dengan neto ditambah biaya provider.">
        <form action={form => mutate(() => settlementAction(form), 'Settlement berhasil diposting.', 'Settlement dengan referensi dan angka yang sama persis sudah pernah diposting.')} className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">""",
    """      <SectionPanel
        title="Settlement gateway"
        description="Catat pencairan dana gateway ke rekening bank."
        action={data.capabilities.configure ? <button type="button" onClick={() => setModal('settlement')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white">Posting settlement</button> : null}>
        <p className="p-4 text-xs leading-5 text-slate-500">
          Dipakai setiap kali dana dari gateway masuk ke rekening utama. Bruto harus sama dengan neto ditambah biaya provider —
          sistem menolak bila tidak seimbang.
        </p>
      </SectionPanel>

      <FinanceModal
        open={modal === 'settlement'}
        title="Posting settlement gateway"
        description="Bruto harus sama dengan neto ditambah biaya provider."
        size="lg"
        onClose={() => setModal(null)}>
        <form action={form => { setModal(null); mutate(() => settlementAction(form), 'Settlement berhasil diposting.', 'Settlement dengan referensi dan angka yang sama persis sudah pernah diposting.') }} className="grid gap-3 sm:grid-cols-2">""",
    'settlement jadi modal')

rep("""          <p className="text-[11px] leading-4 text-slate-500 sm:col-span-2 xl:col-span-5">Referensi yang sama boleh dipakai lagi selama angkanya berbeda — sistem mencocokkan isi, bukan sekadar nomornya.</p>
        </form>
      </SectionPanel>
    </div> : null}""",
    """          <p className="text-[11px] leading-4 text-slate-500 sm:col-span-2">Referensi yang sama boleh dipakai lagi selama angkanya berbeda — sistem mencocokkan isi, bukan sekadar nomornya.</p>
        </form>
      </FinanceModal>
    </div> : null}""",
    'tutup modal settlement')

# --- Tagihan: BulkImport + form -> modal, sisakan panel daftar ---
rep("""    {tab === 'tagihan' ? <div className="space-y-4">
      <BulkImport<Omit<BillImportRow, 'row'>>""",
    """    {tab === 'tagihan' ? <div className="space-y-4">
      <FinanceModal
        open={modal === 'impor-tagihan'}
        title="Impor massal tagihan santri"
        size="xl"
        onClose={() => setModal(null)}>
        <BulkImport<Omit<BillImportRow, 'row'>>""",
    'buka modal impor tagihan')

rep("""        onSubmit={values => importBillsAction(values)}
      />

      <SectionPanel title="Buat tagihan santri" description="SPP dan Non-SPP wajib dilunasi sekaligus; USPP boleh dicicil oleh wali.">
        <form action={form => mutate(() => createBillAction(form), 'Tagihan berhasil dibuat.')} className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">""",
    """        onSubmit={values => importBillsAction(values)}
        />
      </FinanceModal>

      <FinanceModal
        open={modal === 'tagihan'}
        title="Buat tagihan santri"
        description="SPP dan Non-SPP wajib dilunasi sekaligus; USPP boleh dicicil oleh wali."
        size="lg"
        onClose={() => setModal(null)}>
        <form action={form => { setModal(null); mutate(() => createBillAction(form), 'Tagihan berhasil dibuat.') }} className="grid gap-3 sm:grid-cols-2">""",
    'buat tagihan jadi modal')

rep("""          <p className="text-[11px] leading-4 text-slate-500 sm:col-span-2 xl:col-span-2">Santri berstatus bebas SPP otomatis ditolak untuk jenis SPP. Tagihan yang sudah dibayar tidak dapat dibatalkan.</p>
        </form>
      </SectionPanel>

      <SectionPanel title="Tagihan terbaru" description="Validasi hasil pembuatan dan status pembayaran tagihan.">""",
    """          <p className="text-[11px] leading-4 text-slate-500 sm:col-span-2">Santri berstatus bebas SPP otomatis ditolak untuk jenis SPP. Tagihan yang sudah dibayar tidak dapat dibatalkan.</p>
        </form>
      </FinanceModal>

      <SectionPanel
        title="Tagihan terbaru"
        description="Validasi hasil pembuatan dan status pembayaran tagihan."
        action={data.capabilities.configure ? <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setModal('impor-tagihan')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold">Impor Excel</button>
          <button type="button" onClick={() => setModal('tagihan')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white">Buat tagihan</button>
        </div> : null}>""",
    'panel daftar tagihan + tombol')

io.open(p, 'w', encoding='utf-8').write(s)
print('selesai')
