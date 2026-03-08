import { notFound } from "next/navigation";

interface PageProps {
  params: {
    id: string;
  };
}

async function getSantri(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/santri/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

export default async function EditSantriPage({ params }: PageProps) {
  const santri = await getSantri(params.id);

  if (!santri) {
    notFound();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Data Santri</h1>

      <form method="POST" action={`/api/santri/${params.id}`} className="space-y-4">
        <input type="hidden" name="id" value={String(santri?.id ?? "")} />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Nomor Induk Santri (NIS)
          </label>
          <input
            name="nis"
            defaultValue={String(santri?.nis ?? "")}
            required
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            NIK
          </label>
          <input
            name="nik"
            defaultValue={String(santri?.nik ?? "")}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Nama Santri
          </label>
          <input
            name="nama"
            defaultValue={String(santri?.nama ?? "")}
            required
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Tempat Lahir
          </label>
          <input
            name="tempat_lahir"
            defaultValue={String(santri?.tempat_lahir ?? "")}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Tanggal Lahir
          </label>
          <input
            type="date"
            name="tanggal_lahir"
            defaultValue={String(santri?.tanggal_lahir ?? "")}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>

        <div className="pt-4">
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Simpan Perubahan
          </button>
        </div>
      </form>
    </div>
  );
}