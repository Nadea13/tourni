"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

export default function TeamDetailLoading() {
    return (
        <div className="space-y-2 md:space-y-4 animate-in fade-in duration-300">
            {/* Top Navigation & Action Bar */}
            <div className="flex md:items-start justify-between gap-2 lg:gap-4">
                <div className="flex items-center gap-1 lg:gap-2">
                    <Button variant="ghost" size="icon" disabled className="shrink-0">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1 lg:gap-2">
                        <div className="flex gap-1 md:gap-2 items-center">
                            {/* Team Name Skeleton */}
                            <Skeleton className="h-8 w-40 rounded-sm" />
                            <div className="flex items-center gap-1 md:gap-2">
                                {/* Sport Badge Skeleton */}
                                <Skeleton className="h-5 w-16 rounded-full" />
                                {/* Players count Skeleton */}
                                <Skeleton className="h-4 w-12 rounded-sm" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-start gap-2">
                    {/* Add Players Dialog Button Skeleton */}
                    <Skeleton className="h-10 w-24 rounded-sm" />
                    {/* Lock Button Skeleton */}
                    <Skeleton className="h-10 w-12 rounded-sm" />
                </div>
            </div>

            {/* Layout Grid */}
            <div className="flex flex-col lg:flex-row gap-4 items-start">
                {/* Left Column (AddPlayerForm & SquadList Skeletons) */}
                <div className="flex-1 w-full min-w-0 space-y-2 md:space-y-4">
                    {/* AddPlayerForm Skeleton */}
                    <div className="bg-card border rounded-sm p-2 md:p-4">
                        <div className="flex flex-wrap items-end gap-1 md:gap-2">
                            <div className="flex gap-3 items-center w-full">
                                <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
                                    <div className="space-y-2">
                                        <Skeleton className="h-3 w-10 rounded" />
                                        <Skeleton className="h-10 w-full rounded-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-3 w-16 rounded" />
                                        <Skeleton className="h-10 w-full rounded-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-3 w-12 rounded" />
                                        <Skeleton className="h-10 w-full rounded-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-3 w-10 rounded" />
                                        <Skeleton className="h-10 w-full rounded-sm" />
                                    </div>
                                </div>
                                <Skeleton className="h-10 w-20 rounded-sm shrink-0 self-end" />
                            </div>
                        </div>
                    </div>

                    {/* SquadList Skeleton */}
                    <div className="bg-card space-y-2 md:space-y-4 border rounded-sm p-2 md:p-4">
                        <div className="grid gap-1 md:gap-2">
                            {[...Array(5)].map((_, idx) => (
                                <div key={idx} className="rounded-sm border p-2 md:p-3 flex gap-3 md:gap-6 items-center">
                                    <div className="flex flex-1 min-w-0 gap-3 items-center">
                                        {/* Player Avatar */}
                                        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                                        <div className="min-w-0 flex-1 flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                {/* Position Badge */}
                                                <Skeleton className="h-4 w-8 rounded-sm" />
                                                {/* Phone number */}
                                                <Skeleton className="h-3 w-20 rounded-sm" />
                                            </div>
                                            {/* Name */}
                                            <Skeleton className="h-5 w-1/3 rounded-sm" />
                                        </div>
                                    </div>
                                    {/* Actions menu */}
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column (EditTeamForm Skeleton) */}
                <div className="w-full lg:w-[380px] shrink-0 space-y-6 lg:sticky lg:top-6">
                    <div className="bg-card border rounded-sm p-2 md:p-4 space-y-4">
                        <Skeleton className="h-6 w-1/3 rounded-sm" />
                        <div className="space-y-3 pt-2">
                            <div className="space-y-2">
                                <Skeleton className="h-3.5 w-20 rounded" />
                                <Skeleton className="h-28 w-full rounded-sm" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-3.5 w-16 rounded" />
                                <Skeleton className="h-10 w-full rounded-sm" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-3.5 w-24 rounded" />
                                <Skeleton className="h-20 w-full rounded-sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Skeleton className="h-3.5 w-16 rounded" />
                                    <Skeleton className="h-10 w-full rounded-sm" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-3.5 w-20 rounded" />
                                    <Skeleton className="h-10 w-full rounded-sm" />
                                </div>
                            </div>
                            <Skeleton className="h-10 w-full rounded-sm pt-2" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
