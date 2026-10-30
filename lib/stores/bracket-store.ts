import { create } from "zustand";
import {
    Node,
    Edge,
    Connection,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    NodeChange,
    EdgeChange,
} from "@xyflow/react";
import { BracketCanvasData, Match, TournamentTeam, SportType } from "@/types";

export interface MatchNodeData {
    label: string;
    matches: {
        id: string;
        placeholderA: string;
        placeholderB: string;
        match_date?: string;
        match_time?: string;
        dbId?: string;
        matchId?: string;
    }[];
    [key: string]: unknown;
}

export interface DrawPair {
    id: string;
    teamA: string;
    teamB: string;
}

export interface DrawNodeData {
    label: string;
    mode?: "open" | "pots";
    pot1Count?: number;
    teams: string[];
    drawnPairs: DrawPair[];
    lastDrawnAt?: string;
    generatedTargetType?: "round" | "matches";
    generatedNodeIds?: string[];
    [key: string]: unknown;
}

export interface RoundRobinMatchPair {
    slotA: number;
    slotB: number;
    homeIdx?: number;
    awayIdx?: number;
    teamA: string;
    teamB: string;
}

export interface RoundRobinDay {
    day: number;
    matches: RoundRobinMatchPair[];
}

function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function computeRoundRobinDays(teams: string[], groupSuffix?: string, randomize = true): RoundRobinDay[] {
    const effectiveCount = Math.max(2, teams.length);
    const n = effectiveCount % 2 === 0 ? effectiveCount : effectiveCount + 1;
    const isOdd = effectiveCount % 2 !== 0;

    const paddedTeams = [...teams];
    while (paddedTeams.length < effectiveCount) {
        paddedTeams.push("TBD");
    }

    // Slot assignments (randomized or sequential)
    const slotIndices = randomize
        ? shuffleArray(Array.from({ length: effectiveCount }, (_, i) => i))
        : Array.from({ length: effectiveCount }, (_, i) => i);

    const half = n / 2;
    const top = Array.from({ length: half }, (_, i) => i);
    const bottom = Array.from({ length: half }, (_, i) => half + i);

    const rawDays: RoundRobinMatchPair[][] = [];

    for (let r = 0; r < n - 1; r++) {
        const dayMatches: RoundRobinMatchPair[] = [];
        for (let i = 0; i < half; i++) {
            const idxA = top[i];
            const idxB = bottom[i];

            if (isOdd && (idxA === n - 1 || idxB === n - 1)) {
                continue;
            }

            const isHome = randomize ? Math.random() > 0.5 : (i + r) % 2 === 0;
            const h = isHome ? idxA : idxB;
            const aw = isHome ? idxB : idxA;

            const slotA = slotIndices[h];
            const slotB = slotIndices[aw];

            const rawA = paddedTeams[slotA];
            const rawB = paddedTeams[slotB];

            const defaultA = groupSuffix ? `Team ${groupSuffix.toUpperCase()}${slotA + 1}` : `Team ${slotA + 1}`;
            const defaultB = groupSuffix ? `Team ${groupSuffix.toUpperCase()}${slotB + 1}` : `Team ${slotB + 1}`;

            const teamA = rawA && rawA.trim() && rawA !== "TBD" ? rawA.trim() : defaultA;
            const teamB = rawB && rawB.trim() && rawB !== "TBD" ? rawB.trim() : defaultB;

            dayMatches.push({
                slotA,
                slotB,
                homeIdx: slotA,
                awayIdx: slotB,
                teamA,
                teamB,
            });
        }

        if (dayMatches.length > 0) {
            rawDays.push(dayMatches);
        }

        // Clockwise rotation fixing top[0]
        const ring = [...top.slice(1), ...bottom.slice().reverse()];
        const rotatedRing = [ring[ring.length - 1], ...ring.slice(0, ring.length - 1)];
        for (let j = 0; j < half - 1; j++) {
            top[j + 1] = rotatedRing[j];
        }
        const bottomRotated = rotatedRing.slice(half - 1).reverse();
        for (let j = 0; j < half; j++) {
            bottom[j] = bottomRotated[j];
        }
    }

    const finalDays = randomize ? shuffleArray(rawDays) : rawDays;
    return finalDays.map((matches, idx) => ({
        day: idx + 1,
        matches,
    }));
}

interface BracketState {
    nodes: Node[];
    edges: Edge[];
    nodeCounter: number;
    isDirty: boolean;

    // Actions
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    onReconnect: (oldEdge: Edge, newConnection: Connection) => void;
    addMatchNode: (position?: { x: number; y: number }) => void;
    addRoundNode: (position?: { x: number; y: number }, matchCount?: number) => void;
    addGroupNode: (position?: { x: number; y: number }) => void;
    addDrawNode: (position?: { x: number; y: number }) => void;
    shuffleDrawNode: (drawNodeId: string) => void;
    updateDrawPair: (drawNodeId: string, pairIndex: number, slot: "teamA" | "teamB", newTeam: string) => void;
    swapDrawPairSlots: (drawNodeId: string, pairIndex: number) => void;
    generateNextRoundFromDraw: (drawNodeId: string, format: "round" | "matches") => void;
    insertTemplate: (templateNodes: Node[], templateEdges: Edge[], targetPosition?: { x: number; y: number }) => void;
    generateRoundRobinMatches: (groupId: string) => void;
    generateRoundRobinMatchDays: (groupId: string) => void;
    deleteNode: (id: string) => void;
    hydrate: (data: BracketCanvasData | null) => void;
    reset: () => void;
    getCanvasData: () => BracketCanvasData;
    markClean: () => void;
    syncMatches: (matches: Match[]) => void;
    updateNodeData: (id: string, newData: Record<string, unknown>, skipDirty?: boolean) => void;
    selectNode: (id: string | null) => void;
    teams: TournamentTeam[];
    setTeams: (teams: TournamentTeam[]) => void;
    fetchTeams: (categoryId: string, tournamentId?: string) => Promise<void>;
    matches: Match[];
    setMatches: (matches: Match[] | ((prev: Match[]) => Match[])) => void;
    activeNodeId: string | null;
    setActiveNodeId: (id: string | null) => void;
    activeCategoryId: string | null;
    setActiveCategoryId: (id: string | null) => void;
    sport: SportType | null;
    setSport: (sport: SportType | null) => void;

    // History and Clipboard
    past: { nodes: Node[]; edges: Edge[] }[];
    future: { nodes: Node[]; edges: Edge[] }[];
    clipboard: { nodes: Node[]; edges: Edge[] } | null;
    takeSnapshot: () => void;
    undo: () => void;
    redo: () => void;
    copyNodes: () => void;
    cutNodes: () => void;
    pasteNodes: () => void;
}

