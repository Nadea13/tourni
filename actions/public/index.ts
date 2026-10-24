"use server";

import { ApiClient } from "@/lib/api-client";

export interface PublicTournamentItem {
    id: string;
    name: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    organizer_id: string;
    user_id: string;
    format: string;
    max_teams: number;
    tournament_teams: { count: number }[];
    tournament_categories: any[];
    plan: string;
    sport: string;
    sport_name?: string;
    sport_id?: string;
    sports?: { id: string; sport_name: string };
    logo_img: string | null;
    cover_img: string | null;
    logo_url?: string | null;
    banner_url?: string | null;
    document_deadline?: string | null;
    is_registration_open?: boolean;
    location?: string | null;
    location_name?: string | null;
}

export async function getPublicTournaments(query?: string, sportId?: string): Promise<PublicTournamentItem[]> {
    try {
        const resp = await ApiClient.fetch<{ data: any[] }>('/tournaments');
        const tournaments = resp.data || [];

        const mapped: PublicTournamentItem[] = tournaments.map((t: any) => {
            const settings = typeof t.settings === "object" && t.settings !== null ? t.settings : {};
            const rawStatus = t.status || "upcoming";
            const docDeadline = t.document_deadline || t.document_deadline_str || settings.document_deadline || null;
            const teamsCount = typeof t.teams_count === "number" ? t.teams_count : (typeof settings.teams_count === "number" ? settings.teams_count : 0);
            const maxTeams = typeof t.max_teams === "number" && t.max_teams > 0 ? t.max_teams : (typeof settings.max_teams === "number" ? settings.max_teams : 16);
            const sportName = t.sport_name || settings.sport_name || (t.sport_id ? "football" : "football");
            let isOpen = true;
            if (settings.is_registration_open === false || settings.is_registration_open === "false" || t.is_registration_open === false) {
                isOpen = false;
            } else if (settings.is_registration_open === true || settings.is_registration_open === "true" || t.is_registration_open === true) {
                isOpen = true;
            } else {
                isOpen = rawStatus === "registration_open" || rawStatus === "published" || rawStatus === "draft" || rawStatus === "upcoming";
            }

            return {
                id: t.id,
                name: t.name,
                status: rawStatus,
                start_date: t.start_date || null,
                end_date: t.end_date || null,
                organizer_id: t.organizer_id,
                user_id: t.organizer_id,
                format: t.format || "knockout",
                max_teams: maxTeams,
                tournament_teams: [{ count: teamsCount }],
                tournament_categories: [],
                plan: "free",
                sport: sportName,
                sport_name: sportName,
                sport_id: t.sport_id || undefined,
                sports: t.sport_id ? { id: t.sport_id, sport_name: sportName } : undefined,
                logo_img: t.logo_url || settings.logo_img || null,
                cover_img: t.banner_url || settings.cover_img || null,
                logo_url: t.logo_url || null,
                banner_url: t.banner_url || null,
                document_deadline: docDeadline,
                is_registration_open: isOpen,
                location: t.location || settings.location || null,
                location_name: t.location || settings.location_name || null,
            };
        });

        return mapped.filter(item => {
            if (query && !item.name.toLowerCase().includes(query.toLowerCase())) {
                return false;
            }
            if (sportId && sportId !== "all" && item.sport_id !== sportId && item.sports?.id !== sportId) {
                return false;
            }
            return true;
        });
    } catch (err) {
        console.error("Error fetching public tournaments from Go backend:", err);
        return [];
    }
}

export async function getPublicMatches() {
    return [];
}

export async function getPublicTournamentMatches(_tournamentId: string) {
    return [];
}

export async function getPublicSports(): Promise<{ id: string; sport_name: string }[]> {
    try {
        const resp = await ApiClient.fetch<any>('/sports');
        const sports = Array.isArray(resp) ? resp : (resp?.data || []);
        const allowed = ['football', 'volleyball'];
        return sports
            .filter((s: any) => allowed.includes((s.sport_name || s.name || "").toLowerCase()))
            .map((s: any) => ({
                id: String(s.id),
                sport_name: s.sport_name || s.name || "",
            }));
    } catch (err) {
        console.error("Error fetching sports from Go backend:", err);
        return [
            { id: "1", sport_name: "Football" },
            { id: "2", sport_name: "Volleyball" },
        ];
    }
}
