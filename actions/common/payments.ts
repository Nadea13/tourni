'use server'

import { getServerSession } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import { ActionResponse, Payment, Tournament } from "@/types";
import { uploadToR2 } from "@/lib/r2";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://leagueflow-v80x.onrender.com/api/v1';

export async function getUserPayments(): Promise<ActionResponse<Payment[]>> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        const res = await fetch(`${API_BASE_URL}/payments?user_id=${session.user.id}`, {
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            return { success: false, error: "Failed to fetch payments" };
        }

        const data = await res.json();
        const paymentsList: any[] = Array.isArray(data) ? data : (data.data || []);

        const mappedData: Payment[] = paymentsList.map(item => {
            const createdAt = new Date(item.created_at);
            let subscriptionExpiresAt = null;
            if (item.plan_name === "monthly" || item.plan_name === "pro" || item.plan_name === "manager_pro" || item.plan_name === "cup" || item.plan_name === "tournament" || item.plan_name === "event") {
                const expires = new Date(createdAt);
                expires.setMonth(expires.getMonth() + 1);
                subscriptionExpiresAt = expires.toISOString();
            } else if (item.plan_name === "yearly" || item.plan_name === "pro_yearly" || item.plan_name === "cup_yearly" || item.plan_name === "tournament_yearly") {
                const expires = new Date(createdAt);
                expires.setFullYear(expires.getFullYear() + 1);
                subscriptionExpiresAt = expires.toISOString();
            }

            return {
                id: item.id,
                amount: Number(item.amount),
                status: item.payment_status,
                payment_method: item.payment_method || "",
                plan: item.plan_name,
                created_at: item.created_at,
                tournament_id: item.tournament_id,
                provider_id: item.transaction_id,
                subscription_expires_at: subscriptionExpiresAt,
                slip_url: (item.raw_gateway_response as Record<string, unknown>)?.slip_url as string || null
            };
        });

        return { success: true, data: mappedData };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : "Failed to fetch payments",
        };
    }
}

export async function getUserTournaments(): Promise<ActionResponse<Tournament[]>> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        const res = await fetch(`${API_BASE_URL}/tournaments?organizer_id=${session.user.id}`, {
            headers: {
                Authorization: `Bearer ${session.token}`,
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            return { success: false, error: "Failed to fetch tournaments" };
        }

        const data = await res.json();
        return { success: true, data: Array.isArray(data) ? data : (data.data || []) };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : "Failed to fetch tournaments",
        };
    }
}

export async function createPaymentRecord(
    planId: string,
    amount: number,
    paymentMethod: string,
    tournamentId?: string | null
): Promise<ActionResponse<Payment>> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }

        const providerId = amount === 0 
            ? `LF_FREE_${Math.random().toString(36).substring(2, 10).toUpperCase()}`
            : `LF_TXN_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        const res = await fetch(`${API_BASE_URL}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                user_id: session.user.id,
                tournament_id: tournamentId || null,
                amount,
                payment_status: amount === 0 ? "completed" : "pending",
                payment_method: paymentMethod,
                plan_name: planId,
                transaction_id: providerId,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("Error creating payment in backend:", errText);
            return { success: false, error: "Failed to record payment: " + errText };
        }

        const paymentData = await res.json();

        // Revalidate layout and settings paths
        revalidatePath("/", "layout");
        revalidatePath("/[locale]/dashboard", "layout");
        revalidatePath("/settings", "page");
        revalidatePath("/dashboard/settings", "page");
        if (tournamentId) {
            revalidatePath(`/my-tournaments/${tournamentId}`, "layout");
            revalidatePath(`/dashboard/tournaments/${tournamentId}`, "layout");
        }

        // Map database model to expected Payment interface
        const createdAt = new Date(paymentData.created_at);
        let subscriptionExpiresAt = null;
        if (paymentData.plan_name === "monthly" || paymentData.plan_name === "pro" || paymentData.plan_name === "manager_pro" || paymentData.plan_name === "cup" || paymentData.plan_name === "tournament" || paymentData.plan_name === "event") {
            const expires = new Date(createdAt);
            expires.setMonth(expires.getMonth() + 1);
            subscriptionExpiresAt = expires.toISOString();
        } else if (paymentData.plan_name === "yearly" || paymentData.plan_name === "pro_yearly" || paymentData.plan_name === "cup_yearly" || paymentData.plan_name === "tournament_yearly") {
            const expires = new Date(createdAt);
            expires.setFullYear(expires.getFullYear() + 1);
            subscriptionExpiresAt = expires.toISOString();
        }

        const mappedPayment: Payment = {
            id: paymentData.id,
            amount: Number(paymentData.amount),
            status: paymentData.payment_status,
            payment_method: paymentData.payment_method || "",
            plan: paymentData.plan_name,
            created_at: paymentData.created_at,
            tournament_id: paymentData.tournament_id,
            provider_id: paymentData.transaction_id,
            subscription_expires_at: subscriptionExpiresAt,
            slip_url: (paymentData.raw_gateway_response as Record<string, unknown>)?.slip_url as string || null
        };

        return { success: true, data: mappedPayment };
    } catch (e) {
        console.error("Error in createPaymentRecordServerAction:", e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Failed to process payment",
        };
    }
}

