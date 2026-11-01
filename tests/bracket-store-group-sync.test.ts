import { describe, it, expect, beforeEach } from 'vitest';
import { useBracketStore } from '@/lib/stores/bracket-store';

describe('useBracketStore - Group Node to Round realtime sync', () => {
    beforeEach(() => {
        useBracketStore.getState().reset();
    });

    it('should update connected Round match fixtures in realtime when group teams change', () => {

        const groupNode = {
            id: 'group-1',
            type: 'groupNode',
            position: { x: 0, y: 0 },
            data: {
                label: 'Group A',
                teamCount: 4,
                teams: ['TBD', 'TBD', 'TBD', 'TBD'],
            },
        };

        const matchNode = {
            id: 'match-round-1',
            type: 'matchNode',
            position: { x: 400, y: 0 },
            data: {
                label: 'A (Fixtures)',
                matches: [
                    { id: 'm-1', placeholderA: 'Team A1', placeholderB: 'Team A4' },
                    { id: 'm-2', placeholderA: 'Team A3', placeholderB: 'Team A2' },
                    { id: 'm-3', placeholderA: 'Team A3', placeholderB: 'Team A1' },
                    { id: 'm-4', placeholderA: 'Team A4', placeholderB: 'Team A2' },
                    { id: 'm-5', placeholderA: 'Team A1', placeholderB: 'Team A2' },
                    { id: 'm-6', placeholderA: 'Team A4', placeholderB: 'Team A3' },
                ],
            },
        };

        const edge = {
            id: 'edge-group-match',
            source: 'group-1',
            target: 'match-round-1',
            sourceHandle: 'group-matches',
            targetHandle: 'group-in',
        };

        useBracketStore.setState({
            nodes: [groupNode as any, matchNode as any],
            edges: [edge as any],
        });

        // Drop "Arsenal" into Slot 0
        useBracketStore.getState().updateNodeData('group-1', {
            teams: ['Arsenal', 'TBD', 'TBD', 'TBD'],
        });

        const stateAfterArsenal = useBracketStore.getState();
        const updatedMatchNode = stateAfterArsenal.nodes.find((n) => n.id === 'match-round-1');
        const matches = (updatedMatchNode?.data?.matches as any[]) || [];

        // In pairings:
        // Match 0 is Slot 0 vs Slot 3 -> placeholderA should be "Arsenal"
        expect(matches[0].placeholderA).toBe('Arsenal');
        // Match 2 is Slot 2 vs Slot 0 -> placeholderB should be "Arsenal"
        expect(matches[2].placeholderB).toBe('Arsenal');
        // Match 4 is Slot 0 vs Slot 1 -> placeholderA should be "Arsenal"
        expect(matches[4].placeholderA).toBe('Arsenal');

        // Now drop "Chelsea" into Slot 1
        useBracketStore.getState().updateNodeData('group-1', {
            teams: ['Arsenal', 'Chelsea', 'TBD', 'TBD'],
        });

        const stateAfterChelsea = useBracketStore.getState();
        const updatedMatchNode2 = stateAfterChelsea.nodes.find((n) => n.id === 'match-round-1');
        const matches2 = (updatedMatchNode2?.data?.matches as any[]) || [];

        // Match 4 is Slot 0 vs Slot 1 -> "Arsenal" vs "Chelsea"
        expect(matches2[4].placeholderA).toBe('Arsenal');
        expect(matches2[4].placeholderB).toBe('Chelsea');

        // Match 1 is Slot 2 vs Slot 1 -> placeholderB should be "Chelsea"
        expect(matches2[1].placeholderB).toBe('Chelsea');
    });

    it('should clear to TBD in the round when slot is cleared', () => {
        const groupNode = {
            id: 'group-b',
            type: 'groupNode',
            position: { x: 0, y: 0 },
            data: {
                label: 'Group B',
                teamCount: 4,
                teams: ['Real Madrid', 'Barcelona', 'TBD', 'TBD'],
            },
        };

        const matchNode = {
            id: 'match-round-b',
            type: 'matchNode',
            position: { x: 400, y: 0 },
            data: {
                label: 'Matches: Group B',
                matches: [
                    { id: 'm-1', placeholderA: 'Real Madrid', placeholderB: 'Team B4' },
                    { id: 'm-2', placeholderA: 'Team B3', placeholderB: 'Barcelona' },
                    { id: 'm-3', placeholderA: 'Team B3', placeholderB: 'Real Madrid' },
                    { id: 'm-4', placeholderA: 'Team B4', placeholderB: 'Barcelona' },
                    { id: 'm-5', placeholderA: 'Real Madrid', placeholderB: 'Barcelona' },
                    { id: 'm-6', placeholderA: 'Team B4', placeholderB: 'Team B3' },
                ],
            },
        };

        const edge = {
            id: 'edge-group-match-b',
            source: 'group-b',
            target: 'match-round-b',
            sourceHandle: 'group-matches',
            targetHandle: 'group-in',
        };

        useBracketStore.setState({
            nodes: [groupNode as any, matchNode as any],
            edges: [edge as any],
        });

        // Clear Slot 0 back to "TBD"
        useBracketStore.getState().updateNodeData('group-b', {
            teams: ['TBD', 'Barcelona', 'TBD', 'TBD'],
        });

        const state = useBracketStore.getState();
        const updatedMatchNode = state.nodes.find((n) => n.id === 'match-round-b');
        const matches = (updatedMatchNode?.data?.matches as any[]) || [];

        // Match 0 placeholderA was Real Madrid, should now be "TBD"
        expect(matches[0].placeholderA).toBe('TBD');
        // Match 2 placeholderB was Real Madrid, should now be "TBD"
        expect(matches[2].placeholderB).toBe('TBD');
        // Match 4 is Slot 0 vs Slot 1 -> "TBD" vs "Barcelona"
        expect(matches[4].placeholderA).toBe('TBD');
        expect(matches[4].placeholderB).toBe('Barcelona');
    });

    it('should generate Match Day round nodes separated by rounds and update them on team changes', () => {

        const groupNode = {
            id: 'group-c',
            type: 'groupNode',
            position: { x: 100, y: 100 },
            data: {
                label: 'Group C',
                teamCount: 4,
                teams: ['Team 1', 'Team 2', 'Team 3', 'Team 4'],
            },
        };

        useBracketStore.setState({
            nodes: [groupNode as any],
            edges: [],
        });

        // Generate Match Days
        useBracketStore.getState().generateRoundRobinMatchDays('group-c');

        const stateAfterGen = useBracketStore.getState();
        const matchDayNodes = stateAfterGen.nodes.filter(
            (n) => n.type === 'matchNode' && n.data?.groupId === 'group-c'
        );

        // 4 teams -> 3 match days
        expect(matchDayNodes.length).toBe(3);

        const day1 = matchDayNodes.find((n) => n.data?.matchDay === 1);
        const day2 = matchDayNodes.find((n) => n.data?.matchDay === 2);
        const day3 = matchDayNodes.find((n) => n.data?.matchDay === 3);

        expect(day1).toBeDefined();
        expect(day2).toBeDefined();
        expect(day3).toBeDefined();

        expect(day1?.data?.label).toBe('Group C - Match Day 1');
        expect((day1?.data?.matches as any[]).length).toBe(2);

        // Check edges created for each match day
        const dayEdges = stateAfterGen.edges.filter(
            (e) => e.source === 'group-c' && e.sourceHandle === 'group-matches' && e.targetHandle === 'group-in'
        );
        expect(dayEdges.length).toBe(3);

        // Update group teams (e.g. rename Team 1 -> "Arsenal", Team 3 -> "Chelsea")
        useBracketStore.getState().updateNodeData('group-c', {
            teams: ['Arsenal', 'Team 2', 'Chelsea', 'Team 4'],
        });

        const stateAfterUpdate = useBracketStore.getState();
        const updatedDayNodes = stateAfterUpdate.nodes.filter(
            (n) => n.type === 'matchNode' && n.data?.groupId === 'group-c'
        );

        const allMatches = updatedDayNodes.flatMap((n) => (n.data?.matches as any[]) || []);
        expect(allMatches.length).toBe(6);

        // Find the match that pairs slot 0 and slot 2
        const arsenalChelseaMatch = allMatches.find(
            (m) =>
                (m.placeholderA === 'Arsenal' && m.placeholderB === 'Chelsea') ||
                (m.placeholderA === 'Chelsea' && m.placeholderB === 'Arsenal')
        );
        expect(arsenalChelseaMatch).toBeDefined();

        // Verify that Arsenal and Chelsea each appear exactly 3 times across all 6 matches
        const arsenalCount = allMatches.filter(m => m.placeholderA === 'Arsenal' || m.placeholderB === 'Arsenal').length;
        const chelseaCount = allMatches.filter(m => m.placeholderA === 'Chelsea' || m.placeholderB === 'Chelsea').length;
        expect(arsenalCount).toBe(3);
        expect(chelseaCount).toBe(3);
    });
    it('should halve the match count in next round when a Round node connects (4 matches -> 2 matches -> 1 match)', () => {
        const roundNode = {
            id: 'match-20',
            type: 'matchNode',
            position: { x: 0, y: 0 },
            data: {
                label: 'Round Match #20',
                isRound: true,
                matches: [
                    { id: 'm-1', placeholderA: 'TBD', placeholderB: 'TBD' },
                    { id: 'm-2', placeholderA: 'TBD', placeholderB: 'TBD' },
                    { id: 'm-3', placeholderA: 'TBD', placeholderB: 'TBD' },
                    { id: 'm-4', placeholderA: 'TBD', placeholderB: 'TBD' },
                ],
            },
        };

        const nextRoundNode = {
            id: 'match-21',
            type: 'matchNode',
            position: { x: 300, y: 0 },
            data: {
                label: 'Match #21',
                isRound: true,
                matches: [{ id: 'm-next-1', placeholderA: 'TBD', placeholderB: 'TBD' }],
            },
        };

        const finalNode = {
            id: 'match-22',
            type: 'matchNode',
            position: { x: 600, y: 0 },
            data: {
                label: 'Match #22',
                matches: [{ id: 'm-next-2', placeholderA: 'TBD', placeholderB: 'TBD' }],
            },
        };

        useBracketStore.setState({
            nodes: [roundNode as any, nextRoundNode as any, finalNode as any],
            edges: [],
        });

        // Connect Round #20 (4 matches) -> Match #21 (should become 2 matches)
        useBracketStore.getState().onConnect({
            source: 'match-20',
            sourceHandle: 'round-out',
            target: 'match-21',
            targetHandle: 'slot-a-0',
        });

        const state1 = useBracketStore.getState();
        const updatedMatch21 = state1.nodes.find((n) => n.id === 'match-21');
        const matches21 = (updatedMatch21?.data?.matches as any[]) || [];
        expect(matches21.length).toBe(2);
        expect(updatedMatch21?.data?.isRound).toBe(true);
        expect(state1.edges.some(e => e.source === 'match-20' && e.target === 'match-21' && e.targetHandle === 'round-in')).toBe(true);

        // Match 1: Winner (Match 1) vs Winner (Match 2)
        expect(matches21[0].placeholderA).toBe('Winner (Match 1)');
        expect(matches21[0].placeholderB).toBe('Winner (Match 2)');

        // Match 2: Winner (Match 3) vs Winner (Match 4)
        expect(matches21[1].placeholderA).toBe('Winner (Match 3)');
        expect(matches21[1].placeholderB).toBe('Winner (Match 4)');

        // Connect Match #21 (2 matches) -> Match #22 (should become 1 match - Final)
        useBracketStore.getState().onConnect({
            source: 'match-21',
            sourceHandle: 'round-out',
            target: 'match-22',
            targetHandle: 'slot-a-0',
        });

        const state2 = useBracketStore.getState();
        const updatedMatch22 = state2.nodes.find((n) => n.id === 'match-22');
        const matches22 = (updatedMatch22?.data?.matches as any[]) || [];
        expect(matches22.length).toBe(1);
        expect(updatedMatch22?.data?.isRound).toBe(false);
        expect(state2.edges.some(e => e.source === 'match-21' && e.target === 'match-22' && e.targetHandle === 'round-in')).toBe(true);
        expect(matches22[0].placeholderA).toBe('Winner (Match 1)');
        expect(matches22[0].placeholderB).toBe('Winner (Match 2)');
    });

    it('should connect Round node with 4 matches to sibling individual Match nodes correctly', () => {
        const roundNode = {
            id: 'rnd-1',
            type: 'matchNode',
            position: { x: 0, y: 100 },
            data: {
                label: 'Round of 8',
                isRound: true,
                matches: [
                    { id: 'm-1', placeholderA: 'TBD', placeholderB: 'TBD' },
                    { id: 'm-2', placeholderA: 'TBD', placeholderB: 'TBD' },
                    { id: 'm-3', placeholderA: 'TBD', placeholderB: 'TBD' },
                    { id: 'm-4', placeholderA: 'TBD', placeholderB: 'TBD' },
                ],
            },
        };

        const match21 = {
            id: 'm-21',
            type: 'matchNode',
            position: { x: 300, y: 50 },
            data: {
                label: 'Match #21',
                isRound: false,
                matches: [{ id: 'sub-21', placeholderA: 'TBD', placeholderB: 'TBD' }],
            },
        };

        const match22 = {
            id: 'm-22',
            type: 'matchNode',
            position: { x: 300, y: 250 },
            data: {
                label: 'Match #22',
                isRound: false,
                matches: [{ id: 'sub-22', placeholderA: 'TBD', placeholderB: 'TBD' }],
            },
        };

        useBracketStore.setState({
            nodes: [roundNode as any, match21 as any, match22 as any],
            edges: [],
        });

        // First connect rnd-1 -> m-21
        useBracketStore.getState().onConnect({
            source: 'rnd-1',
            sourceHandle: 'round-out',
            target: 'm-21',
            targetHandle: 'slot-a-0',
        });

        // Then connect rnd-1 -> m-22
        useBracketStore.getState().onConnect({
            source: 'rnd-1',
            sourceHandle: 'round-out',
            target: 'm-22',
            targetHandle: 'slot-a-0',
        });

        const state = useBracketStore.getState();
        const updatedM21 = state.nodes.find((n) => n.id === 'm-21');
        const updatedM22 = state.nodes.find((n) => n.id === 'm-22');

        const m21Matches = (updatedM21?.data?.matches as any[]) || [];
        const m22Matches = (updatedM22?.data?.matches as any[]) || [];

        expect(m21Matches[0].placeholderA).toBe('Winner (Match 1)');
        expect(m21Matches[0].placeholderB).toBe('Winner (Match 2)');

        expect(m22Matches[0].placeholderA).toBe('Winner (Match 3)');
        expect(m22Matches[0].placeholderB).toBe('Winner (Match 4)');
    });

    it('should auto fill eligible teams into first round knockout matches', () => {
        const round1 = {
            id: 'r1',
            type: 'matchNode',
            position: { x: 0, y: 100 },
            data: {
                label: 'Quarter Finals',
                isRound: true,
                matches: [
                    { id: 'm-1', placeholderA: 'TBD', placeholderB: 'TBD' },
                    { id: 'm-2', placeholderA: 'TBD', placeholderB: 'TBD' },
                ],
            },
        };

        useBracketStore.setState({
            nodes: [round1 as any],
            edges: [],
            teams: [
                { id: 't1', name: 'Alpha', payment_status: 'paid' } as any,
                { id: 't2', name: 'Beta', payment_status: 'paid' } as any,
                { id: 't3', name: 'Gamma', payment_status: 'paid' } as any,
                { id: 't4', name: 'Delta', payment_status: 'paid' } as any,
            ],
        });

        const result = useBracketStore.getState().autoFillTeams();
        expect(result.success).toBe(true);
        expect(result.target).toBe('match');
        expect(result.count).toBe(4);

        const state = useBracketStore.getState();
        const node = state.nodes.find(n => n.id === 'r1');
        const matches = (node?.data?.matches as any[]) || [];
        const filled = [matches[0].placeholderA, matches[0].placeholderB, matches[1].placeholderA, matches[1].placeholderB];
        expect(filled).toContain('Alpha');
        expect(filled).toContain('Beta');
        expect(filled).toContain('Gamma');
        expect(filled).toContain('Delta');
    });
});
