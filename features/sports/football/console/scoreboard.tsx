import { useState, useEffect } from "react";
import { Match, MatchEvent } from "@/types";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useLocale } from "next-intl";

import { MatchTimer } from "./timer";

const getInitials = (name: string) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

interface ScoreboardProps {
    match: Match;
    homeScore: number;
    awayScore: number;
    events?: MatchEvent[];
    onTeamClick?: (teamId: string, side?: 'home' | 'away') => void;
    // Timer props
    timerTime?: number;
    timerReadOnly?: boolean;
    timerCustomText?: string | number | null;
    addedTime?: number | null;
    showPossession?: boolean;
    isFutsal?: boolean;
    homeFouls?: number;
    awayFouls?: number;
    homeTimeoutUsed?: boolean;
    awayTimeoutUsed?: boolean;
}

export function Scoreboard({ match, homeScore, awayScore, events = [], onTeamClick, timerTime, timerReadOnly, timerCustomText, addedTime, showPossession = true, isFutsal = false, homeFouls = 0, awayFouls = 0, homeTimeoutUsed = false, awayTimeoutUsed = false }: ScoreboardProps) {
    const locale = useLocale();
    const isTh = locale === "th";
    const isFutsalSport = isFutsal || (match as any).sport === 'futsal' || (match as any).sport?.includes('futsal') || (match as any).sport?.includes('ฟุตซอล');
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (match.timer_status !== 'playing') return;
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, [match.timer_status]);

    const formatTeamName = (name: string | undefined) => {
        return name || "";
    };

    const calculatePossession = () => {
        if (!events || events.length === 0) return { home: 50, away: 50, total: 0 };

        const homeTeamId = match.home_team_id;
        const awayTeamId = match.away_team_id;

        // Sort events chronologically by created_at
        const sortedEvents = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        let homeTimeMs = 0;
        let awayTimeMs = 0;
        let currentPossessor: 'home' | 'away' | null = null;
        let lastTimestamp: number | null = null;
        let isTimerActive = false;

        sortedEvents.forEach((evt) => {
            const evtTime = new Date(evt.created_at).getTime();

            // Only accumulate duration if timer was running
            if (isTimerActive && currentPossessor && lastTimestamp !== null && evtTime > lastTimestamp) {
                const duration = evtTime - lastTimestamp;
                if (currentPossessor === 'home') homeTimeMs += duration;
                if (currentPossessor === 'away') awayTimeMs += duration;
            }

            const isHome = evt.team_id === homeTeamId;
            const isAway = evt.team_id === awayTeamId;

            // Timer start/resume events
            if (
                evt.event_type === 'first_half' ||
                evt.event_type === 'second_half' ||
                evt.event_type === 'extra_time' ||
                evt.event_type === 'extra_time_second_half' ||
                evt.event_type === 'kick_off' ||
                evt.event_type === 'match_resumed'
            ) {
                isTimerActive = true;
            }
            // Timer pause/stop events
            else if (
                evt.event_type === 'match_paused' ||
                evt.event_type === 'half_time' ||
                evt.event_type === 'extra_time_half_time' ||
                evt.event_type === 'full_time' ||
                evt.event_type === 'penalties' ||
                evt.event_type === 'walkover'
            ) {
                isTimerActive = false;
                currentPossessor = null;
            }

            // Direct possession actions
            if (evt.event_type === 'possession' || evt.event_type === 'pass' || evt.event_type === 'cross') {
                if (isHome) currentPossessor = 'home';
                else if (isAway) currentPossessor = 'away';
            }
            // Turnover actions transfer possession to opposite team
            else if (evt.event_type === 'bad_pass' || evt.event_type === 'miss_cross') {
                if (isHome) currentPossessor = 'away';
                else if (isAway) currentPossessor = 'home';
            }
            // Stoppage events pause possession accumulation
            else if (
                evt.event_type === 'goal' ||
                evt.event_type === 'yellow_card' ||
                evt.event_type === 'red_card' ||
                evt.event_type === 'substitution' ||
                evt.event_type === 'injury' ||
                evt.event_type === 'corner' ||
                evt.event_type === 'offside'
            ) {
                currentPossessor = null;
            }

            lastTimestamp = evtTime;
        });

        // Accumulate live duration up to now ONLY IF match.timer_status === 'playing'
        const isMatchLive = match.status === 'live' || match.status === 'first_half' || match.status === 'second_half';
        if (match.timer_status === 'playing' && isMatchLive && currentPossessor && lastTimestamp !== null) {
            const currentMs = now;
            if (currentMs > lastTimestamp) {
                const liveDuration = currentMs - lastTimestamp;
                if (currentPossessor === 'home') homeTimeMs += liveDuration;
                if (currentPossessor === 'away') awayTimeMs += liveDuration;
            }
        }

        const totalTimeMs = homeTimeMs + awayTimeMs;
        if (totalTimeMs <= 0) return { home: 50, away: 50, total: 0 };

        const homePct = Math.round((homeTimeMs / totalTimeMs) * 100);
        const awayPct = 100 - homePct;

        return { home: homePct, away: awayPct, total: totalTimeMs };
    };

    const possession = calculatePossession();

    return (
        <div className="bg-card border rounded-sm relative overflow-hidden w-full group">
            <div className="p-2 lg:p-4 flex flex-col items-center justify-center relative z-10 w-full">
                <div className="flex items-center justify-between w-full max-w-7xl px-2 lg:px-8 gap-4 lg:gap-12">
                    <div
                        className="flex-1 flex flex-row-reverse items-center justify-start gap-2 lg:flex-col lg:items-center lg:gap-4 cursor-pointer group/home min-w-0"
                        onClick={() => onTeamClick?.(match.home_team_id || match.home_team?.id || "", 'home')}
                        title={isTh ? "ดูรายชื่อตัวจริง - สำรอง" : "View Lineup"}
                    >
                        <div className="inline-flex items-center justify-center w-12 h-12 lg:w-24 lg:h-24 rounded-full relative group/logo shrink-0">
                            {match.home_team?.logo_url ? (
                                <Image src={match.home_team.logo_url} width={64} height={64} className="w-full h-full object-contain relative z-10 rounded-full" alt="" />
                            ) : (
                                <span className="text-2xl font-black text-foreground/20 relative z-10">{getInitials(match.home_team?.name || '')}</span>
                            )}
                        </div>
                        <div className="min-w-0 max-w-[80px] lg:max-w-none">
                            <h2 className="text-xs lg:text-3xl font-black tracking-tighter text-foreground truncate group-hover/home:text-primary transition-colors">
                                {formatTeamName(match.home_team?.name)}
                            </h2>
                        </div>
                    </div>

                    {/* Central Score Area */}
                    <div className="flex flex-col items-center">
                        {timerTime !== undefined && (
                            <MatchTimer
                                time={timerTime}
                                readOnly={timerReadOnly}
                                customText={timerCustomText}
                                addedTime={addedTime}
                            />
                        )}

                        <div className="flex items-center gap-3 lg:gap-8 tabular-nums">
                            {/* Home Fouls (Futsal: same position as volleyball set) */}
                            {isFutsalSport && (() => {
                                const homeStep = homeFouls % 6;
                                return (
                                <div className="flex flex-col items-center lg:items-end gap-1">
                                    <div className="flex items-center gap-1.5 lg:gap-2">
                                        <div className="flex items-center gap-0.5 lg:gap-1">
                                            {[1, 2, 3, 4, 5].map((num) => {
                                                return (
                                                    <span
                                                        key={num}
                                                        className={cn(
                                                            "w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full transition-colors",
                                                            homeStep >= num
                                                                ? homeStep >= 5 ? "bg-destructive animate-pulse" : "bg-warning"
                                                                : "bg-muted-foreground/20"
                                                        )}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <span className={cn(
                                            "text-2xl lg:text-5xl font-black",
                                            homeStep >= 5 ? "text-destructive animate-pulse" : "text-primary"
                                        )}>
                                            {homeStep}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[9px] lg:text-[10px] font-semibold text-muted-foreground">
                                        <span
                                            title={homeTimeoutUsed ? (isTh ? "เวลานอก: ใช้แล้ว" : "Timeout: Used") : (isTh ? "เวลานอก: พร้อมใช้" : "Timeout: Available")}
                                            className={cn(
                                                "w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full transition-colors shrink-0",
                                                homeTimeoutUsed ? "bg-muted-foreground/20" : "bg-node-5 shadow-[0_0_6px_var(--color-node-5)]"
                                            )}
                                        />
                                        <span>{isTh ? "เวลานอก" : "TO"}</span>
                                    </div>
                                </div>
                                );
                            })()}

                            {/* Home Score */}
                            <span className="text-5xl lg:text-7xl lg:text-9xl font-black tracking-tighter text-foreground">{homeScore}</span>

                            <div className="flex flex-col items-center gap-2">
                                <span className="text-primary text-2xl lg:text-4xl font-black">-</span>
                            </div>

                            {/* Away Score */}
                            <span className="text-5xl lg:text-7xl lg:text-9xl font-black tracking-tighter text-foreground">{awayScore}</span>

                            {/* Away Fouls (Futsal: same position as volleyball set) */}
                            {isFutsalSport && (() => {
                                const awayStep = awayFouls % 6;
                                return (
                                <div className="flex flex-col items-center lg:items-start gap-1">
                                    <div className="flex items-center gap-1.5 lg:gap-2">
                                        <span className={cn(
                                            "text-2xl lg:text-5xl font-black",
                                            awayStep >= 5 ? "text-destructive animate-pulse" : "text-primary"
                                        )}>
                                            {awayStep}
                                        </span>
                                        <div className="flex items-center gap-0.5 lg:gap-1">
                                            {[1, 2, 3, 4, 5].map((num) => {
                                                return (
                                                    <span
                                                        key={num}
                                                        className={cn(
                                                            "w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full transition-colors",
                                                            awayStep >= num
                                                                ? awayStep >= 5 ? "bg-destructive animate-pulse" : "bg-warning"
                                                                : "bg-muted-foreground/20"
                                                        )}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[9px] lg:text-[10px] font-semibold text-muted-foreground">
                                        <span>{isTh ? "เวลานอก" : "TO"}</span>
                                        <span
                                            title={awayTimeoutUsed ? (isTh ? "เวลานอก: ใช้แล้ว" : "Timeout: Used") : (isTh ? "เวลานอก: พร้อมใช้" : "Timeout: Available")}
                                            className={cn(
                                                "w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full transition-colors shrink-0",
                                                awayTimeoutUsed ? "bg-muted-foreground/20" : "bg-node-5 shadow-[0_0_6px_var(--color-node-5)]"
                                            )}
                                        />
                                    </div>
                                </div>
                                );
                            })()}
                        </div>

                        {/* Penalty Shootout Score */}
                        {(() => {
                            // Calculate local penalty score from events if match object hasn't updated yet
                            const pEvents = events.filter(e => e.event_type === 'penalty_shot');
                            const localHomeScore = pEvents.filter(e => e.team_id === match.home_team_id && e.extra_info?.scored === true).length;
                            const localAwayScore = pEvents.filter(e => e.team_id === match.away_team_id && e.extra_info?.scored === true).length;

                            const showHomeScore = match.penalty_home_score !== null && match.penalty_home_score !== undefined ? match.penalty_home_score : localHomeScore;
                            const showAwayScore = match.penalty_away_score !== null && match.penalty_away_score !== undefined ? match.penalty_away_score : localAwayScore;
                            
                            // Show if there is penalty score recorded or at least one penalty shot logged
                            const hasPenaltyScore = (match.penalty_home_score !== null && match.penalty_home_score !== undefined && (Number(match.penalty_home_score) > 0 || Number(match.penalty_away_score) > 0)) || pEvents.length > 0;
                            if (hasPenaltyScore) {
                                return (
                                    <div className="px-2 py-0.5 rounded text-xs lg:text-base font-black tracking-widest text-primary">
                                        (PEN {showHomeScore} - {showAwayScore})
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>

                    <div
                        className="flex-1 flex flex-row items-center justify-start gap-2 lg:flex-col lg:items-center lg:gap-4 cursor-pointer group/away min-w-0"
                        onClick={() => onTeamClick?.(match.away_team_id || match.away_team?.id || "", 'away')}
                        title={isTh ? "ดูรายชื่อตัวจริง - สำรอง" : "View Lineup"}
                    >
                        <div className="inline-flex items-center justify-center w-12 h-12 lg:w-24 lg:h-24 rounded-full relative group/logo shrink-0">
                            {match.away_team?.logo_url ? (
                                <Image src={match.away_team.logo_url} width={64} height={64} className="w-full h-full object-contain relative z-10 rounded-full" alt="" />
                            ) : (
                                <span className="text-2xl font-black text-foreground/20 relative z-10">{getInitials(match.away_team?.name || '')}</span>
                            )}
                        </div>
                        <div className="min-w-0 max-w-[80px] lg:max-w-none">
                            <h2 className="text-xs lg:text-3xl font-black tracking-tighter text-foreground truncate group-hover/away:text-primary transition-colors">
                                {formatTeamName(match.away_team?.name)}
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Possession Gauge Bar */}
                {showPossession && (
                    <div className="w-full max-w-xs sm:max-w-md lg:max-w-xl flex flex-col">
                        <div className="flex justify-between items-center text-xs lg:text-sm font-black tabular-nums">
                            <span className="text-primary">{possession.home}%</span>
                            <span className="text-[10px] lg:text-xs font-bold tracking-widest text-muted-foreground">
                                Possession / การครองบอล
                            </span>
                            <span className="text-muted-foreground">{possession.away}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden flex">
                            <div
                                className="h-full bg-primary rounded-l-full transition-all duration-500 ease-out"
                                style={{ width: `${possession.home}%` }}
                            />
                            <div
                                className="h-full bg-muted-foreground rounded-r-full transition-all duration-500 ease-out"
                                style={{ width: `${possession.away}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
