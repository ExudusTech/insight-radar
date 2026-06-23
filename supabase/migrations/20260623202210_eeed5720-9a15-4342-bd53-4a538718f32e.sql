
-- ===== Enums =====
CREATE TYPE public.app_role AS ENUM ('superadmin', 'contractor', 'analyst');
CREATE TYPE public.profile_status AS ENUM ('active', 'inactive', 'pending', 'blocked');
CREATE TYPE public.mission_status AS ENUM (
  'draft','in_review','awaiting_approval','approved','execution_started',
  'in_collection','in_analysis','report_review','delivered','closed','paused','cancelled'
);
CREATE TYPE public.target_status AS ENUM (
  'not_started','public_research','first_contact_sent','awaiting_response','in_conversation',
  'call_scheduled','call_done','proposal_received','price_identified','collection_complete',
  'incomplete','discarded'
);
CREATE TYPE public.target_priority AS ENUM ('high','medium','low');
CREATE TYPE public.doc_version_status AS ENUM ('draft','reviewing','approved','rejected','replaced','frozen');
CREATE TYPE public.change_request_status AS ENUM ('requested','analyzing','approved','rejected','applied','cancelled');
CREATE TYPE public.report_type AS ENUM ('individual','comparative','strategic');
CREATE TYPE public.report_status AS ENUM ('draft','generated','reviewing','approved','delivered');
CREATE TYPE public.collection_block AS ENUM ('A','B','C','D','E','F','G');

-- ===== Utility: updated_at =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== profiles =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  organization TEXT,
  status public.profile_status NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== user_roles =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ===== has_role security definer =====
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'superadmin' THEN 1 WHEN 'contractor' THEN 2 WHEN 'analyst' THEN 3 END
  LIMIT 1;
$$;

-- ===== profiles policies =====
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Allow authenticated users to list profiles (for selects in mission forms)
CREATE POLICY "profiles_list_for_authenticated" ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- ===== user_roles policies =====
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- ===== missions =====
CREATE TABLE public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contractor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  segment TEXT,
  objective TEXT,
  description TEXT,
  deadline_first DATE,
  deadline_final DATE,
  responsible_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approach_type TEXT,
  ethical_rules TEXT,
  forbidden_items TEXT,
  expected_deliverables TEXT,
  completion_criteria TEXT,
  status public.mission_status NOT NULL DEFAULT 'draft',
  drive_folder_id TEXT,
  target_label TEXT NOT NULL DEFAULT 'Alvo',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.missions TO authenticated;
GRANT ALL ON public.missions TO service_role;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_missions_updated BEFORE UPDATE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== mission_analysts =====
CREATE TABLE public.mission_analysts (
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  analyst_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (mission_id, analyst_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_analysts TO authenticated;
GRANT ALL ON public.mission_analysts TO service_role;
ALTER TABLE public.mission_analysts ENABLE ROW LEVEL SECURITY;

-- ===== mission access helper =====
CREATE OR REPLACE FUNCTION public.can_access_mission(_mission_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(auth.uid(), 'superadmin')
    OR EXISTS (SELECT 1 FROM public.missions m WHERE m.id = _mission_id AND m.contractor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.mission_analysts ma WHERE ma.mission_id = _mission_id AND ma.analyst_id = auth.uid());
$$;

-- ===== missions policies =====
CREATE POLICY "missions_read" ON public.missions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin')
    OR contractor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.mission_analysts ma WHERE ma.mission_id = id AND ma.analyst_id = auth.uid())
  );
CREATE POLICY "missions_admin_write" ON public.missions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- ===== mission_analysts policies =====
CREATE POLICY "mission_analysts_read" ON public.mission_analysts FOR SELECT TO authenticated
  USING (public.can_access_mission(mission_id));
CREATE POLICY "mission_analysts_admin_write" ON public.mission_analysts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- ===== document_versions =====
CREATE TABLE public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_url TEXT,
  file_name TEXT,
  extracted_data JSONB,
  status public.doc_version_status NOT NULL DEFAULT 'draft',
  author_id UUID REFERENCES public.profiles(id),
  reason TEXT,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_versions TO authenticated;
GRANT ALL ON public.document_versions TO service_role;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docver_read" ON public.document_versions FOR SELECT TO authenticated
  USING (public.can_access_mission(mission_id));
CREATE POLICY "docver_write" ON public.document_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin') OR public.can_access_mission(mission_id))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin') OR public.can_access_mission(mission_id));

