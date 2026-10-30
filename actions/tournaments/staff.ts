"use server";

import { revalidatePath } from "next/cache";
import { ActionResponse, TournamentMember } from "@/types";
import { logActivity } from "@/lib/audit";
import { validateTournamentAccess } from "@/lib/security";
import { getServerSession } from "@/lib/auth-server";
import { resolveStorageUrl } from "@/lib/storage-utils";


/**
 * Invite a collaborator to a tournament by email.
 * Creates a pending tournament_invitations record.
 */
export async function inviteStaff(
    tournamentId: string,
    email: string,
    role: 'co_organizer' | 'staff' | 'referee' = 'staff'
): Promise<ActionResponse<TournamentMember>> {
    try {
        const session = await getServerSession();
        if (!session?.user) return { success: false, error: "Authentication required" };

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/invitations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                email: email.toLowerCase(),
                role: role,
                status: 'pending',
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to invite staff" };
        }

        const data = await res.json();
        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        await logActivity('INVITE_MEMBER', 'tournament', tournamentId, { email, role });
        return { success: true, data: data as TournamentMember };
    } catch (e) {
        console.error("Error inviting staff:", e);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function getStaffs(
    tournamentId: string
): Promise<ActionResponse<TournamentMember[]>> {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        
        // Fetch invitations
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/invitations`, {
            cache: 'no-store'
        });
        const invitations: TournamentMember[] = res.ok ? ((await res.json()) || []) : [];

        // Fetch tournament to get owner info
        const tourRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
            cache: 'no-store'
        });
        let ownerMember: TournamentMember | null = null;
        if (tourRes.ok) {
            const tourJson = await tourRes.json();
            const tourData = tourJson?.tournament || tourJson;
            if (tourData) {
                const organizerEmail = tourData.settings?.organizer_email 
                    || (tourData.settings?.organizer_name ? `${tourData.settings.organizer_name}` : null)
                    || (tourData.organizer_id ? `organizer@tourni.com` : null);
                
                ownerMember = {
                    id: `owner-${tourData.id || tournamentId}`,
                    tournament_id: tourData.id || tournamentId,
                    user_id: tourData.organizer_id || null,
                    email: organizerEmail || "Organizer",
                    role: 'owner',
                    status: 'accepted',
                    avatar_url: tourData.settings?.organizer_avatar || null,
                    full_name: tourData.settings?.organizer_name || null,
                    created_at: tourData.created_at || new Date().toISOString()
                };
            }
        }

        // Fallback if API couldn't find tournament or ownerMember was not constructed
        if (!ownerMember) {
            const session = await getServerSession();
            ownerMember = {
                id: `owner-${tournamentId}`,
                tournament_id: tournamentId,
                user_id: session?.user?.id || null,
                email: session?.user?.email || "Organizer",
                role: 'owner',
                status: 'accepted',
                avatar_url: (session?.user as any)?.profile_img || (session?.user as any)?.avatar_url || null,
                full_name: (session?.user as any)?.full_name || (session?.user as any)?.name || null,
                created_at: new Date().toISOString()
            };
        }

        const members: TournamentMember[] = [ownerMember, ...invitations];
        return { success: true, data: members };
    } catch (e) {
        console.error("Error fetching staff:", e);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function updateStaffRole(
    memberId: string,
    tournamentId: string,
    role: 'co_organizer' | 'staff' | 'referee'
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) return { success: false, error: "Authentication required" };

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/invitations/${memberId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`,
            },
            body: JSON.stringify({ role }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to update staff role" };
        }

        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        await logActivity('UPDATE_MEMBER_ROLE', 'tournament', tournamentId, { member_id: memberId, role });
        return { success: true };
    } catch (e) {
        console.error("Error updating staff role:", e);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function removeStaff(
    memberId: string,
    tournamentId: string
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) return { success: false, error: "Authentication required" };

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/invitations/${memberId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.token}`,
            },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to remove staff" };
        }

        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        await logActivity('REMOVE_MEMBER', 'tournament', tournamentId, { member_id: memberId });
        return { success: true };
    } catch (e) {
        console.error("Error removing staff:", e);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function getUserRole(
    tournamentId: string
): Promise<ActionResponse<{ role: 'admin' | 'editor' | 'viewer' | null; isOwner: boolean }>> {
    const access = await validateTournamentAccess(tournamentId, 'viewer');
    if (!access.success || !access.user) {
        return { success: true, data: { role: null, isOwner: false } };
    }

    return {
        success: true,
        data: {
            role: access.role || 'admin',
            isOwner: access.role === 'admin'
        }
    };
}

/**
 * Accept a collaboration invite.
 * Links the current user to the pending member record.
 */
export async function acceptInvite(
    tournamentId: string
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session?.token) {
            return { success: false, error: "Please log in to accept the invite" };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/invitations/${tournamentId}/accept`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to accept invite" };
        }

        // Refresh relevant paths
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/invites`);
        revalidatePath(`/inboxes`);
        revalidatePath(`/dashboard/inboxes`);
        revalidatePath(`/dashboard`);

        return { success: true };
    } catch (e: any) {
        console.error("Error accepting invite:", e);
        return { success: false, error: e?.message || "Failed to accept invite" };
    }
}

/**
 * Check if the current user has a pending invite for any tournament.
 * Used on dashboard to show notifications.
 */
export async function getPendingInvites(): Promise<ActionResponse<Array<{
    id: string;
    tournament_id: string;
    tournament_name?: string;
    role: string;
}>>> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session?.token) {
            return { success: true, data: [] };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/invitations/my`, {
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            return { success: true, data: [] };
        }

        const data = await res.json();
        const pending = (data || [])
            .filter((item: any) => item.status === 'pending')
            .map((item: any) => ({
                id: item.id,
                tournament_id: item.tournament_id,
                tournament_name: item.tournament_name,
                role: item.role
            }));

        return { success: true, data: pending };
    } catch (e) {
        console.error("Error fetching pending invites:", e);
        return { success: true, data: [] };
    }
}

