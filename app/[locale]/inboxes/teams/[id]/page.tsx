import { redirect } from "next/navigation";
import { getTournamentTeam, getTeam, getPlayers } from "@/actions/manager/team";
import { SquadManagement } from "@/features/teams/squad-management";
import { getServerSession } from "@/lib/auth-server";

export default async function TournamentTeamDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string; locale: string }>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { id, locale } = await params;
    const sp = (await searchParams) || {};
    const isTeamRequest = sp.from === 'team_request';
    const session = await getServerSession();

    if (!session?.user) {
        redirect(`/${locale}/sign-in`);
    }

    // Try fetching as tournament team first, then fallback to global team
    let team = await getTournamentTeam(id);
    if (!team) {
        team = await getTeam(id);
    }

    if (!team) {
        redirect(`/${locale}/inboxes`);
    }

    team.isParticipation = true;

    const playersResult = await getPlayers(team.id, true);
    const initialPlayers = playersResult.success ? (playersResult.data || []) : [];

    return (
        <div className="w-full">
            <SquadManagement
                team={team}
                initialPlayers={initialPlayers}
                backHref={`/${locale}/inboxes`}
                isTeamRequest={isTeamRequest}
            />
        </div>
    );
}
