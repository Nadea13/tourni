"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Plan, Tournament, Payment } from "@/types";
import { getPlans } from "@/actions/common/plans";
import { getUserTournaments, createPaymentRecord, getUserPayments } from "@/actions/common/payments";
import { getUserSubscriptionDetails } from "@/actions/common/user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createStripeCheckoutSession, createStripeCustomerPortalSession, verifyStripeCheckoutSession, getStripeReceiptUrl } from "@/actions/common/stripe";
import { Loader2, Check, ExternalLink, Trophy, ReceiptText } from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/ui/header";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const getPlanPrice = (plan: Plan, isEn: boolean = false, hasPurchasedEvent: boolean = false, hasPurchasedTournament: boolean = false) => {
    if (plan.id === "starter" || plan.id === "match") return 0;
    if (isEn) {
        if (plan.id === "pro" || plan.id === "event") return hasPurchasedEvent ? 9 : 4.5;
        if (plan.id === "pro_yearly") return 89;
        if (plan.id === "cup" || plan.id === "tournament") return hasPurchasedTournament ? 17 : 8.5;
        if (plan.id === "cup_yearly" || plan.id === "tournament_yearly") return 170;
        if (plan.id === "manager_pro") return 5.99;
        return plan.price ? Math.round((plan.price / 35) * 100) / 100 : 0;
    }
    if (plan.id === "pro" || plan.id === "event") return hasPurchasedEvent ? 290 : 145;
    if (plan.id === "cup" || plan.id === "tournament") return hasPurchasedTournament ? 590 : 295;
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
        const [plans, setPlans] = useState<Plan[]>([]);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);

    // Active plans (monthly & lifetime & one-time)
    const filteredPlans = plans.filter((plan) => plan.duration === "lifetime" || plan.duration === "monthly" || plan.duration === "one-time");

    const [isPending, startTransition] = useTransition();
    const [loadingData, setLoadingData] = useState(true);

    const loadData = async () => {
        setLoadingData(true);
        try {
            // Load user subscription details
            const subDetails = await getUserSubscriptionDetails();
            setActivePlan(subDetails.plan);
            
            // Load plans
            const plansRes = await getPlans();
            if (plansRes.success && plansRes.data) setPlans(plansRes.data);

            // Load user tournaments
            const tournamentsRes = await getUserTournaments();
            if (tournamentsRes.success && tournamentsRes.data) setTournaments(tournamentsRes.data);

            // Load payments
            const paymentsRes = await getUserPayments();
            if (paymentsRes.success && paymentsRes.data) setPayments(paymentsRes.data);
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
        const price = getPlanPrice(plan, isEn, hasPurchasedEvent, hasPurchasedTournament);

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
        if (planId === "match" || planId === "starter" || planId === "free") return t("plan_starter") || "Match";
        if (planId === "event" || planId === "pro") return t("plan_pro") || "Event";
        if (planId === "pro_yearly" || planId === "yearly") return t("plan_pro_yearly");
        if (planId === "cup" || planId === "tournament") return "Tournament";
        if (planId === "cup_yearly" || planId === "tournament_yearly") return "Tournament Yearly";
        if (planId === "customs") return t("plan_customs") || "Customs";
        if (planId === "manager_pro") return t("manager_pro.title") || "Manager Pro";
        return t("plan_starter") || "Match";
    };

    const getPlanFeatures = (planId: string): string[] => {
        try {
            const featureKey = planId === "match" ? "starter" : planId === "event" ? "pro" : (planId === "tournament" || planId === "cup") ? "tournament" : (planId === "tournament_yearly" || planId === "cup_yearly") ? "tournament_yearly" : planId;
            const rawFeatures = t.raw(`features.${featureKey}`);
            if (Array.isArray(rawFeatures)) return rawFeatures;
        } catch (error) {
            console.error(`Error loading features for ${planId}:`, error);
        }
        return [];
    };

    const [loadingReceiptTxId, setLoadingReceiptTxId] = useState<string | null>(null);

    const handleViewReceipt = async (transactionId: string | null | undefined) => {
        if (!transactionId) return;
        setLoadingReceiptTxId(transactionId);
        try {
            const res = await getStripeReceiptUrl(transactionId);
            if (res.success && res.data?.url) {
                window.open(res.data.url, '_blank');
            } else {
                toast({
                    title: "ไม่พบใบเสร็จรับเงิน",
                    description: "ใบเสร็จกำลังประมวลผล หรือยังไม่มีลิงก์ใบเสร็จสำหรับรายการนี้",
                });
            }
        } catch {
            toast({
                variant: "destructive",
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถเปิดใบเสร็จรับเงินได้",
            });
        } finally {
            setLoadingReceiptTxId(null);
        }
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

    // Quota and privilege calculations
    const completedPayments = payments.filter(p => p.status === 'completed' || p.status === 'success');
    const tournamentPurchases = completedPayments.filter(p => p.plan === 'tournament' || p.plan === 'cup').length;
    const eventPurchases = completedPayments.filter(p => p.plan === 'event' || p.plan === 'pro').length;

    const hasPurchasedEvent = eventPurchases > 0;
    const hasPurchasedTournament = tournamentPurchases > 0;

    // Default credits if activePlan exists
    const totalTournamentCredits = tournamentPurchases > 0 ? tournamentPurchases * 3 : (activePlan === 'tournament' || activePlan === 'cup' ? 3 : 0);
    const totalEventCredits = eventPurchases > 0 ? eventPurchases * 1 : (activePlan === 'event' || activePlan === 'pro' ? 1 : 0);

    const createdCount = tournaments.length;

    // Deduct Tournament credits first
    const usedTournamentCredits = Math.min(createdCount, totalTournamentCredits);
    const remainingTournamentCredits = totalTournamentCredits - usedTournamentCredits;

    const remainingCreated = Math.max(0, createdCount - usedTournamentCredits);
    const usedEventCredits = Math.min(remainingCreated, totalEventCredits);
    const remainingEventCredits = totalEventCredits - usedEventCredits;

    const totalRemainingCredits = remainingTournamentCredits + remainingEventCredits;

    // Determine active packages with remaining quota
    const activePackageNames: string[] = [];
    if (remainingTournamentCredits > 0) {
        activePackageNames.push("Tournament");
    }
    if (remainingEventCredits > 0) {
        activePackageNames.push("Event");
    }
    if (activePackageNames.length === 0) {
        activePackageNames.push(getPlanName(activePlan) || "Match");
    }
    const activePackageDisplay = activePackageNames.join(", ");

    return (
        <div className="space-y-6">
            {/* 1. Header & Current Plan Overview */}
            <div className="rounded-sm border bg-card p-4 sm:p-5 space-y-4">
                <div>
                    <Header level={4}>{t("title")}</Header>
                    <p className="text-xs text-muted-foreground font-medium">{t("description")}</p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-sm bg-muted/20 border border-border/60">
                    <div className="flex items-start gap-3.5">
                        <div className="size-10 rounded-sm bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                            <Trophy className="size-5" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-sm text-foreground">
                                    {locale === 'th' ? `แพ็กเกจปัจจุบัน: ${activePackageDisplay}` : `Current Plan: ${activePackageDisplay}`}
                                </span>
                                <span className="text-xs text-muted-foreground ml-1">
                                    {locale === 'th' ? `(สร้างแล้ว ${createdCount} รายการ)` : `(Created ${createdCount})`}
                                </span>
                            </div>

                            {/* Clean Plain Text Quota Line */}
                            <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                                <span>{locale === 'th' ? "สิทธิ์คงเหลือ:" : "Remaining:"}</span>
                                {remainingTournamentCredits > 0 && (
                                    <span className="text-foreground font-semibold">
                                        Tournament {remainingTournamentCredits}/{totalTournamentCredits} รายการ
                                    </span>
                                )}
                                {remainingTournamentCredits > 0 && remainingEventCredits > 0 && <span>•</span>}
                                {remainingEventCredits > 0 && (
                                    <span className="text-foreground font-semibold">
                                        Event {remainingEventCredits}/{totalEventCredits} รายการ
                                    </span>
                                )}
                                {(remainingTournamentCredits > 0 || remainingEventCredits > 0) && <span>•</span>}
                                <span className="text-foreground font-semibold">
                                    {locale === 'th' ? `สร้างได้อีก ${totalRemainingCredits} ทัวร์นาเมนต์` : `Can create ${totalRemainingCredits} more`}
                                </span>
                            </div>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenCustomerPortal}
                        disabled={isPending}
                        className="text-xs gap-1.5 shrink-0 self-start sm:self-center hover:text-primary hover:border-primary/50"
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

            {/* Plans List */}
            <div className="space-y-2 md:space-y-4">
                <div>
                    <Header level={4}>{t("plansTitle")}</Header>
                </div>

                {loadingData && plans.length === 0 ? (
                    <div className="border bg-card rounded-sm overflow-hidden divide-y md:divide-y-0 md:divide-x grid grid-cols-1 md:grid-cols-3 items-stretch animate-pulse">
                        {[...Array(3)].map((_, idx) => (
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
                    <div className="border bg-card rounded-sm overflow-hidden divide-y md:divide-y-0 md:divide-x grid grid-cols-1 md:grid-cols-3 items-stretch">
                        {filteredPlans.map((plan) => {
                            const isCurrent = activePlan === plan.id || ((plan.id === 'starter' || plan.id === 'match') && activePlan === 'free') || ((plan.id === 'pro' || plan.id === 'event') && (activePlan === 'monthly' || activePlan === 'event' || activePlan === 'pro')) || (plan.id === 'pro_yearly' && activePlan === 'yearly');
                            const isCustoms = plan.id === 'customs';
                            const isPro = plan.id === 'pro' || plan.id === 'event';
                            const isProYearly = plan.id === 'pro_yearly';
                            const isManagerPro = plan.id === 'manager_pro';
                            const isCup = plan.id === 'cup' || plan.id === 'tournament';
                            const isCupYearly = plan.id === 'cup_yearly' || plan.id === 'tournament_yearly';
                            const isRecommended = isCup;

                            return (
                                <div
                                    key={plan.id}
                                    className={cn(
                                        "p-3 md:p-4 flex flex-col justify-between transition-colors relative",
                                        isRecommended ? "bg-muted/10" : ""
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
                                                        {!hasPurchasedEvent && (
                                                            <span className="text-lg font-black line-through text-muted-foreground/60">
                                                                {isEn ? "$9" : "฿290"}
                                                            </span>
                                                        )}
                                                        <span className="text-xl font-black">
                                                            {hasPurchasedEvent
                                                                ? (isEn ? "$9" : "฿290")
                                                                : (isEn ? "$4.50" : "฿145")
                                                            }
                                                        </span>
                                                        <span className="text-muted-foreground text-xs">{locale === "th" ? " / ครั้ง" : " / time"}</span>
                                                        {!hasPurchasedEvent && (
                                                            <Badge variant="default">
                                                                -50%
                                                            </Badge>
                                                        )}
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
                                                <div className="flex items-baseline gap-1 flex-wrap">
                                                    {!hasPurchasedTournament && (
                                                        <span className="text-lg font-black line-through text-muted-foreground/60">
                                                            {isEn ? "$17" : "฿590"}
                                                        </span>
                                                    )}
                                                    <span className="text-xl font-black">
                                                        {hasPurchasedTournament
                                                            ? (isEn ? "$17" : "฿590")
                                                            : (isEn ? "$8.50" : "฿295")
                                                        }
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">{locale === "th" ? " / ครั้ง" : " / time"}</span>
                                                    {!hasPurchasedTournament && (
                                                        <Badge variant="default">
                                                            -50%
                                                        </Badge>
                                                    )}
                                                </div>
                                            ) : isCupYearly ? (
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-xl font-black">
                                                        {isEn ? "$170" : "฿5,900"}
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

                                        <div className="space-y-1.5 pt-2 border-t">
                                            {getPlanFeatures(plan.id).map((feature: string, idx: number) => (
                                                <div key={idx} className="flex items-start gap-1.5 text-[11px]">
                                                    <Check className="size-3 text-primary shrink-0 mt-0.5" />
                                                    <span className="text-muted-foreground leading-tight">{feature}</span>
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
                                                variant={(isRecommended || isCup) ? "default" : "outline"}
                                                size="sm"
                                                className={`w-full text-xs font-bold ${
                                                    (isRecommended || isCup)
                                                        ? "bg-primary text-primary-foreground hover:bg-primary/95"
                                                        : ""
                                                }`}
                                                disabled={(plan.price === 0 && (isCurrent || activePlan !== 'free')) || isPending}
                                                onClick={() => handleSelectPlan(plan)}
                                            >
                                                {isPending && subscribingPlanId === plan.id ? (
                                                    <>
                                                        <Loader2 className="size-3.5 animate-spin mr-1 inline-block" />
                                                        <span>กำลังไปหน้าชำระเงิน...</span>
                                                    </>
                                                ) : (plan.id === "pro" || plan.id === "event") ? (
                                                    t("subscribePro") || "สมัคร Event"
                                                ) : plan.id === "pro_yearly" ? (
                                                    t("subscribeProYearly")
                                                ) : (plan.id === "cup" || plan.id === "tournament") ? (
                                                    "สมัคร Tournament"
                                                ) : (plan.id === "cup_yearly" || plan.id === "tournament_yearly") ? (
                                                    "สมัคร Tournament รายปี"
                                                ) : plan.id === "manager_pro" ? (
                                                    t("manager_pro.title") || "Subscribe Manager Pro"
                                                ) : isCurrent ? (
                                                    t("getStartedFree") || "เริ่มต้นใช้งานฟรี"
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

            {/* 3. Payment History Section */}
            <div className="rounded-sm border bg-card p-4 sm:p-5 space-y-4">
                <div>
                    <Header level={4}>{locale === 'th' ? "ประวัติการชำระเงิน" : "Payment History"}</Header>
                    <p className="text-xs text-muted-foreground font-medium">
                        {locale === 'th' ? "รายการชำระเงินและคำสั่งซื้อทั้งหมดของคุณ" : "All your payment transactions and purchase history"}
                    </p>
                </div>

                {payments.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-sm bg-muted/10">
                        {locale === 'th' ? "ยังไม่มีประวัติการชำระเงิน" : "No payment history yet"}
                    </div>
                ) : (
                    <div className="overflow-x-auto border rounded-sm">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-muted/40 border-b text-muted-foreground text-left font-semibold">
                                    <th className="py-2.5 px-3">{locale === 'th' ? "วันที่ทำรายการ" : "Date"}</th>
                                    <th className="py-2.5 px-3">{locale === 'th' ? "แพ็กเกจ" : "Plan"}</th>
                                    <th className="py-2.5 px-3">{locale === 'th' ? "ยอดเงิน" : "Amount"}</th>
                                    <th className="py-2.5 px-3">{locale === 'th' ? "ช่องทาง" : "Method"}</th>
                                    <th className="py-2.5 px-3">{locale === 'th' ? "สถานะ" : "Status"}</th>
                                    <th className="py-2.5 px-3 text-right">{locale === 'th' ? "ใบเสร็จ" : "Receipt"}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {payments.map((p) => {
                                    const isSuccess = p.status === 'completed' || p.status === 'success';
                                    const dateStr = new Date(p.created_at).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    });
                                    const planDisplayName = p.plan === 'tournament' || p.plan === 'cup' 
                                        ? 'Tournament' 
                                        : (p.plan === 'event' || p.plan === 'pro') 
                                            ? 'Event' 
                                            : p.plan;
                                    const isReceiptLoading = loadingReceiptTxId === p.provider_id;

                                    return (
                                        <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                                            <td className="py-2.5 px-3 text-muted-foreground">{dateStr}</td>
                                            <td className="py-2.5 px-3 font-bold text-foreground">{planDisplayName}</td>
                                            <td className="py-2.5 px-3 font-semibold text-foreground">฿{p.amount.toLocaleString()}</td>
                                            <td className="py-2.5 px-3 text-muted-foreground">
                                                {p.payment_method === 'stripe' ? 'Stripe (PromptPay/บัตร)' : p.payment_method}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <Badge 
                                                    variant="outline" 
                                                    className={cn(
                                                        "text-[10px] font-bold",
                                                        isSuccess 
                                                            ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" 
                                                            : "text-amber-500 border-amber-500/30 bg-amber-500/10"
                                                    )}
                                                >
                                                    {isSuccess ? (locale === 'th' ? "สำเร็จ" : "Completed") : (locale === 'th' ? "รอดำเนินการ" : "Pending")}
                                                </Badge>
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                                {p.provider_id ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleViewReceipt(p.provider_id)}
                                                        disabled={isReceiptLoading}
                                                        className="h-7 px-2 text-xs text-primary hover:text-primary gap-1"
                                                    >
                                                        {isReceiptLoading ? (
                                                            <Loader2 className="size-3 animate-spin" />
                                                        ) : (
                                                            <ReceiptText className="size-3.5" />
                                                        )}
                                                        <span>{locale === 'th' ? "ดูใบเสร็จ" : "Receipt"}</span>
                                                    </Button>
                                                ) : (
                                                    <span className="text-muted-foreground/60">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
