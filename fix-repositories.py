#!/usr/bin/env python3
import os
import re

# List of repositories to fix
repositories = [
    'backend/src/domain/repositories/audit-log.repository.ts',
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

def get_entity_name(filename):
    """Convert audit-log.repository.ts to AuditLog"""
    base = filename.split('/')[-1].replace('.repository.ts', '')
    parts = base.split('-')
    return ''.join(word.capitalize() for word in parts)

def fix_repository(file_path):
    """Fix a single repository file"""
    entity_name = get_entity_name(file_path)
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix class definition
    content = re.sub(
        r'export class (\w+Repository) extends Repository<\w+> \{\s*constructor\(private dataSource: DataSource\) \{\s*super\(\w+, dataSource\.createEntityManager\(\)\);\s*\}',
        f'''export class \\1 {{
  private repository: Repository<{entity_name}>;

  constructor(private dataSource: DataSource) {{
    this.repository = dataSource.getRepository({entity_name});
  }}

  /**
   * Proxy to underlying repository
   */
  private get repo(): Repository<{entity_name}> {{
    return this.repository;
  }}''',
        content,
        flags=re.DOTALL
    )
    
    # Replace all method calls: this.find -> this.repo.find, etc.
    # Only replace method calls, not other uses
    methods = ['find', 'findOne', 'findAndCount', 'create', 'save', 'count', 'createQueryBuilder']
    for method in methods:
        # Replace this.methodName( with this.repo.methodName(
        content = re.sub(
            r'\bthis\.' + method + r'(\s*\()',
            f'this.repo.{method}\\1',
            content
        )
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✓ Fixed {file_path}")

# Fix all repositories
for repo in repositories:
    if os.path.exists(repo):
        try:
            fix_repository(repo)
        except Exception as e:
            print(f"✗ Error fixing {repo}: {e}")
    else:
        print(f"✗ File not found: {repo}")

print("\nAll repositories fixed!")
