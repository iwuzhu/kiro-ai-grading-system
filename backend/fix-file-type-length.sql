-- Fix for PostgreSQL error 22001: string data right truncation
-- The file_type column (VARCHAR(50)) is too small for MIME types
-- MIME type example: application/vnd.openxmlformats-officedocument.wordprocessingml.document = 73 chars

-- Increase file_type column length from 50 to 255
ALTER TABLE grading.submissions
ALTER COLUMN file_type TYPE VARCHAR(255);

-- Verify the change
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'grading'
  AND table_name = 'submissions'
  AND column_name = 'file_type';

-- Confirmation
-- \echo 'File type column successfully updated to VARCHAR(255)'
