-- Verify final schema matches entity expectations
SELECT 
  'assignments' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema='grading' AND table_name='assignments'
ORDER BY ordinal_position;
