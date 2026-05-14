"use client";

import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Loader2,
  Plus,
  Save,
  Settings,
  Shirt,
  Trash2,
  UploadCloud,
  Users,
  Utensils,
  X,
} from "lucide-react";
import Pagination from "@/components/ui/pagination";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  getClientRestriction,
  getDaftarAsrama,
  getDaftarKamar,
  getMasterJasa,
  getSantriLayanan,
  getSantriSebaranDetail,
  getSebaranLayanan,
  hapusMasterJasa,
  simpanBatchLayanan,
  tambahMasterJasa,
  tambahMasterJasaBatch,
} from "./actions";

type TabKey = "plotting" | "sebaran";

type SantriRow = {
  id: string;
  nis: string;
  nama_lengkap: string;
  kamar: string | null;
  tempat_makan_id: string | null;
  tempat_mencuci_id: string | null;
  kategori_santri: string;
  kategori_efektif: string;
};

type MasterJasaRow = {
  id: string;
  nama_jasa: string;
  jenis: "Makan" | "Cuci";
};

type SebaranRow = {
  jasa_id: string | null;
  nama_jasa: string;
  total: number;
};

type DetailRow = {
  id: string;
  nis: string;
  nama_lengkap: string;
  asrama: string | null;
  kamar: string | null;
  kategori_santri: string;
  kategori_efektif: string;
};

type DetailModalState = {
  jenis: "Makan" | "Cuci";
  jasaId: string | null;
  jasaNama: string;
};

const DEFAULT_PAGE_SIZE = 20;
const DETAIL_PAGE_SIZE = 20;

