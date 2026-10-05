#!/usr/bin/env python3
import os
import re

repositories = [
    'backend/src/domain/repositories/audit-log.repository.ts',
    'backend/src/domain/repositories/assignment.repository.ts',
    'backend/src/domain/repositories/course-enrollment.repository.ts',
    'backend/src/domain/repositories/course.repository.ts',
    'backend/src/domain/repositories/grade-override.repository.ts',
    'backend/src/domain/repositories/grade.repository.ts',
    'backend/src/domain/repositories/institution.repository.ts',
    'backend/src/domain/repositories/plagiarism-flag.repository.ts',
    'backend/src/domain/repositories/plagiarism-result.repository.ts',
    'backend/src/domain/repositories/rubric.repository.ts',
    'backend/src/domain/repositories/user.repository.ts'
]

for repo in repositories:
    if not os.path.exists(repo):
        print(f"✗ File not found: {repo}")
        continue
    
    with open(repo, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove the extra query builder parameter
    content = re.sub(
        r'super\((\w+), dataSource\.manager, dataSource\.createQueryBuilder\(\)\);',
        r'super(\1, dataSource.manager);',
        content
    )
    
    with open(repo, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✓ Fixed {repo}")

print("\nAll repositories fixed!")
