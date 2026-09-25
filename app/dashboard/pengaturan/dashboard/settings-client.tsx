'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Save, Settings2 } from 'lucide-react'
import { DASHBOARD_ROLES, DASHBOARD_WIDGETS, type DashboardWidgetKey } from '@/lib/dashboard/catalog'
import type { HeroConfig, TickerConfig } from '@/lib/dashboard/config'
import { saveDashboardHero, saveDashboardRoleWidgets, saveDashboardTicker } from './actions'

type Props = {
  appearance: { hero: HeroConfig; ticker: TickerConfig }
  selections: Record<string, DashboardWidgetKey[]>
}

const prettyRole = (role: string) => role.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())

function HeroPreview({ url, hero, mobile }: { url: string; hero: HeroConfig; mobile?: boolean }) {
  const crop = mobile ? hero.mobile : hero.desktop
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-[#12372a] ${mobile ? 'aspect-[3/4] max-w-[240px]' : 'aspect-[16/6]'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Pratinjau hero" className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})` }} />
      <div className={`absolute inset-0 ${hero.textColor === 'white' ? 'bg-gradient-to-r from-black/65 via-black/20 to-transparent' : 'bg-gradient-to-r from-white/80 via-white/25 to-transparent'}`} />
      <div className={`absolute bottom-5 left-5 ${hero.textColor === 'white' ? 'text-white' : 'text-black'}`}>
        <span className="text-xs font-semibold">ESKAHADE</span>
        <p className={`${mobile ? 'text-xl' : 'text-3xl'} mt-2 font-semibold`}>Selamat pagi, Ahmad</p>
      </div>
    </div>
  )
}

