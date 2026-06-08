-- Seed degli esercizi predefiniti (user_id è NULL così sono visibili a tutti)

INSERT INTO exercises (name, muscle_group, equipment, is_custom) VALUES
  ('Panca piana', 'Petto', 'Bilanciere', false),
  ('Panca inclinata', 'Petto', 'Manubri', false),
  ('Croci cavi', 'Petto', 'Cavi', false),
  ('Shoulder press', 'Spalle', 'Manubri', false),
  ('Alzate laterali', 'Spalle', 'Manubri', false),
  ('Trazioni', 'Schiena', 'Corpo libero', false),
  ('Rematore bilanciere', 'Schiena', 'Bilanciere', false),
  ('Lat machine', 'Schiena', 'Macchina', false),
  ('Squat', 'Gambe', 'Bilanciere', false),
  ('Leg press', 'Gambe', 'Macchina', false),
  ('Romanian deadlift', 'Gambe', 'Bilanciere', false),
  ('Curl bilanciere', 'Bicipiti', 'Bilanciere', false),
  ('Tricep pushdown', 'Tricipiti', 'Cavi', false),
  ('Plank', 'Core', 'Corpo libero', false);