export const useBracketStore = create<BracketState>((set, get) => ({
    nodes: [],
    edges: [],
    nodeCounter: 0,
    isDirty: false,
    teams: [],
    setTeams: (teams) => set({ teams }),
    matches: [],
    setMatches: (matches) => set((state) => ({
        matches: typeof matches === 'function' ? matches(state.matches) : matches
    })),
    fetchTeams: async (categoryId: string, tournamentId?: string) => {
        let tId = tournamentId;
        if (!tId || tId === '0') {
            if (typeof window !== 'undefined') {
                const match = window.location.pathname.match(/\/tournaments\/([a-zA-Z0-9_-]+)/);
                if (match) tId = match[1];
            }
        }
        if (!tId || tId === '0' || !categoryId) return;
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
            const res = await fetch(`${apiUrl}/tournaments/${tId}/teams?category_id=${categoryId}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data) ? data : (data?.data || []);
                const mapped = list.map((t: any) => ({
                    ...t,
                    name: t.team?.name || t.name || "Unknown Team",
                    logo_url: t.team?.logo_img || t.team?.logo_url || t.logo_img || t.logo_url || null,
                }));
                set({ teams: mapped });
            }
        } catch (e) {
            console.error("fetchTeams error:", e);
        }
    },
    activeNodeId: null,
    setActiveNodeId: (id) =>
        set((state) => ({
            activeNodeId: id,
            nodes: state.nodes.some((n) => (n.id === id) !== !!n.selected)
                ? state.nodes.map((n) => ({
                      ...n,
                      selected: n.id === id,
                  }))
                : state.nodes,
        })),
    activeCategoryId: null,
    setActiveCategoryId: (id) => set({ activeCategoryId: id }),
    sport: null,
    setSport: (sport) => set({ sport }),

    past: [],
    future: [],
    clipboard: null,

    takeSnapshot: () => {
        const { nodes, edges, past } = get();
        set({
            past: [...past, {
                nodes: JSON.parse(JSON.stringify(nodes)) as Node[],
                edges: JSON.parse(JSON.stringify(edges)) as Edge[]
            }].slice(-30),
            future: []
        });
    },

    undo: () => {
        const { past, future, nodes, edges } = get();
        if (past.length === 0) return;
        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);
        set({
            nodes: previous.nodes,
            edges: previous.edges,
            past: newPast,
            future: [{
                nodes: JSON.parse(JSON.stringify(nodes)) as Node[],
                edges: JSON.parse(JSON.stringify(edges)) as Edge[]
            }, ...future],
            isDirty: true,
        });
    },

    redo: () => {
        const { past, future, nodes, edges } = get();
        if (future.length === 0) return;
        const next = future[0];
        const newFuture = future.slice(1);
        set({
            nodes: next.nodes,
            edges: next.edges,
            past: [...past, {
                nodes: JSON.parse(JSON.stringify(nodes)) as Node[],
                edges: JSON.parse(JSON.stringify(edges)) as Edge[]
            }],
            future: newFuture,
            isDirty: true,
        });
    },

    copyNodes: () => {
        const { nodes, edges } = get();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return;

        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        const selectedEdges = edges.filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target));

        set({
            clipboard: {
                nodes: JSON.parse(JSON.stringify(selectedNodes)) as Node[],
                edges: JSON.parse(JSON.stringify(selectedEdges)) as Edge[]
            }
        });
    },

    cutNodes: () => {
        const { nodes, edges, copyNodes, takeSnapshot } = get();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return;

        takeSnapshot();
        copyNodes();

        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        set({
            nodes: nodes.filter(n => !selectedNodeIds.has(n.id)),
            edges: edges.filter(e => !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)),
            isDirty: true,
        });
    },

    pasteNodes: () => {
        const { clipboard, nodes, edges, takeSnapshot } = get();
        if (!clipboard || clipboard.nodes.length === 0) return;

        takeSnapshot();

        const idMap = new Map<string, string>();
        const pastedNodes: Node[] = clipboard.nodes.map(node => {
            const newId = `${node.type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            idMap.set(node.id, newId);
            return {
                ...node,
                id: newId,
                selected: true,
                position: {
                    x: node.position.x + 40,
                    y: node.position.y + 40,
                }
            };
        });

        const pastedEdges: Edge[] = clipboard.edges.map(edge => {
            const newSource = idMap.get(edge.source);
            const newTarget = idMap.get(edge.target);
            return {
                ...edge,
                id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                source: newSource!,
                target: newTarget!,
            };
        });

        const deselectedNodes = nodes.map(n => ({ ...n, selected: false }));

        set({
            nodes: [...deselectedNodes, ...pastedNodes],
            edges: [...edges, ...pastedEdges],
            isDirty: true,
        });
    },

    onNodesChange: (changes) => {
        const hasRemove = changes.some(c => c.type === 'remove');
        if (hasRemove) {
            get().takeSnapshot();
        }
        set((state) => {
            let nextNodes = applyNodeChanges(changes, state.nodes);

            const selectedChange = changes.find(
                (c): c is Extract<NodeChange, { type: "select" }> => c.type === "select" && c.selected
            );
            let nextActiveNodeId = state.activeNodeId;

            if (selectedChange) {
                nextNodes = nextNodes.map((n) => ({
                    ...n,
                    selected: n.id === selectedChange.id,
                }));
            } else if (
                state.activeNodeId &&
                changes.some((c) => c.type === "remove" && c.id === state.activeNodeId)
            ) {
                nextActiveNodeId = null;
            }

            const hasRealChange = changes.some(c =>
                c.type === 'position' ||
                c.type === 'remove' ||
                c.type === 'add' ||
                c.type === 'replace'
            );

            return {
                nodes: nextNodes,
                activeNodeId: nextActiveNodeId,
                isDirty: state.isDirty || hasRealChange,
            };
        });
    },

    onEdgesChange: (changes) => {
        const hasRemove = changes.some(c => c.type === 'remove');
        if (hasRemove) {
            get().takeSnapshot();
        }
        set((state) => {
            const removedEdgeIds = new Set(
                changes
                    .filter((c): c is Extract<EdgeChange, { type: 'remove' }> => c.type === 'remove')
                    .map(c => c.id)
            );
            const removedGroupMatchTargetNodeIds = new Set(
                state.edges
                    .filter(
                        (e) =>
                            removedEdgeIds.has(e.id) &&
                            (e.sourceHandle === 'group-matches' || e.targetHandle === 'group-in')
                    )
                    .map((e) => e.target)
            );

            let nextEdges = applyEdgeChanges(changes, state.edges);
            let nextNodes = state.nodes;
            let nextActiveNodeId = state.activeNodeId;

            if (removedGroupMatchTargetNodeIds.size > 0) {
                nextNodes = state.nodes.filter((n) => !removedGroupMatchTargetNodeIds.has(n.id));
                nextEdges = nextEdges.filter(
                    (e) =>
                        !removedGroupMatchTargetNodeIds.has(e.source) &&
                        !removedGroupMatchTargetNodeIds.has(e.target)
                );
                if (nextActiveNodeId && removedGroupMatchTargetNodeIds.has(nextActiveNodeId)) {
                    nextActiveNodeId = null;
                }
            }

            const hasRealChange = changes.some(c =>
                c.type === 'remove' ||
                c.type === 'add' ||
                c.type === 'replace'
            );

            return {
                nodes: nextNodes,
                edges: nextEdges,
                activeNodeId: nextActiveNodeId,
                isDirty: state.isDirty || hasRealChange,
            };
        });
    },

    onConnect: (rawConnection: Connection) => {
        get().takeSnapshot();
        const { nodes, edges: currentEdges, updateNodeData } = get();
        const sourceNode = nodes.find(n => n.id === rawConnection.source);
        const targetNode = nodes.find(n => n.id === rawConnection.target);

        if (!sourceNode || !targetNode) return;

        // Auto-resolve MatchNode handles:
        // - Outgoing: 1st line is always Winner (winner-X), 2nd line is Loser (loser-X)
        // - Incoming: 1st line goes to Team A (slot-a-X), 2nd line goes to Team B (slot-b-X)
        let effectiveSourceHandle = rawConnection.sourceHandle;
        if (sourceNode.type === 'matchNode' && rawConnection.sourceHandle !== 'round-out') {
            const sMatch = (rawConnection.sourceHandle || '').match(/^(?:winner|loser)-(\d+)$/);
            const sIdx = sMatch ? parseInt(sMatch[1], 10) : 0;
            const hasWinnerEdge = currentEdges.some(
                (e) => e.source === rawConnection.source && e.sourceHandle === `winner-${sIdx}`
            );
            effectiveSourceHandle = hasWinnerEdge ? `loser-${sIdx}` : `winner-${sIdx}`;
        }

        if (sourceNode.type === 'drawNode') {
            if (rawConnection.sourceHandle && rawConnection.sourceHandle.startsWith('pair-out-')) {
                effectiveSourceHandle = rawConnection.sourceHandle;
            } else {
                effectiveSourceHandle = rawConnection.sourceHandle || 'draw-out';
            }
        }

        let effectiveTargetHandle = rawConnection.targetHandle;
        if (targetNode.type === 'matchNode' && rawConnection.targetHandle !== 'group-in' && rawConnection.targetHandle !== 'round-in') {
            const tMatch = (rawConnection.targetHandle || '').match(/^slot-(?:a|b)-(\d+)$/);
            const tIdx = tMatch ? parseInt(tMatch[1], 10) : 0;
            const hasSlotAEdge = currentEdges.some(
                (e) => e.target === rawConnection.target && e.targetHandle === `slot-a-${tIdx}`
            );
            effectiveTargetHandle = hasSlotAEdge ? `slot-b-${tIdx}` : `slot-a-${tIdx}`;
        } else if (targetNode.type === 'drawNode') {
            // DrawNode collects all incoming teams into a single centered input point
            effectiveTargetHandle = 'draw-in';
        }

        const connection: Connection = {
            ...rawConnection,
            sourceHandle: effectiveSourceHandle,
            targetHandle: effectiveTargetHandle,
        };

        // Propagate team from Bye/Group/Draw to Match slot or Round on connect
        if (targetNode.type === 'matchNode') {
            // When connecting from DrawNode to a Round node (single line)
            if (sourceNode.type === 'drawNode' && (connection.targetHandle === 'round-in' || connection.targetHandle === 'group-in' || (Array.isArray(targetNode.data.matches) && targetNode.data.matches.length > 1))) {
                const drawData = sourceNode.data as DrawNodeData;
                const pairs = drawData.drawnPairs || [];
                if (pairs.length > 0) {
                    const targetMatches = Array.isArray(targetNode.data.matches) ? targetNode.data.matches : [];
                    const nextMatches = pairs.map((p, idx) => ({
                        id: (targetMatches[idx] as any)?.id || `m-draw-${Date.now()}-${idx + 1}`,
                        placeholderA: p.teamA || "TBD",
                        placeholderB: p.teamB || "TBD",
                    }));
                    updateNodeData(targetNode.id, { matches: nextMatches, isRound: true });
                }
            }

            // When connecting from Round to Round (single line)
            if (sourceNode.type === 'matchNode' && (connection.sourceHandle === 'round-out' || Boolean(sourceNode.data.isRound)) && connection.targetHandle === 'round-in') {
                const sourceMatches = Array.isArray(sourceNode.data.matches) ? sourceNode.data.matches : [];
                const targetMatches = Array.isArray(targetNode.data.matches) ? targetNode.data.matches : [];
                const sourceLabel = sourceNode.data.label || "Round";
                const neededMatchCount = Math.max(1, Math.ceil(sourceMatches.length / 2));
                const nextMatches = Array.from({ length: Math.max(targetMatches.length, neededMatchCount) }).map((_, idx) => {
                    const m1 = sourceMatches[idx * 2];
                    const m2 = sourceMatches[idx * 2 + 1];
                    const winnerA = m1?.placeholderA && m1.placeholderA !== "TBD" ? m1.placeholderA : `Winner of ${sourceLabel} (${idx * 2 + 1})`;
                    const winnerB = m2 ? (m2?.placeholderA && m2.placeholderA !== "TBD" ? m2.placeholderA : `Winner of ${sourceLabel} (${idx * 2 + 2})`) : "Bye";
                    return {
                        id: (targetMatches[idx] as any)?.id || `m-rnd-${Date.now()}-${idx + 1}`,
                        placeholderA: winnerA,
                        placeholderB: winnerB,
                    };
                });
                updateNodeData(targetNode.id, { matches: nextMatches, isRound: true });
            }

            let teamName = null;
            if (sourceNode.type === 'groupNode' || sourceNode.type === 'standingNode') {
                const sourceHandle = connection.sourceHandle || '';
                const rankMatch = sourceHandle.match(/rank-(\d+)/);
                if (rankMatch) {
                    const rankIndex = parseInt(rankMatch[1], 10);
                    const rankSuffix = rankIndex === 0 ? "1st" : rankIndex === 1 ? "2nd" : rankIndex === 2 ? "3rd" : `${rankIndex + 1}th`;
                    teamName = `${rankSuffix} Place (${sourceNode.data.label})`;
                } else {
                    teamName = "Group Winner";
                }
            } else if (sourceNode.type === 'drawNode') {
                const drawData = sourceNode.data as DrawNodeData;
                const sourceHandle = connection.sourceHandle || '';
                const pairMatch = sourceHandle.match(/pair-(?:out|a|b)-(\d+)/);
                if (pairMatch) {
                    const pairIdx = parseInt(pairMatch[1], 10);
                    const pair = drawData.drawnPairs?.[pairIdx];
                    if (pair) {
                        if (sourceHandle.startsWith('pair-out-')) {
                            const targetHandle = connection.targetHandle || '';
                            const matchIndexMatch = targetHandle.match(/slot-(?:a|b)-(\d+)/);
                            const mIdx = matchIndexMatch ? parseInt(matchIndexMatch[1], 10) : 0;
                            const matches = Array.isArray(targetNode.data.matches) ? [...targetNode.data.matches] : [];
                            if (matches[mIdx]) {
                                matches[mIdx] = {
                                    ...matches[mIdx],
                                    placeholderA: pair.teamA,
                                    placeholderB: pair.teamB,
                                };
                                updateNodeData(targetNode.id, { matches });
                            }
                            teamName = null;
                        } else {
                            teamName = sourceHandle.includes('pair-b') ? pair.teamB : pair.teamA;
                        }
                    }
                } else {
                    teamName = `Draw Winner (${drawData.label})`;
                }
            }

            if (teamName && teamName !== "TBD") {
                const targetHandle = connection.targetHandle || '';
                const matchIndexMatch = targetHandle.match(/slot-(a|b)-(\d+)/);

                if (matchIndexMatch) {
                    const [_, slot, indexStr] = matchIndexMatch;
                    const index = parseInt(indexStr, 10);
                    const matches = Array.isArray(targetNode.data.matches) ? [...targetNode.data.matches] : [];

                    if (matches[index]) {
                        // Prevent duplicate team in the same match
                        const otherVal = slot === 'a' ? matches[index]?.placeholderB : matches[index]?.placeholderA;
                        if (otherVal && otherVal !== "TBD" && !otherVal.startsWith("Seed #") && teamName.trim().toLowerCase() === otherVal.trim().toLowerCase()) {
                            return;
                        }

                        matches[index] = {
                            ...matches[index],
                            [slot === 'a' ? 'placeholderA' : 'placeholderB']: teamName
                        };
                        updateNodeData(targetNode.id, { matches });
                    }
                } else if (targetHandle === 'slot-a' || targetHandle === 'slot-b') {
                    // Legacy support
                    const field = targetHandle === 'slot-a' ? 'placeholderA' : 'placeholderB';
                    updateNodeData(targetNode.id, { [field]: teamName });
                }
            }
        }

        // Propagate incoming team to DrawNode pool on connect
        if (targetNode.type === 'drawNode') {
            const incomingTeams: string[] = [];
            if (sourceNode.type === 'groupNode' || sourceNode.type === 'standingNode') {
                const sourceHandle = connection.sourceHandle || '';
                const rankMatch = sourceHandle.match(/rank-(\d+)/);
                if (rankMatch) {
                    const rankIndex = parseInt(rankMatch[1], 10);
                    const rankSuffix = rankIndex === 0 ? "1st" : rankIndex === 1 ? "2nd" : rankIndex === 2 ? "3rd" : `${rankIndex + 1}th`;
                    const staticTeams = Array.isArray(sourceNode.data.teams) ? sourceNode.data.teams : [];
                    const realTeam = staticTeams[rankIndex];
                    incomingTeams.push((realTeam && realTeam !== "TBD") ? realTeam : `${rankSuffix} Place (${sourceNode.data.label})`);
                } else {
                    incomingTeams.push(`Winner (${sourceNode.data.label})`);
                }
            } else if (sourceNode.type === 'matchNode') {
                const isRound = (Array.isArray(sourceNode.data.matches) && sourceNode.data.matches.length > 1) || connection.sourceHandle === 'round-out' || Boolean(sourceNode.data.isRound);
                if (isRound) {
                    const roundMatches = Array.isArray(sourceNode.data.matches) ? sourceNode.data.matches : [];
                    const matchLabel = sourceNode.data.label || "Match";
                    roundMatches.forEach((m, mIdx) => {
                        const winnerTeam = m.placeholderA && m.placeholderA !== "TBD" ? m.placeholderA : `Winner of ${matchLabel} (${mIdx + 1})`;
                        incomingTeams.push(winnerTeam);
                    });
                } else {
                    const isWinner = !(connection.sourceHandle || '').startsWith('loser');
                    const matchIdxMatch = (connection.sourceHandle || '').match(/(?:winner|loser)-(\d+)/);
                    const mIdx = matchIdxMatch ? parseInt(matchIdxMatch[1], 10) : 0;
                    const matchLabel = sourceNode.data.label || "Match";
                    incomingTeams.push(isWinner ? `Winner of ${matchLabel} (${mIdx + 1})` : `Loser of ${matchLabel} (${mIdx + 1})`);
                }
            }

            if (incomingTeams.length > 0) {
                const currentTeams = Array.isArray(targetNode.data.teams) ? [...targetNode.data.teams] : [];
                incomingTeams.forEach((team) => {
                    if (!currentTeams.some(t => t.trim().toLowerCase() === team.trim().toLowerCase())) {
                        currentTeams.push(team);
                    }
                });
                updateNodeData(targetNode.id, { teams: currentTeams });
            }
        }

        // Propagate group data to StandingNode on connect (handle both directions)
        const groupNode = sourceNode.type === 'groupNode' ? sourceNode : targetNode.type === 'groupNode' ? targetNode : null;
        const standingNode = sourceNode.type === 'standingNode' ? sourceNode : targetNode.type === 'standingNode' ? targetNode : null;

        if (groupNode && standingNode) {
            updateNodeData(standingNode.id, {
                sourceGroupId: groupNode.id,
                teamCount: groupNode.data.teamCount,
                teams: groupNode.data.teams,
                label: groupNode.data.label
            });
        }

        // Special handling for Group/Standing -> MatchNode (top handle)
        if (targetNode.type === 'matchNode' && connection.targetHandle === 'group-in') {
            if (sourceNode.type === 'groupNode' || sourceNode.type === 'standingNode') {
                // Sync teams to the CURRENT node instead of creating a new one

                // Balanced Round Robin Algorithm (Circle Method)
                const teamCount = (sourceNode.data.teamCount as number) || (sourceNode.data.teams as string[])?.length || 0;
                const teams = (sourceNode.data.teams as string[]) || (sourceNode.data.rankings as string[]) || [];

                const pairings = [];
                if (teamCount >= 2) {
                    let n = teamCount;
                    const isOdd = n % 2 !== 0;
                    if (isOdd) n++;

                    const indices = Array.from({ length: n }).map((_, i) => i);

                    for (let r = 0; r < n - 1; r++) {
                        for (let i = 0; i < n / 2; i++) {
                            const a = indices[i];
                            const b = indices[n - 1 - i];

                            // Skip dummy team if odd
                            if (isOdd && (a === n - 1 || b === n - 1)) continue;

                            // Balance Home/Away: alternate based on round and position
                            const isHome = (i + r) % 2 === 0;
                            const teamA = teams[isHome ? a : b];
                            const teamB = teams[isHome ? b : a];
                            pairings.push({
                                id: `m-${Date.now()}-${r}-${i}`,
                                placeholderA: (!teamA || teamA === "TBD") ? `Team ${(isHome ? a : b) + 1}` : teamA,
                                placeholderB: (!teamB || teamB === "TBD") ? `Team ${(isHome ? b : a) + 1}` : teamB
                            });
                        }
                        // Rotate indices (keep first fixed)
                        indices.splice(1, 0, indices.pop()!);
                    }
                }

                updateNodeData(targetNode.id, {
                    label: `Matches: ${sourceNode.data.label}`,
                    matches: pairings
                });
            } else {
                return; // Only allow GroupNode or StandingNode to connect to group-in
            }
        }

        // Special handling for Team Source -> GroupNode (left handles)
        const teamInMatch = connection.targetHandle?.match(/team-in-(\d+)/);
        if (targetNode.type === 'groupNode' && teamInMatch) {
            const index = parseInt(teamInMatch[1], 10);
            let teamName = null;
            if (sourceNode.type === 'groupNode' || sourceNode.type === 'standingNode') {
                const sourceHandle = connection.sourceHandle || '';
                const rankMatch = sourceHandle.match(/rank-(\d+)/);
                if (rankMatch) {
                    const rankIndex = parseInt(rankMatch[1], 10);
                    const rankSuffix = rankIndex === 0 ? "1st" : rankIndex === 1 ? "2nd" : rankIndex === 2 ? "3rd" : `${rankIndex + 1}th`;
                    teamName = `${rankSuffix} Place (${sourceNode.data.label})`;
                } else {
                    teamName = sourceNode.type === 'groupNode' ? "Group Winner" : "Standing Advancer";
                }
            }

            if (typeof teamName === "string" && teamName !== "TBD") {
                const nextTeams = [...((targetNode.data.teams as string[]) || [])];
                while (nextTeams.length <= index) nextTeams.push("TBD");
                nextTeams[index] = teamName;
                updateNodeData(targetNode.id, { teams: nextTeams });
            }
        }

        const isStandingToMatchBottom =
            ((sourceNode.type === 'groupNode' || sourceNode.type === 'standingNode') &&
                targetNode.type === 'matchNode' &&
                (connection.targetHandle === 'group-in' || connection.sourceHandle === 'group-matches')) ||
            connection.sourceHandle === 'group-matches' ||
            connection.targetHandle === 'group-in';
        const isWinner = Boolean(connection.sourceHandle && connection.sourceHandle.startsWith("winner"));
        const isRankAdvance = Boolean(connection.sourceHandle && connection.sourceHandle.startsWith("rank-"));
        const isLoser = Boolean(connection.sourceHandle && connection.sourceHandle.startsWith("loser"));

        const isDrawEdge = sourceNode.type === 'drawNode' || targetNode.type === 'drawNode';
        const isRoundEdge = connection.sourceHandle === 'round-out' || connection.targetHandle === 'round-in';

        set((state) => {
            // Remove any existing edge connected to the same source handle or target handle
            // (Except for DrawNode which is a pool that accepts multiple incoming connections into the single draw-in handle)
            const filteredEdges = state.edges.filter((edge) => {
                if (edge.source === connection.source && (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null)) {
                    return false;
                }
                if (targetNode.type === 'drawNode') {
                    return true;
                }
                if (edge.target === connection.target && (edge.targetHandle ?? null) === (connection.targetHandle ?? null)) {
                    return false;
                }
                return true;
            });

            return {
                edges: addEdge(
                    {
                        ...connection,
                        type: "bezier",
                        animated: false,
                        className: (isWinner || isRankAdvance) ? "edge-winner" : isLoser ? "edge-loser" : undefined,
                        style: {
                            stroke: (isDrawEdge || isWinner || isRankAdvance || isStandingToMatchBottom || isRoundEdge)
                                ? "var(--muted-foreground)"
                                : "var(--border)",
                            strokeWidth: 2,
                            strokeDasharray: isStandingToMatchBottom ? "5,5" : "none",
                            opacity: 1,
                        },
                    },
                    filteredEdges
                ),
                isDirty: true,
            };
        });
    },

    onReconnect: (oldEdge: Edge, newConnection: Connection) => {
        get().takeSnapshot();
        set((state) => ({
            edges: state.edges.filter((e) => e.id !== oldEdge.id),
        }));
        get().onConnect(newConnection);
    },

    addMatchNode: (position) => {
        get().takeSnapshot();
        const { nodeCounter, nodes } = get();
        const nextIndex = nodeCounter + 1;

        // Auto-position in a grid if no position provided
        const col = Math.floor(nodes.length / 4);
        const row = nodes.length % 4;
        const pos = position ?? { x: col * 320, y: row * 160 };

        const newNode: Node<MatchNodeData> = {
            id: `match-${nextIndex}-${Date.now()}`,
            type: "matchNode",
            position: pos,
            data: {
                label: `Match #${nextIndex}`,
                matches: [],
            },
        };

        set({
            nodes: [...nodes, newNode],
            nodeCounter: nextIndex,
            isDirty: true,
        });
    },

    addRoundNode: (position, matchCount = 4) => {
        get().takeSnapshot();
        const { nodeCounter, nodes } = get();
        const nextIndex = nodeCounter + 1;

        const col = Math.floor(nodes.length / 4);
        const row = nodes.length % 4;
        const pos = position ?? { x: col * 320, y: row * 160 };

        const newNode: Node<MatchNodeData> = {
            id: `round-${nextIndex}-${Date.now()}`,
            type: "matchNode",
            position: pos,
            data: {
                label: `Round of ${matchCount * 2}`,
                isRound: true,
                matches: Array.from({ length: matchCount }).map((_, i) => ({
                    id: `m-rnd-${Date.now()}-${i + 1}`,
                    placeholderA: "TBD",
                    placeholderB: "TBD",
                })),
            },
        };

        set({
            nodes: [...nodes, newNode],
            nodeCounter: nextIndex,
            isDirty: true,
        });
    },



    addGroupNode: (position) => {
        get().takeSnapshot();
        const { nodes } = get();

        const col = Math.floor(nodes.length / 4);
        const row = nodes.length % 4;
        const pos = position ?? { x: col * 320, y: row * 160 + 100 };

        const newNode: Node = {
            id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type: "groupNode",
            position: pos,
            data: {
                label: "Group A",
                teamCount: 4,
                advancingCount: 2,
                teams: ["TBD", "TBD", "TBD", "TBD"],
            },
        };

        set({
            nodes: [...nodes, newNode],
            isDirty: true,
        });
    },

    addDrawNode: (position) => {
        get().takeSnapshot();
        const { nodes } = get();

        const col = Math.floor(nodes.length / 4);
        const row = nodes.length % 4;
        const pos = position ?? { x: col * 320, y: row * 160 + 120 };

        const newNode: Node<DrawNodeData> = {
            id: `draw-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            type: "drawNode",
            position: pos,
            data: {
                label: "สุ่มจับสลากรอบต่อไป (Draw / Shuffle)",
                teams: [],
                drawnPairs: [],
                mode: "open",
            },
        };

        set({
            nodes: [...nodes, newNode],
            isDirty: true,
        });
    },

    shuffleDrawNode: (drawNodeId: string) => {
        get().takeSnapshot();
        const { nodes, updateNodeData } = get();
        const node = nodes.find((n) => n.id === drawNodeId);
        if (!node) return;
        const data = node.data as DrawNodeData;
        const teams = Array.isArray(data.teams) ? [...data.teams] : [];
        if (teams.length === 0) return;

        // Fisher-Yates shuffle
        const shuffled = [...teams];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const drawnPairs: DrawPair[] = [];
        for (let i = 0; i < shuffled.length; i += 2) {
            drawnPairs.push({
                id: `pair-${Date.now()}-${Math.floor(i / 2) + 1}`,
                teamA: shuffled[i] || "TBD",
                teamB: shuffled[i + 1] || "TBD",
            });
        }

        updateNodeData(drawNodeId, {
            drawnPairs,
            lastDrawnAt: new Date().toISOString(),
        });

        // Sync with connected nodes
        const { edges } = get();
        const outgoingEdges = edges.filter((e) => e.source === drawNodeId);
        outgoingEdges.forEach((e) => {
            const targetNode = nodes.find((n) => n.id === e.target);
            if (!targetNode || targetNode.type !== "matchNode") return;

            if (e.sourceHandle && e.sourceHandle.startsWith("pair-out-")) {
                const matchIdx = parseInt(e.sourceHandle.replace("pair-out-", ""), 10);
                if (drawnPairs[matchIdx]) {
                    const targetMatches = Array.isArray(targetNode.data.matches) ? targetNode.data.matches : [];
                    const firstMatch = targetMatches[0];
                    const nextMatches = [
                        {
                            id: (firstMatch as any)?.id || `m-draw-${Date.now()}-${matchIdx + 1}`,
                            placeholderA: drawnPairs[matchIdx].teamA || "TBD",
                            placeholderB: drawnPairs[matchIdx].teamB || "TBD",
                        },
                    ];
                    updateNodeData(targetNode.id, { matches: nextMatches });
                }
            } else if (e.sourceHandle === "draw-out" || !e.sourceHandle) {
                const targetMatches = Array.isArray(targetNode.data.matches) ? targetNode.data.matches : [];
                const nextMatches = drawnPairs.map((p, idx) => ({
                    id: (targetMatches[idx] as any)?.id || `m-draw-${Date.now()}-${idx + 1}`,
                    placeholderA: p.teamA || "TBD",
                    placeholderB: p.teamB || "TBD",
                }));
                updateNodeData(targetNode.id, { matches: nextMatches });
            }
        });
    },

    updateDrawPair: (drawNodeId: string, pairIndex: number, slot: "teamA" | "teamB", newTeam: string) => {
        get().takeSnapshot();
        const { nodes, edges, updateNodeData } = get();
        const drawNode = nodes.find((n) => n.id === drawNodeId);
        if (!drawNode) return;

        const data = drawNode.data as DrawNodeData;
        const pairs = Array.isArray(data.drawnPairs) ? data.drawnPairs.map((p) => ({ ...p })) : [];
        if (!pairs[pairIndex]) return;

        const currentTeam = pairs[pairIndex][slot];
        if (currentTeam === newTeam) return;

        // Swap if newTeam is already in another pair
        let swappedPairIndex: number | null = null;
        for (let pIdx = 0; pIdx < pairs.length; pIdx++) {
            if (pIdx === pairIndex) continue;
            if (pairs[pIdx].teamA === newTeam) {
                pairs[pIdx].teamA = currentTeam;
                swappedPairIndex = pIdx;
                break;
            }
            if (pairs[pIdx].teamB === newTeam) {
                pairs[pIdx].teamB = currentTeam;
                swappedPairIndex = pIdx;
                break;
            }
        }
        // Also if it's the other slot of the same pair:
        const otherSlot = slot === "teamA" ? "teamB" : "teamA";
        if (pairs[pairIndex][otherSlot] === newTeam) {
            pairs[pairIndex][otherSlot] = currentTeam;
        }

        pairs[pairIndex][slot] = newTeam;
        updateNodeData(drawNodeId, { drawnPairs: pairs });

        // Sync with connected nodes (only update affected separated match nodes)
        const outgoingEdges = edges.filter((e) => e.source === drawNodeId);
        outgoingEdges.forEach((e) => {
            const targetNode = nodes.find((n) => n.id === e.target);
            if (!targetNode || targetNode.type !== "matchNode") return;

            if (e.sourceHandle && e.sourceHandle.startsWith("pair-out-")) {
                const matchIdx = parseInt(e.sourceHandle.replace("pair-out-", ""), 10);
                const targetMatches = Array.isArray(targetNode.data.matches) ? [...targetNode.data.matches] : [];
                if (targetMatches.length > 1) {
                    if (targetMatches[matchIdx]) {
                        targetMatches[matchIdx] = {
                            ...targetMatches[matchIdx],
                            placeholderA: pairs[matchIdx]?.teamA || "TBD",
                            placeholderB: pairs[matchIdx]?.teamB || "TBD",
                        };
                    }
                    if (swappedPairIndex !== null && targetMatches[swappedPairIndex]) {
                        targetMatches[swappedPairIndex] = {
                            ...targetMatches[swappedPairIndex],
                            placeholderA: pairs[swappedPairIndex]?.teamA || "TBD",
                            placeholderB: pairs[swappedPairIndex]?.teamB || "TBD",
                        };
                    }
                    updateNodeData(targetNode.id, { matches: targetMatches });
                } else if (matchIdx === pairIndex || (swappedPairIndex !== null && matchIdx === swappedPairIndex)) {
                    const firstMatch = targetMatches[0];
                    const nextMatches = [
                        {
                            id: (firstMatch as any)?.id || `m-draw-${Date.now()}-${matchIdx + 1}`,
                            placeholderA: pairs[matchIdx]?.teamA || "TBD",
                            placeholderB: pairs[matchIdx]?.teamB || "TBD",
                        },
                    ];
                    updateNodeData(targetNode.id, { matches: nextMatches });
                }
            } else if (e.sourceHandle === "draw-out" || !e.sourceHandle) {
                const targetMatches = Array.isArray(targetNode.data.matches) ? targetNode.data.matches : [];
                const nextMatches = pairs.map((p, idx) => ({
                    id: (targetMatches[idx] as any)?.id || `m-draw-${Date.now()}-${idx + 1}`,
                    placeholderA: p.teamA || "TBD",
                    placeholderB: p.teamB || "TBD",
                }));
                updateNodeData(targetNode.id, { matches: nextMatches });
            }
        });

        set({ isDirty: true });
    },

    swapDrawPairSlots: (drawNodeId: string, pairIndex: number) => {
        get().takeSnapshot();
        const { nodes, edges, updateNodeData } = get();
        const drawNode = nodes.find((n) => n.id === drawNodeId);
        if (!drawNode) return;

        const data = drawNode.data as DrawNodeData;
        const pairs = Array.isArray(data.drawnPairs) ? data.drawnPairs.map((p) => ({ ...p })) : [];
        if (!pairs[pairIndex]) return;

        const temp = pairs[pairIndex].teamA;
        pairs[pairIndex].teamA = pairs[pairIndex].teamB;
        pairs[pairIndex].teamB = temp;

        updateNodeData(drawNodeId, { drawnPairs: pairs });

        // Sync with connected nodes (only update the specific separated match node)
        const outgoingEdges = edges.filter((e) => e.source === drawNodeId);
        outgoingEdges.forEach((e) => {
            const targetNode = nodes.find((n) => n.id === e.target);
            if (!targetNode || targetNode.type !== "matchNode") return;

            if (e.sourceHandle && e.sourceHandle.startsWith("pair-out-")) {
                const matchIdx = parseInt(e.sourceHandle.replace("pair-out-", ""), 10);
                const targetMatches = Array.isArray(targetNode.data.matches) ? [...targetNode.data.matches] : [];
                if (targetMatches.length > 1) {
                    if (targetMatches[matchIdx]) {
                        targetMatches[matchIdx] = {
                            ...targetMatches[matchIdx],
                            placeholderA: pairs[matchIdx]?.teamA || "TBD",
                            placeholderB: pairs[matchIdx]?.teamB || "TBD",
                        };
                        updateNodeData(targetNode.id, { matches: targetMatches });
                    }
                } else if (matchIdx === pairIndex) {
                    const firstMatch = targetMatches[0];
                    const nextMatches = [
                        {
                            id: (firstMatch as any)?.id || `m-draw-${Date.now()}-${pairIndex + 1}`,
                            placeholderA: pairs[pairIndex].teamA || "TBD",
                            placeholderB: pairs[pairIndex].teamB || "TBD",
                        },
                    ];
                    updateNodeData(targetNode.id, { matches: nextMatches });
                }
            } else if (e.sourceHandle === "draw-out" || !e.sourceHandle) {
                const targetMatches = Array.isArray(targetNode.data.matches) ? targetNode.data.matches : [];
                const nextMatches = pairs.map((p, idx) => ({
                    id: (targetMatches[idx] as any)?.id || `m-draw-${Date.now()}-${idx + 1}`,
                    placeholderA: p.teamA || "TBD",
                    placeholderB: p.teamB || "TBD",
                }));
                updateNodeData(targetNode.id, { matches: nextMatches });
            }
        });

        set({ isDirty: true });
    },

    generateNextRoundFromDraw: (drawNodeId: string, format: "round" | "matches") => {
        get().takeSnapshot();
        const { nodes, updateNodeData } = get();
        const drawNode = nodes.find((n) => n.id === drawNodeId);
        if (!drawNode) return;
        const data = drawNode.data as DrawNodeData;

        let pairs = data.drawnPairs;
        // If not drawn yet, do a shuffle first
        if (!pairs || pairs.length === 0) {
            const teams = Array.isArray(data.teams) ? [...data.teams] : [];
            if (teams.length < 2) return;
            const shuffled = [...teams];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            pairs = [];
            for (let i = 0; i < shuffled.length; i += 2) {
                pairs.push({
                    id: `pair-${Date.now()}-${Math.floor(i / 2) + 1}`,
                    teamA: shuffled[i] || "TBD",
                    teamB: shuffled[i + 1] || "TBD",
                });
            }
            updateNodeData(drawNodeId, { drawnPairs: pairs, lastDrawnAt: new Date().toISOString() });
        }

        const teamCount = pairs.length * 2;
        const roundLabel = teamCount >= 32 ? "Round of 32" : teamCount >= 16 ? "Round of 16" : teamCount >= 8 ? "Quarterfinals" : teamCount >= 4 ? "Semifinals" : "Final";

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];
        const createdNodeIds: string[] = [];

        if (format === "round") {
            const roundNodeId = `match-round-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            createdNodeIds.push(roundNodeId);

            const matches = pairs.map((p, idx) => ({
                id: `m-draw-${Date.now()}-${idx + 1}`,
                placeholderA: p.teamA,
                placeholderB: p.teamB,
            }));

            const roundNode: Node<MatchNodeData> = {
                id: roundNodeId,
                type: "matchNode",
                position: {
                    x: drawNode.position.x + 440,
                    y: drawNode.position.y,
                },
                data: {
                    label: roundLabel,
                    matches,
                },
            };
            newNodes.push(roundNode);

            // Connect each pair from draw results directly to its match in the round node
            pairs.forEach((_, idx) => {
                newEdges.push({
                    id: `edge-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
                    source: drawNodeId,
                    target: roundNodeId,
                    sourceHandle: `pair-out-${idx}`,
                    targetHandle: `slot-a-${idx}`,
                    type: "bezier",
                    animated: false,
                    style: { stroke: "var(--muted-foreground)", strokeWidth: 2 },
                });
            });
        } else {
            // format === "matches"
            const startY = drawNode.position.y - Math.max(0, ((pairs.length - 1) * 160) / 2);
            pairs.forEach((p, idx) => {
                const matchNodeId = `match-${Date.now()}-${idx + 1}-${Math.random().toString(36).substring(2, 7)}`;
                createdNodeIds.push(matchNodeId);

                const mNode: Node<MatchNodeData> = {
                    id: matchNodeId,
                    type: "matchNode",
                    position: {
                        x: drawNode.position.x + 440,
                        y: startY + idx * 160,
                    },
                    data: {
                        label: `${roundLabel} - Match ${idx + 1}`,
                        matches: [
                            {
                                id: `m-draw-${Date.now()}-${idx + 1}`,
                                placeholderA: p.teamA,
                                placeholderB: p.teamB,
                            },
                        ],
                    },
                };
                newNodes.push(mNode);

                newEdges.push({
                    id: `edge-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
                    source: drawNodeId,
                    target: matchNodeId,
                    sourceHandle: `pair-out-${idx}`,
                    targetHandle: "slot-a-0",
                    type: "bezier",
                    animated: false,
                    style: { stroke: "var(--muted-foreground)", strokeWidth: 2 },
                });
            });
        }

        set((state) => ({
            nodes: [...state.nodes, ...newNodes],
            edges: [...state.edges, ...newEdges],
            isDirty: true,
        }));

        updateNodeData(drawNodeId, {
            generatedTargetType: format,
            generatedNodeIds: createdNodeIds,
        });
    },

    insertTemplate: (templateNodes, templateEdges, targetPosition) => {
        get().takeSnapshot();
        const { nodes, edges } = get();

        if (!templateNodes || templateNodes.length === 0) return;

        // Calculate bounding box of incoming template nodes
        let minX = Infinity;
        let minY = Infinity;
        templateNodes.forEach((node) => {
            if (node.position.x < minX) minX = node.position.x;
            if (node.position.y < minY) minY = node.position.y;
        });

        // Determine destination origin
        let destX = 0;
        let destY = 0;

        if (targetPosition) {
            destX = targetPosition.x;
            destY = targetPosition.y;
        } else if (nodes.length > 0) {
            // Find existing canvas right edge to place new template gracefully
            let maxExistingX = -Infinity;
            let minExistingY = Infinity;
            nodes.forEach((n) => {
                if (n.position.x > maxExistingX) maxExistingX = n.position.x;
                if (n.position.y < minExistingY) minExistingY = n.position.y;
            });
            destX = maxExistingX + 450;
            destY = isFinite(minExistingY) ? minExistingY : 50;
        } else {
            destX = 100;
            destY = 100;
        }

        const idMap = new Map<string, string>();
        const mappedNodes: Node[] = templateNodes.map((node) => {
            const newId = `${node.type || "node"}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
            idMap.set(node.id, newId);
            return {
                ...node,
                id: newId,
                selected: true,
                position: {
                    x: destX + (node.position.x - minX),
                    y: destY + (node.position.y - minY),
                },
            };
        });

        const mappedEdges: Edge[] = templateEdges.map((edge) => {
            const newSource = idMap.get(edge.source) || edge.source;
            const newTarget = idMap.get(edge.target) || edge.target;
            return {
                ...edge,
                id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
                source: newSource,
                target: newTarget,
            };
        });

        const deselectedExisting = nodes.map((n) => ({ ...n, selected: false }));

        set({
            nodes: [...deselectedExisting, ...mappedNodes],
            edges: [...edges, ...mappedEdges],
            isDirty: true,
        });
    },







    generateRoundRobinMatches: (groupId: string) => {
        get().takeSnapshot();
        const { nodes, edges } = get();
        const groupNode = nodes.find(n => n.id === groupId);
        if (!groupNode || (groupNode.type !== 'groupNode' && groupNode.type !== 'standingNode')) return;

        const teamCount = (groupNode.data.teamCount as number) || (groupNode.data.teams as string[])?.length || 0;
        const teams = (groupNode.data.teams as string[]) || (groupNode.data.rankings as string[]) || [];
        const label = (groupNode.data.label as string) || "Group";

        // Balanced Round Robin Algorithm (Circle Method)
        const pairings: { id: string; placeholderA: string; placeholderB: string }[] = [];
        if (teamCount >= 2) {
            let n = teamCount;
            const isOdd = n % 2 !== 0;
            if (isOdd) n++;

            const indices = Array.from({ length: n }).map((_, i) => i);

            for (let r = 0; r < n - 1; r++) {
                for (let i = 0; i < n / 2; i++) {
                    const a = indices[i];
                    const b = indices[n - 1 - i];

                    if (isOdd && (a === n - 1 || b === n - 1)) continue;

                    const isHome = (i + r) % 2 === 0;
                    const teamA = teams[isHome ? a : b];
                    const teamB = teams[isHome ? b : a];
                    pairings.push({
                        id: `m-${Date.now()}-${r}-${i}`,
                        placeholderA: (!teamA || teamA === "TBD") ? `Team ${(isHome ? a : b) + 1}` : teamA,
                        placeholderB: (!teamB || teamB === "TBD") ? `Team ${(isHome ? b : a) + 1}` : teamB
                    });
                }
                indices.splice(1, 0, indices.pop()!);
            }
        }

        if (pairings.length === 0) return;

        // Find existing match nodes connected from this group (including match days)
        const existingEdges = edges.filter(
            (e) => e.source === groupId && (e.sourceHandle === 'group-matches' || e.targetHandle === 'group-in')
        );
        const existingTargetNodeIds = new Set(existingEdges.map((e) => e.target));
        const existingConnectedMatchNodes = nodes.filter(
            (n) => n.type === 'matchNode' && (existingTargetNodeIds.has(n.id) || n.data?.groupId === groupId || (n.data?.label as string)?.trim() === `Matches: ${label.trim()}`)
        );
        const existingConnectedNodeIds = new Set(existingConnectedMatchNodes.map((n) => n.id));

        // If only 1 existing non-day node was there, reuse its ID
        const existingMatchNode = existingConnectedMatchNodes.length === 1 && !existingConnectedMatchNodes[0].data?.matchDay
            ? existingConnectedMatchNodes[0]
            : null;

        const matchNodeId = existingMatchNode ? existingMatchNode.id : `match-rr-${Date.now()}`;
        const singleNode: Node = {
            id: matchNodeId,
            type: "matchNode",
            position: { x: groupNode.position.x + 380, y: groupNode.position.y },
            data: {
                label: `Matches: ${label}`,
                matches: pairings,
                groupId,
            },
        };

        const remainingNodes = nodes.filter((n) => !existingConnectedNodeIds.has(n.id) || n.id === matchNodeId);
        const nextNodes = existingMatchNode
            ? remainingNodes.map((n) => (n.id === matchNodeId ? singleNode : n))
            : [...remainingNodes, singleNode];

        const filteredEdges = edges.filter(
            (e) =>
                !(e.source === groupId && e.sourceHandle === 'group-matches') &&
                !(e.targetHandle === 'group-in' && existingConnectedNodeIds.has(e.target))
        );

        // Create dashed edge connecting group-matches -> group-in
        const newEdge: Edge = {
            id: existingEdges[0]?.id || `edge-rr-${Date.now()}`,
            source: groupId,
            target: matchNodeId,
            sourceHandle: 'group-matches',
            targetHandle: 'group-in',
            type: 'bezier',
            style: {
                stroke: 'var(--muted-foreground)',
                strokeWidth: 2,
                strokeDasharray: '5,5',
                opacity: 1,
            }
        };

        set({
            nodes: nextNodes,
            edges: [...filteredEdges, newEdge],
            isDirty: true
        });
    },

    generateRoundRobinMatchDays: (groupId: string) => {
        get().takeSnapshot();
        const { nodes, edges } = get();
        const groupNode = nodes.find(n => n.id === groupId);
        if (!groupNode || (groupNode.type !== 'groupNode' && groupNode.type !== 'standingNode')) return;

        const teamCount = (groupNode.data.teamCount as number) || (groupNode.data.teams as string[])?.length || 0;
        const teams = (groupNode.data.teams as string[]) || (groupNode.data.rankings as string[]) || [];
        const label = (groupNode.data.label as string) || "Group";

        if (teamCount < 2) return;

        const groupSuffix = label.replace(/^Group\s*/i, "").trim();
        const days = computeRoundRobinDays(teams, groupSuffix, true);
        if (days.length === 0) return;

        // Find existing match nodes connected from this group (single or match days)
        const existingEdges = edges.filter(
            (e) => e.source === groupId && (e.sourceHandle === 'group-matches' || e.targetHandle === 'group-in')
        );
        const existingTargetNodeIds = new Set(existingEdges.map((e) => e.target));
        const existingConnectedMatchNodes = nodes.filter(
            (n) => n.type === 'matchNode' && (existingTargetNodeIds.has(n.id) || n.data?.groupId === groupId || (n.data?.label as string)?.trim() === `Matches: ${label.trim()}`)
        );
        const existingConnectedNodeIds = new Set(existingConnectedMatchNodes.map((n) => n.id));

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        let currentY = groupNode.position.y;
        const startX = groupNode.position.x + 380;

        days.forEach((dayData) => {
            const dayNodeId = `match-day-${groupId}-${dayData.day}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const matches = dayData.matches.map((m, mIdx) => ({
                id: `m-day-${groupId}-${dayData.day}-${mIdx + 1}-${Date.now()}`,
                placeholderA: m.teamA,
                placeholderB: m.teamB,
                slotA: m.slotA,
                slotB: m.slotB,
            }));

            const dayNode: Node<MatchNodeData> = {
                id: dayNodeId,
                type: "matchNode",
                position: {
                    x: startX,
                    y: currentY,
                },
                data: {
                    label: `${label} - Match Day ${dayData.day}`,
                    matches,
                    groupId,
                    matchDay: dayData.day,
                    isRound: true,
                },
            };
            newNodes.push(dayNode);

            newEdges.push({
                id: `edge-day-${groupId}-${dayData.day}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                source: groupId,
                target: dayNodeId,
                sourceHandle: 'group-matches',
                targetHandle: 'group-in',
                type: 'bezier',
                animated: false,
                style: {
                    stroke: 'var(--muted-foreground)',
                    strokeWidth: 2,
                    strokeDasharray: '5,5',
                    opacity: 1,
                },
            });

            // Height spacing: 36 header + matches * 52 + 20 gap
            const nodeHeight = 36 + matches.length * 52 + 20;
            currentY += nodeHeight;
        });

        // Filter out old connected nodes and edges
        const remainingNodes = nodes.filter((n) => !existingConnectedNodeIds.has(n.id));
        const filteredEdges = edges.filter(
            (e) => !(e.source === groupId && e.sourceHandle === 'group-matches') &&
                   !(e.targetHandle === 'group-in' && existingConnectedNodeIds.has(e.target))
        );

        set({
            nodes: [...remainingNodes, ...newNodes],
            edges: [...filteredEdges, ...newEdges],
            isDirty: true,
        });
    },

    deleteNode: (id) => {
        get().takeSnapshot();
        set((state) => ({
            nodes: state.nodes.filter((n) => n.id !== id),
            edges: state.edges.filter((e) => e.source !== id && e.target !== id),
            activeNodeId: state.activeNodeId === id ? null : state.activeNodeId,
            isDirty: true,
        }));
    },

    hydrate: (data) => {
        if (!data) {
            set({ nodes: [], edges: [], nodeCounter: 0, isDirty: false });
            return;
        }
        const validNodes = (data.nodes || []).filter(n => n.type !== "teamListNode");
        const validNodeIds = new Set(validNodes.map(n => n.id));
        const normalizedEdges: Edge[] = (data.edges || [])
            .filter(edge => validNodeIds.has(edge.source) && validNodeIds.has(edge.target))
            .map(edge => {
                const sourceNode = validNodes.find(n => n.id === edge.source);
                const targetNode = validNodes.find(n => n.id === edge.target);
                const isStandingToMatchBottom =
                    ((sourceNode?.type === 'groupNode' || sourceNode?.type === 'standingNode') &&
                        targetNode?.type === 'matchNode' &&
                        (edge.targetHandle === 'group-in' || edge.sourceHandle === 'group-matches')) ||
                    edge.sourceHandle === 'group-matches' ||
                    edge.targetHandle === 'group-in';
                const isWinner = Boolean(edge.sourceHandle && edge.sourceHandle.startsWith("winner"));
                const isRankAdvance = Boolean(edge.sourceHandle && edge.sourceHandle.startsWith("rank-"));
                const isLoser = Boolean(edge.sourceHandle && edge.sourceHandle.startsWith("loser"));
                return {
                    ...edge,
                    animated: false,
                    className: (isWinner || isRankAdvance) ? "edge-winner" : isLoser ? "edge-loser" : edge.className,
                    style: {
                        ...edge.style,
                        stroke: (isWinner || isRankAdvance || isStandingToMatchBottom) ? "var(--muted-foreground)" : "var(--border)",
                        strokeDasharray: isStandingToMatchBottom ? "5,5" : "none",
                        opacity: 1,
                    }
                };
            });

        // Auto-restore missing dashed Round Robin edge between GroupNode and its corresponding MatchNode
        validNodes.forEach((node) => {
            if (node.type !== 'groupNode' && node.type !== 'standingNode') return;
            const groupLabel = String(node.data?.label || '').trim();
            if (!groupLabel) return;

            const hasGroupMatchEdge = normalizedEdges.some(
                (e) => e.source === node.id && (e.sourceHandle === 'group-matches' || e.targetHandle === 'group-in')
            );
            if (hasGroupMatchEdge) return;

            const matchingMatchNode = validNodes.find((m) => {
                if (m.type !== 'matchNode') return false;
                const mLabel = String(m.data?.label || '').trim();
                return (
                    mLabel.toLowerCase() === `matches: ${groupLabel.toLowerCase()}` ||
                    mLabel.toLowerCase().startsWith(`${groupLabel.toLowerCase()} (`)
                );
            });

            if (matchingMatchNode) {
                normalizedEdges.push({
                    id: `edge-rr-${node.id}-${matchingMatchNode.id}`,
                    source: node.id,
                    target: matchingMatchNode.id,
                    sourceHandle: 'group-matches',
                    targetHandle: 'group-in',
                    type: 'bezier',
                    animated: false,
                    style: {
                        stroke: 'var(--muted-foreground)',
                        strokeWidth: 2,
                        strokeDasharray: '5,5',
                        opacity: 1,
                    },
                });
            }
        });

        set({
            nodes: validNodes,
            edges: normalizedEdges,
            nodeCounter: validNodes.length,
            isDirty: false,
        });
    },

    reset: () => {
        set({ nodes: [], edges: [], nodeCounter: 0, activeNodeId: null, isDirty: true });
    },

    getCanvasData: () => {
        const { nodes, edges } = get();
        return { nodes, edges };
    },

    markClean: () => {
        set({ isDirty: false });
    },
    syncMatches: (matches) => {
        const { nodes, nodeCounter } = get();
        const existingMatchIds = new Set(
            nodes
                .filter((node) => node.type === "matchNode")
                .map((node) => (node.data as MatchNodeData | undefined)?.matchId)
                .filter((matchId): matchId is string => typeof matchId === "string")
        );

        const newNodes: Node[] = [];
        let currentCounter = nodeCounter;

        matches.forEach((m) => {
            if (!existingMatchIds.has(m.id)) {
                currentCounter++;
                const col = Math.floor((nodes.length + newNodes.length) / 4);
                const row = (nodes.length + newNodes.length) % 4;

                newNodes.push({
                    id: `match-${m.id}-${Date.now()}`,
                    type: "matchNode",
                    position: { x: col * 320, y: row * 160 },
                    data: {
                        matchIndex: currentCounter,
                        label: `Match #${currentCounter}`,
                        matchId: m.id,
                        placeholderA: m.placeholder_a || "TBD",
                        placeholderB: m.placeholder_b || "TBD",
                    },
                });
            }
        });

        if (newNodes.length > 0) {
            set({
                nodes: [...nodes, ...newNodes],
                nodeCounter: currentCounter,
                isDirty: true,
            });
        }
    },

    updateNodeData: (id, newData, skipDirty = false) => {
        set((state) => {
            const node = state.nodes.find((n) => n.id === id);
            if (!node) return state;

            // Check if any value actually changed (shallow comparison + JSON for arrays/objects)
            const hasChange = Object.keys(newData).some((key) => {
                const oldVal = node.data[key];
                const newVal = newData[key];
                if (typeof newVal === 'object' && newVal !== null) {
                    return JSON.stringify(oldVal) !== JSON.stringify(newVal);
                }
                return oldVal !== newVal;
            });

            if (!hasChange) return state;

            const updatedNodes = state.nodes.map((n) =>
                n.id === id ? { ...n, data: { ...n.data, ...newData } } : n
            );

            // Handle propagation if a 'source' node changed
            const updatedNode = updatedNodes.find((n) => n.id === id);
            let nextStoreMatches = state.matches;
            let nextEdges = state.edges;

            if (updatedNode && updatedNode.type === 'groupNode') {
                const teamsChanged = newData.teams !== undefined || newData.teamCount !== undefined || newData.label !== undefined;
                if (teamsChanged) {
                    const newTeams = Array.isArray(updatedNode.data.teams) ? (updatedNode.data.teams as string[]) : [];
                    const teamCount = Math.max(0, Number(updatedNode.data.teamCount) || newTeams.length);
                    const groupLabel = String(updatedNode.data.label || "").trim();
                    const groupSuffixMatch = groupLabel.match(/^(?:group\s*)?([a-zA-Z0-9]+)$/i);
                    const groupSuffix = groupSuffixMatch ? groupSuffixMatch[1].toLowerCase() : "";

                    // Find connected or matching Round/Fixtures MatchNodes for this GroupNode
                    const targetMatchNodeIds = new Set<string>();

                    state.edges.forEach((edge) => {
                        if (edge.source === id) {
                            if (edge.sourceHandle === 'group-matches' || edge.targetHandle === 'group-in' || !edge.sourceHandle?.startsWith('rank-')) {
                                const targetNode = state.nodes.find((n) => n.id === edge.target);
                                if (targetNode?.type === 'matchNode') {
                                    targetMatchNodeIds.add(edge.target);
                                }
                            }
                        }
                    });

                    // Also match by label pattern if not linked via edge
                    if (targetMatchNodeIds.size === 0 && groupLabel) {
                        const lowerGroup = groupLabel.toLowerCase();
                        state.nodes.forEach((n) => {
                            if (n.type === 'matchNode') {
                                const mLabel = String(n.data.label || "").trim().toLowerCase();
                                if (
                                    mLabel === `matches: ${lowerGroup}` ||
                                    mLabel.includes(`${lowerGroup} (fixtures)`) ||
                                    mLabel.includes(`${lowerGroup} fixtures`) ||
                                    mLabel === `fixtures: ${lowerGroup}` ||
                                    (groupSuffix && (mLabel === `${groupSuffix} (fixtures)` || mLabel === `matches: ${groupSuffix}`))
                                ) {
                                    targetMatchNodeIds.add(n.id);
                                }
                            }
                        });
                    }

                    if (targetMatchNodeIds.size > 0) {
                        // Compute standard circle method pairings
                        const effectiveCount = Math.max(2, teamCount || newTeams.length);
                        const n = effectiveCount % 2 === 0 ? effectiveCount : effectiveCount + 1;
                        const indices = Array.from({ length: n }, (_, i) => i);
                        const pairings: { homeIdx: number; awayIdx: number }[] = [];

                        for (let r = 0; r < n - 1; r++) {
                            for (let i = 0; i < n / 2; i++) {
                                const a = indices[i];
                                const b = indices[n - 1 - i];

                                if (effectiveCount % 2 !== 0 && (a === n - 1 || b === n - 1)) {
                                    continue;
                                }

                                const isHome = (i + r) % 2 === 0;
                                pairings.push({
                                    homeIdx: isHome ? a : b,
                                    awayIdx: isHome ? b : a,
                                });
                            }
                            indices.splice(1, 0, indices.pop()!);
                        }

                        // Pad teams array if needed
                        const paddedTeams = [...newTeams];
                        while (paddedTeams.length < effectiveCount) {
                            paddedTeams.push("TBD");
                        }

                        targetMatchNodeIds.forEach((mNodeId) => {
                            const targetIdx = updatedNodes.findIndex((n) => n.id === mNodeId);
                            if (targetIdx !== -1) {
                                const targetNode = updatedNodes[targetIdx];
                                const existingMatches = Array.isArray(targetNode.data.matches)
                                    ? [...(targetNode.data.matches as any[])]
                                    : [];

                                let updatedMatches: any[] = [];

                                if (typeof targetNode.data.matchDay === 'number') {
                                    const dayNumber = targetNode.data.matchDay as number;
                                    updatedMatches = existingMatches.map((prevMatch: any, pIdx: number) => {
                                        let placeholderA = prevMatch?.placeholderA;
                                        let placeholderB = prevMatch?.placeholderB;

                                        if (typeof prevMatch?.slotA === 'number' && typeof prevMatch?.slotB === 'number') {
                                            const sA = prevMatch.slotA;
                                            const sB = prevMatch.slotB;
                                            const rawA = paddedTeams[sA];
                                            const rawB = paddedTeams[sB];
                                            const defA = groupSuffix ? `Team ${groupSuffix.toUpperCase()}${sA + 1}` : `Team ${sA + 1}`;
                                            const defB = groupSuffix ? `Team ${groupSuffix.toUpperCase()}${sB + 1}` : `Team ${sB + 1}`;
                                            placeholderA = rawA && rawA.trim() && rawA !== "TBD" ? rawA.trim() : defA;
                                            placeholderB = rawB && rawB.trim() && rawB !== "TBD" ? rawB.trim() : defB;
                                        }

                                        return {
                                            ...(prevMatch || {}),
                                            id: prevMatch?.id || `m-day-${id}-${dayNumber}-${pIdx + 1}`,
                                            placeholderA,
                                            placeholderB,
                                            slotA: prevMatch?.slotA,
                                            slotB: prevMatch?.slotB,
                                        };
                                    });
                                }

                                if (updatedMatches.length === 0) {
                                    const isFullPairingsCount = existingMatches.length === pairings.length;

                                    updatedMatches = isFullPairingsCount
                                        ? pairings.map((pair, pIdx) => {
                                              const rawA = paddedTeams[pair.homeIdx];
                                              const rawB = paddedTeams[pair.awayIdx];
                                              const prevMatch = existingMatches[pIdx];

                                              const defaultPlaceholderA = groupSuffix
                                                  ? `Team ${groupSuffix.toUpperCase()}${pair.homeIdx + 1}`
                                                  : `Team ${pair.homeIdx + 1}`;
                                              const defaultPlaceholderB = groupSuffix
                                                  ? `Team ${groupSuffix.toUpperCase()}${pair.awayIdx + 1}`
                                                  : `Team ${pair.awayIdx + 1}`;

                                              const placeholderA =
                                                  rawA && rawA.trim() && rawA !== "TBD"
                                                      ? rawA.trim()
                                                      : rawA === "TBD"
                                                      ? "TBD"
                                                      : prevMatch?.placeholderA || defaultPlaceholderA;

                                              const placeholderB =
                                                  rawB && rawB.trim() && rawB !== "TBD"
                                                      ? rawB.trim()
                                                      : rawB === "TBD"
                                                      ? "TBD"
                                                      : prevMatch?.placeholderB || defaultPlaceholderB;

                                              return {
                                                  ...(prevMatch || {}),
                                                  id: prevMatch?.id || `m-${Date.now()}-${pIdx}`,
                                                  placeholderA,
                                                  placeholderB,
                                              };
                                          })
                                        : existingMatches.map((prevMatch, pIdx) => {
                                              const resolvePlaceholder = (currentPh: string, pairIdx: number, isSlotA: boolean) => {
                                                  if (pairIdx < pairings.length) {
                                                      const pair = pairings[pairIdx];
                                                      const slotIdx = isSlotA ? pair.homeIdx : pair.awayIdx;
                                                      const raw = paddedTeams[slotIdx];
                                                      if (raw && raw.trim() && raw !== "TBD") {
                                                          return raw.trim();
                                                      }
                                                      if (raw === "TBD") return "TBD";
                                                  }
                                                  const numMatch = currentPh?.match(/^Team\s*(?:[A-Za-z]+)?(\d+)$/i);
                                                  if (numMatch) {
                                                      const sIdx = parseInt(numMatch[1], 10) - 1;
                                                      if (sIdx >= 0 && sIdx < paddedTeams.length) {
                                                          const raw = paddedTeams[sIdx];
                                                          if (raw && raw.trim() && raw !== "TBD") return raw.trim();
                                                          if (raw === "TBD") return "TBD";
                                                      }
                                                  }
                                                  return currentPh || "TBD";
                                              };

                                              return {
                                                  ...prevMatch,
                                                  placeholderA: resolvePlaceholder(prevMatch.placeholderA, pIdx, true),
                                                  placeholderB: resolvePlaceholder(prevMatch.placeholderB, pIdx, false),
                                              };
                                          });
                                }

                                updatedNodes[targetIdx] = {
                                    ...targetNode,
                                    data: {
                                        ...targetNode.data,
                                        matches: updatedMatches,
                                    },
                                };

                                // Also sync in nextStoreMatches if present
                                if (nextStoreMatches.length > 0) {
                                    nextStoreMatches = nextStoreMatches.map((m) => {
                                        if (m.node_id === mNodeId) {
                                            const matchIdx = (m.idx_match ?? m.match_index ?? 1) - 1;
                                            const uMatch = updatedMatches[matchIdx];
                                            if (uMatch) {
                                                const pA = uMatch.placeholderA;
                                                const pB = uMatch.placeholderB;
                                                const teamAObj = state.teams.find(
                                                    (t) => t.name?.trim().toLowerCase() === pA.trim().toLowerCase()
                                                );
                                                const teamBObj = state.teams.find(
                                                    (t) => t.name?.trim().toLowerCase() === pB.trim().toLowerCase()
                                                );

                                                return {
                                                    ...m,
                                                    placeholder_a: pA,
                                                    placeholder_home: pA,
                                                    home_team_id: teamAObj?.id || (pA === "TBD" ? null : m.home_team_id),
                                                    home_team: teamAObj ? { id: teamAObj.id, name: teamAObj.name, logo_url: teamAObj.logo_url } : (pA === "TBD" ? undefined : m.home_team),
                                                    placeholder_b: pB,
                                                    placeholder_away: pB,
                                                    away_team_id: teamBObj?.id || (pB === "TBD" ? null : m.away_team_id),
                                                    away_team: teamBObj ? { id: teamBObj.id, name: teamBObj.name, logo_url: teamBObj.logo_url } : (pB === "TBD" ? undefined : m.away_team),
                                                };
                                            }
                                        }
                                        return m;
                                    });
                                }

                                // Ensure dashed edge connecting group-matches -> group-in exists
                                const hasEdge = nextEdges.some(
                                    (e) => e.source === id && e.target === mNodeId && (e.sourceHandle === 'group-matches' || e.targetHandle === 'group-in')
                                );
                                if (!hasEdge) {
                                    nextEdges = [
                                        ...nextEdges,
                                        {
                                            id: `edge-rr-${id}-${mNodeId}`,
                                            source: id,
                                            target: mNodeId,
                                            sourceHandle: 'group-matches',
                                            targetHandle: 'group-in',
                                            type: 'bezier',
                                            animated: false,
                                            style: {
                                                stroke: 'var(--muted-foreground)',
                                                strokeWidth: 2,
                                                strokeDasharray: '5,5',
                                                opacity: 1,
                                            },
                                        },
                                    ];
                                }
                            }
                        });
                    }
                }
            }

            return {
                nodes: updatedNodes,
                edges: nextEdges,
                matches: nextStoreMatches,
                isDirty: skipDirty ? state.isDirty : true,
            };
        });
    },

    selectNode: (id) => {
        set((state) => {
            const hasChange = state.nodes.some(n => (n.id === id) !== !!n.selected);
            if (!hasChange && state.activeNodeId === id) return state;
            return {
                activeNodeId: id,
                nodes: hasChange
                    ? state.nodes.map((n) => ({
                          ...n,
                          selected: n.id === id,
                      }))
                    : state.nodes,
            };
        });
    },
}));
