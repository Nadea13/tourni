"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "next-intl";

export interface DateTimePickerProps {
    date?: string | null; // format: "YYYY-MM-DD"
    time?: string | null; // format: "HH:mm"
    onChange: (date: string, time: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    size?: "sm" | "default";
}

export function DateTimePicker({
    date,
    time,
    onChange,
    placeholder,
    disabled = false,
    className,
    size = "sm"
}: DateTimePickerProps) {
    const locale = useLocale();
    const dateFnsLocale = locale === "th" ? th : enUS;
    const isThai = locale === "th";

    const [open, setOpen] = useState(false);

    // Parse incoming date/time or default
    const parsedDate = useMemo(() => {
        if (!date) return null;
        try {
            const [y, m, d] = date.split("-").map(Number);
            if (!y || !m || !d) return null;
            return new Date(y, m - 1, d);
        } catch {
            return null;
        }
    }, [date]);

    const [viewDate, setViewDate] = useState<Date>(() => parsedDate || new Date());
    const selectedDate = parsedDate;

    const selectedHour = useMemo(() => {
        if (time && time.includes(":")) {
            const h = parseInt(time.split(":")[0], 10);
            return isNaN(h) ? 12 : Math.min(Math.max(h, 0), 23);
        }
        return 12;
    }, [time]);

    const selectedMinute = useMemo(() => {
        if (time && time.includes(":")) {
            const m = parseInt(time.split(":")[1], 10);
            return isNaN(m) ? 0 : Math.min(Math.max(m, 0), 59);
        }
        return 0;
    }, [time]);

    const hourListRef = useRef<HTMLDivElement>(null);
    const minuteListRef = useRef<HTMLDivElement>(null);

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (newOpen && parsedDate) {
            setViewDate(parsedDate);
        }
    };

    // Scroll active hour and minute into view when popover opens or values change
    useEffect(() => {
        if (open) {
            setTimeout(() => {
                if (hourListRef.current) {
                    const activeHourEl = hourListRef.current.querySelector('[data-selected="true"]');
                    if (activeHourEl) {
                        activeHourEl.scrollIntoView({ block: "center", behavior: "smooth" });
                    }
                }
                if (minuteListRef.current) {
                    const activeMinuteEl = minuteListRef.current.querySelector('[data-selected="true"]');
                    if (activeMinuteEl) {
                        activeMinuteEl.scrollIntoView({ block: "center", behavior: "smooth" });
                    }
                }
            }, 100);
        }
    }, [open, selectedHour, selectedMinute]);

    // Format for display
    const formattedDisplay = useMemo(() => {
        if (!selectedDate) return null;

        const yearFormatted = isThai ? selectedDate.getFullYear() + 543 : selectedDate.getFullYear();
        const dateFormatted = `${format(selectedDate, "dd MMM", { locale: dateFnsLocale })} ${yearFormatted}`;
        const timeFormatted = `${String(selectedHour).padStart(2, "0")}:${String(selectedMinute).padStart(2, "0")}`;
        return `${dateFormatted} | ${timeFormatted}`;
    }, [selectedDate, selectedHour, selectedMinute, dateFnsLocale, isThai]);

    // Emit change
    const emitChange = (newDate: Date | null, newHour: number, newMinute: number) => {
        if (!newDate) {
            onChange("", "");
            return;
        }
        const dateStr = format(newDate, "yyyy-MM-dd");
        const timeStr = `${String(newHour).padStart(2, "0")}:${String(newMinute).padStart(2, "0")}`;
        onChange(dateStr, timeStr);
    };

    const handleSelectDay = (day: Date) => {
        emitChange(day, selectedHour, selectedMinute);
    };

    const handleSelectHour = (h: number) => {
        emitChange(selectedDate || new Date(), h, selectedMinute);
    };

    const handleSelectMinute = (m: number) => {
        emitChange(selectedDate || new Date(), selectedHour, m);
    };

