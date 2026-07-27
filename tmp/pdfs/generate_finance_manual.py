from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    KeepTogether,
    LongTable,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf" / "panduan-operasional-keuangan-terpusat.pdf"

PAGE_W, PAGE_H = A4
MARGIN_X = 17 * mm
MARGIN_TOP = 18 * mm
MARGIN_BOTTOM = 17 * mm

EMERALD = colors.HexColor("#047857")
EMERALD_DARK = colors.HexColor("#064E3B")
EMERALD_LIGHT = colors.HexColor("#ECFDF5")
SLATE_950 = colors.HexColor("#0F172A")
SLATE_700 = colors.HexColor("#334155")
SLATE_500 = colors.HexColor("#64748B")
SLATE_300 = colors.HexColor("#CBD5E1")
SLATE_200 = colors.HexColor("#E2E8F0")
SLATE_100 = colors.HexColor("#F1F5F9")
AMBER = colors.HexColor("#D97706")
AMBER_LIGHT = colors.HexColor("#FFFBEB")
RED = colors.HexColor("#B91C1C")
RED_LIGHT = colors.HexColor("#FEF2F2")
BLUE = colors.HexColor("#1D4ED8")
BLUE_LIGHT = colors.HexColor("#EFF6FF")
WHITE = colors.white


pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Italic", r"C:\Windows\Fonts\ariali.ttf"))


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="BodyID", fontName="Arial", fontSize=8.8, leading=12.3,
    textColor=SLATE_700, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="SmallID", fontName="Arial", fontSize=7.7, leading=10.4,
    textColor=SLATE_500,
))
styles.add(ParagraphStyle(
    name="TinyID", fontName="Arial", fontSize=6.7, leading=8.5,
    textColor=SLATE_500,
))
styles.add(ParagraphStyle(
    name="H1ID", fontName="Arial-Bold", fontSize=20, leading=24,
    textColor=EMERALD_DARK, spaceBefore=4, spaceAfter=9, keepWithNext=True,
))
styles.add(ParagraphStyle(
    name="H2ID", fontName="Arial-Bold", fontSize=13, leading=15,
    textColor=SLATE_950, spaceBefore=6, spaceAfter=4, keepWithNext=True,
))
styles.add(ParagraphStyle(
    name="H3ID", fontName="Arial-Bold", fontSize=9.8, leading=12,
    textColor=EMERALD_DARK, spaceBefore=4, spaceAfter=2, keepWithNext=True,
))
styles.add(ParagraphStyle(
    name="BulletID", fontName="Arial", fontSize=8.4, leading=11.6,
    textColor=SLATE_700, leftIndent=12, firstLineIndent=-7, bulletIndent=3,
    spaceAfter=1.5,
))
styles.add(ParagraphStyle(
    name="StepID", fontName="Arial", fontSize=8.4, leading=11.6,
    textColor=SLATE_700, leftIndent=16, firstLineIndent=-12, spaceAfter=2,
))
styles.add(ParagraphStyle(
    name="CalloutTitle", fontName="Arial-Bold", fontSize=8.5, leading=11,
    textColor=SLATE_950, spaceAfter=2,
))
styles.add(ParagraphStyle(
    name="CalloutBody", fontName="Arial", fontSize=8.2, leading=11.4,
    textColor=SLATE_700,
))
styles.add(ParagraphStyle(
    name="TableHead", fontName="Arial-Bold", fontSize=7.3, leading=9,
    textColor=WHITE,
))
styles.add(ParagraphStyle(
    name="TableCell", fontName="Arial", fontSize=7.2, leading=9.3,
    textColor=SLATE_700,
))
styles.add(ParagraphStyle(
    name="TableCellBold", fontName="Arial-Bold", fontSize=7.2, leading=9.3,
    textColor=SLATE_950,
))
styles.add(ParagraphStyle(
    name="TOCHeading", fontName="Arial-Bold", fontSize=9.2, leading=12,
    textColor=SLATE_950, leftIndent=8, firstLineIndent=-8, spaceBefore=2,
))
styles.add(ParagraphStyle(
    name="TOCSub", fontName="Arial", fontSize=7.8, leading=10,
    textColor=SLATE_500, leftIndent=17, firstLineIndent=-7,
))


def clean(text: object) -> str:
    return escape(str(text)).replace("\n", "<br/>")


def p(text: str, style: str = "BodyID") -> Paragraph:
    return Paragraph(text, styles[style])


def h1(text: str) -> Paragraph:
    return Paragraph(clean(text), styles["H1ID"])


def h2(text: str) -> Paragraph:
    return Paragraph(clean(text), styles["H2ID"])


def h3(text: str) -> Paragraph:
    return Paragraph(clean(text), styles["H3ID"])


def bullets(items: list[str], marker: str = "-") -> list[Paragraph]:
    return [Paragraph(f"{marker} {item}", styles["BulletID"]) for item in items]


def steps(items: list[str]) -> list[Paragraph]:
    return [Paragraph(f"<b>{i}.</b> {item}", styles["StepID"]) for i, item in enumerate(items, 1)]


def callout(title: str, body: str, tone: str = "blue") -> Table:
    palette = {
        "blue": (BLUE_LIGHT, BLUE),
        "green": (EMERALD_LIGHT, EMERALD),
        "amber": (AMBER_LIGHT, AMBER),
        "red": (RED_LIGHT, RED),
        "slate": (SLATE_100, SLATE_500),
    }
    bg, accent = palette[tone]
    content = [
        Paragraph(clean(title), styles["CalloutTitle"]),
        Paragraph(body, styles["CalloutBody"]),
    ]
    box = Table([[content]], colWidths=[PAGE_W - 2 * MARGIN_X])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.5, accent),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return box


def data_table(headers: list[str], rows: list[list[object]], widths: list[float] | None = None) -> LongTable:
    available = PAGE_W - 2 * MARGIN_X
    if widths is None:
        widths = [available / len(headers)] * len(headers)
    data = [[Paragraph(clean(x), styles["TableHead"]) for x in headers]]
    for row in rows:
        data.append([
            Paragraph(clean(x), styles["TableCellBold"] if i == 0 else styles["TableCell"])
            for i, x in enumerate(row)
        ])
    table = LongTable(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), EMERALD_DARK),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, SLATE_200),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#F8FAFC")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


class ChapterMarker(Flowable):
    def __init__(self, number: str):
        super().__init__()
        self.number = number
        self.width = 42 * mm
        self.height = 7 * mm

    def draw(self):
        self.canv.setFillColor(EMERALD)
        self.canv.roundRect(0, 0, self.width, self.height, 3 * mm, fill=1, stroke=0)
        self.canv.setFillColor(WHITE)
        self.canv.setFont("Arial-Bold", 8)
        self.canv.drawCentredString(self.width / 2, 2.25 * mm, self.number)


class FinanceDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=MARGIN_X,
            rightMargin=MARGIN_X,
            topMargin=MARGIN_TOP,
            bottomMargin=MARGIN_BOTTOM,
            title="Panduan Operasional Keuangan Terpusat",
            author="Pondok Pesantren Sukahideng",
            subject="Panduan operasional untuk pengurus asrama dan pesantren",
        )
        frame = Frame(
            MARGIN_X, MARGIN_BOTTOM,
            PAGE_W - 2 * MARGIN_X,
            PAGE_H - MARGIN_TOP - MARGIN_BOTTOM,
            id="body",
        )
        self.addPageTemplates([
            PageTemplate(id="content", frames=[frame], onPage=self._page),
        ])

    def _page(self, canvas, doc):
        if doc.page == 1:
            return
        canvas.saveState()
        canvas.setStrokeColor(SLATE_200)
        canvas.line(MARGIN_X, PAGE_H - 11 * mm, PAGE_W - MARGIN_X, PAGE_H - 11 * mm)
        canvas.setFont("Arial", 7)
        canvas.setFillColor(SLATE_500)
        canvas.drawString(MARGIN_X, PAGE_H - 8 * mm, "PANDUAN OPERASIONAL KEUANGAN TERPUSAT")
        canvas.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 8 * mm, "Dokumen internal - Juli 2026")
        canvas.line(MARGIN_X, 11 * mm, PAGE_W - MARGIN_X, 11 * mm)
        canvas.drawString(MARGIN_X, 7 * mm, "Pondok Pesantren Sukahideng")
        canvas.drawRightString(PAGE_W - MARGIN_X, 7 * mm, f"Halaman {doc.page}")
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph):
            style = flowable.style.name
            if style in ("H1ID", "H2ID"):
                level = 0 if style == "H1ID" else 1
                text = flowable.getPlainText()
                key = f"section-{self.seq.nextf('section')}"
                self.canv.bookmarkPage(key)
                self.canv.addOutlineEntry(text, key, level=level, closed=False)
                self.notify("TOCEntry", (level, text, self.page, key))


def chapter(story: list, num: int, title: str, intro: str):
    if story:
        story.append(PageBreak())
    story += [ChapterMarker(f"BAGIAN {num:02d}"), Spacer(1, 3 * mm), h1(title), p(intro), Spacer(1, 2 * mm)]


def module_block(
    story: list,
    title: str,
    purpose: str,
    users: str,
    prep: list[str],
    workflow: list[str],
    statuses: list[tuple[str, str]],
    scenario: tuple[str, str],
    controls: list[str],
):
    story += [h2(title)]
    story += [callout("Tujuan menu", purpose, "green"), Spacer(1, 2.5 * mm)]
    story += [p(f"<b>Pengguna utama:</b> {users}")]
    story += [h3("Sebelum mulai"), *bullets(prep)]
    story += [h3("Alur penggunaan"), *steps(workflow)]
    if statuses:
        story += [h3("Arti status yang terlihat")]
        story.append(data_table(
            ["Status", "Arti sederhana"],
            [[a, b] for a, b in statuses],
            [38 * mm, PAGE_W - 2 * MARGIN_X - 38 * mm],
        ))
    story += [Spacer(1, 2 * mm), callout(f"Skenario lapangan: {scenario[0]}", scenario[1], "blue")]
    story += [Spacer(1, 2 * mm), h3("Kontrol aman"), *bullets(controls)]


story: list = []

# Cover
cover = Table([[
    [
        Spacer(1, 14 * mm),
        Paragraph("PANDUAN OPERASIONAL", ParagraphStyle(
            "cover-kicker", fontName="Arial-Bold", fontSize=11, leading=13,
            textColor=EMERALD, alignment=TA_CENTER, tracking=1.2,
        )),
        Spacer(1, 5 * mm),
        Paragraph("Keuangan<br/>Terpusat", ParagraphStyle(
            "cover-title", fontName="Arial-Bold", fontSize=34, leading=36,
            textColor=SLATE_950, alignment=TA_CENTER,
        )),
        Spacer(1, 7 * mm),
        Paragraph(
            "Panduan lengkap untuk pengurus asrama dan pengurus pesantren yang bukan berlatar belakang akuntansi.",
            ParagraphStyle("cover-sub", fontName="Arial", fontSize=12, leading=17, textColor=SLATE_500, alignment=TA_CENTER),
        ),
        Spacer(1, 14 * mm),
        Table([[
            Paragraph("<b>Versi sistem</b><br/>Juli 2026", styles["BodyID"]),
            Paragraph("<b>Jenis dokumen</b><br/>Panduan operasional internal", styles["BodyID"]),
        ]], colWidths=[72 * mm, 72 * mm], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), EMERALD_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#A7F3D0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A7F3D0")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ])),
        Spacer(1, 20 * mm),
        Paragraph("PONDOK PESANTREN SUKAHIDENG", ParagraphStyle(
            "cover-org", fontName="Arial-Bold", fontSize=10, leading=12, textColor=EMERALD_DARK, alignment=TA_CENTER
        )),
        Spacer(1, 8 * mm),
    ]
]], colWidths=[PAGE_W - 2 * MARGIN_X], rowHeights=[PAGE_H - MARGIN_TOP - MARGIN_BOTTOM - 16 * mm])
cover.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), WHITE),
    ("BOX", (0, 0), (-1, -1), 1.2, EMERALD),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 14 * mm),
    ("RIGHTPADDING", (0, 0), (-1, -1), 14 * mm),
]))
story += [cover, PageBreak()]

# TOC
toc_title_style = ParagraphStyle(
    "TOCTitle", parent=styles["H1ID"], keepWithNext=False, spaceBefore=0, spaceAfter=6
)
story += [Paragraph("Isi panduan", toc_title_style)]
toc = TableOfContents()
toc.levelStyles = [styles["TOCHeading"], styles["TOCSub"]]
story += [toc, Spacer(1, 6 * mm), callout(
    "Cara memakai panduan",
    "Baca Bagian 1-3 terlebih dahulu. Setelah itu, buka bagian sesuai menu yang sedang dikerjakan. "
    "Untuk keadaan khusus, gunakan bagian skenario lapangan, pemecahan masalah, dan checklist.",
    "slate",
)]

chapter(story, 1, "Memahami sistem tanpa harus menjadi akuntan",
        "Keuangan Terpusat dibuat agar setiap uang masuk, pindah tujuan, dan keluar dapat ditelusuri. Pengurus tidak perlu menghafal teori akuntansi. Yang penting adalah memahami asal uang, tujuan uang, bukti, status, dan siapa yang menyetujui.")
story += [
    callout("Prinsip paling penting", "<b>Satu transaksi = satu tujuan + satu bukti + satu jejak.</b> Jangan mengubah angka hanya supaya laporan terlihat cocok. Jika ada selisih, catat dan telusuri.", "amber"),
    h2("Gambaran besar aliran uang"),
]
story.append(data_table(
    ["Tahap", "Apa yang terjadi", "Contoh"],
    [
        ["1. Dana masuk", "Wali melakukan top-up atau petugas mencatat penerimaan darurat.", "Rp300.000 masuk ke Titipan santri."],
        ["2. Dana ditentukan tujuannya", "Dana Titipan dialokasikan sesuai kebutuhan.", "Rp100.000 ke Jajan, Rp150.000 ke Makan, Rp50.000 tetap di Titipan."],
        ["3. Dana digunakan", "Jajan dicairkan di loket; Makan/Laundry dibayarkan kepada pengelola; tagihan dilunasi.", "Santri mengambil Rp20.000; pengelola makan menerima payout."],
        ["4. Dana diperiksa", "Mutasi bank dicocokkan, payout direkonsiliasi, dan periode ditutup.", "Mutasi bank cocok dengan jurnal dan bulan dinyatakan selesai."],
    ],
    [28 * mm, 76 * mm, 70 * mm],
))
story += [
    h2("Istilah inti dalam bahasa sehari-hari"),
]
story.append(data_table(
    ["Istilah sistem", "Arti sederhana"],
    [
        ["Titipan", "Tempat sementara dana wali yang belum ditentukan untuk kebutuhan apa."],
        ["Wallet", "Kantong tujuan dana per santri: Jajan, Makan, Laundry, SPP, USPP, atau Non-SPP."],
        ["Alokasi", "Memindahkan dana dari Titipan ke kantong tujuan."],
        ["Jurnal", "Catatan resmi pergerakan uang. Jurnal POSTED tidak dihapus; koreksi dibuat dengan catatan lawan atau reversal."],
        ["Ledger", "Buku riwayat semua jurnal untuk penelusuran."],
        ["Payout", "Pembayaran keluar kepada pihak penerima, misalnya pengelola makan, laundry, atau guru."],
        ["Settlement", "Pengakuan bahwa dana dari penyedia pembayaran sudah masuk ke rekening/clearing beserta biayanya."],
        ["Rekonsiliasi", "Mencocokkan catatan sistem dengan bukti bank/provider."],
        ["Cutoff", "Batas waktu terakhir suatu alokasi boleh dikembalikan."],
        ["Maker - checker", "Orang yang membuat transaksi harus berbeda dari orang yang memeriksa/menyetujui."],
        ["Scope asrama", "Batas data dan kewenangan hanya untuk asrama tertentu."],
        ["Idempotensi", "Perlindungan agar klik/kiriman ulang tidak membuat transaksi ganda."],
    ],
    [39 * mm, 135 * mm],
))

