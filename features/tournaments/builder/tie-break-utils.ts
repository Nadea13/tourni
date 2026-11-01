export type TieBreakCriterionKey =
    | "pts"
    | "h2h"
    | "gd"
    | "gf"
    | "wins"
    | "ga"
    | "sd"
    | "sw"
    | "pd"
    | "coin_toss";

export interface TieBreakCriterionDef {
    key: TieBreakCriterionKey;
    labelTh: string;
    labelEn: string;
    descTh: string;
    descEn: string;
    code: string;
}

export const TIE_BREAK_CRITERIA_INFO: Record<TieBreakCriterionKey, TieBreakCriterionDef> = {
    pts: {
        key: "pts",
        code: "PTS",
        labelTh: "คะแนนรวม",
        labelEn: "Points",
        descTh: "ทีมที่มีคะแนนรวมจากการแข่งขันสูงสุด",
        descEn: "Highest total points earned",
    },
    h2h: {
        key: "h2h",
        code: "H2H",
        labelTh: "ผลการพบกันโดยตรง",
        labelEn: "Head-to-Head",
        descTh: "ผลการแข่งขันระหว่างทีมที่เสมอกัน",
        descEn: "Head-to-head match results between tied teams",
    },
    gd: {
        key: "gd",
        code: "GD",
        labelTh: "ผลต่างประตูได้-เสีย",
        labelEn: "Goal Difference",
        descTh: "ผลต่างระหว่างจำนวนประตูที่ยิงได้และเสีย",
        descEn: "Goal difference across all matches",
    },
    gf: {
        key: "gf",
        code: "GF",
        labelTh: "ประตูได้",
        labelEn: "Goals For",
        descTh: "จำนวนประตูที่ยิงได้ทั้งหมด",
        descEn: "Total goals scored",
    },
    wins: {
        key: "wins",
        code: "W",
        labelTh: "จำนวนนัดที่ชนะ",
        labelEn: "Matches Won",
        descTh: "ทีมที่ชนะจำนวนแมตช์มากกว่า",
        descEn: "Total number of matches won",
    },
    ga: {
        key: "ga",
        code: "GA",
        labelTh: "เสียประตูน้อยที่สุด",
        labelEn: "Least Goals Conceded",
        descTh: "จำนวนประตูที่เสียน้อยที่สุด",
        descEn: "Fewest goals conceded",
    },
    sd: {
        key: "sd",
        code: "SD",
        labelTh: "ผลต่างเซ็ตได้-เสีย",
        labelEn: "Set Difference",
        descTh: "ผลต่างเซ็ตที่ชนะและแพ้",
        descEn: "Set difference (Sets won minus lost)",
    },
    sw: {
        key: "sw",
        code: "SW",
        labelTh: "เซ็ตที่ได้",
        labelEn: "Sets Won",
        descTh: "จำนวนเซ็ตที่ชนะทั้งหมด",
        descEn: "Total sets won",
    },
    pd: {
        key: "pd",
        code: "PD",
        labelTh: "ผลต่างแต้มรวม",
        labelEn: "Points Difference",
        descTh: "ผลต่างแต้มรวมที่ทำได้และเสีย",
        descEn: "Point difference in all sets",
    },
    coin_toss: {
        key: "coin_toss",
        code: "DRAW",
        labelTh: "จับสลาก / ลำดับผังเดิม",
        labelEn: "Draw / Slot Order",
        descTh: "ตัดสินด้วยการจับสลาก หรือลำดับผังเดิม",
        descEn: "Draw of lots or initial bracket slot order",
    },
};

export const DEFAULT_FOOTBALL_TIE_BREAK: TieBreakCriterionKey[] = [
    "pts",
    "h2h",
    "gd",
    "gf",
    "wins",
    "ga",
    "coin_toss",
];

export const DEFAULT_VOLLEYBALL_TIE_BREAK: TieBreakCriterionKey[] = [
    "pts",
    "wins",
    "h2h",
    "sd",
    "sw",
    "pd",
    "coin_toss",
];

