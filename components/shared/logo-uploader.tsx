"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ImageIcon, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { compressAndConvertToAvif } from "@/lib/image-compression";
import { ImageCropperDialog } from "@/components/shared/image-cropper-dialog";

export interface LogoUploaderProps {
    id: string;
    name?: string;
    initialUrl?: string | null;
    onFileChange?: (file: File | null) => void;
    onRemove?: () => void;
    disabled?: boolean;
    uploadLabel?: string;
    clickToUploadLabel?: string;
    previewLabel?: string;
    imageFit?: "contain" | "cover";
    maxWidth?: number;
    quality?: number;
    enableCrop?: boolean;
    cropAspectRatio?: number;
}

export function LogoUploader({
    id,
    name,
    initialUrl = null,
    onFileChange,
    onRemove,
    disabled = false,
    previewLabel = "Preview",
    imageFit = "contain",
    maxWidth = 512,
    quality = 0.8,
    enableCrop = true,
    cropAspectRatio = 1,
}: LogoUploaderProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
    const [isCompressing, setIsCompressing] = useState(false);
    const [cropperOpen, setCropperOpen] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [pendingFileName, setPendingFileName] = useState("logo.png");
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
            console.error("Image compression failed, using original file:", error);
            const url = URL.createObjectURL(fileToProcess);
            setPreviewUrl(url);
            onFileChange?.(fileToProcess);
        } finally {
            setIsCompressing(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPendingFileName(file.name);
            if (enableCrop) {
                setCropImageSrc(URL.createObjectURL(file));
                setCropperOpen(true);
            } else {
                processFile(file);
            }
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

    const handleRemoveLogo = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setPreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        onFileChange?.(null);
        onRemove?.();
    };

    return (
        <div className="relative inline-block">
            <div className="relative group w-20 h-20">
                <label
                    htmlFor={id}
                    className={`w-20 h-20 bg-card rounded-full border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer transition-colors hover:border-primary/50 ${disabled || isCompressing ? "pointer-events-none opacity-50" : ""
                        }`}
                >
                    {isCompressing ? (
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    ) : previewUrl ? (
                        <div className="relative w-full h-full">
                            <Image
                                src={previewUrl}
                                alt={previewLabel}
                                fill
                                className={`rounded-full p-1 ${imageFit === "cover" ? "object-cover" : "object-contain"
                                    }`}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                                <ImageIcon className="h-4 w-4 text-white" />
                            </div>
                        </div>
                    ) : (
                        <div className="group p-2 rounded-full transition-colors group-hover:bg-primary/10">
                            <ImageIcon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                        </div>
                    )}
                </label>

                {previewUrl && !disabled && !isCompressing && (
                    <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded-full shadow-sm hover:scale-110 transition-transform"
                        title="Remove image"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
            </div>

            <Input
                id={id}
                name={name}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                ref={fileInputRef}
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
                    title="ปรับแต่งและครอบตัดโลโก้ (1:1)"
                    onCropComplete={handleCropComplete}
                    onCancel={handleCropCancel}
                />
            )}
        </div>
    );
}