chapter(story, 2, "Peran dan pembagian tanggung jawab",
        "Pembagian tugas bukan untuk memperlambat kerja, tetapi untuk melindungi pengurus dan pesantren. Transaksi penting sengaja memerlukan orang yang berbeda.")
story.append(data_table(
    ["Peran", "Kewenangan utama", "Tidak boleh dilakukan"],
    [
        ["Bendahara Pusat", "Konfigurasi, membuat dan mengeksekusi transaksi pusat, Unit Kas, settlement, tutup periode.", "Menyetujui sendiri tindakan yang mensyaratkan checker berbeda."],
        ["Checker Dewan Santri", "Memeriksa payout, absensi/payroll, review top-up terlambat, audit, persetujuan insiden dan reopen.", "Menjadi pembuat sekaligus pemeriksa pada transaksi yang sama."],
        ["Bendahara Asrama", "Melihat dan membuat transaksi dalam scope asrama binaan.", "Melihat atau mengubah data asrama lain tanpa kewenangan."],
        ["Operator Loket", "Membuka shift, scan kartu, mencairkan Jajan, menutup shift.", "Mengubah Unit Kas, mengabaikan identitas/PIN, atau menyelesaikan selisih sendiri."],
        ["Admin Teknis", "Menangani gangguan teknis melalui break-glass yang terbatas waktu.", "Menggunakan akses darurat sebagai akses keuangan harian."],
        ["Wali/Santri", "Wali top-up dan mengalokasikan dana; santri memakai kredensial dan PIN di loket.", "Meminta petugas melewati kontrol identitas atau batas pencairan."],
    ],
    [35 * mm, 86 * mm, 53 * mm],
))
story += [
    h2("Matriks cepat menu"),
]
story.append(data_table(
    ["Menu", "Utama", "Pemeriksa/pendukung"],
    [
        ["Ringkasan", "Bendahara pusat/asrama", "Checker"],
        ["Loket", "Operator Loket", "Bendahara lewat Unit Kas"],
        ["Unit Kas", "Bendahara Pusat", "Supervisor review selisih"],
        ["Kredensial", "Bendahara/Petugas berwenang", "Operator menggunakannya di loket"],
        ["Payout", "Maker dan executor", "Checker berbeda"],
        ["Payroll", "Petugas konfigurasi/absensi", "Checker verifikasi dan approve"],
        ["Ledger", "Bendahara", "Checker/auditor"],
        ["Alokasi", "Wali atau staf berwenang", "Bendahara memantau"],
        ["Insiden", "Bendahara mencatat penerimaan", "Checker mengaktifkan"],
        ["Kontrol", "Bendahara teknis/operasional", "Checker audit"],
        ["Break-glass", "Admin Teknis", "Checker meninjau"],
        ["Operasi", "Bendahara Pusat", "Checker untuk review/reopen"],
    ],
    [37 * mm, 69 * mm, 68 * mm],
))
story += [
    callout("Aturan serah-terima", "Saat berganti petugas, jangan berbagi akun. Petugas lama menutup pekerjaan atau shift miliknya; petugas baru masuk dengan akun sendiri. Jejak sistem mengikuti akun yang melakukan tindakan.", "red"),
]

chapter(story, 3, "Rutinitas kerja yang disarankan",
        "Gunakan urutan tetap agar masalah terlihat lebih awal dan tidak menumpuk sampai akhir bulan.")
story += [h2("Awal hari - 10 sampai 15 menit"), *steps([
    "Buka Ringkasan dan pastikan scope yang tampil benar: global atau nama asrama.",
    "Periksa bagian Butuh Tindakan: top-up terlambat, mutasi belum cocok, dan payout gagal.",
    "Periksa incident mode. Jika masih aktif, pastikan memang masih dibutuhkan.",
    "Operator loket menghitung uang fisik, memastikan scanner/keypad siap, lalu membuka shift.",
    "Jika ada payout hari itu, pastikan rekening penerima sudah aktif dan masa tunggu 24 jam selesai.",
])]
story += [h2("Selama hari berjalan"), *bullets([
    "Catat transaksi pada saat kejadian, bukan ditunda sampai malam.",
    "Gunakan referensi unik dari bank, kuitansi, jadwal, atau dokumen sumber.",
    "Jika terjadi kegagalan, baca pesan sistem dan periksa status terakhir sebelum mencoba lagi.",
    "Jangan membuat transaksi pengganti hanya karena layar lambat; sistem memiliki perlindungan duplikasi.",
])]
story += [h2("Akhir hari"), *steps([
    "Operator menutup shift setelah menghitung uang fisik.",
    "Bendahara mereview setiap selisih kas dan menulis hasil pemeriksaan.",
    "Pastikan payout yang sudah berhasil di provider direkonsiliasi.",
    "Impor mutasi bank terbaru dan periksa baris yang masih UNMATCHED.",
    "Catat pekerjaan yang belum selesai untuk petugas berikutnya.",
])]
story += [callout("Tiga pertanyaan sebelum menekan tombol", "Apakah orang/santri dan scope sudah benar? Apakah nominal dan bukti sudah benar? Apakah tindakan ini memang kewenangan saya?", "green")]

chapter(story, 4, "Ringkasan - pusat kendali harian",
        "Menu Ringkasan membantu pengurus melihat posisi dana dan antrean masalah. Angka di sini berasal dari jurnal yang sudah POSTED.")
module_block(
    story,
    "Cara membaca Ringkasan",
    "Menentukan pekerjaan yang paling mendesak tanpa membuka semua menu satu per satu.",
    "Bendahara Pusat, Bendahara Asrama, dan Checker.",
    ["Pastikan data settlement dan mutasi bank terbaru sudah masuk.", "Periksa label scope di bagian atas halaman."],
    [
        "Baca Posisi bank & clearing untuk melihat dana di rekening utama dan dana yang masih dalam proses settlement.",
        "Baca Titipan wali untuk mengetahui dana yang belum dialokasikan.",
        "Baca Saldo wallet santri untuk melihat total dana yang sudah memiliki tujuan.",
        "Buka setiap Pengecualian butuh tindakan, mulai dari yang berdampak paling besar.",
        "Gunakan Tren arus kas dan Komposisi wallet sebagai indikator, bukan pengganti rekonsiliasi.",
        "Buka Aktivitas jurnal terbaru atau Chart of Accounts jika perlu menelusuri asal angka.",
    ],
    [],
    ("Terdapat 3 mutasi belum cocok", "Klik indikator Mutasi belum cocok. Sistem membawa petugas ke Operasi. Cocokkan berdasarkan tanggal, nominal, uraian, dan referensi. Jangan memilih jurnal hanya karena nominal sama."),
    ["Monitoring batas lunak bukan error; itu sinyal untuk diperiksa.", "Jika angka terasa janggal, telusuri ke Ledger dan mutasi bank, bukan mengedit angka ringkasan."],
)

