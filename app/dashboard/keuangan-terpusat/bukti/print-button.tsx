"use client";
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-11 rounded-md bg-emerald-700 px-5 text-white print:hidden"
    >
      Cetak bukti
    </button>
  );
}
