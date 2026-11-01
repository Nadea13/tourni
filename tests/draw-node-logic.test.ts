import { describe, it, expect, beforeEach } from "vitest";
import { useBracketStore } from "@/lib/stores/bracket-store";

describe("Draw Node Logic & Bracket Store Integration", () => {
    beforeEach(() => {
        useBracketStore.getState().reset();
    });

    it("should add a new drawNode correctly", () => {
        const store = useBracketStore.getState();
        store.addDrawNode({ x: 100, y: 150 });

        const nodes = useBracketStore.getState().nodes;
        const drawNode = nodes.find((n) => n.type === "drawNode");

        expect(drawNode).toBeDefined();
        expect(drawNode?.position).toEqual({ x: 100, y: 150 });
        expect(drawNode?.data.teams).toEqual([]);
        expect(drawNode?.data.drawnPairs).toEqual([]);
    });

    it("should propagate team to drawNode pool on connection", () => {
        const store = useBracketStore.getState();

        // 1. Add Group Node
        store.addGroupNode({ x: 0, y: 0 });
        const groupNode = useBracketStore.getState().nodes.find((n) => n.type === "groupNode")!;
        store.updateNodeData(groupNode.id, {
            label: "Group A",
            teams: ["Team Alpha", "Team Beta", "Team Gamma", "Team Delta"],
        });

        // 2. Add Draw Node
        store.addDrawNode({ x: 350, y: 0 });
        const drawNode = useBracketStore.getState().nodes.find((n) => n.type === "drawNode")!;

        // 3. Connect rank-0 (1st Place) from Group A to Draw Node
        store.onConnect({
            source: groupNode.id,
            target: drawNode.id,
            sourceHandle: "rank-0",
            targetHandle: "draw-in",
        });

        const updatedDrawNode = useBracketStore.getState().nodes.find((n) => n.id === drawNode.id)!;
        expect(updatedDrawNode.data.teams).toContain("Team Alpha");

        // 4. Connect rank-1 (2nd Place) from Group A to Draw Node
        store.onConnect({
            source: groupNode.id,
            target: drawNode.id,
            sourceHandle: "rank-1",
            targetHandle: "draw-in",
        });

        const updatedDrawNode2 = useBracketStore.getState().nodes.find((n) => n.id === drawNode.id)!;
        expect(updatedDrawNode2.data.teams).toContain("Team Alpha");
        expect(updatedDrawNode2.data.teams).toContain("Team Beta");
        expect(updatedDrawNode2.data.teams).toHaveLength(2);
    });

    it("should shuffle and pair all teams in pool", () => {
        const store = useBracketStore.getState();
        store.addDrawNode({ x: 0, y: 0 });
        const drawNode = useBracketStore.getState().nodes.find((n) => n.type === "drawNode")!;

        const initialTeams = ["Team A", "Team B", "Team C", "Team D"];
        store.updateNodeData(drawNode.id, { teams: initialTeams });

        store.shuffleDrawNode(drawNode.id);

        const updatedDrawNode = useBracketStore.getState().nodes.find((n) => n.id === drawNode.id)!;
        const pairs = updatedDrawNode.data.drawnPairs as { id: string; teamA: string; teamB: string }[];

        expect(pairs).toHaveLength(2);
        const allPaired = pairs.flatMap((p) => [p.teamA, p.teamB]);
        expect(allPaired.sort()).toEqual(initialTeams.sort());
        expect(updatedDrawNode.data.lastDrawnAt).toBeDefined();
    });

    it("should generate next round as a single Round Node container", () => {
        const store = useBracketStore.getState();
        store.addDrawNode({ x: 100, y: 100 });
        const drawNode = useBracketStore.getState().nodes.find((n) => n.type === "drawNode")!;

        store.updateNodeData(drawNode.id, {
            teams: ["Team 1", "Team 2", "Team 3", "Team 4"],
        });

        // Generate as Round container
        store.generateNextRoundFromDraw(drawNode.id, "round");

        const nodes = useBracketStore.getState().nodes;
        const edges = useBracketStore.getState().edges;

        const roundNode = nodes.find((n) => n.type === "matchNode" && n.id.startsWith("match-round"));
        expect(roundNode).toBeDefined();
        const matches = roundNode?.data.matches as any[];
        expect(matches).toHaveLength(2); // 4 teams = 2 matches

        // Edge exists connecting drawNode to roundNode
        const connectedEdge = edges.find((e) => e.source === drawNode.id && e.target === roundNode?.id);
        expect(connectedEdge).toBeDefined();
        expect(connectedEdge?.animated).toBe(false);
        expect((connectedEdge?.style as any)?.stroke).toBe("var(--muted-foreground)");
    });

    it("should generate next round as separate Match Nodes", () => {
        const store = useBracketStore.getState();
        store.addDrawNode({ x: 100, y: 100 });
        const drawNode = useBracketStore.getState().nodes.find((n) => n.type === "drawNode")!;

        store.updateNodeData(drawNode.id, {
            teams: ["Team 1", "Team 2", "Team 3", "Team 4"],
        });

        // Generate as separate matches
        store.generateNextRoundFromDraw(drawNode.id, "matches");

        const nodes = useBracketStore.getState().nodes;
        const matchNodes = nodes.filter((n) => n.type === "matchNode" && !n.id.startsWith("match-round"));

        expect(matchNodes).toHaveLength(2); // 2 matches
        const edges = useBracketStore.getState().edges;
        const connectedEdges = edges.filter((e) => e.source === drawNode.id);
        expect(connectedEdges).toHaveLength(2);
        connectedEdges.forEach((e) => {
            expect((e.style as any)?.stroke).toBe("var(--muted-foreground)");
        });
    });

    it("should connect a Round node into a Draw node via a single line (round-out -> draw-in)", () => {
        const store = useBracketStore.getState();

        // 1. Create a Round node with 4 matches
        store.addMatchNode({ x: 0, y: 0 });
        const roundNode = useBracketStore.getState().nodes.find((n) => n.type === "matchNode")!;
        store.updateNodeData(roundNode.id, {
            label: "Round of 8",
            matches: [
                { id: "m1", placeholderA: "Winner 1", placeholderB: "TBD" },
                { id: "m2", placeholderA: "Winner 2", placeholderB: "TBD" },
                { id: "m3", placeholderA: "Winner 3", placeholderB: "TBD" },
                { id: "m4", placeholderA: "Winner 4", placeholderB: "TBD" },
            ],
        });

        // 2. Create Draw Node
        store.addDrawNode({ x: 400, y: 0 });
        const drawNode = useBracketStore.getState().nodes.find((n) => n.type === "drawNode")!;

        // 3. Connect via single line (round-out -> draw-in)
        store.onConnect({
            source: roundNode.id,
            target: drawNode.id,
            sourceHandle: "round-out",
            targetHandle: "draw-in",
        });

        const updatedDrawNode = useBracketStore.getState().nodes.find((n) => n.id === drawNode.id)!;
        expect(updatedDrawNode.data.teams).toEqual(["Winner 1", "Winner 2", "Winner 3", "Winner 4"]);
    });

    it("should connect a Draw node into a Round node via a single line (draw-out -> round-in)", () => {
        const store = useBracketStore.getState();

        // 1. Create Draw Node with drawn pairs
        store.addDrawNode({ x: 0, y: 0 });
        const drawNode = useBracketStore.getState().nodes.find((n) => n.type === "drawNode")!;
        store.updateNodeData(drawNode.id, {
            drawnPairs: [
                { id: "p1", teamA: "Chelsea", teamB: "PSG" },
                { id: "p2", teamA: "Real Madrid", teamB: "Bayern" },
            ],
        });

        // 2. Create Round node with 2 matches
        store.addMatchNode({ x: 400, y: 0 });
        const roundNode = useBracketStore.getState().nodes.find((n) => n.type === "matchNode")!;
        store.updateNodeData(roundNode.id, {
            label: "Quarterfinals",
            matches: [
                { id: "m1", placeholderA: "TBD", placeholderB: "TBD" },
                { id: "m2", placeholderA: "TBD", placeholderB: "TBD" },
            ],
        });

        // 3. Connect single line (draw-out -> round-in)
        store.onConnect({
            source: drawNode.id,
            target: roundNode.id,
            sourceHandle: "draw-out",
            targetHandle: "round-in",
        });

        const updatedRoundNode = useBracketStore.getState().nodes.find((n) => n.id === roundNode.id)!;
        const matches = updatedRoundNode.data.matches as any[];
        expect(matches[0].placeholderA).toBe("Chelsea");
        expect(matches[0].placeholderB).toBe("PSG");
        expect(matches[1].placeholderA).toBe("Real Madrid");
        expect(matches[1].placeholderB).toBe("Bayern");

        // Edge must also be created!
        const edges = useBracketStore.getState().edges;
        const edge = edges.find((e) => e.source === drawNode.id && e.target === roundNode.id);
        expect(edge).toBeDefined();
        expect(edge?.sourceHandle).toBe("draw-out");
        expect(edge?.targetHandle).toBe("round-in");
    });

    it("should support adding round nodes directly via addRoundNode", () => {
        const store = useBracketStore.getState();
        store.addRoundNode({ x: 200, y: 200 }, 4);

        const nodes = useBracketStore.getState().nodes;
        const roundNode = nodes.find((n) => n.id.startsWith("round-"));
        expect(roundNode).toBeDefined();
        expect(roundNode?.data.isRound).toBe(true);
        expect(roundNode?.data.label).toBe("Round of 8");
        expect((roundNode?.data.matches as any[])).toHaveLength(4);
    });

    it("should connect Round 1 to Round 2 directly via single line (round-out -> round-in)", () => {
        const store = useBracketStore.getState();

        // Round of 8 (4 matches = 4 winners)
        store.addRoundNode({ x: 0, y: 0 }, 4);
        const round1 = useBracketStore.getState().nodes.find((n) => n.id.startsWith("round-"))!;
        store.updateNodeData(round1.id, {
            label: "Quarterfinals",
            matches: [
                { id: "m1", placeholderA: "Arsenal", placeholderB: "Chelsea" },
                { id: "m2", placeholderA: "Liverpool", placeholderB: "Man City" },
                { id: "m3", placeholderA: "Real Madrid", placeholderB: "Barcelona" },
                { id: "m4", placeholderA: "Bayern", placeholderB: "PSG" },
            ],
        });

        // Round of 4 (empty target node)
        store.addMatchNode({ x: 400, y: 0 });
        const round2 = useBracketStore.getState().nodes.find((n) => n.id.startsWith("match-"))!;
        store.updateNodeData(round2.id, {
            label: "Semifinals",
            isRound: true,
            matches: [],
        });

        // Connect round-out -> round-in
        store.onConnect({
            source: round1.id,
            target: round2.id,
            sourceHandle: "round-out",
            targetHandle: "round-in",
        });

        const updatedRound2 = useBracketStore.getState().nodes.find((n) => n.id === round2.id)!;
        const matches = updatedRound2.data.matches as any[];
        expect(matches).toHaveLength(2);
        expect(matches[0].placeholderA).toBe("Arsenal");
        expect(matches[0].placeholderB).toBe("Liverpool");
        expect(matches[1].placeholderA).toBe("Real Madrid");
        expect(matches[1].placeholderB).toBe("Bayern");

        const edge = useBracketStore.getState().edges.find((e) => e.source === round1.id && e.target === round2.id);
        expect(edge).toBeDefined();
    });

    it("should allow editing pairs and swapping teams via updateDrawPair and swapDrawPairSlots", () => {
        const store = useBracketStore.getState();
        store.addDrawNode({ x: 0, y: 0 });
        const drawNode = useBracketStore.getState().nodes.find((n) => n.type === "drawNode")!;

        store.updateNodeData(drawNode.id, {
            teams: ["Team 1", "Team 2", "Team 3", "Team 4"],
            drawnPairs: [
                { id: "p1", teamA: "Team 1", teamB: "Team 2" },
                { id: "p2", teamA: "Team 3", teamB: "Team 4" },
            ],
        });

        // 1. Swap Home/Away in Pair 1
        store.swapDrawPairSlots(drawNode.id, 0);
        let updated = useBracketStore.getState().nodes.find((n) => n.id === drawNode.id)!;
        let pairs = updated.data.drawnPairs as any[];
        expect(pairs[0].teamA).toBe("Team 2");
        expect(pairs[0].teamB).toBe("Team 1");

        // 2. Change Team B in Pair 1 to "Team 4" (which is in Pair 2) -> should swap with Pair 2!
        store.updateDrawPair(drawNode.id, 0, "teamB", "Team 4");
        updated = useBracketStore.getState().nodes.find((n) => n.id === drawNode.id)!;
        pairs = updated.data.drawnPairs as any[];
        expect(pairs[0].teamA).toBe("Team 2");
        expect(pairs[0].teamB).toBe("Team 4");
        expect(pairs[1].teamA).toBe("Team 3");
        expect(pairs[1].teamB).toBe("Team 1"); // Team 1 swapped into Pair 2
    });

    it("should auto-distribute incoming connections to drawNode so lines do not converge", () => {
        const store = useBracketStore.getState();
        store.addDrawNode({ x: 400, y: 0 });
        const drawNode = useBracketStore.getState().nodes.find((n) => n.type === "drawNode")!;

        store.addMatchNode({ x: 0, y: 0 });
        store.addMatchNode({ x: 0, y: 150 });
        const matchNodes = useBracketStore.getState().nodes.filter((n) => n.type === "matchNode");

        // Connect Match 1 to Draw Node
        store.onConnect({
            source: matchNodes[0].id,
            target: drawNode.id,
            sourceHandle: "winner-0",
            targetHandle: "draw-in",
        });

        // Connect Match 2 to Draw Node
        store.onConnect({
            source: matchNodes[1].id,
            target: drawNode.id,
            sourceHandle: "winner-0",
            targetHandle: "draw-in",
        });

        const edges = useBracketStore.getState().edges.filter((e) => e.target === drawNode.id);
        expect(edges).toHaveLength(2);
        // All incoming edges converge into the single center point 'draw-in'
        expect(edges[0].targetHandle).toBe("draw-in");
        expect(edges[1].targetHandle).toBe("draw-in");
    });

    it("should update ONLY the separated match node when swapping pairs in separate matches mode", () => {
        const store = useBracketStore.getState();
        store.addDrawNode({ x: 0, y: 0 });
        const drawNode = useBracketStore.getState().nodes.find((n) => n.type === "drawNode")!;

        store.updateNodeData(drawNode.id, {
            teams: ["Team 1", "Team 2", "Team 3", "Team 4"],
            drawnPairs: [
                { id: "p1", teamA: "Team 1", teamB: "Team 2" },
                { id: "p2", teamA: "Team 3", teamB: "Team 4" },
            ],
        });

        // Generate as separate matches ("แบบแยกคู่")
        store.generateNextRoundFromDraw(drawNode.id, "matches");

        let nodes = useBracketStore.getState().nodes;
        const edges = useBracketStore.getState().edges;

        const edgePair0 = edges.find((e) => e.source === drawNode.id && e.sourceHandle === "pair-out-0")!;
        const edgePair1 = edges.find((e) => e.source === drawNode.id && e.sourceHandle === "pair-out-1")!;

        let matchNode1 = nodes.find((n) => n.id === edgePair0.target)!;
        let matchNode2 = nodes.find((n) => n.id === edgePair1.target)!;

        expect(matchNode1.data.matches as any[]).toHaveLength(1);
        expect((matchNode1.data.matches as any[])[0].placeholderA).toBe("Team 1");
        expect((matchNode1.data.matches as any[])[0].placeholderB).toBe("Team 2");

        expect(matchNode2.data.matches as any[]).toHaveLength(1);
        expect((matchNode2.data.matches as any[])[0].placeholderA).toBe("Team 3");
        expect((matchNode2.data.matches as any[])[0].placeholderB).toBe("Team 4");

        // Swap Pair 0 only: should update Match Node 1, and NOT touch Match Node 2
        store.swapDrawPairSlots(drawNode.id, 0);

        nodes = useBracketStore.getState().nodes;
        matchNode1 = nodes.find((n) => n.id === edgePair0.target)!;
        matchNode2 = nodes.find((n) => n.id === edgePair1.target)!;

        // Match Node 1 has its teams swapped and retains 1 match
        expect(matchNode1.data.matches as any[]).toHaveLength(1);
        expect((matchNode1.data.matches as any[])[0].placeholderA).toBe("Team 2");
        expect((matchNode1.data.matches as any[])[0].placeholderB).toBe("Team 1");

        // Match Node 2 is UNTOUCHED
        expect(matchNode2.data.matches as any[]).toHaveLength(1);
        expect((matchNode2.data.matches as any[])[0].placeholderA).toBe("Team 3");
        expect((matchNode2.data.matches as any[])[0].placeholderB).toBe("Team 4");
    });

    it("should connect each pair from draw node to round node via pair-out-idx", () => {
        const store = useBracketStore.getState();
        store.addDrawNode({ x: 0, y: 0 });
        const drawNode = useBracketStore.getState().nodes.find((n) => n.type === "drawNode")!;

        store.updateNodeData(drawNode.id, {
            teams: ["Team 1", "Team 2", "Team 3", "Team 4"],
            drawnPairs: [
                { id: "p1", teamA: "Team 1", teamB: "Team 2" },
                { id: "p2", teamA: "Team 3", teamB: "Team 4" },
            ],
        });

        // Generate as Round mode
        store.generateNextRoundFromDraw(drawNode.id, "round");

        const edges = useBracketStore.getState().edges.filter((e) => e.source === drawNode.id);
        expect(edges).toHaveLength(1);
        expect(edges[0].sourceHandle).toBe("draw-out");
        expect(edges[0].targetHandle).toBe("round-in");
    });

    it("should connect a Round node into a Draw node via centered draw-in handle", () => {
        const store = useBracketStore.getState();
        store.addRoundNode({ x: 0, y: 0 }, 4);
        const roundNode = useBracketStore.getState().nodes.find((n) => n.id.startsWith("round-"))!;
        store.addDrawNode({ x: 400, y: 0 });
        const drawNode = useBracketStore.getState().nodes.find((n) => n.type === "drawNode")!;

        store.onConnect({
            source: roundNode.id,
            target: drawNode.id,
            sourceHandle: "round-out",
            targetHandle: "draw-in",
        });

        const edge = useBracketStore.getState().edges.find((e) => e.source === roundNode.id && e.target === drawNode.id);
        expect(edge).toBeDefined();
        expect(edge?.targetHandle).toBe("draw-in");
    });
});
