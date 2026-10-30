"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
    Background,
    BackgroundVariant,
    ConnectionMode,
    ReactFlow,
    ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GroupNode } from "@/features/tournaments/builder/group-node";
import { MatchNode } from "@/features/tournaments/builder/match-node";
import { EmptyState } from "@/components/shared/empty-state";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { BracketCanvasData, Match } from "@/types/index";
import { useBracketStore } from "@/lib/stores/bracket-store";
import { Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
const getScore = (score: number | { total?: number } | null | undefined): number | null => {
    if (score === null || score === undefined) return null;
    if (typeof score === 'object') return score.total ?? 0;
    return score;
};
const nodeTypes = {
    matchNode: MatchNode,
    groupNode: GroupNode,
    standingNode: GroupNode,
};

const CONNECTOR_W = 48;
const CARD_W = 232;
const MATCH_SLOT_H = 80;
const MATCH_GAP = 12;
type KnockoutStage = Exclude<Match["stage"], "league" | "group" | "knockout">;

interface BracketProps {
    matches: Match[];
    canvasData?: BracketCanvasData | null;
    isPublic?: boolean;
}

function CanvasBracket({ canvasData, matches }: { canvasData: BracketCanvasData; matches?: Match[] }) {
    useEffect(() => {
        if (matches && matches.length > 0) {
            useBracketStore.getState().setMatches(matches);
        }
    }, [matches]);

    if (canvasData.nodes.length === 0) {
        return null;
    }

    return (
        <div className="h-[600px] w-full border bg-card overflow-hidden relative">
            <ReactFlow
                nodes={canvasData.nodes}
                edges={canvasData.edges}
                nodeTypes={nodeTypes}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                zoomOnScroll={false}
                panOnScroll={false}
                panOnDrag={false}
                zoomOnPinch={false}
                zoomOnDoubleClick={false}
                colorMode="light"
                connectionMode={ConnectionMode.Loose}
                defaultEdgeOptions={{
                    type: "bezier",
                    style: {
                        strokeWidth: 3,
                    },
                }}
            >
                <Background
                    color="hsl(var(--muted-foreground))"
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    style={{ opacity: 0.15 }}
                />
            </ReactFlow>
        </div>
    );
}

function LegacyBracket({ matches, isPublic = false }: { matches: Match[]; isPublic?: boolean }) {
    const t = useTranslations("Bracket");
    const [cardHeight, setCardHeight] = useState(MATCH_SLOT_H);
    const measureRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!measureRef.current) {
            return;
        }

        const height = measureRef.current.getBoundingClientRect().height;
        if (height > 0) {
            setCardHeight(height);
        }
    }, []);

    const knockoutMatches = matches.filter(
        (match) => match.stage !== "league" && match.stage !== "group"
    );

    if (knockoutMatches.length === 0) {
        return (
            <EmptyState
                icon={Trophy}
                title={t("no_knockout")}
                description="Knockout rounds will appear here once group stages are complete or matches are generated"
                className="py-12"
            />
        );
    }

    const allStages: KnockoutStage[] = [
        "round_of_64",
        "round_of_32",
        "round_of_16",
        "quarter_final",
        "semi_final",
        "final",
    ];
    const stageLabels: Record<KnockoutStage, string> = {
        round_of_64: t("round_of_64"),
        round_of_32: t("round_of_32"),
        round_of_16: t("round_of_16"),
        quarter_final: t("quarter_final"),
        semi_final: t("semi_final"),
        final: t("final"),
    };
    const matchesByStage = knockoutMatches.reduce<Record<string, Match[]>>((accumulator, match) => {
        if (!accumulator[match.stage]) {
            accumulator[match.stage] = [];
        }
        accumulator[match.stage].push(match);
        return accumulator;
    }, {});
    const activeStages = allStages.filter((stage) => (matchesByStage[stage]?.length ?? 0) > 0);
    const baseSlotHeight = cardHeight + MATCH_GAP;

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="absolute opacity-0 pointer-events-none" style={{ width: CARD_W }}>
                <div ref={measureRef}>
                    <BracketMatchCard match={knockoutMatches[0]} isPublic={isPublic} />
                </div>
            </div>

            <div className="w-full overflow-auto custom-scrollbar scroll-smooth">
                <div id="tournament-bracket-canvas" className="inline-flex items-start">
                    {activeStages.map((stage, stageIndex) => {
                        const stageMatches = [...(matchesByStage[stage] ?? [])].sort(
                            (a, b) => (a.match_index ?? 0) - (b.match_index ?? 0)
                        );
                        const isFinal = stage === "final";
                        const isLast = stageIndex === activeStages.length - 1;
                        const slotHeight = baseSlotHeight * Math.pow(2, stageIndex);

                        return (
                            <div key={stage} className="flex flex-col shrink-0">
                                <div
                                    className="text-center mb-4 md:mb-6 pr-12"
                                    style={{ width: CARD_W + (!isLast ? CONNECTOR_W : 0) }}
                                >
                                    <span className="text-xs font-black tracking-tighter text-primary bg-primary/10 px-3 py-1">
                                        {stageLabels[stage]}
                                    </span>
                                </div>

                                <div className="flex flex-col">
                                    {stageMatches.map((match, index) => (
                                        <BracketSlot
                                            key={match.id}
                                            match={match}
                                            slotHeight={slotHeight}
                                            isFinal={isFinal}
                                            showConnector={!isLast}
                                            isTopOfPair={index % 2 === 0}
                                            isBottomOfPair={index % 2 === 1}
                                            hasPairPartner={!isFinal && stageMatches.length > 1}
                                            isPublic={isPublic}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export function Bracket({ matches, canvasData, isPublic = false }: BracketProps) {
    const hasCanvasData = (canvasData?.nodes.length ?? 0) > 0;

    return (
        <ReactFlowProvider>
            {hasCanvasData && canvasData ? (
                <CanvasBracket canvasData={canvasData} matches={matches} />
            ) : (
                <LegacyBracket matches={matches} isPublic={isPublic} />
            )}
        </ReactFlowProvider>
    );
}

function BracketSlot({
    match,
    slotHeight,
    isFinal,
    showConnector,
    isTopOfPair,
    isBottomOfPair,
    hasPairPartner,
    isPublic,
}: {
    match: Match;
    slotHeight: number;
    isFinal: boolean;
    showConnector: boolean;
    isTopOfPair: boolean;
    isBottomOfPair: boolean;
    hasPairPartner: boolean;
    isPublic?: boolean;
}) {
    return (
        <div className="flex items-center relative" style={{ height: slotHeight }}>
            <div style={{ width: CARD_W }} className="shrink-0">
                <BracketMatchCard match={match} isFinal={isFinal} isPublic={isPublic} />
            </div>

            {showConnector && (
                <div className="relative shrink-0" style={{ width: CONNECTOR_W, alignSelf: "stretch" }}>
                    <div
                        className="absolute bg-primary"
                        style={{
                            left: 0,
                            top: "50%",
                            width: CONNECTOR_W / 2,
                            height: 1,
                            transform: "translateY(-0.5px)",
                        }}
                    />

                    {hasPairPartner ? (
                        <>
                            {isTopOfPair && (
                                <div
                                    className="absolute bg-primary"
                                    style={{
                                        left: CONNECTOR_W / 2 - 0.5,
                                        top: "50%",
                                        width: 1,
                                        bottom: 0,
                                    }}
                                />
                            )}
                            {isBottomOfPair && (
                                <>
                                    <div
                                        className="absolute bg-primary"
                                        style={{
                                            left: CONNECTOR_W / 2 - 0.5,
                                            top: 0,
                                            width: 1,
                                            height: "50%",
                                        }}
                                    />
                                    <div
                                        className="absolute bg-primary"
                                        style={{
                                            left: CONNECTOR_W / 2,
                                            top: 0,
                                            width: CONNECTOR_W / 2,
                                            height: 1,
                                        }}
                                    />
                                </>
                            )}
                        </>
                    ) : (
                        <div
                            className="absolute bg-primary"
                            style={{
                                left: CONNECTOR_W / 2,
                                top: "50%",
                                width: CONNECTOR_W / 2,
                                height: 1,
                                transform: "translateY(-0.5px)",
                            }}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

function BracketMatchCard({ match, isFinal, isPublic }: { match: Match; isFinal?: boolean; isPublic?: boolean }) {
    const t = useTranslations("Bracket");
    const tournamentId = match.tournament_id;
    const isFinished = match.status === "finished";
    const isScheduled = match.status === "scheduled";
    const homeWinner = match.winner_id && match.winner_id === match.home_team_id;
    const awayWinner = match.winner_id && match.winner_id === match.away_team_id;
    const hasPenalties = !isScheduled && ((match.penalty_home_score ?? 0) > 0 || (match.penalty_away_score ?? 0) > 0);
    const url = isPublic
        ? `/${tournamentId}/matches/${match.id}`
        : `/my-tournaments/${tournamentId}/matches/${match.id}`;

    return (
        <Link
            href={url}
            className={cn(
                "flex flex-col border bg-card overflow-hidden text-sm relative transition-all group",
                isFinal && "border-primary"
            )}
        >
            <div className="flex justify-between items-center px-2 md:px-3 py-1.5 border-b">
                <span className="text-[10px] font-black tracking-widest text-muted-foreground flex items-center gap-2 md:gap-3">
                    {isFinal && <Trophy className="h-4 w-4 text-primary" />}
                    {t("match")} {match.match_index != null ? `#${match.match_index}` : ""}
                </span>
                <div className="flex items-center gap-1">
                    {match.status === "live" && (
                        <div className="flex items-center gap-1">
                            <span className="h-2 w-2 bg-destructive rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-destructive tracking-tighter">
                                {t("live")}
                            </span>
                        </div>
                    )}
                    {isFinished && (
                        <span className="text-[10px] font-black text-muted-foreground tracking-tighter">
                            {t("ft")}
                        </span>
                    )}
                </div>
            </div>

            <TeamRow
                name={match.home_team?.name}
                logoUrl={match.home_team?.logo_url}
                score={isScheduled ? null : getScore(match.home_score)}
                penaltyScore={hasPenalties ? match.penalty_home_score : undefined}
                isWinner={Boolean(homeWinner)}
                tbd={t("tbd")}
            />
            <TeamRow
                name={match.away_team?.name}
                logoUrl={match.away_team?.logo_url}
                score={isScheduled ? null : getScore(match.away_score)}
                penaltyScore={hasPenalties ? match.penalty_away_score : undefined}
                isWinner={Boolean(awayWinner)}
                tbd={t("tbd")}
            />
        </Link>
    );
}

function TeamRow({
    name,
    logoUrl,
    score,
    penaltyScore,
    isWinner,
    tbd,
}: {
    name?: string;
    logoUrl?: string | null;
    score: number | null | undefined;
    penaltyScore?: number | null;
    isWinner: boolean;
    tbd: string;
}) {
    return (
        <div
            className={cn(
                "flex justify-between items-center px-3 py-2 gap-2 transition-colors relative",
                isWinner && "bg-primary/10"
            )}
        >
            <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
                <div className="h-4 w-4 border shrink-0 flex items-center justify-center overflow-hidden">
                    {logoUrl ? (
                        <Image src={logoUrl} width={20} height={20} className="w-full h-full object-contain" alt="" unoptimized />
                    ) : (
                        <span className="text-sm font-black text-muted-foreground capitalize">
                            {name?.charAt(0) || "?"}
                        </span>
                    )}
                </div>
                <span
                    className={cn(
                        "truncate text-xs font-black tracking-tighter transition-colors",
                        isWinner ? "text-primary" : "text-foreground"
                    )}
                >
                    {name || tbd}
                </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {penaltyScore != null && (
                    <span className="text-xs font-black text-muted-foreground">
                        ({penaltyScore})
                    </span>
                )}
                <span
                    className={cn(
                        "text-xs min-w-[16px] text-center font-black tracking-tighter",
                        isWinner ? "text-primary" : "text-foreground"
                    )}
                >
                    {score ?? "-"}
                </span>
            </div>
        </div>
    );
}
