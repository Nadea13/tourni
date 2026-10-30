'use server';

import { revalidatePath } from "next/cache";
import { ActionResponse, Player, Sport } from "@/types/index";
import { validateUploadedFile } from "@/lib/file-validation";
import { logActivity } from "@/lib/audit";
import { uploadToR2 } from "@/lib/r2";
import { resolveStorageUrl } from "@/lib/storage-utils";
import { getServerSession } from "@/lib/auth-server";
import { classifyPlayerNames } from "@/lib/name-helper";
import { getPublicSports } from "@/actions/public";

import { 
    getGlobalPlayers as getGP, 
    createGlobalPlayer as createGP, 
    linkPlayerToGlobal as linkGP, 
    unlinkPlayerFromGlobal as unlinkGP,
    updateGlobalPlayerInfo as updateGPInfo
} from "../tournaments/master-player";

export async function updateGlobalPlayerInfo(globalPlayerId: string, data: { name?: string; date_of_birth?: string | null }) {
    return updateGPInfo(globalPlayerId, data);
}

export async function getGlobalPlayers(page?: number, pageSize?: number, search?: string) {
    return getGP(page, pageSize, search);
}

export async function createGlobalPlayer(name: string, photoUrl?: string | null, dateOfBirth?: string | null, _athleteTypes?: string[]) {
    return createGP(name, photoUrl, dateOfBirth);
}

export async function linkPlayerToGlobal(playerId: string, globalPlayerId: string) {
    return linkGP(playerId, globalPlayerId);
}

export async function unlinkPlayerFromGlobal(playerId: string) {
    return unlinkGP(playerId);
}


/**
 * Authorization helper to check if a user is authorized to manage a team.
 * Checks global team ownership and tournament participation ownership/management.
 */
async function isAuthorizedForTeam(teamId: string, userId: string) {
    try {
        const session = await getServerSession();
        if (!session?.token) return false;

        const res = await fetch(`${API_BASE_URL}/teams/${teamId}`, {
            headers: { Authorization: `Bearer ${session.token}` },
            cache: 'no-store'
        });
        if (res.ok) {
            const team = await res.json();
            if (team && (team.user_id === userId || !team.user_id)) return true;
        }

        const ttRes = await fetch(`${API_BASE_URL}/tournament-teams/${teamId}`, {
            headers: { Authorization: `Bearer ${session.token}` },
            cache: 'no-store'
        });
        if (ttRes.ok) return true;
    } catch (e) {
        console.error("Error in isAuthorizedForTeam:", e);
    }
    return false;
}

/* ============================================================================
   TEAM MANAGEMENT
   ============================================================================ */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://leagueflow-v80x.onrender.com/api/v1';

const SPORT_ID_MAP: Record<string, string> = {
    "1": "Football",
    "2": "Volleyball",
    "3": "Basketball",
    "4": "Futsal",
    "5": "Badminton",
    "6": "Tennis",
    "7": "Sepak Takraw",
    "8": "Cricket",
    "7cf8611f-99a1-44f6-a218-9345ca2cfa06": "Football",
    "f193797b-8454-4870-b669-715f45d43543": "Futsal",
    "ed6d32f4-4fe3-4694-81d6-7f29f8f163b1": "Basketball",
    "e193797b-8454-4870-b669-715f45d43542": "Volleyball",
    "b193797b-8454-4870-b669-715f45d43544": "Badminton",
    "t193797b-8454-4870-b669-715f45d43545": "Tennis",
    "s193797b-8454-4870-b669-715f45d43546": "Sepak Takraw",
    "c193797b-8454-4870-b669-715f45d43547": "Cricket",
};

async function getSportsMap(): Promise<Map<string, string>> {
    const sportMap = new Map<string, string>();
    Object.entries(SPORT_ID_MAP).forEach(([k, v]) => sportMap.set(k, v));
    try {
        const sports = await getPublicSports();
        sports.forEach(s => sportMap.set(s.id, s.sport_name));
    } catch {
        // use defaults
    }
    return sportMap;
}

/**
 * Get all available sports.
 */
