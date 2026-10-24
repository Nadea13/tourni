import { getMyTeams } from "@/actions/manager/team";
import { MyTeamsClient } from "@/features/teams/my-teams-client";
import { Team } from "@/types/index";

export default async function MyTeamsPage() {
    const result = await getMyTeams();
    const teams = result.success ? (result.data as Team[] || []) : [];

    return <MyTeamsClient initialTeams={teams} />;
}
