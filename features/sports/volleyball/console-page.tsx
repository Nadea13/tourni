"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Match, MatchEvent, Player, EventType } from "@/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { VolleyballScoreboard } from "./console/scoreboard";
import { VolleyballEventLog } from "./console/log";
import { VolleyballEventDialog, VolleyballEventSaveData, VolleyballActionType } from "@/features/dialogs";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import {
    ArrowLeft, Zap, Flame, ShieldCheck, HelpCircle, Cloud, CloudOff, RefreshCw,
    Undo, Tv, Users, Play, Square, BarChart2,
    Settings, RotateCw, Clock, Hand, Video, Volleyball, CheckCircle2
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { Header } from "@/components/ui/header";
import { cn } from "@/lib/utils";
import { useMatchWebSocket } from "@/hooks/use-match-websocket";
import { updateMatch, updateCategoryRulesConfig } from "@/actions/tournaments/general";
import { syncCategoryBracket } from "@/actions/tournaments/bracket";
import { ApiClient } from "@/lib/api-client";
import { getPlayers } from "@/actions/tournaments/player";
import { useMatchEvents } from "@/hooks/use-match-events";
import { BroadcastDialog } from "@/features/broadcast";
import { WalkoverDialog } from "@/features/dialogs";
import { RosterSelectionDialog } from "@/features/dialogs";
import { VolleyballMatchStatisticsBox } from "./console/statistics-box";
import { VolleyballTeamInfoDialog, VolleyballSettingsDialog, VolleyballStatisticsDialog } from "@/features/dialogs";
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

interface VolleyballConsolePageProps {
    match: Match;
    tournamentId: string;
    readOnly?: boolean;
    initialEvents?: MatchEvent[];
    backUrl: string;
    tournamentName?: string;
    maxSets?: number;
    rulesConfig?: Record<string, unknown> | null;
    fullWidthScoreboard?: boolean;
}

const pointTypes = ['point', 'ace', 'spike', 'block'];

const getSetNumber = (e: MatchEvent) => {
    const extraSet = (e.extra_info as Record<string, unknown> | null)?.set;
    return typeof extraSet === 'number' ? extraSet : (e.minute || 1);
};

export function VolleyballConsolePage({
    match: initialMatch,
    tournamentId,
    readOnly = false,
    initialEvents = [],
    backUrl,
    tournamentName: _tournamentName,
    maxSets = 3,
    rulesConfig,
    fullWidthScoreboard = false
}: VolleyballConsolePageProps) {
    const locale = useLocale();
    const _tPublic = useTranslations("PublicView");
    const tConsole = useTranslations("Console");
    const { toast } = useToast();
    const isFullWidth = fullWidthScoreboard || readOnly;

    // Customizable Actions & Stats
    const ALL_VOLLEYBALL_ACTIONS = [
        'point', 'ace', 'spike', 'block', 'substitution', 'timeout', 'foul', 'challenge', 'sanction'
    ];
    const DEFAULT_VOLLEYBALL_STATS_KEYS = ['sets_won', 'current_set_points', 'total_points'];
    const ALL_VOLLEYBALL_LOG_EVENT_TYPES = [
        'point', 'ace', 'spike', 'block', 'substitution',
        'timeout', 'foul', 'challenge', 'sanction', 'yellow_card', 'red_card', 'set_win',
        'full_time', 'match_paused', 'walkover'
    ];
    const [customActionTypes, setCustomActionTypes] = useState<string[]>(() => {
        if (Array.isArray(rulesConfig?.volleyball_custom_actions)) {
            return rulesConfig.volleyball_custom_actions as string[];
        }
        if (Array.isArray(rulesConfig?.custom_actions)) {
            return rulesConfig.custom_actions as string[];
        }
        if (typeof window !== "undefined") {
            try {
                const savedCustom = localStorage.getItem("tourni-volleyball-custom-actions");
                if (savedCustom) {
                    const parsed = JSON.parse(savedCustom);
                    if (Array.isArray(parsed) && (parsed.includes('point') || parsed.includes('substitution'))) {
                        return parsed;
                    }
                }
            } catch (_) {}
        }
        return ALL_VOLLEYBALL_ACTIONS;
    });

    const [visibleStats, setVisibleStats] = useState<string[]>(() => {
        if (Array.isArray(rulesConfig?.volleyball_visible_stats)) {
            return rulesConfig.volleyball_visible_stats as string[];
        }
        if (Array.isArray(rulesConfig?.visible_stats)) {
            return rulesConfig.visible_stats as string[];
        }
        if (typeof window !== "undefined") {
            try {
                const savedStats = localStorage.getItem("tourni-volleyball-visible-stats");
                if (savedStats) {
                    const parsed = JSON.parse(savedStats);
                    if (Array.isArray(parsed)) return parsed;
                }
            } catch (_) {}
        }
        return DEFAULT_VOLLEYBALL_STATS_KEYS;
    });

    const [visibleLogs, setVisibleLogs] = useState<string[]>(() => {
        if (Array.isArray(rulesConfig?.volleyball_visible_logs)) {
            return rulesConfig.volleyball_visible_logs as string[];
        }
        if (Array.isArray(rulesConfig?.visible_logs)) {
            return rulesConfig.visible_logs as string[];
        }
        if (typeof window !== "undefined") {
            try {
                const savedLogs = localStorage.getItem("tourni-volleyball-visible-logs");
                if (savedLogs) {
                    const parsed = JSON.parse(savedLogs);
                    if (Array.isArray(parsed)) return parsed;
                }
            } catch (_) {}
        }
        return ALL_VOLLEYBALL_LOG_EVENT_TYPES;
    });
    const [customizeDialogOpen, setCustomizeDialogOpen] = useState(false);

    // Sync from rulesConfig
    useEffect(() => {
        const stats = rulesConfig?.volleyball_visible_stats || rulesConfig?.visible_stats;
        if (Array.isArray(stats)) {
            setVisibleStats(stats as string[]);
        } else if (typeof window !== "undefined") {
            try {
                const savedStats = localStorage.getItem("tourni-volleyball-visible-stats");
                if (savedStats) {
                    const parsed = JSON.parse(savedStats);
                    if (Array.isArray(parsed)) setVisibleStats(parsed);
                } else {
                    setVisibleStats(DEFAULT_VOLLEYBALL_STATS_KEYS);
                }
            } catch (_) {}
        }

        const logs = rulesConfig?.volleyball_visible_logs || rulesConfig?.visible_logs;
        if (Array.isArray(logs)) {
            setVisibleLogs(logs as string[]);
        } else if (typeof window !== "undefined") {
            try {
                const savedLogs = localStorage.getItem("tourni-volleyball-visible-logs");
                if (savedLogs) {
                    const parsed = JSON.parse(savedLogs);
                    if (Array.isArray(parsed)) setVisibleLogs(parsed);
                } else {
                    setVisibleLogs(ALL_VOLLEYBALL_LOG_EVENT_TYPES);
                }
            } catch (_) {}
        }

        const actions = rulesConfig?.volleyball_custom_actions || rulesConfig?.custom_actions;
        if (Array.isArray(actions)) {
            setCustomActionTypes(actions as string[]);
        } else if (typeof window !== "undefined") {
            try {
                const savedCustom = localStorage.getItem("tourni-volleyball-custom-actions");
                if (savedCustom) {
                    const parsed = JSON.parse(savedCustom);
                    if (Array.isArray(parsed)) setCustomActionTypes(parsed);
                }
            } catch (_) {}
        }
    }, [rulesConfig]);

    const toggleCustomAction = (type: string) => {
        setCustomActionTypes(prev => {
            const next = prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type];
            if (typeof window !== "undefined") {
                localStorage.setItem("tourni-volleyball-custom-actions", JSON.stringify(next));
            }
            if (!readOnly && match.tournament_category_id) {
                updateCategoryRulesConfig(tournamentId, String(match.tournament_category_id), { volleyball_custom_actions: next }).catch(console.error);
            }
            return next;
        });
    };

    const toggleVisibleStat = (key: string) => {
        setVisibleStats(prev => {
            const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
            if (typeof window !== "undefined") {
                localStorage.setItem("tourni-volleyball-visible-stats", JSON.stringify(next));
            }
            if (!readOnly && match.tournament_category_id) {
                updateCategoryRulesConfig(tournamentId, String(match.tournament_category_id), { volleyball_visible_stats: next }).catch(console.error);
            }
            return next;
        });
    };

    const toggleVisibleLog = (logType: string) => {
        setVisibleLogs(prev => {
            const next = prev.includes(logType) ? prev.filter(t => t !== logType) : [...prev, logType];
            if (typeof window !== "undefined") {
                localStorage.setItem("tourni-volleyball-visible-logs", JSON.stringify(next));
            }
            if (!readOnly && match.tournament_category_id) {
                updateCategoryRulesConfig(tournamentId, String(match.tournament_category_id), { volleyball_visible_logs: next }).catch(console.error);
            }
            return next;
        });
    };

    // State for Volleyball Match with Snapshot Support
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
            } catch (_) {}
        }
        return initialMatch;
    });

    const { events, queue, isSyncing, syncQueue, addEvent, deleteEvent, handleIncomingEvent, handleIncomingDelete } = useMatchEvents(match.id, tournamentId, initialEvents, readOnly);

    // Persist snapshot to LocalStorage
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

    const isHomeEvent = useCallback((e: MatchEvent) => {
        const extra = e.extra_info as Record<string, unknown> | null;
        if (extra?.team_side === 'home') return true;
        if (extra?.team_side === 'away') return false;

        if (e.team_id) {
            if (e.team_id === match.home_team_id || e.team_id === match.home_team?.id) return true;
            if (e.team_id === match.away_team_id || e.team_id === match.away_team?.id) return false;
        }

        const text = (extra?.text as string) || "";
        if (text.includes("Point for home") || text.toLowerCase().includes("for home")) return true;
        if (text.includes("Point for away") || text.toLowerCase().includes("for away")) return false;

        return false;
    }, [match.home_team_id, match.home_team?.id, match.away_team_id, match.away_team?.id]);

    const isAwayEvent = useCallback((e: MatchEvent) => {
        const extra = e.extra_info as Record<string, unknown> | null;
        if (extra?.team_side === 'away') return true;
        if (extra?.team_side === 'home') return false;

        if (e.team_id) {
            if (e.team_id === match.away_team_id || e.team_id === match.away_team?.id) return true;
            if (e.team_id === match.home_team_id || e.team_id === match.home_team?.id) return false;
        }

        const text = (extra?.text as string) || "";
        if (text.includes("Point for away") || text.toLowerCase().includes("for away")) return true;
        if (text.includes("Point for home") || text.toLowerCase().includes("for home")) return false;

        return false;
    }, [match.home_team_id, match.home_team?.id, match.away_team_id, match.away_team?.id]);

    // Roster & Lineup state
    const [homePlayers, setHomePlayers] = useState<Player[]>([]);
    const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
    const [homeLineup, setHomeLineup] = useState<string[]>([]);
    const [awayLineup, setAwayLineup] = useState<string[]>([]);

    // Dialog state
    const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
    const [overlayDialogOpen, setOverlayDialogOpen] = useState(false);
    const [woDialogOpen, setWoDialogOpen] = useState(false);
    const [statsDialogOpen, setStatsDialogOpen] = useState(false);
    const [teamInfoTarget, setTeamInfoTarget] = useState<'home' | 'away' | null>(null);
    const [actionDialogOpen, setActionDialogOpen] = useState(false);
    const [actionConfig, setActionConfig] = useState<{ teamSide: 'home' | 'away'; eventType: VolleyballActionType | null }>({
        teamSide: 'home',
        eventType: 'point'
    });
    const [confirmConfig, setConfirmConfig] = useState<{
        open: boolean;
        title: string;
        description?: string;
        actionLabel?: string;
        cancelLabel?: string;
        onConfirm?: () => void;
    }>({ open: false, title: "" });
 
    // Fetch Players
    useEffect(() => {
        let isMounted = true;
        const loadPlayers = async () => {
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
            }
        };
        loadPlayers();
        return () => { isMounted = false; };
    }, [match.home_team_id, match.away_team_id, match.home_team?.id, match.away_team?.id]);

    // Derive set score state from events
    const { homeSets, awaySets, homePoints, awayPoints, setHistory, servingTeam, currentSet } = useMemo(() => {
        const finishedSetNumbers = new Set<number>();
        const setPointsMap = new Map<number, { home: number; away: number }>();
        if (events && events.length > 0) {
            events.forEach(e => {
                const extra = (e.extra_info as Record<string, unknown> | null) || (e.detail as Record<string, unknown> | null);
                const setNum = getSetNumber(e);
                if (e.event_type === 'set_end' || e.event_type === 'set_win') {
                    finishedSetNumbers.add(setNum);
                    if (extra && typeof extra.home_score === 'number' && typeof extra.away_score === 'number') {
                        setPointsMap.set(setNum, { home: extra.home_score, away: extra.away_score });
                    }
                }
                if (!pointTypes.includes(e.event_type)) return;
                const current = setPointsMap.get(setNum) || { home: 0, away: 0 };
                if (isHomeEvent(e)) current.home += 1;
                if (isAwayEvent(e)) current.away += 1;
                setPointsMap.set(setNum, current);
            });
        }

        const allSetNumbers = Array.from(setPointsMap.keys()).sort((a, b) => a - b);
        const maxLoggedSet = Math.max(
            allSetNumbers.length > 0 ? Math.max(...allSetNumbers) : 1,
            finishedSetNumbers.size > 0 ? Math.max(...Array.from(finishedSetNumbers)) : 1
        );

        const history: Array<{ set: number; home: number; away: number }> = [];
        let hSets = 0;
        let aSets = 0;

        for (let s = 1; s <= maxLoggedSet; s++) {
            const pts = setPointsMap.get(s) || { home: 0, away: 0 };
            const targetPts = s === maxSets ? 15 : 25;
            const isSetFinishedByScore = (pts.home >= targetPts || pts.away >= targetPts) && Math.abs(pts.home - pts.away) >= 2;
            const isPastSet = s < maxLoggedSet;
            const isExplicitlyFinished = finishedSetNumbers.has(s);

            if (isPastSet || isSetFinishedByScore || isExplicitlyFinished) {
                history.push({ set: s, home: pts.home, away: pts.away });
                if (pts.home > pts.away) hSets += 1;
                else if (pts.away > pts.home) aSets += 1;
            }
        }

        const currSet = hSets + aSets + 1;
        const currHomePts = setPointsMap.get(currSet)?.home || 0;
        const currAwayPts = setPointsMap.get(currSet)?.away || 0;

        const latestPointEvent = events ? events.find(e => pointTypes.includes(e.event_type)) : null;
        const sTeam: 'home' | 'away' = latestPointEvent
            ? (isHomeEvent(latestPointEvent) ? 'home' : 'away')
            : 'home';

        return {
            homeSets: hSets,
            awaySets: aSets,
            homePoints: currHomePts,
            awayPoints: currAwayPts,
            setHistory: history,
            servingTeam: sTeam,
            currentSet: currSet
        };
    }, [events, isHomeEvent, isAwayEvent, maxSets]);

    const handleTriggerActionEvent = (teamSide: 'home' | 'away', eventType: VolleyballActionType) => {
        if (readOnly || match.status !== 'live') return;
        setActionConfig({ teamSide, eventType });
        setActionDialogOpen(true);
    };

    const handleTimeout = useCallback(async (teamSide: 'home' | 'away') => {
        if (readOnly || match.status !== 'live') return;
        const teamId = teamSide === 'home' ? match.home_team_id : match.away_team_id;
        const teamName = teamSide === 'home' ? (match.home_team?.name || 'Home') : (match.away_team?.name || 'Away');

        await addEvent(
            teamId || null,
            'timeout',
            currentSet,
            null,
            {
                text: `Set ${currentSet} - Timeout (${teamName})`,
                set: currentSet,
                team_side: teamSide,
            },
            teamName
        );
        toast({
            title: locale === "th" ? `ขอเวลานอก (${teamName})` : `Timeout called (${teamName})`
        });
    }, [readOnly, match.status, match.home_team_id, match.away_team_id, match.home_team?.name, match.away_team?.name, currentSet, addEvent, locale, toast]);

    const handleSaveVolleyballEvent = useCallback(async (data: VolleyballEventSaveData) => {
        if (!actionConfig.teamSide || !actionConfig.eventType) return;
        const teamSide = actionConfig.teamSide;
        const eventType = actionConfig.eventType;
        const teamId = teamSide === 'home' ? match.home_team_id : match.away_team_id;
        const teamName = teamSide === 'home' ? (match.home_team?.name || 'Home') : (match.away_team?.name || 'Away');
        const targetSet = data.set || currentSet;

        if (eventType === 'point' || eventType === 'ace' || eventType === 'spike' || eventType === 'block') {
            const playerText = data.playerName ? ` (${data.playerName})` : "";
            await addEvent(
                teamId || null,
                eventType,
                targetSet,
                data.playerId || null,
                {
                    text: `Set ${targetSet} - Point for ${teamName || teamSide} (${eventType.toUpperCase()})${playerText}`,
                    set: targetSet,
                    team_side: teamSide,
                    player_name: data.playerName
                },
                data.playerName || teamName || "Team"
            );
        } else if (eventType === 'substitution') {
            const outPlayerId = data.outPlayerId;
            const outPlayerName = data.outPlayerName;
            const inPlayerId = data.inPlayerId;
            const inPlayerName = data.inPlayerName;

            await addEvent(
                teamId || null,
                'substitution',
                targetSet,
                outPlayerId || null,
                {
                    text: `Set ${targetSet} - ${teamName} Substitution: Out ${outPlayerName || ''}, In ${inPlayerName || ''}`,
                    set: targetSet,
                    team_side: teamSide,
                    out_player_id: outPlayerId,
                    out_player_name: outPlayerName,
                    in_player_id: inPlayerId,
                    in_player_name: inPlayerName,
                },
                outPlayerName || teamName
            );

            if (outPlayerId && inPlayerId) {
                if (teamSide === 'home') {
                    const newHomeLineup = homeLineup.map(id => id === outPlayerId ? inPlayerId : id);
                    setHomeLineup(newHomeLineup);
                    try {
                        localStorage.setItem(`match-lineup-volleyball-${match.id}`, JSON.stringify({ home: newHomeLineup, away: awayLineup }));
                    } catch (_) {}
                } else {
                    const newAwayLineup = awayLineup.map(id => id === outPlayerId ? inPlayerId : id);
                    setAwayLineup(newAwayLineup);
                    try {
                        localStorage.setItem(`match-lineup-volleyball-${match.id}`, JSON.stringify({ home: homeLineup, away: newAwayLineup }));
                    } catch (_) {}
                }
            }
            toast({ title: locale === "th" ? "เปลี่ยนตัวผู้เล่นเรียบร้อย" : "Substitution recorded" });
        } else if (eventType === 'foul') {
            await addEvent(
                teamId || null,
                'foul',
                targetSet,
                data.playerId || null,
                {
                    text: `Set ${targetSet} - Foul by ${data.playerName || teamName}${data.foulType ? ` (${data.foulType})` : ''}`,
                    set: targetSet,
                    team_side: teamSide,
                    foul_type: data.foulType,
                    player_name: data.playerName,
                },
                data.playerName || teamName
            );

            if (data.awardOpponentPoint !== false) {
                const opponentSide: 'home' | 'away' = teamSide === 'home' ? 'away' : 'home';
                const opponentTeamId = opponentSide === 'home' ? match.home_team_id : match.away_team_id;
                const opponentTeamName = opponentSide === 'home' ? (match.home_team?.name || 'Home') : (match.away_team?.name || 'Away');

                await addEvent(
                    opponentTeamId || null,
                    'point',
                    targetSet,
                    null,
                    {
                        text: `Set ${targetSet} - Point for ${opponentTeamName} (Foul: ${data.playerName || teamName}${data.foulType ? ` - ${data.foulType}` : ''})`,
                        set: targetSet,
                        team_side: opponentSide,
                        reason: 'opponent_foul',
                    },
                    opponentTeamName
                );

                toast({
                    title: locale === "th"
                        ? `บันทึกฟาวล์ (${teamName}) - ${opponentTeamName} ได้ 1 แต้ม`
                        : `Foul recorded (${teamName}) - 1 point to ${opponentTeamName}`
                });
            } else {
                toast({ title: locale === "th" ? "บันทึกฟาวล์เรียบร้อย" : "Foul recorded" });
            }
        } else if (eventType === 'challenge') {
            await addEvent(
                teamId || null,
                'challenge',
                targetSet,
                null,
                {
                    text: `Set ${targetSet} - Challenge (${teamName}): ${data.challengeReason || ''}${data.challengeResult ? ` [${data.challengeResult}]` : ''}`,
                    set: targetSet,
                    team_side: teamSide,
                    challenge_reason: data.challengeReason,
                    challenge_result: data.challengeResult,
                },
                teamName
            );
            toast({ title: locale === "th" ? "บันทึกวิดีโอชาเลนจ์เรียบร้อย" : "Challenge recorded" });
        } else if (eventType === 'sanction') {
            const resolvedEventType: EventType = (data.sanctionType === 'red_card' ? 'red_card' : 'yellow_card');
            await addEvent(
                teamId || null,
                resolvedEventType,
                targetSet,
                data.playerId || null,
                {
                    text: `Set ${targetSet} - ${data.sanctionType === 'red_card' ? 'Red Card' : 'Yellow Card'}: ${data.playerName || teamName}${data.reason ? ` (${data.reason})` : ''}`,
                    set: targetSet,
                    team_side: teamSide,
                    sanction_type: data.sanctionType,
                    player_name: data.playerName,
                    reason: data.reason,
                },
                data.playerName || teamName
            );
            toast({ title: locale === "th" ? "บันทึกการลงโทษเรียบร้อย" : "Sanction recorded" });
        }
    }, [actionConfig.teamSide, actionConfig.eventType, match.home_team_id, match.away_team_id, match.home_team?.name, match.away_team?.name, match.id, currentSet, addEvent, homeLineup, awayLineup, locale, toast]);

    const handleSaveLineup = (homeActive: string[], awayActive: string[]) => {
        setHomeLineup(homeActive);
        setAwayLineup(awayActive);
        toast({ title: locale === "th" ? "บันทึกรายชื่อผู้เล่นเรียบร้อย" : "Lineup saved successfully" });
    };

    type MatchQueueItem = {
        id: string;
        data: Parameters<typeof updateMatch>[1];
        status: "pending" | "syncing" | "failed";
    };

    // Match updates queue state (Optimistic updates for fast UI & background DB sync)
    const [matchQueue, setMatchQueue] = useState<MatchQueueItem[]>([]);
    const [isMatchSyncing, setIsMatchSyncing] = useState(false);
    const isMatchSyncingRef = useRef(false);
    const matchQueueRef = useRef<MatchQueueItem[]>([]);

    useEffect(() => {
        matchQueueRef.current = matchQueue;
    }, [matchQueue]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(`tourni-pending-match-${match.id}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) {
                        setMatchQueue(parsed);
                        matchQueueRef.current = parsed;
                    }
                } catch (_) { }
            }
        }
    }, [match.id]);

    const persistMatchQueue = useCallback((newQueue: MatchQueueItem[]) => {
        matchQueueRef.current = newQueue;
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
            } catch (_) {
                workingQueue = workingQueue.map(m => m.id === item.id ? { ...m, status: 'failed' as const } : m);
                matchQueueRef.current = workingQueue;
                persistMatchQueue(workingQueue);
            }
        }
        isMatchSyncingRef.current = false;
        setIsMatchSyncing(false);
    }, [match.id, tournamentId, readOnly, persistMatchQueue]);

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

    // Auto-finish match when a team reaches setsToWin (Best of 3 -> 2 wins, Best of 5 -> 3 wins)
    useEffect(() => {
        if (readOnly || match.status === 'finished') return;
        const setsToWin = Math.ceil(maxSets / 2);
        if (homeSets >= setsToWin || awaySets >= setsToWin) {
            queueMicrotask(() => {
                const winnerId = homeSets >= setsToWin ? match.home_team_id : match.away_team_id;
                const allSetsData = setHistory.map(h => ({ set: h.set, home: h.home, away: h.away }));
                if (homePoints > 0 || awayPoints > 0) {
                    if (!allSetsData.some(s => s.set === currentSet)) {
                        allSetsData.push({ set: currentSet, home: homePoints, away: awayPoints });
                    }
                }
                queueMatchUpdate({
                    status: 'finished',
                    home_score: homeSets,
                    away_score: awaySets,
                    winner_id: winnerId,
                    score_detail: {
                        ...(match.score_detail || {}),
                        sets: allSetsData,
                    }
                });
                const catId = match.category_id || match.tournament_category_id;
                if (catId) {
                    syncCategoryBracket(tournamentId, catId).catch(e => {
                        console.error("Failed to auto-sync bracket after volleyball match finished:", e);
                    });
                }
                toast({
                    title: locale === "th" ? "จบการแข่งขันเรียบร้อย!" : "Match Completed!",
                    description: `Winner: ${homeSets >= setsToWin ? match.home_team?.name : match.away_team?.name}`
                });
            });
        }
    }, [homeSets, awaySets, match.status, match.home_team_id, match.away_team_id, match.home_team?.name, match.away_team?.name, match.category_id, match.tournament_category_id, tournamentId, readOnly, locale, toast, maxSets, queueMatchUpdate]);

    // --- Score Sync to DB (for MatchCard) ---
    useEffect(() => {
        if (readOnly || match.status === 'finished') return;

        const dbHomeSets = typeof match.home_score === 'number' ? match.home_score : 0;
        const dbAwaySets = typeof match.away_score === 'number' ? match.away_score : 0;

        const allSetsData = setHistory.map(h => ({ set: h.set, home: h.home, away: h.away }));
        if (homePoints > 0 || awayPoints > 0) {
            if (!allSetsData.some(s => s.set === currentSet)) {
                allSetsData.push({ set: currentSet, home: homePoints, away: awayPoints });
            }
        }

        const scoreDetailSetsStr = JSON.stringify((match.score_detail as Record<string, unknown> | null)?.sets || []);
        const currentSetsStr = JSON.stringify(allSetsData);

        if (homeSets !== dbHomeSets || awaySets !== dbAwaySets || scoreDetailSetsStr !== currentSetsStr) {
            const syncScore = setTimeout(() => {
                queueMatchUpdate({
                    home_score: homeSets,
                    away_score: awaySets,
                    score_detail: {
                        ...(match.score_detail || {}),
                        sets: allSetsData,
                    }
                });
            }, 600);
            return () => clearTimeout(syncScore);
        }
    }, [homeSets, awaySets, match.home_score, match.away_score, homePoints, awayPoints, currentSet, setHistory, match.score_detail, readOnly, match.status, queueMatchUpdate]);

    const handleUndo = async () => {
        if (readOnly) return;
        if (events.length === 0) {
            toast({ title: locale === "th" ? "ไม่มีรายการเหตุการณ์ให้ยกเลิก" : "No events to undo" });
            return;
        }
        const lastEvent = events[0];
        if (lastEvent) {
            await deleteEvent(lastEvent.id);

            // Calculate new set scores after deleting last event
            const remainingEvents = events.slice(1);
            let hSets = 0;
            let aSets = 0;
            const finishedSetNumbers = new Set<number>();
            const setPointsMap = new Map<number, { home: number; away: number }>();
            remainingEvents.forEach(e => {
                if (e.event_type === 'set_end' || e.event_type === 'set_win') {
                    finishedSetNumbers.add(getSetNumber(e));
                }
                if (!pointTypes.includes(e.event_type)) return;
                const setNum = getSetNumber(e);
                const current = setPointsMap.get(setNum) || { home: 0, away: 0 };
                if (isHomeEvent(e)) current.home += 1;
                if (isAwayEvent(e)) current.away += 1;
                setPointsMap.set(setNum, current);
            });

            const allSetNumbers = Array.from(setPointsMap.keys()).sort((a, b) => a - b);
            const maxLoggedSet = Math.max(
                allSetNumbers.length > 0 ? Math.max(...allSetNumbers) : 1,
                finishedSetNumbers.size > 0 ? Math.max(...Array.from(finishedSetNumbers)) : 1
            );

            for (let s = 1; s <= maxLoggedSet; s++) {
                const pts = setPointsMap.get(s) || { home: 0, away: 0 };
                const targetPts = s === maxSets ? 15 : 25;
                const isSetFinishedByScore = (pts.home >= targetPts || pts.away >= targetPts) && Math.abs(pts.home - pts.away) >= 2;
                const isPastSet = s < maxLoggedSet;
                const isExplicitlyFinished = finishedSetNumbers.has(s);

                if (isPastSet || isSetFinishedByScore || isExplicitlyFinished) {
                    if (pts.home > pts.away) hSets += 1;
                    else if (pts.away > pts.home) aSets += 1;
                }
            }

            const setsToWin = Math.ceil(maxSets / 2);
            if (match.status === 'finished' && hSets < setsToWin && aSets < setsToWin) {
                queueMatchUpdate({
                    status: 'live',
                    home_score: hSets,
                    away_score: aSets,
                    winner_id: null
                });
            }

            toast({ title: locale === "th" ? "ยกเลิกเหตุการณ์ล่าสุดแล้ว" : "Undid last event" });
        }
    };

    const handlePostponeMatch = () => {
        setConfirmConfig({
            open: true,
            title: locale === "th" ? "เลื่อนการแข่งขัน?" : "Postpone Match?",
            description: locale === "th" ? "คุณแน่ใจหรือไม่ว่าต้องการเลื่อนการแข่งขันนี้?" : "Are you sure you want to postpone this match?",
            actionLabel: locale === "th" ? "ยืนยัน" : "Confirm",
            cancelLabel: locale === "th" ? "ยกเลิก" : "Cancel",
            onConfirm: async () => {
                const res = await updateMatch(match.id, { status: 'scheduled' }, tournamentId);
                if (res.success) {
                    setMatch(prev => ({ ...prev, status: 'scheduled' }));
                    toast({ title: locale === "th" ? "เลื่อนการแข่งขันแล้ว" : "Match postponed" });
                }
            }
        });
    };

    const handleAbandonMatch = () => {
        setConfirmConfig({
            open: true,
            title: locale === "th" ? "ยกเลิกการแข่งขัน?" : "Abandon Match?",
            description: locale === "th" ? "คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการแข่งขันนี้?" : "Are you sure you want to abandon this match?",
            actionLabel: locale === "th" ? "ยืนยัน" : "Confirm",
            cancelLabel: locale === "th" ? "ยกเลิก" : "Cancel",
            onConfirm: async () => {
                const res = await updateMatch(match.id, { status: 'canceled' }, tournamentId);
                if (res.success) {
                    setMatch(prev => ({ ...prev, status: 'canceled' }));
                    toast({ title: locale === "th" ? "ยกเลิกการแข่งขันเรียบร้อย" : "Match canceled" });
                }
            }
        });
    };

    const handleWalkover = async (winnerTeamId: string) => {
        const homeWon = winnerTeamId === match.home_team_id;
        const res = await updateMatch(
            match.id,
            {
                status: 'finished',
                home_score: homeWon ? 3 : 0,
                away_score: homeWon ? 0 : 3,
                winner_id: winnerTeamId
            },
            tournamentId
        );
        if (res.success) {
            setMatch(prev => ({
                ...prev,
                status: 'finished',
                home_score: homeWon ? 3 : 0,
                away_score: homeWon ? 0 : 3,
                winner_id: winnerTeamId
            }));
            setWoDialogOpen(false);
            const catId = match.category_id || match.tournament_category_id;
            if (catId) {
                try {
                    await syncCategoryBracket(tournamentId, catId);
                } catch (e) {
                    console.error("Failed to auto-sync bracket after volleyball walkover:", e);
                }
            }
            toast({ title: locale === "th" ? "บันทึกชนะบายเรียบร้อย" : "Walkover recorded" });
        }
    };

    const handleEndSet = useCallback(() => {
        if (readOnly || match.status !== 'live') return;

        if (homePoints === awayPoints) {
            toast({
                title: locale === "th" ? "ไม่สามารถจบเซตได้เนื่องจากคะแนนเท่ากัน" : "Cannot end set while scores are tied",
                description: locale === "th" ? "กรุณาบันทึกแต้มตัดสินก่อนตัดจบเซต" : "Please record a deciding point before ending set",
                variant: "destructive"
            });
            return;
        }

        const winnerSide = homePoints > awayPoints ? 'home' : 'away';
        const winnerId = winnerSide === 'home' ? match.home_team_id : match.away_team_id;
        const winnerName = winnerSide === 'home' ? (match.home_team?.name || 'Home') : (match.away_team?.name || 'Away');
        const higherScore = Math.max(homePoints, awayPoints);
        const lowerScore = Math.min(homePoints, awayPoints);

        setConfirmConfig({
            open: true,
            title: locale === "th" ? `ยืนยันการจบเซตที่ ${currentSet}?` : `Finish Set ${currentSet}?`,
            description: locale === "th"
                ? `ทีม ${winnerName} (${higherScore} - ${lowerScore}) จะชนะในเซตนี้ และจะเริ่มนับคะแนนในเซตถัดไป`
                : `${winnerName} (${higherScore} - ${lowerScore}) will win this set, and the next set will begin.`,
            actionLabel: locale === "th" ? "จบเซต" : "End Set",
            cancelLabel: locale === "th" ? "ยกเลิก" : "Cancel",
            onConfirm: async () => {
                await addEvent(
                    winnerId || null,
                    'set_end',
                    currentSet,
                    null,
                    {
                        text: `Set ${currentSet} Ended - ${winnerName} Won Set (${higherScore} - ${lowerScore})`,
                        set: currentSet,
                        home_score: homePoints,
                        away_score: awayPoints,
                        winner_side: winnerSide,
                        winner_id: winnerId,
                        winner_name: winnerName
                    },
                    winnerName
                );
                toast({
                    title: locale === "th"
                        ? `จบเซตที่ ${currentSet} เรียบร้อย (${winnerName} ชนะเซต ${higherScore}-${lowerScore})`
                        : `Set ${currentSet} Finished (${winnerName} won ${higherScore}-${lowerScore})`
                });
            }
        });
    }, [readOnly, match.status, match.home_team_id, match.away_team_id, match.home_team?.name, match.away_team?.name, currentSet, homePoints, awayPoints, addEvent, locale, toast]);

    const matchControlsBox = readOnly ? null : (
        <div className="bg-card border p-2 lg:p-4 relative overflow-hidden group rounded-sm" id="vball-status-control">
            <div className="relative z-10 space-y-2 lg:space-y-4">
                <div className="flex flex-col gap-1 lg:gap-2 w-full">
                    {match.status !== 'live' && match.status !== 'finished' ? (
                        <Button
                            variant="outline"
                            onClick={async () => {
                                await queueMatchUpdate({ status: 'live' });
                                toast({ title: locale === "th" ? "เริ่มต้นการแข่งขันเรียบร้อย" : "Match started" });
                            }}
                            disabled={match.status === 'canceled'}
                            className="w-full justify-center lg:justify-start px-2 bg-primary/10 border-primary/20 hover:bg-primary/20 hover:border-primary/40 transition-all group active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-1.5 lg:gap-2">
                                <Play className="h-4 w-4 fill-primary text-primary" />
                                <span className="text-xs font-bold tracking-widest text-foreground">
                                    {locale === "th" ? "เริ่มการแข่งขัน" : "Start Match"}
                                </span>
                            </div>
                        </Button>
                    ) : match.status === 'live' ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleEndSet}
                                className="w-full justify-center lg:justify-start px-2 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all group active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-1.5 lg:gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-amber-500" />
                                    <span className="text-xs font-bold tracking-widest text-foreground">
                                        {locale === "th" ? `จบเซต (Set ${currentSet})` : `End Set (Set ${currentSet})`}
                                    </span>
                                </div>
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => {
                                    setConfirmConfig({
                                        open: true,
                                        title: locale === "th" ? "คุณแน่ใจหรือไม่ที่จะจบการแข่งขัน?" : "End Match?",
                                        description: locale === "th" ? "คุณแน่ใจหรือไม่ว่าต้องการจบการแข่งขันและบันทึกผลการแข่งขันสุดท้าย?" : "Are you sure you want to finish this match?",
                                        actionLabel: locale === "th" ? "จบการแข่งขัน" : "Finish Match",
                                        cancelLabel: locale === "th" ? "ยกเลิก" : "Cancel",
                                        onConfirm: async () => {
                                            const winnerId = homeSets >= awaySets ? match.home_team_id : match.away_team_id;
                                            const allSetsData = setHistory.map(h => ({ set: h.set, home: h.home, away: h.away }));
                                            if (homePoints > 0 || awayPoints > 0) {
                                                if (!allSetsData.some(s => s.set === currentSet)) {
                                                    allSetsData.push({ set: currentSet, home: homePoints, away: awayPoints });
                                                }
                                            }
                                            await queueMatchUpdate({
                                                status: 'finished',
                                                home_score: homeSets,
                                                away_score: awaySets,
                                                winner_id: winnerId,
                                                score_detail: {
                                                    ...(match.score_detail || {}),
                                                    sets: allSetsData,
                                                }
                                            });
                                            const catId = match.category_id || match.tournament_category_id;
                                            if (catId) {
                                                syncCategoryBracket(tournamentId, catId).catch(e => {
                                                    console.error("Failed to auto-sync bracket after volleyball match finished:", e);
                                                });
                                            }
                                            toast({ title: locale === "th" ? "จบการแข่งขันเรียบร้อย" : "Match finished" });
                                        }
                                    });
                                }}
                                className="w-full justify-center lg:justify-start px-2 bg-destructive/10 border-destructive/20 hover:bg-destructive/20 hover:border-destructive/40 transition-all group active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-1.5 lg:gap-2">
                                    <Square className="h-4 w-4 fill-destructive text-destructive" />
                                    <span className="text-xs font-bold tracking-widest text-foreground">
                                        {locale === "th" ? "จบการแข่งขัน" : "Finish Match"}
                                    </span>
                                </div>
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            disabled
                            className="w-full justify-center lg:justify-start px-2 bg-foreground/5 border-foreground/10 opacity-50 cursor-not-allowed"
                        >
                            <div className="flex items-center gap-1.5 lg:gap-2">
                                <Square className="h-4 w-4 fill-destructive text-destructive opacity-50" />
                                <span className="text-xs font-bold tracking-widest text-muted-foreground">
                                    {locale === "th" ? "จบการแข่งขันแล้ว" : "Match Finished"}
                                </span>
                            </div>
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );

    const quickActionsBox = (
        <div className="bg-card border p-2 lg:p-4 relative overflow-hidden group rounded-sm" id="vball-action-panel">
            <div className={cn(
                "grid gap-1 lg:gap-2",
                readOnly ? "grid-cols-2 lg:grid-cols-1" : "grid-cols-3 lg:grid-cols-1"
            )}>
                {!readOnly && (
                    <Button
                        variant="outline"
                        onClick={() => setOverlayDialogOpen(true)}
                        className="w-full flex justify-center lg:justify-start items-center"
                    >
                        <Tv className="h-4 w-4 text-primary" />
                        <span className="hidden lg:inline">{locale === "th" ? "กราฟิกถ่ายทอดสด" : "Broadcast Overlay"}</span>
                    </Button>
                )}

                <Button
                    variant="outline"
                    onClick={() => setRosterDialogOpen(true)}
                    className="w-full flex justify-center lg:justify-start items-center"
                >
                    <Users className="h-4 w-4 text-primary" />
                    <span className="inline text-xs font-semibold">{locale === "th" ? "จัดตัวผู้เล่น" : "Lineups"}</span>
                </Button>

                <Button
                    variant="outline"
                    onClick={() => setStatsDialogOpen(true)}
                    className="w-full flex justify-center lg:justify-start items-center"
                >
                    <BarChart2 className="h-4 w-4 text-primary" />
                    <span className="inline text-xs font-semibold">{locale === "th" ? "สถิติการแข่งขัน" : "Statistics"}</span>
                </Button>
            </div>
        </div>
    );

    const [_pendingCount, setPendingCount] = useState(0);

    const startConsoleTutorial = () => {
        const steps = [
            {
                element: "#vball-scoreboard",
                popover: {
                    title: locale === "th" ? "กระดานคะแนนวอลเลย์บอล" : "Volleyball Scoreboard",
                    description: locale === "th" ? "แสดงชื่อทีม โลโก้ จำนวนเซตที่ชนะ คะแนนในเซตปัจจุบัน และประวัติคะแนนของแต่ละเซต" : "Displays team names, logos, sets won, current set points, and set history.",
                    side: "bottom" as const,
                    align: "start" as const
                }
            },
            {
                element: "#vball-point-controls",
                popover: {
                    title: locale === "th" ? "ปุ่มให้คะแนน (Point Controls)" : "Point Controls",
                    description: locale === "th" ? "กด +1 Point หรือเลือกเหตุการณ์ Ace / Spike / Block เพื่อให้คะแนนทีมที่ทำได้" : "Add points or record Ace, Spike, or Block events.",
                    side: "top" as const,
                    align: "start" as const
                }
            },
            {
                element: "#vball-events-log",
                popover: {
                    title: locale === "th" ? "บันทึกเหตุการณ์ (Events Log)" : "Events Log",
                    description: locale === "th" ? "แสดงประวัติคะแนนและเหตุการณ์ทั้งหมด สามารถกดลบรายการได้" : "View recorded events and delete items if needed.",
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

    const _handleManualSync = async () => {
        await syncQueue();
        setPendingCount(0);
        toast({ title: locale === "th" ? "ซิงค์ข้อมูลเรียบร้อย" : "Data synced successfully" });
    };

    return (
        <div className="flex flex-col font-display selection:bg-primary selection:text-primary-foreground space-y-2 lg:space-y-4 bg-background text-foreground">
            {/* Console Main Header */}
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
                                    match.status === 'live' ? "bg-primary" : (match.status === 'finished' ? "bg-emerald-500" : "bg-warning")
                                )}></span>
                                <span className={cn(
                                    "relative inline-flex rounded-full h-2 w-2",
                                    match.status === 'live' ? "bg-primary" : (match.status === 'finished' ? "bg-emerald-500" : "bg-warning")
                                )}></span>
                            </span>
                            <span className="text-[10px] font-black tracking-widest uppercase whitespace-nowrap">
                                {match.status === 'finished'
                                    ? (locale === 'th' ? 'จบการแข่งขัน' : 'FINISHED')
                                    : (match.status === 'live'
                                        ? (locale === 'th' ? 'กำลังแข่งขัน' : 'LIVE')
                                        : (locale === 'th' ? 'ยังไม่เริ่มการแข่งขัน' : 'SCHEDULED'))}
                            </span>
                        </div>

                        {/* Undo Button */}
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={handleUndo}
                            title={tConsole("undo") || "ย้อนกลับ (Undo)"}
                        >
                            <Undo className="h-4 w-4" />
                        </Button>

                        {/* Help Tutorial Button */}
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={startConsoleTutorial}
                            title={locale === "th" ? "สอนการใช้งาน" : "Help Tutorial"}
                        >
                            <HelpCircle className="h-4 w-4" />
                        </Button>

                        {/* Settings Button */}
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setCustomizeDialogOpen(true)}
                            title={tConsole("settings") || "ตั้งค่า"}
                        >
                            <Settings className="h-4 w-4" />
                        </Button>

                        {/* Sync Icon */}
                        {(isSyncing || isMatchSyncing) ? (
                            <div className="flex items-center justify-center text-primary h-8 w-8" title={locale === "th" ? "กำลังบันทึกลง Database..." : "Syncing to Database..."}>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            </div>
                        ) : (() => {
                            const pendingEvents = queue.filter(q => q.status === 'pending' || q.status === 'failed');
                            const pendingMatch = matchQueue.filter(m => m.status === 'pending' || m.status === 'failed');
                            const hasPending = (pendingEvents.length + pendingMatch.length) > 0;
                            return hasPending ? (
                                <div className="flex items-center gap-1 text-amber-500" title={locale === "th" ? `ยังไม่ได้บันทึกลง Database (${pendingEvents.length + pendingMatch.length})` : `Not synced (${pendingEvents.length + pendingMatch.length})`}>
                                    <CloudOff className="w-4 h-4" />
                                    <button
                                        onClick={() => {
                                            syncQueue();
                                            syncMatchQueue();
                                        }}
                                        className="ml-1 hover:text-white transition-colors"
                                        title={locale === "th" ? "กดเพื่อบันทึกทันที" : "Click to sync now"}
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center text-emerald-500 h-8 w-8" title={locale === "th" ? "บันทึกลง Database เรียบร้อยแล้ว" : "Synced to Database"}>
                                    <Cloud className="w-4 h-4" />
                                </div>
                            );
                        })()}
                    </div>
                )}
            </header>

            {/* Main Content & Sidebar Grid */}
            <main className="flex-1 w-full flex flex-col gap-2 lg:gap-4">
                {/* Scoreboard Section (Full Width across page) */}
                {isFullWidth && (
                    <section className="w-full flex flex-col gap-2 lg:gap-4" id="vball-scoreboard">
                        <VolleyballScoreboard
                            match={match}
                            events={events}
                            homeSetsWon={homeSets}
                            awaySetsWon={awaySets}
                            currentSetHomePoints={homePoints}
                            currentSetAwayPoints={awayPoints}
                            setScoresHistory={setHistory}
                            servingTeam={servingTeam}
                            currentSetNumber={currentSet}
                            maxSets={maxSets}
                            onTeamClick={(tId, side) => {
                                if (side === 'home' || (tId && (tId === match.home_team_id || tId === match.home_team?.id))) {
                                    setTeamInfoTarget('home');
                                } else if (side === 'away' || (tId && (tId === match.away_team_id || tId === match.away_team?.id))) {
                                    setTeamInfoTarget('away');
                                }
                            }}
                        />

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

                        {/* Quick Actions (Desktop only) */}
                        <div className="hidden lg:block">
                            {quickActionsBox}
                        </div>

                        {readOnly && (
                            <div className="hidden lg:block border rounded-sm overflow-hidden bg-card shadow-xs">
                                <VolleyballMatchStatisticsBox
                                    match={match}
                                    events={events}
                                    homeSetsWon={homeSets}
                                    awaySetsWon={awaySets}
                                    homePoints={homePoints}
                                    awayPoints={awayPoints}
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
                            <section className="flex flex-col gap-2 lg:gap-4" id="vball-scoreboard">
                                <VolleyballScoreboard
                                    match={match}
                                    events={events}
                                    homeSetsWon={homeSets}
                                    awaySetsWon={awaySets}
                                    currentSetHomePoints={homePoints}
                                    currentSetAwayPoints={awayPoints}
                                    setScoresHistory={setHistory}
                                    servingTeam={servingTeam}
                                    currentSetNumber={currentSet}
                                    maxSets={maxSets}
                                    onTeamClick={(tId, side) => {
                                        if (side === 'home' || (tId && (tId === match.home_team_id || tId === match.home_team?.id))) {
                                            setTeamInfoTarget('home');
                                        } else if (side === 'away' || (tId && (tId === match.away_team_id || tId === match.away_team?.id))) {
                                            setTeamInfoTarget('away');
                                        }
                                    }}
                                />

                                {/* Quick Actions (Mobile only) */}
                                <div className="block lg:hidden">
                                    {quickActionsBox}
                                </div>

                                 {/* Point Controls Section (Split into Home & Away Cards) */}
                                {!readOnly && (() => {
                                    const renderTeamActionButtons = (teamSide: 'home' | 'away') => {
                                        const isActionDisabled = readOnly || match.status !== 'live';

                                        const actions = [
                                            { type: 'point', label: locale === 'th' ? "ได้แต้ม" : "Point", icon: Volleyball, iconColor: 'text-amber-500' },
                                            { type: 'ace', label: locale === 'th' ? "เสิร์ฟเอซ" : "Serve", icon: Zap, iconColor: 'text-yellow-400' },
                                            { type: 'spike', label: locale === 'th' ? "ตบทำแต้ม" : "Attack", icon: Flame, iconColor: 'text-red-500' },
                                            { type: 'block', label: locale === 'th' ? "บล็อก" : "Block", icon: ShieldCheck, iconColor: 'text-blue-500' },
                                            { type: 'substitution', label: locale === 'th' ? "เปลี่ยนตัว" : "Sub", icon: RotateCw, iconColor: 'text-emerald-500' },
                                            { type: 'timeout', label: locale === 'th' ? "ขอเวลานอก" : "Timeout", icon: Clock, iconColor: 'text-purple-500' },
                                            { type: 'foul', label: locale === 'th' ? "ฟาวล์" : "Foul", icon: Hand, iconColor: 'text-orange-500' },
                                            { type: 'challenge', label: locale === 'th' ? "ชาเลนจ์" : "Challenge", icon: Video, iconColor: 'text-cyan-500' },
                                            { type: 'sanction', label: locale === 'th' ? "คาดโทษ" : "Sanctions", icon: Square, iconColor: 'text-amber-500 fill-amber-500' },
                                        ];

                                        const filteredActions = actions.filter(action => customActionTypes.includes(action.type));

                                        return (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 lg:gap-2">
                                                {filteredActions.map(action => (
                                                    <Button
                                                        key={action.type}
                                                        variant="outline"
                                                        disabled={isActionDisabled}
                                                        onClick={() => {
                                                            if (action.type === 'timeout') {
                                                                handleTimeout(teamSide);
                                                            } else {
                                                                handleTriggerActionEvent(teamSide, action.type as VolleyballActionType);
                                                            }
                                                        }}
                                                        className={cn(
                                                            "h-9 px-2.5 rounded-sm font-medium border-border/80 hover:border-primary/50 hover:bg-muted/40 transition-colors shadow-none",
                                                            action.type === 'point' && "col-span-2 sm:col-span-3 h-10 font-bold"
                                                        )}
                                                    >
                                                        <action.icon className={cn("h-4 w-4 transition-transform shrink-0", action.iconColor)} />
                                                        <span className="text-xs font-semibold truncate cursor-pointer tracking-normal">{action.label}</span>
                                                    </Button>
                                                ))}
                                            </div>
                                        );
                                    };

                                    return (
                                        <div className="flex flex-col gap-2 lg:gap-4">
                                            {match.status !== 'finished' ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 lg:gap-4" id="vball-point-controls">
                                                    {/* Home Team Control Card */}
                                                    <div className="bg-card border rounded-sm p-2 lg:p-4 relative overflow-hidden group space-y-3">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-primary" />
                                                                <h3 className="text-lg lg:text-xl font-black tracking-tight truncate">
                                                                    {match.home_team?.name || "Home"}
                                                                </h3>
                                                            </div>
                                                        </div>

                                                        {renderTeamActionButtons('home')}
                                                    </div>

                                                    {/* Away Team Control Card */}
                                                    <div className="bg-card border rounded-sm p-2 lg:p-4 relative overflow-hidden group space-y-3">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-primary/60" />
                                                                <h3 className="text-lg lg:text-xl font-black tracking-tight truncate">
                                                                    {match.away_team?.name || "Away"}
                                                                </h3>
                                                            </div>
                                                        </div>

                                                        {renderTeamActionButtons('away')}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="p-4 bg-muted/50 border rounded-sm flex items-center justify-between">
                                                    <span className="text-sm font-bold text-muted-foreground">
                                                        {locale === "th" ? "การแข่งขันจบลงแล้ว (หากต้องการแก้ไขแต้มย้อนหลัง สามารถกด Undo บนเมนูด้านข้างได้)" : "Match finished (Click Undo on the left menu to revert last point)"}
                                                    </span>
                                                    <Button variant="outline" size="sm" onClick={handleUndo} className="gap-2">
                                                        <Undo className="h-4 w-4" />
                                                        <span>{locale === "th" ? "ยกเลิกแต้มล่าสุด (Undo)" : "Undo Last Point"}</span>
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </section>
                        )}

                                            {/* Log Section */}
                        <section className="flex flex-col gap-2 lg:gap-4" id="vball-events-log">
                            <VolleyballEventLog
                                events={events}
                                match={match}
                                homeTeamId={match.home_team_id || undefined}
                                awayTeamId={match.away_team_id || undefined}
                                players={[...homePlayers, ...awayPlayers]}
                                readOnly={readOnly}
                                onDeleteEvent={(id) => deleteEvent(id)}
                                visibleLogs={visibleLogs}
                            />
                        </section>
                    </div>
                </div>
            </main>

            {/* Dialogs */}
            <VolleyballEventDialog
                open={actionDialogOpen}
                onOpenChange={setActionDialogOpen}
                teamSide={actionConfig.teamSide}
                teamName={actionConfig.teamSide === 'home' ? match.home_team?.name : match.away_team?.name}
                eventType={actionConfig.eventType}
                initialSet={currentSet}
                players={actionConfig.teamSide === 'home' ? homePlayers : awayPlayers}
                opponentPlayers={actionConfig.teamSide === 'home' ? awayPlayers : homePlayers}
                activeLineupIds={actionConfig.teamSide === 'home' ? homeLineup : awayLineup}
                onSave={handleSaveVolleyballEvent}
            />
            <RosterSelectionDialog
                open={rosterDialogOpen}
                onOpenChange={setRosterDialogOpen}
                homeTeamName={match.home_team?.name || 'Home'}
                awayTeamName={match.away_team?.name || 'Away'}
                homePlayers={homePlayers}
                awayPlayers={awayPlayers}
                homeActiveIds={homeLineup}
                awayActiveIds={awayLineup}
                onSave={handleSaveLineup}
                readOnly={readOnly}
            />
            <BroadcastDialog open={overlayDialogOpen} onOpenChange={setOverlayDialogOpen} matchId={match.id} tournamentId={tournamentId} sport="volleyball" />
            <WalkoverDialog open={woDialogOpen} onOpenChange={setWoDialogOpen} match={match} onConfirm={handleWalkover} />
            <VolleyballStatisticsDialog
                open={statsDialogOpen}
                onOpenChange={setStatsDialogOpen}
                match={match}
                events={events}
                homeSetsWon={homeSets}
                awaySetsWon={awaySets}
                homePoints={homePoints}
                awayPoints={awayPoints}
                visibleStats={visibleStats}
            />
            <VolleyballTeamInfoDialog
                open={teamInfoTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setTeamInfoTarget(null);
                }}
                teamName={teamInfoTarget === 'home' ? (match.home_team?.name || 'Home') : (match.away_team?.name || 'Away')}
                teamLogo={teamInfoTarget === 'home' ? match.home_team?.logo_url : match.away_team?.logo_url}
                description={(teamInfoTarget === 'home' ? match.home_team?.description : match.away_team?.description) || null}
                contactName={(teamInfoTarget === 'home' ? match.home_team?.contact_name : match.away_team?.contact_name) || null}
                contactPhone={(teamInfoTarget === 'home' ? match.home_team?.contact_phone : match.away_team?.contact_phone) || null}
                players={teamInfoTarget === 'home' ? homePlayers : awayPlayers}
                activeLineupIds={teamInfoTarget === 'home' ? homeLineup : awayLineup}
                events={events}
                teamId={teamInfoTarget === 'home' ? match.home_team_id : match.away_team_id}
            />

            <AlertDialog open={confirmConfig.open} onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, open }))}>
                <AlertDialogContent className="bg-card border rounded-sm shadow-2xl sm:max-w-md z-[60]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="border-b p-4">
                            {confirmConfig.title}
                        </AlertDialogTitle>
                        {confirmConfig.description && (
                            <AlertDialogDescription className="p-4">
                                {confirmConfig.description}
                            </AlertDialogDescription>
                        )}
                    </AlertDialogHeader>
                    <AlertDialogFooter className="p-4 bg-muted/20 border-t flex gap-2">
                        <AlertDialogCancel>{confirmConfig.cancelLabel || "Cancel"}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => confirmConfig.onConfirm?.()}>
                            {confirmConfig.actionLabel || "Confirm"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Settings Dialog */}
            <VolleyballSettingsDialog
                open={customizeDialogOpen}
                onOpenChange={setCustomizeDialogOpen}
                match={match}
                readOnly={readOnly}
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
        </div>
    );
}

