"use client";
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="min-h-11 rounded-xl bg-emerald-700 px-5 text-white print:hidden"
    >
      Cetak bukti
    </button>
  );
}
