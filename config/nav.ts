import { LayoutDashboard, Trophy, Users, Settings, Inbox, LucideIcon, Home, Shield } from "lucide-react"

export interface NavItem {
    titleKey: string
    href: string
    icon: LucideIcon
    adminOnly?: boolean
    openInNewTab?: boolean
}

/**
 * Shared navigation items for dashboard sidebar, header mobile menu, and bottom nav
 * Use `titleKey` with translations: t(item.titleKey)
 */
export const organizerNavItems: NavItem[] = [
    {
        titleKey: "home",
        href: "/home",
        icon: Home,
    },
    {
        titleKey: "leagues",
        href: "/my-tournaments",
        icon: Trophy,
    },
    {
        titleKey: "teams",
        href: "/my-teams",
        icon: Users,
    },
    {
        titleKey: "notifications",
        href: "/inboxes",
        icon: Inbox,
    },
    {
        titleKey: "settings",
        href: "/settings",
        icon: Settings,
    },
    {
        titleKey: "admin",
        href: "/admin",
        icon: Shield,
        adminOnly: true,
        openInNewTab: true,
    },
]

export const teamNavItems: NavItem[] = [
    {
        titleKey: "home",
        href: "/manager/dashboard",
        icon: LayoutDashboard,
    },
    {
        titleKey: "my_teams",
        href: "/manager/my-teams",
        icon: Users,
    },
    {
        titleKey: "leagues",
        href: "/manager/tournaments",
        icon: Trophy,
    },
    {
        titleKey: "my_registrations",
        href: "/manager/my-registrations",
        icon: Trophy,
    },
    {
        titleKey: "settings",
        href: "/manager/settings",
        icon: Settings,
    },
    {
        titleKey: "admin",
        href: "/admin",
        icon: Shield,
        adminOnly: true,
        openInNewTab: true,
    },
]

/**
 * Get nav items based on mode
 */
export function getNavItems(mode: 'organizer' | 'team' = 'organizer', role?: string): NavItem[] {
    const isSuperAdmin = role === 'super_admin' || role === 'admin';
    const baseItems = mode === 'team' ? [...teamNavItems] : [...organizerNavItems];
    return baseItems.filter(item => !item.adminOnly || isSuperAdmin);
}
