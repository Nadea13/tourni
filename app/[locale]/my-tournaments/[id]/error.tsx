"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { Link } from "@/i18n/routing";

export default function TournamentError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Tournament error:", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="w-16 h-16 bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Tournament Not Found</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
                This tournament may not exist, or you don&apos;t have permission to access it.
            </p>
            {error?.digest && (
                <p className="text-xs text-muted-foreground mb-4 font-mono">
                    Error ID: {error.digest}
                </p>
            )}
            <div className="flex gap-3">
                <Button onClick={reset} variant="outline">
                    Try Again
                </Button>
                <Button asChild>
                    <Link href="/home">Back to Home</Link>
                </Button>
            </div>
        </div>
    );
}