export interface TeamStandingData {
    name: string;
    originalIndex?: number;
    originalSlotIndex?: number;
    mp: number;
    w: number;
    d?: number;
    l: number;
    gf?: number;
    ga?: number;
    gd?: number;
    sw?: number;
    sl?: number;
    sd?: number;
    pd?: number;
    pts: number;
    [key: string]: unknown;
}

export function normalizeMatchTeamName(team: unknown, placeholderA?: string, placeholderB?: string): string {
    if (typeof team === "string") return team.trim();
    if (team && typeof team === "object" && "name" in team && typeof (team as { name: unknown }).name === "string") {
        return ((team as { name: string }).name).trim();
    }
    if (placeholderA && typeof placeholderA === "string") return placeholderA.trim();
    if (placeholderB && typeof placeholderB === "string") return placeholderB.trim();
    return "";
}

export function isMatchFinished(status?: string): boolean {
    if (!status) return false;
    return [
        "finished",
        "completed",
        "live",
        "first_half",
        "second_half",
        "half_time",
        "extra_time",
        "penalties",
    ].includes(status.toLowerCase());
}

/**
 * Compare two teams based on head-to-head match results.
 * Returns negative if team A is better, positive if team B is better, or 0 if tied.
 */
export function compareHeadToHead(
    teamAName: string,
    teamBName: string,
    matches: unknown[] = [],
    isVolleyball: boolean = false
): number {
    if (!teamAName || !teamBName || teamAName === teamBName) return 0;
    const nameA = teamAName.trim().toLowerCase();
    const nameB = teamBName.trim().toLowerCase();

    let winsA = 0;
    let winsB = 0;
    let diffA = 0; // Goals or sets diff from A's perspective
    let forA = 0;
    let forB = 0;

    for (const rawMatch of matches) {
        if (!rawMatch || typeof rawMatch !== "object") continue;
        const m = rawMatch as Record<string, unknown>;
        if (!isMatchFinished(m.status as string | undefined)) continue;

        const homeName = normalizeMatchTeamName(
            m.home_team,
            m.placeholder_home as string | undefined,
            (m.placeholder_a || m.placeholderA) as string | undefined
        ).toLowerCase();

        const awayName = normalizeMatchTeamName(
            m.away_team,
            m.placeholder_away as string | undefined,
            (m.placeholder_b || m.placeholderB) as string | undefined
        ).toLowerCase();

        const isHomeA = homeName === nameA && awayName === nameB;
        const isHomeB = homeName === nameB && awayName === nameA;

        if (!isHomeA && !isHomeB) continue;

        if (isVolleyball) {
            const hSets = typeof m.home_score === "object" && m.home_score !== null && "sets" in m.home_score
                ? Number((m.home_score as { sets?: unknown }).sets) || 0
                : Number(m.home_score) || 0;
            const aSets = typeof m.away_score === "object" && m.away_score !== null && "sets" in m.away_score
                ? Number((m.away_score as { sets?: unknown }).sets) || 0
                : Number(m.away_score) || 0;

            const scoreA = isHomeA ? hSets : aSets;
            const scoreB = isHomeA ? aSets : hSets;

            forA += scoreA;
            forB += scoreB;
            diffA += (scoreA - scoreB);

            if (scoreA > scoreB) winsA++;
            else if (scoreB > scoreA) winsB++;
        } else {
            const hGoals = typeof m.home_score === "object" && m.home_score !== null && "total" in m.home_score
                ? Number((m.home_score as { total?: unknown }).total) || 0
                : Number(m.home_score) || 0;
            const aGoals = typeof m.away_score === "object" && m.away_score !== null && "total" in m.away_score
                ? Number((m.away_score as { total?: unknown }).total) || 0
                : Number(m.away_score) || 0;

            const scoreA = isHomeA ? hGoals : aGoals;
            const scoreB = isHomeA ? aGoals : hGoals;

            forA += scoreA;
            forB += scoreB;
            diffA += (scoreA - scoreB);

            if (scoreA > scoreB) winsA++;
            else if (scoreB > scoreA) winsB++;
        }
    }

    if (winsA !== winsB) {
        return winsB - winsA; // More wins ranks higher
    }
    if (diffA !== 0) {
        return -diffA; // Positive diffA means A scored more difference, so returns negative
    }
    if (forA !== forB) {
        return forB - forA; // More goals/sets scored ranks higher
    }

    return 0;
}

