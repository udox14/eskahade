import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Pencil, Search, Home } from "lucide-react";
import { SearchInput, LimitSelector, PaginationControls, SantriFilter } from "./santri-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function SantriPage(props: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const searchParams = await props.searchParams;

  // 1. CEK USER & ROLE (Untuk Auto Filter)
  const { data: { user } } = await supabase.auth.getUser();
  let userAsrama = null;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, asrama_binaan')
      .eq('id', user.id)
      .single();
    
    // Jika Pengurus Asrama, ambil asrama binaannya
    if (profile?.role === 'pengurus_asrama') {
      userAsrama = profile.asrama_binaan;
    }
  }

  // 2. Ambil Data Referensi untuk Filter (Marhalah & Kelas)
  const { data: marhalahList } = await supabase.from('marhalah').select('id, nama').order('urutan');
  const { data: kelasRaw } = await supabase.from('kelas').select('id, nama_kelas, marhalah_id');
  const kelasList = (kelasRaw || []).sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' }));

  // 3. Ambil Parameter dari URL
  const page = Number(searchParams.page) || 1;
  const limit = Number(searchParams.limit) || 10;
  const query = (searchParams.q as string) || '';
  
  // Filter: Gunakan dari URL ATAU dari User Profile (Prioritas Profile)
  const asrama = userAsrama || (searchParams.asrama as string) || '';
  
  const kamar = (searchParams.kamar as string) || '';
  const sekolah = (searchParams.sekolah as string) || '';
  const kelasSekolah = (searchParams.kelas_sekolah as string) || '';
  const marhalah = (searchParams.marhalah as string) || '';
  const kelasPesantren = (searchParams.kelas as string) || '';

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // 4. Bangun Query
  let supabaseQuery;

  if (kelasPesantren) {
    supabaseQuery = supabase
      .from("santri")
      .select("*, riwayat_pendidikan!inner(kelas_id)", { count: 'exact' })
      .eq('riwayat_pendidikan.kelas_id', kelasPesantren)
      .eq('riwayat_pendidikan.status_riwayat', 'aktif');
  } else if (marhalah) {
    supabaseQuery = supabase
      .from("santri")
      .select("*, riwayat_pendidikan!inner(kelas!inner(marhalah_id))", { count: 'exact' })
      .eq('riwayat_pendidikan.kelas.marhalah_id', marhalah)
      .eq('riwayat_pendidikan.status_riwayat', 'aktif');
  } else {
    supabaseQuery = supabase
      .from("santri")
      .select("*", { count: 'exact' });
  }

  // Terapkan Filter
  if (query) supabaseQuery = supabaseQuery.or(`nama_lengkap.ilike.%${query}%,nis.ilike.%${query}%`);
  
  // KUNCI FILTER ASRAMA (Jika ada)
  if (asrama) supabaseQuery = supabaseQuery.eq('asrama', asrama);
  
  if (kamar) supabaseQuery = supabaseQuery.eq('kamar', kamar);
  if (sekolah) supabaseQuery = supabaseQuery.eq('sekolah', sekolah);
  if (kelasSekolah) supabaseQuery = supabaseQuery.ilike('kelas_sekolah', `%${kelasSekolah}%`);

  const { data: santriList, error, count } = await supabaseQuery
    .order("nama_lengkap", { ascending: true })
    .range(from, to);

  if (error) {
    return <div className="text-red-500">Error mengambil data: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            Data Santri
            {userAsrama && (
              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full border border-orange-200">
                <Home className="w-3 h-3 inline mr-1"/>
                Asrama: {userAsrama}
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-sm">Kelola data induk santri Pesantren Sukahideng</p>
        </div>
        
        {/* Tombol Tambah hanya untuk Admin & Sekpen (Pengurus Asrama tidak bisa nambah santri) */}
        {!userAsrama && (
          <Link 
            href="/dashboard/santri/input"
            className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Santri Baru</span>
          </Link>
        )}
      </div>

      {/* FILTER BAR KOMPLIT */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-1/3">
            <SearchInput />
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Filter Lanjutan (Jika userAsrama ada, filter asrama di UI akan di-disable/hidden otomatis lewat query param, tapi di sini kita biarkan komponen handle visualnya, atau kita bisa passing props 'lockedAsrama' ke SantriFilter jika mau lebih canggih. Untuk sekarang, query DB sudah membatasinya) */}
            <SantriFilter 
              marhalahList={marhalahList || []} 
              kelasList={kelasList || []} 
            />
            <LimitSelector />
          </div>
        </div>
      </div>

      {/* TABEL DATA */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">Nama Lengkap</th>
                <th className="px-6 py-4">NIS</th>
                <th className="px-6 py-4">Asrama / Kamar</th>
                <th className="px-6 py-4">Sekolah Formal</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {santriList?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <p>Data tidak ditemukan.</p>
                  </td>
                </tr>
              ) : (
                santriList?.map((santri) => (
                  <tr key={santri.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {santri.nama_lengkap}
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-mono">
                      {santri.nis}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900 font-medium">{santri.asrama || "-"}</div>
                      <div className="text-xs text-gray-500">Kamar {santri.kamar || "-"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-blue-700 font-medium">{santri.sekolah || "-"}</div>
                      <div className="text-xs text-gray-500">{santri.kelas_sekolah || "-"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        santri.status_global === 'aktif' ? 'bg-green-100 text-green-700' :
                        santri.status_global === 'lulus' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {santri.status_global?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {!userAsrama && (
                        <Link 
                          href={`/dashboard/santri/${santri.id}/edit`}
                          className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-md font-medium text-xs transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </Link>
                      )}
                      
                      <Link 
                        href={`/dashboard/santri/${santri.id}`}
                        className="inline-block text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md font-medium text-xs transition-colors"
                      >
                        Lihat Detail
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
          <PaginationControls 
            total={count || 0} 
            limit={limit} 
            page={page} 
          />
        </div>
      </div>
    </div>
  );
}