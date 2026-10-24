"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { X, Plus, Loader2 } from "lucide-react";
import { useBracketStore } from "@/lib/stores/bracket-store";
import { saveBracketCanvas } from "@/actions/tournaments/bracket";
import { useToast } from "@/hooks/use-toast";
import { isMatchEnded } from "./match-node";
import { Match } from "@/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/dropdown";
import { DateTimePicker } from "@/components/ui/date-time-picker";

export type MatchItem = {
    id: string;
    placeholderA: string;
    placeholderB: string;
    match_date?: string;
    match_time?: string;
    dbId?: string;
    matchId?: string;
};

export interface MatchNodeSettingsProps {
    id: string;
    data: Record<string, any>;
    tournamentId: string;
    activeCategoryId?: string | null;
    dbMatches: Match[];
}

export function MatchNodeSettings({
    id,
    data,
    tournamentId,
    activeCategoryId,
    dbMatches,
}: MatchNodeSettingsProps) {
    const locale = useLocale();
    const router = useRouter();
    const { toast } = useToast();
    const { nodes, edges, teams, updateNodeData, getCanvasData } = useBracketStore();
    const [isCreatingConsoleId, setIsCreatingConsoleId] = React.useState<string | null>(null);

    // Resolve live teams from edges or database assignments
    const getResolvedTeam = React.useCallback(
        (targetId: string, handleId: string, dbMatch: Match | undefined, slot: 'a' | 'b') => {
            // 1. If we have a database match with a team ID assigned, use it
            if (dbMatch) {
                const teamId = slot === 'a' ? dbMatch.home_team_id : dbMatch.away_team_id;
                if (teamId) {
                    const team = teams.find(t => String(t.team_id || t.id) === String(teamId));
                    if (team) return team.name;
                }
            }

            // 2. Fall back to resolved placeholder/ranking/label from edge connections
            const edge = edges.find(e => e.target === targetId && e.targetHandle === handleId);
            if (!edge) return null;

            const sourceNode = nodes.find(n => n.id === edge.source);
            if (!sourceNode) return null;

            // Handle TeamListNode propagation
            if (sourceNode.type === 'teamListNode') {
                const teamIdMatch = edge.sourceHandle?.match(/team-(.+)/);
                if (teamIdMatch) {
                    const teamId = teamIdMatch[1];
                    const team = teams.find(t => String(t.id) === String(teamId) || String(t.team_id) === String(teamId));
                    return team?.name || null;
                }
            }

            // Handle StandingNode/GroupNode propagation
            if (sourceNode.type === 'standingNode' || sourceNode.type === 'groupNode') {
                const rankMatch = edge.sourceHandle?.match(/rank-(\d+)/);
                if (rankMatch) {
                    const rankIndex = parseInt(rankMatch[1], 10);
                    const rankings = (sourceNode.data as { rankings?: string[] }).rankings || [];
                    if (rankings[rankIndex]) return rankings[rankIndex];

                    const rankSuffix = rankIndex === 0 ? "1st" : rankIndex === 1 ? "2nd" : rankIndex === 2 ? "3rd" : `${rankIndex + 1}th`;
                    return `${rankSuffix} Place (${sourceNode.data.label})`;
                }
            }

            // Handle MatchNode propagation (Winner / Loser)
            if (sourceNode.type === 'matchNode') {
                const winnerMatch = edge.sourceHandle?.match(/winner-(\d+)/);
                const loserMatch = edge.sourceHandle?.match(/loser-(\d+)/);
                const isWinnerHandle = !!winnerMatch;
                const matchIdx = winnerMatch ? parseInt(winnerMatch[1], 10) : loserMatch ? parseInt(loserMatch[1], 10) : -1;

                if (matchIdx !== -1) {
                    const sourceMatches = Array.isArray(sourceNode.data.matches) ? (sourceNode.data.matches as any[]) : [];
                    const sourceMatchItem = sourceMatches[matchIdx];

                    const sourceDbMatch = (dbMatches || []).find(m =>
                        (sourceMatchItem?.dbId && m.id === sourceMatchItem.dbId) ||
                        (sourceMatchItem?.matchId && m.id === sourceMatchItem.matchId) ||
                        (m.node_id === sourceNode.id && ((m.idx_match ?? m.match_index) === (matchIdx + 1))) ||
                        (sourceMatchItem && m.placeholder_a === sourceMatchItem.placeholderA && m.placeholder_b === sourceMatchItem.placeholderB) ||
                        (sourceMatchItem && m.ph_home === sourceMatchItem.placeholderA && m.ph_away === sourceMatchItem.placeholderB)
                    );

                    const isSourceEnded = isMatchEnded(sourceDbMatch?.status);

                    if (isSourceEnded && sourceDbMatch) {
                        let winnerTeamId: string | null = sourceDbMatch.winner_id || null;
                        let loserTeamId: string | null = null;

                        const getScoreNum = (score: unknown) => {
                            if (typeof score === 'object' && score !== null && 'total' in score) {
                                return Number((score as { total?: number }).total) || 0;
                            }
                            return Number(score ?? 0);
                        };
                        const homeScore = getScoreNum(sourceDbMatch.home_score);
                        const awayScore = getScoreNum(sourceDbMatch.away_score);

                        if (!winnerTeamId) {
                            if (homeScore > awayScore) {
                                winnerTeamId = sourceDbMatch.home_team_id;
                                loserTeamId = sourceDbMatch.away_team_id;
                            } else if (awayScore > homeScore) {
                                winnerTeamId = sourceDbMatch.away_team_id;
                                loserTeamId = sourceDbMatch.home_team_id;
                            }
                        } else {
                            loserTeamId = winnerTeamId === sourceDbMatch.home_team_id
                                ? sourceDbMatch.away_team_id
                                : sourceDbMatch.home_team_id;
                        }

                        const targetTeamId = isWinnerHandle ? winnerTeamId : loserTeamId;

                        if (targetTeamId) {
                            const team = teams.find(t => String(t.team_id || t.id) === String(targetTeamId));
                            if (team?.name) return team.name;

                            if (String(sourceDbMatch.home_team_id) === String(targetTeamId) && sourceDbMatch.home_team?.name) {
                                return sourceDbMatch.home_team.name;
                            }
                            if (String(sourceDbMatch.away_team_id) === String(targetTeamId) && sourceDbMatch.away_team?.name) {
                                return sourceDbMatch.away_team.name;
                            }
                        }

                        if (!targetTeamId && homeScore !== awayScore) {
                            const isHomeWinner = homeScore > awayScore;
                            const wantHome = isWinnerHandle ? isHomeWinner : !isHomeWinner;
                            const chosen = wantHome ? sourceMatchItem?.placeholderA : sourceMatchItem?.placeholderB;
                            if (chosen && chosen !== 'TBD') return chosen;
                        }
                    }

                    const labelBase = sourceNode.data.label ? `${sourceNode.data.label}` : `Match ${matchIdx + 1}`;
                    if (isWinnerHandle) {
                        return `Winner (${labelBase})`;
                    } else {
                        return `Loser (${labelBase})`;
                    }
                }
            }

            return null;
        },
        [dbMatches, edges, nodes, teams]
    );

    const groupEdge = edges.find(e => e.target === id && e.targetHandle === 'group-in');
    const connectedGroupNode = groupEdge ? nodes.find(n => n.id === groupEdge.source) : null;

    const getSelectOptions = (currentVal: string) => {
        const options = new Set<string>();
        if (connectedGroupNode) {
            const groupTeamCount = (connectedGroupNode.data as { teamCount?: number }).teamCount || 0;
            const groupTeams = (connectedGroupNode.data as { teams?: string[] }).teams || [];
            for (let i = 0; i < groupTeamCount; i++) {
                const name = groupTeams[i];
                options.add((!name || name === "TBD") ? `Team ${i + 1}` : name);
            }
        }
        if (currentVal && currentVal !== "TBD" && !teams.some(t => t.name === currentVal)) {
            options.add(currentVal);
        }
        return Array.from(options);
    };

    const getSelectItems = (optionsList: string[], liveTeam: string | null) => {
        const rendered = new Set<string>();
        rendered.add("TBD");
        if (liveTeam) {
            rendered.add(liveTeam);
        }
        const items: React.ReactNode[] = [];
        optionsList.forEach(opt => {
            if (!rendered.has(opt)) {
                rendered.add(opt);
                items.push(<SelectItem key={opt} value={opt}>{opt}</SelectItem>);
            }
        });
        teams.forEach(t => {
            if (!rendered.has(t.name)) {
                rendered.add(t.name);
                items.push(<SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>);
            }
        });
        return items;
    };

    const sortedMatches = ((data.matches as MatchItem[]) || [])
        .slice()
        .sort((a, b) => {
            const dateA = a.match_date || "9999-12-31";
            const timeA = a.match_time || "23:59";
            const dateB = b.match_date || "9999-12-31";
            const timeB = b.match_time || "23:59";
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return timeA.localeCompare(timeB);
        });

    return (
        <div className="space-y-4" id="node-settings-match-schedule">
            <Label>{locale === "th" ? "รายการแมตช์ในโหนด" : "Matches in Node"}</Label>
            <div className="space-y-4">
                {sortedMatches.map((match, idx) => {
                    const updateMatch = (updates: Partial<MatchItem>) => {
                        const originalMatches = [...((data.matches as MatchItem[]) || [])];
                        const matchIdx = originalMatches.findIndex(m => m.id === match.id);
                        if (matchIdx !== -1) {
                            originalMatches[matchIdx] = { ...originalMatches[matchIdx], ...updates };
                            updateNodeData(id, { matches: originalMatches });
                        }
                    };

                    const dbMatch = dbMatches.find(m =>
                        (match.dbId && m.id === match.dbId) ||
                        (match.matchId && m.id === match.matchId) ||
                        (m.node_id === id && m.match_index === (idx + 1)) ||
                        (m.placeholder_a === match.placeholderA && m.placeholder_b === match.placeholderB)
                    );
                    const liveTeamA = getResolvedTeam(id, `slot-a-${idx}`, dbMatch, 'a');
                    const liveTeamB = getResolvedTeam(id, `slot-b-${idx}`, dbMatch, 'b');

                    const homeOptions = getSelectOptions(match.placeholderA);
                    const awayOptions = getSelectOptions(match.placeholderB);

                    const homeSelectItems = getSelectItems(homeOptions, liveTeamA);
                    const awaySelectItems = getSelectItems(awayOptions, liveTeamB);

                    const matchConsoleId = match.dbId || match.matchId || dbMatch?.id || (!!data.matchId && idx === 0 ? (data.matchId as string) : undefined);

                    return (
                        <div key={match.id || idx} className="p-2 bg-card border rounded-sm space-y-4 relative group">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black">
                                    {locale === "th" ? `แมตช์ที่ #${idx + 1}` : `Match #${idx + 1}`}
                                </span>
                                <button
                                    onClick={() => {
                                        const originalMatches = [...((data.matches as MatchItem[]) || [])];
                                        const filtered = originalMatches.filter(m => m.id !== match.id);
                                        updateNodeData(id, { matches: filtered });
                                    }}
                                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                                    title={locale === "th" ? "ลบแมตช์นี้" : "Delete match"}
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-[10px]">{locale === "th" ? "ทีมเหย้า" : "Home Team"}</Label>
                                    <Select
                                        value={liveTeamA || match.placeholderA}
                                        onValueChange={(val) => updateMatch({ placeholderA: val })}
                                    >
                                        <SelectTrigger size="sm" className={`bg-card w-full ${liveTeamA ? "text-violet-600 font-black" : ""}`}>
                                            <SelectValue placeholder={locale === "th" ? "เลือกทีม" : "Select Team"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TBD">TBD</SelectItem>
                                            {liveTeamA && (
                                                <SelectItem value={liveTeamA} disabled>
                                                    {liveTeamA} (Live)
                                                </SelectItem>
                                            )}
                                            {homeSelectItems}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px]">{locale === "th" ? "ทีมเยือน" : "Away Team"}</Label>
                                    <Select
                                        value={liveTeamB || match.placeholderB}
                                        onValueChange={(val) => updateMatch({ placeholderB: val })}
                                    >
                                        <SelectTrigger size="sm" className={`bg-card w-full ${liveTeamB ? "text-violet-600 font-black" : ""}`}>
                                            <SelectValue placeholder={locale === "th" ? "เลือกทีม" : "Select Team"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TBD">TBD</SelectItem>
                                            {liveTeamB && (
                                                <SelectItem value={liveTeamB} disabled>
                                                    {liveTeamB} (Live)
                                                </SelectItem>
                                            )}
                                            {awaySelectItems}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px]">{locale === "th" ? "วันและเวลาแข่ง" : "Date & Time"}</Label>
                                <DateTimePicker
                                    date={match.match_date}
                                    time={match.match_time}
                                    onChange={(date, time) => {
                                        updateMatch({ match_date: date, match_time: time });
                                    }}
                                    placeholder={locale === "th" ? "เลือกวันและเวลาแข่ง" : "Select date & time"}
                                    size="sm"
                                />
                            </div>

                            <Button
                                variant={dbMatch?.status === 'finished' ? "outline" : "default"}
                                size="sm"
                                className="w-full"
                                disabled={isCreatingConsoleId === `${id}-${idx}`}
                                onClick={async () => {
                                    let targetId = matchConsoleId;
                                    setIsCreatingConsoleId(`${id}-${idx}`);
                                    try {
                                        const canvasData = getCanvasData();
                                        const res = await saveBracketCanvas(tournamentId, canvasData, activeCategoryId || undefined);
                                        if (res.success && res.data) {
                                            const savedNode = res.data.nodes?.find(n => n.id === id);
                                            const savedMatches = (savedNode?.data as { matches?: MatchItem[] })?.matches || [];
                                            const savedMatch = savedMatches[idx];
                                            if (savedMatch?.dbId || savedMatch?.matchId) {
                                                targetId = savedMatch.dbId || savedMatch.matchId;
                                            }
                                        }
                                    } catch (err) {
                                        console.error("Error creating/syncing match console:", err);
                                    } finally {
                                        setIsCreatingConsoleId(null);
                                    }

                                    if (targetId) {
                                        router.push(`/my-tournaments/${tournamentId}/matches/${targetId}`);
                                    } else {
                                        toast({
                                            title: locale === "th" ? "เกิดข้อผิดพลาด" : "Error",
                                            description: locale === "th" ? "ไม่สามารถสร้างห้องแข่งขันได้ กรุณาลองใหม่อีกครั้ง" : "Failed to open match console",
                                            variant: "destructive"
                                        });
                                    }
                                }}
                            >
                                {isCreatingConsoleId === `${id}-${idx}` ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        {locale === "th" ? "กำลังเปิดห้องแข่งขัน..." : "Opening Console..."}
                                    </>
                                ) : dbMatch?.status === 'finished' ? (
                                    locale === "th" ? "ดูผลการแข่งขัน" : "VIEW MATCH"
                                ) : (
                                    locale === "th" ? "จัดการการแข่งขัน" : "MATCH CONSOLE"
                                )}
                            </Button>
                        </div>
                    );
                })}
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                        const next = [...((data.matches as MatchItem[]) || [])];
                        next.push({ id: `m-${Date.now()}-${next.length + 1}`, placeholderA: "TBD", placeholderB: "TBD" });
                        updateNodeData(id, { matches: next });
                    }}
                >
                    <Plus />
                    {locale === "th" ? "เพิ่มแมตช์ใหม่ในโหนด" : "Add Match to Node"}
                </Button>
            </div>
        </div>
    );
}
