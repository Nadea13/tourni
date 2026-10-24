"use server";

import { revalidatePath } from "next/cache";
import { ActionResponse, PenaltyShot } from "@/types/index";
import { ApiClient } from "@/lib/api-client";
import { getServerSession } from "@/lib/auth-server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

async function syncPenaltyScore(matchId: string) {
    try {
        const session = await getServerSession();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (session?.token) {
            headers.Authorization = `Bearer ${session.token}`;
        }

        // 1. Get the match to know home/away teams
        const matchData = await ApiClient.fetch<any>(`/matches/${matchId}`);
        if (!matchData || !matchData.id) return;

        // 2. Get all penalty shots from match_events
        const eventsData = await ApiClient.fetch<any[]>(`/matches/${matchId}/events`).catch(() => []);
        const penaltyEvents = (eventsData || []).filter((e: any) => e.event_type === "penalty_shot");

        // 3. Count
        const homeShots = penaltyEvents.filter((e: any) => String(e.team_id) === String(matchData.home_team_id));
        const awayShots = penaltyEvents.filter((e: any) => String(e.team_id) === String(matchData.away_team_id));

        const homeScore = homeShots.filter((e: any) => {
            const extra = (e.extra_info || {}) as Record<string, unknown>;
            return extra.scored === true;
        }).length;

        const awayScore = awayShots.filter((e: any) => {
            const extra = (e.extra_info || {}) as Record<string, unknown>;
            return extra.scored === true;
        }).length;

        // Determine mathematically decided winner
        let winnerId: string | null = null;
        const hLen = homeShots.length;
        const aLen = awayShots.length;
        const maxShots = Math.max(hLen, aLen);

        if (maxShots > 0) {
            if (maxShots <= 5) {
                const hRemaining = 5 - hLen;
                const aRemaining = 5 - aLen;
                if (homeScore > awayScore + aRemaining) {
                    winnerId = matchData.home_team_id;
                } else if (awayScore > homeScore + hRemaining) {
                    winnerId = matchData.away_team_id;
                }
            } else {
                // Sudden death: must have equal shots in the round to decide a winner
                if (hLen === aLen) {
                    if (homeScore > awayScore) {
                        winnerId = matchData.home_team_id;
                    } else if (awayScore > homeScore) {
                        winnerId = matchData.away_team_id;
                    }
                }
            }
        }

        // 4. Update match
        const updatePayload: Record<string, unknown> = {
            home_penalty_score: homeScore,
            away_penalty_score: awayScore
        };

        if (winnerId) {
            updatePayload.winner_id = winnerId;
            updatePayload.winner_to_node_id = winnerId;
        } else if (maxShots === 0) {
            // If cleared/no shots, remove shootout winner info
            updatePayload.winner_id = null;
            updatePayload.winner_to_node_id = null;
        }

        await fetch(`${API_BASE_URL}/matches/${matchId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updatePayload),
        });

        if (matchData.tournament_id) {
            revalidatePath(`/my-tournaments/${matchData.tournament_id}`);
            revalidatePath(`/dashboard/tournaments/${matchData.tournament_id}`);
        }
    } catch (err) {
        console.error("Error syncing penalty score:", err);
    }
}

export async function getPenaltyShootout(matchId: string): Promise<ActionResponse<PenaltyShot[]>> {
    try {
        const events = await ApiClient.fetch<any[]>(`/matches/${matchId}/events`);
        const shots = (events || [])
            .filter((event: any) => event.event_type === 'penalty_shot')
            .map((event: any) => {
                const extra = (event.extra_info || {}) as Record<string, unknown>;
                return {
                    id: String(event.id),
                    match_id: String(event.match_id),
                    team_id: String(event.team_id),
                    player_id: event.player_id ? String(event.player_id) : null,
                    round: Number(extra.round) || 1,
                    scored: !!extra.scored,
                    created_at: String(event.created_at),
                    player: event.player_name ? { name: event.player_name } : (event.player ? { name: event.player.name } : null),
                };
            });

        return { success: true, data: shots as PenaltyShot[] };
    } catch (_e) {
        return { success: true, data: [] };
    }
}

export async function addPenaltyShot(
    matchId: string,
    teamId: string,
    round: number,
    scored: boolean,
    playerId?: string | null
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        const res = await fetch(`${API_BASE_URL}/matches/${matchId}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.token || ''}`,
            },
            body: JSON.stringify({
                team_id: teamId || null,
                player_id: playerId || null,
                event_type: 'penalty_shot',
                minute: 120,
                extra_info: {
                    scored,
                    round
                }
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || "Failed to add penalty shot" };
        }

        await syncPenaltyScore(matchId);

        return { success: true };
    } catch (err: any) {
        console.error("Error adding penalty shot:", err);
        return { success: false, error: err?.message || "Failed to add penalty shot" };
    }
}

export async function deletePenaltyShot(shotId: string, matchId?: string): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        const targetMatchId = matchId || '00000000-0000-0000-0000-000000000000';
        const res = await fetch(`${API_BASE_URL}/matches/${targetMatchId}/events/${shotId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${session?.token || ''}`,
            }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || "Failed to delete penalty shot" };
        }

        if (matchId) {
            await syncPenaltyScore(matchId);
        }

        return { success: true };
    } catch (err: any) {
        console.error("Error deleting penalty shot:", err);
        return { success: false, error: err?.message || "Failed to delete penalty shot" };
    }
}

export async function clearPenaltyShootout(matchId: string): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        const events = await ApiClient.fetch<any[]>(`/matches/${matchId}/events`).catch(() => []);
        const penaltyEvents = (events || []).filter((e: any) => e.event_type === "penalty_shot");

        for (const shot of penaltyEvents) {
            await fetch(`${API_BASE_URL}/matches/${matchId}/events/${shot.id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${session?.token || ''}`,
                }
            });
        }

        await syncPenaltyScore(matchId);

        return { success: true };
    } catch (err: any) {
        console.error("Error clearing penalty shootout:", err);
        return { success: false, error: err?.message || "Failed to clear penalty shootout" };
    }
}
