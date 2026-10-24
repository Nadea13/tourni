"use client";

import { useTranslations } from "next-intl";
import { Search, HelpCircle, ShieldCheck, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/ui/header";

export default function TeamsLoading() {
    const t = useTranslations("Team");

    return (
        <div className="flex flex-col gap-2 md:gap-4 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 md:gap-4">
                <div className="flex items-center gap-1 lg:gap-2">
                    <Header level={2}>{t("my_teams")}</Header>
                    <Button variant="ghost" size="icon-sm" disabled>
                        <HelpCircle className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 lg:w-128 sm:flex-none">
                        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
                        <Input type="search" size="sm" disabled />
                    </div>
                    <Button variant="outline" className="h-8 w-8 sm:w-auto gap-1" disabled>
                        <ShieldCheck className="h-4 w-4" />
                        <span className="hidden sm:inline">{t("verify_title")}</span>
                    </Button>
                    <Button className="h-8 w-8 p-0 sm:w-auto gap-1" disabled>
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">{t("add_team")}</span>
                    </Button>
                </div>
            </div>

            {/* Grid Skeleton */}
            <div className="grid gap-2 md:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(6)].map((_, idx) => (
                    <div key={idx} className="flex flex-col h-full bg-card border rounded-sm overflow-hidden p-4 space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                            <div className="flex gap-2 md:gap-4 overflow-hidden w-full">
                                <Skeleton className="h-14 w-14 rounded-full shrink-0" />
                                <div className="flex flex-col gap-2 flex-1">
                                    <Skeleton className="h-5 w-3/4 rounded-sm" />
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-4 w-12 rounded-sm" />
                                        <Skeleton className="h-3 w-16 rounded-sm" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="space-y-3 pt-2 border-t border-border/50">
                            <Skeleton className="h-6 w-full rounded-sm" />
                            <Skeleton className="h-3 w-2/3 rounded-sm" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
