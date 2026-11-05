import { describe, it, expect } from 'vitest';

describe('Futsal Standings & Rules', () => {
    interface FutsalStats {
        name: string;
        mp: number;
        w: number;
        d: number;
        l: number;
        gf: number;
        ga: number;
        gd: number;
        pts: number;
    }

    function calculateFutsalStandings(
        teams: string[],
        matches: Array<{
            home: string;
            away: string;
            homeScore: number;
            awayScore: number;
            status: string;
        }>
    ): FutsalStats[] {
        const map = new Map<string, FutsalStats>();
        teams.forEach(t => {
            map.set(t, { name: t, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 });
        });

        matches.forEach(m => {
            if (m.status !== 'completed' && m.status !== 'finished') return;
            const h = map.get(m.home);
            const a = map.get(m.away);
            if (!h || !a) return;

            h.mp++;
            a.mp++;
            h.gf += m.homeScore;
            h.ga += m.awayScore;
            a.gf += m.awayScore;
            a.ga += m.homeScore;

            if (m.homeScore > m.awayScore) {
                h.w++;
                a.l++;
                h.pts += 3;
            } else if (m.homeScore < m.awayScore) {
                a.w++;
                h.l++;
                a.pts += 3;
            } else {
                h.d++;
                a.d++;
                h.pts += 1;
                a.pts += 1;
            }

            h.gd = h.gf - h.ga;
            a.gd = a.gf - a.ga;
        });

        return Array.from(map.values()).sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
        });
    }

    it('should correctly calculate 3 points for win and 1 point for draw in futsal', () => {
        const teams = ['Port Futsal', 'Chonburi Bluewave', 'Bangkok BTS'];
        const matches = [
            { home: 'Port Futsal', away: 'Chonburi Bluewave', homeScore: 4, awayScore: 2, status: 'completed' },
            { home: 'Chonburi Bluewave', away: 'Bangkok BTS', homeScore: 3, awayScore: 3, status: 'completed' },
        ];

        const standings = calculateFutsalStandings(teams, matches);

        expect(standings[0].name).toBe('Port Futsal');
        expect(standings[0].pts).toBe(3);
        expect(standings[0].gd).toBe(2);

        expect(standings[1].name).toBe('Bangkok BTS');
        expect(standings[1].pts).toBe(1);
        expect(standings[1].gd).toBe(0);

        expect(standings[2].name).toBe('Chonburi Bluewave');
        expect(standings[2].pts).toBe(1);
        expect(standings[2].gd).toBe(-2);
    });

    describe('Futsal Team Fouls Accumulation & Reset', () => {
        interface FoulEvent {
            event_type: string;
            team_side: 'home' | 'away';
            created_at: string;
        }

        function calculateCurrentPeriodFouls(events: FoulEvent[]) {
            const sorted = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            let currentPeriodStartIdx = 0;
            let isSecondHalf = false;

            sorted.forEach((e, idx) => {
                if (e.event_type === 'second_half') {
                    currentPeriodStartIdx = idx;
                    isSecondHalf = true;
                }
            });

            const periodEvents = isSecondHalf ? sorted.slice(currentPeriodStartIdx) : sorted;

            let homeFouls = 0;
            let awayFouls = 0;
            let homeTimeout = false;
            let awayTimeout = false;

            periodEvents.forEach(e => {
                if (e.event_type === 'foul') {
                    if (e.team_side === 'home') homeFouls++;
                    if (e.team_side === 'away') awayFouls++;
                }
                if (e.event_type === 'timeout') {
                    if (e.team_side === 'home') homeTimeout = true;
                    if (e.team_side === 'away') awayTimeout = true;
                }
            });

            return {
                homeFouls,
                awayFouls,
                homeTimeoutUsed: homeTimeout,
                awayTimeoutUsed: awayTimeout,
                homeSecondPenaltyAwarded: homeFouls >= 6,
                awaySecondPenaltyAwarded: awayFouls >= 6,
            };
        }

        it('should accumulate fouls up to 5 and trigger 10m penalty alert on 6th foul', () => {
            const events: FoulEvent[] = [
                { event_type: 'first_half', team_side: 'home', created_at: '2026-11-04T10:00:00Z' },
                { event_type: 'foul', team_side: 'home', created_at: '2026-11-04T10:02:00Z' },
                { event_type: 'foul', team_side: 'home', created_at: '2026-11-04T10:05:00Z' },
                { event_type: 'foul', team_side: 'home', created_at: '2026-11-04T10:08:00Z' },
                { event_type: 'foul', team_side: 'home', created_at: '2026-11-04T10:11:00Z' },
                { event_type: 'foul', team_side: 'home', created_at: '2026-11-04T10:14:00Z' },
            ];

            let state = calculateCurrentPeriodFouls(events);
            expect(state.homeFouls).toBe(5);
            expect(state.homeSecondPenaltyAwarded).toBe(false);

            // 6th foul
            events.push({ event_type: 'foul', team_side: 'home', created_at: '2026-11-04T10:17:00Z' });
            state = calculateCurrentPeriodFouls(events);
            expect(state.homeFouls).toBe(6);
            expect(state.homeSecondPenaltyAwarded).toBe(true);
        });

        it('should correctly handle the 6-step loop: 5 fouls -> 6th second penalty -> restart loop on 7th foul', () => {
            function getFutsalFoulStep(currentFouls: number) {
                const foulStep = (currentFouls % 6) + 1;
                const loopCycle = Math.floor(currentFouls / 6) + 1;
                const isSecondPenalty = foulStep === 6;
                const activeDots = currentFouls % 6;
                return { foulStep, loopCycle, isSecondPenalty, activeDots };
            }

            // Click 1 (current fouls = 0) -> records foul 1/5
            expect(getFutsalFoulStep(0)).toEqual({ foulStep: 1, loopCycle: 1, isSecondPenalty: false, activeDots: 0 });
            // Click 2 (current fouls = 1) -> records foul 2/5
            expect(getFutsalFoulStep(1)).toEqual({ foulStep: 2, loopCycle: 1, isSecondPenalty: false, activeDots: 1 });
            // Click 3 (current fouls = 2) -> records foul 3/5
            expect(getFutsalFoulStep(2)).toEqual({ foulStep: 3, loopCycle: 1, isSecondPenalty: false, activeDots: 2 });
            // Click 4 (current fouls = 3) -> records foul 4/5
            expect(getFutsalFoulStep(3)).toEqual({ foulStep: 4, loopCycle: 1, isSecondPenalty: false, activeDots: 3 });
            // Click 5 (current fouls = 4) -> records foul 5/5
            expect(getFutsalFoulStep(4)).toEqual({ foulStep: 5, loopCycle: 1, isSecondPenalty: false, activeDots: 4 });
            // Click 6 (current fouls = 5) -> records 2nd penalty (10m)
            expect(getFutsalFoulStep(5)).toEqual({ foulStep: 6, loopCycle: 1, isSecondPenalty: true, activeDots: 5 });
            
            // Click 7 (current fouls = 6) -> RESTART LOOP: records foul 1/5 [loop 2], dots reset to 0
            expect(getFutsalFoulStep(6)).toEqual({ foulStep: 1, loopCycle: 2, isSecondPenalty: false, activeDots: 0 });
            // Click 8 (current fouls = 7) -> records foul 2/5 [loop 2]
            expect(getFutsalFoulStep(7)).toEqual({ foulStep: 2, loopCycle: 2, isSecondPenalty: false, activeDots: 1 });
            
            // Click 12 (current fouls = 11) -> records 2nd penalty [loop 2]
            expect(getFutsalFoulStep(11)).toEqual({ foulStep: 6, loopCycle: 2, isSecondPenalty: true, activeDots: 5 });
            // Click 13 (current fouls = 12) -> RESTART LOOP 3: records foul 1/5 [loop 3]
            expect(getFutsalFoulStep(12)).toEqual({ foulStep: 1, loopCycle: 3, isSecondPenalty: false, activeDots: 0 });
        });

        it('should reset fouls and timeouts to 0 when second half starts', () => {
            const events: FoulEvent[] = [
                { event_type: 'first_half', team_side: 'home', created_at: '2026-11-04T10:00:00Z' },
                { event_type: 'foul', team_side: 'home', created_at: '2026-11-04T10:02:00Z' },
                { event_type: 'foul', team_side: 'home', created_at: '2026-11-04T10:05:00Z' },
                { event_type: 'timeout', team_side: 'home', created_at: '2026-11-04T10:10:00Z' },
                { event_type: 'half_time', team_side: 'home', created_at: '2026-11-04T10:20:00Z' },
                // Second half begins
                { event_type: 'second_half', team_side: 'home', created_at: '2026-11-04T10:30:00Z' },
                { event_type: 'foul', team_side: 'home', created_at: '2026-11-04T10:32:00Z' },
            ];

            const state = calculateCurrentPeriodFouls(events);
            expect(state.homeFouls).toBe(1);
            expect(state.homeTimeoutUsed).toBe(false);
            expect(state.homeSecondPenaltyAwarded).toBe(false);
        });

        it('should correctly calculate scoreboard step number and active dots for each total fouls count in loop', () => {
            function getScoreboardStep(totalFouls: number) {
                const step = totalFouls % 6;
                const activeDots = step;
                const isAlert = step >= 5;
                return { step, activeDots, isAlert };
            }

            expect(getScoreboardStep(0)).toEqual({ step: 0, activeDots: 0, isAlert: false });
            expect(getScoreboardStep(1)).toEqual({ step: 1, activeDots: 1, isAlert: false });
            expect(getScoreboardStep(2)).toEqual({ step: 2, activeDots: 2, isAlert: false });
            expect(getScoreboardStep(3)).toEqual({ step: 3, activeDots: 3, isAlert: false });
            expect(getScoreboardStep(4)).toEqual({ step: 4, activeDots: 4, isAlert: false });
            expect(getScoreboardStep(5)).toEqual({ step: 5, activeDots: 5, isAlert: true });
            // Foul 6 (Second Penalty Awarded) -> RESETS TO 0!
            expect(getScoreboardStep(6)).toEqual({ step: 0, activeDots: 0, isAlert: false });
            // Foul 7 -> 1st foul of next cycle -> 1
            expect(getScoreboardStep(7)).toEqual({ step: 1, activeDots: 1, isAlert: false });
            expect(getScoreboardStep(8)).toEqual({ step: 2, activeDots: 2, isAlert: false });
            expect(getScoreboardStep(11)).toEqual({ step: 5, activeDots: 5, isAlert: true });
            // Foul 12 -> RESETS TO 0!
            expect(getScoreboardStep(12)).toEqual({ step: 0, activeDots: 0, isAlert: false });
            expect(getScoreboardStep(13)).toEqual({ step: 1, activeDots: 1, isAlert: false });
        });
    });

    describe('Futsal Countdown Timer & 2-Minute Red Card Penalty', () => {
        function calculateCountdownTime(baseSeconds: number, diffSeconds: number) {
            return Math.max(0, baseSeconds - diffSeconds);
        }

        function checkFutsalRedCardPenalty(
            currentClockSeconds: number,
            redCardClockSeconds: number,
            opponentGoalClockSeconds?: number
        ) {
            // In countdown timer: 2 minutes has passed when clock reaches (redCard - 120)
            const twoMinutesPassed = currentClockSeconds <= redCardClockSeconds - 120;
            const goalConceded = opponentGoalClockSeconds !== undefined &&
                opponentGoalClockSeconds <= redCardClockSeconds &&
                opponentGoalClockSeconds >= redCardClockSeconds - 120;

            const canReturn = goalConceded || twoMinutesPassed;
            const remainingSec = Math.max(0, currentClockSeconds - (redCardClockSeconds - 120));

            return {
                canReturn,
                remainingSec: canReturn ? 0 : remainingSec,
                reason: goalConceded ? 'goal_conceded' : (twoMinutesPassed ? 'time_elapsed' : 'penalty_active')
            };
        }

        it('should correctly count down from configured half time to 0 and not go below 0', () => {
            const halfSeconds = 20 * 60; // 1200 seconds (20:00)
            expect(calculateCountdownTime(halfSeconds, 0)).toBe(1200); // 20:00
            expect(calculateCountdownTime(halfSeconds, 60)).toBe(1140); // 19:00
            expect(calculateCountdownTime(halfSeconds, 1199)).toBe(1); // 00:01
            expect(calculateCountdownTime(halfSeconds, 1200)).toBe(0); // 00:00
            expect(calculateCountdownTime(halfSeconds, 1250)).toBe(0); // Clamped at 00:00
        });

        it('should enforce 2-minute penalty during countdown and allow return when 2 minutes pass or goal conceded', () => {
            const redCardClock = 18 * 60; // Red card occurred at 18:00 (1080 seconds on clock)

            // At 17:00 (1 minute elapsed, 1 minute remaining on penalty)
            const status1 = checkFutsalRedCardPenalty(17 * 60, redCardClock);
            expect(status1.canReturn).toBe(false);
            expect(status1.remainingSec).toBe(60);

            // At 16:00 (2 minutes elapsed -> 18:00 - 2:00 = 16:00 on clock)
            const status2 = checkFutsalRedCardPenalty(16 * 60, redCardClock);
            expect(status2.canReturn).toBe(true);
            expect(status2.reason).toBe('time_elapsed');

            // At 17:30 (30 seconds elapsed), opponent scores a goal at 17:30
            const status3 = checkFutsalRedCardPenalty(17 * 60 + 30, redCardClock, 17 * 60 + 30);
            expect(status3.canReturn).toBe(true);
            expect(status3.reason).toBe('goal_conceded');
        });
    });
});
