-- Verify assignments table has content JSONB
SELECT 'assignments' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema='grading' AND table_name='assignments' 
AND column_name IN ('content', 'type', 'id')
UNION ALL
-- Verify submissions table has content JSONB
SELECT 'submissions', column_name, data_type 
FROM information_schema.columns 
WHERE table_schema='grading' AND table_name='submissions' 
AND column_name IN ('content', 'answer_status', 'question_count', 'id')
ORDER BY table_name, column_name;