chapter(story, 5, "Loket dan Unit Kas",
        "Dua menu ini bekerja berpasangan. Unit Kas menyiapkan loket, operator, dan saldo tetap; Loket digunakan untuk pelayanan pencairan uang Jajan.")
module_block(
    story,
    "Unit Kas - menyiapkan loket",
    "Membuat tempat kas yang jelas, menentukan scope, saldo tetap, dan operator yang bertugas.",
    "Bendahara Pusat atau petugas dengan kewenangan konfigurasi.",
    ["Akun operator sudah memiliki role Operator Loket.", "Tentukan apakah unit berlaku untuk satu asrama atau pusat/semua."],
    [
        "Klik Buat Unit Kas, isi nama yang mudah dikenali, scope, dan saldo kas tetap.",
        "Pilih unit lalu tugaskan operator yang benar.",
        "Aktifkan unit sebelum digunakan. Nonaktifkan unit yang tidak lagi beroperasi.",
        "Gunakan Detail Unit Kas untuk mengubah scope atau saldo tetap.",
        "Periksa Antrean review selisih dan tulis hasil pemeriksaan tanpa mengubah angka asli.",
        "Gunakan Riwayat shift untuk melihat kas awal, pencairan, selisih, dan status.",
    ],
    [("Aktif", "Unit dapat digunakan."), ("Nonaktif", "Unit tidak dapat dipakai membuka shift."), ("OPEN", "Shift masih berjalan."), ("CLOSED_REVIEW", "Shift ditutup dan perlu/menyimpan review."), ("REVIEWED", "Selisih telah ditinjau supervisor.")],
    ("Membuka loket baru di Asrama Putra", "Buat Unit Kas 'Loket Putra', pilih scope Asrama Putra, isi float Rp1.000.000, tugaskan dua operator bergiliran, lalu aktifkan."),
    ["Nama unit harus spesifik.", "Saldo tetap adalah acuan awal, bukan angka yang boleh dipaksakan jika uang fisik berbeda."],
)
module_block(
    story,
    "Loket - pencairan uang Jajan",
    "Melayani pencairan tunai dengan identitas, PIN, saldo, batas, dan shift kas yang jelas.",
    "Operator Loket yang sudah ditugaskan ke Unit Kas.",
    ["Hitung uang fisik.", "Pastikan scanner RFID/QR, kamera bila dipakai, dan keypad PIN siap.", "Pastikan tidak ada shift lama yang masih terbuka."],
    [
        "Pilih Unit Kas dan isi kas fisik awal sesuai hasil hitung, lalu buka shift.",
        "Scan RFID atau QR. Sistem mengenali jenis kredensial otomatis.",
        "Cocokkan foto, nama, NIS, asrama, kamar, dan kartu fisik.",
        "Periksa saldo Jajan serta sisa batas harian, mingguan, dan bulanan.",
        "Masukkan nominal. UI menggunakan kelipatan Rp5.000 dan minimal Rp5.000.",
        "Santri memasukkan PIN melalui keypad privat. Operator tidak boleh menyebut atau mencatat PIN.",
        "Centang konfirmasi identitas, lalu cairkan uang dan serahkan setelah pesan berhasil.",
        "Akhir shift: hitung uang fisik, isi kas akhir, tulis catatan jika ada selisih, lalu tutup shift.",
    ],
    [("Shift aktif", "Operator boleh melayani pencairan."), ("Pencairan berhasil", "Saldo dan jurnal sudah tercatat; uang boleh diserahkan."), ("Selisih", "Kas fisik berbeda dari kas seharusnya dan menunggu review.")],
    ("Kas akhir kurang Rp20.000", "Operator menghitung ulang, memeriksa transaksi terakhir, lalu menutup shift dengan kas fisik sebenarnya dan catatan awal. Bendahara menelusuri dan mereview; angka tidak diubah agar selisih hilang."),
    ["Jangan serahkan uang sebelum layar menyatakan berhasil.", "Jangan melayani kartu milik orang lain meskipun PIN diketahui.", "Kredensial bukan tempat penyimpanan saldo; saldo ada di sistem."],
)

chapter(story, 6, "Kredensial RFID dan QR",
        "Kredensial adalah alat untuk menemukan identitas santri dengan cepat. Transaksi tetap memerlukan kecocokan identitas dan PIN.")
module_block(
    story,
    "Penerbitan, pencetakan, dan penggantian",
    "Mengelola RFID/QR secara massal maupun satu per satu, termasuk kartu hilang atau diganti.",
    "Bendahara atau petugas kredensial berwenang.",
    ["Data nama, NIS, asrama, kamar, kelas, dan foto santri sudah benar.", "Reader RFID siap jika menerbitkan RFID."],
    [
        "Di Pilih Santri, cari atau gunakan filter asrama, kamar, kelas, dan status kepemilikan.",
        "Pilih satu halaman atau semua hasil filter.",
        "Untuk QR, klik Terbitkan QR dan pantau batch. Lanjutkan/retry jika ada kegagalan.",
        "Untuk RFID, buat antrean lalu tempel kartu satu per satu sesuai nama yang tampil.",
        "Di Cetak Kartu, preview kartu pertama lalu unduh PDF per volume. Satu A4 memuat delapan kartu dua sisi.",
        "Untuk kartu rusak/hilang, gunakan Terbitkan ulang. Kartu lama otomatis dicabut ketika pengganti terbit.",
        "Gunakan Blokir untuk penghentian sementara, Hilang untuk kehilangan, dan Cabut untuk penghentian permanen.",
        "Atur mode global: RFID saja, QR saja, hybrid permanen, atau transisi berbatas waktu.",
    ],
    [
        ("ACTIVE", "Dapat dipakai sesuai mode global."),
        ("BLOCKED", "Sengaja diblokir dan tidak dapat dipakai."),
        ("LOST", "Dilaporkan hilang dan tidak dapat dipakai."),
        ("REVOKED", "Dicabut permanen, termasuk karena terbit ulang."),
        ("SUSPENDED_BY_POLICY", "Ditahan karena kebijakan mode kredensial."),
        ("PENDING/PROCESSING", "Batch QR masih berjalan."),
        ("COMPLETED_WITH_ERRORS", "Batch selesai tetapi ada item gagal yang dapat dicoba ulang."),
    ],
    ("Santri kehilangan kartu QR", "Segera tandai kartu sebagai Hilang. Verifikasi identitas santri, lalu Terbitkan ulang QR dan cetak kartu baru. Jangan menunggu sampai kartu lama disalahgunakan."),
    ["UID/token rahasia tidak ditampilkan sebagai data bebas.", "Pastikan nama di layar sama dengan santri yang memegang kartu.", "Gunakan mode transisi hanya dengan tanggal selesai yang jelas."],
)

chapter(story, 7, "Alokasi dana santri",
        "Alokasi memindahkan dana Titipan ke tujuan tertentu. Ini bukan uang baru; hanya perubahan tujuan penggunaan.")