/**
 * Check if two teams are completely tied across all tie break criteria before the draw/coin toss stage.
 */
export function areTeamsTied(
    teamA: TeamStandingData,
    teamB: TeamStandingData,
    criteriaOrder: string[] | undefined,
    matches: unknown[] = [],
    isVolleyball: boolean = false
): boolean {
    if (!teamA || !teamB || !teamA.name || !teamB.name || teamA.name === teamB.name) {
        return false;
    }
    if (teamA.name === "TBD" || teamB.name === "TBD") {
        return false;
    }
    // Only check ties if matches have been played
    if ((teamA.mp || 0) === 0 && (teamB.mp || 0) === 0) {
        return false;
    }

    const defaultOrder = isVolleyball ? DEFAULT_VOLLEYBALL_TIE_BREAK : DEFAULT_FOOTBALL_TIE_BREAK;
    const order = (criteriaOrder && criteriaOrder.length > 0) ? criteriaOrder : defaultOrder;

    for (const crit of order) {
        if (crit === "coin_toss") continue;
        switch (crit) {
            case "pts":
                if (teamB.pts !== teamA.pts) return false;
                break;
            case "wins":
                if (teamB.w !== teamA.w) return false;
                break;
            case "h2h": {
                const h2h = compareHeadToHead(teamA.name, teamB.name, matches, isVolleyball);
                if (h2h !== 0) return false;
                break;
            }
            case "gd": {
                const gdA = teamA.gd ?? ((teamA.gf ?? 0) - (teamA.ga ?? 0));
                const gdB = teamB.gd ?? ((teamB.gf ?? 0) - (teamB.ga ?? 0));
                if (gdB !== gdA) return false;
                break;
            }
            case "gf": {
                const gfA = teamA.gf ?? 0;
                const gfB = teamB.gf ?? 0;
                if (gfB !== gfA) return false;
                break;
            }
            case "ga": {
                const gaA = teamA.ga ?? 0;
                const gaB = teamB.ga ?? 0;
                if (gaA !== gaB) return false;
                break;
            }
            case "sd": {
                const sdA = teamA.sd ?? ((teamA.sw ?? 0) - (teamA.sl ?? 0));
                const sdB = teamB.sd ?? ((teamB.sw ?? 0) - (teamB.sl ?? 0));
                if (sdB !== sdA) return false;
                break;
            }
            case "sw": {
                const swA = teamA.sw ?? 0;
                const swB = teamB.sw ?? 0;
                if (swB !== swA) return false;
                break;
            }
            case "pd": {
                const pdA = teamA.pd ?? 0;
                const pdB = teamB.pd ?? 0;
                if (pdB !== pdA) return false;
                break;
            }
        }
    }
    return true;
}

/**
 * Returns a map of teamName -> tiedGroupId for all teams that are tied on all criteria before coin toss.
 */
export function getTiedTeamGroups<T extends TeamStandingData>(
    teams: T[],
    criteriaOrder: string[] | undefined,
    matches: unknown[] = [],
    isVolleyball: boolean = false
): Map<string, string> {
    const map = new Map<string, string>();
    const validTeams = teams.filter((t) => t.name && t.name !== "TBD" && (t.mp || 0) > 0);
    let nextGroupId = 1;

    for (let i = 0; i < validTeams.length; i++) {
        const teamA = validTeams[i];
        for (let j = i + 1; j < validTeams.length; j++) {
            const teamB = validTeams[j];
            if (areTeamsTied(teamA, teamB, criteriaOrder, matches, isVolleyball)) {
                let existingGroup = map.get(teamA.name) || map.get(teamB.name);
                if (!existingGroup) {
                    existingGroup = `tie-group-${nextGroupId++}`;
                }
                map.set(teamA.name, existingGroup);
                map.set(teamB.name, existingGroup);
            }
        }
    }

    return map;
}

