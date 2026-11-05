"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MatchScoreBoxProps } from "./types";

export function VolleyballScoreBox({
    match,
    events,
    isLive,
    isFinished,
    isEditMode,
    isLiveStatus,
    matchTime,
    formatTime,
    handleTimeUpdate,
    getScore,
}: MatchScoreBoxProps) {
    const homeSetsWon = getScore(match.home_score);
    const awaySetsWon = getScore(match.away_score);

    // Volleyball Set Scores Breakdown from Match Events & score_detail
    const pointTypes = ['point', 'ace', 'spike', 'block'];
    const setPointsMap = new Map<number, { home: number; away: number }>();

    // 1. Process from Match Events if available
    if (events && events.length > 0) {
        events.forEach(e => {
            const evtType = e.event_type || (e as any).type;
            const rawExtra = e.extra_info || (e as any).detail;
            let extra: Record<string, unknown> = {};
            if (typeof rawExtra === 'string') {
                try {
                    extra = JSON.parse(rawExtra);
                } catch (_) {}
            } else if (rawExtra && typeof rawExtra === 'object') {
                extra = rawExtra as Record<string, unknown>;
            }

            const extraSet = extra.set;
            const setNum = typeof extraSet === 'number' ? extraSet : (e.minute || 1);

            // Handle set_end / set_win event scores directly
            if (evtType === 'set_end' || evtType === 'set_win') {
                const sHome = typeof extra.home_score === 'number' ? extra.home_score : (typeof extra.home === 'number' ? extra.home : undefined);
                const sAway = typeof extra.away_score === 'number' ? extra.away_score : (typeof extra.away === 'number' ? extra.away : undefined);
                if (sHome !== undefined && sAway !== undefined) {
                    setPointsMap.set(setNum, { home: sHome, away: sAway });
                }
            }

            if (!evtType || !pointTypes.includes(evtType)) return;
            const current = setPointsMap.get(setNum) || { home: 0, away: 0 };

            const isHome = extra.team_side === 'home' ||
                (Boolean(e.team_id) && Boolean(match.home_team_id) && (e.team_id === match.home_team_id || e.team_id === match.home_team?.id)) ||
                ((extra.text as string) || "").includes("Point for home") ||
                (Boolean(match.home_team?.name) && ((extra.text as string) || "").includes(`Point for ${match.home_team?.name}`));

            if (isHome) current.home += 1;
            else current.away += 1;
            setPointsMap.set(setNum, current);
        });
    }

    // 2. Augment / Fallback from match.score_detail (sets / set_scores / set_history)
    let scoreDetail = match.score_detail as Record<string, unknown> | null | undefined;
    if (typeof scoreDetail === 'string') {
        try {
            scoreDetail = JSON.parse(scoreDetail);
        } catch (_) {}
    }
    const detailSets = (scoreDetail?.sets || scoreDetail?.set_scores || scoreDetail?.set_history) as Array<{ set?: number; home?: number; away?: number; home_score?: number; away_score?: number }> | undefined;
    if (detailSets && Array.isArray(detailSets) && detailSets.length > 0) {
        detailSets.forEach((item, idx) => {
            const setNum = typeof item.set === 'number' ? item.set : (idx + 1);
            const existing = setPointsMap.get(setNum);
            const hVal = Number(item.home ?? item.home_score) || 0;
            const aVal = Number(item.away ?? item.away_score) || 0;
            // If events did not produce points for this set, fill from score_detail
            if (!existing || (existing.home === 0 && existing.away === 0)) {
                setPointsMap.set(setNum, { home: hVal, away: aVal });
            }
        });
    }

    const setNumbers = Array.from(setPointsMap.keys()).sort((a, b) => a - b);
    const currentSetNumber = setNumbers.length > 0 ? setNumbers[setNumbers.length - 1] : 1;
    const currentSetPoints = setPointsMap.get(currentSetNumber) || { home: 0, away: 0 };
    const pastSetNumbers = setNumbers.filter(s => s < currentSetNumber);

    return (
        <div className="flex items-center justify-center shrink-0">
            <div
                className={cn(
                    "flex flex-col items-center justify-center transition-all duration-300",
                    isLive ? "text-primary-foreground scale-105" : isFinished ? "text-foreground" : "text-muted-foreground/40"
                )}
            >
                {isLiveStatus ? (
                    /* Live Mode: Home Sets Won on Left, Home/Away Points in Center, Away Sets Won on Right */
                    <div className="flex flex-col min-w-[5rem] items-center leading-none">
                        <div className="flex items-center gap-1 md:gap-1.5">
                            {/* Home Sets Won (Left Side) */}
                            <span className="text-[9px] md:text-xs font-bold tracking-wider text-foreground">
                                {homeSetsWon}
                            </span>

                            {/* Live Set Points (Home - Away) */}
                            <div className="flex items-center gap-1 md:gap-1.5">
                                <span className="text-base md:text-lg font-black text-foreground tracking-tighter">
                                    {currentSetPoints.home}
                                </span>
                                <span className="text-muted-foreground font-black text-[10px] md:text-xs">-</span>
                                <span className="text-base md:text-lg font-black text-foreground tracking-tighter">
                                    {currentSetPoints.away}
                                </span>
                            </div>

                            {/* Away Sets Won (Right Side) */}
                            <span className="text-[9px] md:text-xs font-bold tracking-wider text-foreground">
                                {awaySetsWon}
                            </span>
                        </div>

                        {/* Live Set Label & Past Set Scores History */}
                        <div className="flex items-center gap-1 flex-wrap justify-center text-[9px] font-bold text-muted-foreground/80 mt-0.5">
                            {pastSetNumbers.map((s) => {
                                const pts = setPointsMap.get(s)!;
                                return (
                                    <span key={s} className="px-1 py-0.5 rounded bg-muted/40 text-muted-foreground">
                                        {pts.home}-{pts.away}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                ) : (isFinished || match.status === 'completed' || homeSetsWon > 0 || awaySetsWon > 0) ? (
                    /* Finished / Scored Mode: Show Main Sets Score (e.g. 2-0) as Main Score, and All Set Scores History below */
                    <div className="flex flex-col min-w-[4rem] items-center leading-none">
                        <div className="flex items-center gap-1 md:gap-2">
                            <span className="text-base md:text-lg font-black text-foreground tracking-tighter">
                                {homeSetsWon}
                            </span>
                            <span className="text-muted-foreground font-black text-[9px] md:text-[10px] uppercase tracking-wider px-0.5">
                                -
                            </span>
                            <span className="text-base md:text-lg font-black text-foreground tracking-tighter">
                                {awaySetsWon}
                            </span>
                        </div>

                        {setNumbers.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap justify-center text-xs font-semibold text-muted-foreground mt-1">
                                {setNumbers.map((s) => {
                                    const pts = setPointsMap.get(s)!;
                                    return (
                                        <span key={s} className="text-[10px] tracking-tight text-muted-foreground/90 font-medium">
                                            ({pts.home}-{pts.away})
                                        </span>
                                    );
                                })}
                            </div>
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
