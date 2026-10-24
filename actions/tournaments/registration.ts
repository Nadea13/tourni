"use server";

import { revalidatePath } from "next/cache";
import { ActionResponse } from "@/types/index";
import { validateTournamentAccess } from "@/lib/security";
import { uploadToR2 } from "@/lib/r2";
import { getServerSession } from "@/lib/auth-server";

async function getStaffUser(): Promise<{ id: string; email: string; full_name?: string; phone?: string } | null> {
    try {
        const session = await getServerSession();
        if (session?.user) {
            return {
                id: session.user.id,
                email: session.user.email,
                full_name: session.user.full_name,
                phone: (session.user as any).phone || (session.user as any).tel || (session.user as any).user_metadata?.phone
            };
        }
    } catch (e) {
        console.error("Error in getServerSession:", e);
    }
    return null;
}

/**
 * Automatically sync/populate players into tournament_roster_submissions table (as pending)
 * for a given tournament_team (registrationId) from the team's roster in the `players` table.
 */
export async function populateTournamentRosterSubmissionsFromGlobalTeam(
    tournamentTeamId: string,
    globalTeamId: string
): Promise<void> {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const session = await getServerSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

        // 1. Fetch team players from Go backend
        const playersRes = await fetch(`${apiUrl}/teams/${globalTeamId}/players`, { headers });
        if (!playersRes.ok) return;
        const teamPlayers = await playersRes.json();
        if (!Array.isArray(teamPlayers) || teamPlayers.length === 0) return;

        // 2. Add each player as a roster submission
        for (const player of teamPlayers) {
            const rawName = (player.name || `${player.first_name || ''} ${player.last_name || ''}`).trim();
            if (!rawName) continue;
            const shirtNum = player.shirt_number || (player.jersey_number !== null && player.jersey_number !== undefined ? String(player.jersey_number) : null);
            await fetch(`${apiUrl}/tournaments/00000000-0000-0000-0000-000000000000/registrations/${tournamentTeamId}/roster`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    name: rawName,
                    shirt_number: shirtNum,
                    position: player.position || null,
                    tel: player.tel || null,
                    photo_url: player.photo_url || null,
                    status: 'pending'
                })
            }).catch(() => {});
        }

        // 3. Update roster status to pending
        await fetch(`${apiUrl}/tournaments/00000000-0000-0000-0000-000000000000/registrations/${tournamentTeamId}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ roster_status: 'pending' })
        }).catch(() => {});
    } catch (e) {
        console.error("Error in populateTournamentRosterSubmissionsFromGlobalTeam:", e);
    }
}

/**
 * Automatically sync/populate players into tournament_players table
 * for a given tournament_team (registrationId) from the team's roster in the `players` table.
 */
export async function populateTournamentPlayersFromGlobalTeam(
    tournamentTeamId: string,
    globalTeamId: string
): Promise<void> {
    await populateTournamentRosterSubmissionsFromGlobalTeam(tournamentTeamId, globalTeamId);
}

export async function approveRegistration(
    registrationId: string,
    tournamentId: string
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/registrations/${registrationId}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                status: 'approved',
                payment_status: 'paid',
                registration_status: 'approved',
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to approve registration" };
        }

        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        return { success: true, message: "Registration approved and synced!" };
    } catch (e) {
        console.error("Error approving registration:", e);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function rejectRegistration(
    registrationId: string,
    tournamentId: string
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/registrations/${registrationId}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                status: 'rejected',
                payment_status: 'rejected',
                registration_status: 'rejected',
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to reject registration" };
        }

        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        return { success: true, message: "Registration rejected" };
    } catch (e) {
        console.error("Error rejecting registration:", e);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function submitRosterWithSender(
    formData: FormData
): Promise<ActionResponse> {
    try {
        const user = await getStaffUser();
        if (!user) return { success: false, error: "Authentication required" };
        const session = await getServerSession();

        const tournamentTeamId = formData.get("tournamentTeamId") as string;
        const senderName = formData.get("senderName") as string;
        const senderPhone = formData.get("senderPhone") as string;

        if (!tournamentTeamId) return { success: false, error: "Tournament team ID is required" };
        if (!senderName || !senderName.trim()) return { success: false, error: "Sender name is required" };
        if (!senderPhone || !senderPhone.trim()) return { success: false, error: "Sender phone is required" };

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

        // Update status to pending
        await fetch(`${apiUrl}/tournaments/00000000-0000-0000-0000-000000000000/registrations/${tournamentTeamId}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ roster_status: 'pending' })
        }).catch(() => {});

        const count = parseInt(formData.get("count") as string || "0");
        for (let i = 0; i < count; i++) {
            const name = formData.get(`name_${i}`) as string;
            if (!name || !name.trim()) continue;

            const number = formData.get(`number_${i}`) as string;
            const position = formData.get(`position_${i}`) as string;
            const tel = formData.get(`tel_${i}`) as string;
            const photoFile = formData.get(`photo_${i}`) as File | null;

            let photoUrl: string | null = null;
            if (photoFile && photoFile.size > 0) {
                const uploadRes = await uploadToR2(photoFile, `roster-submissions/${tournamentTeamId}/${Date.now()}_${photoFile.name}`);
                if (uploadRes.success && uploadRes.url) {
                    photoUrl = uploadRes.url;
                }
            }

            await fetch(`${apiUrl}/tournaments/00000000-0000-0000-0000-000000000000/registrations/${tournamentTeamId}/roster`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    name: name.trim(),
                    shirt_number: number || null,
                    position: position || null,
                    tel: tel || null,
                    photo_url: photoUrl,
                    status: 'pending'
                })
            }).catch(() => {});
        }

        revalidatePath(`/dashboard/tournament-teams/${tournamentTeamId}`);
        revalidatePath(`/inboxes`);
        revalidatePath(`/dashboard/inboxes`);
        return { success: true, message: "Roster submitted successfully!" };
    } catch (e: any) {
        console.error("Error in submitRosterWithSender:", e);
        return { success: false, error: e?.message || "An unexpected error occurred." };
    }
}

