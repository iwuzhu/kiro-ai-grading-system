-- Check assignments table schema and indices
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE schemaname='grading' AND tablename='assignments' 
ORDER BY indexname;