export async function getSports(): Promise<ActionResponse<Sport[]>> {
    try {
        const defaultSports: Sport[] = [
            { id: 1, sport_name: "Football", created_at: new Date().toISOString() },
            { id: 2, sport_name: "Volleyball", created_at: new Date().toISOString() },
        ];

        try {
            const res = await fetch(`${API_BASE_URL}/sports`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    const allowed = ['football', 'volleyball'];
                    const filtered = data.filter((s: any) =>
                        allowed.includes((s.sport_name || s.name || "").toLowerCase())
                    );
                    return { success: true, data: filtered.length > 0 ? filtered : defaultSports };
                }
            }
        } catch (fetchErr) {
            console.warn("Failed to fetch sports from backend API, using defaults:", fetchErr);
        }

        return { success: true, data: defaultSports };
    } catch (error) {
        console.error("Unexpected error in getSports:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}


/**
 * Create a new global team.
 */
export async function createTeam(prevState: ActionResponse, formData: FormData): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        const name = formData.get("name") as string;
        const logoFile = formData.get("logo") as File;
        const rawSportId = formData.get("sport_id") as string;
        const description = formData.get("description") as string;
        const contact_name = formData.get("contact_name") as string;
        const contact_phone = formData.get("contact_phone") as string;
        const contact_email = formData.get("contact_email") as string;

        if (!name || !name.trim()) {
            return { success: false, error: "Team name is required" };
        }
        if (!contact_name || !contact_name.trim()) {
            return { success: false, error: "Contact name is required" };
        }
        if (!contact_phone || !contact_phone.trim()) {
            return { success: false, error: "Contact phone is required" };
        }

        let sportIdInt = 1;
        if (rawSportId) {
            const parsed = parseInt(String(rawSportId), 10);
            if (!isNaN(parsed) && parsed > 0) {
                sportIdInt = parsed;
            } else {
                const lowerSport = String(rawSportId).toLowerCase().trim();
                if (lowerSport.includes("volley") || lowerSport.includes("วอลเลย์") || lowerSport.includes("e193797b")) {
                    sportIdInt = 2;
                } else if (lowerSport.includes("basket") || lowerSport.includes("บาส") || lowerSport.includes("ed6d32f4")) {
                    sportIdInt = 3;
                } else if (lowerSport.includes("futsal") || lowerSport.includes("ฟุตซอล") || lowerSport.includes("f193797b")) {
                    sportIdInt = 4;
                } else if (lowerSport.includes("badminton") || lowerSport.includes("แบดมินตัน") || lowerSport.includes("b193797b")) {
                    sportIdInt = 5;
                } else if (lowerSport.includes("tennis") || lowerSport.includes("เทนนิส") || lowerSport.includes("t193797b")) {
                    sportIdInt = 6;
                } else if (lowerSport.includes("takraw") || lowerSport.includes("ตะกร้อ") || lowerSport.includes("s193797b")) {
                    sportIdInt = 7;
                } else if (lowerSport.includes("cricket") || lowerSport.includes("คริกเก็ต") || lowerSport.includes("c193797b")) {
                    sportIdInt = 8;
                } else {
                    sportIdInt = 1;
                }
            }
        }

        const teamId = crypto.randomUUID();
        let logoUrl: string | null = null;

        // Handle logo upload if provided
        if (logoFile && logoFile.size > 0) {
            const fileCheck = validateUploadedFile(logoFile);
            if (!fileCheck.valid) return { success: false, error: fileCheck.error };

            const fileExt = logoFile.name.split('.').pop() || 'png';
            const fileName = `logo-${Date.now()}.${fileExt}`;
            const filePath = `teams/${teamId}/${fileName}`;

            const uploadRes = await uploadToR2(logoFile, filePath, logoFile.type);
            if (!uploadRes.success || !uploadRes.url) {
                console.error("Logo upload error:", uploadRes.error);
                return { success: false, error: "Failed to upload logo: " + (uploadRes.error || "Unknown error") };
            }

            logoUrl = uploadRes.url;
        }

        // Call Go Backend API to create team
        const createRes = await fetch(`${API_BASE_URL}/teams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                name: name.trim(),
                description: description || '',
                contact_name: contact_name.trim(),
                contact_phone: contact_phone.trim(),
                contact_email: contact_email?.trim() || session.user.email || '',
                logo_url: logoUrl || null,
                logo_img: logoUrl || null,
                sport_id: sportIdInt,
            }),
        });

        if (!createRes.ok) {
            const err = await createRes.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to create team" };
        }

        const createdTeam = await createRes.json();
        await logActivity('CREATE_TEAM', 'team', createdTeam?.id || teamId, { name, sport_id: sportIdInt });

        revalidatePath("/manager/my-teams");
        revalidatePath("/manager/dashboard");
        revalidatePath("/organizer/dashboard"); 
        revalidatePath("/my-teams");
        revalidatePath("/dashboard/teams");
        
        return { success: true };
    } catch (error) {
        console.error("Unexpected error in createTeam:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}

/**
 * Get all global teams owned by the current user.
 */
export async function getMyTeams(): Promise<ActionResponse<unknown[]>> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        const res = await fetch(`${API_BASE_URL}/teams?user_id=${session.user.id}`, {
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to fetch teams" };
        }

        const teams = await res.json();
        
        const sportMap = await getSportsMap();

        const mappedData = (teams || []).map((team: any) => {
            const sportName = (team.sport_id && sportMap.get(team.sport_id)) || team.sport || team.sport_name || 'Football';
            return {
                ...team,
                logo_url: team.logo_url || team.logo_img,
                sport: sportName,
                sport_name: sportName,
                sport_id: team.sport_id,
                tournament: null
            };
        });

        return { success: true, data: mappedData };
    } catch (error) {
        console.error("Error in getMyTeams:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}

/**
 * Get detailed team information, handling both global teams and tournament participations.
 */
export async function getTeam(teamId: string) {
    try {
        const session = await getServerSession();
        if (!session?.user) return null;

        const res = await fetch(`${API_BASE_URL}/teams/${teamId}`, {
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
            cache: 'no-store',
        });

        if (!res.ok) return null;
        const data = await res.json();
        if (!data) return null;

        const sportMap = await getSportsMap();

        const sportName = (data.sport_id && sportMap.get(data.sport_id)) || data.sport || data.sport_name || 'Football';

        const mappedData = {
            ...data,
            logo_url: data.logo_url || data.logo_img,
            sport: sportName,
            sport_name: sportName,
            sport_id: data.sport_id
        };

        return {
            ...mappedData,
            isParticipation: false,
            participations: [],
            registrations: []
        };
    } catch (error) {
        console.error("Error in getTeam:", error);
        return null;
    }
}

export async function getTournamentTeam(id: string) {
    try {
        const session = await getServerSession();
        if (!session?.user) return null;

        const res = await fetch(`${API_BASE_URL}/tournament-teams/${id}`, {
            headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
            cache: 'no-store',
        });

        if (res.ok) {
            const data = await res.json();
            if (data) {
                const teamData = data.team || {};
                const sportMap = await getSportsMap();

                const sportName = (teamData.sport_id && sportMap.get(teamData.sport_id)) || teamData.sport || teamData.sport_name || 'Football';

                let tournament = data.tournament || data.tournaments || null;
                let categories: any[] = [];
                const tournamentId = data.tournament_id || data.tournament?.id;
                if (tournamentId) {
                    try {
                        const tourRes = await fetch(`${API_BASE_URL}/tournaments/${tournamentId}`, {
                            headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
                            cache: 'no-store',
                        });
                        if (tourRes.ok) {
                            const tourJson = await tourRes.json();
                            if (!tournament) {
                                tournament = tourJson.tournament || tourJson;
                            }
                            categories = tourJson.categories || [];
                        }
                    } catch (err) {
                        console.error("Failed to fetch tournament in getTournamentTeam:", err);
                    }
                }

                const resolvedTourName = tournament?.name || (tournament as any)?.tournament?.name || data.tournament_name || data.tournament?.name || null;
                const categoryId = data.tournament_category_id || data.category_id;
                let categoryName = data.category?.name || data.tournament_category?.name || data.category_name || null;
                if (!categoryName && categoryId && categories.length > 0) {
                    const matched = categories.find((c: any) => c.id === categoryId);
                    if (matched) {
                        categoryName = matched.name || matched.category_name || null;
                    }
                }

                return {
                    id: data.id,
                    team_id: data.team_id,
                    user_id: teamData.user_id || data.user_id || null,
                    tournament_id: tournamentId,
                    tournament_category_id: categoryId,
                    tournament: tournament,
                    tournament_name: resolvedTourName,
                    category_name: categoryName,
                    category: data.category || (categoryName ? { id: categoryId, name: categoryName } : null),
                    name: teamData.name || data.name || "Unknown Team",
                    short_name: teamData.short_name || data.short_name,
                    description: teamData.description || null,
                    logo_url: resolveStorageUrl(teamData.logo_url || teamData.logo_img || data.logo_url || data.logo_img),
                    logo_img: resolveStorageUrl(teamData.logo_img || teamData.logo_url || data.logo_img || data.logo_url),
                    contact_name: data.contact_name || teamData.contact_name,
                    contact_phone: data.contact_phone || teamData.contact_phone,
                    contact_email: data.contact_email || teamData.contact_email,
                    is_roster_locked: data.is_roster_locked || false,
                    unlock_requested: data.unlock_requested || false,
                    registration_status: data.registration_status,
                    roster_status: data.roster_status,
                    payment_status: data.payment_status,
                    sport: sportName as any,
                    sport_name: sportName,
                    sport_id: teamData.sport_id,
                    created_at: data.created_at || new Date().toISOString(),
                    isParticipation: true,
                    participations: [],
                    registrations: [],
                };
            }
        }

        return null;
    } catch (error) {
        console.error("Error in getTournamentTeam:", error);
        return null;
    }
}



/**
 * Update global team information.
 */
export async function updateTeamGlobal(teamId: string, formData: FormData, _tournamentId: string): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        const name = formData.get("name") as string;
        const logoFile = formData.get("logo") as File;
        const sport = formData.get("sport") as string;
        const description = formData.get("description") as string;
        const contact_name = formData.get("contact_name") as string;
        const contact_phone = formData.get("contact_phone") as string;
        const contact_email = formData.get("contact_email") as string;
        const existingLogoUrl = formData.get("existing_logo_url") as string;

        if (!name) {
            return { success: false, error: "Team name is required" };
        }

        let logoUrl = existingLogoUrl;

        if (logoFile && logoFile.size > 0) {
            const fileCheck = validateUploadedFile(logoFile);
            if (!fileCheck.valid) return { success: false, error: fileCheck.error };

            const fileExt = logoFile.name.split('.').pop() || 'png';
            const fileName = `logo-${Date.now()}.${fileExt}`;
            const filePath = `teams/${teamId}/${fileName}`;

            const uploadRes = await uploadToR2(logoFile, filePath, logoFile.type);
            if (!uploadRes.success || !uploadRes.url) {
                console.error("Logo upload error:", uploadRes.error);
                return { success: false, error: "Failed to upload logo: " + (uploadRes.error || "Unknown error") };
            }

            logoUrl = uploadRes.url;
        }

        const res = await fetch(`${API_BASE_URL}/teams/${teamId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                name: name.trim(),
                description: description || '',
                contact_name: contact_name || '',
                contact_phone: contact_phone || '',
                contact_email: contact_email?.trim() || null,
                logo_url: logoUrl || null,
                logo_img: logoUrl || null,
                sport_id: sport || undefined,
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to update team" };
        }

        // Revalidate relevant paths
        revalidatePath("/manager/my-teams");
        revalidatePath("/manager/my-registrations");
        revalidatePath(`/manager/my-teams/${teamId}`);
        revalidatePath(`/my-teams/${teamId}`);
        revalidatePath(`/dashboard/teams/${teamId}`);
        revalidatePath(`/dashboard/tournament-teams/${teamId}`);
        revalidatePath(`/inboxes/teams/${teamId}`);
        return { success: true };
    } catch (err) {
        console.error("Error in updateTeamGlobal:", err);
        return { success: false, error: "An unexpected error occurred" };
    }
}

/**
 * Delete a global team.
 */
export async function deleteTeamGlobal(teamId: string, _tournamentId?: string): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) return { success: false, error: "Authentication required" };

        const res = await fetch(`${API_BASE_URL}/teams/${teamId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to delete team" };
        }

        revalidatePath("/my-teams");
        revalidatePath("/dashboard/teams");
        revalidatePath("/manager/my-teams");
        return { success: true };
    } catch (err) {
        console.error("Error in deleteTeamGlobal:", err);
        return { success: false, error: "An unexpected error occurred" };
    }
}

/**
 * Toggle roster locking for a team.
 */
export async function toggleRosterLock(teamId: string, isLocked: boolean): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) return { success: false, error: "Authentication required" };

        let res = await fetch(`${API_BASE_URL}/teams/${teamId}/lock`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({ is_locked: isLocked, is_roster_locked: isLocked }),
        });

        if (!res.ok) {
            res = await fetch(`${API_BASE_URL}/tournaments/00000000-0000-0000-0000-000000000000/registrations/${teamId}/lock`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.token}`,
                },
                body: JSON.stringify({ is_locked: isLocked }),
            }).catch(() => res);
        }

        revalidatePath(`/my-teams/${teamId}`);
        revalidatePath(`/dashboard/teams/${teamId}`);
        revalidatePath(`/manager/my-teams/${teamId}`);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || "Failed to toggle roster lock" };
    }
}

