"use server";

import { revalidatePath } from "next/cache";
import { ActionResponse, BracketCanvasData } from "@/types/index";
import { validateTournamentAccess } from "@/lib/security";
import { ApiClient } from "@/lib/api-client";

interface MatchNodeData {
    matches?: Array<{
        dbId?: string;
        matchId?: string;
        placeholderA?: string;
        placeholderB?: string;
        match_date?: string;
        match_time?: string;
    }>;
}

export async function saveBracketCanvas(
    tournamentId: string,
    canvasData: BracketCanvasData,
    inputCategoryId?: string
): Promise<ActionResponse<BracketCanvasData>> {
    const access = await validateTournamentAccess(tournamentId, "editor");
    if (!access.success) {
        return { success: false, error: access.error };
    }

    return saveBracketCanvasInternal(tournamentId, canvasData, inputCategoryId);
}

export async function saveBracketCanvasInternal(
    tournamentId: string,
    canvasData: BracketCanvasData,
    inputCategoryId?: string,
    skipRevalidate = false
): Promise<ActionResponse<BracketCanvasData>> {

    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
    let targetCategoryId = inputCategoryId;
    if (!targetCategoryId) {
        try {
            const tourRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, { cache: 'no-store' });
            if (tourRes.ok) {
                const tourData = await tourRes.json();
                const categories = tourData.categories || [];
                targetCategoryId = categories.length > 0 ? categories[0].id : undefined;
            }
        } catch (e) {
            console.error("Error fetching tournament categories fallback:", e);
        }
    }

    if (!targetCategoryId) {
        return { success: false, error: "Tournament category not found" };
    }

    const categoryId = targetCategoryId;

    // 1. Fetch teams for auto-mapping placeholders to IDs
    let teams: Array<{ id: string; team_id: string; name: string }> = [];
    try {
        const rawTeams = await ApiClient.fetch<any[]>(`/tournaments/${tournamentId}/teams?category_id=${categoryId}`);
        teams = (rawTeams || []).map((tt: any) => {
            const teamObj = tt.team || {};
            return {
                id: tt.id as string,
                team_id: (tt.team_id || tt.team?.id) as string,
                name: (teamObj.name || tt.team_name || "") as string
            };
        });
    } catch (e) {
        console.error("Error fetching tournament teams in saveBracketCanvas:", e);
    }

    // Fetch all active matches in the category to resolve connections
    let activeDbMatches: any[] = [];
    try {
        const rawMatches = await ApiClient.fetch<any[]>(`/tournaments/${tournamentId}/categories/${categoryId}/matches`);
        activeDbMatches = rawMatches || [];
    } catch (e) {
        console.error("Error fetching active matches in saveBracketCanvas:", e);
    }

    // Helper to resolve team ID from connected edges on the server
    const resolveTeamId = (nodeId: string, slot: 'a' | 'b', matchIndex: number): string | null => {
        const handleId = `slot-${slot}-${matchIndex}`;
        const edge = canvasData.edges.find(e => e.target === nodeId && e.targetHandle === handleId);
        if (!edge) return null;

        const sourceNode = canvasData.nodes.find(n => n.id === edge.source);
        if (!sourceNode) return null;

        if (sourceNode.type === 'standingNode' || sourceNode.type === 'groupNode') {
            const rankMatch = edge.sourceHandle?.match(/rank-(\d+)/);
            if (rankMatch) {
                const rankIndex = parseInt(rankMatch[1], 10);
                const rankings = (sourceNode.data as { rankings?: string[] }).rankings || [];
                const teamName = rankings[rankIndex];
                if (!teamName || teamName === "TBD") return null;

                // Check if all matches for the teams in this standing/group node are finished
                const groupTeamIds = rankings.map((name: string) => teams?.find(t => t.name === name)?.team_id).filter(Boolean);
                const groupMatches = activeDbMatches.filter(m => 
                    m.stage === 'group' &&
                    m.home_team_id && m.away_team_id && 
                    groupTeamIds.includes(m.home_team_id) && 
                    groupTeamIds.includes(m.away_team_id)
                );

                const isGroupFinished = groupMatches.length > 0 && groupMatches.every(m => ['finished', 'completed'].includes(m.status));
                if (isGroupFinished) {
                    const team = teams?.find(t => t.name === teamName);
                    return team?.team_id || null;
                }
            }
        }

        if (sourceNode.type === 'matchNode') {
            const winnerMatch = edge.sourceHandle?.match(/winner-(\d+)/);
            const loserMatch = edge.sourceHandle?.match(/loser-(\d+)/);
            const isWinnerHandle = !!winnerMatch;
            const matchIdx = winnerMatch ? parseInt(winnerMatch[1], 10) : loserMatch ? parseInt(loserMatch[1], 10) : -1;

            if (matchIdx !== -1) {
                const sourceMatches = (sourceNode.data as MatchNodeData).matches || [];
                const sourceMatch = sourceMatches[matchIdx];
                const matchId = sourceMatch?.dbId || sourceMatch?.matchId;
                const dbM = activeDbMatches.find(m =>
                    (matchId && m.id === matchId) ||
                    (m.node_id === sourceNode.id && ((m.idx_match ?? m.match_index) === (matchIdx + 1)))
                );
                const isEnded = dbM && ['finished', 'completed', 'canceled', 'cancelled'].includes(dbM.status);
                if (isEnded && dbM) {
                    const hTeamId = dbM.home_team_id || resolveTeamId(sourceNode.id, 'a', matchIdx);
                    const aTeamId = dbM.away_team_id || resolveTeamId(sourceNode.id, 'b', matchIdx);

                    if (dbM.winner_id) {
                        if (isWinnerHandle) return dbM.winner_id;
                        return dbM.winner_id === hTeamId ? aTeamId : hTeamId;
                    }
                    const hScore = typeof dbM.home_score === 'object' && dbM.home_score !== null && 'total' in dbM.home_score ? Number((dbM.home_score as { total?: number | string }).total) || 0 : Number(dbM.home_score) || 0;
                    const aScore = typeof dbM.away_score === 'object' && dbM.away_score !== null && 'total' in dbM.away_score ? Number((dbM.away_score as { total?: number | string }).total) || 0 : Number(dbM.away_score) || 0;
                    if (isWinnerHandle) {
                        if (hScore > aScore) return hTeamId;
                        if (aScore > hScore) return aTeamId;
                    } else {
                        if (hScore < aScore) return hTeamId;
                        if (aScore < hScore) return aTeamId;
                    }
                }
            }
        }

        return null;
    };

    // 2. Process matches in nodes — prepare for sync
    const updatedNodes = [...canvasData.nodes];
    const matchesToSync: any[] = [];
    const validMatchIds: string[] = [];
    
    for (const node of updatedNodes) {
        if (node.type === 'matchNode') {
            const nodeData = node.data as MatchNodeData;
            const matches = nodeData.matches || [];
            
            for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                
                // Try to map placeholders to real team IDs
                const homeTeam = teams?.find(t => t.name === match.placeholderA);
                const awayTeam = teams?.find(t => t.name === match.placeholderB);

                const resolvedHomeId = resolveTeamId(node.id, 'a', i);
                const resolvedAwayId = resolveTeamId(node.id, 'b', i);
                
                const matchId = match.dbId || match.matchId;
                const existingDbMatch = activeDbMatches.find(m =>
                    (matchId && m.id === matchId) ||
                    (m.node_id === node.id && ((m.idx_match ?? m.match_index) === (i + 1)))
                );
                const resolvedMatchId = matchId || existingDbMatch?.id;
                if (resolvedMatchId) {
                    validMatchIds.push(resolvedMatchId);
                }

                const scheduledAt = match.match_date && match.match_time 
                    ? `${match.match_date}T${match.match_time}:00Z` 
                    : (existingDbMatch?.scheduled_at || null);

                const isHomeTBD = !match.placeholderA || match.placeholderA === "TBD" || match.placeholderA.startsWith("Seed #");
                const isAwayTBD = !match.placeholderB || match.placeholderB === "TBD" || match.placeholderB.startsWith("Seed #");

                const isExistingPlayed = existingDbMatch && (
                    ['finished', 'completed', 'canceled', 'cancelled', 'live', 'first_half', 'half_time', 'second_half', 'extra_time', 'penalties'].includes(existingDbMatch.status) ||
                    existingDbMatch.winner_id ||
                    (existingDbMatch.home_score !== null && Number(existingDbMatch.home_score) > 0) ||
                    (existingDbMatch.away_score !== null && Number(existingDbMatch.away_score) > 0)
                );

                let targetHomeTeamId: string | null = null;
                if (resolvedHomeId) {
                    targetHomeTeamId = resolvedHomeId;
                } else if (homeTeam) {
                    targetHomeTeamId = homeTeam.team_id || homeTeam.id;
                } else if (isExistingPlayed) {
                    targetHomeTeamId = existingDbMatch.home_team_id || null;
                } else if (!isHomeTBD) {
                    targetHomeTeamId = existingDbMatch?.home_team_id || null;
                }

                let targetAwayTeamId: string | null = null;
                if (resolvedAwayId) {
                    targetAwayTeamId = resolvedAwayId;
                } else if (awayTeam) {
                    targetAwayTeamId = awayTeam.team_id || awayTeam.id;
                } else if (isExistingPlayed) {
                    targetAwayTeamId = existingDbMatch.away_team_id || null;
                } else if (!isAwayTBD) {
                    targetAwayTeamId = existingDbMatch?.away_team_id || null;
                }

                // Prevent same team for both home and away in the same match
                let placeholderBVal = match.placeholderB || null;
                if (targetHomeTeamId && targetAwayTeamId && targetHomeTeamId === targetAwayTeamId) {
                    targetAwayTeamId = null;
                    placeholderBVal = "TBD";
                }

                matchesToSync.push({
                    id: resolvedMatchId || undefined,
                    tournament_category_id: categoryId,
                    node_id: node.id,
                    placeholder_home: match.placeholderA || null,
                    placeholder_away: placeholderBVal,
                    placeholder_a: match.placeholderA || null,
                    placeholder_b: placeholderBVal,
                    home_team_id: targetHomeTeamId,
                    away_team_id: targetAwayTeamId,
                    home_score: existingDbMatch?.home_score ?? 0,
                    away_score: existingDbMatch?.away_score ?? 0,
                    score_detail: existingDbMatch?.score_detail ?? undefined,
                    timer_status: existingDbMatch?.timer_status || undefined,
                    elapsed_seconds: existingDbMatch?.elapsed_seconds ?? existingDbMatch?.elapsed_before_pause ?? 0,
                    minute: existingDbMatch?.minute ?? existingDbMatch?.current_minute ?? null,
                    scheduled_at: scheduledAt,
                    scheduled_time: scheduledAt,
                    round: existingDbMatch?.round || 1,
                    round_number: existingDbMatch?.round || 1,
                    stage: matches.length > 1 ? 'group' : 'knockout',
                    match_index: i + 1,
                    match_number: i + 1,
                    status: existingDbMatch?.status || 'scheduled',
                    is_manual: true
                });
            }
        }
    }

    // 3. Sync matches to Go backend API
    let syncedMatches: any[] = [];
    try {
        const syncResp = await ApiClient.fetch<{ message: string; matches: any[] }>(`/tournaments/${tournamentId}/categories/${categoryId}/sync-matches`, {
            method: 'POST',
            body: JSON.stringify({
                matches: matchesToSync,
                valid_ids: validMatchIds
            })
        });

        syncedMatches = syncResp?.matches || [];

        // Map synced match IDs back into node matches
        for (const node of updatedNodes) {
            if (node.type === 'matchNode') {
                const nodeData = node.data as MatchNodeData;
                const matches = nodeData.matches || [];
                for (let i = 0; i < matches.length; i++) {
                    const match = matches[i];
                    const synced = syncedMatches.find(sm => sm.node_id === node.id && sm.match_index === (i + 1));
                    if (synced && synced.id) {
                        matches[i] = { ...match, dbId: synced.id, matchId: synced.id };
                    }
                }
            }
        }
    } catch (syncErr) {
        console.error("Error syncing matches to backend:", syncErr);
    }

    // 4. Save the final updated canvas data to backend
    const returnData: BracketCanvasData = {
        ...canvasData,
        nodes: updatedNodes
    };

    try {
        const updateRes = await fetch(`${apiUrl}/tournaments/${tournamentId}/categories/${categoryId}/canvas`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ canvas_data: returnData }),
        });

        if (!updateRes.ok) {
            const errData = await updateRes.json().catch(() => ({}));
            return { success: false, error: errData.error || `Failed to update canvas data: HTTP ${updateRes.status}` };
        }
    } catch (err) {
        console.error("Failed to save canvas data to backend:", err);
        return { success: false, error: err instanceof Error ? err.message : "Failed to save canvas data" };
    }

    // 5. Check if tournament has determined a champion or rank 1 -> set tournament status to completed
    try {
        const allCurrentMatches = [...activeDbMatches];
        for (const sm of (syncedMatches || [])) {
            const existingIdx = allCurrentMatches.findIndex(m => m.id === sm.id || (m.node_id === sm.node_id && (m.idx_match ?? m.match_index) === sm.match_index));
            if (existingIdx !== -1) {
                allCurrentMatches[existingIdx] = { ...allCurrentMatches[existingIdx], ...sm };
            } else {
                allCurrentMatches.push(sm);
            }
        }

        const thirdPlaceNodeIds = new Set<string>();
        const matchNodes = updatedNodes.filter(n => n.type === 'matchNode');

        matchNodes.forEach(node => {
            const hasLoserInput = canvasData.edges.some(e => e.target === node.id && e.sourceHandle?.startsWith('loser'));
            const labelLower = ((node.data as { label?: string })?.label || "").toLowerCase();
            if (hasLoserInput || labelLower.includes('3rd') || labelLower.includes('third') || labelLower.includes('อันดับ 3')) {
                thirdPlaceNodeIds.add(node.id);
            }
        });

        const grandFinalNodeIds = new Set<string>();
        matchNodes.forEach(node => {
            if (thirdPlaceNodeIds.has(node.id)) return;
            const hasOutgoingWinner = canvasData.edges.some(e =>
                e.source === node.id &&
                (!e.sourceHandle || e.sourceHandle.startsWith('winner')) &&
                matchNodes.some(targetNode => targetNode.id === e.target)
            );
            if (!hasOutgoingWinner) {
                grandFinalNodeIds.add(node.id);
            }
        });

        let hasChampion = false;

        // Check Grand Final nodes
        for (const finalId of grandFinalNodeIds) {
            const node = matchNodes.find(n => n.id === finalId);
            const nodeMatches = (node?.data as MatchNodeData)?.matches || [];
            for (let idx = 0; idx < nodeMatches.length; idx++) {
                const mItem = nodeMatches[idx];
                const matchId = mItem?.dbId || mItem?.matchId;
                const dbM = allCurrentMatches.find(m =>
                    (matchId && m.id === matchId) ||
                    (m.node_id === finalId && ((m.idx_match ?? m.match_index) === (idx + 1)))
                );
                if (dbM) {
                    const isEnded = ['finished', 'completed', 'canceled', 'cancelled'].includes(dbM.status) || !!dbM.winner_id;
                    if (isEnded) {
                        const hScore = typeof dbM.home_score === 'object' && dbM.home_score !== null && 'total' in dbM.home_score
                            ? Number((dbM.home_score as any).total) || 0
                            : Number(dbM.home_score) || 0;
                        const aScore = typeof dbM.away_score === 'object' && dbM.away_score !== null && 'total' in dbM.away_score
                            ? Number((dbM.away_score as any).total) || 0
                            : Number(dbM.away_score) || 0;
                        if (dbM.winner_id || hScore !== aScore) {
                            hasChampion = true;
                            break;
                        }
                    }
                }
            }
            if (hasChampion) break;
        }

        // Check Round Robin / Standing nodes: if all category matches are finished
        if (!hasChampion && allCurrentMatches.length > 0) {
            const allMatchesFinished = allCurrentMatches.every(m => ['finished', 'completed', 'canceled', 'cancelled'].includes(m.status));
            if (allMatchesFinished) {
                hasChampion = true;
            }
        }

        if (hasChampion) {
            let isUnlocked = false;
            try {
                const tourRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, { cache: 'no-store' });
                if (tourRes.ok) {
                    const tourData = await tourRes.json();
                    if (tourData.tournament?.settings?.status_unlocked === true && tourData.tournament?.status === 'ongoing') {
                        isUnlocked = true;
                    }
                }
            } catch (_e) {
                // Ignore error
            }

            if (!isUnlocked) {
                await fetch(`${apiUrl}/tournaments/${tournamentId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'completed' })
                }).catch(e => console.error("Error setting tournament completed in saveBracketCanvas:", e));
            }
        }
    } catch (statusCheckErr) {
        console.error("Error evaluating tournament champion status:", statusCheckErr);
    }

    if (!skipRevalidate) {
        try {
            revalidatePath(`/my-tournaments/${tournamentId}`);
            revalidatePath(`/dashboard/tournaments/${tournamentId}`);
            revalidatePath(`/tournaments/${tournamentId}`);
            revalidatePath(`/organizer/tournaments/${tournamentId}`);
        } catch (e) {
            console.warn("revalidatePath skipped during render:", e);
        }
    }

    return { success: true, data: returnData };
}

export async function syncCategoryBracket(
    tournamentId: string,
    categoryId?: string,
    skipAuth = false,
    skipRevalidate = false
): Promise<ActionResponse<BracketCanvasData>> {
    if (!skipAuth) {
        const access = await validateTournamentAccess(tournamentId, "editor");
        if (!access.success) {
            return { success: false, error: access.error };
        }
    }

    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
    let targetCatId = categoryId;
    let canvasData: BracketCanvasData | null = null;

    try {
        const tourRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, { cache: 'no-store' });
        if (tourRes.ok) {
            const tourData = await tourRes.json();
            const categories = tourData.categories || [];
            const cat = targetCatId ? categories.find((c: any) => c.id === targetCatId) : categories[0];
            if (cat) {
                targetCatId = cat.id;
                canvasData = cat.canvas_data;
            }
        }
    } catch (e) {
        console.error("Error fetching tournament in syncCategoryBracket:", e);
    }

    if (!targetCatId || !canvasData || !canvasData.nodes) {
        return { success: false, error: "Bracket canvas data not found" };
    }

    return saveBracketCanvasInternal(tournamentId, canvasData, targetCatId, skipRevalidate);
}


