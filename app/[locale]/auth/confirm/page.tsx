"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLogo } from "@/components/shared/logo";
import { HeroDotBackground } from "@/components/landing/hero-dot-background";

export default function AuthConfirmPage() {
    const router = useRouter();
    const t = useTranslations("Common");
    const locale = useLocale();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const checkSession = async () => {
            try {
                const token = typeof window !== "undefined" ? (localStorage.getItem("token") || localStorage.getItem("access_token")) : null;
                if (token) {
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    window.location.href = `/${locale}/dashboard`;
                    return;
                }

                setTimeout(() => {
                    if (isMounted) {
                        router.push(`/${locale}/sign-in`);
                    }
                }, 1500);
            } catch (err: any) {
                if (isMounted) setError(err?.message || "Authentication error");
            }
        };

        checkSession();

        return () => {
            isMounted = false;
        };
    }, [locale, router]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background p-4">
                {/* Interactive Canvas Dot Background */}
                <HeroDotBackground />

                {/* Ambient Fade overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-background via-background/90 to-background/50 pointer-events-none z-[1]" />

                <Card className="w-full max-w-sm bg-card/50 backdrop-blur-md shadow-xl border rounded-sm relative z-10">
                    <CardContent className="px-4 pt-6 space-y-6 text-center">
                        {/* Logo */}
                        <BrandLogo 
                        href="/" 
                        size="md"
                        className="inline-flex items-center justify-center gap-2 mx-auto group transition-transform hover:scale-105"
                    />

                        <div className="text-destructive font-semibold">Authentication Error</div>
                        <p className="text-muted-foreground text-sm">{error}</p>
                        <button
                            onClick={() => router.push(`/${locale}/sign-in`)}
                            className="px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            Back to Login
                        </button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background p-4">
            {/* Interactive Canvas Dot Background */}
            <HeroDotBackground />

            {/* Ambient Fade overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-background via-background/90 to-background/50 pointer-events-none z-[1]" />

            <Card className="w-full max-w-sm bg-card/50 backdrop-blur-md shadow-xl border rounded-sm relative z-10">
                <CardContent className="px-4 pt-6 space-y-6 text-center">
                    {/* Logo */}
                    <BrandLogo 
                        href="/" 
                        size="md"
                        className="inline-flex items-center justify-center gap-2 mx-auto group transition-transform hover:scale-105"
                    />

                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground">{t("loading")}</p>
                </CardContent>
            </Card>
        </div>
    );
}
