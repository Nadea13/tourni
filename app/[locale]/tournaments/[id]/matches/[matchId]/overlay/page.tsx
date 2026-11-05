"use client";

import { useState, useEffect, useRef, Suspense, Children, cloneElement } from "react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { ApiClient } from "@/lib/api-client";
import { useMatchEvents } from "@/hooks/use-match-events";
import { useMatchTimer } from "@/hooks/use-match-timer";
import { Match, MatchEvent } from "@/types";
import { Trophy, Square } from "lucide-react";
import { cn } from "@/lib/utils";

const fontImports: Record<string, string> = {
    inter: "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800;900&display=swap');",
    orbitron: "@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');",
    montserrat: "@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800;900&display=swap');",
    "bebas-neue": "@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');",
    outfit: "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');"
};

const fontFamilies: Record<string, string> = {
    inter: "font-family: 'Inter', sans-serif;",
    orbitron: "font-family: 'Orbitron', sans-serif;",
    montserrat: "font-family: 'Montserrat', sans-serif;",
    "bebas-neue": "font-family: 'Bebas Neue', sans-serif;",
    outfit: "font-family: 'Outfit', sans-serif;"
};

interface CustomBlockConfig {
    active: boolean;
    x: number;
    y: number;
    w: number;
    h: number;
    fontSize: number;
    rTL: number;
    rTR: number;
    rBL: number;
    rBR: number;
    opacity: number;
    bg?: string;
    color?: string;
    shapeType?: string;
    text?: string;
    bindTo?: string;
    strokeWidth?: number;
    strokeColor?: string;
    strokePos?: "inside" | "center" | "outside";
    skewX?: number;
    skewY?: number;
    fontWeight?: string;
    fontStyle?: "normal" | "italic";
    textDecoration?: "none" | "underline" | "line-through";
}

interface OverlayNotification {
    id: string;
    type: "goal" | "yellow_card" | "red_card" | "substitution";
    player: string;
    minute: number;
    teamName: string;
    teamColor: "home" | "away";
    playerIn?: string;
    playerOut?: string;
}