export async function approveRoster(
    registrationId: string,
    tournamentId: string
): Promise<ActionResponse> {
    try {
        const access = await validateTournamentAccess(tournamentId, 'admin');
        if (!access.success) return { success: false, error: access.error };

        const session = await getServerSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/registrations/${registrationId}/approve-roster`, {
            method: 'POST',
            headers,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to approve roster" };
        }

        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        revalidatePath(`/inboxes`);
        revalidatePath(`/dashboard/inboxes`);
        return { success: true, message: "Roster approved successfully!" };
    } catch (e) {
        console.error("Error in approveRoster:", e);
        return { success: false, error: e instanceof Error ? e.message : "An unexpected error occurred." };
    }
}

export async function rejectRoster(
    registrationId: string,
    tournamentId: string
): Promise<ActionResponse> {
    try {
        const access = await validateTournamentAccess(tournamentId, 'admin');
        if (!access.success) return { success: false, error: access.error };

        const session = await getServerSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/registrations/${registrationId}/reject-roster`, {
            method: 'POST',
            headers,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to reject roster" };
        }

        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        revalidatePath(`/inboxes`);
        revalidatePath(`/dashboard/inboxes`);
        return { success: true, message: "Roster rejected successfully!" };
    } catch (e) {
        console.error("Error in rejectRoster:", e);
        return { success: false, error: e instanceof Error ? e.message : "An unexpected error occurred." };
    }
}

export async function approveSingleRosterSubmission(
    submissionId: string,
    registrationId: string,
    tournamentId: string
): Promise<ActionResponse> {
    try {
        const access = await validateTournamentAccess(tournamentId, 'admin');
        if (!access.success) return { success: false, error: access.error };

        const session = await getServerSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournament-roster-submissions/${submissionId}/approve`, {
            method: 'POST',
            headers,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to approve player" };
        }

        revalidatePath(`/inboxes`);
        revalidatePath(`/dashboard/inboxes`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        return { success: true, message: "Player approved successfully!" };
    } catch (e) {
        console.error("Error in approveSingleRosterSubmission:", e);
        return { success: false, error: e instanceof Error ? e.message : "An unexpected error occurred." };
    }
}

export async function approveSelectedRosterSubmissions(
    submissionIds: string[],
    registrationId: string,
    tournamentId: string
): Promise<ActionResponse> {
    try {
        if (!submissionIds || submissionIds.length === 0) {
            return { success: false, error: "No players selected." };
        }

        const access = await validateTournamentAccess(tournamentId, 'admin');
        if (!access.success) return { success: false, error: access.error };

        const session = await getServerSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournament-teams/${registrationId}/roster/batch-approve`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ submission_ids: submissionIds }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to approve selected players" };
        }

        revalidatePath(`/inboxes`);
        revalidatePath(`/dashboard/inboxes`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        return { success: true, message: `Approved ${submissionIds.length} players successfully!` };
    } catch (e) {
        console.error("Error in approveSelectedRosterSubmissions:", e);
        return { success: false, error: e instanceof Error ? e.message : "An unexpected error occurred." };
    }
}

