"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Camera, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { compressAndConvertToAvif } from "@/lib/image-compression";
import { validateUploadedFile } from "@/lib/file-validation";
import { ImageCropperDialog } from "@/components/shared/image-cropper-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type PlayerUploaderSize = "xs" | "sm" | "md" | "lg" | "xl" | "custom";

export interface PlayerUploaderProps {
    id: string;
    name?: string;
    initialUrl?: string | null;
    onFileChange?: (file: File | null) => void;
    onRemove?: () => void;
    disabled?: boolean;
    size?: PlayerUploaderSize;
    sizeClassName?: string;
    className?: string;
    previewLabel?: string;
    uploadTitle?: string;
    maxWidth?: number;
    quality?: number;
    maxSize?: number;
    showRemoveButton?: boolean;
    enableCrop?: boolean;
    cropAspectRatio?: number;
    onError?: (error: string) => void;
}

const sizeMap: Record<Exclude<PlayerUploaderSize, "custom">, {
    container: string;
    icon: string;
    removeBtn: string;
    removeIcon: string;
    imageSize: number;
}> = {
    xs: {
        container: "w-6 h-6",
        icon: "size-3",
        removeBtn: "-top-1 -right-1 p-0.5",
        removeIcon: "size-2.5",
        imageSize: 24,
    },
    sm: {
        container: "w-8 h-8",
        icon: "size-3.5",
        removeBtn: "-top-1 -right-1 p-0.5",
        removeIcon: "size-3",
        imageSize: 32,
    },
    md: {
        container: "w-20 h-20",
        icon: "size-5",
        removeBtn: "-top-1 -right-1 p-1",
        removeIcon: "size-3.5",
        imageSize: 80,
    },
    lg: {
        container: "w-24 h-24",
        icon: "size-6",
        removeBtn: "-top-1 -right-1 p-1",
        removeIcon: "size-4",
        imageSize: 96,
    },
    xl: {
        container: "w-28 h-28",
        icon: "size-7",
        removeBtn: "-top-1 -right-1 p-1.5",
        removeIcon: "size-4",
        imageSize: 112,
    },
};

export function PlayerUploader({
    id,
    name,
    initialUrl = null,
    onFileChange,
    onRemove,
    disabled = false,
    size = "md",
    sizeClassName,
    className,
    previewLabel = "Player Photo",
    uploadTitle = "อัปโหลดรูปภาพ",
    maxWidth = 512,
    quality = 0.85,
    maxSize = 5 * 1024 * 1024,
    showRemoveButton = true,
    enableCrop = true,
    cropAspectRatio = 1,
    onError,
}: PlayerUploaderProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
    const [isCompressing, setIsCompressing] = useState(false);
    const [cropperOpen, setCropperOpen] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [pendingFileName, setPendingFileName] = useState("player.png");
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
            console.error("[PlayerUploader] Compression failed, using original file:", error);
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

        // Validation (max 5MB default)
        const check = validateUploadedFile(file, { maxSize });
        if (!check.valid) {
            const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
            const errorMsg = check.error?.includes("maximum limit")
                ? `ขนาดไฟล์รูปถ่ายต้องไม่เกิน ${maxMB}MB`
                : (check.error || `ขนาดไฟล์รูปถ่ายต้องไม่เกิน ${maxMB}MB`);
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

    const resolvedSize = size === "custom" ? (sizeClassName || "w-16 h-16") : sizeMap[size].container;
    const resolvedIcon = size === "custom" ? "size-5" : sizeMap[size].icon;
    const resolvedRemoveBtn = size === "custom" ? "-top-1 -right-1 p-1" : sizeMap[size].removeBtn;
    const resolvedRemoveIcon = size === "custom" ? "size-3.5" : sizeMap[size].removeIcon;
    const resolvedImagePx = size === "custom" ? 64 : sizeMap[size].imageSize;

    return (
        <div className={cn("relative inline-flex items-center justify-center shrink-0", className)}>
            <button
                type="button"
                onClick={() => !disabled && !isCompressing && fileInputRef.current?.click()}
                title={uploadTitle}
                disabled={disabled || isCompressing}
                className={cn(
                    "rounded-full border-2 border-dashed border-border/80 transition-all flex items-center justify-center overflow-hidden relative group bg-muted/20 hover:border-primary/60 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    resolvedSize,
                    (disabled || isCompressing) && "pointer-events-none opacity-60"
                )}
            >
                {isCompressing ? (
                    <Loader2 className={cn("animate-spin text-primary", resolvedIcon)} />
                ) : previewUrl ? (
                    <div className="relative w-full h-full">
                        <Image
                            src={previewUrl}
                            alt={previewLabel}
                            width={resolvedImagePx}
                            height={resolvedImagePx}
                            className="h-full w-full object-cover rounded-full"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                            <Camera className={cn("text-white", resolvedIcon)} />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center text-muted-foreground transition-colors group-hover:text-primary">
                        <Camera className={resolvedIcon} />
                    </div>
                )}
            </button>

            {previewUrl && showRemoveButton && !disabled && !isCompressing && (
                <button
                    type="button"
                    onClick={handleRemove}
                    className={cn(
                        "absolute bg-destructive text-destructive-foreground rounded-full shadow-sm hover:scale-110 transition-transform z-10 flex items-center justify-center cursor-pointer",
                        resolvedRemoveBtn
                    )}
                    title="ลบรูปภาพ"
                >
                    <X className={resolvedRemoveIcon} />
                </button>
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
                    cropShape="round"
                    canvasAspectRatio="2/1"
                    title="ปรับแต่งและครอบตัดรูปนักกีฬา (1:1)"
                    onCropComplete={handleCropComplete}
                    onCancel={handleCropCancel}
                />
            )}
        </div>
    );
}
