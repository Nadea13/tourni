"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { Trophy, Calendar, ArrowLeft, Award, Pin, MapPin, Users, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tab } from "@/components/ui/tab";
import { Standings } from "@/features/tournaments/ranking/standings";
import { MatchManager } from "@/features/tournaments/matches/match-manager";
import { StandingsGroups } from "@/features/tournaments/ranking/standings-groups";
import { Match, MatchEvent, EventType, Team, Goal, Tournament, Player, Announcement } from "@/types";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname, Link } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/dropdown";
import { Sponsor } from "@/actions/tournaments/sponsor";
import { Header } from "@/components/ui/header";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, subDays, addMonths, subMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { formatDate } from "@/lib/date";
import { useMatchWebSocket } from "@/hooks/use-match-websocket";
import { PlayerStatModal, PlayerStatDetail } from "./player-stat-modal";
import { PlayerAvatar } from "@/components/shared/player-avatar";

function parsePlayerAge(bDateStr: string | null | undefined): number | undefined {
    if (!bDateStr) return undefined;
    try {
        const d = new Date(bDateStr);
        if (isNaN(d.getTime())) return undefined;
        const now = new Date();
        const age = now.getFullYear() - d.getFullYear();
        return age >= 0 ? age : undefined;
    } catch {
        return undefined;
    }
}

interface PublicTournamentShellProps {
    tournament: Tournament;
    initialTeams: Team[];
    initialMatches: Match[];
    initialEvents: MatchEvent[];
    initialGoals: Goal[];
    initialPlayers: Player[];
    categories?: { id: string; name: string }[];
    selectedCategoryId?: string;
    announcements?: Announcement[];
    sponsors?: Sponsor[];
}