module_block(
    story,
    "Riwayat dan pengembalian alokasi",
    "Menelusuri tujuan dana dan mengembalikan dana yang masih belum digunakan ke Titipan.",
    "Wali melakukan alokasi melalui portal; bendahara memantau dan dapat menangani pengembalian sesuai kewenangan.",
    ["Pastikan santri dan nominal benar.", "Untuk tagihan, pilih tagihan yang sesuai.", "Perhatikan cutoff Makan/Laundry."],
    [
        "Dana top-up pertama kali masuk ke Titipan.",
        "Pilih tujuan: SPP, USPP, Non-SPP, Makan, Laundry, atau Jajan.",
        "SPP dan Non-SPP harus lunas penuh; USPP boleh dibayar sebagian.",
        "Makan dan Laundry berstatus RESERVED sampai dicairkan; Jajan berstatus COMMITTED.",
        "Cari alokasi berdasarkan santri, NIS, referensi, ID, status, atau tujuan.",
        "Pengembalian hanya tersedia untuk Makan, Laundry, atau Jajan sebelum cutoff, sebelum DISBURSED, dan jika saldo tujuan masih cukup.",
        "Klik Kembalikan alokasi. Sistem memindahkan nominal kembali ke Titipan dan membuat jurnal koreksi.",
    ],
    [("RESERVED", "Dana dipesan untuk Makan/Laundry dan belum dicairkan."), ("COMMITTED", "Dana sudah ditetapkan ke tujuan."), ("DISBURSED", "Dana sudah dibayarkan/digunakan dan tidak dapat dikembalikan."), ("RETURNED", "Dana telah kembali ke Titipan.")],
    ("Wali salah mengalokasikan Rp100.000 ke Jajan", "Selama saldo Jajan masih minimal Rp100.000 dan alokasi belum digunakan, bendahara mengembalikan alokasi. Jika sebagian sudah dicairkan sehingga saldo kurang, sistem menolak untuk mencegah saldo negatif."),
    ["Jangan mengembalikan dana dengan jurnal manual.", "Periksa saldo tujuan; riwayat alokasi tidak menjamin seluruh nominal masih tersedia.", "Setelah cutoff, ikuti kebijakan administrasi, bukan memaksa sistem."],
)

chapter(story, 8, "Payout - pembayaran keluar",
        "Payout digunakan untuk membayar penerima seperti pengelola makan, laundry, guru, refund, atau kebutuhan lain. Alur sengaja dipisahkan menjadi daftar penerima, ajukan, periksa, eksekusi, dan rekonsiliasi.")
module_block(
    story,
    "Rekening penerima dan alur payout",
    "Mencegah pembayaran ke rekening salah dan memastikan uang keluar mendapat pemeriksaan.",
    "Maker membuat, Checker memeriksa, Executor mengirim, petugas merekonsiliasi.",
    ["Siapkan nama penerima, kode bank 3 digit, nomor rekening, nama pemilik rekening, nominal, dan dokumen dasar.", "Gunakan penerima aktif yang sudah melewati masa tunggu 24 jam."],
    [
        "Daftarkan rekening penerima dan pilih jenis penerima.",
        "Petugas berbeda memverifikasi rekening. Rekening tetap belum dapat dipakai sampai masa tunggu 24 jam selesai.",
        "Maker memilih penerima, jenis payout, nominal, dan metode: API BI-Fast, transfer manual, atau cash.",
        "Checker membuka payout SUBMITTED, mencocokkan dokumen dan rekening, lalu menekan Periksa.",
        "Executor yang berwenang mengirim via API atau memasukkan referensi transfer/kuitansi untuk metode manual/cash.",
        "Jika provider berhasil, status menjadi PROVIDER_SUCCESS.",
        "Cocokkan bukti bank/provider, lalu tekan Rekonsiliasi agar status menjadi RECONCILED.",
        "Jika FAILED, baca alasan kegagalan dan pastikan tidak ada debit bank sebelum membuat tindakan lanjutan.",
    ],
    [("PENDING_VERIFICATION", "Rekening baru menunggu verifikasi petugas lain."), ("ACTIVE", "Rekening terverifikasi; tetap perhatikan usable-after 24 jam."), ("SUBMITTED", "Payout diajukan dan menunggu checker."), ("CHECKED", "Sudah diperiksa dan siap dieksekusi."), ("EXECUTING", "Sedang diproses."), ("PROVIDER_SUCCESS", "Provider menyatakan berhasil; menunggu rekonsiliasi."), ("RECONCILED", "Bukti eksternal sudah cocok."), ("FAILED", "Gagal; perlu pemeriksaan sebelum dicoba kembali.")],
    ("Pembayaran makan bulanan", "Maker memilih pengelola makan aktif, jenis MEAL, nominal sesuai rekap, dan metode API. Checker membandingkan rekap dan rekening. Executor mengirim. Setelah bukti bank/provider cocok, payout direkonsiliasi."),
    ["Pembuat tidak boleh memeriksa atau mengeksekusi payout miliknya sendiri.", "Nomor rekening hanya ditampilkan dalam bentuk tersamarkan.", "Jangan menganggap PROVIDER_SUCCESS sama dengan selesai; rekonsiliasi tetap diperlukan."],
)

chapter(story, 9, "Payroll guru",
        "Payroll menggabungkan kebijakan gaji, kompensasi guru, absensi mengajar, perhitungan, persetujuan, dan pencatatan kewajiban pembayaran.")
module_block(
    story,
    "Dari kebijakan sampai batch disetujui",
    "Menghitung hak guru secara konsisten dan dapat dijelaskan kembali.",
    "Bendahara/petugas payroll, petugas absensi, dan Checker.",
    ["Sinkronkan master guru.", "Tentukan kebijakan yang efektif.", "Masukkan kompensasi guru sebelum membuat periode."],
    [
        "Buat versi kebijakan: gaji tetap tidak berubah, dipotong proporsional absen, atau memakai ambang kehadiran.",
        "Isi honor substitusi, tarif sesi default, dan threshold jika dipakai. Versi lama tidak ditimpa.",
        "Tambahkan kompensasi efektif per guru: tanggal mulai, gaji tetap, dan tarif sesi opsional.",
        "Buat periode payroll bulanan. Sistem memilih kebijakan yang berlaku.",
        "Catat setiap sesi: tanggal, referensi jadwal, guru terjadwal, status, guru pengganti bila ada, dan catatan.",
        "Checker memverifikasi setiap baris. Baris belum terverifikasi masih boleh dihapus/diperbaiki.",
        "Jika seluruh baris terverifikasi, kunci absensi. Setelah LOCKED, data absensi tidak dapat diedit.",
        "Hitung payroll. Periksa gaji tetap, honor sesi, potongan, dan nilai bersih tiap guru.",
        "Checker menyetujui batch. Sistem memposting akrual payroll; pembayaran aktual dilakukan melalui Payout jenis PAYROLL.",
    ],
    [("OPEN", "Absensi masih dapat diisi."), ("LOCKED", "Absensi final dan siap dihitung."), ("DRAFT", "Payroll belum dihitung."), ("CALCULATED", "Perhitungan tersedia dan menunggu persetujuan."), ("APPROVED", "Batch disetujui dan akrual diposting."), ("PRESENT", "Guru terjadwal hadir."), ("ABSENT", "Guru terjadwal tidak hadir."), ("HOLIDAY", "Tidak ada sesi karena libur."), ("SUBSTITUTE", "Sesi dijalankan guru pengganti yang berbeda.")],
    ("Guru A digantikan Guru B", "Catat status SUBSTITUTE, pilih Guru A sebagai terjadwal dan Guru B sebagai aktual. Checker memverifikasi. Saat dihitung, ketidakhadiran Guru A dan honor substitusi Guru B mengikuti kebijakan aktif."),
    ["Jangan mengganti kebijakan lama; buat versi efektif baru.", "Jangan mengunci jika ada sesi yang belum diverifikasi.", "APPROVED mencatat kewajiban, bukan bukti uang sudah ditransfer."],
)

