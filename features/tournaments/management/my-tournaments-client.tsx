"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, HelpCircle, Trophy, List, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tab } from "@/components/ui/tab";
import { DashboardCard } from "@/features/dashboard/dashboard-card";
import { TournamentCreate } from "@/features/dialogs";
import { EmptyState } from "@/components/shared/empty-state";
import { Tournament } from "@/types/index";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { Header } from "@/components/ui/header";

interface MyTournamentsClientProps {
    initialTournaments: (Tournament & { role?: string })[];
    userPlan: string;
}

export function MyTournamentsClient({ initialTournaments, userPlan }: MyTournamentsClientProps) {
    const t = useTranslations("Dashboard");
    const locale = useLocale();
    const isThai = locale === "th";
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const viewParam = searchParams.get("view");
    const [viewMode, setViewMode] = useState<"list" | "card">(() => {
        if (viewParam === "list" || viewParam === "card") return viewParam;
        if (viewParam === "grid") return "card";
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem("tournaments_view_mode");
                if (saved === "list" || saved === "card") return saved;
            } catch {}
        }
        return "card";
    });

    useEffect(() => {
        if (viewParam === "list" || viewParam === "card") {
            setViewMode(viewParam);
            try {
                localStorage.setItem("tournaments_view_mode", viewParam);
            } catch {}
        } else if (viewParam === "grid") {
            setViewMode("card");
            try {
                localStorage.setItem("tournaments_view_mode", "card");
            } catch {}
        }
    }, [viewParam]);

    const handleViewModeChange = (mode: "list" | "card") => {
        setViewMode(mode);
        try {
            localStorage.setItem("tournaments_view_mode", mode);
        } catch {}
        const params = new URLSearchParams(searchParams.toString());
        params.set("view", mode);
        const queryString = params.toString();
        router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll: false });
    };

    const [searchQuery, setSearchQuery] = useState("");

    const startTour = useCallback(() => {
        const driverObj = driver({
            showProgress: true,
            animate: true,
            steps: [
                {
                    element: "#tour-my-tournaments-header",
                    popover: {
                        title: t("tour_my_tournaments_title"),
                        description: t("tour_my_tournaments_desc"),
                        side: "bottom" as const,
                        align: "start" as const
                    }
                },
                {
                    element: "#tour-my-tournaments-search",
                    popover: {
                        title: t("tour_my_tournaments_search_title"),
                        description: t("tour_my_tournaments_search_desc"),
                        side: "bottom" as const,
                        align: "start" as const
                    }
                },
                {
                    element: "#tour-create-tournament-btn",
                    popover: {
                        title: t("tour_my_tournaments_create_title"),
                        description: t("tour_my_tournaments_create_desc"),
                        side: "left" as const,
                        align: "start" as const
                    }
                },
                ...(document.getElementById("tour-tournaments-grid") ? [{
                    element: "#tour-tournaments-grid",
                    popover: {
                        title: t("tour_my_tournaments_list_title"),
                        description: t("tour_my_tournaments_list_desc"),
                        side: "top" as const,
                        align: "start" as const
                    }
                }] : [])
            ]
        });
        driverObj.drive();
    }, [t]);

    useEffect(() => {
        const hasSeenTour = localStorage.getItem("has_seen_my_tournaments_tour");
        if (!hasSeenTour) {
            const timer = setTimeout(() => {
                startTour();
                localStorage.setItem("has_seen_my_tournaments_tour", "true");
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [startTour]);

    const filteredTournaments = initialTournaments.filter((tournament) =>
        tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tournament.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tournament.status?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-2 lg:gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 md:gap-4">
                <div className="flex items-center gap-1 lg:gap-2">
                    <Header level={2}>{t("my_tournaments")}</Header>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={startTour}
                    >
                        <HelpCircle className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 lg:w-128 sm:flex-none" id="tour-my-tournaments-search">
                        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                        <Input
                            type="search"
                            size="sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-card"
                            placeholder={isThai ? "พิมพ์ชื่อการแข่งขัน..." : "Search tournaments..."}
                        />
                    </div>
                    <div id="tour-tournaments-view-mode" className="flex items-center shrink-0">
                        <Tab<"list" | "card">
                            value={viewMode}
                            onChange={handleViewModeChange}
                            size="sm"
                            showLabels={false}
                            showIcons={true}
                            itemClassName="size-7"
                            options={[
                                { label: isThai ? "รายการ" : "List", value: "list", icon: List },
                                { label: isThai ? "การ์ด" : "Card", value: "card", icon: LayoutGrid },
                            ]}
                        />
                    </div>
                    <div id="tour-create-tournament-btn" className="inline-block shrink-0">
                        <TournamentCreate
                            iconOnlyMobile
                            isDisabled={(() => {
                                const isUnlimitedPlan = userPlan === "yearly" || userPlan === "pro_yearly" || userPlan === "cup_yearly" || userPlan === "tournament_yearly" || userPlan === "customs";
                                const isCupPlan = userPlan === "cup" || userPlan === "tournament";
                                const isEventPlan = userPlan === "event" || userPlan === "monthly" || userPlan === "pro" || userPlan === "manager_pro";
                                const ownedTournaments = initialTournaments.filter(t => t.role === 'owner');
                                if (isUnlimitedPlan) return false;
                                if (isEventPlan || isCupPlan) {
                                    const maxMonthly = isCupPlan ? 10 : 3;
                                    const currentYearMonth = new Date().toISOString().substring(0, 7);
                                    const thisMonthCount = ownedTournaments.filter(t => (t.created_at || '').substring(0, 7) === currentYearMonth).length;
                                    return thisMonthCount >= maxMonthly;
                                }
                                return ownedTournaments.length >= 1;
                            })()}
                        />
                    </div>
                </div>
            </div>

            {filteredTournaments.length === 0 ? (
                <EmptyState
                    title={searchQuery ? t("no_tournaments_found") : t("no_tournaments")}
                    description={searchQuery ? `${t("search_tournaments")} "${searchQuery}"` : t("create_first")}
                    icon={Trophy}
                    action={
                        <div id="tour-create-tournament-btn-empty">
                            <TournamentCreate
                                isDisabled={(() => {
                                    const isUnlimitedPlan = userPlan === "yearly" || userPlan === "pro_yearly" || userPlan === "cup_yearly" || userPlan === "tournament_yearly" || userPlan === "customs";
                                    const isCupPlan = userPlan === "cup" || userPlan === "tournament";
                                    const isEventPlan = userPlan === "event" || userPlan === "monthly" || userPlan === "pro" || userPlan === "manager_pro";
                                    const ownedTournaments = initialTournaments.filter(t => t.role === 'owner');
                                    if (isUnlimitedPlan) return false;
                                    if (isEventPlan || isCupPlan) {
                                        const maxMonthly = isCupPlan ? 10 : 3;
                                        const currentYearMonth = new Date().toISOString().substring(0, 7);
                                        const thisMonthCount = ownedTournaments.filter(t => (t.created_at || '').substring(0, 7) === currentYearMonth).length;
                                        return thisMonthCount >= maxMonthly;
                                    }
                                    return ownedTournaments.length >= 1;
                                })()}
                            />
                        </div>
                    }
                    className="bg-card rounded-sm border"
                />
            ) : viewMode === "card" ? (
                <div id="tour-tournaments-grid" className="grid gap-2 lg:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredTournaments.map((tournament) => (
                        <DashboardCard
                            key={tournament.id}
                            type="tournament"
                            data={tournament}
                            userPlan={userPlan}
                            layout="card"
                        />
                    ))}
                </div>
            ) : (
                <div id="tour-tournaments-list" className="border bg-card rounded-sm divide-y divide-border overflow-hidden shadow-xs">
                    {filteredTournaments.map((tournament) => (
                        <DashboardCard
                            key={tournament.id}
                            type="tournament"
                            data={tournament}
                            userPlan={userPlan}
                            layout="list"
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

