"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getMasterPlayerStats } from "@/actions/common/user";
import { Link } from "@/i18n/routing";
import {
    Trophy, Calendar, Search, HelpCircle,
    UserCheck, Edit, Link as LinkIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/ui/header";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getSports } from "@/actions/manager/team";
import { Sport, Tournament } from "@/types";
import { VerifyPlayerDialog } from "@/features/dialogs";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export interface MasterPlayer {
    id: string;
    first_name?: string;
    middle_name?: string | null;
    last_name?: string;
    first_name_local?: string | null;
    middle_name_local?: string | null;
    last_name_local?: string | null;
    first_name_intl?: string | null;
    middle_name_intl?: string | null;
    last_name_intl?: string | null;
    first_name_th?: string | null;
    middle_name_th?: string | null;
    last_name_th?: string | null;
    first_name_en?: string | null;
    middle_name_en?: string | null;
    last_name_en?: string | null;
    gender?: 'male' | 'female' | string | null;
    birthday?: string | null;
    tel?: string | null;
    photo_url?: string | null;
    profile_img?: string | null;
    verified?: boolean;
    status?: string;
    favorite_sport_id?: string | null;
    preferred_hand?: string | null;
    preferred_foot?: string | null;
}

interface PlayerStats {
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
}

interface DashboardClientProps {
    initialTournaments: Tournament[];
    initialMasterPlayer: MasterPlayer | null;
}


const THAI_SPORT_NAMES: Record<string, string> = {
    football: "ฟุตบอล",
    basketball: "บาสเกตบอล",
    volleyball: "วอลเลย์บอล",
    futsal: "ฟุตซอล",
    badminton: "แบดมินตัน",
    cricket: "คริกเก็ต",
    takraw: "เซปักตะกร้อ",
    "sepak takraw": "เซปักตะกร้อ",
    tennis: "เทนนิส",
};

export function DashboardClient({ initialTournaments, initialMasterPlayer }: DashboardClientProps) {
    const locale = useLocale();
    const isThai = locale === 'th';
    const t = useTranslations("Dashboard");

    const getTournamentSportName = (tour: Tournament) => {
        const rawSportId = (tour as any).sport_id || (tour as any).settings?.sport_id;
        const matchedSport = rawSportId ? sportsList.find(s => String(s.id) === String(rawSportId)) : null;
        const rawName = tour.sport_name || (tour as any).sports?.sport_name || matchedSport?.sport_name || (tour as any).settings?.sport_name || (tour.sport ? String(tour.sport) : "Football");
        if (locale === "th") {
            return THAI_SPORT_NAMES[rawName.toLowerCase()] || rawName;
        }
        return rawName;
    };

    const [searchQuery, setSearchQuery] = useState("");
    const [masterPlayer, setMasterPlayer] = useState<MasterPlayer | null>(initialMasterPlayer);

    const [stats, setStats] = useState<PlayerStats | null>(null);
    const [statsPlayerId, setStatsPlayerId] = useState<string | null>(null);
    const loadingStats = masterPlayer?.id ? statsPlayerId !== masterPlayer.id : false;

    // Verify / Edit Dialog State
    const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
    const [verifyDialogTab, setVerifyDialogTab] = useState<"create" | "claim">("create");

    const [sportsList, setSportsList] = useState<Sport[]>([]);

    useEffect(() => {
        let active = true;
        if (masterPlayer?.id) {
            getMasterPlayerStats(masterPlayer.id).then((res) => {
                if (active) {
                    if (res.success && res.data) {
                        setStats(res.data);
                    } else {
                        setStats(null);
                    }
                    setStatsPlayerId(masterPlayer.id);
                }
            });
        }
        return () => {
            active = false;
        };
    }, [masterPlayer?.id]);

    useEffect(() => {
        getSports().then((res) => {
            if (res.success && res.data) {
                setSportsList(res.data);
            }
        });
    }, []);

    const handleOpenVerifyDialog = (tab: "create" | "claim" = "create") => {
        setVerifyDialogTab(tab);
        setIsVerifyDialogOpen(true);
    };

    const startTour = useCallback(() => {
        const driverObj = driver({
            showProgress: true,
            animate: true,
            steps: [
                {
                    element: "#tour-all-tournaments-header",
                    popover: {
                        title: t("tour_welcome_title"),
                        description: t("tour_welcome_desc"),
                        side: "bottom" as const,
                        align: "start" as const
                    }
                },
                {
                    element: "#tour-search-input",
                    popover: {
                        title: t("tour_search_title"),
                        description: t("tour_search_desc"),
                        side: "bottom" as const,
                        align: "start" as const
                    }
                },
                {
                    element: "#tour-tournaments-list",
                    popover: {
                        title: t("tour_tournaments_title"),
                        description: t("tour_tournaments_desc"),
                        side: "top" as const,
                        align: "start" as const
                    }
                },
                {
                    element: "#tour-player-card",
                    popover: {
                        title: t("tour_profile_title"),
                        description: t("tour_profile_desc"),
                        side: "left" as const,
                        align: "start" as const
                    }
                },
                ...(document.getElementById("tour-edit-profile-btn") ? [{
                    element: "#tour-edit-profile-btn",
                    popover: {
                        title: t("tour_profile_edit_title"),
                        description: t("tour_profile_edit_desc"),
                        side: "left" as const,
                        align: "start" as const
                    }
                }] : []),
                ...(document.getElementById("tour-sidebar-nav") ? [{
                    element: "#tour-sidebar-nav",
                    popover: {
                        title: t("tour_sidebar_title"),
                        description: t("tour_sidebar_desc"),
                        side: "right" as const,
                        align: "start" as const
                    }
                }] : [])
            ]
        });
        driverObj.drive();
    }, [t]);

    useEffect(() => {
        const hasSeenTour = localStorage.getItem("has_seen_dashboard_tour");
        if (!hasSeenTour) {
            const timer = setTimeout(() => {
                startTour();
                localStorage.setItem("has_seen_dashboard_tour", "true");
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [startTour]);

    // Filter tournaments based on search query (only show tournaments open for registration)
    const filteredTournaments = initialTournaments
        .filter(t => t.is_registration_open !== false && (t as any).settings?.is_registration_open !== false && (t as any).settings?.is_registration_open !== "false")
        .filter(t =>
            t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description?.toLowerCase().includes(searchQuery.toLowerCase())
        );

    return (
        <div className="animate-in fade-in duration-300">
            {/* Main Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 md:gap-4 items-start">

                {/* Left Column: Tournament Listing (8 cols) */}
                <div className="lg:col-span-8 space-y-2 md:space-y-4 order-2 lg:order-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 md:gap-4 bg-background">
                        <div className="flex items-center gap-1 md:gap-2">
                            <Header level={2}>{t("all_tournaments")}</Header>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={startTour}
                            >
                                <HelpCircle className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Search input */}
                        <div className="relative w-full md:w-128">
                            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-all duration-300" />
                            <Input
                                type="search"
                                size="sm"
                                name="q"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                id="tour-search-input"
                                className="bg-card"
                                placeholder={isThai ? "พิมพ์ชื่อการแข่งขัน..." : "Search tournaments..."}
                            />
                        </div>
                    </div>

                    {/* Tournaments Grid */}
                    {loadingStats ? (
                        <div className="border bg-card rounded-sm divide-y overflow-hidden">
                            {[...Array(3)].map((_, idx) => (
                                <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
                                    <div className="flex items-center gap-4 flex-1">
                                        <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                                        <div className="flex flex-col gap-2 justify-center flex-1">
                                            <Skeleton className="h-5 w-1/3 rounded-sm" />
                                            <Skeleton className="h-4 w-1/4 rounded-sm" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0 items-center">
                                        <Skeleton className="h-8 w-8 rounded-sm" />
                                        <div className="space-y-1">
                                            <Skeleton className="h-3.5 w-12 rounded-sm" />
                                            <Skeleton className="h-4 w-28 rounded-sm" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredTournaments.length === 0 ? (
                        <EmptyState
                            title={t("no_tournaments_found")}
                            description={t("no_tournaments_found_desc")}
                            icon={Trophy}
                            className="bg-card rounded-sm border"
                        />
                    ) : (
                        <div className="border bg-card rounded-sm divide-y overflow-hidden" id="tour-tournaments-list">
                            {filteredTournaments.map((tournament) => (
                                <Link
                                    key={tournament.id}
                                    href={`/home/registrations/${tournament.id}`}
                                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 hover:bg-muted/40 transition-colors block group"
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <Avatar className="h-12 w-12 border rounded-full group-hover:border-primary/30 transition-all shrink-0 p-1 bg-muted/30">
                                            <AvatarImage src={tournament.logo_img ?? undefined} alt={tournament.name ?? ""} className="object-contain rounded-full" />
                                            <AvatarFallback className="bg-primary/5 text-primary font-black rounded-full">{tournament.name ? tournament.name.substring(0, 2).toUpperCase() : ""}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <span className="text-base font-black leading-tight tracking-tight group-hover:text-primary transition-colors truncate">
                                                {tournament.name}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {getTournamentSportName(tournament)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                                        <div className="h-9 w-9 bg-muted/50 border border-border/60 flex items-center justify-center rounded-full backdrop-blur-xs shadow-xs text-foreground shrink-0">
                                            <Calendar className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold text-muted-foreground/60 tracking-wider">{t("schedule")}</p>
                                            <p className="text-xs font-bold truncate">
                                                {tournament.start_date && tournament.end_date ? (
                                                    `${new Date(tournament.start_date).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric', year: '2-digit' })} - ${new Date(tournament.end_date).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric', year: '2-digit' })}`
                                                ) : (
                                                    t("not_specified")
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Column: Master Player Card (4 cols) */}
                <div className="lg:col-span-4 space-y-2 md:space-y-4 order-1 lg:order-2">
                    <div className="bg-card rounded-sm" id="tour-player-card">
                        {loadingStats ? (
                            /* Player ID Card Skeleton */
                            <div className="relative overflow-hidden p-2 md:p-4">
                                <div className="flex items-center justify-between pb-2">
                                    <Skeleton className="h-5 w-16 rounded-sm" />
                                    <Skeleton className="h-8 w-8 rounded-sm" />
                                </div>
                                <div className="flex flex-col items-center space-y-3 py-2">
                                    <Skeleton className="h-20 w-20 rounded-full" />
                                    <div className="space-y-2 flex flex-col items-center">
                                        <Skeleton className="h-5 w-36 rounded-sm" />
                                        <Skeleton className="h-4.5 w-16 rounded-sm" />
                                    </div>
                                </div>
                                <div className="border-t pt-2 space-y-2">
                                    <div className="flex items-center justify-between p-2 border-b">
                                        <Skeleton className="h-4 w-16 rounded-sm" />
                                        <Skeleton className="h-4 w-12 rounded-sm" />
                                    </div>
                                    <div className="flex items-center justify-between p-2 border-b">
                                        <Skeleton className="h-4 w-16 rounded-sm" />
                                        <Skeleton className="h-4 w-28 rounded-sm" />
                                    </div>
                                    <div className="flex items-center justify-between p-2">
                                        <Skeleton className="h-4 w-16 rounded-sm" />
                                        <Skeleton className="h-4 w-24 rounded-sm" />
                                    </div>
                                </div>
                            </div>
                        ) : masterPlayer && masterPlayer.verified ? (
                            /* Player ID Card (Verified) */
                            <div className="relative overflow-hidden">
                                {/* Top Action Bar */}
                                <div className="flex items-center justify-between p-2 md:p-4 pb-0">
                                    <Badge className="bg-primary text-primary-foreground">
                                        {t("verified")}
                                    </Badge>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => handleOpenVerifyDialog("create")}
                                        id="tour-edit-profile-btn"
                                        title={isThai ? "แก้ไขข้อมูลนักกีฬา" : "Edit Profile"}
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Main Body */}
                                <div className="flex flex-col items-center text-center space-y-1 md:space-y-2 p-2 md:p-4 relative z-10">
                                    <div className="relative">
                                        <Avatar className="h-20 w-20 border relative z-10 rounded-full">
                                            {(masterPlayer.photo_url || masterPlayer.profile_img) && <AvatarImage src={(masterPlayer.photo_url || masterPlayer.profile_img) || ""} alt="Avatar" className="object-cover" />}
                                            <AvatarFallback className="font-black text-2xl">
                                                {`${(masterPlayer.first_name_intl || masterPlayer.first_name_local || masterPlayer.first_name_en || masterPlayer.first_name_th || "?")[0]}${(masterPlayer.last_name_intl || masterPlayer.last_name_local || masterPlayer.last_name_en || masterPlayer.last_name_th || "?")[0]}`}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>

                                    <div className="space-y-1 md:space-y-2">
                                        <Header level={4}>
                                            {isThai
                                                ? `${masterPlayer.first_name_local || masterPlayer.first_name_intl || masterPlayer.first_name_th || masterPlayer.first_name_en || ""} ${masterPlayer.last_name_local || masterPlayer.last_name_intl || masterPlayer.last_name_th || masterPlayer.last_name_en || ""}`
                                                : `${masterPlayer.first_name_intl || masterPlayer.first_name_local || masterPlayer.first_name_en || masterPlayer.first_name_th || ""} ${masterPlayer.last_name_intl || masterPlayer.last_name_local || masterPlayer.last_name_en || masterPlayer.last_name_th || ""}`}
                                        </Header>
                                        <div className="flex flex-wrap items-center justify-center gap-1 lg:gap-2">
                                            {masterPlayer.preferred_hand && (
                                                <Badge variant="outline">
                                                    {isThai ? "มือ" : "Hand"}: {masterPlayer.preferred_hand === 'right' ? (isThai ? 'ขวา' : 'Right') : masterPlayer.preferred_hand === 'left' ? (isThai ? 'ซ้าย' : 'Left') : (isThai ? 'สองข้าง' : 'Both')}
                                                </Badge>
                                            )}
                                            {masterPlayer.preferred_foot && (
                                                <Badge variant="outline">
                                                    {isThai ? "เท้า" : "Foot"}: {masterPlayer.preferred_foot === 'right' ? (isThai ? 'ขวา' : 'Right') : masterPlayer.preferred_foot === 'left' ? (isThai ? 'ซ้าย' : 'Left') : (isThai ? 'สองข้าง' : 'Both')}
                                                </Badge>
                                            )}
                                            {masterPlayer.favorite_sport_id && (
                                                <Badge variant="outline">
                                                    {sportsList.find(s => s.id === masterPlayer.favorite_sport_id)?.sport_name || (isThai ? "กีฬาที่ชอบ" : "Favorite Sport")}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Details / Stats section */}
                                <div className="border-t relative z-10 p-2 md:p-4 space-y-1 md:space-y-2">
                                    {stats ? (
                                        <>
                                            <div className="grid grid-cols-3 gap-1 md:gap-2 text-center">
                                                <div className="p-2 rounded-sm border transition-all">
                                                    <Label className="block text-[10px] md:text-xs text-muted-foreground">{t("goals")}</Label>
                                                    <span className="text-base md:text-lg font-bold">{stats.goals}</span>
                                                </div>
                                                <div className="p-2 rounded-sm border transition-all">
                                                    <Label className="block text-[10px] md:text-xs text-muted-foreground">{t("assists")}</Label>
                                                    <span className="text-base md:text-lg font-bold">{stats.assists}</span>
                                                </div>
                                                <div className="p-2 rounded-sm border transition-all">
                                                    <Label className="block text-[10px] md:text-xs text-muted-foreground">{t("saves")}</Label>
                                                    <span className="text-base md:text-lg font-bold">{stats.saves}</span>
                                                </div>
                                                <div className="p-2 rounded-sm border transition-all">
                                                    <Label className="block text-[10px] md:text-xs text-warning">{t("yellow")}</Label>
                                                    <span className="text-base md:text-lg font-bold">{stats.yellowCards}</span>
                                                </div>
                                                <div className="p-2 rounded-sm border transition-all">
                                                    <Label className="block text-[10px] md:text-xs text-destructive">{t("red")}</Label>
                                                    <span className="text-base md:text-lg font-bold">{stats.redCards}</span>
                                                </div>
                                                <div className="p-2 rounded-sm border transition-all">
                                                    <Label className="block text-[10px] md:text-xs text-muted-foreground">{t("injuries")}</Label>
                                                    <span className="text-base md:text-lg font-bold">{stats.injuries}</span>
                                                </div>
                                            </div>

                                            {/* Tournament History Table */}
                                            <div className="space-y-2 pt-2">
                                                {stats.history.length === 0 ? (
                                                    <EmptyState
                                                        description={t("no_history")}
                                                        className="bg-card rounded-sm border min-h-[80px]"
                                                    />
                                                ) : (
                                                    <div className="border rounded-sm overflow-hidden">
                                                        <table className="w-full text-[10px] text-left border-collapse">
                                                            <thead>
                                                                <tr className="border-b bg-muted/10">
                                                                    <th className="p-2 font-bold text-muted-foreground">{t("tournament_team")}</th>
                                                                    <th className="p-2 font-bold text-muted-foreground text-center" title="Goals">G</th>
                                                                    <th className="p-2 font-bold text-muted-foreground text-center" title="Assists">A</th>
                                                                    <th className="p-2 font-bold text-muted-foreground text-center" title="Saves">SV</th>
                                                                    <th className="p-2 font-bold text-muted-foreground text-center" title="Yellow Cards">Y</th>
                                                                    <th className="p-2 font-bold text-muted-foreground text-center" title="Red Cards">R</th>
                                                                    <th className="p-2 font-bold text-muted-foreground text-center" title="Injuries">INJ</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y">
                                                                {stats.history.map((h, idx) => (
                                                                    <tr key={idx} className="hover:bg-muted/5 transition-colors">
                                                                        <td className="p-2 font-medium">
                                                                            <div className="font-bold line-clamp-1">{h.tournamentName}</div>
                                                                            <div className="text-muted-foreground text-[9px]">{h.teamName}</div>
                                                                        </td>
                                                                        <td className="p-2 text-center">{h.goals}</td>
                                                                        <td className="p-2 text-center">{h.assists}</td>
                                                                        <td className="p-2 text-center">{h.saves}</td>
                                                                        <td className="p-2 text-center text-amber-500">{h.yellowCards}</td>
                                                                        <td className="p-2 text-center text-rose-500">{h.redCards}</td>
                                                                        <td className="p-2 text-center">{h.injuries}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="p-4 text-center text-xs text-muted-foreground">{t("unable_load_stats")}</div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Player Not Verified / Not Registered Card (Formal Style) */
                            <div className="relative overflow-hidden bg-card border rounded-sm">
                                <div className="flex items-center justify-between p-2 md:p-4 pb-0">
                                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                                        {isThai ? "ยังไม่ได้ยืนยันตัวตน" : "Verification Required"}
                                    </Badge>
                                </div>

                                <div className="flex flex-col items-center text-center p-6 space-y-4">
                                    <div className="relative">
                                        <Avatar className="h-16 w-16 border rounded-full">
                                            {(masterPlayer?.photo_url || masterPlayer?.profile_img) && <AvatarImage src={(masterPlayer.photo_url || masterPlayer.profile_img) || ""} alt="Avatar" className="object-cover" />}
                                            <AvatarFallback className="font-bold text-lg bg-muted text-muted-foreground">
                                                {masterPlayer?.first_name_local || masterPlayer?.first_name_intl || masterPlayer?.first_name_th || masterPlayer?.first_name_en
                                                    ? `${(masterPlayer.first_name_intl || masterPlayer.first_name_local || masterPlayer.first_name_en || masterPlayer.first_name_th || "?")[0]}${(masterPlayer.last_name_intl || masterPlayer.last_name_local || masterPlayer.last_name_en || masterPlayer.last_name_th || "?")[0]}`
                                                    : <UserCheck className="h-7 w-7 text-muted-foreground" />}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>

                                    <div className="space-y-1.5 max-w-xs">
                                        <Header level={4} className="text-base font-bold text-foreground">
                                            {masterPlayer?.first_name_local || masterPlayer?.first_name_intl || masterPlayer?.first_name_th || masterPlayer?.first_name_en
                                                ? `${isThai ? (masterPlayer.first_name_local || masterPlayer.first_name_intl) : (masterPlayer.first_name_intl || masterPlayer.first_name_local)} ${isThai ? (masterPlayer.last_name_local || masterPlayer.last_name_intl || "") : (masterPlayer.last_name_intl || masterPlayer.last_name_local || "")}`.trim()
                                                : (isThai ? "ลงทะเบียนและยืนยันตัวตนนักกีฬา" : "Athlete Profile Verification")}
                                        </Header>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {isThai
                                                ? "กรุณากรอกข้อมูลโปรไฟล์เพื่อยืนยันตัวตน สำหรับใช้ในการสมัครเข้าร่วมการแข่งขัน บันทึกสถิติผลงาน และเข้าร่วมทีมในระบบ"
                                                : "Please complete your profile verification to participate in tournaments, join teams, and track official match statistics."}
                                        </p>
                                    </div>

                                    <div className="w-full space-y-2 pt-2">
                                        <Button
                                            type="button"
                                            className="w-full gap-2 font-bold text-xs h-9 cursor-pointer"
                                            onClick={() => handleOpenVerifyDialog("create")}
                                            id="tour-verify-profile-btn"
                                        >
                                            <UserCheck className="h-4 w-4" />
                                            <span>{isThai ? "ลงทะเบียนยืนยันตัวตนนักกีฬา" : "Complete Athlete Verification"}</span>
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full gap-2 font-medium text-xs h-9 cursor-pointer"
                                            onClick={() => handleOpenVerifyDialog("claim")}
                                        >
                                            <LinkIcon className="h-4 w-4" />
                                            <span>{isThai ? "เชื่อมโยงโปรไฟล์นักกีฬาที่มีอยู่" : "Claim Existing Profile"}</span>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Verify & Edit Player Profile Dialog */}
            <VerifyPlayerDialog
                open={isVerifyDialogOpen}
                onOpenChange={setIsVerifyDialogOpen}
                masterPlayer={masterPlayer}
                initialTab={verifyDialogTab}
                onSuccess={(updatedPlayer) => {
                    setMasterPlayer(updatedPlayer);
                }}
            />
        </div>
    );
}