    const stepHour = (delta: number) => {
        const nextH = (selectedHour + delta + 24) % 24;
        handleSelectHour(nextH);
    };

    const stepMinute = (delta: number) => {
        const nextM = (selectedMinute + delta + 60) % 60;
        handleSelectMinute(nextM);
    };

    const handleSetNow = () => {
        const now = new Date();
        setViewDate(now);
        const h = now.getHours();
        const m = now.getMinutes();
        emitChange(now, h, m);
    };

    const handleClear = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        onChange("", "");
    };

    // Calendar month calculations
    const calendarDays = useMemo(() => {
        const start = startOfMonth(viewDate);
        const end = endOfMonth(viewDate);
        const firstDayIndex = getDay(start); // 0 = Sunday
        const daysInMonth = eachDayOfInterval({ start, end });

        const days: (Date | null)[] = [];
        for (let i = 0; i < firstDayIndex; i++) {
            days.push(null);
        }
        daysInMonth.forEach((d) => days.push(d));
        return days;
    }, [viewDate]);

    const weekDays = useMemo(() => {
        return isThai 
            ? ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] 
            : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    }, [isThai]);

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 60 }, (_, i) => i);

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <div
                    className={cn(
                        "flex items-center justify-between rounded-sm border border-input bg-card px-2.5 py-1.5 text-xs ring-offset-background transition-colors hover:bg-muted/50 cursor-pointer select-none",
                        size === "sm" ? "h-8 text-xs" : "h-9 text-sm",
                        disabled && "cursor-not-allowed opacity-50",
                        open && "ring-1 ring-ring",
                        className
                    )}
                >
                    <div className="flex items-center gap-2 truncate">
                        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {formattedDisplay ? (
                            <span className="font-semibold text-foreground truncate">{formattedDisplay}</span>
                        ) : (
                            <span className="text-muted-foreground truncate">
                                {placeholder || (isThai ? "เลือกวันและเวลาแข่ง" : "Select date & time")}
                            </span>
                        )}
                    </div>
                    {formattedDisplay && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="ml-1 p-0.5 text-muted-foreground/60 hover:text-destructive transition-colors rounded-sm"
                            title={isThai ? "ล้างข้อมูล" : "Clear"}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </PopoverTrigger>
            <PopoverContent
                className="w-auto p-0 bg-card border border-border shadow-2xl rounded-sm overflow-hidden z-[100]"
                align="start"
                sideOffset={4}
            >
                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
                    {/* Calendar Section */}
                    <div className="p-3 w-[280px]">
                        {/* Month & Year Navigation Header */}
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black tracking-tight text-foreground capitalize">
                                {format(viewDate, "MMMM", { locale: dateFnsLocale })} {isThai ? viewDate.getFullYear() + 543 : viewDate.getFullYear()}
                            </span>
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    onClick={() => setViewDate((prev) => subMonths(prev, 1))}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    onClick={() => setViewDate((prev) => addMonths(prev, 1))}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Weekday Labels */}
                        <div className="grid grid-cols-7 gap-1 text-center mb-1">
                            {weekDays.map((wd, i) => (
                                <div
                                    key={i}
                                    className="text-[10px] font-bold text-muted-foreground/70 h-6 flex items-center justify-center"
                                >
                                    {wd}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((day, idx) => {
                                if (!day) {
                                    return <div key={`empty-${idx}`} className="h-7 w-7" />;
                                }

                                const isSel = selectedDate && isSameDay(day, selectedDate);
                                const isCurrentToday = isToday(day);

                                return (
                                    <button
                                        key={day.toISOString()}
                                        type="button"
                                        onClick={() => handleSelectDay(day)}
                                        className={cn(
                                            "h-7 w-7 rounded flex items-center justify-center text-[11px] transition-colors relative font-medium",
                                            isSel
                                                ? "bg-primary text-primary-foreground font-bold shadow-sm"
                                                : "text-foreground hover:bg-muted",
                                            isCurrentToday && !isSel && "border border-primary/60 text-primary font-bold"
                                        )}
                                    >
                                        {format(day, "d")}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 24-Hour Unified Time Picker Card (Without Scrollbar, with Select-like Step Arrows) */}
                    <div className="w-[170px] flex flex-col justify-center">
                        <div className="flex flex-col overflow-hidden">
                            {/* Column Header */}
                            <div className="grid grid-cols-2 text-center py-1.5 border-b text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                <span>{isThai ? "ชั่วโมง" : "Hour"}</span>
                                <span>{isThai ? "นาที" : "Min"}</span>
                            </div>

                            {/* Select-like Scroll Up Buttons */}
                            <div className="grid grid-cols-2 border-b">
                                <button
                                    type="button"
                                    onClick={() => stepHour(-1)}
                                    className="flex items-center justify-center py-1.5 text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors"
                                    title={isThai ? "ลดชั่วโมง" : "Previous hour"}
                                >
                                    <ChevronUp className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => stepMinute(-1)}
                                    className="flex items-center justify-center py-1.5 text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors"
                                    title={isThai ? "ลดนาที" : "Previous minute"}
                                >
                                    <ChevronUp className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Scrollable Lists without visible scrollbar */}
                            <div className="grid grid-cols-2 h-[150px] relative divide-x select-none">
                                {/* Hours Column */}
                                <div
                                    ref={hourListRef}
                                    className="overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-1 space-y-0.5"
                                >
                                    {hours.map((h) => {
                                        const isSel = selectedHour === h;
                                        return (
                                            <button
                                                key={h}
                                                type="button"
                                                data-selected={isSel}
                                                onClick={() => handleSelectHour(h)}
                                                className={cn(
                                                    "w-full text-center py-1 rounded text-xs transition-colors font-mono font-medium",
                                                    isSel
                                                        ? "bg-primary text-primary-foreground font-bold shadow-sm"
                                                        : "text-foreground hover:bg-muted"
                                                )}
                                            >
                                                {String(h).padStart(2, "0")}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Minutes Column */}
                                <div
                                    ref={minuteListRef}
                                    className="overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-1 space-y-0.5"
                                >
                                    {minutes.map((m) => {
                                        const isSel = selectedMinute === m;
                                        return (
                                            <button
                                                key={m}
                                                type="button"
                                                data-selected={isSel}
                                                onClick={() => handleSelectMinute(m)}
                                                className={cn(
                                                    "w-full text-center py-1 rounded text-xs transition-colors font-mono font-medium",
                                                    isSel
                                                        ? "bg-primary text-primary-foreground font-bold shadow-sm"
                                                        : "text-foreground hover:bg-muted"
                                                )}
                                            >
                                                {String(m).padStart(2, "0")}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Select-like Scroll Down Buttons */}
                            <div className="grid grid-cols-2 border-t">
                                <button
                                    type="button"
                                    onClick={() => stepHour(1)}
                                    className="flex items-center justify-center py-1.5 text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors"
                                    title={isThai ? "เพิ่มชั่วโมง" : "Next hour"}
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => stepMinute(1)}
                                    className="flex items-center justify-center py-1.5 text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors"
                                    title={isThai ? "เพิ่มนาที" : "Next minute"}
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Quick Actions */}
                <div className="flex items-center justify-between p-2 bg-muted/20 border-t border-border text-xs">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleSetNow}
                        className="h-7 text-[11px] font-semibold px-2"
                    >
                        {isThai ? "ตอนนี้" : "Now"}
                    </Button>
                    <div className="flex items-center gap-1.5">
                        {selectedDate && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleClear()}
                                className="h-7 text-[11px] text-muted-foreground hover:text-destructive px-2"
                            >
                                {isThai ? "ล้าง" : "Clear"}
                            </Button>
                        )}
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => setOpen(false)}
                            className="h-7 text-[11px] font-bold px-3 gap-1"
                        >
                            <Check className="h-4 w-4" />
                            <span>{isThai ? "เสร็จสิ้น" : "Done"}</span>
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
