import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { BrandLogo } from "@/components/shared/logo";
import { HeroDotBackground } from "@/components/landing/hero-dot-background";

export default function ResetPasswordPage() {
    const t = useTranslations('ResetPassword');

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background p-4 pt-24 md:pt-20">
            <PublicNavbar />

            {/* Interactive Canvas Dot Background */}
            <HeroDotBackground />

            {/* Ambient Fade overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-background via-background/90 to-background/50 pointer-events-none z-[1]" />

            <Card className="w-full py-2 md:py-4 max-w-sm bg-card/50 backdrop-blur-md rounded-sm shadow-xl border animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
                <CardHeader className="text-center mb-1 md:mb-2 px-4">
                    {/* Logo */}
                    <BrandLogo 
                        href="/" 
                        size="md"
                        className="inline-flex items-center justify-center gap-2 mx-auto group transition-transform hover:scale-105"
                    />

                    <div className="space-y-1 md:space-y-2">
                        <CardTitle className="text-2xl font-semibold tracking-tight">
                            {t('title')}
                        </CardTitle>
                        <CardDescription>
                            {t('subtitle')}
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="space-y-1 md:space-y-2 px-4">
                    <ResetPasswordForm />
                </CardContent>
            </Card>
        </div>
    );
}
