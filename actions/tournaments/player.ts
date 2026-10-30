"use server";

import { revalidatePath } from "next/cache";
import { ActionResponse, Player } from "@/types/index";
import { getServerSession } from "@/lib/auth-server";
import { validateUploadedFile } from "@/lib/file-validation";
import { uploadToR2 } from "@/lib/r2";
import { resolveStorageUrl } from "@/lib/storage-utils";
import { classifyPlayerNames } from "@/lib/name-helper";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

/**
 * Fetch players directly from tournament_players table for a tournament team.
 */
export async function getTournamentPlayersDirect(tournamentTeamId: string): Promise<{ success: boolean; data?: Player[]; error?: string }> {
    try {
        const session = await getServerSession();
        const res = await fetch(`${API_BASE_URL}/tournament-teams/${tournamentTeamId}/players`, {
            headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
            cache: 'no-store',
        });

        if (!res.ok) {
            return { success: true, data: [] };
        }

        const data = await res.json();
        const mappedPlayers: Player[] = (data || []).map((tp: any) => {
            const mp = tp.master_player || {};
            const rawName = mp.name || (mp.first_name_local ? `${mp.first_name_local} ${mp.last_name_local || ''}` : `${mp.first_name_intl || ''} ${mp.last_name_intl || ''}`).trim();
            const cleanName = rawName.replace(/\s*-\s*$/, '').trim();

            return {
                id: tp.id,
                name: cleanName || 'Unnamed Player',
                number: tp.shirt_number ? parseInt(tp.shirt_number) : null,
                position: tp.position || null,
                birth_date: mp.birthday || null,
                birthday: mp.birthday || null,
                photo_url: resolveStorageUrl(tp.photo_url || mp.photo_url || null),
                team_id: tournamentTeamId,
                global_team_id: null,
                global_player_id: tp.master_player_id || null,
                master_player_id: tp.master_player_id || null,
                tel: mp.tel || null,
                status: 'approved',
                created_at: tp.created_at || new Date().toISOString(),
                deleted_at: tp.deleted_at || null,
            };
        });

        const getRolePriority = (position?: string | null): number => {
            if (!position) return 4;
            const pos = position.toLowerCase().trim();
            if (pos.includes("ผู้จัดการ") || pos.includes("manager")) return 1;
            if (pos.includes("ผู้ช่วย") || pos.includes("assistant") || pos.includes("asst")) return 3;
            if (pos.includes("ผู้ฝึกสอน") || pos.includes("โค้ช") || pos.includes("coach")) return 2;
            return 4;
        };

        mappedPlayers.sort((a, b) => {
            const rankA = getRolePriority(a.position);
            const rankB = getRolePriority(b.position);
            if (rankA !== rankB) return rankA - rankB;
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            if (timeA !== timeB) return timeA - timeB;
            return 0;
        });

        return { success: true, data: mappedPlayers };
    } catch (e: any) {
        console.error("Error fetching tournament players from Go API:", e);
        return { success: true, data: [] };
    }
}

export async function getPlayers(teamId: string) {
    return getTournamentPlayersDirect(teamId);
}

/**
 * Add player directly into tournament_players table.
 */
