'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpenCheck, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import {
  ActionIcon, Badge, Box, Button, Center, Group, Loader, NativeSelect, Paper, SimpleGrid, Stack, Text, ThemeIcon, UnstyledButton,
} from '@mantine/core'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  addJuzToMarhalah, addSurahToMarhalah, assignKitabToMarhalah, bersihkanResiduHafalan,
  getMasterAssign, removeQuranSurah, unassignJenisFromMarhalah,
} from './actions'

const ARABIC_FONT = '"Amiri Quran", "Scheherazade New", "Traditional Arabic", serif'

type Catalog = { jenis: string; label: string; kitab: { key: string; label: string }[] }

export default function MasterHafalanContent() {
  const [data, setData] = useState<any>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => setData(await getMasterAssign())
  useEffect(() => { load().finally(() => setLoading(false)) }, [])

  const active = useMemo(() => data?.marhalah.find((m: any) => m.id === activeId) || null, [data, activeId])

  if (loading || !data) {
    return <Center py={80}><Loader color="gray" size="lg" /></Center>
  }

  return (
    <Box pb={96}>
      {active ? (
        <MarhalahDetail key={active.id} marhalah={active} data={data} onBack={() => setActiveId(null)} reload={load} />
      ) : (
        <MarhalahList data={data} onOpen={setActiveId} reload={load} />
      )}
    </Box>
  )
}

// ── List marhalah ────────────────────────────────────────────────────────────

function MarhalahList({ data, onOpen, reload }: { data: any; onOpen: (id: number) => void; reload: () => Promise<void> }) {
  const confirm = useConfirm()
  const catalog: Catalog[] = data.catalog
  const [cleaning, setCleaning] = useState(false)
  const labelKitab = (jenis: string, key: string) =>
    catalog.find(c => c.jenis === jenis)?.kitab.find(k => k.key === key)?.label || key

  const bersihkan = async () => {
    if (!await confirm('Hapus semua assignment & materi residu lama (paket di luar konvensi baru)? Tidak bisa dibatalkan.')) return
    setCleaning(true)
    try {
      const res = await bersihkanResiduHafalan()
      if ('error' in res) return toast.error(res.error)
      toast.success(res.clean ? 'Sudah bersih, tidak ada residu.' : `Dibersihkan: ${res.deletedPaket} paket, ${res.deletedBab} bab, ${res.deletedBlok} blok`)
      await reload()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal membersihkan residu.')
    } finally {
      setCleaning(false)
    }
  }

  return (
    <Stack gap="md">
      <DashboardPageHeader
        title="Master Hafalan"
        description="Pilih marhalah, lalu assign kitab atau surat/juz Qur'an untuknya."
        action={
          <Button onClick={bersihkan} loading={cleaning} variant="light" color="pink" fw={700}
            fullWidth={false} leftSection={<Trash2 className="h-4 w-4" />}>
            Bersihkan Residu
          </Button>
        }
      />
      <Stack gap="xs">
        {data.marhalah.map((m: any) => {
          const a = data.assignments[m.id] || { quran: { surat: [] }, kitab: {} }
          const chips: string[] = []
          if (a.quran.surat?.length) chips.push(`Qur'an: ${a.quran.surat.length} surat`)
          for (const c of catalog) if (a.kitab[c.jenis]) chips.push(`${c.label}: ${labelKitab(c.jenis, a.kitab[c.jenis])}`)
          return (
            <UnstyledButton key={m.id} onClick={() => onOpen(m.id)}>
              <Paper withBorder radius="lg" p="md" shadow="sm">
                <Group gap="md" wrap="nowrap">
                  <ThemeIcon variant="light" color="teal" radius="md" size="lg"><BookOpenCheck className="h-5 w-5" /></ThemeIcon>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Text fw={700} c="dark.8">{m.nama}</Text>
                    {chips.length ? (
                      <Group gap={6} mt={4}>
                        {chips.map((c, i) => <Badge key={i} variant="light" color="gray" size="sm" radius="sm">{c}</Badge>)}
                      </Group>
                    ) : <Text size="xs" c="gray.5" mt={2}>Belum ada hafalan di-assign</Text>}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0" color="var(--mantine-color-gray-4)" />
                </Group>
              </Paper>
            </UnstyledButton>
          )
        })}
      </Stack>
    </Stack>
  )
}

// ── Detail marhalah ──────────────────────────────────────────────────────────

