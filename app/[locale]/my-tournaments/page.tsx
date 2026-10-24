import { getDashboardTournaments } from "@/actions/tournaments/general";
import { getUserSubscriptionPlan } from "@/actions/common/user";
import { MyTournamentsClient } from "@/features/tournaments/management/my-tournaments-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "My Tournaments",
    description: "Browse and search for active and completed tournaments.",
};

export default async function MyTournamentsPage() {
    const tournaments = await getDashboardTournaments();
    const userPlan = await getUserSubscriptionPlan();

    return (
        <MyTournamentsClient
            initialTournaments={tournaments}
            userPlan={userPlan}
        />
    );
}