chapter(story, 10, "Ledger - buku jejak transaksi",
        "Ledger dipakai untuk menelusuri catatan debit/kredit dan sumber transaksi. Untuk pengguna non-akuntan, fokuslah pada tanggal, keterangan, sumber, referensi, nominal seimbang, santri, dan scope.")
module_block(
    story,
    "Menelusuri dan membuat penyesuaian",
    "Mencari asal angka dan, bila benar-benar diperlukan, membuat jurnal manual yang seimbang.",
    "Bendahara Pusat; Checker/auditor untuk penelusuran.",
    ["Siapkan dokumen sumber dan referensi unik.", "Pastikan bulan pembukuan masih terbuka."],
    [
        "Cari berdasarkan keterangan, referensi, ID, sumber, status, atau tanggal.",
        "Buka satu jurnal untuk melihat semua baris debit/kredit dan hubungan reversal.",
        "Untuk jurnal manual, isi tanggal efektif, referensi, keterangan, minimal dua baris, akun, posisi, nominal, dan memo.",
        "Pastikan jumlah debit sama dengan kredit. Sistem menolak jurnal yang tidak seimbang.",
        "Gunakan NIS atau scope jika jurnal memang terkait santri/asrama.",
        "Jika jurnal manual POSTED salah, lakukan Reversal dengan alasan minimal dan referensi koreksi.",
    ],
    [("DRAFT", "Catatan belum final dan belum memengaruhi ringkasan."), ("POSTED", "Catatan resmi sudah memengaruhi saldo."), ("REVERSAL", "Jurnal lawan yang membatalkan efek jurnal manual sebelumnya.")],
    ("Biaya administrasi bank belum tercatat", "Dengan dokumen bank, bendahara membuat jurnal manual seimbang menggunakan akun yang benar dan referensi mutasi. Setelah POSTED, mutasi bank dapat dicocokkan ke jurnal tersebut."),
    ["Jangan memakai jurnal manual untuk mengembalikan alokasi atau memperbaiki transaksi domain yang memiliki tombol/proses khusus.", "Jurnal POSTED tidak dihapus.", "Jika tidak yakin memilih akun, hentikan dan minta konfirmasi bendahara berpengalaman."],
)

chapter(story, 11, "Operasi dan rekonsiliasi",
        "Menu Operasi adalah meja kerja bendahara pusat untuk tagihan, impor mutasi, pencocokan bank, settlement, review top-up terlambat, dan penutupan periode.")
module_block(
    story,
    "Tagihan, mutasi bank, settlement, dan periode",
    "Menyatukan catatan sistem dengan kejadian nyata di bank dan mengunci bulan yang sudah selesai.",
    "Bendahara Pusat; Checker untuk review tertentu dan persetujuan reopen.",
    ["Siapkan file CSV/XLS/XLSX maksimal 10 MB.", "Pastikan kolom tanggal, nominal, referensi, dan uraian bank dapat dibaca.", "Siapkan rekap settlement provider."],
    [
        "Buat tagihan dengan NIS, jenis, nama, periode, jatuh tempo, dan nominal. SPP/Non-SPP wajib lunas; USPP boleh dicicil.",
        "Void hanya tagihan OPEN yang belum menerima pembayaran, dengan alasan yang jelas.",
        "Impor mutasi bank. Sistem mendeduplikasi berkas dan mencoba auto-match berdasarkan referensi jurnal.",
        "Buka mutasi UNMATCHED. Bandingkan tanggal, nominal bertanda masuk/keluar, uraian, referensi, dan jurnal kandidat.",
        "Cocokkan satu mutasi ke satu jurnal POSTED. Satu jurnal tidak boleh dipakai dua mutasi.",
        "Review top-up terlambat: pastikan dana benar-benar diterima dan tidak duplikat, lalu tulis hasil pemeriksaan.",
        "Posting settlement dengan referensi, tanggal, bruto, biaya provider, dan neto. Bruto - biaya harus sesuai neto.",
        "Sebelum menutup bulan, pastikan tidak ada mutasi unmatched, jurnal draft, payout belum selesai, atau suspense.",
        "Jika bulan harus dibuka kembali, Checker pertama memberi persetujuan dan petugas berbeda melakukan persetujuan/tindakan final sesuai alur dua orang.",
    ],
    [("READY", "Berkas impor selesai dibaca."), ("FAILED", "Berkas gagal diproses; baca pesan error."), ("UNMATCHED", "Mutasi belum memiliki pasangan."), ("AUTO_MATCHED", "Sistem menemukan pasangan berdasarkan referensi."), ("MANUAL_MATCHED", "Petugas memilih pasangan setelah pemeriksaan."), ("OPEN", "Periode masih menerima transaksi."), ("CLOSED", "Periode dikunci.")],
    ("Top-up masuk setelah instruksi kedaluwarsa", "Sistem menandai review REQUIRED. Checker memeriksa referensi provider/bank, waktu bayar, nominal, dan duplikasi. Jika benar, review diselesaikan dengan catatan. Saldo tidak dibetulkan dengan top-up baru."),
    ["Jangan mencocokkan hanya berdasarkan nominal.", "Simpan file mutasi asli.", "Tutup periode hanya setelah checklist bersih.", "Reopen adalah pengecualian dan wajib memiliki alasan serta dua orang berbeda."],
)

chapter(story, 12, "Insiden - jalur penerimaan darurat",
        "Incident mode hanya digunakan saat jalur normal tidak dapat dipakai. Semua penerimaan darurat tetap membuat bukti dan masuk ke wallet Titipan.")
module_block(
    story,
    "Aktivasi dan penerimaan darurat",
    "Menjaga layanan tetap berjalan saat gangguan, tanpa menghilangkan kontrol dan jejak.",
    "Checker mengaktifkan; Bendahara mencatat penerimaan; petugas berwenang menutup.",
    ["Pastikan gangguan nyata dan jalur normal memang tidak tersedia.", "Tentukan channel CASH dan/atau EMERGENCY_TRANSFER.", "Jika CASH, harus ada shift kas terbuka."],
    [
        "Bendahara melaporkan kebutuhan incident kepada Checker.",
        "Checker memilih pengusul yang berbeda, menulis alasan minimal, memilih channel, dan masa aktif maksimal 24 jam.",
        "Petugas memilih incident aktif dan santri, lalu mengisi nominal dan referensi penerimaan unik.",
        "Untuk CASH pilih shift terbuka; untuk transfer darurat isi referensi bank.",
        "Klik Catat & terbitkan bukti. Dana masuk ke Titipan dan jurnal diposting.",
        "Berikan nomor bukti kepada penyetor dan simpan bukti fisik/digital.",
        "Saat layanan normal, tutup incident dengan catatan kondisi akhir.",
        "Rekonsiliasi seluruh bukti darurat dengan kas/bank.",
    ],
    [("ACTIVE", "Jalur darurat masih dapat dipakai."), ("EXPIRED", "Waktu berakhir sudah lewat; jangan dipakai."), ("ENDED", "Incident ditutup resmi.")],
    ("Gateway top-up mati saat jam kunjungan", "Checker mengaktifkan incident 4 jam dengan CASH. Operator membuka shift, menerima uang, petugas mencatat santri dan nominal, lalu memberi nomor bukti. Setelah gateway pulih, incident ditutup dan kas direkonsiliasi."),
    ["Incident bukan jalan pintas untuk menghindari prosedur normal.", "Setiap penerimaan wajib punya referensi unik.", "Jangan memakai channel yang tidak disetujui.", "Tutup sesegera mungkin setelah gangguan selesai."],
)

