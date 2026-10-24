"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionResponse, SportType, MatchStatus, TournamentStatus, TournamentStatusRequest } from "@/types/index";
import { logActivity } from "@/lib/audit";
import { validateTournamentAccess } from "@/lib/security";
import { validateUploadedFile } from "@/lib/file-validation";
import { uploadToR2 } from "@/lib/r2";
import { getServerSession } from "@/lib/auth-server";
import { ApiClient } from "@/lib/api-client";
import { populateTournamentRosterSubmissionsFromGlobalTeam } from "@/actions/tournaments/registration";



export async function addTeam(
    tournamentId: string,
    prevState: unknown,
    formData: FormData
): Promise<ActionResponse> {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const contact_name = formData.get("contact_name") as string;
    const contact_phone = formData.get("contact_phone") as string;
    const contact_email = formData.get("contact_email") as string;
    const logoFile = formData.get("logo") as File;
    const logoUrlInput = formData.get("logo_url") as string;
    const requestedCategoryId = formData.get("tournament_category_id") as string | null;

    if (!name || !name.trim()) {
        return { success: false, error: "Team name is required" };
    }

    // Security Check: Ensure user is authorized
    const access = await validateTournamentAccess(tournamentId, 'editor');
    if (!access.success) return { success: false, error: access.error };
    const session = await getServerSession();
    if (!session?.token) return { success: false, error: "Authentication required" };

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://leagueflow-v80x.onrender.com/api/v1';

    // 1. Fetch tournament to resolve sport_id and category_id
    let tournamentSportId: string | null = null;
    let targetCategoryId: string | null = requestedCategoryId;

    try {
        const tourRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
            headers: { Authorization: `Bearer ${session.token}` },
            cache: 'no-store',
        });
        if (tourRes.ok) {
            const tourData = await tourRes.json();
            tournamentSportId = tourData.tournament?.sport_id || null;
            const categories = tourData.categories || [];
            const matchedCategory = requestedCategoryId
                ? categories.find((c: any) => String(c.id) === String(requestedCategoryId))
                : categories[0];
            if (matchedCategory) {
                targetCategoryId = matchedCategory.id;
            } else if (categories.length > 0) {
                targetCategoryId = categories[0].id;
            }
        }
    } catch (e) {
        console.error("Failed to fetch tournament info in addTeam:", e);
    }

    if (!targetCategoryId) {
        return { success: false, error: "Tournament category setup not found" };
    }

    let logo_url = logoUrlInput || null;

    // Handle File Upload if URL is not provided
    if (!logo_url && logoFile && logoFile.size > 0) {
        const fileCheck = validateUploadedFile(logoFile);
        if (!fileCheck.valid) return { success: false, error: fileCheck.error };

        const tempId = crypto.randomUUID();
        const fileExt = logoFile.name.split('.').pop() || 'png';
        const fileName = `logo-${Date.now()}.${fileExt}`;
        const filePath = `teams/${tempId}/${fileName}`;

        const uploadRes = await uploadToR2(logoFile, filePath, logoFile.type);
        if (!uploadRes.success || !uploadRes.url) {
            console.error("Logo upload to R2 failed", uploadRes.error);
            return { success: false, error: `Logo upload failed: ${uploadRes.error || "Unknown error"}` };
        }
        logo_url = uploadRes.url;
    }

    // 2. Create global team via Go REST API
    let createdTeam: any = null;
    try {
        const parsedSportId = tournamentSportId ? parseInt(String(tournamentSportId), 10) || 1 : 1;
        const createTeamRes = await fetch(`${apiUrl}/teams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                name: name.trim(),
                description: description || '',
                contact_name: contact_name || '',
                contact_phone: contact_phone || '',
                contact_email: contact_email || '',
                logo_url: logo_url || null,
                logo_img: logo_url || null,
                sport_id: parsedSportId,
            }),
        });

        if (!createTeamRes.ok) {
            const err = await createTeamRes.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to create team" };
        }
        createdTeam = await createTeamRes.json();
    } catch (e) {
        console.error("Error creating team in Go API:", e);
        return { success: false, error: "An unexpected error occurred while creating team" };
    }

    if (!createdTeam?.id) {
        return { success: false, error: "Failed to create team: Invalid response from server" };
    }

    // 3. Register team to tournament via Go REST API
    try {
        const regRes = await fetch(`${apiUrl}/tournaments/${tournamentId}/teams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                tournament_id: tournamentId,
                category_id: targetCategoryId,
                tournament_category_id: targetCategoryId,
                team_id: createdTeam.id,
                status: 'registered',
                payment_status: 'paid',
                registration_status: 'approved',
                roster_status: 'pending',
                contact_name: contact_name || '',
                contact_phone: contact_phone || '',
                contact_email: contact_email || '',
            }),
        });

        if (!regRes.ok) {
            const err = await regRes.json().catch(() => ({}));
            // Cleanup created team
            await fetch(`${apiUrl}/teams/${createdTeam.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.token}` }
            }).catch(() => {});
            return { success: false, error: err.error || "Failed to register team to tournament" };
        }

        const regData = await regRes.json().catch(() => ({}));
        let ttId = regData?.id || regData?.data?.id || regData?.tournament_team?.id;
        if (!ttId && createdTeam?.id) {
            try {
                const ttRes = await fetch(`${apiUrl}/tournaments/${tournamentId}/teams`, {
                    headers: { Authorization: `Bearer ${session.token}` },
                    cache: 'no-store'
                });
                if (ttRes.ok) {
                    const listData = await ttRes.json();
                    const teamsList = Array.isArray(listData) ? listData : (listData.data || listData.teams || []);
                    const matched = teamsList.find((t: any) => t.team_id === createdTeam.id || t.id === createdTeam.id);
                    if (matched) ttId = matched.id;
                }
            } catch (err) {
                console.warn("[addTeam] Fallback team lookup error:", err);
            }
        }

        if (ttId && createdTeam?.id) {
            await populateTournamentRosterSubmissionsFromGlobalTeam(ttId, createdTeam.id).catch(err => {
                console.error("Error populating tournament_roster_submissions in addTeam:", err);
            });
        }
    } catch (e) {
        console.error("Error registering team to tournament:", e);
        return { success: false, error: "An unexpected error occurred while registering team" };
    }

    revalidatePath(`/organizer/tournaments/${tournamentId}`);
    revalidatePath(`/my-tournaments/${tournamentId}`);
    revalidatePath(`/dashboard/tournaments/${tournamentId}`);
    revalidatePath(`/registrations/${tournamentId}`);
    await logActivity('ADD_TEAM', 'tournament', tournamentId, { team_name: name });
    return { success: true };
}

