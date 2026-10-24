"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/routing";
import { cn, getTeamInitials } from "@/lib/utils";
import { Card } from "@/components/ui/card";

import { formatDate } from "@/lib/date";
import { useLocale, useTranslations } from "next-intl";
import { Tournament, Team } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getLandingSportIcon } from "@/components/shared/sport-icons";
import { resolveStorageUrl } from "@/lib/storage-utils";
import { useImageColor } from "@/hooks/use-image-color";
import { ChevronRight } from "lucide-react";


interface DashboardCardProps {
    type: 'tournament' | 'team';
    data: Tournament | Team;
    userPlan?: string;
    mode?: 'organizer' | 'team';
    layout?: 'card' | 'list';
}

export function DashboardCard({ type, data, mode, layout = 'card' }: DashboardCardProps) {
    const tDashboard = useTranslations("Dashboard");
    const tSettings = useTranslations("Settings");
    const tTeam = useTranslations("Team");
    const locale = useLocale();

    if (type === 'tournament') {
        if (layout === 'list') {
            return (
                <TournamentListItem
                    tournament={data as Tournament & { current_teams?: number }}
                    mode={mode}
                    locale={locale}
                    tDashboard={tDashboard}
                    tSettings={tSettings}
                />
            );
        }

        return (
            <TournamentCard
                tournament={data as Tournament & { current_teams?: number }}
                mode={mode}
                locale={locale}
                tDashboard={tDashboard}
                tSettings={tSettings}
            />
        );
    }


    if (layout === 'list') {
        return (
            <TeamListItem
                team={data as Team & { tournament?: { name: string } | null }}
                locale={locale}
                tTeam={tTeam}
            />
        );
    }

    return (
        <TeamCard
            team={data as Team & { tournament?: { name: string } | null }}
            locale={locale}
            tTeam={tTeam}
        />
    );
}

