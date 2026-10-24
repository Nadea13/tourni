import { DashboardShell } from "@/features/dashboard/dashboard-shell";

export default function MyTeamsLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShell>
            {children}
        </DashboardShell>
    );
}
