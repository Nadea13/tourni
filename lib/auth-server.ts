import { cookies } from "next/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://leagueflow-v80x.onrender.com/api/v1';

export interface ServerAuthUser {
    id: string;
    email: string;
    full_name: string;
    role: string;
    avatar_url?: string | null;
    phone?: string | null;
    is_active: boolean;
}

export async function getServerSession(): Promise<{ user: ServerAuthUser; token: string } | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("tourni_access_token")?.value;
        if (!token) return null;

        const res = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(4000),
        });

        if (!res.ok) return null;

        const user = await res.json();
        return { user, token };
    } catch (err) {
        console.error("Error in getServerSession:", err);
        return null;
    }
}