export default function LayananAsramaPage() {
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState<TabKey>("plotting");

  const [asramaList, setAsramaList] = useState<string[]>([]);
  const [kamarList, setKamarList] = useState<string[]>([]);
  const [restrictedAsrama, setRestrictedAsrama] = useState<string | null>(null);
  const [selectedAsrama, setSelectedAsrama] = useState<string>("");
  const [selectedKamar, setSelectedKamar] = useState<string>("");
  const [belumDitempatkan, setBelumDitempatkan] = useState<boolean>(false);
  const [santriBaruOnly, setSantriBaruOnly] = useState<boolean>(false);

  const [masterJasa, setMasterJasa] = useState<MasterJasaRow[]>([]);
  const [showModalJasa, setShowModalJasa] = useState(false);
  const [inputNamaJasa, setInputNamaJasa] = useState("");
  const [inputJenisJasa, setInputJenisJasa] = useState<"Makan" | "Cuci">("Makan");
  const [isSubmittingJasa, setIsSubmittingJasa] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [santriData, setSantriData] = useState<SantriRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalSantri, setTotalSantri] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingSantri, setIsLoadingSantri] = useState(false);

  const [sebaranMakan, setSebaranMakan] = useState<SebaranRow[]>([]);
  const [sebaranCuci, setSebaranCuci] = useState<SebaranRow[]>([]);
  const [isLoadingSebaran, setIsLoadingSebaran] = useState(false);

  const [detailModal, setDetailModal] = useState<DetailModalState | null>(null);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [detailPage, setDetailPage] = useState(1);
  const [detailHasMore, setDetailHasMore] = useState(false);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailLoaderRef = useRef<HTMLDivElement>(null);

  const [pendingChanges, setPendingChanges] = useState<
    Record<string, { tempat_makan_id?: string | null; tempat_mencuci_id?: string | null }>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  useEffect(() => {
    getDaftarAsrama()
      .then((list) => {
        setAsramaList(list);
        if (list.length === 1) setSelectedAsrama(list[0]);
      })
      .catch(console.error);

    getMasterJasa().then((rows) => setMasterJasa(rows as MasterJasaRow[])).catch(console.error);
    getClientRestriction().then(setRestrictedAsrama).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedAsrama) {
      setKamarList([]);
      setSantriData([]);
      setSebaranMakan([]);
      setSebaranCuci([]);
      setTotalSantri(0);
      setTotalPages(1);
      return;
    }

    getDaftarKamar(selectedAsrama).then(setKamarList).catch(console.error);
    setPage(1);
    setPendingChanges({});
  }, [selectedAsrama]);

  useEffect(() => {
    if (!selectedAsrama) return;
    loadSantriPage(page, getEffectivePageSize(pageSize, totalSantri));
  }, [selectedAsrama, selectedKamar, belumDitempatkan, santriBaruOnly, page, pageSize]);

  useEffect(() => {
    if (!selectedAsrama) return;
    loadSebaran();
  }, [selectedAsrama, selectedKamar, belumDitempatkan, santriBaruOnly]);

  useEffect(() => {
    setDetailModal(null);
    setDetailRows([]);
    setDetailPage(1);
    setDetailHasMore(false);
    setDetailTotal(0);
  }, [selectedAsrama, selectedKamar, belumDitempatkan, santriBaruOnly]);

  useEffect(() => {
    if (!detailModal || !detailHasMore || detailLoading) return;

    const node = detailLoaderRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadDetailPage(detailModal, detailPage + 1, false);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [detailModal, detailPage, detailHasMore, detailLoading]);

  const loadSantriPage = async (targetPage: number, targetPageSize: number) => {
    setIsLoadingSantri(true);
    try {
      const res = await getSantriLayanan({
        asrama: selectedAsrama,
        kamar: selectedKamar,
        belumDitempatkan,
        santriBaruOnly,
        page: targetPage,
        limit: targetPageSize,
      });

      if (targetPage > (res.totalPages || 1) && (res.totalPages || 1) > 0) {
        setPage(res.totalPages || 1);
        return;
      }

      setSantriData((res.data || []) as SantriRow[]);
      setTotalSantri(res.count || 0);
      setTotalPages(pageSize === 0 ? 1 : res.totalPages || 1);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingSantri(false);
    }
  };

  const loadSebaran = async () => {
    setIsLoadingSebaran(true);
    try {
      const res = await getSebaranLayanan({
        asrama: selectedAsrama,
        kamar: selectedKamar,
        belumDitempatkan,
        santriBaruOnly,
      });

      setSebaranMakan((res.makan || []) as SebaranRow[]);
      setSebaranCuci((res.cuci || []) as SebaranRow[]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingSebaran(false);
    }
  };

  const loadDetailPage = async (
    modal: DetailModalState,
    targetPage: number,
    replace: boolean
  ) => {
    if (!selectedAsrama) return;

    setDetailLoading(true);
    try {
      const res = await getSantriSebaranDetail({
        asrama: selectedAsrama,
        kamar: selectedKamar,
        belumDitempatkan,
        santriBaruOnly,
        jenis: modal.jenis,
        jasaId: modal.jasaId,
        page: targetPage,
        limit: DETAIL_PAGE_SIZE,
      });

      setDetailRows((prev) => (replace ? res.data || [] : [...prev, ...(res.data || [])]));
      setDetailPage(res.page || targetPage);
      setDetailTotal(res.count || 0);
      setDetailHasMore((res.page || 1) < (res.totalPages || 1));
    } catch (error) {
      console.error(error);
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetailModal = async (jenis: "Makan" | "Cuci", jasaId: string | null, jasaNama: string) => {
    const modalState = { jenis, jasaId, jasaNama };
    setDetailModal(modalState);
    setDetailRows([]);
    setDetailPage(1);
    setDetailHasMore(false);
    setDetailTotal(0);
    await loadDetailPage(modalState, 1, true);
  };

  const handleSelectChange = (
    santriId: string,
    type: "tempat_makan_id" | "tempat_mencuci_id",
    value: string
  ) => {
    setPendingChanges((prev) => {
      const updated = { ...prev };
      if (!updated[santriId]) updated[santriId] = {};
      updated[santriId][type] = value === "null" ? null : value;
      return updated;
    });
  };

  const handleSimpanBatch = async () => {
    setIsSaving(true);
    try {
      await simpanBatchLayanan(pendingChanges);
      setToastMsg(`${Object.keys(pendingChanges).length} data berhasil disimpan.`);
      setPendingChanges({});
      await Promise.all([loadSantriPage(page, pageSize), loadSebaran(), getMasterJasa().then((rows) => setMasterJasa(rows as MasterJasaRow[]))]);
      setTimeout(() => setToastMsg(""), 3000);
    } catch (error) {
      console.error(error);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTambahCepat = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputNamaJasa.trim()) return;

    setIsSubmittingJasa(true);
    try {
      await tambahMasterJasa(inputNamaJasa, inputJenisJasa);
      const freshMaster = await getMasterJasa();
      setMasterJasa(freshMaster as MasterJasaRow[]);
      setInputNamaJasa("");
      setToastMsg("Penyedia jasa berhasil ditambahkan.");
      setTimeout(() => setToastMsg(""), 3000);
    } catch (error) {
      console.error(error);
      alert("Gagal menambahkan data.");
    } finally {
      setIsSubmittingJasa(false);
    }
  };

  const downloadTemplateExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const dataTemplate = [
        { "Nama Penyedia Jasa": "Bu Ade", "Jenis Layanan (Makan/Cuci)": "Makan" },
        { "Nama Penyedia Jasa": "Bi Ani", "Jenis Layanan (Makan/Cuci)": "Cuci" },
        { "Nama Penyedia Jasa": "Laundry Berkah", "Jenis Layanan (Makan/Cuci)": "Cuci" },
      ];

      const ws = XLSX.utils.json_to_sheet(dataTemplate);
      ws["!cols"] = [{ wch: 26 }, { wch: 25 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template Penyedia");
      XLSX.writeFile(wb, "Template_Penyedia_Jasa.xlsx");
    } catch (error) {
      console.error(error);
      alert("Gagal membuat template Excel.");
    }
  };

  const handleExcelUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const XLSX = await import("xlsx");
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
      const dataBatch: { nama_jasa: string; jenis: string }[] = [];

      jsonData.forEach((row) => {
        const values = Object.values(row);
        if (values.length === 0) return;

        const nama = String(values[0]).trim();
        let jenis = "Makan";

        if (values.length > 1) {
          const jenisRaw = String(values[1]).trim().toLowerCase();
          if (jenisRaw.includes("cuci") || jenisRaw.includes("laundry")) jenis = "Cuci";
        }

        if (nama) dataBatch.push({ nama_jasa: nama, jenis });
      });

      if (!dataBatch.length) throw new Error("File kosong atau format salah");

      await tambahMasterJasaBatch(dataBatch);
      const freshMaster = await getMasterJasa();
      setMasterJasa(freshMaster as MasterJasaRow[]);
      setToastMsg(`${dataBatch.length} jasa berhasil diimpor.`);
      setTimeout(() => setToastMsg(""), 4000);
    } catch (error) {
      console.error(error);
      alert("Gagal memproses data Excel. Pastikan format sesuai template.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleHapusJasa = async (id: string) => {
    if (!(await confirm("Yakin hapus penyedia jasa ini?"))) return;

    try {
      await hapusMasterJasa(id);
      const freshMaster = await getMasterJasa();
      setMasterJasa(freshMaster as MasterJasaRow[]);
      await loadSebaran();
    } catch (error) {
      console.error(error);
      alert("Gagal menghapus jasa. Mungkin data ini masih digunakan oleh santri.");
    }
  };

  const getDisplayValue = (
    santriId: string,
    type: "tempat_makan_id" | "tempat_mencuci_id",
    originalValue: string | null
  ) => {
    if (pendingChanges[santriId] && pendingChanges[santriId][type] !== undefined) {
      return pendingChanges[santriId][type] === null ? "null" : pendingChanges[santriId][type];
    }
    return originalValue || "null";
  };

  const jasaMakan = masterJasa.filter((item) => item.jenis === "Makan");
  const jasaCuci = masterJasa.filter((item) => item.jenis === "Cuci");
  const totalChanges = Object.keys(pendingChanges).length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 pb-24">
      <DashboardPageHeader
        title="Katering & Laundry"
        description="Pemetaan layanan makan dan laundry santri, lengkap dengan sebaran per penyedia."
        action={
          <button
            onClick={() => setShowModalJasa(true)}
            className="flex items-center justify-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-lg hover:bg-slate-700 transition"
          >
            <Settings className="w-4 h-4" />
            <span className="font-semibold text-sm">Penyedia Jasa</span>
          </button>
        }
      />

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pilih Asrama</label>
          <select
            className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:ring-2 focus:ring-emerald-500 disabled:opacity-70"
            value={selectedAsrama}
            onChange={(e) => {
              setSelectedKamar("");
              setPage(1);
              setSelectedAsrama(e.target.value);
            }}
            disabled={!!restrictedAsrama}
          >
            <option value="">-- Pilih Asrama --</option>
            {asramaList.map((asrama) => (
              <option key={asrama} value={asrama}>
                {asrama}
              </option>
            ))}
          </select>
          {restrictedAsrama && (
            <p className="text-xs text-emerald-700 mt-2">
              Akses Anda dibatasi ke asrama <span className="font-semibold">{restrictedAsrama}</span>.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pilih Kamar</label>
          <select
            className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            value={selectedKamar}
            onChange={(e) => {
              setPage(1);
              setSelectedKamar(e.target.value);
            }}
            disabled={!selectedAsrama}
          >
            <option value="">-- Semua Kamar --</option>
            {kamarList.map((kamar) => (
              <option key={kamar} value={kamar}>
                {kamar}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 w-full transition">
            <input
              type="checkbox"
              className="w-5 h-5 text-emerald-600 rounded"
              checked={belumDitempatkan}
              onChange={(e) => {
                setPage(1);
                setBelumDitempatkan(e.target.checked);
              }}
            />
            <span className="text-sm font-medium text-slate-700">Tampilkan yang belum ditempatkan</span>
          </label>
        </div>

        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-200 w-full transition">
            <input
              type="checkbox"
              className="w-5 h-5 text-indigo-600 rounded"
              checked={santriBaruOnly}
              onChange={(e) => {
                setPage(1);
                setSantriBaruOnly(e.target.checked);
              }}
            />
            <span className="text-sm font-medium text-slate-700">Santri BARU saja</span>
          </label>
        </div>
      </div>

      {selectedAsrama && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 text-sm text-emerald-800">
          Data layanan dibaca langsung dari tabel <span className="font-semibold">santri</span> aktif pada asrama{" "}
          <span className="font-semibold">{selectedAsrama}</span>
          {selectedKamar ? (
            <>
              {" "}
              kamar <span className="font-semibold">{selectedKamar}</span>
            </>
          ) : null}
          . Sebaran menghitung relasi ke kolom <span className="font-semibold">tempat_makan_id</span> dan{" "}
          <span className="font-semibold">tempat_mencuci_id</span>.
        </div>
      )}

      <div className="bg-slate-100 p-1 rounded-2xl flex gap-1 w-full md:w-fit">
        <button
          onClick={() => setActiveTab("plotting")}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === "plotting" ? "bg-white shadow text-emerald-700" : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <Utensils className="w-4 h-4" />
          Plotting Layanan
        </button>
        <button
          onClick={() => setActiveTab("sebaran")}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === "sebaran" ? "bg-white shadow text-blue-700" : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          Sebaran Layanan
        </button>
      </div>

      {!selectedAsrama ? (
        <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <Filter className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-500">Pilih asrama terlebih dahulu</h3>
        </div>
      ) : activeTab === "plotting" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryCard
              title="Total Santri Terfilter"
              value={totalSantri}
              subtitle="Sumber data santri aktif"
              icon={<Users className="w-5 h-5 text-emerald-600" />}
            />
            <SummaryCard
              title="Penyedia Makan"
              value={jasaMakan.length}
              subtitle="Master katering aktif"
              icon={<Utensils className="w-5 h-5 text-amber-600" />}
            />
            <SummaryCard
              title="Penyedia Laundry"
              value={jasaCuci.length}
              subtitle="Master laundry aktif"
              icon={<Shirt className="w-5 h-5 text-sky-600" />}
            />
          </div>

          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                  <th className="p-4 w-[40%]">Nama Santri & NIS</th>
                  <th className="p-4 w-[30%]">
                    <div className="flex items-center gap-2">
                      <Utensils className="w-4 h-4" />
                      Tempat Makan
                    </div>
                  </th>
                  <th className="p-4 w-[30%]">
                    <div className="flex items-center gap-2">
                      <Shirt className="w-4 h-4" />
                      Tempat Cuci
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoadingSantri ? (
                  <tr>
                    <td colSpan={3} className="p-10 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" />
                    </td>
                  </tr>
                ) : santriData.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-10 text-center text-slate-400 font-medium">
                      Tidak ada santri ditemukan.
                    </td>
                  </tr>
                ) : (
                  santriData.map((santri) => (
                    <tr
                      key={santri.id}
                      className={`border-b border-slate-100 hover:bg-slate-50 transition ${
                        pendingChanges[santri.id] ? "bg-amber-50/40" : ""
                      }`}
                    >
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{santri.nama_lengkap}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
                          <span>{santri.nis} • Kamar {santri.kamar || "-"}</span>
                          <KategoriBadge kategori={santri.kategori_efektif || santri.kategori_santri || "REGULER"} />
                        </div>
                      </td>
                      <td className="p-4">
                        <select
                          className={`w-full border rounded-xl p-2 text-sm focus:ring-2 focus:ring-emerald-500 ${
                            pendingChanges[santri.id]?.tempat_makan_id !== undefined
                              ? "border-amber-400 bg-amber-50"
                              : "border-slate-200"
                          }`}
                          value={getDisplayValue(santri.id, "tempat_makan_id", santri.tempat_makan_id)}
                          onChange={(e) => handleSelectChange(santri.id, "tempat_makan_id", e.target.value)}
                        >
                          <option value="null">- Belum Ada -</option>
                          {jasaMakan.map((jasa) => (
                            <option key={jasa.id} value={jasa.id}>
                              {jasa.nama_jasa}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4">
                        <select
                          className={`w-full border rounded-xl p-2 text-sm focus:ring-2 focus:ring-emerald-500 ${
                            pendingChanges[santri.id]?.tempat_mencuci_id !== undefined
                              ? "border-amber-400 bg-amber-50"
                              : "border-slate-200"
                          }`}
                          value={getDisplayValue(santri.id, "tempat_mencuci_id", santri.tempat_mencuci_id)}
                          onChange={(e) => handleSelectChange(santri.id, "tempat_mencuci_id", e.target.value)}
                        >
                          <option value="null">- Belum Ada -</option>
                          {jasaCuci.map((jasa) => (
                            <option key={jasa.id} value={jasa.id}>
                              {jasa.nama_jasa}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              total={totalSantri}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>

          <div className="md:hidden space-y-3">
            {isLoadingSantri ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 shadow-sm text-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" />
              </div>
            ) : santriData.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center text-slate-400 font-medium">
                Tidak ada santri ditemukan.
              </div>
            ) : (
              santriData.map((santri) => (
                <div
                  key={santri.id}
                  className={`bg-white border rounded-xl p-4 shadow-sm relative ${
                    pendingChanges[santri.id] ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200"
                  }`}
                >
                  {pendingChanges[santri.id] && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}

                  <h3 className="font-bold text-slate-800 text-lg leading-tight">{santri.nama_lengkap}</h3>
                  <div className="mt-1 mb-3 flex flex-wrap items-center gap-1.5">
                    <p className="text-xs font-semibold text-slate-500 bg-slate-100 w-fit px-2 py-0.5 rounded-md">
                      {santri.nis} • Kamar {santri.kamar || "-"}
                    </p>
                    <KategoriBadge kategori={santri.kategori_efektif || santri.kategori_santri || "REGULER"} />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mb-1">
                        <Utensils className="w-3.5 h-3.5" />
                        Makan Di
                      </label>
                      <select
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50"
                        value={getDisplayValue(santri.id, "tempat_makan_id", santri.tempat_makan_id)}
                        onChange={(e) => handleSelectChange(santri.id, "tempat_makan_id", e.target.value)}
                      >
                        <option value="null">- Belum Ada -</option>
                        {jasaMakan.map((jasa) => (
                          <option key={jasa.id} value={jasa.id}>
                            {jasa.nama_jasa}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mb-1">
                        <Shirt className="w-3.5 h-3.5" />
                        Nyuci Di
                      </label>
                      <select
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50"
                        value={getDisplayValue(santri.id, "tempat_mencuci_id", santri.tempat_mencuci_id)}
                        onChange={(e) => handleSelectChange(santri.id, "tempat_mencuci_id", e.target.value)}
                      >
                        <option value="null">- Belum Ada -</option>
                        {jasaCuci.map((jasa) => (
                          <option key={jasa.id} value={jasa.id}>
                            {jasa.nama_jasa}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))
            )}

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                pageSize={pageSize}
                total={totalSantri}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SebaranSection
              title="Sebaran Katering"
              icon={<Utensils className="w-5 h-5 text-amber-600" />}
              color="amber"
              rows={sebaranMakan}
              isLoading={isLoadingSebaran}
              onOpen={(row) => openDetailModal("Makan", row.jasa_id, row.nama_jasa)}
            />
            <SebaranSection
              title="Sebaran Laundry"
              icon={<Shirt className="w-5 h-5 text-sky-600" />}
              color="sky"
              rows={sebaranCuci}
              isLoading={isLoadingSebaran}
              onOpen={(row) => openDetailModal("Cuci", row.jasa_id, row.nama_jasa)}
            />
          </div>
        </div>
      )}

      {totalChanges > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] md:w-auto md:min-w-[420px] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between z-40">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-900">
              {totalChanges}
            </div>
            <span className="font-medium text-sm md:text-base">Perubahan belum disimpan</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPendingChanges({})}
              disabled={isSaving}
              className="text-slate-300 hover:text-white px-3 py-2 text-sm font-medium transition"
            >
              Batal
            </button>
            <button
              onClick={handleSimpanBatch}
              disabled={isSaving}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Simpan</span>
            </button>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed top-4 right-4 bg-emerald-100 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl shadow-sm flex items-center gap-3 z-50">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span className="font-semibold">{toastMsg}</span>
        </div>
      )}

      {showModalJasa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Master Penyedia Jasa</h2>
                <p className="text-sm text-slate-500">Kelola daftar tempat makan dan mencuci.</p>
              </div>
              <button
                onClick={() => setShowModalJasa(false)}
                className="text-slate-400 hover:text-rose-500 transition p-2 rounded-full hover:bg-rose-50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-emerald-600" />
                    Input Manual
                  </h3>
                  <form onSubmit={handleTambahCepat} className="space-y-3">
                    <input
                      type="text"
                      placeholder="Nama penyedia jasa"
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={inputNamaJasa}
                      onChange={(e) => setInputNamaJasa(e.target.value)}
                      required
                    />
                    <select
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={inputJenisJasa}
                      onChange={(e) => setInputJenisJasa(e.target.value as "Makan" | "Cuci")}
                    >
                      <option value="Makan">Jasa Katering / Makan</option>
                      <option value="Cuci">Jasa Laundry / Cuci</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isSubmittingJasa}
                      className="w-full bg-slate-800 text-white py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 transition disabled:opacity-50 flex justify-center items-center"
                    >
                      {isSubmittingJasa ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Data"}
                    </button>
                  </form>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                  <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Import Excel (.xlsx)
                  </h3>
                  <p className="text-xs text-slate-500 mb-4 flex-1">
                    Gunakan template untuk menambah daftar penyedia sekaligus.
                  </p>

                  <div className="space-y-2">
                    <button
                      onClick={downloadTemplateExcel}
                      className="w-full border border-slate-300 text-slate-700 hover:bg-slate-50 py-2 rounded-lg text-sm font-medium transition flex justify-center items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download Template
                    </button>

                    <div className="relative">
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        ref={fileInputRef}
                        onChange={handleExcelUpload}
                        className="hidden"
                        id="upload-excel"
                      />
                      <label
                        htmlFor="upload-excel"
                        className={`w-full border border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 py-2 rounded-lg text-sm font-semibold transition flex justify-center items-center gap-2 cursor-pointer ${
                          isUploading ? "opacity-50 pointer-events-none" : ""
                        }`}
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                        {isUploading ? "Memproses Excel..." : "Upload File Excel"}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-3 border-b pb-2">Daftar Tersimpan ({masterJasa.length})</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {masterJasa.length === 0 && (
                    <p className="text-sm text-slate-500 italic text-center py-6">Belum ada data penyedia jasa.</p>
                  )}
                  {masterJasa.map((jasa) => (
                    <div
                      key={jasa.id}
                      className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 group transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-md ${jasa.jenis === "Makan" ? "bg-amber-100" : "bg-blue-100"}`}>
                          {jasa.jenis === "Makan" ? (
                            <Utensils className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Shirt className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm leading-none">{jasa.nama_jasa}</p>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-1 inline-block ${
                              jasa.jenis === "Makan" ? "text-amber-700" : "text-blue-700"
                            }`}
                          >
                            {jasa.jenis}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleHapusJasa(jasa.id)}
                        className="text-slate-300 hover:text-rose-500 p-2 hover:bg-rose-50 rounded-md transition"
                        title="Hapus Data"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  {detailModal.jenis === "Makan" ? <Utensils className="w-4 h-4" /> : <Shirt className="w-4 h-4" />}
                  {detailModal.jenis === "Makan" ? "Sebaran Katering" : "Sebaran Laundry"}
                </div>
                <h2 className="text-xl font-bold text-slate-800 mt-1">{detailModal.jasaNama}</h2>
                <p className="text-sm text-slate-500 mt-1">{detailTotal} santri terhubung ke penyedia ini.</p>
              </div>
              <button
                onClick={() => setDetailModal(null)}
                className="text-slate-400 hover:text-rose-500 transition p-2 rounded-full hover:bg-rose-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 bg-slate-50/60 p-4 space-y-3">
              {detailRows.map((row) => (
                <div key={row.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-bold text-slate-800">{row.nama_lengkap}</div>
                    <KategoriBadge kategori={row.kategori_efektif || row.kategori_santri || "REGULER"} />
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    {row.nis} • Asrama {row.asrama || "-"} • Kamar {row.kamar || "-"}
                  </div>
                </div>
              ))}

              {detailLoading && (
                <div className="py-6 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-500 mx-auto" />
                </div>
              )}

              {!detailLoading && detailRows.length === 0 && (
                <div className="py-10 text-center text-slate-400 font-medium">Belum ada santri untuk penyedia ini.</div>
              )}

              {!detailLoading && detailRows.length > 0 && detailHasMore && (
                <div ref={detailLoaderRef} className="py-4 text-center text-xs text-slate-400">
                  Scroll untuk memuat santri berikutnya...
                </div>
              )}

              {!detailLoading && detailRows.length > 0 && !detailHasMore && (
                <div className="py-4 text-center text-xs text-slate-400">Semua data santri sudah dimuat.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-800 mt-2">{value}</p>
          <p className="text-xs text-slate-400 mt-2">{subtitle}</p>
        </div>
        <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}

function KategoriBadge({ kategori }: { kategori: string }) {
  const isBaru = kategori === "BARU";
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-black ${
        isBaru ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {kategori}
    </span>
  );
}

function SebaranSection({
  title,
  icon,
  color,
  rows,
  isLoading,
  onOpen,
}: {
  title: string;
  icon: ReactNode;
  color: "amber" | "sky";
  rows: SebaranRow[];
  isLoading: boolean;
  onOpen: (row: SebaranRow) => void;
}) {
  const tone =
    color === "amber"
      ? "bg-amber-50 border-amber-100 text-amber-700"
      : "bg-sky-50 border-sky-100 text-sky-700";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${tone}`}>{icon}</div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <p className="text-sm text-slate-500">Klik penyedia untuk melihat daftar santri.</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-400">{rows.length} penyedia</span>
      </div>

      <div className="p-4 space-y-3 bg-slate-50/50 min-h-[240px]">
        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-medium">Belum ada data sebaran.</div>
        ) : (
          rows.map((row) => (
            <div key={`${title}-${row.jasa_id ?? "null"}`} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-800">{row.nama_jasa}</p>
                  <p className="text-sm text-slate-500 mt-1">{row.total} santri terhubung</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${tone}`}>{row.total}</span>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => onOpen(row)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Eye className="w-4 h-4" />
                  Lihat Santri
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function getEffectivePageSize(pageSize: number, total: number) {
  if (pageSize === 0) return Math.max(total, 1000);
  return pageSize;
}
