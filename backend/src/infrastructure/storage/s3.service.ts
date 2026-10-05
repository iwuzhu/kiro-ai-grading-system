import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

/**
 * S3 File Handling Service (Task 3.2)
 *
 * Manages file operations for submission uploads and downloads:
 * - Upload files to AWS S3 storage at s3://tecbridge-general/websites/externals/deepgrader/
 * - Validate file types and sizes
 * - Generate signed URLs for secure access
 * - Support multi-file submissions
 *
 * Supported File Types:
 * - Documents: pdf, docx, xlsx, txt, md
 * - Code: py, js, ts, java, cpp, c, cs, go, rb, php, swift
 *
 * Requirements Met:
 * ✓ 3.2: File Handling Service / S3 Integration
 * ✓ 14: Multi-Format File Support for Submissions
 * ✓ Files saved to s3://tecbridge-general/websites/externals/deepgrader/
 */
@Injectable()
export class S3Service {
  private readonly maxFileSize: number;
  private readonly maxZipSize: number;
  private readonly allowedFileTypes: Set<string>;
  private readonly allowedCodeLanguages: Set<string>;
  private readonly s3Client: S3Client;
  private readonly s3Bucket: string;
  private readonly s3Region: string;

  constructor(private configService: ConfigService) {
    // Configuration
    this.maxFileSize = 10 * 1024 * 1024; // 10 MB
    this.maxZipSize = 50 * 1024 * 1024; // 50 MB for ZIP archives
    this.s3Bucket = this.configService.get('AWS_S3_BUCKET', 'tecbridge-general');
    this.s3Region = this.configService.get('AWS_REGION', 'us-east-1');

    // Initialize AWS S3 Client
    this.s3Client = new S3Client({ region: this.s3Region });

    // Supported file types
    this.allowedFileTypes = new Set([
      // Documents
      'pdf',
      'docx',
      'xlsx',
      'txt',
      'md',
      // Code files
      'py',
      'js',
      'ts',
      'java',
      'cpp',
      'c',
      'cs',
      'go',
      'rb',
      'php',
      'swift',
      'kt',
      'rs',
      'scala',
      // Archives
      'zip',
    ]);

    this.allowedCodeLanguages = new Set([
      'py',
      'js',
      'ts',
      'java',
      'cpp',
      'c',
      'cs',
      'go',
      'rb',
      'php',
      'swift',
      'kt',
      'rs',
      'scala',
    ]);
  }

  /**
   * Validate file type
   * @param fileName - File name with extension
   * @returns true if valid, throws BadRequestException otherwise
   */
  validateFileType(fileName: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    if (!this.allowedFileTypes.has(ext)) {
      throw new BadRequestException(
        `File type '.${ext}' is not supported. Allowed types: ${Array.from(this.allowedFileTypes).join(', ')}`,
      );
    }

    return true;
  }

