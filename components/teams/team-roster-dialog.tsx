"use client";

import React, { useMemo } from "react";
import { MatchEvent, Player } from "@/types";
import { useLocale } from "next-intl";
import Image from "next/image";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Users,
    UserCheck,
    UserMinus,
    Briefcase,
    Zap,
    Flame,
    ShieldCheck,
    Phone,
    User,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { resolveStorageUrl } from "@/lib/storage-utils";
import { Header } from "@/components/ui/header";

const getInitials = (name: string) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

const STAFF_ROLES_KEYWORDS = [
    'coach', 'head coach', 'assistant coach', 'manager', 'team manager',
    'staff', 'official', 'physio', 'doctor', 'trainer', 'director',
    'โค้ช', 'หัวหน้าผู้ฝึกสอน', 'ผู้ฝึกสอน', 'ผู้ช่วยโค้ช', 'ผู้ช่วยผู้ฝึกสอน',
    'ผู้จัดการทีม', 'เจ้าหน้าที่ทีม', 'แพทย์ประจำทีม', 'นักกายภาพ', 'ทีมงาน', 'ผู้ประสานงาน'
];

export interface TeamStaffMember {
    id: string;
    name: string;
    role: string;
    phone?: string | null;
    photo_url?: string | null;
}

export interface TeamRosterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teamName: string;
    teamLogo?: string | null;
    description?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    players?: Player[];
    activeLineupIds?: string[];
    events?: MatchEvent[];
    teamId?: string | null;
    sport?: 'football' | 'volleyball' | string;
    customStaff?: TeamStaffMember[];
}

