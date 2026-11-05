"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Match, Team, BracketCanvasData } from "@/types/index";
import { MatchCard } from "@/features/tournaments/matches/match-card";
import { Calendar as CalendarIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/lib/date";
import { useBracketStore } from "@/lib/stores/bracket-store";

interface FixturesManagerProps {
    teams: Team[];
    matches: Match[];
    tournamentId: string;
    sport?: string;
    format?: string;
    isPro?: boolean;
    hideControls?: boolean;
    startDate?: string | null;
    endDate?: string | null;
    externalEditMode?: boolean;
    externalFilterStage?: string;
    externalSelectedDate?: string | null;
    isPublic?: boolean;
    canvasData?: BracketCanvasData | null;
}

export function MatchManager({
    matches,
    teams,
    tournamentId,
    sport,
    externalFilterStage = "all",
    externalSelectedDate = null,
    isPublic = false,
    canvasData = null
}: FixturesManagerProps) {
    const _tMatch = useTranslations("Match");
    const tFixtures = useTranslations("Fixtures");
    const _tBracket = useTranslations("Bracket");
    const locale = useLocale();

    const [filterStage, setFilterStage] = useState<string>(externalFilterStage);
    const [selectedDate, setSelectedDate] = useState<string | null>(externalSelectedDate);

    // Sync external states
    useEffect(() => {
        setFilterStage(externalFilterStage);
    }, [externalFilterStage]);

    useEffect(() => {
        setSelectedDate(externalSelectedDate);
    }, [externalSelectedDate]);

    // Filter Logic
    const filteredMatches = matches.filter(match => {
        // Date Filter
        const matchesDate = !selectedDate || match.match_date === selectedDate;
        if (!matchesDate) return false;

        // Stage Filter
        if (filterStage === "all") return true;
        if (filterStage === "knockout") {
            return match.stage !== 'group' && match.stage !== 'league';
        }
        if (filterStage.toLowerCase() !== "group" && (filterStage.startsWith("Group") || filterStage.toLowerCase().startsWith("group"))) {
            const parts = filterStage.split(" ");
            const groupLetter = parts[parts.length - 1];
            if (match.stage !== 'group') return false;

            // 1. Check if home or away team belongs to this group
            const homeGroup = teams.find(t => t.id === match.home_team_id)?.group_name;
            const awayGroup = teams.find(t => t.id === match.away_team_id)?.group_name;
            if (homeGroup === groupLetter || awayGroup === groupLetter) return true;

            // 2. Check if the match node label contains this group
            let nodeLabel = "";
            if (match.node_id) {
                try {
                    const storeNodes = useBracketStore.getState().nodes;
                    const node = storeNodes.find(n => n.id === match.node_id);
                    if (node?.data?.label) nodeLabel = String(node.data.label);
                } catch {}

                if (!nodeLabel && canvasData?.nodes) {
                    const node = canvasData.nodes.find((n) => n.id === match.node_id);
                    if (node?.data?.label) nodeLabel = String(node.data.label);
                }
            }

            if (nodeLabel) {
                const lowerLabel = nodeLabel.toLowerCase();
                if (lowerLabel.includes(`group ${groupLetter.toLowerCase()}`)) return true;
            }

            return false;
        }
        return match.stage === filterStage;
    });

    // Group matches by date and stage
    const groupedMatches = filteredMatches.reduce((acc: Record<string, Record<string, Match[]>>, match) => {
        const date = match.match_date || "TBD";

        // Determine stage label: น็อคเอาท์ หรือ รอบแบ่งกลุ่ม หรือ ลีก
        let stageLabel = "";
        const isGroup = match.stage === 'group';
        const isLeague = match.stage === 'league';

        if (isGroup) {
            stageLabel = locale === 'th' ? "รอบแบ่งกลุ่ม" : "GROUP STAGE";
        } else if (isLeague) {
            stageLabel = locale === 'th' ? "ลีก" : "LEAGUE";
        } else {
            // All knockout stages (round_of_64, round_of_32, round_of_16, quarter_final, semi_final, final, knockout)
            stageLabel = locale === 'th' ? "น็อคเอาท์" : "KNOCKOUT";
        }

        if (!acc[date]) acc[date] = {};
        if (!acc[date][stageLabel]) acc[date][stageLabel] = [];
        acc[date][stageLabel].push(match);
        return acc;
    }, {});

    const sortedDates = Object.keys(groupedMatches)
        .sort((a, b) => {
            if (a === "TBD" && b === "TBD") return 0;
            if (a === "TBD") return 1;
            if (b === "TBD") return -1;
            return a.localeCompare(b);
        });

    return (
        <div>
            {matches.length === 0 ? (
                <EmptyState
                    icon={CalendarIcon}
                    title={tFixtures("ready_to_start")}
                    description={tFixtures("generate_instruction")}
                    className="border rounded-sm"
                />
            ) : (
                <div id="fixtures-canvas" className="space-y-1 md:space-y-2">
                    {filteredMatches.length === 0 ? (
                        <EmptyState
                            title={locale === 'th' ? "ไม่พบการแข่งขัน" : "NO MATCHES FOUND"}
                            description={locale === 'th' ? "ปรับการกรองของคุณหรือเลือกวันที่อื่นเพื่อดูข้อมูลการแข่งขันเพิ่มเติม" : "Adjust your filters or select a different date to see more fixtures."}
                            icon={CalendarIcon}
                        />
                    ) : (
                        sortedDates.map(date => (
                            <div key={date} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                {/* Date Header */}
                                <div className="flex items-center gap-1 md:gap-2 mb-1">
                                    <h2 className="text-xs md:text-sm font-bold tracking-tight text-foreground">
                                        {date !== "TBD" 
                                            ? formatDate(date, "EEEE, d MMM yyyy", locale)
                                            : (locale === 'th' ? "ยังไม่กำหนดวันแข่งขัน (TBD)" : "TBD (Date to be announced)")
                                        }
                                    </h2>
                                </div>

                                <div className="space-y-2 md:space-y-3">
                                    {Object.entries(groupedMatches[date]).map(([stageLabel, stageMatches]) => (
                                        <div key={stageLabel} className="space-y-1 md:space-y-1.5">
                                            {/* Stage Header */}
                                            <div className="flex items-center gap-1.5 md:gap-2 group/stage py-0.5">
                                                <div className="h-px flex-1 bg-primary/50" />
                                                <div className="flex flex-col">
                                                    <h4 className="text-[10px] md:text-xs font-bold tracking-wider text-primary uppercase">
                                                        {stageLabel}
                                                    </h4>
                                                </div>
                                                <div className="h-px flex-1 bg-primary/50" />
                                            </div>

                                            <div className="border bg-card rounded-sm divide-y overflow-hidden">
                                                {stageMatches
                                                    .sort((a, b) => (a.match_time || "") > (b.match_time || "") ? 1 : -1)
                                                    .map((match) => (
                                                        <div key={match.id} className="relative group overflow-hidden">
                                                            <MatchCard
                                                                match={match}
                                                                tournamentId={tournamentId}
                                                                isEditMode={false}
                                                                isPublic={isPublic}
                                                                teams={teams}
                                                                canvasData={canvasData}
                                                                sport={sport}
                                                            />
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
