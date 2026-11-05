"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Sport } from "@/types";
import { getLandingSportIcon } from "@/components/shared/sport-icons";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RadioBtnOption {
    id: string;
    sport_name?: string;
    name?: string;
    label?: string;
    icon?: React.ReactNode;
}

export type SelectOption = RadioBtnOption;
export type SportOption = RadioBtnOption;

export interface RadioBtnProps {
    value?: string;
    onChange: (id: string) => void;
    options?: (Sport | RadioBtnOption)[];
    sports?: (Sport | RadioBtnOption)[];
    disabled?: boolean;
    className?: string;
    placeholder?: string;
    threshold?: number;
    name?: string;
}

export type SelectProps = RadioBtnProps;
export type SportSelectProps = RadioBtnProps;

function getOptionDisplayName(item: Sport | RadioBtnOption): string {
    if ('sport_name' in item && item.sport_name) return item.sport_name;
    if ('name' in item && item.name) return item.name;
    if ('label' in item && item.label) return item.label;
    return "";
}

export function RadioBtn({
    value,
    onChange,
    options,
    sports,
    disabled = false,
    className,
    name,
}: RadioBtnProps) {
    let items = options || sports || [];
    if (sports && sports.length > 0) {
        const allowed = ['football', 'volleyball', 'futsal'];
        items = items.filter((item) => {
            const name = getOptionDisplayName(item).toLowerCase();
            return allowed.includes(name);
        });
    }
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScrollButtons = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        setCanScrollLeft(scrollLeft > 2);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
    }, []);

    useEffect(() => {
        checkScrollButtons();
        const el = scrollContainerRef.current;
        if (!el) return;

        el.addEventListener("scroll", checkScrollButtons);
        window.addEventListener("resize", checkScrollButtons);
        return () => {
            el.removeEventListener("scroll", checkScrollButtons);
            window.removeEventListener("resize", checkScrollButtons);
        };
    }, [checkScrollButtons, items]);

    // Scroll active item into view on mount or value change
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el || !value) return;
        const activeBtn = el.querySelector<HTMLButtonElement>(`[data-select-id="${value}"]`);
        if (activeBtn) {
            activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    }, [value]);

    const handleScroll = (direction: "left" | "right") => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const scrollAmount = direction === "left" ? -180 : 180;
        el.scrollBy({ left: scrollAmount, behavior: "smooth" });
    };

    return (
        <div className={cn("relative w-full group/slider", className)}>
            {name && <input type="hidden" name={name} value={value || ""} />}

            {/* Left Scroll Button */}
            {canScrollLeft && (
                <div className="absolute left-1 top-0 bottom-0 z-20 flex items-center pr-1 bg-gradient-to-r from-card via-card/80 to-transparent">
                    <button
                        type="button"
                        onClick={() => handleScroll("left")}
                        disabled={disabled}
                        className="h-6 w-6 rounded-full bg-background/95 border border-border shadow-md flex items-center justify-center text-foreground hover:bg-muted hover:text-primary transition-all cursor-pointer shrink-0"
                        aria-label="Scroll left"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Right Scroll Button */}
            {canScrollRight && (
                <div className="absolute right-1 top-0 bottom-0 z-20 flex items-center pl-1 bg-gradient-to-l from-card via-card/80 to-transparent">
                    <button
                        type="button"
                        onClick={() => handleScroll("right")}
                        disabled={disabled}
                        className="h-6 w-6 rounded-full bg-background/95 border border-border shadow-md flex items-center justify-center text-foreground hover:bg-muted hover:text-primary transition-all cursor-pointer shrink-0"
                        aria-label="Scroll right"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Unified Single Card Container with divided cells (Card เดียว สไลด์ข้าง) */}
            <div
                ref={scrollContainerRef}
                className="w-full flex items-stretch border border-border bg-card rounded-sm overflow-x-auto divide-x divide-border/70 custom-scrollbar-none scroll-smooth snap-x snap-mandatory"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
                {items.map((item) => {
                    const itemDisplayName = getOptionDisplayName(item);
                    const isSelected = String(value) === String(item.id) || (itemDisplayName && value === itemDisplayName);
                    const customIcon = 'icon' in item ? item.icon : null;

                    return (
                        <button
                            key={item.id}
                            data-select-id={String(item.id)}
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange(String(item.id))}
                            className={cn(
                                "snap-start flex-1 min-w-fit flex items-center justify-center gap-2 px-3.5 py-1.5 transition-colors cursor-pointer select-none",
                                isSelected
                                    ? "bg-primary/15 text-primary font-bold"
                                    : "hover:bg-muted/40 text-muted-foreground hover:text-foreground",
                                disabled && "opacity-50 cursor-not-allowed pointer-events-none"
                            )}
                        >
                            <div
                                className={cn(
                                    "p-1 rounded-full flex items-center justify-center shrink-0 transition-colors leading-none",
                                    isSelected
                                        ? "bg-primary/20 text-primary"
                                        : "bg-muted text-muted-foreground"
                                )}
                            >
                                {customIcon || getLandingSportIcon(itemDisplayName, "h-4 w-4")}
                            </div>
                            <span className="text-xs font-semibold whitespace-nowrap">
                                {itemDisplayName}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// Aliases for backward compatibility
export const Select = RadioBtn;
export const SportSelect = RadioBtn;
