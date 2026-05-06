-- Create custom types for workout sets
CREATE TYPE set_type AS ENUM ('normal', 'warmup', 'dropset', 'failure');

-- Tabella exercises
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users, -- null = predefinito globale
    name TEXT NOT NULL,
    muscle_group TEXT,
    equipment TEXT,
    is_custom BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabella workout_templates
CREATE TABLE workout_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    name TEXT NOT NULL,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabella template_exercises
CREATE TABLE template_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES workout_templates ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises,
    exercise_name TEXT,
    default_sets INTEGER DEFAULT 3,
    default_reps INTEGER DEFAULT 8,
    default_weight NUMERIC DEFAULT 0,
    default_rest_seconds INTEGER DEFAULT 90,
    "order" INTEGER DEFAULT 0
);

-- Tabella workout_sessions
CREATE TABLE workout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    template_id UUID, -- null per workout libero
    template_name TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    duration_seconds INTEGER DEFAULT 0
);

-- Tabella exercise_logs
CREATE TABLE exercise_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES workout_sessions ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises,
    exercise_name TEXT,
    rest_seconds INTEGER DEFAULT 90,
    "order" INTEGER DEFAULT 0
);

-- Tabella workout_sets
CREATE TABLE workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_log_id UUID REFERENCES exercise_logs ON DELETE CASCADE,
    weight NUMERIC DEFAULT 0,
    reps INTEGER DEFAULT 0,
    set_type set_type DEFAULT 'normal',
    is_completed BOOLEAN DEFAULT false,
    "order" INTEGER DEFAULT 0
);

-- Configurazione RLS (Row Level Security)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

-- Policy per exercises
CREATE POLICY "Exercises visibili a tutti se globali o al creatore" ON exercises FOR SELECT
    USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Gli utenti possono inserire i propri esercizi" ON exercises FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Gli utenti possono modificare i propri esercizi" ON exercises FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Gli utenti possono eliminare i propri esercizi" ON exercises FOR DELETE
    USING (auth.uid() = user_id);

-- Policy per workout_templates
CREATE POLICY "I template sono isolati per utente" ON workout_templates FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policy per template_exercises
CREATE POLICY "I template_exercises seguono il template" ON template_exercises FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM workout_templates 
            WHERE workout_templates.id = template_exercises.template_id 
            AND workout_templates.user_id = auth.uid()
        )
    );

-- Policy per workout_sessions
CREATE POLICY "Le sessioni sono isolate per utente" ON workout_sessions FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policy per exercise_logs
CREATE POLICY "Gli exercise_logs seguono la sessione" ON exercise_logs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM workout_sessions 
            WHERE workout_sessions.id = exercise_logs.session_id 
            AND workout_sessions.user_id = auth.uid()
        )
    );

-- Policy per workout_sets
CREATE POLICY "I workout_sets seguono il log" ON workout_sets FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM exercise_logs 
            JOIN workout_sessions ON workout_sessions.id = exercise_logs.session_id
            WHERE exercise_logs.id = workout_sets.exercise_log_id 
            AND workout_sessions.user_id = auth.uid()
        )
    );
