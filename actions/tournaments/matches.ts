"use server";

import { revalidatePath } from "next/cache";
import { ActionResponse, MatchStatus } from "@/types/index";
import { logActivity } from "@/lib/audit";
import { validateTournamentAccess } from "@/lib/security";
import { getServerSession } from "@/lib/auth-server";

export async function updateMatch(
    matchId: string,
    data: {
        home_team_id?: string | null;
        away_team_id?: string | null;
        home_score?: number | null;
        away_score?: number | null;
        penalty_home_score?: number | null;
        penalty_away_score?: number | null;
        winner_id?: string | null;
        status?: MatchStatus;
        match_date?: string | null;
        match_time?: string | null;
        venue?: string | null;
        timer_status?: 'playing' | 'paused' | 'stopped';
        elapsed_before_pause?: number;
        current_minute?: number | string;
    },
    tournamentId: string
): Promise<ActionResponse> {
    const access = await validateTournamentAccess(tournamentId, 'editor');
    if (!access.success) return { success: false, error: access.error };

    const session = await getServerSession();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

    const updateData: Record<string, unknown> = {};
    if (data.home_team_id !== undefined) updateData.home_team_id = data.home_team_id;
    if (data.away_team_id !== undefined) updateData.away_team_id = data.away_team_id;
    if (data.status !== undefined) {
        updateData.status = data.status;
        if (data.status === 'finished' || data.status === 'completed') {
            updateData.timer_status = 'stopped';
        }
    }
    if (data.timer_status !== undefined) {
        if (data.status === 'finished' || data.status === 'completed') {
            updateData.timer_status = 'stopped';
        } else {
            updateData.timer_status = data.timer_status;
        }
    }
    if (data.elapsed_before_pause !== undefined) {
        updateData.elapsed_before_pause = data.elapsed_before_pause;
        updateData.elapsed_seconds = data.elapsed_before_pause;
    }
    if (data.current_minute !== undefined) {
        const minVal = Number(data.current_minute);
        updateData.current_minute = isNaN(minVal) ? null : minVal;
    }
    if (data.home_score !== undefined && data.home_score !== null) {
        updateData.home_score = data.home_score;
    }
    if (data.away_score !== undefined && data.away_score !== null) {
        updateData.away_score = data.away_score;
    }
    if (data.penalty_home_score !== undefined) {
        updateData.home_penalty_score = data.penalty_home_score;
    }
    if (data.penalty_away_score !== undefined) {
        updateData.away_penalty_score = data.penalty_away_score;
    }
    if (data.venue !== undefined) {
        updateData.field_name = data.venue;
    }

    if (data.match_date !== undefined || data.match_time !== undefined) {
        if (data.match_date) {
            const t = data.match_time || "00:00";
            updateData.scheduled_at = new Date(`${data.match_date}T${t}:00`).toISOString();
            updateData.scheduled_time = updateData.scheduled_at;
        }
    }

    try {
        const res = await fetch(`${apiUrl}/matches/${matchId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.token || ''}`,
            },
            body: JSON.stringify(updateData)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || "Failed to update match" };
        }

        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        await logActivity('UPDATE_MATCH', 'match', matchId, { tournament_id: tournamentId, ...data });
        return { success: true };
    } catch (err: any) {
        console.error("Error updating match:", err);
        return { success: false, error: err?.message || "Failed to update match" };
    }
}