function MarhalahDetail({ marhalah, data, onBack, reload }: { marhalah: any; data: any; onBack: () => void; reload: () => Promise<void> }) {
  const catalog: Catalog[] = data.catalog
  const assign = data.assignments[marhalah.id] || { quran: { surat: [] }, kitab: {} }
  const [busy, setBusy] = useState(false)
  const [surah, setSurah] = useState('1')
  const [juz, setJuz] = useState('30')

  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true)
    try {
      const res = await fn()
      if (res && 'error' in res) return toast.error(res.error)
      toast.success(ok)
      await reload()
    } catch (e: any) {
      toast.error(e?.message || 'Terjadi kesalahan.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box>
      <Box mb="md" py="sm"
        style={{ position: 'sticky', top: 0, zIndex: 20, borderBottom: '1px solid var(--mantine-color-gray-1)', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)' }}>
        <UnstyledButton onClick={onBack} mb={4}>
          <Group gap={6} c="teal.7"><ArrowLeft className="h-4 w-4" /><Text size="sm" fw={700}>Semua Marhalah</Text></Group>
        </UnstyledButton>
        <Text fz="xl" fw={700} c="dark.8">{marhalah.nama}</Text>
      </Box>

      {/* Al-Qur'an */}
      <Paper component="section" withBorder radius="lg" p="md" shadow="sm" mb="md">
        <Group gap="xs" mb="sm"><BookOpenCheck className="h-5 w-5" color="var(--mantine-color-teal-8)" /><Text fw={700} c="teal.8">Al-Qur'an</Text></Group>

        {assign.quran.surat?.length ? (
          <Group gap={6} mb="sm">
            {assign.quran.surat.map((s: any) => (
              <Badge key={s.babId} variant="light" color="teal" size="lg" radius="md"
                rightSection={
                  <ActionIcon size="xs" variant="transparent" color="teal" disabled={busy} aria-label="Lepas surat"
                    onClick={() => run(() => removeQuranSurah({ babId: s.babId }), 'Surat dilepas')}>
                    <X className="h-3.5 w-3.5" />
                  </ActionIcon>
                }>
                <Group gap={6} wrap="nowrap">
                  <span dir="rtl" style={{ fontFamily: ARABIC_FONT, textTransform: 'none' }}>{s.title}</span>
                  <Text span size="11px" c="teal.5">{s.ayat} ayat</Text>
                </Group>
              </Badge>
            ))}
          </Group>
        ) : <Text size="xs" c="gray.5" mb="sm">Belum ada surat/juz.</Text>}

        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
          <Group gap="xs" wrap="nowrap">
            <NativeSelect style={{ flex: 1 }} value={surah} onChange={e => setSurah(e.currentTarget.value)}
              data={data.quranSurahs.map((s: any) => ({ value: String(s.number), label: `${s.number}. ${s.arabicName || s.name}` }))} />
            <Button color="teal" fw={700} disabled={busy} leftSection={<Plus className="h-4 w-4" />}
              onClick={() => run(() => addSurahToMarhalah({ marhalahId: marhalah.id, surahNumber: Number(surah) }), 'Surat di-assign')}>Surat</Button>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <NativeSelect style={{ flex: 1 }} value={juz} onChange={e => setJuz(e.currentTarget.value)}
              data={Array.from({ length: 30 }, (_, i) => 30 - i).map(n => ({ value: String(n), label: `Juz ${n}` }))} />
            <Button color="teal" fw={700} disabled={busy} leftSection={<Plus className="h-4 w-4" />}
              onClick={() => run(() => addJuzToMarhalah({ marhalahId: marhalah.id, juz: Number(juz) }), 'Juz di-assign')}>Juz</Button>
          </Group>
        </SimpleGrid>
      </Paper>

      {/* Kitab non-quran */}
      {catalog.map(c => {
        const current = assign.kitab[c.jenis] || ''
        return (
          <Paper component="section" key={c.jenis} withBorder radius="lg" p="md" shadow="sm" mb="md">
            <Text fw={700} c="dark.7" mb="sm">{c.label}</Text>
            <NativeSelect
              value={current}
              disabled={busy}
              onChange={e => {
                const v = e.currentTarget.value
                if (v) run(() => assignKitabToMarhalah({ marhalahId: marhalah.id, jenis: c.jenis, kitabKey: v }), 'Kitab di-assign')
                else run(() => unassignJenisFromMarhalah({ marhalahId: marhalah.id, jenis: c.jenis }), 'Assign dilepas')
              }}
              data={[{ value: '', label: '— Tidak di-assign —' }, ...c.kitab.map(k => ({ value: k.key, label: k.label }))]}
            />
            <Text size="xs" c="dimmed" mt="xs">Pilih satu kitab — seluruh isinya otomatis jadi materi hafalan marhalah ini.</Text>
          </Paper>
        )
      })}
    </Box>
  )
}