/**
 * Reject a collaboration invite.
 * Updates the status to 'rejected'.
 */
export async function rejectInvite(
    tournamentId: string
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session?.token) {
            return { success: false, error: "Please log in to reject the invite" };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/invitations/${tournamentId}/reject`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to reject invite" };
        }

        revalidatePath(`/dashboard/invites`);
        revalidatePath(`/dashboard/notifications`);
        revalidatePath(`/inboxes`);
        revalidatePath(`/dashboard/inboxes`);
        revalidatePath(`/dashboard`);

        return { success: true };
    } catch (e: any) {
        console.error("Error rejecting invite:", e);
        return { success: false, error: e?.message || "Failed to reject invite" };
    }
}

/**
 * Get all invitations (pending, accepted, rejected) for the current user from tournament_invitations.
 */
export async function getAllUserInvites(): Promise<ActionResponse<Array<{
    id: string;
    tournament_id: string;
    tournament_name?: string;
    tournament_logo?: string | null;
    role: string;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
}>>> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session?.token) {
            return { success: true, data: [] };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/invitations/my`, {
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to fetch user invites" };
        }

        const data = await res.json();
        const invites = (data || []).map((item: any) => ({
            id: item.id,
            tournament_id: item.tournament_id,
            tournament_name: item.tournament_name || "Tournament",
            tournament_logo: resolveStorageUrl(item.tournament_logo || null),
            role: item.role,
            status: item.status as 'pending' | 'accepted' | 'rejected',
            created_at: item.created_at,
        }));

        return { success: true, data: invites };
    } catch (error: any) {
        console.error("Error fetching all user invites from Go API:", error);
        return { success: false, error: error?.message || "Failed to fetch user invites" };
    }
}

/**
 * Get all team registrations for user-owned teams.
 */