  /**
   * Validate file size
   * @param fileSize - Size in bytes
   * @param isZip - Whether this is a ZIP archive
   * @returns true if valid, throws BadRequestException otherwise
   */
  validateFileSize(fileSize: number, isZip: boolean = false): boolean {
    const maxSize = isZip ? this.maxZipSize : this.maxFileSize;
    const maxSizeMB = maxSize / (1024 * 1024);

    if (fileSize > maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${maxSizeMB}MB`,
      );
    }

    return true;
  }

  /**
   * Upload a file to AWS S3
   *
   * @param tenantId - Tenant ID for organization
   * @param assignmentId - Assignment ID for organization
   * @param studentId - Student ID for organization
   * @param fileName - Original file name
   * @param fileBuffer - File content as buffer
   * @returns S3 URI (s3://tecbridge-general/websites/externals/deepgrader/...)
   */
  async uploadFile(
    tenantId: string,
    assignmentId: string,
    studentId: string,
    fileName: string,
    fileBuffer: Buffer,
  ): Promise<string> {
    // Validate file first
    this.validateFileType(fileName);
    this.validateFileSize(fileBuffer.length);

    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // S3 key path: websites/externals/deepgrader/[tenant]/[assignment]/[student]/[timestamp]-[filename]
    const s3Key = `websites/externals/deepgrader/${tenantId}/${assignmentId}/${studentId}/${timestamp}-${sanitizedFileName}`;
    
    // Full S3 URI for return
    const s3Uri = `s3://${this.s3Bucket}/${s3Key}`;

    try {
      console.log('[S3Service.uploadFile] Uploading to AWS S3:', {
        bucket: this.s3Bucket,
        key: s3Key,
        size: fileBuffer.length,
        fileName,
      });

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: this.getMimeType(fileName),
      });

      const result = await this.s3Client.send(command);
      
      console.log('[S3Service.uploadFile] Upload successful:', {
        uri: s3Uri,
        etag: result.ETag,
      });

      return s3Uri;
    } catch (error) {
      console.error('[S3Service.uploadFile] Upload failed:', error);
      throw new InternalServerErrorException(
        `Failed to upload file to S3: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(fileName: string): string {
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'py': 'text/plain',
      'js': 'text/javascript',
      'ts': 'text/typescript',
      'java': 'text/plain',
      'cpp': 'text/plain',
      'c': 'text/plain',
      'cs': 'text/plain',
      'go': 'text/plain',
      'rb': 'text/plain',
      'php': 'text/plain',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Download file from AWS S3
   *
   * @param s3Path - S3 path to file (s3://bucket/key)
   * @returns File buffer
   */
  async downloadFile(s3Path: string): Promise<Buffer> {
    try {
      console.log('[S3Service.downloadFile] Downloading from S3:', s3Path);

      // Parse S3 path: s3://bucket/key
      const s3Prefix = 's3://';
      if (!s3Path.startsWith(s3Prefix)) {
        throw new BadRequestException('Invalid S3 path format');
      }

      const afterPrefix = s3Path.substring(s3Prefix.length);
      const firstSlashIndex = afterPrefix.indexOf('/');
      if (firstSlashIndex === -1) {
        throw new BadRequestException('Invalid S3 path format - no key after bucket');
      }

      const bucket = afterPrefix.substring(0, firstSlashIndex);
      const key = afterPrefix.substring(firstSlashIndex + 1);

      console.log('[S3Service.downloadFile] Parsed:', { bucket, key });

      // Download from S3
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      // Convert stream to buffer
      const chunks: Buffer[] = [];
      if (response.Body instanceof Readable) {
        for await (const chunk of response.Body) {
          chunks.push(chunk);
        }
      }

      const buffer = Buffer.concat(chunks);
      console.log('[S3Service.downloadFile] Downloaded successfully, size:', buffer.length, 'bytes');
      
      return buffer;
    } catch (error) {
      console.error('[S3Service.downloadFile] Error:', error);
      throw new InternalServerErrorException(
        `Failed to download file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Generate a signed URL for secure file access
   * @param s3Path - S3 path to file
   * @param expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns Pre-signed URL for accessing the file
   */
  async generateSignedUrl(s3Path: string, expiresIn: number = 3600): Promise<string> {
    try {
      const s3Prefix = 's3://';
      if (!s3Path.startsWith(s3Prefix)) {
        throw new BadRequestException('Invalid S3 path format');
      }

      const afterPrefix = s3Path.substring(s3Prefix.length);
      const firstSlashIndex = afterPrefix.indexOf('/');
      const bucket = afterPrefix.substring(0, firstSlashIndex);
      const key = afterPrefix.substring(firstSlashIndex + 1);

      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      
      return url;
    } catch (error) {
      console.error('[S3Service.generateSignedUrl] Error:', error);
      throw new InternalServerErrorException(
        `Failed to generate signed URL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete file from AWS S3
   * @param s3Path - S3 path to file
   */
  async deleteFile(s3Path: string): Promise<void> {
    try {
      const s3Prefix = 's3://';
      if (!s3Path.startsWith(s3Prefix)) {
        throw new BadRequestException('Invalid S3 path format');
      }

      const afterPrefix = s3Path.substring(s3Prefix.length);
      const firstSlashIndex = afterPrefix.indexOf('/');
      const bucket = afterPrefix.substring(0, firstSlashIndex);
      const key = afterPrefix.substring(firstSlashIndex + 1);

      const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
      await this.s3Client.send(command);

      console.log('[S3Service.deleteFile] Deleted:', { bucket, key });
    } catch (error) {
      console.error('[S3Service.deleteFile] Error:', error);
      throw new InternalServerErrorException(
        `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Check if file type is a code file
   * @param fileType - File extension
   * @returns true if code file
   */
  isCodeFile(fileType: string): boolean {
    return this.allowedCodeLanguages.has(fileType.toLowerCase());
  }

  /**
   * Extract file extension
   * @param fileName - File name
   * @returns File extension without dot
   */
  getFileExtension(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() || '';
  }
}