export async function addTournamentPlayer(
    tournamentTeamId: string,
    formData: FormData
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) return { success: false, error: "Authentication required" };

        const name = formData.get("name") as string;
        const firstNameTh = formData.get("firstNameTh") as string || formData.get("first_name_th") as string || formData.get("first_name_local") as string || "";
        const lastNameTh = formData.get("lastNameTh") as string || formData.get("last_name_th") as string || formData.get("last_name_local") as string || "";
        const firstNameEn = formData.get("firstNameEn") as string || formData.get("first_name_en") as string || formData.get("first_name_intl") as string || "";
        const lastNameEn = formData.get("lastNameEn") as string || formData.get("last_name_en") as string || formData.get("last_name_intl") as string || "";
        const number = formData.get("number") as string;
        const position = formData.get("position") as string;
        const photoFile = formData.get("photo") as File | null;
        const dateOfBirth = formData.get("date_of_birth") as string;
        const tel = formData.get("tel") as string;
        const masterPlayerId = formData.get("master_player_id") as string | null;

        const classified = classifyPlayerNames({
            name,
            first_name_local: firstNameTh || null,
            last_name_local: lastNameTh || null,
            first_name_intl: firstNameEn || null,
            last_name_intl: lastNameEn || null,
        });

        let firstName = classified.first_name_intl || classified.first_name_local;
        let lastName = classified.last_name_intl || classified.last_name_local || "-";

        if (!firstName) {
            if (!name || !name.trim()) return { success: false, error: "Name is required" };
            const nameParts = name.trim().split(" ");
            firstName = nameParts[0];
            lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "-";
        }

        let photoUrl: string | null = null;
        if (photoFile && photoFile.size > 0) {
            const fileCheck = validateUploadedFile(photoFile);
            if (!fileCheck.valid) return { success: false, error: fileCheck.error };

            const fileExt = photoFile.name.split('.').pop() || 'jpg';
            const fileName = `players/${tournamentTeamId}/photo_${Date.now()}.${fileExt}`;
            const uploadRes = await uploadToR2(photoFile, fileName, photoFile.type);
            if (uploadRes.success && uploadRes.url) {
                photoUrl = uploadRes.url;
            }
        }

        const res = await fetch(`${API_BASE_URL}/tournament-teams/${tournamentTeamId}/players`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                first_name: firstName,
                last_name: lastName,
                shirt_number: number ? number.trim() : null,
                position: position || null,
                photo_url: photoUrl,
                date_of_birth: dateOfBirth || null,
                tel: tel || null,
                master_player_id: masterPlayerId || null,
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to add player to tournament" };
        }

        revalidatePath(`/my-tournaments`);
        revalidatePath(`/dashboard/tournaments`);
        return { success: true };
    } catch (err) {
        console.error("Error in addTournamentPlayer:", err);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function addPlayer(
    teamId: string,
    formData: FormData
): Promise<ActionResponse> {
    return addTournamentPlayer(teamId, formData);
}

/**
 * Delete player from tournament_players table.
 */
export async function deleteTournamentPlayer(
    playerId: string,
    tournamentTeamId?: string
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) return { success: false, error: "Authentication required" };

        const targetTeamId = tournamentTeamId || 'default';
        const res = await fetch(`${API_BASE_URL}/tournament-teams/${targetTeamId}/players/${playerId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to delete player" };
        }

        revalidatePath(`/my-tournaments`);
        revalidatePath(`/dashboard/tournaments`);
        return { success: true };
    } catch (err) {
        console.error("Error in deleteTournamentPlayer:", err);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function deletePlayer(playerId: string, teamId?: string): Promise<ActionResponse> {
    return deleteTournamentPlayer(playerId, teamId);
}

/**
 * Update player in tournament_players table.
 */
export async function updateTournamentPlayer(
    playerId: string,
    tournamentTeamId: string,
    data: { name?: string; number?: number | null; position?: string | null; birth_date?: string | null; photo_url?: string | null; tel?: string | null }
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) return { success: false, error: "Authentication required" };

        const nameParts = data.name ? data.name.trim().split(" ") : [];
        const firstName = nameParts.length > 0 ? nameParts[0] : undefined;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : (nameParts.length === 1 ? "-" : undefined);

        const res = await fetch(`${API_BASE_URL}/tournament-teams/${tournamentTeamId}/players/${playerId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                shirt_number: data.number !== undefined && data.number !== null ? String(data.number) : null,
                position: data.position || null,
                first_name: firstName,
                last_name: lastName,
                name: data.name,
                photo_url: data.photo_url,
                tel: data.tel,
            }),
        });

        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            return { success: false, error: errBody.error || "Failed to update tournament player" };
        }

        revalidatePath(`/my-tournaments`);
        revalidatePath(`/dashboard/tournaments`);
        revalidatePath(`/dashboard/tournament-teams/${tournamentTeamId}`);
        revalidatePath(`/inboxes/teams/${tournamentTeamId}`);
        return { success: true };
    } catch (err) {
        console.error("Error in updateTournamentPlayer:", err);
        return { success: false, error: err instanceof Error ? err.message : "An unexpected error occurred" };
    }
}

export async function updatePlayer(
    playerId: string,
    teamId: string,
    data: { name?: string; number?: number | null; position?: string | null; birth_date?: string | null; photo_url?: string | null; tel?: string | null }
): Promise<ActionResponse> {
    return updateTournamentPlayer(playerId, teamId, data);
}
