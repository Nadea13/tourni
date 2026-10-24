"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Loading() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex flex-col font-display selection:bg-primary/30 space-y-2 lg:space-y-4 animate-pulse">
            {/* Header Skeleton */}
            <header className="flex items-center justify-between gap-1 lg:gap-2 h-10 dark:border-foreground/10">
                <div className="flex items-center gap-1 lg:gap-2 w-full">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0 hover:bg-primary/10 hover:text-primary transition-all"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-24 lg:w-32 bg-muted/60 rounded-sm" />
                            <Skeleton className="h-8 w-8 lg:w-8 bg-muted/60 rounded-sm" />
                            <Skeleton className="h-8 w-24 lg:w-32 bg-muted/60 rounded-sm" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-10 w-10 lg:w-10 bg-muted/60 rounded-sm" />
                            <Skeleton className="h-10 w-10 lg:w-10 bg-muted/60 rounded-sm" />
                            <Skeleton className="h-10 w-10 lg:w-10 bg-muted/60 rounded-sm" />
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full grid grid-cols-12 gap-2 lg:gap-4">
                {/* Sidebar Skeleton */}
                <aside className="col-span-12 lg:col-span-3 gap-2 lg:gap-4 order-2 lg:order-1 flex flex-col">
                    {/* Match Controls Skeleton */}
                    <div className="bg-card border p-2 lg:p-4 rounded-sm space-y-2">
                        <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                        <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                        <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                        <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                    </div>
                    {/* Quick Actions Skeleton */}
                    <div className="bg-card border p-2 lg:p-4 rounded-sm space-y-2">
                        <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                        <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                        <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                        <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                        <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                        <Skeleton className="h-10 w-full bg-muted/60 rounded-sm" />
                    </div>
                </aside>

                {/* Main Content Skeleton */}
                <div className="col-span-12 lg:col-span-9 order-1 lg:order-2 flex flex-col gap-2 lg:gap-4">
                    {/* Scoreboard Skeleton */}
                    <div className="bg-card border rounded-sm w-full">
                        <div className="p-2 lg:p-4 flex flex-col items-center justify-center w-full h-[120px] lg:h-[220px]">
                            <div className="flex items-center justify-between w-full max-w-5xl gap-4 lg:gap-12">
                                <div className="flex-1 flex flex-row-reverse items-center justify-start gap-2 lg:flex-col lg:items-center lg:gap-4 min-w-0">
                                    <Skeleton className="w-12 h-12 lg:w-24 lg:h-24 rounded-full bg-muted/60 shrink-0" />
                                    <Skeleton className="h-4 w-16 lg:h-7 lg:w-32 bg-muted/60 rounded-sm shrink-0" />
                                </div>

                                <div className="flex flex-col items-center gap-1 lg:gap-3 shrink-0">
                                    <Skeleton className="h-4 w-12 lg:h-6 lg:w-20 bg-muted/60 rounded-sm" />
                                    <div className="flex items-center gap-4 lg:gap-8">
                                        <Skeleton className="h-10 w-8 lg:h-24 lg:w-16 bg-muted/60 rounded-sm" />
                                        <span className="text-xl lg:text-4xl font-black text-foreground/20">-</span>
                                        <Skeleton className="h-10 w-8 lg:h-24 lg:w-16 bg-muted/60 rounded-sm" />
                                    </div>
                                </div>

                                <div className="flex-1 flex flex-row items-center justify-start gap-2 lg:flex-col lg:items-center lg:gap-4 min-w-0">
                                    <Skeleton className="w-12 h-12 lg:w-24 lg:h-24 rounded-full bg-muted/60 shrink-0" />
                                    <Skeleton className="h-4 w-16 lg:h-7 lg:w-32 bg-muted/60 rounded-sm shrink-0" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Team Action Grid Skeleton */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-4">
                        {[1, 2].map((i) => (
                            <div key={i} className="bg-card border rounded-sm p-2 lg:p-4 space-y-4">
                                <Skeleton className="h-8 w-24 bg-muted/60 rounded-sm" />
                                <div className="grid grid-cols-3 gap-1 lg:gap-2">
                                    {Array.from({ length: 9 }).map((_, idx) => (
                                        <Skeleton key={idx} className="h-10 w-full bg-muted/60 rounded-sm" />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Event Log Skeleton */}
                    <div className="bg-card border rounded-sm p-4 space-y-2">
                        <Skeleton className="h-12 w-full bg-muted/60 rounded-sm" />
                        <Skeleton className="h-12 w-full bg-muted/60 rounded-sm" />
                        <Skeleton className="h-12 w-full bg-muted/60 rounded-sm" />
                    </div>
                </div>
            </main>
        </div>
    );
}
