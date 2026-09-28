/**
 * Encrypted Field Decorator
 *
 * Marks a TypeORM column as requiring encryption/decryption.
 * Used in conjunction with EncryptionTransformer to automatically encrypt
 * data before saving to the database and decrypt after loading.
 *
 * Usage Example:
 * ```typescript
 * @Entity('users')
 * export class User {
 *   @PrimaryGeneratedColumn('uuid')
 *   id: string;
 *
 *   @Column()
 *   email: string;
 *
 *   @Encrypted()
 *   @Column({ type: 'text' })
 *   passwordHash: string;
 *
 *   @Encrypted()
 *   @Column({ type: 'text', nullable: true })
 *   ssoId: string;
 * }
 * ```
 *
 * How it works:
 * 1. The decorator adds metadata to the column
 * 2. TypeORM transformer (EncryptionTransformer) reads this metadata
 * 3. Before INSERT/UPDATE: plaintext → encrypted (base64)
 * 4. After SELECT: encrypted → plaintext
 * 5. Transparent to application code (services see plaintext)
 */

/**
 * Symbol to store encryption metadata on class properties
 */
export const ENCRYPTED_METADATA_KEY = Symbol('encrypted-field');

/**
 * Decorator to mark a property as encrypted
 *
 * Must be used on TypeORM Entity properties before @Column() decorator.
 * Requires EncryptionTransformer to be configured on the column.
 *
 * @example
 * ```typescript
 * @Encrypted()
 * @Column({ transformer: encryptionTransformer })
 * sensitiveData: string;
 * ```
 */
export function Encrypted() {
  return function (target: any, propertyKey: string | symbol) {
    // Store metadata about this field being encrypted
    const existingMetadata = Reflect.getOwnMetadata(
      ENCRYPTED_METADATA_KEY,
      target,
    ) || [];

    Reflect.defineMetadata(
      ENCRYPTED_METADATA_KEY,
      [...existingMetadata, propertyKey],
      target,
    );
  };
}

/**
 * Helper function to check if a property is marked as encrypted
 *
 * @param target - The entity class or instance
 * @param propertyKey - The property name
 * @returns true if the property is marked with @Encrypted()
 */
export function isPropertyEncrypted(
  target: any,
  propertyKey: string | symbol,
): boolean {
  const metadata = Reflect.getMetadata(ENCRYPTED_METADATA_KEY, target) || [];
  return metadata.includes(propertyKey);
}

/**
 * Helper function to get all encrypted properties of an entity
 *
 * @param target - The entity class or instance
 * @returns Array of property names marked with @Encrypted()
 */
export function getEncryptedProperties(target: any): (string | symbol)[] {
  return Reflect.getMetadata(ENCRYPTED_METADATA_KEY, target) || [];
}
