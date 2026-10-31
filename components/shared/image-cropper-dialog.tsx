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
import { ZoomIn, ZoomOut, RotateCcw, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ImageCropperDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    imageSrc: string | null;
    fileName?: string;
    aspectRatio?: number; // width / height (e.g. 1 for 1:1, 2 for 2:1)
    cropShape?: "rect" | "round";
    title?: string;
    minZoom?: number; // default 1
    maxZoom?: number; // default 3
    canvasAspectRatio?: "1/2" | "2/1" | "1/1" | "auto" | string;
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

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        targetWidth,
        targetHeight
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
    minZoom = 1,
    maxZoom = 3,
    canvasAspectRatio = "2/1",
    onCropComplete,
    onCancel,
}: ImageCropperDialogProps) {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isReady, setIsReady] = useState(false);

    // Dynamic viewport container sizing based on canvasAspectRatio (2:1 horizontal by default)
    const getCanvasClass = () => {
        switch (canvasAspectRatio) {
            case "2/1":
                return "w-full aspect-[2/1] mx-auto";
            case "1/2":
                return "h-[380px] aspect-[1/2] mx-auto";
            case "1/1":
                return "h-[340px] aspect-square mx-auto";
            case "auto":
                return "w-full h-[340px]";
            default:
                return "w-full aspect-[2/1] mx-auto";
        }
    };

    // Reset crop and zoom whenever dialog opens or image changes
    // Wait for Dialog layout transition to finish before initializing Cropper
    // to avoid dimension mismatch caused by dialog opening animations
    useEffect(() => {
        if (open) {
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            const timer = setTimeout(() => {
                setIsReady(true);
                // Trigger resize event to ensure react-easy-crop calculates flush dimensions
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new Event("resize"));
                }
            }, 60);
            return () => clearTimeout(timer);
        } else {
            setIsReady(false);
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
                className="max-w-[520px] p-0 overflow-hidden bg-card text-card-foreground border rounded-sm animate-none duration-0"
                showCloseButton={false}
            >
                <DialogHeader className="px-5 py-3 border-b flex flex-row items-center justify-between space-y-0">
                    <DialogTitle className="text-sm font-bold">{title}</DialogTitle>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    >
                        <X className="size-4" />
                    </button>
                </DialogHeader>

                <div className="p-4 space-y-4 flex-1">
                    {/* Viewport with react-easy-crop locked strictly to image bounds */}
                    <div className={cn("relative bg-neutral-950 rounded-sm overflow-hidden select-none", getCanvasClass())}>
                        {imageSrc && isReady ? (
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={aspectRatio}
                                cropShape={cropShape}
                                showGrid={true}
                                minZoom={minZoom}
                                maxZoom={maxZoom}
                                restrictPosition={true}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropCompleteCallback}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="size-6 text-muted-foreground animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-4">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setZoom((z) => Math.max(minZoom, parseFloat((z - 0.1).toFixed(2))))}
                            title="Zoom Out"
                        >
                            <ZoomOut className="size-4" />
                        </Button>

                        <input
                            type="range"
                            min={minZoom}
                            max={maxZoom}
                            step={0.01}
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="flex-1 accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                        />

                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setZoom((z) => Math.min(maxZoom, parseFloat((z + 0.1).toFixed(2))))}
                            title="Zoom In"
                        >
                            <ZoomIn className="size-4" />
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleReset}
                            title="รีเซ็ตขนาดเริ่มต้น"
                        >
                            <RotateCcw className="size-4" />
                            รีเซ็ต
                        </Button>
                    </div>
                </div>

                <DialogFooter className="mt-auto">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleClose}
                    >
                        <X className="size-4" />
                        ยกเลิก
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        disabled={isProcessing}
                        onClick={handleConfirm}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                กำลังประมวลผล...
                            </>
                        ) : (
                            <>
                                <Check className="size-4" />
                                ครอบตัดและใช้งาน
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
