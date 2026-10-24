import { redirect } from "next/navigation";

export default async function DashboardMatchDetailRedirect({
    params,
    searchParams,
}: {
    params: Promise<{ id: string; matchId: string; locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { id, matchId, locale } = await params;
    const sp = await searchParams;
    const queryString = new URLSearchParams(sp as Record<string, string>).toString();
    redirect(`/${locale}/my-tournaments/${id}/matches/${matchId}${queryString ? `?${queryString}` : ""}`);
}