function useDelayedValue<T>(value: T, delaySeconds: number): T {
    const [delayedValue, setDelayedValue] = useState<T>(value);
    const queueRef = useRef<{ val: T; time: number }[]>([]);
    const prevValueRef = useRef<T>(value);
    const hasInitializedRef = useRef(value !== null && value !== undefined);

    // Immediately apply first non-null/non-undefined value during render so page loads without blank states
    // We conditionally update state during render (officially supported by React to adjust state on prop changes)
    if (delaySeconds > 0 && (delayedValue === null || delayedValue === undefined) && value !== null && value !== undefined) {
        setDelayedValue(value);
    }

    // Push new values to queue
    useEffect(() => {
        if (delaySeconds <= 0) {
            return;
        }

        if (value === null || value === undefined) return;

        // If this is the first non-null/non-undefined value, mark it as initialized
        // and skip pushing to queue since we already applied it immediately during render.
        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            prevValueRef.current = value;
            return;
        }

        // Skip if this is the same value we just set as the previous value
        if (value === prevValueRef.current) {
            return;
        }

        prevValueRef.current = value;
        queueRef.current.push({ val: value, time: Date.now() + delaySeconds * 1000 });
    }, [value, delaySeconds]);

    // Process queue
    useEffect(() => {
        if (delaySeconds <= 0) return;

        const interval = setInterval(() => {
            const now = Date.now();
            let lastExpiredItem: { val: T; time: number } | null = null;
            
            queueRef.current = queueRef.current.filter((item) => {
                if (item.time <= now) {
                    lastExpiredItem = item;
                    return false;
                }
                return true;
            });

            if (lastExpiredItem) {
                setDelayedValue((lastExpiredItem as { val: T }).val);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [delaySeconds]);

    return delaySeconds <= 0 ? value : delayedValue;
}

const getInitials = (name: string) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

function BroadcastOverlayContent() {
    const params = useParams();
    const searchParams = useSearchParams();

    const id = params.id as string;
    const matchId = params.matchId as string;

    // Search Query Configuration
    const layout = searchParams.get("layout") || "top-bar"; // 'top-bar' | 'minimal-left' | 'minimal-right'
    const bgType = searchParams.get("bg") || "transparent"; // 'transparent' | 'chromakey'
    const size = searchParams.get("size") || "medium"; // 'small' | 'medium' | 'large'
    const showTimeline = searchParams.get("timeline") === "true"; // show mini ticker of recent goals/cards
    
    // Customization parameters
    const font = searchParams.get("font") || "inter";
    const scoreBg = searchParams.get("scoreBg") || "#ef4444";
    const teamNameMode = searchParams.get("teamNameMode") || "abbr";
    const showLogos = searchParams.get("showLogos") !== "false";
    const headerText = searchParams.get("headerText") || "";
    const _posX = searchParams.get("posX") || "center"; // left | center | right
    const posY = searchParams.get("posY") || "top"; // top | bottom
    const alertDuration = Number(searchParams.get("alertDuration")) || 6;
    const rounded = searchParams.get("rounded") || "md";

    const homeBarDir = searchParams.get("homeBarDir") || "none";
    const homeBarColor = searchParams.get("homeBarColor") || "#10b981";
    const awayBarDir = searchParams.get("awayBarDir") || "none";
    const awayBarColor = searchParams.get("awayBarColor") || "#3b82f6";
    const _blockGap = searchParams.get("blockGap") ? Number(searchParams.get("blockGap")) : 8;

    // Parse custom block configurations from URL if present
    // Format: id:x:y:w:h:fontSize:rTL:rTR:rBL:rBR:opacity:bg:color:shapeType:text:bindTo:strokeWidth:strokeColor:strokePos:skewX:skewY:fontWeight:fontStyle:textDecoration;
    const positionsParam = searchParams.get("positions");
    const customBlockConfigs: Record<string, CustomBlockConfig> = {};
    if (positionsParam) {
        const blockEntries = positionsParam.split(";");
        blockEntries.forEach(entry => {
            if (!entry) return;
            const parts = entry.split(":");
            if (parts.length >= 5) {
                const blockId = parts[0];
                customBlockConfigs[blockId] = {
                    active: true,
                    x: Number(parts[1]) || 0,
                    y: Number(parts[2]) || 0,
                    w: Number(parts[3]) || 0,
                    h: Number(parts[4]) || 0,
                    fontSize: Number(parts[5]) || 0,
                    rTL: parts[6] !== undefined ? Number(parts[6]) : 0,
                    rTR: parts[7] !== undefined ? Number(parts[7]) : 0,
                    rBL: parts[8] !== undefined ? Number(parts[8]) : 0,
                    rBR: parts[9] !== undefined ? Number(parts[9]) : 0,
                    opacity: parts[10] !== undefined ? Number(parts[10]) : 100,
                    bg: (() => {
                        if (!parts[11]) return undefined;
                        const decoded = decodeURIComponent(parts[11]);
                        if (decoded.startsWith("#") || decoded.includes("gradient") || decoded === "transparent") return decoded;
                        if (/^[0-9a-fA-F]{3,8}$/.test(decoded)) {
                            return `#${decoded}`;
                        }
                        return decoded;
                    })(),
                    color: parts[12] ? (parts[12].startsWith("#") ? parts[12] : `#${parts[12]}`) : "#ffffff",
                    shapeType: parts[13] || undefined,
                    text: parts[14] ? decodeURIComponent(parts[14]) : undefined,
                    bindTo: parts[15] || "none",
                    strokeWidth: parts[16] !== undefined ? Number(parts[16]) : 0,
                    strokeColor: parts[17] ? (parts[17].startsWith("#") ? parts[17] : `#${parts[17]}`) : "#ffffff",
                    strokePos: (parts[18] as "inside" | "center" | "outside") || "inside",
                    skewX: parts[19] !== undefined ? Number(parts[19]) : 0,
                    skewY: parts[20] !== undefined ? Number(parts[20]) : 0,
                    fontWeight: parts[21] || "400",
                    fontStyle: (parts[22] as "normal" | "italic") || "normal",
                    textDecoration: (parts[23] as "none" | "underline" | "line-through") || "none",
                };
            }
        });
    }

    const delay = Number(searchParams.get("delay")) || 0;
    const isBlank = searchParams.get("blank") === "true";

    // Match State
    const [realMatch, setRealMatch] = useState<Match | null>(null);
    const [tournamentName, setTournamentName] = useState<string>("");
    const [tournamentLogo, setTournamentLogo] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch initial match
    useEffect(() => {
        const fetchTournament = async () => {
            try {
                const data = await ApiClient.fetch<{ tournament?: { name?: string; logo_img?: string }; name?: string; logo_img?: string }>(`/tournaments/${id}`);
                const tName = data.tournament?.name || data.name || "";
                const tLogo = data.tournament?.logo_img || data.logo_img || null;
                if (tName) setTournamentName(tName);
                if (tLogo) setTournamentLogo(tLogo);
            } catch {
                // Ignore error
            }
        };
        fetchTournament();

        const fetchMatch = async () => {
            try {
                const data = await ApiClient.fetch<Match>(`/matches/${matchId}`);
                if (data) {
                    const homeTeam = data.home_team as unknown as Record<string, unknown>;
                    const awayTeam = data.away_team as unknown as Record<string, unknown>;

                    const mappedMatch = {
                        ...data,
                        home_team: data.home_team ? {
                            ...data.home_team,
                            logo_url: (homeTeam?.logo_url as string) || (homeTeam?.logo_img as string) || null
                        } : null,
                        away_team: data.away_team ? {
                            ...data.away_team,
                            logo_url: (awayTeam?.logo_url as string) || (awayTeam?.logo_img as string) || null
                        } : null
                    };
                    setRealMatch(mappedMatch as unknown as Match);
                }
            } catch {
                // Ignore error
            } finally {
                setLoading(false);
            }
        };

        fetchMatch();

        // Polling fallback to guarantee sync
        const pollInterval = setInterval(() => {
            fetchMatch();
        }, 3000);

        return () => {
            clearInterval(pollInterval);
        };
    }, [matchId, id]);

    // Match Hooks (using existing application hooks for real-time consistency)
    const { events: realEvents } = useMatchEvents(matchId, id, undefined, true);

    const match = useDelayedValue(realMatch, delay) || realMatch;
    const events = useDelayedValue(realEvents || [], delay);

    const isFutsal = Boolean(
        (match as any)?.sport === 'futsal' ||
        (match as any)?.sport?.includes('futsal') ||
        (match as any)?.sport?.includes('ฟุตซอล') ||
        (match as any)?.sport_name?.toLowerCase().includes('futsal') ||
        (match as any)?.sport_name?.includes('ฟุตซอล')
    );
    const { time } = useMatchTimer(match || ({} as Match), id, events, delay, isFutsal);

    // Live Notification Ticker System
    const [activeNotification, setActiveNotification] = useState<OverlayNotification | null>(null);
    const eventsCountRef = useRef<number>(0);
    const initialEventsLoaded = useRef<boolean>(false);

    useEffect(() => {
        if (!match) return;

        // Populate initially to prevent old events firing animations on page load
        if (!initialEventsLoaded.current) {
            if (events && events.length > 0) {
                eventsCountRef.current = events.length;
                initialEventsLoaded.current = true;
            }
            return;
        }

        if (events && events.length > eventsCountRef.current) {
            // New event added (events array is sorted descending by created_at)
            const newEvent = events[0];
            eventsCountRef.current = events.length;

            if (
                newEvent &&
                (newEvent.event_type === "goal" ||
                    newEvent.event_type === "yellow_card" ||
                    newEvent.event_type === "red_card" ||
                    newEvent.event_type === "substitution")
            ) {
                const teamColor = newEvent.team_id === match.home_team_id ? "home" : "away";
                const teamName =
                    newEvent.team_id === match.home_team_id
                        ? match.home_team?.name || "Home"
                        : match.away_team?.name || "Away";

                const notifyTimer = setTimeout(() => {
                    const extra = newEvent.extra_info as Record<string, unknown> | null;
                    setActiveNotification({
                        id: newEvent.id,
                        type: newEvent.event_type as "goal" | "yellow_card" | "red_card" | "substitution",
                        player: newEvent.player_name || "Unknown",
                        minute: newEvent.minute,
                        teamName: teamName,
                        teamColor: teamColor as "home" | "away",
                        playerIn: String(extra?.in_player_name || "Unknown"),
                        playerOut: String(extra?.out_player_name || "Unknown"),
                    });
                }, 0);

                // Clear after alertDuration seconds
                const clearTimer = setTimeout(() => {
                    setActiveNotification(null);
                }, alertDuration * 1000);

                return () => {
                    clearTimeout(notifyTimer);
                    clearTimeout(clearTimer);
                };
            }
        } else if (events && events.length < eventsCountRef.current) {
            // Event deleted, just update count without showing banner
            eventsCountRef.current = events.length;
        }
    }, [events, match, alertDuration]);

    if (loading || !match) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white/50 text-xs font-mono select-none">
                Connecting overlay channel...
            </div>
        );
    }

    // Time calculations
    const displayMinutes = Math.floor(time / 60);
    const displaySeconds = time % 60;
    const timeString = `${displayMinutes}:${String(displaySeconds).padStart(2, "0")}`;

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

    const isHalfTime = match.status === 'live' && match.timer_status === 'paused' && events.length > 0 && (() => {
        const lastTimerEvent = events.find(e => 
            e.event_type === 'kick_off' || 
            e.event_type === 'match_resumed' || 
            e.event_type === 'match_paused' || 
            e.event_type === 'half_time' || 
            e.event_type === 'full_time'
        );
        return lastTimerEvent?.event_type === 'half_time';
    })();

    // Get goals
    const isHomeTeam = (tid: string) => tid === match.home_team_id || tid === match.home_team?.id;
    const isAwayTeam = (tid: string) => tid === match.away_team_id || tid === match.away_team?.id;

    const getScoreValue = (score: unknown): number => {
        if (!score) return 0;
        if (typeof score === 'object' && score !== null && 'total' in score) {
            return Number((score as Record<string, unknown>).total) || 0;
        }
        return Number(score) || 0;
    };

    const dbHomeScore = getScoreValue(match.home_score);
    const dbAwayScore = getScoreValue(match.away_score);

    const homeScore = match.status === 'finished' ? dbHomeScore : Math.max(dbHomeScore, events.filter((e: MatchEvent) => e.team_id && isHomeTeam(e.team_id) && e.event_type === 'goal').length);
    const awayScore = match.status === 'finished' ? dbAwayScore : Math.max(dbAwayScore, events.filter((e: MatchEvent) => e.team_id && isAwayTeam(e.team_id) && e.event_type === 'goal').length);

    // Volleyball Score & Sets Computation
    const vballPointTypes = ['point', 'ace', 'spike', 'block'];
    const vballEvents = events.filter((e: MatchEvent) => vballPointTypes.includes(e.event_type));

    const vballSetPointsMap = new Map<number, { home: number; away: number }>();
    if (vballEvents.length > 0) {
        const sorted = [...vballEvents].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        sorted.forEach((e) => {
            const setNum = (e.extra_info as { set?: number } | null)?.set || 1;
            const current = vballSetPointsMap.get(setNum) || { home: 0, away: 0 };
            const isHome = e.team_id ? isHomeTeam(e.team_id) : (e.extra_info as { team_side?: string } | null)?.team_side === 'home';
            if (isHome) current.home += 1;
            else current.away += 1;
            vballSetPointsMap.set(setNum, current);
        });
    }

    const vballAllSetNumbers = Array.from(vballSetPointsMap.keys()).sort((a, b) => a - b);
    const vballMaxLoggedSet = vballAllSetNumbers.length > 0 ? Math.max(...vballAllSetNumbers) : 1;

    let vballDerivedHomeSets = 0;
    let vballDerivedAwaySets = 0;
    for (let s = 1; s <= vballMaxLoggedSet; s++) {
        const pts = vballSetPointsMap.get(s) || { home: 0, away: 0 };
        const targetPts = (s === 3 || s === 5) ? 15 : 25;
        const isFinishedScore = (pts.home >= targetPts || pts.away >= targetPts) && Math.abs(pts.home - pts.away) >= 2;
        if (s < vballMaxLoggedSet || isFinishedScore) {
            if (pts.home > pts.away) vballDerivedHomeSets += 1;
            else if (pts.away > pts.home) vballDerivedAwaySets += 1;
        }
    }

    const vballCurrentSetNumber = vballEvents.length > 0 ? (vballDerivedHomeSets + vballDerivedAwaySets + 1) : 1;
    const vballCurrentSetPts = vballSetPointsMap.get(vballCurrentSetNumber) || { home: 0, away: 0 };

    const homeVolleyballPoints = vballEvents.length > 0 ? vballCurrentSetPts.home : dbHomeScore;
    const awayVolleyballPoints = vballEvents.length > 0 ? vballCurrentSetPts.away : dbAwayScore;

    const homeSetsWon = vballEvents.length > 0 ? vballDerivedHomeSets : dbHomeScore;
    const awaySetsWon = vballEvents.length > 0 ? vballDerivedAwaySets : dbAwayScore;

    const sortedVballEvents = [...vballEvents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latestVballEvent = sortedVballEvents.length > 0 ? sortedVballEvents[0] : null;
    const isHomePointWon = latestVballEvent ? (latestVballEvent.team_id ? isHomeTeam(latestVballEvent.team_id) : (latestVballEvent.extra_info as { team_side?: string } | null)?.team_side === 'home') : false;
    const isAwayPointWon = latestVballEvent ? !isHomePointWon : false;

    const homeRedCards = events.filter((e: MatchEvent) => e.event_type === "red_card" && e.team_id && isHomeTeam(e.team_id)).length;
    const awayRedCards = events.filter((e: MatchEvent) => e.event_type === "red_card" && e.team_id && isAwayTeam(e.team_id)).length;

    const renderRedCards = (count: number) => {
        if (count <= 0) return null;
        return (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 flex gap-0.5 z-10 pointer-events-none">
                {Array.from({ length: count }).map((_, idx) => (
                    <div 
                        key={idx} 
                        className="w-2 h-1"
                        style={{ backgroundColor: "#ff4d4d" }}
                        title="Red Card"
                    />
                ))}
            </div>
        );
    };

    // Size presets
    const sizeClasses = {
        small: "scale-75 origin-center",
        medium: "scale-100",
        large: "scale-125 origin-center",
    };

    // Filter goals for mini timeline
    const goalEvents = events.filter((e) => e.event_type === "goal");

    const displayHeaderText = headerText || tournamentName;

    const backgroundColor = bgType === "chromakey"
        ? "#00ff00"
        : bgType === "transparent"
            ? "transparent"
            : bgType;

    return (
        <div
            className="min-h-screen w-full select-none overflow-hidden relative transition-colors duration-300 custom-font-style"
            style={{ backgroundColor }}
        >
            <style dangerouslySetInnerHTML={{ __html: `
                ${fontImports[font] || fontImports.inter}
                .custom-font-style {
                    ${fontFamilies[font] || fontFamilies.inter}
                }
            ` }} />

            {/* Scoreboard positioning wrapper */}
            {(!isBlank || searchParams.get("blocks") !== null || searchParams.get("positions") !== null) && (
                <div className="fixed inset-0 p-8 pointer-events-none flex flex-col items-center justify-center gap-3">
                    {/* Scoreboard Content Group */}
                    <div className={cn("pointer-events-auto flex flex-col items-center", sizeClasses[size as keyof typeof sizeClasses])}>
                        
                        {searchParams.get("blocks") !== null ? (
                            (Object.keys(customBlockConfigs).length > 0 || searchParams.get("positions") !== null) ? (
                                /* Canvas Layout Builder (Absolute coordinates positioning) */
                                <div className="relative w-[400px] h-[180px] bg-transparent">
                                    {(searchParams.get("blocks") || "").split(",").filter(Boolean).map((blockId) => {
                                        const cfg = customBlockConfigs[blockId] || { active: true, x: 0, y: 0, w: 80, h: 40, fontSize: 14, rTL: 8, rTR: 8, rBL: 8, rBR: 8, opacity: 100, bg: blockId.startsWith("score") ? scoreBg : "#000000", color: "#ffffff" };
                                        if (cfg.active === false) return null;
                                        if (cfg.bindTo === "point-won-home" && !isHomePointWon) return null;
                                        if (cfg.bindTo === "point-won-away" && !isAwayPointWon) return null;
                                        const absoluteStyle: React.CSSProperties = {
                                            position: "absolute",
                                            left: "50%",
                                            top: "50%",
                                            transform: `translate(calc(-50% + ${cfg.x}px), calc(-50% + ${cfg.y}px))`,
                                            width: `${cfg.w}px`,
                                            height: `${cfg.h}px`,
                                            fontSize: `${cfg.fontSize}px`,
                                            borderTopLeftRadius: `${cfg.rTL}px`,
                                            borderTopRightRadius: `${cfg.rTR}px`,
                                            borderBottomLeftRadius: `${cfg.rBL}px`,
                                            borderBottomRightRadius: `${cfg.rBR}px`,
                                            color: cfg.color ?? "#ffffff",
                                            background: "transparent",
                                            backgroundColor: "transparent",
                                        };

                                        const blockElement = (() => {
                                            // 1. Home Name
                                            if (blockId === "name-home") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    style={absoluteStyle}
                                                    className="font-extrabold tracking-tight text-white flex items-center justify-center select-none bg-black relative"
                                                >
                                                    <span>{teamNameMode === "abbr" ? getInitials(match.home_team?.name || '') : match.home_team?.name}</span>
                                                    {renderRedCards(homeRedCards)}
                                                    {homeBarDir !== "none" && (
                                                        <div
                                                            style={{
                                                                position: "absolute",
                                                                [homeBarColor.includes("gradient") ? "background" : "backgroundColor"]: homeBarColor,
                                                                ...(homeBarDir === "top" && { top: 0, left: 0, right: 0, height: "4px", borderTopLeftRadius: `${cfg.rTL}px`, borderTopRightRadius: `${cfg.rTR}px` }),
                                                                ...(homeBarDir === "right" && { top: 0, bottom: 0, right: 0, width: "4px", borderTopRightRadius: `${cfg.rTR}px`, borderBottomRightRadius: `${cfg.rBR}px` }),
                                                                ...(homeBarDir === "bottom" && { bottom: 0, left: 0, right: 0, height: "4px", borderBottomLeftRadius: `${cfg.rBL}px`, borderBottomRightRadius: `${cfg.rBR}px` }),
                                                                ...(homeBarDir === "left" && { top: 0, bottom: 0, left: 0, width: "4px", borderTopLeftRadius: `${cfg.rTL}px`, borderBottomLeftRadius: `${cfg.rBL}px` }),
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 2. Home Logo
                                        if (blockId === "logo-home") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    style={absoluteStyle}
                                                    className="p-1 shrink-0 flex items-center justify-center select-none bg-black font-black text-[10px] tracking-tighter"
                                                >
                                                    {match.home_team?.logo_url ? (
                                                        <div className="relative w-full h-full">
                                                            <Image src={match.home_team.logo_url} alt="" fill className="object-contain rounded-sm" unoptimized />
                                                        </div>
                                                    ) : (
                                                        <span>{match.home_team?.name?.substring(0, 3)}</span>
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 3. Score
                                        if (blockId === "score") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    style={absoluteStyle}
                                                    className="flex items-center text-white font-black justify-center tracking-tighter shadow-inner"
                                                >
                                                    <span>{homeScore}</span>
                                                    <span className="mx-2 text-white/50 text-base font-normal">-</span>
                                                    <span>{awayScore}</span>
                                                </div>
                                            );
                                        }
                                        // 3a. Home Score
                                        if (blockId === "score-home") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    style={absoluteStyle}
                                                    className="flex items-center text-white font-black justify-center tracking-tighter shadow-inner"
                                                >
                                                    <span>{homeScore}</span>
                                                </div>
                                            );
                                        }
                                        // 3b. Away Score
                                        if (blockId === "score-away") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    style={absoluteStyle}
                                                    className="flex items-center text-white font-black justify-center tracking-tighter shadow-inner"
                                                >
                                                    <span>{awayScore}</span>
                                                </div>
                                            );
                                        }
                                        // 4. Away Name
                                        if (blockId === "name-away") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    style={absoluteStyle}
                                                    className="font-extrabold tracking-tight text-white flex items-center justify-center select-none bg-black relative"
                                                >
                                                    <span>{teamNameMode === "abbr" ? getInitials(match.away_team?.name || '') : match.away_team?.name}</span>
                                                    {renderRedCards(awayRedCards)}
                                                    {awayBarDir !== "none" && (
                                                        <div
                                                            style={{
                                                                position: "absolute",
                                                                [awayBarColor.includes("gradient") ? "background" : "backgroundColor"]: awayBarColor,
                                                                ...(awayBarDir === "top" && { top: 0, left: 0, right: 0, height: "4px", borderTopLeftRadius: `${cfg.rTL}px`, borderTopRightRadius: `${cfg.rTR}px` }),
                                                                ...(awayBarDir === "right" && { top: 0, bottom: 0, right: 0, width: "4px", borderTopRightRadius: `${cfg.rTR}px`, borderBottomRightRadius: `${cfg.rBR}px` }),
                                                                ...(awayBarDir === "bottom" && { bottom: 0, left: 0, right: 0, height: "4px", borderBottomLeftRadius: `${cfg.rBL}px`, borderBottomRightRadius: `${cfg.rBR}px` }),
                                                                ...(awayBarDir === "left" && { top: 0, bottom: 0, left: 0, width: "4px", borderTopLeftRadius: `${cfg.rTL}px`, borderBottomLeftRadius: `${cfg.rBL}px` }),
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 5. Away Logo
                                        if (blockId === "logo-away") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    style={absoluteStyle}
                                                    className="p-1 shrink-0 flex items-center justify-center select-none bg-black font-black text-[10px] tracking-tighter"
                                                >
                                                    {match.away_team?.logo_url ? (
                                                        <div className="relative w-full h-full">
                                                            <Image src={match.away_team.logo_url} alt="" fill className="object-contain rounded-sm" unoptimized />
                                                        </div>
                                                    ) : (
                                                        <span>{match.away_team?.name?.substring(0, 3)}</span>
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 6. Timer
                                        if (blockId === "timer") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    style={absoluteStyle}
                                                    className="flex items-center justify-center text-white font-mono font-bold select-none bg-black"
                                                >
                                                    {match.status === "finished" ? (
                                                        <span className="font-extrabold tracking-widest text-xs">FT</span>
                                                    ) : isHalfTime ? (
                                                        <span className="font-extrabold tracking-widest text-xs">HT</span>
                                                    ) : match.status === "live" ? (
                                                        <span className={cn("font-bold", match.timer_status === "paused" && "")}>
                                                            {timeString}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs font-extrabold tracking-wider">PRE</span>
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 7a. Tournament Logo
                                        if (blockId === "logo-tournament") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    style={absoluteStyle}
                                                    className="p-1 shrink-0 flex items-center justify-center select-none bg-black font-black text-[10px] tracking-tighter"
                                                >
                                                    {tournamentLogo ? (
                                                        <div className="relative w-full h-full">
                                                            <Image src={tournamentLogo} alt="" fill className="object-contain rounded-sm" unoptimized />
                                                        </div>
                                                    ) : (
                                                        <span className="text-[9px] opacity-40">Logo</span>
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 7. Header/Watermark Text
                                        if (blockId === "header-text" && displayHeaderText) {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    style={absoluteStyle}
                                                    className="text-center font-black tracking-widest flex items-center justify-center select-none bg-black"
                                                >
                                                    {displayHeaderText}
                                                </div>
                                            );
                                        }
                                        // 8. Substitution Block
                                        if (blockId === "substitution") {
                                            const isSubActive = activeNotification?.type === "substitution";
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    style={{
                                                        ...absoluteStyle,
                                                        transition: "all 0.5s ease-in-out",
                                                        opacity: isSubActive ? 1 : 0,
                                                        transform: `${absoluteStyle.transform || ""} ${isSubActive ? "scale(1)" : "scale(0.9)"}`,
                                                    }}
                                                    className="p-2 flex flex-col justify-center select-none bg-black border border-white/10 text-white font-bold leading-tight"
                                                >
                                                    {isSubActive && (
                                                        <div className="flex flex-col text-[10px] w-full text-center">
                                                            <div className="text-emerald-400 font-extrabold truncate">
                                                                ▲ {activeNotification.playerIn}
                                                            </div>
                                                            <div className="text-red-500 font-extrabold truncate">
                                                                ▼ {activeNotification.playerOut}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 8b. Added Time Block
                                        if (blockId === "add-time") {
                                            if (!addedTime) return null;
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    style={absoluteStyle}
                                                    className="flex items-center justify-center font-mono font-bold select-none bg-black"
                                                >
                                                    +{addedTime}
                                                </div>
                                            );
                                        }
                                        // 9. Alerts Block
                                        if (blockId === "alerts") {
                                            const isAlertActive = !!activeNotification;
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    style={{
                                                        ...absoluteStyle,
                                                        transition: "all 0.5s ease-in-out",
                                                        opacity: isAlertActive ? 1 : 0,
                                                        transform: `${absoluteStyle.transform || ""} ${isAlertActive ? "scale(1)" : "scale(0.9)"}`,
                                                    }}
                                                    className="flex items-center justify-center select-none bg-transparent"
                                                >
                                                    {isAlertActive && (
                                                        <div className="flex items-center gap-4 bg-black/95 border border-white/15 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] px-6 py-3 w-full h-full text-white text-xs font-bold overflow-hidden">
                                                            {activeNotification.type === "goal" && (
                                                                <>
                                                                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-emerald-500/35 animate-bounce shrink-0">
                                                                        <Trophy className="w-4 h-4 text-black fill-black" />
                                                                    </div>
                                                                    <div className="flex flex-col truncate text-left">
                                                                        <span className="text-emerald-400 font-black text-sm tracking-tighter leading-none">GOAL!</span>
                                                                        <span className="text-white font-extrabold mt-0.5 leading-none truncate">{activeNotification.player}</span>
                                                                        <span className="text-white/50 font-bold text-[10px] mt-0.5">{activeNotification.teamName} • {activeNotification.minute}&apos;</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {(activeNotification.type === "yellow_card" || activeNotification.type === "red_card") && (
                                                                <>
                                                                    <div className={cn("w-6 h-8 rounded flex items-center justify-center transform rotate-6 shrink-0", activeNotification.type === "yellow_card" ? "bg-yellow-400" : "bg-red-600")}>
                                                                        <Square className={cn("w-3 h-4", activeNotification.type === "yellow_card" ? "text-black fill-black" : "text-white fill-white")} />
                                                                    </div>
                                                                    <div className="flex flex-col truncate text-left">
                                                                        <span className={cn("font-black text-sm tracking-tighter leading-none", activeNotification.type === "yellow_card" ? "text-yellow-400" : "text-red-500")}>
                                                                            {activeNotification.type === "yellow_card" ? "YELLOW CARD" : "RED CARD"}
                                                                        </span>
                                                                        <span className="text-white font-extrabold mt-0.5 leading-none truncate">{activeNotification.player}</span>
                                                                        <span className="text-white/50 font-bold text-[10px] mt-0.5">{activeNotification.teamName} • {activeNotification.minute}&apos;</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 9b. Goal Timeline (Home)
                                        if (blockId === "timeline-home") {
                                            const homeGoalEvents = goalEvents.filter((e) => e.team_id && isHomeTeam(e.team_id));
                                            if (homeGoalEvents.length === 0) return null;
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    style={absoluteStyle}
                                                    className="flex flex-col gap-1 overflow-hidden p-1 justify-center"
                                                >
                                                    {homeGoalEvents.slice(0, 3).map((e) => (
                                                        <div key={e.id} className="flex items-center gap-1.5 px-2 text-[9px] font-bold truncate">
                                                            <span className="truncate">{e.player_name} ({e.minute}&apos;)</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        // 9c. Goal Timeline (Away)
                                        if (blockId === "timeline-away") {
                                            const awayGoalEvents = goalEvents.filter((e) => e.team_id && isAwayTeam(e.team_id));
                                            if (awayGoalEvents.length === 0) return null;
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    style={absoluteStyle}
                                                    className="flex flex-col gap-1 overflow-hidden p-1 justify-center"
                                                >
                                                    {awayGoalEvents.slice(0, 3).map((e) => (
                                                        <div key={e.id} className="flex items-center gap-1.5 px-2 text-[9px] font-bold truncate">
                                                            <span className="truncate">{e.player_name} ({e.minute}&apos;)</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        // 10. Custom Shapes, Text & Data Bound Blocks
                                        if (blockId.startsWith("shape-") || cfg.shapeType) {
                                            if (cfg.bindTo === "point-won-home" && !isHomePointWon) return null;
                                            if (cfg.bindTo === "point-won-away" && !isAwayPointWon) return null;

                                            const isCircle = cfg.shapeType === "circle";
                                            const isPolygon = cfg.shapeType === "polygon";
                                            const isStar = cfg.shapeType === "star";
                                            const getBoundText = () => {
                                                if (cfg.bindTo && cfg.bindTo !== "none") {
                                                    switch (cfg.bindTo) {
                                                        case "name-home": return teamNameMode === "abbr" ? getInitials(match.home_team?.name || '') : match.home_team?.name || 'HOME';
                                                        case "name-away": return teamNameMode === "abbr" ? getInitials(match.away_team?.name || '') : match.away_team?.name || 'AWAY';
                                                        case "score-home": return vballEvents.length > 0 ? String(homeVolleyballPoints) : String(homeScore);
                                                        case "score-away": return vballEvents.length > 0 ? String(awayVolleyballPoints) : String(awayScore);
                                                        case "set-home": return String(homeSetsWon);
                                                        case "set-away": return String(awaySetsWon);
                                                        case "point-won-home": return isHomePointWon ? (cfg.text || "🏐") : "";
                                                        case "point-won-away": return isAwayPointWon ? (cfg.text || "🏐") : "";
                                                        case "header-text": return displayHeaderText || 'TOURNI';
                                                        case "timer": return timeString;
                                                        case "add-time": return addedTime ? `+${addedTime}` : '+0';
                                                        case "home-scorer": {
                                                            const homeGoalEvents = goalEvents.filter((e) => e.team_id && isHomeTeam(e.team_id));
                                                            if (homeGoalEvents.length === 0) return '';
                                                            const grouped: Record<string, number[]> = {};
                                                            homeGoalEvents.forEach((e) => {
                                                                const name = e.player_name || 'Player';
                                                                if (!grouped[name]) grouped[name] = [];
                                                                grouped[name].push(e.minute);
                                                            });
                                                            const entries = Object.entries(grouped).map(([name, minutes]) => `${name} (${minutes.join("', ")}')`);
                                                            if (entries.length > 1) {
                                                                return (
                                                                    <span className="flex flex-col text-center leading-tight">
                                                                        {entries.map((item, idx) => (
                                                                            <span key={idx} className="truncate">{item}</span>
                                                                        ))}
                                                                    </span>
                                                                );
                                                            }
                                                            return entries[0] || '';
                                                        }
                                                        case "away-scorer": {
                                                            const awayGoalEvents = goalEvents.filter((e) => e.team_id && isAwayTeam(e.team_id));
                                                            if (awayGoalEvents.length === 0) return '';
                                                            const grouped: Record<string, number[]> = {};
                                                            awayGoalEvents.forEach((e) => {
                                                                const name = e.player_name || 'Player';
                                                                if (!grouped[name]) grouped[name] = [];
                                                                grouped[name].push(e.minute);
                                                            });
                                                            const entries = Object.entries(grouped).map(([name, minutes]) => `${name} (${minutes.join("', ")}')`);
                                                            if (entries.length > 1) {
                                                                return (
                                                                    <span className="flex flex-col text-center leading-tight">
                                                                        {entries.map((item, idx) => (
                                                                            <span key={idx} className="truncate">{item}</span>
                                                                        ))}
                                                                    </span>
                                                                );
                                                            }
                                                            return entries[0] || '';
                                                        }
                                                        default: break;
                                                    }
                                                }
                                                return cfg.text || '';
                                            };

                                            const isLogoBinding = cfg.bindTo === "logo-home" || cfg.bindTo === "logo-away" || cfg.bindTo === "logo-tournament";
                                            const logoUrl = cfg.bindTo === "logo-home" ? match.home_team?.logo_url : cfg.bindTo === "logo-away" ? match.away_team?.logo_url : tournamentLogo;

                                            const clipPathStyle = isPolygon
                                                ? "polygon(50% 0%, 100% 100%, 0% 100%)"
                                                : isStar
                                                    ? "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)"
                                                    : undefined;

                                            const isScoreBarBinding = cfg.bindTo === "score-bar-home" || cfg.bindTo === "score-bar-away";
                                            const renderScoreBar = (isHomeBar: boolean) => {
                                                const vballCurrentSetEvents = vballEvents.filter((e: MatchEvent) => {
                                                    const setNum = (e.extra_info as { set?: number } | null)?.set || 1;
                                                    return setNum === vballCurrentSetNumber;
                                                });

                                                const sortedCurrentSetEvents = [...vballCurrentSetEvents].sort(
                                                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                                                );

                                                const slotCount = Math.max(5, sortedCurrentSetEvents.length);
                                                const slots = [];

                                                for (let i = 0; i < slotCount; i++) {
                                                    const evt = sortedCurrentSetEvents[i];
                                                    if (!evt) {
                                                        slots.push({ active: false, empty: true });
                                                    } else {
                                                        const isHomeEvt = evt.team_id ? isHomeTeam(evt.team_id) : (evt.extra_info as { team_side?: string } | null)?.team_side === 'home';
                                                        const isActive = isHomeBar ? isHomeEvt : !isHomeEvt;
                                                        slots.push({ active: isActive, empty: false });
                                                    }
                                                }

                                                return (
                                                    <div className="w-full h-full flex items-center justify-between gap-0.5 px-1 overflow-hidden">
                                                        {slots.map((s, idx) => (
                                                            <div key={idx} className="flex-1 h-full min-w-0 flex items-center justify-center text-xs">
                                                                <span className={cn("transition-all flex items-center justify-center", s.active ? "text-amber-400 scale-110 drop-shadow" : "text-white/30")}>
                                                                    {s.active ? "🏐" : "○"}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            };

                                            const strokePos = cfg.strokePos || "inside";
                                            const strokeWidth = cfg.strokeWidth ?? 0;
                                            const strokeInset = strokeWidth > 0
                                                ? (strokePos === "outside" ? `-${strokeWidth}px` : strokePos === "center" ? `-${strokeWidth / 2}px` : "0px")
                                                : "0px";

                                            return (
                                                <div
                                                    key={blockId}
                                                    style={{
                                                        ...absoluteStyle,
                                                        fontWeight: cfg.fontWeight || "bold",
                                                        fontStyle: (cfg.fontStyle as "normal" | "italic") || "normal",
                                                        textDecoration: cfg.textDecoration || "none",
                                                    }}
                                                    className="flex items-center justify-center font-black tracking-tight select-none relative overflow-hidden"
                                                >
                                                    <div
                                                        style={{
                                                            position: "absolute",
                                                            inset: strokeInset,
                                                            transform: `skewX(${cfg.skewX || 0}deg) skewY(${cfg.skewY || 0}deg)`,
                                                            zIndex: -1,
                                                            borderRadius: isCircle ? "50%" : undefined,
                                                            borderTopLeftRadius: isCircle ? "50%" : `${cfg.rTL}px`,
                                                            borderTopRightRadius: isCircle ? "50%" : `${cfg.rTR}px`,
                                                            borderBottomLeftRadius: isCircle ? "50%" : `${cfg.rBL}px`,
                                                            borderBottomRightRadius: isCircle ? "50%" : `${cfg.rBR}px`,
                                                            clipPath: clipPathStyle,
                                                            pointerEvents: "none",
                                                            borderStyle: strokeWidth > 0 ? "solid" : "none",
                                                            borderWidth: strokeWidth > 0 ? `${strokeWidth}px` : "0px",
                                                            borderColor: cfg.strokeColor ?? "#ffffff",
                                                            boxSizing: "border-box",
                                                            ...(cfg.bg?.includes("gradient") ? {
                                                                background: cfg.bg,
                                                                opacity: (cfg.opacity ?? 100) / 100,
                                                            } : {
                                                                backgroundColor: `color-mix(in srgb, ${cfg.bg} ${cfg.opacity ?? 100}%, transparent)`,
                                                            })
                                                        }}
                                                    />
                                                    {isLogoBinding && logoUrl ? (
                                                        <div className="relative w-full h-full">
                                                            <Image src={logoUrl} alt="" fill className="object-cover" unoptimized />
                                                        </div>
                                                    ) : isScoreBarBinding ? (
                                                        renderScoreBar(cfg.bindTo === "score-bar-home")
                                                    ) : (
                                                        <div className="px-1 overflow-hidden flex items-center justify-center">
                                                            {getBoundText()}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        return null;
                                    })();

                                    if (!blockElement) return null;

                                    const hasGradient = cfg.bg?.includes("gradient");
                                    const bgDiv = (
                                        <div
                                            key="block-bg-layer"
                                            style={{
                                                position: "absolute",
                                                inset: 0,
                                                zIndex: -1,
                                                borderTopLeftRadius: `${cfg.rTL}px`,
                                                borderTopRightRadius: `${cfg.rTR}px`,
                                                borderBottomLeftRadius: `${cfg.rBL}px`,
                                                borderBottomRightRadius: `${cfg.rBR}px`,
                                                pointerEvents: "none",
                                                ...(hasGradient ? {
                                                    background: cfg.bg,
                                                    opacity: (cfg.opacity ?? 100) / 100,
                                                } : {
                                                    backgroundColor: `color-mix(in srgb, ${cfg.bg} ${cfg.opacity ?? 100}%, transparent)`,
                                                })
                                            }}
                                        />
                                    );

                                    const existingStyle = blockElement.props.style || {};
                                    const children = Children.toArray(blockElement.props.children);
                                    children.unshift(bgDiv);

                                    return cloneElement(blockElement, {
                                        style: {
                                            ...existingStyle,
                                            background: "transparent",
                                            backgroundColor: "transparent",
                                            isolation: "isolate",
                                        },
                                        children: children,
                                    });
                                })}
                                </div>
                            ) : (
                                /* Modular Blocks Flex Scoreboard */
                                <div 
                                    className={cn(
                                        "flex",
                                        searchParams.get("orientation") === "vertical" ? "flex-col items-stretch" : "flex-row items-center",
                                        searchParams.get("blockBg") === "docked" ? cn("bg-black/85 shadow-2xl p-1.5", rounded === "none" ? "rounded-none" : rounded === "full" ? "rounded-full" : "rounded-sm") : "bg-transparent"
                                    )}
                                    style={{ gap: `${searchParams.get("blockGap") || "8"}px` }}
                                >
                                    {(searchParams.get("blocks") || "").split(",").filter(Boolean).map((blockId) => {
                                        const activeRoundedClass = rounded === "none" ? "rounded-none" : rounded === "full" ? "rounded-full" : "rounded-sm";
                                        const isSpaced = searchParams.get("blockBg") !== "docked";
                                        const cfg = customBlockConfigs[blockId] || { x: 0, y: 0, w: 80, h: 40, fontSize: 14, rTL: 8, rTR: 8, rBL: 8, rBR: 8, opacity: 100, bg: blockId.startsWith("score") ? scoreBg : "#000000", color: "#ffffff" };
                                        
                                        const blockElement = (() => {
                                            // 1. Home Name
                                            if (blockId === "name-home") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    className={cn(
                                                        "px-4 py-2 font-extrabold tracking-tight text-white text-sm flex items-center justify-center min-w-[70px] select-none h-12 relative",
                                                        isSpaced ? cn("bg-black/85", activeRoundedClass) : "border-0"
                                                    )}
                                                >
                                                    <span>{teamNameMode === "abbr" ? getInitials(match.home_team?.name || '') : match.home_team?.name}</span>
                                                    {renderRedCards(homeRedCards)}
                                                    {homeBarDir !== "none" && (
                                                        <div
                                                            style={{
                                                                position: "absolute",
                                                                [homeBarColor.includes("gradient") ? "background" : "backgroundColor"]: homeBarColor,
                                                                ...(homeBarDir === "top" && { top: 0, left: 0, right: 0, height: "4px", borderTopLeftRadius: `${cfg.rTL}px`, borderTopRightRadius: `${cfg.rTR}px` }),
                                                                ...(homeBarDir === "right" && { top: 0, bottom: 0, right: 0, width: "4px", borderTopRightRadius: `${cfg.rTR}px`, borderBottomRightRadius: `${cfg.rBR}px` }),
                                                                ...(homeBarDir === "bottom" && { bottom: 0, left: 0, right: 0, height: "4px", borderBottomLeftRadius: `${cfg.rBL}px`, borderBottomRightRadius: `${cfg.rBR}px` }),
                                                                ...(homeBarDir === "left" && { top: 0, bottom: 0, left: 0, width: "4px", borderTopLeftRadius: `${cfg.rTL}px`, borderBottomLeftRadius: `${cfg.rBL}px` }),
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 2. Home Logo
                                        if (blockId === "logo-home") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    className={cn(
                                                        "p-1 shrink-0 flex items-center justify-center h-12 w-12 select-none font-black text-[10px] tracking-tighter",
                                                        isSpaced ? cn("bg-black/85", activeRoundedClass) : "border-0"
                                                    )}
                                                >
                                                    {match.home_team?.logo_url ? (
                                                        <div className="relative w-8 h-8">
                                                            <Image src={match.home_team.logo_url} alt="" fill className="object-contain rounded-sm" unoptimized />
                                                        </div>
                                                    ) : (
                                                        <span>{getInitials(match.home_team?.name || '')}</span>
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 3. Score
                                        if (blockId === "score") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    className={cn(
                                                        "flex items-center text-white font-black text-xl h-12 px-5 justify-center tracking-tighter shadow-inner min-w-[90px]",
                                                        isSpaced ? cn("border border-white/10", activeRoundedClass) : "border-0"
                                                    )}
                                                    style={{ [scoreBg.includes("gradient") ? "background" : "backgroundColor"]: scoreBg }}
                                                >
                                                    <span>{homeScore}</span>
                                                    <span className="mx-2 text-white/50 text-base font-normal">-</span>
                                                    <span>{awayScore}</span>
                                                </div>
                                            );
                                        }
                                        // 3a. Home Score
                                        if (blockId === "score-home") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    className={cn(
                                                        "flex items-center text-white font-black text-xl h-12 px-4 justify-center tracking-tighter shadow-inner min-w-[45px]",
                                                        isSpaced ? cn("border border-white/10", activeRoundedClass) : "border-0"
                                                    )}
                                                    style={{ [scoreBg.includes("gradient") ? "background" : "backgroundColor"]: scoreBg }}
                                                >
                                                    <span>{homeScore}</span>
                                                </div>
                                            );
                                        }
                                        // 3b. Away Score
                                        if (blockId === "score-away") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    className={cn(
                                                        "flex items-center text-white font-black text-xl h-12 px-4 justify-center tracking-tighter shadow-inner min-w-[45px]",
                                                        isSpaced ? cn("border border-white/10", activeRoundedClass) : "border-0"
                                                    )}
                                                    style={{ [scoreBg.includes("gradient") ? "background" : "backgroundColor"]: scoreBg }}
                                                >
                                                    <span>{awayScore}</span>
                                                </div>
                                            );
                                        }
                                        // 4. Away Name
                                        if (blockId === "name-away") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    className={cn(
                                                        "px-4 py-2 font-extrabold tracking-tight text-white text-sm flex items-center justify-center min-w-[70px] select-none h-12 relative",
                                                        isSpaced ? cn("bg-black/85", activeRoundedClass) : "border-0"
                                                    )}
                                                >
                                                    <span>{teamNameMode === "abbr" ? getInitials(match.away_team?.name || '') : match.away_team?.name}</span>
                                                    {renderRedCards(awayRedCards)}
                                                    {awayBarDir !== "none" && (
                                                        <div
                                                            style={{
                                                                position: "absolute",
                                                                [awayBarColor.includes("gradient") ? "background" : "backgroundColor"]: awayBarColor,
                                                                ...(awayBarDir === "top" && { top: 0, left: 0, right: 0, height: "4px", borderTopLeftRadius: `${cfg.rTL}px`, borderTopRightRadius: `${cfg.rTR}px` }),
                                                                ...(awayBarDir === "right" && { top: 0, bottom: 0, right: 0, width: "4px", borderTopRightRadius: `${cfg.rTR}px`, borderBottomRightRadius: `${cfg.rBR}px` }),
                                                                ...(awayBarDir === "bottom" && { bottom: 0, left: 0, right: 0, height: "4px", borderBottomLeftRadius: `${cfg.rBL}px`, borderBottomRightRadius: `${cfg.rBR}px` }),
                                                                ...(awayBarDir === "left" && { top: 0, bottom: 0, left: 0, width: "4px", borderTopLeftRadius: `${cfg.rTL}px`, borderBottomLeftRadius: `${cfg.rBL}px` }),
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 5. Away Logo
                                        if (blockId === "logo-away") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    className={cn(
                                                        "p-1 shrink-0 flex items-center justify-center h-12 w-12 select-none font-black text-[10px] tracking-tighter",
                                                        isSpaced ? cn("bg-black/85", activeRoundedClass) : "border-0"
                                                    )}
                                                >
                                                    {match.away_team?.logo_url ? (
                                                        <div className="relative w-8 h-8">
                                                            <Image src={match.away_team.logo_url} alt="" fill className="object-contain rounded-sm" unoptimized />
                                                        </div>
                                                    ) : (
                                                        <span>{getInitials(match.away_team?.name || '')}</span>
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 6. Timer
                                        if (blockId === "timer") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    className={cn(
                                                        "flex items-center justify-center px-4 text-white font-mono text-sm font-bold min-w-[90px] h-12 select-none",
                                                        isSpaced ? cn("bg-black/85", activeRoundedClass) : "border-0"
                                                    )}
                                                >
                                                    {match.status === "finished" ? (
                                                        <span className="text-red-500 font-extrabold tracking-widest text-xs">FT</span>
                                                    ) : isHalfTime ? (
                                                        <span className="text-amber-500 font-extrabold tracking-widest text-xs">HT</span>
                                                    ) : match.status === "live" ? (
                                                        <span className={cn("text-emerald-400 font-bold", match.timer_status === "paused" && "text-amber-400")}>
                                                            {timeString}
                                                        </span>
                                                    ) : (
                                                        <span className="text-white/60 text-xs font-extrabold tracking-wider">PRE</span>
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 7a. Tournament Logo
                                        if (blockId === "logo-tournament") {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    className={cn(
                                                        "p-1 shrink-0 flex items-center justify-center h-12 w-12 select-none font-black text-[10px] tracking-tighter",
                                                        isSpaced ? cn("bg-black/85", activeRoundedClass) : "border-0"
                                                    )}
                                                >
                                                    {tournamentLogo ? (
                                                        <div className="relative w-8 h-8">
                                                            <Image src={tournamentLogo} alt="" fill className="object-contain rounded-sm" unoptimized />
                                                        </div>
                                                    ) : (
                                                        <span className="text-[9px] opacity-40">Logo</span>
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 7. Header/Watermark Text
                                        if (blockId === "header-text" && displayHeaderText) {
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    className={cn(
                                                        "px-4 text-[10px] font-black text-white/70 tracking-widest flex items-center justify-center select-none h-12",
                                                        isSpaced ? cn("bg-black/85", activeRoundedClass) : "border-0"
                                                    )}
                                                >
                                                    {displayHeaderText}
                                                </div>
                                            );
                                        }
                                        // 8. Substitution Block
                                        if (blockId === "substitution") {
                                            const isSubActive = activeNotification?.type === "substitution";
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    className={cn(
                                                        "p-2 flex flex-col justify-center select-none h-12 text-white font-bold leading-tight transition-all duration-500",
                                                        isSpaced ? cn("bg-black/95 border border-white/10", activeRoundedClass) : "border-0",
                                                        isSubActive ? "opacity-100 scale-100" : "opacity-0 scale-90 w-0 px-0 overflow-hidden"
                                                    )}
                                                >
                                                    {isSubActive && (
                                                        <div className="flex flex-col text-[10px] w-full text-center min-w-[120px]">
                                                            <div className="text-emerald-400 font-extrabold truncate">
                                                                ▲ {activeNotification.playerIn}
                                                            </div>
                                                            <div className="text-red-500 font-extrabold truncate">
                                                                ▼ {activeNotification.playerOut}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 8b. Added Time Block
                                        if (blockId === "add-time") {
                                            if (!addedTime) return null;
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    className={cn(
                                                        "flex items-center justify-center px-3 text-white font-mono text-sm font-bold min-w-[40px] h-12 select-none",
                                                        isSpaced ? cn("bg-black/85", activeRoundedClass) : "border-0"
                                                    )}
                                                    style={{
                                                        ...(cfg.bg?.includes("gradient") ? { background: cfg.bg } : { backgroundColor: cfg.bg }),
                                                        color: cfg.color,
                                                        borderTopLeftRadius: isSpaced ? undefined : `${cfg.rTL}px`,
                                                        borderTopRightRadius: isSpaced ? undefined : `${cfg.rTR}px`,
                                                        borderBottomLeftRadius: isSpaced ? undefined : `${cfg.rBL}px`,
                                                        borderBottomRightRadius: isSpaced ? undefined : `${cfg.rBR}px`,
                                                    }}
                                                >
                                                    +{addedTime}
                                                </div>
                                            );
                                        }
                                        // 9. Alerts Block
                                        if (blockId === "alerts") {
                                            const isAlertActive = !!activeNotification;
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    className={cn(
                                                        "flex items-center justify-center select-none h-12 text-white font-bold leading-tight transition-all duration-500",
                                                        isSpaced ? cn("", activeRoundedClass) : "border-0",
                                                        isAlertActive ? "opacity-100 scale-100" : "opacity-0 scale-90 w-0 px-0 overflow-hidden"
                                                    )}
                                                >
                                                    {isAlertActive && (
                                                        <div className="flex items-center gap-2 bg-black/95 border border-white/10 px-4 py-2 rounded-sm text-white font-bold leading-tight min-w-[160px]">
                                                            {activeNotification.type === "goal" && (
                                                                <>
                                                                    <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
                                                                    <div className="flex flex-col text-[10px] text-left truncate">
                                                                        <span className="text-emerald-400 font-extrabold truncate">GOAL! {activeNotification.player}</span>
                                                                        <span className="text-white/60 text-[9px]">{activeNotification.teamName} ({activeNotification.minute}&apos;)</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {(activeNotification.type === "yellow_card" || activeNotification.type === "red_card") && (
                                                                <>
                                                                    <Square className={cn("w-3 h-4 shrink-0", activeNotification.type === "yellow_card" ? "text-yellow-400 fill-yellow-400" : "text-red-500 fill-red-500")} />
                                                                    <div className="flex flex-col text-[10px] text-left truncate">
                                                                        <span className={cn("font-extrabold truncate", activeNotification.type === "yellow_card" ? "text-yellow-400" : "text-red-500")}>
                                                                            {activeNotification.type === "yellow_card" ? "Y.Card" : "R.Card"} {activeNotification.player}
                                                                        </span>
                                                                        <span className="text-white/60 text-[9px]">{activeNotification.teamName} ({activeNotification.minute}&apos;)</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        // 9b. Goal Timeline (Home)
                                        if (blockId === "timeline-home") {
                                            const homeGoalEvents = goalEvents.filter((e) => e.team_id && isHomeTeam(e.team_id));
                                            if (homeGoalEvents.length === 0) return null;
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    className={cn(
                                                        "flex flex-col gap-0.5 justify-center p-1.5 text-white font-bold leading-tight select-none min-w-[100px]",
                                                        isSpaced ? cn("bg-black/85", activeRoundedClass) : "border-0"
                                                    )}
                                                    style={{
                                                        ...(isSpaced ? {} : (cfg.bg?.includes("gradient") ? { background: cfg.bg } : { backgroundColor: cfg.bg })),
                                                        color: cfg.color,
                                                        fontSize: `${cfg.fontSize}px`,
                                                        borderTopLeftRadius: isSpaced ? undefined : `${cfg.rTL}px`,
                                                        borderTopRightRadius: isSpaced ? undefined : `${cfg.rTR}px`,
                                                        borderBottomLeftRadius: isSpaced ? undefined : `${cfg.rBL}px`,
                                                        borderBottomRightRadius: isSpaced ? undefined : `${cfg.rBR}px`,
                                                    }}
                                                >
                                                    {homeGoalEvents.slice(0, 3).map((e) => (
                                                        <div key={e.id} className="flex items-center gap-1.5 px-1 text-[9px] truncate">
                                                            <Trophy className="h-4 w-4 text-emerald-400 shrink-0" />
                                                            <span className="truncate">{e.player_name} ({e.minute}&apos;)</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        // 9c. Goal Timeline (Away)
                                        if (blockId === "timeline-away") {
                                            const awayGoalEvents = goalEvents.filter((e) => e.team_id && isAwayTeam(e.team_id));
                                            if (awayGoalEvents.length === 0) return null;
                                            return (
                                                <div 
                                                    key={blockId} 
                                                    className={cn(
                                                        "flex flex-col gap-0.5 justify-center p-1.5 text-white font-bold leading-tight select-none min-w-[100px]",
                                                        isSpaced ? cn("bg-black/85", activeRoundedClass) : "border-0"
                                                    )}
                                                    style={{
                                                        ...(isSpaced ? {} : (cfg.bg?.includes("gradient") ? { background: cfg.bg } : { backgroundColor: cfg.bg })),
                                                        color: cfg.color,
                                                        fontSize: `${cfg.fontSize}px`,
                                                        borderTopLeftRadius: isSpaced ? undefined : `${cfg.rTL}px`,
                                                        borderTopRightRadius: isSpaced ? undefined : `${cfg.rTR}px`,
                                                        borderBottomLeftRadius: isSpaced ? undefined : `${cfg.rBL}px`,
                                                        borderBottomRightRadius: isSpaced ? undefined : `${cfg.rBR}px`,
                                                    }}
                                                >
                                                    {awayGoalEvents.slice(0, 3).map((e) => (
                                                        <div key={e.id} className="flex items-center gap-1.5 px-1 text-[9px] truncate">
                                                            <Trophy className="h-4 w-4 text-emerald-400 shrink-0" />
                                                            <span className="truncate">{e.player_name} ({e.minute}&apos;)</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })();

                                    if (!blockElement) return null;

                                    const finalBg = isSpaced ? cfg.bg : (blockId.startsWith("score") ? scoreBg : "transparent");
                                    const hasGradient = finalBg?.includes("gradient");
                                    const bgDiv = (
                                        <div
                                            key="block-bg-layer"
                                            style={{
                                                position: "absolute",
                                                inset: 0,
                                                zIndex: -1,
                                                borderTopLeftRadius: isSpaced ? `${cfg.rTL}px` : undefined,
                                                borderTopRightRadius: isSpaced ? `${cfg.rTR}px` : undefined,
                                                borderBottomLeftRadius: isSpaced ? `${cfg.rBL}px` : undefined,
                                                borderBottomRightRadius: isSpaced ? `${cfg.rBR}px` : undefined,
                                                pointerEvents: "none",
                                                ...(hasGradient ? {
                                                    background: finalBg,
                                                    opacity: (cfg.opacity ?? 100) / 100,
                                                } : {
                                                    backgroundColor: finalBg === "transparent" ? "transparent" : `color-mix(in srgb, ${finalBg} ${cfg.opacity ?? 100}%, transparent)`,
                                                })
                                            }}
                                        />
                                    );

                                    const existingStyle = blockElement.props.style || {};
                                    const children = Children.toArray(blockElement.props.children);
                                    children.unshift(bgDiv);

                                    return cloneElement(blockElement, {
                                        style: {
                                            ...existingStyle,
                                            background: "transparent",
                                            backgroundColor: "transparent",
                                            isolation: "isolate",
                                        },
                                        children: children,
                                    });
                                })}
                                </div>
                            )
                        ) : (
                            /* Legacy Scoreboards (Fallback) */
                            <>
                                {/* Top Bar Scoreboard Style */}
                                {layout === "top-bar" && (
                                    <div className="flex flex-col items-center">
                                        {displayHeaderText && (
                                            <div className="bg-black/85 text-[10px] font-black text-white/70 tracking-widest px-4 py-1.5 rounded-t-xl border-t border-x border-white/10 mb-[-1px] select-none">
                                                {displayHeaderText}
                                            </div>
                                        )}
                                        <div className={cn(
                                            "flex items-center bg-black/85 shadow-2xl h-14 relative",
                                            displayHeaderText ? "rounded-b-xl rounded-t-none" : "rounded-sm"
                                        )}>
                                            {/* Home Team */}
                                            <div className="flex items-center gap-3 px-5 py-2 relative">
                                                {showLogos && (
                                                    match.home_team?.logo_url ? (
                                                        <div className="relative w-7 h-7">
                                                            <Image
                                                                src={match.home_team.logo_url}
                                                                alt={match.home_team.name || ""}
                                                                fill
                                                                className="object-contain rounded-sm"
                                                                unoptimized
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-7 h-7 bg-white/5 rounded flex items-center justify-center text-[10px] font-black tracking-tighter select-none">
                                                            {getInitials(match.home_team?.name || '')}
                                                        </div>
                                                    )
                                                )}
                                                <span className="font-extrabold tracking-tight text-white text-base max-w-[120px] truncate relative">
                                                    <span>{teamNameMode === "abbr" ? getInitials(match.home_team?.name || '') : match.home_team?.name}</span>
                                                    {renderRedCards(homeRedCards)}
                                                </span>
                                            </div>

                                            <div 
                                                className="flex items-center text-white font-black text-2xl h-full px-6 border-x border-white/15 min-w-[100px] justify-center tracking-tighter shadow-inner"
                                                style={{ [scoreBg.includes("gradient") ? "background" : "backgroundColor"]: scoreBg }}
                                            >
                                                <span>{homeScore}</span>
                                                <span className="mx-2 text-white/50 text-base font-normal">-</span>
                                                <span>{awayScore}</span>
                                            </div>

                                            {/* Away Team */}
                                            <div className="flex items-center gap-3 px-5 py-2 flex-row-reverse relative">
                                                {showLogos && (
                                                    match.away_team?.logo_url ? (
                                                        <div className="relative w-7 h-7">
                                                            <Image
                                                                src={match.away_team.logo_url}
                                                                alt={match.away_team.name || ""}
                                                                fill
                                                                className="object-contain rounded-sm"
                                                                unoptimized
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-7 h-7 bg-white/5 rounded flex items-center justify-center text-[10px] font-black tracking-tighter select-none">
                                                            {getInitials(match.away_team?.name || '')}
                                                        </div>
                                                    )
                                                )}
                                                <span className="font-extrabold tracking-tight text-white text-base max-w-[120px] truncate relative">
                                                    <span>{teamNameMode === "abbr" ? getInitials(match.away_team?.name || '') : match.away_team?.name}</span>
                                                    {renderRedCards(awayRedCards)}
                                                </span>
                                            </div>

                                            {/* Timer / Status Area */}
                                            <div className="flex items-center justify-center bg-white/5 border-l border-white/10 px-5 text-white h-full font-mono text-sm font-bold min-w-[95px]">
                                                {match.status === "finished" ? (
                                                    <span className="text-red-500 font-extrabold tracking-widest text-xs">FT</span>
                                                ) : isHalfTime ? (
                                                    <span className="text-amber-500 font-extrabold tracking-widest text-xs">HT</span>
                                                ) : match.status === "live" ? (
                                                    <span className={cn("text-emerald-400 font-bold", match.timer_status === "paused" && "text-amber-400")}>
                                                        {timeString}
                                                    </span>
                                                ) : (
                                                    <span className="text-white/60 text-xs font-extrabold tracking-wider">PRE</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Minimal Corner Scoreboard Style */}
                                {(layout === "minimal-left" || layout === "minimal-right") && (
                                    <div className="bg-black/90 rounded-sm shadow-2xl p-3 flex flex-col gap-2 min-w-[240px]">
                                        {/* Header with Timer/Status */}
                                        <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[10px] font-bold text-white/50 tracking-wider">
                                            <span>{displayHeaderText || "TOURNI OVERLAY"}</span>
                                            <span className={cn("font-mono text-xs text-white", match.status === "live" && match.timer_status === "paused" && "text-amber-400")}>
                                                {match.status === "finished" ? "FULL TIME" : isHalfTime ? "HALF TIME" : match.status === "live" ? timeString : "UPCOMING"}
                                            </span>
                                        </div>

                                        {/* Home Row */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {showLogos && (
                                                    <div className="h-4 w-4 bg-white/5 rounded flex items-center justify-center overflow-hidden text-[8px] font-black tracking-tighter relative">
                                                        {match.home_team?.logo_url ? (
                                                            <Image src={match.home_team.logo_url} alt="" fill className="object-contain" unoptimized />
                                                        ) : (
                                                            <span>{getInitials(match.home_team?.name || '')}</span>
                                                        )}
                                                    </div>
                                                )}
                                                <span className="font-extrabold text-sm text-white tracking-tight relative">
                                                    <span>{teamNameMode === "abbr" ? getInitials(match.home_team?.name || '') : match.home_team?.name}</span>
                                                    {renderRedCards(homeRedCards)}
                                                </span>
                                            </div>
                                            <span className="font-black text-lg" style={{ color: scoreBg }}>{homeScore}</span>
                                        </div>

                                        {/* Away Row */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {showLogos && (
                                                    <div className="h-4 w-4 bg-white/5 rounded flex items-center justify-center overflow-hidden text-[8px] font-black tracking-tighter relative">
                                                        {match.away_team?.logo_url ? (
                                                            <Image src={match.away_team.logo_url} alt="" fill className="object-contain" unoptimized />
                                                        ) : (
                                                            <span>{getInitials(match.away_team?.name || '')}</span>
                                                        )}
                                                    </div>
                                                )}
                                                <span className="font-extrabold text-sm text-white tracking-tight relative">
                                                    <span>{teamNameMode === "abbr" ? getInitials(match.away_team?.name || '') : match.away_team?.name}</span>
                                                    {renderRedCards(awayRedCards)}
                                                </span>
                                            </div>
                                            <span className="font-black text-lg" style={{ color: scoreBg }}>{awayScore}</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Mini Goal Scorer Timeline Ticker Overlay */}
                        {showTimeline && goalEvents.length > 0 && (
                            <div className="flex flex-col gap-1 mt-2.5 max-h-[160px] overflow-hidden items-center select-none">
                                {goalEvents.slice(0, 3).map((e) => (
                                    <div key={e.id} className="flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 text-[10px] font-bold text-white/80 shadow-md">
                                        <Trophy className="h-4 w-4 text-emerald-400" />
                                        <span>{e.player_name} ({e.minute}&apos;)</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Live Ticker Alert Popup Banner */}
            {searchParams.get("blocks") === null && (
                <div className={cn(
                    "absolute left-0 right-0 flex justify-center pointer-events-none z-50",
                    posY === "top" ? "bottom-10" : "top-10"
                )}>
                    <div
                        className={cn(
                            "transition-all duration-700 transform flex items-center gap-4 bg-black/95 border border-white/15 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] px-8 py-4 pointer-events-auto",
                            activeNotification
                                ? "translate-y-0 opacity-100 scale-100"
                                : posY === "top" ? "translate-y-10 opacity-0 scale-90" : "-translate-y-10 opacity-0 scale-90"
                        )}
                    >
                        {activeNotification?.type === "goal" && (
                            <>
                                <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shadow-emerald-500/35 animate-bounce">
                                    <Trophy className="w-6 h-6 text-black fill-black" />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-emerald-400 font-black text-2xl tracking-tighter leading-none">GOAL!</span>
                                    <span className="text-white font-extrabold text-lg mt-0.5 leading-none">
                                        {activeNotification.player}
                                    </span>
                                    <span className="text-white/50 font-bold text-xs mt-1">
                                        {activeNotification.teamName} • {activeNotification.minute}&apos;
                                    </span>
                                </div>
                            </>
                        )}

                        {(activeNotification?.type === "yellow_card" || activeNotification?.type === "red_card") && (
                            <>
                                <div
                                    className={cn(
                                        "w-10 h-12 rounded flex items-center justify-center transform rotate-6",
                                        activeNotification.type === "yellow_card"
                                            ? "bg-yellow-400 shadow-yellow-400/25"
                                            : "bg-red-600 shadow-red-600/25"
                                    )}
                                >
                                    <Square className={cn("w-5 h-6", activeNotification.type === "yellow_card" ? "text-black fill-black" : "text-white fill-white")} />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span
                                        className={cn(
                                            "font-black text-2xl tracking-tighter leading-none",
                                            activeNotification.type === "yellow_card" ? "text-yellow-400" : "text-red-500"
                                        )}
                                    >
                                        {activeNotification.type === "yellow_card" ? "YELLOW CARD" : "RED CARD"}
                                    </span>
                                    <span className="text-white font-extrabold text-lg mt-0.5 leading-none">
                                        {activeNotification.player}
                                    </span>
                                    <span className="text-white/50 font-bold text-xs mt-1">
                                        {activeNotification.teamName} • {activeNotification.minute}&apos;
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function BroadcastOverlay() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center text-white/50 text-xs font-mono select-none">
                Loading overlay...
            </div>
        }>
            <BroadcastOverlayContent />
        </Suspense>
    );
}
