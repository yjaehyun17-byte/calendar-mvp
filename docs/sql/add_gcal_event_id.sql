-- Google Calendar event ID를 attendance 레코드에 저장하기 위한 컬럼 추가
ALTER TABLE public.event_attendance
  ADD COLUMN IF NOT EXISTS gcal_event_id text;
