import io

p = 'app/dashboard/keuangan-terpusat/unit-kas/_cash-unit-client.tsx'
s = io.open(p, encoding='utf-8').read()


def rep(old, new, label):
    global s
    if old not in s:
        raise SystemExit('GAGAL: ' + label)
    s = s.replace(old, new, 1)
    print('  ok :', label)


rep("  ConfirmAction, EmptyState, FINANCE_FIELD_CLASS, FinanceTour, ResultBanner, SectionPanel, StatusBadge,",
    "  ConfirmAction, EmptyState, FINANCE_FIELD_CLASS, FinanceModal, FinanceTabs, FinanceTour, ResultBanner, SectionPanel, StatusBadge,",
    'impor')

rep("  const [showCreate, setShowCreate] = useState(data.units.length === 0)",
    """  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState<'selisih' | 'unit' | 'riwayat'>('selisih')""",
    'state tab')

io.open(p, 'w', encoding='utf-8').write(s)

# --- pindahkan form buat unit ke modal, per baris ---
lines = io.open(p, encoding='utf-8').read().split('\n')
awal = next(i for i, l in enumerate(lines) if l.strip().startswith('{showCreate ? <form'))
akhir = next(i for i, l in enumerate(lines) if i > awal and l.strip() == '</form> : null}')
form = lines[awal:akhir + 1]
form[0] = form[0].replace('{showCreate ? <form className="grid gap-3 border-b border-slate-100 bg-emerald-50/40 p-4 md:grid-cols-[1fr_180px_220px_auto]"',
                          '<form className="grid gap-3 sm:grid-cols-2"')
form[-1] = '      </form>'
modal = ['''    <FinanceModal
      open={showCreate}
      title="Buat Unit Kas"
      description="Satu Unit Kas mewakili satu loket fisik. Saldo tetap menjadi nilai awal saat operator membuka shift."
      size="lg"
      onClose={() => setShowCreate(false)}>'''] + form + ['    </FinanceModal>', '']
sisa = lines[:awal] + lines[akhir + 1:]

# sisipkan modal tepat setelah penutup SectionPanel "Daftar Unit Kas"
tutup = next(i for i, l in enumerate(sisa) if i > awal and l.strip() == '</SectionPanel>')
sisa = sisa[:tutup + 1] + [''] + modal + sisa[tutup + 1:]
io.open(p, 'w', encoding='utf-8').write('\n'.join(sisa))
print('  ok : form buat unit -> FinanceModal')

# --- tab bar + pembungkus tab ---
s = io.open(p, encoding='utf-8').read()
rep("""    <ResultBanner result={result} onDismiss={() => setResult(null)} />

    <SectionPanel title="Daftar Unit Kas\"""",
    """    <ResultBanner result={result} onDismiss={() => setResult(null)} />

    <FinanceTabs
      label="Kelompok pekerjaan unit kas"
      active={tab}
      onChange={id => setTab(id as typeof tab)}
      tabs={[
        { id: 'selisih', label: 'Antrean selisih', hint: 'Pekerjaan harian: review selisih kas saat shift ditutup', badge: pendingReviews.length },
        { id: 'unit', label: 'Unit & operator', hint: 'Data setup: unit kas dan penugasan operator', badge: 0 },
        { id: 'riwayat', label: 'Riwayat shift', hint: '60 shift terbaru dari seluruh unit', badge: 0 },
      ]}
    />

    {tab === 'unit' ? <>
    <SectionPanel title="Daftar Unit Kas\"""",
    'tab bar + buka tab unit')

rep("""    <SectionPanel title="Antrean review selisih\"""",
    """    </> : null}

    {tab === 'selisih' ? <SectionPanel title="Antrean review selisih\"""",
    'buka tab selisih')

rep("""    <SectionPanel title="Riwayat shift" description="60 shift terbaru dari seluruh Unit Kas.">""",
    """    {tab === 'riwayat' ? <SectionPanel title="Riwayat shift" description="60 shift terbaru dari seluruh Unit Kas.">""",
    'buka tab riwayat')

io.open(p, 'w', encoding='utf-8').write(s)
print('tahap 2 selesai')