chapter(story, 13, "Kontrol, audit, dan break-glass",
        "Bagian ini membantu menjaga sistem tetap aman, menjelaskan siapa melakukan apa, dan memberi akses teknis terbatas saat darurat.")
module_block(
    story,
    "Kontrol dan Audit",
    "Memantau pengaturan, event sistem, sesi staf, autentikasi, dan jejak perubahan.",
    "Bendahara berwenang; Checker untuk audit.",
    ["Pahami dampak pengaturan sebelum mengubah.", "Gunakan akun pribadi."],
    [
        "Periksa pengaturan runtime: masa berlaku instruksi top-up, batas lunak monitoring, cutoff Makan, dan cutoff Laundry.",
        "Ubah nilai hanya jika ada keputusan resmi. Setiap perubahan masuk audit log.",
        "Pantau Outbox event. Jika FAILED, baca error lalu Retry setelah penyebab diperbaiki.",
        "Periksa MFA dan sesi staf. Cabut sesi finance yang tidak dikenal atau tidak lagi digunakan.",
        "Baca agregat percobaan autentikasi 14 hari untuk mendeteksi lonjakan kegagalan.",
        "Gunakan Audit trail untuk mencari aktor, tindakan, jenis entitas, atau ID; buka before/after untuk melihat perubahan.",
    ],
    [("PENDING", "Event menunggu dikirim."), ("SENT", "Event berhasil dikirim."), ("FAILED", "Pengiriman gagal dan dapat di-retry setelah diperiksa."), ("AKTIF", "Sesi masih dapat digunakan."), ("DICABUT", "Sesi dihentikan lebih awal."), ("BERAKHIR", "Masa sesi selesai.")],
    ("Ada sesi bendahara yang tidak dikenal", "Periksa nama, waktu, dan perangkat. Jika tidak dapat dikonfirmasi, cabut sesi, minta pengguna masuk ulang, dan tinjau audit/auth attempt. Jangan meminta atau membagikan secret MFA."),
    ["Secret MFA, hash identitas, dan hash IP tidak boleh tampil di UI.", "Retry event tidak membuat transaksi baru; hanya mengembalikan event gagal ke antrean.", "Catat keputusan perubahan konfigurasi di luar sistem bila diwajibkan SOP."],
)
module_block(
    story,
    "Break-glass untuk admin teknis",
    "Memberi akses keuangan sementara kepada admin teknis saat insiden, tanpa mengubahnya menjadi akses harian.",
    "Admin Teknis tanpa role keuangan native; Checker meninjau.",
    ["Pastikan masalah benar-benar membutuhkan akses keuangan.", "Siapkan alasan yang menjelaskan insiden, dampak, dan kebutuhan akses."],
    [
        "Admin mengisi alasan minimal 20 karakter dan mengaktifkan akses 30 menit.",
        "Selama aktif, semua tindakan tetap tercatat pada akun admin.",
        "Admin atau Checker dapat mencabut akses sebelum habis.",
        "Checker yang berbeda menandai aktivasi sebagai direview.",
        "Jika masih perlu setelah habis, lakukan aktivasi baru dengan alasan yang sesuai; jangan mencoba membuat akses tumpang tindih.",
    ],
    [("AKTIF", "Jendela 30 menit masih berlaku."), ("BERAKHIR", "Waktu habis otomatis."), ("DICABUT", "Dihentikan sebelum habis."), ("Menunggu review", "Checker belum meninjau."), ("Direview", "Checker sudah memeriksa aktivasi.")],
    ("Admin perlu memeriksa error payout produksi", "Admin mengaktifkan break-glass dengan alasan spesifik, memeriksa error tanpa melakukan tindakan di luar kebutuhan, lalu mencabut akses. Checker meninjau aktivitasnya."),
    ["Admin dengan role keuangan native menggunakan akses normal, bukan break-glass.", "Break-glass tidak menghapus aturan maker-checker.", "Akses harus dicabut segera setelah selesai."],
)

chapter(story, 14, "Skenario lapangan dari awal sampai akhir",
        "Gunakan skenario berikut sebagai latihan meja sebelum sistem dipakai penuh.")
scenarios = [
    ("Top-up hingga pencairan Jajan",
     ["Wali top-up Rp300.000; dana masuk Titipan.", "Wali mengalokasikan Rp100.000 ke Jajan.", "Operator membuka shift dengan kas fisik yang dihitung.", "Santri scan kartu, identitas dicocokkan, limit diperiksa, lalu memasukkan PIN.", "Operator mencairkan Rp20.000 setelah sistem menyatakan berhasil.", "Saldo Jajan tersisa Rp80.000; kas seharusnya turun Rp20.000; jurnal tercatat."]),
    ("Mutasi bank belum cocok",
     ["Bendahara mengimpor file mutasi.", "Satu baris tetap UNMATCHED.", "Petugas mencari referensi di Ledger dan dokumen sumber.", "Jika jurnal benar ditemukan, petugas mencocokkan manual.", "Jika tidak ada jurnal, jangan memaksakan pasangan; telusuri apakah transaksi belum dicatat atau merupakan biaya bank yang sah."]),
    ("Payout gagal di provider",
     ["Status menjadi FAILED dan alasan tersimpan.", "Periksa apakah rekening bank sebenarnya terdebit.", "Periksa dashboard/provider dan referensi payout.", "Jika tidak terdebit, perbaiki penyebab lalu buat tindakan sesuai SOP.", "Jika terdebit, jangan kirim ulang; lakukan eskalasi dan rekonsiliasi bukti."]),
    ("Penutupan bulan",
     ["Impor seluruh mutasi sampai tanggal akhir bulan.", "Selesaikan top-up terlambat, unmatched, payout, jurnal draft, dan suspense.", "Cocokkan saldo bank/clearing dan tinjau ledger.", "Tutup periode.", "Jika ditemukan dokumen terlambat, gunakan reopen dua orang dengan alasan, posting koreksi, rekonsiliasi ulang, lalu tutup kembali."]),
    ("Selisih kas loket",
     ["Operator hitung ulang dan memeriksa uang terselip/pecahan.", "Tutup shift dengan angka fisik sebenarnya dan catatan.", "Bendahara membandingkan kas awal, total pencairan, waktu transaksi, dan bukti.", "Tulis hasil review; jangan mengubah transaksi tanpa bukti.", "Jika ada dugaan penyalahgunaan, eskalasi sesuai kebijakan pesantren."]),
    ("Payroll bulanan",
     ["Pastikan kebijakan dan kompensasi efektif benar.", "Buat periode dan catat sesi.", "Checker verifikasi semua sesi.", "Kunci absensi dan hitung payroll.", "Periksa rincian per guru lalu approve batch.", "Buat payout PAYROLL, periksa, eksekusi, dan rekonsiliasi."]),
]
for title, items in scenarios:
    story += [h2(title), *steps(items)]

chapter(story, 15, "Pemecahan masalah",
        "Saat terjadi masalah, cari status terakhir dan bukti eksternal. Jangan langsung mengulang transaksi.")
