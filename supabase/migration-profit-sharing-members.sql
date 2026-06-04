-- Migration: profit sharing per member (individual %)

CREATE TABLE IF NOT EXISTS profit_sharing_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  share_pct numeric(5,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profit_sharing_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_members_select" ON profit_sharing_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "ps_members_write_admin" ON profit_sharing_members FOR ALL
  USING (get_my_role() = 'admin');