/**
 * Sorts group standings according to custom tie break priority criteria.
 */
export function sortStandingsByTieBreak<T extends TeamStandingData>(
    teams: T[],
    criteriaOrder: string[] | undefined,
    matches: unknown[] = [],
    isVolleyball: boolean = false,
    manualDrawOrder?: Record<string, number>
): T[] {
    const defaultOrder = isVolleyball ? DEFAULT_VOLLEYBALL_TIE_BREAK : DEFAULT_FOOTBALL_TIE_BREAK;
    const order = (criteriaOrder && criteriaOrder.length > 0) ? criteriaOrder : defaultOrder;

    const list = [...teams];
    list.sort((a, b) => {
        for (const crit of order) {
            switch (crit) {
                case "pts":
                    if (b.pts !== a.pts) return b.pts - a.pts;
                    break;
                case "wins":
                    if (b.w !== a.w) return b.w - a.w;
                    break;
                case "h2h": {
                    const h2h = compareHeadToHead(a.name, b.name, matches, isVolleyball);
                    if (h2h !== 0) return h2h;
                    break;
                }
                case "gd": {
                    const gdA = a.gd ?? ((a.gf ?? 0) - (a.ga ?? 0));
                    const gdB = b.gd ?? ((b.gf ?? 0) - (b.ga ?? 0));
                    if (gdB !== gdA) return gdB - gdA;
                    break;
                }
                case "gf": {
                    const gfA = a.gf ?? 0;
                    const gfB = b.gf ?? 0;
                    if (gfB !== gfA) return gfB - gfA;
                    break;
                }
                case "ga": {
                    // Least conceded is better, so smaller ga comes first
                    const gaA = a.ga ?? 0;
                    const gaB = b.ga ?? 0;
                    if (gaA !== gaB) return gaA - gaB;
                    break;
                }
                case "sd": {
                    const sdA = a.sd ?? ((a.sw ?? 0) - (a.sl ?? 0));
                    const sdB = b.sd ?? ((b.sw ?? 0) - (b.sl ?? 0));
                    if (sdB !== sdA) return sdB - sdA;
                    break;
                }
                case "sw": {
                    const swA = a.sw ?? 0;
                    const swB = b.sw ?? 0;
                    if (swB !== swA) return swB - swA;
                    break;
                }
                case "pd": {
                    const pdA = a.pd ?? 0;
                    const pdB = b.pd ?? 0;
                    if (pdB !== pdA) return pdB - pdA;
                    break;
                }
                case "coin_toss": {
                    if (manualDrawOrder) {
                        const orderA = manualDrawOrder[a.name];
                        const orderB = manualDrawOrder[b.name];
                        if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
                            return orderA - orderB;
                        }
                        if (orderA !== undefined && orderB === undefined) return -1;
                        if (orderA === undefined && orderB !== undefined) return 1;
                    }
                    const slotA = a.originalIndex ?? a.originalSlotIndex ?? 0;
                    const slotB = b.originalIndex ?? b.originalSlotIndex ?? 0;
                    if (slotA !== slotB) return slotA - slotB;
                    break;
                }
            }
        }

        // Final fallback: manual draw order then original slot order
        if (manualDrawOrder) {
            const orderA = manualDrawOrder[a.name];
            const orderB = manualDrawOrder[b.name];
            if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
                return orderA - orderB;
            }
            if (orderA !== undefined && orderB === undefined) return -1;
            if (orderA === undefined && orderB !== undefined) return 1;
        }

        const slotA = a.originalIndex ?? a.originalSlotIndex ?? 0;
        const slotB = b.originalIndex ?? b.originalSlotIndex ?? 0;
        return slotA - slotB;
    });

    return list;
}
