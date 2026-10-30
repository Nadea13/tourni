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
});