function TournamentCard({
    tournament,
    mode,
    locale,
    tDashboard,
    tSettings
}: {
    tournament: Tournament & { current_teams?: number };
    mode?: 'organizer' | 'team';
    locale: string;
    tDashboard: any;
    tSettings: any;
}) {
    const statusColors: Record<string, string> = {
        draft: "bg-warning/10 text-warning border-warning/50",
        ongoing: "bg-primary/10 text-primary border-primary/50",
        completed: "bg-node-3/10 text-node-3 border-node-3/50",
        cancelled: "bg-destructive/10 text-destructive border-destructive/50",
    };

    const statusColor = (tournament.status && statusColors[tournament.status]) || statusColors.draft;
    const coverUrl = resolveStorageUrl(tournament.cover_img || tournament.banner_url);
    const sportVal = tournament.sport || (tournament as any).sport_name || (tournament as any).sports?.sport_name;

    const getStatusLabel = (status?: string | null) => {
        if (!status) return tSettings('draft');
        try {
            return tSettings(status as any);
        } catch {
            return status;
        }
    };

    const dateStr = tournament.start_date && tournament.end_date ? (
        tournament.start_date === tournament.end_date
            ? formatDate(tournament.start_date, "d MMMM yyyy", locale)
            : `${formatDate(tournament.start_date, "d MMMM yyyy", locale)} - ${formatDate(tournament.end_date, "d MMMM yyyy", locale)}`
    ) : null;

    const resolvedTournamentLogo = resolveStorageUrl(tournament.logo_img || tournament.logo_url);
    const tournamentDominantColor = useImageColor(coverUrl ? null : resolvedTournamentLogo);

    const tournamentRole = (tournament as any).role;
    const isStaffMember = tournamentRole && tournamentRole !== 'owner';
    const getRoleBadgeLabel = (role: string) => {
        const isTh = locale === "th";
        const norm = role.toLowerCase().trim();
        if (norm === "co_organizer" || norm === "co-organizer") return isTh ? "ผู้ร่วมจัด" : "Co-Organizer";
        if (norm === "referee") return isTh ? "ผู้ตัดสิน" : "Referee";
        if (norm === "staff") return isTh ? "ทีมงาน" : "Staff";
        return role.replace(/_/g, ' ');
    };

    return (
        <Link href={`/my-tournaments/${tournament.id}`} className="block h-full group">
            <Card className="flex flex-col justify-between h-full bg-card border rounded-sm transition-all hover:border-primary/50 hover:shadow-md overflow-hidden relative cursor-pointer min-h-[160px] p-4 gap-4">
                {/* Background Cover Image */}
                {coverUrl ? (
                    <>
                        <img
                            src={coverUrl}
                            alt={tournament.name}
                            className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                        />
                        {/* Dark Gradient Overlay for optimal readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/40 pointer-events-none" />
                    </>
                ) : (
                    <>
                        {/* Top-left subtle ambient gradient glow fallback */}
                        <div
                            className={cn(
                                "absolute -top-8 -left-8 w-36 h-36 rounded-full blur-2xl pointer-events-none transition-all duration-500",
                                !tournamentDominantColor && (resolvedTournamentLogo ? "bg-white/10 dark:bg-white/10" : "bg-primary/20 dark:bg-primary/15")
                            )}
                            style={
                                tournamentDominantColor
                                    ? { backgroundColor: `rgba(${tournamentDominantColor}, 0.28)` }
                                    : undefined
                            }
                        />
                        <div
                            className={cn(
                                "absolute inset-0 pointer-events-none transition-all duration-500",
                                !tournamentDominantColor && (resolvedTournamentLogo ? "bg-gradient-to-br from-white/10 via-transparent to-transparent" : "bg-gradient-to-br from-primary/15 via-transparent to-transparent")
                            )}
                            style={
                                tournamentDominantColor
                                    ? {
                                          background: `radial-gradient(circle at top left, rgba(${tournamentDominantColor}, 0.18) 0%, transparent 70%)`,
                                      }
                                    : undefined
                            }
                        />

                        {/* Bottom-right watermark logo fallback */}
                        <div className="absolute -right-14 -bottom-14 w-36 h-36 sm:w-44 sm:h-44 pointer-events-none select-none opacity-5 dark:opacity-5 overflow-hidden flex items-center justify-center">
                            {resolvedTournamentLogo ? (
                                <img
                                    src={resolvedTournamentLogo}
                                    alt=""
                                    className="w-full h-full object-cover grayscale rounded-full"
                                />
                            ) : (
                                <div className="w-full h-full rounded-full flex items-center justify-center text-8xl font-black text-foreground">
                                    {getTeamInitials(tournament.name)}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Top Row: Tournament Profile/Logo & Status / Role Badges */}
                <div className="flex items-start justify-between relative z-10">
                    <Avatar className="h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-xs bg-muted shrink-0 overflow-hidden">
                        <AvatarImage src={resolvedTournamentLogo ?? undefined} alt={tournament.name} className="object-contain rounded-full w-full h-full" />
                        <AvatarFallback className="bg-primary/10 text-primary font-black text-lg rounded-full flex items-center justify-center w-full h-full">
                            {getTeamInitials(tournament.name)}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {isStaffMember && (
                            <Badge
                                variant="outline"
                                className="capitalize backdrop-blur-xs border shadow-xs bg-primary/10 text-primary border-primary/50"
                            >
                                {getRoleBadgeLabel(tournamentRole)}
                            </Badge>
                        )}
                        <Badge
                            variant="outline"
                            className={cn(
                                "capitalize backdrop-blur-xs border shadow-xs",
                                coverUrl ? "bg-black/60 text-white border-white/20" : statusColor
                            )}
                        >
                            {getStatusLabel(tournament.status)}
                        </Badge>
                    </div>
                </div>

                {/* Bottom Info: Tournament Name, Description/Dates & Sport Icon at Bottom Right */}
                <div className="flex items-end justify-between gap-2 relative z-10">
                    <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                        <h3 className={cn(
                            "text-xl md:text-2xl font-black tracking-tight line-clamp-1  transition-colors",
                            coverUrl ? "text-white" : "text-foreground"
                        )}>
                            {tournament.name}
                        </h3>

                        <p className={cn(
                            "text-xs line-clamp-2 leading-relaxed",
                            coverUrl ? "text-gray-200/90" : "text-muted-foreground"
                        )}>
                            {dateStr || tournament.description || (mode === 'organizer' ? tDashboard('manage_tournament_desc') : tDashboard('view_tournament_desc'))}
                        </p>
                    </div>

                    {/* Sport Icon (Bottom Right) */}
                    <div className={cn(
                        "h-9 w-9 rounded-full flex items-center justify-center shrink-0 shadow-xs border backdrop-blur-xs transition-colors",
                        coverUrl
                            ? "bg-black/60 text-white border-white/20"
                            : "bg-muted/50 text-foreground"
                    )}>
                        {getLandingSportIcon(sportVal, "h-4 w-4")}
                    </div>
                </div>
            </Card>
        </Link>
    );
}

function TournamentListItem({
    tournament,
    mode,
    locale,
    tDashboard,
    tSettings,
}: {
    tournament: Tournament & { current_teams?: number };
    mode?: 'organizer' | 'team';
    locale: string;
    tDashboard: any;
    tSettings: any;
}) {
    const statusColors: Record<string, string> = {
        draft: "bg-warning/10 text-warning border-warning/50",
        ongoing: "bg-primary/10 text-primary border-primary/50",
        completed: "bg-node-3/10 text-node-3 border-node-3/50",
        cancelled: "bg-destructive/10 text-destructive border-destructive/50",
    };

    const statusColor = (tournament.status && statusColors[tournament.status]) || statusColors.draft;
    const resolvedTournamentLogo = resolveStorageUrl(tournament.logo_img || tournament.logo_url);
    const dominantColor = useImageColor(resolvedTournamentLogo);
    const sportVal = tournament.sport || (tournament as any).sport_name || (tournament as any).sports?.sport_name;

    const getStatusLabel = (status?: string | null) => {
        if (!status) return tSettings('draft');
        try {
            return tSettings(status as any);
        } catch {
            return status;
        }
    };

    const dateStr = tournament.start_date && tournament.end_date ? (
        tournament.start_date === tournament.end_date
            ? formatDate(tournament.start_date, "d MMMM yyyy", locale)
            : `${formatDate(tournament.start_date, "d MMMM yyyy", locale)} - ${formatDate(tournament.end_date, "d MMMM yyyy", locale)}`
    ) : null;

    const tournamentRole = (tournament as any).role;
    const isStaffMember = tournamentRole && tournamentRole !== 'owner';
    const getRoleBadgeLabel = (role: string) => {
        const isTh = locale === "th";
        const norm = role.toLowerCase().trim();
        if (norm === "co_organizer" || norm === "co-organizer") return isTh ? "ผู้ร่วมจัด" : "Co-Organizer";
        if (norm === "referee") return isTh ? "ผู้ตัดสิน" : "Referee";
        if (norm === "staff") return isTh ? "ทีมงาน" : "Staff";
        return role.replace(/_/g, ' ');
    };

    return (
        <Link
            href={`/my-tournaments/${tournament.id}`}
            className="block group relative transition-all hover:bg-muted/30 cursor-pointer p-4 overflow-hidden"
        >
            {/* Subtle ambient radial gradient from top left */}
            {dominantColor && (
                <div
                    className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                        background: `radial-gradient(circle at top left, rgba(${dominantColor}, 0.08) 0%, transparent 60%)`,
                    }}
                />
            )}

            <div className="flex items-center justify-between gap-3 sm:gap-4 relative z-10">
                {/* Left: Avatar + Tournament Info */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <Avatar className="h-11 w-11 sm:h-12 sm:w-12 rounded-full shadow-xs bg-muted shrink-0 overflow-hidden">
                        <AvatarImage
                            src={resolvedTournamentLogo ?? undefined}
                            alt={tournament.name}
                            className="object-contain rounded-full w-full h-full"
                        />
                        <AvatarFallback className="bg-primary/10 text-primary font-black text-sm sm:text-base rounded-full flex items-center justify-center w-full h-full">
                            {getTeamInitials(tournament.name)}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col min-w-0 gap-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-base sm:text-lg tracking-tight text-foreground line-clamp-1 transition-colors">
                                {tournament.name}
                            </h3>
                            {isStaffMember && (
                                <Badge
                                    variant="outline"
                                    className="capitalize text-[10px] py-0 px-1.5 h-4 font-semibold bg-primary/10 text-primary border-primary/50"
                                >
                                    {getRoleBadgeLabel(tournamentRole)}
                                </Badge>
                            )}
                            <Badge
                                variant="outline"
                                className={cn(
                                    "capitalize text-[10px] py-0 px-1.5 h-4 font-semibold border shadow-xs",
                                    statusColor
                                )}
                            >
                                {getStatusLabel(tournament.status)}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                            {dateStr || tournament.description || (mode === 'organizer' ? tDashboard('manage_tournament_desc') : tDashboard('view_tournament_desc'))}
                        </p>
                    </div>
                </div>

                {/* Right: Sport Badge & Chevron */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div className="h-8 px-2.5 rounded-full bg-muted/50 text-foreground border flex items-center gap-1.5 shrink-0 shadow-xs backdrop-blur-xs text-xs font-semibold">
                        {getLandingSportIcon(sportVal, "h-3.5 w-3.5")}
                        <span className="hidden sm:inline capitalize">
                            {(tournament as any).sport_name || tournament.sport || "Sport"}
                        </span>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                </div>
            </div>
        </Link>
    );
}

function TeamCard({
    team,
    locale,
    tTeam
}: {
    team: Team & { tournament?: { name: string } | null };
    locale: string;
    tTeam: any;
}) {
    const resolvedTeamLogo = resolveStorageUrl((team as any).logo_img || team.logo_url);
    const dominantColor = useImageColor(resolvedTeamLogo);
    const [teamHref, setTeamHref] = useState(`/my-teams/${team.id}`);

    useEffect(() => {
        try {
            const saved = localStorage.getItem("squad_view_mode");
            const mode = saved === "card" || saved === "grid" ? "card" : "list";
            setTeamHref(`/my-teams/${team.id}?view=${mode}`);
        } catch {}
    }, [team.id]);

    return (
        <Link href={teamHref} className="block h-full group">
            <Card className="flex flex-col justify-between h-full bg-card border rounded-sm transition-all hover:border-primary/50 hover:shadow-md overflow-hidden relative cursor-pointer p-4 gap-4 min-h-[160px]">
                {/* Top-left subtle ambient gradient glow matching team profile logo */}
                <div
                    className={cn(
                        "absolute -top-8 -left-8 w-36 h-36 rounded-full blur-2xl pointer-events-none transition-all duration-500",
                        !dominantColor && (resolvedTeamLogo ? "bg-white/10 dark:bg-white/10" : "bg-primary/20 dark:bg-primary/15")
                    )}
                    style={
                        dominantColor
                            ? { backgroundColor: `rgba(${dominantColor}, 0.28)` }
                            : undefined
                    }
                />
                <div
                    className={cn(
                        "absolute inset-0 pointer-events-none transition-all duration-500",
                        !dominantColor && (resolvedTeamLogo ? "bg-gradient-to-br from-white/10 via-transparent to-transparent" : "bg-gradient-to-br from-primary/15 via-transparent to-transparent")
                    )}
                    style={
                        dominantColor
                            ? {
                                  background: `radial-gradient(circle at top left, rgba(${dominantColor}, 0.18) 0%, transparent 70%)`,
                              }
                            : undefined
                    }
                />

                {/* Bottom-right watermark logo */}
                <div className="absolute -right-14 -bottom-14 w-36 h-36 sm:w-44 sm:h-44 pointer-events-none select-none opacity-5 dark:opacity-5 overflow-hidden flex items-center justify-center">
                    {resolvedTeamLogo ? (
                        <img
                            src={resolvedTeamLogo}
                            alt=""
                            className="w-full h-full object-cover grayscale rounded-full"
                        />
                    ) : (
                        <div className="w-full h-full rounded-full flex items-center justify-center text-8xl font-black text-foreground">
                            {getTeamInitials(team.name)}
                        </div>
                    )}
                </div>

                {/* Top Row: Avatar & Landing Sport Icon Badge */}
                <div className="flex items-start justify-between relative z-10">
                    <Avatar className="h-14 w-14 sm:h-16 sm:w-16 rounded-full shadow-xs bg-muted shrink-0 overflow-hidden">
                        <AvatarImage src={resolvedTeamLogo ?? undefined} alt={team.name} className="object-contain rounded-full w-full h-full" />
                        <AvatarFallback className="bg-primary/10 text-primary font-black text-xl rounded-full flex items-center justify-center w-full h-full">
                            {getTeamInitials(team.name)}
                        </AvatarFallback>
                    </Avatar>


                    <div className="h-9 w-9 rounded-full bg-muted/50 text-foreground border flex items-center justify-center shrink-0 shadow-xs backdrop-blur-xs">
                        {getLandingSportIcon(team.sport || team.sport_name || (team as any).sport_id, "h-4 w-4")}
                    </div>

                </div>

                {/* Bottom Info: Team Name & Description */}
                <div className="flex flex-col gap-1.5 relative z-10">
                    <h3 className="text-xl md:text-2xl font-black tracking-tight text-foreground line-clamp-1 transition-colors">
                        {team.name}
                    </h3>
                    <p className="text-sm font-medium text-foreground/80 dark:text-muted-foreground line-clamp-1 leading-relaxed">
                        {team.description || (locale === 'th' ? "ยังไม่มีคำอธิบายทีม" : tTeam("no_description"))}
                    </p>
                </div>
            </Card>
        </Link>
    );
}

function TeamListItem({
    team,
    locale,
    tTeam,
}: {
    team: Team & { tournament?: { name: string } | null };
    locale: string;
    tTeam: any;
}) {
    const resolvedTeamLogo = resolveStorageUrl((team as any).logo_img || team.logo_url);
    const dominantColor = useImageColor(resolvedTeamLogo);
    const [teamHref, setTeamHref] = useState(`/my-teams/${team.id}`);

    useEffect(() => {
        try {
            const saved = localStorage.getItem("squad_view_mode");
            const mode = saved === "card" || saved === "grid" ? "card" : "list";
            setTeamHref(`/my-teams/${team.id}?view=${mode}`);
        } catch {}
    }, [team.id]);

    const sportVal = team.sport || team.sport_name || (team as any).sport_id;

    return (
        <Link
            href={teamHref}
            className="block group relative transition-all hover:bg-muted/30 cursor-pointer p-3 sm:p-4 overflow-hidden"
        >
            {/* Subtle ambient radial gradient from top left */}
            {dominantColor && (
                <div
                    className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                        background: `radial-gradient(circle at top left, rgba(${dominantColor}, 0.08) 0%, transparent 60%)`,
                    }}
                />
            )}

            <div className="flex items-center justify-between gap-3 sm:gap-4 relative z-10">
                {/* Left: Avatar + Team Info */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <Avatar className="h-11 w-11 sm:h-12 sm:w-12 rounded-full shadow-xs bg-muted shrink-0 overflow-hidden">
                        <AvatarImage
                            src={resolvedTeamLogo ?? undefined}
                            alt={team.name}
                            className="object-contain rounded-full w-full h-full"
                        />
                        <AvatarFallback className="bg-primary/10 text-primary font-black text-sm sm:text-base rounded-full flex items-center justify-center w-full h-full">
                            {getTeamInitials(team.name)}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col min-w-0 gap-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-base sm:text-lg tracking-tight text-foreground line-clamp-1 transition-colors">
                                {team.name}
                            </h3>
                            {team.tournament?.name && (
                                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 font-semibold">
                                    {team.tournament.name}
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                            {team.description || (team.contact_name ? `${team.contact_name} ${team.contact_phone ? `(${team.contact_phone})` : ""}` : (locale === 'th' ? "ยังไม่มีคำอธิบายทีม" : tTeam("no_description")))}
                        </p>
                    </div>
                </div>

                {/* Right: Sport Badge & Chevron */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div className="h-8 px-2.5 rounded-full bg-muted/50 text-foreground border flex items-center gap-1.5 shrink-0 shadow-xs backdrop-blur-xs text-xs font-semibold">
                        {getLandingSportIcon(sportVal, "h-3.5 w-3.5")}
                        <span className="hidden sm:inline capitalize">
                            {team.sport_name || team.sport || "Sport"}
                        </span>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                </div>
            </div>
        </Link>
    );
}

