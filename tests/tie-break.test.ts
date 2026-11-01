import { describe, it, expect } from "vitest";
import {
    sortStandingsByTieBreak,
    DEFAULT_FOOTBALL_TIE_BREAK,
    DEFAULT_VOLLEYBALL_TIE_BREAK,
    TeamStandingData,
} from "@/features/tournaments/builder/tie-break-utils";

describe("Tie Break Utils", () => {
    it("should sort teams primarily by points", () => {
        const teams: TeamStandingData[] = [
            { name: "Team A", originalIndex: 0, mp: 3, w: 1, l: 2, pts: 3, gf: 5, ga: 6, gd: -1 },
            { name: "Team B", originalIndex: 1, mp: 3, w: 2, l: 1, pts: 6, gf: 4, ga: 2, gd: 2 },
            { name: "Team C", originalIndex: 2, mp: 3, w: 0, l: 3, pts: 0, gf: 1, ga: 7, gd: -6 },
        ];

        const sorted = sortStandingsByTieBreak(teams, DEFAULT_FOOTBALL_TIE_BREAK, [], false);
        expect(sorted.map((t) => t.name)).toEqual(["Team B", "Team A", "Team C"]);
    });

    it("should resolve tie using Head-to-Head when h2h is higher priority", () => {
        // Team A and Team B have identical points (6 pts)
        // Team A has worse goal difference (+2 vs +4)
        // BUT Team A defeated Team B 2-1 in their head-to-head match!
        const teams: TeamStandingData[] = [
            { name: "Team B", originalIndex: 1, mp: 3, w: 2, l: 1, pts: 6, gf: 8, ga: 4, gd: 4 },
            { name: "Team A", originalIndex: 0, mp: 3, w: 2, l: 1, pts: 6, gf: 5, ga: 3, gd: 2 },
        ];

        const matches = [
            {
                status: "finished",
                home_team: { name: "Team A" },
                away_team: { name: "Team B" },
                home_score: 2,
                away_score: 1,
            },
        ];

        // 1) With H2H before GD (default football): Team A should be ranked #1
        const sortedH2hFirst = sortStandingsByTieBreak(
            teams,
            ["pts", "h2h", "gd", "gf", "wins", "ga", "coin_toss"],
            matches,
            false
        );
        expect(sortedH2hFirst[0].name).toBe("Team A");
        expect(sortedH2hFirst[1].name).toBe("Team B");

        // 2) If user reorders GD before H2H: Team B should be ranked #1
        const sortedGdFirst = sortStandingsByTieBreak(
            teams,
            ["pts", "gd", "h2h", "gf", "wins", "ga", "coin_toss"],
            matches,
            false
        );
        expect(sortedGdFirst[0].name).toBe("Team B");
        expect(sortedGdFirst[1].name).toBe("Team A");
    });

    it("should resolve tie using Goal Difference and Goals For", () => {
        const teams: TeamStandingData[] = [
            { name: "Team X", originalIndex: 0, mp: 3, w: 1, l: 1, pts: 4, gf: 5, ga: 3, gd: 2 },
            { name: "Team Y", originalIndex: 1, mp: 3, w: 1, l: 1, pts: 4, gf: 3, ga: 2, gd: 1 },
        ];

        const sorted = sortStandingsByTieBreak(teams, ["pts", "gd", "gf"], [], false);
        expect(sorted[0].name).toBe("Team X");
        expect(sorted[1].name).toBe("Team Y");
    });

    it("should sort volleyball correctly using sets won and set difference", () => {
        const teams: TeamStandingData[] = [
            { name: "Spikers A", originalIndex: 0, mp: 2, w: 2, l: 0, pts: 6, sw: 6, sl: 1, sd: 5 },
            { name: "Spikers B", originalIndex: 1, mp: 2, w: 2, l: 0, pts: 6, sw: 6, sl: 3, sd: 3 },
        ];

        const sorted = sortStandingsByTieBreak(teams, DEFAULT_VOLLEYBALL_TIE_BREAK, [], true);
        expect(sorted[0].name).toBe("Spikers A");
        expect(sorted[1].name).toBe("Spikers B");
    });

    it("should fallback to coin_toss (original slot index) when all else is tied", () => {
        const teams: TeamStandingData[] = [
            { name: "Team 2", originalIndex: 2, mp: 1, w: 0, d: 1, l: 0, pts: 1, gf: 1, ga: 1, gd: 0 },
            { name: "Team 1", originalIndex: 1, mp: 1, w: 0, d: 1, l: 0, pts: 1, gf: 1, ga: 1, gd: 0 },
        ];

        const sorted = sortStandingsByTieBreak(teams, ["pts", "gd", "gf", "coin_toss"], [], false);
        expect(sorted[0].name).toBe("Team 1");
        expect(sorted[1].name).toBe("Team 2");
    });

    it("should prioritize manualDrawOrder on coin_toss only for tied teams", () => {
        const teams: TeamStandingData[] = [
            { name: "Leader", originalIndex: 0, mp: 2, w: 2, l: 0, pts: 6, gf: 5, ga: 1, gd: 4 },
            { name: "Tied Team A", originalIndex: 1, mp: 2, w: 1, l: 1, pts: 3, gf: 2, ga: 2, gd: 0 },
            { name: "Tied Team B", originalIndex: 2, mp: 2, w: 1, l: 1, pts: 3, gf: 2, ga: 2, gd: 0 },
            { name: "Last Place", originalIndex: 3, mp: 2, w: 0, l: 2, pts: 0, gf: 1, ga: 5, gd: -4 },
        ];

        // Without manualDrawOrder, Tied Team A (slot 1) ranks before Tied Team B (slot 2)
        const initialSorted = sortStandingsByTieBreak(teams, DEFAULT_FOOTBALL_TIE_BREAK, [], false);
        expect(initialSorted.map((t) => t.name)).toEqual([
            "Leader",
            "Tied Team A",
            "Tied Team B",
            "Last Place",
        ]);

        // With manualDrawOrder setting Tied Team B ahead of Tied Team A
        const manualDrawOrder = { "Tied Team B": 0, "Tied Team A": 1 };
        const manualSorted = sortStandingsByTieBreak(teams, DEFAULT_FOOTBALL_TIE_BREAK, [], false, manualDrawOrder);
        expect(manualSorted.map((t) => t.name)).toEqual([
            "Leader",
            "Tied Team B",
            "Tied Team A",
            "Last Place",
        ]);
    });
});
