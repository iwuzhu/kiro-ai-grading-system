import { Injectable } from '@nestjs/common';
import { S3Service } from '../../infrastructure/storage/s3.service';
import { ConfigService } from '@nestjs/config';

/**
 * Submission Upload Service
 *
 * Handles uploading submission content (files or text) to S3 storage
 * Returns S3 URI for storage in database
 */
@Injectable()
export class SubmissionUploadService {
  private readonly s3Bucket: string;

  constructor(
    private s3Service: S3Service,
    private configService: ConfigService,
  ) {
    this.s3Bucket = this.configService.get('AWS_S3_BUCKET', 'tecbridge-general');
  }

  /**
   * Upload submission content to S3
   *
   * For file submissions: upload the file buffer
   * For text submissions: convert text to buffer and upload
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @param content - File buffer or text string
   * @param fileName - File name (e.g., "essay.txt", "solution.py")
   * @param contentType - MIME type or file extension
   * @returns S3 URI for the uploaded content
   */
  async uploadSubmissionContent(
    tenantId: string,
    assignmentId: string,
    studentId: string,
    content: Buffer | string,
    fileName: string,
    contentType: string,
  ): Promise<string> {
    // Convert text to buffer if needed
    const buffer = typeof content === 'string' 
      ? Buffer.from(content, 'utf-8') 
      : content;

    // Generate S3 path
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Path = `s3://${this.s3Bucket}/websites/externals/deepgrader/${timestamp}/${sanitizedFileName}`;

    try {
      // Upload to S3 using existing S3Service
      const uploadedPath = await this.s3Service.uploadFile(
        tenantId,
        assignmentId,
        studentId,
        fileName,
        buffer,
      );

      console.log(`✓ Submitted content uploaded to S3: ${uploadedPath}`);
      return uploadedPath;
    } catch (error) {
      console.error(`✗ Failed to upload submission content to S3:`, error);
      throw error;
    }
  }

  /**
   * Generate download URL for submission
   * In production: pre-signed S3 URL
   * In development: download endpoint URL
   *
   * @param s3Path - S3 path to file
   * @returns Public URL for downloading
   */
  generateDownloadUrl(s3Path: string): string {
    const encodedPath = Buffer.from(s3Path).toString('base64');
    return `/api/v1/files/download/${encodedPath}`;
  }

  /**
   * Get S3 URI for storage in database
   * This is what gets saved in the submissions table
   *
   * @param s3Path - S3 path from upload
   * @returns S3 URI (same as s3Path)
   */
  getS3Uri(s3Path: string): string {
    return s3Path;
  }
}
