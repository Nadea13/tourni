'use client'

import { useMemo } from "react";
import { Match, MatchEvent, Player } from "@/types";
import { EVENT_TYPES } from "./constants";
import {
    Trash2,
    Clock,
    Hand,
    RotateCw,
    ShieldAlert,
    Shield,
    Flag,
    FlagTriangleRight,
    Stethoscope,
    MonitorPlay
} from "lucide-react";
import { IconBallFootball } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";
import { EmptyState } from "@/components/shared/empty-state";
import { PlayerAvatar } from "@/components/shared/player-avatar";

interface EventLogProps {
    events: MatchEvent[];
    match: Match;
    readOnly?: boolean;
    onDelete?: (eventId: string) => void;
    players?: Player[];
    visibleLogs?: string[];
}

const PERIOD_LIFECYCLE_TYPES = [
    'kick_off',
    'first_half',
    'half_time',
    'second_half',
    'full_time',
    'extra_time',
    'extra_time_half_time',
    'extra_time_second_half',
    'penalties'
];

const isEventVisible = (event: MatchEvent, visibleLogs?: string[], isSecondYellow?: boolean) => {
    if (!visibleLogs) return true;
    const type = event.event_type;
    if (visibleLogs.includes(type)) return true;
    if (isSecondYellow && visibleLogs.includes('red_card')) return true;
    if (type === 'penalty' && visibleLogs.includes('penalty_shot')) return true;
    if (type === 'penalty_shot' && visibleLogs.includes('penalty')) return true;
    if (type === 'miss_cross' && visibleLogs.includes('cross')) return true;
    if (type === 'match_resumed' && visibleLogs.includes('match_paused')) return true;
    if (PERIOD_LIFECYCLE_TYPES.includes(type) && visibleLogs.includes('period_lifecycle')) return true;
    return false;
};

