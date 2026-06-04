-- Tabel tracking deposit dari investor
CREATE TABLE IF NOT EXISTS deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_date date NOT NULL DEFAULT CURRENT_DATE,
  investor_name text NOT NULL,
  amount_idr numeric(16,2) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deposits_select" ON deposits FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "deposits_write_admin" ON deposits FOR ALL USING (get_my_role() = 'admin');
