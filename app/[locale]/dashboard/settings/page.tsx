import { redirect } from "next/navigation";

export default async function DashboardSettingsRedirect({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { locale } = await params;
    const sp = await searchParams;
    const queryString = new URLSearchParams(sp as Record<string, string>).toString();
    redirect(`/${locale}/settings${queryString ? `?${queryString}` : ""}`);
}
