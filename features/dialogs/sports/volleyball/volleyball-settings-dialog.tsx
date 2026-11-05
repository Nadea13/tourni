"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Header } from "@/components/ui/header";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    ChevronDown,
    ChevronUp,
    Clock,
    Ban,
    Trophy,
    BarChart2,
    Zap,
    Flame,
    ShieldCheck,
    Volleyball,
    Hand,
    RotateCw,
    Square,
    Video,
} from "lucide-react";
import { Match } from "@/types";

export interface VolleyballSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    match: Match;
    readOnly?: boolean;
    customActionTypes: string[];
    onToggleCustomAction: (type: string) => void;
    visibleLogs: string[];
    onToggleVisibleLog: (type: string) => void;
    visibleStats: string[];
    onToggleVisibleStat: (statKey: string) => void;
    onPostponeMatch: () => void;
    onWalkover: () => void;
    onAbandonMatch: () => void;
}

export function VolleyballSettingsDialog({
    open,
    onOpenChange,
    match,
    readOnly,
    customActionTypes,
    onToggleCustomAction,
    visibleLogs,
    onToggleVisibleLog,
    visibleStats,
    onToggleVisibleStat,
    onPostponeMatch,
    onWalkover,
    onAbandonMatch,
}: VolleyballSettingsDialogProps) {
    const tConsole = useTranslations("Console");
    const tCommon = useTranslations("Common");
    const locale = useLocale();

    const [isActionsExpanded, setIsActionsExpanded] = useState(false);
    const [isLogsExpanded, setIsLogsExpanded] = useState(false);
    const [isStatsExpanded, setIsStatsExpanded] = useState(false);

    const allActionItems = [
        { type: 'point', label: locale === "th" ? "Point (ได้แต้ม)" : "Point", icon: Volleyball },
        { type: 'ace', label: locale === "th" ? "Ace (เสิร์ฟเอซ)" : "Ace (Serve)", icon: Zap },
        { type: 'spike', label: locale === "th" ? "Attack / Spike (ตบทำแต้ม)" : "Attack / Spike", icon: Flame },
        { type: 'block', label: locale === "th" ? "Block (บล็อกทำแต้ม)" : "Block", icon: ShieldCheck },
        { type: 'substitution', label: locale === "th" ? "Substitution (เปลี่ยนตัว)" : "Substitution", icon: RotateCw },
        { type: 'timeout', label: locale === "th" ? "Timeout (ขอเวลานอก)" : "Timeout", icon: Clock },
        { type: 'foul', label: locale === "th" ? "Foul (ฟาวล์)" : "Foul", icon: Hand },
        { type: 'challenge', label: locale === "th" ? "Challenge (วิดีโอชาเลนจ์)" : "Challenge", icon: Video },
        { type: 'sanction', label: locale === "th" ? "Sanctions (การลงโทษ / ใบเตือน)" : "Sanctions", icon: Square },
    ];

    const allLogItems = [
        { key: 'point', label: tConsole("point") || "คะแนนทั่วไป", icon: Volleyball },
        { key: 'ace', label: "Ace (เสิร์ฟเอซ)", icon: Zap },
        { key: 'spike', label: "Spike (ตบ)", icon: Flame },
        { key: 'block', label: "Block (บล็อก)", icon: ShieldCheck },
        { key: 'substitution', label: tConsole("substitution") || "เปลี่ยนตัว", icon: RotateCw },
        { key: 'timeout', label: tConsole("timeout") || "ขอเวลานอก", icon: Clock },
        { key: 'foul', label: tConsole("foul") || "ฟาวล์", icon: Hand },
        { key: 'challenge', label: locale === "th" ? "Challenge (วิดีโอชาเลนจ์)" : "Challenge", icon: Hand },
        { key: 'sanction', label: locale === "th" ? "การลงโทษ (ใบเตือน/ทำฟาวล์)" : "Sanctions", icon: Square },
        { key: 'set_start', label: locale === "th" ? "เริ่มเซต" : "Set Start", icon: Clock },
        { key: 'set_end', label: locale === "th" ? "จบเซต" : "Set End", icon: Trophy },
        { key: 'match_end', label: locale === "th" ? "จบการแข่งขัน" : "Match End", icon: Trophy },
    ];

    const allStatItems = [
        { key: 'sets_won', label: tConsole("sets_won") || "เซตที่ชนะ (Sets Won)", icon: Trophy },
        { key: 'current_set_points', label: tConsole("current_set_points") || "คะแนนเซตปัจจุบัน", icon: BarChart2 },
        { key: 'total_points', label: tConsole("total_points") || "คะแนนรวมทั้งหมด", icon: BarChart2 },
        { key: 'ace', label: "Ace (เสิร์ฟเอซ)", icon: Zap },
        { key: 'spike', label: "Spike (ตบทำแต้ม)", icon: Flame },
        { key: 'block', label: "Block (บล็อกทำแต้ม)", icon: ShieldCheck },
        { key: 'other_points', label: tConsole("other_points") || "แต้มอื่นๆ", icon: BarChart2 },
    ];

    // Actions list calculation
    const enabledActions = allActionItems.filter(item => customActionTypes.includes(item.type));
    const disabledActions = allActionItems.filter(item => !customActionTypes.includes(item.type));
    const displayedActions = isActionsExpanded
        ? [...enabledActions, ...disabledActions]
        : enabledActions.slice(0, 4);
    const hasMoreActionsToShow = enabledActions.length > 4 || disabledActions.length > 0;

    // Logs list calculation
    const enabledLogs = allLogItems.filter(item => visibleLogs.includes(item.key));
    const disabledLogs = allLogItems.filter(item => !visibleLogs.includes(item.key));
    const displayedLogs = isLogsExpanded
        ? [...enabledLogs, ...disabledLogs]
        : enabledLogs.slice(0, 5);
    const hasMoreLogsToShow = enabledLogs.length > 5 || disabledLogs.length > 0;

    // Stats list calculation
    const enabledStats = allStatItems.filter(item => visibleStats.includes(item.key));
    const disabledStats = allStatItems.filter(item => !visibleStats.includes(item.key));
    const displayedStats = isStatsExpanded
        ? [...enabledStats, ...disabledStats]
        : enabledStats.slice(0, 5);
    const hasMoreStatsToShow = enabledStats.length > 5 || disabledStats.length > 0;

    const isMatchLocked = readOnly || match.status === 'finished' || match.status === 'canceled';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col bg-card rounded-sm p-0 overflow-hidden border border-border">
                <DialogHeader className="p-4 border-b border-border shrink-0 bg-card">
                    <DialogTitle className="text-lg md:text-xl font-black tracking-tighter text-foreground leading-none">
                        {tConsole("settings") || "ตั้งค่า"}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        {locale === "th" ? "จัดการการแสดงผลปุ่ม สถิติ บันทึกเหตุการณ์ และสถานะแมตช์" : "Manage buttons, statistics, event logs, and match status"}
                    </p>
                </DialogHeader>

                {/* Scrollable Content Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* SECTION 1: Action Buttons */}
                    <section id="settings-section-actions" className="space-y-2">
                        <Header level={6}>{tConsole("tab_buttons") || "ปุ่มเหตุการณ์"}</Header>
                        <div className="space-y-1">
                            {/* Customizable Action Buttons */}
                            {displayedActions.map((item) => {
                                const isSelected = customActionTypes.includes(item.type);
                                return (
                                    <div
                                        key={item.type}
                                        onClick={() => onToggleCustomAction(item.type)}
                                        className="flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-sm"
                                    >
                                        <div className="flex items-center gap-2 px-4 py-2">
                                            <div className="size-8 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                                <item.icon className="size-4 text-muted-foreground" />
                                            </div>
                                            <Label className="cursor-pointer">{item.label}</Label>
                                        </div>
                                        <div className="px-4">
                                            <Switch
                                                checked={isSelected}
                                                onCheckedChange={() => onToggleCustomAction(item.type)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="cursor-pointer shrink-0"
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Expand/Collapse Badge Button */}
                            {hasMoreActionsToShow && (
                                <div className="flex justify-center pt-1.5">
                                    <Badge
                                        variant="outline"
                                        className="cursor-pointer hover:bg-muted/60 transition-colors"
                                        onClick={() => setIsActionsExpanded(!isActionsExpanded)}
                                    >
                                        {isActionsExpanded ? (
                                            <>
                                                <span>{locale === "th" ? "แสดงน้อยลง" : "Show less"}</span>
                                                <ChevronUp className="h-3.5 w-3.5" />
                                            </>
                                        ) : (
                                            <>
                                                <span>{locale === "th" ? "แสดงเพิ่มเติม" : "Show more"}</span>
                                                <ChevronDown className="h-3.5 w-3.5" />
                                            </>
                                        )}
                                    </Badge>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* SECTION 2: Match Log Display */}
                    <section id="settings-section-logs" className="space-y-2">
                        <Header level={6}>{tConsole("tab_logs") || "บันทึกเหตุการณ์"}</Header>
                        <div className="space-y-1">
                            {displayedLogs.map((item) => {
                                const isSelected = visibleLogs.includes(item.key);
                                return (
                                    <div
                                        key={item.key}
                                        onClick={() => onToggleVisibleLog(item.key)}
                                        className="flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-sm"
                                    >
                                        <div className="flex items-center gap-2 px-4 py-2">
                                            <div className="size-8 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                                <item.icon className="size-4 text-muted-foreground" />
                                            </div>
                                            <Label className="cursor-pointer">{item.label}</Label>
                                        </div>
                                        <div className="px-4">
                                            <Switch
                                                checked={isSelected}
                                                onCheckedChange={() => onToggleVisibleLog(item.key)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="cursor-pointer shrink-0"
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Expand/Collapse Badge Button */}
                            {hasMoreLogsToShow && (
                                <div className="flex justify-center pt-1.5">
                                    <Badge
                                        variant="outline"
                                        className="cursor-pointer hover:bg-muted/60 transition-colors"
                                        onClick={() => setIsLogsExpanded(!isLogsExpanded)}
                                    >
                                        {isLogsExpanded ? (
                                            <>
                                                <span>{locale === "th" ? "แสดงน้อยลง" : "Show less"}</span>
                                                <ChevronUp className="h-3.5 w-3.5" />
                                            </>
                                        ) : (
                                            <>
                                                <span>{locale === "th" ? "แสดงเพิ่มเติม" : "Show more"}</span>
                                                <ChevronDown className="h-3.5 w-3.5" />
                                            </>
                                        )}
                                    </Badge>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* SECTION 3: Match Statistics */}
                    <section id="settings-section-stats" className="space-y-2">
                        <Header level={6}>{tConsole("tab_stats") || "สถิติการแข่งขัน"}</Header>
                        <div className="space-y-1">
                            {displayedStats.map((item) => {
                                const isSelected = visibleStats.includes(item.key);
                                return (
                                    <div
                                        key={item.key}
                                        onClick={() => onToggleVisibleStat(item.key)}
                                        className="flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-sm"
                                    >
                                        <div className="flex items-center gap-2 px-4 py-2">
                                            <div className="size-8 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                                <item.icon className="size-4 text-muted-foreground" />
                                            </div>
                                            <Label className="cursor-pointer">{item.label}</Label>
                                        </div>
                                        <div className="px-4">
                                            <Switch
                                                checked={isSelected}
                                                onCheckedChange={() => onToggleVisibleStat(item.key)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="cursor-pointer shrink-0"
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Expand/Collapse Badge Button */}
                            {hasMoreStatsToShow && (
                                <div className="flex justify-center pt-1.5">
                                    <Badge
                                        variant="outline"
                                        className="cursor-pointer hover:bg-muted/60 transition-colors"
                                        onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                                    >
                                        {isStatsExpanded ? (
                                            <>
                                                <span>{locale === "th" ? "แสดงน้อยลง" : "Show less"}</span>
                                                <ChevronUp className="h-3.5 w-3.5" />
                                            </>
                                        ) : (
                                            <>
                                                <span>{locale === "th" ? "แสดงเพิ่มเติม" : "Show more"}</span>
                                                <ChevronDown className="h-3.5 w-3.5" />
                                            </>
                                        )}
                                    </Badge>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* SECTION 4: Warning Zone */}
                    <section id="settings-section-warning" className="space-y-1 border border-warning/50 rounded-sm p-4">
                        <Header level={6} className="text-warning">
                            {locale === "th" ? "โซนแจ้งเตือน" : "Warning Zone"}
                        </Header>
                        <p className="text-xs text-muted-foreground">
                            {locale === "th" ? "การดำเนินการเหล่านี้จะส่งผลกระทบต่อตารางเวลาหรือกำหนดการแข่งขัน" : "These actions will affect match schedules and dates."}
                        </p>

                        {/* เลื่อนการแข่งขัน (Postpone Match) */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 px-4 py-2">
                                <div className="size-8 rounded-sm bg-warning/10 flex items-center justify-center">
                                    <Clock className="size-4 text-warning" />
                                </div>
                                <div className="space-y-1">
                                    <Label>{tConsole("postponed") || "เลื่อนการแข่งขัน"}</Label>
                                    <p className="text-xs text-muted-foreground">
                                        {locale === "th" ? "เปลี่ยนสถานะแมตช์เป็นรอแข่งขัน และล้างวัน เวลา" : "Reschedule match and reset match date/time"}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onPostponeMatch}
                                disabled={isMatchLocked}
                                className="text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                            >
                                {tConsole("postponed") || "เลื่อนการแข่งขัน"}
                            </Button>
                        </div>
                    </section>

                    {/* SECTION 5: Danger Zone */}
                    <section id="settings-section-danger" className="space-y-1 border border-destructive/50 rounded-sm p-4">
                        <Header level={6} className="text-destructive">
                            {tConsole("danger_zone") || (locale === "th" ? "โซนอันตราย" : "Danger Zone")}
                        </Header>
                        <p className="text-xs text-muted-foreground">
                            {locale === "th" ? "การดำเนินการเหล่านี้จะส่งผลกระทบต่อผลการแข่งขันหรือสถานะแมตช์โดยตรง โปรดใช้ความระมัดระวัง" : "These actions will affect match results directly."}
                        </p>

                        {/* จบการแข่งขันก่อนเวลา (Walkover / Early Finish) */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 px-4 py-2">
                                <div className="size-8 rounded-sm bg-destructive/10 flex items-center justify-center">
                                    <Trophy className="size-4 text-destructive" />
                                </div>
                                <div className="space-y-1">
                                    <Label>{tConsole("walkover") || "จบการแข่งขันก่อนเวลา"}</Label>
                                    <p className="text-xs text-muted-foreground">
                                        {locale === "th" ? "บันทึกผลชนะบาย (3-0 หรือ 0-3) และยุติการแข่งขันทันที" : "Award walkover victory (3-0 or 0-3) and end match"}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={onWalkover}
                                disabled={isMatchLocked}
                                className="cursor-pointer"
                            >
                                {tConsole("walkover") || "จบการแข่งขันก่อนเวลา"}
                            </Button>
                        </div>

                        {/* ยกเลิกการแข่งขัน (Abandon Match) */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 px-4 py-2">
                                <div className="size-8 rounded-sm bg-destructive/10 flex items-center justify-center">
                                    <Ban className="size-4 text-destructive" />
                                </div>
                                <div className="space-y-1">
                                    <Label>{tConsole("abandoned") || "ยกเลิกการแข่งขัน"}</Label>
                                    <p className="text-xs text-muted-foreground">
                                        {locale === "th" ? "ยกเลิกแมตช์นี้ (Canceled) โดยไม่มีผลคะแนนแพ้ชนะ" : "Cancel and abandon this match without recorded winner"}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={onAbandonMatch}
                                disabled={isMatchLocked}
                                className="cursor-pointer"
                            >
                                {tConsole("abandoned") || "ยกเลิกการแข่งขัน"}
                            </Button>
                        </div>
                    </section>
                </div>

                {/* Dialog Footer */}
                <DialogFooter className="p-4 border-t border-border bg-card shrink-0 flex flex-row items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                        {locale === "th" ? "การตั้งค่าจะถูกบันทึกอัตโนมัติ" : "Settings saved automatically"}
                    </span>
                    <Button
                        size="sm"
                        className="h-8 text-xs font-semibold px-5 cursor-pointer ml-auto"
                        onClick={() => onOpenChange(false)}
                    >
                        {tCommon("done") || "เสร็จสิ้น"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
