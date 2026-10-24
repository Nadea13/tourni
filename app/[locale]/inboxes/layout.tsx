import { DashboardShell } from "@/features/dashboard/dashboard-shell";

export default function InboxesLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShell>
            {children}
        </DashboardShell>
    );
}
