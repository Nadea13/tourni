"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { ApiClient, ApiError, UserProfile } from "@/lib/api-client";
import { DashboardSidebar } from "@/features/dashboard/dashboard-sidebar";
import { DashboardNavbar } from "@/features/dashboard/dashboard-navbar";

function parseJwt(token: string): { user_id?: string; email?: string; role?: string; exp?: number } | null {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [_isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Fast sync from cache immediately after mount to avoid SSR hydration mismatch
        const cached = ApiClient.getCachedProfile();
        if (cached) {
            setUser(cached);
            setIsLoading(false);
        }

        const fetchUserProfile = async () => {
            try {
                const token = ApiClient.getToken();
                if (!token) {
                    setIsLoading(false);
                    router.push('/sign-in');
                    return;
                }

                // Check client-side JWT expiration (7 days)
                const claims = parseJwt(token);
                if (claims?.exp && claims.exp * 1000 < Date.now()) {
                    console.warn("Access token expired");
                    ApiClient.setToken(null);
                    router.push('/sign-in');
                    return;
                }

                // Populate fast fallback profile from JWT claims if not yet set
                if (!user && claims && claims.email) {
                    const email = claims.email;
                    setUser((prev) => prev || {
                        id: claims.user_id || '',
                        email: email,
                        full_name: email.split('@')[0],
                        role: claims.role || 'organizer',
                    });
                }

                const profile = await ApiClient.getUserProfile();
                if (profile) {
                    setUser(profile);
                }
            } catch (err: unknown) {
                const isAuthError =
                    err instanceof ApiError
                        ? err.isUnauthorized
                        : (err as any)?.status === 401 || (err as any)?.status === 403;
                const isRateLimited =
                    err instanceof ApiError
                        ? err.isRateLimited
                        : (err as any)?.status === 429;

                // Only wipe session and kick out if server explicitly returned 401/403
                if (isAuthError) {
                    ApiClient.setToken(null);
                    router.push('/sign-in');
                } else if (isRateLimited) {
                    console.warn("User profile fetch throttled (429); preserving current active session.");
                } else {
                    // For temporary network glitches, 502 Bad Gateway (Render cold start), do NOT destroy user session
                    console.warn("Backend unavailable or spinning up; preserving current session.");
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserProfile();
    }, [router]);

    const userRole = user?.role || 'organizer';
    const isOrganizer = user?.role === 'organizer' || user?.role === 'super_admin';
    const isTeamManager = true;
    const userName = user?.full_name || (user?.email ? user.email.split('@')[0] : "");
    const userEmail = user?.email || "";
    const userAvatar = user?.avatar_url || undefined;

    return (
        <div className="min-h-screen w-full md:grid md:grid-cols-[64px_1fr]">
            <div className="border-r bg-muted/40 hidden md:block">
                <div className="flex h-full min-h-screen flex-col gap-2">
                    <DashboardSidebar
                        role={userRole}
                        isOrganizer={isOrganizer}
                        isTeamManager={isTeamManager}
                        forcedMode="organizer"
                        userEmail={userEmail}
                        userName={userName}
                        userAvatar={userAvatar}
                    />
                </div>
            </div>
            <div className="flex flex-col min-w-0 min-h-screen">
                <DashboardNavbar
                    userEmail={userEmail}
                    userName={userName}
                    userAvatar={userAvatar}
                    role={userRole}
                    isOrganizer={isOrganizer}
                    isTeamManager={isTeamManager}
                    forcedMode="organizer"
                    className="md:hidden"
                />
                <main className="flex-1 p-2 md:p-4 pb-17 md:pb-4">
                    {children}
                </main>
            </div>
        </div>
    );
}
