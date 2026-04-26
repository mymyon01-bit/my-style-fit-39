-- Enforce: once a star is given on OOTD or a Showroom, it cannot be reclaimed.
-- Remove DELETE permissions on the underlying tables for the affected reaction kinds.

-- 1) ootd_stars: drop the user-facing DELETE policy entirely.
DROP POLICY IF EXISTS "Users can delete own stars" ON public.ootd_stars;

-- 2) showroom_reactions: replace the existing delete policy so 'star' reactions
--    can never be removed. Other reaction kinds (like, save) remain reversible.
DROP POLICY IF EXISTS "Users can delete own showroom reactions" ON public.showroom_reactions;
DROP POLICY IF EXISTS "Users delete own showroom reactions" ON public.showroom_reactions;

CREATE POLICY "Users delete own non-star showroom reactions"
ON public.showroom_reactions
FOR DELETE
TO public
USING (
  auth.uid() = user_id
  AND reaction_type <> 'star'
);