export function TeamRosterDialog({
    open,
    onOpenChange,
    teamName,
    teamLogo,
    description,
    contactName,
    contactPhone,
    players = [],
    activeLineupIds = [],
    events = [],
    teamId,
    sport = 'football',
    customStaff = []
}: TeamRosterDialogProps) {
    const locale = useLocale();
    const isThai = locale === "th";

    // Categorize roster into: Starters, Substitutes, and Staff
    const { starters, substitutes, staffList } = useMemo(() => {
        const starterList: Player[] = [];
        const subList: Player[] = [];
        const staffEntries: TeamStaffMember[] = [...customStaff];

        // If contact person is provided, add as staff/manager
        if (contactName) {
            const alreadyExists = staffEntries.some(
                s => s.name.toLowerCase().trim() === contactName.toLowerCase().trim()
            );
            if (!alreadyExists) {
                staffEntries.push({
                    id: 'contact-manager',
                    name: contactName,
                    role: isThai ? "ผู้จัดการทีม" : "Team Manager",
                    phone: contactPhone || null,
                    photo_url: null
                });
            }
        }

        players.forEach(p => {
            const pos = (p.position || "").toLowerCase().trim();
            const isStaffPos = STAFF_ROLES_KEYWORDS.some(k => pos.includes(k));

            if (isStaffPos) {
                staffEntries.push({
                    id: p.id,
                    name: p.name,
                    role: p.position || (isThai ? "เจ้าหน้าที่ทีม" : "Team Staff"),
                    phone: p.tel || null,
                    photo_url: p.photo_url || p.profile_img || null
                });
            } else {
                if (activeLineupIds.length > 0) {
                    if (activeLineupIds.includes(p.id)) {
                        starterList.push(p);
                    } else {
                        subList.push(p);
                    }
                } else {
                    starterList.push(p);
                }
            }
        });

        // Sort players by jersey number
        starterList.sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
        subList.sort((a, b) => (a.number ?? 999) - (b.number ?? 999));

        return { starters: starterList, substitutes: subList, staffList: staffEntries };
    }, [players, activeLineupIds, customStaff, contactName, contactPhone, isThai]);

    // Calculate match events stats
    const playerStatsMap = useMemo(() => {
        const statsMap = new Map<string, {
            goals: number;
            yellowCards: number;
            redCards: number;
            aces: number;
            spikes: number;
            blocks: number;
            totalPoints: number;
        }>();

        const relevantEvents = events.filter(e => {
            if (teamId && e.team_id) return e.team_id === teamId;
            const extraText = (e.extra_info as Record<string, unknown> | null)?.text as string || "";
            if (teamName && extraText.includes(teamName)) return true;
            return false;
        });

        const matchPlayerYellows = new Map<string, number>();

        relevantEvents.forEach(e => {
            const pName = e.player_name || (e.extra_info as Record<string, unknown> | null)?.player_name as string;
            if (!e.player_id && !pName) return;
            if (e.player_id === 'unknown' || (pName && ['unknown', 'unknown player', 'ไม่ระบุ', 'team'].includes(pName.trim().toLowerCase()))) return;

            const key = e.player_id || pName || "";
            const stat = statsMap.get(key) || {
                goals: 0,
                yellowCards: 0,
                redCards: 0,
                aces: 0,
                spikes: 0,
                blocks: 0,
                totalPoints: 0
            };

            const isExplicitSecondYellow = Boolean(
                (e.extra_info as Record<string, unknown> | null)?.is_second_yellow ||
                (e.detail as Record<string, unknown> | null)?.is_second_yellow
            );

            if (e.event_type === 'goal') stat.goals += 1;
            if (e.event_type === 'yellow_card') {
                stat.yellowCards += 1;
                const matchKey = `${e.match_id}-${key}`;
                const count = (matchPlayerYellows.get(matchKey) || 0) + 1;
                matchPlayerYellows.set(matchKey, count);
                if (isExplicitSecondYellow || count >= 2) {
                    stat.redCards += 1;
                }
            }
            if (e.event_type === 'red_card') {
                stat.redCards += 1;
                if (isExplicitSecondYellow) {
                    stat.yellowCards += 1;
                }
            }
            if (e.event_type === 'ace') { stat.aces += 1; stat.totalPoints += 1; }
            if (e.event_type === 'spike') { stat.spikes += 1; stat.totalPoints += 1; }
            if (e.event_type === 'block') { stat.blocks += 1; stat.totalPoints += 1; }
            if (e.event_type === 'point') { stat.totalPoints += 1; }

            statsMap.set(key, stat);
        });

        return statsMap;
    }, [events, teamId, teamName]);

    const renderPlayerRow = (p: Player, isStarter: boolean) => {
        const stats = playerStatsMap.get(p.id) || playerStatsMap.get(p.name);
        const photo = resolveStorageUrl(p.photo_url || p.profile_img);

        return (
            <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-transparent hover:bg-muted/30 transition-colors"
            >
                <div className="flex items-center gap-3 min-w-0">
                    {/* Jersey Number */}
                    <div className="h-7 w-7 rounded-full border border-border bg-transparent flex items-center justify-center font-black text-xs text-foreground shrink-0 tabular-nums">
                        {p.number !== null && p.number !== undefined ? `${p.number}` : "-"}
                    </div>

                    {/* Avatar/Photo - Circular */}
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-transparent flex items-center justify-center shrink-0 border border-border">
                        {photo ? (
                            <Image src={photo} alt={p.name} width={32} height={32} className="w-full h-full object-cover rounded-full" />
                        ) : (
                            <span className="text-[10px] font-bold text-muted-foreground">{getInitials(p.name)}</span>
                        )}
                    </div>

                    {/* Name & Position */}
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold truncate text-foreground">{p.name}</span>
                            <Badge
                                variant="outline"
                                className={cn(
                                    "text-[9px] px-1.5 py-0 h-4 font-semibold tracking-wide rounded-sm",
                                    isStarter
                                        ? "bg-primary/10 text-primary border-primary/30"
                                        : "bg-muted text-muted-foreground border-border"
                                )}
                            >
                                {isStarter ? (isThai ? "ตัวจริง" : "Starter") : (isThai ? "ตัวสำรอง" : "Substitute")}
                            </Badge>
                        </div>
                        {p.position && (
                            <span className="text-[10px] text-muted-foreground font-medium truncate">
                                {p.position}
                            </span>
                        )}
                    </div>
                </div>

                {/* Match Stats Pill */}
                {stats && (
                    <div className="flex items-center gap-1 shrink-0 text-[10px] font-bold">
                        {stats.goals > 0 && (
                            <span className="px-1.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                ⚽ {stats.goals}
                            </span>
                        )}
                        {stats.yellowCards > 0 && (
                            <span className="px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                🟨 {stats.yellowCards}
                            </span>
                        )}
                        {stats.redCards > 0 && (
                            <span className="px-1.5 py-0.5 rounded-sm bg-destructive/10 text-destructive border border-destructive/20">
                                🟥 {stats.redCards}
                            </span>
                        )}
                        {stats.aces > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                <Zap className="h-3 w-3" />{stats.aces} Ace
                            </span>
                        )}
                        {stats.spikes > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-destructive/10 text-destructive border border-destructive/20">
                                <Flame className="h-3 w-3" />{stats.spikes}
                            </span>
                        )}
                        {stats.blocks > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                <ShieldCheck className="h-3 w-3" />{stats.blocks}
                            </span>
                        )}
                        {stats.totalPoints > 0 && sport === 'volleyball' && (
                            <span className="px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20 font-black">
                                {stats.totalPoints} Pts
                            </span>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderStaffRow = (staff: TeamStaffMember) => {
        const photo = resolveStorageUrl(staff.photo_url);

        return (
            <div
                key={staff.id}
                className="flex items-center justify-between p-3 bg-transparent hover:bg-muted/30 transition-colors"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-transparent border border-border flex items-center justify-center shrink-0">
                        {photo ? (
                            <Image src={photo} alt={staff.name} width={32} height={32} className="w-full h-full object-cover rounded-full" />
                        ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold truncate text-foreground">{staff.name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium truncate">
                            {staff.role}
                        </span>
                    </div>
                </div>

                {staff.phone && (
                    <a
                        href={`tel:${staff.phone}`}
                        className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline px-2 py-1 rounded-sm bg-transparent border border-border hover:border-primary/40 transition-colors"
                    >
                        <Phone className="h-3.5 w-3.5" />
                        <span>{staff.phone}</span>
                    </a>
                )}
            </div>
        );
    };

    const totalCount = starters.length + substitutes.length + staffList.length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="sm:max-w-[580px] bg-card p-0 rounded-none sm:rounded-sm shadow-2xl overflow-hidden border border-border max-h-[90vh] flex flex-col">
                {/* Header - Strictly p-4, text-only, no header icons */}
                <DialogHeader className="p-4 border-b border-border bg-card shrink-0 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-transparent border border-border flex items-center justify-center overflow-hidden shrink-0">
                            {teamLogo ? (
                                <Image src={teamLogo} alt={teamName} width={40} height={40} className="w-full h-full object-contain rounded-full" />
                            ) : (
                                <span className="font-black text-sm text-foreground/40">{getInitials(teamName)}</span>
                            )}
                        </div>
                        <div className="flex flex-col min-w-0 space-y-0.5">
                            <DialogTitle className="text-lg md:text-xl font-black tracking-tighter text-foreground leading-none truncate">
                                {teamName}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-1">
                                {isThai ? "ข้อมูลทีมและรายชื่อผู้เล่น" : "Team and Roster Information"}
                            </DialogDescription>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-8 w-8 rounded-sm hover:bg-muted/30 text-muted-foreground"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </DialogHeader>

                {/* Content Area - Strictly p-4 and space-y-4 between sections */}
                <div className="p-4 space-y-4 overflow-y-auto flex-1 no-scrollbar">
                    {/* Team Details & Contact Summary */}
                    {(contactName || contactPhone || description) && (
                        <div className="p-3 border border-border rounded-sm bg-transparent space-y-1.5 text-xs">
                            {description && (
                                <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-muted-foreground pt-0.5">
                                {contactName && (
                                    <div className="flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5 text-primary" />
                                        <span className="font-semibold text-foreground">{contactName}</span>
                                    </div>
                                )}
                                {contactPhone && (
                                    <div className="flex items-center gap-1.5">
                                        <Phone className="h-3.5 w-3.5 text-primary" />
                                        <a href={`tel:${contactPhone}`} className="font-semibold text-foreground hover:underline">
                                            {contactPhone}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {totalCount === 0 ? (
                        <EmptyState
                            icon={Users}
                            title={isThai ? "ไม่มีข้อมูลรายชื่อผู้เล่นและทีมงาน" : "No Team Roster"}
                            description={isThai ? "ยังไม่ได้ลงทะเบียนรายชื่อผู้เล่นหรือทีมงานสำหรับทีมนี้" : "No players or staff have been registered for this team yet."}
                            className="min-h-[200px] p-4 border rounded-sm bg-transparent border-dashed"
                        />
                    ) : (
                        <div className="space-y-4">
                            {/* SECTION 1: STARTERS (ตัวจริง) */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Header level={4}>{isThai ? "ผู้เล่นตัวจริง" : "Starting Lineup"}</Header>
                                    <Badge variant="outline" className="text-[10px] font-bold rounded-sm">
                                        {starters.length} {isThai ? "คน" : "players"}
                                    </Badge>
                                </div>
                                {starters.length > 0 ? (
                                    <div className="border border-border bg-transparent rounded-sm divide-y divide-border overflow-hidden">
                                        {starters.map(p => renderPlayerRow(p, true))}
                                    </div>
                                ) : (
                                    <EmptyState
                                        icon={UserCheck}
                                        title={isThai ? "ไม่มีผู้เล่นตัวจริง" : "No Starters"}
                                        description={isThai ? "ยังไม่ได้กำหนดรายชื่อผู้เล่นตัวจริงสำหรับแมตช์นี้" : "No starting lineup has been selected yet."}
                                        className="min-h-[120px] p-3 border rounded-sm bg-transparent border-dashed"
                                    />
                                )}
                            </div>

                            {/* SECTION 2: SUBSTITUTES (ตัวสำรอง) */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Header level={4}>{isThai ? "ผู้เล่นตัวสำรอง" : "Substitutes"}</Header>
                                    <Badge variant="outline" className="text-[10px] font-bold rounded-sm">
                                        {substitutes.length} {isThai ? "คน" : "players"}
                                    </Badge>
                                </div>
                                {substitutes.length > 0 ? (
                                    <div className="border border-border bg-transparent rounded-sm divide-y divide-border overflow-hidden">
                                        {substitutes.map(p => renderPlayerRow(p, false))}
                                    </div>
                                ) : (
                                    <EmptyState
                                        icon={UserMinus}
                                        title={isThai ? "ไม่มีผู้เล่นตัวสำรอง" : "No Substitutes"}
                                        description={isThai ? "ไม่มีรายชื่อผู้เล่นสำรองในทีมนี้" : "No substitute players found in this team roster."}
                                        className="min-h-[120px] p-3 border rounded-sm bg-transparent border-dashed"
                                    />
                                )}
                            </div>

                            {/* SECTION 3: STAFF (ทีมงาน) */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Header level={4}>{isThai ? "เจ้าหน้าที่และทีมงาน" : "Team Staff"}</Header>
                                    <Badge variant="outline" className="text-[10px] font-bold rounded-sm">
                                        {staffList.length} {isThai ? "คน" : "members"}
                                    </Badge>
                                </div>
                                {staffList.length > 0 ? (
                                    <div className="border border-border bg-transparent rounded-sm divide-y divide-border overflow-hidden">
                                        {staffList.map(renderStaffRow)}
                                    </div>
                                ) : (
                                    <EmptyState
                                        icon={Briefcase}
                                        title={isThai ? "ไม่มีข้อมูลทีมงาน" : "No Team Staff"}
                                        description={isThai ? "ไม่มีรายชื่อเจ้าหน้าที่หรือโค้ชในทีมนี้" : "No staff or coaches registered for this team."}
                                        className="min-h-[120px] p-3 border rounded-sm bg-transparent border-dashed"
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
