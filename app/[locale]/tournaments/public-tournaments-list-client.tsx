"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Search, Trophy, Calendar, CheckCircle2, PlayCircle } from "lucide-react";
import { Tournament } from "@/types";
import { PublicTournamentCard } from "@/features/tournaments/public/public-tournament-card";
import { getPublicTournaments } from "@/actions/public";
import { EmptyState } from "@/components/shared/empty-state";
import { Tab, TabOption } from "@/components/ui/tab";
import { Header } from "@/components/ui/header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/dropdown";
import { TournamentSearchHeader } from "@/features/tournaments/public/tournament-search-bar";
import { isPastDocumentDeadline } from "@/lib/date";

interface SportItem {
    id: string;
    sport_name: string;
}

type ExtendedTournament = Tournament & {
    sport_id?: string;
    sports?: { id: string };
};

const THAI_SPORT_NAMES: Record<string, string> = {
    football: "ฟุตบอล",
    basketball: "บาสเกตบอล",
    volleyball: "วอลเลย์บอล",
    futsal: "ฟุตซอล",
    badminton: "แบดมินตัน",
    cricket: "คริกเก็ต",
    takraw: "เซปักตะกร้อ",
};

type StatusTabValue = "all" | "upcoming" | "ongoing" | "completed";

export function PublicTournamentsListClient({ 
    sports,
    initialTournaments = [],
    showTabs = true,
    onlyUpcoming = false,
    title = "รายการแข่งขันทั้งหมด",
    cardHrefPrefix
}: { 
    sports: SportItem[];
    initialTournaments?: Tournament[];
    showTabs?: boolean;
    onlyUpcoming?: boolean;
    title?: string;
    cardHrefPrefix?: string;
}) {
    const searchParams = useSearchParams();
    const search = searchParams.get("search") || "";
    
    const [selectedSport, setSelectedSport] = useState<string>("all");
    const [activeStatusTab, setActiveStatusTab] = useState<StatusTabValue>("all");
    const [tournaments, setTournaments] = useState<Tournament[]>(initialTournaments);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (initialTournaments && initialTournaments.length > 0) {
            setTournaments(initialTournaments);
        }
    }, [initialTournaments]);

    useEffect(() => {
        if (initialTournaments.length > 0 && !search && selectedSport === "all") {
            return;
        }

        const fetchTournaments = async () => {
            setIsLoading(true);
            try {
                const data = await getPublicTournaments(search, selectedSport);
                if (data && data.length > 0) {
                    setTournaments(data as unknown as Tournament[]);
                }
            } catch (error) {
                console.error("Failed to fetch tournaments:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTournaments();
    }, [search, selectedSport, initialTournaments.length]);

    // Filter tournaments client-side for smooth real-time tab & search filtering
    const filteredTournaments = tournaments.filter(t => {
        const ext = t as ExtendedTournament;
        const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
        const matchesSport = selectedSport === "all" || ext.sport_id === selectedSport || ext.sports?.id === selectedSport;
        return matchesSearch && matchesSport;
    });



    // Categorize status: upcoming (registration phase), ongoing, completed
    const ongoingTournaments = filteredTournaments.filter(t => {
        const s = ((t as ExtendedTournament).status || "").toLowerCase();
        return s === "ongoing" || s === "active";
    });

    const completedTournaments = filteredTournaments.filter(t => {
        const s = ((t as ExtendedTournament).status || "").toLowerCase();
        return s === "finished" || s === "completed";
    });

    // Upcoming / Registration Phase:
    // Tournaments that are upcoming/open for registration/draft/published, AND not ongoing, completed, or cancelled.
    // When on /registrations (onlyUpcoming=true), even if teams are full, it remains visible until document_deadline has passed!
    const upcomingTournaments = filteredTournaments.filter(t => {
        const s = ((t as ExtendedTournament).status || "").toLowerCase();
        if (s === "ongoing" || s === "active" || s === "finished" || s === "completed" || s === "cancelled") {
            return false;
        }
        
        // If registration is closed, remove from upcoming registration list
        const settings = (t as any).settings || {};
        if (t.is_registration_open === false || settings.is_registration_open === false || settings.is_registration_open === "false") {
            return false;
        }

        // If document deadline is specified and has passed, remove from upcoming registration list
        if (isPastDocumentDeadline(t.document_deadline)) {
            return false;
        }

        return true;
    });

    const statusTabOptions: TabOption<StatusTabValue>[] = [
        { value: "all", label: `ทั้งหมด (${filteredTournaments.length})` },
        { value: "upcoming", label: `Upcoming (${upcomingTournaments.length})`, icon: Calendar },
        { value: "ongoing", label: `Ongoing (${ongoingTournaments.length})`, icon: PlayCircle },
        { value: "completed", label: `Completed (${completedTournaments.length})`, icon: CheckCircle2 },
    ];

    const displayTournaments = onlyUpcoming ? upcomingTournaments : filteredTournaments;

    const getCardHref = (tId: string) => cardHrefPrefix ? `${cardHrefPrefix}/${tId}` : undefined;

    return (
        <div className="space-y-2 lg:space-y-4">
            {/* Header & Sports Dropdown Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 lg:gap-4">
                    <Header level={2}>
                        {title}
                    </Header>
                    <div className="w-fit min-w-[150px]">
                        <Select value={selectedSport} onValueChange={setSelectedSport}>
                            <SelectTrigger className="bg-card">
                                <SelectValue placeholder="เลือกชนิดกีฬา" />
                            </SelectTrigger>
                            <SelectContent className="bg-card">
                                <SelectItem value="all">
                                    ทั้งหมด (ทุกกีฬา)
                                </SelectItem>
                                {sports.map((sport) => (
                                    <SelectItem key={sport.id} value={sport.id}>
                                        {THAI_SPORT_NAMES[sport.sport_name.toLowerCase()] || sport.sport_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="w-full md:w-80">
                    <TournamentSearchHeader />
                </div>
            </div>

            {/* Status Tabs */}
            {showTabs && (
                <div className="w-full">
                    <Tab
                        options={statusTabOptions}
                        value={activeStatusTab}
                        onChange={(val) => setActiveStatusTab(val)}
                        className="w-max min-w-full"
                    />
                </div>
            )}

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 bg-muted/5 border border-dashed rounded-sm mt-6">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground font-semibold text-sm">กำลังโหลดรายการแข่งขัน...</p>
                </div>
            ) : displayTournaments.length === 0 ? (
                <EmptyState
                    icon={search ? Search : Trophy}
                    title={search ? "ไม่พบรายการแข่งขัน" : "ยังไม่มีรายการแข่งขันเปิดรับสมัคร"}
                    description={search ? `ไม่พบผลการค้นหาสำหรับ "${search}"` : "ยังไม่มีรายการแข่งขันในขณะนี้"}
                    className="bg-card rounded-sm border"
                />
            ) : !showTabs ? (
                    <div className="bg-card border rounded-sm divide-y divide-border overflow-hidden">
                    {displayTournaments.map((tournament) => (
                        <PublicTournamentCard key={tournament.id} tournament={tournament} href={getCardHref(tournament.id)} />
                    ))}
                </div>
            ) : (
                <div>
                    {/* Tab: All */}
                    {activeStatusTab === "all" && (
                            <div className="bg-card border rounded-sm divide-y divide-border overflow-hidden">
                            {filteredTournaments.map((tournament) => (
                                <PublicTournamentCard key={tournament.id} tournament={tournament} href={getCardHref(tournament.id)} />
                            ))}
                        </div>
                    )}

                    {/* Tab: Upcoming */}
                    {activeStatusTab === "upcoming" && (
                        upcomingTournaments.length === 0 ? (
                            <EmptyState
                                icon={Calendar}
                                title="ไม่มีรายการแข่งขันที่กำลังจะมาถึง"
                                className="bg-card rounded-sm border"
                            />
                        ) : (
                                <div className="bg-card border rounded-sm divide-y divide-border overflow-hidden">
                                {upcomingTournaments.map((tournament) => (
                                    <PublicTournamentCard key={tournament.id} tournament={tournament} href={getCardHref(tournament.id)} />
                                ))}
                            </div>
                        )
                    )}

                    {/* Tab: Ongoing */}
                    {activeStatusTab === "ongoing" && (
                        ongoingTournaments.length === 0 ? (
                            <EmptyState
                                icon={PlayCircle}
                                title="ไม่มีรายการแข่งขันที่กำลังดำเนินการอยู่"
                                className="bg-card rounded-sm border"
                            />
                        ) : (
                                <div className="bg-card border rounded-sm divide-y divide-border overflow-hidden">
                                {ongoingTournaments.map((tournament) => (
                                    <PublicTournamentCard key={tournament.id} tournament={tournament} href={getCardHref(tournament.id)} />
                                ))}
                            </div>
                        )
                    )}

                    {/* Tab: Completed */}
                    {activeStatusTab === "completed" && (
                        completedTournaments.length === 0 ? (
                            <EmptyState
                                icon={CheckCircle2}
                                title="ไม่มีรายการแข่งขันที่เสร็จสิ้นแล้ว"
                                className="bg-card rounded-sm border"
                            />
                        ) : (
                                <div className="bg-card border rounded-sm divide-y divide-border overflow-hidden">
                                {completedTournaments.map((tournament) => (
                                    <PublicTournamentCard key={tournament.id} tournament={tournament} href={getCardHref(tournament.id)} />
                                ))}
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
}

