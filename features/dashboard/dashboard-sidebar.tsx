"use client"

import { useState, useEffect } from "react"
import { Link, usePathname } from "@/i18n/routing"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"
import { getNavItems } from "@/config/nav"
import { useAnalytics } from "@/hooks/use-analytics"
import { getPendingInvites } from "@/actions/tournaments/staff"

import { FeedbackDialog } from "@/features/dialogs"
import { UserDropdown } from "@/features/dashboard/user-dropdown"
import { BecomeOrganizerDialog } from "@/features/dialogs"
import { BecomeTeamManagerDialog } from "@/features/dialogs"
import { Logo, BrandText } from "@/components/shared/logo"

export function DashboardSidebar({ 
    className, 
    role, 
    isOrganizer = false, 
    isTeamManager = false, 
    userEmail, 
    userName,
    userAvatar
}: { 
    className?: string, 
    role?: string, 
    isOrganizer?: boolean, 
    isTeamManager?: boolean, 
    forcedMode?: 'organizer' | 'team', 
    userEmail?: string, 
    userName?: string | null,
    userAvatar?: string
}) {
    const pathname = usePathname()
    const t = useTranslations("Nav")
    const { trackClick } = useAnalytics()
    const [hasUnread, setHasUnread] = useState(false)
    const [showOrganizerDialog, setShowOrganizerDialog] = useState(false)
    const [showManagerDialog, setShowManagerDialog] = useState(false)

    useEffect(() => {
        const fetchPending = async () => {
            let pCount = 0;
            let iCount = 0;

            const res = await getPendingInvites();
            if (res.success && res.data) {
                pCount = res.data.length;
            }

            try {
                const { getPendingInboxCount } = await import("@/actions/tournaments/registration");
                const inboxRes = await getPendingInboxCount();
                if (inboxRes.success && inboxRes.data !== undefined) {
                    iCount = inboxRes.data;
                }
            } catch (err) {
                console.error("Failed to fetch pending inbox count:", err);
            }

            const total = pCount + iCount;
            const ackCountStr = localStorage.getItem("acknowledgedNotificationsCount");
            const ackCount = ackCountStr ? parseInt(ackCountStr, 10) : 0;

            if (pathname === "/dashboard/inboxes" || pathname === "/dashboard/notifications") {
                localStorage.setItem("acknowledgedNotificationsCount", String(total));
                setHasUnread(false);
            } else {
                setHasUnread(total > ackCount);
            }
        };
        fetchPending();

        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                fetchPending();
            }
        }, 30000);

        const handleFocus = () => {
            fetchPending();
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, [pathname]);

    const mode = 'organizer'
    const navItems = getNavItems(mode, role)

    return (
        <div className={cn("flex h-full max-h-screen flex-col gap-0 fixed md:w-[64px] hover:md:w-[200px] hover:lg:w-[220px] bg-card border-r z-50 transition-all duration-300 ease-in-out group/sidebar overflow-hidden shadow-lg", className)}>
            <div className="flex items-center justify-center md:justify-start p-4">
                <Link href="/dashboard" className="flex items-center gap-0 md:group-hover/sidebar:gap-3 transition-all duration-300 ease-in-out group shrink-0">
                    <div className="relative shrink-0">
                        <Logo className="w-8 h-8 transition-all duration-300 ease-in-out" color="#00C49A" />
                    </div>
                    <div className="flex flex-col transition-all duration-300 ease-in-out opacity-100 w-auto md:opacity-0 md:w-0 md:group-hover/sidebar:opacity-100 md:group-hover/sidebar:w-auto overflow-hidden">
                        <BrandText className="text-xl whitespace-nowrap" />
                    </div>
                </Link>
            </div>

            <nav className="grid items-start px-4" id="tour-sidebar-nav">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            target={item.openInNewTab ? "_blank" : undefined}
                            rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                            onClick={(e) => {
                                if (item.href === "/dashboard/tournaments" && !isOrganizer) {
                                    e.preventDefault();
                                    setShowOrganizerDialog(true);
                                    return;
                                }
                                if (item.href === "/dashboard/teams" && !isTeamManager) {
                                    e.preventDefault();
                                    setShowManagerDialog(true);
                                    return;
                                }
                                trackClick('NAV_ITEM', 'navigation', { target: item.href });
                            }}
                            className={cn(
                                "flex items-center gap-0 md:group-hover/sidebar:gap-2 p-2 rounded-sm transition-all duration-300 ease-in-out relative group tracking-wide justify-center md:justify-start",
                                isActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:text-primary"
                            )}
                        >
                            <item.icon className={cn("h-4 w-4 shrink-0 transition-all duration-300 ease-in-out group-hover:text-primary", isActive ? "text-primary" : "text-muted-foreground")} />
                            <span className="text-sm font-medium whitespace-nowrap transition-all duration-300 ease-in-out opacity-100 w-auto md:opacity-0 md:w-0 md:group-hover/sidebar:opacity-100 md:group-hover/sidebar:w-auto overflow-hidden">{t(item.titleKey)}</span>
                            {item.titleKey === "notifications" && hasUnread && (
                                <span className="absolute right-1 top-1.5 h-2 w-2 rounded-full bg-destructive transition-opacity duration-300 ease-in-out" />
                            )}
                        </Link>
                    );
                })}
            </nav>
            <div className="mt-auto">
                <div className="p-4 border-t">
                    <FeedbackDialog />
                </div>
                <div className="p-4 border-t">
                    <UserDropdown 
                        email={userEmail} 
                        name={userName} 
                        avatar={userAvatar} 
                        role={role}
                        side="right" 
                        align="end" 
                        sideOffset={16} 
                    />
                </div>
            </div>

            <BecomeOrganizerDialog 
                open={showOrganizerDialog}
                onOpenChange={setShowOrganizerDialog}
            />
            <BecomeTeamManagerDialog
                open={showManagerDialog}
                onOpenChange={setShowManagerDialog}
            />
        </div>
    )
}

