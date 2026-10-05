SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema='grading' AND table_name='assignments' 
ORDER BY ordinal_position;
