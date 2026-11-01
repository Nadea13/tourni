import { describe, it, expect } from "vitest";
import { Node, Edge } from "@xyflow/react";
import {
    analyzeRoundsFromCanvas,
    partitionRoundsToDays,
    computeAutoSchedule,
    getTeamIdentifiers,
} from "../features/tournaments/builder/auto-schedule-utils";

describe("Auto Schedule Utils", () => {
    // Build canvas test data resembling the user's screenshot
    const createTestNodesAndEdges = () => {
        const groupNode: Node = {
            id: "group-a",
            type: "groupNode",
            position: { x: 400, y: 100 },
            data: {
                label: "Group A",
                teams: ["Team A1", "Team A2", "Team A3", "Team A4"],
            },
        };

        const md1Node: Node = {
            id: "md-1",
            type: "matchNode",
            position: { x: 100, y: 100 },
            data: {
                label: "Group A - Match Day 1",
                groupId: "group-a",
                matchDay: 1,
                matches: [
                    { id: "m-1-1", placeholderA: "Team A3", placeholderB: "Team A4" },
                    { id: "m-1-2", placeholderA: "Team A1", placeholderB: "Team A2" },
                ],
            },
        };

        const md2Node: Node = {
            id: "md-2",
            type: "matchNode",
            position: { x: 100, y: 350 },
            data: {
                label: "Group A - Match Day 2",
                groupId: "group-a",
                matchDay: 2,
                matches: [
                    { id: "m-2-1", placeholderA: "Team A1", placeholderB: "Team A3" },
                    { id: "m-2-2", placeholderA: "Team A4", placeholderB: "Team A2" },
                ],
            },
        };

        const md3Node: Node = {
            id: "md-3",
            type: "matchNode",
            position: { x: 100, y: 600 },
            data: {
                label: "Group A - Match Day 3",
                groupId: "group-a",
                matchDay: 3,
                matches: [
                    { id: "m-3-1", placeholderA: "Team A3", placeholderB: "Team A2" },
                    { id: "m-3-2", placeholderA: "Team A1", placeholderB: "Team A4" },
                ],
            },
        };

        const knockoutNode: Node = {
            id: "ko-final",
            type: "matchNode",
            position: { x: 800, y: 200 },
            data: {
                label: "Match #1 (Final)",
                matches: [
                    { id: "m-final", placeholderA: "1st Place (Group A)", placeholderB: "2nd Place (Group A)" },
                ],
            },
        };

        const nodes = [groupNode, md1Node, md2Node, md3Node, knockoutNode];

        const edges: Edge[] = [
            { id: "e1", source: "group-a", target: "md-1", sourceHandle: "group-matches", targetHandle: "group-in" },
            { id: "e2", source: "group-a", target: "md-2", sourceHandle: "group-matches", targetHandle: "group-in" },
            { id: "e3", source: "group-a", target: "md-3", sourceHandle: "group-matches", targetHandle: "group-in" },
            { id: "e4", source: "group-a", target: "ko-final", sourceHandle: "rank-1", targetHandle: "slot-a-0" },
            { id: "e5", source: "group-a", target: "ko-final", sourceHandle: "rank-2", targetHandle: "slot-b-0" },
        ];

        return { nodes, edges };
    };

    it("correctly identifies team names and ignores rank placeholders", () => {
        expect(getTeamIdentifiers({ placeholderA: "Team A1", placeholderB: "Team A2" })).toEqual(["Team A1", "Team A2"]);
        expect(getTeamIdentifiers({ placeholderA: "1st Place (Group A)", placeholderB: "2nd Place (Group A)" })).toEqual([]);
        expect(getTeamIdentifiers({ placeholderA: "Winner of Match 1", placeholderB: "TBD" })).toEqual([]);
    });

    it("analyzes rounds and places group rounds before knockout rounds", () => {
        const { nodes, edges } = createTestNodesAndEdges();
        const rounds = analyzeRoundsFromCanvas(nodes, edges);

        expect(rounds.length).toBe(4);
        expect(rounds[0].stage).toBe("group");
        expect(rounds[0].label).toContain("Match Day 1");
        expect(rounds[1].stage).toBe("group");
        expect(rounds[1].label).toContain("Match Day 2");
        expect(rounds[2].stage).toBe("group");
        expect(rounds[2].label).toContain("Match Day 3");
        expect(rounds[3].stage).toBe("knockout");
        expect(rounds[3].matches.length).toBe(1);
    });

    it("partitions rounds to tournament days accurately", () => {
        // 4 rounds into 2 days -> 2 rounds each day
        expect(partitionRoundsToDays(4, 2)).toEqual([[0, 1], [2, 3]]);

        // 4 rounds into 1 day -> all 4 rounds on day 1
        expect(partitionRoundsToDays(4, 1)).toEqual([[0, 1, 2, 3]]);

        // 4 rounds into 4 days -> 1 round per day
        expect(partitionRoundsToDays(4, 4)).toEqual([[0], [1], [2], [3]]);
    });

    it("schedules matches across 2 tournament days without team collision", () => {
        const { nodes, edges } = createTestNodesAndEdges();
        const results = computeAutoSchedule(nodes, edges, {
            startDate: "2026-10-31",
            endDate: "2026-11-01",
            firstMatchTime: "09:00",
            matchDurationMinutes: 40,
            hasBreakTime: false,
            selectedCourts: ["สนาม 1", "สนาม 2"],
        });

        expect(results.length).toBe(7); // 2 in MD1 + 2 in MD2 + 2 in MD3 + 1 in Final

        // Day 1: Round 1 & Round 2
        const day1Matches = results.filter((r) => r.targetDate === "2026-10-31");
        const day2Matches = results.filter((r) => r.targetDate === "2026-11-01");

        expect(day1Matches.length).toBe(4); // MD1 and MD2
        expect(day2Matches.length).toBe(3); // MD3 and Final

        // Verify MD1 matches run at 09:00 on สนาม 1 and สนาม 2
        const md1Matches = results.filter((r) => r.nodeId === "md-1");
        expect(md1Matches[0].targetDate).toBe("2026-10-31");
        expect(md1Matches[0].targetTime).toBe("09:00");
        expect(md1Matches[1].targetDate).toBe("2026-10-31");
        expect(md1Matches[1].targetTime).toBe("09:00");
        expect(md1Matches.map((m) => m.assignedCourt).sort()).toEqual(["สนาม 1", "สนาม 2"]);

        // Verify MD2 matches start at 09:40 on Day 1
        const md2Matches = results.filter((r) => r.nodeId === "md-2");
        expect(md2Matches[0].targetDate).toBe("2026-10-31");
        expect(md2Matches[0].targetTime).toBe("09:40");
        expect(md2Matches[1].targetDate).toBe("2026-10-31");
        expect(md2Matches[1].targetTime).toBe("09:40");

        // Verify Day 2: MD3 at 09:00, Final at 09:40
        const md3Matches = results.filter((r) => r.nodeId === "md-3");
        expect(md3Matches[0].targetDate).toBe("2026-11-01");
        expect(md3Matches[0].targetTime).toBe("09:00");

        const finalMatch = results.find((r) => r.nodeId === "ko-final");
        expect(finalMatch).toBeDefined();
        expect(finalMatch?.targetDate).toBe("2026-11-01");
        expect(finalMatch?.targetTime).toBe("09:40"); // Played AFTER MD3 on Day 2!

        // Crucial: Check that in any single time slot, no team plays twice
        const timeSlotMap = new Map<string, string[]>();
        results.forEach((r) => {
            const key = `${r.targetDate} ${r.targetTime}`;
            if (!timeSlotMap.has(key)) timeSlotMap.set(key, []);
            // find original teams
            const origNode = nodes.find((n) => n.id === r.nodeId);
            const rawM = (origNode?.data.matches as any[])[r.matchIndex];
            const teams = getTeamIdentifiers(rawM);
            teams.forEach((t) => {
                expect(timeSlotMap.get(key)!).not.toContain(t);
                timeSlotMap.get(key)!.push(t);
            });
        });
    });

    it("compacts into 1 day if tournament only has 1 day", () => {
        const { nodes, edges } = createTestNodesAndEdges();
        const results = computeAutoSchedule(nodes, edges, {
            startDate: "2026-10-31",
            endDate: "2026-10-31", // 1 day only
            firstMatchTime: "09:00",
            matchDurationMinutes: 40,
            hasBreakTime: false,
            selectedCourts: ["สนาม 1", "สนาม 2"],
        });

        // All 7 matches must be on 2026-10-31
        expect(results.every((r) => r.targetDate === "2026-10-31")).toBe(true);

        // Sequence of times:
        // 09:00 -> MD1
        // 09:40 -> MD2
        // 10:20 -> MD3
        // 11:00 -> Final
        const finalMatch = results.find((r) => r.nodeId === "ko-final");
        expect(finalMatch?.targetTime).toBe("11:00");
    });

    it("respects break time (e.g. lunch 12:00 - 13:00)", () => {
        const { nodes, edges } = createTestNodesAndEdges();
        const results = computeAutoSchedule(nodes, edges, {
            startDate: "2026-10-31",
            endDate: "2026-10-31",
            firstMatchTime: "11:30", // 11:30 + 40m = 12:10, which enters lunch break
            matchDurationMinutes: 40,
            hasBreakTime: true,
            breakStartTime: "12:00",
            breakEndTime: "13:00",
            selectedCourts: ["สนาม 1", "สนาม 2"],
        });

        // MD1 should run at 11:30
        const md1 = results.filter((r) => r.nodeId === "md-1");
        expect(md1[0].targetTime).toBe("11:30");

        // Next round (MD2) must skip to 13:00 (break end)
        const md2 = results.filter((r) => r.nodeId === "md-2");
        expect(md2[0].targetTime).toBe("13:00");
    });

    it("respects maxMatchesPerTeam limit per day", () => {
        const { nodes, edges } = createTestNodesAndEdges();
        // If maxMatchesPerTeam = 1, each team can play at most 1 match per day!
        // Group has MD1, MD2, MD3 -> requires 3 separate days!
        const results = computeAutoSchedule(nodes, edges, {
            startDate: "2026-10-31",
            firstMatchTime: "09:00",
            matchDurationMinutes: 40,
            hasBreakTime: false,
            selectedCourts: ["สนาม 1", "สนาม 2"],
            maxMatchesPerTeam: 1,
        });

        const md1Matches = results.filter((r) => r.nodeId === "md-1");
        const md2Matches = results.filter((r) => r.nodeId === "md-2");
        const md3Matches = results.filter((r) => r.nodeId === "md-3");

        expect(md1Matches.every((m) => m.targetDate === "2026-10-31")).toBe(true);
        expect(md2Matches.every((m) => m.targetDate === "2026-11-01")).toBe(true);
        expect(md3Matches.every((m) => m.targetDate === "2026-11-02")).toBe(true);
    });

    it("respects maxMatchesPerDay total match limit per day", () => {
        const { nodes, edges } = createTestNodesAndEdges();
        // Total matches = 7. If maxMatchesPerDay = 3:
        // Day 1 has 3 matches, Day 2 has 3 matches, Day 3 has 1 match!
        const results = computeAutoSchedule(nodes, edges, {
            startDate: "2026-10-31",
            firstMatchTime: "09:00",
            matchDurationMinutes: 40,
            hasBreakTime: false,
            selectedCourts: ["สนาม 1", "สนาม 2"],
            maxMatchesPerDay: 3,
        });

        const day1 = results.filter((r) => r.targetDate === "2026-10-31");
        const day2 = results.filter((r) => r.targetDate === "2026-11-01");
        const day3 = results.filter((r) => r.targetDate === "2026-11-02");

        expect(day1.length).toBe(3);
        expect(day2.length).toBe(3);
        expect(day3.length).toBe(1);
    });

    it("respects dailyEndTime cutoff per day", () => {
        const { nodes, edges } = createTestNodesAndEdges();
        // 1 court, firstMatch: 09:00, duration: 60m, dailyEndTime: 11:00
        // Slot 1: 09:00 - 10:00 (ends 10:00 <= 11:00 -> ok)
        // Slot 2: 10:00 - 11:00 (ends 11:00 <= 11:00 -> ok)
        // Slot 3 would be 11:00 - 12:00, but 12:00 > 11:00 cutoff -> must roll over to next day!
        const results = computeAutoSchedule(nodes, edges, {
            startDate: "2026-10-31",
            firstMatchTime: "09:00",
            dailyEndTime: "11:00",
            matchDurationMinutes: 60,
            hasBreakTime: false,
            selectedCourts: ["สนาม 1"],
        });

        const day1 = results.filter((r) => r.targetDate === "2026-10-31");
        expect(day1.length).toBe(2);
        expect(day1[0].targetTime).toBe("09:00");
        expect(day1[1].targetTime).toBe("10:00");

        const day2 = results.filter((r) => r.targetDate === "2026-11-01");
        expect(day2.length).toBeGreaterThan(0);
        expect(day2[0].targetTime).toBe("09:00");
    });
});
