import { Node, Edge } from "@xyflow/react";
import { format, parse, addDays, differenceInCalendarDays } from "date-fns";

export interface ScheduledMatchItem {
    nodeId: string;
    matchIndex: number;
    matchId: string;
    targetDate: string;
    targetTime: string;
    assignedCourt: string;
    roundNumber: number;
    roundLabel: string;
    stage: "group" | "knockout";
}

export interface MatchSlotInfo {
    nodeId: string;
    matchIndex: number;
    matchId: string;
    rawMatch: any;
    nodeLabel: string;
    teams: string[];
    groupId?: string;
    matchDay?: number;
    isGroupStage: boolean;
    stage: "group" | "knockout";
}

export interface RoundGroup {
    roundNumber: number;
    stage: "group" | "knockout";
    label: string;
    matches: MatchSlotInfo[];
}

export interface AutoScheduleOptions {
    startDate: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
    firstMatchTime: string; // HH:mm (e.g. "09:00")
    dailyEndTime?: string; // HH:mm (e.g. "18:00") - latest time matches must finish
    matchDurationMinutes: number; // e.g. 40
    gapMinutes?: number; // e.g. 0
    hasBreakTime: boolean;
    breakStartTime?: string; // HH:mm (e.g. "12:00")
    breakEndTime?: string; // HH:mm (e.g. "13:00")
    selectedCourts: string[];
    maxMatchesPerDay?: number; // Max total matches per day
    maxMatchesPerTeam?: number; // Max matches per team per day
}

/**
 * Extract normalized team identifiers from a match item
 * Filters out placeholders like TBD, Bye, Winner of..., 1st Place...
 */
export function getTeamIdentifiers(m: any): string[] {
    const raw = [
        m.placeholderA,
        m.placeholderB,
        m.teamA,
        m.teamB,
        m.slotA,
        m.slotB,
        m.home_team_name,
        m.away_team_name,
    ].filter(Boolean);

    const validTeams = new Set<string>();

    for (const item of raw) {
        const str = String(item).trim();
        if (!str) continue;
        const lower = str.toLowerCase();
        if (
            lower === "tbd" ||
            lower === "bye" ||
            lower === "-" ||
            lower.startsWith("winner") ||
            lower.startsWith("loser") ||
            /^\d+(st|nd|rd|th)\s+place/i.test(lower) ||
            /^seed\s*#?\d+/i.test(lower)
        ) {
            continue;
        }
        validTeams.add(str);
    }

    return Array.from(validTeams);
}

/**
 * Parse HH:mm string to minutes since midnight
 */
export function timeToMinutes(timeStr: string): number {
    const [h, m] = (timeStr || "09:00").split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
}

/**
 * Format minutes since midnight to HH:mm string
 */
