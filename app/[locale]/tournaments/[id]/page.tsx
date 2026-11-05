import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { getServerSession } from "@/lib/auth-server";
import { Match, MatchEvent, Goal, Player, SportType } from "@/types/index";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { PublicTournamentShell } from "@/features/tournaments/public/public-tournament-shell";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { PublicFooter } from "@/components/layout/public-footer";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiClient } from "@/lib/api-client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    try {
        const resp = await ApiClient.fetch<{ tournament: any }>(`/tournaments/${id}`);
        const tournament = resp?.tournament;
        if (!tournament) return { title: "Tournament Not Found" };
        return {
            title: `${tournament.name} | Live Standings & Results`,
            description: `Follow ${tournament.name} live. View standings, fixtures, results, and bracket in real-time.`,
            openGraph: {
                title: `${tournament.name} | Tourni`,
                description: `Live standings and results for ${tournament.name}.`,
            },
        };
    } catch {
        return { title: "Tournament Not Found" };
    }
}

export default async function PublicViewPage({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ category_id?: string }>;
}) {
    const { id } = await params;
    const { category_id } = await searchParams;
    const t = await getTranslations("PublicView");
    const session = await getServerSession();
    const user = session?.user || null;

    // 1. Fetch Tournament & Categories via API
    let tournamentData: any = null;
    let categories: any[] = [];
    try {
        const resp = await ApiClient.fetch<{ tournament: any; categories: any[] }>(`/tournaments/${id}`);
        tournamentData = resp?.tournament;
        categories = resp?.categories || [];
    } catch (e) {
        console.error("Error fetching tournament from Go API:", e);
        notFound();
    }

    if (!tournamentData) {
        notFound();
    }

    // Fetch announcements & sponsors
    let announcements: any[] = [];
    let sponsors: any[] = [];
    try {
        const [announcementsRes, sponsorsRes] = await Promise.all([
            ApiClient.fetch<any[]>(`/tournaments/${id}/announcements`).catch(() => []),
            ApiClient.fetch<any[]>(`/tournaments/${id}/sponsors`).catch(() => [])
        ]);
        announcements = announcementsRes || [];
        sponsors = sponsorsRes || [];
    } catch {
        // non-blocking
    }

    const category = categories.find(c => String(c.id) === category_id) || (categories.length > 0 ? categories[0] : null);
    if (!category) {
        const tournament = {
            ...tournamentData,
            format: tournamentData.format || 'knockout',
            max_teams: 8,
            advancing_teams: 2,
            canvas_data: null,
            user_id: tournamentData.organizer_id,
            sport: (tournamentData.sport_name?.toLowerCase() || 'football') as SportType,
            plan: 'free'
        };

        return (
            <div className="flex flex-col min-h-screen bg-background overflow-x-hidden print:pt-0">
                <PublicNavbar user={user} />
                <main className="flex-1 pt-14 flex items-center justify-center p-6 md:p-12 relative overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] bg-primary/10 rounded-full blur-[90px] pointer-events-none" />
                    <div className="max-w-md w-full bg-background/50 border border-slate-200 dark:border-foreground/10 backdrop-blur-md shadow-2xl rounded-2xl p-8 text-center space-y-6 transition-all duration-300 hover:shadow-primary/5 hover:border-primary/20 relative z-10">
                        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center animate-pulse">
                            <Trophy className="h-8 w-8" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-3xl font-black tracking-tighter text-foreground leading-none">
                                {t("not_active")}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight text-sm leading-relaxed">
                                {t.rich("not_active_desc", {
                                    name: tournament.name,
                                    span: (chunks) => <span className="text-primary font-bold">{chunks}</span>
                                })}
                            </p>
                        </div>
                        <div className="pt-2">
                            <Button asChild variant="outline" className="w-full sm:w-auto font-semibold">
                                <Link href="/">
                                    {t("back_to_home")}
                                </Link>
                            </Button>
                        </div>
                    </div>
                </main>
                <PublicFooter />
            </div>
        );
    }

    const categoryId = category.id;
    const canvasData = category.canvas_data;
    const maxTeams = category.max_teams || 8;

    const settings = typeof tournamentData.settings === 'object' && tournamentData.settings !== null ? tournamentData.settings : {};
    const tournament = {
        ...tournamentData,
        ...settings,
        format: tournamentData.format || 'knockout',
        max_teams: maxTeams,
        advancing_teams: 2,
        canvas_data: canvasData,
        user_id: tournamentData.organizer_id,
        sport: (tournamentData.sport_name?.toLowerCase() || 'football') as SportType,
        plan: 'free',
        registration_fee: category?.registration_fee ?? 0
    };

    // 2. Fetch Tournament Teams
    let rawTeams: any[] = [];
    try {
        rawTeams = await ApiClient.fetch<any[]>(`/tournaments/${id}/teams?category_id=${categoryId}`);
    } catch {
        rawTeams = [];
    }

    const teams = (rawTeams || []).map((t: any) => {
        const teamObj = t.team || {};
        return {
            ...t,
            name: teamObj.name || t.team_name || "Unknown Team",
            logo_url: teamObj.logo_url || teamObj.logo_img || t.logo_url || null,
            description: teamObj.description || null,
            contact_name: t.contact_name || teamObj.contact_name || null,
            contact_phone: t.contact_phone || teamObj.contact_phone || null,
            sport: 'football' as SportType,
            user_id: teamObj.user_id || null,
            created_at: t.created_at
        };
    });

    // 3. Fetch Matches
    let rawMatches: any[] = [];
    try {
        rawMatches = await ApiClient.fetch<any[]>(`/tournaments/${id}/matches?category_id=${categoryId}`);
    } catch {
        rawMatches = [];
    }

    const matches = (rawMatches || []).map((m: any) => {
        let match_date = m.match_date || null;
        let match_time = m.match_time || null;
        if (m.scheduled_at) {
            const parts = m.scheduled_at.split('T');
            match_date = match_date || parts[0];
            match_time = match_time || parts[1]?.substring(0, 5) || null;
        }

        const penalty_home_score = m.penalty_home_score ??
            m.home_penalty_score ??
            m.score_detail?.penalty_home_score ??
            m.score_detail?.home_penalty_score;
        const penalty_away_score = m.penalty_away_score ??
            m.away_penalty_score ??
            m.score_detail?.penalty_away_score ??
            m.score_detail?.away_penalty_score;
        const winner_id = m.winner_id || m.winner_to_node_id || m.score_detail?.winner_id;

        return {
            ...m,
            match_date,
            match_time,
            penalty_home_score,
            penalty_away_score,
            winner_id,
            home_team: m.home_team ? { id: m.home_team_id, name: m.home_team.name, logo_url: m.home_team.logo_url || m.home_team.logo_img } : null,
            away_team: m.away_team ? { id: m.away_team_id, name: m.away_team.name, logo_url: m.away_team.logo_url || m.away_team.logo_img } : null,
            home_score: typeof m.home_score === 'object' && m.home_score !== null && 'total' in m.home_score ? Number((m.home_score as { total?: number }).total) || 0 : Number(m.home_score) || 0,
            away_score: typeof m.away_score === 'object' && m.away_score !== null && 'total' in m.away_score ? Number((m.away_score as { total?: number }).total) || 0 : Number(m.away_score) || 0
        };
    });

    // 4. Fetch Tournament Events & Players
    let rawEvents: any[] = [];
    let rawPlayers: any[] = [];
    try {
        const [eventsRes, playersRes] = await Promise.all([
            ApiClient.fetch<any[]>(`/tournaments/${id}/events?category_id=${categoryId}`).catch(() => []),
            ApiClient.fetch<any[]>(`/tournaments/${id}/players?category_id=${categoryId}`).catch(() => [])
        ]);
        rawEvents = eventsRes || [];
        rawPlayers = playersRes || [];
    } catch {
        // non-blocking
    }

    const allEvents: MatchEvent[] = (rawEvents || []).map((e: any) => {
        const detailObj = e.detail || e.extra_info || {};
        const eventType = e.type || e.event_type || 'goal';
        return {
            ...e,
            type: eventType,
            event_type: eventType,
            detail: detailObj,
            extra_info: detailObj,
            player_name: e.player_name || detailObj.player_name || "Unknown Player",
            team_name: e.team_name || detailObj.team_name,
            team_logo: e.team_logo || detailObj.team_logo
        };
    });

    const initialPlayers: Player[] = (rawPlayers || []).map((p: any) => {
        const mp = p.master_player || {};
        return {
            ...p,
            id: p.id,
            name: mp.name || p.name || "Unknown Player",
            number: p.shirt_number ? parseInt(p.shirt_number) : (p.number ?? null),
            position: p.position || null,
            team_id: p.tournament_team_id || p.team_id,
            photo_url: p.photo_url || mp.photo_url || p.profile_img || mp.profile_img || null,
            master_player_id: p.master_player_id || null,
            master_player: mp,
            birth_date: mp.birthday || p.birth_date || null,
            birthday: mp.birthday || p.birthday || null,
            created_at: p.created_at || new Date().toISOString(),
            status: 'approved'
        };
    });
    const initialGoals: Goal[] = [];

    return (
        <div className="flex flex-col min-h-screen bg-background overflow-x-hidden print:pt-0">
            <PublicNavbar user={user} />

            <main className="flex-1 pt-16 md:pt-20">
                <PublicTournamentShell
                    tournament={tournament}
                    initialTeams={teams}
                    initialMatches={matches as Match[]}
                    initialEvents={allEvents}
                    initialGoals={initialGoals}
                    initialPlayers={initialPlayers}
                    categories={categories.map((c: any) => ({
                        id: String(c.id),
                        name: `${c.age_categories?.category_name || c.category_name || "General"} (${c.gender_type || "open"})`
                    }))}
                    selectedCategoryId={category.id ? String(category.id) : undefined}
                    announcements={announcements}
                    sponsors={sponsors}
                />
            </main>

            <PublicFooter />
        </div>
    );
}
