"use client";

import { OAuthButtons } from "@/features/auth/oauth-buttons";
import { SignUpForm } from "@/features/auth/sign-up-form";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { BrandLogo } from "@/components/shared/logo";
import { HeroDotBackground } from "@/components/landing/hero-dot-background";
import { Header } from "@/components/ui/header";
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
    const t = useTranslations('SignUp');

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background p-4 pt-24 md:pt-20">
            <PublicNavbar />

            {/* Interactive Canvas Dot Background */}
            <HeroDotBackground />

            {/* Ambient Fade overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-background via-background/90 to-background/50 pointer-events-none z-[1]" />

            <div className="w-full max-w-[480px] bg-card backdrop-blur-xl rounded-sm shadow-2xl relative z-10 p-4 space-y-4">
                <div className="text-center space-y-4">
                    {/* Logo */}
                    <BrandLogo 
                        href="/" 
                        size="lg"
                        className="inline-flex items-center justify-center mx-auto"
                    />

                    <div className="space-y-2">
                        <Header level={2}>{t('title')}</Header>
                        <p className="text-muted-foreground text-sm">
                            {t('subtitle')}
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <OAuthButtons />

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center uppercase">
                            <Label className="bg-card px-4">
                                {t('or')}
                            </Label>
                        </div>
                    </div>

                    <SignUpForm />

                    <div className="text-center text-sm text-muted-foreground">
                        {t('have_account')}{" "}
                        <Link
                            href="/sign-in"
                            className="font-semibold text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                        >
                            {t('sign_in')}
                        </Link>
                    </div>
                </div>

                <div>
                    <p className="text-center text-xs text-muted-foreground w-full leading-relaxed">
                        {t('agreement')}{" "}
                        <Link
                            href="/terms-of-service"
                            className="underline underline-offset-4 hover:text-primary transition-colors"
                        >
                            {t('terms')}
                        </Link>{" "}
                        {t('and')}{" "}
                        <Link
                            href="/privacy-policy"
                            className="underline underline-offset-4 hover:text-primary transition-colors"
                        >
                            {t('privacy')}
                        </Link>
                        .
                    </p>
                </div>
            </div>
        </div>
    );
}
