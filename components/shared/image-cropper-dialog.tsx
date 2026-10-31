"use client";

import React, { useState, useCallback, useEffect } from "react";
import Cropper, { type Point, type Area } from "react-easy-crop";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, Check, X, Crop, Loader2 } from "lucide-react";

export interface ImageCropperDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    imageSrc: string | null;
    fileName?: string;
    aspectRatio?: number; // width / height (e.g. 1 for 1:1, 2 for 2:1)
    cropShape?: "rect" | "round";
    title?: string;
    minZoom?: number; // default 0.5
    maxZoom?: number; // default 3
    onCropComplete: (croppedFile: File) => void;
    onCancel?: () => void;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new window.Image();
        image.addEventListener("load", () => resolve(image));
        image.addEventListener("error", (error) => reject(error));
        image.setAttribute("crossOrigin", "anonymous");
        image.src = url;
    });

async function getCroppedImg(
    imageSrc: string,
    pixelCrop: Area,
    fileName: string = "cropped.png"
): Promise<File> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error("No 2d context available");
    }

    const targetWidth = Math.max(1, Math.round(pixelCrop.width));
    const targetHeight = Math.max(1, Math.round(pixelCrop.height));

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Clear canvas with transparent
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the image relative to the crop window.
    // Handles zoom-in (pixelCrop.x > 0) and zoom-out (pixelCrop.x < 0) safely.
    ctx.drawImage(
        image,
        -pixelCrop.x,
        -pixelCrop.y,
        image.naturalWidth,
        image.naturalHeight
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error("Canvas toBlob failed"));
                    return;
                }
                const ext = fileName.split(".").pop() || "png";
                const safeName = fileName.replace(/\.[^/.]+$/, "") + `-cropped.${ext}`;
                const file = new File([blob], safeName, {
                    type: "image/png",
                    lastModified: Date.now(),
                });
                resolve(file);
            },
            "image/png",
            0.95
        );
    });
}

export function ImageCropperDialog({
    open,
    onOpenChange,
    imageSrc,
    fileName = "image.png",
    aspectRatio = 1,
    cropShape = "rect",
    title = "ปรับแต่งและครอบตัดรูปภาพ",
    minZoom = 0.5,
    maxZoom = 3,
    onCropComplete,
    onCancel,
}: ImageCropperDialogProps) {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Reset crop and zoom whenever dialog opens or image changes
    useEffect(() => {
        if (open) {
            setCrop({ x: 0, y: 0 });
            setZoom(1);
        }
    }, [open, imageSrc]);

    const onCropCompleteCallback = useCallback(
        (_croppedArea: Area, currentCroppedAreaPixels: Area) => {
            setCroppedAreaPixels(currentCroppedAreaPixels);
        },
        []
    );

    const handleReset = () => {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    const handleFitCrop = () => {
        setCrop({ x: 0, y: 0 });
        // For 1:1 round crop, a square inscribed inside the circle has zoom = 1 / sqrt(2) ≈ 0.71
        setZoom(cropShape === "round" ? 0.71 : minZoom);
    };

    const handleConfirm = async () => {
        if (!imageSrc || !croppedAreaPixels) return;
        setIsProcessing(true);
        try {
            const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels, fileName);
            onCropComplete(croppedFile);
            onOpenChange(false);
        } catch (e) {
            console.error("[ImageCropperDialog] Failed to crop image:", e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        onCancel?.();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent
                className="max-w-[520px] p-0 overflow-hidden bg-card text-card-foreground border rounded-sm"
                showCloseButton={false}
            >
                <DialogHeader className="px-5 py-3 border-b flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                        <Crop className="size-4 text-primary" />
                        <DialogTitle className="text-sm font-bold">{title}</DialogTitle>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    >
                        <X className="size-4" />
                    </button>
                </DialogHeader>

                <div className="p-4 space-y-4">
                    {/* Viewport with react-easy-crop */}
                    <div className="relative w-full h-[340px] bg-neutral-950 rounded-sm overflow-hidden select-none">
                        {imageSrc && (
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={aspectRatio}
                                cropShape={cropShape}
                                showGrid={true}
                                minZoom={minZoom}
                                maxZoom={maxZoom}
                                restrictPosition={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropCompleteCallback}
                            />
                        )}
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] font-mono text-white/80 pointer-events-none z-10">
                            {aspectRatio === 1 ? "1:1" : `${aspectRatio}:1`}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 px-1">
                        <button
                            type="button"
                            onClick={() => setZoom((z) => Math.max(minZoom, parseFloat((z - 0.1).toFixed(2))))}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                            title="Zoom Out"
                        >
                            <ZoomOut className="size-4" />
                        </button>

                        <input
                            type="range"
                            min={minZoom}
                            max={maxZoom}
                            step={0.01}
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="flex-1 accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                        />

                        <button
                            type="button"
                            onClick={() => setZoom((z) => Math.min(maxZoom, parseFloat((z + 0.1).toFixed(2))))}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                            title="Zoom In"
                        >
                            <ZoomIn className="size-4" />
                        </button>

                        <div className="flex items-center gap-1.5 ml-1 border-l pl-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleFitCrop}
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                                title="ย่อให้รูปภาพทั้งหมดพอดีกรอบวงกลม"
                            >
                                พอดีกรอบ
                            </Button>

                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleReset}
                                className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                                title="รีเซ็ตขนาดเริ่มต้น"
                            >
                                <RotateCcw className="size-3.5" />
                                รีเซ็ต
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-5 py-3 border-t bg-muted/20 flex flex-row items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleClose}
                        className="text-xs font-bold"
                    >
                        <X className="size-3.5 mr-1" />
                        ยกเลิก
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        disabled={isProcessing}
                        onClick={handleConfirm}
                        className="text-xs font-bold gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="size-3.5 animate-spin" />
                                กำลังประมวลผล...
                            </>
                        ) : (
                            <>
                                <Check className="size-3.5" />
                                ครอบตัดและใช้งาน
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
