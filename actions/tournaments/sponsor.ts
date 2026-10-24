"use server";

import { revalidatePath } from "next/cache";
import { ActionResponse } from "@/types/index";
import { uploadToR2 } from "@/lib/r2";
import { getServerSession } from "@/lib/auth-server";

export interface Sponsor {
    id: string;
    tournament_id: string;
    sponsor_name: string;
    logo_img: string;
    cover_url?: string | null;
    link_url: string | null;
    order_index: number;
    created_at: string;
    updated_at?: string;
}

export async function getSponsors(tournamentId: string): Promise<ActionResponse<Sponsor[]>> {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/sponsors`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to fetch sponsors" };
        }

        const sponsors = await res.json();
        return { success: true, data: sponsors as Sponsor[] };
    } catch (error) {
        console.error("Unexpected error in getSponsors:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function addSponsor(
    tournamentId: string,
    sponsorName: string,
    logoImgOrFile: string | File | FormData,
    linkUrl?: string,
    orderIndex?: number,
    coverImgOrFile?: string | File
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        let finalLogoUrl = "";
        let finalCoverUrl: string | null = null;
        let finalSponsorName = sponsorName;
        let finalLinkUrl = linkUrl;
        const finalOrderIndex = orderIndex || 0;

        if (typeof FormData !== "undefined" && logoImgOrFile instanceof FormData) {
            finalSponsorName = (logoImgOrFile.get("sponsorName") as string) || sponsorName;
            finalLinkUrl = (logoImgOrFile.get("linkUrl") as string) || linkUrl;
            
            // Logo
            const logoFile = logoImgOrFile.get("logoFile") as File;
            if (logoFile && logoFile instanceof File && logoFile.size > 0) {
                const fileExt = logoFile.name.split('.').pop() || 'png';
                const fileName = `sponsors/${tournamentId}/${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                const uploadRes = await uploadToR2(logoFile, fileName, logoFile.type);
                if (uploadRes.success && uploadRes.url) {
                    finalLogoUrl = uploadRes.url;
                }
            } else {
                finalLogoUrl = (logoImgOrFile.get("logoUrl") as string) || "";
            }

            // Cover
            const coverFile = logoImgOrFile.get("coverFile") as File;
            if (coverFile && coverFile instanceof File && coverFile.size > 0) {
                const fileExt = coverFile.name.split('.').pop() || 'png';
                const fileName = `sponsors/${tournamentId}/covers/${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                const uploadRes = await uploadToR2(coverFile, fileName, coverFile.type);
                if (uploadRes.success && uploadRes.url) {
                    finalCoverUrl = uploadRes.url;
                }
            } else {
                const cUrl = logoImgOrFile.get("coverUrl") as string;
                if (cUrl) finalCoverUrl = cUrl;
            }
        } else {
            if (typeof File !== "undefined" && logoImgOrFile instanceof File) {
                const fileExt = logoImgOrFile.name.split('.').pop() || 'png';
                const fileName = `sponsors/${tournamentId}/${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                const uploadRes = await uploadToR2(logoImgOrFile, fileName, logoImgOrFile.type);
                if (uploadRes.success && uploadRes.url) {
                    finalLogoUrl = uploadRes.url;
                }
            } else if (typeof logoImgOrFile === "string") {
                finalLogoUrl = logoImgOrFile;
            }

            if (coverImgOrFile) {
                if (typeof File !== "undefined" && coverImgOrFile instanceof File) {
                    const fileExt = coverImgOrFile.name.split('.').pop() || 'png';
                    const fileName = `sponsors/${tournamentId}/covers/${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                    const uploadRes = await uploadToR2(coverImgOrFile, fileName, coverImgOrFile.type);
                    if (uploadRes.success && uploadRes.url) {
                        finalCoverUrl = uploadRes.url;
                    }
                } else if (typeof coverImgOrFile === "string") {
                    finalCoverUrl = coverImgOrFile;
                }
            }
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/sponsors`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                tournament_id: tournamentId,
                sponsor_name: finalSponsorName,
                logo_img: finalLogoUrl,
                cover_url: finalCoverUrl || null,
                link_url: finalLinkUrl || null,
                order_index: finalOrderIndex,
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to add sponsor" };
        }

        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        return { success: true };
    } catch (error) {
        console.error("Unexpected error in addSponsor:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function updateSponsorsOrder(
    tournamentId: string,
    _sponsors: { id: string; order_index: number }[]
): Promise<ActionResponse> {
    try {
        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        return { success: true };
    } catch (error) {
        console.error("Unexpected error in updateSponsorsOrder:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function updateSponsor(
    sponsorId: string,
    tournamentId: string,
    sponsorName: string,
    logoImgOrFile: string | File | FormData,
    linkUrl?: string,
    coverImgOrFile?: string | File
): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        let finalLogoUrl = "";
        let finalCoverUrl: string | null = null;
        let finalSponsorName = sponsorName;
        let finalLinkUrl = linkUrl;

        if (typeof FormData !== "undefined" && logoImgOrFile instanceof FormData) {
            finalSponsorName = (logoImgOrFile.get("sponsorName") as string) || sponsorName;
            finalLinkUrl = (logoImgOrFile.get("linkUrl") as string) || linkUrl;

            // Logo
            const logoFile = logoImgOrFile.get("logoFile") as File;
            if (logoFile && logoFile instanceof File && logoFile.size > 0) {
                const fileExt = logoFile.name.split('.').pop() || 'png';
                const fileName = `sponsors/${tournamentId}/${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                const uploadRes = await uploadToR2(logoFile, fileName, logoFile.type);
                if (uploadRes.success && uploadRes.url) {
                    finalLogoUrl = uploadRes.url;
                }
            } else {
                finalLogoUrl = (logoImgOrFile.get("logoUrl") as string) || "";
            }

            // Cover
            const coverFile = logoImgOrFile.get("coverFile") as File;
            if (coverFile && coverFile instanceof File && coverFile.size > 0) {
                const fileExt = coverFile.name.split('.').pop() || 'png';
                const fileName = `sponsors/${tournamentId}/covers/${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                const uploadRes = await uploadToR2(coverFile, fileName, coverFile.type);
                if (uploadRes.success && uploadRes.url) {
                    finalCoverUrl = uploadRes.url;
                }
            } else {
                const cUrl = logoImgOrFile.get("coverUrl") as string;
                finalCoverUrl = cUrl || null;
            }
        } else {
            if (typeof File !== "undefined" && logoImgOrFile instanceof File) {
                const fileExt = logoImgOrFile.name.split('.').pop() || 'png';
                const fileName = `sponsors/${tournamentId}/${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                const uploadRes = await uploadToR2(logoImgOrFile, fileName, logoImgOrFile.type);
                if (uploadRes.success && uploadRes.url) {
                    finalLogoUrl = uploadRes.url;
                }
            } else if (typeof logoImgOrFile === "string") {
                finalLogoUrl = logoImgOrFile;
            }

            if (coverImgOrFile !== undefined) {
                if (typeof File !== "undefined" && coverImgOrFile instanceof File) {
                    const fileExt = coverImgOrFile.name.split('.').pop() || 'png';
                    const fileName = `sponsors/${tournamentId}/covers/${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                    const uploadRes = await uploadToR2(coverImgOrFile, fileName, coverImgOrFile.type);
                    if (uploadRes.success && uploadRes.url) {
                        finalCoverUrl = uploadRes.url;
                    }
                } else if (typeof coverImgOrFile === "string") {
                    finalCoverUrl = coverImgOrFile;
                }
            }
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/sponsors/${sponsorId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                sponsor_name: finalSponsorName,
                logo_img: finalLogoUrl,
                cover_url: finalCoverUrl || null,
                link_url: finalLinkUrl || null,
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to update sponsor" };
        }

        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        return { success: true };
    } catch (error) {
        console.error("Unexpected error in updateSponsor:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function deleteSponsor(sponsorId: string, tournamentId: string): Promise<ActionResponse> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/sponsors/${sponsorId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.token}`,
            },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.error || "Failed to delete sponsor" };
        }

        revalidatePath(`/organizer/tournaments/${tournamentId}`);
        revalidatePath(`/my-tournaments/${tournamentId}`);
        revalidatePath(`/dashboard/tournaments/${tournamentId}`);
        return { success: true };
    } catch (error) {
        console.error("Unexpected error in deleteSponsor:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}
