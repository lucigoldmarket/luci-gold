-- Tambah initial_saldo ke profit_sharing_config (digunakan sebagai saldo awal)
ALTER TABLE profit_sharing_config
  ADD COLUMN IF NOT EXISTS initial_saldo numeric(16,2) NOT NULL DEFAULT 0;
