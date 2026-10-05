'use client';
import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { getSupervisiTeam, setSupervisiTeamMember, removeSupervisiTeamMember } from '@/app/dashboard/sekpen/supervisi/actions';
import { inputClass, secondaryClass } from '@/components/supervisi/styles';
const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40';
type Team = Awaited<ReturnType<typeof getSupervisiTeam>>;
export default function SupervisiTeam() {
    const [data, setData] = useState<Team | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState<string | null>(null), [userId, setUserId] = useState(''), [all, setAll] = useState(false), [search, setSearch] = useState(''), [removing, setRemoving] = useState<string | null>(null);
    useEffect(() => { let active = true; getSupervisiTeam().then(d => { if (active) setData(d); }).catch(() => { if (active) setError('Tim Supervisi belum dapat dimuat. Periksa akses admin dan aktivasi modul.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
    async function save() {
        setBusy(true); setError('');
        try { const result = await setSupervisiTeamMember(userId, all); if (!result.ok) { setError(result.error); return; } setData(await getSupervisiTeam()); setEditing(null); }
        catch { setError('Penugasan belum dapat dipastikan. Muat ulang untuk memeriksa status.'); }
        finally { setBusy(false); }
    }
    async function remove() {
        if (!removing) return;
        setBusy(true); setError('');
        try { const result = await removeSupervisiTeamMember(removing); if (!result.ok) { setError(result.error); return; } setData(await getSupervisiTeam()); setRemoving(null); }
        catch { setError('Penugasan belum dapat dicabut. Coba lagi.'); }
        finally { setBusy(false); }
    }
    function edit(id = '') { const member = data?.members.find(m => m.id === id); setUserId(id); setAll(!!member?.can_manage_all); setSearch(''); setRemoving(null); setEditing(id); }
    return <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-800">Petugas Supervisi</h2><p className="mt-1 text-sm text-slate-500">{data?.members.length ?? 0} petugas · penugasan berlaku untuk seluruh kegiatan.</p></div><button className={primary} disabled={loading || !data || busy} onClick={() => edit()}><Plus size={16}/>Tambah petugas</button></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {editing !== null && <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-800">{editing ? 'Ubah akses petugas' : 'Tambah petugas Supervisi'}</h3><button aria-label="Tutup pengaturan petugas" disabled={busy} className="flex min-h-11 min-w-11 items-center justify-center text-slate-500" onClick={() => setEditing(null)}><X size={18}/></button></div>{!editing && <label className="block text-sm font-medium">Cari pengguna<input className={inputClass + ' mt-1'} value={search} onChange={e => setSearch(e.target.value)} placeholder="Nama pengguna…" disabled={busy}/></label>}<label className="block text-sm font-medium">Pengguna<select className={inputClass + ' mt-1'} value={userId} disabled={busy || !!editing} onChange={e => setUserId(e.target.value)}><option value="">Pilih pengguna</option>{data?.users.filter(u => editing ? u.id === editing : !data.members.some(m => m.id === u.id) && (u.id === userId || u.full_name.toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id')))).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label><label className="block text-sm font-medium">Cakupan akses<select className={inputClass + ' mt-1'} disabled={busy} value={all ? 'all' : 'own'} onChange={e => setAll(e.target.value === 'all')}><option value="own">Hasil sendiri</option><option value="all">Semua hasil dan draft</option></select></label><p className="text-sm leading-6 text-slate-500">{all ? 'Dapat membaca semua hasil, mengedit semua draft, melihat analitik keseluruhan, dan mencetak.' : 'Dapat memulai wawancara dan mengelola hasil miliknya. Status seluruh target guru tetap terlihat.'}</p><div className="flex flex-wrap gap-3"><button disabled={busy || !userId} className={primary} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan penugasan'}</button><button disabled={busy} className={secondaryClass} onClick={() => setEditing(null)}>Batal</button></div></div>}
        {removing && <div role="alert" className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-900">Cabut penugasan <strong>{data?.members.find(m => m.id === removing)?.full_name}</strong>? Akses Supervisi akan dicabut; hasil wawancaranya tetap tersimpan.</p><div className="flex flex-wrap gap-3"><button className={secondaryClass} disabled={busy} onClick={remove}>Konfirmasi cabut akses</button><button className={secondaryClass} disabled={busy} onClick={() => setRemoving(null)}>Batal</button></div></div>}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{loading ? <p className="p-8 text-center text-sm text-slate-500">Memuat tim Supervisi…</p> : !data?.members.length ? <p className="p-8 text-center text-sm text-slate-500">Belum ada petugas Supervisi yang ditugaskan.</p> : <><div className="hidden grid-cols-[1fr_1fr_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-medium text-slate-500 sm:grid"><span>Petugas</span><span>Cakupan akses</span><span>Aksi</span></div>{data.members.map(m => <div key={m.id} className="grid gap-3 border-b border-slate-100 p-4 last:border-0 sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:px-5"><p className="break-words font-medium text-slate-800">{m.full_name}</p><p className="text-sm text-slate-500">{m.can_manage_all ? 'Semua hasil dan draft' : 'Hasil sendiri'}</p><div className="flex flex-wrap gap-2"><button disabled={busy} className={secondaryClass} onClick={() => edit(m.id)}>Ubah akses</button><button disabled={busy} className={secondaryClass} onClick={() => { setEditing(null); setRemoving(m.id); }}>Cabut</button></div></div>)}</>}</div>
    </section>;
}
