ALTER TABLE public.conversation_participants ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE POLICY "Users update own participation"
ON public.conversation_participants
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);