export async function createPaymentRecordWithSlip(formData: FormData): Promise<ActionResponse<Payment>> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }
        const user = session.user;

        const planId = formData.get("planId") as string;
        const amount = Number(formData.get("amount"));
        const paymentMethod = formData.get("paymentMethod") as string;
        const tournamentId = formData.get("tournamentId") as string | null;
        const slipFile = formData.get("slipFile") as File | null;

        let slipUrl: string | null = null;

        if (slipFile && slipFile instanceof File) {
            if (slipFile.size > 5 * 1024 * 1024) {
                return { success: false, error: "File size must be less than 5MB" };
            }
            if (!slipFile.type.startsWith("image/")) {
                return { success: false, error: "File must be an image" };
            }

            const fileExt = slipFile.name.split('.').pop() || 'jpg';
            const fileName = `slips/subscriptions/${user.id}_${Date.now()}.${fileExt}`;
            const uploadRes = await uploadToR2(slipFile, fileName, slipFile.type);

            if (!uploadRes.success || !uploadRes.url) {
                console.error("Upload error:", uploadRes.error);
                return { success: false, error: "Failed to upload slip image: " + (uploadRes.error || "Unknown error") };
            }

            slipUrl = uploadRes.url;
        }

        const providerId = `LF_TXN_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        const res = await fetch(`${API_BASE_URL}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                user_id: user.id,
                tournament_id: tournamentId || null,
                amount,
                payment_status: "pending",
                payment_method: paymentMethod,
                plan_name: planId,
                transaction_id: providerId,
                raw_gateway_response: slipUrl ? { slip_url: slipUrl } : {},
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("Error creating slip payment in backend:", errText);
            return { success: false, error: "Failed to record payment: " + errText };
        }

        const paymentData = await res.json();

        // Map database model to expected Payment interface
        const subscriptionExpiresAt = null;

        const mappedPayment: Payment = {
            id: paymentData.id,
            amount: Number(paymentData.amount),
            status: paymentData.payment_status,
            payment_method: paymentData.payment_method || "",
            plan: paymentData.plan_name,
            created_at: paymentData.created_at,
            tournament_id: paymentData.tournament_id,
            provider_id: paymentData.transaction_id,
            subscription_expires_at: subscriptionExpiresAt,
            slip_url: (paymentData.raw_gateway_response as Record<string, unknown>)?.slip_url as string || null
        };

        return { success: true, data: mappedPayment };
    } catch (e) {
        console.error("Error in createPaymentRecordWithSlip:", e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Failed to process payment",
        };
    }
}
