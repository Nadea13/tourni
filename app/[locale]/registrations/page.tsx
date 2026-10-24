import { getServerSession } from "@/lib/auth-server";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicTournamentsListClient } from "../tournaments/public-tournaments-list-client";
import { getPublicTournaments, getPublicSports } from "@/actions/public";
import { Tournament } from "@/types";

export default async function RegistrationsListPage() {
    const session = await getServerSession();
    const user = session?.user || null;

    // Fetch list of sports for filtering tab from Go backend
    const sports = await getPublicSports();

    // Fetch initial public tournaments on server (filter out closed registrations)
    const rawTournaments = (await getPublicTournaments()) as unknown as Tournament[];
    const initialTournaments = rawTournaments.filter(t => {
        const settings = (t as any).settings || {};
        return t.is_registration_open !== false && settings.is_registration_open !== false && settings.is_registration_open !== "false";
    });

    return (
        <div className="flex flex-col min-h-screen">
            <PublicNavbar user={user} />

            <main className="flex-1 pt-16 md:pt-20 container max-w-7xl mx-auto p-2 lg:px-0 space-y-4">
                <PublicTournamentsListClient 
                    sports={sports || []} 
                    initialTournaments={initialTournaments} 
                    showTabs={false}
                    onlyUpcoming={true}
                    title="การลงทะเบียน"
                    cardHrefPrefix="/registrations"
                />
            </main>

            <PublicFooter />
        </div>
    );
}
