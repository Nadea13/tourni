"use client";

import { useState, useMemo, useCallback } from "react";
import { Link } from "@/i18n/routing";
import { CardTitle } from "@/components/ui/card";
import { 
    Calendar, 
    ChevronDown, 
    ChevronLeft, 
    ChevronRight, 
    Loader2, 
    Calendar as CalendarIcon, 
    ArrowUpRight 
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Tournament, Match, Team } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicTournamentMatches } from "@/actions/public";
import { motion, AnimatePresence } from "motion/react";
import { MatchManager } from "@/features/tournaments/matches/match-manager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/dropdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, subDays, addMonths, subMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { formatDate, isPastDocumentDeadline } from "@/lib/date";
import { cn, getTeamInitials } from "@/lib/utils";
import { getLandingSportIcon } from "@/components/shared/sport-icons";


interface PublicTournamentCardProps {
    tournament: Tournament & { 
        tournament_teams?: { count: number }[];
        sports?: { id: string; sport_name: string };
        sport_name?: string;
        tournament_categories?: {
            id: string;
            max_teams?: number;
            age_categories?: { category_name: string } | null;
        }[];
    };
    href?: string;
}

const THAI_SPORT_NAMES: Record<string, string> = {
    football: "ฟุตบอล",
    basketball: "บาสเกตบอล",
    volleyball: "วอลเลย์บอล",
    futsal: "ฟุตซอล",
    badminton: "แบดมินตัน",
    cricket: "คริกเก็ต",
    takraw: "เซปักตะกร้อ",
};

