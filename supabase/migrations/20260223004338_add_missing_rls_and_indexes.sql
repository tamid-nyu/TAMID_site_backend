
-- Missing RLS policies for write operations
CREATE POLICY "Enable insert for anon" ON public.members FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Enable insert for anon" ON public.semesters FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Enable update for anon" ON public.board_members FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for anon" ON public.board_members FOR DELETE TO anon USING (true);

-- Indexes on unindexed FK columns
CREATE INDEX idx_events_semester ON public.events (semester);
CREATE INDEX idx_members_semester ON public.members (semester);
;
