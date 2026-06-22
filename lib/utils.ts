import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Fungsi ini berguna untuk menggabungkan class Tailwind secara dinamis
// Contoh: cn("bg-red-500", kondisi && "text-white")
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Mengubah huruf pertama setiap kata menjadi huruf kapital, sisanya huruf kecil.
 * Contoh: "MUHAMMAD AL FATIH" -> "Muhammad Al Fatih"
 */
export function capitalizeEachWord(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}