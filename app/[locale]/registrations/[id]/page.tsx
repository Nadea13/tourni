import { notFound } from "next/navigation";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { getServerSession } from "@/lib/auth-server";
import { ApiClient } from "@/lib/api-client";
import { RegistrationForm } from "@/features/registrations/registration-form";
import { getMyTeams } from "@/actions/manager/team";
import { Team } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicNavbar } from "@/components/layout/public-navbar";
import {
    Calendar,
    DollarSign,
    MapPin,
    Users,
    Clock,
    ArrowUpRight,
    ArrowLeft
} from "lucide-react";
import { formatDate, isPastDocumentDeadline } from "@/lib/date";
import { Header } from "@/components/ui/header";
import { cn } from "@/lib/utils";
import { getLandingSportIcon } from "@/components/shared/sport-icons";

import {
    DocumentSubmissionClient,
    TournamentDetails,
    UserRegisteredTeam
} from "@/features/registrations/document-submission-client";
import { RegistrationTabSwitcher } from "@/features/registrations/registration-tab-switcher";

interface RegisterPageProps {
    params: Promise<{ id: string; locale: string }>;
    searchParams?: Promise<{ category?: string | string[]; tab?: string; team?: string }>;
}

export default async function RegisterPage({ params, searchParams }: RegisterPageProps) {
    const { id, locale } = await params;
    const resolvedSearchParams = await searchParams;
    const categoryParam = resolvedSearchParams?.category;
    const activeTab = resolvedSearchParams?.tab === "documents" ? "documents" : "registration";
    const initialTeamId = resolvedSearchParams?.team;
    const tournamentCategoryId = typeof categoryParam === "string" ? categoryParam : undefined;
    const t = await getTranslations({ locale, namespace: "Registration" });
    const session = await getServerSession();
    const user = session?.user || null;

    // 1. Fetch tournament details & categories via Go API
    let tournament: any = null;
    let categories: any[] = [];
    try {
        const resp = await ApiClient.fetch<{ tournament: any; categories: any[] }>(`/tournaments/${id}`);
        tournament = resp?.tournament;
        categories = resp?.categories || [];
    } catch {
        notFound();
    }

    if (!tournament) {
        notFound();
    }

    const settings = typeof tournament.settings === 'object' && tournament.settings !== null ? tournament.settings : {};
    const isRegistrationOpen = Boolean(tournament.is_registration_open ?? settings.is_registration_open);

    const activeCategory = tournamentCategoryId
        ? categories?.find((c: any) => String(c.id) === tournamentCategoryId)
        : categories?.[0];

    const resolvedCategoryId = activeCategory?.id;
    const registrationFee = activeCategory?.registration_fee ?? 0;

    const getCategoryDisplayName = (cat: any) => {
        if (!cat) return t("default_category");
        const ageName = cat.age_categories?.category_name || cat.category_name || t("general");
        const gender = cat.gender_type === 'open' ? t("gender_open")
            : cat.gender_type === 'male' ? t("gender_male")
                : cat.gender_type === 'female' ? t("gender_female")
                    : t("gender_mixed");
        return `${ageName} (${gender})`;
    };

    const categoryName = getCategoryDisplayName(activeCategory);

    // 3. Fetch registered teams
    // 3. Fetch registered teams (for all categories to ensure document submission tab shows all user registered teams)
    let allTournamentTeams: any[] = [];
    if (categories && categories.length > 0) {
        try {
            const teamFetches = categories.map(async (cat: any) => {
                try {
                    const raw = await ApiClient.fetch<any[]>(`/tournaments/${id}/teams?category_id=${cat.id}`);
                    return (raw || []).map((tt: any) => ({
                        ...tt,
                        tournament_category: cat
                    }));
                } catch {
                    return [];
                }
            });
            const results = await Promise.all(teamFetches);
            allTournamentTeams = results.flat();
        } catch {
            allTournamentTeams = [];
        }
    } else if (resolvedCategoryId) {
        try {
            const raw = await ApiClient.fetch<any[]>(`/tournaments/${id}/teams?category_id=${resolvedCategoryId}`);
            allTournamentTeams = (raw || []).map((tt: any) => ({
                ...tt,
                tournament_category: activeCategory
            }));
        } catch {
            allTournamentTeams = [];
        }
    }

    const registeredTeams = allTournamentTeams
        .filter((tt: any) => {
            const catId = tt.tournament_category?.id || tt.category_id || tt.tournament_category_id;
            return !resolvedCategoryId || String(catId) === String(resolvedCategoryId);
        })
        .filter((tt: any) => tt.registration_status !== "rejected")
        .map((tt: any) => ({
            id: tt.id,
            registration_status: tt.registration_status,
            payment_status: tt.payment_status,
            contact_name: tt.contact_name,
            contact_phone: tt.contact_phone,
            team: tt.team ? {
                id: tt.team.id,
                name: tt.team.name,
                logo_img: tt.team.logo_img || tt.team.logo_url
            } : {
                id: tt.team_id,
                name: tt.team_name || "Team",
                logo_img: tt.logo_url || null
            }
        }));

    const teamsResult = await getMyTeams();
    const myTeams = (teamsResult.success ? (teamsResult.data as Team[]) : []) || [];
    const myTeamIds = myTeams.map((t) => t.id);

    // Fetch user's registered teams in this tournament for document submission
    const userRegisteredTeams: UserRegisteredTeam[] = (allTournamentTeams || [])
        .filter((tt: any) => {
            const teamId = tt.team?.id || tt.team_id;
            return teamId && myTeamIds.includes(teamId);
        })
        .map((item: any) => {
            const cat = item.tournament_category || categories.find((c: any) => String(c.id) === String(item.category_id || item.tournament_category_id)) || activeCategory;
            const ageCategoriesData = (Array.isArray(cat?.age_categories) ? cat.age_categories[0] : cat?.age_categories) as unknown as { category_name: string | null } | null;
            return {
                id: item.id,
                contact_name: item.contact_name || "",
                contact_phone: item.contact_phone || "",
                team: item.team ? {
                    id: item.team.id,
                    name: item.team.name,
                    logo_img: item.team.logo_img || item.team.logo_url || null
                } : {
                    id: item.team_id,
                    name: item.team_name || "Team",
                    logo_img: item.logo_url || null
                },
                tournament_categories: cat ? {
                    id: cat.id,
                    gender_type: cat.gender_type,
                    age_categories: {
                        category_name: ageCategoriesData?.category_name || cat.category_name || "General"
                    }
                } : null
            };
        });



    const sportName = tournament.sport_name || settings.sport_name || "Sport";
    const coverImg = tournament.banner_url || tournament.cover_img || settings.cover_img || settings.banner_url || null;
    const logoImg = tournament.logo_url || tournament.logo_img || settings.logo_img || settings.logo_url || null;
    const locationName = tournament.location_name || tournament.location || settings.location_name || settings.location || null;
    const googleMapUrl = tournament.google_map_url || settings.google_map_url || null;

    const tournamentDetails: TournamentDetails = {
        id: tournament.id,
        name: tournament.name,
        description: tournament.description,
        status: tournament.status || "draft",
        start_date: tournament.start_date,
        end_date: tournament.end_date,
        document_deadline: tournament.document_deadline || settings.document_deadline,
        location_name: locationName,
        cover_img: coverImg,
        logo_img: logoImg,
        sport_name: sportName,
        is_registration_open: isRegistrationOpen
    };

    const categoryMaxTeams = Number(activeCategory?.max_teams || activeCategory?.team_limit || 0) > 0
        ? Number(activeCategory?.max_teams || activeCategory?.team_limit)
        : (Number(tournament.max_teams || settings.max_teams || 0) > 0 ? Number(tournament.max_teams || settings.max_teams) : 8);

    const isFull = (registeredTeams?.length || 0) >= categoryMaxTeams;
    const isPastDeadline = isPastDocumentDeadline(tournament.document_deadline);
    const isRegistrationDisabled = isFull || isPastDeadline || !isRegistrationOpen;

    // Check if tournament has meaningful text description (strips HTML tags and entities left by rich text editor)
    const strippedDescription = (tournament.description || "")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();
    const hasDescription = strippedDescription.length > 0;

    return (
        <div className="relative flex flex-col min-h-screen bg-background">
            {/* Full-page Background Cover with Light Tint & Blur */}
            {coverImg && (
                <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                    <Image
                        src={coverImg}
                        alt={tournament.name}
                        fill
                        priority
                        className="object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-background/50 dark:bg-background/65 backdrop-blur-[2px]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30" />
                </div>
            )}

            {/* Navbar */}
            <PublicNavbar user={user} />

            <main className="relative z-10 flex-1 pt-16 md:pt-20 container mx-auto p-2 md:p-0 md:py-4 max-w-7xl">
                {activeTab === "documents" ? (
                    <div className="space-y-2 md:space-y-4">
                        {/* Header & Tab Switcher */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 md:gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    asChild
                                    className="h-8 w-8 shrink-0 hover:bg-primary/10 hover:text-primary transition-all"
                                >
                                    <Link href="/registrations">
                                        <ArrowLeft className="h-4 w-4" />
                                    </Link>
                                </Button>
                                <div className="flex md:items-start lg:items-center gap-1 md:gap-2" id="tour-registration-header">
                                    <Header level={2}>
                                        <span className="md:hidden">
                                            {tournament.name && tournament.name.length > 16
                                                ? `${tournament.name.substring(0, 16)}...`
                                                : tournament.name}
                                        </span>
                                        <span className="hidden md:inline">
                                            {tournament.name}
                                        </span>
                                    </Header>
                                    <div className={cn(
                                        "h-9 w-9 rounded-full flex items-center justify-center shrink-0 shadow-xs border backdrop-blur-xs transition-colors",
                                        coverImg
                                            ? "bg-card/50 border-border/60 text-foreground"
                                            : "bg-muted/50 text-foreground border-border/60"
                                    )}>
                                        {getLandingSportIcon(sportName, "h-4 w-4")}
                                    </div>
                                </div>
                            </div>
                            <RegistrationTabSwitcher
                                tournamentId={tournament.id}
                                activeTab={activeTab as "registration" | "documents"}
                                tournamentCategoryId={tournamentCategoryId}
                                initialTeamId={initialTeamId}
                                documentCount={userRegisteredTeams.length}
                                basePath="/registrations"
                            />
                        </div>

                        <DocumentSubmissionClient
                            tournament={tournamentDetails}
                            registeredTeams={userRegisteredTeams}
                            locale={locale}
                            initialTeamId={initialTeamId}
                            hideHeader={true}
                        />
                    </div>
                ) : (
                    <div className="space-y-2 md:space-y-4">
                        {/* Title & Badges */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 md:gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    asChild
                                    className="h-8 w-8 shrink-0 hover:bg-primary/10 hover:text-primary transition-all"
                                >
                                    <Link href="/registrations">
                                        <ArrowLeft className="h-4 w-4" />
                                    </Link>
                                </Button>
                                <div className="flex md:items-start lg:items-center gap-1 md:gap-2" id="tour-registration-header">
                                    <Header level={2}>
                                        <span className="md:hidden">
                                            {tournament.name && tournament.name.length > 16
                                                ? `${tournament.name.substring(0, 16)}...`
                                                : tournament.name}
                                        </span>
                                        <span className="hidden md:inline">
                                            {tournament.name}
                                        </span>
                                    </Header>
                                    <div className={cn(
                                        "h-9 w-9 rounded-full flex items-center justify-center shrink-0 shadow-xs border backdrop-blur-xs transition-colors",
                                        coverImg
                                            ? "bg-card/50 border-border/60 text-foreground"
                                            : "bg-muted/50 text-foreground border-border/60"
                                    )}>
                                        {getLandingSportIcon(sportName, "h-4 w-4")}
                                    </div>
                                </div>
                            </div>
                            <RegistrationTabSwitcher
                                tournamentId={tournament.id}
                                activeTab={activeTab as "registration" | "documents"}
                                tournamentCategoryId={tournamentCategoryId}
                                initialTeamId={initialTeamId}
                                documentCount={userRegisteredTeams.length}
                                basePath="/registrations"
                            />
                        </div>

                        {/* Grid Layout: 5 Columns on Desktop */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 md:gap-4">
                            {/* Left side (3 Columns): Tournament Info, Registered Teams, details */}
                            <div className="lg:col-span-3 space-y-2 md:space-y-4 order-1">
                                {/* 3. รายละเอียดการแข่งขัน (Tournament Details / Description & Cover) */}
                                {(coverImg || hasDescription) && (
                                    <Card 
                                        className={cn(
                                            "border rounded-sm overflow-hidden",
                                            coverImg ? "bg-card/50 backdrop-blur-xl border-border/60 shadow-lg" : "bg-card"
                                        )}
                                        id="tour-registration-details"
                                    >
                                        {coverImg && (
                                            <div className="relative w-full aspect-[2/1] overflow-hidden">
                                                <Image
                                                    src={coverImg}
                                                    alt={tournament.name}
                                                    fill
                                                    priority
                                                    className="object-cover object-center"
                                                />
                                            </div>
                                        )}
                                        {hasDescription && (
                                            <>
                                                <CardHeader className={cn("flex flex-row items-center space-y-0", coverImg ? "pt-2 md:pt-4" : "pt-4")}>
                                                    <CardTitle>{t("details")}</CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-2 md:space-y-4 px-2 lg:px-4">
                                                    <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
                                                        <div
                                                            className="text-foreground/95 whitespace-pre-line break-words [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_p]:mb-2 [&_a]:text-primary [&_a]:underline [&_h1]:text-2xl [&_h1]:font-black [&_h1]:my-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:my-2 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:my-2"
                                                            dangerouslySetInnerHTML={{ __html: tournament.description || "" }}
                                                        />
                                                    </div>
                                                </CardContent>
                                            </>
                                        )}
                                    </Card>
                                )}

                                {/* 1. ข้อมูลการแข่งขัน (Tournament Information) */}
                                <Card 
                                    className={cn(
                                        "border rounded-sm overflow-hidden py-0",
                                        coverImg ? "bg-card/50 backdrop-blur-xl border-border/60 shadow-lg" : "bg-card"
                                    )}
                                    id="tour-registration-info"
                                >
                                    <CardContent className="p-0">
                                        <div className="grid text-sm divide-y divide-border">
                                            <div className="flex items-center gap-3 px-3 md:px-4 py-2.5">
                                                <div className="h-9 w-9 rounded-full bg-muted/50 border border-border/60 backdrop-blur-xs shadow-xs text-muted-foreground flex items-center justify-center shrink-0">
                                                    <Calendar className="h-4 w-4" />
                                                </div>
                                                <div className="space-y-0.5 min-w-0">
                                                    <p className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">{t("dates")}</p>
                                                    <p className="text-sm font-medium text-foreground">
                                                        {tournament.start_date ? formatDate(tournament.start_date, "d MMMM yyyy", locale) : "-"} - {tournament.end_date ? formatDate(tournament.end_date, "d MMMM yyyy", locale) : "-"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 px-3 md:px-4 py-2.5">
                                                <div className="h-9 w-9 rounded-full bg-muted/50 border border-border/60 backdrop-blur-xs shadow-xs text-muted-foreground flex items-center justify-center shrink-0">
                                                    <MapPin className="h-4 w-4" />
                                                </div>
                                                <div className="space-y-0.5 min-w-0">
                                                    <p className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">{t("location")}</p>
                                                    <p className="text-sm font-medium text-foreground">{locationName || t("no_location")}</p>
                                                    {googleMapUrl && (
                                                        <a
                                                            href={googleMapUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline group"
                                                        >
                                                            {t("view_map")}
                                                            <ArrowUpRight className="h-4 w-4" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 px-3 md:px-4 py-2.5">
                                                <div className="h-9 w-9 rounded-full bg-muted/50 border border-border/60 backdrop-blur-xs shadow-xs text-muted-foreground flex items-center justify-center shrink-0">
                                                    <DollarSign className="h-4 w-4" />
                                                </div>
                                                <div className="space-y-0.5 min-w-0">
                                                    <p className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">{t("registration_fee")}</p>
                                                    <p className="text-sm font-black text-primary">
                                                        {Number(registrationFee || 0) === 0 ? t("free") : `${Number(registrationFee).toLocaleString()} ${locale === "th" ? "บาท" : "THB"}`}
                                                    </p>
                                                </div>
                                            </div>
                                            {tournament.document_deadline && (
                                                <div className="flex items-center gap-3 px-3 md:px-4 py-2.5">
                                                    <div className="h-9 w-9 rounded-full bg-muted/50 border border-border/60 backdrop-blur-xs shadow-xs text-muted-foreground flex items-center justify-center shrink-0">
                                                        <Clock className="h-4 w-4" />
                                                    </div>
                                                    <div className="space-y-0.5 min-w-0">
                                                        <p className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">{t("deadline")}</p>
                                                        <p className="text-sm font-medium text-foreground">
                                                            {formatDate(tournament.document_deadline, "d MMMM yyyy", locale)}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* 2. รายชื่อทีม (Team List) */}
                                <Card 
                                    className={cn(
                                        "border rounded-sm overflow-hidden py-0 space-y-0",
                                        coverImg ? "bg-card/50 backdrop-blur-xl border-border/60 shadow-lg" : "bg-card"
                                    )}
                                    id="tour-registration-teams"
                                >
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border py-3 px-3 md:px-4">
                                        <CardTitle>
                                            {t("registered_list", { category: categoryName })}
                                        </CardTitle>
                                        <div className="text-xs text-muted-foreground font-medium">
                                            {t("teams_count", { current: registeredTeams?.length || 0, max: categoryMaxTeams })}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="px-0 py-0">
                                        <div>
                                            {registeredTeams && registeredTeams.length > 0 ? (
                                                <div className="divide-y divide-border max-h-[300px] overflow-y-auto custom-scrollbar">
                                                    {registeredTeams.map((reg) => {
                                                        const teamObj = (Array.isArray(reg.team) ? reg.team[0] : reg.team) as unknown as { id: string; name: string; logo_img: string | null } | null;
                                                        return (
                                                            <div
                                                                key={reg.id}
                                                                className={cn(
                                                                    "flex items-center justify-between px-3 md:px-4 py-2.5 transition-colors",
                                                                    coverImg
                                                                        ? "hover:bg-card/80"
                                                                        : "hover:bg-muted/20"
                                                                )}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-8 w-8 rounded-full flex items-center justify-center overflow-hidden border shrink-0">
                                                                        {teamObj?.logo_img ? (
                                                                            <Image
                                                                                src={teamObj.logo_img}
                                                                                alt={teamObj.name}
                                                                                width={36}
                                                                                height={36}
                                                                                className="h-full w-full object-cover"
                                                                            />
                                                                        ) : (
                                                                            <Users className="h-4 w-4 text-muted-foreground/65" />
                                                                        )}
                                                                    </div>
                                                                    <span className="font-bold text-sm text-foreground truncate max-w-[180px]">
                                                                        {teamObj?.name || "Unknown Team"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <EmptyState
                                                    icon={Users}
                                                    description={t("no_teams_registered_category")}
                                                    className="min-h-[160px]"
                                                />
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right side (2 Columns): Tournament Registration Form */}
                            <div className="lg:col-span-2 order-2 lg:sticky lg:top-18 self-start h-fit space-y-4">
                                <RegistrationForm
                                    tournament={{
                                        id: tournament.id,
                                        name: tournament.name,
                                        registration_fee: Number(registrationFee || 0),
                                        bank_account_number: tournament.bank_account_number || settings.bank_account_number || "",
                                        bank_name: tournament.bank_name || settings.bank_name || "",
                                        bank_account_name: tournament.bank_account_name || settings.bank_account_name || "",
                                        is_registration_open: isRegistrationOpen,
                                        status: tournament.status || "draft"
                                    }}
                                    tournamentCategoryId={resolvedCategoryId ? String(resolvedCategoryId) : undefined}
                                    initialTeams={myTeams}
                                    categories={categories || []}
                                    isFull={isFull}
                                    isPastDeadline={isPastDeadline}
                                    isRegistrationDisabled={isRegistrationDisabled}
                                    className={coverImg ? "bg-card/50 backdrop-blur-xl border-border/60 shadow-lg" : "bg-card"}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </main>
            <PublicFooter />
        </div>
    );
}
