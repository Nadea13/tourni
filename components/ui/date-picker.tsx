"use client";

import React, { useState, useMemo } from "react";
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    addMonths,
    subMonths,
    setYear,
    setMonth,
    isValid,
    parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/dropdown";
import { formatDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { useLocale } from "next-intl";

export interface DatePickerProps {
    /** Value in ISO format (YYYY-MM-DD) or empty string/null */
    value?: string | null;
    /** Callback when date changes */
    onChange: (date: string) => void;
    /** Placeholder when no date is selected */
    placeholder?: string;
    /** Disabled state */
    disabled?: boolean;
    /** Additional CSS classes for trigger button or wrapper */
    className?: string;
    /** Display mode: "popover" (Input trigger with slide-down/popover dropdown) or "inline" (always open calendar) */
    mode?: "popover" | "inline";
    /** Minimum selectable year (default: 1940) */
    minYear?: number;
    /** Maximum selectable year (default: current year) */
    maxYear?: number;
    /** Default view year when no value is selected (default: 2000) */
    defaultViewYear?: number;
    /** Size of the popover trigger button */
    size?: "sm" | "default";
    /** Allow clearing the value */
    clearable?: boolean;
    /** Show quick action buttons footer */
    showFooter?: boolean;
}

const MONTHS_TH = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const MONTHS_EN = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const WEEKDAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DatePicker({
    value,
    onChange,
    placeholder,
    disabled = false,
    className,
    mode = "popover",
    minYear = 1940,
    maxYear = new Date().getFullYear(),
    defaultViewYear = 2000,
    size = "default",
    clearable = true,
    showFooter = true,
}: DatePickerProps) {
    const locale = useLocale();
    const isThai = locale === "th";
    const [open, setOpen] = useState(false);

    // Parse date safely
    const parsedDate = useMemo(() => {
        if (!value) return null;
        try {
            const d = parseISO(value);
            return isValid(d) ? d : null;
        } catch {
            return null;
        }
    }, [value]);

    // Calendar navigation view date
    const [viewDate, setViewDate] = useState<Date>(() => {
        if (parsedDate) return parsedDate;
        const now = new Date();
        const targetYear = defaultViewYear !== undefined ? defaultViewYear : now.getFullYear();
        const boundedYear = Math.min(Math.max(targetYear, minYear), maxYear);
        const targetMonth = targetYear === now.getFullYear() ? now.getMonth() : 0;
        return new Date(boundedYear, targetMonth, 1);
    });

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (newOpen) {
            if (parsedDate) {
                setViewDate(parsedDate);
            } else {
                const now = new Date();
                const targetYear = defaultViewYear !== undefined ? defaultViewYear : now.getFullYear();
                const boundedYear = Math.min(Math.max(targetYear, minYear), maxYear);
                const targetMonth = targetYear === now.getFullYear() ? now.getMonth() : 0;
                setViewDate(new Date(boundedYear, targetMonth, 1));
            }
        }
    };

    const birthYears = useMemo(() => {
        const list: number[] = [];
        for (let y = maxYear; y >= minYear; y--) {
            list.push(y);
        }
        return list;
    }, [minYear, maxYear]);

    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(viewDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [viewDate]);

    const handleSelectDate = (day: Date) => {
        const dateStr = format(day, "yyyy-MM-dd");
        onChange(dateStr);
        if (mode === "popover") {
            setOpen(false);
        }
    };

    const handleClear = () => {
        onChange("");
    };

    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();

    const calendarContent = (
        <div className="space-y-2 select-none">
            {/* Header: Month & Year Selectors with Navigation */}
            <div className="flex items-center justify-between gap-1">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setViewDate((prev) => subMonths(prev, 1))}
                    className="flex items-center justify-center p-1.5 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
                    title={isThai ? "เดือนก่อนหน้า" : "Previous month"}
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-1.5">
                    {/* Month Selector */}
                    <Select
                        value={String(currentMonth)}
                        disabled={disabled}
                        onValueChange={(val) => setViewDate((prev) => setMonth(prev, parseInt(val, 10)))}
                    >
                        <SelectTrigger size="sm" className="h-7 px-2 py-0 text-xs font-semibold gap-1 border-border/60 hover:bg-muted/50">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-56 z-[60]">
                            {(isThai ? MONTHS_TH : MONTHS_EN).map((name, idx) => (
                                <SelectItem key={idx} value={String(idx)} className="text-xs">
                                    {name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Year Selector */}
                    <Select
                        value={String(currentYear)}
                        disabled={disabled}
                        onValueChange={(val) => setViewDate((prev) => setYear(prev, parseInt(val, 10)))}
                    >
                        <SelectTrigger size="sm" className="h-7 px-2 py-0 text-xs font-semibold font-mono gap-1 border-border/60 hover:bg-muted/50 min-w-[70px]">
                            <SelectValue>
                                {isThai ? `${currentYear + 543}` : String(currentYear)}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-56 z-[60]">
                            {birthYears.map((y) => (
                                <SelectItem key={y} value={String(y)} className="text-xs font-mono">
                                    {isThai ? `${y + 543}` : y}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setViewDate((prev) => addMonths(prev, 1))}
                    className="flex items-center justify-center p-1.5 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
                    title={isThai ? "เดือนถัดไป" : "Next month"}
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 text-center pt-1">
                {(isThai ? WEEKDAYS_TH : WEEKDAYS_EN).map((d, i) => (
                    <div key={i} className="text-[11px] font-bold text-muted-foreground/80 py-1">
                        {d}
                    </div>
                ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-0.5">
                {calendarDays.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const isSelected = value === dateStr;
                    const isCurrentMonth = day.getMonth() === currentMonth;
                    const isToday = dateStr === format(new Date(), "yyyy-MM-dd");

                    return (
                        <button
                            key={dateStr}
                            type="button"
                            disabled={disabled}
                            onClick={() => handleSelectDate(day)}
                            className={cn(
                                "h-8 w-full flex items-center justify-center text-xs rounded-sm transition-all relative font-medium",
                                isSelected && "bg-primary text-primary-foreground font-bold shadow-xs z-10",
                                !isSelected && isCurrentMonth && "text-foreground hover:bg-muted",
                                !isSelected && !isCurrentMonth && "text-muted-foreground/40 hover:bg-muted/50",
                                isToday && !isSelected && "border border-primary/50 text-primary font-semibold"
                            )}
                        >
                            {format(day, "d")}
                        </button>
                    );
                })}
            </div>

            {/* Footer */}
            {showFooter && (
                <div className="flex items-center justify-between text-xs pt-2 mt-1 border-t border-border">
                    <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                        {value
                            ? `${isThai ? "เลือก:" : "Selected:"} ${formatDate(value, "d MMM yyyy", locale)}`
                            : (isThai ? "คลิกเลือกวันที่" : "Select a date")}
                    </span>
                    {value && clearable && (
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={handleClear}
                            className="text-destructive text-[11px] font-semibold hover:underline"
                        >
                            {isThai ? "ล้างค่า" : "Clear"}
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    if (mode === "inline") {
        return (
            <div className={cn("p-2 border rounded-sm bg-card text-card-foreground shadow-xs", className)}>
                {calendarContent}
            </div>
        );
    }

    const defaultPlaceholder = isThai ? "เลือกวัน/เดือน/ปีเกิด" : "Select date of birth";

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                        "rounded-sm placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground w-full min-w-0 border transition-all duration-500 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 font-medium",
                        "flex items-center justify-between gap-2 text-left bg-transparent",
                        size === "sm"
                            ? "px-2 py-1 h-8 text-xs font-semibold"
                            : "px-2 md:px-3 py-2 h-8 lg:h-10 text-base md:text-sm",
                        "bg-[linear-gradient(var(--color-primary),var(--color-primary))] bg-[length:0%_2px] bg-no-repeat bg-[position:bottom_left] focus-visible:bg-[length:100%_2px]",
                        "focus:border-border focus:ring-0 focus:bg-muted/5",
                        open && "border-primary bg-[length:100%_2px]",
                        className
                    )}
                >
                    <span className={cn("truncate", !value && "text-muted-foreground")}>
                        {value ? formatDate(value, "d MMMM yyyy", locale) : (placeholder || defaultPlaceholder)}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                        {value && clearable && (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClear();
                                }}
                                className="p-0.5 hover:text-foreground rounded transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </span>
                        )}
                        <CalendarIcon className={cn(size === "sm" ? "h-4 w-4" : "h-4 w-4")} />
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-72 p-3 bg-popover text-popover-foreground border border-border shadow-xl rounded-sm z-50 animate-in fade-in-50 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 duration-200"
                align="start"
                sideOffset={4}
            >
                {calendarContent}
            </PopoverContent>
        </Popover>
    );
}

export interface DateRangeValue {
    startDate?: string | null;
    endDate?: string | null;
}

export interface DateRangePickerProps {
    /** Start date in ISO format (YYYY-MM-DD) or null */
    startDate?: string | null;
    /** End date in ISO format (YYYY-MM-DD) or null */
    endDate?: string | null;
    /** Callback when date range changes */
    onChange: (range: { startDate: string; endDate: string }) => void;
    /** Placeholder when no date range is selected */
    placeholder?: string;
    /** Disabled state */
    disabled?: boolean;
    /** Additional CSS classes for trigger button */
    className?: string;
    /** Minimum selectable year (default: current year - 1) */
    minYear?: number;
    /** Maximum selectable year (default: current year + 5) */
    maxYear?: number;
    /** Default view year when no value is selected */
    defaultViewYear?: number;
    /** Size of the popover trigger button */
    size?: "sm" | "default";
    /** Allow clearing the value */
    clearable?: boolean;
    /** Show quick action buttons footer */
    showFooter?: boolean;
}

export function DateRangePicker({
    startDate,
    endDate,
    onChange,
    placeholder,
    disabled = false,
    className,
    minYear = new Date().getFullYear() - 5,
    maxYear = new Date().getFullYear() + 10,
    defaultViewYear = new Date().getFullYear(),
    size = "default",
    clearable = true,
    showFooter = true,
}: DateRangePickerProps) {
    const locale = useLocale();
    const isThai = locale === "th";
    const [open, setOpen] = useState(false);
    const [hoverDate, setHoverDate] = useState<string | null>(null);

    // Parse start & end dates safely
    const parsedStartDate = useMemo(() => {
        if (!startDate) return null;
        try {
            const d = parseISO(startDate);
            return isValid(d) ? d : null;
        } catch {
            return null;
        }
    }, [startDate]);

    // Calendar navigation view date
    const [viewDate, setViewDate] = useState<Date>(() => {
        if (parsedStartDate) return parsedStartDate;
        const boundedYear = Math.min(Math.max(defaultViewYear, minYear), maxYear);
        return new Date(boundedYear, new Date().getMonth(), 1);
    });

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (newOpen) {
            if (parsedStartDate) {
                setViewDate(parsedStartDate);
            }
            setHoverDate(null);
        }
    };

    const yearsList = useMemo(() => {
        const list: number[] = [];
        for (let y = maxYear; y >= minYear; y--) {
            list.push(y);
        }
        return list;
    }, [minYear, maxYear]);

    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(viewDate);
        const monthEnd = endOfMonth(monthStart);
        const firstDay = startOfWeek(monthStart);
        const lastDay = endOfWeek(monthEnd);
        return eachDayOfInterval({ start: firstDay, end: lastDay });
    }, [viewDate]);

    const handleSelectDay = (day: Date) => {
        const clickedStr = format(day, "yyyy-MM-dd");

        // Case 1: Neither is selected OR both are already selected -> Start fresh
        if ((!startDate && !endDate) || (startDate && endDate)) {
            onChange({ startDate: clickedStr, endDate: "" });
            return;
        }

        // Case 2: Only startDate is selected
        if (startDate && !endDate) {
            if (clickedStr < startDate) {
                // If clicked date is before start date, make it the new start date
                onChange({ startDate: clickedStr, endDate: "" });
            } else {
                // Set as end date and close popover
                onChange({ startDate, endDate: clickedStr });
                setOpen(false);
            }
        }
    };

    const handleClear = () => {
        onChange({ startDate: "", endDate: "" });
    };

    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();

    // Determine display range label
    const displayLabel = useMemo(() => {
        if (startDate && endDate) {
            return `${formatDate(startDate, "d MMM yyyy", locale)} - ${formatDate(endDate, "d MMM yyyy", locale)}`;
        }
        if (startDate) {
            return `${formatDate(startDate, "d MMM yyyy", locale)} - ...`;
        }
        return placeholder || (isThai ? "เลือกช่วงวันที่ (เริ่ม - สิ้นสุด)" : "Select date range");
    }, [startDate, endDate, locale, placeholder, isThai]);

    const calendarContent = (
        <div className="space-y-2 select-none">
            {/* Header: Month & Year Selectors with Navigation */}
            <div className="flex items-center justify-between gap-1">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setViewDate((prev) => subMonths(prev, 1))}
                    className="flex items-center justify-center p-1.5 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
                    title={isThai ? "เดือนก่อนหน้า" : "Previous month"}
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-1.5">
                    {/* Month Selector */}
                    <Select
                        value={String(currentMonth)}
                        disabled={disabled}
                        onValueChange={(val) => setViewDate((prev) => setMonth(prev, parseInt(val, 10)))}
                    >
                        <SelectTrigger size="sm" className="h-7 px-2 py-0 text-xs font-semibold gap-1 border-border/60 hover:bg-muted/50">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-56 z-[60]">
                            {(isThai ? MONTHS_TH : MONTHS_EN).map((name, idx) => (
                                <SelectItem key={idx} value={String(idx)} className="text-xs">
                                    {name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Year Selector */}
                    <Select
                        value={String(currentYear)}
                        disabled={disabled}
                        onValueChange={(val) => setViewDate((prev) => setYear(prev, parseInt(val, 10)))}
                    >
                        <SelectTrigger size="sm" className="h-7 px-2 py-0 text-xs font-semibold font-mono gap-1 border-border/60 hover:bg-muted/50 min-w-[70px]">
                            <SelectValue>
                                {isThai ? `${currentYear + 543}` : String(currentYear)}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-56 z-[60]">
                            {yearsList.map((y) => (
                                <SelectItem key={y} value={String(y)} className="text-xs font-mono">
                                    {isThai ? `${y + 543}` : y}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setViewDate((prev) => addMonths(prev, 1))}
                    className="flex items-center justify-center p-1.5 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
                    title={isThai ? "เดือนถัดไป" : "Next month"}
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 text-center pt-1">
                {(isThai ? WEEKDAYS_TH : WEEKDAYS_EN).map((d, i) => (
                    <div key={i} className="text-[11px] font-bold text-muted-foreground/80 py-1">
                        {d}
                    </div>
                ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-y-0.5">
                {calendarDays.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const isCurrentMonth = day.getMonth() === currentMonth;
                    const isToday = dateStr === format(new Date(), "yyyy-MM-dd");

                    const isStart = startDate === dateStr;
                    const isEnd = endDate === dateStr;

                    // Range checks
                    let isInRange = false;
                    let isInHoverRange = false;

                    if (startDate && endDate) {
                        isInRange = dateStr >= startDate && dateStr <= endDate;
                    } else if (startDate && !endDate && hoverDate && hoverDate >= startDate) {
                        isInHoverRange = dateStr >= startDate && dateStr <= hoverDate;
                    }

                    return (
                        <div
                            key={dateStr}
                            className={cn(
                                "relative flex items-center justify-center p-0",
                                (isInRange || isInHoverRange) && "bg-primary/10",
                                isStart && (endDate || hoverDate) && "rounded-l-sm",
                                (isEnd || (hoverDate === dateStr && startDate)) && "rounded-r-sm"
                            )}
                            onMouseEnter={() => {
                                if (startDate && !endDate) {
                                    setHoverDate(dateStr);
                                }
                            }}
                        >
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => handleSelectDay(day)}
                                className={cn(
                                    "h-8 w-full flex items-center justify-center text-xs rounded-sm transition-all relative font-medium",
                                    (isStart || isEnd) && "bg-primary text-primary-foreground font-bold shadow-xs z-10",
                                    !isStart && !isEnd && isCurrentMonth && "text-foreground hover:bg-muted/70",
                                    !isStart && !isEnd && !isCurrentMonth && "text-muted-foreground/40 hover:bg-muted/50",
                                    isToday && !isStart && !isEnd && "border border-primary/50 text-primary font-semibold"
                                )}
                            >
                                {format(day, "d")}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            {showFooter && (
                <div className="flex items-center justify-between text-xs pt-2 mt-1 border-t border-border">
                    <span className="text-[11px] text-muted-foreground truncate max-w-[190px]">
                        {startDate && endDate
                            ? `${formatDate(startDate, "d MMM", locale)} - ${formatDate(endDate, "d MMM yy", locale)}`
                            : startDate
                            ? `${isThai ? "เลือกวันสิ้นสุด..." : "Select end date..."}`
                            : (isThai ? "คลิกเลือกวันเริ่มต้น" : "Select start date")}
                    </span>
                    {(startDate || endDate) && clearable && (
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={handleClear}
                            className="text-destructive text-[11px] font-semibold hover:underline"
                        >
                            {isThai ? "ล้างค่า" : "Clear"}
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                        "rounded-sm placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground w-full min-w-0 border transition-all duration-500 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 font-medium",
                        "flex items-center justify-between gap-2 text-left bg-transparent",
                        size === "sm"
                            ? "px-2 py-1 h-8 text-xs font-semibold"
                            : "px-2 md:px-3 py-2 h-8 lg:h-10 text-base md:text-sm",
                        "bg-[linear-gradient(var(--color-primary),var(--color-primary))] bg-[length:0%_2px] bg-no-repeat bg-[position:bottom_left] focus-visible:bg-[length:100%_2px]",
                        "focus:border-border focus:ring-0 focus:bg-muted/5",
                        open && "border-primary bg-[length:100%_2px]",
                        className
                    )}
                >
                    <span className={cn("truncate", (!startDate && !endDate) && "text-muted-foreground")}>
                        {displayLabel}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                        {(startDate || endDate) && clearable && (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClear();
                                }}
                                className="p-0.5 hover:text-foreground rounded transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </span>
                        )}
                        <CalendarIcon className={cn(size === "sm" ? "h-4 w-4" : "h-4 w-4")} />
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-72 p-3 bg-popover text-popover-foreground border border-border shadow-xl rounded-sm z-50 animate-in fade-in-50 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 duration-200"
                align="start"
                sideOffset={4}
            >
                {calendarContent}
            </PopoverContent>
        </Popover>
    );
}

