"use client";

import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plan } from "@/types";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/routing";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/dropdown";
import { ManagerPlan, OrganizerPlan, Product } from "@/types";

export type PricingPlan = Plan & Partial<ManagerPlan> & Partial<OrganizerPlan> & Partial<Product>;

interface PricingCardsProps {
    plans: PricingPlan[];
    currentPlan?: string | null;
    activePlan?: string;
    onSelectPlan?: (planId: string) => void;
    isLoading?: boolean;
    landingPageMode?: boolean;
    tournaments?: { id: string; name: string; status: string; plan?: string | null; }[] | null;
    selectedTournamentId?: string;
    onTournamentChange?: (id: string) => void;
}

export function PricingCards({
    plans,
    currentPlan,
    activePlan,
    onSelectPlan,
    isLoading = false,
    landingPageMode = false,
    tournaments = [],
    selectedTournamentId,
    onTournamentChange
}: PricingCardsProps) {
    const t = useTranslations('Pricing');
    const tBilling = useTranslations('Billing');

    const getTranslatedValue = (key: string, value: string | undefined | null) => {
        if (!value) return "-";

        // Name Mapping
        if (key === 'name') {
            if (value === 'Starter') return t('free.title');
            if (value === 'Per Tournament') return t('tournament.title');
            if (value === 'Monthly Pro') return t('monthly.title');
            if (value === 'Yearly Pro') return t('yearly.title');
            if (value === 'Manager Pro') return t('manager_pro.title');
        }

        // Format Mapping
        if (key === 'format') {
            if (value.includes('League') && value.includes('Knockout')) return t('comparison.val_league_ko');
            if (value.includes('Group') || value === 'All') return t('comparison.val_all_group');
        }

        // Stats Mapping
        if (key === 'stats') {
            if (value === 'Basic' || value.includes('Basic')) return t('comparison.val_basic');
            if (value.includes('Pro') || value === 'Advanced') return t('comparison.val_pro_stats');
        }

        // Support Mapping
        if (key === 'support') {
            if (value === 'Standard') return t('comparison.val_standard');
            if (value.includes('Priority')) return t('comparison.val_priority');
            if (value.includes('VIP')) return t('yearly.features.support');
        }

        // Duration Mapping
        if (key === 'duration') {
            if (value === 'monthly') return t('monthly.unit').replace('/', '').trim();
            if (value === 'yearly') return t('yearly.unit').replace('/', '').trim();
            if (value === 'lifetime') return t('tournament.unit').replace('/', '').trim();
            return value;
        }

        return value;
    };

    if (!plans || plans.length === 0) {
        return <div className="text-center p-8 text-muted-foreground">{t('no_plans')}</div>;
    }

    // Sort plans by price
    const sortedPlans = [...plans].sort((a, b) => a.price - b.price);
    const isManagerPlans = plans.length > 0 && ('max_teams' in plans[0] || (plans[0] as PricingPlan).target_role === 'manager');

    return (
        <div className="overflow-x-auto border bg-background shadow-sm pt-6">
            <table className="w-full text-sm min-w-[600px] table-fixed border-separate border-spacing-0">
                <thead>
                    <tr className="bg-muted/50">
                        <th className="p-6 text-left font-semibold w-[200px] md:w-1/4 text-lg border-b">{t('features')}</th>
                        {sortedPlans.map(plan => {
                            const isRecommended = plan.recommended;
                            return (
                                <th key={plan.id} className={cn(
                                    "p-6 text-center relative border-b",
                                    isRecommended && "border-2 border-primary/20 bg-primary/5 rounded-t-lg border-b-0"
                                )}>
                                    {isRecommended && (
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 shadow-sm whitespace-nowrap z-10">
                                            {t('recommended')}
                                        </div>
                                    )}
                                    <div className="flex flex-col items-center gap-2 mb-1">
                                        <div className="text-lg font-bold">{getTranslatedValue('name', plan.name)}</div>
                                        {plan.price > 0 && (
                                            <Badge variant="default" className="bg-primary text-primary-foreground border-none">
                                                {t('pro_badge')}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="text-muted-foreground font-normal">
                                        {plan.discounted_price ? (
                                            <div className="flex flex-col items-center">
                                                <span className="line-through text-xs opacity-70">
                                                    {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(plan.price)}
                                                </span>
                                                <span className="text-primary font-bold text-xl">
                                                    {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(plan.discounted_price)}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xl font-bold">
                                                {plan.price === 0 ? t('free_label') : new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(plan.price)}
                                            </span>
                                        )}
                                        {plan.duration && plan.price > 0 && <span className="text-xs ml-1">/{getTranslatedValue('duration', plan.duration)}</span>}
                                    </div>
                                </th>
                            )
                        })}
                    </tr>
                </thead>
                <tbody>
                    {/* Teams Limit */}
                    <tr className="hover:bg-muted/50 transition-colors">
                        <td className="p-4 font-medium pl-6">{isManagerPlans ? t('manager_teams_limit') : t('teams_limit')}</td>
                        {sortedPlans.map(plan => (
                            <td key={`teams-${plan.id}`} className={cn(
                                "p-4 text-center text-muted-foreground",
                                plan.recommended && "border-x-2 border-primary/20 bg-primary/5"
                            )}>
                                {(plan.teams_limit === 0 || plan.max_teams === 0 || plan.max_teams_per_tournament === 0) ? t('unlimited') : (plan.teams_limit ?? plan.max_teams ?? plan.max_teams_per_tournament)}
                            </td>
                        ))}
                    </tr>
                    {/* Access Duration */}
                    <tr className="hover:bg-muted/50 transition-colors">
                        <td className="p-4 font-medium pl-6">{t('duration_access')}</td>
                        {sortedPlans.map(plan => {
                            const isLifetime = plan.duration === 'lifetime' || plan.name === 'Per Tournament';
                            return (
                                <td key={`duration-${plan.id}`} className={cn(
                                    "p-4 text-center text-muted-foreground",
                                    plan.recommended && "border-x-2 border-primary/20 bg-primary/5",
                                    isLifetime && "text-primary font-bold"
                                )}>
                                    {isLifetime ? t('lifetime_label') : getTranslatedValue('duration', plan.duration)}
                                </td>
                            );
                        })}
                    </tr>
                    {/* Format Support */}
                    <tr className="hover:bg-muted/50 transition-colors">
                        <td className="p-4 font-medium pl-6">{isManagerPlans ? t('manager_format_support') : t('format_support')}</td>
                        {sortedPlans.map(plan => (
                            <td key={`format-${plan.id}`} className={cn(
                                "p-4 text-center capitalize text-muted-foreground",
                                plan.recommended && "border-x-2 border-primary/20 bg-primary/5"
                            )}>
                                {getTranslatedValue('format', plan.format_support ?? plan.max_players_per_team?.toString())}
                            </td>
                        ))}
                    </tr>

                    {/* Invite teams via link */}
                    {!isManagerPlans && (
                        <tr className="hover:bg-muted/50 transition-colors">
                            <td className="p-4 font-medium pl-6">{t('invite_via_link')}</td>
                            {sortedPlans.map(plan => (
                                <td key={`invite-${plan.id}`} className={cn(
                                    "p-4 text-center",
                                    plan.recommended && "border-x-2 border-primary/20 bg-primary/5"
                                )}>
                                    {plan.invite_enabled ? (
                                        <Check className="h-6 w-5 mx-auto text-primary" aria-hidden="true" />
                                    ) : (
                                        <X className="h-6 w-5 mx-auto text-muted-foreground opacity-50" aria-hidden="true" />
                                    )}
                                </td>
                            ))}
                        </tr>
                    )}

                    {/* Open Registration */}
                    {!isManagerPlans && (
                        <tr className="hover:bg-muted/50 transition-colors">
                            <td className="p-4 font-medium pl-6">{t('open_registration')}</td>
                            {sortedPlans.map(plan => (
                                <td key={`register-${plan.id}`} className={cn(
                                    "p-4 text-center",
                                    plan.recommended && "border-x-2 border-primary/20 bg-primary/5"
                                )}>
                                    {plan.register_enabled ? (
                                        <Check className="h-6 w-5 mx-auto text-primary" aria-hidden="true" />
                                    ) : (
                                        <X className="h-6 w-5 mx-auto text-muted-foreground opacity-50" aria-hidden="true" />
                                    )}
                                </td>
                            ))}
                        </tr>
                    )}

                    {/* Statistics */}
                    {!isManagerPlans && (
                        <tr className="hover:bg-muted/50 transition-colors">
                            <td className="p-4 font-medium pl-6">{t('statistics')}</td>
                            {sortedPlans.map(plan => (
                                <td key={`stats-${plan.id}`} className={cn(
                                    "p-4 text-center text-muted-foreground capitalize",
                                    plan.recommended && "border-x-2 border-primary/20 bg-primary/5"
                                )}>
                                    {getTranslatedValue('stats', plan.stats_support)}
                                </td>
                            ))}
                        </tr>
                    )}

                    {/* Support Level */}
                    <tr className="hover:bg-muted/50 transition-colors">
                        <td className="p-4 font-medium pl-6">{t('support')}</td>
                        {sortedPlans.map(plan => (
                            <td key={`support-${plan.id}`} className={cn(
                                "p-4 text-center capitalize text-muted-foreground",
                                plan.recommended && "border-x-2 border-primary/20 bg-primary/5",
                            )}>
                                {getTranslatedValue('support', plan.support_level)}
                            </td>
                        ))}
                    </tr>

                    {/* Action Buttons Row */}
                    <tr className="">
                        <td className="p-4 pl-6 border-t"></td>
                        {sortedPlans.map(plan => {
                            const isSelected = currentPlan === plan.id;
                            const isFreePlan = plan.price === 0;
                            const isPaidPlan = plan.price > 0;
                            const isMonthlyPlan = plan.duration === 'monthly' && isPaidPlan && plan.name?.trim() !== 'Manager Pro';
                            const isYearlyPlan = plan.duration === 'yearly' && isPaidPlan;
                            const isTournamentPlan = plan.name?.trim() === 'Per Tournament' || plan.duration === 'lifetime' && isPaidPlan;
                            const isManagerProPlan = plan.name?.trim() === 'Manager Pro';

                            // Check if this specific tournament is already upgraded
                            let isThisTournamentUpgraded = false;
                            if (isTournamentPlan && selectedTournamentId) {
                                const selectedTour = tournaments?.find(t => t.id === selectedTournamentId);
                                isThisTournamentUpgraded = selectedTour?.plan === 'tournament';
                            }

                            // A plan is "Effectively Active" if:
                            // 1. It's the SPECIFIC global plan the user has
                            // 2. It's the Free plan and user is on 'free'
                            // 3. It's the Per Tournament plan and (SELECTED tournament is upgraded OR user has global pro)
                            const isGlobalPro = activePlan === 'monthly' || activePlan === 'yearly';
                            const isAnyManagerPro = activePlan === 'manager_pro' || isGlobalPro;

                            const isEffectivelyActive =
                                (activePlan === 'monthly' && isMonthlyPlan) ||
                                (activePlan === 'yearly' && isYearlyPlan) ||
                                (activePlan === 'free' && isFreePlan) ||
                                (isManagerProPlan && isAnyManagerPro) ||
                                (isTournamentPlan && (isThisTournamentUpgraded || isGlobalPro));

                            return (
                                <td key={`action-${plan.id}`} className={cn(
                                    "p-4 text-center pb-6 border-t",
                                    plan.recommended && "border-2 border-t-0 border-primary/20 bg-primary/5 rounded-b-lg"
                                )}>
                                    {landingPageMode ? (
                                        <Button variant="outline" className="w-full" asChild>
                                            {/* Link needs to be handled by parent or just redirect */}
                                            <Link href="/dashboard">{t('get_started')}</Link>
                                        </Button>
                                    ) : (
                                        <div className="space-y-4">
                                            {isTournamentPlan && (
                                                <div className="text-left space-y-1.5">
                                                    <Select
                                                        value={selectedTournamentId}
                                                        onValueChange={onTournamentChange}
                                                    >
                                                        <SelectTrigger className="w-full bg-background">
                                                            <SelectValue placeholder={tBilling('select_tournament_placeholder', { defaultValue: "Select Tournament" })} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {tournaments && tournaments.length > 0 ? (
                                                                tournaments.map((tItem) => (
                                                                    <SelectItem key={tItem.id} value={tItem.id}>
                                                                        {tItem.name}
                                                                    </SelectItem>
                                                                ))
                                                            ) : (
                                                                <SelectItem value="none" disabled>
                                                                    {tBilling('no_tournaments', { defaultValue: "No tournaments found" })}
                                                                </SelectItem>
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                            <Button
                                                variant={isEffectivelyActive ? "outline" : (isSelected ? "default" : "default")}
                                                className={cn(
                                                    "w-full",
                                                    isSelected && !isEffectivelyActive && "ring-2 ring-primary ring-offset-2"
                                                )}
                                                disabled={isEffectivelyActive || isLoading || isFreePlan || (isTournamentPlan && !selectedTournamentId)}
                                                onClick={() => onSelectPlan && onSelectPlan(plan.id)}
                                            >
                                                {isLoading && isSelected && <Loader2 className="h-4 w-4 animate-spin" />}
                                                {isEffectivelyActive ? t('current_plan') : (isSelected ? t('selected') : t('choose_plan'))}
                                            </Button>
                                        </div>
                                    )}
                                </td>
                            );
                        })}
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

