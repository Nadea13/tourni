'use server'

import { ApiClient } from "@/lib/api-client";
import { ActionResponse } from "@/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validateUploadedFile } from "@/lib/file-validation";
import { uploadToR2 } from "@/lib/r2";
import { getServerSession } from "@/lib/auth-server";
import { populateTournamentRosterSubmissionsFromGlobalTeam } from "@/actions/tournaments/registration";

// Zod Schema for Validation (Basic fields, slip validated conditionally)
const registrationSchema = z.object({
    tournamentId: z.string().uuid(),
    tournamentCategoryId: z.string().uuid().optional().nullable(),
    teamName: z.string().min(2, "Team name must be at least 2 characters"),
    contactName: z.string().min(2, "Contact name must be at least 2 characters"),
    contactPhone: z.string().min(10, "Phone number must be at least 10 digits"),
    contactEmail: z.string().email("Invalid email address").optional().nullable(),
    logoFile: z.unknown().optional().nullable(),
    logoUrl: z.string().optional().nullable(),
    existingTeamId: z.string().uuid().optional().nullable(),
    description: z.string().optional().nullable(),
    slipFile: z.unknown().optional().nullable(),
});

// Mock Slip Verification Function
async function mockVerifySlip(_file: File, expectedAmount: number, expectedReceiver: string | null) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const mockTransRef = `MOCK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const mockAmount = expectedAmount;
    const mockReceiver = expectedReceiver || "000-000-0000";

    return {
        success: true,
        data: {
            transRef: mockTransRef,
            amount: mockAmount,
            receiverAccount: mockReceiver,
            timestamp: new Date().toISOString(),
        },
    };
}

export async function registerTeam(formData: FormData): Promise<ActionResponse> {
    // 1. Validate Form Data
    const rawData = {
        tournamentId: formData.get("tournamentId"),
        tournamentCategoryId: formData.get("tournamentCategoryId") || null,
        teamName: formData.get("teamName"),
        contactName: formData.get("contactName"),
        contactPhone: formData.get("contactPhone"),
        contactEmail: formData.get("contactEmail") || null,
        logoFile: formData.get("logoFile"),
        logoUrl: formData.get("logoUrl"),
        existingTeamId: formData.get("existingTeamId") || null,
        description: formData.get("description"),
        slipFile: formData.get("slipFile"),
    };

    console.log("[registerTeam] Initiating registration for tournament:", rawData.tournamentId);

    const validation = registrationSchema.safeParse(rawData);
    if (!validation.success) {
        console.error("[registerTeam] Validation errors:", validation.error.flatten().fieldErrors);
        const fieldErrors = validation.error.flatten().fieldErrors;
        const firstError = Object.values(fieldErrors).flat()[0];
        return {
            success: false,
            error: firstError || "Invalid form data",
        };
    }

    const {
        tournamentId,
        tournamentCategoryId,
        teamName,
        contactName,
        contactPhone,
        contactEmail,
        slipFile,
        logoFile,
        logoUrl,
        existingTeamId,
        description
    } = validation.data;

    try {
        // Fetch tournament & categories from Go API
        const tourneyResp = await ApiClient.fetch<{ tournament: any; categories: any[] }>(`/tournaments/${tournamentId}`);
        if (!tourneyResp || !tourneyResp.tournament) {
            return { success: false, error: "Tournament not found" };
        }

        const tournament = tourneyResp.tournament;
        const categories = tourneyResp.categories || [];
        const settings = typeof tournament.settings === 'object' && tournament.settings !== null ? tournament.settings : {};
        const isRegOpen = tournament.is_registration_open || settings.is_registration_open || tournament.status === 'registration_open';

        if (!isRegOpen) {
            return { success: false, error: "Registration is closed for this tournament" };
        }

        // Find active category
        const tournamentCategory = tournamentCategoryId
            ? categories.find(c => c.id === tournamentCategoryId)
            : categories[0];

        if (!tournamentCategory) {
            return { success: false, error: "Tournament category setup not found" };
        }

        // Pre-determine team ID if a new team will be created
        let finalTeamId = existingTeamId || null;

        // Check duplicate team registration & team limit
        try {
            const existingTeams = await ApiClient.fetch<any[]>(`/tournaments/${tournamentId}/teams?category_id=${tournamentCategory.id}`);
            if (Array.isArray(existingTeams)) {
                // Filter active teams (ignore rejected/withdrawn)
                const activeTeams = existingTeams.filter(t => {
                    const rs = String(t.registration_status || '').toLowerCase();
                    const ps = String(t.payment_status || '').toLowerCase();
                    return rs !== 'rejected' && ps !== 'rejected';
                });

                // 1. Check duplicate by linked team_id
                if (finalTeamId) {
                    const isDuplicateId = activeTeams.some(t => String(t.team_id || t.id) === String(finalTeamId));
                    if (isDuplicateId) {
                        return {
                            success: false,
                            error: "ทีมนี้ได้ลงทะเบียนในรายการแข่งขันนี้เรียบร้อยแล้ว"
                        };
                    }
                }

                // 2. Check duplicate by team name
                const isDuplicateName = activeTeams.some(t => {
                    const existingName = (t.name || t.team_name || '').trim().toLowerCase();
                    return existingName === teamName.trim().toLowerCase();
                });
                if (isDuplicateName) {
                    return {
                        success: false,
                        error: `ทีม "${teamName}" ได้ลงทะเบียนในรายการแข่งขันนี้เรียบร้อยแล้ว กรุณาใช้ชื่ออื่นหรือตรวจสอบสถานะการสมัคร`
                    };
                }

                const limit = tournamentCategory.max_teams || 8;
                if (activeTeams.length >= limit) {
                    return { success: false, error: `ขออภัย จำนวนทีมในรุ่นนี้เต็มแล้ว (จำกัดสูงสุด ${limit} ทีม)` };
                }
            }
        } catch (e) {
            console.warn("[registerTeam] Check duplicate/limit warning:", e);
        }

        const registrationFee = Number(tournamentCategory.registration_fee || 0);
        const isFree = registrationFee <= 0;

        let transRef = "";
        let publicUrl = null;
        let finalLogoUrl = logoUrl || null;

        // Handle Logo Upload if provided as file
        if (logoFile && logoFile instanceof File && logoFile.size > 0) {
            const fileCheck = validateUploadedFile(logoFile);
            if (!fileCheck.valid) return { success: false, error: fileCheck.error };

            const tempTeamId = finalTeamId || crypto.randomUUID();
            const fileExt = logoFile.name.split('.').pop() || 'png';
            const fileName = `logo-${Date.now()}.${fileExt}`;
            const filePath = `teams/${tempTeamId}/${fileName}`;
            const uploadRes = await uploadToR2(logoFile, filePath, logoFile.type);
            if (uploadRes.success && uploadRes.url) {
                finalLogoUrl = uploadRes.url;
            }
        }

        if (!isFree) {
            // Validate Slip File
            if (!slipFile || !(slipFile instanceof File)) {
                return { success: false, error: "Slip image is required for paid tournaments" };
            }
            if (slipFile.size > 5 * 1024 * 1024) return { success: false, error: "File size must be less than 5MB" };
            if (!slipFile.type.startsWith("image/")) return { success: false, error: "File must be an image" };

            // Verify Slip (Mock)
            const bankAccNum = tournament.bank_account_number || settings.bank_account_number || null;
            const verificationResult = await mockVerifySlip(
                slipFile,
                registrationFee,
                bankAccNum
            );

            if (!verificationResult.success || !verificationResult.data) {
                return { success: false, error: "Slip verification failed: Invalid slip" };
            }

            const { transRef: vTransRef, amount } = verificationResult.data;
            transRef = vTransRef;

            if (amount < registrationFee) {
                return {
                    success: false,
                    error: `Insufficient payment amount. Expected ${registrationFee}, got ${amount}`
                };
            }

            // Upload Slip to R2 Storage
            const fileExt = slipFile.name.split('.').pop() || 'jpg';
            const fileName = `slips/${tournamentId}/${transRef}.${fileExt}`;
            const uploadRes = await uploadToR2(slipFile, fileName, slipFile.type);

            if (!uploadRes.success || !uploadRes.url) {
                console.error("Upload error:", uploadRes.error);
                return { success: false, error: "Failed to upload slip image" };
            }

            publicUrl = uploadRes.url;
        } else {
            transRef = `FREE-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            publicUrl = null;
        }

        // Fetch current authenticated user if any
        const session = await getServerSession().catch(() => null);
        const user = session?.user;

        // If no existing team, create team via API
        if (!finalTeamId) {
            const teamResp = await ApiClient.fetch<any>('/teams', {
                method: 'POST',
                body: JSON.stringify({
                    name: teamName,
                    sport_id: tournament.sport_id,
                    user_id: user?.id || null,
                    description: description || '',
                    logo_img: finalLogoUrl,
                    logo_url: finalLogoUrl,
                    contact_name: contactName,
                    contact_phone: contactPhone,
                    contact_email: contactEmail || user?.email || '',
                    is_roster_locked: false,
                })
            });

            if (!teamResp || !teamResp.id) {
                return { success: false, error: "Failed to create team record" };
            }
            finalTeamId = teamResp.id;
        }

        // Register team in tournament
        const regResp = await ApiClient.fetch<any>(`/tournaments/${tournamentId}/registrations`, {
            method: 'POST',
            body: JSON.stringify({
                tournament_id: tournamentId,
                category_id: tournamentCategory.id,
                tournament_category_id: tournamentCategory.id,
                team_id: finalTeamId,
                status: 'pending',
                payment_status: isFree ? 'paid' : 'pending',
                registration_status: 'pending',
                roster_status: 'pending',
                slip_img: publicUrl,
                contact_name: contactName,
                contact_phone: contactPhone,
                contact_email: contactEmail || user?.email || '',
                remark: transRef || null,
            })
        });

        // Automatically populate players into tournament_roster_submissions table
        if (finalTeamId) {
            try {
                let ttId = regResp?.id || regResp?.data?.id;
                if (!ttId) {
                    try {
                        const checkRes = await ApiClient.fetch<any[]>(`/tournaments/${tournamentId}/teams`);
                        const found = (Array.isArray(checkRes) ? checkRes : []).find((t: any) => t.team_id === finalTeamId || t.id === finalTeamId);
                        if (found) {
                            ttId = found.id;
                        }
                    } catch {
                        // ignore
                    }
                }

                if (ttId) {
                    await populateTournamentRosterSubmissionsFromGlobalTeam(ttId, finalTeamId);
                }
            } catch (popErr) {
                console.error("[registerTeam] Error populating tournament_roster_submissions:", popErr);
            }
        }

        revalidatePath(`/registrations/${tournamentId}`);
        revalidatePath(`/home/registrations/${tournamentId}`);
        revalidatePath(`/dashboard/registrations/${tournamentId}`);
        revalidatePath(`/tournaments/${tournamentId}`);
        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);

        return { success: true, message: "Registration submitted successfully! Please wait for organizer approval." };

    } catch (error: any) {
        console.error("Registration error:", error);
        return { success: false, error: error.message || "An unexpected error occurred" };
    }
}
