"use server";

import { ApiClient } from "@/lib/api-client";
import { getServerSession } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import { ActionResponse, MatchEvent } from "@/types";
import { validateTournamentAccess } from "@/lib/security";

export async function getMatchEvents(matchId: string): Promise<ActionResponse<MatchEvent[]>> {
    try {
        const events = await ApiClient.fetch<any[]>(`/matches/${matchId}/events`);
        const mapped: MatchEvent[] = (events || []).map((e) => {
            const detailObj = e.detail || e.extra_info || {};
            const eventType = e.type || e.event_type || 'goal';
            return {
                ...e,
                type: eventType,
                event_type: eventType,
                detail: detailObj,
                extra_info: detailObj,
                player_name: detailObj.player_name || e.player_name || (e.player?.name || "Unknown"),
            };
        });
        return { success: true, data: mapped };
    } catch (error: any) {
        console.error("Error fetching events:", error);
        return { success: false, error: error?.message || "Failed to fetch match events" };
    }
}

export async function addMatchEvent(
    matchId: string,
    teamId: string | null,
    eventType: string,
    minute: number,
    playerId: string | null,
    extraInfo: Record<string, unknown> | null = null,
    tournamentId: string
): Promise<ActionResponse<MatchEvent>> {
    if (tournamentId) {
        const access = await validateTournamentAccess(tournamentId, 'editor');
        if (!access.success) return { success: false, error: access.error };
    }

    const session = await getServerSession();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

    const isValidUuid = (id: string | null): boolean => {
        if (!id) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(id);
    };

    try {
        const detailPayload = extraInfo || {};
        const res = await fetch(`${apiUrl}/matches/${matchId}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.token || ''}`,
            },
            body: JSON.stringify({
                team_id: isValidUuid(teamId) ? teamId : null,
                player_id: isValidUuid(playerId) ? playerId : null,
                type: eventType,
                event_type: eventType,
                minute: minute,
                detail: detailPayload,
                extra_info: detailPayload
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || "Failed to add match event" };
        }

        const data = await res.json();
        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        return { success: true, data };
    } catch (err: any) {
        console.error("Error adding match event:", err);
        return { success: false, error: err?.message || "Failed to add match event" };
    }
}

export async function deleteMatchEvent(eventId: string, tournamentId: string, matchId?: string): Promise<ActionResponse> {
    if (tournamentId) {
        const access = await validateTournamentAccess(tournamentId, 'editor');
        if (!access.success) return { success: false, error: access.error };
    }

    const session = await getServerSession();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

    try {
        const targetMatchId = matchId || '00000000-0000-0000-0000-000000000000';
        const res = await fetch(`${apiUrl}/matches/${targetMatchId}/events/${eventId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${session?.token || ''}`,
            }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || "Failed to delete match event" };
        }

        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        return { success: true };
    } catch (err: any) {
        console.error("Error deleting match event:", err);
        return { success: false, error: err?.message || "Failed to delete match event" };
    }
}
