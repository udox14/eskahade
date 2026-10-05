'use client';
import { useEffect, useState } from 'react';
import { createActivity, getTeacherCandidates, getActivityTargetIds, updateActivityTargets } from './actions';
import type { Activity, Teacher } from '@/lib/supervisi/types';
import { inputClass, buttonClass, secondaryClass } from '@/components/supervisi/styles';
export default function ActivityEditor({ years, activity, onClose, onSaved }: {
    years: {
        id: number;
        nama: string;
        is_active: number;
    }[];
    activity?: Activity;
    onClose: () => void;
    onSaved: (id: string) => Promise<void>;
}) {
    const [name, setName] = useState(activity?.nama ?? ''), [year, setYear] = useState(activity?.tahun_ajaran_id ?? years[0]?.id ?? 0), [teachers, setTeachers] = useState<Teacher[]>([]), [selected, setSelected] = useState<number[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
    useEffect(() => { let active = true; setLoading(true); Promise.all([getTeacherCandidates(year), activity ? getActivityTargetIds(activity.id) : Promise.resolve(null)]).then(([t, ids]) => { if (active) {
        setTeachers(t);
        setSelected(ids ?? t.map(g => g.id));
    } }).catch(() => { if (active)
        setError('Target guru belum dapat dimuat.'); }).finally(() => { if (active)
        setLoading(false); }); return () => { active = false; }; }, [year, activity]);
    async function save() { setBusy(true); setError(''); try {
        const r = activity ? await updateActivityTargets(activity.id, selected) : await createActivity(name, year, selected);
        if (r.ok)
            await onSaved(activity?.id ?? String(r.data));
        else
            setError(r.error);
    }
    catch {
        setError('Kegiatan belum tersimpan. Coba lagi.');
    }
    finally {
        setBusy(false);
    } }
    return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"><h2 className="text-lg font-semibold text-slate-900">{activity ? 'Atur target guru' : 'Kegiatan baru'}</h2>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<label className="block text-sm font-medium">Nama kegiatan<input disabled={!!activity} maxLength={200} className={`${inputClass} mt-1`} value={name} onChange={e => setName(e.target.value)}/></label><label className="block text-sm font-medium">Tahun ajaran<select disabled={!!activity} className={`${inputClass} mt-1`} value={year} onChange={e => setYear(Number(e.target.value))}>{years.map(y => <option key={y.id} value={y.id}>{y.nama}</option>)}</select></label><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{selected.length} dari {teachers.length} guru dipilih</p><button className={secondaryClass} onClick={() => setSelected(selected.length === teachers.length ? [] : teachers.map(t => t.id))}>{selected.length === teachers.length ? 'Kosongkan pilihan' : 'Pilih semua'}</button></div><div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">{loading ? <p className="p-4 text-sm text-slate-500">Memuat guru…</p> : teachers.map(t => <label key={t.id} className="flex min-h-14 cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0"><input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={selected.includes(t.id)} onChange={e => setSelected(v => e.target.checked ? [...v, t.id] : v.filter(id => id !== t.id))}/><span><span className="block text-sm font-medium text-slate-900">{t.nama}</span><span className="block text-xs text-slate-500">{t.kelas.join(', ')}{!t.contexts.length ? ' · Pembagian kitab belum lengkap' : ''}</span></span></label>)}</div><div className="flex gap-3"><button disabled={busy || loading || !selected.length || !name.trim()} className={buttonClass} onClick={save}>Simpan kegiatan</button><button className={secondaryClass} onClick={onClose}>Batal</button></div></section>;
}
