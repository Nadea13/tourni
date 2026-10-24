import { redirect } from "next/navigation";

export default async function DashboardBracketBuilderRedirect({
    params,
    searchParams,
}: {
    params: Promise<{ id: string; locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { id, locale } = await params;
    const sp = await searchParams;
    const queryString = new URLSearchParams(sp as Record<string, string>).toString();
    redirect(`/${locale}/my-tournaments/${id}/bracket-builder${queryString ? `?${queryString}` : ""}`);
}
