"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { getPlayers } from "@/actions/tournaments/player";
import { updateMatch, advanceStage, updateCategoryRulesConfig } from "@/actions/tournaments/general";
import { syncCategoryBracket } from "@/actions/tournaments/bracket";
import { getPenaltyShootout } from "@/actions/tournaments/penalty";
import { useMatchWebSocket } from "@/hooks/use-match-websocket";
import { ApiClient } from "@/lib/api-client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { cn } from "@/lib/utils";
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
import {
    Hand,
    Clock,
    ArrowLeft,
    Undo,
    Activity,
    Square,
    Repeat,
    Flag,
    Stethoscope,
    Shield,
    Tv,
    BarChart2,
    Users,
    Volleyball,
    Cloud,
    CloudOff,
    RefreshCw,
    HelpCircle,
    MoveRight,
    Crosshair,
    FlagTriangleRight,
    CornerUpRight,
    Scissors,
    ArrowUpRight,
    Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/routing";

// Types
import { Match, Player, EventType, MatchEvent, PenaltyShot } from "@/types";

// Components & Hooks
import { MatchTimeControl } from "./console/time-control";
import { Scoreboard } from "./console/scoreboard";
import { EventLog } from "./console/log";
import { MatchEventDialog } from "@/features/dialogs";
import { WalkoverDialog } from "@/features/dialogs";
import { PenaltyShootoutDialog } from "@/features/dialogs";
import { AddTimeDialog, SetTimeDialog } from "@/features/dialogs";
import { BroadcastDialog } from "@/features/broadcast";
import { RosterSelectionDialog } from "@/features/dialogs";
import { FootballSettingsDialog, FootballStatisticsDialog } from "@/features/dialogs";
import { MatchStatisticsBox } from "./console/statistics-box";
import { TeamRosterDialog } from "@/components/teams/team-roster-dialog";
import { useMatchTimer } from "@/hooks/use-match-timer";
import { useMatchEvents } from "@/hooks/use-match-events";
import { EVENT_TYPES } from "./console/constants";
import { Header } from "@/components/ui/header";

interface ConsolePageProps {
    match: Match;
    tournamentId: string;
    readOnly?: boolean;
    initialEvents?: MatchEvent[];
    backUrl: string;
    tournamentName?: string;
    rulesConfig?: Record<string, unknown> | null;
    fullWidthScoreboard?: boolean;
    sport?: string;
}

export function ConsolePage({ match: initialMatch, tournamentId, readOnly = false, initialEvents, backUrl, tournamentName: _tournamentName, rulesConfig, fullWidthScoreboard = false, sport }: ConsolePageProps) {
    const t = useTranslations("Console");
    const locale = useLocale();
    const tMatch = useTranslations("Match");
    const tCommon = useTranslations("Common");
    const _tPublic = useTranslations("PublicView");
    const { toast } = useToast();
    const isFullWidth = fullWidthScoreboard || readOnly;


    // --- State ---
    const [match, setMatch] = useState<Match>(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem(`tourni-match-snapshot-${initialMatch.id}`);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed && parsed.id === initialMatch.id) {
                        return { ...initialMatch, ...parsed };
                    }
                }
            } catch (_) { }
        }
        return initialMatch;
    });
    const [homePlayers, setHomePlayers] = useState<Player[]>([]);
    const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
    const [playersLoading, setPlayersLoading] = useState(true);
    const ALL_CUSTOMIZABLE_ACTIONS = [
        'pass', 'cross', 'possession', 'foul', 'substitution',
        'yellow_card', 'save', 'injury', 'corner', 'missed_shot',
        'bad_pass', 'offside'
    ];
    const DEFAULT_STATS_KEYS = ['goal', 'yellow_card', 'red_card'];
    const ALL_LOG_EVENT_TYPES = [
        'goal',
        'penalty_shot',
        'yellow_card',
        'red_card',
        'substitution',
        'foul',
        'save',
        'corner',
        'offside',
        'missed_shot',
        'pass',
        'bad_pass',
        'cross',
        'possession',
        'injury',
        'var',
        'timeout',
        'period_lifecycle',
        'add_time',
        'walkover',
    ];
    const [customActionTypes, setCustomActionTypes] = useState<string[]>(() => {
        if (Array.isArray(rulesConfig?.custom_actions)) {
            return rulesConfig.custom_actions as string[];
        }
        if (typeof window !== "undefined") {
            try {
                const savedCustom = localStorage.getItem("tourni-custom-actions");
                if (savedCustom) {
                    const parsed = JSON.parse(savedCustom);
                    if (Array.isArray(parsed)) return parsed;
                }
            } catch (_) { }
        }
        return ALL_CUSTOMIZABLE_ACTIONS;
    });
    const [showScoreboardPossession, setShowScoreboardPossession] = useState<boolean>(() => {
        if (typeof rulesConfig?.scoreboard_possession === 'boolean') {
            return rulesConfig.scoreboard_possession;
        }
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem("tourni-scoreboard-possession");
                if (saved !== null) return saved === "true";
            } catch (_) { }
        }
        return true;
    });
    const [visibleStats, setVisibleStats] = useState<string[]>(() => {
        if (Array.isArray(rulesConfig?.visible_stats)) {
            return rulesConfig.visible_stats as string[];
        }
        if (typeof window !== "undefined") {
            try {
                const savedStats = localStorage.getItem("tourni-visible-stats");
                if (savedStats) {
                    const parsed = JSON.parse(savedStats);
                    if (Array.isArray(parsed)) return parsed;
                }
            } catch (_) { }
        }
        return DEFAULT_STATS_KEYS;
    });
    const [visibleLogs, setVisibleLogs] = useState<string[]>(() => {
        if (Array.isArray(rulesConfig?.visible_logs)) {
            return rulesConfig.visible_logs as string[];
        }
        if (typeof window !== "undefined") {
            try {
                const savedLogs = localStorage.getItem("tourni-visible-logs");
                if (savedLogs) {
                    const parsed = JSON.parse(savedLogs);
                    if (Array.isArray(parsed)) return parsed;
                }
            } catch (_) { }
        }
        return ALL_LOG_EVENT_TYPES;
    });
    const [customizeDialogOpen, setCustomizeDialogOpen] = useState(false);

    // Load custom action preferences from rulesConfig or localStorage
    useEffect(() => {
        if (Array.isArray(rulesConfig?.visible_stats)) {
            setVisibleStats(rulesConfig.visible_stats as string[]);
        } else if (typeof window !== "undefined") {
            try {
                const savedStats = localStorage.getItem("tourni-visible-stats");
                if (savedStats) {
                    const parsed = JSON.parse(savedStats);
                    if (Array.isArray(parsed)) {
                        setVisibleStats(parsed);
                    }
                } else {
                    setVisibleStats(DEFAULT_STATS_KEYS);
                }
            } catch (_) { }
        }

        if (Array.isArray(rulesConfig?.visible_logs)) {
            setVisibleLogs(rulesConfig.visible_logs as string[]);
        } else if (typeof window !== "undefined") {
            try {
                const savedLogs = localStorage.getItem("tourni-visible-logs");
                if (savedLogs) {
                    const parsed = JSON.parse(savedLogs);
                    if (Array.isArray(parsed)) {
                        setVisibleLogs(parsed);
                    }
                } else {
                    setVisibleLogs(ALL_LOG_EVENT_TYPES);
                }
            } catch (_) { }
        }

        if (Array.isArray(rulesConfig?.custom_actions)) {
            setCustomActionTypes(rulesConfig.custom_actions as string[]);
        } else if (typeof window !== "undefined") {
            try {
                const savedCustom = localStorage.getItem("tourni-custom-actions");
                if (savedCustom) {
                    const parsed = JSON.parse(savedCustom);
                    if (Array.isArray(parsed)) {
                        setCustomActionTypes(parsed);
                    }
                }
            } catch (_) { }
        }

        if (typeof rulesConfig?.scoreboard_possession === 'boolean') {
            setShowScoreboardPossession(rulesConfig.scoreboard_possession);
        } else if (typeof window !== "undefined") {
            try {
                const savedScoreboardPoss = localStorage.getItem("tourni-scoreboard-possession");
                if (savedScoreboardPoss !== null) {
                    setShowScoreboardPossession(savedScoreboardPoss === "true");
                }
            } catch (_) { }
        }
    }, [rulesConfig]);

    const toggleCustomAction = (type: string) => {
        setCustomActionTypes((prev) => {
            const next = prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type];
            if (typeof window !== "undefined") {
                localStorage.setItem("tourni-custom-actions", JSON.stringify(next));
            }
            if (!readOnly && match.tournament_category_id) {
                updateCategoryRulesConfig(tournamentId, String(match.tournament_category_id), { custom_actions: next }).catch(console.error);
            }
            return next;
        });
    };

    const toggleScoreboardPossession = (enabled: boolean) => {
        setShowScoreboardPossession(enabled);
        if (typeof window !== "undefined") {
            localStorage.setItem("tourni-scoreboard-possession", String(enabled));
        }
        if (!readOnly && match.tournament_category_id) {
            updateCategoryRulesConfig(tournamentId, String(match.tournament_category_id), { scoreboard_possession: enabled }).catch(console.error);
        }
    };

    const toggleVisibleStat = (statKey: string) => {
        setVisibleStats((prev) => {
            const next = prev.includes(statKey) ? prev.filter((k) => k !== statKey) : [...prev, statKey];
            if (typeof window !== "undefined") {
                localStorage.setItem("tourni-visible-stats", JSON.stringify(next));
            }
            if (!readOnly && match.tournament_category_id) {
                updateCategoryRulesConfig(tournamentId, String(match.tournament_category_id), { visible_stats: next }).catch(console.error);
            }
            return next;
        });
    };

    const toggleVisibleLog = (logType: string) => {
        setVisibleLogs((prev) => {
            const next = prev.includes(logType) ? prev.filter((t) => t !== logType) : [...prev, logType];
            if (typeof window !== "undefined") {
                localStorage.setItem("tourni-visible-logs", JSON.stringify(next));
            }
            if (!readOnly && match.tournament_category_id) {
                updateCategoryRulesConfig(tournamentId, String(match.tournament_category_id), { visible_logs: next }).catch(console.error);
            }
            return next;
        });
    };

    const isTh = locale === "th";
    const isFutsal = Boolean(
        sport === 'futsal' ||
        sport?.includes('futsal') ||
        sport?.includes('ฟุตซอล') ||
        (match as any).sport === 'futsal' ||
        (match as any).sport?.includes('futsal') ||
        (match as any).sport?.includes('ฟุตซอล') ||
        (match as any).sport_name?.toLowerCase().includes('futsal') ||
        (match as any).sport_name?.includes('ฟุตซอล') ||
        (rulesConfig as any)?.sport === 'futsal' ||
        (rulesConfig as any)?.sport?.includes('futsal') ||
        (rulesConfig as any)?.sport?.includes('ฟุตซอล')
    );
    const futsalHalfMinutes = Number((rulesConfig as any)?.futsal_half_length || (rulesConfig as any)?.half_length || (rulesConfig as any)?.period_length) || 20;
    const futsalHalfSeconds = futsalHalfMinutes * 60;

    // Hooks
    const { events, queue, isSyncing, syncQueue, addEvent, deleteEvent, handleIncomingEvent, handleIncomingDelete } = useMatchEvents(match.id, tournamentId, initialEvents, readOnly);
    const { time, setTime, isRunning, setIsRunning } = useMatchTimer(
        match,
        tournamentId,
        events,
        0,
        isFutsal,
        futsalHalfSeconds
    );

    // Team Fouls & Timeouts Calculation (Resets per half)
    const { homeFouls, awayFouls, homeTimeoutUsed, awayTimeoutUsed } = useMemo(() => {
        const sorted = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        // Find latest period boundary
        let currentPeriodStartIdx = 0;
        let isSecondHalfOrET = false;
        
        sorted.forEach((e, idx) => {
            const t = e.event_type || (e as any).type;
            if (t === 'second_half') {
                currentPeriodStartIdx = idx;
                isSecondHalfOrET = true;
            }
        });

        // Filter events relevant to current period
        const periodEvents = isSecondHalfOrET ? sorted.slice(currentPeriodStartIdx) : sorted;

        let hFouls = 0;
        let aFouls = 0;
        let hTO = false;
        let aTO = false;

        const effectiveHomeId = match.home_team_id || match.home_team?.id || 'home';
        const effectiveAwayId = match.away_team_id || match.away_team?.id || 'away';

        periodEvents.forEach(e => {
            const extra = (e.extra_info as Record<string, unknown> | null) || (e.detail as Record<string, unknown> | null) || {};
            const teamSide = extra.team_side as string | undefined;
            const isHome = teamSide === 'home' || e.team_id === effectiveHomeId || (Boolean(match.home_team_id) && e.team_id === match.home_team_id);
            const isAway = teamSide === 'away' || e.team_id === effectiveAwayId || (Boolean(match.away_team_id) && e.team_id === match.away_team_id);
            const t = e.event_type || (e as any).type;

            if (t === 'foul') {
                if (isHome) hFouls++;
                else if (isAway) aFouls++;
            }

            if (t === 'timeout') {
                if (isHome) hTO = true;
                else if (isAway) aTO = true;
            }
        });

        return { homeFouls: hFouls, awayFouls: aFouls, homeTimeoutUsed: hTO, awayTimeoutUsed: aTO };
    }, [events, match.home_team_id, match.away_team_id, match.home_team?.id, match.away_team?.id]);

    // Futsal Red Card 2-Minute Penalty Tracking
    const redCardPenaltyStatus = useMemo(() => {
        if (!isFutsal) return { home: { canReturn: false, reason: '' }, away: { canReturn: false, reason: '' } };

        const getStatusForTeam = (teamSide: 'home' | 'away') => {
            const teamId = teamSide === 'home' ? match.home_team_id : match.away_team_id;
            const opponentId = teamSide === 'home' ? match.away_team_id : match.home_team_id;
            const opponentSide = teamSide === 'home' ? 'away' : 'home';

            // Find all red card events for this team
            const redEvents = events.filter(e => {
                const type = e.event_type || e.type;
                const extra = (e.extra_info || e.detail) as Record<string, unknown> | null;
                const isRed = type === 'red_card' || extra?.card_type === 'red';
                if (!isRed) return false;
                const side = extra?.team_side;
                if (side) return side === teamSide;
                return Boolean(e.team_id) && (e.team_id === teamId || e.team_id === (teamSide === 'home' ? match.home_team?.id : match.away_team?.id));
            });

            if (redEvents.length === 0) return { canReturn: false, reason: '' };

            // Find penalty return substitutions already made by this team
            const restoreSubs = events.filter(e => {
                const type = e.event_type || e.type;
                const extra = (e.extra_info || e.detail) as Record<string, unknown> | null;
                if (type !== 'substitution') return false;
                const side = extra?.team_side;
                const isThisTeam = side ? (side === teamSide) : (e.team_id === teamId || e.team_id === (teamSide === 'home' ? match.home_team?.id : match.away_team?.id));
                if (!isThisTeam) return false;
                return Boolean(extra?.is_penalty_return || !extra?.out_player_id || extra?.out_player_id === 'none');
            });

            if (restoreSubs.length >= redEvents.length) {
                return { canReturn: false, reason: '' };
            }

            // Sort red cards chronologically
            const sortedReds = [...redEvents].sort((a, b) => {
                const extraA = (a.extra_info || a.detail) as Record<string, unknown> | null;
                const extraB = (b.extra_info || b.detail) as Record<string, unknown> | null;
                const secA = typeof extraA?.match_seconds === 'number' ? extraA.match_seconds : Math.max(0, ((a.minute || 1) - 1) * 60);
                const secB = typeof extraB?.match_seconds === 'number' ? extraB.match_seconds : Math.max(0, ((b.minute || 1) - 1) * 60);
                return secA - secB;
            });

            const unfulfilledReds = sortedReds.slice(restoreSubs.length);
            if (unfulfilledReds.length === 0) return { canReturn: false, reason: '' };

            const earliestRed = unfulfilledReds[0];
            const extraRed = (earliestRed.extra_info || earliestRed.detail) as Record<string, unknown> | null;
            const redSec = typeof extraRed?.match_seconds === 'number' ? extraRed.match_seconds : Math.max(0, ((earliestRed.minute || 1) - 1) * 60);

            // 1. Has 2 minutes passed?
            const twoMinutesPassed = isFutsal ? (time <= redSec - 120) : (time >= redSec + 120);

            // 2. Did opponent score a goal after red card within 2 minutes?
            const opponentGoals = events.filter(e => {
                const type = e.event_type || e.type;
                const extra = (e.extra_info || e.detail) as Record<string, unknown> | null;
                const isGoal = type === 'goal' || type === 'penalty_shot';
                if (!isGoal) return false;
                const side = extra?.team_side;
                const isOpp = side ? (side === opponentSide) : (e.team_id === opponentId || e.team_id === (opponentSide === 'home' ? match.home_team?.id : match.away_team?.id));
                if (!isOpp) return false;

                const gSec = typeof extra?.match_seconds === 'number' ? extra.match_seconds : Math.max(0, ((e.minute || 1) - 1) * 60);
                return isFutsal
                    ? (gSec <= redSec && gSec >= redSec - 120)
                    : (gSec >= redSec && gSec <= redSec + 120);
            });
            const goalConceded = opponentGoals.length > 0;

            if (goalConceded) {
                return {
                    canReturn: true,
                    reason: isTh
                        ? "เสียประตูในช่วง 2 นาทีหลังใบแดง สามารถส่งผู้เล่นลงสนามแทนได้ทันที"
                        : "Conceded a goal during 2-minute penalty. Allowed to return to full strength."
                };
            }

            if (twoMinutesPassed) {
                return {
                    canReturn: true,
                    reason: isTh
                        ? "ผ่านไปครบ 2 นาทีหลังใบแดงแล้ว สามารถส่งผู้เล่นลงสนามแทนได้"
                        : "2-minute penalty period has elapsed. Allowed to return to full strength."
                };
            }

            const remainingSec = isFutsal
                ? Math.max(0, time - (redSec - 120))
                : Math.max(0, (redSec + 120) - time);
            const remMins = Math.floor(remainingSec / 60);
            const remSecs = remainingSec % 60;
            return {
                canReturn: false,
                reason: isTh
                    ? `อยู่ในช่วงโทษแบนใบแดง 2 นาที (เหลืออีก ${remMins}:${String(remSecs).padStart(2, '0')} นาที)`
                    : `Active 2-minute penalty (${remMins}:${String(remSecs).padStart(2, '0')} remaining)`
            };
        };

        return {
            home: getStatusForTeam('home'),
            away: getStatusForTeam('away')
        };
    }, [isFutsal, events, time, match.home_team_id, match.away_team_id, match.home_team?.id, match.away_team?.id, isTh]);

    type MatchQueueItem = {
        id: string;
        data: Parameters<typeof updateMatch>[1];
        status: "pending" | "syncing" | "failed";
    };

    // Match updates queue state
    const [matchQueue, setMatchQueue] = useState<MatchQueueItem[]>([]);
    const [isMatchSyncing, setIsMatchSyncing] = useState(false);
    const isMatchSyncingRef = useRef(false);
    const matchQueueRef = useRef<MatchQueueItem[]>([]);
    matchQueueRef.current = matchQueue;

    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedMatchKey = `tourni-pending-match-${match.id}`;
            const saved = localStorage.getItem(savedMatchKey);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) {
                        setMatchQueue(parsed);
                    }
                } catch (_) { }
            }
        }
    }, [match.id]);

    const persistMatchQueue = useCallback((newQueue: MatchQueueItem[]) => {
        setMatchQueue(newQueue);
        if (typeof window !== "undefined") {
            localStorage.setItem(`tourni-pending-match-${match.id}`, JSON.stringify(newQueue));
        }
    }, [match.id]);

    const syncMatchQueue = useCallback(async () => {
        if (isMatchSyncingRef.current || readOnly) return;

        const currentQueue = matchQueueRef.current;
        const pendingItems = currentQueue.filter((item: MatchQueueItem) => item.status === 'pending');

        if (pendingItems.length === 0) return;

        isMatchSyncingRef.current = true;
        setIsMatchSyncing(true);

        let workingQueue = [...currentQueue];

        for (const item of pendingItems) {
            workingQueue = workingQueue.map(m => m.id === item.id ? { ...m, status: 'syncing' as const } : m);
            matchQueueRef.current = workingQueue;
            persistMatchQueue(workingQueue);

            try {
                let success = false;
                try {
                    const res = await updateMatch(match.id, item.data, tournamentId);
                    if (res.success) {
                        success = true;
                    }
                } catch (_serverActionErr) {
                    console.warn("Server action updateMatch failed, attempting direct API fallback...", _serverActionErr);
                }

                if (!success) {
                    // Direct API fallback using local JWT
                    try {
                        await ApiClient.fetch(`/matches/${match.id}`, {
                            method: 'PUT',
                            body: JSON.stringify(item.data),
                        });
                        success = true;
                    } catch (apiErr) {
                        console.error("Direct API Fallback error:", apiErr);
                    }
                }

                if (success) {
                    workingQueue = workingQueue.filter(m => m.id !== item.id);
                    matchQueueRef.current = workingQueue;
                    persistMatchQueue(workingQueue);
                } else {
                    workingQueue = workingQueue.map(m => m.id === item.id ? { ...m, status: 'failed' as const } : m);
                    matchQueueRef.current = workingQueue;
                    persistMatchQueue(workingQueue);
                }
            } catch (_err) {
                workingQueue = workingQueue.map(m => m.id === item.id ? { ...m, status: 'failed' as const } : m);
                matchQueueRef.current = workingQueue;
                persistMatchQueue(workingQueue);
            }
        }
        isMatchSyncingRef.current = false;
        setIsMatchSyncing(false);
    }, [match.id, tournamentId, readOnly, persistMatchQueue]);

    // Auto-sync match queue on online event
    useEffect(() => {
        if (typeof window !== "undefined") {
            const handleOnline = () => {
                syncMatchQueue();
            };
            window.addEventListener("online", handleOnline);
            return () => window.removeEventListener("online", handleOnline);
        }
    }, [syncMatchQueue]);

    const queueMatchUpdate = useCallback(async (data: Parameters<typeof updateMatch>[1]) => {
        const newItem = { id: `match-${Date.now()}`, data, status: 'pending' as const };
        const nextQueue = [...matchQueueRef.current, newItem];
        matchQueueRef.current = nextQueue;
        persistMatchQueue(nextQueue);
        setMatch(prev => ({ ...prev, ...data }));
        setTimeout(() => {
            syncMatchQueue();
        }, 50);
    }, [persistMatchQueue, syncMatchQueue]);

    const directUpdateMatch = useCallback(async (data: Parameters<typeof updateMatch>[1]) => {
        setMatch(prev => ({ ...prev, ...data }));
        let success = false;
        try {
            const res = await updateMatch(match.id, data, tournamentId);
            if (res.success) success = true;
        } catch (_err) {
            console.warn("Server action updateMatch failed, attempting direct API fallback...", _err);
        }
        if (!success) {
            try {
                await ApiClient.fetch(`/matches/${match.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(data),
                });
                success = true;
            } catch (apiErr) {
                console.error("Direct API fallback error:", apiErr);
            }
        }
        return success;
    }, [match.id, tournamentId]);

    const lastPeriodEvent = events.find(e =>
        e.event_type === 'first_half' ||
        e.event_type === 'half_time' ||
        e.event_type === 'second_half' ||
        e.event_type === 'full_time' ||
        e.event_type === 'extra_time' ||
        e.event_type === 'extra_time_half_time' ||
        e.event_type === 'extra_time_second_half' ||
        e.event_type === 'penalties'
    );
    const lastPeriodEventType = lastPeriodEvent?.event_type;
    const isHalfTime = !isRunning && lastPeriodEventType === 'half_time';

    // Lineup / Roster Selection States
    const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
    const [homeLineup, setHomeLineup] = useState<string[]>([]);
    const [awayLineup, setAwayLineup] = useState<string[]>([]);

    // Dialog States
    const [eventDialogOpen, setEventDialogOpen] = useState(false);
    const [teamInfoTarget, setTeamInfoTarget] = useState<'home' | 'away' | null>(null);
    const [woDialogOpen, setWoDialogOpen] = useState(false);
    const [addTimeDialogOpen, setAddTimeDialogOpen] = useState(false);
    const [setTimeDialogOpen, setSetTimeDialogOpen] = useState(false);
    const [overlayDialogOpen, setOverlayDialogOpen] = useState(false);
    const [statsDialogOpen, setStatsDialogOpen] = useState(false);
    const [penaltyDialogOpen, setPenaltyDialogOpen] = useState(false);
    const [_penaltyShots, setPenaltyShots] = useState<PenaltyShot[]>([]);

    // Event Selection State
    const [selectedTeamId, setSelectedTeamId] = useState<string>("");
    const [selectedTeamSide, setSelectedTeamSide] = useState<'home' | 'away'>("home");
    const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);

    // Confirm Dialog State
    const [confirmConfig, setConfirmConfig] = useState<{
        open: boolean;
        title: string;
        description?: string;
        actionLabel?: string;
        cancelLabel?: string;
        onConfirm: () => void | Promise<void>;
    }>({
        open: false,
        title: "",
        description: "",
        actionLabel: "",
        cancelLabel: "",
        onConfirm: () => { },
    });

    // --- Effects ---
    useEffect(() => {
        setMatch(initialMatch);
    }, [initialMatch]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(`match-lineup-${match.id}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.home) setHomeLineup(parsed.home);
                    if (parsed.away) setAwayLineup(parsed.away);
                } catch (e) {
                    console.error("Failed to parse saved lineup:", e);
                }
            } else if (!readOnly && match.status !== 'live' && match.status !== 'finished') {
                setRosterDialogOpen(true);
            }
        }
    }, [match.id, match.status, readOnly]);

    const handleSaveLineup = (homeActive: string[], awayActive: string[]) => {
        setHomeLineup(homeActive);
        setAwayLineup(awayActive);
        if (typeof window !== "undefined") {
            localStorage.setItem(
                `match-lineup-${match.id}`,
                JSON.stringify({ home: homeActive, away: awayActive })
            );
        }
    };

    useEffect(() => {
        let isMounted = true;
        const loadPlayers = async () => {
            setPlayersLoading(true);
            try {
                const homeId = match.home_team_id || match.home_team?.id;
                const awayId = match.away_team_id || match.away_team?.id;
                const [homeRes, awayRes] = await Promise.all([
                    homeId ? getPlayers(homeId) : Promise.resolve({ success: true, data: [] }),
                    awayId ? getPlayers(awayId) : Promise.resolve({ success: true, data: [] })
                ]);
                if (isMounted) {
                    if (homeRes.success && homeRes.data) setHomePlayers(homeRes.data);
                    if (awayRes.success && awayRes.data) setAwayPlayers(awayRes.data);
                }
            } catch (err) {
                console.error("Error loading team players:", err);
            } finally {
                if (isMounted) setPlayersLoading(false);
            }
        };
        loadPlayers();
        return () => { isMounted = false; };
    }, [match.home_team_id, match.away_team_id, match.home_team?.id, match.away_team?.id]);

    const fetchShots = useCallback(async () => {
        const res = await getPenaltyShootout(match.id);
        if (res.success && res.data) {
            const shots = res.data;
            setPenaltyShots(shots);

            const homeId = match.home_team_id || match.home_team?.id;
            const awayId = match.away_team_id || match.away_team?.id;

            const hShots = shots.filter((s: PenaltyShot) => s.team_id === homeId);
            const aShots = shots.filter((s: PenaltyShot) => s.team_id === awayId);
            const pHome = hShots.filter((s: PenaltyShot) => s.scored).length;
            const pAway = aShots.filter((s: PenaltyShot) => s.scored).length;

            const hLen = hShots.length;
            const aLen = aShots.length;
            const maxShots = Math.max(hLen, aLen);
            let decidedWinner: string | null = null;

            if (maxShots > 0) {
                if (maxShots <= 5) {
                    const hRem = 5 - hLen;
                    const aRem = 5 - aLen;
                    if (pHome > pAway + aRem) decidedWinner = homeId || null;
                    else if (pAway > pHome + hRem) decidedWinner = awayId || null;
                } else {
                    if (hLen === aLen) {
                        if (pHome > pAway) decidedWinner = homeId || null;
                        else if (pAway > pHome) decidedWinner = awayId || null;
                    }
                }
            }

            if (hShots.length > 0 || aShots.length > 0) {
                setMatch((prev) => ({
                    ...prev,
                    penalty_home_score: pHome,
                    penalty_away_score: pAway,
                    winner_id: decidedWinner || prev.winner_id,
                }));
            }
        }
    }, [match.id, match.home_team_id, match.away_team_id, match.home_team?.id, match.away_team?.id]);

    const handlePenaltyShootoutComplete = useCallback(async (pHome: number, pAway: number, winnerTeamId: string) => {
        setMatch((prev) => ({
            ...prev,
            penalty_home_score: pHome,
            penalty_away_score: pAway,
            winner_id: winnerTeamId,
        }));
        await directUpdateMatch({
            penalty_home_score: pHome,
            penalty_away_score: pAway,
            winner_id: winnerTeamId,
            winner_to_node_id: winnerTeamId,
        });
        toast({
            title: t("penalty_recorded") || "บันทึกผลการดวลจุดโทษเรียบร้อย",
            description: `${match.home_team?.name || 'Home'} ${pHome} - ${pAway} ${match.away_team?.name || 'Away'}`,
        });
    }, [match.home_team?.name, match.away_team?.name, directUpdateMatch, t, toast]);

    useEffect(() => {
        fetchShots();
    }, [fetchShots]);

    // Persist match state snapshot to localStorage for 0ms render & offline resilience
    useEffect(() => {
        if (typeof window !== "undefined" && match.id) {
            localStorage.setItem(`tourni-match-snapshot-${match.id}`, JSON.stringify(match));
        }
    }, [match]);

    // 100% Realtime WebSocket Connection
    useMatchWebSocket(match.id, {
        onScoreUpdate: (payload) => {
            setMatch((prev) => ({
                ...prev,
                home_score: payload.home_score,
                away_score: payload.away_score,
                status: (payload.status as Match["status"]) || prev.status
            }));
        },
        onMatchEvent: (payload) => {
            if (payload?.event) {
                handleIncomingEvent(payload.event);
            }
        },
        onMatchEventDelete: (payload) => {
            if (payload?.event_id) {
                handleIncomingDelete(payload.event_id);
            }
        },
        onMatchUpdate: (payload) => {
            if (payload?.match) {
                setMatch((prev) => ({
                    ...prev,
                    ...payload.match
                }));
            }
        },
        onStatusChange: (payload) => {
            if (payload?.status) {
                setMatch((prev) => ({
                    ...prev,
                    status: payload.status as Match["status"]
                }));
            }
        }
    });

    // --- Computed Data ---
    const isHomeTeam = (id: string) => id === match.home_team_id || id === match.home_team?.id;
    const isAwayTeam = (id: string) => id === match.away_team_id || id === match.away_team?.id;

    const getScoreValue = (score: unknown): number => {
        if (!score) return 0;
        if (typeof score === 'object' && score !== null && 'total' in score) {
            return Number((score as Record<string, unknown>).total) || 0;
        }
        return Number(score) || 0;
    };

    const dbHomeScore = getScoreValue(match.home_score);
    const dbAwayScore = getScoreValue(match.away_score);

    const homeScore = match.status === 'finished' ? dbHomeScore : events.filter((e: MatchEvent) => e.team_id && isHomeTeam(e.team_id) && e.event_type === 'goal').length;
    const awayScore = match.status === 'finished' ? dbAwayScore : events.filter((e: MatchEvent) => e.team_id && isAwayTeam(e.team_id) && e.event_type === 'goal').length;
    const allPlayers = [...homePlayers, ...awayPlayers];

    // --- Score Sync to DB (for MatchCard) ---
    useEffect(() => {
        if (readOnly || match.status === 'finished') return;

        // Only sync if scores differ from DB values
        if (homeScore !== dbHomeScore || awayScore !== dbAwayScore) {
            const syncScore = setTimeout(() => {
                queueMatchUpdate({ home_score: homeScore, away_score: awayScore });
            }, 500);
            return () => clearTimeout(syncScore);
        }
    }, [homeScore, awayScore, dbHomeScore, dbAwayScore, match.id, readOnly, match.status, queueMatchUpdate]);

    // --- Timer Sync to DB (for MatchCard) ---
    useEffect(() => {
        if (readOnly || match.status !== 'live' || !isRunning) return;

        const currentMinute = isFutsal
            ? Math.floor(Math.max(0, futsalHalfSeconds - time) / 60) + 1
            : Math.floor(time / 60) + 1;

        if (currentMinute !== Number(match.current_minute)) {
            const syncTimer = setTimeout(() => {
                queueMatchUpdate({ current_minute: currentMinute });
            }, 1000);
            return () => clearTimeout(syncTimer);
        }
    }, [time, isRunning, match.status, match.current_minute, match.id, tournamentId, readOnly, queueMatchUpdate, isFutsal, futsalHalfSeconds]);

    // Futsal auto-pause when countdown reaches 0
    useEffect(() => {
        if (isFutsal && isRunning && time <= 0 && match.status === 'live') {
            setIsRunning(false);
            queueMatchUpdate({
                status: 'live',
                timer_status: 'paused',
                elapsed_before_pause: 0,
                elapsed_seconds: 0
            });
            toast({
                title: isTh ? "⏰ หมดเวลาการแข่งขันในครึ่งนี้" : "⏰ Time expired for this period",
                description: isTh ? "เวลานับถอยหลังถึง 00:00 แล้ว" : "Countdown reached 00:00"
            });
        }
    }, [isFutsal, isRunning, time, match.status, queueMatchUpdate, isTh, toast]);

    // --- Handlers ---
    const handleStartMatch = async () => {
        if (readOnly) return;
        const currentSeconds = isFutsal ? (time > 0 ? time : futsalHalfSeconds) : time;
        const currentMinute = isFutsal
            ? Math.floor(Math.max(0, futsalHalfSeconds - currentSeconds) / 60) + 1
            : Math.floor(currentSeconds / 60) + 1;

        // Optimistic UI Update
        if (isFutsal && time === 0) {
            setTime(futsalHalfSeconds);
        }
        setIsRunning(true);

        try {
            await addEvent(null, 'first_half', currentMinute, null, { start_timestamp: Date.now() }, "First Half");
            await queueMatchUpdate({
                status: 'live',
                timer_status: 'playing',
                elapsed_before_pause: currentSeconds,
                elapsed_seconds: currentSeconds,
                current_minute: currentMinute
            });
            toast({ title: t("first_half") || t("match_started") || "First Half Started" });
        } catch (error) {
            console.error("Start match error:", error);
        }
    };

    const handlePauseMatch = async () => {
        if (readOnly) return;
        const currentSeconds = time;
        const currentMinute = isFutsal
            ? Math.floor(Math.max(0, futsalHalfSeconds - currentSeconds) / 60) + 1
            : Math.floor(currentSeconds / 60) + 1;

        // Optimistic UI Update
        setIsRunning(false);

        try {
            await queueMatchUpdate({
                status: 'live',
                timer_status: 'paused',
                elapsed_before_pause: currentSeconds,
                elapsed_seconds: currentSeconds,
                current_minute: currentMinute
            });
            toast({ title: t("match_paused") || "Match Paused" });
        } catch (error) {
            console.error("Pause match error:", error);
        }
    };

    const handleHalfTime = async () => {
        if (readOnly) return;
        const currentSeconds = time;
        const currentMinute = isFutsal ? futsalHalfMinutes : Math.floor(currentSeconds / 60) + 1;

        // Optimistic UI Update
        setIsRunning(false);

        try {
            await addEvent(null, 'half_time', currentMinute, null, {}, "Half Time");
            await queueMatchUpdate({
                status: 'live',
                timer_status: 'paused',
                elapsed_before_pause: currentSeconds,
                elapsed_seconds: currentSeconds,
                current_minute: currentMinute
            });
            toast({ title: t("half_time") || "Half Time" });
        } catch (error) {
            console.error("Half time error:", error);
        }
    };

    const handleRegularFullTime = async () => {
        if (readOnly) return;
        const currentSeconds = time;
        const currentMinute = Math.floor(currentSeconds / 60) + 1;

        // Optimistic UI Update
        setIsRunning(false);

        try {
            await addEvent(null, 'full_time', currentMinute, null, {}, "End Regular Time");
            await queueMatchUpdate({
                status: 'live',
                timer_status: 'paused',
                elapsed_before_pause: currentSeconds,
                elapsed_seconds: currentSeconds,
                current_minute: currentMinute
            });
            toast({ title: t("regular_full_time") || "End of Regular Time" });
        } catch (error) {
            console.error("Regular full time error:", error);
        }
    };

    const handleStartExtraTime = async () => {
        if (readOnly) return;
        let currentSeconds = time;
        if (isFutsal) {
            currentSeconds = 5 * 60;
            setTime(5 * 60);
        }
        const currentMinute = Math.floor(currentSeconds / 60) + 1;

        // Optimistic UI Update
        setIsRunning(true);

        try {
            await addEvent(null, 'extra_time', currentMinute, null, { start_timestamp: Date.now() }, "Extra Time");
            await queueMatchUpdate({
                status: 'live',
                timer_status: 'playing',
                elapsed_before_pause: currentSeconds,
                elapsed_seconds: currentSeconds,
                current_minute: currentMinute
            });
            toast({ title: t("start_extra_time") || "Extra Time Started" });
        } catch (error) {
            console.error("Start extra time error:", error);
        }
    };

    const handleExtraTimeHalfTime = async () => {
        if (readOnly) return;
        const currentSeconds = time;
        const currentMinute = Math.floor(currentSeconds / 60) + 1;

        // Optimistic UI Update
        setIsRunning(false);

        try {
            await addEvent(null, 'extra_time_half_time', currentMinute, null, {}, "Extra Time Half Time");
            await queueMatchUpdate({
                status: 'live',
                timer_status: 'paused',
                elapsed_before_pause: currentSeconds,
                elapsed_seconds: currentSeconds,
                current_minute: currentMinute
            });
            toast({ title: t("pause_extra_time") || "Extra Time Break" });
        } catch (error) {
            console.error("Extra time half time error:", error);
        }
    };

    const handleStartPenalties = async () => {
        if (readOnly) return;
        const currentSeconds = time;
        const currentMinute = Math.floor(currentSeconds / 60) + 1;

        // Optimistic UI Update
        setIsRunning(false);

        // Open Penalty Shootout Dialog immediately
        setPenaltyDialogOpen(true);

        try {
            if (lastPeriodEventType !== 'penalties') {
                await addEvent(null, 'penalties', currentMinute, null, {}, "Penalty Shootout");
                await queueMatchUpdate({
                    status: 'live',
                    timer_status: 'paused',
                    elapsed_before_pause: currentSeconds,
                    elapsed_seconds: currentSeconds,
                    current_minute: currentMinute
                });
                toast({ title: t("start_penalties") || "Penalty Shootout Started" });
            }
        } catch (error) {
            console.error("Start penalties error:", error);
        }
    };

    const handleResumeMatch = async () => {
        if (readOnly) return;
        let currentSeconds = time;
        if (isFutsal && lastPeriodEventType === 'half_time') {
            currentSeconds = futsalHalfSeconds;
            setTime(futsalHalfSeconds);
        } else if (isFutsal && lastPeriodEventType === 'extra_time_half_time') {
            currentSeconds = 5 * 60;
            setTime(5 * 60);
        }

        const currentMinute = isFutsal
            ? (lastPeriodEventType === 'half_time' ? futsalHalfMinutes + 1 : Math.floor(Math.max(0, futsalHalfSeconds - currentSeconds) / 60) + 1)
            : Math.floor(currentSeconds / 60) + 1;

        // Optimistic UI Update
        setIsRunning(true);

        try {
            if (lastPeriodEventType === 'half_time') {
                await addEvent(null, 'second_half', currentMinute, null, { start_timestamp: Date.now() }, "Second Half");
                toast({ title: t("second_half") || "Second Half Started" });
            } else if (lastPeriodEventType === 'extra_time_half_time') {
                await addEvent(null, 'extra_time_second_half', currentMinute, null, { start_timestamp: Date.now() }, "Extra Time 2nd Half");
                toast({ title: t("extra_time_second_half") || "Extra Time 2nd Half Started" });
            } else {
                toast({ title: t("match_resumed") || "Match Resumed" });
            }

            await queueMatchUpdate({
                status: 'live',
                timer_status: 'playing',
                elapsed_before_pause: currentSeconds,
                elapsed_seconds: currentSeconds,
                current_minute: currentMinute
            });
        } catch (error) {
            console.error("Resume match error:", error);
        }
    };

    const handleEndMatch = () => {
        setConfirmConfig({
            open: true,
            title: t("confirm_end") || "End Match?",
            description: t("confirm_end_desc") || "Are you sure you want to end the match and record final scores?",
            actionLabel: tCommon("confirm") || "Confirm",
            cancelLabel: tCommon("cancel") || "Cancel",
            onConfirm: async () => {
                const currentSeconds = time;
                const currentMinute = Math.floor(currentSeconds / 60) + 1;

                setIsRunning(false);
                await addEvent(null, 'full_time', currentMinute, null, {}, "Full Time");

                const endPayload: Parameters<typeof updateMatch>[1] = {
                    status: 'finished',
                    timer_status: 'stopped',
                    home_score: homeScore,
                    away_score: awayScore,
                    current_minute: currentMinute,
                    elapsed_before_pause: currentSeconds,
                    elapsed_seconds: currentSeconds,
                };

                const homeTeamId = match.home_team_id || match.home_team?.id;
                const awayTeamId = match.away_team_id || match.away_team?.id;

                if (match.winner_id) {
                    endPayload.winner_id = match.winner_id;
                    endPayload.winner_to_node_id = match.winner_id;
                } else if (homeScore > awayScore && homeTeamId) {
                    endPayload.winner_id = homeTeamId;
                    endPayload.winner_to_node_id = homeTeamId;
                } else if (awayScore > homeScore && awayTeamId) {
                    endPayload.winner_id = awayTeamId;
                    endPayload.winner_to_node_id = awayTeamId;
                } else if (homeScore === awayScore) {
                    const pHome = Number(match.penalty_home_score ?? 0);
                    const pAway = Number(match.penalty_away_score ?? 0);
                    if (pHome > pAway && homeTeamId) {
                        endPayload.winner_id = homeTeamId;
                        endPayload.winner_to_node_id = homeTeamId;
                    } else if (pAway > pHome && awayTeamId) {
                        endPayload.winner_id = awayTeamId;
                        endPayload.winner_to_node_id = awayTeamId;
                    }
                }

                if (match.penalty_home_score !== undefined && match.penalty_home_score !== null) {
                    endPayload.penalty_home_score = match.penalty_home_score;
                }
                if (match.penalty_away_score !== undefined && match.penalty_away_score !== null) {
                    endPayload.penalty_away_score = match.penalty_away_score;
                }

                await directUpdateMatch(endPayload);

                // Auto-advance if possible
                await advanceStage(tournamentId);
                const catId = match.category_id || match.tournament_category_id;
                if (catId) {
                    try {
                        await syncCategoryBracket(tournamentId, catId);
                    } catch (e) {
                        console.error("Failed to auto-sync bracket after finishing match:", e);
                    }
                }
            }
        });
    };

    const handleWalkover = (winnerId: string) => {
        const isHomeWinner = winnerId === match.home_team_id;
        setConfirmConfig({
            open: true,
            title: t("confirm_walkover") || "Confirm Walkover",
            description: t("confirm_walkover_desc", { teamName: (isHomeWinner ? match.home_team?.name : match.away_team?.name) || "" }) || (isHomeWinner ? `Confirm walkover victory for ${match.home_team?.name}` : `Confirm walkover victory for ${match.away_team?.name}`),
            actionLabel: tCommon("confirm") || "Confirm",
            cancelLabel: tCommon("cancel") || "Cancel",
            onConfirm: async () => {
                try {
                    setIsRunning(false);
                    await addEvent(winnerId, 'walkover', 0, null, { winner_id: winnerId }, `Walkover Victory (${isHomeWinner ? '3-0' : '0-3'})`);
                    await directUpdateMatch({
                        status: 'finished',
                        home_score: isHomeWinner ? 3 : 0,
                        away_score: isHomeWinner ? 0 : 3,
                        winner_id: winnerId,
                        current_minute: 0,
                        winner_to_node_id: winnerId,
                        timer_status: 'stopped'
                    });

                    // Auto-advance if possible
                    await advanceStage(tournamentId);
                    const catId = match.category_id || match.tournament_category_id;
                    if (catId) {
                        try {
                            await syncCategoryBracket(tournamentId, catId);
                        } catch (e) {
                            console.error("Failed to auto-sync bracket after walkover:", e);
                        }
                    }

                    setWoDialogOpen(false);
                } catch (error) {
                    console.error("Walkover error:", error);
                    toast({
                        title: t("error_recording_walkover") || "Error recording walkover",
                        description: t("please_try_again") || "Please try again",
                        variant: "destructive"
                    });
                }
            }
        });
    };

    const handleAbandonMatch = () => {
        setConfirmConfig({
            open: true,
            title: t("confirm_abandon") || "Abandon Match?",
            description: t("confirm_abandon_desc") || "Are you sure you want to abandon this match?",
            actionLabel: tCommon("confirm") || "Confirm",
            cancelLabel: tCommon("cancel") || "Cancel",
            onConfirm: async () => {
                try {
                    setIsRunning(false);
                    await queueMatchUpdate({
                        status: 'canceled',
                        timer_status: 'stopped',
                    });

                    toast({ title: t("abandoned") });
                } catch (error) {
                    console.error("Abandon match error:", error);
                    toast({
                        title: t("error_abandoning_match") || "Error abandoning match",
                        description: t("please_try_again") || "Please try again",
                        variant: "destructive"
                    });
                }
            }
        });
    };

    const handlePostponeMatch = () => {
        setConfirmConfig({
            open: true,
            title: t("confirm_postpone") || "Postpone Match?",
            description: t("confirm_postpone_desc") || "Are you sure you want to postpone this match?",
            actionLabel: tCommon("confirm") || "Confirm",
            cancelLabel: tCommon("cancel") || "Cancel",
            onConfirm: async () => {
                try {
                    setIsRunning(false);
                    await queueMatchUpdate({
                        status: 'scheduled',
                        timer_status: 'stopped',
                        match_date: null,
                        match_time: null,
                    });

                    toast({ title: t("postponed") });
                } catch (error) {
                    console.error("Postpone match error:", error);
                    toast({
                        title: t("error_postponing_match") || "Error postponing match",
                        description: t("please_try_again") || "Please try again",
                        variant: "destructive"
                    });
                }
            }
        });
    };

    const handleUndo = async () => {
        if (readOnly) return;
        const lastEvent = events.find((e: MatchEvent) => !e.id.startsWith("temp-"));
        if (!lastEvent) return toast({ title: t("no_events") });

        const evtConfig = EVENT_TYPES.find(e => e.type === lastEvent.event_type);
        const label = evtConfig ? t(evtConfig.label) : lastEvent.event_type;

        setConfirmConfig({
            open: true,
            title: t("delete_confirm_title", { label }) || `${tCommon("delete")} '${label}'?`,
            description: t("delete_event_desc") || "This action cannot be undone. This event will be permanently deleted.",
            actionLabel: tCommon("delete") || "Delete",
            cancelLabel: tCommon("cancel") || "Cancel",
            onConfirm: async () => {
                const res = await deleteEvent(lastEvent.id);
                if (res && !res.success) {
                    toast({
                        title: "Error deleting event",
                        description: res.error || "Unknown error occurred",
                        variant: "destructive"
                    });
                }
            }
        });
    };

    const handleQuickAction = async (teamId: string, type: EventType, side?: 'home' | 'away') => {
        if (readOnly || match.status !== 'live') return;

        const effectiveHomeId = match.home_team_id || match.home_team?.id || 'home';
        const effectiveAwayId = match.away_team_id || match.away_team?.id || 'away';
        const isHome = side ? side === 'home' : (teamId === effectiveHomeId || teamId === 'home' || teamId === match.home_team_id || teamId === match.home_team?.id);
        const teamSide: 'home' | 'away' = isHome ? 'home' : 'away';
        const resolvedTeamId = teamId || (isHome ? effectiveHomeId : effectiveAwayId);

        if (isFutsal && type === 'offside') return;

        if (type === 'timeout') {
            const alreadyUsed = isHome ? homeTimeoutUsed : awayTimeoutUsed;
            const teamName = isHome ? (match.home_team?.name || "Home") : (match.away_team?.name || "Away");
            if (alreadyUsed) {
                toast({
                    title: isTh ? "ไม่สามารถขอเวลานอกได้" : "Cannot request timeout",
                    description: isTh ? `${teamName} ใช้สิทธิ์ขอเวลานอกในครึ่งนี้ไปแล้ว` : `${teamName} has already used timeout in this half`,
                    variant: "destructive"
                });
                return;
            }
            const minute = Math.floor(time / 60) + 1;
            const res = await addEvent(resolvedTeamId, 'timeout', minute, null, { team_side: teamSide }, "Timeout (1 min)");
            if (res && res.success) {
                toast({
                    title: isTh ? "ขอเวลานอก (1 นาที)" : "Timeout Requested (1 min)",
                    description: `${teamName}`
                });
            }
            return;
        }

        const quickActionTypes: EventType[] = ['corner', 'missed_shot', 'offside', 'possession', 'pass', 'bad_pass', 'cross', 'miss_cross', 'save'];
        if (quickActionTypes.includes(type)) {
            const minute = Math.floor(time / 60) + 1;
            const evtConfig = EVENT_TYPES.find(e => e.type === type);
            const label = evtConfig ? t(evtConfig.label) : type;
            const res = await addEvent(resolvedTeamId, type, minute, null, { team_side: teamSide }, label);
            if (res && !res.success) {
                toast({
                    title: `Error saving ${type} event`,
                    description: res.error || "Unknown error occurred",
                    variant: "destructive"
                });
            }
            return;
        }
        setSelectedTeamId(resolvedTeamId);
        setSelectedTeamSide(teamSide);
        setSelectedEventType(type);
        setEventDialogOpen(true);
    };

    const handleSaveEvent = async (data: { minute: number; playerId: string; extraInfo: Record<string, unknown>; autoRed?: boolean; overrideEventType?: EventType }) => {
        if (!selectedEventType) return;
        const effectiveHomeId = match.home_team_id || match.home_team?.id || 'home';
        const effectiveAwayId = match.away_team_id || match.away_team?.id || 'away';
        const isHome = selectedTeamSide === 'home' || selectedTeamId === effectiveHomeId || selectedTeamId === 'home' || selectedTeamId === match.home_team_id || selectedTeamId === match.home_team?.id;
        const teamSide: 'home' | 'away' = isHome ? 'home' : 'away';
        const resolvedTeamId = selectedTeamId || (isHome ? effectiveHomeId : effectiveAwayId);

        const player = allPlayers.find(p => p.id === data.playerId);
        const playerName = player?.name || "Unknown";

        const actualEventType = data.overrideEventType || selectedEventType;
        const isYellowCard = actualEventType === 'yellow_card' || (actualEventType === 'foul' && data.extraInfo?.card_type === 'yellow');

        // Check futsal foul loop logic
        let futsalExtra: Record<string, unknown> = {};
        if (isFutsal && actualEventType === 'foul') {
            const teamName = isHome ? (match.home_team?.name || "Home") : (match.away_team?.name || "Away");
            const currentFouls = isHome ? homeFouls : awayFouls;
            const foulStep = (currentFouls % 6) + 1; // 1 to 6
            const loopCycle = Math.floor(currentFouls / 6) + 1;

            if (foulStep === 6) {
                futsalExtra = {
                    team_side: teamSide,
                    is_second_penalty: true,
                    penalty_distance: 10,
                    foul_count: 6,
                    loop_cycle: loopCycle
                };
                toast({
                    title: isTh ? "🚨 จุดโทษระยะ 2 (10 เมตร)!" : "🚨 10m Second Penalty Awarded!",
                    description: isTh 
                        ? `${teamName} ฟาวล์สะสมครบ 5 ครั้งแล้ว ครั้งนี้เป็นการลงโทษจุดโทษระยะ 2`
                        : `${teamName} committed 6th foul: awarded 10m second penalty`,
                    variant: "destructive"
                });
            } else {
                futsalExtra = {
                    team_side: teamSide,
                    foul_count: foulStep,
                    loop_cycle: loopCycle
                };
                if (foulStep === 5) {
                    toast({
                        title: isTh ? "⚠️ ฟาวล์สะสมครบ 5 ครั้ง!" : "⚠️ 5 Accumulated Fouls!",
                        description: isTh
                            ? `${teamName} ฟาวล์ครบ 5 ครั้งแล้ว ครั้งต่อไปจะเป็นจุดโทษระยะ 2 (10 ม.)`
                            : `${teamName} has 5 fouls. Next foul will trigger a 10m second penalty!`,
                        variant: "destructive"
                    });
                } else {
                    toast({
                        title: isTh ? "บันทึกฟาวล์สำเร็จ" : "Foul recorded",
                        description: `${teamName} (${isTh ? "ฟาวล์สะสม" : "Fouls"}: ${foulStep}/5${loopCycle > 1 ? ` [${isTh ? "รอบ" : "Loop"} ${loopCycle}]` : ""})`,
                    });
                }
            }
        }

        const eventExtraInfo = { ...data.extraInfo, team_side: teamSide, match_seconds: time, ...futsalExtra };

        // Defensive check: If this is a yellow card and player already has a yellow card in this match,
        // treat it as autoRed (Second Yellow -> Red Card) even if autoRed flag was not set
        const playerAlreadyHasYellow = Boolean(
            data.playerId && data.playerId !== 'unknown' && isYellowCard &&
            events.some(e => {
                const pid = e.player_id || (e.extra_info as Record<string, unknown> | null)?.player_id || (e.detail as Record<string, unknown> | null)?.player_id;
                const isSameId = pid && String(pid) === String(data.playerId);
                const isSameName = playerName && playerName !== "Unknown" && e.player_name && e.player_name.trim().toLowerCase() === playerName.trim().toLowerCase();
                if (!isSameId && !isSameName) return false;
                const type = e.event_type || e.type;
                if (type === 'yellow_card') return true;
                const card = (e.extra_info as Record<string, unknown> | null)?.card_type || (e.detail as Record<string, unknown> | null)?.card_type;
                return card === 'yellow';
            })
        );

        if (data.autoRed || playerAlreadyHasYellow) {
            // Second yellow card resulting in red card
            const res = await addEvent(resolvedTeamId, 'red_card', data.minute, data.playerId, { ...eventExtraInfo, is_second_yellow: true, card_type: 'red' }, playerName);
            if (res && !res.success) {
                toast({
                    title: "Error saving red card event",
                    description: res.error || "Unknown error occurred",
                    variant: "destructive"
                });
                return;
            }
        } else {
            const res = await addEvent(resolvedTeamId, actualEventType, data.minute, data.playerId, eventExtraInfo, playerName);
            if (res && !res.success) {
                toast({
                    title: "Error saving event",
                    description: res.error || "Unknown error occurred",
                    variant: "destructive"
                });
                return;
            }
        }

        // Remove player from active lineup when red card occurs
        const isEffectivelyRedCard = actualEventType === 'red_card' || data.autoRed || playerAlreadyHasYellow || data.extraInfo?.card_type === 'red';
        if (isEffectivelyRedCard && data.playerId && data.playerId !== 'unknown') {
            const redCardPlayerId = data.playerId;
            if (isHome) {
                const newHomeLineup = homeLineup.filter(id => id !== redCardPlayerId);
                setHomeLineup(newHomeLineup);
                localStorage.setItem(`match-lineup-${match.id}`, JSON.stringify({ home: newHomeLineup, away: awayLineup }));
            } else {
                const newAwayLineup = awayLineup.filter(id => id !== redCardPlayerId);
                setAwayLineup(newAwayLineup);
                localStorage.setItem(`match-lineup-${match.id}`, JSON.stringify({ home: homeLineup, away: newAwayLineup }));
            }
        }

        // Handle lineup updates on substitution (swap or penalty return)
        if (selectedEventType === 'substitution' && data.extraInfo.in_player_id) {
            const inPlayerId = data.extraInfo.in_player_id as string;
            const isReturnOnly = Boolean(data.extraInfo.is_penalty_return || !data.extraInfo.out_player_id || data.extraInfo.out_player_id === 'none');
            const outPlayerId = data.playerId;

            if (isHome) {
                let newHomeLineup = [...homeLineup];
                if (isReturnOnly) {
                    if (!newHomeLineup.includes(inPlayerId)) {
                        newHomeLineup.push(inPlayerId);
                    }
                } else if (outPlayerId && outPlayerId !== 'none' && outPlayerId !== 'unknown') {
                    newHomeLineup = newHomeLineup.map(id => id === outPlayerId ? inPlayerId : id);
                }
                setHomeLineup(newHomeLineup);
                localStorage.setItem(`match-lineup-${match.id}`, JSON.stringify({ home: newHomeLineup, away: awayLineup }));
            } else {
                let newAwayLineup = [...awayLineup];
                if (isReturnOnly) {
                    if (!newAwayLineup.includes(inPlayerId)) {
                        newAwayLineup.push(inPlayerId);
                    }
                } else if (outPlayerId && outPlayerId !== 'none' && outPlayerId !== 'unknown') {
                    newAwayLineup = newAwayLineup.map(id => id === outPlayerId ? inPlayerId : id);
                }
                setAwayLineup(newAwayLineup);
                localStorage.setItem(`match-lineup-${match.id}`, JSON.stringify({ home: homeLineup, away: newAwayLineup }));
            }
        }
    };

    const handleSetTime = async (minutes: number, seconds: number) => {
        const totalSeconds = (minutes * 60) + seconds;
        const currentMinute = isFutsal
            ? Math.floor(Math.max(0, futsalHalfSeconds - totalSeconds) / 60) + 1
            : Math.ceil((totalSeconds || 1) / 60);

        // Optimistic Update
        setTime(totalSeconds);

        await queueMatchUpdate({
            elapsed_before_pause: totalSeconds,
            elapsed_seconds: totalSeconds,
            current_minute: currentMinute
        });
        setSetTimeDialogOpen(false);
    };

    const lastAddTimeEvent = events.find(e => e.event_type === 'add_time');
    const lastTimerMarker = events.find(e =>
        e.event_type === 'kick_off' ||
        e.event_type === 'match_resumed' ||
        e.event_type === 'match_paused' ||
        e.event_type === 'half_time' ||
        e.event_type === 'full_time'
    );
    const isAddedTimeActive = lastAddTimeEvent && lastTimerMarker
        ? new Date(lastAddTimeEvent.created_at).getTime() > new Date(lastTimerMarker.created_at).getTime()
        : !!lastAddTimeEvent;
    const addedTime = isAddedTimeActive
        ? (lastAddTimeEvent?.extra_info as Record<string, unknown> | null)?.added_minutes as number | undefined || null
        : null;

    // --- Unified Actions Card Render ---
    const renderActionGridsCard = () => {
        const isActionDisabled = readOnly || match.status !== 'live';
        const actions = [
            { type: 'pass', label: t("pass") || "à¸ˆà¹ˆà¸²à¸¢à¸šà¸­à¸¥", icon: MoveRight },
            { type: 'cross', label: t("cross") || "à¸„à¸£à¸­à¸ªà¸šà¸­à¸¥", icon: CornerUpRight },
            { type: 'possession', label: t("possession_action") || "à¸„à¸£à¸­à¸‡à¸šà¸­à¸¥/à¸•à¸±à¸”à¸šà¸­à¸¥", icon: Scissors },
            { type: 'foul', label: t("foul") || "Foul", icon: Activity },
            { type: 'substitution', label: t("substitution"), icon: Repeat },
            { type: 'yellow_card', label: t("cards") || "à¸„à¸²à¸”à¹‚à¸—à¸© (à¹ƒà¸šà¹€à¸•à¸·à¸­à¸™)", icon: Square, iconColor: 'text-amber-500 fill-amber-500' },
            { type: 'save', label: t("save") || "Save", icon: Shield },
            { type: 'injury', label: t("injury") || "Injury", icon: Stethoscope },
            { type: 'corner', label: t("corner") || "Corner", icon: Flag },
            { type: 'missed_shot', label: t("missed_shot") || "à¸¢à¸´à¸‡à¸žà¸¥à¸²à¸”", icon: Crosshair },
            { type: 'bad_pass', label: t("bad_pass") || "à¸­à¸­à¸à¸‚à¹‰à¸²à¸‡", icon: ArrowUpRight },
            ...(isFutsal ? [
                { type: 'timeout' as const, label: isTh ? "ขอเวลานอก" : "Timeout", icon: Clock },
            ] : [
                { type: 'offside', label: t("offside") || "ล้ำหน้า", icon: FlagTriangleRight },
            ]),
            { type: 'goal', label: t("goal"), icon: Volleyball },
        ];

        // Filter actions based on customActionTypes, but 'goal' is ALWAYS displayed
        const filteredActions = actions.filter((action) => {
            if (action.type === 'goal') return true;
            if (isFutsal && (action.type === 'foul' || action.type === 'timeout')) return true;
            return customActionTypes.includes(action.type);
        });

        const effectiveHomeId = match.home_team_id || match.home_team?.id || 'home';
        const effectiveAwayId = match.away_team_id || match.away_team?.id || 'away';

        const renderTeamButtons = (teamId: string, side: 'home' | 'away') => {
            const isHome = side === 'home';
            const isTimeoutUsed = isHome ? homeTimeoutUsed : awayTimeoutUsed;

            return (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 lg:gap-2">
                    {filteredActions.map((action) => {
                        const isTimeout = action.type === 'timeout';
                        const isBtnDisabled = isActionDisabled || (isTimeout && isTimeoutUsed);
                        const label = isTimeout && isTimeoutUsed
                            ? (isTh ? "ขอเวลานอก (ใช้แล้ว)" : "Timeout (Used)")
                            : action.label;

                        return (
                            <Button
                                variant="outline"
                                key={action.type}
                                onClick={() => handleQuickAction(teamId, action.type as EventType, side)}
                                disabled={isBtnDisabled}
                                title={typeof label === 'string' ? label : undefined}
                                className={cn(
                                    "h-9 px-2.5 rounded-sm font-medium border-border/80 hover:border-primary/50 hover:bg-muted/40 transition-colors shadow-none",
                                    action.type === 'goal' && "col-span-2 sm:col-span-3 h-10 font-bold bg-primary/5 border-primary/30 hover:bg-primary/10 hover:border-primary text-primary",
                                    isTimeout && isTimeoutUsed && "opacity-50 cursor-not-allowed line-through bg-muted/40"
                                )}
                            >
                                <action.icon className={cn("h-4 w-4 transition-transform shrink-0", action.iconColor)} />
                                <span className="hidden lg:inline text-xs font-semibold truncate cursor-pointer tracking-normal">{label}</span>
                            </Button>
                        );
                    })}
                </div>
            );
        };

        return (
            <div className="bg-card border rounded-sm relative overflow-hidden group">
                {/* Team Action Grids Side by Side with Divider between Home and Away */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-border">
                    {/* Home Team Column */}
                    <div className="p-3 lg:p-4 space-y-2 lg:space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            <h3 className="text-lg lg:text-xl font-black tracking-tight truncate">
                                {match.home_team?.name || 'Home'}
                            </h3>
                        </div>
                        {renderTeamButtons(effectiveHomeId, 'home')}
                    </div>

                    {/* Away Team Column */}
                    <div className="p-3 lg:p-4 space-y-2 lg:space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary/60" />
                            <h3 className="text-lg lg:text-xl font-black tracking-tight truncate">
                                {match.away_team?.name || 'Away'}
                            </h3>
                        </div>
                        {renderTeamButtons(effectiveAwayId, 'away')}
                    </div>
                </div>
            </div>
        );
    };

    const matchControlsBox = readOnly ? null : (
        <div className="bg-card border p-2 lg:p-4 relative overflow-hidden group rounded-sm" id="console-timer-control">
            <div className="relative z-10 space-y-2 lg:space-y-4">
                <MatchTimeControl
                    status={match.status}
                    isRunning={isRunning}
                    readOnly={false}
                    lastPeriodEventType={lastPeriodEventType}
                    onStart={handleStartMatch}
                    onPause={handlePauseMatch}
                    onHalfTime={handleHalfTime}
                    onRegularFullTime={handleRegularFullTime}
                    onStartExtraTime={handleStartExtraTime}
                    onExtraTimeHalfTime={handleExtraTimeHalfTime}
                    onStartPenalties={handleStartPenalties}
                    onResume={handleResumeMatch}
                    onEnd={handleEndMatch}
                    onSetTime={() => setSetTimeDialogOpen(true)}
                    onAddTime={isFutsal ? undefined : () => setAddTimeDialogOpen(true)}
                />
            </div>
        </div>
    );

    const quickActionsBox = (
        <div className="bg-card border p-2 lg:p-4 relative overflow-hidden group rounded-sm" id="console-action-panel">
            <div className="relative z-10 space-y-2 lg:space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-1 lg:gap-2">
                    {!readOnly && (
                        <Button
                            variant="outline"
                            onClick={() => setOverlayDialogOpen(true)}
                            className="hidden lg:flex w-full justify-start items-center"
                        >
                            <Tv className="h-4 w-4 text-primary" />
                            <span className="hidden lg:inline">{t("broadcast_overlay")}</span>
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => setRosterDialogOpen(true)}
                        className="w-full flex justify-center lg:justify-start items-center"
                    >
                        <Users className="h-4 w-4 text-primary" />
                        <span className="inline text-xs font-semibold">{t("select_starting_lineup") || "Lineups"}</span>
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setStatsDialogOpen(true)}
                        className="w-full flex justify-center lg:justify-start items-center"
                    >
                        <BarChart2 className="h-4 w-4 text-primary" />
                        <span className="inline text-xs font-semibold">{t("match_statistics") || "à¸ªà¸–à¸´à¸•à¸´à¸à¸²à¸£à¹à¸‚à¹ˆà¸‡à¸‚à¸±à¸™"}</span>
                    </Button>
                </div>
            </div>
        </div>
    );

    const startConsoleTutorial = () => {
        const steps = [
            {
                element: "#console-scoreboard",
                popover: {
                    title: locale === "th" ? "à¸à¸£à¸°à¸”à¸²à¸™à¸„à¸°à¹à¸™à¸™ (Scoreboard)" : "Scoreboard",
                    description: locale === "th" ? "à¹à¸ªà¸”à¸‡à¸Šà¸·à¹ˆà¸­à¸—à¸µà¸¡ à¹‚à¸¥à¹‚à¸à¹‰ à¹à¸¥à¸°à¸„à¸°à¹à¸™à¸™à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™ à¸£à¸§à¸¡à¸–à¸¶à¸‡à¸ªà¸–à¸²à¸™à¸°à¸‚à¸­à¸‡à¹à¸¡à¸•à¸Šà¹Œ (à¹€à¸Šà¹ˆà¸™ à¸„à¸£à¸¶à¹ˆà¸‡à¹à¸£à¸, à¸„à¸£à¸¶à¹ˆà¸‡à¸«à¸¥à¸±à¸‡, à¸ˆà¸šà¸à¸²à¸£à¹à¸‚à¹ˆà¸‡à¸‚à¸±à¸™)" : "Displays team names, logos, current score, and match status.",
                    side: "bottom" as const,
                    align: "start" as const
                }
            },
            {
                element: "#console-timer-control",
                popover: {
                    title: locale === "th" ? "à¸„à¸§à¸šà¸„à¸¸à¸¡à¹€à¸§à¸¥à¸² (Match Timer)" : "Match Timer",
                    description: locale === "th" ? "à¹ƒà¸Šà¹‰à¸ªà¸³à¸«à¸£à¸±à¸šà¸„à¸§à¸šà¸„à¸¸à¸¡à¹€à¸§à¸¥à¸² à¹€à¸£à¸´à¹ˆà¸¡/à¸«à¸¢à¸¸à¸”à¹€à¸§à¸¥à¸² à¸«à¸£à¸·à¸­à¸›à¸£à¸±à¸šà¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¹€à¸§à¸¥à¸²à¸‚à¸­à¸‡à¹à¸¡à¸•à¸Šà¹Œ" : "Start, pause, or configure the match clock.",
                    side: "bottom" as const,
                    align: "start" as const
                }
            },
            {
                element: "#console-action-panel",
                popover: {
                    title: locale === "th" ? "à¹à¸œà¸‡à¸„à¸§à¸šà¸„à¸¸à¸¡à¹€à¸«à¸•à¸¸à¸à¸²à¸£à¸“à¹Œ (Events Panel)" : "Events Panel",
                    description: locale === "th" ? "à¸à¸”à¸šà¸±à¸™à¸—à¸¶à¸à¹€à¸«à¸•à¸¸à¸à¸²à¸£à¸“à¹Œà¸ªà¸³à¸„à¸±à¸à¹ƒà¸™à¸ªà¸™à¸²à¸¡ à¹€à¸Šà¹ˆà¸™ à¸—à¸³à¸›à¸£à¸°à¸•à¸¹ (Goal), à¹ƒà¸šà¹€à¸«à¸¥à¸·à¸­à¸‡/à¹ƒà¸šà¹à¸”à¸‡, à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸•à¸±à¸§à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™ à¸«à¸£à¸·à¸­à¹à¸ˆà¹‰à¸‡à¸ˆà¸šà¸à¸²à¸£à¹à¸‚à¹ˆà¸‡à¸‚à¸±à¸™" : "Log events like Goals, Cards, Substitutions, or finish the match.",
                    side: "top" as const,
                    align: "start" as const
                }
            },
            {
                element: "#console-event-log",
                popover: {
                    title: locale === "th" ? "à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸à¸²à¸£à¹à¸‚à¹ˆà¸‡à¸‚à¸±à¸™ (Event Log)" : "Event Log",
                    description: locale === "th" ? "à¹à¸ªà¸”à¸‡à¸¥à¸³à¸”à¸±à¸šà¸›à¸£à¸°à¸§à¸±à¸•à¸´à¹€à¸«à¸•à¸¸à¸à¸²à¸£à¸“à¹Œà¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸—à¸µà¹ˆà¹€à¸à¸´à¸”à¸‚à¸¶à¹‰à¸™à¹ƒà¸™à¸ªà¸™à¸²à¸¡ à¹‚à¸”à¸¢à¹€à¸£à¸µà¸¢à¸‡à¸•à¸²à¸¡à¸™à¸²à¸—à¸µ à¸ªà¸²à¸¡à¸²à¸£à¸–à¸à¸”à¸¢à¹‰à¸­à¸™à¸à¸¥à¸±à¸š (Undo) à¹€à¸žà¸·à¹ˆà¸­à¸¥à¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸šà¸±à¸™à¸—à¸¶à¸à¸œà¸´à¸”à¹„à¸”à¹‰" : "Chronological log of match events with undo/delete actions.",
                    side: "left" as const,
                    align: "start" as const
                }
            }
        ];

        const driverObj = driver({
            showProgress: true,
            animate: true,
            steps
        });
        driverObj.drive();
    };

    if (playersLoading) {
        return (
            <div className="flex flex-col font-display selection:bg-primary selection:text-primary-foreground space-y-2 lg:space-y-4 animate-pulse">
                {/* Header Skeleton */}
                <header className="flex items-center justify-between gap-1 lg:gap-2 h-10 dark:border-foreground/10">
                    <div className="flex items-center gap-1 lg:gap-2 w-full">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 hover:bg-primary/10 hover:text-primary transition-all"
                            asChild
                        >
                            <Link href={backUrl}>
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <div className="flex justify-between items-center w-full">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-8 w-24 lg:w-32 bg-muted/60 rounded-sm" />
                                <Skeleton className="h-8 w-8 lg:w-8 bg-muted/60 rounded-sm" />
                                <Skeleton className="h-8 w-24 lg:w-32 bg-muted/60 rounded-sm" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-10 w-10 lg:w-10 bg-muted/60 rounded-sm" />
                                <Skeleton className="h-10 w-10 lg:w-10 bg-muted/60 rounded-sm" />
                                <Skeleton className="h-10 w-10 lg:w-10 bg-muted/60 rounded-sm" />
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 w-full flex flex-col gap-2 lg:gap-4">
                    {/* Scoreboard Skeleton - Full Width */}
                    {isFullWidth && (
                        <div className="bg-card border rounded-sm w-full">
                            <div className="p-2 lg:p-4 flex flex-col items-center justify-center w-full h-[120px] lg:h-[220px]">
                                <div className="flex items-center justify-between w-full max-w-7xl px-2 lg:px-8 gap-4 lg:gap-12">
                                    <div className="flex-1 flex flex-row-reverse items-center justify-start gap-2 lg:flex-col lg:items-center lg:gap-4 min-w-0">
                                        <Skeleton className="w-12 h-12 lg:w-24 lg:h-24 rounded-full bg-muted/60 shrink-0" />
                                        <Skeleton className="h-4 w-16 lg:h-7 lg:w-32 bg-muted/60 rounded-sm shrink-0" />
                                    </div>

                                    <div className="flex flex-col items-center gap-1 lg:gap-3 shrink-0">
                                        <Skeleton className="h-4 w-12 lg:h-6 lg:w-20 bg-muted/60 rounded-sm" />
                                        <div className="flex items-center gap-4 lg:gap-8">
                                            <Skeleton className="h-10 w-8 lg:h-24 lg:w-16 bg-muted/60 rounded-sm" />
                                            <span className="text-xl lg:text-4xl font-black text-foreground/20">-</span>
                                            <Skeleton className="h-10 w-8 lg:h-24 lg:w-16 bg-muted/60 rounded-sm" />
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-row items-center justify-start gap-2 lg:flex-col lg:items-center lg:gap-4 min-w-0">
                                        <Skeleton className="w-12 h-12 lg:w-24 lg:h-24 rounded-full bg-muted/60 shrink-0" />
                                        <Skeleton className="h-4 w-16 lg:h-7 lg:w-32 bg-muted/60 rounded-sm shrink-0" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="w-full grid grid-cols-12 gap-2 lg:gap-4">
                        {/* Sidebar Skeleton */}
                        <aside className="col-span-12 lg:col-span-3 gap-2 lg:gap-4 order-2 lg:order-1 flex flex-col">
                            {/* Match Controls Skeleton */}
                            {!readOnly && (
                                <div className="bg-card border p-2 lg:p-4 rounded-sm space-y-2">
                                    <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                                    <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                                    <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                                    <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                                </div>
                            )}
                            {/* Quick Actions Skeleton */}
                            <div className="bg-card border p-2 lg:p-4 rounded-sm space-y-2">
                                <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                                <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                                <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                                <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                                <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                                <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                            </div>
                        </aside>

                        {/* Main Content Skeleton */}
                        <div className="col-span-12 lg:col-span-9 order-1 lg:order-2 flex flex-col gap-2 lg:gap-4">
                            {/* Scoreboard Skeleton */}
                            {!isFullWidth && (
                                <div className="bg-card border rounded-sm w-full">
                                    <div className="p-2 lg:p-4 flex flex-col items-center justify-center w-full h-[120px] lg:h-[220px]">
                                        <div className="flex items-center justify-between w-full max-w-5xl gap-4 lg:gap-12">
                                            <div className="flex-1 flex flex-row-reverse items-center justify-start gap-2 lg:flex-col lg:items-center lg:gap-4 min-w-0">
                                                <Skeleton className="w-12 h-12 lg:w-24 lg:h-24 rounded-full bg-muted/60 shrink-0" />
                                                <Skeleton className="h-4 w-16 lg:h-7 lg:w-32 bg-muted/60 rounded-sm shrink-0" />
                                            </div>

                                            <div className="flex flex-col items-center gap-1 lg:gap-3 shrink-0">
                                                <Skeleton className="h-4 w-12 lg:h-6 lg:w-20 bg-muted/60 rounded-sm" />
                                                <div className="flex items-center gap-4 lg:gap-8">
                                                    <Skeleton className="h-10 w-8 lg:h-24 lg:w-16 bg-muted/60 rounded-sm" />
                                                    <span className="text-xl lg:text-4xl font-black text-foreground/20">-</span>
                                                    <Skeleton className="h-10 w-8 lg:h-24 lg:w-16 bg-muted/60 rounded-sm" />
                                                </div>
                                            </div>

                                            <div className="flex-1 flex flex-row items-center justify-start gap-2 lg:flex-col lg:items-center lg:gap-4 min-w-0">
                                                <Skeleton className="w-12 h-12 lg:w-24 lg:h-24 rounded-full bg-muted/60 shrink-0" />
                                                <Skeleton className="h-4 w-16 lg:h-7 lg:w-32 bg-muted/60 rounded-sm shrink-0" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        {/* Team Action Grid Skeleton */}
                        {!readOnly && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-4">
                                {[1, 2].map((i) => (
                                    <div key={i} className="bg-card border rounded-sm p-2 lg:p-4 space-y-4">
                                        <Skeleton className="h-8 w-24 bg-muted/60 rounded-sm" />
                                        <div className="grid grid-cols-3 gap-1 lg:gap-2">
                                            {Array.from({ length: 9 }).map((_, idx) => (
                                                <Skeleton key={idx} className="h-10 w-full bg-muted/60 rounded-sm" />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Event Log Skeleton */}
                        <div className="bg-card border rounded-sm p-4 space-y-2">
                            <Skeleton className="h-12 w-full bg-muted/60 rounded-sm" />
                            <Skeleton className="h-12 w-full bg-muted/60 rounded-sm" />
                            <Skeleton className="h-12 w-full bg-muted/60 rounded-sm" />
                        </div>
                    </div>
                </div>
            </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col font-display selection:bg-primary selection:text-primary-foreground space-y-2 lg:space-y-4">
            <header className="flex items-center justify-between gap-1 lg:gap-2">
                <div className="flex items-center gap-1 lg:gap-2 w-full">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 hover:bg-primary/10 hover:text-primary transition-all"
                        asChild
                    >
                        <Link href={backUrl}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <Header level={2}>
                        <span>{match.home_team?.name || 'Home'}</span>
                        <span className="text-xs lg:text-sm font-black tracking-widest px-2">VS</span>
                        <span>{match.away_team?.name || 'Away'}</span>
                    </Header>
                </div>

                {!readOnly && (
                    <div className="flex items-center">
                        {/* Match Status */}
                        <div className="flex items-center gap-1 lg:gap-2 px-2 relative group shrink-0">
                            <span className="relative flex h-2 w-2 shrink-0">
                                <span className={cn(
                                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                                    (isHalfTime || (lastPeriodEventType === 'full_time' && !isRunning) || lastPeriodEventType === 'extra_time_half_time') ? "bg-warning" : (match.status === 'live' ? "bg-primary" : "bg-warning")
                                )}></span>
                                <span className={cn(
                                    "relative inline-flex rounded-full h-2 w-2",
                                    (isHalfTime || (lastPeriodEventType === 'full_time' && !isRunning) || lastPeriodEventType === 'extra_time_half_time') ? "bg-warning" : (match.status === 'live' ? "bg-primary" : "bg-warning")
                                )}></span>
                            </span>
                            <span className="text-[10px] font-black tracking-widest whitespace-nowrap">
                                {(() => {
                                    if (match.status === 'finished') return tMatch("status_finished");
                                    if (lastPeriodEventType === 'half_time') return (t("half_time") || "HALF TIME").toUpperCase();
                                    if (lastPeriodEventType === 'full_time' && !isRunning) return (t("regular_full_time") || "END REGULAR TIME").toUpperCase();
                                    if (lastPeriodEventType === 'extra_time_half_time') return (t("extra_time_half_time") || "ET HALF TIME").toUpperCase();
                                    if (lastPeriodEventType === 'penalties') return (t("penalties") || "PENALTIES").toUpperCase();
                                    if (lastPeriodEventType === 'extra_time' || lastPeriodEventType === 'extra_time_second_half') return (t("extra_time") || "EXTRA TIME").toUpperCase();
                                    return match.status === 'live' ? tMatch("status_live") : tMatch("status_" + match.status);
                                })()}
                            </span>
                        </div>

                        {/* Undo Button */}
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={handleUndo}
                            title={t("undo") || "à¸¢à¹‰à¸­à¸™à¸à¸¥à¸±à¸š (Undo)"}
                        >
                            <Undo className="h-4 w-4" />
                        </Button>

                        {/* Help Tutorial Button */}
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={startConsoleTutorial}
                            title={locale === "th" ? "à¸ªà¸­à¸™à¸à¸²à¸£à¹ƒà¸Šà¹‰à¸‡à¸²à¸™" : "Help Tutorial"}
                        >
                            <HelpCircle className="h-4 w-4" />
                        </Button>

                        {/* Settings Button */}
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setCustomizeDialogOpen(true)}
                            title={t("settings") || "à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²"}
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                        {(isSyncing || isMatchSyncing) ? (
                            <div className="flex items-center justify-center text-primary h-8 w-8" title={locale === "th" ? "à¸à¸³à¸¥à¸±à¸‡à¸šà¸±à¸™à¸—à¸¶à¸à¸¥à¸‡ Database..." : "Syncing to Database..."}>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            </div>
                        ) : (() => {
                            const pendingEvents = queue.filter(q => q.status === 'pending' || q.status === 'failed');
                            const pendingMatch = matchQueue.filter(m => m.status === 'pending' || m.status === 'failed');
                            const hasPending = (pendingEvents.length + pendingMatch.length) > 0;
                            return hasPending ? (
                                <div className="flex items-center gap-1 text-amber-500" title={locale === "th" ? `à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸šà¸±à¸™à¸—à¸¶à¸à¸¥à¸‡ Database (${pendingEvents.length + pendingMatch.length})` : `Not synced (${pendingEvents.length + pendingMatch.length})`}>
                                    <CloudOff className="w-4 h-4" />
                                    <button
                                        onClick={() => {
                                            syncQueue();
                                            syncMatchQueue();
                                        }}
                                        className="ml-1 hover:text-white transition-colors"
                                        title={locale === "th" ? "à¸à¸”à¹€à¸žà¸·à¹ˆà¸­à¸šà¸±à¸™à¸—à¸¶à¸à¸—à¸±à¸™à¸—à¸µ" : "Click to sync now"}
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center text-emerald-500 h-8 w-8" title={locale === "th" ? "à¸šà¸±à¸™à¸—à¸¶à¸à¸¥à¸‡ Database à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¹à¸¥à¹‰à¸§" : "Synced to Database"}>
                                    <Cloud className="w-4 h-4" />
                                </div>
                            );
                        })()}
                    </div>
                )}
            </header>

            <main className="flex-1 w-full flex flex-col gap-2 lg:gap-4">
                {/* Scoreboard Section (Full Width across page) */}
                {isFullWidth && (
                    <section className="w-full flex flex-col gap-2 lg:gap-4" id="console-scoreboard">
                        <Scoreboard
                            match={match}
                            homeScore={homeScore}
                            awayScore={awayScore}
                            events={events}
                            onTeamClick={(teamId, side) => {
                                if (side === 'home' || (teamId && (teamId === match.home_team_id || teamId === match.home_team?.id))) {
                                    setTeamInfoTarget('home');
                                } else if (side === 'away' || (teamId && (teamId === match.away_team_id || teamId === match.away_team?.id))) {
                                    setTeamInfoTarget('away');
                                }
                            }}
                            timerTime={time}
                            timerReadOnly={readOnly || match.status === 'finished'}
                            timerCustomText={
                                match.status === 'finished' ? "FT" :
                                    lastPeriodEventType === 'half_time' ? "HT" :
                                        (lastPeriodEventType === 'full_time' && !isRunning) ? "FT" :
                                            lastPeriodEventType === 'extra_time_half_time' ? "ET HT" :
                                                lastPeriodEventType === 'penalties' ? "PSO" : null
                            }
                            addedTime={(isHalfTime || (lastPeriodEventType === 'full_time' && !isRunning) || match.status === 'finished' || lastPeriodEventType === 'penalties') ? null : addedTime}
                            showPossession={!readOnly && showScoreboardPossession}
                            isFutsal={isFutsal}
                            homeFouls={homeFouls}
                            awayFouls={awayFouls}
                            homeTimeoutUsed={homeTimeoutUsed}
                            awayTimeoutUsed={awayTimeoutUsed}
                        />

                        {/* Futsal Red Card Penalty Status Alerts */}
                        {isFutsal && (redCardPenaltyStatus.home.reason || redCardPenaltyStatus.away.reason) && (
                            <div className="flex flex-col gap-1.5 p-2 rounded-sm bg-muted/40 border">
                                {redCardPenaltyStatus.home.reason && (
                                    <div className={cn(
                                        "text-xs font-semibold px-2.5 py-1.5 rounded flex items-center justify-between gap-2",
                                        redCardPenaltyStatus.home.canReturn ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30" : "bg-destructive/10 text-destructive border border-destructive/30"
                                    )}>
                                        <span className="flex items-center gap-1.5 truncate">
                                            {redCardPenaltyStatus.home.canReturn ? "🟢" : "🟥"}
                                            <span className="font-bold">{match.home_team?.name || 'Home'}:</span> {redCardPenaltyStatus.home.reason}
                                        </span>
                                        {redCardPenaltyStatus.home.canReturn && !readOnly && match.status === 'live' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 text-[10px] font-bold border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/20 shrink-0"
                                                onClick={() => handleQuickAction(match.home_team_id || 'home', 'substitution')}
                                            >
                                                {isTh ? "เปลี่ยนตัว / เติมผู้เล่น" : "Substitute In"}
                                            </Button>
                                        )}
                                    </div>
                                )}
                                {redCardPenaltyStatus.away.reason && (
                                    <div className={cn(
                                        "text-xs font-semibold px-2.5 py-1.5 rounded flex items-center justify-between gap-2",
                                        redCardPenaltyStatus.away.canReturn ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30" : "bg-destructive/10 text-destructive border border-destructive/30"
                                    )}>
                                        <span className="flex items-center gap-1.5 truncate">
                                            {redCardPenaltyStatus.away.canReturn ? "🟢" : "🟥"}
                                            <span className="font-bold">{match.away_team?.name || 'Away'}:</span> {redCardPenaltyStatus.away.reason}
                                        </span>
                                        {redCardPenaltyStatus.away.canReturn && !readOnly && match.status === 'live' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 text-[10px] font-bold border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/20 shrink-0"
                                                onClick={() => handleQuickAction(match.away_team_id || 'away', 'substitution')}
                                            >
                                                {isTh ? "เปลี่ยนตัว / เติมผู้เล่น" : "Substitute In"}
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quick Actions (Mobile only) */}
                        <div className="block lg:hidden">
                            {quickActionsBox}
                        </div>
                    </section>
                )}

                <div className="w-full grid grid-cols-12 gap-2 lg:gap-4">
                    {/* Sidebar: Admin Controls or Match Info */}
                    <aside className={cn(
                        "col-span-12 gap-2 lg:gap-4 order-2 lg:order-1 flex flex-col",
                        readOnly ? "lg:col-span-4" : "lg:col-span-3"
                    )}>
                        {/* Match Controls (Desktop only) */}
                        {matchControlsBox && (
                            <div className="hidden lg:block">
                                {matchControlsBox}
                            </div>
                        )}

                        <div className="hidden lg:block">
                            {quickActionsBox}
                        </div>

                        {readOnly && (
                            <div className="hidden lg:block border rounded-sm overflow-hidden bg-card shadow-xs">
                                <MatchStatisticsBox
                                    match={match}
                                    events={events}
                                    homeScore={homeScore}
                                    awayScore={awayScore}
                                    visibleStats={visibleStats}
                                />
                            </div>
                        )}
                    </aside>

                    {/* Main Content Area */}
                    <div className={cn(
                        "col-span-12 order-1 lg:order-2 flex flex-col gap-2 lg:gap-4",
                        readOnly ? "lg:col-span-8" : "lg:col-span-9"
                    )}>
                        {/* Match Controls (Mobile only) */}
                        {matchControlsBox && (
                            <div className="block lg:hidden">
                                {matchControlsBox}
                            </div>
                        )}

                        {/* Scoreboard Section (When not fullWidth) */}
                        {!isFullWidth && (
                            <section className="flex flex-col gap-2 lg:gap-4" id="console-scoreboard">
                                <Scoreboard
                                    match={match}
                                    homeScore={homeScore}
                                    awayScore={awayScore}
                                    events={events}
                                    onTeamClick={(teamId, side) => {
                                        if (side === 'home' || (teamId && (teamId === match.home_team_id || teamId === match.home_team?.id))) {
                                            setTeamInfoTarget('home');
                                        } else if (side === 'away' || (teamId && (teamId === match.away_team_id || teamId === match.away_team?.id))) {
                                            setTeamInfoTarget('away');
                                        }
                                    }}
                                    timerTime={time}
                                    timerReadOnly={readOnly || match.status === 'finished'}
                                    timerCustomText={
                                        match.status === 'finished' ? "FT" :
                                            lastPeriodEventType === 'half_time' ? "HT" :
                                                (lastPeriodEventType === 'full_time' && !isRunning) ? "FT" :
                                                    lastPeriodEventType === 'extra_time_half_time' ? "ET HT" :
                                                        lastPeriodEventType === 'penalties' ? "PSO" : null
                                    }
                                    addedTime={(isHalfTime || (lastPeriodEventType === 'full_time' && !isRunning) || match.status === 'finished' || lastPeriodEventType === 'penalties') ? null : addedTime}
                                    showPossession={!readOnly && showScoreboardPossession}
                                    isFutsal={isFutsal}
                                    homeFouls={homeFouls}
                                    awayFouls={awayFouls}
                                    homeTimeoutUsed={homeTimeoutUsed}
                                    awayTimeoutUsed={awayTimeoutUsed}
                                />

                                {/* Quick Actions (Mobile only) */}
                                <div className="block lg:hidden">
                                    {quickActionsBox}
                                </div>

                                {!readOnly && (
                                    renderActionGridsCard()
                                )}
                            </section>
                        )}

                        {/* Log Section */}
                        <section className="flex flex-col gap-2 lg:gap-4" id="console-event-log">
                            <EventLog
                                events={events}
                                match={match}
                                readOnly={readOnly}
                                onDelete={deleteEvent}
                                players={allPlayers}
                                visibleLogs={visibleLogs}
                            />
                        </section>
                    </div>
                </div>
            </main>

            {/* Dialogs */}
            <MatchEventDialog
                open={eventDialogOpen}
                onOpenChange={setEventDialogOpen}
                teamId={selectedTeamId}
                eventType={selectedEventType}
                initialMinute={Math.floor(time / 60) + 1}
                players={selectedTeamSide === 'home' ? homePlayers : awayPlayers}
                opponentPlayers={selectedTeamSide === 'home' ? awayPlayers : homePlayers}
                existingEvents={events}
                activeLineupIds={selectedTeamSide === 'home' ? homeLineup : awayLineup}
                onSave={handleSaveEvent}
                isFutsal={isFutsal}
                currentFouls={selectedTeamSide === 'home' ? homeFouls : awayFouls}
                canReturnToFullStrength={selectedTeamSide === 'home' ? redCardPenaltyStatus.home.canReturn : redCardPenaltyStatus.away.canReturn}
                penaltyReturnReason={selectedTeamSide === 'home' ? redCardPenaltyStatus.home.reason : redCardPenaltyStatus.away.reason}
            />
            <PenaltyShootoutDialog
                open={penaltyDialogOpen}
                onOpenChange={setPenaltyDialogOpen}
                matchId={match.id}
                homeTeamId={match.home_team_id || match.home_team?.id || null}
                awayTeamId={match.away_team_id || match.away_team?.id || null}
                homeTeamName={match.home_team?.name || 'Home'}
                awayTeamName={match.away_team?.name || 'Away'}
                homePlayers={homePlayers}
                awayPlayers={awayPlayers}
                readOnly={readOnly}
                onComplete={handlePenaltyShootoutComplete}
                onUpdate={fetchShots}
            />
            <RosterSelectionDialog open={rosterDialogOpen} onOpenChange={setRosterDialogOpen} homeTeamName={match.home_team?.name || 'Home'} awayTeamName={match.away_team?.name || 'Away'} homePlayers={homePlayers} awayPlayers={awayPlayers} homeActiveIds={homeLineup} awayActiveIds={awayLineup} onSave={handleSaveLineup} readOnly={readOnly} />
            <WalkoverDialog open={woDialogOpen} onOpenChange={setWoDialogOpen} match={match} onConfirm={handleWalkover} />
            <BroadcastDialog open={overlayDialogOpen} onOpenChange={setOverlayDialogOpen} matchId={match.id} tournamentId={tournamentId} />
            <SetTimeDialog key={`set-time-${time}-${setTimeDialogOpen}`} open={setTimeDialogOpen} onOpenChange={setSetTimeDialogOpen} currentTime={time > 0 ? time : (isFutsal ? futsalHalfSeconds : 0)} onSave={handleSetTime} />
            <AddTimeDialog open={addTimeDialogOpen} onOpenChange={setAddTimeDialogOpen} onSave={(mins) => {
                const minute = Math.floor(time / 60) + 1;
                addEvent(null, 'add_time', minute, null, { added_minutes: mins }, `+${mins} min`);
                setAddTimeDialogOpen(false);
            }} />
            <FootballStatisticsDialog
                open={statsDialogOpen}
                onOpenChange={setStatsDialogOpen}
                match={match}
                events={events}
                homeScore={homeScore}
                awayScore={awayScore}
                visibleStats={visibleStats}
            />

            <AlertDialog open={confirmConfig.open} onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, open }))}>
                <AlertDialogContent className="bg-card border rounded-sm shadow-2xl sm:max-w-md z-[60]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="border-b p-2 lg:p-4">
                            {confirmConfig.title}
                        </AlertDialogTitle>
                        {confirmConfig.description && (
                            <AlertDialogDescription className="p-2 lg:p-4">
                                {confirmConfig.description}
                            </AlertDialogDescription>
                        )}
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-1 lg:gap-2 border-t p-2 lg:p-4">
                        <AlertDialogCancel>
                            {confirmConfig.cancelLabel}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                await confirmConfig.onConfirm();
                                setConfirmConfig(prev => ({ ...prev, open: false }));
                            }}
                        >
                            {confirmConfig.actionLabel}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Settings Dialog */}
            <FootballSettingsDialog
                open={customizeDialogOpen}
                onOpenChange={setCustomizeDialogOpen}
                match={match}
                readOnly={readOnly}
                showScoreboardPossession={showScoreboardPossession}
                onToggleScoreboardPossession={toggleScoreboardPossession}
                customActionTypes={customActionTypes}
                onToggleCustomAction={toggleCustomAction}
                visibleLogs={visibleLogs}
                onToggleVisibleLog={toggleVisibleLog}
                visibleStats={visibleStats}
                onToggleVisibleStat={toggleVisibleStat}
                onPostponeMatch={handlePostponeMatch}
                onWalkover={() => setWoDialogOpen(true)}
                onAbandonMatch={handleAbandonMatch}
            />

            {/* Team Roster & Info Dialog (à¸•à¸±à¸§à¸ˆà¸£à¸´à¸‡, à¸•à¸±à¸§à¸ªà¸³à¸£à¸­à¸‡, à¸—à¸µà¸¡à¸‡à¸²à¸™) */}
            {teamInfoTarget && (
                <TeamRosterDialog
                    open={!!teamInfoTarget}
                    onOpenChange={(open) => {
                        if (!open) setTeamInfoTarget(null);
                    }}
                    teamName={teamInfoTarget === 'home' ? (match.home_team?.name || t("home")) : (match.away_team?.name || t("away"))}
                    teamLogo={teamInfoTarget === 'home' ? match.home_team?.logo_url : match.away_team?.logo_url}
                    description={teamInfoTarget === 'home' ? match.home_team?.description : match.away_team?.description}
                    contactName={teamInfoTarget === 'home' ? match.home_team?.contact_name : match.away_team?.contact_name}
                    contactPhone={teamInfoTarget === 'home' ? match.home_team?.contact_phone : match.away_team?.contact_phone}
                    players={teamInfoTarget === 'home' ? homePlayers : awayPlayers}
                    activeLineupIds={teamInfoTarget === 'home' ? homeLineup : awayLineup}
                    events={events}
                    teamId={teamInfoTarget === 'home' ? match.home_team_id : match.away_team_id}
                    sport="football"
                />
            )}
        </div>
    );
}

