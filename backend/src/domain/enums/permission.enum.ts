/**
 * Permission Enumeration
 *
 * Fine-grained permissions following the pattern: resource:action
 * Permissions are assigned to roles and validated by the PermissionsGuard
 *
 * Permission Categories:
 * - User Management
 * - Institution Management
 * - Course Management
 * - Assignment Management
 * - Submission Management
 * - Grade Management
 * - Integrity/Plagiarism Management
 */
export enum Permission {
  // User Management Permissions
  USERS_CREATE = 'users:create',
  USERS_READ = 'users:read',
  USERS_UPDATE = 'users:update',
  USERS_DELETE = 'users:delete',
  USERS_BULK_IMPORT = 'users:bulk_import',
  USERS_EXPORT = 'users:export',

  // Institution Management Permissions
  INSTITUTIONS_READ = 'institutions:read',
  INSTITUTIONS_UPDATE = 'institutions:update',
  INSTITUTIONS_DELETE = 'institutions:delete',
  INSTITUTIONS_SETTINGS_MANAGE = 'institutions:settings:manage',

  // Course Management Permissions
  COURSES_CREATE = 'courses:create',
  COURSES_READ = 'courses:read',
  COURSES_UPDATE = 'courses:update',
  COURSES_DELETE = 'courses:delete',
  COURSES_ARCHIVE = 'courses:archive',
  COURSES_VIEW_ANALYTICS = 'courses:view_analytics',
  COURSES_PUBLISH = 'courses:publish',

  // Assignment Management Permissions
  ASSIGNMENTS_CREATE = 'assignments:create',
  ASSIGNMENTS_READ = 'assignments:read',
  ASSIGNMENTS_UPDATE = 'assignments:update',
  ASSIGNMENTS_DELETE = 'assignments:delete',
  ASSIGNMENTS_PUBLISH = 'assignments:publish',
  ASSIGNMENTS_CONFIGURE_RUBRIC = 'assignments:configure_rubric',

  // Submission Management Permissions
  SUBMISSIONS_READ = 'submissions:read',
  SUBMISSIONS_VIEW_OWN = 'submissions:view_own',
  SUBMISSIONS_DOWNLOAD = 'submissions:download',
  SUBMISSIONS_CREATE = 'submissions:create',
  SUBMISSIONS_RESUBMIT = 'submissions:resubmit',

  // Grade Management Permissions
  GRADES_READ = 'grades:read',
  GRADES_VIEW_OWN = 'grades:view_own',
  GRADES_VIEW_ANALYTICS = 'grades:view_analytics',
  GRADES_WRITE = 'grades:write',
  GRADES_OVERRIDE = 'grades:override',
  GRADES_RELEASE = 'grades:release',

  // Plagiarism/Integrity Permissions
  PLAGIARISM_READ = 'plagiarism:read',
  PLAGIARISM_INVESTIGATE = 'plagiarism:investigate',
  PLAGIARISM_FLAG = 'plagiarism:flag',
  PLAGIARISM_SETTINGS_MANAGE = 'plagiarism:settings:manage',
}

/**
 * Role-to-Permissions Mapping
 *
 * Maps each role to its allowed permissions
 * This is the source of truth for RBAC
 */
export const ROLE_PERMISSIONS = {
  admin: [
    // Admins have all permissions
    Permission.USERS_CREATE,
    Permission.USERS_READ,
    Permission.USERS_UPDATE,
    Permission.USERS_DELETE,
    Permission.USERS_BULK_IMPORT,
    Permission.USERS_EXPORT,

    Permission.INSTITUTIONS_READ,
    Permission.INSTITUTIONS_UPDATE,
    Permission.INSTITUTIONS_DELETE,
    Permission.INSTITUTIONS_SETTINGS_MANAGE,

    Permission.COURSES_CREATE,
    Permission.COURSES_READ,
    Permission.COURSES_UPDATE,
    Permission.COURSES_DELETE,
    Permission.COURSES_ARCHIVE,
    Permission.COURSES_VIEW_ANALYTICS,
    Permission.COURSES_PUBLISH,

    Permission.ASSIGNMENTS_CREATE,
    Permission.ASSIGNMENTS_READ,
    Permission.ASSIGNMENTS_UPDATE,
    Permission.ASSIGNMENTS_DELETE,
    Permission.ASSIGNMENTS_PUBLISH,
    Permission.ASSIGNMENTS_CONFIGURE_RUBRIC,

    Permission.SUBMISSIONS_READ,
    Permission.SUBMISSIONS_VIEW_OWN,
    Permission.SUBMISSIONS_DOWNLOAD,
    Permission.SUBMISSIONS_CREATE,
    Permission.SUBMISSIONS_RESUBMIT,

    Permission.GRADES_READ,
    Permission.GRADES_VIEW_OWN,
    Permission.GRADES_VIEW_ANALYTICS,
    Permission.GRADES_WRITE,
    Permission.GRADES_OVERRIDE,
    Permission.GRADES_RELEASE,

    Permission.PLAGIARISM_READ,
    Permission.PLAGIARISM_INVESTIGATE,
    Permission.PLAGIARISM_FLAG,
    Permission.PLAGIARISM_SETTINGS_MANAGE,
  ],

  instructor: [
    // Instructors can manage courses and grades
    Permission.USERS_READ,
    Permission.USERS_EXPORT,

    Permission.INSTITUTIONS_READ,

    Permission.COURSES_CREATE,
    Permission.COURSES_READ,
    Permission.COURSES_UPDATE,
    Permission.COURSES_VIEW_ANALYTICS,
    Permission.COURSES_PUBLISH,

    Permission.ASSIGNMENTS_CREATE,
    Permission.ASSIGNMENTS_READ,
    Permission.ASSIGNMENTS_UPDATE,
    Permission.ASSIGNMENTS_DELETE,
    Permission.ASSIGNMENTS_PUBLISH,
    Permission.ASSIGNMENTS_CONFIGURE_RUBRIC,

    Permission.SUBMISSIONS_READ,
    Permission.SUBMISSIONS_DOWNLOAD,

    Permission.GRADES_READ,
    Permission.GRADES_VIEW_ANALYTICS,
    Permission.GRADES_WRITE,
    Permission.GRADES_OVERRIDE,
    Permission.GRADES_RELEASE,

    Permission.PLAGIARISM_READ,
    Permission.PLAGIARISM_INVESTIGATE,
    Permission.PLAGIARISM_FLAG,
  ],

  student: [
    // Students have read-only access to their own data
    Permission.INSTITUTIONS_READ,

    Permission.COURSES_READ,

    Permission.ASSIGNMENTS_READ,

    Permission.SUBMISSIONS_VIEW_OWN,
    Permission.SUBMISSIONS_CREATE,
    Permission.SUBMISSIONS_RESUBMIT,

    Permission.GRADES_VIEW_OWN,

    Permission.PLAGIARISM_READ,
  ],
};

/**
 * Get all permissions for a role
 * @param role The role to get permissions for
 * @returns Array of permissions for the role
 */
export function getPermissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[role.toLowerCase()] || [];
}

/**
 * Check if a role has a specific permission
 * @param role The role to check
 * @param permission The permission to verify
 * @returns true if the role has the permission
 */
export function roleHasPermission(role: string, permission: Permission): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}
