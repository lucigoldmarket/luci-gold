-- Add order_code column to transactions for linking G2G order codes
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS order_code TEXT;
