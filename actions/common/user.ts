'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionResponse, Tournament } from "@/types";
import { uploadToR2 } from "@/lib/r2";
import { ApiClient } from "@/lib/api-client";

import { getServerSession } from "@/lib/auth-server";
import { classifyPlayerNames } from "@/lib/name-helper";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

async function getAuthUser() {
    const session = await getServerSession();
    if (session?.user?.id) {
        return {
            id: session.user.id,
            email: session.user.email
        };
    }
    return null;
}

export async function getUserSubscriptionPlan(): Promise<string> {
    const details = await getUserSubscriptionDetails();
    return details.plan;
}

export async function getUserSubscriptionDetails() {
    try {
        const session = await getServerSession();
        if (!session?.user) return { plan: 'free', expiresAt: null };

        if (session.user.role === 'super_admin') {
            return { plan: 'yearly', expiresAt: null };
        }

        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://leagueflow-v80x.onrender.com/api/v1';
        try {
            const res = await fetch(`${API_BASE_URL}/payments?user_id=${session.user.id}`, {
                headers: { Authorization: `Bearer ${session.token}` },
                cache: 'no-store'
            });
            if (res.ok) {
                const data = await res.json();
                const list: any[] = Array.isArray(data) ? data : (data.data || []);
                const paid = list.find((p: any) => p.payment_status === 'completed' || p.payment_status === 'success');
                if (paid && paid.plan_name) {
                    return { plan: paid.plan_name, expiresAt: null };
                }
            }
        } catch {
            // fallback to role
        }

        // Non-paid users default to 'free'
        return { plan: 'free', expiresAt: null };
    } catch {
        return { plan: 'free', expiresAt: null };
    }
}