export async function assignTeamGroup(
    teamId: string,
    groupName: string | null,
    tournamentId: string
): Promise<ActionResponse> {
    // Security Check
    const access = await validateTournamentAccess(tournamentId, 'editor');
    if (!access.success) return { success: false, error: access.error };

    // Group name is removed in tournament_teams, stub to return success: true
    return { success: true };
}

export async function updateTeam(
    teamId: string,
    formData: FormData,
    tournamentId: string
): Promise<ActionResponse> {
    // Security Check
    const access = await validateTournamentAccess(tournamentId, 'editor');
    if (!access.success) return { success: false, error: access.error };

    const session = await getServerSession();
    if (!session?.token) return { success: false, error: "Authentication required" };
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const contact_name = formData.get("contact_name") as string;
    const contact_phone = formData.get("contact_phone") as string;
    const contact_email = formData.get("contact_email") as string;
    const logoFile = formData.get("logo") as File;
    const existingLogoUrl = formData.get("existing_logo_url") as string;

    let logo_url = existingLogoUrl;

    // Handle File Upload
    if (logoFile && logoFile.size > 0) {
        const fileCheck = validateUploadedFile(logoFile);
        if (!fileCheck.valid) return { success: false, error: fileCheck.error };

        const fileExt = logoFile.name.split('.').pop() || 'png';
        const fileName = `logo-${Date.now()}.${fileExt}`;
        const filePath = `teams/${teamId}/${fileName}`;

        const uploadRes = await uploadToR2(logoFile, filePath, logoFile.type);
        if (!uploadRes.success || !uploadRes.url) {
            console.error("Logo upload to R2 failed", uploadRes.error);
            return { success: false, error: `Logo upload failed: ${uploadRes.error || "Unknown error"}` };
        }
        logo_url = uploadRes.url;
    }

    const updateData: Record<string, unknown> = {
        name,
        description: description || null,
        logo_url: logo_url || null
    };
    if (contact_name) updateData.contact_name = contact_name;
    if (contact_phone) updateData.contact_phone = contact_phone;
    if (contact_email !== undefined) updateData.contact_email = contact_email ? contact_email.trim() : null;

    try {
        const res = await fetch(`${apiUrl}/teams/${teamId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify(updateData)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to update team" };
        }
    } catch (e: any) {
        return { success: false, error: e?.message || "Failed to update team" };
    }

    revalidatePath(`/organizer/tournaments/${tournamentId}`);
    await logActivity('UPDATE_TEAM', 'team', teamId, { name, tournament_id: tournamentId });
    return { success: true };
}

export async function deleteTeam(teamId: string, tournamentId: string): Promise<ActionResponse> {
    // Security Check
    const access = await validateTournamentAccess(tournamentId, 'editor');
    if (!access.success) return { success: false, error: access.error };
    
    const session = await getServerSession();
    if (!session?.token) return { success: false, error: "Authentication required" };
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

    try {
        const res = await fetch(`${apiUrl}/teams/${teamId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to delete team" };
        }
    } catch (e: any) {
        return { success: false, error: e?.message || "Failed to delete team" };
    }

    revalidatePath(`/organizer/tournaments/${tournamentId}`);
    await logActivity('DELETE_TEAM', 'team', teamId, { tournament_id: tournamentId });
    return { success: true };
}

export async function updateTournament(
    tournamentId: string,
    prevState: unknown,
    formData: FormData
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        const formType = formData.get("form_type") as string;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

        // Fetch current tournament data to merge settings
        let currentTour: any = null;
        let categories: any[] = [];
        const tourRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
            headers: {
                'Authorization': `Bearer ${session.token}`,
            },
            cache: 'no-store'
        });
        if (tourRes.ok) {
            const data = await tourRes.json();
            currentTour = data.tournament;
            categories = data.categories || [];
        }

        const currentSettings = (currentTour?.settings as Record<string, unknown>) || {};
        const updateData: Record<string, unknown> = {
            id: tournamentId,
        };

        if (formType === 'general' || !formType) {
            if (formData.has("name")) updateData.name = formData.get("name") as string;
            if (formData.has("status")) {
                const newStatus = formData.get("status") as string;
                if ((currentTour?.status === 'completed' || currentTour?.status === 'cancelled') && newStatus !== currentTour?.status) {
                    return {
                        success: false,
                        error: "Tournament status is locked because it is completed or cancelled. Please use the Danger Zone to request a status change."
                    };
                }
                updateData.status = newStatus;
                if (newStatus === 'registration_open') {
                    currentSettings.is_registration_open = true;
                } else if (newStatus === 'registration_closed' || newStatus === 'completed' || newStatus === 'finished' || newStatus === 'cancelled') {
                    currentSettings.is_registration_open = false;
                }
            }
            if (formData.has("description")) updateData.description = formData.get("description") as string;
            if (formData.has("start_date")) updateData.start_date = formData.get("start_date") as string || null;
            if (formData.has("end_date")) updateData.end_date = formData.get("end_date") as string || null;
            delete currentSettings.document_deadline;
            if (formData.has("document_deadline")) {
                const dl = (formData.get("document_deadline") as string) || null;
                updateData.document_deadline = dl;
            }
            if (formData.has("bank_name")) currentSettings.bank_name = formData.get("bank_name") as string;
            if (formData.has("bank_account_name")) currentSettings.bank_account_name = formData.get("bank_account_name") as string;
            if (formData.has("bank_account_number")) currentSettings.bank_account_number = formData.get("bank_account_number") as string;

            // Handle logo and cover file uploads
            const logoFile = formData.get("logo_img") as File | null;
            const coverFile = formData.get("cover_img") as File | null;

            if (logoFile && logoFile.size > 0) {
                const fileCheck = validateUploadedFile(logoFile);
                if (!fileCheck.valid) return { success: false, error: `Logo: ${fileCheck.error}` };

                const fileExt = logoFile.name.split('.').pop() || 'png';
                const fileName = `logo-${Date.now()}.${fileExt}`;
                const filePath = `tournaments/uploads/${fileName}`;

                const uploadRes = await uploadToR2(logoFile, filePath, logoFile.type);
                if (!uploadRes.success || !uploadRes.url) {
                    console.error("Logo upload to R2 failed", uploadRes.error);
                    return { success: false, error: `Logo upload failed: ${uploadRes.error || "Unknown error"}` };
                }
                updateData.logo_url = uploadRes.url;
            } else if (formData.get("logo_img_remove") === 'true') {
                updateData.logo_url = null;
            }

            if (coverFile && coverFile.size > 0) {
                const fileCheck = validateUploadedFile(coverFile);
                if (!fileCheck.valid) return { success: false, error: `Cover: ${fileCheck.error}` };

                const fileExt = coverFile.name.split('.').pop() || 'png';
                const fileName = `cover-${Date.now()}.${fileExt}`;
                const filePath = `tournaments/uploads/${fileName}`;

                const uploadRes = await uploadToR2(coverFile, filePath, coverFile.type);
                if (!uploadRes.success || !uploadRes.url) {
                    console.error("Cover upload to R2 failed", uploadRes.error);
                    return { success: false, error: `Cover upload failed: ${uploadRes.error || "Unknown error"}` };
                }
                updateData.banner_url = uploadRes.url;
            } else if (formData.get("cover_img_remove") === 'true') {
                updateData.banner_url = null;
            }
        }

        if (formType === 'registration' || !formType) {
            if (formType === 'registration' || formData.has("is_registration_open")) {
                const isOpen = formData.get("is_registration_open") === 'true';
                currentSettings.is_registration_open = isOpen;
            }

            if (formData.has("bank_name")) currentSettings.bank_name = formData.get("bank_name") as string;
            if (formData.has("bank_account_name")) currentSettings.bank_account_name = formData.get("bank_account_name") as string;
            if (formData.has("bank_account_number")) currentSettings.bank_account_number = formData.get("bank_account_number") as string;
        }

        if (formType === 'general' || formType === 'venue' || !formType) {
            if (formData.has("location_name")) updateData.location = formData.get("location_name") as string || null;
            if (formData.has("google_map_url")) currentSettings.google_map_url = formData.get("google_map_url") as string || null;
        }

        updateData.settings = currentSettings;

        // Resolve category and update max_teams or registration_fee
        const requestedCategoryId = formData.get("tournament_category_id") as string | null;
        let targetCategoryId = requestedCategoryId;
        if (!targetCategoryId && categories.length > 0) {
            targetCategoryId = categories[0].id;
        }

        if (targetCategoryId) {
            const catUpdate: Record<string, unknown> = {};
            if (formData.has("max_teams")) {
                catUpdate.max_teams = Number(formData.get("max_teams") || 8);
            }
            if (formData.has("registration_fee")) {
                catUpdate.registration_fee = Number(formData.get("registration_fee") || 0);
            }
            if (Object.keys(catUpdate).length > 0) {
                await fetch(`${apiUrl}/tournaments/${tournamentId}/categories/${targetCategoryId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.token}`,
                    },
                    body: JSON.stringify(catUpdate),
                });
            }
        }

        const updateRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`,
            },
            body: JSON.stringify(updateData),
        });

        if (!updateRes.ok) {
            const errData = await updateRes.json().catch(() => ({}));
            return { success: false, error: errData.error || "Failed to update tournament" };
        }

        revalidatePath(`/my-tournaments/${tournamentId}`);
    revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        await logActivity('UPDATE_TOURNAMENT', 'tournament', tournamentId, updateData);
        return { success: true };
    } catch (error) {
        console.error("Update tournament error:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function updateTournamentStatus(
    tournamentId: string,
    status: TournamentStatus,
    options?: {
        reason?: string;
        unlockManual?: boolean;
    }
): Promise<ActionResponse> {
    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
    try {
        const session = await getServerSession();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (session?.token) {
            headers['Authorization'] = `Bearer ${session.token}`;
        }

        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status }),
        });

        if (!res.ok) {
            // Fallback to PUT /tournaments/${tournamentId}
            const fallbackRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ id: tournamentId, status }),
            });
            if (!fallbackRes.ok) {
                const errData = await fallbackRes.json().catch(() => ({}));
                return { success: false, error: errData.error || `Failed to update tournament status: ${fallbackRes.status}` };
            }
        }

        // If unlockManual or reason provided, or if completing/cancelling, update settings accordingly
        try {
            const tourRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, { cache: 'no-store' });
            if (tourRes.ok) {
                const tourData = await tourRes.json();
                const currentSettings = (tourData.tournament?.settings as Record<string, any>) || {};
                let shouldUpdateSettings = false;

                if (options?.unlockManual) {
                    currentSettings.status_unlocked = true;
                    if (options.reason) currentSettings.status_unlock_reason = options.reason;
                    currentSettings.status_unlocked_at = new Date().toISOString();
                    shouldUpdateSettings = true;
                } else if (status === 'completed' || status === 'cancelled') {
                    if (currentSettings.status_unlocked) {
                        currentSettings.status_unlocked = false;
                        shouldUpdateSettings = true;
                    }
                }

                if (shouldUpdateSettings) {
                    await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify({
                            id: tournamentId,
                            settings: currentSettings,
                        }),
                    });
                }
            }
        } catch (settingsErr) {
            console.error("Error updating tournament settings for status unlock:", settingsErr);
        }

        revalidatePath(`/my-tournaments/${tournamentId}`);
    revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/tournaments/${tournamentId}`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        await logActivity('UPDATE_TOURNAMENT_STATUS', 'tournament', tournamentId, { status, ...options });
        return { success: true };
    } catch (err) {
        console.error("Error updating tournament status:", err);
        return { success: false, error: err instanceof Error ? err.message : "Failed to update status" };
    }
}

