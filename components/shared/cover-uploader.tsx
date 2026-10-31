"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ImageIcon, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { compressAndConvertToAvif } from "@/lib/image-compression";
import { validateUploadedFile } from "@/lib/file-validation";
import { ImageCropperDialog } from "@/components/shared/image-cropper-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface CoverUploaderProps {
    id: string;
    name?: string;
    initialUrl?: string | null;
    onFileChange?: (file: File | null) => void;
    onRemove?: () => void;
    disabled?: boolean;
    aspectRatio?: string; // CSS aspect ratio string, e.g. "aspect-[2/1]"
    cropAspectRatio?: number; // Numeric aspect ratio for cropper, default 2 (2:1 horizontal banner)
    enableCrop?: boolean;
    previewLabel?: string;
    uploadLabel?: string;
    changeLabel?: string;
    removeLabel?: string;
    dimensionHint?: string;
    maxWidth?: number;
    quality?: number;
    maxSize?: number;
    className?: string;
    children?: React.ReactNode;
    onError?: (error: string) => void;
}

export function CoverUploader({
    id,
    name,
    initialUrl = null,
    onFileChange,
    onRemove,
    disabled = false,
    aspectRatio = "aspect-[2/1]",
    cropAspectRatio = 2,
    enableCrop = true,
    previewLabel = "Cover Preview",
    uploadLabel = "คลิกเพื่ออัปโหลดภาพหน้าปก",
    changeLabel = "เปลี่ยนรูป",
    removeLabel = "ลบรูป",
    dimensionHint = "(1440x720)",
    maxWidth = 1920,
    quality = 0.85,
    maxSize = 10 * 1024 * 1024,
    className,
    children,
    onError,
}: CoverUploaderProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
    const [isCompressing, setIsCompressing] = useState(false);
    const [cropperOpen, setCropperOpen] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [pendingFileName, setPendingFileName] = useState("cover.png");
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setPreviewUrl(initialUrl);
    }, [initialUrl]);

    const processFile = async (fileToProcess: File) => {
        setIsCompressing(true);
        try {
            const compressed = await compressAndConvertToAvif(fileToProcess, maxWidth, quality);
            const url = URL.createObjectURL(compressed);
            setPreviewUrl(url);
            onFileChange?.(compressed);
        } catch (error) {
            console.error("[CoverUploader] Compression failed, using original file:", error);
            const url = URL.createObjectURL(fileToProcess);
            setPreviewUrl(url);
            onFileChange?.(fileToProcess);
        } finally {
            setIsCompressing(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation (max 10MB default)
        const check = validateUploadedFile(file, { maxSize });
        if (!check.valid) {
            const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
            const errorMsg = check.error?.includes("maximum limit")
                ? `ขนาดไฟล์ภาพหน้าปกต้องไม่เกิน ${maxMB}MB`
                : (check.error || `ขนาดไฟล์ภาพหน้าปกต้องไม่เกิน ${maxMB}MB`);
            if (onError) {
                onError(errorMsg);
            } else {
                toast.error(errorMsg);
            }
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        setPendingFileName(file.name);
        if (enableCrop) {
            setCropImageSrc(URL.createObjectURL(file));
            setCropperOpen(true);
        } else {
            processFile(file);
        }
    };

    const handleCropComplete = (croppedFile: File) => {
        processFile(croppedFile);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleCropCancel = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setPreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        onFileChange?.(null);
        onRemove?.();
    };

    const hasChildren = Boolean(children);

    return (
        <div className={cn("relative", hasChildren && "pb-10", className)}>
            <div
                onClick={() => !disabled && !isCompressing && fileInputRef.current?.click()}
                className={cn(
                    "relative w-full border-2 border-dashed hover:border-primary/50 transition-all rounded-sm overflow-hidden flex flex-col items-center justify-center cursor-pointer group",
                    aspectRatio,
                    (disabled || isCompressing) && "pointer-events-none opacity-60"
                )}
            >
                {isCompressing ? (
                    <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <Loader2 className="size-4 text-primary animate-spin" />
                        <span className="text-xs text-muted-foreground">กำลังประมวลผลรูปภาพ...</span>
                    </div>
                ) : previewUrl ? (
                    <>
                        <Image
                            src={previewUrl}
                            alt={previewLabel}
                            fill
                            className="object-cover p-1 rounded-sm transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="font-bold text-xs"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                }}
                            >
                                {changeLabel}
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="font-bold text-xs"
                                onClick={handleRemove}
                            >
                                {removeLabel}
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className={cn("flex flex-col items-center justify-center p-4 text-center space-y-2", hasChildren && "pb-12")}>
                        <div className="group p-4 bg-muted rounded-full text-muted-foreground transition-transform group-hover:bg-primary/10 group-hover:text-primary">
                            <ImageIcon className="size-4" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-xs font-bold text-muted-foreground">
                                {uploadLabel}
                            </p>
                            {dimensionHint && (
                                <p className="text-[11px] text-muted-foreground/60">
                                    {dimensionHint}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {children && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10 bg-card rounded-full shadow-md">
                    {children}
                </div>
            )}

            <Input
                id={id}
                name={name}
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
                disabled={disabled || isCompressing}
            />

            {enableCrop && (
                <ImageCropperDialog
                    open={cropperOpen}
                    onOpenChange={setCropperOpen}
                    imageSrc={cropImageSrc}
                    fileName={pendingFileName}
                    aspectRatio={cropAspectRatio}
                    cropShape="rect"
                    canvasAspectRatio="2/1"
                    title="ปรับแต่งและครอบตัดภาพหน้าปก (2:1)"
                    onCropComplete={handleCropComplete}
                    onCancel={handleCropCancel}
                />
            )}
        </div>
    );
}
