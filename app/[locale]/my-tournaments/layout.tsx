import { DashboardShell } from "@/features/dashboard/dashboard-shell";

export default function MyTournamentsLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShell>
            {children}
        </DashboardShell>
    );
}