export async function getUserRegistrations(): Promise<ActionResponse<Array<{
    id: string;
    tournament_id?: string;
    team_id: string;
    team_name: string;
    team_logo?: string | null;
    tournament_name: string;
    tournament_logo?: string | null;
    registration_status: 'pending' | 'approved' | 'rejected';
    payment_status: 'pending' | 'paid' | 'waived' | 'failed';
    created_at: string;
}>>> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session?.token) {
            return { success: true, data: [] };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/registrations/my`, {
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to fetch user registrations" };
        }

        const data = await res.json();
        const registrations = (data || []).map((item: any) => ({
            id: item.id,
            tournament_id: item.tournament_id || "",
            team_id: item.team_id,
            team_name: item.team_name || "Unknown Team",
            team_logo: resolveStorageUrl(item.team_logo || null),
            tournament_name: item.tournament_name || "Unknown Tournament",
            tournament_logo: resolveStorageUrl(item.tournament_logo || null),
            registration_status: item.registration_status as 'pending' | 'approved' | 'rejected',
            payment_status: item.payment_status as 'pending' | 'paid' | 'waived' | 'failed',
            created_at: item.created_at,
        }));

        return { success: true, data: registrations };
    } catch (e: any) {
        console.error("Error fetching user registrations from Go API:", e);
        return { success: false, error: e?.message || "An unexpected error occurred" };
    }
}

/**
 * Get team management requests submitted by the current user.
 */
export async function getUserTeamManagementRequests(): Promise<ActionResponse<Array<{
    id: string;
    team_id?: string;
    team_name: string;
    team_logo?: string | null;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
}>>> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session?.token) {
            return { success: true, data: [] };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/team-management-requests/my`, {
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to fetch my team requests" };
        }

        const data = await res.json();
        const formatted = (data || []).map((item: any) => ({
            id: item.id,
            team_id: item.team_id,
            team_name: item.team?.name || "Unknown Team",
            team_logo: resolveStorageUrl(item.team?.logo_img || item.team?.logo_url || null),
            status: item.status as 'pending' | 'approved' | 'rejected',
            created_at: item.created_at,
        }));

        return { success: true, data: formatted };
    } catch (e: any) {
        console.error("Error fetching my team management requests from Go API:", e);
        return { success: false, error: e?.message || "An unexpected error occurred" };
    }
}

/**
 * Get team management requests submitted by other users for teams in tournaments where the current user is organizer or collaborator, or owned teams.
 */
export async function getIncomingTeamManagementRequests(): Promise<ActionResponse<Array<{
    id: string;
    team_id: string;
    team_name: string;
    team_logo?: string | null;
    requester_name: string;
    requester_email: string;
    requester_avatar?: string | null;
    contact_phone: string;
    message: string | null;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
}>>> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session?.token) {
            return { success: true, data: [] };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/team-management-requests/incoming`, {
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to fetch incoming team requests" };
        }

        const data = await res.json();
        const formatted = (data || []).map((item: any) => ({
            id: item.id,
            team_id: item.team_id,
            team_name: item.team?.name || "Unknown Team",
            team_logo: resolveStorageUrl(item.team?.logo_img || item.team?.logo_url || null),
            requester_name: item.requester?.full_name || "Unknown User",
            requester_email: item.requester?.email || "",
            requester_avatar: resolveStorageUrl(item.requester?.avatar_url || null),
            contact_phone: item.contact_phone,
            message: item.message || null,
            status: item.status as 'pending' | 'approved' | 'rejected',
            created_at: item.created_at,
        }));

        return { success: true, data: formatted };
    } catch (error: any) {
        console.error("Unexpected error in getIncomingTeamManagementRequests:", error);
        return { success: false, error: error?.message || "An unexpected error occurred" };
    }
}

/**
 * Approve a team management request, transferring team ownership (user_id) to the requester.
 */
export async function approveTeamManagementRequest(
    requestId: string
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session?.token) {
            return { success: false, error: "Authentication required" };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/team-management-requests/${requestId}/approve`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to approve request" };
        }

        revalidatePath(`/inboxes`);
        revalidatePath(`/dashboard/inboxes`);
        revalidatePath(`/my-teams`);
        revalidatePath(`/dashboard/teams`);
        revalidatePath(`/dashboard`);

        return { success: true };
    } catch (error: any) {
        console.error("Unexpected error in approveTeamManagementRequest:", error);
        return { success: false, error: error?.message || "An unexpected error occurred" };
    }
}

