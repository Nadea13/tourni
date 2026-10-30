"use client";

import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BrandLogo } from "@/components/shared/logo";

export function AuthNavbar() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <BrandLogo 
                    href="/" 
                    size="md"
                    className="group transition-transform"
                    iconClassName="drop-shadow-[0_0_8px_rgba(0,196,154,0.3)]"
                />
                <div className="flex items-center gap-2">
                    <LanguageToggle />
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
