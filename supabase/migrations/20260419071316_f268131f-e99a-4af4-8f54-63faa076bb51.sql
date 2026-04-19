CREATE TABLE public.today_quiz_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  quiz_date DATE NOT NULL DEFAULT CURRENT_DATE,
  occasion TEXT NOT NULL,
  style TEXT NOT NULL,
  craving TEXT NOT NULL,
  weather_snapshot JSONB DEFAULT '{}'::jsonb,
  aqi_snapshot JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, quiz_date)
);

ALTER TABLE public.today_quiz_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own quiz answers"
  ON public.today_quiz_answers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own quiz answers"
  ON public.today_quiz_answers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own quiz answers"
  ON public.today_quiz_answers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_today_quiz_answers_updated_at
  BEFORE UPDATE ON public.today_quiz_answers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_today_quiz_answers_user_date ON public.today_quiz_answers(user_id, quiz_date DESC);