export async function rejectSingleRosterSubmission(
    submissionId: string,
    registrationId: string,
    tournamentId: string,
    rejectionReason?: string
): Promise<ActionResponse> {
    try {
        const access = await validateTournamentAccess(tournamentId, 'admin');
        if (!access.success) return { success: false, error: access.error };

        const session = await getServerSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournament-roster-submissions/${submissionId}/reject`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ reason: rejectionReason || 'ไม่ผ่านเกณฑ์การตรวจสอบ' }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to reject player" };
        }

        revalidatePath(`/inboxes`);
        revalidatePath(`/dashboard/inboxes`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        return { success: true, message: "Player rejected successfully!" };
    } catch (e) {
        console.error("Error in rejectSingleRosterSubmission:", e);
        return { success: false, error: e instanceof Error ? e.message : "An unexpected error occurred." };
    }
}

export async function submitTournamentRoster(
    tournamentTeamId: string,
    formData: FormData
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

        const playersJson = formData.get("players") as string;
        const deletedIdsJson = formData.get("deleted_player_ids") as string;

        let players: any[] = [];
        let deletedPlayerIds: string[] = [];

        if (playersJson) {
            try {
                players = JSON.parse(playersJson);
            } catch (e) {
                console.error("Error parsing players JSON:", e);
            }
        }
        if (deletedIdsJson) {
            try {
                deletedPlayerIds = JSON.parse(deletedIdsJson);
            } catch (e) {
                console.error("Error parsing deleted ids JSON:", e);
            }
        }

        if (deletedPlayerIds && deletedPlayerIds.length > 0) {
            for (const delId of deletedPlayerIds) {
                await fetch(`${apiUrl}/tournaments/00000000-0000-0000-0000-000000000000/registrations/${tournamentTeamId}/roster/${delId}`, {
                    method: 'DELETE',
                    headers
                }).catch(() => {});
            }
        }

        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            const name = (p.name || `${p.firstName || ''} ${p.lastName || ''}`).trim();
            if (!name) continue;

            const fullNameWithNickname = p.nickname?.trim() ? `${name} (${p.nickname.trim()})` : name;
            let photoUrl = p.photoPreview || null;
            const photoFile = formData.get(`photo_${i}`) as File | null;
            if (photoFile && photoFile.size > 0) {
                try {
                    const uploadRes = await uploadToR2(photoFile, "players");
                    if (uploadRes.success && uploadRes.url) {
                        photoUrl = uploadRes.url;
                    }
                } catch (upErr) {
                    console.error("Error uploading player photo to R2:", upErr);
                }
            }

            let resolvedPosition = p.position || "";
            if (p.memberType === "manager") resolvedPosition = "ผู้จัดการทีม";
            else if (p.memberType === "head_coach") resolvedPosition = "ผู้ฝึกสอน";
            else if (p.memberType === "assistant_coach") resolvedPosition = "ผู้ช่วยผู้ฝึกสอน";

            await fetch(`${apiUrl}/tournaments/00000000-0000-0000-0000-000000000000/registrations/${tournamentTeamId}/roster`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    name: fullNameWithNickname,
                    shirt_number: p.number ? String(p.number) : null,
                    position: resolvedPosition || null,
                    tel: p.tel || null,
                    photo_url: photoUrl,
                    status: 'pending'
                })
            }).catch(() => {});
        }

        // Update roster status to pending
        await fetch(`${apiUrl}/tournaments/00000000-0000-0000-0000-000000000000/registrations/${tournamentTeamId}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ roster_status: 'pending' })
        }).catch(() => {});

        revalidatePath(`/inboxes`);
        revalidatePath(`/dashboard/inboxes`);
        revalidatePath(`/dashboard/tournament-teams/${tournamentTeamId}`);
        return { success: true, message: "Roster submitted to inbox successfully!" };
    } catch (e) {
        console.error("Error in submitTournamentRoster:", e);
        return { success: false, error: e instanceof Error ? e.message : "An unexpected error occurred." };
    }
}

