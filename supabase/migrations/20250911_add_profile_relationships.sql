-- Link memberships.user_id → profiles.user_id for PostgREST relationship support

DO $$
BEGIN
  ALTER TABLE public.account_memberships
    ADD CONSTRAINT account_memberships_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.team_memberships
    ADD CONSTRAINT team_memberships_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Refresh PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');
