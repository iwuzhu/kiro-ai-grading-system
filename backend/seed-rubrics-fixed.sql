-- Seed test data: Sample rubrics for assignments
-- This script creates rubrics for assignments that don't have them
-- Fixed to use correct institution ID

SET app.current_tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- ============================================================================
-- 1. CODE ASSIGNMENT RUBRIC
-- ============================================================================

INSERT INTO grading.rubrics (
  id,
  tenant_id,
  institution_id,
  name,
  description,
  criteria,
  is_template,
  created_by_user_id,
  created_at,
  updated_at
) VALUES
(
  '823e4567-e89b-12d3-a456-426614174100',
  '550e8400-e29b-41d4-a716-446655440000',
  '08ae0aaa-ff14-40a4-beb0-7e857ac2bf2d',
  'Code Quality Rubric',
  'Evaluates code quality, functionality, and best practices',
  '[
    {
      "id": "criterion-1",
      "name": "Functionality",
      "description": "Does the code work correctly and produce expected output?",
      "points": 25,
      "levels": [
        {
          "name": "Exceptional",
          "points": 25,
          "description": "Code runs perfectly with no errors. Output is correct in all test cases."
        },
        {
          "name": "Proficient",
          "points": 20,
          "description": "Code works correctly for most test cases. Minor issues that don''t affect core functionality."
        },
        {
          "name": "Developing",
          "points": 15,
          "description": "Code has some functionality but fails on several test cases."
        },
        {
          "name": "Beginning",
          "points": 10,
          "description": "Code is incomplete or produces incorrect output on most test cases."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "Code does not work or is missing."
        }
      ]
    },
    {
      "id": "criterion-2",
      "name": "Code Style & Readability",
      "description": "Is the code well-organized, properly formatted, and easy to understand?",
      "points": 15,
      "levels": [
        {
          "name": "Exceptional",
          "points": 15,
          "description": "Code is well-formatted with consistent style, meaningful variable names, and proper indentation."
        },
        {
          "name": "Proficient",
          "points": 12,
          "description": "Code is generally well-formatted with mostly meaningful names and good structure."
        },
        {
          "name": "Developing",
          "points": 8,
          "description": "Code has some style issues. Some confusing variable names or inconsistent formatting."
        },
        {
          "name": "Beginning",
          "points": 4,
          "description": "Code is poorly formatted with unclear variable names and inconsistent style."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "Code is unreadable or missing."
        }
      ]
    },
    {
      "id": "criterion-3",
      "name": "Comments & Documentation",
      "description": "Are there adequate comments explaining the code logic?",
      "points": 10,
      "levels": [
        {
          "name": "Exceptional",
          "points": 10,
          "description": "Clear, helpful comments throughout. Complex logic is well-explained."
        },
        {
          "name": "Proficient",
          "points": 8,
          "description": "Good comments on most sections. Explanations are mostly clear."
        },
        {
          "name": "Developing",
          "points": 5,
          "description": "Some comments present but could be more thorough or clear."
        },
        {
          "name": "Beginning",
          "points": 2,
          "description": "Minimal comments or unclear explanations."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "No comments or documentation."
        }
      ]
    }
  ]',
  true,
  (SELECT id FROM grading.users WHERE email = 'testinstructor@test.com' LIMIT 1),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. ESSAY ASSIGNMENT RUBRIC
-- ============================================================================

INSERT INTO grading.rubrics (
  id,
  tenant_id,
  institution_id,
  name,
  description,
  criteria,
  is_template,
  created_by_user_id,
  created_at,
  updated_at
) VALUES
(
  '823e4567-e89b-12d3-a456-426614174101',
  '550e8400-e29b-41d4-a716-446655440000',
  '08ae0aaa-ff14-40a4-beb0-7e857ac2bf2d',
  'Essay Writing Rubric',
  'Evaluates essays on clarity, organization, evidence, and mechanics',
  '[
    {
      "id": "criterion-1",
      "name": "Thesis Clarity",
      "description": "Is the thesis clear and compelling?",
      "points": 20,
      "levels": [
        {
          "name": "Exceptional",
          "points": 20,
          "description": "Clear, compelling thesis that directly addresses the prompt and guides the essay."
        },
        {
          "name": "Proficient",
          "points": 16,
          "description": "Clear thesis that addresses the prompt, though could be more specific."
        },
        {
          "name": "Developing",
          "points": 12,
          "description": "Thesis is present but somewhat unclear or doesn''t fully address the prompt."
        },
        {
          "name": "Beginning",
          "points": 8,
          "description": "Weak or missing thesis statement."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "No thesis or completely unclear."
        }
      ]
    },
    {
      "id": "criterion-2",
      "name": "Organization & Structure",
      "description": "Is the essay well-organized with clear transitions?",
      "points": 20,
      "levels": [
        {
          "name": "Exceptional",
          "points": 20,
          "description": "Excellent organization with clear introduction, body, and conclusion. Smooth transitions between paragraphs."
        },
        {
          "name": "Proficient",
          "points": 16,
          "description": "Well-organized with clear structure. Most transitions are smooth and logical."
        },
        {
          "name": "Developing",
          "points": 12,
          "description": "Generally organized but some transitions are unclear or abrupt."
        },
        {
          "name": "Beginning",
          "points": 8,
          "description": "Poor organization with weak transitions and unclear flow."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "Disorganized or incomprehensible structure."
        }
      ]
    },
    {
      "id": "criterion-3",
      "name": "Evidence & Support",
      "description": "Are claims supported by credible evidence and examples?",
      "points": 30,
      "levels": [
        {
          "name": "Exceptional",
          "points": 30,
          "description": "Claims are well-supported with relevant, credible evidence and insightful examples."
        },
        {
          "name": "Proficient",
          "points": 24,
          "description": "Good use of evidence and examples to support most claims."
        },
        {
          "name": "Developing",
          "points": 18,
          "description": "Some evidence present but may be limited or need better integration."
        },
        {
          "name": "Beginning",
          "points": 12,
          "description": "Little evidence or examples. Claims lack support."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "No supporting evidence or examples."
        }
      ]
    },
    {
      "id": "criterion-4",
      "name": "Grammar & Mechanics",
      "description": "Are grammar, spelling, and punctuation correct?",
      "points": 20,
      "levels": [
        {
          "name": "Exceptional",
          "points": 20,
          "description": "No significant grammar, spelling, or punctuation errors."
        },
        {
          "name": "Proficient",
          "points": 16,
          "description": "Few minor errors that don''t significantly impede readability."
        },
        {
          "name": "Developing",
          "points": 12,
          "description": "Several errors that occasionally impact readability."
        },
        {
          "name": "Beginning",
          "points": 8,
          "description": "Frequent errors that impede understanding."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "Numerous errors that significantly impede readability."
        }
      ]
    }
  ]',
  true,
  (SELECT id FROM grading.users WHERE email = 'testinstructor@test.com' LIMIT 1),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. MATH PROBLEM SET RUBRIC
