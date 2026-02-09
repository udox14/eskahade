export function terbilang(angka: number): string {
  const bil = Math.abs(angka);
  
  const satuan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let hasil = "";

  if (bil < 12) {
    hasil = " " + satuan[bil];
  } else if (bil < 20) {
    hasil = terbilang(bil - 10) + " Belas";
  } else if (bil < 100) {
    hasil = terbilang(Math.floor(bil / 10)) + " Puluh" + terbilang(bil % 10);
  } else if (bil < 200) {
    hasil = " Seratus" + terbilang(bil - 100);
  } else if (bil < 1000) {
    hasil = terbilang(Math.floor(bil / 100)) + " Ratus" + terbilang(bil % 100);
  }

  return hasil.trim();
}