export async function updateProfile(formData: FormData): Promise<ActionResponse> {
    const fullName = formData.get("fullName") as string;
    const phone = formData.get("phone") as string;
    const avatarFile = formData.get("avatar") as File | null;

    const session = await getServerSession();
    if (!session?.user || !session?.token) {
        return { success: false, error: "Authentication required" };
    }

    let avatarUrl: string | null = (formData.get("existing_avatar_url") as string) || null;

    // Handle avatar upload if provided
    if (avatarFile && avatarFile.size > 0) {
        const fileExt = avatarFile.name.split('.').pop() || 'jpg';
        const fileName = `${session.user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const uploadRes = await uploadToR2(avatarFile, filePath, avatarFile.type);

        if (!uploadRes.success || !uploadRes.url) {
            console.error("Avatar upload error:", uploadRes.error);
            return { success: false, error: "Failed to upload avatar: " + (uploadRes.error || "Unknown error") };
        }

        avatarUrl = uploadRes.url;
    } else if (formData.get("remove_avatar") === "true") {
        avatarUrl = null;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                full_name: fullName,
                phone: phone || null,
                avatar_url: avatarUrl,
            }),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || "Failed to update profile" };
        }

        revalidatePath("/", "layout");
        return { success: true };
    } catch (err: any) {
        console.error("Error updating profile in Go backend:", err);
        return { success: false, error: err.message || "Failed to update profile" };
    }
}

export async function changePassword(formData: FormData): Promise<ActionResponse> {
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!currentPassword || !newPassword) {
        return { success: false, error: "กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่" };
    }

    if (newPassword.length < 8) {
        return { success: false, error: "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร" };
    }

    if (newPassword !== confirmPassword) {
        return { success: false, error: "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน" };
    }

    const session = await getServerSession();
    if (!session?.token) {
        return { success: false, error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };
    }

    try {
        const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword,
            }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { success: false, error: data.error || "ไม่สามารถเปลี่ยนรหัสผ่านได้" };
        }

        return { success: true };
    } catch (err: any) {
        console.error("Error changing password:", err);
        return { success: false, error: err.message || "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน" };
    }
}


export async function deleteAccount() {
    const user = await getAuthUser();

    if (!user) return;
    redirect("/");
}

export async function getMasterPlayer() {
    const user = await getAuthUser();
    if (!user) return null;

    try {
        const session = await getServerSession();
        const res = await fetch(`${API_BASE_URL}/master-players?user_id=${user.id}`, {
            headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
            cache: 'no-store'
        });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                return data[0];
            }
        }
    } catch (err) {
        console.error("Error fetching master player profile:", err);
    }
    return null;
}

export async function createMasterPlayer(formData: FormData): Promise<ActionResponse> {
    try {
        const user = await getAuthUser();
        const session = await getServerSession();

        if (!user || !session) {
            return { success: false, error: "Authentication required" };
        }

        const firstNameTh = formData.get("firstNameTh") as string || null;
        const middleNameTh = formData.get("middleNameTh") as string || null;
        const lastNameTh = formData.get("lastNameTh") as string || null;
        const firstNameEn = formData.get("firstNameEn") as string || null;
        const middleNameEn = formData.get("middleNameEn") as string || null;
        const lastNameEn = formData.get("lastNameEn") as string || null;
        const gender = formData.get("gender") as string;
        const birthday = formData.get("birthday") as string;
        const tel = formData.get("tel") as string;
        const favoriteSportId = formData.get("favoriteSportId") as string || null;
        const preferredHand = formData.get("preferredHand") as string || null;
        const preferredFoot = formData.get("preferredFoot") as string || null;

        const classified = classifyPlayerNames({
            first_name_local: firstNameTh || null,
            middle_name_local: middleNameTh || null,
            last_name_local: lastNameTh || null,
            first_name_intl: firstNameEn || null,
            middle_name_intl: middleNameEn || null,
            last_name_intl: lastNameEn || null,
        });

        const res = await fetch(`${API_BASE_URL}/master-players`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                user_id: user.id,
                first_name_local: classified.first_name_local,
                middle_name_local: classified.middle_name_local,
                last_name_local: classified.last_name_local,
                first_name_intl: classified.first_name_intl,
                middle_name_intl: classified.middle_name_intl,
                last_name_intl: classified.last_name_intl,
                gender,
                birthday,
                tel,
                favorite_sport_id: favoriteSportId,
                preferred_hand: preferredHand,
                preferred_foot: preferredFoot,
                status: 'active',
                verified: true
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to create player profile" };
        }

        const data = await res.json();
        revalidatePath("/", "layout");
        return { success: true, data };
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "Failed to create master player profile";
        return { success: false, error: errorMessage };
    }
}

export async function getAllPublicTournaments(): Promise<Tournament[]> {
    try {
        const resp = await ApiClient.fetch<{ data: any[] }>('/tournaments');
        const tournaments = resp.data || [];

        return tournaments
            .map((t: any) => {
                const settings = t.settings || {};
                let isRegOpen = true;
                if (settings.is_registration_open === false || settings.is_registration_open === "false" || t.is_registration_open === false) {
                    isRegOpen = false;
                } else if (settings.is_registration_open === true || settings.is_registration_open === "true" || t.is_registration_open === true) {
                    isRegOpen = true;
                } else {
                    isRegOpen = t.status === "registration_open" || t.status === "published" || t.status === "draft" || t.status === "upcoming";
                }

                return {
                    id: t.id,
                    name: t.name,
                    logo_img: t.logo_url || null,
                    cover_img: t.banner_url || null,
                    description: t.description || null,
                    location_name: t.location || null,
                    google_map_url: settings.google_map_url || null,
                    status: t.status,
                    is_registration_open: isRegOpen,
                    sport: (t.sport_name || settings.sport_name || 'football').toLowerCase(),
                    sport_name: t.sport_name || settings.sport_name || undefined,
                    sport_id: t.sport_id || settings.sport_id || undefined,
                    start_date: t.start_date,
                    end_date: t.end_date,
                    document_deadline: t.document_deadline || settings.document_deadline || null,
                    bank_name: settings.bank_name || null,
                    bank_account_name: settings.bank_account_name || null,
                    bank_account_number: settings.bank_account_number || null,
                    registration_fee: 0,
                    settings: {
                        ...settings,
                        is_registration_open: isRegOpen,
                    },
                };
            })
            .filter((t: any) => t.is_registration_open !== false) as unknown as Tournament[];
    } catch (err) {
        console.error("Error fetching tournaments from Go backend:", err);
        return [];
    }
}

export async function searchMasterPlayers(query: string) {
    try {
        const trimmed = query.trim();
        if (!trimmed) return { success: true, data: [] };

        const session = await getServerSession();
        const res = await fetch(`${API_BASE_URL}/master-players?search=${encodeURIComponent(trimmed)}`, {
            headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
            cache: 'no-store'
        });

        if (res.ok) {
            const data = await res.json();
            return { success: true, data: Array.isArray(data) ? data : [] };
        }

        return { success: true, data: [] };
    } catch (err) {
        console.error("Error searching master players:", err);
        return { success: true, data: [] };
    }
}

export async function claimMasterPlayer(masterPlayerId: string): Promise<ActionResponse> {
    try {
        const user = await getAuthUser();
        const session = await getServerSession();

        if (!user || !session) {
            return { success: false, error: "Authentication required" };
        }

        const res = await fetch(`${API_BASE_URL}/master-players/${masterPlayerId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                user_id: user.id,
                verified: false,
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to claim master player profile" };
        }

        const updatedPlayer = await res.json();
        revalidatePath("/", "layout");
        return { success: true, data: updatedPlayer };
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "Failed to claim master player profile";
        return { success: false, error: errorMessage };
    }
}

export async function registerAsOrganizer(): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session?.token) {
            return { success: false, error: "Authentication required" };
        }

        const res = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                role: 'organizer',
                is_organizer: true,
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to register as organizer" };
        }

        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: (error as Error).message };
    }
}

export async function registerAsTeamManager(): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session?.token) {
            return { success: false, error: "Authentication required" };
        }

        const res = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                is_team_manager: true,
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to register as team manager" };
        }

        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: (error as Error).message };
    }
}

export async function getMasterPlayerStats(_masterPlayerId: string): Promise<ActionResponse<{
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    saves: number;
    injuries: number;
    history: {
        tournamentName: string;
        teamName: string;
        goals: number;
        assists: number;
        yellowCards: number;
        redCards: number;
        saves: number;
        injuries: number;
    }[];
}>> {
    return {
        success: true,
        data: {
            goals: 0,
            assists: 0,
            yellowCards: 0,
            redCards: 0,
            saves: 0,
            injuries: 0,
            history: []
        }
    };
}


