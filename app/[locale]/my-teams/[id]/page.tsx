import { redirect } from "next/navigation";
import { getTournamentTeam, getTeam, getPlayers } from "@/actions/manager/team";
import { SquadManagement } from "@/features/teams/squad-management";
import { getServerSession } from "@/lib/auth-server";

export default async function TeamDetailPage({
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

    // Fetch master team first
    let team = await getTeam(id);
    if (!team) {
        team = await getTournamentTeam(id);
    }

    if (!team) {
        redirect(`/${locale}/my-teams`);
    }

    const currentUserId = session.user.id;
    const isOwner = Boolean(
        (team.user_id && team.user_id === currentUserId) ||
        (team.created_by && team.created_by === currentUserId)
    );

    if (isOwner) {
        // If owner, this is the master team management page with all editing and squad tools
        team.isParticipation = false;
    } else {
        // If not our user_id, make it use the exact same participant UI as /inboxes/teams/[id]
        team.isParticipation = true;
    }

    const playersResult = await getPlayers(id);
    const initialPlayers = playersResult.success ? (playersResult.data || []) : [];

    return (
        <div className="w-full">
            <SquadManagement
                team={team}
                initialPlayers={initialPlayers}
                backHref={`/${locale}/my-teams`}
                isTeamRequest={isTeamRequest}
            />
        </div>
    );
}
