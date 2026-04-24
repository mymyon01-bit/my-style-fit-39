
-- 1. Add group chat columns to conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- 2. Make user_a/user_b nullable for group rooms (legacy 1:1 still uses them)
ALTER TABLE public.conversations
  ALTER COLUMN user_a DROP NOT NULL,
  ALTER COLUMN user_b DROP NOT NULL;

-- 3. Participants table
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON public.conversation_participants(conversation_id);

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a participant?
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conv_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conv_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = _conv_id AND (user_a = _user_id OR user_b = _user_id)
  );
$$;

-- RLS for participants
CREATE POLICY "Participants view membership"
  ON public.conversation_participants FOR SELECT
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Users add themselves"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Users leave conversations"
  ON public.conversation_participants FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Messages: allow null recipient (group), keep existing 1:1 working
ALTER TABLE public.messages
  ALTER COLUMN recipient_id DROP NOT NULL;

-- Replace messages SELECT policy to also allow group participants
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages"
  ON public.messages FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() = recipient_id
    OR public.is_conversation_participant(conversation_id, auth.uid())
  );

-- Allow senders that are participants to insert (covers group)
DROP POLICY IF EXISTS "Senders can insert messages" ON public.messages;
CREATE POLICY "Senders can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

-- Conversations SELECT/UPDATE policies updated to include group participants
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations"
  ON public.conversations FOR SELECT
  USING (
    auth.uid() = user_a
    OR auth.uid() = user_b
    OR public.is_conversation_participant(id, auth.uid())
  );

DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
CREATE POLICY "Participants can update conversations"
  ON public.conversations FOR UPDATE
  USING (
    auth.uid() = user_a
    OR auth.uid() = user_b
    OR public.is_conversation_participant(id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can create conversations they are part of" ON public.conversations;
CREATE POLICY "Users can create conversations they are part of"
  ON public.conversations FOR INSERT
  WITH CHECK (
    auth.uid() = user_a
    OR auth.uid() = user_b
    OR auth.uid() = created_by
  );

-- 5. RPC: create group conversation with members
CREATE OR REPLACE FUNCTION public.create_group_conversation(_title text, _member_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _id uuid;
  _uid uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _member_ids IS NULL OR array_length(_member_ids, 1) < 1 THEN
    RAISE EXCEPTION 'need_at_least_one_member';
  END IF;

  INSERT INTO public.conversations (is_group, title, created_by)
  VALUES (true, NULLIF(trim(_title), ''), _me)
  RETURNING id INTO _id;

  -- creator is participant
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (_id, _me)
  ON CONFLICT DO NOTHING;

  FOREACH _uid IN ARRAY _member_ids LOOP
    IF _uid <> _me THEN
      INSERT INTO public.conversation_participants (conversation_id, user_id)
      VALUES (_id, _uid)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN _id;
END;
$$;

-- 6. RPC: add a member to existing group
CREATE OR REPLACE FUNCTION public.add_conversation_member(_conv_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_conversation_participant(_conv_id, _me) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (_conv_id, _user_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- 7. Backfill: existing 1:1 conversations -> add both users as participants (so the same code path works)
INSERT INTO public.conversation_participants (conversation_id, user_id)
SELECT id, user_a FROM public.conversations WHERE user_a IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.conversation_participants (conversation_id, user_id)
SELECT id, user_b FROM public.conversations WHERE user_b IS NOT NULL
ON CONFLICT DO NOTHING;
