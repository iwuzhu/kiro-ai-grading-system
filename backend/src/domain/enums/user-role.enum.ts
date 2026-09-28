/**
 * User Role Enumeration
 *
 * Defines the three core roles in the system with hierarchical permissions:
 * - ADMIN: Highest level (manage institutions, all users, override permissions)
 * - INSTRUCTOR: Mid level (create courses, manage students, grade)
 * - STUDENT: Lowest level (view courses, submit assignments, view grades)
 */
export enum UserRole {
  ADMIN = 'admin',
  INSTRUCTOR = 'instructor',
  STUDENT = 'student',
}

/**
 * Role hierarchy for permission inheritance
 * Higher levels have access to lower levels' actions
 */
export const ROLE_HIERARCHY = {
  [UserRole.ADMIN]: [UserRole.ADMIN, UserRole.INSTRUCTOR, UserRole.STUDENT],
  [UserRole.INSTRUCTOR]: [UserRole.INSTRUCTOR, UserRole.STUDENT],
  [UserRole.STUDENT]: [UserRole.STUDENT],
};

/**
 * Convert string to UserRole enum with validation
 */
export function toUserRole(value: string | undefined): UserRole | null {
  if (!value) return null;

  const normalized = value.toLowerCase();
  switch (normalized) {
    case 'admin':
      return UserRole.ADMIN;
    case 'instructor':
      return UserRole.INSTRUCTOR;
    case 'student':
      return UserRole.STUDENT;
    default:
      return null;
  }
}
