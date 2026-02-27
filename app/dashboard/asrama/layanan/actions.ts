"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// --- REFERENSI ASRAMA & KAMAR ---
export async function getDaftarAsrama() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('santri')
    .select('asrama')
    .not('asrama', 'is', null)
    .order('asrama');
  
  if (error) throw error;
  
  const uniqueAsrama = Array.from(new Set(data.map(item => item.asrama)));
  return uniqueAsrama;
}

export async function getDaftarKamar(asrama: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('santri')
    .select('kamar')
    .eq('asrama', asrama)
    .not('kamar', 'is', null)
    .order('kamar');
  
  if (error) throw error;
  
  const uniqueKamar = Array.from(new Set(data.map(item => item.kamar)));
  return uniqueKamar;
}

// --- MASTER PENYEDIA JASA ---
export async function getMasterJasa() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('master_jasa')
    .select('*')
    .order('nama_jasa', { ascending: true });
  
  if (error) throw error;
  return data;
}

export async function tambahMasterJasa(nama_jasa: string, jenis: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('master_jasa').insert([{ nama_jasa, jenis }]);
  
  if (error) throw error;
  revalidatePath('/dashboard/asrama/layanan');
  return { success: true };
}

// Tambah massal - Sekarang menerima array objek langsung (hasil parsing Excel dari Client)
export async function tambahMasterJasaBatch(dataBatch: { nama_jasa: string, jenis: string }[]) {
  if (!dataBatch || dataBatch.length === 0) return { error: "Data kosong" };

  const supabase = await createClient();
  const { error } = await supabase.from('master_jasa').insert(dataBatch);
  if (error) throw error;
  
  revalidatePath('/dashboard/asrama/layanan');
  return { success: true, count: dataBatch.length };
}

export async function hapusMasterJasa(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('master_jasa').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/dashboard/asrama/layanan');
}

// --- LAZY LOAD LIST SANTRI ---
export async function getSantriLayanan({
  asrama,
  kamar,
  belumDitempatkan,
  page = 0,
  limit = 20
}: {
  asrama: string;
  kamar?: string;
  belumDitempatkan: boolean;
  page: number;
  limit: number;
}) {
  const supabase = await createClient();
  const start = page * limit;
  const end = start + limit - 1;

  let query = supabase
    .from('santri')
    .select('id, nis, nama_lengkap, kamar, tempat_makan_id, tempat_mencuci_id', { count: 'exact' })
    .eq('asrama', asrama)
    .order('kamar', { ascending: true })
    .order('nama_lengkap', { ascending: true })
    .range(start, end);

  if (kamar) {
    query = query.eq('kamar', kamar);
  }

  if (belumDitempatkan) {
    query = query.or('tempat_makan_id.is.null,tempat_mencuci_id.is.null');
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, count };
}

// --- SIMPAN BATCH (BULK UPDATE) ---
export async function simpanBatchLayanan(changes: Record<string, { tempat_makan_id?: string | null, tempat_mencuci_id?: string | null }>) {
  const supabase = await createClient();
  const entries = Object.entries(changes);
  
  if (entries.length === 0) return { success: true };

  const promises = entries.map(([id, data]) => {
    return supabase.from('santri').update(data).eq('id', id);
  });

  const results = await Promise.all(promises);
  
  const hasError = results.some(res => res.error !== null);
  if (hasError) throw new Error("Gagal menyimpan beberapa data");

  revalidatePath('/dashboard/asrama/layanan');
  return { success: true, count: entries.length };
}