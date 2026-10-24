import { notFound } from "next/navigation";
import { validateTournamentAccess } from "@/lib/security";
import { Canvas } from "@/features/tournaments/builder/canvas";
import { ApiClient } from "@/lib/api-client";

export default async function BracketBuilderPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    // Validate access
    const access = await validateTournamentAccess(id, "viewer");
    if (!access.success) {
        notFound();
    }

    let tournament: any = null;
    let categories: any[] = [];
    try {
        const resp = await ApiClient.fetch<{ tournament: any; categories: any[] }>(`/tournaments/${id}`);
        tournament = resp?.tournament;
        categories = resp?.categories || [];
    } catch {
        notFound();
    }

    if (!tournament) {
        notFound();
    }

    const category = categories && categories.length > 0 ? categories[0] : null;
    const canvasData = category ? category.canvas_data : null;

    return (
        <Canvas
            tournamentId={id}
            tournamentName={tournament.name}
            initialCanvasData={canvasData ?? null}
            readonly={access.role === 'viewer'}
        />
    );
}
