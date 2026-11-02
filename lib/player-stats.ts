import { MatchEvent, TournamentRules } from "@/types/index";

export interface PlayerStat {
    playerId: string;
    playerName: string;
    teamId: string;
    teamName?: string;
    teamLogoUrl?: string | null;
    matchesPlayed: number;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    isBanned: boolean;
    banReason?: string;
    cleanSheets?: number;
}

const DEFAULT_RULES: TournamentRules = {
    tournament_id: '',
    half_duration: 45,
    extra_time_duration: 15,
    max_substitutions: 5,
    yellow_card_ban_threshold: 3,
    red_card_ban_matches: 1,
    points_for_win: 3,
    points_for_draw: 1,
    points_for_loss: 0,
};

/**
 * Calculate player statistics from match events
 */
export function calculatePlayerStats(
    events: MatchEvent[],
    players: { id: string; name: string; team_id?: string | null; teamName?: string; teamLogoUrl?: string | null }[],
    rules?: TournamentRules | null
): PlayerStat[] {
    const r = rules || DEFAULT_RULES;
    const statsMap = new Map<string, PlayerStat>();

    // Initialize stats for all players
    players.forEach(player => {
        statsMap.set(player.id, {
            playerId: player.id,
            playerName: player.name,
            teamId: player.team_id || '',
            teamName: player.teamName,
            teamLogoUrl: player.teamLogoUrl,
            matchesPlayed: 0,
            goals: 0,
            assists: 0,
            yellowCards: 0,
            redCards: 0,
            isBanned: false,
        });
    });

    // Track which matches each player has been involved in
    const playerMatchSet = new Map<string, Set<string>>();

    // Process events
    const matchPlayerYellows = new Map<string, number>();

    events.forEach(event => {
        if (!event.player_id) return;

        let stat = statsMap.get(event.player_id);
        if (!stat) {
            // Player not in roster but has events (edge case)
            stat = {
                playerId: event.player_id,
                playerName: event.player_name || 'Unknown',
                teamId: event.team_id || '',
                matchesPlayed: 0,
                goals: 0,
                assists: 0,
                yellowCards: 0,
                redCards: 0,
                isBanned: false,
            };
            statsMap.set(event.player_id, stat);
        }

        // Track matches played
        if (!playerMatchSet.has(event.player_id)) {
            playerMatchSet.set(event.player_id, new Set());
        }
        playerMatchSet.get(event.player_id)!.add(event.match_id);

        const isExplicitSecondYellow = Boolean(
            (event.extra_info as Record<string, unknown> | null)?.is_second_yellow ||
            (event.detail as Record<string, unknown> | null)?.is_second_yellow
        );

        switch (event.event_type) {
            case 'goal':
                stat.goals += 1;
                break;
            case 'assist':
                stat.assists += 1;
                break;
            case 'yellow_card': {
                stat.yellowCards += 1;
                const matchKey = `${event.match_id}-${event.player_id}`;
                const count = (matchPlayerYellows.get(matchKey) || 0) + 1;
                matchPlayerYellows.set(matchKey, count);
                if (isExplicitSecondYellow || count >= 2) {
                    stat.redCards += 1;
                }
                break;
            }
            case 'red_card':
                stat.redCards += 1;
                if (isExplicitSecondYellow) {
                    stat.yellowCards += 1;
                }
                break;
        }
    });

    // Update matches played
    playerMatchSet.forEach((matches, playerId) => {
        const stat = statsMap.get(playerId);
        if (stat) {
            stat.matchesPlayed = matches.size;
        }
    });

    // Calculate bans
    statsMap.forEach(stat => {
        if (stat.yellowCards >= r.yellow_card_ban_threshold) {
            stat.isBanned = true;
            stat.banReason = `${stat.yellowCards} yellow cards (threshold: ${r.yellow_card_ban_threshold})`;
        }
        if (stat.redCards > 0) {
            stat.isBanned = true;
            stat.banReason = `Red card (${r.red_card_ban_matches} match ban)`;
        }
    });

    return Array.from(statsMap.values())
        .filter(s => s.matchesPlayed > 0 || s.goals > 0 || s.yellowCards > 0 || s.redCards > 0)
        .sort((a, b) => {
            // Sort by goals (desc), then by name
            if (b.goals !== a.goals) return b.goals - a.goals;
            return a.playerName.localeCompare(b.playerName);
        });
}

/**
 * Get list of banned players
 */
export function getBannedPlayers(
    events: MatchEvent[],
    players: { id: string; name: string; team_id?: string | null; teamName?: string; teamLogoUrl?: string | null }[],
    rules?: TournamentRules | null
): PlayerStat[] {
    const stats = calculatePlayerStats(events, players, rules);
    return stats.filter(s => s.isBanned);
}
