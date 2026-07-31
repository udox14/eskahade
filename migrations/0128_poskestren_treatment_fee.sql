-- Menambahkan kolom patient_rate_with_treatment_rupiah untuk tarif kunjungan dengan tindakan
ALTER TABLE poskestren_compensation_history 
  ADD COLUMN patient_rate_with_treatment_rupiah INTEGER 
  CHECK (patient_rate_with_treatment_rupiah IS NULL OR patient_rate_with_treatment_rupiah >= 0);