export async function requestTournamentStatusChange(
    tournamentId: string,
    targetStatus: TournamentStatus,
    reason?: string
): Promise<ActionResponse> {
    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        const access = await validateTournamentAccess(tournamentId, 'editor');
        if (!access.success) return { success: false, error: access.error };

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session.token) headers['Authorization'] = `Bearer ${session.token}`;

        // Call Go backend status request endpoint to insert into dedicated tournament_status_requests table
        let goBackendSuccess = false;
        try {
            const reqRes = await fetch(`${apiUrl}/tournaments/${tournamentId}/status-request`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    target_status: targetStatus,
                    reason: reason?.trim() || ""
                })
            });
            if (reqRes.ok) {
                goBackendSuccess = true;
            }
        } catch (backendErr) {
            console.warn("[requestTournamentStatusChange] Go backend endpoint error:", backendErr);
        }

        // Fetch tournament & sync settings
        const tourRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, { cache: 'no-store', headers });
        if (!tourRes.ok) return { success: false, error: "Tournament not found" };
        const tourData = await tourRes.json();
        const currentTour = tourData.tournament;
        const currentSettings = (currentTour?.settings as Record<string, any>) || {};

        const statusRequest: TournamentStatusRequest = {
            id: crypto.randomUUID(),
            tournament_id: tournamentId,
            tournament_name: currentTour.name,
            current_status: currentTour.status,
            target_status: targetStatus,
            reason: reason?.trim() || "",
            requested_by: session.user.id,
            requested_by_email: session.user.email,
            requested_by_name: (session.user as any).user_metadata?.full_name || (session.user as any).name || session.user.email,
            requested_at: new Date().toISOString(),
            status: 'pending'
        };

        currentSettings.status_request = statusRequest;

        const updateRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                id: tournamentId,
                settings: currentSettings
            })
        });

        if (!updateRes.ok && !goBackendSuccess) {
            return { success: false, error: "Failed to submit status change request" };
        }

        revalidatePath(`/my-tournaments/${tournamentId}`);
    revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/tournaments/${tournamentId}`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        revalidatePath(`/admin`);
        await logActivity('REQUEST_TOURNAMENT_STATUS_CHANGE', 'tournament', tournamentId, { statusRequest });

        return { success: true };
    } catch (e) {
        console.error("Error submitting tournament status change request:", e);
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function cancelTournamentStatusChangeRequest(tournamentId: string): Promise<ActionResponse> {
    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        const access = await validateTournamentAccess(tournamentId, 'editor');
        if (!access.success) return { success: false, error: access.error };

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session.token) headers['Authorization'] = `Bearer ${session.token}`;

        // Call Go backend status request endpoint to cancel in dedicated tournament_status_requests table
        try {
            await fetch(`${apiUrl}/tournaments/${tournamentId}/status-request`, {
                method: 'DELETE',
                headers
            });
        } catch (backendErr) {
            console.warn("[cancelTournamentStatusChangeRequest] Go backend endpoint error:", backendErr);
        }

        // Fetch tournament
        const tourRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, { cache: 'no-store', headers });
        if (!tourRes.ok) return { success: false, error: "Tournament not found" };
        const tourData = await tourRes.json();
        const currentTour = tourData.tournament;
        const currentSettings = (currentTour?.settings as Record<string, any>) || {};

        if (currentSettings.status_request) {
            currentSettings.status_request = {
                ...currentSettings.status_request,
                status: 'cancelled'
            };
        }

        const updateRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                id: tournamentId,
                settings: currentSettings
            })
        });

        if (!updateRes.ok) {
            return { success: false, error: "Failed to cancel status change request" };
        }

        revalidatePath(`/my-tournaments/${tournamentId}`);
    revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/tournaments/${tournamentId}`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        revalidatePath(`/admin`);
        await logActivity('CANCEL_TOURNAMENT_STATUS_CHANGE_REQUEST', 'tournament', tournamentId);

        return { success: true };
    } catch (e) {
        console.error("Error cancelling tournament status change request:", e);
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function deleteTournament(tournamentId: string) {
    const session = await getServerSession();
    if (!session?.user) return { success: false, error: "Authentication required" };

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
    const res = await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${session.token}`,
        },
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.error || "Failed to delete tournament" };
    }

    await logActivity('DELETE_TOURNAMENT', 'tournament', tournamentId, {});
    redirect("/my-tournaments");
}

export async function cancelTournament(tournamentId: string): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) return { success: false, error: "Authentication required" };

        const access = await validateTournamentAccess(tournamentId, 'admin');
        if (!access.success) return { success: false, error: access.error || "Permission denied" };

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

        // Fetch current tournament data to merge settings
        let currentSettings: Record<string, unknown> = {};
        const tourRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
            headers: {
                'Authorization': `Bearer ${session.token}`,
            },
            cache: 'no-store'
        });
        if (tourRes.ok) {
            const data = await tourRes.json();
            currentSettings = (data.tournament?.settings as Record<string, unknown>) || {};
        }

        currentSettings.is_registration_open = false;

        const updateData: Record<string, unknown> = {
            id: tournamentId,
            status: 'cancelled',
            settings: currentSettings,
        };

        const updateRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`,
            },
            body: JSON.stringify(updateData),
        });

        if (!updateRes.ok) {
            const errData = await updateRes.json().catch(() => ({}));
            return { success: false, error: errData.error || "Failed to cancel tournament" };
        }

        revalidatePath(`/my-tournaments/${tournamentId}`);
    revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        await logActivity('CANCEL_TOURNAMENT', 'tournament', tournamentId, updateData);
        return { success: true };
    } catch (error) {
        console.error("Cancel tournament error:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function createTournament(_prevState: ActionResponse, formData: FormData): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        const name = formData.get("name") as string;
        const sport_id = formData.get("sport_id") as string;
        const description = formData.get("description") as string;
        const location_name = formData.get("location_name") as string || null;
        const google_map_url = formData.get("google_map_url") as string || null;
        const start_date = formData.get("start_date") as string;
        const end_date = formData.get("end_date") as string;
        const document_deadline = formData.get("document_deadline") as string;

        if (!name) {
            return { success: false, error: "Name is required" };
        }

        if (!sport_id) {
            return { success: false, error: "Sport is required" };
        }

        if (!start_date || !end_date) {
            return { success: false, error: "Dates are required" };
        }

        const logoFile = formData.get("logo_img") as File | null;
        const coverFile = formData.get("cover_img") as File | null;

        let logo_img: string | null = null;
        let cover_img: string | null = null;

        // Upload Logo
        if (logoFile && logoFile.size > 0) {
            const fileCheck = validateUploadedFile(logoFile);
            if (!fileCheck.valid) return { success: false, error: `Logo: ${fileCheck.error}` };

            const fileExt = logoFile.name.split('.').pop() || 'png';
            const fileName = `logo-${Date.now()}.${fileExt}`;
            const filePath = `tournaments/uploads/${fileName}`;

            const uploadRes = await uploadToR2(logoFile, filePath, logoFile.type);
            if (uploadRes.success && uploadRes.url) {
                logo_img = uploadRes.url;
            }
        }

        // Upload Cover
        if (coverFile && coverFile.size > 0) {
            const fileCheck = validateUploadedFile(coverFile);
            if (!fileCheck.valid) return { success: false, error: `Cover: ${fileCheck.error}` };

            const fileExt = coverFile.name.split('.').pop() || 'png';
            const fileName = `cover-${Date.now()}.${fileExt}`;
            const filePath = `tournaments/uploads/${fileName}`;

            const uploadRes = await uploadToR2(coverFile, filePath, coverFile.type);
            if (uploadRes.success && uploadRes.url) {
                cover_img = uploadRes.url;
            }
        }

        // Call Go Backend API to create tournament
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                name,
                description: description || null,
                start_date,
                end_date,
                location: location_name || null,
                banner_url: cover_img || null,
                logo_url: logo_img || null,
                document_deadline: document_deadline || null,
                settings: {
                    sport_id,
                    google_map_url,
                }
            }),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || "Failed to create tournament" };
        }

        const newTournament = await res.json();

        revalidatePath("/dashboard");
        revalidatePath("/my-tournaments");
        revalidatePath("/dashboard/tournaments");
        return { success: true, data: newTournament };
    } catch (_error) {
        console.error("Create tournament error:", _error);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function getDashboardTournaments(query?: string) {
    try {
        const session = await getServerSession();
        if (!session?.user) return [];

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

        // 1. Fetch owned tournaments and user accepted invitations concurrently
        const [tourRes, invRes] = await Promise.all([
            fetch(`${apiUrl}/tournaments?organizer_id=${session.user.id}`, {
                headers: { 'Authorization': `Bearer ${session.token}` },
                cache: 'no-store',
            }),
            fetch(`${apiUrl}/invitations/my`, {
                headers: { 'Authorization': `Bearer ${session.token}` },
                cache: 'no-store',
            })
        ]);

        const respData = tourRes.ok ? await tourRes.json() : { data: [] };
        const ownedTournaments = respData.data || [];

        let mapped = ownedTournaments.map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            status: t.status || 'draft',
            organizer_id: t.organizer_id,
            user_id: t.organizer_id,
            role: 'owner',
            start_date: t.start_date,
            end_date: t.end_date,
            logo_img: t.logo_url || null,
            cover_img: t.banner_url || null,
            created_at: t.created_at,
            sport: 'football' as SportType,
            format: t.format || 'knockout',
            plan: 'free' as const,
            is_registration_open: Boolean(t.is_registration_open ?? t.settings?.is_registration_open)
        }));

        // 2. Fetch tournament details for accepted invitations
        if (invRes.ok) {
            const invitations = await invRes.json();
            const acceptedInvites = (invitations || []).filter((inv: any) => inv.status === 'accepted');

            // Find tournament IDs not already in mapped list
            const existingIds = new Set(mapped.map((t: any) => t.id));
            const newInvites = acceptedInvites.filter((inv: any) => !existingIds.has(inv.tournament_id));

            if (newInvites.length > 0) {
                const staffTournaments = await Promise.all(
                    newInvites.map(async (inv: any) => {
                        try {
                            const tourDetailRes = await fetch(`${apiUrl}/tournaments/${inv.tournament_id}`, {
                                headers: { 'Authorization': `Bearer ${session.token}` },
                                cache: 'no-store',
                            });
                            if (!tourDetailRes.ok) return null;
                            const tourDetail = await tourDetailRes.json();
                            const t = tourDetail.tournament;
                            if (!t) return null;

                            return {
                                id: t.id,
                                name: t.name,
                                description: t.description,
                                status: t.status || 'draft',
                                organizer_id: t.organizer_id,
                                user_id: t.organizer_id,
                                role: inv.role || 'staff',
                                start_date: t.start_date,
                                end_date: t.end_date,
                                logo_img: t.logo_url || null,
                                cover_img: t.banner_url || null,
                                created_at: t.created_at,
                                sport: 'football' as SportType,
                                format: t.format || 'knockout',
                                plan: 'free' as const,
                                is_registration_open: Boolean(t.is_registration_open ?? t.settings?.is_registration_open)
                            };
                        } catch (e) {
                            console.error(`Error fetching staff tournament ${inv.tournament_id}:`, e);
                            return null;
                        }
                    })
                );

                for (const st of staffTournaments) {
                    if (st) {
                        mapped.push(st);
                    }
                }
            }
        }

        if (query) {
            const lowerQuery = query.toLowerCase();
            mapped = mapped.filter((t: any) => t.name?.toLowerCase().includes(lowerQuery));
        }

        return mapped;
    } catch (e) {
        console.error("Error in getDashboardTournaments:", e);
        return [];
    }
}