story.append(data_table(
    ["Masalah", "Periksa", "Tindakan aman", "Jangan lakukan"],
    [
        ["Kartu tidak terbaca", "Mode global, status kartu, scanner, kartu pengganti.", "Coba scan ulang, cek ACTIVE, lalu terbitkan ulang bila rusak.", "Memakai kartu santri lain."],
        ["PIN salah/diblokir sementara", "Santri yang benar, cara input, kebijakan PIN.", "Minta santri mencoba sesuai prosedur pemulihan.", "Mencatat atau meminta PIN secara lisan."],
        ["Saldo cukup tetapi pencairan ditolak", "Limit harian/mingguan/bulanan, shift, credential.", "Baca sisa limit dan pesan backend.", "Membagi transaksi untuk menghindari limit."],
        ["Klik dua kali/layar lambat", "Pesan sukses dan riwayat transaksi.", "Tunggu, refresh, cari transaksi berdasarkan waktu/ID.", "Membuat transaksi baru tanpa pemeriksaan."],
        ["Mutasi unmatched", "Tanggal, tanda nominal, referensi, uraian, jurnal.", "Cari dokumen sumber dan pasangan POSTED.", "Memilih jurnal hanya karena nominal sama."],
        ["Payout lama di EXECUTING", "Provider, callback, rekening bank, referensi.", "Eskalasi teknis dan tahan pengiriman ulang.", "Membayar kedua kali."],
        ["Alokasi tidak bisa dikembalikan", "Status, cutoff, saldo tujuan.", "Jelaskan penyebab dan ikuti SOP administrasi.", "Membuat jurnal manual untuk memaksa saldo."],
        ["Periode tidak bisa ditutup", "Unmatched, draft, payout, suspense.", "Selesaikan daftar penghambat.", "Menutup tanpa rekonsiliasi."],
        ["Event outbox FAILED", "Pesan error dan layanan tujuan.", "Perbaiki penyebab lalu Retry.", "Mengubah transaksi utama."],
        ["Akun kehilangan akses", "Role, scope, sesi, break-glass bila admin teknis.", "Hubungi pengelola akses; gunakan jalur resmi.", "Meminjam akun rekan."],
    ],
    [34 * mm, 46 * mm, 52 * mm, 42 * mm],
))
story += [Spacer(1, 3 * mm), callout("Urutan investigasi 5 langkah", "1) Hentikan pengulangan. 2) Catat waktu, pengguna, nominal, dan ID. 3) Periksa status sistem. 4) Cocokkan bukti fisik/bank/provider. 5) Pilih tindakan koreksi resmi dan tulis alasan.", "red")]

chapter(story, 16, "Checklist siap pakai",
        "Checklist ini dapat dicetak atau dijadikan dasar SOP lokal.")
story += [h2("Checklist operator loket - buka shift"), *bullets([
    "[ ] Saya masuk dengan akun sendiri.",
    "[ ] Unit Kas dan scope sudah benar.",
    "[ ] Uang fisik sudah dihitung dan sama/berbeda dicatat apa adanya.",
    "[ ] Scanner RFID/QR, kamera, dan keypad PIN siap.",
    "[ ] Tidak ada shift lama saya yang masih terbuka.",
])]
story += [h2("Checklist operator loket - setiap pencairan"), *bullets([
    "[ ] Kartu/QR terbaca ACTIVE.",
    "[ ] Foto, nama, NIS, dan santri fisik cocok.",
    "[ ] Saldo Jajan dan sisa limit cukup.",
    "[ ] Santri memasukkan PIN secara privat.",
    "[ ] Uang diserahkan setelah sistem menyatakan berhasil.",
])]
story += [h2("Checklist bendahara - harian"), *bullets([
    "[ ] Ringkasan dan scope diperiksa.",
    "[ ] Top-up terlambat, mutasi unmatched, dan payout gagal ditindaklanjuti.",
    "[ ] Payout PROVIDER_SUCCESS sudah direkonsiliasi.",
    "[ ] Selisih kas sudah direview dengan catatan.",
    "[ ] Incident/break-glass yang tidak diperlukan sudah ditutup/dicabut.",
])]
story += [h2("Checklist bendahara - akhir bulan"), *bullets([
    "[ ] Semua file mutasi sudah diimpor dan disimpan.",
    "[ ] Tidak ada mutasi UNMATCHED yang belum dijelaskan.",
    "[ ] Tidak ada jurnal DRAFT atau payout tertunda.",
    "[ ] Settlement bruto, biaya, dan neto cocok.",
    "[ ] Payroll disetujui dan payout terkait ditelusuri.",
    "[ ] Audit pengecualian dibaca.",
    "[ ] Periode ditutup oleh petugas berwenang.",
])]

chapter(story, 17, "Kamus status dan istilah singkat",
        "Gunakan halaman ini sebagai rujukan cepat ketika menemukan kode berbahasa Inggris di layar.")
story.append(data_table(
    ["Status/istilah", "Makna operasional"],
    [
        ["ACTIVE", "Aktif dan dapat digunakan sesuai aturan."],
        ["INACTIVE/Nonaktif", "Tidak dapat digunakan untuk transaksi baru."],
        ["OPEN", "Masih terbuka dan dapat menerima proses."],
        ["LOCKED", "Dikunci; tidak dapat diedit melalui alur biasa."],
        ["DRAFT", "Belum final dan umumnya belum memengaruhi saldo."],
        ["POSTED", "Sudah resmi memengaruhi saldo/ledger."],
        ["SUBMITTED", "Sudah diajukan; menunggu pemeriksaan."],
        ["CHECKED", "Sudah diperiksa; siap tahap pelaksanaan."],
        ["EXECUTING", "Sedang diproses oleh sistem/provider."],
        ["PROVIDER_SUCCESS", "Provider menyatakan berhasil; menunggu pencocokan."],
        ["RECONCILED", "Sudah cocok dengan bukti eksternal."],
        ["FAILED", "Proses gagal; baca penyebab sebelum mengulang."],
        ["REQUIRED", "Wajib ditinjau petugas."],
        ["UNMATCHED", "Belum menemukan pasangan catatan."],
        ["AUTO_MATCHED", "Pasangan ditemukan otomatis."],
        ["MANUAL_MATCHED", "Pasangan dipilih petugas."],
        ["RESERVED", "Dana dipesan tetapi belum dibayarkan keluar."],
        ["COMMITTED", "Dana sudah ditetapkan untuk tujuan."],
        ["DISBURSED", "Dana sudah dicairkan/dibayarkan."],
        ["RETURNED", "Dana dikembalikan ke Titipan."],
        ["VOID", "Tagihan dibatalkan sebelum pembayaran."],
        ["REVERSAL", "Catatan lawan untuk membatalkan dampak jurnal sebelumnya."],
        ["Cooling period", "Masa tunggu keamanan sebelum rekening baru dapat dipakai."],
        ["Float kas", "Uang tetap yang disediakan sebagai kas awal Unit Kas."],
        ["Suspense", "Transaksi/selisih sementara yang belum mendapat klasifikasi akhir."],
    ],
    [47 * mm, 127 * mm],
))
story += [
    Spacer(1, 4 * mm),
    callout(
        "Penutup",
        "Sistem membantu menjaga jejak, tetapi keputusan yang baik tetap bergantung pada ketelitian petugas. "
        "Jika ragu: jangan menebak, jangan mengulang, jangan menyembunyikan selisih. Catat fakta, cocokkan bukti, lalu minta pemeriksaan.",
        "green",
    ),
    Spacer(1, 8 * mm),
    Paragraph("Dokumen ini menjelaskan fitur yang tersedia pada modul Keuangan Terpusat versi Juli 2026. Tampilan tombol dapat berbeda menurut role dan scope pengguna.", styles["SmallID"]),
]


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = FinanceDocTemplate(str(OUT))
    doc.multiBuild(story)
    print(OUT)


if __name__ == "__main__":
    build()
