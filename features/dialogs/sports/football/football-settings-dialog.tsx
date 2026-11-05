"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Header } from "@/components/ui/header";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Percent,
    Volleyball,
    Square,
    Repeat,
    Activity,
    Flag,
    Shield,
    Stethoscope,
    Crosshair,
    MoveRight,
    ArrowUpRight,
    CornerUpRight,
    Scissors,
    FlagTriangleRight,
    ChevronDown,
    ChevronUp,
    Target,
    MonitorPlay,
    Clock,
    Ban,
    PieChart,
    Trophy,
} from "lucide-react";
import { Match } from "@/types";

export interface FootballSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    match: Match;
    readOnly?: boolean;
    isFutsal?: boolean;
    showScoreboardPossession: boolean;
    onToggleScoreboardPossession: (enabled: boolean) => void;
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

export function FootballSettingsDialog({
    open,
    onOpenChange,
    match,
    readOnly,
    isFutsal,
    showScoreboardPossession,
    onToggleScoreboardPossession,
    customActionTypes,
    onToggleCustomAction,
    visibleLogs,
    onToggleVisibleLog,
    visibleStats,
    onToggleVisibleStat,
    onPostponeMatch,
    onWalkover,
    onAbandonMatch,
}: FootballSettingsDialogProps) {
    const t = useTranslations("Console");
    const locale = useLocale();

    const isFutsalSport = Boolean(
        isFutsal ||
        (match as any).sport === 'futsal' ||
        (match as any).sport?.includes('futsal') ||
        (match as any).sport?.includes('ฟุตซอล') ||
        (match as any).sport_name?.toLowerCase().includes('futsal') ||
        (match as any).sport_name?.includes('ฟุตซอล')
    );

    const [isActionsExpanded, setIsActionsExpanded] = useState(false);
    const [isLogsExpanded, setIsLogsExpanded] = useState(false);
    const [isStatsExpanded, setIsStatsExpanded] = useState(false);

    const allActionItems = [
        { type: 'yellow_card', label: t("cards") || "คาดโทษ (ใบเตือน)", icon: Square },
        { type: 'substitution', label: t("substitution") || "เปลี่ยนตัว", icon: Repeat },
        { type: 'foul', label: t("foul") || "ฟาวล์", icon: Activity },
        { type: 'corner', label: t("corner") || "เตะมุม", icon: Flag },
        { type: 'save', label: t("save") || "เซฟ", icon: Shield },
        { type: 'injury', label: t("injury") || "บาดเจ็บ", icon: Stethoscope },
        { type: 'missed_shot', label: t("missed_shot") || "ยิงพลาด", icon: Crosshair },
        { type: 'pass', label: t("pass") || "จ่ายบอล", icon: MoveRight },
        { type: 'bad_pass', label: t("bad_pass") || "ออกข้าง", icon: ArrowUpRight },
        { type: 'cross', label: t("cross") || "ครอสบอล", icon: CornerUpRight },
        { type: 'possession', label: t("possession_action") || "การครองบอล (ตัดบอล)", icon: Scissors },
        ...(isFutsalSport ? [] : [{ type: 'offside', label: t("offside") || "ล้ำหน้า", icon: FlagTriangleRight }]),
    ];

    const allLogItems = [
        { key: 'goal', label: t("goal") || "ประตู", icon: Volleyball },
        { key: 'penalty_shot', label: t("penalty") || "จุดโทษ / ดวลจุดโทษ", icon: Target },
        { key: 'yellow_card', label: t("yellow_card") || "ใบเหลือง", icon: Square },
        { key: 'red_card', label: t("red_card") || "ใบแดง", icon: Square },
        { key: 'substitution', label: t("substitution") || "เปลี่ยนตัว", icon: Repeat },
        { key: 'foul', label: t("foul") || "ฟาวล์", icon: Activity },
        { key: 'corner', label: t("corner") || "เตะมุม", icon: Flag },
        { key: 'save', label: t("save") || "เซฟ", icon: Shield },
        ...(isFutsalSport ? [] : [{ key: 'offside', label: t("offside") || "ล้ำหน้า", icon: FlagTriangleRight }]),
        { key: 'missed_shot', label: t("missed_shot") || "ยิงพลาด", icon: Crosshair },
        { key: 'pass', label: t("pass") || "จ่ายบอล", icon: MoveRight },
        { key: 'bad_pass', label: t("bad_pass") || "ออกข้าง / จ่ายเสีย", icon: ArrowUpRight },
        { key: 'cross', label: t("cross") || "ครอสบอล", icon: CornerUpRight },
        { key: 'possession', label: t("possession_action") || "การครองบอล (ตัดบอล)", icon: Scissors },
        { key: 'injury', label: t("injury") || "บาดเจ็บ", icon: Stethoscope },
        { key: 'var', label: t("var") || "VAR", icon: MonitorPlay },
        { key: 'period_lifecycle', label: t("match_period") || "ช่วงเวลาการแข่งขัน (เริ่มเกม, พักครึ่ง, จบเกม)", icon: Clock },
        ...(isFutsalSport ? [] : [{ key: 'add_time', label: t("add_time") || "ทดเวลาบาดเจ็บ", icon: Clock }]),
        { key: 'walkover', label: t("walkover") || "ชนะบาย / จบการแข่งขันก่อนเวลา", icon: Ban },
    ];

    const allStatItems = [
        { key: 'possession', label: t("possession") || "การครองบอล", icon: PieChart },
        { key: 'goal', label: t("goal") || "ประตู", icon: Volleyball },
        { key: 'total_shots', label: t("total_shots") || "โอกาสยิงประตู", icon: Target },
        { key: 'missed_shot', label: t("missed_shot") || "ยิงพลาด", icon: Crosshair },
        { key: 'pass', label: t("pass") || "จ่ายบอล", icon: MoveRight },
        { key: 'bad_pass', label: t("bad_pass") || "ออกข้าง", icon: ArrowUpRight },
        { key: 'cross', label: t("cross") || "ครอสบอล", icon: CornerUpRight },
        { key: 'corner', label: t("corner") || "เตะมุม", icon: Flag },
        { key: 'save', label: t("save") || "เซฟ", icon: Shield },
        { key: 'foul', label: t("foul") || "ฟาวล์", icon: Activity },
        { key: 'penalty', label: t("penalty") || "จุดโทษ", icon: Target },
        { key: 'yellow_card', label: t("yellow_card") || "ใบเหลือง", icon: Square },
        { key: 'red_card', label: t("red_card") || "ใบแดง", icon: Square },
        ...(isFutsalSport ? [] : [{ key: 'offside', label: t("offside") || "ล้ำหน้า", icon: FlagTriangleRight }]),
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
                        {t("settings") || "ตั้งค่า"}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        {locale === "th" ? "จัดการการแสดงผลปุ่ม สถิติ และกระดานคะแนน" : "Manage buttons, statistics, and scoreboard display"}
                    </p>
                </DialogHeader>

                {/* Scrollable Content Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* SECTION 1: Display Settings */}
                    <section id="settings-section-display" className="space-y-2">
                        <Header level={6}>{t("tab_display")}</Header>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 px-4 py-2">
                                <div className="size-8 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                    <Percent className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Label>
                                        {t("scoreboard_possession") || "แสดงการครองบอลบนสกอร์บอร์ด"}
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        {t("scoreboard_possession_desc") || "เปิด/ปิดการแสดงผลแถบการครองบอล (Possession) บนกระดานคะแนน"}
                                    </p>
                                </div>
                            </div>
                            <Switch
                                id="possession-switch"
                                checked={showScoreboardPossession}
                                onCheckedChange={onToggleScoreboardPossession}
                                className="cursor-pointer shrink-0"
                            />
                        </div>
                    </section>

                    {/* SECTION 2: Action Buttons */}
                    <section id="settings-section-actions" className="space-y-2">
                        <Header level={6}>{t("tab_buttons") || "ปุ่มเหตุการณ์"}</Header>
                        <div className="space-y-1">
                            {/* Goal indicator (Permanent) */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 px-4 py-2">
                                    <div className="size-8 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                        <Volleyball className="size-4 text-muted-foreground" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>{t("goal")}</Label>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <Switch
                                        checked={true}
                                        disabled={true}
                                        className="shrink-0 opacity-60"
                                    />
                                </div>
                            </div>

                            {/* Customizable Action Buttons */}
                            {displayedActions.map((item) => {
                                const isSelected = customActionTypes.includes(item.type);
                                return (
                                    <div
                                        key={item.type}
                                        onClick={() => onToggleCustomAction(item.type)}
                                        className="flex items-center justify-between cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2 px-4 py-2">
                                            <div className="size-8 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                                <item.icon className="size-4 text-muted-foreground" />
                                            </div>
                                            <Label className="cursor-pointer">{item.label}</Label>
                                        </div>
                                        <Switch
                                            checked={isSelected}
                                            onCheckedChange={() => onToggleCustomAction(item.type)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="cursor-pointer shrink-0"
                                        />
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

                    {/* SECTION 3: Match Log Display */}
                    <section id="settings-section-logs" className="space-y-2">
                        <Header level={6}>{t("tab_logs") || "บันทึกเหตุการณ์"}</Header>
                        <div className="space-y-1">
                            {displayedLogs.map((item) => {
                                const isSelected = visibleLogs.includes(item.key);
                                return (
                                    <div
                                        key={item.key}
                                        onClick={() => onToggleVisibleLog(item.key)}
                                        className="flex items-center justify-between cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2 px-4 py-2">
                                            <div className="size-8 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                                <item.icon className="size-4 text-muted-foreground" />
                                            </div>
                                            <Label className="cursor-pointer">{item.label}</Label>
                                        </div>
                                        <Switch
                                            checked={isSelected}
                                            onCheckedChange={() => onToggleVisibleLog(item.key)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="cursor-pointer shrink-0"
                                        />
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

                    {/* SECTION 4: Match Statistics */}
                    <section id="settings-section-stats" className="space-y-2">
                        <Header level={6}>{t("tab_stats") || "สถิติการแข่งขัน"}</Header>
                        <div className="space-y-1">
                            {displayedStats.map((item) => {
                                const isSelected = visibleStats.includes(item.key);
                                return (
                                    <div
                                        key={item.key}
                                        onClick={() => onToggleVisibleStat(item.key)}
                                        className="flex items-center justify-between cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2 px-4 py-2">
                                            <div className="size-8 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                                <item.icon className="size-4 text-muted-foreground" />
                                            </div>
                                            <Label className="cursor-pointer">{item.label}</Label>
                                        </div>
                                        <Switch
                                            checked={isSelected}
                                            onCheckedChange={() => onToggleVisibleStat(item.key)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="cursor-pointer shrink-0"
                                        />
                                    </div>
                                );
                            })}

                            {/* Expand/Collapse Badge Button */}
                            {hasMoreStatsToShow && (
                                <div className="flex justify-center">
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

                    {/* SECTION 5: Warning Zone */}
                    <section className="space-y-1 border border-warning/50 rounded-sm p-4">
                        <Header level={6} className="text-warning">
                            {locale === "th" ? "โซนแจ้งเตือน" : "Warning Zone"}
                        </Header>

                        {/* เลื่อนการแข่งขัน (Postpone Match) */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 px-4 py-2">
                                <div className="size-8 rounded-sm bg-warning/10 flex items-center justify-center">
                                    <Clock className="size-4 text-warning" />
                                </div>
                                <div className="space-y-1">
                                    <Label>{t("postponed") || "เลื่อนการแข่งขัน"}</Label>
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
                                className="text-warning cursor-pointer"
                            >
                                {t("postponed") || "เลื่อนการแข่งขัน"}
                            </Button>
                        </div>
                    </section>

                    {/* SECTION 6: Danger Zone */}
                    <section id="settings-section-danger" className="space-y-1 border border-destructive/50 rounded-sm p-4">
                        <Header level={6} className="text-destructive">
                            {t("danger_zone") || (locale === "th" ? "โซนอันตราย" : "Danger Zone")}
                        </Header>

                        {/* จบการแข่งขันก่อนเวลา (Walkover / Early Finish) */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 px-4 py-2">
                                <div className="size-8 rounded-sm bg-destructive/10 flex items-center justify-center">
                                    <Trophy className="size-4 text-destructive" />
                                </div>
                                <div className="space-y-1">
                                    <Label>{t("walkover") || "จบการแข่งขันก่อนเวลา"}</Label>
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
                                {t("walkover") || "จบการแข่งขันก่อนเวลา"}
                            </Button>
                        </div>

                        {/* ยกเลิกการแข่งขัน (Abandon Match) */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 px-4 py-2">
                                <div className="size-8 rounded-sm bg-destructive/10 flex items-center justify-center">
                                    <Ban className="size-4 text-destructive" />
                                </div>
                                <div className="space-y-1">
                                    <Label>{t("abandoned") || "ยกเลิกการแข่งขัน"}</Label>
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
                                {t("abandoned") || "ยกเลิกการแข่งขัน"}
                            </Button>
                        </div>
                    </section>
                </div>
            </DialogContent>
        </Dialog>
    );
}
