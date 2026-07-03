
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_view_strategic boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.strategic_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  content text,
  order_index integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategic_documents TO authenticated;
GRANT ALL ON public.strategic_documents TO service_role;

ALTER TABLE public.strategic_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Strategic viewers can read published docs"
  ON public.strategic_documents FOR SELECT
  TO authenticated
  USING (
    is_published = true
    AND (
      public.has_role(auth.uid(), 'superadmin')
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.can_view_strategic = true)
    )
  );

CREATE POLICY "Superadmin can read all strategic docs"
  ON public.strategic_documents FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin can insert strategic docs"
  ON public.strategic_documents FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin can update strategic docs"
  ON public.strategic_documents FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin can delete strategic docs"
  ON public.strategic_documents FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER strategic_documents_set_updated_at
  BEFORE UPDATE ON public.strategic_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.strategic_documents (title, content, order_index, is_published)
VALUES ('O Sistema', NULL, 1, false)
ON CONFLICT DO NOTHING;
