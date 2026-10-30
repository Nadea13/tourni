'use client';

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Team, TournamentTeam } from "@/types/index";
import { resolveStorageUrl } from "@/lib/storage-utils";
import { Header } from "@/components/ui/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { Phone, Mail, User, Info, ExternalLink, Tag, Trophy } from "lucide-react";
import { getSportIcon } from "@/components/shared/sport-icons";
import Link from "next/link";
import { Tournament } from "@/types/index";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useImageColor } from "@/hooks/use-image-color";

interface TeamInfoCardProps {
    team: (Team | TournamentTeam) & {
        isParticipation?: boolean;
        sport_name?: string | null;
        contact_tel?: string | null;
        short_name?: string | null;
        tournament_id?: string | null;
        tournament_name?: string | null;
        tournament_category_id?: string | null;
        category_name?: string | null;
        category?: { id?: string; name?: string } | null;
        tournament?: Tournament | null;
    };
    className?: string;
    isTeamRequest?: boolean;
}

export function TeamInfoCard({ team, className, isTeamRequest }: TeamInfoCardProps) {
    const tSports = useTranslations("Sports");
    const logoUrl = resolveStorageUrl((team as { logo_img?: string }).logo_img || team.logo_url);
    const dominantColor = useImageColor(logoUrl);
    const sportKey = team.sport || team.sport_name;
    const sportDisplay = team.sport ? (tSports.has(team.sport.toLowerCase() as any) ? tSports(team.sport.toLowerCase() as any) : (tSports.has(team.sport as any) ? tSports(team.sport as any) : team.sport)) : (team.sport_name || "");
    const phone = team.contact_phone || (team as any).contact_tel || "";

    const initialTournamentName =
        team.tournament?.name ||
        (team.tournament as any)?.tournament?.name ||
        team.tournament_name ||
        (team as any).tournament_title ||
        (team as any).tournaments?.name ||
        (typeof (team as any).tournament === 'string' ? (team as any).tournament : "");

    const initialCategoryName =
        team.category?.name ||
        team.category_name ||
        (team as any).tournament_category?.name ||
        (team as any).category_title ||
        (typeof (team as any).category === 'string' ? (team as any).category : "");

    const [tournamentName, setTournamentName] = useState<string>(initialTournamentName);
    const [categoryName, setCategoryName] = useState<string>(initialCategoryName);

    useEffect(() => {
        if (initialTournamentName) {
            setTournamentName(initialTournamentName);
        }
        if (initialCategoryName) {
            setCategoryName(initialCategoryName);
        }

        const tourId = team.tournament_id || (team as any).tournamentId;
        const categoryId = team.tournament_category_id || (team as any).category_id;

        if (tourId && (!initialTournamentName || (!initialCategoryName && categoryId))) {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
            fetch(`${apiUrl}/tournaments/${tourId}`)
                .then((res) => (res.ok ? res.json() : null))
                .then((data) => {
                    if (data) {
                        const name = data.tournament?.name || data.name;
                        if (name && !initialTournamentName) {
                            setTournamentName(name);
                        }
                        const categories = data.categories || [];
                        if (categoryId && categories.length > 0 && !initialCategoryName) {
                            const matched = categories.find((c: any) => c.id === categoryId);
                            if (matched?.name) {
                                setCategoryName(matched.name);
                            }
                        }
                    }
                })
                .catch((err) => console.error("Error loading tournament details in TeamInfoCard:", err));
        }
    }, [initialTournamentName, initialCategoryName, team.tournament_id, team.tournament_category_id]);

    const hasContactInfo = Boolean(team.contact_name || phone || team.contact_email);

    return (
        <div className={cn("bg-card border border-border rounded-sm overflow-hidden relative", className)}>
            {/* Ambient gradient glow covering the entire card from top to bottom */}
            <div
                className={cn(
                    "absolute -top-16 -left-16 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-500",
                    !dominantColor && (logoUrl ? "bg-white/10 dark:bg-white/10" : "bg-primary/15 dark:bg-primary/10")
                )}
                style={
                    dominantColor
                        ? { backgroundColor: `rgba(${dominantColor}, 0.25)` }
                        : undefined
                }
            />
            <div
                className={cn(
                    "absolute inset-0 pointer-events-none transition-all duration-500",
                    !dominantColor && (logoUrl ? "bg-gradient-to-b from-white/10 via-white/5 to-transparent" : "bg-gradient-to-b from-primary/15 via-primary/5 to-transparent")
                )}
                style={
                    dominantColor
                        ? {
                              background: `linear-gradient(150deg, rgba(${dominantColor}, 0.22) 0%, rgba(${dominantColor}, 0.10) 40%, rgba(${dominantColor}, 0.04) 75%, transparent 100%)`,
                          }
                        : undefined
                }
            />

            <div className="relative z-10 divide-y divide-border">
                {/* Section 1: Team Identity */}
                <div className="p-4 flex flex-col items-center text-center space-y-4 relative">
                    <div className="relative inline-block z-10">
                        {/* Team Circular Logo */}
                        <div className="h-24 w-24 rounded-full border bg-muted/20 flex items-center justify-center overflow-hidden">
                            {logoUrl ? (
                                <Image
                                    src={logoUrl}
                                    alt={team.name}
                                    width={96}
                                    height={96}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex items-center justify-center text-muted-foreground/40">
                                    {getSportIcon(sportKey, "h-10 w-10")}
                                </div>
                            )}
                        </div>

                        {/* Sport Icon Overlay Badge on Bottom-Right */}
                        {sportDisplay && (
                            <div
                                className="absolute bottom-1 right-1 size-5 rounded-full bg-card flex items-center justify-center"
                                title={sportDisplay}
                            >
                                {getSportIcon(sportKey, "size-5 text-foreground")}
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5 flex flex-col items-center">
                        <Header level={1}>{team.name}</Header>

                        {/* Tournament & Category Info */}
                        {(tournamentName || categoryName) && (
                            <div className="flex flex-col items-center justify-center gap-1">
                                {tournamentName && (
                                    <Label>{tournamentName}</Label>
                                )}
                                {categoryName && (
                                    <Badge variant="secondary">
                                        {categoryName}
                                    </Badge>
                                )}
                            </div>
                        )}

                        {team.short_name && (
                            <Badge variant="outline" className="font-mono text-xs font-bold inline-flex items-center gap-1">
                                <Tag className="size-3 text-muted-foreground" />
                                {team.short_name}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Section 2: Contact Details */}
                {hasContactInfo && (
                    <div className="py-2">
                        {team.contact_name && (
                            <div className="flex items-center gap-4 px-4 py-2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                    <User className="size-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[10px] text-muted-foreground">ชื่อผู้ติดต่อ</div>
                                    <Label className="truncate">{team.contact_name}</Label>
                                </div>
                            </div>
                        )}

                        {phone && (
                            <div className="flex items-center gap-4 px-4 py-2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                    <Phone className="size-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[10px] text-muted-foreground">เบอร์โทรศัพท์</div>
                                    <Label asChild className="hover:text-primary transition-colors block truncate cursor-pointer">
                                        <a href={`tel:${phone}`}>
                                            {phone}
                                        </a>
                                    </Label>
                                </div>
                            </div>
                        )}

                        {team.contact_email && (
                            <div className="flex items-center gap-4 px-4 py-2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                    <Mail className="size-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[10px] text-muted-foreground">อีเมล</div>
                                    <Label asChild className="hover:text-primary transition-colors block truncate cursor-pointer">
                                        <a href={`mailto:${team.contact_email}`}>
                                            {team.contact_email}
                                        </a>
                                    </Label>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Section 3: Description */}
                {team.description && (
                    <div className="p-4 space-y-1">
                        <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold">
                            <Info className="size-4 text-muted-foreground" />
                            รายละเอียดทีม
                        </span>
                        <p className="text-xs text-muted-foreground/90 whitespace-pre-wrap leading-relaxed">
                            {team.description}
                        </p>
                    </div>
                )}

                {/* Section 4: Tournament Link */}
                {!isTeamRequest && team.tournament_id && (
                    <div className="p-4">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-between gap-2"
                            asChild
                        >
                            <Link href={`/tournaments/${team.tournament_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center w-full min-w-0">
                                <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                                    <Trophy className="size-4" />
                                    <span className="truncate">ไปที่หน้ารายการแข่งขัน {tournamentName}</span>
                                </div>
                                <ExternalLink className="size-4 text-muted-foreground shrink-0 ml-auto" />
                            </Link>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
