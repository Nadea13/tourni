import { redirect } from "next/navigation";
import { getTeam, getPlayers } from "@/actions/manager/team";
import { SquadManagement } from "@/features/teams/squad-management";
import { getServerSession } from "@/lib/auth-server";

export default async function TeamDetailPage({
    params,
}: {
    params: Promise<{ id: string; locale: string }>;
}) {
    const { id, locale } = await params;
    const session = await getServerSession();

    if (!session?.user) {
        redirect(`/${locale}/sign-in`);
    }

    const team = await getTeam(id);

    if (!team) {
        redirect(`/${locale}/my-teams`);
    }

    const playersResult = await getPlayers(id);
    const initialPlayers = playersResult.success ? (playersResult.data || []) : [];

    return (
        <div className="w-full">
            <SquadManagement
                team={team}
                initialPlayers={initialPlayers}
            />
        </div>
    );
}
