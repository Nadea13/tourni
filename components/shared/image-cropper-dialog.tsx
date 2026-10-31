"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, Check, X, Crop } from "lucide-react";
import { cn } from "@/lib/utils";

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
    const [imageLoaded, setImageLoaded] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

    // Reset state when opening with a new image
    useEffect(() => {
        if (open && imageSrc) {
            setZoom(1);
            setPan({ x: 0, y: 0 });
            setImageLoaded(false);
        }
    }, [open, imageSrc]);

    // Viewport and Crop Frame calculations
    const containerWidth = 460;
    const containerHeight = 320;

    // Calculate crop frame dimensions inside the container
    let cropBoxWidth = containerWidth - 40;
    let cropBoxHeight = cropBoxWidth / aspectRatio;

    if (cropBoxHeight > containerHeight - 40) {
        cropBoxHeight = containerHeight - 40;
        cropBoxWidth = cropBoxHeight * aspectRatio;
    }

    // Calculate base image size to cover the crop box at zoom = 1 (object-fit: cover)
    let baseWidth = cropBoxWidth;
    let baseHeight = cropBoxHeight;

    if (naturalSize.width > 0 && naturalSize.height > 0) {
        const imgAspect = naturalSize.width / naturalSize.height;
        if (imgAspect > aspectRatio) {
            baseHeight = cropBoxHeight;
            baseWidth = cropBoxHeight * imgAspect;
        } else {
            baseWidth = cropBoxWidth;
            baseHeight = cropBoxWidth / imgAspect;
        }
    }

    const currentWidth = baseWidth * zoom;
    const currentHeight = baseHeight * zoom;

    const clampPan = useCallback((x: number, y: number, currentZoom: number) => {
        const curW = baseWidth * currentZoom;
        const curH = baseHeight * currentZoom;
        const maxX = Math.max(0, (curW - cropBoxWidth) / 2);
        const maxY = Math.max(0, (curH - cropBoxHeight) / 2);
        return {
            x: Math.max(-maxX, Math.min(maxX, x)),
            y: Math.max(-maxY, Math.min(maxY, y)),
        };
    }, [baseWidth, baseHeight, cropBoxWidth, cropBoxHeight]);

    // Pointer event handlers for panning
    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            panX: pan.x,
            panY: pan.y,
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        const newPan = clampPan(dragStartRef.current.panX + dx, dragStartRef.current.panY + dy, zoom);
        setPan(newPan);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (isDragging) {
            setIsDragging(false);
            try {
                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
                // Ignore if pointer capture already released
            }
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        const newZoom = Math.max(1, Math.min(3, zoom + delta));
        setZoom(newZoom);
        setPan((prev) => clampPan(prev.x, prev.y, newZoom));
    };

    const handleZoomChange = (newZoom: number) => {
        setZoom(newZoom);
        setPan((prev) => clampPan(prev.x, prev.y, newZoom));
    };

    const handleReset = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    // Perform the crop on Canvas and output File
    const handleCrop = () => {
        if (!imgRef.current || naturalSize.width === 0 || naturalSize.height === 0) return;

        // Visual position of image center inside container:
        const imgCenterX = containerWidth / 2 + pan.x;
        const imgCenterY = containerHeight / 2 + pan.y;

        const imgLeft = imgCenterX - currentWidth / 2;
        const imgTop = imgCenterY - currentHeight / 2;

        // Crop box top-left:
        const cropLeft = (containerWidth - cropBoxWidth) / 2;
        const cropTop = (containerHeight - cropBoxHeight) / 2;

        // Crop box offset relative to rendered image:
        const relCropX = cropLeft - imgLeft;
        const relCropY = cropTop - imgTop;

        // Ratio of natural dimensions to current rendered dimensions:
        const scale = naturalSize.width / currentWidth;

        const sourceX = Math.max(0, relCropX * scale);
        const sourceY = Math.max(0, relCropY * scale);
        const sourceWidth = Math.min(naturalSize.width - sourceX, cropBoxWidth * scale);
        const sourceHeight = Math.min(naturalSize.height - sourceY, cropBoxHeight * scale);

        // High resolution output canvas:
        const outputWidth = Math.round(aspectRatio >= 1 ? Math.min(sourceWidth, 1920) : Math.min(sourceWidth, 1080));
        const outputHeight = Math.round(outputWidth / aspectRatio);

        const canvas = document.createElement("canvas");
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        // If shape is round, we can optionally clip or leave as square (uploader will render round with rounded-full)
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.drawImage(
            imgRef.current,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            outputWidth,
            outputHeight
        );

        canvas.toBlob(
            (blob) => {
                if (blob) {
                    const ext = fileName.split(".").pop() || "png";
                    const safeName = fileName.replace(/\.[^/.]+$/, "") + `-cropped.${ext}`;
                    const file = new File([blob], safeName, {
                        type: blob.type || "image/png",
                        lastModified: Date.now(),
                    });
                    onCropComplete(file);
                    onOpenChange(false);
                }
            },
            "image/png",
            0.95
        );
    };

    const handleClose = () => {
        onCancel?.();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent
                className="max-w-[500px] p-0 overflow-hidden bg-card text-card-foreground border rounded-sm"
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
                    {/* Viewport & Interactive Image Canvas */}
                    <div
                        ref={containerRef}
                        onWheel={handleWheel}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        className="relative w-full h-[320px] bg-neutral-950 rounded-sm overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none"
                    >
                        {imageSrc && (
                            <img
                                ref={imgRef}
                                src={imageSrc}
                                alt="Crop target"
                                onLoad={(e) => {
                                    const img = e.currentTarget;
                                    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
                                    setImageLoaded(true);
                                }}
                                draggable={false}
                                className="absolute pointer-events-none max-w-none transition-transform duration-75"
                                style={{
                                    width: `${currentWidth}px`,
                                    height: `${currentHeight}px`,
                                    transform: `translate(${pan.x}px, ${pan.y}px)`,
                                    opacity: imageLoaded ? 1 : 0,
                                }}
                            />
                        )}

                        {/* Dark Backdrop Overlay with Cutout */}
                        <div className="absolute inset-0 pointer-events-none">
                            {/* SVG Mask for sharp cutout */}
                            <svg className="w-full h-full">
                                <defs>
                                    <mask id="crop-mask">
                                        <rect width="100%" height="100%" fill="white" />
                                        {cropShape === "round" ? (
                                            <ellipse
                                                cx={containerWidth / 2}
                                                cy={containerHeight / 2}
                                                rx={cropBoxWidth / 2}
                                                ry={cropBoxHeight / 2}
                                                fill="black"
                                            />
                                        ) : (
                                            <rect
                                                x={(containerWidth - cropBoxWidth) / 2}
                                                y={(containerHeight - cropBoxHeight) / 2}
                                                width={cropBoxWidth}
                                                height={cropBoxHeight}
                                                rx={4}
                                                fill="black"
                                            />
                                        )}
                                    </mask>
                                </defs>
                                <rect
                                    width="100%"
                                    height="100%"
                                    fill="rgba(0, 0, 0, 0.65)"
                                    mask="url(#crop-mask)"
                                />
                            </svg>
                        </div>

                        {/* Crop Box Border & Guides */}
                        <div
                            className={cn(
                                "absolute pointer-events-none border-2 border-primary/90 shadow-[0_0_0_9999px_rgba(0,0,0,0)]",
                                cropShape === "round" ? "rounded-full" : "rounded-sm"
                            )}
                            style={{
                                width: `${cropBoxWidth}px`,
                                height: `${cropBoxHeight}px`,
                            }}
                        >
                            {/* 3x3 Grid Lines */}
                            <div className="w-full h-full grid grid-cols-3 grid-rows-3 opacity-30 pointer-events-none">
                                <div className="border-r border-b border-white" />
                                <div className="border-r border-b border-white" />
                                <div className="border-b border-white" />
                                <div className="border-r border-b border-white" />
                                <div className="border-r border-b border-white" />
                                <div className="border-b border-white" />
                                <div className="border-r border-white" />
                                <div className="border-r border-white" />
                                <div />
                            </div>
                        </div>

                        {/* Badge for Aspect Ratio */}
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] font-mono text-white/80 pointer-events-none">
                            {aspectRatio === 1 ? "1:1 (Square)" : `${aspectRatio}:1 (Cover)`}
                        </div>
                    </div>

                    {/* Controls: Zoom slider & Reset */}
                    <div className="flex items-center gap-3 px-1">
                        <button
                            type="button"
                            onClick={() => handleZoomChange(Math.max(1, zoom - 0.2))}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
                            title="Zoom Out"
                        >
                            <ZoomOut className="size-4" />
                        </button>

                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.01}
                            value={zoom}
                            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                            className="flex-1 accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                        />

                        <button
                            type="button"
                            onClick={() => handleZoomChange(Math.min(3, zoom + 0.2))}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
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
                        className="text-xs font-bold"
                    >
                        <X className="size-3.5 mr-1" />
                        ยกเลิก
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleCrop}
                        className="text-xs font-bold gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        <Check className="size-3.5" />
                        ครอบตัดและใช้งาน
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
