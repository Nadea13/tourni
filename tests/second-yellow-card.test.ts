import { describe, it, expect } from 'vitest';
import { calculatePlayerStats } from '@/lib/player-stats';
import { MatchEvent } from '@/types';

describe('Second Yellow Card Logic', () => {
    const mockPlayers = [
        { id: 'player-1', name: 'Somchai Jaidee', team_id: 'team-a', number: 10 },
        { id: 'player-2', name: 'John Doe', team_id: 'team-b', number: 7 },
    ];

    it('should count second yellow card as a red card in calculatePlayerStats', () => {
        const events: MatchEvent[] = [
            {
                id: 'evt-1',
                match_id: 'match-1',
                team_id: 'team-a',
                player_id: 'player-1',
                event_type: 'yellow_card',
                minute: 15,
                created_at: new Date('2026-11-02T10:15:00Z').toISOString(),
            },
            {
                id: 'evt-2',
                match_id: 'match-1',
                team_id: 'team-a',
                player_id: 'player-1',
                event_type: 'red_card',
                minute: 60,
                extra_info: { is_second_yellow: true },
                created_at: new Date('2026-11-02T11:00:00Z').toISOString(),
            },
        ];

        const stats = calculatePlayerStats(events, mockPlayers);
        const p1 = stats.find(s => s.playerId === 'player-1');

        expect(p1).toBeDefined();
        // Should have 2 yellow cards and 1 red card
        expect(p1?.yellowCards).toBe(2);
        expect(p1?.redCards).toBe(1);
        expect(p1?.isBanned).toBe(true);
    });

    it('should correctly identify 2nd yellow card in match event list', () => {
        const events: MatchEvent[] = [
            {
                id: 'evt-1',
                match_id: 'match-1',
                team_id: 'team-a',
                player_id: 'player-1',
                player_name: 'Somchai Jaidee',
                event_type: 'yellow_card',
                minute: 20,
                created_at: new Date('2026-11-02T10:20:00Z').toISOString(),
            },
            {
                id: 'evt-2',
                match_id: 'match-1',
                team_id: 'team-a',
                player_id: 'player-1',
                player_name: 'Somchai Jaidee',
                event_type: 'yellow_card',
                minute: 75,
                created_at: new Date('2026-11-02T11:15:00Z').toISOString(),
            },
            {
                id: 'evt-3',
                match_id: 'match-1',
                team_id: 'team-b',
                player_id: 'player-2',
                player_name: 'John Doe',
                event_type: 'yellow_card',
                minute: 80,
                created_at: new Date('2026-11-02T11:20:00Z').toISOString(),
            },
        ];

        // Simulate the chronological second yellow detection used in EventLog
        const playerYellowCounts = new Map<string, number>();
        const secondYellowIds = new Set<string>();

        const sorted = [...events].sort((a, b) => {
            if (a.minute !== b.minute) return a.minute - b.minute;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        for (const evt of sorted) {
            const extra = ((evt.extra_info || evt.detail || {}) as Record<string, unknown>);
            if (extra.is_second_yellow) {
                secondYellowIds.add(evt.id);
                continue;
            }
            if (evt.event_type !== 'yellow_card') continue;

            const pKey = evt.player_id || extra.player_id || evt.player_name;
            if (!pKey) continue;

            const count = (playerYellowCounts.get(String(pKey)) || 0) + 1;
            playerYellowCounts.set(String(pKey), count);

            if (count >= 2) {
                secondYellowIds.add(evt.id);
            }
        }

        expect(secondYellowIds.has('evt-1')).toBe(false);
        expect(secondYellowIds.has('evt-2')).toBe(true);
        expect(secondYellowIds.has('evt-3')).toBe(false);
    });
});
