CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Catatan Baru',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_select_own" ON notes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notes_insert_own" ON notes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "notes_update_own" ON notes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notes_delete_own" ON notes FOR DELETE USING (user_id = auth.uid());
