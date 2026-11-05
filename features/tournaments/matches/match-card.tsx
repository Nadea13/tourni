"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Eraser } from "lucide-react";
import { Match, Team, BracketCanvasData } from "@/types/index";
import { updateMatch } from "@/actions/tournaments/matches";
import { Button } from "@/components/ui/button";
import { useBracketStore } from "@/lib/stores/bracket-store";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/routing";
import { useMatchEvents } from "@/hooks/use-match-events";
import { useMatchTimer } from "@/hooks/use-match-timer";
import { useMatchWebSocket } from "@/hooks/use-match-websocket";
import { MatchScoreBox } from "./score-boxes";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const getScore = (score: number | { total?: number } | null | undefined): number => {
    if (score === null || score === undefined) return 0;
    if (typeof score === 'object') return score.total ?? 0;
    return score;
};

export function MatchCard({
    match: initialMatch,
    tournamentId,
    isPublic = false,
    isEditMode = false,
    teams = [],
    canvasData = null,
    sport: propSport,
    className
}: {
    match: Match;
    tournamentId: string;
    isPublic?: boolean;
    isEditMode?: boolean;
    teams?: Team[];
    canvasData?: BracketCanvasData | null;
    sport?: string;
    className?: string;
}) {
    const t = useTranslations("Fixtures");
    const tMatch = useTranslations("Match");
    const tCommon = useTranslations("Common");
    const _locale = useLocale();
    const searchParams = useSearchParams();

    const [isLoading, setIsLoading] = useState(false);
    const [clearDialogOpen, setClearDialogOpen] = useState(false);

    // --- Realtime Sync State ---
    const [match, setMatchState] = useState<Match>(initialMatch);

    // Live Timer Logic
    const isLiveStatus = match.status === 'live';
    const { events } = useMatchEvents(match.id, tournamentId, undefined, true);




    const isFutsal = Boolean(
        propSport === 'futsal' ||
        propSport?.includes('futsal') ||
        propSport?.includes('ฟุตซอล') ||
        (match as any).sport === 'futsal' ||
        (match as any).sport?.includes('futsal') ||
        (match as any).sport?.includes('ฟุตซอล') ||
        (match as any).sport_name?.toLowerCase().includes('futsal') ||
        (match as any).sport_name?.includes('ฟุตซอล') ||
        (match as any).tournaments?.sport === 'futsal' ||
        (match as any).tournaments?.sport?.includes('ฟุตซอล') ||
        (match as any).tournament?.sport === 'futsal' ||
        (match as any).tournament?.sport?.includes('ฟุตซอล')
    );

    const { time: liveTime } = useMatchTimer(match, tournamentId, events, 0, isFutsal);

    const formatSeconds = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Update local state if prop changes
    useEffect(() => {
        setMatchState(initialMatch);
    }, [initialMatch]);

    // Realtime WebSocket Subscription
    useMatchWebSocket(match.id, {
        onMatchUpdate: (data) => {
            if (data?.match) {
                setMatchState(prev => ({ ...prev, ...data.match }));
            }
        },
        onScoreUpdate: (data) => {
            if (data) {
                setMatchState(prev => ({
                    ...prev,
                    home_score: data.home_score,
                    away_score: data.away_score,
                    status: (data.status as Match["status"]) || prev.status
                }));
            }
        }
    });

    // Local state for auto-save inputs
    const [matchDate, setMatchDate] = useState(match.match_date || "");
    const [matchTime, setMatchTime] = useState(match.match_time || "");

    const handleDateUpdate = async (newDate: string) => {
        setMatchDate(newDate);
        if (newDate !== match.match_date) {
            await updateMatch(match.id, { match_date: newDate }, tournamentId);
        }
    };

    const handleTimeUpdate = async (newTime: string) => {
        setMatchTime(newTime);
        if (newTime !== match.match_time) {
            await updateMatch(match.id, { match_time: newTime }, tournamentId);
        }
    };

    // Helper Variables
    const status = match.status?.toLowerCase() || 'scheduled';
    const isLive = status === 'live';
    const isFinished = status === 'finished';
    const pEvents = (events || []).filter((e: any) => e.event_type === "penalty_shot" || e.type === "penalty_shot");
    const hasPenalty = Boolean(
        (match.penalty_home_score !== undefined && match.penalty_home_score !== null) ||
        (match.home_penalty_score !== undefined && match.home_penalty_score !== null) ||
        (match.score_detail?.penalty_home_score !== undefined && match.score_detail?.penalty_home_score !== null) ||
        (match.score_detail?.home_penalty_score !== undefined && match.score_detail?.home_penalty_score !== null) ||
        pEvents.length > 0
    );

    const storeSport = useBracketStore((state) => state.sport);
    const resolvedSport = propSport ||
        (match as unknown as { sport?: string })?.sport ||
        (match as unknown as { tournaments?: { sport?: string } })?.tournaments?.sport ||
        (match as unknown as { tournament?: { sport?: string } })?.tournament?.sport ||
        (match as unknown as { sport_name?: string })?.sport_name ||
        teams[0]?.sport ||
        storeSport ||
        "football";

    // Format Date Helper
    // Use global formatDate helper
    // const formatDate = ... (removed)

    // Format Time Helper (24H)
    const formatTime = (timeStr?: string | null) => {
        if (!timeStr) return null;
        // Assume timeStr is HH:mm:ss or HH:mm
        const [h, m] = timeStr.split(':');
        return `${h.padStart(2, '0')}:${m}`;
    };

    // Tie Breaker Logic (ถ้าต้องการให้เลือกผู้ชนะเมื่อเสมอในรอบ Knockout)
    // const showTieBreaker = ... (removed as unused)

    const handleClear = async () => {
        setClearDialogOpen(false);
        setIsLoading(true);
        try {
            await updateMatch(match.id, {
                home_team_id: null,
                away_team_id: null,
                home_score: null,
                away_score: null,
                winner_id: null,
                status: 'scheduled'
            }, tournamentId);
        } catch (_error) {
            console.error("Failed to clear match");
        } finally {
            setIsLoading(false);
        }
    };

    const CardContent = (
        <div
            className={cn(
                "flex flex-col bg-card md:grid md:grid-cols-[120px_1fr_120px] items-center px-2 py-2 md:px-4 md:py-2.5 transition-all cursor-pointer group relative overflow-hidden hover:bg-muted/40",
                className
            )}
        >
            {/* 1. Status/Time/Badge Section */}
            <div className="flex flex-col items-center justify-center w-full md:w-auto gap-1 min-w-[90px]">
                {status !== 'scheduled' && (
                    <div
                        className={cn(
                            "text-[10px] md:text-xs tracking-wider font-bold",
                            status === 'scheduled' && "text-muted-foreground",
                            isLive && "text-primary border-primary animate-pulse",
                            isFinished && "text-muted-foreground",
                            !match.away_team_id && "text-muted-foreground"
                        )}
                    >
                        {isFinished ? (hasPenalty ? (_locale === "th" ? "จบ" : "FT") : t("ft")) : (!match.away_team_id ? t("scheduled") : (
                            isLive ? (
                                <span className="flex items-center gap-1.5">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                                    </span>
                                </span>
                            ) : t("scheduled")
                        ))}
                    </div>
                )}

                {/* Date/Time Info (Edit Mode only) */}
                {!isFinished && !isLive && !isPublic && isEditMode && (
                    <div className="w-full pr-2 md:pr-3">
                        <div className="flex flex-col gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                            <Input
                                type="date"
                                value={matchDate}
                                className="bg-card h-8 text-xs"
                                onChange={(e) => handleDateUpdate(e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Teams & Score Section */}
            <div className="flex flex-col items-center w-full gap-0.5 md:gap-1">
                {/* Match Label (Middle Top) */}
                <div className="text-[9px] md:text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase">
                    {(() => {
                        let nodeLabel = "";
                        const nodeId = match.node_id;
                        if (nodeId) {
                            try {
                                const storeNodes = useBracketStore.getState().nodes;
                                const node = storeNodes.find(n => n.id === nodeId);
                                if (node?.data?.label) {
                                    nodeLabel = String(node.data.label);
                                }
                            } catch (_e) {}

                            if (!nodeLabel && canvasData?.nodes) {
                                const node = canvasData.nodes.find((n) => n.id === nodeId);
                                if (node?.data?.label) {
                                    nodeLabel = String(node.data.label);
                                }
                            }
                        }

                        const matchNum = match.match_index ? `#${match.match_index}` : "";

                        if (nodeLabel) {
                            const lowerLabel = nodeLabel.toLowerCase();
                            if (lowerLabel.includes("group") || lowerLabel.includes("matches:")) {
                                return `${nodeLabel} - match ${matchNum}`.trim();
                            }
                            return nodeLabel;
                        }

                        const homeTeam = teams.find(t => t.id === match.home_team_id);
                        const awayTeam = teams.find(t => t.id === match.away_team_id);
                        const groupName = homeTeam?.group_name || awayTeam?.group_name;
                        if (groupName) {
                            return `matches: group ${groupName} - match ${matchNum}`.trim();
                        }
                        return `match ${matchNum}`.trim();
                    })()}
                </div>

                <div className="flex flex-row items-center justify-between w-full gap-2 md:gap-3">
                    {/* Home Team */}
                    <div className="flex-1 flex items-center justify-end gap-2 md:gap-3 text-right w-[40%]">
                        <div className={cn(
                            "text-xs md:text-sm font-bold tracking-tight flex items-center gap-2 justify-end group-hover:text-primary transition-colors duration-300",
                            (isFinished && (match.home_score ?? -1) > (match.away_score ?? -1)) || match.winner_id === match.home_team_id ? "text-foreground" : "text-muted-foreground/70"
                        )}>
                            {isEditMode ? (
                                <div onClick={e => e.stopPropagation()}>
                                    <Select
                                        value={match.home_team_id || "tbd"}
                                        onValueChange={(value) => updateMatch(match.id, { home_team_id: value === "tbd" ? "" : value }, tournamentId)}
                                    >
                                        <SelectTrigger size="sm" className="w-[120px] md:w-[150px]">
                                            <SelectValue placeholder={tMatch("select_team")} />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card">
                                            <SelectItem value="tbd" className="font-bold text-xs text-foreground">{tMatch("tbd")}</SelectItem>
                                            {teams.map((t) => (
                                                <SelectItem key={t.id} value={t.id} className="font-bold text-xs text-foreground">{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <>
                                    <span className="line-clamp-1 py-0.5 px-1 text-foreground">
                                        {match.home_team?.name || match.placeholder_home || match.placeholder_a || (match as any).placeholderA || tMatch("tbd")}
                                    </span>
                                    {match.home_team?.logo_url ? (
                                        <Image src={match.home_team.logo_url} width={32} height={32} className="w-6 h-6 md:w-8 md:h-8 object-contain grayscale-[0.2] group-hover:grayscale-0 transition-all rounded-full" alt="" />
                                    ) : (
                                        <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center shrink-0 border rounded-full bg-muted/20">
                                            <span className="text-[10px] md:text-xs font-bold text-muted-foreground">
                                                {(match.home_team?.name || match.placeholder_home || match.placeholder_a || (match as any).placeholderA || "?").substring(0, 2).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Score Box Component (Divided by Sport: Football / Volleyball) */}
                    <MatchScoreBox
                        match={match}
                        sport={resolvedSport}
                        events={events}
                        isLive={isLive}
                        isFinished={isFinished}
                        isEditMode={isEditMode}
                        isLiveStatus={isLiveStatus}
                        liveTime={liveTime}
                        matchTime={matchTime}
                        formatTime={formatTime}
                        formatSeconds={formatSeconds}
                        handleTimeUpdate={handleTimeUpdate}
                        getScore={getScore}
                    />

                    {/* Away Team */}
                    <div className="flex-1 flex items-center justify-start gap-2 md:gap-3 text-left w-[40%]">
                        <div className={cn(
                            "text-xs md:text-sm font-bold tracking-tight flex items-center gap-2 justify-start group-hover:text-primary transition-colors duration-300",
                            (isFinished && (match.away_score ?? -1) > (match.home_score ?? -1)) || match.winner_id === match.away_team_id ? "text-foreground" : "text-muted-foreground/70"
                        )}>
                            {isEditMode ? (
                                <div onClick={e => e.stopPropagation()}>
                                    <Select
                                        value={match.away_team_id || "tbd"}
                                        onValueChange={(value) => updateMatch(match.id, { away_team_id: value === "tbd" ? "" : value }, tournamentId)}
                                    >
                                        <SelectTrigger size="sm" className="w-[120px] md:w-[150px]">
                                            <SelectValue placeholder={tMatch("select_team")} />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card">
                                            <SelectItem value="tbd" className="font-bold text-xs">{tMatch("tbd")}</SelectItem>
                                            {teams.map((t) => (
                                                <SelectItem key={t.id} value={t.id} className="font-bold text-xs">{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <>
                                    {match.away_team?.logo_url ? (
                                        <Image src={match.away_team.logo_url} width={32} height={32} className="w-6 h-6 md:w-8 md:h-8 object-contain grayscale-[0.2] group-hover:grayscale-0 transition-all rounded-full" alt="" />
                                    ) : (
                                        <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center shrink-0 border rounded-full bg-muted/20">
                                            <span className="text-[10px] md:text-xs font-bold text-muted-foreground">
                                                {(match.away_team?.name || match.placeholder_away || match.placeholder_b || (match as any).placeholderB || "?").substring(0, 2).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    <span className="line-clamp-1 py-0.5 px-1 text-foreground">
                                        {match.away_team?.name || match.placeholder_away || match.placeholder_b || (match as any).placeholderB || tMatch("tbd")}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Actions / Selection Indicator */}
            <div className="flex items-center justify-center w-full" onClick={e => e.stopPropagation()}>
                {isEditMode && match.away_team_id && (
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground/20 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => setClearDialogOpen(true)}
                        disabled={isLoading}
                    >
                        <Eraser className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );

    const router = useRouter();

    // The card is clickable to open the full page console
    const canOpen = !isEditMode;
    const currentTab = searchParams.get('tab');
    const currentCategory = searchParams.get('category') || searchParams.get('category_id');
    const queryParams = new URLSearchParams();
    if (currentTab) queryParams.set('from', currentTab);
    if (currentCategory) queryParams.set('category', currentCategory);
    const querySuffix = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const url = isPublic
        ? `/tournaments/${tournamentId}/matches/${match.id}${querySuffix}`
        : `/my-tournaments/${tournamentId}/matches/${match.id}${querySuffix}`;

    const handleCardClick = (e: React.MouseEvent) => {
        if (!canOpen) return;
        // Don't navigate if clicking on an interactive control (button, select, input, dialog)
        const target = e.target as HTMLElement;
        if (target.closest('button, input, select, [role="button"], [data-radix-collection-item]')) {
            return;
        }
        router.push(url);
    };

    return (
        <>
            <div 
                onClick={handleCardClick}
                className={cn(
                    canOpen && "cursor-pointer"
                )}
            >
                {CardContent}
            </div>

            <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                <AlertDialogContent className="bg-card border-border/10 shadow-2xl max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black tracking-tighter text-foreground flex items-center gap-2">
                            <Eraser className="h-4 w-4 text-destructive" />
                            {t("clear_match") || "Clear Match"}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium text-muted-foreground/80 mt-2">
                            {t("confirm_clear")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="border-border/10 bg-foreground/5 hover:bg-foreground/10 hover:text-foreground transition-all">
                            {tCommon("cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleClear();
                            }}
                            className="border border-destructive/20 bg-destructive/90 text-foreground hover:bg-destructive hover:shadow-[0_0_15px_rgba(220,38,38,0.3)] transition-all"
                        >
                            {t("clear") || "Clear"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

