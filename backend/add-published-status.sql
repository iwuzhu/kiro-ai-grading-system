-- Add published_status column to assignments table
ALTER TABLE grading.assignments 
ADD COLUMN IF NOT EXISTS published_status VARCHAR(50) DEFAULT 'draft' NOT NULL;

-- Create index on published_status for filtering
CREATE INDEX IF NOT EXISTS idx_assignments_published_status 
ON grading.assignments(published_status);

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema='grading' AND table_name='assignments' 
ORDER BY ordinal_position;