export function DashboardSettingsClient({ appearance, selections }: Props) {
  const [hero, setHero] = useState(appearance.hero)
  const [ticker, setTicker] = useState(appearance.ticker)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [role, setRole] = useState<string>('admin')
  const [roleWidgets, setRoleWidgets] = useState(selections)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const selected = roleWidgets[role] ?? []
  const updateCrop = (mode: 'desktop' | 'mobile', field: 'x' | 'y' | 'zoom', value: number) => {
    setHero(current => ({ ...current, [mode]: { ...current[mode], [field]: value } }))
  }
  const onImage = (file: File | undefined) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8_000_000) {
      setMessage('Pilih gambar PNG, JPEG, atau WebP maksimal 8 MB.')
      return
    }
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setMessage(null)
  }

  const saveHero = async () => {
    setBusy('hero'); setMessage(null)
    try {
      if (imageFile) {
        const form = new FormData()
        form.set('file', imageFile)
        form.set('config', JSON.stringify({ textColor: hero.textColor, desktop: hero.desktop, mobile: hero.mobile }))
        const response = await fetch('/api/dashboard/hero', { method: 'POST', body: form })
        const result = await response.json() as { url?: string; hero?: HeroConfig; error?: string }
        if (!response.ok || !result.url) throw new Error(result.error || 'Gagal mengunggah gambar.')
        setHero(result.hero ?? { ...hero, imageUrl: result.url })
        setImageFile(null)
        setPreviewUrl(null)
      } else {
        setHero(await saveDashboardHero({ textColor: hero.textColor, desktop: hero.desktop, mobile: hero.mobile }))
      }
      setMessage('Hero berhasil disimpan.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal menyimpan hero.') }
    finally { setBusy(null) }
  }

  const saveTicker = async () => {
    setBusy('ticker'); setMessage(null)
    try { setTicker(await saveDashboardTicker(ticker)); setMessage('Running text berhasil disimpan.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal menyimpan running text.') }
    finally { setBusy(null) }
  }

  const toggleWidget = (key: DashboardWidgetKey) => {
    setRoleWidgets(current => ({ ...current, [role]: selected.includes(key) ? selected.filter(item => item !== key) : [...selected, key] }))
  }
  const moveWidget = (key: DashboardWidgetKey, direction: number) => {
    const index = selected.indexOf(key)
    const target = index + direction
    if (index < 0 || target < 0 || target >= selected.length) return
    const next = [...selected]
    ;[next[index], next[target]] = [next[target], next[index]]
    setRoleWidgets(current => ({ ...current, [role]: next }))
  }
  const saveWidgets = async () => {
    setBusy('widgets'); setMessage(null)
    try { await saveDashboardRoleWidgets(role, selected); setMessage(`Widget untuk ${prettyRole(role)} berhasil disimpan.`) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal menyimpan widget.') }
    finally { setBusy(null) }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16 text-[#1c2923]">
      <header>
        <div className="flex items-center gap-3"><Settings2 className="h-6 w-6 text-[#247451]" /><h1 className="text-2xl font-semibold">Pengaturan Dashboard</h1></div>
        <p className="mt-2 text-sm text-[#66736c]">Atur tampilan beranda untuk seluruh pengguna dan widget untuk tiap role.</p>
      </header>
      {message && <p role="status" className="rounded-xl border border-[#ddd4c3] bg-white px-4 py-3 text-sm">{message}</p>}

      <section className="space-y-5 border-t border-[#ddd4c3] pt-7">
        <div><h2 className="text-lg font-semibold">Gambar hero</h2><p className="text-sm text-[#66736c]">Satu gambar aktif. Atur potongan gambar untuk desktop dan mobile secara terpisah.</p></div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#c9d8ce] bg-white px-4 py-3 text-sm font-semibold text-[#12372a] hover:bg-[#eef4ee]">
          <ImagePlus className="h-4 w-4" /> Ganti gambar
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => onImage(event.target.files?.[0])} />
        </label>
        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#66736c]">Desktop</p><HeroPreview url={previewUrl ?? hero.imageUrl} hero={hero} /></div>
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#66736c]">Mobile</p><HeroPreview url={previewUrl ?? hero.imageUrl} hero={hero} mobile /></div>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {(['desktop', 'mobile'] as const).map(mode => (
            <fieldset key={mode} className="space-y-3 rounded-xl border border-[#ddd4c3] bg-white p-4">
              <legend className="px-1 font-semibold capitalize">Crop {mode}</legend>
              {(['x', 'y', 'zoom'] as const).map(field => (
                <label key={field} className="block text-sm">{field === 'x' ? 'Posisi horizontal' : field === 'y' ? 'Posisi vertikal' : 'Perbesaran'}
                  <input className="mt-1 w-full accent-[#247451]" type="range" min={field === 'zoom' ? 1 : 0} max={field === 'zoom' ? 2.5 : 100}
                    step={field === 'zoom' ? 0.05 : 1} value={hero[mode][field]}
                    onChange={event => updateCrop(mode, field, Number(event.target.value))} />
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <fieldset className="flex items-center gap-5 text-sm"><legend className="mb-2 font-semibold">Warna tulisan hero</legend>
          {(['white', 'black'] as const).map(value => <label key={value} className="flex items-center gap-2"><input type="radio" checked={hero.textColor === value} onChange={() => setHero(current => ({ ...current, textColor: value }))} />{value === 'white' ? 'Putih' : 'Hitam'}</label>)}
        </fieldset>
        <button disabled={!!busy} onClick={saveHero} className="inline-flex items-center gap-2 rounded-xl bg-[#12372a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" /> Simpan hero</button>
      </section>

      <section className="space-y-5 border-t border-[#ddd4c3] pt-7">
        <div><h2 className="text-lg font-semibold">Running text</h2><p className="text-sm text-[#66736c]">Kosongkan isi untuk menyembunyikan strip pengumuman.</p></div>
        <label className="block text-sm font-semibold">Isi pengumuman<textarea maxLength={500} rows={2} value={ticker.text} onChange={event => setTicker(current => ({ ...current, text: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#ddd4c3] bg-white p-3 font-normal outline-none focus:ring-2 focus:ring-[#247451]" /></label>
        <div className="flex flex-wrap gap-6">
          <label className="text-sm font-semibold">Warna latar <input type="color" value={ticker.backgroundColor} onChange={event => setTicker(current => ({ ...current, backgroundColor: event.target.value }))} className="ml-2 align-middle" /></label>
          <label className="text-sm font-semibold">Warna teks <input type="color" value={ticker.textColor} onChange={event => setTicker(current => ({ ...current, textColor: event.target.value }))} className="ml-2 align-middle" /></label>
        </div>
        <div className="overflow-hidden rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: ticker.backgroundColor, color: ticker.textColor }}>{ticker.text || 'Pratinjau pengumuman akan tampil di sini.'}</div>
        <button disabled={!!busy} onClick={saveTicker} className="inline-flex items-center gap-2 rounded-xl bg-[#12372a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" /> Simpan running text</button>
      </section>

      <section className="space-y-5 border-t border-[#ddd4c3] pt-7">
        <div><h2 className="text-lg font-semibold">Widget per role</h2><p className="text-sm text-[#66736c]">Widget tetap mengikuti izin menu dan cakupan data masing-masing pengguna.</p></div>
        <label className="block text-sm font-semibold">Role
          <select value={role} onChange={event => setRole(event.target.value)} className="ml-3 rounded-lg border border-[#ddd4c3] bg-white px-3 py-2 font-normal">
            {DASHBOARD_ROLES.map(item => <option key={item} value={item}>{prettyRole(item)}</option>)}
          </select>
        </label>
        <div className="overflow-hidden rounded-xl border border-[#ddd4c3] bg-white">
          <div className="border-b border-[#e8e1d4] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#66736c]">Ditampilkan sesuai urutan</div>
          {selected.length === 0 && <p className="px-4 py-4 text-sm text-[#66736c]">Tidak ada widget aktif untuk role ini.</p>}
          {selected.map((key, index) => {
            const widget = DASHBOARD_WIDGETS.find(item => item.key === key)
            if (!widget) return null
            return <div key={key} className="flex items-center gap-3 border-b border-[#e8e1d4] px-4 py-3">
              <span className="w-5 text-xs font-bold tabular-nums text-[#66736c]">{index + 1}</span>
              <label className="flex flex-1 items-center gap-3 text-sm"><input type="checkbox" checked onChange={() => toggleWidget(key)} />{widget.title}</label>
              <button disabled={index === 0} aria-label={'Naikkan ' + widget.title} onClick={() => moveWidget(key, -1)} className="rounded-lg p-2 hover:bg-[#eef4ee] disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
              <button disabled={index === selected.length - 1} aria-label={'Turunkan ' + widget.title} onClick={() => moveWidget(key, 1)} className="rounded-lg p-2 hover:bg-[#eef4ee] disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
            </div>
          })}
          <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#66736c]">Widget tersedia</div>
          {DASHBOARD_WIDGETS.filter(widget => !selected.includes(widget.key)).map(widget =>
            <label key={widget.key} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#f7f1e5]">
              <input type="checkbox" checked={false} onChange={() => toggleWidget(widget.key)} />{widget.title}
            </label>
          )}
        </div>        <button disabled={!!busy} onClick={saveWidgets} className="inline-flex items-center gap-2 rounded-xl bg-[#12372a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" /> Simpan widget role</button>
      </section>
    </div>
  )
}
