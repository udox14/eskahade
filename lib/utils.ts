import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Fungsi ini berguna untuk menggabungkan class Tailwind secara dinamis
// Contoh: cn("bg-red-500", kondisi && "text-white")
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}