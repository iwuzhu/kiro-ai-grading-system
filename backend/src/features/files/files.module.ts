import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { FilesController } from './files.controller';
import { S3Service } from '../../infrastructure/storage/s3.service';

/**
 * Files Module
 *
 * Provides file handling operations:
 * - Download files from storage
 * - Stream files with proper MIME types
 * - Handle secure file serving
 *
 * Imports PassportModule to enable JWT authentication on controllers
 */
@Module({
  imports: [PassportModule],
  providers: [S3Service],
  controllers: [FilesController],
  exports: [S3Service],
})
export class FilesModule {}
