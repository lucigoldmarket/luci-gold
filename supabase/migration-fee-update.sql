-- Update fee config: ganti withdrawal fee dari 1.99% + Rp 19.999 fixed
-- ke 2.48% (base rate, VAT applied in application code)
-- Sesuai invoice G2G real: disbursement 2.48% × 1.11 PPN = 2.7528% efektif

UPDATE fee_config
SET
  withdrawal_fee_pct = 2.48,
  withdrawal_fee_fixed = 0
WHERE is_active = true;

-- Verifikasi
SELECT commission_pct, vat_pct, withdrawal_fee_pct, withdrawal_fee_fixed, is_active
FROM fee_config;