-- ===== targets =====
CREATE TABLE public.targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  instagram TEXT,
  site TEXT,
  whatsapp TEXT,
  email TEXT,
  linkedin TEXT,
  other_links TEXT,
  priority public.target_priority NOT NULL DEFAULT 'medium',
  status public.target_status NOT NULL DEFAULT 'not_started',
  analyst_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  drive_folder_id TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.targets TO authenticated;
GRANT ALL ON public.targets TO service_role;
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_targets_updated BEFORE UPDATE ON public.targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "targets_read" ON public.targets FOR SELECT TO authenticated
  USING (public.can_access_mission(mission_id));
CREATE POLICY "targets_write" ON public.targets FOR ALL TO authenticated
  USING (public.can_access_mission(mission_id))
  WITH CHECK (public.can_access_mission(mission_id));

-- ===== collection_data =====
CREATE TABLE public.collection_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  block public.collection_block NOT NULL,
  field_key TEXT NOT NULL,
  field_value JSONB,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(target_id, block, field_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_data TO authenticated;
GRANT ALL ON public.collection_data TO service_role;
ALTER TABLE public.collection_data ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_collection_updated BEFORE UPDATE ON public.collection_data
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "collection_read" ON public.collection_data FOR SELECT TO authenticated
  USING (public.can_access_mission(mission_id));
CREATE POLICY "collection_write" ON public.collection_data FOR ALL TO authenticated
  USING (public.can_access_mission(mission_id))
  WITH CHECK (public.can_access_mission(mission_id));

-- ===== interactions =====
CREATE TABLE public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel TEXT,
  content TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_action TEXT,
  status_after TEXT,
  event_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interactions TO authenticated;
GRANT ALL ON public.interactions TO service_role;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interactions_read" ON public.interactions FOR SELECT TO authenticated
  USING (public.can_access_mission(mission_id));
CREATE POLICY "interactions_write" ON public.interactions FOR ALL TO authenticated
  USING (public.can_access_mission(mission_id))
  WITH CHECK (public.can_access_mission(mission_id));

-- ===== evidences =====
CREATE TABLE public.evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  interaction_id UUID REFERENCES public.interactions(id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL,
  file_url TEXT,
  drive_url TEXT,
  caption TEXT,
  tags TEXT[],
  captured_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidences TO authenticated;
GRANT ALL ON public.evidences TO service_role;
ALTER TABLE public.evidences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidences_read" ON public.evidences FOR SELECT TO authenticated
  USING (public.can_access_mission(mission_id));
CREATE POLICY "evidences_write" ON public.evidences FOR ALL TO authenticated
  USING (public.can_access_mission(mission_id))
  WITH CHECK (public.can_access_mission(mission_id));

-- ===== change_requests =====
CREATE TABLE public.change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  requestor_id UUID REFERENCES public.profiles(id),
  change_type TEXT,
  description TEXT NOT NULL,
  justification TEXT,
  estimated_impact TEXT,
  affects_deadline BOOLEAN NOT NULL DEFAULT FALSE,
  affects_deliverables BOOLEAN NOT NULL DEFAULT FALSE,
  affects_targets BOOLEAN NOT NULL DEFAULT FALSE,
  affects_evidences BOOLEAN NOT NULL DEFAULT FALSE,
  affects_questionnaire BOOLEAN NOT NULL DEFAULT FALSE,
  status public.change_request_status NOT NULL DEFAULT 'requested',
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.change_requests TO authenticated;
GRANT ALL ON public.change_requests TO service_role;
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cr_read" ON public.change_requests FOR SELECT TO authenticated
  USING (public.can_access_mission(mission_id));
CREATE POLICY "cr_insert" ON public.change_requests FOR INSERT TO authenticated
  WITH CHECK (public.can_access_mission(mission_id));
CREATE POLICY "cr_update_admin" ON public.change_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- ===== reports =====
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  report_type public.report_type NOT NULL,
  target_id UUID REFERENCES public.targets(id) ON DELETE SET NULL,
  content JSONB,
  pdf_url TEXT,
  status public.report_status NOT NULL DEFAULT 'draft',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_read" ON public.reports FOR SELECT TO authenticated
  USING (public.can_access_mission(mission_id));
CREATE POLICY "reports_write" ON public.reports FOR ALL TO authenticated
  USING (public.can_access_mission(mission_id))
  WITH CHECK (public.can_access_mission(mission_id));

-- ===== activity_logs =====
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_read" ON public.activity_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin') OR (mission_id IS NOT NULL AND public.can_access_mission(mission_id)));
CREATE POLICY "logs_insert" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ===== Trigger: auto-create profile on signup =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, organization)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'organization'
  )
  ON CONFLICT (id) DO NOTHING;

  -- default role: analyst (superadmin precisa promover)
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'analyst');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