export function minutesToTime(totalMinutes: number): string {
    const norm = Math.max(0, totalMinutes);
    const h = Math.floor(norm / 60) % 24;
    const m = norm % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Analyze nodes and edges to build an ordered sequence of stages and rounds
 */
export function analyzeRoundsFromCanvas(
    nodes: Node[],
    edges: Edge[]
): RoundGroup[] {
    const matchNodes = nodes.filter((n) => n.type === "matchNode");
    if (matchNodes.length === 0) return [];

    const groupNodeIds = new Set(
        nodes.filter((n) => n.type === "groupNode" || n.type === "standingNode").map((n) => n.id)
    );

    // Group stage detection:
    // Edges with group-matches or group-in connect Group nodes to Match Day nodes
    const groupMatchesTargetIds = new Set(
        edges
            .filter(
                (e) =>
                    (groupNodeIds.has(e.source) && (e.sourceHandle === "group-matches" || e.targetHandle === "group-in")) ||
                    e.sourceHandle === "group-matches" ||
                    e.targetHandle === "group-in"
            )
            .map((e) => e.target)
    );

    // Rank handles connect Group standings to Knockout matches
    const knockoutFromRankIds = new Set(
        edges
            .filter((e) => groupNodeIds.has(e.source) && e.sourceHandle && e.sourceHandle.startsWith("rank-"))
            .map((e) => e.target)
    );

    // 1. Classify each matchNode into Group Stage vs Knockout Stage
    const groupStageNodes: Node[] = [];
    const knockoutStageNodes: Node[] = [];

    for (const node of matchNodes) {
        const isKnockoutFromRank = knockoutFromRankIds.has(node.id);
        const data = node.data || {};
        const label = String(data.label || "");

        const isExplicitGroup =
            groupMatchesTargetIds.has(node.id) ||
            Boolean(data.groupId) ||
            Boolean(data.matchDay) ||
            /Match Day/i.test(label) ||
            (/Group\s+[A-Za-z0-9]/i.test(label) && !isKnockoutFromRank);

        if (isExplicitGroup && !isKnockoutFromRank) {
            groupStageNodes.push(node);
        } else {
            knockoutStageNodes.push(node);
        }
    }

    // 2. Organize Group Stage Rounds
    // Map of groupRoundNumber -> MatchSlotInfo[]
    const groupRoundsMap = new Map<number, MatchSlotInfo[]>();

    for (const node of groupStageNodes) {
        const rawMatches = (node.data?.matches as any[]) || [];
        const label = String(node.data?.label || "");
        const explicitMatchDay = node.data?.matchDay as number | undefined;

        // Try to get match day from data.matchDay or label
        let detectedDay = explicitMatchDay;
        if (!detectedDay) {
            const mdMatch = label.match(/Match\s*Day\s*(\d+)/i) || label.match(/MD\s*(\d+)/i) || label.match(/รอบที่\s*(\d+)/i);
            if (mdMatch) {
                detectedDay = parseInt(mdMatch[1], 10);
            }
        }

        if (detectedDay) {
            // All matches in this node belong to this match day
            if (!groupRoundsMap.has(detectedDay)) {
                groupRoundsMap.set(detectedDay, []);
            }
            rawMatches.forEach((m, idx) => {
                groupRoundsMap.get(detectedDay)!.push({
                    nodeId: node.id,
                    matchIndex: idx,
                    matchId: m.id || m.matchId || `m-${node.id}-${idx}`,
                    rawMatch: m,
                    nodeLabel: label,
                    teams: getTeamIdentifiers(m),
                    groupId: node.data?.groupId as string,
                    matchDay: detectedDay,
                    isGroupStage: true,
                    stage: "group",
                });
            });
        } else {
            // Node has multiple matches (e.g. all round-robin matches in a single node)
            // Partition matches so no team appears twice in the same round
            let currentPartitionDay = 1;
            let currentPartitionTeams = new Set<string>();

            rawMatches.forEach((m, idx) => {
                const teams = getTeamIdentifiers(m);
                const hasCollision = teams.some((t) => currentPartitionTeams.has(t));

                if (hasCollision && currentPartitionTeams.size > 0) {
                    currentPartitionDay += 1;
                    currentPartitionTeams = new Set<string>();
                }

                teams.forEach((t) => currentPartitionTeams.add(t));

                if (!groupRoundsMap.has(currentPartitionDay)) {
                    groupRoundsMap.set(currentPartitionDay, []);
                }
                groupRoundsMap.get(currentPartitionDay)!.push({
                    nodeId: node.id,
                    matchIndex: idx,
                    matchId: m.id || m.matchId || `m-${node.id}-${idx}`,
                    rawMatch: m,
                    nodeLabel: label,
                    teams,
                    groupId: node.data?.groupId as string,
                    matchDay: currentPartitionDay,
                    isGroupStage: true,
                    stage: "group",
                });
            });
        }
    }

    // Sort group rounds by day number
    const sortedGroupDays = Array.from(groupRoundsMap.keys()).sort((a, b) => a - b);
    const roundGroups: RoundGroup[] = [];

    sortedGroupDays.forEach((dayNum) => {
        roundGroups.push({
            roundNumber: roundGroups.length + 1,
            stage: "group",
            label: `รอบแบ่งกลุ่ม - Match Day ${dayNum}`,
            matches: groupRoundsMap.get(dayNum)!,
        });
    });

    // 3. Organize Knockout Stage Rounds
    if (knockoutStageNodes.length > 0) {
        // Build dependency graph among knockout nodes
        const knockoutIds = new Set(knockoutStageNodes.map((n) => n.id));
        const knockoutEdges = edges.filter(
            (e) => knockoutIds.has(e.source) && knockoutIds.has(e.target)
        );

        // Compute DAG depth for each knockout node
        const depthMap = new Map<string, number>();

        // Nodes with no incoming knockout edges start at depth 0
        const inDegree = new Map<string, number>();
        knockoutStageNodes.forEach((n) => inDegree.set(n.id, 0));
        knockoutEdges.forEach((e) => {
            inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
        });

        // Breadth-first / longest-path depth calculation
        const getDepth = (nodeId: string, visited = new Set<string>()): number => {
            if (depthMap.has(nodeId)) return depthMap.get(nodeId)!;
            if (visited.has(nodeId)) return 0; // prevent cycle
            visited.add(nodeId);

            const incomingEdges = knockoutEdges.filter((e) => e.target === nodeId);
            if (incomingEdges.length === 0) {
                depthMap.set(nodeId, 0);
                return 0;
            }

            let maxParentDepth = 0;
            for (const edge of incomingEdges) {
                const parentDepth = getDepth(edge.source, new Set(visited));
                if (parentDepth + 1 > maxParentDepth) {
                    maxParentDepth = parentDepth + 1;
                }
            }

            depthMap.set(nodeId, maxParentDepth);
            return maxParentDepth;
        };

        knockoutStageNodes.forEach((n) => getDepth(n.id));

        // Group knockout nodes by depth / position
        const knockoutByDepth = new Map<number, Node[]>();
        knockoutStageNodes.forEach((node) => {
            let depth = depthMap.get(node.id) || 0;

            // Optional keyword boost for finals/semifinals if depths are flat
            const label = String(node.data?.label || "").toLowerCase();
            if (depth === 0) {
                if (label.includes("final") || label.includes("รอบชิง")) depth = 999;
                else if (label.includes("semi") || label.includes("รองชนะเลิศ")) depth = 888;
                else if (label.includes("quarter") || label.includes("8 ทีม")) depth = 777;
            }

            if (!knockoutByDepth.has(depth)) {
                knockoutByDepth.set(depth, []);
            }
            knockoutByDepth.get(depth)!.push(node);
        });

        // Sort depth keys
        const sortedDepths = Array.from(knockoutByDepth.keys()).sort((a, b) => a - b);

        sortedDepths.forEach((d) => {
            const nodesAtDepth = knockoutByDepth.get(d)!;
            // Sort nodes at same depth by position.x or position.y
            nodesAtDepth.sort((a, b) => a.position.y - b.position.y);

            const matchesAtDepth: MatchSlotInfo[] = [];
            let representativeLabel = "";

            nodesAtDepth.forEach((node) => {
                const rawMatches = (node.data?.matches as any[]) || [];
                const label = String(node.data?.label || "");
                if (!representativeLabel) representativeLabel = label;

                rawMatches.forEach((m, idx) => {
                    matchesAtDepth.push({
                        nodeId: node.id,
                        matchIndex: idx,
                        matchId: m.id || m.matchId || `m-${node.id}-${idx}`,
                        rawMatch: m,
                        nodeLabel: label,
                        teams: getTeamIdentifiers(m),
                        isGroupStage: false,
                        stage: "knockout",
                    });
                });
            });

            if (matchesAtDepth.length > 0) {
                const roundNum = roundGroups.length + 1;
                let displayLabel = `รอบน็อกเอาต์ #${roundNum}`;
                if (representativeLabel.toLowerCase().includes("final")) {
                    displayLabel = "รอบชิงชนะเลิศ (Grand Final)";
                } else if (representativeLabel.toLowerCase().includes("semi")) {
                    displayLabel = "รอบรองชนะเลิศ (Semifinals)";
                } else if (representativeLabel.toLowerCase().includes("quarter")) {
                    displayLabel = "รอบ 8 ทีม (Quarterfinals)";
                } else if (representativeLabel) {
                    displayLabel = `รอบน็อกเอาต์ (${representativeLabel})`;
                }

                roundGroups.push({
                    roundNumber: roundNum,
                    stage: "knockout",
                    label: displayLabel,
                    matches: matchesAtDepth,
                });
            }
        });
    }

    return roundGroups;
}

/**
 * Distribute total rounds into available tournament days
 */
export function partitionRoundsToDays(totalRounds: number, totalDays: number): number[][] {
    const days: number[][] = Array.from({ length: Math.max(1, totalDays) }, () => []);
    if (totalDays <= 0 || totalRounds <= 0) return days;

    if (totalDays >= totalRounds) {
        // Plenty of days: 1 round per day
        for (let r = 0; r < totalRounds; r++) {
            days[r].push(r);
        }
    } else {
        // Compact ("ยัดโปรแกรม") into totalDays
        // Distribute rounds as evenly as possible across days
        const base = Math.floor(totalRounds / totalDays);
        const remainder = totalRounds % totalDays;
        let roundIdx = 0;
        for (let d = 0; d < totalDays; d++) {
            const count = base + (d < remainder ? 1 : 0);
            for (let c = 0; c < count; c++) {
                if (roundIdx < totalRounds) {
                    days[d].push(roundIdx++);
                }
            }
        }
    }

    return days;
}

/**
 * Schedule all matches respecting:
 * 1. Stage & Round progression (Round 1 finishes before Round 2)
 * 2. Tournament date bounds (packs into tournament days if days < rounds)
 * 3. Team concurrency conflict prevention (no team plays 2 matches simultaneously)
 * 4. Court alternation and distribution
 * 5. Optional break window (e.g. lunch break)
 */
export function computeAutoSchedule(
    nodes: Node[],
    edges: Edge[],
    options: AutoScheduleOptions
): ScheduledMatchItem[] {
    const roundGroups = analyzeRoundsFromCanvas(nodes, edges);
    if (roundGroups.length === 0) return [];

    const effectiveCourts =
        options.selectedCourts.length > 0 ? options.selectedCourts : ["สนาม 1"];

    const startDateParsed = parse(options.startDate, "yyyy-MM-dd", new Date());
    const endDateParsed = options.endDate
        ? parse(options.endDate, "yyyy-MM-dd", new Date())
        : startDateParsed;

    const rawDiff = differenceInCalendarDays(endDateParsed, startDateParsed);
    const totalDays = Math.max(1, rawDiff + 1);

    const dayRoundMap = partitionRoundsToDays(roundGroups.length, totalDays);

    const firstMatchMin = timeToMinutes(options.firstMatchTime || "09:00");
    const dailyEndMin = options.dailyEndTime ? timeToMinutes(options.dailyEndTime) : -1;
    const breakStartMin = options.hasBreakTime && options.breakStartTime ? timeToMinutes(options.breakStartTime) : -1;
    const breakEndMin = options.hasBreakTime && options.breakEndTime ? timeToMinutes(options.breakEndTime) : -1;
    const durationMin = options.matchDurationMinutes || 40;
    const gapMin = options.gapMinutes || 0;

    const scheduledResults: ScheduledMatchItem[] = [];

    let currentDayIndex = 0;
    let currentDayMinutes = firstMatchMin;
    let matchesScheduledToday = 0;
    const teamMatchesToday = new Map<string, number>();

    const advanceToNextDay = (targetDayIdx?: number) => {
        currentDayIndex = typeof targetDayIdx === "number" ? Math.max(currentDayIndex + 1, targetDayIdx) : currentDayIndex + 1;
        currentDayMinutes = firstMatchMin;
        matchesScheduledToday = 0;
        teamMatchesToday.clear();
    };

    // Which day is each round scheduled to start on according to dayRoundMap?
    const roundStartDayMap = new Map<number, number>();
    dayRoundMap.forEach((rIndices, d) => {
        rIndices.forEach((rIdx) => roundStartDayMap.set(rIdx, d));
    });

    for (let rIdx = 0; rIdx < roundGroups.length; rIdx++) {
        const round = roundGroups[rIdx];
        if (!round || round.matches.length === 0) continue;

        // If this round was planned for a later day in dayRoundMap, ensure we are at least on that day
        const plannedDay = roundStartDayMap.get(rIdx) ?? 0;
        if (currentDayIndex < plannedDay) {
            currentDayIndex = plannedDay;
            currentDayMinutes = firstMatchMin;
            matchesScheduledToday = 0;
            teamMatchesToday.clear();
        }

        const remainingMatches = [...round.matches];

        while (remainingMatches.length > 0) {
            // Check if latest daily end time exceeded
            if (dailyEndMin !== -1 && currentDayMinutes + durationMin > dailyEndMin) {
                advanceToNextDay();
            }

            // Check if maxMatchesPerDay reached
            if (options.maxMatchesPerDay && options.maxMatchesPerDay > 0 && matchesScheduledToday >= options.maxMatchesPerDay) {
                advanceToNextDay();
            }

            // Check if current match slot falls into break time
            if (options.hasBreakTime && breakStartMin !== -1 && breakEndMin !== -1) {
                if (currentDayMinutes >= breakStartMin && currentDayMinutes < breakEndMin) {
                    currentDayMinutes = breakEndMin;
                }
            }

            // Re-check daily end time after break time shift
            if (dailyEndMin !== -1 && currentDayMinutes + durationMin > dailyEndMin) {
                advanceToNextDay();
            }

            // Select matches for current time slot
            const slotMatches: MatchSlotInfo[] = [];
            const activeTeamsInSlot = new Set<string>();

            for (let i = 0; i < remainingMatches.length; i++) {
                if (slotMatches.length >= effectiveCourts.length) break;
                if (options.maxMatchesPerDay && options.maxMatchesPerDay > 0 && matchesScheduledToday + slotMatches.length >= options.maxMatchesPerDay) {
                    break;
                }

                const candidate = remainingMatches[i];

                // 1. Team concurrency in this slot
                const hasConcurrencyConflict = candidate.teams.some((t) => activeTeamsInSlot.has(t));
                if (hasConcurrencyConflict) continue;

                // 2. Max matches per team per day check
                if (options.maxMatchesPerTeam && options.maxMatchesPerTeam > 0) {
                    const exceedsTeamQuota = candidate.teams.some((t) => (teamMatchesToday.get(t) || 0) >= options.maxMatchesPerTeam!);
                    if (exceedsTeamQuota) continue;
                }

                slotMatches.push(candidate);
                candidate.teams.forEach((t) => activeTeamsInSlot.add(t));
            }

            // If no match could be scheduled in this slot today:
            if (slotMatches.length === 0) {
                // If teams in this round all exceeded team quota, rollover to next day!
                if (options.maxMatchesPerTeam && options.maxMatchesPerTeam > 0) {
                    const allExceedQuota = remainingMatches.every((m) =>
                        m.teams.some((t) => (teamMatchesToday.get(t) || 0) >= options.maxMatchesPerTeam!)
                    );
                    if (allExceedQuota) {
                        advanceToNextDay();
                        continue;
                    }
                }
                if (options.maxMatchesPerDay && options.maxMatchesPerDay > 0 && matchesScheduledToday >= options.maxMatchesPerDay) {
                    advanceToNextDay();
                    continue;
                }

                // Otherwise, it was just slot team collision. Advance time slot!
                currentDayMinutes += durationMin + gapMin;
                continue;
            }

            const currentDateStr = format(addDays(startDateParsed, currentDayIndex), "yyyy-MM-dd");
            const timeStr = minutesToTime(currentDayMinutes);

            slotMatches.forEach((mInfo, courtIdx) => {
                const assignedCourt = effectiveCourts[courtIdx % effectiveCourts.length];

                scheduledResults.push({
                    nodeId: mInfo.nodeId,
                    matchIndex: mInfo.matchIndex,
                    matchId: mInfo.matchId,
                    targetDate: currentDateStr,
                    targetTime: timeStr,
                    assignedCourt,
                    roundNumber: round.roundNumber,
                    roundLabel: round.label,
                    stage: round.stage,
                });

                matchesScheduledToday += 1;
                mInfo.teams.forEach((t) => {
                    teamMatchesToday.set(t, (teamMatchesToday.get(t) || 0) + 1);
                });

                const removeIdx = remainingMatches.findIndex(
                    (rem) => rem.nodeId === mInfo.nodeId && rem.matchIndex === mInfo.matchIndex
                );
                if (removeIdx !== -1) {
                    remainingMatches.splice(removeIdx, 1);
                }
            });

            currentDayMinutes += durationMin + gapMin;
        }
    }

    return scheduledResults;
}
