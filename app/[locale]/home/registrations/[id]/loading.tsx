import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function Loading() {
    return (
        <div className="space-y-2 md:space-y-4 animate-pulse">
            {/* Top Navigation & Action Bar */}
            <div className="flex md:items-start justify-between gap-2 md:gap-4">
                <div className="flex items-center gap-1 md:gap-2">
                    <Button variant="ghost" size="icon-sm" asChild className="h-8 w-8 shrink-0 hover:bg-primary/10 hover:text-primary transition-all">
                        <Link href="/home">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div className="flex items-center gap-2 md:gap-4">
                        <Skeleton className="h-8 w-48 rounded-sm" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-sm" />
                    <Skeleton className="h-8 w-32 rounded-sm" />
                </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 md:gap-4">
                {/* Left Side (3 Columns): Tournament Info & Teams */}
                <div className="lg:col-span-3 space-y-2 md:space-y-4">
                    {/* Tournament Details */}
                    <div className="bg-card border rounded-sm p-4 space-y-4">
                        <Skeleton className="h-6 w-1/3 rounded-sm" />
                        <Skeleton className="aspect-[2/1] w-full rounded-sm" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full rounded-sm" />
                            <Skeleton className="h-4 w-3/4 rounded-sm" />
                        </div>
                    </div>

                    {/* Tournament Info */}
                    <div className="bg-card border rounded-sm p-4 space-y-3">
                        {[...Array(3)].map((_, idx) => (
                            <div key={idx} className="flex gap-2">
                                <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                                <div className="space-y-1 flex-1">
                                    <Skeleton className="h-3 w-12 rounded-sm" />
                                    <Skeleton className="h-4 w-1/2 rounded-sm" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Registered Teams */}
                    <div className="bg-card border rounded-sm p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <Skeleton className="h-6 w-1/3 rounded-sm" />
                            <Skeleton className="h-4 w-12 rounded-sm" />
                        </div>
                        <div className="space-y-2">
                            {[...Array(3)].map((_, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 border rounded-sm">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-8 w-8 rounded-full" />
                                        <Skeleton className="h-4 w-24 rounded-sm" />
                                    </div>
                                    <Skeleton className="h-5 w-16 rounded-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side (2 Columns): Registration Form */}
                <div className="lg:col-span-2 space-y-2 md:space-y-4">
                    <div className="bg-card border rounded-sm p-4 space-y-4">
                        <Skeleton className="h-6 w-1/4 rounded-sm" />
                        <Skeleton className="h-10 w-full rounded-sm" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-1/3 rounded-sm" />
                            <Skeleton className="h-10 w-full rounded-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-1/2 rounded-sm" />
                                <Skeleton className="h-10 w-full rounded-sm" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-1/2 rounded-sm" />
                                <Skeleton className="h-10 w-full rounded-sm" />
                            </div>
                        </div>
                        <Skeleton className="h-10 w-full rounded-sm" />
                    </div>
                </div>
            </div>
        </div>
    );
}