export function PublicTournamentCard({ tournament, href }: PublicTournamentCardProps) {
    const locale = useLocale();
    const tDashboard = useTranslations("Dashboard");
    const tSettings = useTranslations("Settings");

    const [isExpanded, setIsExpanded] = useState(false);
    const [matches, setMatches] = useState<Match[]>([]);
    const [isLoadingMatches, setIsLoadingMatches] = useState(false);
    const [hasFetchedMatches, setHasFetchedMatches] = useState(false);
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

    // Match Filters
    const [matchSelectedDate, setMatchSelectedDate] = useState<string | null>(null);
    const [matchFilterStage, setMatchFilterStage] = useState<string>("all");
    const [matchViewDate, setMatchViewDate] = useState(new Date());
    const [isMatchCalendarOpen, setIsMatchCalendarOpen] = useState(false);

    const currentTeams = tournament.tournament_teams?.[0]?.count || 0;
    const isFull = tournament.max_teams ? currentTeams >= tournament.max_teams : false;
    const isPastDeadline = useMemo(() => {
        return isPastDocumentDeadline(tournament.document_deadline);
    }, [tournament.document_deadline]);
    const isNotOpenYet = tournament.is_registration_open === false;
    const isClosed = isFull || isPastDeadline || isNotOpenYet;
    const isOngoing = tournament.status === "ongoing" || (tournament.status as string) === "active";

    const cardHref = href || `/tournaments/${tournament.id}`;

    const rawSportName = tournament.sports?.sport_name || tournament.sport_name || "";
    const sportDisplayName = locale === "th" && rawSportName
        ? (THAI_SPORT_NAMES[rawSportName.toLowerCase()] || rawSportName)
        : rawSportName;

    const fetchMatches = useCallback(async () => {
        if (hasFetchedMatches || isLoadingMatches) return;
        setIsLoadingMatches(true);
        try {
            const data = await getPublicTournamentMatches(tournament.id);
            setMatches((data || []) as unknown as Match[]);
            setHasFetchedMatches(true);
        } catch (err) {
            console.error("Failed to load matches for tournament:", err);
        } finally {
            setIsLoadingMatches(false);
        }
    }, [hasFetchedMatches, isLoadingMatches, tournament.id]);

    const handleToggleExpand = (e: React.MouseEvent) => {
        if (isOngoing) {
            e.preventDefault();
            e.stopPropagation();
            const next = !isExpanded;
            setIsExpanded(next);
            if (next && !hasFetchedMatches) {
                fetchMatches();
            }
        }
    };

    // Calendar & Dates calculations
    const datesWithMatches = useMemo(() => {
        return new Set(matches.map(m => m.match_date).filter(Boolean) as string[]);
    }, [matches]);

    const calendarDays = useMemo(() => {
        const days = [];
        const startOfViewMonth = startOfMonth(matchViewDate);
        const endOfViewMonth = endOfMonth(matchViewDate);
        const firstDay = getDay(startOfViewMonth);

        for (let i = 0; i < firstDay; i++) days.push(null);
        const interval = eachDayOfInterval({ start: startOfViewMonth, end: endOfViewMonth });
        interval.forEach(day => days.push(day));
        return days;
    }, [matchViewDate]);

    const goToPrevDay = () => {
        const current = matchSelectedDate ? new Date(matchSelectedDate) : new Date();
        const prev = subDays(current, 1);
        setMatchSelectedDate(format(prev, 'yyyy-MM-dd'));
    };

    const goToNextDay = () => {
        const current = matchSelectedDate ? new Date(matchSelectedDate) : new Date();
        const next = addDays(current, 1);
        setMatchSelectedDate(format(next, 'yyyy-MM-dd'));
    };

    // Get unique categories present in matches
    const availableCategories = useMemo(() => {
        return Array.from(
            new Map(matches.map(m => {
                const ext = m as Match & { category_name?: string };
                return [m.tournament_category_id || ext.category_name || "all", {
                    id: m.tournament_category_id || ext.category_name || "all",
                    name: ext.category_name || "รุ่นทั่วไป"
                }];
            })).values()
        );
    }, [matches]);

    // Extract all teams from matches for MatchManager
    const allTeams = useMemo(() => {
        const teamMap = new Map<string, Team>();
        matches.forEach(m => {
            const ext = m as Match & {
                home_team?: { id?: string | null; name: string; logo_url: string | null } | null;
                away_team?: { id?: string | null; name: string; logo_url: string | null } | null;
            };
            if (m.home_team_id && ext.home_team) {
                teamMap.set(m.home_team_id, {
                    id: m.home_team_id,
                    name: ext.home_team.name,
                    logo_url: ext.home_team.logo_url,
                    created_at: new Date().toISOString()
                } as unknown as Team);
            }
            if (m.away_team_id && ext.away_team) {
                teamMap.set(m.away_team_id, {
                    id: m.away_team_id,
                    name: ext.away_team.name,
                    logo_url: ext.away_team.logo_url,
                    created_at: new Date().toISOString()
                } as unknown as Team);
            }
        });
        return Array.from(teamMap.values());
    }, [matches]);

    // Filter matches by selected category
    const filteredMatchesByCategory = useMemo(() => {
        if (selectedCategoryFilter === "all") return matches;
        return matches.filter(m => {
            const ext = m as Match & { category_name?: string };
            return m.tournament_category_id === selectedCategoryFilter || ext.category_name === selectedCategoryFilter;
        });
    }, [matches, selectedCategoryFilter]);

    const cardContent = (
        <div className="flex flex-col bg-card group-hover:bg-muted/30 transition-colors relative cursor-pointer">
            <div className="flex justify-between items-center p-3 md:p-4 relative z-10 gap-2">
                <div className="flex items-center gap-2 md:gap-3 overflow-hidden min-w-0">
                    <Avatar className="h-12 w-12 border rounded-full group-hover:border-primary/30 transition-all shrink-0 p-1 bg-muted/30">
                        <AvatarImage src={(tournament.logo_url || tournament.logo_img) ?? undefined} alt={tournament.name ?? ""} className="object-contain rounded-full" />
                        <AvatarFallback className="bg-primary/5 text-primary font-black rounded-full">
                            {getTeamInitials(tournament.name)}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-lg font-black leading-none tracking-tight group-hover:text-primary transition-colors truncate">
                                {tournament.name}
                            </CardTitle>
                            {isOngoing ? (
                                <Badge
                                    variant="outline"
                                    className="w-fit text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10 shrink-0"
                                >
                                    กำลังแข่งขัน
                                </Badge>
                            ) : isClosed ? (
                                <Badge
                                    variant="outline"
                                    className={`w-fit shrink-0 ${isNotOpenYet
                                        ? "text-warning border-warning/50 bg-warning/10"
                                        : "text-destructive border-destructive/50 bg-destructive/10"
                                        }`}
                                >
                                    {isNotOpenYet
                                        ? "ยังไม่เปิดรับสมัคร"
                                        : isFull
                                        ? (tSettings("full") || "เต็มแล้ว")
                                        : (tSettings("closed") || "ปิดรับสมัคร")}
                                </Badge>
                            ) : null}
                        </div>
                        {sportDisplayName && (
                            <p className="text-xs font-semibold text-muted-foreground truncate">
                                {sportDisplayName}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4 shrink-0">
                    {isOngoing ? (
                        <div className="flex items-center gap-2 md:gap-3">
                            {rawSportName && (
                                <div className="h-9 w-9 rounded-full bg-muted/50 text-foreground border border-border/60 flex items-center justify-center shrink-0 shadow-xs backdrop-blur-xs">
                                    {getLandingSportIcon(rawSportName, "h-4 w-4")}
                                </div>
                            )}
                            <div className="hidden sm:flex flex-col text-right">
                                <p className="text-[10px] font-bold text-muted-foreground/60 tracking-wider">
                                    {tDashboard("schedule")}
                                </p>
                                <p className="text-xs font-bold text-muted-foreground">
                                    {tournament.start_date && tournament.end_date ? (
                                        tournament.start_date === tournament.end_date
                                            ? new Date(tournament.start_date).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                                            : `${new Date(tournament.start_date).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric', year: '2-digit' })} - ${new Date(tournament.end_date).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric', year: '2-digit' })}`
                                    ) : tournament.start_date ? (
                                        new Date(tournament.start_date).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                                    ) : (
                                        tDashboard("not_specified")
                                    )}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="p-1 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center cursor-pointer"
                                onClick={handleToggleExpand}
                            >
                                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 md:gap-3">
                            {rawSportName && (
                                <div className="h-9 w-9 rounded-full bg-muted/50 text-foreground border border-border/60 flex items-center justify-center shrink-0 shadow-xs backdrop-blur-xs">
                                    {getLandingSportIcon(rawSportName, "h-4 w-4")}
                                </div>
                            )}
                            <div className="flex gap-2 items-center">
                                <div className="h-9 w-9 bg-muted/50 border border-border/60 flex items-center justify-center rounded-full text-primary shrink-0 shadow-xs backdrop-blur-xs">
                                    <Calendar className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-muted-foreground/60 tracking-wider">
                                        {tDashboard("schedule")}
                                    </p>
                                    <p className="text-xs font-bold truncate">
                                        {tournament.start_date && tournament.end_date ? (
                                            tournament.start_date === tournament.end_date
                                                ? new Date(tournament.start_date).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                                                : `${new Date(tournament.start_date).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric', year: '2-digit' })} - ${new Date(tournament.end_date).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric', year: '2-digit' })}`
                                        ) : tournament.start_date ? (
                                            new Date(tournament.start_date).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                                        ) : (
                                            tDashboard("not_specified")
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Expandable Match Schedule Dropdown for Ongoing Tournaments */}
            {isOngoing && (
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="border-t border-border/80 bg-background/50 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-3 md:p-4 space-y-3">
                                {/* Schedule Filter Bar matching /tournaments/[id]?tab=matches */}
                                {matches.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2 bg-card border p-2 rounded-sm">
                                        {/* Date Filter */}
                                        <div className="flex items-center border bg-card rounded-sm h-8 overflow-hidden shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setMatchSelectedDate(null)}
                                                className={cn(
                                                    "px-2.5 h-full text-xs font-semibold tracking-tight transition-all border-r flex items-center shrink-0",
                                                    matchSelectedDate === null
                                                        ? "bg-primary text-black font-bold"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                )}
                                            >
                                                {locale === 'th' ? "ทั้งหมด" : "ALL"}
                                            </button>
                                            <div className="flex items-center justify-between px-1 h-full gap-0.5">
                                                <button 
                                                    type="button"
                                                    onClick={goToPrevDay} 
                                                    className="p-1 hover:text-primary text-muted-foreground transition-colors rounded-sm hover:bg-muted"
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </button>
                                                <Popover open={isMatchCalendarOpen} onOpenChange={setIsMatchCalendarOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-6 px-2 gap-1.5 hover:bg-muted transition-all flex-1 justify-center text-xs">
                                                            <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
                                                            <span className="text-xs font-semibold tracking-tight truncate max-w-[120px]">
                                                                {matchSelectedDate ? formatDate(matchSelectedDate, "d MMM yyyy", locale) : (locale === 'th' ? "วันนี้" : "TODAY")}
                                                            </span>
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-80 p-0 bg-card rounded-sm shadow-2xl" align="start" side="bottom" sideOffset={5}>
                                                        <div className="p-3 border-b flex items-center justify-between bg-muted/20">
                                                            <button 
                                                                type="button"
                                                                onClick={() => setMatchViewDate(subMonths(matchViewDate, 1))} 
                                                                className="p-1 hover:text-primary transition-colors"
                                                            >
                                                                <ChevronLeft className="h-4 w-4" />
                                                            </button>
                                                            <span className="text-xs font-black tracking-widest">
                                                                {matchViewDate.toLocaleString(locale === 'th' ? 'th-TH' : 'en-US', { month: 'long', year: 'numeric' })}
                                                            </span>
                                                            <button 
                                                                type="button"
                                                                onClick={() => setMatchViewDate(addMonths(matchViewDate, 1))} 
                                                                className="p-1 hover:text-primary transition-colors"
                                                            >
                                                                <ChevronRight className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                        <div className="p-4 space-y-4">
                                                            <div className="grid grid-cols-7 gap-1">
                                                                {(locale === 'th' ? ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map((d, idx) => (
                                                                    <div key={`${d}-${idx}`} className="text-[9px] text-center font-black opacity-30">{d}</div>
                                                                ))}
                                                            </div>
                                                            <div className="grid grid-cols-7 gap-1">
                                                                {calendarDays.map((day, i) => {
                                                                    if (!day) return <div key={`empty-${i}`} />;
                                                                    const dateStr = format(day, 'yyyy-MM-dd');
                                                                    const isSel = matchSelectedDate === dateStr;
                                                                    const hasMatch = datesWithMatches.has(dateStr);
                                                                    const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
                                                                    const isOutsideRange = !!((tournament?.start_date && dateStr < tournament.start_date) || (tournament?.end_date && dateStr > tournament.end_date));

                                                                    return (
                                                                        <button
                                                                            key={dateStr}
                                                                            disabled={isOutsideRange}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setMatchSelectedDate(dateStr);
                                                                                setIsMatchCalendarOpen(false);
                                                                            }}
                                                                            className={cn(
                                                                                "h-8 flex flex-col items-center justify-center relative transition-all rounded-xs",
                                                                                isSel ? "bg-primary text-black font-black" : "hover:bg-muted text-muted-foreground hover:text-foreground",
                                                                                isToday && !isSel && "border border-primary text-primary",
                                                                                isOutsideRange && "opacity-20 cursor-not-allowed grayscale"
                                                                            )}
                                                                        >
                                                                            <span className="text-[11px]">{format(day, 'd')}</span>
                                                                            {hasMatch && (
                                                                                <div className={cn(
                                                                                    "absolute bottom-1 h-1 w-1 rounded-full",
                                                                                    isSel ? "bg-black" : "bg-primary"
                                                                                )} />
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setMatchSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                                                                    setMatchViewDate(new Date());
                                                                    setIsMatchCalendarOpen(false);
                                                                }}
                                                                className="w-full text-[10px] font-black tracking-widest h-8 hover:bg-primary hover:text-black hover:border-primary transition-all"
                                                            >
                                                                {locale === 'th' ? "กลับไปที่วันนี้" : "BACK TO TODAY"}
                                                            </Button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                                <button 
                                                    type="button"
                                                    onClick={goToNextDay} 
                                                    className="p-1 hover:text-primary text-muted-foreground transition-colors rounded-sm hover:bg-muted"
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Stage Filter */}
                                        <Select value={matchFilterStage} onValueChange={setMatchFilterStage}>
                                            <SelectTrigger size="sm" className="w-[130px] md:w-[150px] h-8 bg-card text-xs">
                                                <SelectValue placeholder={locale === 'th' ? "รอบการแข่งขัน" : "Stage"} />
                                            </SelectTrigger>
                                            <SelectContent className="bg-card shadow-2xl">
                                                <SelectItem value="all" className="font-semibold text-xs">
                                                    {locale === 'th' ? "ทุกรอบการแข่งขัน" : "ALL STAGES"}
                                                </SelectItem>
                                                <SelectItem value="group" className="font-semibold text-xs">
                                                    {locale === 'th' ? "รอบแบ่งกลุ่ม" : "GROUP STAGE"}
                                                </SelectItem>
                                                <SelectItem value="knockout" className="font-semibold text-xs">
                                                    {locale === 'th' ? "รอบน็อคเอาท์" : "KNOCKOUT STAGE"}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>

                                        {/* Category (รุ่น) Filter Dropdown */}
                                        {availableCategories.length > 0 && (
                                            <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                                                <SelectTrigger size="sm" className="w-[130px] md:w-[150px] h-8 bg-card text-xs">
                                                    <SelectValue placeholder={locale === 'th' ? "เลือกรุ่นการแข่งขัน" : "Category"} />
                                                </SelectTrigger>
                                                <SelectContent className="bg-card shadow-2xl">
                                                    <SelectItem value="all" className="font-semibold text-xs">
                                                        {locale === 'th' ? "ทุกรุ่นการแข่งขัน" : "ALL CATEGORIES"}
                                                    </SelectItem>
                                                    {availableCategories.map((cat) => (
                                                        <SelectItem key={cat.id} value={cat.id} className="font-semibold text-xs">
                                                            รุ่น {cat.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                )}

                                {/* Loading state */}
                                {isLoadingMatches ? (
                                    <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        <span>กำลังโหลดตารางการแข่งขัน...</span>
                                    </div>
                                ) : (
                                    /* MatchManager Component identical to /tournaments/[id]?tab=matches */
                                    <div className="space-y-2">
                                        <MatchManager
                                            matches={filteredMatchesByCategory}
                                            teams={allTeams}
                                            tournamentId={tournament.id}
                                            format={tournament.format}
                                            startDate={tournament.start_date}
                                            endDate={tournament.end_date}
                                            isPublic={true}
                                            canvasData={tournament.canvas_data}
                                            externalFilterStage={matchFilterStage}
                                            externalSelectedDate={matchSelectedDate}
                                        />
                                    </div>
                                )}

                                {/* Bottom direct link to full tournament view */}
                                <div className="pt-2 flex justify-end border-t border-border/40">
                                    <Button asChild size="sm" variant="ghost" className="text-xs font-bold text-primary hover:text-primary/80 gap-1 h-7 px-2">
                                        <Link href={`/tournaments/${tournament.id}?tab=matches`}>
                                            <span>ไปยังหน้ารายการแข่งขันเต็มรูปแบบ</span>
                                            <ArrowUpRight className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );

    if (isOngoing) {
        return (
            <div onClick={handleToggleExpand} className="block group">
                {cardContent}
            </div>
        );
    }

    return (
        <Link href={cardHref} className="block group">
            {cardContent}
        </Link>
    );
}


