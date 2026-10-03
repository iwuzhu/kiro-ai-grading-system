-- Add content column to submissions table
ALTER TABLE grading.submissions
ADD COLUMN content TEXT NULL;

COMMENT ON COLUMN grading.submissions.content IS 'Text submission content (for essays, short answers, etc.)';

-- Verify the column was added
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name='submissions' AND table_schema='grading' 
ORDER BY ordinal_position;