export function PublicTournamentShell({
    tournament: initialTournament,
    initialTeams,
    initialMatches,
    initialEvents,
    initialPlayers = [],
    categories = [],
    selectedCategoryId,
    announcements = [],
    sponsors = []
}: PublicTournamentShellProps) {
    const t = useTranslations("PublicView");
    const tTournament = useTranslations("Tournament");
    const locale = useLocale();
    const [matches, setMatches] = useState<Match[]>(initialMatches);
    const [events, setEvents] = useState<MatchEvent[]>(initialEvents);
    const [tournament, setTournament] = useState(initialTournament);
    const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<PlayerStatDetail | null>(null);

    useEffect(() => {
        setMatches(initialMatches);
    }, [initialMatches]);

    useEffect(() => {
        setEvents(initialEvents);
    }, [initialEvents]);

    useEffect(() => {
        setTournament(initialTournament);
    }, [initialTournament]);

    // 100% Realtime WebSocket Connection for Tournament Matches & Events
    useMatchWebSocket("all", {
        onMatchEvent: ({ event }) => {
            if (!event || !event.match_id) return;
            const belongsToTournament = matches.some(m => m.id === event.match_id);
            if (!belongsToTournament) return;

            const eventType = event.type || event.event_type || 'goal';
            const detailObj = event.detail || event.extra_info || {};
            const normalizedEvent: MatchEvent = {
                ...event,
                type: eventType as EventType,
                event_type: eventType as EventType,
                detail: detailObj,
                extra_info: detailObj,
                player_name: String(event.player_name || detailObj.player_name || "Unknown Player"),
                team_name: (event as any).team_name || detailObj.team_name,
                team_logo: (event as any).team_logo || detailObj.team_logo
            };

            setEvents(prev => {
                const exists = prev.some(e => e.id === normalizedEvent.id);
                if (exists) return prev;
                return [...prev, normalizedEvent];
            });
        },
        onMatchEventDelete: ({ event_id, match_id }) => {
            if (!match_id) return;
            const belongsToTournament = matches.some(m => m.id === match_id);
            if (!belongsToTournament) return;

            setEvents(prev => prev.filter(e => e.id !== event_id));
        },
        onScoreUpdate: ({ match_id, home_score, away_score, status }) => {
            if (!match_id) return;
            setMatches(prev => prev.map(m => {
                if (m.id === match_id) {
                    return {
                        ...m,
                        home_score,
                        away_score,
                        status: (status || m.status) as any
                    };
                }
                return m;
            }));
        },
        onStatusChange: ({ match_id, status }) => {
            if (!match_id) return;
            setMatches(prev => prev.map(m => {
                if (m.id === match_id) {
                    return { ...m, status: status as any };
                }
                return m;
            }));
        },
        onMatchUpdate: ({ match }) => {
            if (!match?.id) return;
            const penalty_home_score = match.penalty_home_score ??
                match.home_penalty_score ??
                match.score_detail?.penalty_home_score ??
                match.score_detail?.home_penalty_score;
            const penalty_away_score = match.penalty_away_score ??
                match.away_penalty_score ??
                match.score_detail?.penalty_away_score ??
                match.score_detail?.away_penalty_score;
            const winner_id = match.winner_id || match.winner_to_node_id || match.score_detail?.winner_id;
            const normalizedMatch = {
                ...match,
                penalty_home_score,
                penalty_away_score,
                winner_id
            };
            setMatches(prev => {
                const idx = prev.findIndex(m => m.id === match.id);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = { ...updated[idx], ...normalizedMatch };
                    return updated;
                }
                return [...prev, normalizedMatch];
            });
        },
        onStandingsSync: () => {
            router.refresh();
        }
    });

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Match Filter & Date States (matches Schedule view)
    const [matchSelectedDate, setMatchSelectedDate] = useState<string | null>(null);
    const [matchFilterStage, setMatchFilterStage] = useState<string>("all");
    const [matchFilterTeam, setMatchFilterTeam] = useState<string>("all");
    const [matchViewDate, setMatchViewDate] = useState(new Date());
    const [isMatchCalendarOpen, setIsMatchCalendarOpen] = useState(false);

    const datesWithMatches = useMemo(() => {
        return new Set(matches.map(m => m.match_date).filter(Boolean));
    }, [matches]);

    const calendarDays = useMemo(() => {
        const days = [];
        const startOfViewMonth = startOfMonth(matchViewDate);
        const endOfViewMonth = endOfMonth(matchViewDate);
        const firstDay = getDay(startOfViewMonth);

        for (let i = 0; i < firstDay; i++) days.push(null);
        const interval = eachDayOfInterval({ start: startOfViewMonth, end: endOfViewMonth });
        interval.forEach(day => days.push(day));
        return days;
    }, [matchViewDate]);

    const goToPrevDay = () => {
        const current = matchSelectedDate ? new Date(matchSelectedDate) : new Date();
        const prev = subDays(current, 1);
        setMatchSelectedDate(format(prev, 'yyyy-MM-dd'));
    };

    const goToNextDay = () => {
        const current = matchSelectedDate ? new Date(matchSelectedDate) : new Date();
        const next = addDays(current, 1);
        setMatchSelectedDate(format(next, 'yyyy-MM-dd'));
    };

    const groupNodes = useMemo(() => {
        return tournament.canvas_data?.nodes?.filter(n => n.type === 'groupNode') || [];
    }, [tournament.canvas_data]);

    const filteredMatchesForDisplay = useMemo(() => {
        if (matchFilterTeam === "all") return matches;
        return matches.filter(m => {
            const selTeam = initialTeams.find(t => t.id === matchFilterTeam);
            const targetIds = selTeam
                ? [selTeam.id, (selTeam as { team_id?: string }).team_id].filter(Boolean) as string[]
                : [matchFilterTeam];
            return (
                targetIds.includes(m.home_team_id || "") ||
                targetIds.includes(m.away_team_id || "") ||
                (m.home_team?.id && targetIds.includes(m.home_team.id)) ||
                (m.away_team?.id && targetIds.includes(m.away_team.id))
            );
        });
    }, [matches, matchFilterTeam, initialTeams]);

    const canvasStandings = useMemo(() => {
        if (!tournament.canvas_data || !tournament.canvas_data.nodes) return null;

        const standingNodes = tournament.canvas_data.nodes.filter(n => n.type === 'standingNode');
        if (standingNodes.length === 0) return null;

        const edges = tournament.canvas_data.edges || [];
        const nodes = tournament.canvas_data.nodes;

        return standingNodes.map(node => {
            const nodeData = node.data as Record<string, unknown>;
            const label = (nodeData?.label as string) || "Standings";

            const sourceEdge = edges.find(e => e.target === node.id && e.targetHandle === 'in');
            const sourceGroupNode = sourceEdge ? nodes.find(n => n.id === sourceEdge.source) : null;

            let nodeTeams: string[] = [];
            if (!sourceGroupNode || sourceGroupNode.type !== 'groupNode') {
                const teams = Array.isArray(nodeData?.teams) ? (nodeData.teams as string[]) : [];
                nodeTeams = teams.filter((name: string) => name && name !== "TBD");
            } else {
                const sourceData = sourceGroupNode.data as Record<string, unknown>;
                const teamCount = (sourceData?.teamCount as number) || 0;
                const staticTeams = (sourceData?.teams as string[]) || [];

                nodeTeams = Array.from({ length: teamCount }).map((_, index) => {
                    const handleId = `team-in-${index}`;
                    const edge = edges.find(e => e.target === sourceGroupNode.id && e.targetHandle === handleId);

                    if (!edge) return staticTeams[index] || "TBD";

                    const sNode = nodes.find(n => n.id === edge.source);
                    if (!sNode) return staticTeams[index] || "TBD";

                    if (sNode.type === 'standingNode' || sNode.type === 'groupNode') {
                        const rankMatch = edge.sourceHandle?.match(/rank-(\d+)/);
                        if (rankMatch) {
                            const rankIndex = parseInt(rankMatch[1], 10);
                            const sData = sNode.data as Record<string, unknown>;
                            const rankings = (sData?.rankings as string[]) || [];
                            if (rankings[rankIndex]) return rankings[rankIndex];
                            const rankSuffix = rankIndex === 0 ? "1st" : rankIndex === 1 ? "2nd" : rankIndex === 2 ? "3rd" : `${rankIndex + 1}th`;
                            return `${rankSuffix} Place (${(sData?.label as string) || ""})`;
                        }
                    }

                    return staticTeams[index] || `Team ${index + 1}`;
                }).filter(name => name && name !== "TBD");
            }

            // Map IDs to names for easier lookup (both team_id and id to handle matches referencing teams)
            const teamIdToName = new Map<string, string>();
            initialTeams.forEach((t) => {
                if (t.name) {
                    const tObj = t as unknown as Record<string, unknown>;
                    if (typeof tObj.team_id === 'string') teamIdToName.set(tObj.team_id, t.name);
                    if (t.id) teamIdToName.set(t.id, t.name);
                }
            });

            // Initialize stats map for all teams in this node (by name)
            const statsMap: Record<string, {
                name: string;
                logo_url?: string;
                team_id?: string;
                mp: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number;
            }> = {};

            nodeTeams.forEach((name, index) => {
                const key = name === "TBD" ? `TBD-${index}` : name;
                const dbTeam = initialTeams.find(t => t.name === name);
                statsMap[key] = {
                    name,
                    logo_url: dbTeam?.logo_url ?? undefined,
                    team_id: dbTeam?.id,
                    mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0
                };
            });

            // Calculate stats from matches
            const findStats = (rawName?: string | null) => {
                if (!rawName) return undefined;
                const trimmed = rawName.trim();
                if (statsMap[trimmed]) return statsMap[trimmed];
                const lower = trimmed.toLowerCase();
                for (const key of Object.keys(statsMap)) {
                    if (key.trim().toLowerCase() === lower) {
                        return statsMap[key];
                    }
                }
                return undefined;
            };

            matches.forEach(m => {
                const matchObj = m as unknown as Record<string, unknown>;
                const homeName = m.home_team?.name || (m.home_team_id ? teamIdToName.get(m.home_team_id) : null) || (matchObj.placeholder_home as string) || m.placeholder_a;
                const awayName = m.away_team?.name || (m.away_team_id ? teamIdToName.get(m.away_team_id) : null) || (matchObj.placeholder_away as string) || m.placeholder_b;

                if (!homeName || !awayName) return;

                const h = findStats(homeName);
                const a = findStats(awayName);

                const isPlayed = m.status === 'finished' || m.status === 'completed' || m.status === 'live' || m.status === 'first_half' || m.status === 'second_half' || m.status === 'half_time' || m.status === 'extra_time' || m.status === 'penalties';
                if (isPlayed) {
                    if (h && a) {
                        const hScore = typeof m.home_score === 'object' && m.home_score !== null && 'total' in m.home_score ? Number((m.home_score as { total?: number }).total) || 0 : Number(m.home_score) || 0;
                        const aScore = typeof m.away_score === 'object' && m.away_score !== null && 'total' in m.away_score ? Number((m.away_score as { total?: number }).total) || 0 : Number(m.away_score) || 0;

                        h.mp++; a.mp++;
                        h.gf += hScore; h.ga += aScore;
                        a.gf += aScore; a.ga += hScore;

                        if (hScore > aScore) {
                            h.w++; h.pts += 3;
                            a.l++;
                        } else if (hScore < aScore) {
                            a.w++; a.pts += 3;
                            h.l++;
                        } else {
                            h.d++; h.pts += 1;
                            a.d++; a.pts += 1;
                        }
                    }
                }
            });

            const calculated = Object.values(statsMap).map((s) => ({
                tournament_id: tournament.id,
                team_id: s.team_id || s.name,
                team: {
                    name: s.name,
                    logo_url: s.logo_url
                },
                played: s.mp,
                won: s.w,
                drawn: s.d,
                lost: s.l,
                gf: s.gf,
                ga: s.ga,
                gd: s.gf - s.ga,
                pts: s.pts
            })).sort((a, b) => {
                if (b.pts !== a.pts) return b.pts - a.pts;
                if (b.gd !== a.gd) return b.gd - a.gd;
                return b.gf - a.gf;
            });

            return {
                label,
                standings: calculated
            };
        });
    }, [tournament.canvas_data, initialTeams, matches, tournament.id]);

    const resolveTeam = useCallback((teamId: string | null) => {
        if (!teamId) return null;
        return initialTeams.find(t => t.id === teamId || (t as Team & { team_id?: string }).team_id === teamId);
    }, [initialTeams]);

    const playerStats = useMemo(() => {
        const playersMap = new Map<string, PlayerStatDetail>();

        const getOrCreatePlayer = (playerId: string, playerName: string, teamId: string | null, fallbackTeamName?: string, fallbackTeamLogo?: string | null) => {
            if (!playersMap.has(playerId)) {
                const team = resolveTeam(teamId);
                const teamName = team?.name || fallbackTeamName || "Unknown Team";
                const teamLogo = team?.logo_url || fallbackTeamLogo || null;
                const matchedPlayer = initialPlayers.find(p => p.id === playerId || p.master_player_id === playerId || p.name === playerName);
                const birthDate = matchedPlayer?.birth_date || (matchedPlayer as any)?.birthday || matchedPlayer?.master_player?.birthday || null;
                const age = birthDate ? (() => {
                    try {
                        const d = new Date(birthDate);
                        if (isNaN(d.getTime())) return null;
                        const diff = Date.now() - d.getTime();
                        return Math.abs(new Date(diff).getUTCFullYear() - 1970);
                    } catch { return null; }
                })() : null;

                playersMap.set(playerId, {
                    id: playerId,
                    name: playerName,
                    teamId: team?.id || (team as any)?.team_id || teamId || matchedPlayer?.team_id || null,
                    teamName,
                    teamLogo,
                    goals: 0,
                    assists: 0,
                    fouls: 0,
                    foulsDrawn: 0,
                    yellowCards: 0,
                    redCards: 0,
                    saves: 0,
                    injuries: 0,
                    subIn: 0,
                    subOut: 0,
                    ownGoals: 0,
                    penaltiesScored: 0,
                    number: matchedPlayer?.number ?? (matchedPlayer as any)?.shirt_number ?? null,
                    position: matchedPlayer?.position ?? null,
                    photo_url: matchedPlayer?.photo_url || (matchedPlayer as any)?.profile_img || (matchedPlayer as any)?.master_player?.profile_img || (matchedPlayer as any)?.global_player?.photo_url || (matchedPlayer as any)?.global_player?.profile_img || null,
                    birthDate,
                    age,
                    nickname: (matchedPlayer as any)?.master_player?.nickname || (matchedPlayer as any)?.nickname || null,
                    preferredFoot: (matchedPlayer as any)?.master_player?.preferred_foot || null,
                    gender: (matchedPlayer as any)?.master_player?.gender || null,
                    matchesPlayed: 0
                });
            }
            const existing = playersMap.get(playerId)!;
            if ((existing.name === "Unknown Player" || existing.name === "Unknown") && playerName && playerName !== "Unknown Player" && playerName !== "Unknown") {
                existing.name = playerName;
            }
            if (existing.teamName === "Unknown Team") {
                const team = resolveTeam(teamId);
                if (team?.name) {
                    existing.teamName = team.name;
                    existing.teamLogo = team.logo_url || null;
                    if (!existing.teamId) existing.teamId = team.id || (team as any).team_id || null;
                } else if (fallbackTeamName && fallbackTeamName !== "Unknown Team") {
                    existing.teamName = fallbackTeamName;
                    existing.teamLogo = fallbackTeamLogo || null;
                }
            }
            if (!existing.photo_url || existing.number === undefined || existing.number === null) {
                const matchedPlayer = initialPlayers.find(p => p.id === playerId || p.master_player_id === playerId || p.name === playerName);
                if (matchedPlayer) {
                    if (!existing.photo_url) {
                        existing.photo_url = matchedPlayer.photo_url || (matchedPlayer as any)?.profile_img || (matchedPlayer as any)?.master_player?.profile_img || (matchedPlayer as any)?.global_player?.photo_url || (matchedPlayer as any)?.global_player?.profile_img || null;
                    }
                    if (existing.number === undefined || existing.number === null) {
                        existing.number = matchedPlayer.number ?? (matchedPlayer as any)?.shirt_number ?? null;
                    }
                    if (!existing.position) existing.position = matchedPlayer.position ?? null;
                    if (!existing.birthDate) {
                        const bDate = matchedPlayer.birth_date || (matchedPlayer as any).birthday || matchedPlayer.master_player?.birthday || null;
                        existing.birthDate = bDate;
                        if (bDate) {
                            const calculatedAge = parsePlayerAge(bDate);
                            if (calculatedAge !== undefined) existing.age = calculatedAge;
                        }
                    }
                    if (!existing.nickname) existing.nickname = (matchedPlayer as any).master_player?.nickname || null;
                    if (!existing.preferredFoot) existing.preferredFoot = (matchedPlayer as any).master_player?.preferred_foot || null;
                    if (!existing.gender) existing.gender = (matchedPlayer as any).master_player?.gender || null;
                }
            }
            return existing;
        };

        const matchPlayerYellows = new Map<string, number>();

        // Sort events chronologically to properly detect match-specific card sequences
        const sortedEvents = [...events].sort((a, b) => {
            const timeA = new Date(a.created_at || 0).getTime();
            const timeB = new Date(b.created_at || 0).getTime();
            if (a.minute !== b.minute) return a.minute - b.minute;
            return timeA - timeB;
        });

        sortedEvents.forEach(event => {
            const rawPlayerId = event.player_id || (event.extra_info?.player_id as string) || (event.detail?.player_id as string);
            const extraName = (event.extra_info?.player_name as string) || (event.detail?.player_name as string) || (event as any).player_name;
            const matchedPlayer = rawPlayerId ? initialPlayers.find(p => p.id === rawPlayerId || p.master_player_id === rawPlayerId) : null;
            const playerName = (extraName && extraName !== "Unknown") ? extraName : (matchedPlayer?.name || (rawPlayerId ? "Unknown Player" : null));

            // Skip if no player could be identified
            if (!rawPlayerId && !playerName) return;

            const effectivePlayerId = rawPlayerId ? String(rawPlayerId) : `name-${playerName}`;
            const effectivePlayerName = playerName || "Unknown Player";
            const effectiveTeamId = event.team_id || matchedPlayer?.team_id || null;
            const fallbackTeamName = (event as any).team_name || (event.extra_info?.team_name as string) || (event.detail?.team_name as string);
            const fallbackTeamLogo = (event as any).team_logo || (event.extra_info?.team_logo as string) || (event.detail?.team_logo as string);

            // 1. Process Goals
            if (event.event_type === 'goal' || event.event_type === 'penalty_goal' || event.event_type === 'own_goal') {
                const isOwnGoal = event.event_type === 'own_goal' || !!(event.extra_info?.is_own_goal || event.detail?.is_own_goal);
                const isPenalty = event.event_type === 'penalty_goal' || !!(event.extra_info?.is_penalty || event.detail?.is_penalty);

                if (isOwnGoal) {
                    const ogPlayerId = (event.extra_info?.own_goal_player_id as string) || (event.detail?.own_goal_player_id as string) || effectivePlayerId;
                    const ogPlayerName = (event.extra_info?.own_goal_player_name as string) || (event.detail?.own_goal_player_name as string) || effectivePlayerName;
                    const player = getOrCreatePlayer(ogPlayerId, ogPlayerName, effectiveTeamId, fallbackTeamName, fallbackTeamLogo);
                    player.ownGoals = (player.ownGoals || 0) + 1;
                } else {
                    const player = getOrCreatePlayer(effectivePlayerId, effectivePlayerName, effectiveTeamId, fallbackTeamName, fallbackTeamLogo);
                    player.goals++;
                    if (isPenalty) {
                        player.penaltiesScored = (player.penaltiesScored || 0) + 1;
                    }

                    // Check for assist in goal event extra_info / detail
                    const assistPlayerId = (event.extra_info?.assist_player_id as string) || (event.detail?.assist_player_id as string);
                    const assistPlayerName = (event.extra_info?.assist_player_name as string) || (event.detail?.assist_player_name as string);

                    if ((assistPlayerId && assistPlayerId !== 'none') || (assistPlayerName && assistPlayerName !== 'none')) {
                        const matchedAssistPlayer = assistPlayerId ? initialPlayers.find(p => p.id === assistPlayerId || p.master_player_id === assistPlayerId) : null;
                        const aName = (assistPlayerName && assistPlayerName !== 'none') ? assistPlayerName : (matchedAssistPlayer?.name || "Unknown Player");
                        const aId = assistPlayerId && assistPlayerId !== 'none' ? String(assistPlayerId) : `name-${aName}`;
                        const aTeamId = matchedAssistPlayer?.team_id || effectiveTeamId;
                        const assistPlayerObj = getOrCreatePlayer(aId, aName, aTeamId, fallbackTeamName, fallbackTeamLogo);
                        assistPlayerObj.assists++;
                    }
                }
            }
            // 2. Process Yellow Cards
            else if (event.event_type === 'yellow_card') {
                const player = getOrCreatePlayer(effectivePlayerId, effectivePlayerName, effectiveTeamId, fallbackTeamName, fallbackTeamLogo);
                player.yellowCards++;

                const isExplicitSecondYellow = Boolean(
                    (event.extra_info as Record<string, unknown> | null)?.is_second_yellow ||
                    (event.detail as Record<string, unknown> | null)?.is_second_yellow
                );
                const matchKey = `${event.match_id}-${effectivePlayerId}`;
                const count = (matchPlayerYellows.get(matchKey) || 0) + 1;
                matchPlayerYellows.set(matchKey, count);

                if (isExplicitSecondYellow || count >= 2) {
                    player.redCards++;
                }
            }
            // 3. Process Red Cards
            else if (event.event_type === 'red_card') {
                const player = getOrCreatePlayer(effectivePlayerId, effectivePlayerName, effectiveTeamId, fallbackTeamName, fallbackTeamLogo);
                player.redCards++;

                const isExplicitSecondYellow = Boolean(
                    (event.extra_info as Record<string, unknown> | null)?.is_second_yellow ||
                    (event.detail as Record<string, unknown> | null)?.is_second_yellow
                );
                if (isExplicitSecondYellow) {
                    player.yellowCards++;
                }
            }
            // 4. Process Saves
            else if (event.event_type === 'save') {
                const player = getOrCreatePlayer(effectivePlayerId, effectivePlayerName, effectiveTeamId, fallbackTeamName, fallbackTeamLogo);
                player.saves++;
            }
            // 5. Process Injuries
            else if (event.event_type === 'injury') {
                const player = getOrCreatePlayer(effectivePlayerId, effectivePlayerName, effectiveTeamId, fallbackTeamName, fallbackTeamLogo);
                player.injuries++;
            }
            // 6. Process Substitutions
            else if (event.event_type === 'substitution') {
                const outId = (event.extra_info?.out_player_id as string) || (event.detail?.out_player_id as string) || effectivePlayerId;
                const outName = (event.extra_info?.out_player_name as string) || (event.detail?.out_player_name as string) || effectivePlayerName;
                const inId = (event.extra_info?.in_player_id as string) || (event.detail?.in_player_id as string);
                const inName = (event.extra_info?.in_player_name as string) || (event.detail?.in_player_name as string);

                if (outId || outName) {
                    const outPlayer = getOrCreatePlayer(outId || `name-${outName}`, outName || "Unknown Player", effectiveTeamId, fallbackTeamName, fallbackTeamLogo);
                    outPlayer.subOut = (outPlayer.subOut || 0) + 1;
                }
                if (inId || inName) {
                    const inPlayer = getOrCreatePlayer(inId || `name-${inName}`, inName || "Unknown Player", effectiveTeamId, fallbackTeamName, fallbackTeamLogo);
                    inPlayer.subIn = (inPlayer.subIn || 0) + 1;
                }
            }
            // 7. Process Fouls (Committed, Cards, and Fouls Drawn / เรียกฟาวล์)
            else if (event.event_type === 'foul') {
                const player = getOrCreatePlayer(effectivePlayerId, effectivePlayerName, effectiveTeamId, fallbackTeamName, fallbackTeamLogo);
                player.fouls++;

                const foulCard = ((event.extra_info as Record<string, unknown> | null)?.card_type || (event.detail as Record<string, unknown> | null)?.card_type) as string | undefined;
                if (foulCard === 'yellow') {
                    player.yellowCards++;
                    const isExplicitSecondYellow = Boolean(
                        (event.extra_info as Record<string, unknown> | null)?.is_second_yellow ||
                        (event.detail as Record<string, unknown> | null)?.is_second_yellow
                    );
                    const matchKey = `${event.match_id}-${effectivePlayerId}`;
                    const count = (matchPlayerYellows.get(matchKey) || 0) + 1;
                    matchPlayerYellows.set(matchKey, count);

                    if (isExplicitSecondYellow || count >= 2) {
                        player.redCards++;
                    }
                } else if (foulCard === 'red') {
                    player.redCards++;
                }

                // Check for fouled opponent player (เรียกฟาวล์)
                const fouledPlayerId = (event.extra_info?.fouled_player_id as string) || (event.detail?.fouled_player_id as string);
                const fouledPlayerName = (event.extra_info?.fouled_player_name as string) || (event.detail?.fouled_player_name as string);
                if ((fouledPlayerId && fouledPlayerId !== 'none') || (fouledPlayerName && fouledPlayerName !== 'none')) {
                    const matchedFouledPlayer = fouledPlayerId ? initialPlayers.find(p => p.id === fouledPlayerId || p.master_player_id === fouledPlayerId) : null;
                    const fName = (fouledPlayerName && fouledPlayerName !== 'none') ? fouledPlayerName : (matchedFouledPlayer?.name || "Unknown Player");
                    const fId = fouledPlayerId && fouledPlayerId !== 'none' ? String(fouledPlayerId) : `name-${fName}`;
                    const fTeamId = matchedFouledPlayer?.team_id || null;
                    const fouledPlayerObj = getOrCreatePlayer(fId, fName, fTeamId);
                    fouledPlayerObj.foulsDrawn = (fouledPlayerObj.foulsDrawn || 0) + 1;
                }
            }
        });

        const allStats = Array.from(playersMap.values());

        // Calculate matches played for each player
        allStats.forEach(p => {
            let count = 0;
            matches.forEach(m => {
                const isTeamMatch = (m.status === 'finished' || m.status === 'live') && (
                    (p.teamId && (m.home_team_id === p.teamId || m.away_team_id === p.teamId)) ||
                    (p.teamName && (m.home_team?.name === p.teamName || m.away_team?.name === p.teamName))
                );
                const hasPlayerEvent = events.some(e => e.match_id === m.id && (
                    e.player_id === p.id ||
                    (e.extra_info?.player_id as string) === p.id ||
                    (e.detail?.player_id as string) === p.id ||
                    (e.extra_info?.player_name as string) === p.name ||
                    (e.detail?.player_name as string) === p.name ||
                    (e.extra_info?.assist_player_id as string) === p.id ||
                    (e.detail?.assist_player_id as string) === p.id ||
                    (e.extra_info?.assist_player_name as string) === p.name ||
                    (e.extra_info?.fouled_player_id as string) === p.id ||
                    (e.extra_info?.fouled_player_name as string) === p.name ||
                    (e.extra_info?.in_player_id as string) === p.id ||
                    (e.extra_info?.in_player_name as string) === p.name ||
                    (e.extra_info?.out_player_id as string) === p.id ||
                    (e.extra_info?.out_player_name as string) === p.name
                ));
                if (isTeamMatch || hasPlayerEvent) {
                    count++;
                }
            });
            p.matchesPlayed = count;
        });

        const scorers = [...allStats]
            .filter(p => p.goals > 0)
            .sort((a, b) => b.goals - a.goals || b.assists - a.assists);

        const assists = [...allStats]
            .filter(p => p.assists > 0)
            .sort((a, b) => b.assists - a.assists || b.goals - a.goals);

        const yellowCards = [...allStats]
            .filter(p => p.yellowCards > 0)
            .sort((a, b) => b.yellowCards - a.yellowCards || b.redCards - a.redCards);

        const redCards = [...allStats]
            .filter(p => p.redCards > 0)
            .sort((a, b) => b.redCards - a.redCards || b.yellowCards - a.yellowCards);

        const saves = [...allStats]
            .filter(p => p.saves > 0)
            .sort((a, b) => b.saves - a.saves);

        const injuries = [...allStats]
            .filter(p => p.injuries > 0)
            .sort((a, b) => b.injuries - a.injuries);

        return { scorers, assists, yellowCards, redCards, saves, injuries };
    }, [events, initialPlayers, resolveTeam]);

    const hasStandings = useMemo(() => {
        if (canvasStandings && canvasStandings.length > 0) return true;
        const hasGroups = initialTeams.some(t => t.group_name && t.group_name !== "Unassigned");
        return hasGroups;
    }, [canvasStandings, initialTeams]);

    const currentTab = searchParams.get('tab') || 'overview';

    const handleTabChange = useCallback((value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === 'overview') {
            params.delete('tab');
        } else {
            params.set('tab', value);
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, pathname, router]);

    // Fallback if current active tab is standings but hasStandings is false
    useEffect(() => {
        if (!hasStandings && currentTab === 'standings') {
            handleTabChange('overview');
        }
    }, [hasStandings, currentTab, handleTabChange]);

    const handleCategoryChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('category_id', value);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    useEffect(() => {
        const interval = setInterval(() => {
            router.refresh();
        }, 15000);

        return () => {
            clearInterval(interval);
        };
    }, [router]);

    const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    const tabOptions = useMemo(() => {
        const options = [
            { value: 'overview', label: t("overview"), icon: Trophy },
        ];
        if (hasStandings) {
            options.push({ value: 'standings', label: t("league_table"), icon: Award });
        }
        options.push(
            { value: 'matches', label: t("matches"), icon: Calendar },
            { value: 'stats', label: t("player_stats"), icon: Users }
        );
        return options;
    }, [hasStandings, t]);

    return (
        <main className="container mx-auto px-2 md:px-0 pb-2 md:pb-4 max-w-7xl space-y-4">
            {/* Unified Header Block - Styled like squad-management */}
            <div className="flex md:items-center justify-between">
                <div className="flex items-center gap-1 md:gap-2">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        asChild
                        className="shrink-0 hover:bg-primary/10 hover:text-primary transition-all"
                    >
                        <Link href="/">
                            <ArrowLeft className="size-4" />
                        </Link>
                    </Button>
                    <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-1 md:gap-2">
                            <Header level={2}>{tournament?.name}</Header>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 lg:gap-2 shrink-0 self-end md:self-auto">
                    {/* Public Navigation */}
                    <Tab
                        value={currentTab}
                        onChange={handleTabChange}
                        className="w-full"
                        itemClassName="flex-1 md:flex-none"
                        options={tabOptions}
                    />
                    {categories.length > 0 && (
                        <div className="flex items-center gap-2 w-fit md:w-auto max-w-[280px]">
                            <Select value={selectedCategoryId} onValueChange={handleCategoryChange}>
                                <SelectTrigger size="sm" className="bg-card border h-9 text-xs">
                                    <SelectValue placeholder={tTournament("select_category")} />
                                </SelectTrigger>
                                <SelectContent className="bg-card">
                                    {categories.map((c) => (
                                        <SelectItem key={c.id} value={c.id} className="text-xs">
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </div>

            {currentTab === 'overview' && (
                <div className="space-y-2 md:space-y-4">
                    {/* Tournament Banner & Profile Logo */}
                    <div className="relative border rounded-sm overflow-hidden bg-card">
                        {/* Cover Image */}
                        <div className="w-full aspect-2/1 lg:aspect-3/1 overflow-hidden shadow-inner bg-muted/20 relative">
                            {(tournament.cover_img || tournament.banner_url) ? (
                                <Image
                                    src={tournament.cover_img || tournament.banner_url || ""}
                                    alt={tournament.name}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-background to-primary/5 flex items-center justify-center">
                                    <Trophy className="h-10 w-10 md:h-16 md:w-16 text-muted-foreground/20" />
                                </div>
                            )}
                        </div>

                        {/* Profile Logo & Info */}
                        <div className="p-4 flex flex-col items-center text-center gap-1 lg:gap-2 relative z-10 -mt-10 md:-mt-16 p-2 lg:p-4">
                            {/* Logo */}
                            <div className="w-20 h-20 md:w-32 md:h-32 rounded-full border-4 lg:border-8 border-card bg-card overflow-hidden flex items-center justify-center shrink-0 shadow-lg relative z-20 mx-auto">
                                {(tournament.logo_img || tournament.logo_url) ? (
                                    <Image
                                        src={tournament.logo_img || tournament.logo_url || ""}
                                        alt={tournament.name}
                                        width={128}
                                        height={128}
                                        className="w-full h-full object-contain rounded-full"
                                    />
                                ) : (
                                    <span className="font-black text-2xl md:text-4xl text-muted-foreground">
                                        {getInitials(tournament.name)}
                                    </span>
                                )}
                            </div>

                            {/* Description */}
                            <div className="space-y-1 flex-1 md:mb-2 w-full text-left">
                                {tournament.description && (
                                    <div
                                        className="text-xs md:text-sm text-left"
                                        dangerouslySetInnerHTML={{ __html: tournament.description }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Announcements Block */}
                    {announcements.length > 0 && (
                        <div className="grid grid-cols-1 gap-1 md:gap-2">
                            {announcements.map((ann) => (
                                <div
                                    key={ann.id}
                                    className={cn(
                                        "p-2 lg:p-4 border bg-card relative rounded-sm transition-colors",
                                        ann.is_pinned && "border-primary/50 bg-primary/10"
                                    )}
                                >
                                    {ann.is_pinned && (
                                        <Pin className="absolute top-2 right-2 lg:top-4 lg:right-4 size-4 text-primary" />
                                    )}
                                    <Header level={4}>{ann.title}</Header>
                                    {ann.content && (
                                        <div
                                            className="text-xs text-foreground mt-1 lg:mt-2 leading-relaxed prose prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{ __html: ann.content }}
                                        />
                                    )}
                                    <span className="text-[9px] text-muted-foreground/50 mt-2 lg:mt-4 block font-bold">
                                        {new Date(ann.created_at).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* General Information */}
                    <div className="p-2 md:p-4 border bg-card rounded-sm space-y-2 md:space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Date range */}
                            <div className="flex items-start gap-1 lg:gap-2">
                                <Calendar className="size-4 text-primary" />
                                <div className="space-y-0.5">
                                    <Label>{t("dates")}</Label>
                                    <p className="text-sm">
                                        {tournament.start_date ? new Date(tournament.start_date).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { year: 'numeric', month: 'long', day: 'numeric' }) : "-"}
                                        {tournament.end_date && ` - ${new Date(tournament.end_date).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { year: 'numeric', month: 'long', day: 'numeric' })}`}
                                    </p>
                                </div>
                            </div>

                            {/* Location */}
                            <div className="flex items-start gap-1 md:gap-2">
                                <MapPin className="size-4 text-primary" />
                                <div className="space-y-0.5">
                                    <Label>{t("location")}</Label>
                                    {tournament.location_name ? (
                                        <p className="text-sm">{tournament.location_name}</p>
                                    ) : (
                                        <p className="text-sm">-</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Embedded Map Canvas */}
                        {tournament.location_name && (
                            <div className="w-full aspect-2/1 border rounded-sm overflow-hidden shadow-inner relative">
                                <iframe
                                    title="Venue Location Map"
                                    width="100%"
                                    height="100%"
                                    className="border-0"
                                    loading="lazy"
                                    allowFullScreen
                                    referrerPolicy="no-referrer-when-downgrade"
                                    src={`https://maps.google.com/maps?q=${encodeURIComponent(tournament.location_name)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                                />
                            </div>
                        )}
                    </div>

                    {/* Sponsors Block */}
                    {sponsors && sponsors.length > 0 && (
                        <div className="space-y-2 md:space-y-4 text-center">
                            <h2 className="tracking-tighter text-foreground flex items-center justify-center gap-1 md:gap-2 font-black text-xl">
                                Sponsored By
                            </h2>
                            <div className="flex flex-wrap gap-4 items-center justify-center">
                                {sponsors.map((sponsor) => {
                                    const content = (
                                        <div
                                            className={cn(
                                                "flex items-center justify-center overflow-hidden shrink-0 cursor-pointer rounded-sm group transition-all",
                                                sponsor.cover_url
                                                    ? "h-16 md:h-24 w-auto min-w-[100px] max-w-[240px] px-2 bg-muted/20 hover:bg-muted/40 border border-border/40"
                                                    : "w-16 h-16 md:w-24 md:h-24"
                                            )}
                                            title={sponsor.sponsor_name}
                                        >
                                            {sponsor.cover_url ? (
                                                <Image src={sponsor.cover_url} className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105" alt={sponsor.sponsor_name} width={240} height={96} />
                                            ) : sponsor.logo_img ? (
                                                <Image src={sponsor.logo_img} className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-110" alt={sponsor.sponsor_name} width={96} height={96} />
                                            ) : (
                                                <span className="font-black text-2xl text-muted-foreground transition-transform duration-200 group-hover:scale-110">
                                                    {getInitials(sponsor.sponsor_name)}
                                                </span>
                                            )}
                                        </div>
                                    );

                                    if (sponsor.link_url) {
                                        return (
                                            <a
                                                key={sponsor.id}
                                                href={sponsor.link_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-block"
                                            >
                                                {content}
                                            </a>
                                        );
                                    }

                                    return (
                                        <div key={sponsor.id}>
                                            {content}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {currentTab === 'standings' && (
                <div className="space-y-2 md:space-y-4">
                    <div className="flex flex-col gap-1 mb-2 md:mb-4">
                        <h2 className="text-xl font-black tracking-tighter text-foreground flex items-center gap-2 md:gap-3">
                            <Trophy className="size-4 text-primary" />
                            {t("league_table")}
                        </h2>
                        <p className="text-[10px] font-bold text-muted-foreground/60">{t("league_table_desc")}</p>
                    </div>

                    {canvasStandings && canvasStandings.length > 0 ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 md:gap-4">
                            {canvasStandings.map((group) => (
                                <div key={group.label} className="space-y-2 md:space-y-4">
                                    <h3 className="text-lg font-black tracking-tighter text-foreground flex items-center gap-2">
                                        {group.label}
                                    </h3>
                                    <div className="bg-card border relative overflow-hidden transition-colors rounded-sm">
                                        <Standings standings={group.standings} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <StandingsGroups teams={initialTeams} matches={matches} isPublic={true} />
                    )}
                </div>
            )}

            {currentTab === 'matches' && (
                <div className="space-y-4">
                    {/* Schedule Filter Bar */}
                    <div className="flex flex-wrap items-center gap-2 bg-card border p-2 md:p-3 rounded-sm">
                        {/* Date Filter */}
                        <div className="flex items-center border bg-card rounded-sm h-8 md:h-9 overflow-hidden shrink-0">
                            <button
                                onClick={() => setMatchSelectedDate(null)}
                                className={cn(
                                    "px-2.5 md:px-3 h-full text-xs font-semibold tracking-tight transition-all border-r flex items-center shrink-0",
                                    matchSelectedDate === null
                                        ? "bg-primary text-black font-bold"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                )}
                            >
                                {locale === 'th' ? "ทั้งหมด" : "ALL"}
                            </button>
                            <div className="flex items-center justify-between px-1 h-full gap-0.5">
                                <button onClick={goToPrevDay} className="p-1 hover:text-primary text-muted-foreground transition-colors rounded-sm hover:bg-muted">
                                    <ChevronLeft className="size-4" />
                                </button>
                                <Popover open={isMatchCalendarOpen} onOpenChange={setIsMatchCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 hover:bg-muted transition-all flex-1 justify-center">
                                            <CalendarIcon className="size-4 text-primary shrink-0" />
                                            <span className="text-xs font-semibold tracking-tight truncate max-w-[120px] md:max-w-none">
                                                {matchSelectedDate ? formatDate(matchSelectedDate, "d MMM yyyy", locale) : (locale === 'th' ? "วันนี้" : "TODAY")}
                                            </span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-0 bg-card rounded-sm shadow-2xl" align="start" side="bottom" sideOffset={5}>
                                        <div className="p-3 border-b flex items-center justify-between bg-muted/20">
                                            <button onClick={() => setMatchViewDate(subMonths(matchViewDate, 1))} className="p-1 hover:text-primary transition-colors">
                                                <ChevronLeft className="size-4" />
                                            </button>
                                            <span className="text-xs font-black tracking-widest">
                                                {matchViewDate.toLocaleString(locale === 'th' ? 'th-TH' : 'en-US', { month: 'long', year: 'numeric' })}
                                            </span>
                                            <button onClick={() => setMatchViewDate(addMonths(matchViewDate, 1))} className="p-1 hover:text-primary transition-colors">
                                                <ChevronRight className="size-4" />
                                            </button>
                                        </div>
                                        <div className="p-4 space-y-4">
                                            <div className="grid grid-cols-7 gap-1">
                                                {(locale === 'th' ? ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map((d, idx) => (
                                                    <div key={`${d}-${idx}`} className="text-[9px] text-center font-black opacity-30">{d}</div>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-7 gap-1">
                                                {calendarDays.map((day, i) => {
                                                    if (!day) return <div key={`empty-${i}`} />;
                                                    const dateStr = format(day, 'yyyy-MM-dd');
                                                    const isSel = matchSelectedDate === dateStr;
                                                    const hasMatch = datesWithMatches.has(dateStr);
                                                    const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
                                                    const isOutsideRange = !!((tournament?.start_date && dateStr < tournament.start_date) || (tournament?.end_date && dateStr > tournament.end_date));

                                                    return (
                                                        <button
                                                            key={dateStr}
                                                            disabled={isOutsideRange}
                                                            onClick={() => {
                                                                setMatchSelectedDate(dateStr);
                                                                setIsMatchCalendarOpen(false);
                                                            }}
                                                            className={cn(
                                                                "h-9 flex flex-col items-center justify-center relative transition-all",
                                                                isSel ? "bg-primary text-black font-black" : "hover:bg-muted text-muted-foreground hover:text-foreground",
                                                                isToday && !isSel && "border border-primary text-primary",
                                                                isOutsideRange && "opacity-20 cursor-not-allowed grayscale"
                                                            )}
                                                        >
                                                            <span className="text-[11px]">{format(day, 'd')}</span>
                                                            {hasMatch && (
                                                                <div className={cn(
                                                                    "absolute bottom-1.5 h-1 w-1 rounded-full",
                                                                    isSel ? "bg-black" : "bg-primary"
                                                                )} />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setMatchSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                                                    setMatchViewDate(new Date());
                                                    setIsMatchCalendarOpen(false);
                                                }}
                                                className="w-full text-[10px] font-black tracking-widest h-9 hover:bg-primary hover:text-black hover:border-primary transition-all"
                                            >
                                                {locale === 'th' ? "กลับไปที่วันนี้" : "BACK TO TODAY"}
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <button onClick={goToNextDay} className="p-1 hover:text-primary text-muted-foreground transition-colors rounded-sm hover:bg-muted">
                                    <ChevronRight className="size-4" />
                                </button>
                            </div>
                        </div>

                        {/* Stage Filter */}
                        <Select value={matchFilterStage} onValueChange={setMatchFilterStage}>
                            <SelectTrigger size="sm" className="w-[140px] md:w-[170px] h-8 md:h-9 bg-card">
                                <SelectValue placeholder={locale === 'th' ? "รอบการแข่งขัน" : "Stage"} />
                            </SelectTrigger>
                            <SelectContent className="bg-card shadow-2xl">
                                <SelectItem value="all" className="font-semibold text-xs">
                                    {locale === 'th' ? "ทุกรอบการแข่งขัน" : "ALL STAGES"}
                                </SelectItem>
                                <SelectItem value="group" className="font-semibold text-xs">
                                    {locale === 'th' ? "รอบแบ่งกลุ่ม (ทั้งหมด)" : "GROUP STAGE (ALL)"}
                                </SelectItem>
                                {groupNodes.map(node => {
                                    const label = (node.data as { label?: string })?.label || "Group";
                                    return (
                                        <SelectItem
                                            key={node.id}
                                            value={label}
                                            className="font-semibold text-xs pl-4"
                                        >
                                            - {label}
                                        </SelectItem>
                                    );
                                })}
                                <SelectItem value="knockout" className="font-semibold text-xs">
                                    {locale === 'th' ? "รอบน็อคเอาท์" : "KNOCKOUT STAGE"}
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Team Filter */}
                        <Select value={matchFilterTeam} onValueChange={setMatchFilterTeam}>
                            <SelectTrigger size="sm" className="w-[140px] md:w-[170px] h-8 md:h-9 bg-card">
                                <SelectValue placeholder={locale === 'th' ? "เลือกทีม" : "Select Team"} />
                            </SelectTrigger>
                            <SelectContent className="bg-card shadow-2xl">
                                <SelectItem value="all" className="font-semibold text-xs">
                                    {locale === 'th' ? "แสดงทุกทีม" : "SHOW ALL TEAMS"}
                                </SelectItem>
                                {initialTeams.map(team => (
                                    <SelectItem key={team.id} value={team.id} className="font-semibold text-xs">
                                        {team.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Match Manager List */}
                    <MatchManager
                        matches={filteredMatchesForDisplay}
                        teams={initialTeams}
                        tournamentId={tournament.id}
                        sport={tournament.sport}
                        format={tournament.format}
                        startDate={tournament.start_date}
                        endDate={tournament.end_date}
                        isPublic={true}
                        canvasData={tournament.canvas_data}
                        externalFilterStage={matchFilterStage}
                        externalSelectedDate={matchSelectedDate}
                    />
                </div>
            )}

            {currentTab === 'stats' && (
                <div className="space-y-2 md:space-y-4 animate-in fade-in duration-200">
                    <div className="flex flex-col gap-1">
                        <Header level={3}>{t("player_stats")}</Header>
                    </div>

                    {!(playerStats.scorers.length > 0 || playerStats.assists.length > 0 || playerStats.saves.length > 0 || playerStats.yellowCards.length > 0 || playerStats.redCards.length > 0 || playerStats.injuries.length > 0) ? (
                        <div className="bg-card border rounded-sm">
                            <EmptyState
                                icon={Users}
                                title={t("no_stats_recorded")}
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 md:gap-4">
                            {/* Top Scorers */}
                            {playerStats.scorers.length > 0 && (
                                <div className="bg-card border rounded-sm overflow-hidden shadow-sm flex flex-col">
                                    <div className="p-2 md:p-4 border-b flex items-center justify-between">
                                        <h3 className="font-black text-sm flex items-center gap-2 text-foreground">
                                            {t("goals")}
                                        </h3>
                                    </div>
                                    <div className="divide-y flex-1">
                                        {playerStats.scorers.map((player, idx) => (
                                            <div
                                                key={player.id}
                                                onClick={() => setSelectedPlayerForModal(player)}
                                                className="p-4 flex items-center justify-between hover:bg-muted/40 transition-all cursor-pointer group select-none"
                                                title={locale === 'th' ? "คลิกเพื่อดูสถิตินักกีฬา" : "Click to view player stats"}
                                            >
                                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 pr-2">
                                                    <span className="font-black text-xs text-muted-foreground w-4 text-center shrink-0">{idx + 1}</span>
                                                    <PlayerAvatar
                                                        photoUrl={player.photo_url || (player as any).profile_img}
                                                        name={player.name}
                                                        number={player.number}
                                                        size="sm"
                                                    />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">{player.name}</span>
                                                        <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 font-medium truncate">
                                                            {player.teamLogo && (
                                                                <Image src={player.teamLogo} alt={player.teamName} width={12} height={12} unoptimized className="object-contain rounded-full shrink-0" />
                                                            )}
                                                            <span className="truncate">{player.teamName}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-sm font-black text-foreground">{player.goals}</span>
                                                    <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top Assists */}
                            {playerStats.assists.length > 0 && (
                                <div className="bg-card border rounded-sm overflow-hidden shadow-sm flex flex-col">
                                    <div className="p-2 md:p-4 border-b flex items-center justify-between">
                                        <h3 className="font-black text-sm flex items-center gap-2 text-foreground">
                                            {t("assists")}
                                        </h3>
                                    </div>
                                    <div className="divide-y flex-1">
                                        {playerStats.assists.map((player, idx) => (
                                            <div
                                                key={player.id}
                                                onClick={() => setSelectedPlayerForModal(player)}
                                                className="p-4 flex items-center justify-between hover:bg-muted/40 transition-all cursor-pointer group select-none"
                                                title={locale === 'th' ? "คลิกเพื่อดูสถิตินักกีฬา" : "Click to view player stats"}
                                            >
                                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 pr-2">
                                                    <span className="font-black text-xs text-muted-foreground w-4 text-center shrink-0">{idx + 1}</span>
                                                    <PlayerAvatar
                                                        photoUrl={player.photo_url || (player as any).profile_img}
                                                        name={player.name}
                                                        number={player.number}
                                                        size="sm"
                                                    />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">{player.name}</span>
                                                        <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 font-medium truncate">
                                                            {player.teamLogo && (
                                                                <Image src={player.teamLogo} alt={player.teamName} width={12} height={12} unoptimized className="object-contain rounded-full shrink-0" />
                                                            )}
                                                            <span className="truncate">{player.teamName}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-sm font-black text-foreground">{player.assists}</span>
                                                    <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top Saves */}
                            {playerStats.saves.length > 0 && (
                                <div className="bg-card border rounded-sm overflow-hidden shadow-sm flex flex-col">
                                    <div className="p-2 md:p-4 border-b flex items-center justify-between">
                                        <h3 className="font-black text-sm flex items-center gap-2 text-foreground">
                                            {t("saves")}
                                        </h3>
                                    </div>
                                    <div className="divide-y flex-1">
                                        {playerStats.saves.map((player, idx) => (
                                            <div
                                                key={player.id}
                                                onClick={() => setSelectedPlayerForModal(player)}
                                                className="p-4 flex items-center justify-between hover:bg-muted/40 transition-all cursor-pointer group select-none"
                                                title={locale === 'th' ? "คลิกเพื่อดูสถิตินักกีฬา" : "Click to view player stats"}
                                            >
                                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 pr-2">
                                                    <span className="font-black text-xs text-muted-foreground w-4 text-center shrink-0">{idx + 1}</span>
                                                    <PlayerAvatar
                                                        photoUrl={player.photo_url || (player as any).profile_img}
                                                        name={player.name}
                                                        number={player.number}
                                                        size="sm"
                                                    />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">{player.name}</span>
                                                        <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 font-medium truncate">
                                                            {player.teamLogo && (
                                                                <Image src={player.teamLogo} alt={player.teamName} width={12} height={12} unoptimized className="object-contain rounded-full shrink-0" />
                                                            )}
                                                            <span className="truncate">{player.teamName}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-sm font-black text-foreground">{player.saves}</span>
                                                    <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top Yellow Cards */}
                            {playerStats.yellowCards.length > 0 && (
                                <div className="bg-card border rounded-sm overflow-hidden shadow-sm flex flex-col">
                                    <div className="p-2 md:p-4 border-b flex items-center justify-between">
                                        <h3 className="font-black text-sm flex items-center gap-2 text-foreground">
                                            <span className="w-2.5 h-3.5 bg-amber-500 rounded-xs inline-block shrink-0" />
                                            {t("yellow_cards")}
                                        </h3>
                                    </div>
                                    <div className="divide-y flex-1">
                                        {playerStats.yellowCards.map((player, idx) => (
                                            <div
                                                key={player.id}
                                                onClick={() => setSelectedPlayerForModal(player)}
                                                className="p-4 flex items-center justify-between hover:bg-muted/40 transition-all cursor-pointer group select-none"
                                                title={locale === 'th' ? "คลิกเพื่อดูสถิตินักกีฬา" : "Click to view player stats"}
                                            >
                                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 pr-2">
                                                    <span className="font-black text-xs text-muted-foreground w-4 text-center shrink-0">{idx + 1}</span>
                                                    <PlayerAvatar
                                                        photoUrl={player.photo_url || (player as any).profile_img}
                                                        name={player.name}
                                                        number={player.number}
                                                        size="sm"
                                                    />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">{player.name}</span>
                                                        <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 font-medium truncate">
                                                            {player.teamLogo && (
                                                                <Image src={player.teamLogo} alt={player.teamName} width={12} height={12} unoptimized className="object-contain rounded-full shrink-0" />
                                                            )}
                                                            <span className="truncate">{player.teamName}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-sm font-black text-foreground">{player.yellowCards}</span>
                                                    <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top Red Cards */}
                            {playerStats.redCards.length > 0 && (
                                <div className="bg-card border rounded-sm overflow-hidden shadow-sm flex flex-col">
                                    <div className="p-2 md:p-4 border-b flex items-center justify-between">
                                        <h3 className="font-black text-sm flex items-center gap-2 text-foreground">
                                            <span className="w-2.5 h-3.5 bg-rose-500 rounded-sm inline-block shrink-0" />
                                            {t("red_cards")}
                                        </h3>
                                    </div>
                                    <div className="divide-y flex-1">
                                        {playerStats.redCards.map((player, idx) => (
                                            <div
                                                key={player.id}
                                                onClick={() => setSelectedPlayerForModal(player)}
                                                className="p-4 flex items-center justify-between hover:bg-muted/40 transition-all cursor-pointer group select-none"
                                                title={locale === 'th' ? "คลิกเพื่อดูสถิตินักกีฬา" : "Click to view player stats"}
                                            >
                                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 pr-2">
                                                    <span className="font-black text-xs text-muted-foreground w-4 text-center shrink-0">{idx + 1}</span>
                                                    <PlayerAvatar
                                                        photoUrl={player.photo_url || (player as any).profile_img}
                                                        name={player.name}
                                                        number={player.number}
                                                        size="sm"
                                                    />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">{player.name}</span>
                                                        <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 font-medium truncate">
                                                            {player.teamLogo && (
                                                                <Image src={player.teamLogo} alt={player.teamName} width={12} height={12} unoptimized className="object-contain rounded-full shrink-0" />
                                                            )}
                                                            <span className="truncate">{player.teamName}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-sm font-black text-foreground">{player.redCards}</span>
                                                    <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Injuries */}
                            {playerStats.injuries.length > 0 && (
                                <div className="bg-card border rounded-sm overflow-hidden shadow-sm flex flex-col">
                                    <div className="p-2 md:p-4 border-b flex items-center justify-between">
                                        <h3 className="font-black text-sm flex items-center gap-2 text-foreground">
                                            {t("injuries")}
                                        </h3>
                                    </div>
                                    <div className="divide-y flex-1">
                                        {playerStats.injuries.map((player, idx) => (
                                            <div
                                                key={player.id}
                                                onClick={() => setSelectedPlayerForModal(player)}
                                                className="p-4 flex items-center justify-between hover:bg-muted/40 transition-all cursor-pointer group select-none"
                                                title={locale === 'th' ? "คลิกเพื่อดูสถิตินักกีฬา" : "Click to view player stats"}
                                            >
                                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 pr-2">
                                                    <span className="font-black text-xs text-muted-foreground w-4 text-center shrink-0">{idx + 1}</span>
                                                    <PlayerAvatar
                                                        photoUrl={player.photo_url || (player as any).profile_img}
                                                        name={player.name}
                                                        number={player.number}
                                                        size="sm"
                                                    />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">{player.name}</span>
                                                        <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 font-medium truncate">
                                                            {player.teamLogo && (
                                                                <Image src={player.teamLogo} alt={player.teamName} width={12} height={12} unoptimized className="object-contain rounded-full shrink-0" />
                                                            )}
                                                            <span className="truncate">{player.teamName}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-sm font-black text-foreground">{player.injuries}</span>
                                                    <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Player Detailed 5-Point Radar & Timeline Modal */}
            <PlayerStatModal
                open={!!selectedPlayerForModal}
                onOpenChange={(op) => !op && setSelectedPlayerForModal(null)}
                player={selectedPlayerForModal}
                events={events}
                matches={matches}
                locale={locale}
            />
        </main>
    );
}

