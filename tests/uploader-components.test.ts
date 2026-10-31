import { describe, it, expect } from 'vitest';
import { CoverUploader } from '@/components/shared/cover-uploader';
import { PlayerUploader } from '@/components/shared/player-uploader';
import { LogoUploader } from '@/components/shared/logo-uploader';
import { ImageCropperDialog } from '@/components/shared/image-cropper-dialog';

describe('Shared Uploader Components exports', () => {
    it('should export CoverUploader component function', () => {
        expect(typeof CoverUploader).toBe('function');
    });

    it('should export PlayerUploader component function', () => {
        expect(typeof PlayerUploader).toBe('function');
    });

    it('should export LogoUploader component function', () => {
        expect(typeof LogoUploader).toBe('function');
    });

    it('should export ImageCropperDialog component function', () => {
        expect(typeof ImageCropperDialog).toBe('function');
    });
});