export async function requestRosterAddition(
    registrationId: string,
    tournamentId: string
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

        await fetch(`${apiUrl}/tournaments/${tournamentId}/registrations/${registrationId}/lock`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ is_locked: false })
        });

        await fetch(`${apiUrl}/tournaments/${tournamentId}/registrations/${registrationId}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ roster_status: 'pending' })
        });

        revalidatePath(`/dashboard/registration/${tournamentId}`);
        return { success: true, message: "Roster addition requested successfully! Roster unlocked." };
    } catch (e: any) {
        return { success: false, error: e?.message || "Failed to request roster addition" };
    }
}

export async function requestRosterUnlock(
    registrationId: string
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

        const res = await fetch(`${apiUrl}/tournaments/00000000-0000-0000-0000-000000000000/registrations/${registrationId}/request-unlock`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ remark: "Unlock requested" })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to request unlock" };
        }

        return { success: true, message: "Unlock request submitted successfully!" };
    } catch (e: any) {
        return { success: false, error: e?.message || "Failed to request unlock" };
    }
}

export async function approveRosterUnlock(
    registrationId: string,
    tournamentId: string
): Promise<ActionResponse> {
    try {
        const access = await validateTournamentAccess(tournamentId, 'admin');
        if (!access.success) return { success: false, error: access.error };

        const session = await getServerSession();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/registrations/${registrationId}/approve-unlock`, {
            method: 'POST',
            headers,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to approve unlock" };
        }

        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        return { success: true, message: "Roster unlocked successfully!" };
    } catch (e: any) {
        return { success: false, error: e?.message || "Failed to approve unlock" };
    }
}

export async function rejectRosterUnlock(
    registrationId: string,
    tournamentId: string
): Promise<ActionResponse> {
    try {
        const access = await validateTournamentAccess(tournamentId, 'admin');
        if (!access.success) return { success: false, error: access.error };

        const session = await getServerSession();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/registrations/${registrationId}/reject-unlock`, {
            method: 'POST',
            headers,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to reject unlock" };
        }

        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        return { success: true, message: "Unlock request rejected." };
    } catch (e: any) {
        return { success: false, error: e?.message || "Failed to reject unlock" };
    }
}

export async function getPendingInboxCount(): Promise<ActionResponse<number>> {
    try {
        const session = await getServerSession();
        if (!session?.token) return { success: true, data: 0 };

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/actions/incoming`, {
            headers: { Authorization: `Bearer ${session.token}` },
            cache: 'no-store',
        });

        if (!res.ok) {
            return { success: true, data: 0 };
        }

        const data = await res.json();
        const count = Array.isArray(data) ? data.length : 0;
        return { success: true, data: count };
    } catch (error: any) {
        console.error("Error fetching pending inbox count:", error);
        return { success: false, error: error?.message || "Failed to get inbox count" };
    }
}

export async function withdrawTournamentTeam(
    registrationId: string
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        const user = session?.user;

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (session?.token) {
            headers['Authorization'] = `Bearer ${session.token}`;
        }

        const res = await fetch(`${apiUrl}/tournament-teams/${registrationId}/withdraw`, {
            method: 'POST',
            headers,
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error("Go API withdraw error:", errData);
            return { success: false, error: errData.error || "Failed to withdraw team" };
        }

        revalidatePath(`/my-teams`);
        revalidatePath(`/dashboard/teams`);
        revalidatePath(`/dashboard/tournament-teams/${registrationId}`);
        revalidatePath(`/inboxes`);
        revalidatePath(`/dashboard/inboxes`);
        revalidatePath(`/tournaments`);

        return { success: true, message: "ถอนทีมเรียบร้อยแล้ว" };
    } catch (e: any) {
        console.error("Error in withdrawTournamentTeam:", e);
        return { success: false, error: e?.message || "An unexpected error occurred" };
    }
}
