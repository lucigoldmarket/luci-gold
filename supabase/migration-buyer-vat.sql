-- Add buyer_vat_pct to transactions
-- G2G applies destination-based VAT: buyer's country VAT is charged on top of commission
-- e.g. UK buyer: commission × (1 + 11% ID VAT + 20% UK VAT)

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS buyer_vat_pct DECIMAL(5,2) DEFAULT 0;

-- Verifikasi
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name = 'buyer_vat_pct';
