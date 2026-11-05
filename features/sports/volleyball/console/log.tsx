"use client";

import { Match, MatchEvent, Player } from "@/types";
import { VOLLEYBALL_EVENT_TYPES } from "./constants";
import {
    Trash2,
    Clock,
    Zap,
    Flame,
    ShieldCheck,
    RotateCw,
    Hand,
    Trophy,
    Ban,
    Volleyball,
    Play,
    Pause,
    CheckCircle2,
    Video,
    Square
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";
import { EmptyState } from "@/components/shared/empty-state";
import { PlayerAvatar } from "@/components/shared/player-avatar";

interface EventLogProps {
    events: MatchEvent[];
    match?: Match;
    homeTeamId?: string;
    awayTeamId?: string;
    readOnly?: boolean;
    onDeleteEvent?: (id: string) => void;
    players?: Player[];
    visibleLogs?: string[];
}

const isVolleyballEventVisible = (event: MatchEvent, visibleLogs?: string[]) => {
    if (!visibleLogs) return true;
    const type = event.event_type;
    if (visibleLogs.includes(type)) return true;
    if (type === 'match_resumed' && visibleLogs.includes('match_paused')) return true;
    if ((type === 'yellow_card' || type === 'red_card') && visibleLogs.includes('sanction')) return true;
    return false;
};

export function VolleyballEventLog({
    events,
    match,
    homeTeamId,
    awayTeamId,
    readOnly = false,
    onDeleteEvent,
    players = [],
    visibleLogs
}: EventLogProps) {
    const t = useTranslations("Console");
    const locale = useLocale();
    const isTh = locale === "th";

    const resolvedHomeId = match?.home_team_id || match?.home_team?.id || homeTeamId;
    const resolvedAwayId = match?.away_team_id || match?.away_team?.id || awayTeamId;

    const filteredEvents = visibleLogs ? events.filter(e => isVolleyballEventVisible(e, visibleLogs)) : events;

    const getPlayer = (playerId?: string | null, playerName?: string | null): Player | undefined => {
        if (!players || players.length === 0) return undefined;
        if (playerId && playerId !== 'unknown') {
            const found = players.find(p => p.id === playerId);
            if (found) return found;
        }
        if (playerName && playerName !== 'unknown' && playerName !== 'ไม่ระบุชื่อ' && playerName !== 'Unknown Player') {
            const normalized = playerName.trim().toLowerCase();
            return players.find(p => p.name?.trim().toLowerCase() === normalized);
        }
        return undefined;
    };

    const isHomeEvent = (e: MatchEvent) => {
        const extra = (e.extra_info || e.detail) as Record<string, unknown> | null;
        if (extra?.team_side === 'home') return true;
        if (extra?.team_side === 'away') return false;

        if (e.team_id) {
            if (e.team_id === resolvedHomeId) return true;
            if (e.team_id === resolvedAwayId) return false;
        }

        const text = (extra?.text as string) || "";
        if (text.includes("Point for home") || text.toLowerCase().includes("for home")) return true;
        if (text.includes("Point for away") || text.toLowerCase().includes("for away")) return false;

        return false;
    };

    const isAwayEvent = (e: MatchEvent) => {
        const extra = (e.extra_info || e.detail) as Record<string, unknown> | null;
        if (extra?.team_side === 'away') return true;
        if (extra?.team_side === 'home') return false;

        if (e.team_id) {
            if (e.team_id === resolvedAwayId) return true;
            if (e.team_id === resolvedHomeId) return false;
        }

        const text = (extra?.text as string) || "";
        if (text.includes("Point for away") || text.toLowerCase().includes("for away")) return true;
        if (text.includes("Point for home") || text.toLowerCase().includes("for home")) return false;

        return false;
    };

    const getSetNumber = (e: MatchEvent) => {
        const extraSet = ((e.extra_info || e.detail) as Record<string, unknown> | null)?.set;
        return typeof extraSet === 'number' ? extraSet : (e.minute || 1);
    };

    const getEventLabel = (event: MatchEvent) => {
        const type = event.event_type || event.type;
        switch (type) {
            case 'point': return isTh ? "ได้แต้ม" : "Point";
            case 'ace': return isTh ? "เสิร์ฟเอซ" : "Service Ace";
            case 'spike': return isTh ? "ตบทำแต้ม" : "Attack / Spike";
            case 'block': return isTh ? "บล็อกทำแต้ม" : "Block Point";
            case 'substitution': return isTh ? "เปลี่ยนตัว" : "Substitution";
            case 'timeout': return isTh ? "ขอเวลานอก" : "Timeout";
            case 'foul': return isTh ? "ฟาวล์" : "Foul";
            case 'challenge': return isTh ? "วิดีโอชาเลนจ์" : "Video Challenge";
            case 'sanction': return isTh ? "การลงโทษ" : "Sanction";
            case 'yellow_card': return isTh ? "ใบเหลือง" : "Yellow Card";
            case 'red_card': return isTh ? "ใบแดง" : "Red Card";
            case 'set_end': return isTh ? "จบเซต" : "Set Finished";
            case 'set_win': return isTh ? "ชนะเซ็ต" : "Set Win";
            case 'walkover': return isTh ? "จบการแข่งขันก่อนเวลา" : "Walkover";
            case 'match_paused': return isTh ? "พักสนาม" : "Match Paused";
            case 'match_resumed': return isTh ? "เริ่มแข่งต่อ" : "Match Resumed";
            case 'full_time': return isTh ? "จบเกม" : "Match Finished";
            default: {
                const config = VOLLEYBALL_EVENT_TYPES.find(e => e.type === type);
                return config?.label || type.replace(/_/g, ' ');
            }
        }
    };

    const renderEventIcon = (event: MatchEvent) => {
        const type = event.event_type || event.type;

        if (type === 'yellow_card') {
            return (
                <span title={isTh ? "ใบเหลือง" : "Yellow Card"}>
                    <span className="w-3 h-4 bg-amber-400 rounded-xs border border-amber-500/50 shadow-xs inline-block shrink-0" />
                </span>
            );
        }

        if (type === 'red_card') {
            return (
                <span title={isTh ? "ใบแดง" : "Red Card"}>
                    <span className="w-3 h-4 bg-red-600 rounded-xs border border-red-700/50 shadow-xs inline-block shrink-0" />
                </span>
            );
        }

        if (type === 'substitution') {
            return (
                <span title={isTh ? "เปลี่ยนตัว" : "Substitution"}>
                    <RotateCw className="size-4 text-emerald-500 shrink-0" />
                </span>
            );
        }

        if (type === 'point') {
            return (
                <span title={isTh ? "ได้แต้ม" : "Point"}>
                    <Volleyball className="size-4 text-amber-500 shrink-0" />
                </span>
            );
        }

        if (type === 'ace') {
            return (
                <span title={isTh ? "เสิร์ฟเอซ" : "Service Ace"}>
                    <Zap className="size-4 text-yellow-400 shrink-0" />
                </span>
            );
        }

        if (type === 'spike') {
            return (
                <span title={isTh ? "ตบทำแต้ม" : "Attack / Spike"}>
                    <Flame className="size-4 text-red-500 shrink-0" />
                </span>
            );
        }

        if (type === 'block') {
            return (
                <span title={isTh ? "บล็อกทำแต้ม" : "Block Point"}>
                    <ShieldCheck className="size-4 text-blue-500 shrink-0" />
                </span>
            );
        }

        if (type === 'timeout') {
            return (
                <span title={isTh ? "ขอเวลานอก" : "Timeout"}>
                    <Clock className="size-4 text-purple-500 shrink-0" />
                </span>
            );
        }

        if (type === 'foul') {
            return (
                <span title={isTh ? "ฟาวล์" : "Foul"}>
                    <Hand className="size-4 text-orange-500 shrink-0" />
                </span>
            );
        }

        if (type === 'challenge') {
            return (
                <span title={isTh ? "วิดีโอชาเลนจ์" : "Video Challenge"}>
                    <Video className="size-4 text-cyan-500 shrink-0" />
                </span>
            );
        }

        if (type === 'sanction') {
            return (
                <span title={isTh ? "การลงโทษ" : "Sanction"}>
                    <Square className="size-4 text-rose-500 shrink-0" />
                </span>
            );
        }

        if (type === 'set_win' || type === 'set_end') {
            return (
                <span title={isTh ? "จบเซต" : "Set Finished"}>
                    <Trophy className="size-4 text-amber-400 shrink-0" />
                </span>
            );
        }

        if (type === 'walkover') {
            return (
                <span title={isTh ? "จบการแข่งขันก่อนเวลา" : "Walkover"}>
                    <Ban className="size-4 text-red-500 shrink-0" />
                </span>
            );
        }

        const config = VOLLEYBALL_EVENT_TYPES.find(e => e.type === type);
        if (config?.icon) {
            const IconComp = config.icon;
            return (
                <span title={config.label || type}>
                    <IconComp className={cn("size-4 shrink-0", config.color)} />
                </span>
            );
        }

        return null;
    };

    return (
        <div className="bg-card border rounded-sm relative overflow-hidden group">
            <div className="relative z-10">
                <div className="overflow-y-auto no-scrollbar scroll-smooth">
                    {!filteredEvents || filteredEvents.length === 0 ? (
                        <EmptyState
                            icon={Clock}
                            title={t("no_events") || "No events yet"}
                            description={events && events.length > 0 ? (t("no_filtered_events") || "No events matching your log display settings") : (t("live_updates_desc") || "Live match updates will appear here")}
                        />
                    ) : (
                        filteredEvents.map((event: MatchEvent) => {
                            const evtConfig = VOLLEYBALL_EVENT_TYPES.find(e => e.type === event.event_type);

                            const isHome = isHomeEvent(event);
                            const isAway = isAwayEvent(event);
                            const neutralTypes = ['set_end', 'set_win', 'match_paused', 'match_resumed', 'full_time', 'walkover'];
                            const isNeutral = (!isHome && !isAway) || neutralTypes.includes(event.event_type);

                            const setNum = getSetNumber(event);
                            const extra = (event.extra_info || event.detail) as Record<string, unknown> | null;
                            let textDesc = typeof extra?.text === 'string' ? extra.text : null;
                            if (textDesc) {
                                textDesc = textDesc.replace(/\s*\((unknown|unknown player|ไม่ระบุ|team)\)/gi, '').trim();
                            }
                            const playerName = event.player_name || (extra?.player_name as string | undefined);
                            const isUnknownPlayer = !playerName || ['team', 'unknown', 'unknown player', 'ไม่ระบุ', 'ไม่ระบุชื่อ'].includes(playerName.trim().toLowerCase());

                            const effectivePlayerId = event.player_id || 
                                ((event.extra_info as Record<string, unknown> | null)?.player_id as string | undefined) ||
                                ((event.detail as Record<string, unknown> | null)?.player_id as string | undefined);
                            const playerObj = getPlayer(effectivePlayerId, playerName);

                            const outPlayer = event.event_type === 'substitution'
                                ? getPlayer(
                                    (event.extra_info as Record<string, unknown> | null)?.out_player_id as string | undefined,
                                    (event.extra_info as Record<string, unknown> | null)?.out_player_name as string | undefined
                                )
                                : undefined;

                            const inPlayer = event.event_type === 'substitution'
                                ? getPlayer(
                                    (event.extra_info as Record<string, unknown> | null)?.in_player_id as string | undefined,
                                    (event.extra_info as Record<string, unknown> | null)?.in_player_name as string | undefined
                                )
                                : undefined;

                            const teamName = isHome
                                ? (match?.home_team?.name || 'Home')
                                : (match?.away_team?.name || 'Away');

                            return (
                                <div
                                    key={event.id}
                                    className={cn(
                                        "relative flex items-center gap-4 group/item w-full px-4 transition-all duration-300",
                                        isNeutral ? "flex-row justify-center" : (isHome ? "flex-row" : "flex-row-reverse"),
                                        event.isPending && "opacity-75 select-none"
                                    )}
                                >
                                    {/* Set Indicator */}
                                    {!isNeutral && (
                                        <div className="w-12 flex flex-col items-center shrink-0">
                                            <span className="text-sm font-bold transition-colors">
                                                SET {setNum}
                                            </span>
                                        </div>
                                    )}

                                    {/* Event Card Content */}
                                    <div className={cn(
                                        "flex-1 min-w-0 transition-all relative rounded-sm py-2",
                                        !isNeutral && (isHome ? "text-left" : "text-right")
                                    )}>
                                        <div className={cn(
                                            "flex items-center w-full",
                                            isNeutral ? "justify-center" : (isHome ? "justify-start" : "justify-end")
                                        )}>
                                            {isNeutral ? (
                                                <div className="flex items-center gap-4 w-full">
                                                    <div className="flex-1 h-[1px] bg-primary/50" />
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-sm font-black tracking-wider text-primary">
                                                            {getEventLabel(event)}
                                                            {event.isPending && ` (${t("pending")})`}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-foreground">
                                                                SET {setNum}
                                                            </span>
                                                                    {!readOnly && onDeleteEvent && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    className="h-6 w-6 text-foreground/20 hover:text-destructive hover:bg-destructive/10 opacity-100 lg:opacity-0 group-hover/item:opacity-100 transition-all shrink-0 ml-1"
                                                                    onClick={() => onDeleteEvent(event.id)}
                                                                    title={isTh ? "ลบ" : "Delete"}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 h-[1px] bg-primary/50" />
                                                </div>
                                            ) : (
                                                <div className={cn(
                                                    "flex items-center gap-4",
                                                    isHome ? "flex-row text-left" : "flex-row-reverse text-right"
                                                )}>
                                                    {/* 1. Event Icon */}
                                                    <div className="flex items-center justify-center shrink-0 w-6">
                                                        {renderEventIcon(event)}
                                                    </div>

                                                    {/* 2. Player Avatar for single player events */}
                                                    {event.event_type !== 'substitution' && !isUnknownPlayer && (
                                                        <PlayerAvatar
                                                            size="sm"
                                                            player={playerObj}
                                                            name={playerName}
                                                            className="shrink-0"
                                                        />
                                                    )}

                                                    {/* 3. Details Container */}
                                                    <div className="min-w-0">
                                                        {/* Player or Substitution Details */}
                                                        {event.event_type === 'substitution' ? (
                                                            <div className={cn(
                                                                "flex items-center gap-3 flex-wrap",
                                                                isHome ? "flex-row justify-start" : "flex-row-reverse justify-start"
                                                            )}>
                                                                {/* Out Player */}
                                                                <div className="flex items-center gap-1.5">
                                                                    <PlayerAvatar size="sm" player={outPlayer} name={String(event.extra_info?.out_player_name || '')} />
                                                                    <span className="text-xs font-bold text-foreground">
                                                                        <span className="text-red-500 mr-1">▼</span>{String(event.extra_info?.out_player_name || t("unknown_player"))}
                                                                    </span>
                                                                </div>

                                                                {/* In Player */}
                                                                <div className="flex items-center gap-1.5">
                                                                    <PlayerAvatar size="sm" player={inPlayer} name={String(event.extra_info?.in_player_name || '')} />
                                                                    <span className="text-xs font-bold text-foreground">
                                                                        <span className="text-emerald-500 mr-1">▲</span>{String(event.extra_info?.in_player_name || t("unknown_player"))}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className={cn(
                                                                "text-xs font-bold tracking-wide flex flex-wrap items-center gap-1.5 text-foreground",
                                                                isHome ? "justify-start" : "justify-end"
                                                            )}>
                                                                {!isUnknownPlayer && playerName ? (
                                                                    <span className="font-bold text-foreground">{playerName}</span>
                                                                ) : (
                                                                    <span className="font-bold text-foreground">{teamName}</span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Event Label Row */}
                                                        {event.event_type !== 'substitution' ? (
                                                            <div className={cn(
                                                                "flex items-center gap-1.5 mt-0.5",
                                                                isHome ? "flex-row justify-start" : "flex-row-reverse justify-start"
                                                            )}>
                                                                <span className={cn(
                                                                    "text-xs font-bold truncate max-w-[150px]",
                                                                    evtConfig?.color || "text-muted-foreground"
                                                                )}>
                                                                    {getEventLabel(event)}
                                                                </span>
                                                                {!isUnknownPlayer && playerName && (
                                                                    <>
                                                                        <span className="text-xs text-muted-foreground">•</span>
                                                                        <span className="text-xs font-semibold text-muted-foreground truncate max-w-[120px]">
                                                                            {teamName}
                                                                        </span>
                                                                    </>
                                                                )}
                                                                {event.isPending && (
                                                                    <span className="text-[10px] text-muted-foreground italic">({t("pending")})</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            event.isPending && (
                                                                <span className="text-[10px] text-muted-foreground italic block mt-0.5">({t("pending")})</span>
                                                            )
                                                        )}

                                                        {!!(event.extra_info as Record<string, unknown> | null)?.reason && (
                                                            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{String((event.extra_info as Record<string, unknown>).reason)}</p>
                                                        )}
                                                    </div>

                                                    {/* 4. Delete Button attached next to the content */}
                                                    {!readOnly && onDeleteEvent && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            className="h-7 w-7 text-foreground/20 hover:text-destructive hover:bg-destructive/10 opacity-100 lg:opacity-0 group-hover/item:opacity-100 transition-all shrink-0 self-center"
                                                            onClick={() => onDeleteEvent(event.id)}
                                                            title={isTh ? "ลบ" : "Delete"}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
