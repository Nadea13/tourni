import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Match, Goal, TournamentTeam } from "@/types/index";
import { CategorySetup } from "@/features/tournaments/management/category-setup";
import { Trophy } from "lucide-react";
import { TournamentContent } from "@/features/tournaments/tournament-content";
import { getUserRole } from "@/actions/tournaments/staff";
import { getUserSubscriptionPlan } from "@/actions/common/user";

export default async function TournamentPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
    const { id, locale } = await params;
    const t = await getTranslations({ locale, namespace: "Tournament" });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

    let tournamentData: any = null;
    let categories: any[] = [];
    try {
        const res = await fetch(`${apiUrl}/tournaments/${id}`, { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            tournamentData = data.tournament;
            categories = data.categories || [];
        }
    } catch (e) {
        console.error("Error fetching tournament:", e);
    }

    if (!tournamentData) {
        notFound();
    }

    const [userPlan, roleRes] = await Promise.all([
        getUserSubscriptionPlan(),
        getUserRole(id)
    ]);

    const userRole = roleRes.success && roleRes.data ? roleRes.data.role : null;
    const isOwner = roleRes.success && roleRes.data ? roleRes.data.isOwner : false;

    const category = categories && categories.length > 0 ? categories[0] : null;
    if (!category) {
        if (userRole === "admin" || userRole === "editor" || isOwner) {
            const ageCategories = [
                { id: 1, category_name: "Open" },
                { id: 2, category_name: "U12" },
                { id: 3, category_name: "U14" },
                { id: 4, category_name: "U16" },
                { id: 5, category_name: "U18" },
                { id: 6, category_name: "35+" },
                { id: 7, category_name: "40+" }
            ];

            return (
                <CategorySetup
                    tournamentId={id}
                    ageCategories={ageCategories}
                    tournamentName={tournamentData.name}
                />
            );
        } else {
            return (
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 space-y-4">
                    <div className="h-16 w-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                        <Trophy className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-black tracking-tight">{t("not_initialized_title")}</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                        {t("not_initialized_desc")}
                    </p>
                </div>
            );
        }
    }


    const categoryId = category ? category.id : null;
    const canvasData = category ? category.canvas_data : null;
    const maxTeams = category ? category.max_teams : 8;

    const sportsObj = tournamentData.sports as unknown as { sport_name: string } | { sport_name: string }[] | null;
    const sportsList = Array.isArray(sportsObj) ? sportsObj : (sportsObj ? [sportsObj] : []);
    const sportName = (sportsList[0]?.sport_name?.toLowerCase() || 'football') as 'football';

    const tournament = {
        ...tournamentData,
        format: tournamentData.format || 'knockout',
        max_teams: maxTeams,
        advancing_teams: 2,
        canvas_data: canvasData,
        user_id: tournamentData.organizer_id,
        sport: sportName,
        plan: 'free' as 'free' | 'tournament' | 'monthly' | 'yearly',
        registration_fee: category ? Number(category.registration_fee || 0) : 0,
        logo_img: tournamentData.logo_url || tournamentData.logo_img || null,
        cover_img: tournamentData.banner_url || tournamentData.cover_img || null,
        logo_url: tournamentData.logo_url || tournamentData.logo_img || null,
        banner_url: tournamentData.banner_url || tournamentData.cover_img || null,
        location_name: tournamentData.location || tournamentData.settings?.location_name || tournamentData.location_name || null,
        google_map_url: tournamentData.settings?.google_map_url || tournamentData.google_map_url || null,
        document_deadline: tournamentData.settings?.document_deadline || tournamentData.document_deadline || null,
        is_registration_open: tournamentData.settings?.is_registration_open ?? (tournamentData.status === 'registration_open'),
        bank_name: tournamentData.settings?.bank_name || 'PromptPay',
        bank_account_name: tournamentData.settings?.bank_account_name || null,
        bank_account_number: tournamentData.settings?.bank_account_number || null,
    };

    // Fetch related data (Teams, Matches) from Go REST API
    let allTeams: any[] = [];
    let allMatches: any[] = [];

    if (categoryId) {
        try {
            const [teamsRes, matchesRes] = await Promise.all([
                fetch(`${apiUrl}/tournaments/${id}/teams?category_id=${categoryId}`, { cache: 'no-store' }),
                fetch(`${apiUrl}/tournaments/${id}/categories/${categoryId}/matches`, { cache: 'no-store' })
            ]);

            if (teamsRes.ok) {
                allTeams = await teamsRes.json();
            }
            if (matchesRes.ok) {
                allMatches = await matchesRes.json();
            }
        } catch (e) {
            console.error("Error fetching teams/matches:", e);
        }
    }

    const mappedTeams = (allTeams || []).map((t: any) => {
        const teamObj = t.team || {};
        return {
            ...t,
            name: teamObj.name || t.name || "Unknown Team",
            logo_url: teamObj.logo_img || teamObj.logo_url || t.logo_img || t.logo_url || null,
            description: teamObj.description || t.description || null,
            contact_name: teamObj.contact_name || t.contact_name || null,
            contact_phone: teamObj.contact_phone || t.contact_phone || null,
            sport: 'football' as const,
            user_id: teamObj.user_id || t.user_id || null
        };
    });

    const teams = mappedTeams.filter((t: any) => {
        const ps = t.payment_status;
        const rs = t.registration_status;
        if (!ps && !rs) return true;
        return String(ps || '').toLowerCase() === 'paid' ||
            String(rs || '').toLowerCase() === 'approved';
    });

    const matches = (allMatches || []).map((m: any) => {
        return {
            ...m,
            home_team: m.home_team ? { id: m.home_team_id, name: m.home_team.name, logo_url: m.home_team.logo_url || m.home_team.logo_img } : null,
            away_team: m.away_team ? { id: m.away_team_id, name: m.away_team.name, logo_url: m.away_team.logo_url || m.away_team.logo_img } : null,
            home_score: m.home_score || 0,
            away_score: m.away_score || 0
        };
    });

    // Top Scorers / Goals (initial empty array, populated from matches)
    const tournamentGoals: Goal[] = [];

    const isPro = true; // Pro locks removed for all users

    return (
        <TournamentContent
            tournament={tournament}
            initialMatches={matches as Match[] || []}
            initialTeams={teams as (TournamentTeam & { team?: { user_id: string | null } })[] || []}
            initialGoals={tournamentGoals as Goal[]}
            userPlan={userPlan}
            initialIsPro={isPro}
            id={id}
            userRole={userRole}
        />
    );
}
