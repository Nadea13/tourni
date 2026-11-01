"use client";

import { memo } from "react";
import Image from "next/image";
import { Handle, Position, NodeProps, Node, useUpdateNodeInternals } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { MatchNodeData, useBracketStore } from "@/lib/stores/bracket-store";
import { useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Match, Registration } from "@/types";
import { GripVertical, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "next-intl";
import { ApiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { TeamRosterDetailsDialog } from "@/features/dialogs";
import { LiveMatchTimer } from "./live-match-timer";

type MatchNodeType = Node<MatchNodeData, "matchNode">;
type MatchItem = NonNullable<MatchNodeData['matches']>[number];

interface DragSlotSource {
    nodeId: string;
    matchIndex: number;
    slot: "a" | "b";
    label: string;
    teamId?: string | null;
}

const LIVE_STATUSES = new Set(['live', 'warmup', 'first_half', 'half_time', 'second_half', 'extra_time', 'penalties', 'in_progress']);
const ENDED_STATUSES = new Set(['finished', 'completed', 'canceled', 'cancelled']);

export const isMatchLive = (status?: string | null) => !!status && LIVE_STATUSES.has(status);
export const isMatchEnded = (status?: string | null) => !!status && ENDED_STATUSES.has(status);

export const hasMatchResult = (m?: Match | null) => {
    if (!m) return false;
    if (isMatchEnded(m.status) || isMatchLive(m.status)) return true;
    if (m.winner_id) return true;
    const getScoreVal = (s: unknown) => {
        if (typeof s === 'object' && s !== null && 'total' in s) return Number((s as any).total) || 0;
        return typeof s === 'number' ? s : Number(s) || 0;
    };
    const hScore = getScoreVal(m.home_score);
    const aScore = getScoreVal(m.away_score);
    if ((m.status && m.status !== 'scheduled') || hScore > 0 || aScore > 0) {
        return true;
    }
    return false;
};

export const isSameTeamIdentifier = (a?: string | null, b?: string | null) => {
    if (!a || !b) return false;
    const trimA = a.trim().toLowerCase();
    const trimB = b.trim().toLowerCase();
    if (trimA === "tbd" || trimB === "tbd") return false;
    if (trimA.startsWith("seed #") || trimB.startsWith("seed #")) return false;
    return trimA === trimB;
};

export const MatchNode = memo(function MatchNode({
    id,
    data,
    selected,
}: NodeProps<MatchNodeType>) {
    const updateNodeInternals = useUpdateNodeInternals();
    const updateNodeData = useBracketStore((s) => s.updateNodeData);
    const onEdgesChange = useBracketStore((s) => s.onEdgesChange);
    const edges = useBracketStore((s) => s.edges);
    const nodes = useBracketStore((s) => s.nodes);
    const storeTeams = useBracketStore((s) => s.teams);
    const storeSport = useBracketStore((s) => s.sport);
    const storeMatches = useBracketStore((s) => s.matches);
    const setStoreMatches = useBracketStore((s) => s.setMatches);
    const activeCategoryId = useBracketStore((s) => s.activeCategoryId);
    const params = useParams();
    const locale = useLocale();
    const tournamentId = params.id as string;
    const { toast } = useToast();

    const handleAddMatch = (e: React.MouseEvent) => {
        e.stopPropagation();
        const nextMatches = [...(Array.isArray(data.matches) ? data.matches : [])];
        nextMatches.push({
            id: `m-${Date.now()}-${nextMatches.length + 1}`,
            placeholderA: "TBD",
            placeholderB: "TBD",
        });
        updateNodeData(id, { matches: nextMatches });
    };

    const [, setCurrentTimestamp] = useState<number>(0);
    const [selectedTeamForDetails, setSelectedTeamForDetails] = useState<Registration | null>(null);
    const matches = useMemo(() => Array.isArray(data.matches) ? data.matches : [], [data.matches]);
    const isRound = data.isRound !== undefined ? Boolean(data.isRound) : matches.length > 1;

    const hasRoundInEdge = edges.some(
        (e) => e.target === id && (e.targetHandle === "round-in" || e.targetHandle === "group-in")
    );

    const handleOpenTeamDetails = async (teamLabel: string, teamId?: string | null, fallbackLogo?: string | null) => {
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

        const foundInStore = matchTeam(storeTeams);
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

    const sport = useMemo(() => {
        const s = storeSport || (data as { sport?: string })?.sport || 'football';
        return String(s).toLowerCase();
    }, [storeSport, data]);

    // Local ticker to update the live timer every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTimestamp(Date.now());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Fallback match fetching if store doesn't have matches yet
    useEffect(() => {
        let isMounted = true;
        async function fetchInitialMatches() {
            if (storeMatches.length > 0 || !tournamentId) return;
            try {
                const targetCatId = activeCategoryId || undefined;
                const endpoint = targetCatId
                    ? `/tournaments/${tournamentId}/categories/${targetCatId}/matches`
                    : `/tournaments/${tournamentId}/matches`;
                const data = await ApiClient.fetch<Match[]>(endpoint);
                if (isMounted && data && data.length > 0) {
                    setStoreMatches(data);
                }
            } catch {
                // non-blocking
            }
        }
        fetchInitialMatches();
        return () => {
            isMounted = false;
        };
    }, [tournamentId, activeCategoryId, storeMatches.length, setStoreMatches]);

    useEffect(() => {
        updateNodeInternals(id);
    }, [id, matches, storeMatches, edges.length, updateNodeInternals]);

    const findDbMatchForNode = (targetNodeId: string, item: MatchItem | undefined, index: number): Match | undefined => {
        if (!item) return undefined;
        return storeMatches.find(m =>
            (item.dbId && m.id === item.dbId) ||
            (item.matchId && m.id === item.matchId) ||
            (m.node_id === targetNodeId && ((m.idx_match ?? m.match_index) === (index + 1))) ||
            (item.placeholderA && item.placeholderB && (
                (m.placeholder_a === item.placeholderA && m.placeholder_b === item.placeholderB) ||
                (m.ph_home === item.placeholderA && m.ph_away === item.placeholderB)
            ))
        );
    };

    const findDbMatch = (item: MatchItem | undefined, index: number): Match | undefined =>
        findDbMatchForNode(id, item, index);

    const resolveTeamMeta = (teamLabel: string, teamIdHint?: string | null) => {
        const trimmed = (teamLabel || "").trim();
        const isPlaceholder =
            !trimmed ||
            trimmed === "TBD" ||
            trimmed === "Bye" ||
            trimmed.startsWith("Seed #") ||
            trimmed.startsWith("Winner (") ||
            trimmed.startsWith("Winner of") ||
            trimmed.startsWith("Loser (") ||
            trimmed.startsWith("Loser of") ||
            /^\d+(st|nd|rd|th) Place \(/.test(trimmed);

        if (isPlaceholder) {
            return {
                isReal: false,
                label: "TBD",
                teamId: null as string | null,
                teamObj: undefined as { id: string; name: string; logo_url: string | null } | undefined,
            };
        }

        const found = storeTeams.find(
            (t) =>
                (teamIdHint && (String(t.id) === String(teamIdHint) || String(t.team_id) === String(teamIdHint))) ||
                t.name.trim().toLowerCase() === trimmed.toLowerCase()
        );
        const resolvedId = found ? String(found.team_id || found.id) : (teamIdHint ? String(teamIdHint) : null);
        return {
            isReal: true,
            label: found?.name || trimmed,
            teamId: resolvedId,
            teamObj: found
                ? { id: resolvedId!, name: found.name, logo_url: found.logo_url }
                : resolvedId
                    ? { id: resolvedId, name: trimmed, logo_url: null }
                    : undefined,
        };
    };

    const handleSlotDrop = (
        targetMatchIndex: number,
        targetSlot: "a" | "b",
        currentTargetLabel: string,
        currentTargetTeamId: string | null | undefined,
        otherSlotCurrentLabel: string,
        incomingTeamName: string,
        incomingTeamId?: string,
        sourceMeta?: DragSlotSource
    ) => {
        const targetMatchItem = matches[targetMatchIndex];
        const targetDbMatch = findDbMatch(targetMatchItem, targetMatchIndex);

        if (hasMatchResult(targetDbMatch)) {
            toast({
                title: locale === 'th' ? "ไม่สามารถเปลี่ยนทีมได้" : "Cannot change team",
                description: locale === 'th' ? "แมตช์นี้มีผลการแข่งขันแล้ว ไม่สามารถเปลี่ยนทีมได้" : "Match already has results and cannot be modified",
                variant: "destructive",
            });
            return;
        }

        // Case 1: Dragged from another MatchNode slot (or the other slot in the same match) -> Swap / Move
        if (sourceMeta && sourceMeta.nodeId && typeof sourceMeta.matchIndex === "number" && (sourceMeta.slot === "a" || sourceMeta.slot === "b")) {
            // Dropped onto the exact same slot -> no-op
            if (sourceMeta.nodeId === id && sourceMeta.matchIndex === targetMatchIndex && sourceMeta.slot === targetSlot) {
                return;
            }

            // 1A: Same match swap (Home <-> Away in the same match)
            if (sourceMeta.nodeId === id && sourceMeta.matchIndex === targetMatchIndex && sourceMeta.slot !== targetSlot) {
                useBracketStore.getState().takeSnapshot();
                const sourceRec = resolveTeamMeta(sourceMeta.label, sourceMeta.teamId);
                const targetRec = resolveTeamMeta(currentTargetLabel, currentTargetTeamId);

                const newSlotA = targetSlot === "a" ? sourceRec : targetRec;
                const newSlotB = targetSlot === "b" ? sourceRec : targetRec;

                const nextMatches = [...matches];
                nextMatches[targetMatchIndex] = {
                    ...nextMatches[targetMatchIndex],
                    placeholderA: newSlotA.label,
                    placeholderB: newSlotB.label,
                };

                const targetHandleId = `slot-${targetSlot}-${targetMatchIndex}`;
                const connectedEdge = edges.find(e => e.target === id && e.targetHandle === targetHandleId);
                if (connectedEdge) {
                    onEdgesChange([{ id: connectedEdge.id, type: "remove" }]);
                }

                if (targetDbMatch) {
                    const targetDbId = targetDbMatch.id;
                    setStoreMatches((prev: Match[]) =>
                        prev.map((m) => {
                            if (m.id === targetDbId || (m.node_id === id && (m.idx_match ?? m.match_index) === targetMatchIndex + 1)) {
                                return {
                                    ...m,
                                    home_team_id: newSlotA.teamId,
                                    home_team: newSlotA.teamObj,
                                    placeholder_a: newSlotA.label,
                                    placeholder_home: newSlotA.label,
                                    away_team_id: newSlotB.teamId,
                                    away_team: newSlotB.teamObj,
                                    placeholder_b: newSlotB.label,
                                    placeholder_away: newSlotB.label,
                                };
                            }
                            return m;
                        })
                    );
                }

                updateNodeData(id, { matches: nextMatches });
                useBracketStore.setState({ isDirty: true });
                return;
            }

            // 1B: Cross-match swap / move (between different MatchNodes or different matches in the same node)
            const sourceNode = nodes.find((n) => n.id === sourceMeta.nodeId);
            const sourceNodeMatches = Array.isArray(sourceNode?.data?.matches)
                ? [...(sourceNode!.data.matches as MatchItem[])]
                : [];
            const sourceMatchItem = sourceNodeMatches[sourceMeta.matchIndex];
            const sourceDbMatch = findDbMatchForNode(sourceMeta.nodeId, sourceMatchItem, sourceMeta.matchIndex);

            if (hasMatchResult(sourceDbMatch)) {
                toast({
                    title: locale === 'th' ? "ไม่สามารถย้ายทีมได้" : "Cannot move team",
                    description: locale === 'th' ? "แมตช์ต้นทางมีผลการแข่งขันแล้ว ไม่สามารถเปลี่ยนทีมได้" : "Source match already has results and cannot be modified",
                    variant: "destructive",
                });
                return;
            }

            const sourceRec = resolveTeamMeta(sourceMeta.label, sourceMeta.teamId);
            const targetRec = resolveTeamMeta(currentTargetLabel, currentTargetTeamId);

            // Prevent duplicate team in target match
            const targetOtherTeamId = targetSlot === "a" ? targetDbMatch?.away_team_id : targetDbMatch?.home_team_id;
            if (
                isSameTeamIdentifier(sourceRec.label, otherSlotCurrentLabel) ||
                (sourceRec.teamId && targetOtherTeamId && String(sourceRec.teamId) === String(targetOtherTeamId))
            ) {
                toast({
                    title: locale === 'th' ? "ไม่สามารถเลือกทีมเดียวกันได้" : "Duplicate Team",
                    description: locale === 'th' ? "ทีมเดียวกันไม่สามารถอยู่ในแมตช์เดียวกันได้" : "Cannot assign the same team to both slots in the same match",
                    variant: "destructive",
                });
                return;
            }

            // Prevent duplicate team in source match when swapping targetRec back
            if (targetRec.isReal && sourceMatchItem) {
                const sourceOtherLabel =
                    sourceMeta.slot === "a"
                        ? (sourceDbMatch?.away_team?.name || sourceMatchItem.placeholderB)
                        : (sourceDbMatch?.home_team?.name || sourceMatchItem.placeholderA);
                const sourceOtherTeamId =
                    sourceMeta.slot === "a" ? sourceDbMatch?.away_team_id : sourceDbMatch?.home_team_id;

                if (
                    isSameTeamIdentifier(targetRec.label, sourceOtherLabel) ||
                    (targetRec.teamId && sourceOtherTeamId && String(targetRec.teamId) === String(sourceOtherTeamId))
                ) {
                    toast({
                        title: locale === 'th' ? "ไม่สามารถสลับทีมได้" : "Duplicate Team",
                        description: locale === 'th' ? "ทีมเดียวกันไม่สามารถอยู่ในแมตช์เดียวกันได้" : "Cannot assign the same team to both slots in the same match",
                        variant: "destructive",
                    });
                    return;
                }
            }

            useBracketStore.getState().takeSnapshot();

            const targetHandleId = `slot-${targetSlot}-${targetMatchIndex}`;
            const connectedEdge = edges.find((e) => e.target === id && e.targetHandle === targetHandleId);
            if (connectedEdge) {
                onEdgesChange([{ id: connectedEdge.id, type: "remove" }]);
            }

            if (sourceMeta.nodeId === id) {
                const nextMatches = [...matches];
                nextMatches[targetMatchIndex] = {
                    ...nextMatches[targetMatchIndex],
                    [targetSlot === "a" ? "placeholderA" : "placeholderB"]: sourceRec.label,
                };
                if (nextMatches[sourceMeta.matchIndex]) {
                    nextMatches[sourceMeta.matchIndex] = {
                        ...nextMatches[sourceMeta.matchIndex],
                        [sourceMeta.slot === "a" ? "placeholderA" : "placeholderB"]: targetRec.label,
                    };
                }
                updateNodeData(id, { matches: nextMatches });
            } else {
                const nextTargetMatches = [...matches];
                nextTargetMatches[targetMatchIndex] = {
                    ...nextTargetMatches[targetMatchIndex],
                    [targetSlot === "a" ? "placeholderA" : "placeholderB"]: sourceRec.label,
                };
                updateNodeData(id, { matches: nextTargetMatches });

                if (sourceNode && sourceNodeMatches[sourceMeta.matchIndex]) {
                    sourceNodeMatches[sourceMeta.matchIndex] = {
                        ...sourceNodeMatches[sourceMeta.matchIndex],
                        [sourceMeta.slot === "a" ? "placeholderA" : "placeholderB"]: targetRec.label,
                    };
                    updateNodeData(sourceMeta.nodeId, { matches: sourceNodeMatches });
                }
            }

            const targetDbId = targetDbMatch?.id;
            const sourceDbId = sourceDbMatch?.id;

            setStoreMatches((prev: Match[]) =>
                prev.map((m) => {
                    let updated = m;
                    const isTargetMatch =
                        (targetDbId && m.id === targetDbId) ||
                        (m.node_id === id && (m.idx_match ?? m.match_index) === targetMatchIndex + 1);
                    if (isTargetMatch) {
                        updated =
                            targetSlot === "a"
                                ? {
                                    ...updated,
                                    home_team_id: sourceRec.teamId,
                                    home_team: sourceRec.teamObj,
                                    placeholder_a: sourceRec.label,
                                    placeholder_home: sourceRec.label,
                                }
                                : {
                                    ...updated,
                                    away_team_id: sourceRec.teamId,
                                    away_team: sourceRec.teamObj,
                                    placeholder_b: sourceRec.label,
                                    placeholder_away: sourceRec.label,
                                };
                    }

                    const isSourceMatch =
                        (sourceDbId && m.id === sourceDbId) ||
                        (m.node_id === sourceMeta.nodeId && (m.idx_match ?? m.match_index) === sourceMeta.matchIndex + 1);
                    if (isSourceMatch) {
                        updated =
                            sourceMeta.slot === "a"
                                ? {
                                    ...updated,
                                    home_team_id: targetRec.teamId,
                                    home_team: targetRec.teamObj,
                                    placeholder_a: targetRec.label,
                                    placeholder_home: targetRec.label,
                                }
                                : {
                                    ...updated,
                                    away_team_id: targetRec.teamId,
                                    away_team: targetRec.teamObj,
                                    placeholder_b: targetRec.label,
                                    placeholder_away: targetRec.label,
                                };
                    }

                    return updated;
                })
            );

            useBracketStore.setState({ isDirty: true });
            return;
        }

        // Case 2: External team drop (without match-slot-source)
        const targetOtherTeamId = targetSlot === "a" ? targetDbMatch?.away_team_id : targetDbMatch?.home_team_id;
        if (
            isSameTeamIdentifier(incomingTeamName, otherSlotCurrentLabel) ||
            (incomingTeamId && targetOtherTeamId && String(incomingTeamId) === String(targetOtherTeamId))
        ) {
            toast({
                title: locale === 'th' ? "ไม่สามารถเลือกทีมเดียวกันได้" : "Duplicate Team",
                description: locale === 'th' ? "ทีมเดียวกันไม่สามารถอยู่ในแมตช์เดียวกันได้" : "Cannot assign the same team to both slots in the same match",
                variant: "destructive",
            });
            return;
        }

        useBracketStore.getState().takeSnapshot();
        const incomingRec = resolveTeamMeta(incomingTeamName, incomingTeamId);
        const nextMatches = [...matches];
        nextMatches[targetMatchIndex] = {
            ...nextMatches[targetMatchIndex],
            [targetSlot === "a" ? "placeholderA" : "placeholderB"]: incomingRec.label,
        };

        const handleId = `slot-${targetSlot}-${targetMatchIndex}`;
        const connectedEdge = edges.find((e) => e.target === id && e.targetHandle === handleId);
        if (connectedEdge) {
            onEdgesChange([{ id: connectedEdge.id, type: "remove" }]);
        }

        if (targetDbMatch) {
            const targetDbId = targetDbMatch.id;
            setStoreMatches((prev: Match[]) =>
                prev.map((m) => {
                    if (m.id === targetDbId || (m.node_id === id && (m.idx_match ?? m.match_index) === targetMatchIndex + 1)) {
                        return targetSlot === "a"
                            ? {
                                ...m,
                                home_team_id: incomingRec.teamId,
                                home_team: incomingRec.teamObj,
                                placeholder_a: incomingRec.label,
                                placeholder_home: incomingRec.label,
                            }
                            : {
                                ...m,
                                away_team_id: incomingRec.teamId,
                                away_team: incomingRec.teamObj,
                                placeholder_b: incomingRec.label,
                                placeholder_away: incomingRec.label,
                            };
                    }
                    return m;
                })
            );
        }

        updateNodeData(id, { matches: nextMatches });
        useBracketStore.setState({ isDirty: true });
    };

    const renderMatchStatus = (m: MatchItem | undefined, dbM: Match | undefined, inHeader = false) => {
        if (!m) return null;
        const matchDate = dbM?.match_date || m.match_date;
        const matchTime = dbM?.match_time || m.match_time;

        const isLive = isMatchLive(dbM?.status);
        const isEnded = isMatchEnded(dbM?.status);

        if (isLive) {
            if (sport === 'volleyball') {
                const homeSets = typeof dbM?.home_score === 'number' ? dbM.home_score : 0;
                const awaySets = typeof dbM?.away_score === 'number' ? dbM.away_score : 0;
                const currentSetNum = (homeSets + awaySets) + 1;
                return (
                    <span className={cn(
                        "text-[10px] font-black flex items-center gap-1.5 px-1.5 py-0.5 rounded border",
                        inHeader ? "text-white bg-black/25 border-white/25" : "text-primary bg-primary/10 border-primary/20"
                    )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full inline-block animate-pulse", inHeader ? "bg-white" : "bg-primary")}></span>
                        SET {currentSetNum}
                    </span>
                );
            }

            if (dbM?.status === 'half_time') {
                return (
                    <span className={cn(
                        "text-[10px] font-black flex items-center gap-1 px-1.5 py-0.5 rounded border",
                        inHeader ? "text-amber-200 bg-black/25 border-amber-300/30" : "text-amber-500 bg-amber-500/10 border-amber-500/20"
                    )}>
                        HT
                    </span>
                );
            }

            if (dbM) {
                return (
                    <LiveMatchTimer
                        match={dbM}
                        tournamentId={tournamentId}
                        inHeader={inHeader}
                    />
                );
            }
        }

        if (isEnded) {
            const isCanceled = dbM?.status === 'canceled' || dbM?.status === 'cancelled';
            return (
                <span className={cn(
                    "text-[10px] font-black px-1.5 py-0.5 rounded border uppercase",
                    isCanceled
                        ? (inHeader ? "text-red-200 bg-black/25 border-red-300/30" : "text-destructive bg-destructive/10 border-destructive/20")
                        : (inHeader ? "text-white/90 bg-black/20 border-white/20" : "text-muted-foreground bg-muted/50 border-border")
                )}>
                    {isCanceled ? 'Canceled' : 'FT'}
                </span>
            );
        }

        const courtName = m.field_name || m.venue || dbM?.field_name || dbM?.venue;

        if (matchDate || matchTime || courtName) {
            const formattedDate = (() => {
                if (!matchDate) return "";
                const raw = matchDate.split("T")[0];
                const parts = raw.split("-").map(Number);
                const dateObj = parts.length === 3 && !parts.some(isNaN)
                    ? new Date(parts[0], parts[1] - 1, parts[2])
                    : new Date(matchDate);
                if (isNaN(dateObj.getTime())) return matchDate;
                return dateObj.toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
                    day: "numeric",
                    month: "short",
                    year: "2-digit",
                });
            })();
            const formattedTime = matchTime ? matchTime.slice(0, 5) : "";

            return (
                <span className={cn(
                    "text-[10px] font-semibold flex items-center gap-1",
                    inHeader ? "text-white/90" : "text-muted-foreground"
                )}>
                    {formattedDate && <span>{formattedDate}</span>}
                    {formattedDate && formattedTime && <span className={cn(inHeader ? "text-white/60" : "text-muted-foreground/60")}>|</span>}
                    {formattedTime && <span>{formattedTime}</span>}
                    {courtName && (
                        <span className={cn(
                            "px-1 py-0.2 rounded text-[9px] font-bold border",
                            inHeader ? "bg-black/20 border-white/20 text-white" : "bg-muted border-border text-foreground"
                        )}>
                            {courtName}
                        </span>
                    )}
                </span>
            );
        }

        return null;
    };

    const singleMatch = matches[0];
    const singleDbMatch = findDbMatch(singleMatch, 0);
    const _hasLiveMatch = matches.some((item, i) => isMatchLive(findDbMatch(item, i)?.status));

    return (
        <div
            className={cn(
                "relative w-[320px] border bg-card text-card-foreground transition-all cursor-pointer rounded-sm shadow-md",
                selected
                    ? "border-node-2"
                    : "border-node-2/50 hover:border-node-2"
            )}
        >
            {/* Center target handle for Group Round Robin connection */}
            <Handle
                type="target"
                position={Position.Top}
                id="group-in"
                className="!opacity-0 !bg-transparent !border-0 !w-1 !h-1 !min-w-0 !min-h-0 !rounded-none pointer-events-none z-0"
                style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
            />

            {/* Single Input and Output handles when in Round mode OR when connected via round-in */}
            {(isRound || hasRoundInEdge) && (
                <>
                    <Handle
                        type="target"
                        position={Position.Left}
                        id="round-in"
                        className={cn(
                            "!opacity-0 !bg-transparent !border-0 !w-5 !h-full !rounded-none cursor-crosshair",
                            hasRoundInEdge ? "z-0 pointer-events-none" : "z-20 pointer-events-auto"
                        )}
                        style={{ left: "-4px", top: 0, height: "100%", transform: "none" }}
                        title={locale === "th" ? "รับทีมเข้าสู่รอบนี้ (Round Input)" : "Round Input"}
                    />
                    {isRound && (
                        <Handle
                            type="source"
                            position={Position.Right}
                            id="round-out"
                            className="!opacity-0 !bg-transparent !border-0 !w-5 !h-full !rounded-none cursor-crosshair z-20 pointer-events-auto"
                            style={{ right: "-4px", top: 0, height: "100%", transform: "none" }}
                            title={locale === "th" ? "ส่งทีมจากรอบนี้ (Round Output)" : "Round Output"}
                        />
                    )}
                </>
            )}

            <div className="overflow-hidden rounded-[inherit]">
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-node-2 border-node-2/50">
                <div className="flex items-center gap-2 truncate min-w-0">
                    <div className="rounded flex items-center justify-center shrink-0">
                        <span className="font-bold">VS</span>
                    </div>
                    <span className="text-xs font-bold tracking-wide shrink-0">
                        {isRound ? "Round" : "Match"}
                    </span>
                    <span className="text-xs font-bold tracking-wide truncate">
                        {data.label}
                    </span>
                </div>

                {/* Right side of Header: Date & Time or Live Status for single match */}
                {matches.length === 1 && (
                    <div className="flex items-center shrink-0 ml-auto">
                        {renderMatchStatus(singleMatch, singleDbMatch, true)}
                    </div>
                )}
            </div>

            {/* ── Match List ── */}
            <div className="flex flex-col divide-y divide-border">
                {matches.length === 0 ? (
                    <div className="p-4 text-center flex flex-col items-center gap-2">
                        <p className="text-xs text-center text-muted-foreground">
                            {locale === "th" ? "ยังไม่มีแมตช์ในโหนดนี้" : "No matches in this round"}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-node-2/50 text-node-2 hover:bg-node-2/10"
                            onClick={handleAddMatch}
                        >
                            <Plus className="h-4 w-4" />
                            {locale === "th" ? "เพิ่มแมตช์" : "Add Match"}
                        </Button>
                    </div>
                ) : (
                    <div>
                        {matches
                            .slice()
                            .sort((a, b) => {
                                const dateA = a.match_date || "9999-12-31";
                                const timeA = a.match_time || "23:59";
                                const dateB = b.match_date || "9999-12-31";
                                const timeB = b.match_time || "23:59";
                                if (dateA !== dateB) return dateA.localeCompare(dateB);
                                return timeA.localeCompare(timeB);
                            })
                            .map((match, index) => {
                                const dbMatch = findDbMatch(match, index);

                                // Resolve live teams from edges or database assignments
                                const getResolvedTeam = (slot: 'a' | 'b') => {
                                    const placeholder = (slot === 'a' ? match.placeholderA : match.placeholderB)?.trim() || "";
                                    const isExplicitTBD = !placeholder || placeholder === "TBD" || placeholder.startsWith("Seed #");
                                    const hasResult = hasMatchResult(dbMatch);
                                    const handleId = `slot-${slot}-${index}`;
                                    let edge = edges.find(e => e.target === id && e.targetHandle === handleId);

                                    let isFromRound = false;
                                    let roundPairIdx = 0;

                                    if (!edge) {
                                        const roundEdge = edges.find(e => {
                                            if (e.target !== id) return false;
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
                                            roundPairIdx = Math.max(0, allRoundEdges.findIndex(e => e.target === id));
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
                                            roundPairIdx = Math.max(0, allRoundEdges.findIndex(e => e.target === id));
                                        }
                                    }

                                    // When match has no results and no incoming edge, use the node's placeholder directly so edits/swaps reflect in real time
                                    if (!hasResult && !edge) {
                                        if (isExplicitTBD) return null;
                                        return placeholder;
                                    }

                                    // 1. If we have a database match with a team ID assigned, use it UNLESS explicitly cleared to TBD and match has no results
                                    if (dbMatch && (hasResult || !edge)) {
                                        if (!hasResult && isExplicitTBD) {
                                            return null;
                                        }
                                        const teamId = slot === 'a' ? dbMatch.home_team_id : dbMatch.away_team_id;
                                        if (teamId) {
                                            const team = storeTeams.find(t => String(t.team_id || t.id) === String(teamId));
                                            if (team?.name) return team.name;
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
                                            matchIdx = isRound ? (index * 2 + (slot === 'a' ? 0 : 1)) : (roundPairIdx * 2 + (slot === 'a' ? 0 : 1));
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

                                            const sourceDbMatch = storeMatches.find(m =>
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
                                                    const team = storeTeams.find(t => String(t.team_id || t.id) === String(targetTeamId));
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
                                };

                                const liveTeamA = getResolvedTeam('a');
                                const liveTeamB = getResolvedTeam('b');

                                return (
                                    <div key={match.id || index} className="relative">
                                        {/* Sub-header for multi-match round nodes */}
                                        {matches.length > 1 && (
                                            <div className="px-4 py-1 flex items-center justify-between gap-2 border-b bg-node-2/10">
                                                <span className="text-xs font-bold">
                                                    Match {index + 1}
                                                </span>
                                                <div className="flex items-center shrink-0">
                                                    {renderMatchStatus(match, dbMatch)}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            {(() => {
                                                const isEnded = isMatchEnded(dbMatch?.status);

                                                const getScoreValue = (score: unknown) => (typeof score === 'object' && score !== null && 'total' in score ? (score as Record<string, unknown>).total : score);

                                                const homeScoreVal = dbMatch?.home_score !== null && dbMatch?.home_score !== undefined ? Number(getScoreValue(dbMatch.home_score)) || 0 : 0;
                                                const awayScoreVal = dbMatch?.away_score !== null && dbMatch?.away_score !== undefined ? Number(getScoreValue(dbMatch.away_score)) || 0 : 0;

                                                const isHomeWinner = isEnded && (
                                                    dbMatch?.winner_id
                                                        ? dbMatch.winner_id === dbMatch?.home_team_id
                                                        : homeScoreVal > awayScoreVal
                                                );
                                                const isAwayWinner = isEnded && (
                                                    dbMatch?.winner_id
                                                        ? dbMatch.winner_id === dbMatch?.away_team_id
                                                        : awayScoreVal > homeScoreVal
                                                );
                                                const isHomeLoser = isEnded && !isHomeWinner && (isAwayWinner || (dbMatch?.winner_id ? dbMatch.winner_id === dbMatch?.away_team_id : homeScoreVal < awayScoreVal));
                                                const isAwayLoser = isEnded && !isAwayWinner && (isHomeWinner || (dbMatch?.winner_id ? dbMatch.winner_id === dbMatch?.home_team_id : awayScoreVal < homeScoreVal));

                                                const hasWinnerEdge = edges.some(
                                                    (e) => e.source === id && e.sourceHandle === `winner-${index}`
                                                );
                                                const hasDirectSlotAEdge = edges.some(
                                                    (e) => e.target === id && e.targetHandle === `slot-a-${index}`
                                                );
                                                const hasDirectSlotBEdge = edges.some(
                                                    (e) => e.target === id && e.targetHandle === `slot-b-${index}`
                                                );

                                                // Check if this match receives an incoming connection from a Draw Node or round-level edge
                                                const isDrawConnected = edges.some((e) => {
                                                    if (e.target !== id) return false;
                                                    const sourceNode = nodes.find((n) => n.id === e.source);
                                                    if (sourceNode?.type !== "drawNode") return false;
                                                    return (
                                                        !e.targetHandle ||
                                                        e.targetHandle === "round-in" ||
                                                        e.targetHandle === `slot-a-${index}` ||
                                                        e.targetHandle === `slot-b-${index}`
                                                    );
                                                });

                                                const hasIncomingRoundEdge = hasRoundInEdge || edges.some(e => {
        if (e.target !== id) return false;
        const sNode = nodes.find(n => n.id === e.source);
        if (!sNode || sNode.type !== 'matchNode') return false;
        return (Array.isArray(sNode.data.matches) && sNode.data.matches.length > 1) || e.sourceHandle === 'round-out' || Boolean(sNode.data.isRound);
    });

                                                const hasSlotAEdge = hasDirectSlotAEdge || isDrawConnected || hasIncomingRoundEdge;
                                                const hasSlotBEdge = hasDirectSlotBEdge || isDrawConnected || hasIncomingRoundEdge;

                                                return (
                                                    <div className="relative flex flex-col divide-y divide-border">
                                                        {/* Only render individual match slot handles in Match mode when not in Round and not receiving round input */}
                                                        {!isRound && !hasRoundInEdge && (
                                                            <>
{/* Target Handles for each match slot */}
                                                        <Handle
                                                            type="target"
                                                            position={Position.Left}
                                                            id={`slot-a-${index}`}
                                                            className={cn(
                                                                "!opacity-0 !bg-transparent !border-0 !w-3 !h-full !transform-none !rounded-none cursor-crosshair",
                                                                hasSlotAEdge ? "z-10 pointer-events-none" : "z-20 pointer-events-auto"
                                                            )}
                                                            style={{ left: "-2px", top: 0, height: "100%", transform: "none" }}
                                                            title={locale === 'th' ? "ทีม A" : "Team A"}
                                                        />
                                                        <Handle
                                                            type="target"
                                                            position={Position.Left}
                                                            id={`slot-b-${index}`}
                                                            className={cn(
                                                                "!opacity-0 !bg-transparent !border-0 !w-3 !h-full !transform-none !rounded-none cursor-crosshair",
                                                                hasSlotBEdge ? "z-10 pointer-events-none" : (hasSlotAEdge ? "z-20 pointer-events-auto" : "z-10 pointer-events-none")
                                                            )}
                                                            style={{ left: "-2px", top: 0, height: "100%", transform: "none" }}
                                                            title={locale === 'th' ? "ทีม B" : "Team B"}
                                                        />

                                                        {/* Source Handles for each match (Winner / Loser) */}
                                                        <Handle
                                                            type="source"
                                                            position={Position.Right}
                                                            id={`winner-${index}`}
                                                            className={cn(
                                                                "!opacity-0 !bg-transparent !border-0 !w-3 !h-full !transform-none !rounded-none cursor-crosshair",
                                                                hasWinnerEdge ? "z-10 pointer-events-none" : "z-20 pointer-events-auto"
                                                            )}
                                                            style={{ right: "-2px", top: 0, height: "100%", transform: "none" }}
                                                            title={locale === 'th' ? "ผู้ชนะ (Winner)" : "Winner"}
                                                        />
                                                        <Handle
                                                            type="source"
                                                            position={Position.Right}
                                                            id={`loser-${index}`}
                                                            className={cn(
                                                                "!opacity-0 !bg-transparent !border-0 !w-3 !h-full !transform-none !rounded-none cursor-crosshair",
                                                                hasWinnerEdge ? "z-20 pointer-events-auto" : "z-10 pointer-events-none"
                                                            )}
                                                            style={{ right: "-2px", top: 0, height: "100%", transform: "none" }}
                                                            title={locale === 'th' ? "ผู้แพ้ (Loser)" : "Loser"}
                                                        />
                                                            </>
                                                        )}
                                                        {/* Slot A Row */}
                                                        <div className="relative group/slot-a">
                                                            <SlotRow
                                                                nodeId={id}
                                                                matchIndex={index}
                                                                slotKey="a"
                                                                label={liveTeamA || match.placeholderA}
                                                                teamId={dbMatch?.home_team_id}
                                                                logoUrl={dbMatch?.home_team?.logo_url}
                                                                isResolved={!!liveTeamA}
                                                                hasIncomingEdge={hasSlotAEdge}
                                                                score={dbMatch?.home_score}
                                                                isWinner={isHomeWinner}
                                                                isLoser={isHomeLoser}
                                                                status={dbMatch?.status}
                                                                hasResult={hasMatchResult(dbMatch)}
                                                                position="top"
                                                                sport={sport}
                                                                onClickTeam={() =>
                                                                    handleOpenTeamDetails(
                                                                        liveTeamA || match.placeholderA,
                                                                        dbMatch?.home_team_id,
                                                                        dbMatch?.home_team?.logo_url
                                                                    )
                                                                }
                                                                onDropTeam={(teamName, teamId, sourceMeta) =>
                                                                    handleSlotDrop(
                                                                        index,
                                                                        "a",
                                                                        liveTeamA || match.placeholderA,
                                                                        dbMatch?.home_team_id,
                                                                        liveTeamB || match.placeholderB,
                                                                        teamName,
                                                                        teamId,
                                                                        sourceMeta
                                                                    )
                                                                }
                                                                onClear={() => {
                                                                    if (hasMatchResult(dbMatch)) {
                                                                        toast({
                                                                            title: locale === 'th' ? "ไม่สามารถลบทีมได้" : "Cannot remove team",
                                                                            description: locale === 'th' ? "แมตช์นี้มีผลการแข่งขันแล้ว ไม่สามารถลบทีมได้" : "Match already has results and cannot be removed",
                                                                            variant: "destructive"
                                                                        });
                                                                        return;
                                                                    }
                                                                    const nextMatches = [...matches];
                                                                    nextMatches[index] = { ...nextMatches[index], placeholderA: "TBD" };
                                                                    const handleId = `slot-a-${index}`;
                                                                    const connectedEdge = edges.find(e => e.target === id && e.targetHandle === handleId);
                                                                    if (connectedEdge) {
                                                                        onEdgesChange([{ id: connectedEdge.id, type: 'remove' }]);
                                                                    }

                                                                    if (dbMatch) {
                                                                        setStoreMatches((prev: Match[]) => prev.map(m => {
                                                                            if (m.id === dbMatch.id || (m.node_id === id && (m.idx_match ?? m.match_index) === (index + 1))) {
                                                                                return {
                                                                                    ...m,
                                                                                    home_team_id: null,
                                                                                    home_team: undefined,
                                                                                    placeholder_a: "TBD",
                                                                                    placeholder_home: "TBD",
                                                                                };
                                                                            }
                                                                            return m;
                                                                        }));
                                                                    }

                                                                    updateNodeData(id, { matches: nextMatches });
                                                                    useBracketStore.setState({ isDirty: true });
                                                                }}
                                                            />
                                                        </div>

                                                        {/* Slot B Row */}
                                                        <div className="relative group/slot-b">
                                                            <SlotRow
                                                                nodeId={id}
                                                                matchIndex={index}
                                                                slotKey="b"
                                                                label={liveTeamB || match.placeholderB}
                                                                teamId={dbMatch?.away_team_id}
                                                                logoUrl={dbMatch?.away_team?.logo_url}
                                                                isResolved={!!liveTeamB}
                                                                hasIncomingEdge={hasSlotBEdge}
                                                                score={dbMatch?.away_score}
                                                                isWinner={isAwayWinner}
                                                                isLoser={isAwayLoser}
                                                                status={dbMatch?.status}
                                                                hasResult={hasMatchResult(dbMatch)}
                                                                position="bottom"
                                                                sport={sport}
                                                                onClickTeam={() =>
                                                                    handleOpenTeamDetails(
                                                                        liveTeamB || match.placeholderB,
                                                                        dbMatch?.away_team_id,
                                                                        dbMatch?.away_team?.logo_url
                                                                    )
                                                                }
                                                                onDropTeam={(teamName, teamId, sourceMeta) =>
                                                                    handleSlotDrop(
                                                                        index,
                                                                        "b",
                                                                        liveTeamB || match.placeholderB,
                                                                        dbMatch?.away_team_id,
                                                                        liveTeamA || match.placeholderA,
                                                                        teamName,
                                                                        teamId,
                                                                        sourceMeta
                                                                    )
                                                                }
                                                                onClear={() => {
                                                                    if (hasMatchResult(dbMatch)) {
                                                                        toast({
                                                                            title: locale === 'th' ? "ไม่สามารถลบทีมได้" : "Cannot remove team",
                                                                            description: locale === 'th' ? "แมตช์นี้มีผลการแข่งขันแล้ว ไม่สามารถลบทีมได้" : "Match already has results and cannot be removed",
                                                                            variant: "destructive"
                                                                        });
                                                                        return;
                                                                    }
                                                                    const nextMatches = [...matches];
                                                                    nextMatches[index] = { ...nextMatches[index], placeholderB: "TBD" };
                                                                    const handleId = `slot-b-${index}`;
                                                                    const connectedEdge = edges.find(e => e.target === id && e.targetHandle === handleId);
                                                                    if (connectedEdge) {
                                                                        onEdgesChange([{ id: connectedEdge.id, type: 'remove' }]);
                                                                    }

                                                                    if (dbMatch) {
                                                                        setStoreMatches((prev: Match[]) => prev.map(m => {
                                                                            if (m.id === dbMatch.id || (m.node_id === id && (m.idx_match ?? m.match_index) === (index + 1))) {
                                                                                return {
                                                                                    ...m,
                                                                                    away_team_id: null,
                                                                                    away_team: undefined,
                                                                                    placeholder_b: "TBD",
                                                                                    placeholder_away: "TBD",
                                                                                };
                                                                            }
                                                                            return m;
                                                                        }));
                                                                    }

                                                                    updateNodeData(id, { matches: nextMatches });
                                                                    useBracketStore.setState({ isDirty: true });
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>
            </div>

            <TeamRosterDetailsDialog
                team={selectedTeamForDetails}
                open={!!selectedTeamForDetails}
                onOpenChange={(open) => !open && setSelectedTeamForDetails(null)}
            />
        </div>
    );
});

function SlotRow({
    nodeId,
    matchIndex,
    slotKey,
    label,
    teamId,
    logoUrl,
    score,
    setPoints,
    isWinner,
    isLoser,
    status,
    hasResult,
    isResolved: _isResolved,
    hasIncomingEdge,
    position,
    sport = 'football',
    onClickTeam,
    onDropTeam,
    onClear,
}: {
    nodeId: string;
    matchIndex: number;
    slotKey: "a" | "b";
    label: string;
    teamId?: string | null;
    logoUrl?: string | null;
    score?: unknown;
    setPoints?: number;
    isWinner?: boolean;
    isLoser?: boolean;
    status?: string;
    hasResult?: boolean;
    isResolved?: boolean;
    hasIncomingEdge?: boolean;
    position: "top" | "bottom";
    sport?: string;
    onClickTeam?: () => void;
    onDropTeam?: (teamName: string, teamId?: string, sourceMeta?: DragSlotSource) => void;
    onClear?: () => void;
}) {
    const locale = useLocale();
    const [isDragOver, setIsDragOver] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const teams = useBracketStore((s) => s.teams);
    const trimmedLabel = (label || "").trim();
    const teamByName = trimmedLabel
        ? teams.find((t) => t.name.trim().toLowerCase() === trimmedLabel.toLowerCase())
        : undefined;
    const team =
        teamByName ||
        teams.find(
            (t) =>
                teamId && (String(t.id) === String(teamId) || String(t.team_id) === String(teamId))
        );
    const isRealTeam =
        Boolean(team || teamId) ||
        Boolean(
            trimmedLabel &&
            trimmedLabel !== "TBD" &&
            trimmedLabel !== "Bye" &&
            !trimmedLabel.startsWith("Seed #") &&
            !trimmedLabel.startsWith("Winner (") &&
            !trimmedLabel.startsWith("Winner of") &&
            !trimmedLabel.startsWith("Loser (") &&
            !trimmedLabel.startsWith("Loser of") &&
            !/^\d+(st|nd|rd|th) Place \(/.test(trimmedLabel)
        );

    const canDrag = isRealTeam && !hasResult && !hasIncomingEdge;
    const resolvedTeamId = team ? String(team.team_id || team.id) : teamId ? String(teamId) : null;

    const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    const isEnded = isMatchEnded(status);
    const hasScore = score !== undefined && score !== null && status !== 'scheduled';
    const displayScore = hasScore
        ? (typeof score === 'object' && score !== null && 'total' in score
            ? String((score as Record<string, unknown>).total)
            : String(score))
        : "";

    const displayLogo = team?.logo_url || logoUrl;

    return (
        <div
            draggable={canDrag}
            onDragStart={(e) => {
                if (!canDrag) {
                    e.preventDefault();
                    return;
                }
                e.stopPropagation();
                setIsDragging(true);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("application/reactflow-team", trimmedLabel);
                e.dataTransfer.setData("text/plain", trimmedLabel);
                if (resolvedTeamId) {
                    e.dataTransfer.setData("application/team-id", resolvedTeamId);
                }
                const sourceMeta: DragSlotSource = {
                    nodeId,
                    matchIndex,
                    slot: slotKey,
                    label: trimmedLabel,
                    teamId: resolvedTeamId,
                };
                e.dataTransfer.setData("application/match-slot-source", JSON.stringify(sourceMeta));
            }}
            onDragEnd={() => {
                setIsDragging(false);
            }}
            className={cn(
                "flex items-center gap-2 px-4 py-2 transition-all hover:bg-muted/30 group/slot relative",
                canDrag ? "nodrag cursor-grab active:cursor-grabbing" : "cursor-default",
                isDragging && "opacity-40 bg-node-2/10",
                isLoser && "text-muted-foreground/50 opacity-60",
                isDragOver && "bg-node-2/20 ring-2 ring-node-2 ring-inset rounded-xs"
            )}
            onDragOver={(e) => {
                if (hasIncomingEdge || hasResult) {
                    return;
                }
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setIsDragOver(true);
            }}
            onDragLeave={() => {
                setIsDragOver(false);
            }}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(false);
                if (hasIncomingEdge || hasResult) {
                    return;
                }
                const regStatus = e.dataTransfer.getData("application/registration-status");
                if (regStatus && regStatus !== "PAID") {
                    return;
                }
                const teamName = e.dataTransfer.getData("application/reactflow-team") || e.dataTransfer.getData("text/plain");
                const droppedTeamId = e.dataTransfer.getData("application/team-id");
                const rawSourceMeta = e.dataTransfer.getData("application/match-slot-source");
                let parsedSourceMeta: DragSlotSource | undefined;
                if (rawSourceMeta) {
                    try {
                        parsedSourceMeta = JSON.parse(rawSourceMeta) as DragSlotSource;
                    } catch {
                        parsedSourceMeta = undefined;
                    }
                }
                if (teamName && onDropTeam) {
                    onDropTeam(teamName, droppedTeamId || undefined, parsedSourceMeta);
                }
            }}
        >
            <GripVertical
                className={cn(
                    "size-4 shrink-0 -ml-1.5 transition-colors",
                    canDrag ? "text-muted-foreground" : "text-muted-foreground/20 cursor-not-allowed"
                )}
                aria-hidden="true"
            />
            <button
                type="button"
                disabled={!isRealTeam}
                onClick={(e) => {
                    if (!isRealTeam || !onClickTeam) return;
                    e.stopPropagation();
                    onClickTeam();
                }}
                title={
                    isRealTeam
                        ? (locale === "th" ? "คลิกเพื่อดูข้อมูลทีมและรายชื่อนักกีฬา" : "Click to view team & roster")
                        : undefined
                }
                className={cn(
                    "relative z-30 w-6 h-6 border rounded-full flex items-center justify-center bg-muted/50 group-hover/slot:border-node-2/50 group-hover/slot:bg-node-2/10 transition-all overflow-hidden shrink-0",
                    isRealTeam ? "nodrag cursor-pointer" : "cursor-default",
                    isLoser && "opacity-50"
                )}
            >
                {displayLogo ? (
                    <Image
                        src={displayLogo}
                        alt={label}
                        width={24}
                        height={24}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <span className="text-[9px] font-black text-muted-foreground group-hover/slot:text-node-2">
                        {team ? getInitials(team.name) : isRealTeam ? getInitials(trimmedLabel) : (position === "top" ? "H" : "A")}
                    </span>
                )}
            </button>
            <span
                onClick={(e) => {
                    if (!isRealTeam || !onClickTeam) return;
                    e.stopPropagation();
                    onClickTeam();
                }}
                title={
                    isRealTeam
                        ? (locale === "th" ? "คลิกเพื่อดูข้อมูลทีมและรายชื่อนักกีฬา" : "Click to view team & roster")
                        : undefined
                }
                className={cn(
                    "text-xs font-bold tracking-tight truncate flex-1 transition-all",
                    isRealTeam ? "nodrag cursor-pointer hover:underline" : "cursor-default",
                    label === "TBD" ? "text-muted-foreground" : "",
                    isWinner && "text-foreground font-black",
                    isLoser && "text-muted-foreground/50"
                )}
            >
                {label}
            </span>

            {/* Clear Button on hover when team assigned and no result yet and not connected from incoming edge */}
            {onClear && label !== "TBD" && !label.startsWith("Seed #") && !hasResult && !hasIncomingEdge && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClear();
                    }}
                    className="opacity-0 group-hover/slot:opacity-100 focus:opacity-100 p-1 hover:text-destructive text-muted-foreground hover:bg-destructive/10 rounded-full transition-all shrink-0 cursor-pointer"
                    title={locale === "th" ? "ลบทีมออกจากแมตช์" : "Remove team from match"}
                >
                    <X className="size-4" />
                </button>
            )}
            {hasScore && (
                <div className={cn(
                    "flex items-center gap-1.5 font-black text-xs transition-colors shrink-0",
                    isWinner && "text-foreground font-black",
                    isLoser && "text-muted-foreground/50"
                )}>
                    {sport === 'volleyball' ? (
                        <>
                            <span className={cn(
                                isEnded
                                    ? "w-6 h-6 flex items-center justify-center font-black text-xs"
                                    : "text-[10px] font-extrabold tracking-tight"
                            )}>
                                {displayScore}
                            </span>
                            {!isEnded && (
                                <span className="text-xs font-black text-center">
                                    {setPoints !== undefined ? setPoints : 0}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="w-6 h-6 flex items-center justify-center font-black text-xs">{displayScore}</span>
                    )}
                </div>
            )}
        </div>
    );
}
