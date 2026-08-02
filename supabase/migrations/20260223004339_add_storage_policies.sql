
-- board-headshots bucket policies
CREATE POLICY "Allow public read on board-headshots" ON storage.objects FOR SELECT TO public USING (bucket_id = 'board-headshots');
CREATE POLICY "Allow anon upload to board-headshots" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'board-headshots');
CREATE POLICY "Allow anon delete from board-headshots" ON storage.objects FOR DELETE TO anon USING (bucket_id = 'board-headshots');

-- event-flyers bucket policies
CREATE POLICY "Allow public read on event-flyers" ON storage.objects FOR SELECT TO public USING (bucket_id = 'event-flyers');
CREATE POLICY "Allow anon upload to event-flyers" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'event-flyers');
CREATE POLICY "Allow anon delete from event-flyers" ON storage.objects FOR DELETE TO anon USING (bucket_id = 'event-flyers');
;
