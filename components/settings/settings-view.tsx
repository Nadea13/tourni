"use client";

import { useTranslations, useLocale } from "next-intl";
import { Profile } from "@/types";
import { Link } from "@/i18n/routing";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DeleteAccountButton } from "./delete-account-button";
import { ChevronRight, CreditCard, Scale, AlertTriangle, UserCog, KeyRound, SunMoon, Languages, FileText } from "lucide-react";
import { ProfileForm } from "./profile-form";
import { SecurityForm } from "./security-form";
import { ConnectedAccounts } from "./connected-accounts";
import { BillingTab } from "./billing-tab";
import { SettingsTourButton } from "./settings-tour-button";
import { Header } from "../ui/header";
import { Button } from "../ui/button";
import { useRouter } from "@/i18n/routing";
import { TabOption } from "../ui/tab";
import { cn } from "@/lib/utils";

export interface SettingsUser {
    id: string;
    email?: string;
    user_metadata?: {
        full_name?: string;
        avatar_url?: string;
    };
}

interface SettingsViewProps {
    user: SettingsUser;
    profile?: Profile;
    activeTab?: string;
    onProfileUpdated?: () => void;
}

type SettingsTabValue = "general" | "security" | "legal" | "billing" | "danger";

export function SettingsView({ user, profile, activeTab = "general", onProfileUpdated }: SettingsViewProps) {
    const t = useTranslations("DashboardSettings");
    const tCommon = useTranslations("Common");
    const tLegal = useTranslations("Legal");
    const locale = useLocale();
    const isThai = locale === "th";
    const router = useRouter();

    const currentTab: SettingsTabValue = (activeTab === 'profile' || activeTab === 'preferences' || activeTab === 'general')
        ? 'general'
        : (activeTab as SettingsTabValue);

    const isGeneralTab = currentTab === 'general';

    const tabOptions: TabOption<SettingsTabValue>[] = [
        { value: "general", label: t("general") || "General", icon: UserCog },
        { value: "security", label: t("security") || "Security", icon: KeyRound },
        { value: "legal", label: t("legal"), icon: Scale },
        { value: "billing", label: t("billing"), icon: CreditCard },
        { value: "danger", label: t("danger_zone"), icon: AlertTriangle },
    ];

    const handleTabChange = (val: SettingsTabValue) => {
        router.push(`/settings?tab=${val}`);
    };

    return (
        <div className="flex flex-col gap-3 md:gap-4 w-full">
            <div className="flex items-center justify-between" id="tour-settings-header">
                <div>
                    <Header level={2} className="text-2xl md:text-3xl font-black tracking-tight">
                        {t("title")}
                    </Header>
                </div>
                <SettingsTourButton />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Left Column: Settings Navigation Menu */}
                <aside className="lg:col-span-4 xl:col-span-3 sticky top-0 z-20 lg:top-4 self-start" id="tour-settings-tabs">
                    <div className="rounded-sm border bg-card p-2.5 sm:p-4 space-y-1 shadow-xs">
                        <div className="pb-4 hidden lg:block">
                            <Header level={6}>
                                {isThai ? "เมนูการตั้งค่า" : "Settings Menu"}
                            </Header>
                        </div>
                        <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-0 pb-1 lg:pb-0 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {tabOptions.map((opt) => {
                                const Icon = opt.icon;
                                const isActive = currentTab === opt.value;
                                const isDanger = opt.value === 'danger';

                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handleTabChange(opt.value)}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-sm text-xs md:text-sm font-medium transition-colors text-left shrink-0 lg:shrink lg:w-full group",
                                            isActive
                                                ? isDanger
                                                    ? "bg-destructive/10 text-destructive font-semibold"
                                                    : "bg-primary/10 text-primary font-semibold"
                                                : isDanger
                                                ? "text-destructive/80 hover:text-destructive"
                                                : "text-muted-foreground hover:text-primary"
                                        )}
                                    >
                                        {Icon && (
                                            <Icon className={cn(
                                                "size-4 shrink-0 transition-colors",
                                                isActive
                                                    ? isDanger ? "text-destructive" : "text-primary"
                                                    : isDanger ? "text-destructive/80 group-hover:text-destructive" : "text-muted-foreground group-hover:text-primary"
                                            )} />
                                        )}
                                        <span className="flex-1 whitespace-nowrap lg:whitespace-normal">{opt.label}</span>
                                        <ChevronRight className={cn(
                                            "size-4 hidden lg:block transition-transform",
                                            isActive
                                                ? isDanger ? "text-destructive opacity-100 translate-x-0.5" : "text-primary opacity-100 translate-x-0.5"
                                                : "opacity-0"
                                        )} />
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </aside>

                {/* Right Column: Active Tab Content */}
                <div id="tour-settings-content" className="lg:col-span-8 xl:col-span-9 min-w-0">
                    {/* Tab 1: General (Single Unified Card for Profile, Preferences, and Connected Accounts) */}
                    {isGeneralTab && (
                        <div className="rounded-sm border bg-card divide-y divide-border overflow-hidden">
                            {/* 1. Profile Information */}
                            <ProfileForm user={user} profile={profile} onSuccess={onProfileUpdated} />

                            {/* 2. Theme & Language Preferences */}
                            <div className="p-4 space-y-4">
                                <div>
                                    <Header level={4}>
                                        {isThai ? "การตั้งค่าระบบและการแสดงผล" : "Preferences & Display"}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "ปรับแต่งธีมการแสดงผลและภาษาสำหรับการใช้งานระบบ" : "Customize interface theme and preferred language."}
                                    </p>
                                </div>

                                <div>
                                    {/* Theme */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                                        <div className="flex items-start gap-4 sm:w-2/3">
                                            <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                                <SunMoon className="size-4 text-muted-foreground" />
                                            </div>
                                            <div className="space-y-1">
                                                <Header level={6}>
                                                    {tCommon("theme")}
                                                </Header>
                                                <p className="text-xs text-muted-foreground">
                                                    {t("theme_desc")}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="sm:w-2/3 flex justify-end">
                                            <ThemeToggle variant="ghost" size="sm" />
                                        </div>
                                    </div>

                                    {/* Language */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                                        <div className="flex items-start gap-4 sm:w-2/3">
                                            <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                                <Languages className="size-4 text-muted-foreground" />
                                            </div>
                                            <div className="space-y-1">
                                                <Header level={6}>
                                                    {tCommon("language")}
                                                </Header>
                                                <p className="text-xs text-muted-foreground">
                                                    {t("language_desc")}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="sm:w-2/3 flex justify-end">
                                            <LanguageToggle variant="ghost" size="sm" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Connected Accounts */}
                            <ConnectedAccounts email={user?.email} />
                        </div>
                    )}

                    {/* Tab 2: Security / Password */}
                    {currentTab === 'security' && (
                        <div className="rounded-sm border bg-card divide-y divide-border overflow-hidden">
                            <SecurityForm />
                        </div>
                    )}

                    {/* Tab 3: Legal */}
                    {currentTab === 'legal' && (
                        <div className="rounded-sm border bg-card divide-y divide-border overflow-hidden">
                            <div className="p-4 space-y-4">
                                <div>
                                    <Header level={4}>
                                        {tLegal("title") || (isThai ? "ข้อกำหนดและนโยบาย" : "Legal & Compliance")}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai 
                                            ? "ข้อกำหนดการให้บริการ นโยบายความเป็นส่วนตัว และเอกสารทางกฎหมายของระบบ" 
                                            : "Terms of service, privacy policy, and legal documentation."}
                                    </p>
                                </div>

                                <div>
                                    {/* Privacy Policy */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                                        <div className="flex items-start gap-4 sm:w-2/3">
                                            <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                                <FileText className="size-4 text-muted-foreground" />
                                            </div>
                                            <div className="space-y-1">
                                                <Header level={6}>
                                                    {tLegal("privacy_policy") || tLegal("privacy") || (isThai ? "นโยบายความเป็นส่วนตัว" : "Privacy Policy")}
                                                </Header>
                                                <p className="text-xs text-muted-foreground">
                                                    {tLegal("privacy_description") || (isThai ? "ข้อตกลงและนโยบายในการคุ้มครองข้อมูลส่วนบุคคลของคุณ" : "Our commitment to protecting your personal data and privacy.")}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="sm:w-2/3 flex justify-end">
                                            <Button asChild variant="outline" size="sm" className="text-xs gap-1.5 hover:text-primary hover:border-primary/50">
                                                <Link href="/privacy-policy">
                                                    <span>{isThai ? "อ่านนโยบาย" : "Read Policy"}</span>
                                                    <ChevronRight className="size-4" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Terms of Service */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                                        <div className="flex items-start gap-4 sm:w-2/3">
                                            <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                                <Scale className="size-4 text-muted-foreground" />
                                            </div>
                                            <div className="space-y-1">
                                                <Header level={6}>
                                                    {tLegal("terms_of_service") || tLegal("terms") || (isThai ? "ข้อกำหนดการให้บริการ" : "Terms of Service")}
                                                </Header>
                                                <p className="text-xs text-muted-foreground">
                                                    {tLegal("terms_description") || (isThai ? "ข้อกำหนด เงื่อนไข และระเบียบปฏิบัติในการใช้งานแพลตฟอร์ม" : "Terms, conditions, and rules for using the Tourni platform.")}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="sm:w-2/3 flex justify-end">
                                            <Button asChild variant="outline" size="sm" className="text-xs gap-1.5 hover:text-primary hover:border-primary/50">
                                                <Link href="/terms-of-service">
                                                    <span>{isThai ? "อ่านข้อกำหนด" : "Read Terms"}</span>
                                                    <ChevronRight className="size-4" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 4: Billing */}
                    {currentTab === 'billing' && (
                        <BillingTab />
                    )}

                    {/* Tab 5: Danger Zone */}
                    {currentTab === 'danger' && (
                        <div className="rounded-sm border border-destructive/30 bg-card divide-y divide-border overflow-hidden">
                            <div className="p-4 space-y-4">
                                <div>
                                    <Header level={4} className="text-destructive">
                                        {t("danger_zone") || (isThai ? "พื้นที่อันตราย" : "Danger Zone")}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai 
                                            ? "การดำเนินการในส่วนนี้ไม่สามารถย้อนกลับได้ โปรดใช้ความระมัดระวัง" 
                                            : "Actions here are permanent and cannot be undone. Please proceed with caution."}
                                    </p>
                                </div>

                                <div className="space-y-4 divide-y divide-border">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                                        <div className="flex items-start gap-4 sm:w-2/3">
                                            <div className="size-9 rounded-sm bg-destructive/10 flex items-center justify-center shrink-0">
                                                <AlertTriangle className="size-4 text-destructive" />
                                            </div>
                                            <div className="space-y-1">
                                                <Header level={6}>
                                                    {t("delete_account_title") || t("delete_account")}
                                                </Header>
                                                <p className="text-xs text-muted-foreground">
                                                    {t("delete_account_description") || t("delete_account_desc")}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="sm:w-2/3 flex justify-end">
                                            <DeleteAccountButton email={user?.email || ""} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
