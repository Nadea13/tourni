"use client";

import React, { useState, useMemo } from "react";
import { useLocale } from "next-intl";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Calendar,
    Clock,
    Sparkles,
    Coffee,
    Layers,
    ListOrdered,
    Info,
    CalendarDays,
    Users,
} from "lucide-react";
import { useBracketStore } from "@/lib/stores/bracket-store";
import { useToast } from "@/hooks/use-toast";
import { Tournament } from "@/types";
import { format, parse, differenceInCalendarDays } from "date-fns";
import {
    analyzeRoundsFromCanvas,
    computeAutoSchedule,
    ScheduledMatchItem,
} from "./auto-schedule-utils";

export interface AutoScheduleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tournament?: Tournament;
    activeCategoryId?: string | null;
}

export function AutoScheduleDialog({
    open,
    onOpenChange,
    tournament,
    activeCategoryId: _activeCategoryId,
}: AutoScheduleDialogProps) {
    const locale = useLocale();
    const isThai = locale === "th";
    const { toast } = useToast();

    const {
        nodes,
        edges,
        updateNodeData,
        matches: storeMatches,
        setMatches: setStoreMatches,
    } = useBracketStore();

    // 1. Initial Start Date and End Date from Tournament
    const defaultStartDate = tournament?.start_date
        ? format(new Date(tournament.start_date), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd");

    const defaultEndDate = tournament?.end_date
        ? format(new Date(tournament.end_date), "yyyy-MM-dd")
        : defaultStartDate;

    const [startDate, setStartDate] = useState(defaultStartDate);
    const [endDate, setEndDate] = useState(defaultEndDate);
    const [firstMatchTime, setFirstMatchTime] = useState("09:00");
    const [dailyEndTime, setDailyEndTime] = useState("18:00");
    const [matchDurationMinutes, setMatchDurationMinutes] = useState(40);
    const [hasBreakTime, setHasBreakTime] = useState(false);
    const [breakStartTime, setBreakStartTime] = useState("12:00");
    const [breakEndTime, setBreakEndTime] = useState("13:00");
    const [maxMatchesPerTeam, setMaxMatchesPerTeam] = useState<number | undefined>(undefined);
    const [maxMatchesPerDay, setMaxMatchesPerDay] = useState<number | undefined>(undefined);

    // Court / Field configuration
    const tournamentCourts: string[] = Array.isArray(tournament?.settings?.fields)
        ? tournament.settings.fields
        : [];

    const [selectedCourts, setSelectedCourts] = useState<string[]>(
        tournamentCourts.length > 0 ? tournamentCourts : ["สนาม 1", "สนาม 2"]
    );
    const [customCourtInput, setCustomCourtInput] = useState("");

    // Analyze stages and rounds currently on the canvas
    const detectedRounds = useMemo(() => {
        return analyzeRoundsFromCanvas(nodes, edges);
    }, [nodes, edges]);

    const totalMatchesCount = useMemo(() => {
        return detectedRounds.reduce((acc, r) => acc + r.matches.length, 0);
    }, [detectedRounds]);

    // Calculate tournament days
    const totalDays = useMemo(() => {
        try {
            const s = parse(startDate, "yyyy-MM-dd", new Date());
            const e = parse(endDate, "yyyy-MM-dd", new Date());
            return Math.max(1, differenceInCalendarDays(e, s) + 1);
        } catch {
            return 1;
        }
    }, [startDate, endDate]);

    // Apply auto-scheduling logic
    const handleApplySchedule = () => {
        if (detectedRounds.length === 0 || totalMatchesCount === 0) {
            toast({
                title: isThai ? "ไม่พบแมตช์" : "No Matches Found",
                description: isThai
                    ? "กรุณาสร้างแมตช์หรือกลุ่มการแข่งขันบนกระดานก่อนจัดตารางเวลา"
                    : "Please create matches or groups on canvas before scheduling.",
                variant: "destructive",
            });
            return;
        }

        const effectiveCourts = selectedCourts.length > 0 ? selectedCourts : ["สนาม 1"];

        const results = computeAutoSchedule(nodes, edges, {
            startDate,
            endDate,
            firstMatchTime,
            dailyEndTime: dailyEndTime ? dailyEndTime : undefined,
            matchDurationMinutes,
            gapMinutes: 0,
            hasBreakTime,
            breakStartTime,
            breakEndTime,
            selectedCourts: effectiveCourts,
            maxMatchesPerTeam,
            maxMatchesPerDay,
        });

        if (results.length === 0) {
            toast({
                title: isThai ? "ไม่สามารถจัดตารางได้" : "Scheduling Failed",
                description: isThai
                    ? "เกิดข้อผิดพลาดในการประมวลผลตารางแข่งขัน"
                    : "An error occurred while computing schedule.",
                variant: "destructive",
            });
            return;
        }

        // Group results by nodeId
        const nodeMatchesMap = new Map<string, Map<number, ScheduledMatchItem>>();
        results.forEach((r) => {
            if (!nodeMatchesMap.has(r.nodeId)) nodeMatchesMap.set(r.nodeId, new Map());
            nodeMatchesMap.get(r.nodeId)!.set(r.matchIndex, r);
        });

        const matchNodes = nodes.filter((n) => n.type === "matchNode");
        const updatedDbMatches = [...storeMatches];

        matchNodes.forEach((node) => {
            const scheduledForNode = nodeMatchesMap.get(node.id);
            if (!scheduledForNode) return;

            const rawMatches = (node.data?.matches as any[]) || [];
            const nextMatches = rawMatches.map((mItem, idx) => {
                const sched = scheduledForNode.get(idx);
                if (!sched) return mItem;

                // Sync into dbMatches if matching
                const dbMatch = updatedDbMatches.find(
                    (dbM) =>
                        (mItem.dbId && dbM.id === mItem.dbId) ||
                        (mItem.matchId && dbM.id === mItem.matchId) ||
                        (dbM.node_id === node.id && (dbM.idx_match ?? dbM.match_index) === idx + 1)
                );
                if (dbMatch) {
                    dbMatch.match_date = sched.targetDate;
                    dbMatch.match_time = sched.targetTime;
                    dbMatch.scheduled_at = `${sched.targetDate}T${sched.targetTime}:00Z`;
                    dbMatch.field_name = sched.assignedCourt;
                    dbMatch.venue = sched.assignedCourt;
                }

                return {
                    ...mItem,
                    match_date: sched.targetDate,
                    match_time: sched.targetTime,
                    field_name: sched.assignedCourt,
                    venue: sched.assignedCourt,
                };
            });

            updateNodeData(node.id, { matches: nextMatches });
        });

        setStoreMatches(updatedDbMatches);
        useBracketStore.setState({ isDirty: true });

        toast({
            title: isThai ? "จัดตารางเวลาอัตโนมัติสำเร็จ" : "Auto-Scheduled Successfully",
            description: isThai
                ? `จัดตารางแข่งแบ่งตามรอบ ${detectedRounds.length} รอบ รวมทั้งหมด ${results.length} แมตช์เรียบร้อยแล้ว`
                : `Successfully scheduled ${results.length} matches across ${detectedRounds.length} rounds.`,
        });

        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden rounded-sm">
                <DialogHeader className="p-4 border-b bg-muted/20">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <Sparkles className="size-4 text-primary" />
                        <span>{isThai ? "จัดตารางเวลาแข่งขันอัตโนมัติ" : "Auto-Schedule Matches"}</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        {isThai
                            ? "จัดคิวแข่งตามลำดับรอบจริง ไม่ให้ทีมแข่งชนเวลา และกระจายสนามอัตโนมัติ"
                            : "Chronological round-based match scheduling with court distribution and no team collisions."}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
                    {/* Stage & Round Sequence Analysis Preview */}
                    <div className="rounded-sm border bg-muted/20 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-bold flex items-center gap-1.5 text-foreground">
                                <ListOrdered className="size-3.5 text-primary" />
                                <span>{isThai ? "โครงสร้างรอบการแข่งขันที่ตรวจพบ" : "Detected Tournament Structure"}</span>
                            </span>
                            <span className="text-[11px] text-muted-foreground bg-background px-2 py-0.5 rounded border">
                                {detectedRounds.length} {isThai ? "รอบ" : "Rounds"} • {totalMatchesCount} {isThai ? "คู่แข่งขัน" : "Matches"}
                            </span>
                        </div>

                        {detectedRounds.length > 0 ? (
                            <div className="space-y-1.5 pt-1">
                                {detectedRounds.map((rg, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-background border text-muted-foreground"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black w-4 text-primary">#{rg.roundNumber}</span>
                                            <span className="font-medium text-foreground">{rg.label}</span>
                                        </div>
                                        <span className="text-[11px]">{rg.matches.length} {isThai ? "คู่" : "matches"}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground italic">
                                {isThai ? "ไม่พบแมตช์บนกระดาน กรุณาสร้างแมตช์ก่อน" : "No matches found on canvas."}
                            </p>
                        )}

                        {/* Tournament Days Distribution Info */}
                        {detectedRounds.length > 0 && (
                            <div className="pt-2 border-t mt-2 flex items-start gap-2 text-[11px] text-muted-foreground">
                                <Info className="size-3.5 shrink-0 text-primary mt-0.5" />
                                <div>
                                    {totalDays < detectedRounds.length ? (
                                        <span>
                                            {isThai
                                                ? `วันแข่งในตารางมี ${totalDays} วัน แต่วงจรมี ${detectedRounds.length} รอบ -> ระบบจะรวบจัด ${detectedRounds.length} รอบลงใน ${totalDays} วันตามลำดับเวลาต่อเนื่องอย่างถูกต้อง`
                                                : `Tournament duration is ${totalDays} day(s) for ${detectedRounds.length} rounds. Matches will be packed chronologically within tournament dates.`}
                                        </span>
                                    ) : (
                                        <span>
                                            {isThai
                                                ? `จัดแบ่ง ${detectedRounds.length} รอบลงตามวันแข่งขัน ${totalDays} วันอย่างสมดุล (รอบก่อนหน้าแข่งก่อนรอบถัดไปเสมอ)`
                                                : `Rounds will be distributed sequentially across ${totalDays} tournament days.`}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 1. Date Range: Start Date & End Date */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold flex items-center gap-1.5">
                                <Calendar className="size-3.5 text-muted-foreground" />
                                <span>{isThai ? "วันเริ่มแข่ง (Start Date)" : "Start Date"}</span>
                            </Label>
                            <Input
                                type="date"
                                size="sm"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold flex items-center gap-1.5">
                                <CalendarDays className="size-3.5 text-muted-foreground" />
                                <span>{isThai ? "วันสิ้นสุด (End Date)" : "End Date"}</span>
                            </Label>
                            <Input
                                type="date"
                                size="sm"
                                value={endDate}
                                min={startDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* 2. Daily Time Window: First Match Time & Latest End Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold flex items-center gap-1.5">
                                <Clock className="size-3.5 text-muted-foreground" />
                                <span>{isThai ? "เวลาเริ่มคู่แรก" : "First Match Time"}</span>
                            </Label>
                            <Input
                                type="time"
                                size="sm"
                                value={firstMatchTime}
                                onChange={(e) => setFirstMatchTime(e.target.value)}
                                className="w-full"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold flex items-center gap-1.5">
                                <Clock className="size-3.5 text-muted-foreground" />
                                <span>{isThai ? "เวลาจบช้าสุดของวัน" : "Latest End Time"}</span>
                            </Label>
                            <Input
                                type="time"
                                size="sm"
                                value={dailyEndTime}
                                onChange={(e) => setDailyEndTime(e.target.value)}
                                className="w-full"
                            />
                            <span className="text-[10px] text-muted-foreground block">
                                {isThai ? "*ไม่เกินเวลานี้ต่อวัน (คู่ที่ไม่ทันจะยกยอดไปวันถัดไป)" : "*Matches rolling past this time move to next day"}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold">
                            {isThai ? "ระยะเวลาต่อคู่ (นาที)" : "Match Duration (min)"}
                        </Label>
                        <Input
                            type="number"
                            size="sm"
                            min={10}
                            max={180}
                            step={5}
                            value={matchDurationMinutes}
                            onChange={(e) => setMatchDurationMinutes(Number(e.target.value) || 30)}
                            className="w-full"
                        />
                    </div>

                    {/* 3. Daily Match Limits (Max team/day & Max match/day) */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Users className="size-3.5 text-muted-foreground" />
                                    <span>{isThai ? "แข่งสูงสุดต่อทีม/วัน" : "Max Matches/Team/Day"}</span>
                                </span>
                            </Label>
                            <Input
                                type="number"
                                size="sm"
                                min={1}
                                max={10}
                                placeholder={isThai ? "เช่น 1 หรือ 2 (เว้นว่าง = ไม่จำกัด)" : "e.g. 1 or 2 (empty = none)"}
                                value={maxMatchesPerTeam !== undefined ? maxMatchesPerTeam : ""}
                                onChange={(e) => {
                                    const val = e.target.value.trim();
                                    setMaxMatchesPerTeam(val === "" ? undefined : Number(val));
                                }}
                                className="w-full text-xs"
                            />
                            <span className="text-[10px] text-muted-foreground block">
                                {isThai ? "*ป้องกันนักกีฬาเหนื่อยล้า หากครบโควต้าจะยกไปวันถัดไป" : "*Roll over to next day when team quota reached"}
                            </span>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <CalendarDays className="size-3.5 text-muted-foreground" />
                                    <span>{isThai ? "แมตช์รวมสูงสุด/วัน" : "Max Matches/Day"}</span>
                                </span>
                            </Label>
                            <Input
                                type="number"
                                size="sm"
                                min={1}
                                max={100}
                                placeholder={isThai ? "เช่น 12 (เว้นว่าง = ไม่จำกัด)" : "e.g. 12 (empty = none)"}
                                value={maxMatchesPerDay !== undefined ? maxMatchesPerDay : ""}
                                onChange={(e) => {
                                    const val = e.target.value.trim();
                                    setMaxMatchesPerDay(val === "" ? undefined : Number(val));
                                }}
                                className="w-full text-xs"
                            />
                            <span className="text-[10px] text-muted-foreground block">
                                {isThai ? "*จำกัดจำนวนคู่แข่งรวมในแต่ละวัน" : "*Limit total matches per day"}
                            </span>
                        </div>
                    </div>

                    {/* 3. Break Time (Optional) */}
                    <div className="border rounded-sm p-3 bg-muted/10 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Coffee className="size-3.5 text-muted-foreground" />
                                <Label className="text-xs font-bold cursor-pointer" htmlFor="toggle-break">
                                    {isThai ? "กำหนดเวลาพัก (เช่น พักเที่ยง)" : "Break Time (e.g. Lunch)"}
                                </Label>
                            </div>
                            <input
                                type="checkbox"
                                id="toggle-break"
                                checked={hasBreakTime}
                                onChange={(e) => setHasBreakTime(e.target.checked)}
                                className="size-4 accent-primary rounded cursor-pointer"
                            />
                        </div>

                        {hasBreakTime && (
                            <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in-50">
                                <div className="space-y-1">
                                    <span className="text-[11px] text-muted-foreground">{isThai ? "เริ่มพัก" : "Break Start"}</span>
                                    <Input
                                        type="time"
                                        size="sm"
                                        value={breakStartTime}
                                        onChange={(e) => setBreakStartTime(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[11px] text-muted-foreground">{isThai ? "สิ้นสุดพัก" : "Break End"}</span>
                                    <Input
                                        type="time"
                                        size="sm"
                                        value={breakEndTime}
                                        onChange={(e) => setBreakEndTime(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. Court / Field Selection */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Layers className="size-3.5 text-muted-foreground" />
                                <span>{isThai ? "สนามแข่งขันที่ใช้งาน" : "Active Courts / Fields"}</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground font-normal">
                                {isThai ? "แข่งพร้อมกันได้ตามจำนวนสนาม (ไม่ชนทีมเดียวกัน)" : "Concurrent matches across courts"}
                            </span>
                        </Label>

                        {/* Available courts checkboxes */}
                        {tournamentCourts.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {tournamentCourts.map((cName) => {
                                    const isChecked = selectedCourts.includes(cName);
                                    return (
                                        <button
                                            key={cName}
                                            type="button"
                                            onClick={() => {
                                                if (isChecked) {
                                                    if (selectedCourts.length > 1) {
                                                        setSelectedCourts(selectedCourts.filter((c) => c !== cName));
                                                    }
                                                } else {
                                                    setSelectedCourts([...selectedCourts, cName]);
                                                }
                                            }}
                                            className={`px-3 py-1 rounded-sm border text-xs font-semibold transition-all cursor-pointer ${
                                                isChecked
                                                    ? "bg-primary text-black border-primary"
                                                    : "bg-muted/30 text-muted-foreground hover:bg-muted"
                                            }`}
                                        >
                                            {cName}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Input
                                        size="sm"
                                        value={customCourtInput}
                                        onChange={(e) => setCustomCourtInput(e.target.value)}
                                        placeholder={isThai ? "ระบุสนาม เช่น สนาม 1, สนาม 2" : "e.g. Court 1, Pitch A"}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                const trimmed = customCourtInput.trim();
                                                if (trimmed && !selectedCourts.includes(trimmed)) {
                                                    setSelectedCourts([...selectedCourts, trimmed]);
                                                    setCustomCourtInput("");
                                                }
                                            }
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const trimmed = customCourtInput.trim();
                                            if (trimmed && !selectedCourts.includes(trimmed)) {
                                                setSelectedCourts([...selectedCourts, trimmed]);
                                                setCustomCourtInput("");
                                            }
                                        }}
                                        disabled={!customCourtInput.trim()}
                                        className="h-8 shrink-0 text-xs"
                                    >
                                        {isThai ? "เพิ่ม" : "Add"}
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedCourts.map((c) => (
                                        <span
                                            key={c}
                                            className="px-2 py-0.5 rounded-sm bg-muted border text-xs font-semibold flex items-center gap-1 text-foreground"
                                        >
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                            {isThai
                                ? "*จัดการรายชื่อสนามถาวรได้ใน การตั้งค่าทัวร์นาเมนต์ > ข้อมูลทั่วไป"
                                : "*Manage permanent courts in Tournament Settings > General."}
                        </p>
                    </div>
                </div>

                <DialogFooter className="p-3 border-t bg-muted/10 gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        className="text-xs"
                    >
                        {isThai ? "ยกเลิก" : "Cancel"}
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleApplySchedule}
                        className="text-xs font-semibold bg-primary hover:bg-primary/90 text-black gap-1.5"
                    >
                        <Sparkles className="size-3.5" />
                        <span>{isThai ? "สร้างตารางเวลาทันที" : "Apply Schedule"}</span>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
