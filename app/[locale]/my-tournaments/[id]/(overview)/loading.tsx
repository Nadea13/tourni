import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="flex flex-col h-full w-full border bg-card rounded-sm animate-pulse overflow-hidden">
            {/* Header matches ID tour-console-header */}
            <div className="flex items-center justify-between p-2 lg:p-4 border-b gap-1">
                {/* Left Side: Name, Help, Lock, Category Select */}
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 lg:h-10 w-36 lg:w-48 rounded-sm" />
                    <Skeleton className="h-8 lg:h-10 w-10 rounded-sm" />
                    <Skeleton className="h-8 lg:h-10 w-10 rounded-sm" />
                    <Skeleton className="h-8 lg:h-10 w-30 lg:w-40 rounded-sm" />
                </div>
                {/* Right Side: Save, Inbox, Share, Schedule, Settings */}
                <div className="flex items-center gap-1.5 lg:gap-2">
                    <Skeleton className="h-8 lg:h-10 w-20 lg:w-24 rounded-sm" />
                    <Skeleton className="h-8 lg:h-10 w-10 rounded-sm" />
                    <Skeleton className="h-8 lg:h-10 w-10 rounded-sm" />
                    <Skeleton className="h-8 lg:h-10 w-10 rounded-sm" />
                    <Skeleton className="h-8 lg:h-10 w-10 rounded-sm" />
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* Main Flow Editor Area */}
                <div className="flex-1 relative flex items-center justify-center bg-muted/5 overflow-hidden">
                    {/* Grid Background Lines (Dot Pattern style representation) */}
                    <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] opacity-50" />

                    {/* Floating Nodes Skeletons */}
                    <div className="relative w-full h-full flex items-center justify-center gap-12 p-8">
                        {/* Round 1 Column */}
                        <div className="space-y-16">
                            {[...Array(2)].map((_, idx) => (
                                <div key={idx} className="w-64 border rounded-sm p-3 bg-card space-y-2 relative shadow-sm">
                                    <div className="flex justify-between">
                                        <Skeleton className="h-4 w-12 rounded-sm" />
                                        <Skeleton className="h-4 w-20 rounded-sm" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center p-1 bg-muted/20 rounded-sm">
                                            <Skeleton className="h-4 w-24 rounded-sm" />
                                            <Skeleton className="h-4 w-6 rounded-sm" />
                                        </div>
                                        <div className="flex justify-between items-center p-1 bg-muted/20 rounded-sm">
                                            <Skeleton className="h-4 w-24 rounded-sm" />
                                            <Skeleton className="h-4 w-6 rounded-sm" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Round 2 Column */}
                        <div className="space-y-32">
                            <div className="w-64 border rounded-sm p-3 bg-card space-y-2 relative shadow-sm">
                                <div className="flex justify-between">
                                    <Skeleton className="h-4 w-12 rounded-sm" />
                                    <Skeleton className="h-4 w-20 rounded-sm" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center p-1 bg-muted/20 rounded-sm">
                                        <Skeleton className="h-4 w-24 rounded-sm" />
                                        <Skeleton className="h-4 w-6 rounded-sm" />
                                    </div>
                                    <div className="flex justify-between items-center p-1 bg-muted/20 rounded-sm">
                                        <Skeleton className="h-4 w-24 rounded-sm" />
                                        <Skeleton className="h-4 w-6 rounded-sm" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Settings Sidebar */}
                <div className="w-80 border-l hidden lg:flex flex-col p-4 space-y-4 shrink-0 bg-card">
                    <Skeleton className="h-6 w-1/3 rounded-sm" />
                    <Skeleton className="h-10 w-full rounded-sm" />
                    <div className="border-t pt-4 space-y-3">
                        <Skeleton className="h-4 w-1/4 rounded-sm" />
                        <Skeleton className="h-10 w-full rounded-sm" />
                        <Skeleton className="h-4 w-1/3 rounded-sm" />
                        <Skeleton className="h-24 w-full rounded-sm" />
                    </div>
                    <div className="border-t pt-4 space-y-2">
                        {[...Array(3)].map((_, idx) => (
                            <div key={idx} className="flex justify-between items-center py-1">
                                <Skeleton className="h-4 w-20 rounded-sm" />
                                <Skeleton className="h-6 w-12 rounded-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
