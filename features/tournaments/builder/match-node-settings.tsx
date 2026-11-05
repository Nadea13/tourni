"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import Image from "next/image";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { X, Plus, Loader2, Shield, ArrowLeftRight, Lock } from "lucide-react";
import { useBracketStore } from "@/lib/stores/bracket-store";
import { saveBracketCanvas } from "@/actions/tournaments/bracket";
import { useToast } from "@/hooks/use-toast";
import { isMatchEnded, hasMatchResult, isSameTeamIdentifier } from "./match-node";
import { Match, Registration, Tournament } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/components/ui/dropdown";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { MatchSettingTimerPill } from "./live-match-timer";
import { TeamRosterDetailsDialog } from "@/features/dialogs";

export type MatchItem = {
    id: string;
    placeholderA: string;
    placeholderB: string;
    match_date?: string;
    match_time?: string;
    field_name?: string;
    venue?: string;
    dbId?: string;
    matchId?: string;
};

export interface MatchNodeSettingsProps {
    id: string;
    data: Record<string, any>;
    tournamentId: string;
    activeCategoryId?: string | null;
    dbMatches: Match[];
    tournament?: Tournament;
    isLocked?: boolean;
}

export function MatchNodeSettings({
    id,
    data,
    tournamentId,
    activeCategoryId,
    dbMatches,
    tournament,
    isLocked = false,
}: MatchNodeSettingsProps) {
    const locale = useLocale();
    const router = useRouter();
    const { toast } = useToast();
    const { nodes, edges, teams, sport: storeSport, matches: storeMatches, updateNodeData, getCanvasData, setMatches: setStoreMatches, onEdgesChange } = useBracketStore();
    const [isCreatingConsoleId, setIsCreatingConsoleId] = React.useState<string | null>(null);
    const [selectedTeamForDetails, setSelectedTeamForDetails] = React.useState<Registration | null>(null);
    const [customCourtMatchId, setCustomCourtMatchId] = React.useState<string | null>(null);
    const [customCourtValue, setCustomCourtValue] = React.useState("");
    const activeDbMatches = storeMatches.length > 0 ? storeMatches : dbMatches;

    const availableCourts: string[] = React.useMemo(() => {
        const set = new Set<string>();

        // 1. From tournament settings.fields
        if (Array.isArray(tournament?.settings?.fields)) {
            tournament.settings.fields.forEach((f: unknown) => {
                if (typeof f === 'string' && f.trim()) set.add(f.trim());
            });
        }

        // 2. From tournament number_of_pitches
        const numPitches = tournament?.number_of_pitches;
        if (typeof numPitches === 'number' && numPitches > 0) {
            for (let i = 1; i <= numPitches; i++) {
                set.add(locale === 'th' ? `สนาม ${i}` : `Pitch ${i}`);
            }
        }

        // 3. From all matches in canvas nodes
        nodes.forEach(n => {
            const matches = (n.data as any)?.matches;
            if (Array.isArray(matches)) {
                matches.forEach((m: any) => {
                    const name = (m.field_name || m.venue || "").trim();
                    if (name) set.add(name);
                });
            }
        });

        // 4. From activeDbMatches
        activeDbMatches.forEach(m => {
            const name = (m.field_name || m.venue || "").trim();
            if (name) set.add(name);
        });

        // 5. Friendly defaults if still empty
        if (set.size === 0) {
            set.add(locale === 'th' ? "สนาม 1" : "Pitch 1");
            set.add(locale === 'th' ? "สนาม 2" : "Pitch 2");
        }

        return Array.from(set);
    }, [tournament?.settings?.fields, tournament?.number_of_pitches, nodes, activeDbMatches, locale]);

    // Resolve live teams from edges or database assignments
    const getResolvedTeam = React.useCallback(
        (targetId: string, handleId: string, dbMatch: Match | undefined, slot: 'a' | 'b', placeholder?: string) => {
            const trimmedPlaceholder = (placeholder || "").trim();
            const isSlotTBD = !trimmedPlaceholder || trimmedPlaceholder === "TBD" || trimmedPlaceholder.startsWith("Seed #");
            const hasResult = hasMatchResult(dbMatch);
            let edge = edges.find(e => e.target === targetId && e.targetHandle === handleId);

            let isFromRound = false;
            let roundPairIdx = 0;

            if (!edge) {
                const roundEdge = edges.find(e => {
                    if (e.target !== targetId) return false;
                    const sNode = nodes.find(n => n.id === e.source);
                    if (!sNode || sNode.type !== 'matchNode') return false;
                    return (Array.isArray(sNode.data.matches) && sNode.data.matches.length > 1) || e.sourceHandle === 'round-out' || Boolean(sNode.data.isRound);
                });
                if (roundEdge) {
                    edge = roundEdge;
                    isFromRound = true;
                    const allRoundEdges = edges
                        .filter(e => e.source === roundEdge.source)
                        .sort((eA, eB) => {
                            const nA = nodes.find(n => n.id === eA.target);
                            const nB = nodes.find(n => n.id === eB.target);
                            return (nA?.position?.y ?? 0) - (nB?.position?.y ?? 0);
                        });
                    roundPairIdx = Math.max(0, allRoundEdges.findIndex(e => e.target === targetId));
                }
            } else {
                const sNode = nodes.find(n => n.id === edge?.source);
                if (sNode && sNode.type === 'matchNode' && ((Array.isArray(sNode.data.matches) && sNode.data.matches.length > 1) || edge.sourceHandle === 'round-out' || Boolean(sNode.data.isRound))) {
                    isFromRound = true;
                    const allRoundEdges = edges
                        .filter(e => e.source === sNode.id)
                        .sort((eA, eB) => {
                            const nA = nodes.find(n => n.id === eA.target);
                            const nB = nodes.find(n => n.id === eB.target);
                            return (nA?.position?.y ?? 0) - (nB?.position?.y ?? 0);
                        });
                    roundPairIdx = Math.max(0, allRoundEdges.findIndex(e => e.target === targetId));
                }
            }

            // When match has no results and no incoming edge, use the node's placeholder directly so edits/swaps reflect in real time
            if (!hasResult && !edge) {
                if (isSlotTBD) return null;
                return trimmedPlaceholder;
            }

            // 1. If we have a database match with a team ID assigned, use it UNLESS explicitly cleared to TBD without results
            if (dbMatch && (hasResult || !edge)) {
                if (!hasResult && isSlotTBD) {
                    return null;
                }
                const teamId = slot === 'a' ? dbMatch.home_team_id : dbMatch.away_team_id;
                if (teamId) {
                    const team = teams.find(t => String(t.team_id || t.id) === String(teamId));
                    if (team) return team.name;
                }
                if (slot === 'a' && dbMatch.home_team?.name) return dbMatch.home_team.name;
                if (slot === 'b' && dbMatch.away_team?.name) return dbMatch.away_team.name;
            }

            // 2. Fall back to resolved placeholder/ranking/label from edge connections
            if (!edge) return null;

            const sourceNode = nodes.find(n => n.id === edge.source);
            if (!sourceNode) return null;

            // Handle StandingNode/GroupNode propagation
            if (sourceNode.type === 'standingNode' || sourceNode.type === 'groupNode') {
                const rankMatch = edge.sourceHandle?.match(/rank-(\d+)/);
                if (rankMatch) {
                    const rankIndex = parseInt(rankMatch[1], 10);
                    const rankings = (sourceNode.data as { rankings?: string[] }).rankings || [];
                    if (rankings[rankIndex]) return rankings[rankIndex];

                    const rankSuffix = rankIndex === 0 ? "1st" : rankIndex === 1 ? "2nd" : rankIndex === 2 ? "3rd" : `${rankIndex + 1}th`;
                    return `${rankSuffix} Place (${sourceNode.data.label})`;
                }
            }

            // Handle MatchNode propagation (Winner / Loser)
            if (sourceNode.type === 'matchNode') {
                let matchIdx = -1;
                let isWinnerHandle = true;

                if (isFromRound) {
                    const targetN = nodes.find(n => n.id === targetId);
                    const isTargetRound = Boolean(targetN?.data.isRound) || (Array.isArray(targetN?.data.matches) && targetN.data.matches.length > 1);
                    const matchIndexInNode = parseInt(handleId.split('-')[2] || '0', 10);
                    matchIdx = isTargetRound ? (matchIndexInNode * 2 + (slot === 'a' ? 0 : 1)) : (roundPairIdx * 2 + (slot === 'a' ? 0 : 1));
                    isWinnerHandle = true;
                } else {
                    const winnerMatch = edge.sourceHandle?.match(/winner-(\d+)/);
                    const loserMatch = edge.sourceHandle?.match(/loser-(\d+)/);
                    isWinnerHandle = !loserMatch;
                    matchIdx = winnerMatch ? parseInt(winnerMatch[1], 10) : loserMatch ? parseInt(loserMatch[1], 10) : -1;
                }

                if (matchIdx !== -1) {
                    const sourceMatches = Array.isArray(sourceNode.data.matches) ? (sourceNode.data.matches as any[]) : [];
                    if (isFromRound && matchIdx >= sourceMatches.length) {
                        return "Bye";
                    }
                    const sourceMatchItem = sourceMatches[matchIdx];

                    const sourceDbMatch = (activeDbMatches || []).find(m =>
                        (sourceMatchItem?.dbId && m.id === sourceMatchItem.dbId) ||
                        (sourceMatchItem?.matchId && m.id === sourceMatchItem.matchId) ||
                        (m.node_id === sourceNode.id && ((m.idx_match ?? m.match_index) === (matchIdx + 1))) ||
                        (sourceMatchItem && m.placeholder_a === sourceMatchItem.placeholderA && m.placeholder_b === sourceMatchItem.placeholderB) ||
                        (sourceMatchItem && m.ph_home === sourceMatchItem.placeholderA && m.ph_away === sourceMatchItem.placeholderB)
                    );

                    const isSourceEnded = isMatchEnded(sourceDbMatch?.status);

                    if (isSourceEnded && sourceDbMatch) {
                        let winnerTeamId: string | null = sourceDbMatch.winner_id || null;
                        let loserTeamId: string | null = null;

                        const getScoreNum = (score: unknown) => {
                            if (typeof score === 'object' && score !== null && 'total' in score) {
                                return Number((score as { total?: number }).total) || 0;
                            }
                            return Number(score ?? 0);
                        };
                        const homeScore = getScoreNum(sourceDbMatch.home_score);
                        const awayScore = getScoreNum(sourceDbMatch.away_score);

                        if (!winnerTeamId) {
                            if (homeScore > awayScore) {
                                winnerTeamId = sourceDbMatch.home_team_id;
                                loserTeamId = sourceDbMatch.away_team_id;
                            } else if (awayScore > homeScore) {
                                winnerTeamId = sourceDbMatch.away_team_id;
                                loserTeamId = sourceDbMatch.home_team_id;
                            }
                        } else {
                            loserTeamId = winnerTeamId === sourceDbMatch.home_team_id
                                ? sourceDbMatch.away_team_id
                                : sourceDbMatch.home_team_id;
                        }

                        const targetTeamId = isWinnerHandle ? winnerTeamId : loserTeamId;

                        if (targetTeamId) {
                            const team = teams.find(t => String(t.team_id || t.id) === String(targetTeamId));
                            if (team?.name) return team.name;

                            if (String(sourceDbMatch.home_team_id) === String(targetTeamId) && sourceDbMatch.home_team?.name) {
                                return sourceDbMatch.home_team.name;
                            }
                            if (String(sourceDbMatch.away_team_id) === String(targetTeamId) && sourceDbMatch.away_team?.name) {
                                return sourceDbMatch.away_team.name;
                            }
                        }

                        if (!targetTeamId && homeScore !== awayScore) {
                            const isHomeWinner = homeScore > awayScore;
                            const wantHome = isWinnerHandle ? isHomeWinner : !isHomeWinner;
                            const chosen = wantHome ? sourceMatchItem?.placeholderA : sourceMatchItem?.placeholderB;
                            if (chosen && chosen !== 'TBD') return chosen;
                        }
                    }

                    const isMultiMatch = sourceMatches.length > 1;
                    const labelBase = isFromRound ? `Match ${matchIdx + 1}` : (isMultiMatch ? `Match ${matchIdx + 1}` : (sourceNode.data.label ? `${sourceNode.data.label}` : `Match ${matchIdx + 1}`));
                    if (isWinnerHandle) {
                        return `Winner (${labelBase})`;
                    } else {
                        return `Loser (${labelBase})`;
                    }
                }
            }

            return null;
        },
        [activeDbMatches, edges, nodes, teams]
    );

    const groupEdge = edges.find(e => e.target === id && e.targetHandle === 'group-in');
    const connectedGroupNode = groupEdge ? nodes.find(n => n.id === groupEdge.source) : null;

    const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    const isPlaceholderLabel = (label?: string | null) => {
        const trimmed = (label || "").trim();
        return (
            !trimmed ||
            trimmed === "TBD" ||
            trimmed === "Bye" ||
            trimmed.startsWith("Seed #") ||
            trimmed.startsWith("Winner (") ||
            trimmed.startsWith("Winner of") ||
            trimmed.startsWith("Loser (") ||
            trimmed.startsWith("Loser of") ||
            /^\d+(st|nd|rd|th) Place \(/.test(trimmed)
        );
    };

    const findTeamByNameOrId = (teamLabel?: string | null, teamId?: string | null) => {
        const trimmed = (teamLabel || "").trim();
        if (trimmed && !isPlaceholderLabel(trimmed)) {
            const byName = teams.find((t) => t.name.trim().toLowerCase() === trimmed.toLowerCase());
            if (byName) return byName;
        }
        if (teamId) {
            return teams.find((t) => String(t.id) === String(teamId) || String(t.team_id) === String(teamId));
        }
        return undefined;
    };

    const handleOpenTeamDetails = async (teamLabel: string, teamId?: string | null, fallbackLogo?: string | null) => {
        const trimmed = (teamLabel || "").trim();
        if (isPlaceholderLabel(trimmed)) {
            return;
        }

        const buildRegistration = (item: any): Registration => {
            const ps = String(item?.payment_status || "").toLowerCase();
            const rs = String(item?.registration_status || "").toLowerCase();
            const s = String(item?.status || "").toLowerCase();

            let mappedStatus: "PENDING" | "PAID" | "REJECTED" = "PAID";
            if (rs === "rejected" || ps === "rejected" || s === "rejected") {
                mappedStatus = "REJECTED";
            } else if (rs === "pending" || ps === "pending" || s === "pending") {
                mappedStatus = "PENDING";
            }

            return {
                id: String(item?.id || teamId || trimmed),
                tournament_id: item?.tournament_id || tournamentId,
                team_name: item?.team?.name || item?.name || trimmed,
                contact_name: item?.contact_name || item?.team?.contact_name || "",
                contact_phone: item?.contact_phone || item?.team?.contact_phone || "",
                logo_url: fallbackLogo || item?.team?.logo_img || item?.team?.logo_url || item?.logo_img || item?.logo_url || null,
                existing_team_id: item?.team_id || item?.team?.id || null,
                slip_url: item?.slip_img || item?.slip_url || null,
                payment_status: mappedStatus,
                trans_ref: item?.remark || null,
                description: item?.team?.description || item?.description || null,
                tournament_team_id: String(item?.tournament_team_id || item?.id || teamId || ""),
                created_at: item?.created_at || new Date().toISOString(),
            };
        };

        const matchTeam = (list: any[]) =>
            list.find(
                (t) =>
                    (teamId && (String(t.id) === String(teamId) || String(t.team_id) === String(teamId))) ||
                    String(t.team?.name || t.name || "").trim().toLowerCase() === trimmed.toLowerCase()
            );

        const foundInStore = matchTeam(teams);
        if (foundInStore) {
            setSelectedTeamForDetails(buildRegistration(foundInStore));
            return;
        }

        // Open immediately with fallback info and enrich from API if available
        setSelectedTeamForDetails(buildRegistration({ id: teamId, name: trimmed, logo_url: fallbackLogo }));

        if (tournamentId) {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";
                const url = activeCategoryId
                    ? `${apiUrl}/tournaments/${tournamentId}/teams?category_id=${activeCategoryId}`
                    : `${apiUrl}/tournaments/${tournamentId}/teams`;
                const res = await fetch(url, { cache: "no-store" });
                if (res.ok) {
                    const raw = await res.json();
                    const list = Array.isArray(raw) ? raw : raw?.data || [];
                    const found = matchTeam(list);
                    if (found) {
                        setSelectedTeamForDetails(buildRegistration(found));
                    }
                }
            } catch {
                // keep fallback details
            }
        }
    };

    const renderTeamAvatar = (
        teamLabel: string,
        options?: {
            teamId?: string | null;
            fallbackLogo?: string | null;
            fallbackBadge?: string;
            size?: "sm" | "md";
        }
    ) => {
        const size = options?.size || "sm";
        const foundTeam = findTeamByNameOrId(teamLabel, options?.teamId);
        const logoUrl = foundTeam?.logo_url || options?.fallbackLogo;
        const isReal = Boolean(foundTeam || options?.teamId || !isPlaceholderLabel(teamLabel));
        const dimClass = size === "md" ? "size-8" : "size-5";
        const pxSize = size === "md" ? 32 : 20;

        if (logoUrl) {
            return (
                <span
                    className={cn(
                        "rounded-full border bg-muted/50 flex items-center justify-center overflow-hidden shrink-0",
                        dimClass
                    )}
                >
                    <Image
                        src={logoUrl}
                        alt={teamLabel}
                        width={pxSize}
                        height={pxSize}
                        className="w-full h-full object-cover"
                    />
                </span>
            );
        }

        if (isReal) {
            return (
                <span
                    className={cn(
                        "rounded-full border border-node-2/30 bg-node-2/10 text-node-2 flex items-center justify-center font-black shrink-0",
                        dimClass,
                        size === "md" ? "text-[10px]" : "text-[8px]"
                    )}
                >
                    {getInitials(foundTeam?.name || teamLabel)}
                </span>
            );
        }

        return (
            <span
                className={cn(
                    "rounded-full border bg-muted/50 text-muted-foreground flex items-center justify-center font-black shrink-0",
                    dimClass,
                    size === "md" ? "text-[10px]" : "text-[8px]"
                )}
            >
                {options?.fallbackBadge ? (
                    options.fallbackBadge
                ) : (
                    <Shield className={size === "md" ? "size-4" : "size-3"} />
                )}
            </span>
        );
    };

    const isTeamApproved = React.useCallback((item: any) => {
        const ps = String(item?.payment_status || "").toLowerCase();
        const rs = String(item?.registration_status || "").toLowerCase();
        const s = String(item?.status || "").toLowerCase();
        if (rs === "rejected" || ps === "rejected" || s === "rejected") return false;
        return (
            rs === "approved" ||
            rs === "confirmed" ||
            s === "approved" ||
            (s === "registered" && rs !== "pending" && ps !== "pending")
        );
    }, []);

    const approvedTeams = React.useMemo(
        () => teams.filter((t) => isTeamApproved(t)),
        [teams, isTeamApproved]
    );

    const getSelectOptions = () => {
        const options = new Set<string>();
        if (connectedGroupNode) {
            const groupTeamCount = (connectedGroupNode.data as { teamCount?: number }).teamCount || 0;
            const groupTeams = (connectedGroupNode.data as { teams?: string[] }).teams || [];
            for (let i = 0; i < groupTeamCount; i++) {
                const name = groupTeams[i];
                if (name && name !== "TBD" && approvedTeams.some(t => t.name.trim().toLowerCase() === name.trim().toLowerCase())) {
                    options.add(name);
                }
            }
        }
        return Array.from(options);
    };

    const getSelectItems = (optionsList: string[], opponentTeam: string | null) => {
        const rendered = new Set<string>();
        rendered.add("TBD");
        const items: React.ReactNode[] = [];

        optionsList.forEach(opt => {
            if (!rendered.has(opt)) {
                rendered.add(opt);
                const isOpponent = Boolean(opponentTeam && isSameTeamIdentifier(opt, opponentTeam));
                items.push(
                    <SelectItem key={opt} value={opt} disabled={isOpponent}>
                        <span className="flex items-center gap-2 min-w-0">
                            {renderTeamAvatar(opt, { size: "sm" })}
                            <span className="truncate">
                                {opt}
                                {isOpponent ? (locale === "th" ? " (คู่แข่ง)" : " (Opponent)") : ""}
                            </span>
                        </span>
                    </SelectItem>
                );
            }
        });

        approvedTeams.forEach(t => {
            if (!rendered.has(t.name)) {
                rendered.add(t.name);
                const isOpponent = Boolean(opponentTeam && isSameTeamIdentifier(t.name, opponentTeam));
                items.push(
                    <SelectItem key={t.id} value={t.name} disabled={isOpponent}>
                        <span className="flex items-center gap-2 min-w-0">
                            {renderTeamAvatar(t.name, { teamId: t.team_id || t.id, fallbackLogo: t.logo_url, size: "sm" })}
                            <span className="truncate">
                                {t.name}
                                {isOpponent ? (locale === "th" ? " (คู่แข่ง)" : " (Opponent)") : ""}
                            </span>
                        </span>
                    </SelectItem>
                );
            }
        });
        return items;
    };

    const sortedMatches = ((data.matches as MatchItem[]) || [])
        .slice()
        .sort((a, b) => {
            const dateA = a.match_date || "9999-12-31";
            const timeA = a.match_time || "23:59";
            const dateB = b.match_date || "9999-12-31";
            const timeB = b.match_time || "23:59";
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return timeA.localeCompare(timeB);
        });

    return (
        <div className="space-y-3" id="node-settings-match-schedule">
            <div className="flex items-center justify-between">
                <Label>{locale === "th" ? "รายการแมตช์ในโหนด" : "Matches in Node"}</Label>
                <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                    {sortedMatches.length} {locale === "th" ? "แมตช์" : "Matches"}
                </span>
            </div>
            <div className="space-y-3">
                {sortedMatches.map((match, idx) => {
                    const updateMatch = (updates: Partial<MatchItem>) => {
                        const originalMatches = [...((data.matches as MatchItem[]) || [])];
                        const matchIdx = originalMatches.findIndex(m => m.id === match.id);
                        if (matchIdx !== -1) {
                            originalMatches[matchIdx] = { ...originalMatches[matchIdx], ...updates };
                            updateNodeData(id, { matches: originalMatches });
                        }
                    };

                    const dbMatch = activeDbMatches.find(m =>
                        (match.dbId && m.id === match.dbId) ||
                        (match.matchId && m.id === match.matchId) ||
                        (m.node_id === id && m.match_index === (idx + 1)) ||
                        (m.placeholder_a === match.placeholderA && m.placeholder_b === match.placeholderB)
                    );
                    const hasResult = hasMatchResult(dbMatch);
                    const liveTeamA = getResolvedTeam(id, `slot-a-${idx}`, dbMatch, 'a', match.placeholderA);
                    const liveTeamB = getResolvedTeam(id, `slot-b-${idx}`, dbMatch, 'b', match.placeholderB);

                    const displayHomeName = liveTeamA || match.placeholderA || "TBD";
                    const displayAwayName = liveTeamB || match.placeholderB || "TBD";

                    const homeOptions = getSelectOptions();
                    const awayOptions = getSelectOptions();

                    const homeSelectItems = getSelectItems(homeOptions, displayAwayName);
                    const awaySelectItems = getSelectItems(awayOptions, displayHomeName);

                    const matchConsoleId = match.dbId || match.matchId || dbMatch?.id || (!!data.matchId && idx === 0 ? (data.matchId as string) : undefined);

                    const getScoreDisplay = (s: unknown) => {
                        if (s === null || s === undefined) return null;
                        if (typeof s === "object" && "total" in (s as Record<string, unknown>)) {
                            return String((s as Record<string, unknown>).total ?? 0);
                        }
                        return String(s);
                    };
                    const showScore = dbMatch && dbMatch.status && dbMatch.status !== "scheduled" && (dbMatch.home_score !== null || dbMatch.away_score !== null);

                    const handleSwapTeams = () => {
                        if (hasResult) return;
                        const nextHome = displayAwayName;
                        const nextAway = displayHomeName;

                        const nextHomeTeam = findTeamByNameOrId(nextHome);
                        const nextAwayTeam = findTeamByNameOrId(nextAway);
                        const nextHomeTid = isPlaceholderLabel(nextHome) ? null : (nextHomeTeam ? (nextHomeTeam.team_id || nextHomeTeam.id) : null);
                        const nextAwayTid = isPlaceholderLabel(nextAway) ? null : (nextAwayTeam ? (nextAwayTeam.team_id || nextAwayTeam.id) : null);

                        if (dbMatch) {
                            setStoreMatches((prev: Match[]) =>
                                prev.map((m) => {
                                    if (m.id === dbMatch.id || (m.node_id === id && (m.idx_match ?? m.match_index) === idx + 1)) {
                                        return {
                                            ...m,
                                            home_team_id: nextHomeTid,
                                            home_team: nextHomeTid && nextHomeTeam ? { id: nextHomeTid, name: nextHomeTeam.name, logo_url: nextHomeTeam.logo_url } : undefined,
                                            placeholder_a: nextHome,
                                            placeholder_home: nextHome,
                                            away_team_id: nextAwayTid,
                                            away_team: nextAwayTid && nextAwayTeam ? { id: nextAwayTid, name: nextAwayTeam.name, logo_url: nextAwayTeam.logo_url } : undefined,
                                            placeholder_b: nextAway,
                                            placeholder_away: nextAway,
                                        };
                                    }
                                    return m;
                                })
                            );
                        }

                        updateMatch({ placeholderA: nextHome, placeholderB: nextAway });
                        useBracketStore.setState({ isDirty: true });
                    };

                    return (
                        <div key={match.id || idx} className="bg-card border rounded-sm overflow-hidden shadow-xs relative group">
                            {/* Card Header */}
                            <div className="px-4 py-2 border-b flex justify-between items-center gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="text-node-2 text-sm font-black flex items-center justify-center shrink-0">
                                        VS
                                    </span>
                                    <span className="text-sm font-bold tracking-tight shrink-0">
                                        {locale === "th" ? `แมตช์ที่ ${idx + 1}` : `Match #${idx + 1}`}
                                    </span>
                                    <DateTimePicker
                                        disabled={hasResult || tournament?.status === 'completed'}
                                        date={match.match_date}
                                        time={match.match_time}
                                        onChange={(date, time) => {
                                            updateMatch({ match_date: date, match_time: time });
                                        }}
                                        placeholder={locale === "th" ? "เลือกวันและเวลาแข่ง" : "Select date & time"}
                                        size="sm"
                                        className="h-7 px-2 text-xs min-w-0"
                                    />
                                    {/* Court / Pitch Selector */}
                                    {(() => {
                                        const currentCourt = (match.field_name || match.venue || "").trim();
                                        const matchCourts = currentCourt && !availableCourts.includes(currentCourt)
                                            ? [currentCourt, ...availableCourts]
                                            : availableCourts;
                                        const isCustom = customCourtMatchId === (match.id || String(idx));

                                        if (isCustom) {
                                            return (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        disabled={hasResult || tournament?.status === 'completed'}
                                                        value={customCourtValue}
                                                        onChange={(e) => setCustomCourtValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                const finalVal = customCourtValue.trim() ? customCourtValue.trim() : undefined;
                                                                updateMatch({ field_name: finalVal, venue: finalVal });
                                                                useBracketStore.setState({ isDirty: true });
                                                                setCustomCourtMatchId(null);
                                                            } else if (e.key === "Escape") {
                                                                setCustomCourtMatchId(null);
                                                            }
                                                        }}
                                                        placeholder={locale === "th" ? "ชื่อสนาม..." : "Court name..."}
                                                        className="h-7 px-2 text-xs border rounded-sm bg-background text-foreground w-24 shrink-0 focus:outline-none focus:ring-1 focus:ring-primary"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const finalVal = customCourtValue.trim() ? customCourtValue.trim() : undefined;
                                                            updateMatch({ field_name: finalVal, venue: finalVal });
                                                            useBracketStore.setState({ isDirty: true });
                                                            setCustomCourtMatchId(null);
                                                        }}
                                                        className="h-7 px-1.5 text-xs bg-primary text-black font-semibold rounded-sm hover:bg-primary/90 cursor-pointer"
                                                        title={locale === "th" ? "บันทึกสนาม" : "Save"}
                                                    >
                                                        ✓
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCustomCourtMatchId(null)}
                                                        className="h-7 px-1.5 text-xs border rounded-sm text-muted-foreground hover:text-foreground cursor-pointer"
                                                        title={locale === "th" ? "ยกเลิก" : "Cancel"}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            );
                                        }

                                        return (
                                            <Select
                                                value={match.field_name || match.venue || "none"}
                                                onValueChange={(val) => {
                                                    if (val === "__custom__") {
                                                        setCustomCourtMatchId(match.id || String(idx));
                                                        setCustomCourtValue(match.field_name || match.venue || "");
                                                        return;
                                                    }
                                                    const finalVal = val === "none" ? undefined : val;
                                                    updateMatch({ field_name: finalVal, venue: finalVal });
                                                    useBracketStore.setState({ isDirty: true });
                                                }}
                                            >
                                                <SelectTrigger
                                                    size="sm"
                                                    disabled={hasResult || tournament?.status === 'completed'}
                                                    className="h-7 px-2 text-xs border rounded-sm bg-background hover:bg-muted/50 flex items-center gap-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:cursor-not-allowed max-w-[130px]"
                                                    title={locale === "th" ? "เลือกสนามแข่งขัน" : "Select Court/Pitch"}
                                                >
                                                    <span className="truncate">
                                                        {match.field_name || match.venue || (locale === "th" ? "เลือกสนาม" : "Court")}
                                                    </span>
                                                </SelectTrigger>
                                                <SelectContent position="popper" align="start" className="min-w-[140px]">
                                                    <SelectItem value="none">
                                                        <span className="text-muted-foreground italic">
                                                            {locale === "th" ? "ไม่ระบุสนาม" : "No Court"}
                                                        </span>
                                                    </SelectItem>
                                                    {matchCourts.map((cName) => (
                                                        <SelectItem key={cName} value={cName}>
                                                            <span>{cName}</span>
                                                        </SelectItem>
                                                    ))}
                                                    <SelectItem value="__custom__">
                                                        <span className="text-primary font-medium flex items-center gap-1">
                                                            <Plus className="size-3" />
                                                            {locale === "th" ? "กำหนดสนามเอง..." : "Custom Court..."}
                                                        </span>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        );
                                    })()}
                                </div>
                                {hasResult && (
                                    <Lock className="size-4 text-warning" />
                                )}
                                {!hasResult && !isLocked && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={handleSwapTeams}
                                            className="text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded p-1 transition-colors cursor-pointer"
                                            title={locale === "th" ? "สลับทีมเหย้า ↔ ทีมเยือน" : "Swap Home ↔ Away"}
                                        >
                                            <ArrowLeftRight className="size-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const originalMatches = [...((data.matches as MatchItem[]) || [])];
                                                const filtered = originalMatches.filter(m => m.id !== match.id);
                                                updateNodeData(id, { matches: filtered });
                                                useBracketStore.setState({ isDirty: true });
                                            }}
                                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded p-1 transition-colors cursor-pointer"
                                            title={locale === "th" ? "ลบแมตช์นี้" : "Delete match"}
                                        >
                                            <X className="size-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 space-y-4">
                                {/* Clickable Matchup Banner with Team Icons + Direct Dropdown */}
                                <div className="flex justify-center items-center gap-4">
                                    {/* Home Team Trigger & Dropdown */}
                                    <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
                                        <Select
                                            value={displayHomeName}
                                            disabled={hasResult || isLocked}
                                            onValueChange={(val) => {
                                                if (hasResult) return;
                                                const opp = displayAwayName;
                                                if (val !== "TBD" && isSameTeamIdentifier(val, opp)) {
                                                    toast({
                                                        title: locale === 'th' ? "ไม่สามารถเลือกทีมเดียวกันได้" : "Duplicate Team",
                                                        description: locale === 'th' ? "ทีมเดียวกันไม่สามารถอยู่ในแมตช์เดียวกันได้" : "Cannot assign the same team to both slots in the same match",
                                                        variant: "destructive"
                                                    });
                                                    return;
                                                }

                                                // Clear incoming edge to slot-a
                                                const connectedEdge = edges.find(e => e.target === id && e.targetHandle === `slot-a-${idx}`);
                                                if (connectedEdge) {
                                                    onEdgesChange([{ id: connectedEdge.id, type: 'remove' }]);
                                                }

                                                const assignedTeam = teams.find(t => t.name.trim().toLowerCase() === val.trim().toLowerCase());
                                                const tid = assignedTeam ? (assignedTeam.team_id || assignedTeam.id) : null;

                                                if (dbMatch) {
                                                    setStoreMatches((prev: Match[]) => prev.map(m => {
                                                        if (m.id === dbMatch.id || (m.node_id === id && (m.idx_match ?? m.match_index) === (idx + 1))) {
                                                            return {
                                                                ...m,
                                                                home_team_id: val === "TBD" ? null : tid,
                                                                home_team: val === "TBD" ? undefined : (assignedTeam ? { id: tid!, name: assignedTeam.name, logo_url: assignedTeam.logo_url } : undefined),
                                                                placeholder_a: val,
                                                                placeholder_home: val,
                                                            };
                                                        }
                                                        return m;
                                                    }));
                                                }

                                                updateMatch({ placeholderA: val });
                                                useBracketStore.setState({ isDirty: true });
                                            }}
                                        >
                                            <SelectPrimitive.Trigger asChild>
                                                <button
                                                    type="button"
                                                    disabled={hasResult || isLocked}
                                                    className="flex flex-1 items-center justify-end min-w-0 p-1.5 rounded-sm hover:bg-muted/50 transition-colors cursor-pointer disabled:cursor-not-allowed group/home outline-none"
                                                >
                                                    <div className="flex flex-col min-w-0 gap-1 items-end">
                                                        <span
                                                            className={cn(
                                                                "text-xs font-bold truncate max-w-full group-hover/home:text-primary transition-colors",
                                                                displayHomeName === "TBD" ? "text-muted-foreground" : "text-foreground"
                                                            )}
                                                            title={displayHomeName}
                                                        >
                                                            {displayHomeName}
                                                        </span>
                                                        <span className="flex justify-end text-[10px] text-muted-foreground">
                                                            {locale === "th" ? "ทีมเหย้า" : "Home"}
                                                        </span>
                                                    </div>
                                                </button>
                                            </SelectPrimitive.Trigger>
                                            <SelectContent position="popper" align="start">
                                                <SelectItem value="TBD">
                                                    <span className="flex items-center gap-2">
                                                        {renderTeamAvatar("TBD", { fallbackBadge: "H", size: "sm" })}
                                                        <span className="text-muted-foreground">TBD</span>
                                                    </span>
                                                </SelectItem>
                                                {homeSelectItems}
                                            </SelectContent>
                                        </Select>

                                        {/* Home Team Icon (Clickable to open Team Info Dialog) */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                handleOpenTeamDetails(displayHomeName, dbMatch?.home_team_id, dbMatch?.home_team?.logo_url);
                                            }}
                                            disabled={isPlaceholderLabel(displayHomeName)}
                                            className={cn(
                                                "rounded-full transition-all shrink-0 outline-none",
                                                !isPlaceholderLabel(displayHomeName)
                                                    ? "cursor-pointer hover:scale-110 hover:ring-2 hover:ring-primary/50 active:scale-95"
                                                    : "cursor-default"
                                            )}
                                            title={!isPlaceholderLabel(displayHomeName) ? (locale === "th" ? "ดูข้อมูลทีมเหย้า" : "View Home Team Details") : undefined}
                                        >
                                            {renderTeamAvatar(displayHomeName, {
                                                teamId: dbMatch?.home_team_id,
                                                fallbackLogo: dbMatch?.home_team?.logo_url,
                                                fallbackBadge: "H",
                                                size: "md",
                                            })}
                                        </button>
                                    </div>

                                    {/* VS / Score Pill */}
                                    <div className="flex flex-col items-center justify-center shrink-0">
                                        <MatchSettingTimerPill
                                            dbMatch={dbMatch}
                                            match={match}
                                            tournamentId={tournamentId}
                                            sport={storeSport || 'football'}
                                        />
                                        {showScore ? (
                                            <span className="font-black tracking-tight text-foreground">
                                                {getScoreDisplay(dbMatch?.home_score)} - {getScoreDisplay(dbMatch?.away_score)}
                                            </span>
                                        ) : (
                                            <span className="font-black text-muted-foreground">
                                                VS
                                            </span>
                                        )}
                                    </div>

                                    {/* Away Team Trigger & Dropdown */}
                                    <div className="flex flex-1 items-center justify-start gap-2 min-w-0">
                                        {/* Away Team Icon (Clickable to open Team Info Dialog) */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                handleOpenTeamDetails(displayAwayName, dbMatch?.away_team_id, dbMatch?.away_team?.logo_url);
                                            }}
                                            disabled={isPlaceholderLabel(displayAwayName)}
                                            className={cn(
                                                "rounded-full transition-all shrink-0 outline-none",
                                                !isPlaceholderLabel(displayAwayName)
                                                    ? "cursor-pointer hover:scale-110 hover:ring-2 hover:ring-primary/50 active:scale-95"
                                                    : "cursor-default"
                                            )}
                                            title={!isPlaceholderLabel(displayAwayName) ? (locale === "th" ? "ดูข้อมูลทีมเยือน" : "View Away Team Details") : undefined}
                                        >
                                            {renderTeamAvatar(displayAwayName, {
                                                teamId: dbMatch?.away_team_id,
                                                fallbackLogo: dbMatch?.away_team?.logo_url,
                                                fallbackBadge: "A",
                                                size: "md",
                                            })}
                                        </button>

                                        <Select
                                            value={displayAwayName}
                                            disabled={hasResult || isLocked}
                                            onValueChange={(val) => {
                                                if (hasResult) return;
                                                const opp = displayHomeName;
                                                if (val !== "TBD" && isSameTeamIdentifier(val, opp)) {
                                                    toast({
                                                        title: locale === 'th' ? "ไม่สามารถเลือกทีมเดียวกันได้" : "Duplicate Team",
                                                        description: locale === 'th' ? "ทีมเดียวกันไม่สามารถอยู่ในแมตช์เดียวกันได้" : "Cannot assign the same team to both slots in the same match",
                                                        variant: "destructive"
                                                    });
                                                    return;
                                                }

                                                // Clear incoming edge to slot-b
                                                const connectedEdge = edges.find(e => e.target === id && e.targetHandle === `slot-b-${idx}`);
                                                if (connectedEdge) {
                                                    onEdgesChange([{ id: connectedEdge.id, type: 'remove' }]);
                                                }

                                                const assignedTeam = teams.find(t => t.name.trim().toLowerCase() === val.trim().toLowerCase());
                                                const tid = assignedTeam ? (assignedTeam.team_id || assignedTeam.id) : null;

                                                if (dbMatch) {
                                                    setStoreMatches((prev: Match[]) => prev.map(m => {
                                                        if (m.id === dbMatch.id || (m.node_id === id && (m.idx_match ?? m.match_index) === (idx + 1))) {
                                                            return {
                                                                ...m,
                                                                away_team_id: val === "TBD" ? null : tid,
                                                                away_team: val === "TBD" ? undefined : (assignedTeam ? { id: tid!, name: assignedTeam.name, logo_url: assignedTeam.logo_url } : undefined),
                                                                placeholder_b: val,
                                                                placeholder_away: val,
                                                            };
                                                        }
                                                        return m;
                                                    }));
                                                }

                                                updateMatch({ placeholderB: val });
                                                useBracketStore.setState({ isDirty: true });
                                            }}
                                        >
                                            <SelectPrimitive.Trigger asChild>
                                                <button
                                                    type="button"
                                                    disabled={hasResult || isLocked}
                                                    className="flex flex-1 items-center justify-start min-w-0 p-1.5 rounded-sm hover:bg-muted/50 transition-colors cursor-pointer disabled:cursor-not-allowed group/away outline-none"
                                                >
                                                    <div className="flex flex-col min-w-0 gap-1 items-start text-left">
                                                        <span
                                                            className={cn(
                                                                "text-xs font-bold truncate max-w-full group-hover/away:text-primary transition-colors",
                                                                displayAwayName === "TBD" ? "text-muted-foreground" : "text-foreground"
                                                            )}
                                                            title={displayAwayName}
                                                        >
                                                            {displayAwayName}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {locale === "th" ? "ทีมเยือน" : "Away"}
                                                        </span>
                                                    </div>
                                                </button>
                                            </SelectPrimitive.Trigger>
                                            <SelectContent position="popper" align="end">
                                                <SelectItem value="TBD">
                                                    <span className="flex items-center gap-2">
                                                        {renderTeamAvatar("TBD", { fallbackBadge: "A", size: "sm" })}
                                                        <span className="text-muted-foreground">TBD</span>
                                                    </span>
                                                </SelectItem>
                                                {awaySelectItems}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <Button
                                    variant={dbMatch?.status === 'finished' ? "outline" : "default"}
                                    size="sm"
                                    className="w-full"
                                    disabled={isCreatingConsoleId === `${id}-${idx}`}
                                    onClick={async () => {
                                        let targetId = matchConsoleId;
                                        setIsCreatingConsoleId(`${id}-${idx}`);
                                        try {
                                            const canvasData = getCanvasData();
                                            const res = await saveBracketCanvas(tournamentId, canvasData, activeCategoryId || undefined);
                                            if (res.success && res.data) {
                                                const savedNode = res.data.nodes?.find(n => n.id === id);
                                                const savedMatches = (savedNode?.data as { matches?: MatchItem[] })?.matches || [];
                                                const savedMatch = savedMatches[idx];
                                                if (savedMatch?.dbId || savedMatch?.matchId) {
                                                    targetId = savedMatch.dbId || savedMatch.matchId;
                                                }
                                            }
                                        } catch (err) {
                                            console.error("Error creating/syncing match console:", err);
                                        } finally {
                                            setIsCreatingConsoleId(null);
                                        }

                                        if (targetId) {
                                            router.push(`/my-tournaments/${tournamentId}/matches/${targetId}`);
                                        } else {
                                            toast({
                                                title: locale === "th" ? "เกิดข้อผิดพลาด" : "Error",
                                                description: locale === "th" ? "ไม่สามารถสร้างห้องแข่งขันได้ กรุณาลองใหม่อีกครั้ง" : "Failed to open match console",
                                                variant: "destructive"
                                            });
                                        }
                                    }}
                                >
                                    {isCreatingConsoleId === `${id}-${idx}` ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin" />
                                            {locale === "th" ? "กำลังเปิดห้องแข่งขัน..." : "Opening Console..."}
                                        </>
                                    ) : dbMatch?.status === 'finished' ? (
                                        locale === "th" ? "ดูผลการแข่งขัน" : "VIEW MATCH"
                                    ) : (
                                        locale === "th" ? "จัดการการแข่งขัน" : "MATCH CONSOLE"
                                    )}
                                </Button>
                            </div>
                        </div>
                    );
                })}
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                        const next = [...((data.matches as MatchItem[]) || [])];
                        next.push({ id: `m-${Date.now()}-${next.length + 1}`, placeholderA: "TBD", placeholderB: "TBD" });
                        updateNodeData(id, { matches: next });
                    }}
                >
                    <Plus />
                    {locale === "th" ? "เพิ่มแมตช์ใหม่ในโหนด" : "Add Match to Node"}
                </Button>
            </div>

            {/* Team Roster Details Dialog */}
            <TeamRosterDetailsDialog
                team={selectedTeamForDetails}
                open={!!selectedTeamForDetails}
                onOpenChange={(open) => !open && setSelectedTeamForDetails(null)}
            />
        </div>
    );
}
