import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { ApiClient } from "@/lib/api-client";
import { MatchEvent, Match } from "@/types";
import { ConsolePage as FootballConsolePage } from "@/features/sports/football/console-page";
import { VolleyballConsolePage } from "@/features/sports/volleyball/console-page";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { PublicFooter } from "@/components/layout/public-footer";
import { syncCategoryBracket } from "@/actions/tournaments/bracket";

export default async function MatchConsoleReadOnlyPage(props: {
    params: Promise<{ locale: string; id: string; matchId: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { locale: _locale, id, matchId } = await props.params;
    const resolvedParams = await props.searchParams;
    const fromTab = typeof resolvedParams.from === 'string' ? resolvedParams.from : 'matches';

    const session = await getServerSession();
    const user = session?.user || null;

    // 1. Fetch the match details from Go REST API
    let rawMatch: any = null;
    try {
        rawMatch = await ApiClient.fetch<any>(`/matches/${matchId}`);
    } catch (err) {
        console.error("Match fetch error from Go API:", err, "Match ID:", matchId);
    }

    if (!rawMatch || !rawMatch.id) {
        notFound();
    }

    // 2. Fetch Tournament & Categories via Go API
    let tournamentData: any = null;
    let categories: any[] = [];
    try {
        const resp = await ApiClient.fetch<{ tournament: any; categories: any[] }>(`/tournaments/${id}`);
        tournamentData = resp?.tournament;
        categories = resp?.categories || [];
    } catch (e) {
        console.error("Error fetching tournament from Go API:", e);
    }

    // Auto-resolve team IDs if missing in database for this match node
    const catId = rawMatch.category_id || rawMatch.tournament_category_id;
    if ((!rawMatch.home_team_id || !rawMatch.away_team_id) && catId) {
        try {
            await syncCategoryBracket(id, catId, true, true);
            const refreshed = await ApiClient.fetch<any>(`/matches/${matchId}`);
            if (refreshed && refreshed.id) {
                rawMatch = refreshed;
            }
        } catch (syncErr) {
            console.error("Error auto-syncing bracket match teams in public page:", syncErr);
        }
    }

    // 3. Fetch initial events
    let rawEvents: any[] = [];
    try {
        rawEvents = await ApiClient.fetch<any[]>(`/matches/${matchId}/events`);
    } catch {
        rawEvents = [];
    }

    // Format home & away teams
    const home_team = rawMatch.home_team ? {
        id: rawMatch.home_team.id,
        name: String(rawMatch.home_team.name || 'Unknown Team'),
        logo_url: rawMatch.home_team.logo_url || rawMatch.home_team.logo_img || null,
        description: rawMatch.home_team.description || null,
        contact_name: rawMatch.home_team.contact_name || null,
        contact_phone: rawMatch.home_team.contact_phone || null
    } : (rawMatch.placeholder_home ? {
        id: 'placeholder_home',
        name: String(rawMatch.placeholder_home),
        logo_url: null,
    } : null);

    const away_team = rawMatch.away_team ? {
        id: rawMatch.away_team.id,
        name: String(rawMatch.away_team.name || 'Unknown Team'),
        logo_url: rawMatch.away_team.logo_url || rawMatch.away_team.logo_img || null,
        description: rawMatch.away_team.description || null,
        contact_name: rawMatch.away_team.contact_name || null,
        contact_phone: rawMatch.away_team.contact_phone || null
    } : (rawMatch.placeholder_away ? {
        id: 'placeholder_away',
        name: String(rawMatch.placeholder_away),
        logo_url: null,
    } : null);

    const match: Match = {
        ...rawMatch,
        home_team,
        away_team,
        home_score: typeof rawMatch.home_score === 'object' && rawMatch.home_score !== null && 'total' in rawMatch.home_score
            ? Number((rawMatch.home_score as { total?: number }).total) || 0
            : Number(rawMatch.home_score) || 0,
        away_score: typeof rawMatch.away_score === 'object' && rawMatch.away_score !== null && 'total' in rawMatch.away_score
            ? Number((rawMatch.away_score as { total?: number }).total) || 0
            : Number(rawMatch.away_score) || 0,
    };

    const sportName = (
        tournamentData?.sport ||
        tournamentData?.sport_name ||
        tournamentData?.sports?.sport_name ||
        tournamentData?.rules_config?.sport ||
        'football'
    ).toLowerCase();

    const formattedEvents: MatchEvent[] = (rawEvents || []).map((e: any) => ({
        ...e,
        player_name: e.extra_info?.player_name || e.player_name || (e.player?.name || "Unknown"),
    }));

    const categoryId = typeof resolvedParams.category === 'string' ? resolvedParams.category : rawMatch.tournament_category_id;
    const backParams = new URLSearchParams();
    if (categoryId) backParams.set('category', categoryId);
    if (fromTab) backParams.set('tab', fromTab);
    const backUrl = backParams.toString()
        ? `/tournaments/${id}?${backParams.toString()}`
        : `/tournaments/${id}`;

    // Extract category rules_config if available
    let maxSets = 3;
    let rulesConfig: Record<string, unknown> | null = null;
    const categoryData = categories.find((c: any) => String(c.id) === String(rawMatch.tournament_category_id || categoryId));

    if (categoryData?.rules_config && typeof categoryData.rules_config === 'object') {
        rulesConfig = categoryData.rules_config as Record<string, unknown>;
        const rules = rulesConfig as { max_sets?: number };
        if (rules.max_sets) {
            maxSets = Number(rules.max_sets);
        }
    }

    return (
        <div className="flex flex-col min-h-screen bg-background overflow-x-hidden print:pt-0">
            {/* Navbar */}
            <PublicNavbar user={user} />

            <main className="flex-1 pt-18 lg:pt-20 container max-w-7xl mx-auto px-2 md:px-0 pb-8">
                {sportName === 'volleyball' ? (
                    <VolleyballConsolePage
                        match={match}
                        tournamentId={id}
                        tournamentName={tournamentData?.name || undefined}
                        readOnly={true}
                        fullWidthScoreboard={true}
                        initialEvents={formattedEvents}
                        backUrl={backUrl}
                        maxSets={maxSets}
                        rulesConfig={rulesConfig}
                    />
                ) : (
                    <FootballConsolePage
                        match={match}
                        tournamentId={id}
                        tournamentName={tournamentData?.name || undefined}
                        readOnly={true}
                        fullWidthScoreboard={true}
                        initialEvents={formattedEvents}
                        backUrl={backUrl}
                        rulesConfig={rulesConfig}
                        sport={sportName}
                    />
                )}
            </main>
            <PublicFooter />
        </div>
    );
}
