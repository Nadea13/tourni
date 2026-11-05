"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MatchScoreBoxProps } from "./types";

export function FootballScoreBox({
    match,
    events,
    isLive,
    isFinished,
    isEditMode,
    isLiveStatus,
    liveTime,
    matchTime,
    formatTime,
    formatSeconds,
    handleTimeUpdate,
    getScore,
    sport,
}: MatchScoreBoxProps) {
    const homeScore = getScore(match.home_score);
    const awayScore = getScore(match.away_score);

    const pEvents = (events || []).filter((e: any) => e.event_type === "penalty_shot" || e.type === "penalty_shot");
    const pHomeFromEvents = pEvents.length > 0 && match.home_team_id
        ? pEvents.filter((e: any) => String(e.team_id) === String(match.home_team_id) && (e.extra_info?.scored || e.detail?.scored)).length
        : undefined;
    const pAwayFromEvents = pEvents.length > 0 && match.away_team_id
        ? pEvents.filter((e: any) => String(e.team_id) === String(match.away_team_id) && (e.extra_info?.scored || e.detail?.scored)).length
        : undefined;

    const penaltyHome = match.penalty_home_score ??
        match.home_penalty_score ??
        match.score_detail?.penalty_home_score ??
        match.score_detail?.home_penalty_score ??
        pHomeFromEvents;
    const penaltyAway = match.penalty_away_score ??
        match.away_penalty_score ??
        match.score_detail?.penalty_away_score ??
        match.score_detail?.away_penalty_score ??
        pAwayFromEvents;

    const hasPenalty = (penaltyHome !== undefined && penaltyHome !== null) ||
        (penaltyAway !== undefined && penaltyAway !== null) ||
        pEvents.length > 0;

    const isFutsal = Boolean(
        sport === 'futsal' ||
        sport?.includes('futsal') ||
        sport?.includes('ฟุตซอล') ||
        (match as any).sport === 'futsal' ||
        (match as any).sport?.includes('futsal') ||
        (match as any).sport?.includes('ฟุตซอล') ||
        (match as any).sport_name?.toLowerCase().includes('futsal') ||
        (match as any).sport_name?.includes('ฟุตซอล') ||
        (match as any).tournaments?.sport === 'futsal' ||
        (match as any).tournaments?.sport?.includes('ฟุตซอล') ||
        (match as any).tournament?.sport === 'futsal' ||
        (match as any).tournament?.sport?.includes('ฟุตซอล') ||
        (match as any).category?.sport?.toLowerCase().includes('futsal') ||
        (match as any).category?.sport?.includes('ฟุตซอล')
    );

    const effectiveHomeId = match.home_team_id || match.home_team?.id || 'home';
    const effectiveAwayId = match.away_team_id || match.away_team?.id || 'away';

    let futsalFouls: { home: number; away: number } | null = null;
    if (isFutsal) {
        let hF = 0, aF = 0;
        if (events && events.length > 0) {
            const sorted = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            let lastSecondHalf = -1;
            sorted.forEach((e, i) => {
                const t = e.event_type || (e as any).type;
                if (t === 'second_half') lastSecondHalf = i;
            });
            const periodEvts = lastSecondHalf !== -1 ? sorted.slice(lastSecondHalf) : sorted;
            periodEvts.forEach(e => {
                const t = e.event_type || (e as any).type;
                if (t === 'foul') {
                    const extra = (e.extra_info as Record<string, unknown> | null) || (e.detail as Record<string, unknown> | null) || {};
                    const teamSide = extra.team_side as string | undefined;
                    const isHome = teamSide === 'home' || e.team_id === effectiveHomeId || (Boolean(match.home_team_id) && e.team_id === match.home_team_id);
                    const isAway = teamSide === 'away' || e.team_id === effectiveAwayId || (Boolean(match.away_team_id) && e.team_id === match.away_team_id);
                    if (isHome) hF++;
                    else if (isAway) aF++;
                }
            });
        }
        futsalFouls = { home: hF, away: aF };
    }


    const homeFoulStep = (futsalFouls?.home ?? 0) % 6;
    const awayFoulStep = (futsalFouls?.away ?? 0) % 6;

    return (
        <div className="flex items-center justify-center shrink-0">
            <div
                className={cn(
                    "flex flex-col items-center justify-center transition-all duration-300",
                    isLive ? "text-primary-foreground scale-110" : isFinished ? "text-foreground" : "text-muted-foreground/40"
                )}
            >
                {isLive || isFinished ? (
                    <div className={cn(
                        "flex flex-col items-center leading-none",
                        isFutsal ? "min-w-[5rem]" : "w-[4rem]"
                    )}>
                        <div className="flex items-center gap-1 md:gap-1.5">
                            {/* Home Fouls (Futsal: Left side, like Volleyball sets) */}
                            {isFutsal && futsalFouls && (
                                <span
                                    title={`Home Fouls: ${homeFoulStep}`}
                                    className={cn(
                                        "text-[9px] md:text-xs font-bold tracking-wider transition-colors",
                                        homeFoulStep >= 5 ? "text-destructive font-black animate-pulse" : "text-foreground"
                                    )}
                                >
                                    {homeFoulStep}
                                </span>
                            )}

                            {/* Main Goals (Home - Away) */}
                            <div className="flex items-center gap-1 md:gap-1.5">
                                <span className="text-base md:text-lg font-black text-foreground tracking-tighter">
                                    {homeScore}
                                </span>
                                <span className="text-muted-foreground font-black text-xs md:text-sm">-</span>
                                <span className="text-base md:text-lg font-black text-foreground tracking-tighter">
                                    {awayScore}
                                </span>
                            </div>

                            {/* Away Fouls (Futsal: Right side, like Volleyball sets) */}
                            {isFutsal && futsalFouls && (
                                <span
                                    title={`Away Fouls: ${awayFoulStep}`}
                                    className={cn(
                                        "text-[9px] md:text-xs font-bold tracking-wider transition-colors",
                                        awayFoulStep >= 5 ? "text-destructive font-black animate-pulse" : "text-foreground"
                                    )}
                                >
                                    {awayFoulStep}
                                </span>
                            )}
                        </div>

                        {hasPenalty && (
                            <span className="text-[10px] font-bold text-primary mt-0.5">
                                ({penaltyHome ?? 0}) - ({penaltyAway ?? 0})
                            </span>
                        )}

                        {isLiveStatus && (
                            <span className="text-[9px] font-bold text-primary tabular-nums mt-0.5">
                                {formatSeconds(liveTime)}
                            </span>
                        )}
                    </div>
                ) : isEditMode ? (
                    <div className="flex flex-col items-center justify-center transition-transform duration-300">
                        <Input
                            type="time"
                            value={formatTime(matchTime) || ""}
                            className="bg-card text-foreground h-8 text-xs w-24"
                            onChange={(e) => handleTimeUpdate(e.target.value)}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center min-w-[3.5rem] transition-transform duration-300">
                        <span className="text-xs md:text-sm font-bold text-foreground tracking-tight leading-none hover:text-primary transition-colors">
                            {formatTime(match.match_time) || "--:--"}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
