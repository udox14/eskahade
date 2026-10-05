import { query, queryOne } from '@/lib/db';
import { getSession, getEffectiveRoles, isAdmin, isDemoSandboxRequest } from '@/lib/auth/session';
import { getWeeklyGuruRules, buildWeeklyGuruRuleMap, resolveGuruForHariIndex, GURU_JADWAL_SESSIONS, HARI_INDEX_LABEL, type KelasGuruBase } from '@/lib/akademik/guru-jadwal';
import { getGuruKitabAssignments } from '@/lib/akademik/guru-kitab';
import type { Teacher, Context } from './types';
export const HREF = '/dashboard/sekpen/supervisi';
export async function requireSupervisi(adminOnly = false) {
    const session = await getSession();
    if (!session)
        throw new Error('Silakan masuk terlebih dahulu.');
    const roles = getEffectiveRoles(session);
    if ((roles.includes('demo') && !isDemoSandboxRequest(session)) || (roles.includes('tester') && !isAdmin(session)))
        throw new Error('Akses supervisi tidak diberikan untuk akun ini.');
    const feature = await queryOne<{
        id: number;
        is_active: number;
    }>('SELECT id,is_active FROM fitur_akses WHERE href=?', [HREF]);
    if (!feature?.is_active)
        throw new Error('Modul Supervisi belum diaktifkan.');
    const admin = isAdmin(session);
    if (adminOnly && !admin)
        throw new Error('Hanya admin yang dapat melakukan tindakan ini.');
    if (!admin) {
        const grant = await queryOne<{
            action: string;
        }>('SELECT action FROM user_fitur_override WHERE user_id=? AND fitur_id=?', [session.id, feature.id]);
        if (grant?.action !== 'grant')
            throw new Error('Anda belum diberi akses Supervisi.');
    }
    const permission = await queryOne<{
        can_manage_all: number;
    }>('SELECT can_manage_all FROM supervisi_user_permission WHERE user_id=?', [session.id]);
    return { session, admin, all: admin || permission?.can_manage_all === 1, featureId: feature.id };
}
export async function teachersForYear(year: number): Promise<Teacher[]> {
    const [classes, rules, assignments, gurus] = await Promise.all([
        query<KelasGuruBase & {
            nama_kelas: string;
        }>('SELECT id,nama_kelas,guru_shubuh_id,guru_ashar_id,guru_maghrib_id FROM kelas WHERE tahun_ajaran_id=?', [year]),
        getWeeklyGuruRules(), getGuruKitabAssignments(year), query<{
            id: number;
            nama_lengkap: string;
            gelar: string | null;
        }>('SELECT id,nama_lengkap,gelar FROM data_guru'),
    ]);
    const weekly = buildWeeklyGuruRuleMap(rules);
    const result = new Map<number, Teacher>();
    function teacher(id: number, kelas: string, classId: string, sesi: string) {
        const guru = gurus.find(g => g.id === id);
        if (!guru)
            return null;
        const t = result.get(id) ?? { id, nama: [guru.nama_lengkap, guru.gelar].filter(Boolean).join(', '), contexts: [], kelas: [], classes: [] };
        if (!t.kelas.includes(kelas))
            t.kelas.push(kelas);
        let classOption = t.classes.find(c => c.id === classId);
        if (!classOption) { classOption = { id: classId, nama: kelas, sessions: [] }; t.classes.push(classOption); }
        if (!classOption.sessions.includes(sesi)) classOption.sessions.push(sesi);
        result.set(id, t);
        return t;
    }
    for (const k of classes)
        for (const sesi of GURU_JADWAL_SESSIONS)
            for (let day = 0; day < 7; day++) {
                const resolved = resolveGuruForHariIndex(k, day, weekly)[sesi];
                if (resolved.id)
                    teacher(resolved.id, k.nama_kelas, k.id, sesi);
                const candidates = assignments.filter(a => a.kelas_id === k.id && a.sesi === sesi && a.is_active === 1 && (a.hari_index === null || a.hari_index === day));
                // A specific day assignment supersedes the default for the same kitab.
                const applicable = candidates.filter(a => a.hari_index !== null || !candidates.some(b => b.kitab_id === a.kitab_id && b.hari_index === day));
                for (const a of applicable) {
                    const t = teacher(a.guru_id, k.nama_kelas, k.id, sesi);
                    if (!t)
                        continue;
                    const c: Context = { key: `${k.id}:${sesi}:${day}:${a.kitab_id}`, kelas_id: k.id, kelas_nama: k.nama_kelas, sesi, hari: HARI_INDEX_LABEL[day], kitab_id: a.kitab_id, kitab_nama: a.kitab_nama, mapel_nama: a.mapel_nama };
                    if (c.kitab_nama && c.mapel_nama && !t.contexts.some(x => x.key === c.key))
                        t.contexts.push(c);
                }
            }
    return [...result.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
}
export function validDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date)
        throw new Error('Tanggal wawancara tidak valid.');
    return date;
}
export function boundedText(value: string, max = 200) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
        throw new Error(`Isian wajib diisi, maksimal ${max} karakter.`);
    return value.trim();
}
