"use client";

import React, { memo, useState, useMemo, useEffect } from "react";
import Image from "next/image";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Handle, Position, NodeProps, type Node as FlowNode, useUpdateNodeInternals } from "@xyflow/react";
import { useBracketStore, type DrawNodeData } from "@/lib/stores/bracket-store";
import {
    Dices, Shuffle, Shield, Layers, GitBranch, ArrowLeftRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import { useLocale } from "next-intl";

export const DrawNode = memo(({
    id,
    data,
    selected,
}: NodeProps<FlowNode<DrawNodeData>>) => {
    const locale = useLocale();
    const isThai = locale === "th";

    const {
        edges,
        shuffleDrawNode,
        updateDrawPair,
        swapDrawPairSlots,
        generateNextRoundFromDraw,
        teams: storeTeams = [],
        setActiveNodeId,
        selectNode,
    } = useBracketStore();

    const [isShuffling, setIsShuffling] = useState(false);

    const teams = useMemo(() => Array.isArray(data.teams) ? data.teams : [], [data.teams]);
    const drawnPairs = useMemo(() => Array.isArray(data.drawnPairs) ? data.drawnPairs : [], [data.drawnPairs]);

    const updateNodeInternals = useUpdateNodeInternals();
    useEffect(() => {
        updateNodeInternals(id);
    }, [id, drawnPairs, teams, updateNodeInternals]);

    // Team Lookup map for logos
    const teamLookup = useMemo(() => {
        const map = new Map<string, { logoUrl?: string | null }>();
        storeTeams.forEach((item) => {
            const t = item as any;
            const name = t.team?.name || t.name;
            if (name) {
                const logoUrl = t.team?.logo_img || t.team?.logo_url || t.logo_img || t.logo_url || null;
                map.set(name.trim().toLowerCase(), { logoUrl });
            }
        });
        return map;
    }, [storeTeams]);

    const getInitials = (n: string) => {
        const parts = n.trim().split(/\s+/);
        if (parts.length > 1 && parts[0] && parts[1]) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return n.slice(0, 2).toUpperCase();
    };

    const handleShuffle = () => {
        if (teams.length < 2) return;
        setIsShuffling(true);
        setTimeout(() => {
            shuffleDrawNode(id);
            setIsShuffling(false);
        }, 500);
    };

    const renderTeamLogo = (name: string) => {
        const isTbd = !name || name === "TBD";
        const info = !isTbd ? teamLookup.get(name.trim().toLowerCase()) : null;

        return (
            <div className="w-6 h-6 rounded-full border border-border/60 bg-muted/50 flex items-center justify-center overflow-hidden shrink-0 transition-all group-hover/team:border-node-4/50 group-hover/team:bg-node-4/10 group-hover/pair:border-node-4/50 group-hover/pair:bg-node-4/10 hover:border-node-4/50 hover:bg-node-4/10">
                {info?.logoUrl ? (
                    <Image
                        src={info.logoUrl}
                        alt={name}
                        width={24}
                        height={24}
                        className="w-full h-full object-cover"
                    />
                ) : !isTbd ? (
                    <span className="text-[9px] font-black text-muted-foreground group-hover/team:text-node-4 group-hover/pair:text-node-4 hover:text-node-4 transition-colors">
                        {getInitials(name)}
                    </span>
                ) : (
                    <Shield className="size-4 text-muted-foreground/60 group-hover/team:text-node-4/70 group-hover/pair:text-node-4/70 hover:text-node-4/70 transition-colors" />
                )}
            </div>
        );
    };

    const renderEditableTeam = (
        pairIdx: number,
        slot: "teamA" | "teamB",
        teamName: string,
        opponentName?: string
    ) => {
        const isLeft = slot === "teamA";
        const isTbd = !teamName || teamName === "TBD";

        return (
            <div
                className={cn(
                    "flex flex-1 items-center gap-2 min-w-0 group/team",
                    isLeft ? "justify-end text-right" : "justify-start text-left"
                )}
            >
                {/* On left slot (Team A / Home): Dropdown is on left, Avatar is on right (next to VS) */}
                {isLeft ? (
                    <>
                        <Select
                            value={teamName || "TBD"}
                            onValueChange={(val) => updateDrawPair(id, pairIdx, slot, val)}
                        >
                            <SelectPrimitive.Trigger asChild>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        (e.nativeEvent as any)?.stopImmediatePropagation?.();
                                    }}
                                    className="flex flex-1 items-center justify-end min-w-0 h-6 px-1 rounded-sm hover:bg-muted/50 transition-colors cursor-pointer nodrag group/team outline-none"
                                    title={isThai ? "คลิกเพื่อสลับหรือเลือกทีมนี้ใหม่" : "Click to select or swap team"}
                                >
                                    <span
                                        className={cn(
                                            "text-xs font-bold truncate max-w-full group-hover/team:text-node-4 transition-colors text-right",
                                            isTbd ? "text-muted-foreground italic font-normal" : "text-foreground"
                                        )}
                                    >
                                        {teamName || "TBD"}
                                    </span>
                                </button>
                            </SelectPrimitive.Trigger>
                            <SelectContent
                                position="popper"
                                align="start"
                                className="min-w-[190px] max-h-60 z-50"
                            >
                                <SelectItem value="TBD">
                                    <span className="flex items-center gap-2">
                                        {renderTeamLogo("TBD")}
                                        <span className="text-muted-foreground">TBD</span>
                                    </span>
                                </SelectItem>
                                {teams.map((t) => {
                                    const isOpponent = Boolean(opponentName && t.trim().toLowerCase() === opponentName.trim().toLowerCase());
                                    return (
                                        <SelectItem key={`side-${slot}-${t}`} value={t} disabled={isOpponent}>
                                            <span className="flex items-center gap-2 min-w-0">
                                                {renderTeamLogo(t)}
                                                <span className="truncate font-semibold">
                                                    {t}
                                                    {isOpponent ? (isThai ? " (คู่แข่ง)" : " (Opponent)") : ""}
                                                </span>
                                            </span>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        {renderTeamLogo(teamName)}
                    </>
                ) : (
                    <>
                        {/* On right slot (Team B / Away): Avatar is on left (next to VS), Dropdown is on right */}
                        {renderTeamLogo(teamName)}
                        <Select
                            value={teamName || "TBD"}
                            onValueChange={(val) => updateDrawPair(id, pairIdx, slot, val)}
                        >
                            <SelectPrimitive.Trigger asChild>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        (e.nativeEvent as any)?.stopImmediatePropagation?.();
                                    }}
                                    className="flex flex-1 items-center justify-start min-w-0 h-6 px-1 rounded-sm hover:bg-muted/50 transition-colors cursor-pointer nodrag group/team outline-none"
                                    title={isThai ? "คลิกเพื่อสลับหรือเลือกทีมนี้ใหม่" : "Click to select or swap team"}
                                >
                                    <span
                                        className={cn(
                                            "text-xs font-bold truncate max-w-full group-hover/team:text-node-4 transition-colors text-left",
                                            isTbd ? "text-muted-foreground italic font-normal" : "text-foreground"
                                        )}
                                    >
                                        {teamName || "TBD"}
                                    </span>
                                </button>
                            </SelectPrimitive.Trigger>
                            <SelectContent
                                position="popper"
                                align="end"
                                className="min-w-[190px] max-h-60 z-50"
                            >
                                <SelectItem value="TBD">
                                    <span className="flex items-center gap-2">
                                        {renderTeamLogo("TBD")}
                                        <span className="text-muted-foreground">TBD</span>
                                    </span>
                                </SelectItem>
                                {teams.map((t) => {
                                    const isOpponent = Boolean(opponentName && t.trim().toLowerCase() === opponentName.trim().toLowerCase());
                                    return (
                                        <SelectItem key={`side-${slot}-${t}`} value={t} disabled={isOpponent}>
                                            <span className="flex items-center gap-2 min-w-0">
                                                {renderTeamLogo(t)}
                                                <span className="truncate font-semibold">
                                                    {t}
                                                    {isOpponent ? (isThai ? " (คู่แข่ง)" : " (Opponent)") : ""}
                                                </span>
                                            </span>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </>
                )}
            </div>
        );
    };

    const hasOutgoingEdge = edges.some((e) => e.source === id);

    return (
        <div
            onClick={(e) => {
                const target = e.target as HTMLElement | null;
                if (target?.closest('button, input, select, [role="combobox"], [data-slot], .nodrag')) {
                    return;
                }
                setActiveNodeId(id);
                selectNode(id);
            }}
            className={cn(
                "relative w-[380px] border bg-card text-card-foreground overflow-hidden transition-all cursor-pointer rounded-sm shadow-md",
                selected ? "border-node-4" : "border-node-4/50 hover:border-node-4"
            )}
        >
            {/* Single Center Input Handle (Left: anchored at the exact vertical center of the node) */}
            <Handle
                type="target"
                position={Position.Left}
                id="draw-in"
                className="!opacity-0 !bg-transparent !border-0 !w-4 cursor-crosshair z-20 pointer-events-auto"
                style={{
                    left: "-2px",
                    top: "50%",
                    height: "64px",
                    transform: "translateY(-50%)",
                }}
                title={isThai ? "รับทีมเข้าสู่โถสุ่ม (ตรงกลาง)" : "Connect to draw pool (center)"}
            />

            {/* Fallback handles for any existing draw-in-idx edges so they also converge at the exact same center point */}
            {Array.from({ length: 8 }).map((_, idx) => (
                <Handle
                    key={`draw-in-${idx}`}
                    type="target"
                    position={Position.Left}
                    id={`draw-in-${idx}`}
                    className="!opacity-0 !bg-transparent !border-0 !w-1 !h-1 pointer-events-none z-0"
                    style={{
                        left: "-2px",
                        top: "50%",
                        height: "1px",
                        transform: "translateY(-50%)",
                    }}
                />
            ))}

            {/* General Output Handle (Right: anchored at the exact vertical center of the node) */}
            <Handle
                type="source"
                position={Position.Right}
                id="draw-out"
                className={cn(
                    "!opacity-0 !bg-transparent !border-0 !w-4 cursor-crosshair",
                    (hasOutgoingEdge || drawnPairs.length > 0) ? "z-0 pointer-events-none" : "z-20 pointer-events-auto"
                )}
                style={{
                    right: "-2px",
                    top: "50%",
                    height: "64px",
                    transform: "translateY(-50%)",
                }}
                title={isThai ? "ลากเส้นเชื่อมต่อไปยังรอบถัดไป (จากตรงกลางโหนด)" : "Connect to next round (from center)"}
            />

            <div className="overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-node-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="size-6 rounded-sm flex items-center justify-center shrink-0">
                            <Dices className={cn("size-4", isShuffling && "animate-spin")} />
                        </div>
                        <span className="text-xs font-bold truncate">
                            {data.label || (isThai ? "สุ่มจับสลากรอบต่อไป" : "Random Draw / Shuffle")}
                        </span>
                    </div>
                    <span className="text-xs font-bold shrink-0">
                        {teams.length} {isThai ? "ทีม" : "Teams"}
                    </span>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    {teams.length === 0 && (
                        <div className="p-3 border border-dashed rounded-sm bg-muted/20 text-center">
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {isThai
                                    ? "ลากเส้นเชื่อมทีมจากรอบก่อนหน้าเข้ามาที่นี่เพื่อสุ่มจับสลาก"
                                    : "Connect incoming teams here to draw"}
                            </p>
                        </div>
                    )}

                    {/* Shuffle Draw Action */}
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                            e.stopPropagation();
                            (e.nativeEvent as any)?.stopImmediatePropagation?.();
                            handleShuffle();
                        }}
                        disabled={teams.length < 2 || isShuffling}
                        className="w-full text-node-4 transition-colors"
                    >
                        <Shuffle className={cn("size-4", isShuffling && "animate-spin")} />
                        {isShuffling
                            ? (isThai ? "กำลังสุ่มจับสลาก..." : "Shuffling...")
                            : drawnPairs.length > 0
                                ? (isThai ? "สุ่มใหม่อีกครั้ง (Reshuffle)" : "Reshuffle Draw")
                                : (isThai ? "กดสุ่มจับสลากประกบคู่" : "Shuffle & Draw Pairs")}
                    </Button>

                    {/* Drawn Pairs Preview */}
                    {drawnPairs.length > 0 && (
                        <div className="space-y-4">
                            {/* Full-width container stretching edge-to-edge across the node */}
                            <div className="-mx-4 border-y border-border divide-y divide-border bg-card/60 max-h-64 overflow-y-auto overflow-x-hidden custom-scrollbar">
                                {drawnPairs.map((pair, idx) => (
                                    <div
                                        key={pair.id || idx}
                                        className="relative w-full flex items-center justify-between gap-2 px-4 py-2 text-xs hover:bg-muted/30 transition-colors group/pair"
                                    >
                                        <span className="text-xs font-black text-node-4 shrink-0 w-4">
                                            {idx + 1}
                                        </span>

                                        {/* Team A (Left) */}
                                        <div className="flex-1 min-w-0">
                                            {renderEditableTeam(idx, "teamA", pair.teamA, pair.teamB)}
                                        </div>

                                        {/* Center: VS & Swap Action */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                (e.nativeEvent as any)?.stopImmediatePropagation?.();
                                                swapDrawPairSlots(id, idx);
                                            }}
                                            className="nodrag h-6 px-1.5 rounded-sm hover:bg-muted text-muted-foreground hover:text-node-4 transition-colors shrink-0 flex items-center gap-1 group/swap cursor-pointer"
                                            title={isThai ? "สลับทีมเหย้า-เยือนในคู่นี้" : "Swap Home/Away"}
                                        >
                                            <span className="text-[9px] font-black text-muted-foreground/60 group-hover/swap:text-node-4">
                                                VS
                                            </span>
                                            <ArrowLeftRight className="size-2.5 text-muted-foreground/50 group-hover/swap:text-node-4" />
                                        </button>

                                        {/* Team B (Right) */}
                                        <div className="flex-1 min-w-0">
                                            {renderEditableTeam(idx, "teamB", pair.teamB, pair.teamA)}
                                        </div>

                                        {/* Pair output handle on the right edge */}
                                        <Handle
                                            type="source"
                                            position={Position.Right}
                                            id={`pair-out-${idx}`}
                                            className={cn(
                                                "!opacity-0 !bg-transparent !border-0 !w-4 cursor-crosshair",
                                                edges.some((e) => e.source === id && e.sourceHandle === `pair-out-${idx}`)
                                                    ? "z-10 pointer-events-none"
                                                    : "z-20 pointer-events-auto"
                                            )}
                                            style={{
                                                right: "-2px",
                                                top: 0,
                                                height: "100%",
                                                transform: "none",
                                            }}
                                            title={isThai ? `ส่งคู่นี้ (#${idx + 1}) ไปยังแมตช์ปลายทาง` : `Connect Match #${idx + 1}`}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Generation Options to Next Stage */}
                            <div className="grid grid-cols-2 gap-4">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        (e.nativeEvent as any)?.stopImmediatePropagation?.();
                                        generateNextRoundFromDraw(id, "round");
                                    }}
                                    className="text-node-4"
                                    title={isThai ? "สร้างโหนด Round รวมทุกคู่ในกล่องเดียว" : "Generate 1 unified Round Node"}
                                >
                                    <Layers className="size-4" />
                                    {isThai ? "แบบ Round" : "As Round"}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        (e.nativeEvent as any)?.stopImmediatePropagation?.();
                                        generateNextRoundFromDraw(id, "matches");
                                    }}
                                    className="text-node-4"
                                    title={isThai ? "สร้างแยกคู่ละโหนดสำหรับลากสายแข่งต่อ" : "Generate separate Match Nodes"}
                                >
                                    <GitBranch className="size-4" />
                                    {isThai ? "แบบแยกคู่" : "As Matches"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

DrawNode.displayName = "DrawNode";
