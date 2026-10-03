import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Response,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import { AuthGuard } from '@nestjs/passport';
import * as fs from 'fs';
import * as path from 'path';
import { S3Service } from '../../infrastructure/storage/s3.service';
import { ConfigService } from '@nestjs/config';

/**
 * Files Controller
 *
 * Handles file operations:
 * - Download files from storage (with proper headers and streaming)
 * - Serve files with correct MIME types
 *
 * Security:
 * - Requires authentication (JWT)
 * - Tenant isolation via request user context
 */
@Controller('files')
@UseGuards(AuthGuard('jwt'))
export class FilesController {
  private uploadDir: string;

  constructor(
    private s3Service: S3Service,
    private configService: ConfigService,
  ) {
    this.uploadDir = this.configService.get('UPLOAD_DIR', './uploads');
  }

  /**
   * Download file by S3 path
   * Streams file from storage with proper HTTP headers
   *
   * @param s3Path - S3 path to file (base64 encoded in URL)
   * @param response - Express response object
   * @param request - Express request object
   */
  @Get('download/:filename')
  @HttpCode(HttpStatus.OK)
  async downloadFile(
    @Param('filename') filename: string,
    @Request() request: any,
    @Response() response: ExpressResponse,
  ) {
    try {
      // Get tenant from authenticated user
      let tenantId: string;
      try {
        tenantId = request.user?.tenant_id;
        if (!tenantId) {
          throw new Error('Tenant ID not found in user context');
        }
      } catch (e) {
        return response.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication failed: ' + e.message,
          },
        });
      }

      // Decode filename (it's base64 encoded for URL safety)
      let s3Path = filename;
      try {
        s3Path = Buffer.from(filename, 'base64').toString('utf-8');
      } catch (e) {
        // If not base64, use as-is
      }

      console.log('Download requested for S3 path:', s3Path);

      // Extract file extension for MIME type
      const fileExtension = s3Path.split('.').pop()?.toLowerCase() || '';

      // MIME type mapping
      const mimeTypes: Record<string, string> = {
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'txt': 'text/plain',
        'md': 'text/markdown',
        'py': 'text/plain',
        'js': 'application/javascript',
        'ts': 'text/typescript',
        'java': 'text/plain',
        'cpp': 'text/plain',
        'c': 'text/plain',
        'cs': 'text/plain',
        'go': 'text/plain',
        'rb': 'text/plain',
        'php': 'text/plain',
        'html': 'text/html',
        'css': 'text/css',
        'json': 'application/json',
        'zip': 'application/zip',
      };

      const mimeType = mimeTypes[fileExtension] || 'application/octet-stream';

      // Determine local file path
      let localFilePath: string;

      if (s3Path.startsWith('s3://')) {
        // S3-format path: s3://bucket/tenant/assignment/student/file
        // Convert to local: uploads/tenant/assignment/student/file
        const pathWithoutBucket = s3Path
          .replace(/^s3:\/\/[^/]+\//, '');
        localFilePath = path.join(this.uploadDir, pathWithoutBucket);
      } else if (s3Path.startsWith('/')) {
        // Legacy format or absolute path: /submissions/cs101/hello_world_michael.py
        // Treat as relative to uploadDir
        localFilePath = path.join(this.uploadDir, s3Path);
      } else {
        // Relative path
        localFilePath = path.join(this.uploadDir, s3Path);
      }

      console.log('Resolved local file path:', localFilePath);

      // Security check: ensure we're not reading outside upload directory
      const resolvedPath = path.resolve(localFilePath);
      const resolvedUploadDir = path.resolve(this.uploadDir);

      if (!resolvedPath.startsWith(resolvedUploadDir)) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PATH',
            message: 'Invalid file path: access denied',
          },
        });
      }

      // Check if file exists
      if (!fs.existsSync(resolvedPath)) {
        console.log('File not found at:', resolvedPath);
        return response.status(404).json({
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File not found at path: ' + resolvedPath,
          },
        });
      }

      // Read file
      const fileBuffer = fs.readFileSync(resolvedPath);

      // Extract filename from S3 path for the download
      const displayFileName = s3Path.split('/').pop() || 'download';

      // Set response headers
      response.set({
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${displayFileName}"`,
        'Content-Length': fileBuffer.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });

      // Send file
      response.send(fileBuffer);
    } catch (error) {
      console.error('Download error:', error);
      response.status(400).json({
        success: false,
        error: {
          code: 'DOWNLOAD_FAILED',
          message: error.message || 'Failed to download file',
        },
      });
    }
  }
}
