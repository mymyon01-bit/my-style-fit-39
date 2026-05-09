
-- ============================================================
-- OOTD Waves: private group OOTD communities
-- ============================================================

-- 1. waves
CREATE TABLE public.waves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  cover_image_url text,
  created_by uuid NOT NULL,
  is_private boolean NOT NULL DEFAULT true,
  member_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.waves ENABLE ROW LEVEL SECURITY;

-- 2. wave_members
CREATE TABLE public.wave_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id uuid NOT NULL REFERENCES public.waves(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wave_id, user_id)
);
ALTER TABLE public.wave_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wave_members_user ON public.wave_members(user_id);
CREATE INDEX idx_wave_members_wave ON public.wave_members(wave_id);

-- 3. wave_posts (linking ootd_posts into wave feeds)
CREATE TABLE public.wave_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id uuid NOT NULL REFERENCES public.waves(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.ootd_posts(id) ON DELETE CASCADE,
  shared_by uuid NOT NULL,
  shared_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wave_id, post_id)
);
ALTER TABLE public.wave_posts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wave_posts_wave ON public.wave_posts(wave_id, shared_at DESC);

-- 4. wave_invites
CREATE TABLE public.wave_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id uuid NOT NULL REFERENCES public.waves(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (wave_id, invitee_id)
);
ALTER TABLE public.wave_invites ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wave_invites_invitee ON public.wave_invites(invitee_id, status);

-- ============================================================
-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_wave_member(_wave_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wave_members
    WHERE wave_id = _wave_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_wave_admin(_wave_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wave_members
    WHERE wave_id = _wave_id AND user_id = _user_id
      AND role IN ('owner','admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_wave_owner(_wave_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wave_members
    WHERE wave_id = _wave_id AND user_id = _user_id AND role = 'owner'
  );
$$;

-- ============================================================
-- Trigger: auto-add creator as owner
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_wave_creator_as_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wave_members (wave_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_wave_add_owner
AFTER INSERT ON public.waves
FOR EACH ROW EXECUTE FUNCTION public.add_wave_creator_as_owner();

-- Member count maintenance
CREATE OR REPLACE FUNCTION public.bump_wave_member_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.waves SET member_count = member_count + 1, updated_at = now() WHERE id = NEW.wave_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.waves SET member_count = GREATEST(member_count - 1, 0), updated_at = now() WHERE id = OLD.wave_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_wave_member_count
AFTER INSERT OR DELETE ON public.wave_members
FOR EACH ROW EXECUTE FUNCTION public.bump_wave_member_count();

-- updated_at trigger
CREATE TRIGGER trg_waves_updated_at
BEFORE UPDATE ON public.waves
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notify invitee on new invite (in-app notification)
CREATE OR REPLACE FUNCTION public.notify_on_wave_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invitee_id <> NEW.inviter_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, target_id, metadata)
    VALUES (NEW.invitee_id, NEW.inviter_id, 'wave_invite', NEW.wave_id::text,
            jsonb_build_object('invite_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_wave_invite_notify
AFTER INSERT ON public.wave_invites
FOR EACH ROW EXECUTE FUNCTION public.notify_on_wave_invite();

-- Accept-invite RPC: invitee accepts → becomes member
CREATE OR REPLACE FUNCTION public.accept_wave_invite(_invite_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _inv public.wave_invites%ROWTYPE;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _inv FROM public.wave_invites WHERE id = _invite_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  IF _inv.invitee_id <> _me THEN RAISE EXCEPTION 'not_invitee'; END IF;
  IF _inv.status <> 'pending' THEN RAISE EXCEPTION 'invite_not_pending'; END IF;

  INSERT INTO public.wave_members (wave_id, user_id, role)
  VALUES (_inv.wave_id, _me, 'member')
  ON CONFLICT (wave_id, user_id) DO NOTHING;

  UPDATE public.wave_invites
     SET status = 'accepted', responded_at = now()
   WHERE id = _invite_id;

  RETURN _inv.wave_id;
END $$;

CREATE OR REPLACE FUNCTION public.decline_wave_invite(_invite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.wave_invites
     SET status = 'declined', responded_at = now()
   WHERE id = _invite_id AND invitee_id = _me AND status = 'pending';
END $$;

-- ============================================================
-- RLS Policies
-- ============================================================

-- waves
CREATE POLICY "Members can view their waves"
  ON public.waves FOR SELECT
  USING (public.is_wave_member(id, auth.uid()));

CREATE POLICY "Authenticated users can create waves"
  ON public.waves FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners and admins can update waves"
  ON public.waves FOR UPDATE
  USING (public.is_wave_admin(id, auth.uid()));

CREATE POLICY "Owners can delete waves"
  ON public.waves FOR DELETE
  USING (public.is_wave_owner(id, auth.uid()));

-- wave_members
CREATE POLICY "Members can view co-members"
  ON public.wave_members FOR SELECT
  USING (public.is_wave_member(wave_id, auth.uid()));

CREATE POLICY "Admins can add members"
  ON public.wave_members FOR INSERT
  WITH CHECK (public.is_wave_admin(wave_id, auth.uid()) OR auth.uid() = user_id);

CREATE POLICY "Admins or self can remove members"
  ON public.wave_members FOR DELETE
  USING (public.is_wave_admin(wave_id, auth.uid()) OR auth.uid() = user_id);

CREATE POLICY "Admins can update roles"
  ON public.wave_members FOR UPDATE
  USING (public.is_wave_admin(wave_id, auth.uid()));

-- wave_posts
CREATE POLICY "Members can view wave posts"
  ON public.wave_posts FOR SELECT
  USING (public.is_wave_member(wave_id, auth.uid()));

CREATE POLICY "Members can share to wave"
  ON public.wave_posts FOR INSERT
  WITH CHECK (
    public.is_wave_member(wave_id, auth.uid())
    AND auth.uid() = shared_by
  );

CREATE POLICY "Sharer or admin can remove from wave"
  ON public.wave_posts FOR DELETE
  USING (auth.uid() = shared_by OR public.is_wave_admin(wave_id, auth.uid()));

-- wave_invites
CREATE POLICY "Inviter or invitee can view invite"
  ON public.wave_invites FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Wave members can send invites"
  ON public.wave_invites FOR INSERT
  WITH CHECK (
    auth.uid() = inviter_id
    AND public.is_wave_member(wave_id, auth.uid())
  );

CREATE POLICY "Invitee can update invite status"
  ON public.wave_invites FOR UPDATE
  USING (auth.uid() = invitee_id OR auth.uid() = inviter_id);

CREATE POLICY "Inviter can cancel invite"
  ON public.wave_invites FOR DELETE
  USING (auth.uid() = inviter_id);
