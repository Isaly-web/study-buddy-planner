-- Privat bucket för skärmdumpar bifogade till feedback. Filen laddas upp av
-- klienten till sin egen mapp (auth.uid()), servern skapar sedan en signerad
-- URL som skickas vidare till den centrala Feedback Hub-tjänsten.
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "feedback screenshots: user uploads to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "feedback screenshots: user reads own folder"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "feedback screenshots: user deletes own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
