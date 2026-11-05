"use client";

import React, { useState, useEffect } from "react";
import { Match } from "@/types";
import { useMatchEvents } from "@/hooks/use-match-events";
import { useMatchTimer } from "@/hooks/use-match-timer";
import { useMatchWebSocket } from "@/hooks/use-match-websocket";
import { cn } from "@/lib/utils";
import { isMatchLive, isMatchEnded } from "./match-node";

export function formatTimerSeconds(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

interface LiveMatchTimerProps {
    match: Match;
    tournamentId: string;
    inHeader?: boolean;
    className?: string;
}

export function LiveMatchTimer({ match: initialMatch, tournamentId, className }: LiveMatchTimerProps) {
    const [match, setMatch] = useState<Match>(initialMatch);

    useEffect(() => {
        setMatch(initialMatch);
    }, [initialMatch]);

    const { events, handleIncomingEvent, handleIncomingDelete } = useMatchEvents(match.id, tournamentId, undefined, true);

    useMatchWebSocket(match.id, {
        onMatchEvent: (data) => {
            if (data?.event) {
                handleIncomingEvent(data.event);
            }
        },
        onMatchEventDelete: (data) => {
            if (data?.event_id) {
                handleIncomingDelete(data.event_id);
            }
        },
        onMatchUpdate: (data) => {
            if (data?.match) {
                setMatch(prev => ({ ...prev, ...data.match }));
            }
        },
        onScoreUpdate: (data) => {
            if (data) {
                setMatch(prev => ({
                    ...prev,
                    home_score: data.home_score,
                    away_score: data.away_score,
                    status: (data.status as Match["status"]) || prev.status,
                }));
            }
        }
    });

    const isFutsal = Boolean(
        (match as any).sport === 'futsal' ||
        (match as any).sport?.includes('futsal') ||
        (match as any).sport?.includes('ฟุตซอล') ||
        (match as any).sport_name?.toLowerCase().includes('futsal') ||
        (match as any).sport_name?.includes('ฟุตซอล')
    );
    const { time } = useMatchTimer(match, tournamentId, events, 0, isFutsal);
    const formatted = formatTimerSeconds(time);

    return (
        <span
            className={cn(
                "text-xs font-bold flex items-center tabular-nums",
                className
            )}>
            {formatted}
        </span>
    );
}

export function MatchSettingTimerPill({
    dbMatch,
    match,
    tournamentId,
    sport = "football",
}: {
    dbMatch?: Match;
    match?: { match_date?: string; match_time?: string };
    tournamentId: string;
    sport?: string;
}) {
    const isLive = isMatchLive(dbMatch?.status);
    const isEnded = isMatchEnded(dbMatch?.status);

    if (isLive && dbMatch) {
        if (sport === 'volleyball') {
            const homeSets = typeof dbMatch.home_score === 'number' ? dbMatch.home_score : 0;
            const awaySets = typeof dbMatch.away_score === 'number' ? dbMatch.away_score : 0;
            const currentSetNum = (homeSets + awaySets) + 1;
            return (
                <span className="text-[10px] font-black text-primary flex items-center gap-1 mt-0.5">
                    <span className="size-1.5 rounded-full bg-primary" />
                    SET {currentSetNum}
                </span>
            );
        }

        if (dbMatch.status === 'half_time') {
            return (
                <span className="text-[10px] font-black text-warning uppercase px-1 rounded bg-warning/10 border border-warning/20 mt-0.5">
                    HT
                </span>
            );
        }

        return <LiveSettingTimer match={dbMatch} tournamentId={tournamentId} />;
    }

    if (isEnded && dbMatch) {
        const isCanceled = dbMatch.status === 'canceled' || dbMatch.status === 'cancelled';
        return (
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                {isCanceled ? 'Canceled' : 'FT'}
            </span>
        );
    }

    const timeStr = dbMatch?.match_time || match?.match_time;
    if (timeStr) {
        return (
            <span className="text-[10px] font-semibold text-muted-foreground/80 tabular-nums mt-0.5">
                {timeStr.slice(0, 5)}
            </span>
        );
    }

    return null;
}

function LiveSettingTimer({ match: initialMatch, tournamentId }: { match: Match; tournamentId: string }) {
    const [match, setMatch] = useState<Match>(initialMatch);

    useEffect(() => {
        setMatch(initialMatch);
    }, [initialMatch]);

    const { events, handleIncomingEvent, handleIncomingDelete } = useMatchEvents(match.id, tournamentId, undefined, true);

    useMatchWebSocket(match.id, {
        onMatchEvent: (data) => {
            if (data?.event) {
                handleIncomingEvent(data.event);
            }
        },
        onMatchEventDelete: (data) => {
            if (data?.event_id) {
                handleIncomingDelete(data.event_id);
            }
        },
        onMatchUpdate: (data) => {
            if (data?.match) {
                setMatch(prev => ({ ...prev, ...data.match }));
            }
        },
        onScoreUpdate: (data) => {
            if (data) {
                setMatch(prev => ({
                    ...prev,
                    home_score: data.home_score,
                    away_score: data.away_score,
                    status: (data.status as Match["status"]) || prev.status,
                }));
            }
        }
    });

    const isFutsal = Boolean(
        (match as any).sport === 'futsal' ||
        (match as any).sport?.includes('futsal') ||
        (match as any).sport?.includes('ฟุตซอล') ||
        (match as any).sport_name?.toLowerCase().includes('futsal') ||
        (match as any).sport_name?.includes('ฟุตซอล')
    );
    const { time } = useMatchTimer(match, tournamentId, events, 0, isFutsal);
    const formatted = formatTimerSeconds(time);

    return (
        <span className="text-[10px] font-bold tabular-nums flex items-center text-muted-foreground">
            {formatted}
        </span>
    );
}