-- ============================================================================

INSERT INTO grading.rubrics (
  id,
  tenant_id,
  institution_id,
  name,
  description,
  criteria,
  is_template,
  created_by_user_id,
  created_at,
  updated_at
) VALUES
(
  '823e4567-e89b-12d3-a456-426614174102',
  '550e8400-e29b-41d4-a716-446655440000',
  '08ae0aaa-ff14-40a4-beb0-7e857ac2bf2d',
  'Math Problem Set Rubric',
  'Evaluates mathematical problem-solving on correctness and methodology',
  '[
    {
      "id": "criterion-1",
      "name": "Correct Answers",
      "description": "Are the final answers correct?",
      "points": 40,
      "levels": [
        {
          "name": "Exceptional",
          "points": 40,
          "description": "95-100% of answers are correct."
        },
        {
          "name": "Proficient",
          "points": 32,
          "description": "85-94% of answers are correct."
        },
        {
          "name": "Developing",
          "points": 24,
          "description": "70-84% of answers are correct."
        },
        {
          "name": "Beginning",
          "points": 12,
          "description": "50-69% of answers are correct."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "Less than 50% of answers are correct."
        }
      ]
    },
    {
      "id": "criterion-2",
      "name": "Mathematical Process & Methodology",
      "description": "Is the mathematical reasoning and process clear and correct?",
      "points": 25,
      "levels": [
        {
          "name": "Exceptional",
          "points": 25,
          "description": "Clear, logical mathematical processes. All steps are shown and correct."
        },
        {
          "name": "Proficient",
          "points": 20,
          "description": "Generally clear process with most steps shown correctly."
        },
        {
          "name": "Developing",
          "points": 15,
          "description": "Some steps shown but process may be unclear or have minor errors."
        },
        {
          "name": "Beginning",
          "points": 8,
          "description": "Process is difficult to follow or has significant errors."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "Work is not shown or process is incomprehensible."
        }
      ]
    },
    {
      "id": "criterion-3",
      "name": "Presentation & Organization",
      "description": "Is the work neat, organized, and easy to follow?",
      "points": 10,
      "levels": [
        {
          "name": "Exceptional",
          "points": 10,
          "description": "Neat, well-organized presentation. Easy to follow."
        },
        {
          "name": "Proficient",
          "points": 8,
          "description": "Generally neat and well-organized."
        },
        {
          "name": "Developing",
          "points": 6,
          "description": "Somewhat messy or disorganized but still followable."
        },
        {
          "name": "Beginning",
          "points": 3,
          "description": "Messy and difficult to follow."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "Very disorganized or unreadable."
        }
      ]
    }
  ]',
  true,
  (SELECT id FROM grading.users WHERE email = 'testinstructor@test.com' LIMIT 1),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. LINK RUBRICS TO ASSIGNMENTS THAT DON'T HAVE THEM
-- ============================================================================

-- Link Code Quality Rubric to assignments without rubrics
UPDATE grading.assignments 
SET rubric_id = '823e4567-e89b-12d3-a456-426614174100'
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000' 
AND rubric_id IS NULL
AND title LIKE '%Assignment%'
AND (type = 'CODE' OR id IN (SELECT id FROM grading.assignments WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000' AND type IS NULL LIMIT 4));

-- Link Essay Rubric to essay-type assignments
UPDATE grading.assignments 
SET rubric_id = '823e4567-e89b-12d3-a456-426614174101'
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000' 
AND rubric_id IS NULL
AND (type = 'ESSAY' OR title LIKE '%Essay%');

-- Link Math Rubric to remaining assignments without rubrics
UPDATE grading.assignments 
SET rubric_id = '823e4567-e89b-12d3-a456-426614174102'
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000' 
AND rubric_id IS NULL;

-- ============================================================================
-- 5. VERIFY DATA WAS INSERTED
-- ============================================================================

SELECT 'Rubrics created:' as message;
SELECT id, name, is_template FROM grading.rubrics WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000';

SELECT 'Assignments with rubrics:' as message;
SELECT id, title, rubric_id FROM grading.assignments WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000' AND rubric_id IS NOT NULL;
