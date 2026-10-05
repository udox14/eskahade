import type { Context, Teacher } from './types';
export function timeLabel(sessions: string[]) {
    const ordered = ['shubuh', 'ashar', 'maghrib'].filter(s => sessions.includes(s));
    if (ordered.length === 3) return 'Semua waktu';
    return ordered.map(s => ({ shubuh: 'Shubuh', ashar: 'Ashar', maghrib: 'Maghrib' })[s]).join(' dan ');
}
export function classContext(teacher: Teacher, classId: string): Context | null {
    const kelas = teacher.classes.find(c => c.id === classId);
    const contexts = teacher.contexts.filter(c => c.kelas_id === classId);
    if (!kelas || !contexts.length) return null;
    const books = [...new Map(contexts.map(c => [c.kitab_id, c])).values()];
    return { ...contexts[0], key: classId, kelas_nama: kelas.nama, hari: '', sesi: timeLabel(kelas.sessions),
        sessions: [...kelas.sessions], kitab: books.map(c => ({ id: c.kitab_id, nama: c.kitab_nama, mapel: c.mapel_nama })),
        kitab_nama: books.map(c => c.kitab_nama).join('; '), mapel_nama: [...new Set(books.map(c => c.mapel_nama))].join('; ') };
}
export function contextTime(context: Context) {
    return context.hari ? context.hari + ', ' + (timeLabel([context.sesi]) || context.sesi) : context.sesi;
}

export function contextBooks(context: Context) {
    return context.kitab?.length ? context.kitab.map(k => k.nama + ' / ' + k.mapel).join('; ') : context.kitab_nama + ' / ' + context.mapel_nama;
}
