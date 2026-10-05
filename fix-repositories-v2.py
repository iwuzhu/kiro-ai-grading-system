#!/usr/bin/env python3
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

# Methods that need to be proxied
proxy_methods = [
    'find',
    'findOne',
    'findAndCount',
    'create',
    'save',
    'count',
    'createQueryBuilder',
    'delete',
]

delegation_template = '''
  // Repository method delegations for backwards compatibility
  {methods}
'''

def generate_delegation_methods(entity_name):
    """Generate delegation methods for TypeORM repository methods"""
    methods = []
    
    methods.append(f'''
  /**
   * Delegate to underlying repository
   */
  find(options?: any): Promise<{entity_name}[]> {{
    return this.repo.find(options);
  }}

  findOne(options?: any): Promise<{entity_name} | null> {{
    return this.repo.findOne(options);
  }}

  findAndCount(options?: any): Promise<[{entity_name}[], number]> {{
    return this.repo.findAndCount(options);
  }}

  create(plainObject?: any): {entity_name} {{
    return this.repo.create(plainObject);
  }}

  save(entity: {entity_name} | {entity_name}[], options?: any): Promise<{entity_name} | {entity_name}[]> {{
    return this.repo.save(entity as any, options);
  }}

  count(options?: any): Promise<number> {{
    return this.repo.count(options);
  }}

  createQueryBuilder(alias?: string): any {{
    return this.repo.createQueryBuilder(alias);
  }}

  delete(criteria?: any): Promise<any> {{
    return this.repo.delete(criteria);
  }}''')
    
    return ''.join(methods)

def get_entity_name(filename):
    """Convert audit-log.repository.ts to AuditLog"""
    base = filename.split('/')[-1].replace('.repository.ts', '')
    parts = base.split('-')
    return ''.join(word.capitalize() for word in parts)

def fix_repository_v2(file_path):
    """Add delegation methods to repository"""
    entity_name = get_entity_name(file_path)
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the last closing brace (end of class)
    last_brace = content.rfind('}')
    if last_brace == -1:
        print(f"✗ Could not find class closing brace in {file_path}")
        return
    
    # Generate delegation methods
    delegation = generate_delegation_methods(entity_name)
    
    # Insert delegation methods before the closing brace
    content = content[:last_brace] + delegation + '\n' + content[last_brace:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✓ Added delegation methods to {file_path}")

# Fix all repositories
for repo in repositories:
    try:
        fix_repository_v2(repo)
    except Exception as e:
        print(f"✗ Error fixing {repo}: {e}")

print("\nAll repositories enhanced with delegation methods!")
