"use server";

import { revalidatePath } from "next/cache";
import { ActionResponse, Announcement } from "@/types/index";
import { getServerSession } from "@/lib/auth-server";

export async function getAnnouncements(tournamentId: string): Promise<ActionResponse<Announcement[]>> {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/announcements`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to fetch announcements" };
        }

        const data = await res.json();
        return { success: true, data: data as Announcement[] };
    } catch (e) {
        console.error("Error fetching announcements:", e);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function addAnnouncement(
    tournamentId: string,
    title: string,
    content?: string,
    isPinned?: boolean
): Promise<ActionResponse<Announcement>> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/announcements`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                title,
                content: content || "",
                is_pinned: isPinned || false,
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to add announcement" };
        }

        const data = await res.json();

        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        revalidatePath(`/tournaments/${tournamentId}`);

        return { success: true, data: data as Announcement };
    } catch (e) {
        console.error("Error adding announcement:", e);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function deleteAnnouncement(announcementId: string, tournamentId: string): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/announcements/${announcementId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.token}`,
            },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to delete announcement" };
        }

        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        revalidatePath(`/tournaments/${tournamentId}`);

        return { success: true };
    } catch (e) {
        console.error("Error deleting announcement:", e);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function toggleAnnouncementPin(announcementId: string, isPinned: boolean, tournamentId: string): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/announcements/${announcementId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                is_pinned: isPinned,
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to update announcement" };
        }

        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        revalidatePath(`/tournaments/${tournamentId}`);

        return { success: true };
    } catch (e) {
        console.error("Error toggling announcement pin:", e);
        return { success: false, error: "An unexpected error occurred" };
    }
}
