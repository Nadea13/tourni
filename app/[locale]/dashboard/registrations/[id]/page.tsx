import { redirect } from "next/navigation";

export default async function DashboardRegistrationRedirect({
    params,
    searchParams,
}: {
    params: Promise<{ id: string; locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { id, locale } = await params;
    const sp = await searchParams;
    const queryString = new URLSearchParams(sp as Record<string, string>).toString();
    redirect(`/${locale}/home/registrations/${id}${queryString ? `?${queryString}` : ""}`);
}
