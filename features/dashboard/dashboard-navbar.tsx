"use client"

import { Link, usePathname } from "@/i18n/routing"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"
import { UserDropdown } from "@/features/dashboard/user-dropdown"
import { useState } from "react"
import { getNavItems } from "@/config/nav"

import { BecomeOrganizerDialog } from "@/features/dialogs"
import { BecomeTeamManagerDialog } from "@/features/dialogs"
import { BrandLogo } from "@/components/shared/logo"

interface DashboardNavbarProps {
    userEmail?: string
    userName?: string | null
    userAvatar?: string
    role?: string
    isOrganizer?: boolean
    isTeamManager?: boolean
    forcedMode?: 'organizer' | 'team'
    className?: string
}

export function DashboardNavbar({
    userEmail,
    userName,
    userAvatar,
    role,
    isOrganizer = false,
    isTeamManager = false,
    className
}: DashboardNavbarProps) {
    const pathname = usePathname()
    const t = useTranslations("Nav")
    const [showOrganizerDialog, setShowOrganizerDialog] = useState(false)
    const [showManagerDialog, setShowManagerDialog] = useState(false)

    const mode = 'organizer'
    const navItems = getNavItems(mode, role)

    return (
        <>
            {/* Mobile Bottom Navigation Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex justify-around py-1.5 items-center px-2 shadow-lg">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/home" && item.href !== "/dashboard" && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            target={item.openInNewTab ? "_blank" : undefined}
                            rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                            onClick={(e) => {
                                if ((item.href === "/my-tournaments" || item.href === "/dashboard/tournaments") && !isOrganizer) {
                                    e.preventDefault();
                                    setShowOrganizerDialog(true);
                                    return;
                                }
                                if ((item.href === "/my-teams" || item.href === "/dashboard/teams") && !isTeamManager) {
                                    e.preventDefault();
                                    setShowManagerDialog(true);
                                    return;
                                }
                            }}
                            className={cn(
                                "flex flex-col items-center gap-1 py-1 px-3 rounded-sm transition-all active:scale-95",
                                isActive ? "text-primary" : "text-muted-foreground/60 hover:text-primary"
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            <span className="text-[10px] font-bold tracking-tight">{t(item.titleKey)}</span>
                        </Link>
                    );
                })}
            </div>

            {/* Mobile Top Header / Desktop Navbar Header */}
            <header className={cn("sticky top-0 z-40 flex h-14 md:h-20 items-center justify-between border-b bg-card backdrop-blur-xl px-2 w-full", className)}>
                <div className="flex items-center gap-1 md:gap-2">
                    <BrandLogo 
                        href="/home" 
                        size="sm"
                        className="transition-transform group"
                        iconClassName="w-7 h-7 md:w-8 md:h-8"
                        textClassName="text-base md:text-lg"
                    />
                </div>
                <div className="flex items-center">
                    <UserDropdown email={userEmail} name={userName} avatar={userAvatar} role={role} className="border-none hover:bg-transparent p-0" hideText />
                </div>

                <BecomeOrganizerDialog
                    open={showOrganizerDialog}
                    onOpenChange={setShowOrganizerDialog}
                />
                <BecomeTeamManagerDialog
                    open={showManagerDialog}
                    onOpenChange={setShowManagerDialog}
                />
            </header>
        </>
    )
}

