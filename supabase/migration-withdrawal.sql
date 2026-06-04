-- Migration: add withdrawal_id to transactions + ensure operational_expenses is ready

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS withdrawal_id uuid REFERENCES withdrawals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_withdrawal_id ON transactions(withdrawal_id);