/* ============================================================================
   ROSTER IMPORT & MANAGEMENT
   ============================================================================ */

/**
 * Fetch available teams that the user owns to use as import sources.
 */
export async function getImportableTeams(currentTeamId: string): Promise<ActionResponse<any[]>> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session?.token) return { success: false, error: "Authentication required" };

        const res = await fetch(`${API_BASE_URL}/teams?user_id=${session.user.id}`, {
            headers: { Authorization: `Bearer ${session.token}` },
            cache: 'no-store'
        });

        if (!res.ok) return { success: true, data: [] };
        const teams = await res.json();
        const results = (teams || [])
            .filter((t: any) => t.id !== currentTeamId)
            .map((t: any) => ({
                id: t.id,
                name: t.name,
                logo_url: resolveStorageUrl(t.logo_url || t.logo_img),
                sourceType: 'global',
                description: 'Global Team'
            }));

        return { success: true, data: results };
    } catch (e: any) {
        console.error("Error in getImportableTeams:", e);
        return { success: false, error: e?.message || "Failed to fetch importable teams" };
    }
}

/* ============================================================================
   PLAYER MANAGEMENT (Manager Perspective)
   ============================================================================ */

/**
 * Get players for a specific team (global or tournament).
 */
export async function getPlayers(teamId: string, isTournament = false): Promise<ActionResponse<Player[]>> {
    try {
        const session = await getServerSession();
        let players: any[] = [];
        const headers: Record<string, string> = session?.token ? { Authorization: `Bearer ${session.token}` } : {};

        if (!isTournament) {
            try {
                const res = await fetch(`${API_BASE_URL}/teams/${teamId}/players`, {
                    headers,
                    cache: 'no-store',
                });
                if (res.ok) {
                    players = await res.json();
                }
            } catch {
                // ignore
            }
        }

        if (isTournament || !players || players.length === 0) {
            try {
                const ttRes = await fetch(`${API_BASE_URL}/tournament-teams/${teamId}/players`, {
                    headers,
                    cache: 'no-store',
                });
                if (ttRes.ok) {
                    players = await ttRes.json();
                }
            } catch {
                // ignore
            }
        }

        if (isTournament || !players || players.length === 0) {
            try {
                const rRes = await fetch(`${API_BASE_URL}/tournament-teams/${teamId}/roster`, {
                    headers,
                    cache: 'no-store',
                });
                if (rRes.ok) {
                    const rData = await rRes.json();
                    if (Array.isArray(rData)) {
                        const existingIds = new Set((players || []).map((p) => p.master_player_id || p.id));
                        for (const s of rData) {
                            if (!existingIds.has(s.master_player_id || s.id)) {
                                players.push({
                                    id: s.id,
                                    name: s.name,
                                    first_name: s.name,
                                    last_name: '',
                                    jersey_number: s.shirt_number ? parseInt(s.shirt_number) : null,
                                    shirt_number: s.shirt_number,
                                    position: s.position,
                                    photo_url: s.photo_url,
                                    status: s.status,
                                    rejection_reason: s.rejection_reason
                                });
                            }
                        }
                    }
                }
            } catch {
                // ignore
            }
        }

        const activeRawPlayers = (players || []).filter((p: any) => !p.deleted_at);
        const mappedPlayers: Player[] = activeRawPlayers.map((p: any) => {
            const mp = p.master_player || {};
            const rawName = p.name || mp.name || `${p.first_name || mp.first_name_intl || mp.first_name_local || ''} ${p.last_name || (mp.last_name_intl && mp.last_name_intl !== '-' ? mp.last_name_intl : '') || (mp.last_name_local && mp.last_name_local !== '-' ? mp.last_name_local : '')}`.trim() || 'Unnamed Player';
            const cleanName = rawName.replace(/\s*-\s*$/, '').trim();
            const shirtNum = p.jersey_number !== undefined && p.jersey_number !== null
                ? (typeof p.jersey_number === 'number' ? p.jersey_number : parseInt(p.jersey_number))
                : (p.shirt_number ? parseInt(p.shirt_number) : null);

            return {
                id: p.id,
                name: cleanName,
                first_name: p.first_name || null,
                last_name: p.last_name || null,
                number: isNaN(shirtNum as number) ? null : shirtNum,
                position: p.position || null,
                birth_date: p.date_of_birth || p.birthday || null,
                photo_url: resolveStorageUrl(p.photo_url || null),
                team_id: p.team_id || teamId,
                global_team_id: teamId,
                global_player_id: p.master_player_id || p.id,
                master_player_id: p.master_player_id || null,
                tel: p.tel || null,
                status: p.status || 'approved',
                created_at: p.created_at || new Date().toISOString(),
                deleted_at: p.deleted_at || null,
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
    } catch (err) {
        console.error("Error fetching players:", err);
        return { success: true, data: [] };
    }
}

/**
 * Add a player to a team roster.
 */
export async function addPlayer(
    teamId: string,
    formData: FormData
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) return { success: false, error: "Authentication required" };

        const name = formData.get("name") as string;
        const firstNameTh = formData.get("firstNameTh") as string || formData.get("first_name_th") as string || formData.get("first_name_local") as string || "";
        const middleNameTh = formData.get("middleNameTh") as string || formData.get("middle_name_th") as string || formData.get("middle_name_local") as string || "";
        const lastNameTh = formData.get("lastNameTh") as string || formData.get("last_name_th") as string || formData.get("last_name_local") as string || "";
        const firstNameEn = formData.get("firstNameEn") as string || formData.get("first_name_en") as string || formData.get("first_name_intl") as string || "";
        const middleNameEn = formData.get("middleNameEn") as string || formData.get("middle_name_en") as string || formData.get("middle_name_intl") as string || "";
        const lastNameEn = formData.get("lastNameEn") as string || formData.get("last_name_en") as string || formData.get("last_name_intl") as string || "";
        const nickname = formData.get("nickname") as string || "";
        const number = formData.get("number") as string;
        const position = formData.get("position") as string;
        const photoFile = formData.get("photo") as File | null;
        const dateOfBirth = formData.get("date_of_birth") as string || formData.get("birthday") as string || "";
        const tel = formData.get("tel") as string || "";
        const gender = formData.get("gender") as string || "male";
        const preferredHand = formData.get("preferred_hand") as string || formData.get("preferredHand") as string || "";
        const preferredFoot = formData.get("preferred_foot") as string || formData.get("preferredFoot") as string || "";
        let masterPlayerId = formData.get("master_player_id") as string | null;

        // Smart name classification
        const classified = classifyPlayerNames({
            name,
            first_name_local: firstNameTh || null,
            middle_name_local: middleNameTh || null,
            last_name_local: lastNameTh || null,
            first_name_intl: firstNameEn || null,
            middle_name_intl: middleNameEn || null,
            last_name_intl: lastNameEn || null,
        });

        // Resolve display first and last name
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
            const fileName = `players/${teamId}/photo_${Date.now()}.${fileExt}`;
            const uploadRes = await uploadToR2(photoFile, fileName, photoFile.type);
            if (uploadRes.success && uploadRes.url) {
                photoUrl = uploadRes.url;
            }
        }

        if (!masterPlayerId) {
            try {
                const mpRes = await fetch(`${API_BASE_URL}/master-players`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.token}`,
                    },
                    body: JSON.stringify({
                        first_name_local: classified.first_name_local,
                        middle_name_local: classified.middle_name_local,
                        last_name_local: classified.last_name_local,
                        first_name_intl: classified.first_name_intl,
                        middle_name_intl: classified.middle_name_intl,
                        last_name_intl: classified.last_name_intl,
                        nickname: nickname || null,
                        birthday: dateOfBirth || null,
                        gender: gender || 'male',
                        preferred_hand: preferredHand || null,
                        preferred_foot: preferredFoot || null,
                        tel: tel || null,
                        photo_url: photoUrl,
                        status: 'active',
                        verified: false
                    })
                });
                if (mpRes.ok) {
                    const createdMP = await mpRes.json();
                    if (createdMP?.id) {
                        masterPlayerId = createdMP.id;
                    }
                }
            } catch (mpErr) {
                console.warn("[addPlayer] Master player API error:", mpErr);
            }
        }

        // Call Go Backend API
        const res = await fetch(`${API_BASE_URL}/teams/${teamId}/players`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                team_id: teamId,
                first_name: firstName,
                last_name: lastName,
                jersey_number: number ? parseInt(number) : null,
                shirt_number: number ? number.toString() : null,
                position: position || null,
                photo_url: photoUrl,
                date_of_birth: dateOfBirth || null,
                master_player_id: masterPlayerId || null,
            }),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || "Failed to add player" };
        }

        revalidatePath(`/my-teams/${teamId}`);
        revalidatePath(`/dashboard/teams/${teamId}`);
        revalidatePath(`/manager/my-teams/${teamId}`);
        return { success: true };
    } catch (err) {
        console.error("Error in addPlayer:", err);
        return { success: false, error: "An unexpected error occurred" };
    }
}

/**
 * Add multiple players to a team roster at once.
 */
export async function addPlayersBatch(
    teamId: string,
    playersList: { name: string; number?: string; position?: string; tel?: string; master_player_id?: string; }[]
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) return { success: false, error: "Authentication required" };

        const targetRes = await getPlayers(teamId);
        const existingPlayers = targetRes.success && targetRes.data ? targetRes.data : [];
        const existingMasterIds = new Set(
            existingPlayers.map(p => p.global_player_id).filter(Boolean)
        );
        const existingNames = new Set(
            existingPlayers.map(p => {
                const raw = p.name || `${p.first_name || ''} ${p.last_name || ''}`;
                return raw.trim().toLowerCase();
            })
        );

        for (const playerInfo of playersList) {
            if (!playerInfo.name || !playerInfo.name.trim()) continue;

            const nameParts = playerInfo.name.trim().split(" ");
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "-";
            const fullName = `${firstName} ${lastName}`.trim().toLowerCase();

            // Skip duplicate within batch or already on team
            if (playerInfo.master_player_id && existingMasterIds.has(playerInfo.master_player_id)) continue;
            if (existingNames.has(fullName)) continue;

            if (playerInfo.master_player_id) existingMasterIds.add(playerInfo.master_player_id);
            existingNames.add(fullName);

            await fetch(`${API_BASE_URL}/teams/${teamId}/players`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.token}`,
                },
                body: JSON.stringify({
                    team_id: teamId,
                    first_name: firstName,
                    last_name: lastName,
                    jersey_number: playerInfo.number ? parseInt(playerInfo.number) : null,
                    position: playerInfo.position || null,
                    master_player_id: playerInfo.master_player_id || null,
                }),
            });
        }

        revalidatePath(`/my-teams/${teamId}`);
        revalidatePath(`/dashboard/teams/${teamId}`);
        revalidatePath(`/manager/my-teams/${teamId}`);
        return { success: true };
    } catch (err) {
        console.error("Error in addPlayersBatch:", err);
        return { success: false, error: "An unexpected error occurred" };
    }
}

