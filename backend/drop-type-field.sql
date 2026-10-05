-- Drop the type column from assignments table
ALTER TABLE grading.assignments DROP COLUMN IF EXISTS type;

-- Drop the assignment_type enum if no other tables use it
DROP TYPE IF EXISTS grading.assignment_type CASCADE;

-- Verify the type column is gone
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema='grading' AND table_name='assignments' 
ORDER BY ordinal_position;
