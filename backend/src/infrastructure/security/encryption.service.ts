import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Exception thrown when decryption fails
 */
export class DecryptionException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionException';
  }
}

/**
 * Exception thrown when configuration is invalid
 */
export class ConfigurationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationException';
  }
}

/**
 * Exception thrown when data integrity check fails
 */
export class IntegrityException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrityException';
  }
}

/**
 * EncryptionService provides AES-256-CBC encryption and decryption for sensitive data
 *
 * Algorithm Details:
 * - Algorithm: AES-256-CBC (Cipher Block Chaining)
 * - Key: 32 bytes (256 bits) from ENCRYPTION_KEY env var
 * - IV (Initialization Vector): Random 16 bytes, prepended to ciphertext
 * - Output: Base64-encoded [IV + ciphertext]
 * - HMAC: Optional integrity verification using SHA-256
 *
 * Security Properties:
 * - Confidentiality: AES-256 provides strong encryption
 * - Integrity: HMAC prevents tampering
 * - Key Protection: Key stored in environment (not in code)
 * - Randomness: Each encryption uses a fresh random IV
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private encryptionKey: Buffer;
  private hmacKey: Buffer;
  private readonly algorithm = 'aes-256-cbc';
  private readonly ivLength = 16; // 128 bits for CBC
  private readonly keyLength = 32; // 256 bits
  private readonly hmacAlgorithm = 'sha256';

  constructor(private configService: ConfigService) {
    this.initializeKeys();
  }

  /**
   * Initialize encryption keys from environment variables
   * Throws ConfigurationException if keys are invalid
   */
  private initializeKeys(): void {
    const keyString = this.configService.get<string>('ENCRYPTION_KEY');
    const hmacKeyString = this.configService.get<string>(
      'ENCRYPTION_HMAC_KEY',
      keyString, // Fall back to encryption key if HMAC key not provided
    );

    if (!keyString) {
      throw new ConfigurationException(
        'ENCRYPTION_KEY environment variable is not set',
      );
    }

    if (keyString.length !== 64) {
      throw new ConfigurationException(
        `ENCRYPTION_KEY must be 64 hex characters (32 bytes), got ${keyString.length}`,
      );
    }

    try {
      this.encryptionKey = Buffer.from(keyString, 'hex');
      this.hmacKey = Buffer.from(hmacKeyString, 'hex');

      if (this.encryptionKey.length !== this.keyLength) {
        throw new Error(
          `Key must be exactly ${this.keyLength} bytes, got ${this.encryptionKey.length}`,
        );
      }

      this.logger.debug('Encryption keys initialized successfully');
    } catch (error) {
      throw new ConfigurationException(
        `Invalid ENCRYPTION_KEY format: ${error.message}`,
      );
    }
  }

  /**
   * Encrypt plaintext string using AES-256-CBC
   *
   * Returns Base64-encoded string containing: [IV (16 bytes) + ciphertext + HMAC (optional)]
   *
   * @param plaintext - The string to encrypt
   * @returns Base64-encoded encrypted data
   * @throws ConfigurationException if encryption key is not configured
   */
  encrypt(plaintext: string): string {
    if (!this.encryptionKey) {
      throw new ConfigurationException(
        'Encryption key not initialized. Check ENCRYPTION_KEY environment variable.',
      );
    }

    // Generate random IV
    const iv = crypto.randomBytes(this.ivLength);

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'binary');
    encrypted += cipher.final('binary');

    // Prepend IV to ciphertext
    const encryptedBuffer = Buffer.concat([
      iv,
      Buffer.from(encrypted, 'binary'),
    ]);

    // Calculate HMAC for integrity verification
    const hmac = this.calculateHmac(encryptedBuffer);

    // Combine encrypted data + HMAC and encode as base64
    const combined = Buffer.concat([encryptedBuffer, hmac]);
    return combined.toString('base64');
  }

  /**
   * Decrypt Base64-encoded ciphertext using AES-256-CBC
   *
   * Expected format: Base64-encoded [IV (16 bytes) + ciphertext + HMAC (32 bytes)]
   *
   * @param ciphertext - Base64-encoded encrypted data
   * @returns Decrypted plaintext string
   * @throws DecryptionException if decryption fails
   * @throws IntegrityException if HMAC verification fails
   */
  decrypt(ciphertext: string): string {
    if (!this.encryptionKey) {
      throw new ConfigurationException(
        'Encryption key not initialized. Check ENCRYPTION_KEY environment variable.',
      );
    }

    try {
      // Decode from base64
      const encryptedData = Buffer.from(ciphertext, 'base64');

      // HMAC is last 32 bytes (SHA-256)
      const hmacLength = 32;
      if (encryptedData.length < this.ivLength + hmacLength) {
        throw new Error('Ciphertext too short');
      }

      const encryptedWithIv = encryptedData.slice(
        0,
        encryptedData.length - hmacLength,
      );
      const providedHmac = encryptedData.slice(encryptedData.length - hmacLength);

      // Verify HMAC
      const calculatedHmac = this.calculateHmac(encryptedWithIv);
      if (!this.constantTimeCompare(calculatedHmac, providedHmac)) {
        throw new IntegrityException('HMAC verification failed');
      }

      // Extract IV and ciphertext
      const iv = encryptedWithIv.slice(0, this.ivLength);
      const encrypted = encryptedWithIv.slice(this.ivLength);

      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );

      // Decrypt data
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString('utf8');
    } catch (error) {
      if (error instanceof IntegrityException) {
        throw error;
      }
      throw new DecryptionException(
        `Decryption failed: ${error.message}`,
      );
    }
  }

  /**
   * Serialize an object to JSON, then encrypt it
   *
   * @param obj - The object to encrypt
   * @returns Base64-encoded encrypted JSON
   */
  encryptObject(obj: any): string {
    const json = JSON.stringify(obj);
    return this.encrypt(json);
  }

  /**
   * Decrypt and deserialize a JSON object
   *
   * @param ciphertext - Base64-encoded encrypted JSON
   * @returns Decrypted object
   * @throws DecryptionException if decryption fails
   */
  decryptObject(ciphertext: string): any {
    const json = this.decrypt(ciphertext);
    try {
      return JSON.parse(json);
    } catch (error) {
      throw new DecryptionException(
        `Failed to parse decrypted JSON: ${error.message}`,
      );
    }
  }

  /**
   * Rotate encryption key by re-encrypting data with the new key
   *
   * Important: This should be used in a migration script to re-encrypt all existing data
   * 1. Call this method with old ciphertext and new key
   * 2. It decrypts with current key (old), then encrypts with new key
   * 3. Update the encrypted value in the database
   * 4. After all data is migrated, update ENCRYPTION_KEY environment variable
   *
   * @param ciphertext - Base64-encoded data encrypted with old key
   * @param newKeyHex - New encryption key as 64-character hex string (32 bytes)
   * @returns New ciphertext encrypted with new key
   * @throws ConfigurationException if newKeyHex is invalid
   * @throws DecryptionException if decryption fails
   */
  rotateKey(ciphertext: string, newKeyHex: string): string {
    if (!newKeyHex || newKeyHex.length !== 64) {
      throw new ConfigurationException(
        `New key must be 64 hex characters (32 bytes), got ${newKeyHex.length}`,
      );
    }

    // Decrypt with current key
    const plaintext = this.decrypt(ciphertext);

    // Temporarily switch to new key
    const oldKey = this.encryptionKey;
    try {
      const newKey = Buffer.from(newKeyHex, 'hex');
      if (newKey.length !== this.keyLength) {
        throw new ConfigurationException(
          `New key must be exactly ${this.keyLength} bytes`,
        );
      }

      this.encryptionKey = newKey;

      // Encrypt with new key
      return this.encrypt(plaintext);
    } finally {
      // Restore old key
      this.encryptionKey = oldKey;
    }
  }

  /**
   * Calculate HMAC for integrity verification
   * Uses SHA-256 hash of the data
   */
  private calculateHmac(data: Buffer): Buffer {
    const hmac = crypto.createHmac(this.hmacAlgorithm, this.hmacKey);
    hmac.update(data);
    return hmac.digest();
  }

  /**
   * Constant-time comparison to prevent timing attacks
   * Compares two buffers without early exit
   */
  private constantTimeCompare(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }

    return result === 0;
  }

  /**
   * Generate a random encryption key (for initialization/testing)
   * Returns 64-character hex string representing 32 bytes
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
