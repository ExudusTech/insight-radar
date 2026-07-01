ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'doubt','observation','status_change','feedback',
  'mission_started','mission_accepted','date_proposal','deadline_alert',
  'status_update','new_evidence','new_comment','report_ready','assignment'
));