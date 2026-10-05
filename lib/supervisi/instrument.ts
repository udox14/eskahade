export type Answer = {
    score?: number | null;
    unknown?: boolean;
    note?: string;
    text?: string;
};
export type Answers = Record<string, Answer>;
export type Item = {
    id: string;
    label: string;
    kind: 'score' | 'text';
};
export type Section = {
    title: string;
    items: Item[];
};
const score = (n: number, label: string): Item => ({ id: `s${n}`, label, kind: 'score' });
const text = (id: string, label: string): Item => ({ id, label, kind: 'text' });
export const SCALE = ['Jarang / Perlu Pengembangan', 'Kadang-kadang / Cukup', 'Sering / Baik', 'Selalu / Sangat Baik'];
export const OPENING = 'Kami ingin mengetahui pengalaman Anda selama mengikuti pengajian. Wawancara ini bukan untuk mencari kesalahan pengajar, tetapi untuk mengetahui hal-hal yang sudah baik dan hal-hal yang masih dapat diperbaiki. Silakan menjawab dengan jujur, sopan, dan sesuai pengalaman Anda. Identitas Anda akan dijaga.';
export const GUIDANCE = [
    'Wawancara dilakukan dalam suasana santai, aman, dan tidak mengintimidasi.',
    'Santri diberi kesempatan menyampaikan pengalaman secara jujur dan sopan.',
    'Identitas santri tidak perlu dicantumkan dalam laporan.',
    'Pewawancara tidak mengarahkan jawaban dan dapat mengembangkan pertanyaan sesuai jawaban santri.',
    'Hasil wawancara digunakan sebagai bahan pembinaan dan peningkatan kualitas pengajian.',
];
export const CLOSING = 'Ucapkan terima kasih kepada santri atas waktu dan keterbukaan dalam menyampaikan pengalaman. Ingatkan bahwa hasil wawancara akan digunakan secara bijaksana untuk meningkatkan kualitas pengajian dan pembinaan pengajar.';
export const SECTIONS: Section[] = [
    { title: 'Keteraturan Pengajian', items: [score(1, 'Pengajar masuk kelas tepat waktu.'), score(2, 'Pengajar keluar kelas tepat waktu.'), score(3, 'Pengajar melanjutkan materi secara berkesinambungan dari pembahasan sebelumnya.'), text('d1', 'Bagaimana menurut Anda keteraturan pelaksanaan pengajian selama ini?'), text('d2', 'Apakah ada hal terkait waktu atau kesinambungan materi yang perlu diperhatikan?')] },
    { title: 'Kejelasan Penyampaian Materi', items: [score(4, 'Penjelasan pengajar mudah dipahami.'), score(5, 'Pengajar menjelaskan materi secara bertahap dan sistematis.'), score(6, 'Pengajar memberikan contoh ketika materi sulit dipahami.'), score(7, 'Pengajar menjelaskan kembali materi ketika santri belum memahaminya.'), text('e1', 'Bagian mana dari cara pengajar menjelaskan yang paling membantu Anda memahami materi?'), text('e2', 'Materi atau bagian apa yang biasanya paling sulit Anda pahami?')] },
    { title: 'Penguasaan Materi', items: [score(8, 'Pengajar dapat menjelaskan materi yang sedang dibahas.'), score(9, 'Pengajar dapat memberikan penjelasan ketika santri bertanya.'), score(10, 'Pengajar memberikan contoh atau penjelasan tambahan ketika diperlukan.'), text('f1', 'Ketika Anda atau teman Anda bertanya tentang materi yang belum dipahami, bagaimana respons pengajar?'), text('f2', 'Apakah ada contoh ketika penjelasan tambahan dari pengajar membantu Anda?')] },
    { title: 'Metode Pengajaran', items: [score(11, 'Pengajar menggunakan metode yang sesuai dengan materi.'), score(12, 'Pengajar menggunakan lebih dari satu cara dalam menyampaikan materi apabila diperlukan.'), score(13, 'Pengajar memberikan kesempatan kepada santri untuk membaca, menjelaskan, berlatih, atau berdiskusi.'), score(14, 'Metode yang digunakan membantu santri memahami materi.'), text('g1', 'Cara atau metode apa yang paling membantu Anda memahami materi?'), text('g2', 'Apakah ada kegiatan yang menurut Anda perlu ditambah dalam pengajian?')] },
    { title: 'Interaksi dan Partisipasi Santri', items: [score(15, 'Pengajar memberikan kesempatan kepada santri untuk bertanya.'), score(16, 'Pengajar memberikan kesempatan kepada santri untuk menyampaikan pendapat atau jawaban.'), score(17, 'Pengajar melibatkan santri dalam proses pengajian.'), score(18, 'Santri merasa cukup nyaman untuk bertanya ketika belum memahami materi.'), text('h1', 'Apakah Anda merasa memiliki kesempatan yang cukup untuk bertanya?'), text('h2', 'Apa yang biasanya membuat santri aktif atau kurang aktif dalam pengajian?')] },
    { title: 'Pengelolaan Suasana Pengajian', items: [score(19, 'Pengajar mampu menjaga ketertiban selama pengajian.'), score(20, 'Pengajar mampu menjaga perhatian santri terhadap materi.'), score(21, 'Pengajar menegur santri yang kurang memperhatikan dengan cara yang baik.'), score(22, 'Suasana pengajian mendukung santri untuk belajar.'), text('i1', 'Bagaimana suasana yang biasanya terjadi selama pengajian?'), text('i2', 'Apa yang dilakukan pengajar ketika suasana pengajian mulai kurang kondusif?')] },
    { title: 'Perhatian terhadap Kemampuan Santri', items: [score(23, 'Pengajar memperhatikan apakah santri sudah memahami materi.'), score(24, 'Pengajar membantu santri yang mengalami kesulitan memahami materi.'), score(25, 'Pengajar menyesuaikan penjelasan ketika materi dirasakan terlalu sulit.'), text('j1', 'Ketika Anda belum memahami materi, apa yang biasanya dilakukan oleh pengajar?'), text('j2', 'Apakah pengajar memberikan cara atau penjelasan lain ketika cara pertama belum dipahami?')] },
    { title: 'Evaluasi dan Tindak Lanjut', items: [score(26, 'Pengajar melakukan tanya jawab untuk mengetahui pemahaman santri.'), score(27, 'Pengajar memberikan latihan atau kegiatan untuk memperkuat pemahaman.'), score(28, 'Pengajar mengulang atau membahas kembali materi yang belum dipahami.'), text('k1', 'Bagaimana pengajar biasanya mengetahui bahwa santri sudah memahami materi?'), text('k2', 'Apakah ada latihan, hafalan, pengulangan, atau kegiatan lain setelah pembahasan materi?')] },
    { title: 'Pertanyaan Reflektif', items: [text('l1', 'Apa hal yang paling membantu Anda dalam memahami materi dari pengajar ini?'), text('l2', 'Apa kelebihan pengajar yang menurut Anda perlu dipertahankan?'), text('l3', 'Bagian apa dari pengajian yang menurut Anda masih dapat diperbaiki?'), text('l4', 'Apa yang dapat dilakukan agar pengajian menjadi lebih mudah dipahami dan lebih bermanfaat?'), text('l5', 'Apakah ada hal lain yang ingin Anda sampaikan mengenai pengajian ini?')] },
    { title: 'Catatan Pewawancara', items: [text('m1', 'Hal-hal positif yang muncul dalam wawancara:'), text('m2', 'Kendala atau kebutuhan belajar yang banyak disampaikan:'), text('m3', 'Kutipan/pernyataan penting (tanpa mencantumkan identitas santri):'), text('m4', 'Hal yang perlu dikonfirmasi melalui observasi atau sumber lain:')] },
];
export const ITEMS = SECTIONS.flatMap(s => s.items);
export function isAnswered(item: Item, answer?: Answer) {
    if (!answer)
        return false;
    return item.kind === 'text' ? Boolean(answer.text?.trim()) : answer.unknown === true ? Boolean(answer.note?.trim()) : Number.isInteger(answer.score) && Number(answer.score) >= 1 && Number(answer.score) <= 4;
}
export function completedCount(answers: Answers) { return ITEMS.filter(i => isAnswered(i, answers[i.id])).length; }
export function normalizeAnswers(input: unknown): Answers {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new Error('Jawaban tidak valid.');
    const out: Answers = {};
    for (const [id, value] of Object.entries(input)) {
        const item = ITEMS.find(i => i.id === id);
        if (!item || !value || typeof value !== 'object' || Array.isArray(value))
            throw new Error('Item jawaban tidak valid.');
        const a = value as Answer;
        for (const field of ['text', 'note'] as const)
            if (a[field] !== undefined && (typeof a[field] !== 'string' || a[field]!.length > 10000))
                throw new Error('Jawaban teks maksimal 10.000 karakter.');
        if (item.kind === 'text')
            out[id] = { text: a.text ?? '' };
        else if (a.unknown === true)
            out[id] = { unknown: true, score: null, note: a.note ?? '' };
        else {
            if (a.score !== null && a.score !== undefined && (!Number.isInteger(a.score) || a.score < 1 || a.score > 4))
                throw new Error('Skor harus 1–4.');
            out[id] = { score: a.score ?? null, unknown: false };
        }
    }
    return out;
}
export function summarize(sets: Answers[]) {
    return SECTIONS.slice(0, 8).map(section => {
        const indicators = section.items.filter(i => i.kind === 'score').map(item => {
            const distribution = [0, 0, 0, 0];
            let unknown = 0;
            for (const answers of sets) {
                const a = answers[item.id];
                if (a?.unknown)
                    unknown++;
                else if (isAnswered(item, a))
                    distribution[Number(a.score) - 1]++;
            }
            const rated = distribution.reduce((a, b) => a + b, 0);
            const sum = distribution.reduce((a, b, i) => a + b * (i + 1), 0);
            return { ...item, distribution, unknown, rated, sum, average: rated ? sum / rated : null };
        });
        const rated = indicators.reduce((a, b) => a + b.rated, 0), sum = indicators.reduce((a, b) => a + b.sum, 0);
        return { title: section.title, indicators, rated, unknown: indicators.reduce((a, b) => a + b.unknown, 0), average: rated ? sum / rated : null };
    });
}