export function EventLog({ events, match, readOnly = false, onDelete, players = [], visibleLogs }: EventLogProps) {
    const t = useTranslations("Console");
    const locale = useLocale();

    // Map each event ID to whether it represents a 2nd yellow card (resulting in a red card)
    const secondYellowMap = useMemo(() => {
        const map = new Map<string, boolean>();
        const playerYellowCounts = new Map<string, number>();

        // Sort events chronologically to track yellow cards in order of occurrence
        const chronological = [...events].sort((a, b) => {
            if (a.minute !== b.minute) return a.minute - b.minute;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        for (const evt of chronological) {
            const extra = ((evt.extra_info || evt.detail || {}) as Record<string, unknown>);
            const isExplicitSecondYellow = Boolean(extra.is_second_yellow);

            if (isExplicitSecondYellow) {
                map.set(evt.id, true);
                continue;
            }

            const isYellow = (evt.event_type || evt.type) === 'yellow_card' ||
                extra.card_type === 'yellow';

            if (!isYellow) continue;

            const playerKey = evt.player_id || extra.player_id || evt.player_name;
            if (!playerKey || playerKey === 'unknown' || playerKey === 'Unknown Player') continue;

            const currentCount = (playerYellowCounts.get(String(playerKey).toLowerCase().trim()) || 0) + 1;
            playerYellowCounts.set(String(playerKey).toLowerCase().trim(), currentCount);

            if (currentCount >= 2) {
                map.set(evt.id, true);
            }
        }
        return map;
    }, [events]);

    const filteredEvents = visibleLogs
        ? events.filter(e => isEventVisible(e, visibleLogs, secondYellowMap.has(e.id)))
        : events;

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

    const getEventLabel = (event: MatchEvent, isSecondYellow?: boolean) => {
        const extra = ((event.extra_info || event.detail || {}) as Record<string, unknown>);
        const type = event.event_type || event.type;

        if (type === 'penalty_shot') {
            return extra.scored !== false ? t("penalty_scored") : t("penalty_missed");
        }

        if (isSecondYellow) {
            return t("second_yellow_red_card") || (locale === 'th' ? "ใบเหลือง-แดง (ใบแดง)" : "Second Yellow (Red Card)");
        }

        if (type === 'goal') {
            if (extra.is_own_goal) {
                return t("own_goal") || (locale === 'th' ? "ทำเข้าประตูตัวเอง" : "Own Goal");
            }
            return t("goal") || (locale === 'th' ? "ประตู" : "Goal");
        }

        if (type === 'yellow_card') {
            return t("yellow_card") || (locale === 'th' ? "ใบเหลือง" : "Yellow Card");
        }

        if (type === 'red_card') {
            return t("red_card") || (locale === 'th' ? "ใบแดง" : "Red Card");
        }

        if (type === 'foul') {
            const cardType = extra.card_type as string | undefined;
            if (cardType === 'yellow') {
                return isSecondYellow
                    ? (t("second_yellow_red_card") || (locale === 'th' ? "ใบเหลือง-แดง (ใบแดง)" : "Second Yellow (Red Card)"))
                    : `${t("foul") || (locale === 'th' ? "ฟาวล์" : "Foul")} (${t("yellow_card") || (locale === 'th' ? "ใบเหลือง" : "Yellow Card")})`;
            }
            if (cardType === 'red') {
                return `${t("foul") || (locale === 'th' ? "ฟาวล์" : "Foul")} (${t("red_card") || (locale === 'th' ? "ใบแดง" : "Red Card")})`;
            }
            return t("foul") || (locale === 'th' ? "ฟาวล์" : "Foul");
        }

        if (type === 'substitution') {
            return t("substitution") || (locale === 'th' ? "เปลี่ยนตัว" : "Substitution");
        }

        const evtConfig = EVENT_TYPES.find(e => e.type === type);
        return t(evtConfig?.label || type);
    };

    const renderEventIcon = (event: MatchEvent, isSecondYellow?: boolean) => {
        const extra = ((event.extra_info || event.detail || {}) as Record<string, unknown>);
        const type = event.event_type || event.type;

        if (type === 'goal') {
            const isOwnGoal = Boolean(extra.is_own_goal);
            return (
                <span
                    className="inline-flex items-center gap-1 shrink-0"
                    title={isOwnGoal ? (t("own_goal") || "ทำเข้าประตูตัวเอง") : (t("goal") || "ประตู")}
                >
                    <IconBallFootball
                        className={cn("size-4.5 shrink-0", isOwnGoal ? "text-destructive" : "text-emerald-500")}
                        stroke={2}
                    />
                </span>
            );
        }

        if (type === 'yellow_card') {
            if (isSecondYellow) {
                return (
                    <span
                        className="inline-flex items-center -space-x-1.5 shrink-0"
                        title={t("second_yellow_red_card") || (locale === 'th' ? "ใบเหลือง-แดง (ใบแดง)" : "Second Yellow (Red Card)")}
                    >
                        <span className="w-3.5 h-4.5 bg-amber-400 rounded-xs border border-amber-500/50 shadow-xs inline-block" />
                        <span className="w-3.5 h-4.5 bg-red-600 rounded-xs border border-red-700/50 shadow-xs inline-block" />
                    </span>
                );
            }
            return (
                <span
                    className="w-3.5 h-4.5 bg-amber-400 rounded-xs border border-amber-500/50 shadow-xs inline-block shrink-0"
                    title={t("yellow_card") || "ใบเหลือง"}
                />
            );
        }

        if (type === 'red_card') {
            if (isSecondYellow) {
                return (
                    <span
                        className="inline-flex items-center -space-x-1.5 shrink-0"
                        title={t("second_yellow_red_card") || (locale === 'th' ? "ใบเหลือง-แดง (ใบแดง)" : "Second Yellow (Red Card)")}
                    >
                        <span className="w-3.5 h-4.5 bg-amber-400 rounded-xs border border-amber-500/50 shadow-xs inline-block" />
                        <span className="w-3.5 h-4.5 bg-red-600 rounded-xs border border-red-700/50 shadow-xs inline-block" />
                    </span>
                );
            }
            return (
                <span
                    className="w-3.5 h-4.5 bg-red-600 rounded-xs border border-red-700/50 shadow-xs inline-block shrink-0"
                    title={t("red_card") || "ใบแดง"}
                />
            );
        }

        if (type === 'foul') {
            const cardType = extra.card_type as string | undefined;
            return (
                <span className="inline-flex items-center gap-1.5 shrink-0" title={t("foul") || "ฟาวล์"}>
                    <Hand className="size-4 text-orange-500 shrink-0" />
                    {cardType === 'yellow' && !isSecondYellow && (
                        <span className="w-3 h-4 bg-amber-400 rounded-xs border border-amber-500/50 shadow-xs inline-block shrink-0" title={t("yellow_card") || "ใบเหลือง"} />
                    )}
                    {(cardType === 'red' || (cardType === 'yellow' && isSecondYellow)) && (
                        <span className="w-3 h-4 bg-red-600 rounded-xs border border-red-700/50 shadow-xs inline-block shrink-0" title={t("red_card") || "ใบแดง"} />
                    )}
                </span>
            );
        }

        if (type === 'substitution') {
            return (
                <span title={t("substitution") || "เปลี่ยนตัว"}>
                    <RotateCw className="size-4 text-blue-500 shrink-0" />
                </span>
            );
        }

        if (type === 'penalty' || type === 'penalty_shot') {
            const isScored = extra.scored !== false;
            return (
                <span className="inline-flex items-center gap-1 shrink-0" title={t("penalty") || "จุดโทษ"}>
                    <ShieldAlert className="size-4 text-indigo-500 shrink-0" />
                    {type === 'penalty_shot' && (
                        <span className={cn("text-[10px] font-black", isScored ? "text-emerald-500" : "text-destructive")}>
                            {isScored ? "✓" : "✕"}
                        </span>
                    )}
                </span>
            );
        }

        if (type === 'corner') {
            return (
                <span title={t("corner") || "เตะมุม"}>
                    <Flag className="size-4 text-foreground/80 shrink-0" />
                </span>
            );
        }

        if (type === 'offside') {
            return (
                <span title={t("offside") || "ล้ำหน้า"}>
                    <FlagTriangleRight className="size-4 text-orange-500 shrink-0" />
                </span>
            );
        }

        if (type === 'save') {
            return (
                <span title={t("save") || "เซฟ"}>
                    <Shield className="size-4 text-teal-500 shrink-0" />
                </span>
            );
        }

        if (type === 'injury') {
            return (
                <span title={t("injury") || "บาดเจ็บ"}>
                    <Stethoscope className="size-4 text-red-500 shrink-0" />
                </span>
            );
        }

        if (type === 'var') {
            return (
                <span title="VAR">
                    <MonitorPlay className="size-4 text-purple-500 shrink-0" />
                </span>
            );
        }

        // Default icon fallback from EVENT_TYPES
        const config = EVENT_TYPES.find(e => e.type === type);
        if (config?.icon) {
            const IconComp = config.icon;
            return (
                <span title={t(config.label || type)}>
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
                    {filteredEvents.length === 0 ? (
                        <EmptyState
                            icon={Clock}
                            title={t("no_events") || "No events yet"}
                            description={events.length > 0 ? (t("no_filtered_events") || "No events matching your log display settings") : (t("live_updates_desc") || "Live match updates will appear here")}
                        />
                    ) : (
                        filteredEvents.map((event: MatchEvent) => {
                            const evtConfig = EVENT_TYPES.find(e => e.type === event.event_type);
                            const globalEventTypes = [
                                'kick_off',
                                'first_half',
                                'half_time',
                                'second_half',
                                'full_time',
                                'extra_time',
                                'extra_time_half_time',
                                'extra_time_second_half',
                                'penalties',
                                'match_paused',
                                'match_resumed',
                                'add_time'
                            ];
                            const isNeutral = !event.team_id || globalEventTypes.includes(event.event_type);
                            const isGoal = event.event_type === 'goal';
                            const isSpecialCentered = isNeutral || isGoal;
                            const isHome = !isNeutral && event.team_id === match.home_team_id;
                            const eventTeam = isHome ? match.home_team : (event.team_id === match.away_team_id ? match.away_team : null);
                            const isUnknownPlayer = 
                                !event.player_name ||
                                event.player_id === 'unknown' ||
                                event.player_name.toLowerCase() === 'unknown' ||
                                event.player_name === 'ไม่ระบุชื่อ' ||
                                event.player_name === 'Unknown Player';

                            const isSecondYellow = secondYellowMap.has(event.id) || Boolean(
                                (event.extra_info as Record<string, unknown> | null)?.is_second_yellow ||
                                (event.detail as Record<string, unknown> | null)?.is_second_yellow
                            );
                            const isEffectivelyRedCard = event.event_type === 'red_card' || isSecondYellow;

                            const effectivePlayerId = event.player_id || 
                                ((event.extra_info as Record<string, unknown> | null)?.player_id as string | undefined) ||
                                ((event.detail as Record<string, unknown> | null)?.player_id as string | undefined);
                            const playerObj = getPlayer(effectivePlayerId, event.player_name);

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
                            
                            return (
                                <div
                                    key={event.id}
                                    className={cn(
                                        "relative flex items-center gap-4 group/item w-full px-4 transition-all duration-300",
                                        isSpecialCentered ? "flex-row justify-center" : (isHome ? "flex-row" : "flex-row-reverse"),
                                        event.isPending && "opacity-75 select-none"
                                    )}
                                >
                                    {/* Minute Indicator (Hidden for neutral and special centered goal events) */}
                                    {!isSpecialCentered && (
                                        <div className="w-10 flex flex-col items-center shrink-0">
                                            <span className="text-sm font-bold transition-colors">
                                                {event.event_type === 'penalty_shot' ? 'PSO' : `${event.minute}'`}
                                            </span>
                                        </div>
                                    )}

                                    <div className={cn(
                                        "flex-1 min-w-0 transition-all relative rounded-sm py-2",
                                        !isSpecialCentered && (isHome ? "text-left" : "text-right")
                                    )}>
                                        <div className={cn(
                                            "flex items-center w-full",
                                            isSpecialCentered ? "justify-center" : (isHome ? "justify-start" : "justify-end")
                                        )}>
                                            {isNeutral ? (
                                                <div className="flex items-center gap-4 w-full">
                                                    <div className="flex-1 h-[1px] bg-primary/50" />
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-sm font-black tracking-wider text-primary">
                                                            {t(evtConfig?.label || event.event_type)}
                                                            {event.isPending && ` (${t("pending")})`}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-foreground">
                                                                {event.minute}&apos;
                                                            </span>
                                                            {!!(event.extra_info as Record<string, unknown> | null)?.added_minutes && (
                                                                <span className="text-sm font-bold text-foreground">
                                                                    (+{String((event.extra_info as Record<string, unknown>).added_minutes)} MIN)
                                                                </span>
                                                            )}
                                                            {!readOnly && onDelete && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    className="h-6 w-6 text-foreground/20 hover:text-destructive hover:bg-destructive/10 opacity-100 lg:opacity-0 group-hover/item:opacity-100 transition-all shrink-0 ml-1"
                                                                    onClick={() => onDelete(event.id)}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 h-[1px] bg-primary/50" />
                                                </div>
                                            ) : isGoal ? (
                                                <div className="flex items-center gap-3 sm:gap-4 w-full my-1.5">
                                                    <div className="flex-1 h-[1px] bg-primary/50" />
                                                    <div className="relative flex flex-col items-center text-center py-1 group/card">
                                                        {/* 1. รูป + (ชื่อ & ชื่อทีมอยู่ใต้ชื่อ) */}
                                                        <div className="flex items-center gap-2.5 text-left">
                                                            <PlayerAvatar
                                                                size="sm"
                                                                player={playerObj}
                                                                name={event.player_name}
                                                                className="shrink-0"
                                                            />
                                                            <div className="flex flex-col min-w-0">
                                                                <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                                                                    <span>{event.player_name || t("unknown_player")}</span>
                                                                    {!!(event.extra_info as Record<string, unknown> | null)?.is_own_goal && (
                                                                        <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-xs border border-destructive/20">
                                                                            {t("own_goal") || "ทำเข้าประตูตัวเอง"}
                                                                            {!!(event.extra_info as Record<string, unknown> | null)?.own_goal_player_name && (
                                                                                <span className="font-semibold ml-1">({String((event.extra_info as Record<string, unknown>).own_goal_player_name)})</span>
                                                                            )}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                                                                    {eventTeam?.logo_url && (
                                                                        <img src={eventTeam.logo_url} alt="" className="size-3.5 object-contain rounded-full" />
                                                                    )}
                                                                    <span>{eventTeam?.name || (isHome ? match.home_team?.name : match.away_team?.name) || "-"}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Goal assist info */}
                                                        {(() => {
                                                            const assistId = (event.extra_info as Record<string, unknown> | null)?.assist_player_id as string | undefined;
                                                            if (!assistId || assistId === 'none') return null;
                                                            const assistName = ((event.extra_info as Record<string, unknown> | null)?.assist_player_name as string | undefined) || 
                                                                players?.find(p => p.id === assistId)?.name;
                                                            if (!assistName) return null;
                                                            return (
                                                                <span className="text-[11px] text-muted-foreground font-medium mt-0.5">
                                                                    {t("assist")}: {assistName}
                                                                </span>
                                                            );
                                                        })()}

                                                        {/* 2. GOALLL!!! Callout */}
                                                        <span className="text-lg font-black tracking-widest text-emerald-500 uppercase mt-1">
                                                            GOALLL!!!
                                                        </span>

                                                        {/* 3. เวลา (Time - plain text, default color, no badge) */}
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-sm font-bold text-foreground">
                                                                {event.minute}&apos;
                                                            </span>
                                                            {event.isPending && (
                                                                <span className="text-[10px] text-muted-foreground italic">({t("pending")})</span>
                                                            )}
                                                            {!readOnly && onDelete && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    className="h-6 w-6 text-foreground/20 hover:text-destructive hover:bg-destructive/10 opacity-100 lg:opacity-0 group-hover/card:opacity-100 transition-all ml-1"
                                                                    onClick={() => onDelete(event.id)}
                                                                    title={t("delete") || "ลบ"}
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
                                                        {renderEventIcon(event, isSecondYellow)}
                                                    </div>

                                                    {/* 2. Player Avatar for single player events */}
                                                    {event.event_type !== 'substitution' && !isUnknownPlayer && (
                                                        <PlayerAvatar
                                                            size="sm"
                                                            player={playerObj}
                                                            name={event.player_name}
                                                            className="shrink-0"
                                                        />
                                                    )}

                                                    <div className="min-w-0">
                                                        {/* Details Row: Player Name or Substitution details */}
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
                                                                {!isUnknownPlayer && <span className="font-bold text-foreground">{event.player_name}</span>}

                                                                {/* Own Goal badge */}
                                                                {!!(event.extra_info as Record<string, unknown> | null)?.is_own_goal && (
                                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-xs border border-destructive/20">
                                                                        {t("own_goal") || "ทำเข้าประตูตัวเอง"}
                                                                        {!!(event.extra_info as Record<string, unknown> | null)?.own_goal_player_name && (
                                                                            <span className="font-semibold">({String((event.extra_info as Record<string, unknown>).own_goal_player_name)})</span>
                                                                        )}
                                                                    </span>
                                                                )}

                                                                {/* Foul extras: penalty, fouled player */}
                                                                {event.event_type === 'foul' && (() => {
                                                                    const isPen = !!(event.extra_info as Record<string, unknown> | null)?.is_penalty;
                                                                    const fouledName = (event.extra_info as Record<string, unknown> | null)?.fouled_player_name as string | undefined;
                                                                    return (
                                                                        <span className="inline-flex flex-wrap items-center gap-1 text-[11px] font-bold text-muted-foreground">
                                                                            {isPen && (
                                                                                <span className="text-destructive font-black bg-destructive/10 px-1.5 py-0.5 rounded-xs border border-destructive/20">
                                                                                    ⚽ {t("penalty")}
                                                                                </span>
                                                                            )}
                                                                            {fouledName && (
                                                                                <span className="text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-xs">
                                                                                    {t("fouled_player")}: {fouledName}
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    );
                                                                })()}

                                                                {/* Goal assist info */}
                                                                {event.event_type === 'goal' && (() => {
                                                                    const assistId = (event.extra_info as Record<string, unknown> | null)?.assist_player_id as string | undefined;
                                                                    if (!assistId || assistId === 'none') return null;
                                                                    const assistName = ((event.extra_info as Record<string, unknown> | null)?.assist_player_name as string | undefined) || 
                                                                        players?.find(p => p.id === assistId)?.name;
                                                                    if (!assistName) return null;
                                                                    const assistPlayer = players?.find(p => p.id === assistId || p.name === assistName);
                                                                    return (
                                                                        <span className="inline-flex items-center gap-1 text-muted-foreground text-[11px] font-semibold bg-muted/40 px-1.5 py-0.5 rounded-xs">
                                                                            {assistPlayer && <PlayerAvatar size="xs" player={assistPlayer} name={assistName} className="size-3.5" showNumberBadge={false} />}
                                                                            <span>{t("assist")}: {assistName}</span>
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </div>
                                                        )}

                                                        {/* Event Label Row (e.g. ใบเหลือง, ใบแดง, ฟาวล์) - hidden for substitution */}
                                                        {event.event_type !== 'substitution' ? (
                                                            <div className={cn(
                                                                "flex items-center gap-1.5 mt-0.5",
                                                                isHome ? "flex-row justify-start" : "flex-row-reverse justify-start"
                                                            )}>
                                                                <span className={cn(
                                                                    "text-xs font-bold truncate max-w-[150px]",
                                                                    event.event_type === 'goal' ? "text-emerald-500" :
                                                                    isEffectivelyRedCard ? "text-red-500" :
                                                                    event.event_type === 'yellow_card' ? "text-amber-500" :
                                                                    event.event_type === 'foul' ? "text-orange-500" :
                                                                    "text-muted-foreground"
                                                                )}>
                                                                    {getEventLabel(event, isSecondYellow)}
                                                                </span>
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

                                                    {/* Delete Button directly attached next to the content */}
                                                    {!readOnly && onDelete && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            className="h-7 w-7 text-foreground/20 hover:text-destructive hover:bg-destructive/10 opacity-100 lg:opacity-0 group-hover/item:opacity-100 transition-all shrink-0 self-center"
                                                            onClick={() => onDelete(event.id)}
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
