-- Update Submissions Table Schema

-- Convert content from TEXT to JSONB
ALTER TABLE grading.submissions 
ALTER COLUMN content TYPE JSONB USING 
CASE 
  WHEN content IS NULL OR content = '' THEN '{"answers": []}'::jsonb
  ELSE jsonb_build_object(
    'answers', jsonb_build_array(
      jsonb_build_object(
        'questionId', '0',
        'type', 'FILE',
        'answer', content,
        'submittedAt', NOW()
      )
    )
  )
END;

-- Add answer_status column
ALTER TABLE grading.submissions 
ADD COLUMN IF NOT EXISTS answer_status VARCHAR(50) DEFAULT 'submitted'
  CHECK (answer_status IN ('in_progress', 'submitted', 'graded'));

-- Add question_count column
ALTER TABLE grading.submissions 
ADD COLUMN IF NOT EXISTS question_count INTEGER DEFAULT 0;

-- Create JSONB index on content
CREATE INDEX IF NOT EXISTS idx_submissions_content 
ON grading.submissions USING GIN (content);

-- Create index on answer_status
CREATE INDEX IF NOT EXISTS idx_submissions_answer_status 
ON grading.submissions(answer_status);
