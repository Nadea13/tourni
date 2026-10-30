"use client";

import React, { memo, useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { Handle, Position, NodeProps, type Node as FlowNode } from "@xyflow/react";
import { useBracketStore } from "@/lib/stores/bracket-store";
import { LayoutGrid, X, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import { ApiClient } from "@/lib/api-client";
import { Match, Registration, SportType } from "@/types";
import { TeamRosterDetailsDialog } from "@/features/dialogs";
import { useLocale } from "next-intl";
import { useToast } from "@/hooks/use-toast";

export interface CalculatedStanding {
    name: string;
    originalSlotIndex: number;
    mp: number;
    w: number;
    d: number;
    l: number;
    gf: number;
    ga: number;
    gd: number;
    pts: number;
    form: string[];
    nextMatch?: string;
    // Volleyball specific
    sw: number;
    sl: number;
    sd: number;
}

export interface GroupNodeData {
    label: string;
    teamCount?: number;
    advancingCount?: number;
    teams?: string[];
    rankings?: string[];
    sport?: SportType;
    showPlayed?: boolean;
    showWin?: boolean;
    showDraw?: boolean;
    showLoss?: boolean;
    showGF?: boolean;
    showGA?: boolean;
    showGD?: boolean;
    showPts?: boolean;
    showForm?: boolean;
    showNextMatch?: boolean;
    // Volleyball specific
    showSW?: boolean;
    showSL?: boolean;
    showSD?: boolean;
    [key: string]: unknown;
}

export const GroupNode = memo(({
    id,
    data,
    selected,
}: NodeProps<FlowNode<GroupNodeData>>) => {
    const locale = useLocale();
    const isThai = locale === "th";
    const { toast } = useToast();
    const params = useParams();
    const tournamentId = params.id as string;

    const edges = useBracketStore((state) => state.edges);
    const nodes = useBracketStore((state) => state.nodes);
    const onEdgesChange = useBracketStore((state) => state.onEdgesChange);
    const updateNodeData = useBracketStore((state) => state.updateNodeData);
    const storeTeams = useBracketStore((state) => state.teams);
    const storeMatches = useBracketStore((state) => state.matches);
    const storeSport = useBracketStore((state) => state.sport);
    const activeCategoryId = useBracketStore((state) => state.activeCategoryId);

    const [fetchedSport, setFetchedSport] = useState<SportType | null>(null);
    const sport: SportType = storeSport || (data?.sport as SportType) || fetchedSport || "football";
    const isVolleyball = sport === "volleyball";

    const [loading, setLoading] = useState(false);
    const [standings, setStandings] = useState<CalculatedStanding[]>([]);
    const [selectedTeamForDetails, setSelectedTeamForDetails] = useState<Registration | null>(null);
    const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);
    const [isNodeDragOver, setIsNodeDragOver] = useState(false);

    // Fetch tournament sport if not present
    useEffect(() => {
        if (storeSport || data?.sport) return;
        let isMounted = true;
        async function fetchSport() {
            const targetId = tournamentId || activeCategoryId;
            if (!targetId) return;
            try {
                const res = await ApiClient.fetch<{ tournament?: { sport?: string }; sport?: string }>(`/tournaments/${targetId}`);
                const s = res?.tournament?.sport || res?.sport;
                if (isMounted && s) {
                    setFetchedSport(s as SportType);
                }
            } catch {
                // Ignore error
            }
        }
        fetchSport();
        return () => {
            isMounted = false;
        };
    }, [tournamentId, activeCategoryId, storeSport, data?.sport]);

    // Team Count & Advancing Count
    const teamCount = Math.max(
        0,
        Number(data.teamCount !== undefined ? data.teamCount : (Array.isArray(data.teams) ? data.teams.length : 4))
    );
    const advancingCount = Number(data.advancingCount !== undefined ? data.advancingCount : 2);
    const rawStaticTeams = Array.isArray(data.teams) ? data.teams : [];

    // Helper to resolve incoming edge to a team slot
    const resolveIncomingSlotTeam = useCallback((slotIndex: number) => {
        const handleId = `team-in-${slotIndex}`;
        const edge = edges.find((e) => e.target === id && e.targetHandle === handleId);
        if (!edge) return null;

        const sNode = nodes.find((n) => n.id === edge.source);
        if (!sNode) return null;

        if (sNode.type === "groupNode") {
            const rankMatch = edge.sourceHandle?.match(/rank-(\d+)/);
            if (rankMatch) {
                const rankIndex = parseInt(rankMatch[1], 10);
                const rankings = (sNode.data as { rankings?: string[] }).rankings || [];
                if (rankings[rankIndex]) return rankings[rankIndex];
                const rankSuffix = rankIndex === 0 ? "1st" : rankIndex === 1 ? "2nd" : rankIndex === 2 ? "3rd" : `${rankIndex + 1}th`;
                return `${rankSuffix} Place (${sNode.data.label})`;
            }
        }

        if (sNode.type === "matchNode") {
            const winnerMatch = edge.sourceHandle?.match(/winner-(\d+)/);
            const loserMatch = edge.sourceHandle?.match(/loser-(\d+)/);
            const isWinnerHandle = !!winnerMatch;
            const matchIdx = winnerMatch ? parseInt(winnerMatch[1], 10) : loserMatch ? parseInt(loserMatch[1], 10) : -1;
            if (matchIdx !== -1) {
                const labelBase = sNode.data.label ? `${sNode.data.label}` : `Match ${matchIdx + 1}`;
                return isWinnerHandle ? `Winner (${labelBase})` : `Loser (${labelBase})`;
            }
        }

        return null;
    }, [edges, nodes, id]);

    // Build effective slots
    const effectiveSlots = useMemo(() => {
        return Array.from({ length: teamCount }).map((_, index) => {
            const incomingTeam = resolveIncomingSlotTeam(index);
            const staticName = rawStaticTeams[index];
            const name = incomingTeam || (staticName !== undefined && staticName !== null && staticName !== "" ? staticName : "TBD");
            return {
                originalSlotIndex: index,
                name,
                hasIncomingEdge: !!incomingTeam,
            };
        });
    }, [teamCount, resolveIncomingSlotTeam, rawStaticTeams]);

    // Team Lookup map for logos and info
    const teamLookup = useMemo(() => {
        const map = new Map<string, { id?: string; name: string; logoUrl?: string | null }>();
        storeTeams.forEach((item) => {
            const t = item as any;
            const name = t.team?.name || t.name;
            if (name) {
                const logoUrl = t.team?.logo_img || t.team?.logo_url || t.logo_img || t.logo_url || null;
                const idVal = String(t.team?.id || t.team_id || t.id);
                map.set(name.trim().toLowerCase(), { id: idVal, name, logoUrl });
            }
        });
        return map;
    }, [storeTeams]);

    // Calculate standings from matches
    const teamsJson = JSON.stringify(effectiveSlots.map((s) => s.name));

    useEffect(() => {
        let isMounted = true;

        async function calculateStandings() {
            const realTeams = effectiveSlots.filter((s) => s.name && s.name !== "TBD");
            if (realTeams.length === 0) {
                if (isMounted) {
                    setStandings([]);
                }
                return;
            }

            setLoading(true);

            try {
                const categoryId = activeCategoryId;
                let dbMatches: Match[] = storeMatches || [];

                if ((!dbMatches || dbMatches.length === 0) && tournamentId && categoryId) {
                    try {
                        const fetched = await ApiClient.fetch<Match[]>(
                            `/tournaments/${tournamentId}/categories/${categoryId}/matches`,
                            { cache: "no-store" }
                        );
                        if (Array.isArray(fetched)) {
                            dbMatches = fetched;
                        }
                    } catch {
                        // ignore fetch error
                    }
                }

                // Initial stats map
                const statsMap: Record<string, CalculatedStanding> = {};
                effectiveSlots.forEach((slot) => {
                    const key = slot.name === "TBD" ? `TBD-${slot.originalSlotIndex}` : slot.name;
                    statsMap[key] = {
                        name: slot.name,
                        originalSlotIndex: slot.originalSlotIndex,
                        mp: 0,
                        w: 0,
                        d: 0,
                        l: 0,
                        gf: 0,
                        ga: 0,
                        gd: 0,
                        pts: 0,
                        form: [],
                        sw: 0,
                        sl: 0,
                        sd: 0,
                    };
                });

                const findStats = (rawName?: string | null): CalculatedStanding | undefined => {
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

                let totalMatchesPlayed = 0;

                dbMatches.forEach((m: any) => {
                    const homeName = m.home_team?.name || m.placeholder_home || m.placeholder_a || m.placeholderA;
                    const awayName = m.away_team?.name || m.placeholder_away || m.placeholder_b || m.placeholderB;

                    if (!homeName || !awayName) return;

                    const h = findStats(homeName);
                    const a = findStats(awayName);

                    // Only count matches between teams in this group
                    if (!h || !a) return;

                    const isPlayed =
                        m.status === "finished" ||
                        m.status === "completed" ||
                        m.status === "live" ||
                        m.status === "first_half" ||
                        m.status === "second_half" ||
                        m.status === "half_time" ||
                        m.status === "extra_time" ||
                        m.status === "penalties";

                    if (isPlayed) {
                        totalMatchesPlayed++;
                        if (isVolleyball) {
                            // Volleyball sets calculation
                            const hSets = typeof m.home_score === "object" && m.home_score !== null && "sets" in m.home_score
                                ? Number((m.home_score as { sets?: number }).sets) || 0
                                : Number(m.home_score) || 0;
                            const aSets = typeof m.away_score === "object" && m.away_score !== null && "sets" in m.away_score
                                ? Number((m.away_score as { sets?: number }).sets) || 0
                                : Number(m.away_score) || 0;

                            h.mp++;
                            a.mp++;
                            h.sw += hSets;
                            h.sl += aSets;
                            a.sw += aSets;
                            a.sl += hSets;

                            if (hSets > aSets) {
                                h.w++;
                                a.l++;
                                h.form.push("W");
                                a.form.push("L");
                                if (hSets === 3 && (aSets === 0 || aSets === 1)) {
                                    h.pts += 3;
                                } else if (hSets === 3 && aSets === 2) {
                                    h.pts += 2;
                                    a.pts += 1;
                                } else {
                                    h.pts += 3;
                                }
                            } else if (aSets > hSets) {
                                a.w++;
                                h.l++;
                                a.form.push("W");
                                h.form.push("L");
                                if (aSets === 3 && (hSets === 0 || hSets === 1)) {
                                    a.pts += 3;
                                } else if (aSets === 3 && hSets === 2) {
                                    a.pts += 2;
                                    h.pts += 1;
                                } else {
                                    a.pts += 3;
                                }
                            }
                        } else {
                            // Football calculation
                            const hScore = typeof m.home_score === "object" && m.home_score !== null && "total" in m.home_score
                                ? Number((m.home_score as { total?: number }).total) || 0
                                : Number(m.home_score) || 0;
                            const aScore = typeof m.away_score === "object" && m.away_score !== null && "total" in m.away_score
                                ? Number((m.away_score as { total?: number }).total) || 0
                                : Number(m.away_score) || 0;

                            h.mp++;
                            a.mp++;
                            h.gf += hScore;
                            h.ga += aScore;
                            a.gf += aScore;
                            a.ga += hScore;

                            if (hScore > aScore) {
                                h.w++;
                                h.pts += 3;
                                h.form.push("W");
                                a.l++;
                                a.form.push("L");
                            } else if (hScore < aScore) {
                                a.w++;
                                a.pts += 3;
                                a.form.push("W");
                                h.l++;
                                h.form.push("L");
                            } else {
                                h.d++;
                                h.pts += 1;
                                h.form.push("D");
                                a.d++;
                                a.pts += 1;
                                a.form.push("D");
                            }
                        }
                    } else if (m.status === "scheduled") {
                        if (h && !h.nextMatch) h.nextMatch = awayName;
                        if (a && !a.nextMatch) a.nextMatch = homeName;
                    }
                });

                const resultList = Object.values(statsMap).map((s) => ({
                    ...s,
                    gd: s.gf - s.ga,
                    sd: s.sw - s.sl,
                    form: s.form.slice(-5),
                }));

                // Sort: If matches were played, sort by tournament points/difference; otherwise keep original slot order!
                if (totalMatchesPlayed > 0) {
                    resultList.sort((a, b) => {
                        if (b.pts !== a.pts) return b.pts - a.pts;
                        if (isVolleyball) {
                            if (b.sd !== a.sd) return b.sd - a.sd;
                            if (b.sw !== a.sw) return b.sw - a.sw;
                        } else {
                            if (b.gd !== a.gd) return b.gd - a.gd;
                            if (b.gf !== a.gf) return b.gf - a.gf;
                        }
                        return a.originalSlotIndex - b.originalSlotIndex;
                    });
                } else {
                    resultList.sort((a, b) => a.originalSlotIndex - b.originalSlotIndex);
                }

                if (isMounted) {
                    setStandings(resultList);
                    const newRankings = resultList.map((s) => s.name);
                    const currentRankings = (data as { rankings?: string[] })?.rankings || [];
                    if (JSON.stringify(currentRankings) !== JSON.stringify(newRankings)) {
                        updateNodeData(id, { rankings: newRankings }, true);
                    }
                }
            } catch (err) {
                console.error("Error calculating standings:", err);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        calculateStandings();

        return () => {
            isMounted = false;
        };
    }, [tournamentId, activeCategoryId, teamsJson, id, isVolleyball, storeMatches, updateNodeData, effectiveSlots, data]);

    // Display rows (fallback to effectiveSlots if standings not ready)
    const displayRows = useMemo(() => {
        if (standings.length === effectiveSlots.length && standings.length > 0) {
            return standings;
        }
        return effectiveSlots.map((slot) => ({
            name: slot.name,
            originalSlotIndex: slot.originalSlotIndex,
            mp: 0,
            w: 0,
            d: 0,
            l: 0,
            gf: 0,
            ga: 0,
            gd: 0,
            pts: 0,
            form: [],
            sw: 0,
            sl: 0,
            sd: 0,
        })) as CalculatedStanding[];
    }, [standings, effectiveSlots]);

    // Handle team dialog click
    const handleOpenTeamDetails = useCallback(async (teamLabel: string) => {
        const trimmed = (teamLabel || "").trim();
        if (
            !trimmed ||
            trimmed === "TBD" ||
            trimmed === "Bye" ||
            trimmed.startsWith("Seed #") ||
            trimmed.startsWith("Winner (") ||
            trimmed.startsWith("Winner of") ||
            trimmed.startsWith("Loser (") ||
            trimmed.startsWith("Loser of") ||
            /^\d+(st|nd|rd|th) Place \(/.test(trimmed)
        ) {
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
                id: String(item?.id || trimmed),
                tournament_id: item?.tournament_id || tournamentId,
                team_name: item?.team?.name || item?.name || trimmed,
                contact_name: item?.contact_name || item?.team?.contact_name || "",
                contact_phone: item?.contact_phone || item?.team?.contact_phone || "",
                logo_url: item?.team?.logo_img || item?.team?.logo_url || item?.logo_img || item?.logo_url || null,
                existing_team_id: item?.team_id || item?.team?.id || null,
                slip_url: item?.slip_img || item?.slip_url || null,
                payment_status: mappedStatus,
                trans_ref: item?.remark || null,
                description: item?.team?.description || item?.description || null,
                tournament_team_id: String(item?.tournament_team_id || item?.id || ""),
                created_at: item?.created_at || new Date().toISOString(),
            };
        };

        const matchTeam = (list: any[]) =>
            list.find(
                (t) =>
                    String(t.team?.name || t.name || "").trim().toLowerCase() === trimmed.toLowerCase()
            );

        const foundInStore = matchTeam(storeTeams);
        if (foundInStore) {
            setSelectedTeamForDetails(buildRegistration(foundInStore));
            return;
        }

        // Open immediately with fallback info and enrich from API if available
        setSelectedTeamForDetails(buildRegistration({ name: trimmed }));

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
                // keep fallback
            }
        }
    }, [storeTeams, tournamentId, activeCategoryId]);

    // Direct User Actions: Clear Slot, Drag & Drop
    const handleClearSlot = useCallback((slotIndex: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const currentTeams = Array.isArray(data.teams) ? [...data.teams] : [];
        while (currentTeams.length <= slotIndex) {
            currentTeams.push("TBD");
        }
        currentTeams[slotIndex] = "TBD";
        updateNodeData(id, { teams: currentTeams });
        useBracketStore.setState({ isDirty: true });
    }, [data.teams, updateNodeData, id]);

    const handleDropOnSlot = useCallback((e: React.DragEvent, slotIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverSlotIndex(null);
        setIsNodeDragOver(false);

        const regStatus = e.dataTransfer.getData("application/registration-status");
        if (regStatus && regStatus !== "PAID") {
            return;
        }

        const teamName = e.dataTransfer.getData("application/reactflow-team") || e.dataTransfer.getData("text/plain");
        if (!teamName || !teamName.trim()) return;

        const trimmed = teamName.trim();
        const currentTeams = Array.isArray(data.teams) ? [...data.teams] : [];
        const requiredLength = Math.max(teamCount, slotIndex + 1);
        while (currentTeams.length < requiredLength) {
            currentTeams.push("TBD");
        }

        // Prevent duplicate team (same as MatchNode):
        // If the team already exists in another slot in this group, do not allow and do not swap!
        const isDuplicate = currentTeams.some(
            (t, idx) => idx !== slotIndex && t && t.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (isDuplicate) {
            toast({
                title: isThai ? "ไม่สามารถเลือกทีมเดียวกันได้" : "Duplicate Team",
                description: isThai
                    ? "ทีมเดียวกันไม่สามารถอยู่ในกลุ่มเดียวกันได้"
                    : "Cannot assign the same team to multiple slots in the same group",
                variant: "destructive",
            });
            return;
        }

        // Remove connected wire to this slot if present
        const handleId = `team-in-${slotIndex}`;
        const connectedEdge = edges.find((edge) => edge.target === id && edge.targetHandle === handleId);
        if (connectedEdge) {
            onEdgesChange([{ id: connectedEdge.id, type: "remove" }]);
        }

        useBracketStore.getState().takeSnapshot();

        currentTeams[slotIndex] = trimmed;
        updateNodeData(id, {
            teams: currentTeams,
            teamCount: Math.max(teamCount, currentTeams.length),
        });
        useBracketStore.setState({ isDirty: true });
    }, [data.teams, teamCount, updateNodeData, id, edges, onEdgesChange, isThai, toast]);

    const handleDropOnNode = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsNodeDragOver(false);
        setDragOverSlotIndex(null);

        const regStatus = e.dataTransfer.getData("application/registration-status");
        if (regStatus && regStatus !== "PAID") {
            return;
        }

        const teamName = e.dataTransfer.getData("application/reactflow-team") || e.dataTransfer.getData("text/plain");
        if (!teamName || !teamName.trim()) return;

        const trimmed = teamName.trim();
        const currentTeams = Array.isArray(data.teams) ? [...data.teams] : [];
        while (currentTeams.length < teamCount) {
            currentTeams.push("TBD");
        }

        // Prevent duplicate team (same as MatchNode)
        const isDuplicate = currentTeams.some(
            (t) => t && t.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (isDuplicate) {
            toast({
                title: isThai ? "ไม่สามารถเลือกทีมเดียวกันได้" : "Duplicate Team",
                description: isThai
                    ? "ทีมเดียวกันไม่สามารถอยู่ในกลุ่มเดียวกันได้"
                    : "Cannot assign the same team to multiple slots in the same group",
                variant: "destructive",
            });
            return;
        }

        useBracketStore.getState().takeSnapshot();

        // Find the first "TBD" slot
        const firstTbdIndex = currentTeams.findIndex(
            (t) => !t || t.trim().toUpperCase() === "TBD"
        );

        if (firstTbdIndex !== -1) {
            currentTeams[firstTbdIndex] = trimmed;
            updateNodeData(id, {
                teams: currentTeams,
            });
        } else {
            // Append as a new team
            currentTeams.push(trimmed);
            updateNodeData(id, {
                teams: currentTeams,
                teamCount: currentTeams.length,
            });
        }
        useBracketStore.setState({ isDirty: true });
    }, [data.teams, teamCount, updateNodeData, id, isThai, toast]);

    return (
        <div
            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
                if (!isNodeDragOver) {
                    setIsNodeDragOver(true);
                }
            }}
            onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsNodeDragOver(false);
                    setDragOverSlotIndex(null);
                }
            }}
            onDrop={handleDropOnNode}
            className={cn(
                "relative w-fit min-w-[320px] border bg-card text-card-foreground transition-all cursor-pointer overflow-hidden rounded-sm shadow-md",
                selected ? "border-node-5" : "border-node-5/50 hover:border-node-5",
                isNodeDragOver && dragOverSlotIndex === null && "ring-2 ring-node-5 border-node-5 bg-node-5/5"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-node-5/50 bg-node-5">
                <div className="flex items-center gap-2">
                    <div className="size-6 rounded flex items-center justify-center shrink-0">
                        <LayoutGrid className="size-4" />
                    </div>
                    <div className="flex items-center">
                        <span className="text-xs font-bold">
                            {data.label || (isThai ? "กลุ่มการแข่งขัน" : "Group Stage")}
                        </span>
                        {loading && <Loader2 className="h-3 w-3 animate-spin text-node-5 ml-1.5" />}
                    </div>
                </div>
            </div>

            {/* Standings Table */}
            <div className="w-full">
                <table className="w-full text-xs border-collapse whitespace-nowrap">
                    <thead>
                        <tr className="border-b border-border bg-node-5/10">
                            <th className="px-4 py-1 text-left font-bold w-7">#</th>
                            <th className="py-1 text-left font-bold min-w-[120px]">
                                {isThai ? "ทีม" : "TEAM"}
                            </th>
                            <th className="px-1 py-1 text-center font-bold w-6">MP</th>
                            <th className="px-1 py-1 text-center font-bold w-6">W</th>
                            {!isVolleyball && <th className="px-1 py-1 text-center font-bold w-6">D</th>}
                            <th className="px-1 py-1 text-center font-bold w-6">L</th>
                            <th className="pl-2 pr-4 py-1 text-center font-bold w-12">PTS</th>
                            <th className="p-0 w-0"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {displayRows.length === 0 ? (
                            <tr>
                                <td colSpan={isVolleyball ? 6 : 7} className="py-6 text-center text-muted-foreground">
                                    <p className="text-[10px] text-muted-foreground">
                                        {isThai ? "ยังไม่มีทีมในกลุ่ม คลิก '+ เพิ่มทีม' ด้านล่าง" : "No teams in group. Click '+ Add Team' below"}
                                    </p>
                                </td>
                            </tr>
                        ) : (
                            displayRows.map((team, rankIndex) => {
                                const teamName = team.name || "TBD";
                                const isPromoted = rankIndex < advancingCount;
                                const isTbd = teamName === "TBD" || !teamName;
                                const teamInfo = !isTbd ? teamLookup.get(teamName.trim().toLowerCase()) : null;
                                const originalIndex = team.originalSlotIndex;
                                const hasIncomingEdge = effectiveSlots[originalIndex]?.hasIncomingEdge;
                                const hasRankEdge = edges.some(
                                    (e) => e.source === id && e.sourceHandle === `rank-${rankIndex}`
                                );

                                const getInitials = (n: string) => {
                                    const parts = n.trim().split(/\s+/);
                                    if (parts.length > 1) {
                                        return (parts[0][0] + parts[1][0]).toUpperCase();
                                    }
                                    return n.slice(0, 2).toUpperCase();
                                };

                                return (
                                    <tr
                                        key={`row-${teamName}-${originalIndex}-${rankIndex}`}
                                        className={cn(
                                            "hover:bg-muted/30 transition-colors group/row relative",
                                            isPromoted && "bg-node-5/10",
                                            dragOverSlotIndex === originalIndex && "bg-node-5/20 ring-2 ring-node-5 ring-inset"
                                        )}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.dataTransfer.dropEffect = "move";
                                            if (dragOverSlotIndex !== originalIndex) {
                                                setDragOverSlotIndex(originalIndex);
                                            }
                                        }}
                                        onDragLeave={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                                if (dragOverSlotIndex === originalIndex) {
                                                    setDragOverSlotIndex(null);
                                                }
                                            }
                                        }}
                                        onDrop={(e) => handleDropOnSlot(e, originalIndex)}
                                    >
                                        {/* Rank Column with Target Handle for incoming wires */}
                                        <td className="p-2 relative">
                                            {/* Incoming slot handle */}
                                            <Handle
                                                type="target"
                                                position={Position.Left}
                                                id={`team-in-${originalIndex}`}
                                                className={cn(
                                                    "!opacity-0 !bg-transparent !border-0 !w-3 !h-full !transform-none !rounded-none cursor-crosshair",
                                                    hasIncomingEdge ? "z-10 pointer-events-none" : "z-20 pointer-events-auto"
                                                )}
                                                style={{ left: "-2px", top: 0, height: "100%", transform: "none" }}
                                                title={isThai ? `ช่องทีม #${originalIndex + 1}` : `Team Slot #${originalIndex + 1}`}
                                            />
                                            <div
                                                className={cn(
                                                    "flex items-center justify-center font-black text-sm transition-colors",
                                                    isPromoted
                                                        ? "text-node-5 font-bold"
                                                        : "text-muted-foreground"
                                                )}
                                            >
                                                {rankIndex + 1}
                                            </div>
                                        </td>

                                        {/* Team Name + Avatar + Quick Clear */}
                                        <td className="py-2">
                                            <div className="flex items-center justify-between min-w-[110px]">
                                                <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                                                    {/* Team Avatar with Hover Effect like match-node */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            if (isTbd) return;
                                                            e.stopPropagation();
                                                            handleOpenTeamDetails(teamName);
                                                        }}
                                                        title={
                                                            !isTbd
                                                                ? (isThai ? "คลิกเพื่อดูข้อมูลทีมและรายชื่อนักกีฬา" : "Click to view team & roster")
                                                                : undefined
                                                        }
                                                        className={cn(
                                                            "relative z-30 size-6 border rounded-full flex items-center justify-center bg-muted/50 group-hover/row:border-node-5/50 group-hover/row:bg-node-5/10 transition-all overflow-hidden shrink-0",
                                                            !isTbd ? "nodrag cursor-pointer hover:ring-2 hover:ring-node-5/50" : "cursor-default"
                                                        )}
                                                    >
                                                        {teamInfo?.logoUrl ? (
                                                            <Image
                                                                src={teamInfo.logoUrl}
                                                                alt={teamName}
                                                                width={24}
                                                                height={24}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : !isTbd ? (
                                                            <span className="text-[9px] font-black text-muted-foreground group-hover/row:text-node-5">
                                                                {getInitials(teamName)}
                                                            </span>
                                                        ) : (
                                                            <Shield className="size-3 fill-muted-foreground text-muted-foreground group-hover/row:text-node-5 group-hover/row:fill-node-5 transition-colors" />
                                                        )}
                                                    </button>

                                                    <span
                                                        onClick={(e) => {
                                                            if (!isTbd) {
                                                                e.stopPropagation();
                                                                handleOpenTeamDetails(teamName);
                                                            }
                                                        }}
                                                        className={cn(
                                                            "text-xs font-bold tracking-tight truncate transition-all",
                                                            !isTbd ? "hover:underline cursor-pointer" : "text-muted-foreground cursor-default",
                                                            !isTbd && "text-foreground"
                                                        )}
                                                    >
                                                        {teamName}
                                                    </span>
                                                </div>

                                                {/* Clear Button on hover */}
                                                {!isTbd && !hasIncomingEdge && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleClearSlot(originalIndex, e)}
                                                        className="opacity-0 group-hover/row:opacity-100 p-0.5 rounded-full hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all shrink-0"
                                                        title={isThai ? "ล้างทีมออกจากช่องนี้" : "Clear slot"}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>

                                        {/* Stats columns: Strictly MP, W, D, L, PTS */}
                                        <td className="px-1 py-1 text-center text-muted-foreground font-medium w-6">
                                            {team.mp}
                                        </td>
                                        <td className="px-1 py-1 text-center text-muted-foreground font-medium w-6">
                                            {team.w}
                                        </td>
                                        {!isVolleyball && (
                                            <td className="px-1 py-1 text-center text-muted-foreground font-medium w-6">
                                                {team.d}
                                            </td>
                                        )}
                                        <td className="px-1 py-1 text-center text-muted-foreground font-medium w-6">
                                            {team.l}
                                        </td>
                                        <td className="pl-2 pr-4 py-1 text-center font-black text-foreground w-12">
                                            {team.pts}
                                        </td>

                                        {/* Advancing Rank Handle (Right) */}
                                        <td className="p-0 w-0 relative">
                                            {isPromoted && (
                                                <Handle
                                                    type="source"
                                                    position={Position.Right}
                                                    id={`rank-${rankIndex}`}
                                                    className={cn(
                                                        "!opacity-0 !bg-transparent !border-0 !w-3 !h-full !transform-none !rounded-none cursor-crosshair",
                                                        hasRankEdge ? "z-10 pointer-events-none" : "z-20 pointer-events-auto"
                                                    )}
                                                    style={{ right: "-2px", top: 0, height: "100%", transform: "none" }}
                                                    title={isThai ? `อันดับที่ ${rankIndex + 1}` : `Rank ${rankIndex + 1}`}
                                                />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Center handle to connect round robin matches */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="group-matches"
                className="!opacity-0 !bg-transparent !border-0 !w-1 !h-1 !min-w-0 !min-h-0 !rounded-none pointer-events-none z-0"
                style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
            />

            {/* Team Roster Dialog */}
            <TeamRosterDetailsDialog
                team={selectedTeamForDetails}
                open={!!selectedTeamForDetails}
                onOpenChange={(open) => !open && setSelectedTeamForDetails(null)}
            />
        </div>
    );
});

GroupNode.displayName = "GroupNode";