/**
 * Add multiple players with photos using FormData.
 */
export async function addPlayersBatchForm(
    formData: FormData
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) return { success: false, error: "Authentication required" };

        const teamId = formData.get("teamId") as string;
        const count = parseInt(formData.get("count") as string || "0");
        if (!teamId || count === 0) return { success: false, error: "No players provided" };

        for (let i = 0; i < count; i++) {
            const name = formData.get(`name_${i}`) as string;
            if (!name || !name.trim()) continue;

            const number = formData.get(`number_${i}`) as string;
            const position = formData.get(`position_${i}`) as string;
            const photoFile = formData.get(`photo_${i}`) as File | null;
            const masterPlayerId = formData.get(`master_player_id_${i}`) as string | null;

            let photoUrl: string | null = null;
            if (photoFile && photoFile.size > 0) {
                const fileCheck = validateUploadedFile(photoFile);
                if (fileCheck.valid) {
                    const fileExt = photoFile.name.split('.').pop() || 'jpg';
                    const fileName = `players/${teamId}/photo_${Date.now()}_${i}.${fileExt}`;
                    const uploadRes = await uploadToR2(photoFile, fileName, photoFile.type);
                    if (uploadRes.success && uploadRes.url) {
                        photoUrl = uploadRes.url;
                    }
                }
            }

            const nameParts = name.trim().split(" ");
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "-";

            await fetch(`${API_BASE_URL}/teams/${teamId}/players`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.token}`,
                },
                body: JSON.stringify({
                    team_id: teamId,
                    first_name: firstName,
                    last_name: lastName,
                    jersey_number: number ? parseInt(number) : null,
                    position: position || null,
                    photo_url: photoUrl,
                    master_player_id: masterPlayerId || null,
                }),
            });
        }

        revalidatePath(`/my-teams/${teamId}`);
        revalidatePath(`/dashboard/teams/${teamId}`);
        revalidatePath(`/manager/my-teams/${teamId}`);
        return { success: true };
    } catch (err) {
        console.error("Error in addPlayersBatchForm:", err);
        return { success: false, error: "An unexpected error occurred" };
    }
}

/**
 * Update player information.
 */
export async function updatePlayer(
    playerId: string,
    teamId: string,
    data: { name?: string; number?: number | null; position?: string | null; birth_date?: string | null; photo_url?: string | null; tel?: string | null }
): Promise<ActionResponse> {
    try {
        const session = await getServerSession().catch(() => null);
        if (!session?.user) return { success: false, error: "Authentication required" };

        const nameParts = data.name ? data.name.trim().split(" ") : [];
        const firstName = nameParts.length > 0 ? nameParts[0] : undefined;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : (nameParts.length === 1 ? "-" : undefined);

        let updateSuccess = false;
        let lastError = "";

        // 1. Try Go Backend API for team player
        try {
            const res = await fetch(`${API_BASE_URL}/teams/${teamId}/players/${playerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.token}`,
                },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    jersey_number: data.number !== undefined ? data.number : undefined,
                    position: data.position !== undefined ? data.position : undefined,
                    photo_url: data.photo_url !== undefined ? data.photo_url : undefined,
                    date_of_birth: data.birth_date !== undefined ? data.birth_date : undefined,
                    tel: data.tel !== undefined ? data.tel : undefined,
                }),
            });
            if (res.ok) {
                updateSuccess = true;
            } else {
                const errBody = await res.json().catch(() => ({}));
                lastError = errBody.error || "Failed to update team player";
            }
        } catch (apiErr) {
            console.warn("[updatePlayer] API PUT /teams failed:", apiErr);
        }

        // 2. Also try tournament player PUT API if applicable
        try {
            const res = await fetch(`${API_BASE_URL}/tournament-teams/${teamId}/players/${playerId}`, {
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
            if (res.ok) {
                updateSuccess = true;
            }
        } catch {
            // ignore
        }

        if (!updateSuccess && lastError) {
            return { success: false, error: lastError };
        }

        revalidatePath(`/my-teams/${teamId}`);
        revalidatePath(`/dashboard/teams/${teamId}`);
        revalidatePath(`/dashboard/tournament-teams/${teamId}`);
        revalidatePath(`/inboxes/teams/${teamId}`);
        revalidatePath(`/manager/my-teams/${teamId}`);
        return { success: true };
    } catch (err) {
        console.error("Error in updatePlayer:", err);
        return { success: false, error: err instanceof Error ? err.message : "An unexpected error occurred" };
    }
}

/**
 * Remove a player from a team roster.
 */
export async function deletePlayer(playerId: string, teamId: string): Promise<ActionResponse> {
    try {
        const session = await getServerSession().catch(() => null);
        if (!session?.user) return { success: false, error: "Authentication required" };

        const headers = { Authorization: `Bearer ${session.token}` };

        const res = await fetch(`${API_BASE_URL}/teams/${teamId}/players/${playerId}`, {
            method: 'DELETE',
            headers,
        });

        if (!res.ok) {
            await fetch(`${API_BASE_URL}/tournament-teams/${teamId}/players/${playerId}`, {
                method: 'DELETE',
                headers,
            });
        }

        revalidatePath(`/my-teams/${teamId}`);
        revalidatePath(`/dashboard/teams/${teamId}`);
        revalidatePath(`/dashboard/tournament-teams/${teamId}`);
        revalidatePath(`/inboxes/teams/${teamId}`);
        revalidatePath(`/manager/my-teams/${teamId}`);
        return { success: true };
    } catch (err) {
        console.error("Error in deletePlayer:", err);
        return { success: false, error: err instanceof Error ? err.message : "An unexpected error occurred" };
    }
}

/**
 * Import a roster from one team to another.
 */
export async function importRoster(
    targetTeamId: string,
    sourceTeamId: string
): Promise<ActionResponse> {
    const session = await getServerSession();
    if (!session?.user) return { success: false, error: "Authentication required" };

    const authorizedTarget = await isAuthorizedForTeam(targetTeamId, session.user.id);
    if (!authorizedTarget) return { success: false, error: "Unauthorized to manage target roster" };

    const authorizedSource = await isAuthorizedForTeam(sourceTeamId, session.user.id);
    if (!authorizedSource) return { success: false, error: "Unauthorized to read from source roster" };

    const sourceRes = await getPlayers(sourceTeamId);
    if (!sourceRes.success || !sourceRes.data || sourceRes.data.length === 0) {
        return { success: false, error: sourceRes.error || "Source team has no players to import" };
    }
    const sourcePlayers = sourceRes.data;

    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
    };

    // Check if targetTeamId is tournament team or global team
    const tourRes = await fetch(`${API_BASE_URL}/tournament-teams/${targetTeamId}`, {
        headers: session.token ? { Authorization: `Bearer ${session.token}` } : {},
    });

    const isTournamentTeam = tourRes.ok;

    const targetRes = await getPlayers(targetTeamId, isTournamentTeam);
    const existingPlayers = targetRes.success && targetRes.data ? targetRes.data : [];
    const existingMasterIds = new Set(
        existingPlayers.map(p => p.global_player_id).filter(Boolean)
    );
    const existingNames = new Set(
        existingPlayers.map(p => {
            const raw = p.name || `${p.first_name || ''} ${p.last_name || ''}`;
            return raw.trim().toLowerCase();
        })
    );

    for (const p of sourcePlayers) {
        const nameParts = (p.name || '').trim().split(' ');
        const firstName = p.first_name || nameParts[0] || '';
        const lastName = p.last_name || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '-');
        const fullName = `${firstName} ${lastName}`.trim().toLowerCase();

        // Skip duplicates already in target team
        if (p.global_player_id && existingMasterIds.has(p.global_player_id)) continue;
        if (existingNames.has(fullName)) continue;

        if (p.global_player_id) existingMasterIds.add(p.global_player_id);
        existingNames.add(fullName);

        if (isTournamentTeam) {
            await fetch(`${API_BASE_URL}/tournament-teams/${targetTeamId}/players`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    master_player_id: p.global_player_id || undefined,
                    first_name: firstName,
                    last_name: lastName,
                    shirt_number: p.number ? String(p.number) : undefined,
                    position: p.position || undefined,
                    photo_url: p.photo_url || undefined,
                    tel: p.tel || undefined
                }),
            });
        } else {
            await fetch(`${API_BASE_URL}/teams/${targetTeamId}/players`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    team_id: targetTeamId,
                    master_player_id: p.global_player_id || null,
                    first_name: firstName,
                    last_name: lastName,
                    jersey_number: p.number ? parseInt(String(p.number)) : null,
                    shirt_number: p.number ? String(p.number) : null,
                    position: p.position || null,
                    photo_url: p.photo_url || null,
                    tel: p.tel || null,
                }),
            });
        }
    }

    revalidatePath(`/manager/my-teams/${targetTeamId}`);
    revalidatePath(`/dashboard/tournament-teams/${targetTeamId}`);
        revalidatePath(`/inboxes/teams/${targetTeamId}`);
    return { success: true, message: `Successfully imported ${sourcePlayers.length} players.` };
}

/**
 * Remove all players from a team roster.
 */
export async function resetRoster(teamId: string): Promise<ActionResponse> {
    const session = await getServerSession();
    if (!session?.user) return { success: false, error: "Authentication required" };

    const authorized = await isAuthorizedForTeam(teamId, session.user.id);
    if (!authorized) return { success: false, error: "Unauthorized to manage this roster" };

    try {
        const res = await fetch(`${API_BASE_URL}/teams/${teamId}/reset-roster`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to reset roster" };
        }

        revalidatePath(`/manager/my-teams/${teamId}`);
        revalidatePath(`/dashboard/tournament-teams/${teamId}`);
        revalidatePath(`/inboxes/teams/${teamId}`);
        await logActivity('RESET_ROSTER', 'team', teamId, { reset_by: session.user.id });
        return { success: true };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Failed to reset roster" };
    }
}

/**
 * Restore all soft-deleted players for a team roster.
 */
export async function restoreRoster(teamId: string): Promise<ActionResponse> {
    const session = await getServerSession();
    if (!session?.user) return { success: false, error: "Authentication required" };

    const authorized = await isAuthorizedForTeam(teamId, session.user.id);
    if (!authorized) return { success: false, error: "Unauthorized to manage this roster" };

    try {
        const res = await fetch(`${API_BASE_URL}/teams/${teamId}/restore-roster`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to restore roster" };
        }

        revalidatePath(`/manager/my-teams/${teamId}`);
        revalidatePath(`/dashboard/tournament-teams/${teamId}`);
        revalidatePath(`/inboxes/teams/${teamId}`);
        await logActivity('RESTORE_ROSTER', 'team', teamId, { restored_by: session.user.id });
        return { success: true };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Failed to restore roster" };
    }
}

/**
 * Check if a team has any soft-deleted players.
 */
export async function hasSoftDeletedPlayers(teamId: string): Promise<ActionResponse<boolean>> {
    try {
        const res = await fetch(`${API_BASE_URL}/teams/${teamId}/has-deleted-players`, {
            cache: 'no-store'
        });
        if (!res.ok) {
            return { success: false, error: "Failed to check soft deleted players" };
        }
        const data = await res.json();
        return { success: true, data: Boolean(data?.has_deleted) };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Failed to check soft deleted players" };
    }
}

/**
 * Search global teams for management claim by name or contact email.
 */
export async function searchTeamsForClaim(query: string): Promise<ActionResponse<Array<{ id: string; name: string; contact_email?: string; logo_url?: string; sport?: string }>>> {
    try {
        const session = await getServerSession();
        const url = `${API_BASE_URL}/teams/search-claim?q=${encodeURIComponent(query.trim())}`;
        const headers: Record<string, string> = {};
        if (session?.token) {
            headers['Authorization'] = `Bearer ${session.token}`;
        }

        const res = await fetch(url, {
            headers,
            cache: 'no-store'
        });

        if (res.ok) {
            const data = await res.json();
            return {
                success: true,
                data: (data || []).map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    contact_email: t.contact_email,
                    logo_url: t.logo_url || t.logo_img,
                    sport: t.sport || 'football'
                }))
            };
        }

        return { success: false, error: "Failed to search teams" };
    } catch (error) {
        console.error("Unexpected error in searchTeamsForClaim:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}

/**
 * Search global teams by contact email.
 */
export async function getTeamsByEmail(email: string): Promise<ActionResponse<Array<{ id: string; name: string }>>> {
    return searchTeamsForClaim(email);
}

/**
 * Submit a team management request.
 * Inserts or updates a row in team_management_requests with status='pending'.
 */
export async function submitTeamManagementRequest(
    teamId: string,
    contactPhone: string,
    message?: string
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        const res = await fetch(`${API_BASE_URL}/team-management-requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                team_id: teamId,
                contact_phone: contactPhone.trim(),
                message: message?.trim() || null,
            }),
        });

        if (res.ok) {
            revalidatePath("/my-teams");
        revalidatePath("/dashboard/teams");
            return { success: true };
        }

        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.error || "Failed to submit team management request" };
    } catch (error) {
        console.error("Unexpected error in submitTeamManagementRequest:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}


