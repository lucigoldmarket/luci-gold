-- Periode tutup buku: setiap arsip transaksi per period
CREATE TABLE IF NOT EXISTS periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS archived_period_id uuid REFERENCES periods(id);

ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "periods_select" ON periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "periods_insert" ON periods FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "periods_delete" ON periods FOR DELETE TO authenticated USING (true);
