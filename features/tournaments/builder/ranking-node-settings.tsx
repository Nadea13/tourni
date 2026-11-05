"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import Image from "next/image";
import {
    Trophy,
    Flame,
    Search,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";
import { useBracketStore } from "@/lib/stores/bracket-store";
import { useMatchWebSocket } from "@/hooks/use-match-websocket";
import { ApiClient } from "@/lib/api-client";
import { Match, TournamentStatus, Registration } from "@/types";
import { isMatchEnded } from "./match-node";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/ui/header";
import { cn } from "@/lib/utils";

export interface ResolvedTeam {
    id: string;
    name: string;
    logo_url?: string | null;
}

export interface TournamentRegistrationItem extends Registration {
    registration_status: string;
}

export interface UnifiedRankingItem {
    id: string;
    team: ResolvedTeam;
    type: 'champion' | 'runner_up' | 'third' | 'fourth' | 'knockout' | 'group' | 'active' | 'unranked';
    rank?: number;
    isTie?: boolean;
    stageLabel: string;
    nextOpponent?: string;
    isActive?: boolean;
}

export function RankingNodeSettings({
    tournamentId,
    categoryId,
    currentTournamentStatus,
    onStatusChange,
}: {
    tournamentId: string;
    categoryId?: string;
    currentTournamentStatus?: string;
    onStatusChange?: (status: TournamentStatus) => void;
}) {
    const locale = useLocale();
    const storeCategoryId = useBracketStore((s) => s.activeCategoryId);
    const resolvedCategoryId = categoryId || storeCategoryId || undefined;

    const nodes = useBracketStore((s) => s.nodes);
    const edges = useBracketStore((s) => s.edges);
    const storeTeams = useBracketStore((s) => s.teams);
    const storeMatches = useBracketStore((s) => s.matches);
    const setStoreMatches = useBracketStore((s) => s.setMatches);
    const fetchTeams = useBracketStore((s) => s.fetchTeams);

    // Team Management (การจัดการทีม) reference state
    const [teamRegistrations, setTeamRegistrations] = React.useState<TournamentRegistrationItem[]>([]);
    const [localMatches, setLocalMatches] = React.useState<Match[]>([]);
    const [_isLoading, setIsLoading] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

    // Merge storeMatches and localMatches with local priority for instantaneous real-time responsiveness
    const matches = localMatches.length > 0 ? localMatches : (storeMatches || []);

    const isMatchTarget = (m: Match, id: string) =>
        m.id === id || (m as any).dbId === id || (m as any).matchId === id || (m as any).match_id === id;

    // 1. Fetch team registrations referencing "การจัดการทีม" (Team Management)
    const fetchTeamRegistrations = React.useCallback(async () => {
        if (!tournamentId) return;
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
            const url = resolvedCategoryId
                ? `${apiUrl}/tournaments/${tournamentId}/teams?category_id=${resolvedCategoryId}`
                : `${apiUrl}/tournaments/${tournamentId}/teams`;

            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data) ? data : (data?.data || []);
                const mapped: TournamentRegistrationItem[] = list.map((item: any) => {
                    const ps = String(item.payment_status || '').toLowerCase();
                    const rs = String(item.registration_status || '').toLowerCase();
                    const s = String(item.status || '').toLowerCase();

                    let mappedStatus: 'PENDING' | 'PAID' | 'REJECTED' = 'PENDING';
                    if (rs === 'rejected' || ps === 'rejected' || s === 'rejected') {
                        mappedStatus = 'REJECTED';
                    } else if (rs === 'approved' || rs === 'confirmed' || s === 'approved' || (s === 'registered' && rs !== 'pending' && ps !== 'pending')) {
                        mappedStatus = 'PAID';
                    } else {
                        mappedStatus = 'PENDING';
                    }

                    return {
                        id: item.id,
                        tournament_id: item.tournament_id || tournamentId,
                        team_name: item.team?.name || item.name || '',
                        contact_name: item.contact_name || item.team?.contact_name || '',
                        contact_phone: item.contact_phone || item.team?.contact_phone || '',
                        logo_url: item.team?.logo_img || item.team?.logo_url || item.logo_img || item.logo_url || null,
                        existing_team_id: item.team_id || item.team?.id || null,
                        slip_url: item.slip_img || null,
                        payment_status: mappedStatus,
                        trans_ref: item.remark || null,
                        description: item.team?.description || item.description || null,
                        tournament_team_id: item.id,
                        created_at: item.created_at || new Date().toISOString(),
                        registration_status: rs,
                    };
                });
                setTeamRegistrations(mapped);
                forceUpdate();
            }
        } catch (e) {
            console.error("Error fetching team registrations for rankings:", e);
        }
    }, [tournamentId, resolvedCategoryId]);

    // 2. Fetch matches & teams for category via ApiClient
    const fetchCategoryMatches = React.useCallback(async () => {
        if (!tournamentId) return;
        setIsLoading(true);
        try {
            if (resolvedCategoryId) {
                fetchTeams(resolvedCategoryId, tournamentId);
            }
            const url = resolvedCategoryId
                ? `/tournaments/${tournamentId}/categories/${resolvedCategoryId}/matches`
                : `/tournaments/${tournamentId}/matches`;
            const data = await ApiClient.fetch<any[]>(url, { cache: 'no-store' });
            if (data && Array.isArray(data)) {
                const mappedMatches = (data as Match[]).map(match => {
                    let match_date = match.match_date;
                    let match_time = match.match_time;
                    if (match.scheduled_at) {
                        const parts = match.scheduled_at.split('T');
                        match_date = parts[0];
                        match_time = parts[1]?.substring(0, 5) || null;
                    }

                    const home_team = match.home_team ? {
                        id: match.home_team.id || match.home_team_id || "",
                        name: match.home_team.name || "",
                        logo_url: (match.home_team as { logo_img?: string | null }).logo_img || match.home_team.logo_url || undefined
                    } : undefined;

                    const away_team = match.away_team ? {
                        id: match.away_team.id || match.away_team_id || "",
                        name: match.away_team.name || "",
                        logo_url: (match.away_team as { logo_img?: string | null }).logo_img || match.away_team.logo_url || undefined
                    } : undefined;

                    return {
                        ...match,
                        match_date,
                        match_time,
                        home_team,
                        away_team
                    };
                });
                setStoreMatches(mappedMatches);
                setLocalMatches(mappedMatches);
                forceUpdate();
            }
        } catch (err) {
            console.error("Failed to fetch matches for rankings:", err);
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId, resolvedCategoryId, setStoreMatches, fetchTeams]);

    const fetchAllData = React.useCallback(async () => {
        await Promise.all([fetchCategoryMatches(), fetchTeamRegistrations()]);
    }, [fetchCategoryMatches, fetchTeamRegistrations]);

    // Real-time synchronization referencing "การจัดการทีม" (Registrations):
    // 1. Initial fetch on mount / category change
    // 2. 3-second recurring interval
    // 3. Window focus event
    // 4. Trigger on storeTeams update
    React.useEffect(() => {
        fetchAllData();

        const interval = setInterval(() => {
            fetchAllData();
        }, 3000);

        const handleFocus = () => {
            fetchAllData();
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, [fetchAllData]);

    React.useEffect(() => {
        if (storeTeams.length > 0 || teamRegistrations.length > 0) {
            fetchAllData();
        }
    }, [storeTeams, fetchAllData]);

    // 100% Realtime WebSocket Listener for Tournament Standings & Rankings
    useMatchWebSocket("all", {
        onScoreUpdate: ({ match_id, home_score, away_score, status }) => {
            if (!match_id) return;
            const updateList = (prev: Match[]) => prev.map(m => {
                if (isMatchTarget(m, match_id)) {
                    return {
                        ...m,
                        home_score,
                        away_score,
                        status: (status || m.status) as any
                    };
                }
                return m;
            });
            setLocalMatches(updateList);
            setStoreMatches(updateList);
            forceUpdate();
            fetchAllData();
        },
        onStatusChange: ({ match_id, status }) => {
            if (!match_id) return;
            const updateList = (prev: Match[]) => prev.map(m => {
                if (isMatchTarget(m, match_id)) {
                    return { ...m, status: status as any };
                }
                return m;
            });
            setLocalMatches(updateList);
            setStoreMatches(updateList);
            forceUpdate();
            fetchAllData();
        },
        onMatchUpdate: ({ match }) => {
            if (!match?.id) return;
            const updateList = (prev: Match[]) => {
                const idx = prev.findIndex(m => isMatchTarget(m, match.id));
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = { ...updated[idx], ...match };
                    return updated;
                }
                return [...prev, match];
            };
            setLocalMatches(updateList);
            setStoreMatches(updateList);
            forceUpdate();
            fetchAllData();
        },
        onStandingsSync: () => {
            fetchAllData();
            forceUpdate();
        }
    });

    // 2. Compute rankings from nodes, edges, matches, and teams
    const { items, activeCount } = React.useMemo(() => {
        const teamMap = new Map<string, ResolvedTeam>();

        // Collect Set of approved teams (STRICTLY registration_status === 'approved')
        const approvedTeamIdSet = new Set<string>();
        const approvedTeamNameSet = new Set<string>();

        teamRegistrations.forEach(r => {
            if (r.registration_status === 'approved') {
                if (r.id) approvedTeamIdSet.add(String(r.id));
                if (r.existing_team_id) approvedTeamIdSet.add(String(r.existing_team_id));
                if (r.tournament_team_id) approvedTeamIdSet.add(String(r.tournament_team_id));
                if (r.team_name) approvedTeamNameSet.add(r.team_name.trim().toLowerCase());
            }
        });

        storeTeams.forEach(t => {
            if (String(t.registration_status || '').toLowerCase() === 'approved') {
                if (t.id) approvedTeamIdSet.add(String(t.id));
                if (t.team_id) approvedTeamIdSet.add(String(t.team_id));
                if (t.name) approvedTeamNameSet.add(t.name.trim().toLowerCase());
            }
        });

        const isApprovedTeam = (team?: ResolvedTeam | null): boolean => {
            if (!team) return false;
            return approvedTeamIdSet.has(String(team.id)) || approvedTeamNameSet.has(team.name.trim().toLowerCase());
        };

        // 0. Primary Reference: Approved Teams from Team Management (STRICTLY registration_status === 'approved')
        const approvedRegistrations = teamRegistrations.filter(r => r.registration_status === 'approved');
        approvedRegistrations.forEach(r => {
            const canonicalId = String(r.existing_team_id || r.id);
            const resolved: ResolvedTeam = {
                id: canonicalId,
                name: r.team_name,
                logo_url: r.logo_url,
            };
            if (r.id) teamMap.set(String(r.id), resolved);
            if (r.existing_team_id) teamMap.set(String(r.existing_team_id), resolved);
            if (r.tournament_team_id) teamMap.set(String(r.tournament_team_id), resolved);
            if (r.team_name) {
                teamMap.set(r.team_name.trim(), resolved);
                teamMap.set(r.team_name.trim().toLowerCase(), resolved);
            }
        });

        // Register approved store teams
        storeTeams.forEach(t => {
            if (String(t.registration_status || '').toLowerCase() === 'approved') {
                const canonicalId = String(t.team_id || t.id);
                const resolved: ResolvedTeam = {
                    id: canonicalId,
                    name: t.name,
                    logo_url: t.logo_url,
                };
                if (t.id) teamMap.set(String(t.id), resolved);
                if (t.team_id) teamMap.set(String(t.team_id), resolved);
                if (t.name) {
                    teamMap.set(t.name.trim(), resolved);
                    teamMap.set(t.name.trim().toLowerCase(), resolved);
                }
            }
        });

        // Helper to resolve a team by ID or name (Strictly for approved teams)
        const resolveTeam = (idOrName?: string | null): ResolvedTeam | undefined => {
            if (!idOrName) return undefined;
            const trimmed = String(idOrName).trim();
            if (!trimmed) return undefined;
            const lower = trimmed.toLowerCase();
            if (teamMap.has(trimmed)) {
                const candidate = teamMap.get(trimmed)!;
                if (isApprovedTeam(candidate)) return candidate;
            }
            if (teamMap.has(lower)) {
                const candidate = teamMap.get(lower)!;
                if (isApprovedTeam(candidate)) return candidate;
            }
            if (
                trimmed === "TBD" ||
                trimmed === "Bye" ||
                trimmed.startsWith("Winner of") ||
                trimmed.startsWith("Winner (") ||
                trimmed.startsWith("Loser of") ||
                trimmed.startsWith("Loser (") ||
                trimmed.includes("Place (")
            ) {
                return undefined;
            }

            const foundReg = approvedRegistrations.find(
                r => r.team_name.trim().toLowerCase() === lower ||
                     String(r.id) === trimmed ||
                     String(r.existing_team_id) === trimmed ||
                     String(r.tournament_team_id) === trimmed
            );
            if (foundReg) {
                const resolved: ResolvedTeam = {
                    id: String(foundReg.existing_team_id || foundReg.id),
                    name: foundReg.team_name,
                    logo_url: foundReg.logo_url,
                };
                teamMap.set(trimmed, resolved);
                teamMap.set(lower, resolved);
                return resolved;
            }

            const foundStore = storeTeams.find(
                st => String(st.registration_status || '').toLowerCase() === 'approved' && (
                      st.name.trim().toLowerCase() === lower ||
                      String(st.id) === trimmed ||
                      String(st.team_id) === trimmed
                )
            );
            if (foundStore) {
                const resolved: ResolvedTeam = {
                    id: String(foundStore.team_id || foundStore.id),
                    name: foundStore.name,
                    logo_url: foundStore.logo_url,
                };
                teamMap.set(trimmed, resolved);
                teamMap.set(lower, resolved);
                return resolved;
            }

            // Strictly do not auto-create unapproved teams
            return undefined;
        };

        const matchNodes = nodes.filter(n => n.type === 'matchNode');
        const groupNodes = nodes.filter(n => n.type === 'groupNode');

        // Dynamic group node real-time calculations from live matches
        const dynamicGroupRankingsMap = new Map<string, ResolvedTeam[]>();

        const calculateGroupRankings = (nodeTeams: string[]): ResolvedTeam[] => {
            if (!nodeTeams || nodeTeams.length === 0) return [];
            const stats: Record<string, { team: ResolvedTeam; pts: number; gd: number; gf: number }> = {};
            nodeTeams.forEach(name => {
                const resolved = resolveTeam(name);
                if (resolved) {
                    stats[resolved.id] = { team: resolved, pts: 0, gd: 0, gf: 0 };
                }
            });

            matches.forEach(m => {
                const homeTeam = resolveTeam(m.home_team_id) || resolveTeam((m.home_team as any)?.id) || resolveTeam(m.home_team?.name) || resolveTeam(m.placeholder_home || m.placeholder_a);
                const awayTeam = resolveTeam(m.away_team_id) || resolveTeam((m.away_team as any)?.id) || resolveTeam(m.away_team?.name) || resolveTeam(m.placeholder_away || m.placeholder_b);

                if (!homeTeam || !awayTeam) return;
                const hStat = stats[homeTeam.id];
                const aStat = stats[awayTeam.id];
                if (!hStat || !aStat) return;

                const isPlayed = m.status === 'finished' || m.status === 'completed' || m.status === 'live' || m.status === 'first_half' || m.status === 'second_half' || (m.home_score !== undefined && m.away_score !== undefined && (Number(m.home_score) > 0 || Number(m.away_score) > 0));
                if (isPlayed) {
                    const getScoreVal = (s: unknown) => (typeof s === 'object' && s !== null && 'total' in s ? Number((s as any).total) || 0 : Number(s) || 0);
                    const hScore = getScoreVal(m.home_score);
                    const aScore = getScoreVal(m.away_score);

                    hStat.gf += hScore;
                    hStat.gd += (hScore - aScore);
                    aStat.gf += aScore;
                    aStat.gd += (aScore - hScore);

                    if (hScore > aScore) {
                        hStat.pts += 3;
                    } else if (aScore > hScore) {
                        aStat.pts += 3;
                    } else {
                        hStat.pts += 1;
                        aStat.pts += 1;
                    }
                }
            });

            return Object.values(stats).sort((a, b) => {
                if (b.pts !== a.pts) return b.pts - a.pts;
                if (b.gd !== a.gd) return b.gd - a.gd;
                return b.gf - a.gf;
            }).map(s => s.team);
        };

        groupNodes.forEach(gNode => {
            const nodeTeams: string[] = (gNode.data as { teams?: string[] })?.teams || [];
            const computed = calculateGroupRankings(nodeTeams);
            if (computed.length > 0) {
                dynamicGroupRankingsMap.set(gNode.id, computed);
            }
        });

        // Resolve match results dynamically with upstream winner/loser DAG propagation
        interface MatchOutcome {
            nodeId: string;
            matchIndex: number;
            dbMatch?: Match;
            homeTeam?: ResolvedTeam;
            awayTeam?: ResolvedTeam;
            isFinished: boolean;
            winner?: ResolvedTeam;
            loser?: ResolvedTeam;
            label: string;
        }

        const outcomeCache = new Map<string, MatchOutcome>();

        const getMatchNodeTeam = (targetNodeId: string, matchIdx: number, slot: 'a' | 'b', visited = new Set<string>()): ResolvedTeam | undefined => {
            const cycleKey = `${targetNodeId}-${matchIdx}-${slot}`;
            if (visited.has(cycleKey)) return undefined;
            visited.add(cycleKey);

            const node = matchNodes.find(n => n.id === targetNodeId);
            if (!node) return undefined;

            const nodeMatches = (node.data as any)?.matches || [];
            const mItem = nodeMatches[matchIdx];
            const matchNumber = matchIdx + 1;

            // 1. Find dbMatch
            const dbMatch = matches.find(dbm =>
                (mItem?.dbId && dbm.id === mItem.dbId) ||
                (mItem?.matchId && dbm.id === mItem.matchId) ||
                (mItem?.id && dbm.id === mItem.id) ||
                (dbm.node_id === targetNodeId && ((dbm.idx_match ?? dbm.match_index ?? (dbm as any).match_number) === matchNumber || dbm.idx_match === matchIdx)) ||
                (mItem?.placeholderA && mItem?.placeholderB && (
                    (dbm.placeholder_a === mItem.placeholderA && dbm.placeholder_b === mItem.placeholderB) ||
                    (dbm.ph_home === mItem.placeholderA && dbm.ph_away === mItem.placeholderB)
                ))
            );

            if (slot === 'a') {
                const teamFromDb = resolveTeam(dbMatch?.home_team_id) || resolveTeam((dbMatch?.home_team as any)?.id) || resolveTeam(dbMatch?.home_team?.name);
                if (teamFromDb) return teamFromDb;
            } else {
                const teamFromDb = resolveTeam(dbMatch?.away_team_id) || resolveTeam((dbMatch?.away_team as any)?.id) || resolveTeam(dbMatch?.away_team?.name);
                if (teamFromDb) return teamFromDb;
            }

            // 2. Check incoming edge
            const targetHandle = `slot-${slot}-${matchIdx}`;
            const edge = edges.find(e => e.target === targetNodeId && (e.targetHandle === targetHandle || e.targetHandle === `slot-${slot}`));
            if (edge) {
                const sourceNode = nodes.find(n => n.id === edge.source);
                if (sourceNode?.type === 'standingNode' || sourceNode?.type === 'groupNode') {
                    const rankMatch = edge.sourceHandle?.match(/rank-(\d+)/);
                    if (rankMatch) {
                        const rankIndex = parseInt(rankMatch[1], 10);
                        const computedRankings = dynamicGroupRankingsMap.get(sourceNode.id);
                        if (computedRankings && computedRankings[rankIndex]) {
                            return computedRankings[rankIndex];
                        }
                        const rankings = (sourceNode.data as { rankings?: string[] }).rankings || [];
                        if (rankings[rankIndex]) {
                            const team = resolveTeam(rankings[rankIndex]);
                            if (team) return team;
                        }
                    }
                } else if (sourceNode?.type === 'matchNode') {
                    const winnerMatch = edge.sourceHandle?.match(/winner-(\d+)/);
                    const loserMatch = edge.sourceHandle?.match(/loser-(\d+)/);
                    const isWinner = !!winnerMatch || (!edge.sourceHandle || edge.sourceHandle.startsWith('winner'));
                    const sMatchIdx = winnerMatch ? parseInt(winnerMatch[1], 10) : loserMatch ? parseInt(loserMatch[1], 10) : 0;

                    const sOutcome = getOutcome(sourceNode.id, sMatchIdx, visited);
                    if (sOutcome?.isFinished) {
                        const advancedTeam = isWinner ? sOutcome.winner : sOutcome.loser;
                        if (advancedTeam) return advancedTeam;
                    }
                }
            }

            // 3. Fallback to placeholder
            const placeholder = slot === 'a' ? mItem?.placeholderA : mItem?.placeholderB;
            return resolveTeam(placeholder);
        };

        const getOutcome = (nodeId: string, matchIdx: number, visited = new Set<string>()): MatchOutcome | undefined => {
            const key = `${nodeId}-${matchIdx}`;
            if (outcomeCache.has(key)) return outcomeCache.get(key);

            const node = matchNodes.find(n => n.id === nodeId);
            if (!node) return undefined;

            const nodeMatches = (node.data as any)?.matches || [];
            const mItem = nodeMatches[matchIdx] || { placeholderA: "TBD", placeholderB: "TBD" };
            const matchNumber = matchIdx + 1;
            const nodeLabel = (node.data as any)?.label || "Match";

            const dbMatch = matches.find(dbm =>
                (mItem?.dbId && dbm.id === mItem.dbId) ||
                (mItem?.matchId && dbm.id === mItem.matchId) ||
                (mItem?.id && dbm.id === mItem.id) ||
                (dbm.node_id === nodeId && ((dbm.idx_match ?? dbm.match_index ?? (dbm as any).match_number) === matchNumber)) ||
                (mItem?.placeholderA && mItem?.placeholderB && (
                    (dbm.placeholder_a === mItem.placeholderA && dbm.placeholder_b === mItem.placeholderB) ||
                    (dbm.ph_home === mItem.placeholderA && dbm.ph_away === mItem.placeholderB)
                ))
            );

            const homeTeam = getMatchNodeTeam(nodeId, matchIdx, 'a', new Set(visited));
            const awayTeam = getMatchNodeTeam(nodeId, matchIdx, 'b', new Set(visited));

            const status = dbMatch?.status;
            const isFinished = isMatchEnded(status) || status === 'finished' || status === 'completed' || status === 'canceled' || status === 'cancelled' || !!dbMatch?.winner_id;

            let winner: ResolvedTeam | undefined;
            let loser: ResolvedTeam | undefined;

            if (isFinished && homeTeam && awayTeam) {
                let isHomeWon = false;
                let isAwayWon = false;

                if (dbMatch?.winner_id) {
                    const wid = String(dbMatch.winner_id);
                    const resolvedWinner = resolveTeam(wid);
                    if (resolvedWinner) {
                        if (resolvedWinner.id === homeTeam.id || resolvedWinner.name.toLowerCase() === homeTeam.name.toLowerCase()) {
                            isHomeWon = true;
                        } else if (resolvedWinner.id === awayTeam.id || resolvedWinner.name.toLowerCase() === awayTeam.name.toLowerCase()) {
                            isAwayWon = true;
                        }
                    }
                    if (!isHomeWon && !isAwayWon) {
                        if (wid === String(dbMatch.home_team_id) || wid === String(homeTeam.id) || wid.toLowerCase() === homeTeam.name.toLowerCase()) {
                            isHomeWon = true;
                        } else if (wid === String(dbMatch.away_team_id) || wid === String(awayTeam.id) || wid.toLowerCase() === awayTeam.name.toLowerCase()) {
                            isAwayWon = true;
                        }
                    }
                }

                if (!isHomeWon && !isAwayWon) {
                    const getScoreVal = (s: unknown) => (typeof s === 'object' && s !== null && 'total' in s ? Number((s as any).total) || 0 : Number(s) || 0);
                    const hScore = getScoreVal(dbMatch?.home_score);
                    const aScore = getScoreVal(dbMatch?.away_score);

                    if (hScore > aScore) {
                        isHomeWon = true;
                    } else if (aScore > hScore) {
                        isAwayWon = true;
                    }
                }

                if (isHomeWon) {
                    winner = homeTeam;
                    loser = awayTeam;
                } else if (isAwayWon) {
                    winner = awayTeam;
                    loser = homeTeam;
                }
            }

            const outcome: MatchOutcome = {
                nodeId,
                matchIndex: matchNumber,
                dbMatch,
                homeTeam,
                awayTeam,
                isFinished,
                winner,
                loser,
                label: nodeLabel,
            };

            outcomeCache.set(key, outcome);
            return outcome;
        };

        const matchOutcomes: MatchOutcome[] = [];
        matchNodes.forEach(node => {
            const nodeMatches = (node.data as any)?.matches || [];
            nodeMatches.forEach((_: any, idx: number) => {
                const outcome = getOutcome(node.id, idx);
                if (outcome) matchOutcomes.push(outcome);
            });
        });

        // Identify Knockout DAG Structure
        const thirdPlaceNodeIds = new Set<string>();
        matchNodes.forEach(node => {
            const hasLoserInput = edges.some(e => e.target === node.id && e.sourceHandle?.startsWith('loser'));
            const labelLower = ((node.data as { label?: string })?.label || "").toLowerCase();
            if (hasLoserInput || labelLower.includes('3rd') || labelLower.includes('third') || labelLower.includes('อันดับ 3')) {
                thirdPlaceNodeIds.add(node.id);
            }
        });

        const grandFinalNodeIds = new Set<string>();
        matchNodes.forEach(node => {
            if (thirdPlaceNodeIds.has(node.id)) return;
            const hasOutgoingWinner = edges.some(e =>
                e.source === node.id &&
                (!e.sourceHandle || e.sourceHandle.startsWith('winner')) &&
                matchNodes.some(targetNode => targetNode.id === e.target)
            );
            if (!hasOutgoingWinner) {
                grandFinalNodeIds.add(node.id);
            }
        });

        const nodeDistanceMap = new Map<string, number>();

        grandFinalNodeIds.forEach(id => {
            nodeDistanceMap.set(id, 0);
        });

        let changed = true;
        let maxIter = 10;
        while (changed && maxIter > 0) {
            changed = false;
            maxIter--;
            edges.forEach(edge => {
                if (thirdPlaceNodeIds.has(edge.target)) return;
                if ((!edge.sourceHandle || edge.sourceHandle.startsWith('winner')) && nodeDistanceMap.has(edge.target)) {
                    const targetDist = nodeDistanceMap.get(edge.target)!;
                    const currentSourceDist = nodeDistanceMap.get(edge.source);
                    const newDist = targetDist + 1;
                    if (currentSourceDist === undefined || newDist > currentSourceDist) {
                        nodeDistanceMap.set(edge.source, newDist);
                        changed = true;
                    }
                }
            });
        }

        const eliminatedTiers: Array<{
            tierName: 'champion' | 'runner_up' | 'third' | 'fourth' | 'knockout' | 'group';
            stageLabel: string;
            teams: ResolvedTeam[];
        }> = [];

        const assignedTeamIds = new Set<string>();
        const markAssigned = (team: ResolvedTeam) => {
            assignedTeamIds.add(team.id);
            assignedTeamIds.add(team.name.toLowerCase());
        };
        const isTeamAssigned = (team: ResolvedTeam) => {
            return assignedTeamIds.has(team.id) || assignedTeamIds.has(team.name.toLowerCase());
        };

        // 1. Grand Final Winner & Loser
        const champions: ResolvedTeam[] = [];
        const runnerUps: ResolvedTeam[] = [];

        grandFinalNodeIds.forEach(finalId => {
            const finalOutcomes = matchOutcomes.filter(mo => mo.nodeId === finalId);
            finalOutcomes.forEach(fo => {
                if (fo.winner && isApprovedTeam(fo.winner)) {
                    champions.push(fo.winner);
                    markAssigned(fo.winner);
                }
                if (fo.loser && isApprovedTeam(fo.loser)) {
                    runnerUps.push(fo.loser);
                    markAssigned(fo.loser);
                }
            });
        });

        // 2. 3rd Place Match
        const thirdPlaceWinners: ResolvedTeam[] = [];
        const fourthPlaceLosers: ResolvedTeam[] = [];

        thirdPlaceNodeIds.forEach(tpId => {
            const tpOutcomes = matchOutcomes.filter(mo => mo.nodeId === tpId);
            tpOutcomes.forEach(tpo => {
                if (tpo.winner && isApprovedTeam(tpo.winner) && !isTeamAssigned(tpo.winner)) {
                    thirdPlaceWinners.push(tpo.winner);
                    markAssigned(tpo.winner);
                }
                if (tpo.loser && isApprovedTeam(tpo.loser) && !isTeamAssigned(tpo.loser)) {
                    fourthPlaceLosers.push(tpo.loser);
                    markAssigned(tpo.loser);
                }
            });
        });

        if (thirdPlaceWinners.length > 0) {
            eliminatedTiers.push({
                tierName: 'third',
                stageLabel: locale === 'th' ? "อันดับ 3 (3rd Place)" : "3rd Place",
                teams: thirdPlaceWinners,
            });
        }

        if (fourthPlaceLosers.length > 0) {
            eliminatedTiers.push({
                tierName: 'fourth',
                stageLabel: locale === 'th' ? "อันดับ 4 (4th Place)" : "4th Place",
                teams: fourthPlaceLosers,
            });
        }

        // 3. Knockout Losers by Round Distance
        const distanceToNodes = new Map<number, string[]>();
        nodeDistanceMap.forEach((dist, nId) => {
            if (dist === 0) return;
            const list = distanceToNodes.get(dist) || [];
            list.push(nId);
            distanceToNodes.set(dist, list);
        });

        const sortedDistances = Array.from(distanceToNodes.keys()).sort((a, b) => a - b);

        sortedDistances.forEach(dist => {
            const nodesInDist = distanceToNodes.get(dist) || [];
            const losersInRound: ResolvedTeam[] = [];

            nodesInDist.forEach(nId => {
                const hasNextLoserMatch = edges.some(e =>
                    e.source === nId &&
                    e.sourceHandle?.startsWith('loser') &&
                    matchNodes.some(tn => tn.id === e.target)
                );

                const outcomes = matchOutcomes.filter(mo => mo.nodeId === nId);
                outcomes.forEach(o => {
                    if (o.loser && isApprovedTeam(o.loser) && !isTeamAssigned(o.loser)) {
                        if (!hasNextLoserMatch) {
                            losersInRound.push(o.loser);
                            markAssigned(o.loser);
                        }
                    }
                });
            });

            if (losersInRound.length > 0) {
                let stageName = "";
                if (dist === 1) {
                    stageName = locale === 'th' ? "ตกรอบรองชนะเลิศ (Semifinals)" : "Semifinalist";
                } else if (dist === 2) {
                    stageName = locale === 'th' ? "ตกรอบ 8 ทีมสุดท้าย (Quarterfinals)" : "Quarterfinalist";
                } else if (dist === 3) {
                    stageName = locale === 'th' ? "ตกรอบ 16 ทีมสุดท้าย (Round of 16)" : "Round of 16";
                } else {
                    stageName = locale === 'th' ? `ตกรอบน็อคเอาท์ (รอบที่ ${dist + 1})` : `Knockout Round ${dist + 1}`;
                }

                eliminatedTiers.push({
                    tierName: dist === 1 && thirdPlaceNodeIds.size === 0 ? 'third' : 'knockout',
                    stageLabel: stageName,
                    teams: losersInRound,
                });
            }
        });

        // 4. Standings / Group Stage Data
        interface GroupStandingsData {
            label: string;
            rankings: ResolvedTeam[];
            advancingCount: number;
        }

        const groupsData: GroupStandingsData[] = [];

        groupNodes.forEach(gNode => {
            const advCount = Number(gNode.data.advancingCount) || 2;
            const label = (gNode.data.label as string) || "Group";

            const computedRankings = dynamicGroupRankingsMap.get(gNode.id);
            if (computedRankings && computedRankings.length > 0) {
                groupsData.push({
                    label,
                    rankings: computedRankings,
                    advancingCount: advCount,
                });
                return;
            }

            const rawRankings = (gNode.data as { rankings?: string[] })?.rankings || (gNode.data as { teams?: string[] })?.teams || [];
            const resolvedRankings: ResolvedTeam[] = [];
            rawRankings.forEach(name => {
                const t = resolveTeam(name);
                if (t) resolvedRankings.push(t);
            });

            if (resolvedRankings.length > 0) {
                groupsData.push({
                    label,
                    rankings: resolvedRankings,
                    advancingCount: advCount,
                });
            }
        });

        const isKnockoutPresent = grandFinalNodeIds.size > 0;
        const areAllMatchesEnded = matches.length > 0 && matches.every(m => isMatchEnded(m.status) || m.status === 'finished' || m.status === 'completed' || m.status === 'canceled' || m.status === 'cancelled');

        if (!isKnockoutPresent && groupsData.length > 0) {
            // League / Single Table / Round-Robin Tournament (No Knockout Finals)
            const maxTeamsInGroup = Math.max(...groupsData.map(g => g.rankings.length));

            for (let pos = 0; pos < maxTeamsInGroup; pos++) {
                const teamsAtPos: ResolvedTeam[] = [];

                groupsData.forEach(g => {
                    const team = g.rankings[pos];
                    if (team && !isTeamAssigned(team)) {
                        teamsAtPos.push(team);
                        markAssigned(team);
                    }
                });

                if (teamsAtPos.length > 0) {
                    if (pos === 0) {
                        teamsAtPos.forEach(t => champions.push(t));
                    } else if (pos === 1) {
                        teamsAtPos.forEach(t => runnerUps.push(t));
                    } else {
                        const posNum = pos + 1;
                        let tierName: 'third' | 'fourth' | 'group' = 'group';
                        let stageLabel = locale === 'th' ? `อันดับ ${posNum} ของตาราง` : `Place ${posNum}`;
                        if (pos === 2) {
                            tierName = 'third';
                            stageLabel = locale === 'th' ? "อันดับ 3 (3rd Place)" : "3rd Place";
                        } else if (pos === 3) {
                            tierName = 'fourth';
                            stageLabel = locale === 'th' ? "อันดับ 4 (4th Place)" : "4th Place";
                        }
                        eliminatedTiers.push({
                            tierName,
                            stageLabel,
                            teams: teamsAtPos,
                        });
                    }
                }
            }
        } else if (groupsData.length > 0) {
            // Group + Knockout Tournament: Non-advancing teams get group rankings
            const maxTeamsInGroup = Math.max(...groupsData.map(g => g.rankings.length));
            let maxAdv = Math.max(...groupsData.map(g => g.advancingCount));
            if (maxAdv >= maxTeamsInGroup) maxAdv = 0;

            for (let pos = maxAdv; pos < maxTeamsInGroup; pos++) {
                const teamsAtPos: ResolvedTeam[] = [];

                groupsData.forEach(g => {
                    const team = g.rankings[pos];
                    if (team && !isTeamAssigned(team)) {
                        teamsAtPos.push(team);
                        markAssigned(team);
                    }
                });

                if (teamsAtPos.length > 0) {
                    const posNum = pos + 1;
                    const suffix = locale === 'th' ? `อันดับ ${posNum} ของกลุ่ม` : `Group ${posNum}${posNum === 1 ? 'st' : posNum === 2 ? 'nd' : posNum === 3 ? 'rd' : 'th'} Place`;
                    eliminatedTiers.push({
                        tierName: 'group',
                        stageLabel: suffix,
                        teams: teamsAtPos,
                    });
                }
            }
        }

        // 5. Find Active Teams (ทีมที่ยังอยู่ในการแข่งขัน)
        const allTeamsMap = new Map<string, ResolvedTeam>();

        // 1. Primary Reference: Approved teams from Team Management (การจัดการทีม)
        approvedRegistrations.forEach(r => {
            const canonicalId = String(r.existing_team_id || r.id);
            const resolved: ResolvedTeam = {
                id: canonicalId,
                name: r.team_name,
                logo_url: r.logo_url,
            };
            allTeamsMap.set(resolved.name.toLowerCase(), resolved);
        });

        // 2. Teams from storeTeams
        storeTeams.forEach(t => {
            if (String(t.registration_status || '').toLowerCase() === 'approved') {
                const res = resolveTeam(String(t.team_id || t.id)) || resolveTeam(t.name);
                if (res && isApprovedTeam(res) && !allTeamsMap.has(res.name.toLowerCase())) {
                    allTeamsMap.set(res.name.toLowerCase(), res);
                }
            }
        });

        // 4. Teams from match outcomes
        matchOutcomes.forEach(mo => {
            if (mo.homeTeam && isApprovedTeam(mo.homeTeam) && !allTeamsMap.has(mo.homeTeam.name.toLowerCase())) {
                allTeamsMap.set(mo.homeTeam.name.toLowerCase(), mo.homeTeam);
            }
            if (mo.awayTeam && isApprovedTeam(mo.awayTeam) && !allTeamsMap.has(mo.awayTeam.name.toLowerCase())) {
                allTeamsMap.set(mo.awayTeam.name.toLowerCase(), mo.awayTeam);
            }
        });

        // 5. Teams from group data
        groupsData.forEach(g => {
            g.rankings.forEach(t => {
                if (isApprovedTeam(t) && !allTeamsMap.has(t.name.toLowerCase())) {
                    allTeamsMap.set(t.name.toLowerCase(), t);
                }
            });
        });

        const activeList: { team: ResolvedTeam; currentStage: string; nextOpponent?: string }[] = [];

        allTeamsMap.forEach(team => {
            if (!isTeamAssigned(team)) {
                const activeMatch = matchOutcomes.find(mo =>
                    !mo.isFinished && (
                        (mo.homeTeam && (mo.homeTeam.id === team.id || mo.homeTeam.name.toLowerCase() === team.name.toLowerCase())) ||
                        (mo.awayTeam && (mo.awayTeam.id === team.id || mo.awayTeam.name.toLowerCase() === team.name.toLowerCase()))
                    )
                );

                let currentStage = locale === 'th' ? "อยู่ในการแข่งขัน" : "In Contention";
                let nextOpponent: string | undefined;

                if (activeMatch) {
                    currentStage = activeMatch.label;
                    const isHome = activeMatch.homeTeam?.id === team.id || activeMatch.homeTeam?.name.toLowerCase() === team.name.toLowerCase();
                    const opp = isHome ? activeMatch.awayTeam?.name : activeMatch.homeTeam?.name;
                    if (opp && opp !== "TBD" && opp !== "Bye") {
                        const m = activeMatch.dbMatch;
                        const getScoreVal = (s: unknown) => (typeof s === 'object' && s !== null && 'total' in s ? Number((s as any).total) || 0 : Number(s) || 0);
                        const hScore = m ? getScoreVal(m.home_score) : 0;
                        const aScore = m ? getScoreVal(m.away_score) : 0;
                        const hasScore = m && (m.status !== 'scheduled' || hScore > 0 || aScore > 0);
                        if (hasScore) {
                            const myScore = isHome ? hScore : aScore;
                            const oppScore = isHome ? aScore : hScore;
                            nextOpponent = `${opp} (${myScore} - ${oppScore})`;
                        } else {
                            nextOpponent = opp;
                        }
                    }
                } else if (groupsData.length > 0) {
                    const inGroup = groupsData.find(g => g.rankings.some(rt => rt.id === team.id || rt.name.toLowerCase() === team.name.toLowerCase()));
                    if (inGroup) {
                        currentStage = `${locale === 'th' ? "รอบแบ่งกลุ่ม" : "Group Stage"} (${inGroup.label})`;
                    }
                } else {
                    currentStage = locale === 'th' ? "รอการแข่งขัน" : "Waiting for match";
                }

                activeList.push({
                    team,
                    currentStage,
                    nextOpponent,
                });
            }
        });

        // 6. Build Single Unified Ranking List
        const unifiedList: UnifiedRankingItem[] = [];

        // Champion
        if (champions.length > 0) {
            champions.forEach(team => {
                const isFinalChampion = isKnockoutPresent || areAllMatchesEnded;
                unifiedList.push({
                    id: team.id,
                    team,
                    type: isFinalChampion ? 'champion' : 'active',
                    rank: 1,
                    stageLabel: isFinalChampion
                        ? (locale === 'th' ? "ชนะเลิศ (Champion)" : "Champion")
                        : (locale === 'th' ? "จ่าฝูง (อันดับ 1 ชั่วคราว)" : "Current Leader (1st Place)"),
                    isActive: !isFinalChampion,
                });
            });
        }

        // Runner-up
        if (runnerUps.length > 0) {
            runnerUps.forEach(team => {
                const isFinalRunnerUp = isKnockoutPresent || areAllMatchesEnded;
                unifiedList.push({
                    id: team.id,
                    team,
                    type: isFinalRunnerUp ? 'runner_up' : 'active',
                    rank: 2,
                    stageLabel: isFinalRunnerUp
                        ? (locale === 'th' ? "รองชนะเลิศอันดับ 1" : "Runner-up")
                        : (locale === 'th' ? "อันดับ 2 (กำลังแข่งขัน)" : "Current 2nd Place"),
                    isActive: !isFinalRunnerUp,
                });
            });
        }

        // Active Teams
        if (activeList.length > 0) {
            activeList.forEach(item => {
                unifiedList.push({
                    id: item.team.id,
                    team: item.team,
                    type: 'active',
                    stageLabel: item.currentStage,
                    nextOpponent: item.nextOpponent,
                    isActive: true,
                });
            });
        }

        // Eliminated Tiers (3rd place, 4th place, Knockout rounds, Group stages)
        const decidedTopCount = (champions.length > 0 ? champions.length : 0) + (runnerUps.length > 0 ? runnerUps.length : 0);
        let currentRank = decidedTopCount + activeList.length + 1;

        eliminatedTiers.forEach(tier => {
            const tierCount = tier.teams.length;
            const isTie = tierCount > 1;

            tier.teams.forEach(team => {
                unifiedList.push({
                    id: team.id,
                    team,
                    type: tier.tierName,
                    rank: currentRank,
                    stageLabel: tier.stageLabel,
                    isTie,
                    isActive: false,
                });
            });

            currentRank += tierCount;
        });

        const approvedUnifiedList = unifiedList.filter(item => isApprovedTeam(item.team));

        return {
            items: approvedUnifiedList,
            activeCount: approvedUnifiedList.filter(i => i.isActive).length,
        };
    }, [nodes, edges, matches, storeMatches, localMatches, teamRegistrations, storeTeams, resolvedCategoryId, locale]);

    // Filter by search query
    const filteredItems = React.useMemo(() => {
        if (!searchQuery.trim()) return items;
        const q = searchQuery.toLowerCase();
        return items.filter(item =>
            item.team.name.toLowerCase().includes(q) ||
            item.stageLabel.toLowerCase().includes(q) ||
            (item.nextOpponent && item.nextOpponent.toLowerCase().includes(q))
        );
    }, [items, searchQuery]);

    // Note: Automatic status completion is handled only when all matches in the tournament are finished or grace period passes

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
            {/* Search and Refresh Bar */}
            <div className="p-4 border-b flex items-center shrink-0">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        size="sm"
                        placeholder={locale === 'th' ? "ค้นหาชื่อทีมหรือรอบ..." : "Search team or round..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3 custom-scrollbar">
                {/* Header Info */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Header level={4}>
                            {locale === 'th' ? "ตารางอันดับการแข่งขัน" : "Tournament Standings"}
                        </Header>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeCount > 0 ? (
                            <Badge variant="success" size="sm" className="font-bold text-[10px] px-2 py-0.5">
                                {locale === 'th'
                                    ? `อยู่ในการแข่งขัน ${activeCount}/${items.length}`
                                    : `In Contention ${activeCount}/${items.length}`}
                            </Badge>
                        ) : items.length > 0 ? (
                            <Badge variant="outline" size="sm" className="font-bold text-[10px] px-2 py-0.5 text-muted-foreground border-border">
                                <CheckCircle2 className="size-3 text-emerald-500" />
                                {locale === 'th'
                                    ? `เสร็จสิ้นการแข่งขัน (${items.length}/${items.length})`
                                    : `Completed (${items.length}/${items.length})`}
                            </Badge>
                        ) : null}
                    </div>
                </div>

                {filteredItems.length === 0 ? (
                    <div className="py-8 text-center border border-dashed rounded-sm bg-muted/10 p-6">
                        <AlertCircle className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-bold text-foreground">
                            {locale === 'th' ? "ยังไม่มีข้อมูลทีมในการแข่งขัน" : "No teams found"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 max-w-[260px] mx-auto">
                            {locale === 'th'
                                ? "เมื่อเพิ่มทีมในสายการแข่งขันและบันทึกผล อันดับจะถูกประมวลผลอัตโนมัติ"
                                : "Add teams and record match outcomes to view standings."}
                        </p>
                    </div>
                ) : (
                    <div className="border border-border bg-card rounded-sm divide-y divide-border overflow-hidden">
                        {filteredItems.map((item, idx) => {
                            const isChamp = item.type === 'champion';
                            const isSecond = item.type === 'runner_up';
                            const isThird = item.type === 'third';
                            const isPodium = isChamp || isSecond || isThird;

                            return (
                                <div
                                    key={`${item.id}-${idx}`}
                                    className={cn(
                                        "flex items-center justify-between p-2.5 transition-all gap-2",
                                        isChamp && "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent",
                                        isSecond && "bg-gradient-to-r from-slate-400/10 via-slate-400/5 to-transparent",
                                        isThird && "bg-gradient-to-r from-amber-700/10 via-amber-700/5 to-transparent",
                                        item.isActive && "bg-muted/10 hover:bg-muted/30",
                                        !isPodium && !item.isActive && "hover:bg-muted/30"
                                    )}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {/* Rank / Status Badge */}
                                        <div
                                            className={cn(
                                                "flex items-center justify-center font-bold text-sm shrink-0",
                                                isChamp && "text-amber-800 dark:text-amber-600 font-bold",
                                                isSecond && "text-slate-600 dark:text-slate-600 font-bold",
                                                isThird && "text-amber-800 dark:text-amber-600 font-bold",
                                                item.isActive && "text-primary",
                                                !isPodium && !item.isActive && "text-sm"
                                            )}
                                        >
                                            {isChamp ? (
                                                <Trophy className="size-4 fill-amber-800 dark:fill-amber-600" />
                                            ) : isSecond ? (
                                                <span className="">2</span>
                                            ) : isThird ? (
                                                <span className="">3</span>
                                            ) : item.isActive ? (
                                                <Flame className="size-4 fill-primary" />
                                            ) : (
                                                item.rank ?? "-"
                                            )}
                                        </div>

                                        {/* Team Crest & Name */}
                                        <div className="size-9 rounded-full bg-muted-foreground/10 flex items-center justify-center overflow-hidden shrink-0">
                                            {item.team.logo_url ? (
                                                <Image
                                                    src={item.team.logo_url}
                                                    alt={item.team.name}
                                                    width={28}
                                                    height={28}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-xs font-bold text-muted-foreground">
                                                    {item.team.name.slice(0, 2).toUpperCase()}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn(
                                                    "text-xs truncate",
                                                    isChamp ? "font-black text-amber-500 text-sm" : isSecond ? "font-black text-foreground" : "font-bold text-foreground"
                                                )}>
                                                    {item.team.name}
                                                </span>
                                                {item.isTie && (
                                                    <span className="text-[9px] text-muted-foreground font-semibold shrink-0">
                                                        ({locale === 'th' ? "ร่วม" : "tied"})
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-muted-foreground truncate">
                                                {item.stageLabel}
                                                {item.nextOpponent && (
                                                    <span className="text-foreground/80 font-bold ml-1">
                                                        vs {item.nextOpponent}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Stage / Status Badge on right */}
                                    <div className="shrink-0 flex items-center">
                                        {isChamp ? (
                                            <div className="text-amber-500 dark:text-amber-500 text-xs font-bold">
                                                1st
                                            </div>
                                        ) : isSecond ? (
                                            <div className="text-slate-600 dark:text-slate-600 text-xs font-bold">
                                                2nd
                                            </div>
                                        ) : isThird ? (
                                            <div className="text-amber-800 dark:text-amber-600 text-xs font-bold">
                                                3rd
                                            </div>
                                        ) : item.isActive ? (
                                            <div className="text-xs text-primary font-bold">
                                                {locale === 'th' ? "กำลังแข่งขัน" : "Active"}
                                            </div>
                                        ) : (
                                            <div className="text-xs font-bold text-muted-foreground">
                                                #{item.rank}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
