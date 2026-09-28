import { ValueTransformer } from 'typeorm';
import { EncryptionService } from './encryption.service';

/**
 * TypeORM Value Transformer for automatic encryption/decryption
 *
 * This transformer is used in TypeORM @Column() decorators to automatically
 * encrypt data before saving and decrypt after loading.
 *
 * Usage in Entity:
 * ```typescript
 * const encryptionTransformer = new EncryptionTransformer(encryptionService);
 *
 * @Entity('users')
 * export class User {
 *   @Column({
 *     transformer: encryptionTransformer,
 *     type: 'text'
 *   })
 *   sensitiveField: string;
 * }
 * ```
 *
 * How it works:
 * - to(value): Called before saving to database (plaintext → encrypted)
 * - from(value): Called after loading from database (encrypted → plaintext)
 *
 * Performance: ~1-5ms per field depending on data size
 */
export class EncryptionTransformer implements ValueTransformer {
  constructor(private encryptionService: EncryptionService) {}

  /**
   * Called before saving to database
   * Converts plaintext to encrypted base64
   *
   * @param value - The plaintext value from the application
   * @returns Encrypted base64 string to store in database
   */
  to(value: any): any {
    if (value === null || value === undefined || value === '') {
      return value; // Preserve null/undefined/empty values
    }

    try {
      if (typeof value === 'string') {
        return this.encryptionService.encrypt(value);
      } else if (typeof value === 'object') {
        return this.encryptionService.encryptObject(value);
      } else {
        // Convert other types to string before encryption
        return this.encryptionService.encrypt(String(value));
      }
    } catch (error) {
      throw new Error(
        `Encryption failed: ${error.message}`,
      );
    }
  }

  /**
   * Called after loading from database
   * Converts encrypted base64 to plaintext
   *
   * @param value - The encrypted base64 value from the database
   * @returns Decrypted plaintext string
   */
  from(value: any): any {
    if (value === null || value === undefined || value === '') {
      return value; // Preserve null/undefined/empty values
    }

    try {
      if (typeof value === 'string') {
        return this.encryptionService.decrypt(value);
      } else {
        // Handle cases where database returns buffer or other types
        const stringValue = value.toString();
        return this.encryptionService.decrypt(stringValue);
      }
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error.message}`,
      );
    }
  }
}

/**
 * Factory function to create an EncryptionTransformer instance
 *
 * @param encryptionService - The EncryptionService instance
 * @returns A configured EncryptionTransformer
 */
export function createEncryptionTransformer(
  encryptionService: EncryptionService,
): EncryptionTransformer {
  return new EncryptionTransformer(encryptionService);
}
