-- Update "Standard Programming Rubric" with comprehensive criteria

UPDATE grading.rubrics
SET 
  description = 'Comprehensive rubric for evaluating programming assignments on functionality, code quality, testing, and documentation',
  criteria = '[
    {
      "id": "criterion-1",
      "name": "Program Functionality & Correctness",
      "description": "Does the program execute without errors and produce correct output for all test cases?",
      "points": 30,
      "levels": [
        {
          "name": "Exceptional",
          "points": 30,
          "description": "Program runs perfectly. All test cases pass. Output is correct and complete. Handles edge cases appropriately."
        },
        {
          "name": "Proficient",
          "points": 24,
          "description": "Program works correctly for most test cases. Minor issues that don''t affect primary functionality. Handles most edge cases."
        },
        {
          "name": "Developing",
          "points": 18,
          "description": "Program works but fails on several test cases. Some edge cases not handled. Output is mostly correct but incomplete."
        },
        {
          "name": "Beginning",
          "points": 12,
          "description": "Program has significant issues. Fails on many test cases. Limited edge case handling. Output frequently incorrect."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "Program does not work. Crashes on test input or produces no output."
        }
      ]
    },
    {
      "id": "criterion-2",
      "name": "Code Style, Organization & Readability",
      "description": "Is the code well-structured, properly formatted, and easy to understand?",
      "points": 20,
      "levels": [
        {
          "name": "Exceptional",
          "points": 20,
          "description": "Excellent organization with logical structure. Consistent naming conventions (camelCase, snake_case). Proper indentation. Functions/methods well-defined with single responsibilities. DRY principle followed."
        },
        {
          "name": "Proficient",
          "points": 16,
          "description": "Good organization and structure. Mostly consistent naming. Good indentation. Functions are generally well-defined. Minimal code duplication."
        },
        {
          "name": "Developing",
          "points": 12,
          "description": "Adequate structure but some organizational issues. Inconsistent naming in places. Some indentation problems. Some functions could be better defined. Some code duplication."
        },
        {
          "name": "Beginning",
          "points": 8,
          "description": "Poor organization. Inconsistent naming throughout. Inconsistent indentation. Functions not well-defined. Significant code duplication."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "Code is disorganized and difficult to follow. No clear structure or naming conventions."
        }
      ]
    },
    {
      "id": "criterion-3",
      "name": "Comments & Documentation",
      "description": "Are there clear comments and documentation explaining the code''s logic and purpose?",
      "points": 15,
      "levels": [
        {
          "name": "Exceptional",
          "points": 15,
          "description": "Comprehensive comments explaining all major logic. Function/method documentation with purpose, parameters, and return values. Complex algorithms explained clearly. README or usage instructions if applicable."
        },
        {
          "name": "Proficient",
          "points": 12,
          "description": "Good comments on most functions and complex sections. Function documentation present. Most logic is explained. Clear enough for another developer to understand."
        },
        {
          "name": "Developing",
          "points": 9,
          "description": "Some comments present but missing in key areas. Partial function documentation. Some complex sections unexplained. Could be clearer."
        },
        {
          "name": "Beginning",
          "points": 5,
          "description": "Minimal comments. Little or no function documentation. Complex logic unexplained. Difficult for others to understand code."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "No comments or documentation. Code purpose is unclear."
        }
      ]
    },
    {
      "id": "criterion-4",
      "name": "Use of Data Structures & Algorithms",
      "description": "Are appropriate data structures and algorithms used efficiently?",
      "points": 15,
      "levels": [
        {
          "name": "Exceptional",
          "points": 15,
          "description": "Excellent choice of data structures (lists, maps, sets, trees) for the problem. Algorithms are efficient with appropriate time/space complexity. No unnecessary iterations or computations."
        },
        {
          "name": "Proficient",
          "points": 12,
          "description": "Good data structure choices. Algorithms are reasonably efficient. Minor optimization opportunities missed but code works well."
        },
        {
          "name": "Developing",
          "points": 9,
          "description": "Adequate data structures but could be better optimized. Algorithms work but have efficiency issues. Some unnecessary operations."
        },
        {
          "name": "Beginning",
          "points": 5,
          "description": "Poor data structure choices. Inefficient algorithms. Unnecessary nested loops or redundant operations."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "Inappropriate data structures. Severely inefficient algorithms or approach."
        }
      ]
    },
    {
      "id": "criterion-5",
      "name": "Error Handling & Robustness",
      "description": "Does the code handle errors gracefully and handle invalid input appropriately?",
      "points": 10,
      "levels": [
        {
          "name": "Exceptional",
          "points": 10,
          "description": "Comprehensive error handling with try-catch blocks. Input validation for all user inputs. Graceful handling of edge cases and null values. Meaningful error messages."
        },
        {
          "name": "Proficient",
          "points": 8,
          "description": "Good error handling for most cases. Input validation present. Handles most edge cases. Clear error messages."
        },
        {
          "name": "Developing",
          "points": 6,
          "description": "Some error handling present but incomplete. Limited input validation. Some edge cases not handled. Error messages could be clearer."
        },
        {
          "name": "Beginning",
          "points": 3,
          "description": "Minimal error handling. Little input validation. Crashes on invalid input. Poor error messages."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "No error handling. Program crashes on any invalid input or edge case."
        }
      ]
    },
    {
      "id": "criterion-6",
      "name": "Testing & Verification",
      "description": "Has the program been tested thoroughly? Are there test cases or evidence of testing?",
      "points": 10,
      "levels": [
        {
          "name": "Exceptional",
          "points": 10,
          "description": "Comprehensive test coverage including unit tests, integration tests, and edge cases. Test results documented. All tests pass. Test-driven development approach evident."
        },
        {
          "name": "Proficient",
          "points": 8,
          "description": "Good test coverage with multiple test cases. Most edge cases tested. Test results documented and passing."
        },
        {
          "name": "Developing",
          "points": 6,
          "description": "Some testing evident. Basic test cases present but incomplete coverage. Some edge cases untested."
        },
        {
          "name": "Beginning",
          "points": 3,
          "description": "Minimal testing. Only tested with happy path. No edge case testing."
        },
        {
          "name": "Insufficient",
          "points": 0,
          "description": "No evidence of testing. Untested code."
        }
      ]
    }
  ]',
  updated_at = CURRENT_TIMESTAMP
WHERE name = 'Standard Programming Rubric'
AND tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- Verify update
SELECT id, name, description FROM grading.rubrics WHERE name = 'Standard Programming Rubric';
