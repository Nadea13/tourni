"use client"

import { useState, useEffect } from "react"
import { Link } from "@/i18n/routing"
import { useTheme } from "next-themes"
import { Laptop, Moon, Sun, LogOut, User, CreditCard, Shield } from "lucide-react"
import {
    ActionMenu,
    ActionMenuContent,
    ActionMenuGroup,
    ActionMenuItem,
    ActionMenuLabel,
    ActionMenuPortal,
    ActionMenuSeparator,
    ActionMenuSub,
    ActionMenuSubContent,
    ActionMenuSubTrigger,
    ActionMenuTrigger,
} from "@/components/ui/action-menu"
import Image from "next/image"
import { LanguageSubMenu } from "@/components/layout/language-sub-menu"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ApiClient } from "@/lib/api-client"

export function UserDropdown({
    email,
    name,
    avatar,
    role,
    className,
    side = "bottom",
    align = "end",
    sideOffset = 8,
    alignOffset = 0,
    hideText = false
}: {
    email: string | undefined,
    name?: string | null,
    avatar?: string,
    role?: string,
    className?: string,
    side?: "top" | "right" | "bottom" | "left",
    align?: "start" | "center" | "end",
    sideOffset?: number,
    alignOffset?: number,
    hideText?: boolean
}) {
    const { setTheme } = useTheme()
    const locale = useLocale()
    const t = useTranslations("Nav")
    const tCommon = useTranslations("Common")
    const tSettings = useTranslations("DashboardSettings")

    const profileHref = '/dashboard/settings'
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const effectiveName = mounted ? name : undefined
    const effectiveEmail = mounted ? email : undefined
    const effectiveAvatar = mounted ? avatar : undefined
    const displayName = effectiveName || (effectiveEmail ? effectiveEmail.split('@')[0] : "");

    return (
        <ActionMenu>
            <ActionMenuTrigger asChild>
                <Button suppressHydrationWarning variant="ghost" size="lg" className={cn("w-full justify-center md:justify-start md:group-hover/sidebar:justify-start p-0 md:py-2 md:group-hover/sidebar:p-2 h-auto transition-all duration-300 ease-in-out text-left overflow-hidden", className)}>
                    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-muted/10 text-muted-foreground/60 shrink-0 transition-all duration-300 ease-in-out">
                        {effectiveAvatar ? (
                            <Image
                                src={effectiveAvatar}
                                alt={displayName || "User"}
                                width={36}
                                height={36}
                                className="h-full w-full object-cover rounded-full"
                            />
                        ) : displayName ? (
                            <span className="text-xs font-bold">{displayName.slice(0, 2).toUpperCase()}</span>
                        ) : (
                            <User className="h-4 w-4" />
                        )}
                    </div>
                    {!hideText && (
                        <div className="flex flex-col min-w-0 transition-all duration-300 ease-in-out opacity-100 w-auto md:opacity-0 md:w-0 md:group-hover/sidebar:opacity-100 md:group-hover/sidebar:w-auto md:group-hover/sidebar:ml-2 overflow-hidden">
                            <span className="text-xs font-bold text-foreground truncate">{displayName || "..."}</span>
                            {effectiveEmail && <span className="text-[10px] text-muted-foreground truncate">{effectiveEmail}</span>}
                        </div>
                    )}
                </Button>
            </ActionMenuTrigger>
            <ActionMenuContent
                className="w-64 bg-card border shadow-2xl ml-4 mt-3 p-2 rounded-sm"
                side={side}
                align={align}
                sideOffset={sideOffset}
                alignOffset={alignOffset}
            >
                <ActionMenuLabel className="mb-2">
                    <div className="flex flex-col space-y-1">
                        {role && (
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                                {role}
                            </p>
                        )}
                        <p className="text-sm font-medium leading-none text-foreground truncate">
                            {displayName || email}
                        </p>
                        {email && displayName !== email && (
                            <p className="text-xs text-muted-foreground truncate">{email}</p>
                        )}
                    </div>
                </ActionMenuLabel>
                <ActionMenuSeparator className="bg-border" />
                <ActionMenuGroup>
                    <ActionMenuItem asChild className="group hover:text-primary transition-colors cursor-pointer py-2 rounded-sm">
                        <Link href={profileHref} className="w-full flex items-center gap-2 md:gap-3">
                            <User className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                            <span className="text-xs text-muted-foreground font-bold tracking-tight group-hover:text-primary">{t("profile")}</span>
                        </Link>
                    </ActionMenuItem>
                    <ActionMenuItem asChild className="group hover:text-primary transition-colors cursor-pointer py-2 rounded-sm">
                        <Link href="/dashboard/settings?tab=billing" className="w-full flex items-center gap-2 md:gap-3">
                            <CreditCard className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                            <span className="text-xs text-muted-foreground font-bold tracking-tight group-hover:text-primary">{tSettings("billing")}</span>
                        </Link>
                    </ActionMenuItem>
                    {(role === "admin" || role === "super_admin") && (
                        <ActionMenuItem asChild className="group hover:text-primary transition-colors cursor-pointer py-2 rounded-sm">
                            <Link href="/admin" target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-2 md:gap-3">
                                <Shield className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                                <span className="text-xs text-muted-foreground font-bold tracking-tight group-hover:text-primary">{t("admin") || "Admin"}</span>
                            </Link>
                        </ActionMenuItem>
                    )}
                </ActionMenuGroup>
                <ActionMenuSeparator className="bg-border" />
                <LanguageSubMenu />
                <ActionMenuSub>
                    <ActionMenuSubTrigger className="group hover:text-primary transition-colors cursor-pointer py-2 rounded-sm flex items-center gap-2 md:gap-3">
                        <div className="relative flex items-center justify-center h-4 w-4 shrink-0">
                            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-muted-foreground group-hover:text-primary" />
                            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <span className="text-xs text-muted-foreground font-bold tracking-tight group-hover:text-primary">{tCommon("theme")}</span>
                    </ActionMenuSubTrigger>
                    <ActionMenuPortal>
                        <ActionMenuSubContent
                            className="bg-background border border-border min-w-[120px] rounded-sm shadow-xl p-1.5"
                            sideOffset={8}
                        >
                            <ActionMenuItem onClick={() => setTheme("light")} className="focus:bg-muted focus:text-primary text-xs font-bold flex items-center gap-2.5">
                                <Sun className="h-4 w-4 shrink-0" />
                                {tCommon("light")}
                            </ActionMenuItem>
                            <ActionMenuItem onClick={() => setTheme("dark")} className="focus:bg-muted focus:text-primary text-xs font-bold flex items-center gap-2.5">
                                <Moon className="h-4 w-4 shrink-0" />
                                {tCommon("dark")}
                            </ActionMenuItem>
                            <ActionMenuItem onClick={() => setTheme("system")} className="focus:bg-muted focus:text-primary text-xs font-bold flex items-center gap-2.5">
                                <Laptop className="h-4 w-4 shrink-0" />
                                {tCommon("system")}
                            </ActionMenuItem>
                        </ActionMenuSubContent>
                    </ActionMenuPortal>
                </ActionMenuSub>
                <ActionMenuSeparator className="bg-border" />
                <ActionMenuItem 
                    onClick={() => {
                        ApiClient.setToken(null);
                        window.location.href = `/${locale}/sign-in`;
                    }} 
                    className="text-destructive focus:text-red-400 focus:bg-red-500/10 py-2 rounded-sm cursor-pointer"
                >
                    <div className="w-full flex items-center gap-2.5 text-left">
                        <LogOut className="h-4 w-4 text-red-500 shrink-0" />
                        <span className="text-xs font-bold tracking-tight">{t("logout")}</span>
                    </div>
                </ActionMenuItem>
            </ActionMenuContent>
        </ActionMenu>
    )
}
