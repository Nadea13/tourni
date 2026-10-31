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

    it('should validate cover max size limit (10MB)', async () => {
        const { validateUploadedFile } = await import('@/lib/file-validation');
        const over10MB = new File([new Uint8Array(11 * 1024 * 1024)], 'cover.png', { type: 'image/png' });
        const resOver = validateUploadedFile(over10MB, { maxSize: 10 * 1024 * 1024 });
        expect(resOver.valid).toBe(false);
        expect(resOver.error).toContain('maximum limit of 10.0MB');

        const under10MB = new File([new Uint8Array(8 * 1024 * 1024)], 'cover.png', { type: 'image/png' });
        const resUnder = validateUploadedFile(under10MB, { maxSize: 10 * 1024 * 1024 });
        expect(resUnder.valid).toBe(true);
    });

    it('should validate logo max size limit (5MB)', async () => {
        const { validateUploadedFile } = await import('@/lib/file-validation');
        const over5MB = new File([new Uint8Array(6 * 1024 * 1024)], 'logo.png', { type: 'image/png' });
        const resOver = validateUploadedFile(over5MB, { maxSize: 5 * 1024 * 1024 });
        expect(resOver.valid).toBe(false);
        expect(resOver.error).toContain('maximum limit of 5.0MB');

        const under5MB = new File([new Uint8Array(3 * 1024 * 1024)], 'logo.png', { type: 'image/png' });
        const resUnder = validateUploadedFile(under5MB, { maxSize: 5 * 1024 * 1024 });
        expect(resUnder.valid).toBe(true);
    });

    it('should validate player photo max size limit (5MB)', async () => {
        const { validateUploadedFile } = await import('@/lib/file-validation');
        const over5MB = new File([new Uint8Array(6 * 1024 * 1024)], 'player.png', { type: 'image/png' });
        const resOver = validateUploadedFile(over5MB, { maxSize: 5 * 1024 * 1024 });
        expect(resOver.valid).toBe(false);
        expect(resOver.error).toContain('maximum limit of 5.0MB');

        const under5MB = new File([new Uint8Array(3 * 1024 * 1024)], 'player.png', { type: 'image/png' });
        const resUnder = validateUploadedFile(under5MB, { maxSize: 5 * 1024 * 1024 });
        expect(resUnder.valid).toBe(true);
    });
});
