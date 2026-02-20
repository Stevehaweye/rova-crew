-- ============================================================
-- ROVA Crew – Week 1 Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================


-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id                  uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           text        NOT NULL,
  avatar_url          text,
  bio                 text,
  location            text,
  interests           text[]      DEFAULT '{}',
  onboarding_complete boolean     DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.groups (
  id                      uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text        NOT NULL,
  slug                    text        UNIQUE NOT NULL,
  tagline                 text,
  description             text,
  category                text        DEFAULT 'Other',
  logo_url                text,
  hero_url                text,
  primary_colour          text        DEFAULT '0D7377',
  is_public               boolean     DEFAULT true,
  join_approval_required  boolean     DEFAULT false,
  created_by              uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  uuid        REFERENCES public.groups(id)   ON DELETE CASCADE,
  user_id   uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  role      text        DEFAULT 'member'    CHECK (role   IN ('super_admin','co_admin','member')),
  status    text        DEFAULT 'approved'  CHECK (status IN ('pending','approved','blocked')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.member_stats (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id                uuid        REFERENCES public.groups(id)   ON DELETE CASCADE,
  crew_score              integer     DEFAULT 0   CHECK (crew_score >= 0 AND crew_score <= 1000),
  tier                    text        DEFAULT 'newcomer' CHECK (tier IN ('newcomer','regular','dedicated','veteran','legend')),
  loyalty_score           integer     DEFAULT 0,
  spirit_score            integer     DEFAULT 0,
  adventure_score         integer     DEFAULT 0,
  legacy_score            integer     DEFAULT 0,
  events_attended         integer     DEFAULT 0,
  events_available        integer     DEFAULT 0,
  attendance_rate         decimal     DEFAULT 0,
  spirit_points_total     integer     DEFAULT 0,
  spirit_points_this_month integer    DEFAULT 0,
  current_streak          integer     DEFAULT 0,
  best_streak             integer     DEFAULT 0,
  guest_converts          integer     DEFAULT 0,
  last_calculated_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, group_id)
);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_stats  ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- RLS POLICIES: profiles
-- ============================================================

-- Any authenticated user can read any profile
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can create only their own profile row
CREATE POLICY "profiles_insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can update only their own profile row
CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ============================================================
-- RLS POLICIES: groups
-- ============================================================

-- Public groups visible to all authenticated users;
-- private groups visible only to approved members or the creator
CREATE POLICY "groups_select"
  ON public.groups FOR SELECT
  TO authenticated
  USING (
    is_public = true
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = groups.id
        AND gm.user_id  = auth.uid()
        AND gm.status   = 'approved'
    )
  );

-- Any authenticated user can create a group (they become creator)
CREATE POLICY "groups_insert"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Only super_admin / co_admin members can update group details
CREATE POLICY "groups_update"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = groups.id
        AND gm.user_id  = auth.uid()
        AND gm.role     IN ('super_admin','co_admin')
        AND gm.status   = 'approved'
    )
  );

-- Only the super_admin can delete a group
CREATE POLICY "groups_delete"
  ON public.groups FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = groups.id
        AND gm.user_id  = auth.uid()
        AND gm.role     = 'super_admin'
        AND gm.status   = 'approved'
    )
  );


-- ============================================================
-- RLS POLICIES: group_members
-- ============================================================

-- Approved members of a group (and the member themselves) can read memberships
CREATE POLICY "group_members_select"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id
        AND gm2.user_id  = auth.uid()
        AND gm2.status   = 'approved'
    )
  );

-- Any authenticated user can request to join (insert their own row)
CREATE POLICY "group_members_insert"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Group admins can update membership rows (approve, block, change role)
CREATE POLICY "group_members_update"
  ON public.group_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id
        AND gm2.user_id  = auth.uid()
        AND gm2.role     IN ('super_admin','co_admin')
        AND gm2.status   = 'approved'
    )
  );

-- Users can remove themselves; admins can remove others
CREATE POLICY "group_members_delete"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id
        AND gm2.user_id  = auth.uid()
        AND gm2.role     IN ('super_admin','co_admin')
        AND gm2.status   = 'approved'
    )
  );


-- ============================================================
-- RLS POLICIES: member_stats
-- ============================================================

-- Approved members of the same group can read stats
CREATE POLICY "member_stats_select"
  ON public.member_stats FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = member_stats.group_id
        AND gm.user_id  = auth.uid()
        AND gm.status   = 'approved'
    )
  );

-- No INSERT / UPDATE / DELETE policies for authenticated role →
-- only the service_role (backend / Edge Functions) can write stats.


-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Shared updated_at stamper
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- Auto-create a profile row when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)   -- fallback: use email prefix
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