export async function getOrCreateAgeCategory(
    categoryName: string,
    minAge?: number,
    maxAge?: number
): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/age-categories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                category_name: categoryName,
                min_age: minAge,
                max_age: maxAge,
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to get or create age category" };
        }

        const data = await res.json();
        return { success: true, id: data.id };
    } catch (e) {
        console.error("Error in getOrCreateAgeCategory:", e);
        return { success: false, error: "Network or server error" };
    }
}

export async function createTournamentCategory(
    tournamentId: string,
    ageCategoryId: number,
    genderType: string,
    maxTeams: number,
    registrationFee: number,
    rulesConfig?: Record<string, unknown> | null,
    bankDetails?: {
        bank_name?: string;
        bank_account_name?: string;
        bank_account_number?: string;
    } | null
): Promise<ActionResponse> {
    try {
        const access = await validateTournamentAccess(tournamentId, 'editor');
        if (!access.success || !access.user) {
            return { success: false, error: access.error || "Authentication required" };
        }

        const session = await getServerSession();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

        const categoryPayload = {
            name: `${genderType === 'female' ? 'Women ' : genderType === 'mix' ? 'Mix ' : ''}Open`,
            team_limit: maxTeams,
            max_teams: maxTeams,
            gender_type: genderType,
            age_category_id: ageCategoryId,
            registration_fee: registrationFee,
            rules_config: rulesConfig || null,
        };

        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/categories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.token || ''}`,
            },
            body: JSON.stringify(categoryPayload),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || "Failed to create category" };
        }

        // If bank details provided, also update tournament settings
        if (bankDetails && (bankDetails.bank_account_number || bankDetails.bank_account_name)) {
            try {
                // Fetch current tournament settings first
                const tourRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
                    headers: { 'Authorization': `Bearer ${session?.token || ''}` },
                    cache: 'no-store'
                });
                let existingSettings: Record<string, any> = {};
                if (tourRes.ok) {
                    const tourData = await tourRes.json();
                    existingSettings = tourData.tournament?.settings || {};
                }

                await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session?.token || ''}`,
                    },
                    body: JSON.stringify({
                        settings: {
                            ...existingSettings,
                            bank_name: bankDetails.bank_name || existingSettings.bank_name || 'PromptPay',
                            bank_account_name: bankDetails.bank_account_name || existingSettings.bank_account_name || '',
                            bank_account_number: bankDetails.bank_account_number || existingSettings.bank_account_number || '',
                            is_registration_open: true
                        }
                    }),
                });
            } catch (err) {
                console.error("Failed to update tournament bank details during category setup:", err);
            }
        }

        await logActivity('CREATE_TOURNAMENT_CATEGORY', 'tournament_category', tournamentId, { 
            tournament_id: tournamentId,
            gender_type: genderType,
            max_teams: maxTeams,
            registration_fee: registrationFee
        });

        revalidatePath(`/my-tournaments/${tournamentId}`);
    revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/${tournamentId}`);
        return { success: true };
    } catch (error) {
        console.error("Unexpected error in createTournamentCategory:", error);
        return { success: false, error: "Internal server error" };
    }
}

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
        timer_status?: 'playing' | 'paused' | 'stopped' | string;
        elapsed_before_pause?: number;
        elapsed_seconds?: number;
        current_minute?: number | string;
        minute?: number | string;
        winner_to_node_id?: string | null;
        next_node_id?: string | null;
        ph_home?: string | null;
        ph_away?: string | null;
        score_detail?: Record<string, any> | null;
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
    
    if (data.elapsed_seconds !== undefined) {
        updateData.elapsed_seconds = data.elapsed_seconds;
        updateData.elapsed_before_pause = data.elapsed_seconds;
    } else if (data.elapsed_before_pause !== undefined) {
        updateData.elapsed_seconds = data.elapsed_before_pause;
        updateData.elapsed_before_pause = data.elapsed_before_pause;
    }

    if (data.next_node_id !== undefined) {
        updateData.next_node_id = data.next_node_id;
        updateData.winner_to_node_id = data.next_node_id;
    } else if (data.winner_to_node_id !== undefined) {
        updateData.next_node_id = data.winner_to_node_id;
        updateData.winner_to_node_id = data.winner_to_node_id;
    }

    if (data.minute !== undefined) {
        const minVal = Number(data.minute);
        updateData.minute = isNaN(minVal) ? null : minVal;
        updateData.current_minute = updateData.minute;
    } else if (data.current_minute !== undefined) {
        const minVal = Number(data.current_minute);
        updateData.minute = isNaN(minVal) ? null : minVal;
        updateData.current_minute = updateData.minute;
    }

    if (data.ph_home !== undefined) updateData.ph_home = data.ph_home;
    if (data.ph_away !== undefined) updateData.ph_away = data.ph_away;
    if (data.score_detail !== undefined) updateData.score_detail = data.score_detail;

    if (data.home_score !== undefined && data.home_score !== null) {
        updateData.home_score = data.home_score;
    }
    if (data.away_score !== undefined && data.away_score !== null) {
        updateData.away_score = data.away_score;
    }
    if (data.venue !== undefined) {
        updateData.field_name = data.venue;
    }

    if (data.match_date !== undefined || data.match_time !== undefined) {
        if (data.match_date) {
            const t = data.match_time || "00:00";
            updateData.scheduled_at = new Date(`${data.match_date}T${t}:00`).toISOString();
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

export async function deleteMatch(matchId: string, tournamentId: string): Promise<ActionResponse> {
    const access = await validateTournamentAccess(tournamentId, 'editor');
    if (!access.success) return { success: false, error: access.error };

    try {
        await ApiClient.fetch(`/matches/${matchId}`, {
            method: 'DELETE'
        });
        revalidatePath(`/my-tournaments/${tournamentId}`);
    revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        return { success: true };
    } catch (err: any) {
        console.error("Error deleting match via Go API:", err);
        return { success: false, error: err?.message || "Failed to delete match" };
    }
}

export async function advanceStage(tournamentId: string): Promise<ActionResponse> {
    const access = await validateTournamentAccess(tournamentId, 'editor');
    if (!access.success) return { success: false, error: access.error };

    revalidatePath(`/my-tournaments/${tournamentId}`);
    revalidatePath(`/dashboard/tournaments/${tournamentId}`);
    revalidatePath(`/tournaments/${tournamentId}`);
    return { success: true };
}

export async function updateTournamentCategory(
    tournamentId: string,
    categoryId: string,
    ageCategoryId: number,
    genderType: string,
    maxTeams: number,
    registrationFee: number,
    rulesConfig?: Record<string, unknown> | null
): Promise<ActionResponse> {
    try {
        const access = await validateTournamentAccess(tournamentId, 'editor');
        if (!access.success || !access.user) {
            return { success: false, error: access.error || "Authentication required" };
        }

        const session = await getServerSession();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

        const formattedFee = Math.round(registrationFee * 100) / 100;
        const categoryPayload = {
            gender_type: genderType,
            max_teams: maxTeams,
            team_limit: maxTeams,
            registration_fee: formattedFee,
            age_category_id: ageCategoryId,
            rules_config: rulesConfig || null,
        };

        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/categories/${categoryId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.token || ''}`,
            },
            body: JSON.stringify(categoryPayload),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || "Failed to update category" };
        }

        await logActivity('UPDATE_TOURNAMENT_CATEGORY', 'tournament_category', categoryId, { 
            tournament_id: tournamentId,
            age_category_id: ageCategoryId,
            gender_type: genderType,
            max_teams: maxTeams,
            registration_fee: registrationFee,
            rules_config: rulesConfig
        });

        revalidatePath(`/my-tournaments/${tournamentId}`);
    revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/${tournamentId}`);
        return { success: true };
    } catch (error) {
        console.error("Unexpected error in updateTournamentCategory:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function updateCategoryRulesConfig(
    tournamentId: string,
    categoryId: string,
    rulesConfigUpdate: Record<string, unknown>
): Promise<ActionResponse> {
    try {
        const access = await validateTournamentAccess(tournamentId, 'editor');
        if (!access.success || !access.user) {
            return { success: false, error: access.error || "Authentication required" };
        }

        const session = await getServerSession();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

        const categoryPayload = {
            rules_config: rulesConfigUpdate,
        };

        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/categories/${categoryId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.token || ''}`,
            },
            body: JSON.stringify(categoryPayload),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || "Failed to update category rules" };
        }

        return { success: true, data: rulesConfigUpdate };
    } catch (error) {
        console.error("Unexpected error in updateCategoryRulesConfig:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function deleteTournamentCategory(
    tournamentId: string,
    categoryId: string
): Promise<ActionResponse> {
    try {
        const access = await validateTournamentAccess(tournamentId, 'editor');
        if (!access.success || !access.user) {
            return { success: false, error: access.error || "Authentication required" };
        }

        const session = await getServerSession();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/categories/${categoryId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${session?.token || ''}`,
            },
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || "Failed to delete category" };
        }

        await logActivity('DELETE_TOURNAMENT_CATEGORY', 'tournament_category', categoryId, { 
            tournament_id: tournamentId
        });

        revalidatePath(`/my-tournaments/${tournamentId}`);
    revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        revalidatePath(`/${tournamentId}`);
        return { success: true };
    } catch (error) {
        console.error("Unexpected error in deleteTournamentCategory:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function updateBroadcastSettings(
    tournamentId: string,
    settings: unknown
): Promise<ActionResponse> {
    try {
        const access = await validateTournamentAccess(tournamentId, 'editor');
        if (!access.success) return { success: false, error: access.error };

        const session = await getServerSession();
        if (!session?.token) return { success: false, error: "Authentication required" };
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({
                id: tournamentId,
                broadcast_settings: settings
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to update broadcast settings" };
        }

        return { success: true };
    } catch (error) {
        console.error("Unexpected error in updateBroadcastSettings:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}