/**
 * Reject a team management request.
 */
export async function rejectTeamManagementRequest(
    requestId: string
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session?.token) {
            return { success: false, error: "Authentication required" };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/team-management-requests/${requestId}/reject`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to reject request" };
        }

        revalidatePath(`/inboxes`);
        revalidatePath(`/dashboard/inboxes`);
        revalidatePath(`/my-teams`);
        revalidatePath(`/dashboard/teams`);
        revalidatePath(`/dashboard`);

        return { success: true };
    } catch (error: any) {
        console.error("Unexpected error in rejectTeamManagementRequest:", error);
        return { success: false, error: error?.message || "An unexpected error occurred" };
    }
}

/**
 * Cancel a team management request.
 */
export async function cancelTeamManagementRequest(
    id: string
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session?.token) {
            return { success: false, error: "Authentication required" };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/team-management-requests/${id}/cancel`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to cancel request" };
        }

        revalidatePath(`/inboxes`);
        revalidatePath(`/dashboard/inboxes`);
        revalidatePath(`/my-teams`);
        revalidatePath(`/dashboard/teams`);
        revalidatePath(`/dashboard`);
        revalidatePath(`/inboxes/teams/${id}`);

        return { success: true };
    } catch (error: any) {
        console.error("Unexpected error in cancelTeamManagementRequest:", error);
        return { success: false, error: error?.message || "An unexpected error occurred" };
    }
}

/**
 * Get system notifications for current user.
 */
export async function getUserSystemNotifications(): Promise<ActionResponse<Array<{
    id: string;
    title: string;
    message: string;
    type: 'invite' | 'payment' | 'system';
    status?: 'approved' | 'rejected' | 'pending';
    link?: string | null;
    is_read: boolean;
    created_at: string;
}>>> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session?.token) {
            return { success: true, data: [] };
        }

        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
        };

        const res = await fetch(`${apiUrl}/tournaments/status-requests/my`, {
            headers,
            cache: 'no-store',
        });

        if (!res.ok) {
            return { success: true, data: [] };
        }

        const json = await res.json();
        const list = json?.data || [];

        const notifs: Array<{
            id: string;
            title: string;
            message: string;
            type: 'invite' | 'payment' | 'system';
            status?: 'approved' | 'rejected' | 'pending';
            link?: string | null;
            is_read: boolean;
            created_at: string;
        }> = [];

        for (const item of list) {
            const tourName = item.tournament_name || "ทัวร์นาเมนต์";
            const targetStatus = item.target_status || "ongoing";

            if (item.status === 'approved') {
                notifs.push({
                    id: item.id,
                    title: `คำขอเปลี่ยนสถานะได้รับการอนุมัติ: ${tourName}`,
                    message: `แอดมินได้อนุมัติคำขอเปลี่ยนสถานะเป็น "${targetStatus}" เรียบร้อยแล้ว พร้อมปลดล็อคการจัดการสายการแข่งขัน`,
                    type: 'system',
                    status: 'approved',
                    link: `/my-tournaments/${item.tournament_id}`,
                    is_read: false,
                    created_at: item.reviewed_at || item.updated_at || item.created_at || new Date().toISOString(),
                });
            } else if (item.status === 'rejected') {
                notifs.push({
                    id: item.id,
                    title: `คำขอเปลี่ยนสถานะถูกปฏิเสธ: ${tourName}`,
                    message: `แอดมินได้ปฏิเสธคำขอเปลี่ยนสถานะเป็น "${targetStatus}"${item.reject_reason ? ` (เหตุผล: ${item.reject_reason})` : ''}`,
                    type: 'system',
                    status: 'rejected',
                    link: `/my-tournaments/${item.tournament_id}`,
                    is_read: false,
                    created_at: item.reviewed_at || item.updated_at || item.created_at || new Date().toISOString(),
                });
            } else if (item.status === 'pending') {
                notifs.push({
                    id: item.id,
                    title: `คำขอเปลี่ยนสถานะกำลังรอการตรวจสอบ: ${tourName}`,
                    message: `คำขอเปลี่ยนสถานะเป็น "${targetStatus}" อยู่ระหว่างการพิจารณาตรวจสอบโดยผู้ดูแลระบบ`,
                    type: 'system',
                    status: 'pending',
                    link: `/my-tournaments/${item.tournament_id}`,
                    is_read: false,
                    created_at: item.created_at || new Date().toISOString(),
                });
            }
        }

        return { success: true, data: notifs };
    } catch (e) {
        console.error("Error fetching system notifications:", e);
        return { success: true, data: [] };
    }
}

