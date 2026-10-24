import { DashboardShell } from "@/features/dashboard/dashboard-shell";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShell>
            {children}
        </DashboardShell>
    );
}
