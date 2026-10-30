import { Node, Edge } from "@xyflow/react";

export type TournamentTemplateType =
    | "single_elimination_4"
    | "single_elimination_8"
    | "single_elimination_16"
    | "single_elimination_32"
    | "double_elimination_4"
    | "double_elimination_8"
    | "round_robin_4"
    | "round_robin_6"
    | "round_robin_8"
    | "round_robin_10"
    | "round_robin_12"
    | "group_knockout_2g"
    | "group_knockout_4g"
    | "group_knockout_8g";

export interface TemplateOptions {
    includeThirdPlace?: boolean;
    centerPosition?: { x: number; y: number };
}

export interface GeneratedTemplate {
    nodes: Node[];
    edges: Edge[];
}

function uid(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function createEdge(
    source: string,
    target: string,
    sourceHandle?: string,
    targetHandle?: string,
    isDashed = false
): Edge {
    const isWinner = Boolean(sourceHandle && sourceHandle.startsWith("winner"));
    const isRank = Boolean(sourceHandle && sourceHandle.startsWith("rank-"));
    const isGroupMatches = isDashed || sourceHandle === "group-matches" || targetHandle === "group-in";
    const isLoser = Boolean(sourceHandle && sourceHandle.startsWith("loser"));
    return {
        id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        source,
        target,
        sourceHandle: sourceHandle || undefined,
        targetHandle: targetHandle || undefined,
        type: "bezier",
        animated: false,
        className: (isWinner || isRank) ? "edge-winner" : isLoser ? "edge-loser" : undefined,
        style: {
            stroke: (isWinner || isRank || isGroupMatches) ? "var(--muted-foreground)" : "var(--border)",
            strokeWidth: 2,
            strokeDasharray: isGroupMatches ? "5,5" : "none",
            opacity: 1,
        },
    };
}

/**
 * Generate Single Elimination Tournament Template (4, 8, 16, 32+ teams or arbitrary teamCount)
 */
export function generateSingleElimination(
    teamCount: number,
    options?: TemplateOptions
): GeneratedTemplate {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const offsetX = options?.centerPosition?.x ?? 0;
    const offsetY = options?.centerPosition?.y ?? 0;
    const includeThirdPlace = options?.includeThirdPlace ?? true;

    // Sizing & Spacing
    const colSpacing = 360;
    const baseRowHeight = 130;

    // Standard bracket size is nearest power of 2 (at least 4)
    const bracketSize = Math.max(4, Math.pow(2, Math.ceil(Math.log2(Math.max(2, teamCount)))));
    const round1MatchesCount = bracketSize / 2;
    const round1NodeIds: string[] = [];

    // Round 1 label
    const round1Name =
        bracketSize >= 32 ? "Round of 32" : bracketSize >= 16 ? "Round of 16" : bracketSize >= 8 ? "Quarterfinals" : "Semifinals";

    for (let i = 0; i < round1MatchesCount; i++) {
        const nodeId = uid("match");
        round1NodeIds.push(nodeId);

        const seedA = i * 2 + 1;
        const seedB = i * 2 + 2;
        const placeholderA = seedA <= teamCount ? `Seed #${seedA}` : `Bye`;
        const placeholderB = seedB <= teamCount ? `Seed #${seedB}` : `Bye`;

        nodes.push({
            id: nodeId,
            type: "matchNode",
            position: {
                x: offsetX,
                y: offsetY + i * (baseRowHeight * 1.6),
            },
            data: {
                label: `${round1Name} ${i + 1}`,
                matches: [
                    {
                        id: `m-${Date.now()}-${i}`,
                        placeholderA,
                        placeholderB,
                    },
                ],
            },
        });
    }

    // Round 2 and beyond
    let prevRoundIds = round1NodeIds;
    let prevSpacing = baseRowHeight * 1.6;
    let currentX = offsetX + colSpacing;
    let currentMatchesCount = round1MatchesCount / 2;
    let roundIndex = 2;

    let semiFinalIds: string[] = [];

    while (currentMatchesCount >= 1) {
        const currentRoundIds: string[] = [];
        const isFinal = currentMatchesCount === 1;
        const isSemi = currentMatchesCount === 2;
        const roundName = isFinal ? "Grand Final" : isSemi ? "Semifinals" : `Round ${roundIndex}`;

        const currentSpacing = prevSpacing * 2;
        const startY = offsetY + (currentSpacing / 2) - (prevSpacing / 2);

        for (let i = 0; i < currentMatchesCount; i++) {
            const nodeId = uid("match");
            currentRoundIds.push(nodeId);

            nodes.push({
                id: nodeId,
                type: "matchNode",
                position: {
                    x: currentX,
                    y: startY + i * currentSpacing,
                },
                data: {
                    label: isFinal ? "Grand Final" : `${roundName} ${i + 1}`,
                    matches: [
                        {
                            id: `m-${Date.now()}-${roundIndex}-${i}`,
                            placeholderA: `Winner of ${nodes.find((n) => n.id === prevRoundIds[i * 2])?.data.label || "Match"}`,
                            placeholderB: `Winner of ${nodes.find((n) => n.id === prevRoundIds[i * 2 + 1])?.data.label || "Match"}`,
                        },
                    ],
                },
            });

            // Connect prev matches winners
            edges.push(createEdge(prevRoundIds[i * 2], nodeId, "winner-0", "slot-a-0"));
            edges.push(createEdge(prevRoundIds[i * 2 + 1], nodeId, "winner-0", "slot-b-0"));
        }

        if (isSemi) {
            semiFinalIds = [...currentRoundIds];
        }

        prevRoundIds = currentRoundIds;
        prevSpacing = currentSpacing;
        currentX += colSpacing;
        currentMatchesCount = currentMatchesCount / 2;
        roundIndex++;
    }

    // --- 3rd Place Match (Optional) ---
    if (includeThirdPlace && (round1NodeIds.length === 2 || semiFinalIds.length === 2)) {
        const sourceSemis = round1NodeIds.length === 2 ? round1NodeIds : semiFinalIds;
        const thirdPlaceNodeId = uid("match");
        const finalX = currentX - colSpacing;

        nodes.push({
            id: thirdPlaceNodeId,
            type: "matchNode",
            position: {
                x: finalX,
                y: offsetY + (bracketSize <= 4 ? 260 : bracketSize <= 8 ? 440 : 800),
            },
            data: {
                label: "3rd Place Match",
                matches: [
                    {
                        id: `m-3rd-${Date.now()}`,
                        placeholderA: "Loser SF 1",
                        placeholderB: "Loser SF 2",
                    },
                ],
            },
        });

        edges.push(createEdge(sourceSemis[0], thirdPlaceNodeId, "loser-0", "slot-a-0"));
        edges.push(createEdge(sourceSemis[1], thirdPlaceNodeId, "loser-0", "slot-b-0"));
    }

    return { nodes, edges };
}

/**
 * Generate Double Elimination Tournament Template for ANY teamCount (4, 8, 16, 28, 32, etc.)
 */
export function generateDoubleElimination(teamCount: number, options?: TemplateOptions): GeneratedTemplate {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const offsetX = options?.centerPosition?.x ?? 0;
    const offsetY = options?.centerPosition?.y ?? 0;

    const colSpacing = 360;
    const baseRowHeight = 130;

    // Standard bracket size is power of 2 (at least 4)
    const bracketSize = Math.max(4, Math.pow(2, Math.ceil(Math.log2(Math.max(2, teamCount)))));
    const totalUbRounds = Math.log2(bracketSize);

    // Round 1 label name
    const ubRound1Name =
        bracketSize >= 32 ? "UB Round of 32" : bracketSize >= 16 ? "UB Round of 16" : bracketSize >= 8 ? "UB Quarterfinal" : "UB Semifinal";

    // 1. Upper Bracket (UB)
    const ubRoundMatches: string[][] = [];

    // UB Round 1
    const round1Count = bracketSize / 2;
    const ubRound1Ids: string[] = [];
    for (let i = 0; i < round1Count; i++) {
        const id = uid("match-ub-r1");
        ubRound1Ids.push(id);
        const seedA = i * 2 + 1;
        const seedB = i * 2 + 2;
        const placeholderA = seedA <= teamCount ? `Seed #${seedA}` : `Bye`;
        const placeholderB = seedB <= teamCount ? `Seed #${seedB}` : `Bye`;

        nodes.push({
            id,
            type: "matchNode",
            position: { x: offsetX, y: offsetY + i * (baseRowHeight * 1.5) },
            data: {
                label: `${ubRound1Name} ${i + 1}`,
                matches: [{ id: `m-ub-1-${i}`, placeholderA, placeholderB }],
            },
        });
    }
    ubRoundMatches.push(ubRound1Ids);

    // Subsequent UB Rounds
    let prevUbIds = ubRound1Ids;
    let prevUbSpacing = baseRowHeight * 1.5;
    let currentUbX = offsetX + colSpacing;
    let currentUbCount = round1Count / 2;
    let ubRoundIndex = 2;

    while (currentUbCount >= 1) {
        const currentRoundIds: string[] = [];
        const isFinal = currentUbCount === 1;
        const isSemi = currentUbCount === 2;
        const roundName = isFinal ? "UB Final" : isSemi ? "UB Semifinals" : `UB Round ${ubRoundIndex}`;

        const currentSpacing = prevUbSpacing * 2;
        const startY = offsetY + (currentSpacing / 2) - (prevUbSpacing / 2);

        for (let i = 0; i < currentUbCount; i++) {
            const id = uid("match-ub");
            currentRoundIds.push(id);

            nodes.push({
                id,
                type: "matchNode",
                position: { x: currentUbX, y: startY + i * currentSpacing },
                data: {
                    label: isFinal ? "UB Final" : `${roundName} ${i + 1}`,
                    matches: [
                        {
                            id: `m-ub-${ubRoundIndex}-${i}`,
                            placeholderA: `Winner ${nodes.find((n) => n.id === prevUbIds[i * 2])?.data.label || "Match"}`,
                            placeholderB: `Winner ${nodes.find((n) => n.id === prevUbIds[i * 2 + 1])?.data.label || "Match"}`,
                        },
                    ],
                },
            });

            edges.push(createEdge(prevUbIds[i * 2], id, "winner-0", "slot-a-0"));
            edges.push(createEdge(prevUbIds[i * 2 + 1], id, "winner-0", "slot-b-0"));
        }

        ubRoundMatches.push(currentRoundIds);
        prevUbIds = currentRoundIds;
        prevUbSpacing = currentSpacing;
        currentUbX += colSpacing;
        currentUbCount = currentUbCount / 2;
        ubRoundIndex++;
    }

    // 2. Lower Bracket (LB)
    const lbOffsetY = offsetY + (bracketSize / 2) * (baseRowHeight * 1.5) + 120;
    const totalLbRounds = 2 * (totalUbRounds - 1);
    const lbRoundMatches: string[][] = [];

    let currentLbX = offsetX;

    for (let k = 0; k < totalLbRounds; k++) {
        const roundNum = k + 1;
        const isLastLbRound = k === totalLbRounds - 1;
        const isLbSemi = k === totalLbRounds - 2;
        const lbRoundName = isLastLbRound
            ? "LB Final"
            : isLbSemi
            ? "LB Semifinal"
            : `LB Round ${roundNum}`;

        const roundIds: string[] = [];

        if (k === 0) {
            // LB Round 1: Pair losers from UB Round 1 (round1Count losers -> round1Count / 2 matches)
            const matchesInRound = round1Count / 2;
            for (let i = 0; i < matchesInRound; i++) {
                const id = uid("match-lb");
                roundIds.push(id);
                nodes.push({
                    id,
                    type: "matchNode",
                    position: { x: currentLbX, y: lbOffsetY + i * 160 },
                    data: {
                        label: `${lbRoundName} (${i + 1})`,
                        matches: [
                            {
                                id: `m-lb-1-${i}`,
                                placeholderA: `Loser ${nodes.find((n) => n.id === ubRoundMatches[0][i * 2])?.data.label || "UB Match"}`,
                                placeholderB: `Loser ${nodes.find((n) => n.id === ubRoundMatches[0][i * 2 + 1])?.data.label || "UB Match"}`,
                            },
                        ],
                    },
                });
                edges.push(createEdge(ubRoundMatches[0][i * 2], id, "loser-0", "slot-a-0"));
                edges.push(createEdge(ubRoundMatches[0][i * 2 + 1], id, "loser-0", "slot-b-0"));
            }
        } else if (k % 2 === 1) {
            // Odd round: Major round (LB winners vs dropping UB losers)
            const ubDropRoundIndex = (k + 1) / 2;
            const prevLbMatches = lbRoundMatches[k - 1];
            const matchesInRound = prevLbMatches.length;

            for (let i = 0; i < matchesInRound; i++) {
                const id = uid("match-lb");
                roundIds.push(id);
                const ubSourceId = ubRoundMatches[ubDropRoundIndex]?.[matchesInRound - 1 - i] || ubRoundMatches[ubDropRoundIndex]?.[i];

                nodes.push({
                    id,
                    type: "matchNode",
                    position: { x: currentLbX, y: lbOffsetY + i * 160 + (k * 20) },
                    data: {
                        label: isLastLbRound ? "LB Final" : `${lbRoundName} (${i + 1})`,
                        matches: [
                            {
                                id: `m-lb-${roundNum}-${i}`,
                                placeholderA: `Winner ${nodes.find((n) => n.id === prevLbMatches[i])?.data.label || "LB Match"}`,
                                placeholderB: `Loser ${nodes.find((n) => n.id === ubSourceId)?.data.label || "UB Match"}`,
                            },
                        ],
                    },
                });
                edges.push(createEdge(prevLbMatches[i], id, "winner-0", "slot-a-0"));
                if (ubSourceId) {
                    edges.push(createEdge(ubSourceId, id, "loser-0", "slot-b-0"));
                }
            }
        } else {
            // Even round (k > 0): Minor round (LB winners vs LB winners, matches halving)
            const prevLbMatches = lbRoundMatches[k - 1];
            const matchesInRound = prevLbMatches.length / 2;

            for (let i = 0; i < matchesInRound; i++) {
                const id = uid("match-lb");
                roundIds.push(id);
                nodes.push({
                    id,
                    type: "matchNode",
                    position: { x: currentLbX, y: lbOffsetY + i * 200 + (k * 20) },
                    data: {
                        label: isLbSemi ? "LB Semifinal" : `${lbRoundName} (${i + 1})`,
                        matches: [
                            {
                                id: `m-lb-${roundNum}-${i}`,
                                placeholderA: `Winner ${nodes.find((n) => n.id === prevLbMatches[i * 2])?.data.label || "LB Match"}`,
                                placeholderB: `Winner ${nodes.find((n) => n.id === prevLbMatches[i * 2 + 1])?.data.label || "LB Match"}`,
                            },
                        ],
                    },
                });
                edges.push(createEdge(prevLbMatches[i * 2], id, "winner-0", "slot-a-0"));
                edges.push(createEdge(prevLbMatches[i * 2 + 1], id, "winner-0", "slot-b-0"));
            }
        }

        lbRoundMatches.push(roundIds);
        currentLbX += colSpacing;
    }

    // 3. Grand Final
    const ubFinalId = ubRoundMatches[ubRoundMatches.length - 1][0];
    const lbFinalId = lbRoundMatches[lbRoundMatches.length - 1][0];
    const grandFinalId = uid("match-grand-final");

    const grandFinalX = Math.max(currentUbX, currentLbX);
    const grandFinalY = offsetY + ((bracketSize / 2) * (baseRowHeight * 1.5)) / 2;

    nodes.push({
        id: grandFinalId,
        type: "matchNode",
        position: { x: grandFinalX, y: grandFinalY },
        data: {
            label: "Grand Final",
            matches: [
                {
                    id: `m-gf`,
                    placeholderA: "Winner UB Final",
                    placeholderB: "Winner LB Final",
                },
            ],
        },
    });

    edges.push(createEdge(ubFinalId, grandFinalId, "winner-0", "slot-a-0"));
    edges.push(createEdge(lbFinalId, grandFinalId, "winner-0", "slot-b-0"));

    return { nodes, edges };
}

export function generateDoubleElimination8(options?: TemplateOptions): GeneratedTemplate {
    return generateDoubleElimination(8, options);
}

/**
 * Generate Round Robin / League Template (Custom Team Count)
 */
export function generateRoundRobin(
    teamCount: number,
    options?: TemplateOptions
): GeneratedTemplate {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const offsetX = options?.centerPosition?.x ?? 0;
    const offsetY = options?.centerPosition?.y ?? 0;

    const groupNodeId = uid("group");
    const count = Math.max(3, teamCount);
    const teams = Array.from({ length: count }, (_, i) => `Team ${i + 1}`);

    // Unified Group Node (with Standings)
    nodes.push({
        id: groupNodeId,
        type: "groupNode",
        position: { x: offsetX, y: offsetY },
        data: {
            label: `League Pool (${count} Teams)`,
            teamCount: count,
            advancingCount: Math.min(count, 2),
            teams,
            showPlayed: true,
            showWin: true,
            showDraw: true,
            showLoss: true,
            showGD: true,
            showPts: true,
        },
    });

    // Generate Round Robin Match fixtures
    const matchNodeId = uid("match");
    const n = count % 2 === 0 ? count : count + 1;
    const indices = Array.from({ length: n }, (_, i) => i);
    const pairings: { id: string; placeholderA: string; placeholderB: string }[] = [];

    for (let r = 0; r < n - 1; r++) {
        for (let i = 0; i < n / 2; i++) {
            const a = indices[i];
            const b = indices[n - 1 - i];
            if (count % 2 !== 0 && (a === n - 1 || b === n - 1)) continue;
            const isHome = (i + r) % 2 === 0;
            pairings.push({
                id: `m-${Date.now()}-${r}-${i}`,
                placeholderA: teams[isHome ? a : b] || `Team ${(isHome ? a : b) + 1}`,
                placeholderB: teams[isHome ? b : a] || `Team ${(isHome ? b : a) + 1}`,
            });
        }
        indices.splice(1, 0, indices.pop()!);
    }

    nodes.push({
        id: matchNodeId,
        type: "matchNode",
        position: { x: offsetX + 400, y: offsetY },
        data: {
            label: `Fixtures (${pairings.length} Matches)`,
            matches: pairings,
        },
    });

    // Connect Group bottom -> Match group-in (dashed)
    edges.push(createEdge(groupNodeId, matchNodeId, "group-matches", "group-in", true));

    return { nodes, edges };
}

/**
 * Generate Group Stage + Knockout (World Cup / Champions League style)
 * Supports 2, 4, 8, 16, 32, 64 Groups dynamically with complete knockout brackets
 */
export function generateGroupStageWithKnockout(
    groupCount: number,
    options?: TemplateOptions & { teamsPerGroup?: number }
): GeneratedTemplate {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const offsetX = options?.centerPosition?.x ?? 0;
    const offsetY = options?.centerPosition?.y ?? 0;
    const includeThirdPlace = options?.includeThirdPlace ?? true;
    const teamsPerGroup = options?.teamsPerGroup || 4;

    // Helper to generate group letter/name (A..Z, AA..AZ, etc.)
    const getGroupLabel = (index: number) => {
        if (index < 26) return String.fromCharCode(65 + index);
        const first = String.fromCharCode(65 + Math.floor(index / 26) - 1);
        const second = String.fromCharCode(65 + (index % 26));
        return `${first}${second}`;
    };

    const standingNodeIds: string[] = [];
    const effectiveGroupCount = Math.max(2, groupCount);
    // Each group contains: GroupNode, StandingNode, and below StandingNode is MatchNode (fixtures).
    // Base height for StandingNode (~250px) + Fixture MatchNode (~260px) + padding (~100px) = 620px
    const groupSpacingY = effectiveGroupCount >= 16 ? 480 : effectiveGroupCount >= 8 ? 540 : 620;

    // 1. Create Groups, Standings, and Fixture Matches
    for (let g = 0; g < effectiveGroupCount; g++) {
        const groupLabel = getGroupLabel(g);
        const gNodeId = uid(`group-${groupLabel.toLowerCase()}`);
        const mNodeId = uid(`match-group-${groupLabel.toLowerCase()}`);
        standingNodeIds.push(gNodeId);

        const groupTeams = Array.from({ length: teamsPerGroup }, (_, i) => `Team ${groupLabel}${i + 1}`);

        // Unified Group Node (with Standings)
        nodes.push({
            id: gNodeId,
            type: "groupNode",
            position: { x: offsetX, y: offsetY + g * groupSpacingY },
            data: {
                label: `Group ${groupLabel}`,
                teamCount: teamsPerGroup,
                advancingCount: 2,
                teams: groupTeams,
                showPlayed: true,
                showWin: true,
                showDraw: true,
                showLoss: true,
                showGD: true,
                showPts: true,
            },
        });

        // Generate Group Stage Match fixtures (Round-robin)
        const count = teamsPerGroup;
        const n = count % 2 === 0 ? count : count + 1;
        const indices = Array.from({ length: n }, (_, i) => i);
        const pairings: { id: string; placeholderA: string; placeholderB: string }[] = [];

        for (let r = 0; r < n - 1; r++) {
            for (let i = 0; i < n / 2; i++) {
                const a = indices[i];
                const b = indices[n - 1 - i];
                if (count % 2 !== 0 && (a === n - 1 || b === n - 1)) continue;
                const isHome = (i + r) % 2 === 0;
                pairings.push({
                    id: `m-${Date.now()}-${g}-${r}-${i}`,
                    placeholderA: groupTeams[isHome ? a : b] || `Team ${groupLabel}${(isHome ? a : b) + 1}`,
                    placeholderB: groupTeams[isHome ? b : a] || `Team ${groupLabel}${(isHome ? b : a) + 1}`,
                });
            }
            indices.splice(1, 0, indices.pop()!);
        }

        // Match Node placed next to Group Node
        nodes.push({
            id: mNodeId,
            type: "matchNode",
            position: { x: offsetX + 400, y: offsetY + g * groupSpacingY },
            data: {
                label: `Group ${groupLabel} (${pairings.length} Matches)`,
                matches: pairings,
            },
        });

        // Connect Group bottom -> Match top (dashed)
        edges.push(createEdge(gNodeId, mNodeId, "group-matches", "group-in", true));
    }

    // 2. Build Knockout Bracket
    // Each group advances 2 teams -> total knockout teams = effectiveGroupCount * 2
    // Number of matches in Round 1 = effectiveGroupCount
    const knockoutOffsetX = offsetX + 780;

    const getRoundName = (matchesInRound: number): string => {
        if (matchesInRound === 1) return "Grand Final";
        if (matchesInRound === 2) return "Semifinal";
        if (matchesInRound === 4) return "Quarterfinal";
        if (matchesInRound === 8) return "Round of 16";
        if (matchesInRound === 16) return "Round of 32";
        if (matchesInRound === 32) return "Round of 64";
        return `Round of ${matchesInRound * 2}`;
    };

    // Construct standard Cross-Group Pairings for Round 1
    // Top half: 1A vs 2B, 1C vs 2D, 1E vs 2F...
    // Bottom half: 1B vs 2A, 1D vs 2C, 1F vs 2E...
    const firstRoundPairings: { g1: number; r1: number; g2: number; r2: number }[] = [];
    const halfGroups = effectiveGroupCount / 2;

    // Top half: 1st of even groups vs 2nd of odd groups
    for (let i = 0; i < halfGroups; i++) {
        const gA = i * 2;
        const gB = i * 2 + 1;
        firstRoundPairings.push({ g1: gA, r1: 0, g2: gB, r2: 1 });
    }
    // Bottom half: 1st of odd groups vs 2nd of even groups
    for (let i = 0; i < halfGroups; i++) {
        const gA = i * 2;
        const gB = i * 2 + 1;
        firstRoundPairings.push({ g1: gB, r1: 0, g2: gA, r2: 1 });
    }

    const roundMatchIds: string[][] = [];
    let currentMatchesCount = effectiveGroupCount;
    let roundIndex = 0;
    const colSpacingX = 340;

    // Build Knockout tree
    while (currentMatchesCount >= 1) {
        const roundName = getRoundName(currentMatchesCount);
        const matchIdsInThisRound: string[] = [];
        const currentColX = knockoutOffsetX + roundIndex * colSpacingX;
        const matchHeightSpacing = ((effectiveGroupCount * groupSpacingY) / currentMatchesCount);

        for (let m = 0; m < currentMatchesCount; m++) {
            const matchId = uid(`ko-r${roundIndex}-m${m + 1}`);
            matchIdsInThisRound.push(matchId);

            const matchY = offsetY + m * matchHeightSpacing + (matchHeightSpacing / 2) - 40;

            let placeholderA = `Winner Match`;
            let placeholderB = `Winner Match`;

            if (roundIndex === 0) {
                const pairing = firstRoundPairings[m];
                placeholderA = `1st Place (Group ${getGroupLabel(pairing.g1)})`;
                placeholderB = `2nd Place (Group ${getGroupLabel(pairing.g2)})`;
            } else {
                const prevRoundName = getRoundName(currentMatchesCount * 2);
                placeholderA = `Winner ${prevRoundName} ${m * 2 + 1}`;
                placeholderB = `Winner ${prevRoundName} ${m * 2 + 2}`;
            }

            nodes.push({
                id: matchId,
                type: "matchNode",
                position: { x: currentColX, y: matchY },
                data: {
                    label: currentMatchesCount === 1 ? "Grand Final" : `${roundName} ${m + 1}`,
                    matches: [
                        {
                            id: `m-ko-${roundIndex}-${m + 1}`,
                            placeholderA,
                            placeholderB,
                        },
                    ],
                },
            });

            if (roundIndex === 0) {
                // Connect from standings
                const pairing = firstRoundPairings[m];
                edges.push(createEdge(standingNodeIds[pairing.g1], matchId, `rank-${pairing.r1}`, "slot-a-0"));
                edges.push(createEdge(standingNodeIds[pairing.g2], matchId, `rank-${pairing.r2}`, "slot-b-0"));
            } else {
                // Connect from previous round
                const prevRoundMatches = roundMatchIds[roundIndex - 1];
                edges.push(createEdge(prevRoundMatches[m * 2], matchId, "winner-0", "slot-a-0"));
                edges.push(createEdge(prevRoundMatches[m * 2 + 1], matchId, "winner-0", "slot-b-0"));
            }
        }

        roundMatchIds.push(matchIdsInThisRound);
        currentMatchesCount = Math.floor(currentMatchesCount / 2);
        roundIndex++;
    }

    // 3rd Place Match (if enabled and at least 2 rounds / semifinals exist)
    if (includeThirdPlace && roundMatchIds.length >= 2) {
        const sfMatchIds = roundMatchIds[roundMatchIds.length - 2];
        if (sfMatchIds && sfMatchIds.length === 2) {
            const thirdPlaceId = uid("match-3rd");
            const finalColX = knockoutOffsetX + (roundMatchIds.length - 1) * colSpacingX;
            const finalNode = nodes.find((n) => n.id === roundMatchIds[roundMatchIds.length - 1][0]);
            const finalY = finalNode ? finalNode.position.y : offsetY;

            nodes.push({
                id: thirdPlaceId,
                type: "matchNode",
                position: { x: finalColX, y: finalY + 220 },
                data: {
                    label: "3rd Place Match",
                    matches: [
                        {
                            id: `m-3rd`,
                            placeholderA: "Loser Semifinal 1",
                            placeholderB: "Loser Semifinal 2",
                        },
                    ],
                },
            });

            edges.push(createEdge(sfMatchIds[0], thirdPlaceId, "loser-0", "slot-a-0"));
            edges.push(createEdge(sfMatchIds[1], thirdPlaceId, "loser-0", "slot-b-0"));
        }
    }

    return { nodes, edges };
}