/**
 * Get pending tournament actions (team registration approval, roster/document verification, unlock requests)
 * for tournaments where the current user is organizer or staff.
 */
export async function getIncomingTournamentActions(): Promise<ActionResponse<Array<{
    id: string;
    tournament_id: string;
    tournament_name: string;
    tournament_logo?: string | null;
    category_name?: string | null;
    max_teams?: number;
    approved_teams_count?: number;
    min_players?: number;
    max_players?: number;
    registration_fee?: number;
    team_id?: string | null;
    team_name: string;
    team_logo?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    slip_img?: string | null;
    action_type: 'tournament_registration' | 'tournament_roster_submission' | 'tournament_roster_unlock';
    status: 'pending' | 'approved' | 'rejected';
    registration_status?: 'pending' | 'approved' | 'rejected' | null;
    payment_status?: string | null;
    roster_player_count?: number;
    created_at: string;
}>>> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session?.token) {
            return { success: true, data: [] };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/actions/incoming`, {
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to fetch incoming tournament actions" };
        }

        const data = await res.json();
        const actions = (data || []).map((item: any) => ({
            id: item.id,
            tournament_id: item.tournament_id,
            tournament_name: item.tournament_name || "Unknown Tournament",
            tournament_logo: resolveStorageUrl(item.tournament_logo || null),
            category_name: item.category_name || null,
            max_teams: item.max_teams,
            approved_teams_count: item.approved_teams_count || 0,
            min_players: item.min_players,
            max_players: item.max_players,
            registration_fee: item.registration_fee,
            team_id: item.team_id,
            team_name: item.team_name || "Unknown Team",
            team_logo: resolveStorageUrl(item.team_logo || null),
            contact_name: item.contact_name || null,
            contact_phone: item.contact_phone || null,
            slip_img: resolveStorageUrl(item.slip_img || null),
            action_type: item.action_type as 'tournament_registration' | 'tournament_roster_submission' | 'tournament_roster_unlock',
            status: item.status as 'pending' | 'approved' | 'rejected',
            registration_status: item.registration_status || (item.action_type === 'tournament_registration' ? item.status : 'approved'),
            payment_status: item.payment_status || null,
            roster_player_count: item.roster_player_count || 0,
            created_at: item.created_at,
        }));

        return { success: true, data: actions };
    } catch (e: any) {
        console.error("Error fetching incoming tournament actions from Go API:", e);
        return { success: false, error: e?.message || "An unexpected error occurred" };
    }
}

/**
 * Fetch roster submissions for a specific tournament team registration
 */
export async function getTournamentTeamRoster(
    tournamentTeamId: string
): Promise<ActionResponse<Array<{
    id: string;
    tournament_team_id: string;
    master_player_id?: string | null;
    player_id?: string | null;
    name: string;
    shirt_number?: string | null;
    position?: string | null;
    tel?: string | null;
    photo_url?: string | null;
    status: string;
    rejection_reason?: string | null;
    created_at: string;
}>>> {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const session = await getServerSession();
        
        const res = await fetch(`${apiUrl}/tournament-teams/${tournamentTeamId}/roster`, {
            headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
            cache: 'no-store'
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to fetch roster" };
        }

        const data = await res.json();
        const mapped = (data || []).map((item: any) => ({
            id: item.id,
            tournament_team_id: item.tournament_team_id,
            master_player_id: item.master_player_id || null,
            player_id: item.player_id || null,
            name: item.name,
            shirt_number: item.shirt_number || null,
            position: item.position || null,
            tel: item.tel || null,
            photo_url: resolveStorageUrl(item.photo_url || null),
            status: item.status || 'pending',
            rejection_reason: item.rejection_reason || null,
            created_at: item.created_at || new Date().toISOString()
        }));

        return { success: true, data: mapped };
    } catch (e: any) {
        console.error("Error in getTournamentTeamRoster:", e);
        return { success: false, error: e?.message || "Failed to fetch roster" };
    }
}

/**
 * Review a single roster submission (Approve or Reject)
 */
export async function reviewRosterSubmission(
    submissionId: string,
    status: 'approved' | 'rejected',
    rejectionReason?: string
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (session?.token) {
            headers['Authorization'] = `Bearer ${session.token}`;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const endpoint = status === 'approved'
            ? `${apiUrl}/tournament-roster-submissions/${submissionId}/approve`
            : `${apiUrl}/tournament-roster-submissions/${submissionId}/reject`;

        const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: status === 'rejected' ? JSON.stringify({ reason: rejectionReason || 'ไม่ผ่านเกณฑ์การตรวจสอบ' }) : undefined,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || `Failed to ${status} roster submission` };
        }

        return { success: true };
    } catch (e: any) {
        console.error("Error reviewing roster submission:", e);
        return { success: false, error: e?.message || "Failed to review roster submission" };
    }
}

/**
 * Batch review roster submissions
 */
export async function batchReviewRosterSubmissions(
    submissionIds: string[],
    status: 'approved' | 'rejected',
    rejectionReason?: string
): Promise<ActionResponse> {
    try {
        for (const id of submissionIds) {
            await reviewRosterSubmission(id, status, rejectionReason);
        }
        return { success: true };
    } catch (e: any) {
        console.error("Error batch reviewing roster submissions:", e);
        return { success: false, error: e?.message || "Failed to batch review submissions" };
    }
}

/**
 * Unified server action to fetch all user inbox items in one request
 */
export async function getUnifiedInboxData() {
    try {
        const [invitesRes, regsRes, mgmtReqsRes, incomingReqsRes, systemRes, tourActionsRes] = await Promise.all([
            getAllUserInvites(),
            getUserRegistrations(),
            getUserTeamManagementRequests(),
            getIncomingTeamManagementRequests(),
            getUserSystemNotifications(),
            getIncomingTournamentActions()
        ]);

        return {
            success: true,
            data: {
                invites: invitesRes.success ? (invitesRes.data || []) : [],
                registrations: regsRes.success ? (regsRes.data || []) : [],
                teamRequests: mgmtReqsRes.success ? (mgmtReqsRes.data || []) : [],
                incomingTeamRequests: incomingReqsRes.success ? (incomingReqsRes.data || []) : [],
                systemNotifications: systemRes.success ? (systemRes.data || []) : [],
                tournamentActions: tourActionsRes.success ? (tourActionsRes.data || []) : []
            }
        };
    } catch (e: any) {
        console.error("Error fetching unified inbox data:", e);
        return { success: false, error: e?.message || "Failed to fetch inbox data" };
    }
}



