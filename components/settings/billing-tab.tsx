"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Plan, Tournament } from "@/types";
import { getPlans } from "@/actions/common/plans";
import { getUserTournaments, createPaymentRecord } from "@/actions/common/payments";
import { getUserSubscriptionDetails } from "@/actions/common/user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createStripeCheckoutSession, createStripeCustomerPortalSession, verifyStripeCheckoutSession } from "@/actions/common/stripe";
import { Loader2, Check, ExternalLink, CreditCard } from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/ui/header";
import { Tab } from "@/components/ui/tab";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const getPlanPrice = (plan: Plan, isEn: boolean = false) => {
    if (plan.id === "starter" || plan.id === "match") return 0;
    if (isEn) {
        if (plan.id === "pro" || plan.id === "event") return 4.5;
        if (plan.id === "pro_yearly") return 89;
        if (plan.id === "cup") return 45;
        if (plan.id === "cup_yearly") return 450;
        if (plan.id === "manager_pro") return 5.99;
        return plan.price ? Math.round((plan.price / 35) * 100) / 100 : 0;
    }
    if (plan.id === "pro" || plan.id === "event") return 145;
    return (plan.discounted_price || plan.price);
};

export function BillingTab() {
    const t = useTranslations("Billing");
    const locale = useLocale();
    const isEn = locale === "en";
    const router = useRouter();

    const { toast } = useToast();
    const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);

    const [activePlan, setActivePlan] = useState<string>("free");
    const [expiryDate, setExpiryDate] = useState<string | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

    // Filter plans based on billing cycle (lifetime/customs show in both)
    const filteredPlans = plans.filter((plan) => {
        if (billingCycle === 'monthly') {
            return plan.duration === 'lifetime' || plan.duration === 'monthly';
        } else {
            return plan.duration === 'lifetime' || plan.duration === 'yearly';
        }
    });

    const [isPending, startTransition] = useTransition();
    const [loadingData, setLoadingData] = useState(true);

    const loadData = async () => {
        setLoadingData(true);
        try {
            // Load user subscription details
            const subDetails = await getUserSubscriptionDetails();
            setActivePlan(subDetails.plan);
            setExpiryDate(subDetails.expiresAt);

            // Load plans
            const plansRes = await getPlans();
            if (plansRes.success && plansRes.data) setPlans(plansRes.data);

            // Load user tournaments
            const tournamentsRes = await getUserTournaments();
            if (tournamentsRes.success && tournamentsRes.data) setTournaments(tournamentsRes.data);
        } catch (error) {
            console.error("Error loading billing data:", error);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSelectPlan = (plan: Plan) => {
        const price = getPlanPrice(plan, isEn);

        if (price === 0) {
            setSubscribingPlanId(plan.id);
            startTransition(async () => {
                try {
                    const res = await createPaymentRecord(plan.id, 0, "free");
                    if (res.success) {
                        toast({
                            title: "เปิดใช้งานสำเร็จ",
                            description: `คุณกำลังใช้งานแพ็กเกจ ${getPlanName(plan.id)}`,
                        });
                        await loadData();
                        router.refresh();
                    } else {
                        toast({
                            variant: "destructive",
                            title: "เกิดข้อผิดพลาด",
                            description: res.error || "ไม่สามารถเปิดใช้งานแพ็กเกจได้",
                        });
                    }
                } finally {
                    setSubscribingPlanId(null);
                }
            });
            return;
        }

        const isTournamentPlan = plan.name === "Single Tournament";
        const tourId = isTournamentPlan && tournaments.length > 0 ? tournaments[0].id : null;

        // Direct 1-click redirect straight to Stripe Checkout
        setSubscribingPlanId(plan.id);
        startTransition(async () => {
            try {
                const res = await createStripeCheckoutSession({
                    planId: plan.id,
                    planName: plan.name.replace(/^สมัครใช้\s*/i, '').trim(),
                    amount: price,
                    currency: isEn ? 'usd' : 'thb',
                    tournamentId: tourId,
                });

                if (res.success && res.data?.url) {
                    window.location.href = res.data.url;
                } else {
                    setSubscribingPlanId(null);
                    toast({
                        variant: "destructive",
                        title: "ไม่สามารถเปิดหน้าชำระเงินได้",
                        description: res.error || "เกิดข้อผิดพลาดในการเชื่อมต่อกับ Stripe",
                    });
                }
            } catch (err: any) {
                setSubscribingPlanId(null);
                toast({
                    variant: "destructive",
                    title: "เกิดข้อผิดพลาด",
                    description: err.message || "ไม่สามารถเปิดหน้าชำระเงินได้",
                });
            }
        });
    };

    const searchParams = useSearchParams();

    useEffect(() => {
        const sessionId = searchParams.get("session_id");
        const success = searchParams.get("success");
        if (sessionId && success === "true") {
            startTransition(async () => {
                const res = await verifyStripeCheckoutSession(sessionId);
                if (res.success) {
                    await loadData();
                    router.replace("/settings?tab=billing");
                }
            });
        }
    }, [searchParams, router]);


    // Helper to get plan displayName
    const getPlanName = (planId: string) => {
        if (planId === "match" || planId === "starter" || planId === "free") return t("plan_starter");
        if (planId === "event" || planId === "pro") return t("plan_pro") || "Event";
        if (planId === "pro_yearly" || planId === "yearly") return t("plan_pro_yearly");
        if (planId === "cup") return t("plan_cup") || "Cup";
        if (planId === "cup_yearly") return t("plan_cup_yearly") || "Cup Yearly";
        if (planId === "customs") return t("plan_customs") || "Customs";
        if (planId === "manager_pro") return t("manager_pro.title") || "Manager Pro";
        return t("plan_starter") || "Starter";
    };

    const getPlanFeatures = (planId: string): string[] => {
        try {
            const featureKey = planId === "match" ? "starter" : planId === "event" ? "pro" : planId;
            const rawFeatures = t.raw(`features.${featureKey}`);
            if (Array.isArray(rawFeatures)) return rawFeatures;
        } catch (error) {
            console.error(`Error loading features for ${planId}:`, error);
        }
        return [];
    };

    const handleOpenCustomerPortal = () => {
        startTransition(async () => {
            const res = await createStripeCustomerPortalSession();
            if (res.success && res.data?.url) {
                window.location.href = res.data.url;
            } else {
                alert(res.error || "Failed to open Stripe Billing Portal");
            }
        });
    };

    return (
        <div className="space-y-4">
            {/* 1. Current Plan & Billing Portal */}
            <div className="rounded-sm border bg-card divide-y divide-border overflow-hidden">
                <div className="p-4 space-y-4">
                    <div>
                        <Header level={4}>{t("title")}</Header>
                        <p className="text-xs text-muted-foreground font-medium">{t("description")}</p>
                    </div>

                    <div className="space-y-4 divide-y divide-border">
                        {/* Current Plan Overview Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                            <div className="flex items-start gap-4 sm:w-2/3">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <CreditCard className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Header level={6}>
                                            {locale === 'th' ? "แพ็กเกจปัจจุบันของคุณ" : "Your Current Plan"}
                                        </Header>
                                        <Badge variant="outline" className="text-[10px] text-primary border-primary/40 bg-primary/5">
                                            {t("active_prefix")}{getPlanName(activePlan)}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {expiryDate ? (
                                            <>
                                                {t("expiryDate")}: {new Date(expiryDate).toLocaleDateString(isEn ? 'en-US' : 'th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </>
                                        ) : (
                                            locale === 'th' ? "ใช้งานฟรี ไม่มีวันหมดอายุ" : "Free tier, no expiration"
                                        )}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-2/3 flex justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleOpenCustomerPortal}
                                    disabled={isPending}
                                    className="text-xs gap-1.5 hover:text-primary hover:border-primary/50"
                                >
                                    {isPending ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                        <ExternalLink className="size-3.5 text-primary" />
                                    )}
                                    <span>{locale === 'th' ? "จัดการการชำระเงินและใบเสร็จ" : "Manage Billing & Invoices"}</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Plans List */}
            <div className="space-y-2 md:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Header level={4}>{t("plansTitle")}</Header>
                    <Tab
                        options={[
                            { value: "monthly", label: t("monthly_label") || "รายเดือน" },
                            { value: "yearly", label: t("yearly_label") || "รายปี" }
                        ]}
                        value={billingCycle}
                        onChange={(val) => setBillingCycle(val)}
                        showIcons={false}
                        fullWidth={true}
                        className="w-full sm:w-auto"
                    />
                </div>

                {loadingData && plans.length === 0 ? (
                    <div className="border bg-card rounded-sm overflow-hidden divide-y md:divide-y-0 md:divide-x grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 items-stretch animate-pulse">
                        {[...Array(4)].map((_, idx) => (
                            <div key={idx} className="p-3 md:p-4 flex flex-col justify-between space-y-4">
                                <div className="space-y-3">
                                    <Skeleton className="h-6 w-1/2 rounded-sm" />
                                    <Skeleton className="h-8 w-1/3 rounded-sm" />
                                    <Skeleton className="h-3.5 w-3/4 rounded-sm" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-3 w-full rounded-sm" />
                                    <Skeleton className="h-3 w-5/6 rounded-sm" />
                                    <Skeleton className="h-3 w-4/5 rounded-sm" />
                                </div>
                                <Skeleton className="h-8 w-full rounded-sm mt-4" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="border bg-card rounded-sm overflow-hidden divide-y md:divide-y-0 md:divide-x grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 items-stretch">
                        {filteredPlans.map((plan) => {
                            const isCurrent = activePlan === plan.id || ((plan.id === 'starter' || plan.id === 'match') && activePlan === 'free') || ((plan.id === 'pro' || plan.id === 'event') && (activePlan === 'monthly' || activePlan === 'event' || activePlan === 'pro')) || (plan.id === 'pro_yearly' && activePlan === 'yearly');
                            const isCustoms = plan.id === 'customs';
                            const isPro = plan.id === 'pro' || plan.id === 'event';
                            const isProYearly = plan.id === 'pro_yearly';
                            const isManagerPro = plan.id === 'manager_pro';
                            const isCup = plan.id === 'cup';
                            const isCupYearly = plan.id === 'cup_yearly';
                            const isRecommended = isPro || isManagerPro;

                            return (
                                <div
                                    key={plan.id}
                                    className={cn(
                                        "p-3 md:p-4 flex flex-col justify-between transition-colors relative",
                                        isCurrent && "bg-primary/5",
                                        isRecommended && !isCurrent && "bg-muted/10"
                                    )}
                                >
                                    <div>
                                        <div className="flex justify-between items-start mb-1 gap-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h3 className="text-sm font-black">{getPlanName(plan.id)}</h3>
                                                {isRecommended && (
                                                    <span className="bg-primary text-primary-foreground text-[9px] font-black px-1.5 py-0.5 rounded-sm tracking-wider uppercase">
                                                        {t("recommended")}
                                                    </span>
                                                )}
                                            </div>
                                            {isCurrent && (
                                                <Badge variant="outline" className="border-primary text-primary">
                                                    {t("active_badge")}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-muted-foreground text-[10px] min-h-[28px]">
                                            {isPro
                                                ? t("proDesc")
                                                : (plan.id === "starter" || plan.id === "match")
                                                    ? t("starterDesc")
                                                    : isProYearly
                                                        ? t("proYearlyDesc")
                                                        : isCup
                                                            ? t("cupDesc")
                                                            : isCupYearly
                                                                ? t("cupYearlyDesc")
                                                                : isManagerPro
                                                                    ? t("managerProDesc")
                                                                    : t("customsDesc")
                                            }
                                        </p>

                                        <div className="flex flex-col min-h-[44px] justify-center my-2">
                                            {isPro ? (
                                                <>
                                                    <div className="flex items-baseline gap-1 flex-wrap">
                                                        <span className="text-lg font-black line-through text-muted-foreground/60">
                                                            {isEn ? "$9" : "฿290"}
                                                        </span>
                                                        <span className="text-xl font-black">
                                                            {isEn ? "$4.50" : "฿145"}
                                                        </span>
                                                        <span className="text-muted-foreground text-xs">{t("perMonth")}</span>
                                                        <Badge variant="default">
                                                            -50%
                                                        </Badge>
                                                    </div>
                                                </>
                                            ) : isProYearly ? (
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-xl font-black">
                                                        {isEn ? "$89" : "฿2,900"}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">{t("perYear")}</span>
                                                </div>
                                            ) : isManagerPro ? (
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-xl font-black">
                                                        {isEn ? "$5.99" : `฿${plan.price.toLocaleString()}`}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">{t("perMonth")}</span>
                                                </div>
                                            ) : isCustoms ? (
                                                <span className="text-base font-black py-1">{t("contactSales")}</span>
                                            ) : isCup ? (
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-xl font-black">
                                                        {isEn ? "$45" : "฿1,490"}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">{t("perMonth")}</span>
                                                </div>
                                            ) : isCupYearly ? (
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-xl font-black">
                                                        {isEn ? "$450" : "฿14,900"}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">{t("perYear")}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-xl font-black">
                                                        {isEn ? "$0" : "฿0"}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">{t("lifetime")}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-1.5 pt-3 border-t">
                                            {getPlanFeatures(plan.id).map((feature, idx) => (
                                                <div key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                                    <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                                    <span className="leading-tight text-[11px]">{feature}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-3 mt-3 border-t">
                                        {isCustoms ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full text-xs font-bold"
                                                asChild
                                            >
                                                <a href="https://www.facebook.com/profile.php?id=61583928452496" target="_blank" rel="noopener noreferrer">
                                                    {t("contactTeam")}
                                                </a>
                                            </Button>
                                        ) : (
                                            <Button
                                                variant={isCurrent ? "outline" : ((isRecommended || isProYearly || isCup || isCupYearly) ? "default" : "outline")}
                                                size="sm"
                                                className={`w-full text-xs font-bold ${isCurrent
                                                    ? "border-primary text-primary hover:bg-primary/10"
                                                    : (isRecommended || isProYearly || isCup || isCupYearly) && !isCurrent
                                                        ? "bg-primary text-primary-foreground hover:bg-primary/95"
                                                        : ""
                                                    }`}
                                                disabled={isCurrent || plan.price === 0 || isPending}
                                                onClick={() => handleSelectPlan(plan)}
                                            >
                                                {isPending && subscribingPlanId === plan.id ? (
                                                    <>
                                                        <Loader2 className="size-3.5 animate-spin mr-1 inline-block" />
                                                        <span>กำลังไปหน้าชำระเงิน...</span>
                                                    </>
                                                ) : isCurrent ? (
                                                    t("currentPlan")
                                                ) : (plan.id === "pro" || plan.id === "event") ? (
                                                    t("subscribePro") || "สมัคร Event"
                                                ) : plan.id === "pro_yearly" ? (
                                                    t("subscribeProYearly")
                                                ) : plan.id === "cup" ? (
                                                    t("subscribeCup") || "สมัคร Cup"
                                                ) : plan.id === "cup_yearly" ? (
                                                    t("subscribeCupYearly") || "สมัคร Cup รายปี"
                                                ) : plan.id === "manager_pro" ? (
                                                    t("manager_pro.title") || "Subscribe Manager Pro"
                                                ) : (
                                                    t("getStartedFree")
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

