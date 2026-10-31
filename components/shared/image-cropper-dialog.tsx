"use client";

import React, { useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, Check, X, Crop } from "lucide-react";

export interface ImageCropperDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    imageSrc: string | null;
    fileName?: string;
    aspectRatio?: number; // width / height (e.g. 1 for 1:1, 2 for 2:1)
    cropShape?: "rect" | "round";
    title?: string;
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

export function ImageCropperDialog({
    open,
    onOpenChange,
    imageSrc,
    fileName = "cropped-image.png",
    aspectRatio = 1,
    cropShape = "rect",
    title = "ปรับแต่งและครอบตัดรูปภาพ",
    onCropComplete,
    onCancel,
}: ImageCropperDialogProps) {
    const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropCompleteCallback = useCallback((_croppedArea: Area, croppedPixels: Area) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

    const handleReset = () => {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    const handleCrop = async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        setIsProcessing(true);
        try {
            const image = await createImage(imageSrc);
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(croppedAreaPixels.width);
            canvas.height = Math.round(croppedAreaPixels.height);
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                throw new Error("Could not create canvas context");
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            ctx.drawImage(
                image,
                croppedAreaPixels.x,
                croppedAreaPixels.y,
                croppedAreaPixels.width,
                croppedAreaPixels.height,
                0,
                0,
                canvas.width,
                canvas.height
            );

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const ext = fileName.split(".").pop() || "png";
                        const safeName = fileName.replace(/\.[^/.]+$/, "") + `-cropped.${ext}`;
                        const file = new File([blob], safeName, {
                            type: "image/png",
                            lastModified: Date.now(),
                        });
                        onCropComplete(file);
                        onOpenChange(false);
                    }
                    setIsProcessing(false);
                },
                "image/png",
                0.95
            );
        } catch (error) {
            console.error("[ImageCropperDialog] Failed to crop image:", error);
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
                    {/* Cropper Container */}
                    <div className="relative w-full h-[340px] bg-neutral-950 rounded-sm overflow-hidden select-none">
                        {imageSrc && (
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={aspectRatio}
                                cropShape={cropShape}
                                showGrid={true}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropCompleteCallback}
                            />
                        )}
                    </div>

                    {/* Controls: Zoom slider & Reset */}
                    <div className="flex items-center gap-3 px-1">
                        <button
                            type="button"
                            onClick={() => setZoom((prev) => Math.max(1, prev - 0.2))}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                            title="Zoom Out"
                        >
                            <ZoomOut className="size-4" />
                        </button>

                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.05}
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="flex-1 accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                        />

                        <button
                            type="button"
                            onClick={() => setZoom((prev) => Math.min(3, prev + 0.2))}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                            title="Zoom In"
                        >
                            <ZoomIn className="size-4" />
                        </button>

                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleReset}
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            title="รีเซ็ตตำแหน่ง"
                        >
                            <RotateCcw className="size-3.5" />
                            รีเซ็ต
                        </Button>
                    </div>
                </div>

                <DialogFooter className="px-5 py-3 border-t bg-muted/20 flex flex-row items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleClose}
                        disabled={isProcessing}
                        className="text-xs font-bold"
                    >
                        <X className="size-3.5 mr-1" />
                        ยกเลิก
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleCrop}
                        disabled={isProcessing}
                        className="text-xs font-bold gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        <Check className="size-3.5" />
                        {isProcessing ? "กำลังประมวลผล..." : "ครอบตัดและใช้งาน"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
