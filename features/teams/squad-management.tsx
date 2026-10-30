'use client';

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Player, Team, Registration, Tournament } from "@/types/index";
import { cn } from "@/lib/utils";
import { deletePlayer, toggleRosterLock } from "@/actions/manager/team";
import { Button } from "@/components/ui/button";
import { Loader2, Users, AlertCircle, Lock, Unlock, LayoutGrid, ArrowLeft, HelpCircle, Trophy, ExternalLink } from "lucide-react";
import { Tab } from "@/components/ui/tab";
import { useTranslations, useLocale } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Header } from "@/components/ui/header";
import { useRouter, useSearchParams } from "next/navigation";
import { AddPlayerForm } from "@/features/teams/add-player-form";
import { ManageAndSubmitRosterDialog } from "@/features/dialogs";
import { EditTeamForm } from "@/features/teams/edit-team-form";
import { TeamInfoCard } from "@/features/teams/team-info-card";
import { SquadList } from "@/features/teams/squad-list";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SquadManagementProps {
    team: Team & {
        participations?: { tournament_id: string }[];
        registrations?: Registration[];
        is_roster_locked?: boolean;
        isParticipation?: boolean;
        tournament?: Tournament;
        team_id?: string | null;
        roster_status?: string | null;
        registration_status?: string | null;
        status?: string | null;
        payment_status?: string | null;
        unlock_requested?: boolean;
        sport_name?: string | null;
    };
    initialPlayers: Player[];
    backHref?: string;
    isTeamRequest?: boolean;
}

export function SquadManagement({ team, initialPlayers, backHref, isTeamRequest: propIsTeamRequest }: SquadManagementProps) {
    const t = useTranslations("Roster");
    const tCommon = useTranslations("Common");
    const tSports = useTranslations("Sports");
    const locale = useLocale();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isTeamRequest = Boolean(propIsTeamRequest || searchParams?.get("from") === "team_request");
    const rosterStatus = team.roster_status;
    const [unlockRequested, setUnlockRequested] = useState(team.unlock_requested || false);
    const [isRequestingUnlock, setIsRequestingUnlock] = useState(false);

    const handleRequestUnlock = async () => {
        setIsRequestingUnlock(true);
        const { requestRosterUnlock } = await import("@/actions/tournaments/registration");
        const result = await requestRosterUnlock(team.id);
        setIsRequestingUnlock(false);

        if (result.success) {
            setUnlockRequested(true);
            toast({
                title: tCommon("success"),
                description: "ส่งคำขอปลดล็อกรายชื่อไปยังผู้จัดแล้ว กรุณารอการอนุมัติ"
            });
            router.refresh();
        } else {
            toast({ title: tCommon("error"), description: result.error, variant: "destructive" });
        }
    };

    const handleRequestRosterAddition = async () => {
        setIsRequestingUnlock(true);
        const { requestRosterUnlock } = await import("@/actions/tournaments/registration");
        const result = await requestRosterUnlock(team.id);
        setIsRequestingUnlock(false);

        if (result.success) {
            setUnlockRequested(true);
            toast({
                title: tCommon("success"),
                description: "ส่งคำขอเพิ่มรายชื่อนักกีฬาแล้วและรออนุมัติปลดล็อกชั่วคราวจาก Organizer"
            });
            router.refresh();
        } else {
            toast({ title: tCommon("error"), description: result.error, variant: "destructive" });
        }
    };

    const startTour = useCallback(() => {
        const driverObj = driver({
            showProgress: true,
            animate: true,
            steps: [
                {
                    element: "#tour-squad-header",
                    popover: {
                        title: t("tour_squad_welcome_title"),
                        description: t("tour_squad_welcome_desc"),
                        side: "bottom" as const,
                        align: "start" as const
                    }
                },
                ...(!team.isParticipation && document.getElementById("tour-lock-roster-btn") ? [{
                    element: "#tour-lock-roster-btn",
                    popover: {
                        title: t("tour_squad_lock_title"),
                        description: t("tour_squad_lock_desc"),
                        side: "bottom" as const,
                        align: "start" as const
                    }
                }] : []),
                ...(!team.isParticipation && document.getElementById("tour-add-player-form") ? [{
                    element: "#tour-add-player-form",
                    popover: {
                        title: t("tour_squad_add_title"),
                        description: t("tour_squad_add_desc"),
                        side: "bottom" as const,
                        align: "start" as const
                    }
                }] : []),
                {
                    element: "#tour-squad-list",
                    popover: {
                        title: t("tour_squad_list_title"),
                        description: t("tour_squad_list_desc"),
                        side: "top" as const,
                        align: "start" as const
                    }
                },
                ...(document.getElementById("tour-edit-team-form") ? [{
                    element: "#tour-edit-team-form",
                    popover: {
                        title: t("tour_squad_edit_title"),
                        description: t("tour_squad_edit_desc"),
                        side: "left" as const,
                        align: "start" as const
                    }
                }] : []),
                ...(document.getElementById("tour-team-info-card") ? [{
                    element: "#tour-team-info-card",
                    popover: {
                        title: "ข้อมูลทีม",
                        description: "แสดงรายละเอียดข้อมูลทีมในการแข่งขันนี้",
                        side: "left" as const,
                        align: "start" as const
                    }
                }] : [])
            ]
        });
        driverObj.drive();
    }, [t]);

    useEffect(() => {
        const hasSeenTour = localStorage.getItem("has_seen_squad_tour");
        if (!hasSeenTour) {
            const timer = setTimeout(() => {
                startTour();
                localStorage.setItem("has_seen_squad_tour", "true");
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [startTour]);

    const [players, setPlayers] = useState<Player[]>(initialPlayers);

    useEffect(() => {
        setPlayers(initialPlayers);
    }, [initialPlayers]);

    const refreshPlayers = useCallback(async () => {
        const { getPlayers } = await import("@/actions/manager/team");
        const res = await getPlayers(team.id, Boolean(team.isParticipation || team.tournament_id));
        if (res.success && res.data) setPlayers(res.data);
    }, [team.id, team.isParticipation, team.tournament_id]);

    // Team Edit State
    const [teamName, setTeamName] = useState(team.name);

    // Import Roster State
    const [mobileTab, setMobileTab] = useState<'roster' | 'team'>('roster');

    // Synergy State
    const [isLocked, setIsLocked] = useState(team.is_roster_locked || false);
    const [isLocking, setIsLocking] = useState(false);

    // Deadline check (23:59:59 / เที่ยงคืน สิ้นสุดวันที่กำหนด)
    const documentDeadlineDate = useMemo(() => {
        if (!team.tournament?.document_deadline) return null;
        const d = new Date(team.tournament.document_deadline);
        d.setHours(23, 59, 59, 999);
        return d;
    }, [team.tournament?.document_deadline]);

    const isDeadlinePassed = documentDeadlineDate ? new Date() > documentDeadlineDate : false;
    const effectivelyLocked = isLocked || isDeadlinePassed;
    const canSubmitRoster = !isTeamRequest && (!team.isParticipation || !team.tournament_id || team.registration_status === 'approved');

    // Delete confirmation state
    const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);






    const handleToggleLock = async () => {
        setIsLocking(true);
        const nextLockState = unlockRequested ? true : !isLocked;
        const result = await toggleRosterLock(team.id, nextLockState);
        setIsLocking(false);

        if (result.success) {
            setIsLocked(nextLockState);
            if (nextLockState) {
                setUnlockRequested(false);
            }
            toast({
                title: tCommon("success"),
                description: nextLockState ? "Roster locked. Only Organizer can unlock now." : "Roster unlocked."
            });
        } else {
            toast({ title: tCommon("error"), description: result.error, variant: "destructive" });
        }
    };


    const confirmDeletePlayer = async () => {
        if (!playerToDelete) return;
        const playerId = playerToDelete;
        setPlayerToDelete(null);

        const result = await deletePlayer(playerId, team.id);
        if (result.success) {
            toast({ title: tCommon("success"), description: t("deleted_success") });
            setPlayers(players.filter(p => p.id !== playerId));
        } else {
            toast({ title: tCommon("error"), description: result.error, variant: "destructive" });
        }
    };

    const [isCancellingRequest, setIsCancellingRequest] = useState(false);
    const [showCancelRequestDialog, setShowCancelRequestDialog] = useState(false);

    const handleCancelRequest = async () => {
        setIsCancellingRequest(true);
        try {
            const { cancelTeamManagementRequest } = await import("@/actions/tournaments/staff");
            const result = await cancelTeamManagementRequest(team.team_id || team.id);
            if (result.success) {
                toast({
                    title: tCommon("success"),
                    description: locale === 'th' ? "ยกเลิกคำขอจัดการทีมเรียบร้อยแล้ว" : "Team management request cancelled successfully"
                });
                setShowCancelRequestDialog(false);
                router.push(backHref || `/${locale}/inboxes`);
                router.refresh();
            } else {
                toast({ title: tCommon("error"), description: result.error, variant: "destructive" });
            }
        } catch (err: any) {
            toast({ title: tCommon("error"), description: err?.message || "Failed to cancel request", variant: "destructive" });
        } finally {
            setIsCancellingRequest(false);
        }
    };

    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);

    const handleWithdraw = async () => {
        setIsWithdrawing(true);
        try {
            const { withdrawTournamentTeam } = await import("@/actions/tournaments/registration");
            const result = await withdrawTournamentTeam(team.id);
            if (result.success) {
                toast({
                    title: tCommon("success"),
                    description: "ถอนทีมเรียบร้อยแล้ว"
                });
                setShowWithdrawDialog(false);
                router.push(`/${locale}/inboxes`);
                router.refresh();
            } else {
                toast({ title: tCommon("error"), description: result.error, variant: "destructive" });
            }
        } catch (err: any) {
            toast({ title: tCommon("error"), description: err?.message || "Failed to withdraw team", variant: "destructive" });
        } finally {
            setIsWithdrawing(false);
        }
    };

    return (
        <div className="space-y-2 md:space-y-4">
            {/* Top Navigation & Action Bar */}
            <div className="flex md:items-start justify-between gap-2 lg:gap-4">
                <div className="flex items-center gap-1 lg:gap-2">
                    <Button variant="ghost" size="icon-sm" asChild className="shrink-0 hover:bg-primary/10 hover:text-primary transition-all">
                        <Link href={backHref || (team.isParticipation || team.tournament_id ? "/inboxes" : "/my-teams")}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div className="flex items-center gap-1 lg:gap-2">
                        <div className="flex gap-1 md:gap-2" id="tour-squad-header">
                            <Header level={2} className="md:hidden">
                                {teamName && teamName.length > 12 ? `${teamName.slice(0, 12)}...` : teamName}
                            </Header>
                            <Header level={2} className="hidden md:block">
                                {teamName}
                            </Header>
                            <div className="flex items-center gap-1 md:gap-2">
                                <Badge variant="default">
                                    {team.sport ? (tSports.has(team.sport.toLowerCase() as any) ? tSports(team.sport.toLowerCase() as any) : (tSports.has(team.sport as any) ? tSports(team.sport as any) : team.sport)) : ""}
                                </Badge>
                                <span className="text-[10px] font-black tracking-wider text-primary/60">
                                    {players.length} {tCommon("players") || "Players"}
                                </span>
                                {!team.isParticipation && isLocked && (
                                    <Badge variant="destructive">
                                        {tCommon("secured")}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon-sm" 
                            onClick={startTour} 
                            title="Tutorial"
                        >
                            <HelpCircle className="h-4 w-4" />
                        </Button>
                        {/* Concise Roster Status Badge next to Tutorial */}
                        {unlockRequested ? (
                            <Badge variant="warning" size="default">
                                <span>รออนุมัติปลดล็อก</span>
                            </Badge>
                        ) : isTeamRequest ? (
                            <Badge variant="warning" size="default" title="รอการอนุมัติการโอนสิทธิ์การจัดการทีม">
                                <span>รออนุมัติการโอนสิทธิ์</span>
                            </Badge>
                        ) : (team.isParticipation && team.registration_status === 'pending') ? (
                            <Badge variant="warning" size="default" title="รอการอนุมัติการสมัครจากผู้จัด">
                                <span>รออนุมัติการสมัคร</span>
                            </Badge>
                        ) : (!isDeadlinePassed && rosterStatus === 'pending' && players.length > 0) ? (
                            <Badge variant="warning" size="default" title="ส่งรายชื่อนักกีฬาแล้วและกำลังรอการตรวจสอบ/อนุมัติจาก Organizer">
                                <span>รอ Organizer ตรวจสอบรายชื่อ</span>
                            </Badge>
                        ) : (team.registration_status === 'rejected' || rosterStatus === 'rejected') ? (
                            <Badge variant="destructive" size="default" title="ถอนทีม">
                                <span>ถอนทีม</span>
                            </Badge>
                        ) : null}
                    </div>
                </div>
                <div className="flex items-start gap-2" id="tour-lock-roster-btn">
                    {isTeamRequest && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowCancelRequestDialog(true)}
                            disabled={isCancellingRequest}
                        >
                            {isCancellingRequest && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                            {locale === 'th' ? "ยกเลิกคำขอ" : "Cancel Request"}
                        </Button>
                    )}
                    {!isTeamRequest && team.tournament_id && (
                        <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="hover:border-primary hover:text-primary transition-all gap-1.5"
                        >
                            <Link href={`/tournaments/${team.tournament_id}`} target="_blank" rel="noopener noreferrer">
                                <Trophy className="h-4 w-4" />
                                <span className="hidden md:inline">หน้ารายการแข่งขัน</span>
                                <ExternalLink className="h-4 w-4 opacity-60 hidden md:inline" />
                            </Link>
                        </Button>
                    )}
                    {!isTeamRequest && team.isParticipation && Boolean(team.tournament_id) && team.registration_status !== 'rejected' && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowWithdrawDialog(true)}
                            disabled={isWithdrawing}
                        >
                            {isWithdrawing && <Loader2 className="h-4 w-4 animate-spin" />}
                            ถอนทีม
                        </Button>
                    )}
                    {canSubmitRoster && (
                        <ManageAndSubmitRosterDialog 
                            teamId={team.id} 
                            sourceTeamId={team.isParticipation ? team.team_id || undefined : undefined}
                            onSuccess={refreshPlayers} 
                            effectivelyLocked={unlockRequested ? false : effectivelyLocked} 
                            sport={team.sport || team.sport_name || undefined}
                            existingPlayers={players}
                        />
                    )}
                    {!team.isParticipation && (!effectivelyLocked || unlockRequested || !isDeadlinePassed) && (
                        <Button
                            variant={(effectivelyLocked && !unlockRequested) ? "outline" : "warning"}
                            size="sm"
                            onClick={(effectivelyLocked && !unlockRequested) ? (isDeadlinePassed ? handleRequestUnlock : handleToggleLock) : handleToggleLock}
                            disabled={isLocking || isRequestingUnlock}
                            title={(effectivelyLocked && !unlockRequested) ? t("unlock_roster") : t("submit_lock")}
                        >
                            {isLocking || isRequestingUnlock ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (effectivelyLocked && !unlockRequested) ? (
                                <Unlock className="h-4 w-4" />
                            ) : (
                                <Lock className="h-4 w-4" />
                            )}
                            <span className="hidden md:inline">
                                {(effectivelyLocked && !unlockRequested) ? t("unlock_roster") : t("submit_lock")}
                            </span>
                        </Button>
                    )}
                </div>
            </div>

            {!isTeamRequest && team.isParticipation && Boolean(team.tournament_id) && team.registration_status !== 'approved' && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 flex items-center justify-between gap-3 text-amber-700 dark:text-amber-400 rounded-sm animate-in fade-in">
                    <div className="flex items-center gap-2.5">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p className="text-xs font-medium">
                            {team.registration_status === 'rejected'
                                ? (locale === 'th' ? "การสมัครเข้าร่วมการแข่งขันของทีมนี้ไม่ได้รับการอนุมัติ" : "Team registration was rejected.")
                                : (locale === 'th' ? "ทีมของคุณอยู่ระหว่างรอการอนุมัติการสมัครเข้าร่วมการแข่งขันจากผู้จัด (จะสามารถส่งรายชื่อนักกีฬาได้เมื่อได้รับการอนุมัติแล้ว)" : "Waiting for organizer approval before roster submission is available.")}
                        </p>
                    </div>
                </div>
            )}

            {isDeadlinePassed && (
                <Badge variant="outline" className="bg-destructive/10 border-destructive/50 flex items-center text-destructive animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-1">
                        <Header level={5} className="text-destructive">{t("deadline_passed")}</Header>
                        <p className="text-xs opacity-90">
                            {t("deadline_locked_desc", { date: documentDeadlineDate!.toLocaleString() })}
                        </p>
                    </div>
                </Badge>
            )}

            {rosterStatus === 'approved' && players.length > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-center justify-between gap-3 text-emerald-600 rounded-sm animate-in fade-in">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p className="text-xs font-bold">รายชื่อนักกีฬาได้รับการอนุมัติเรียบร้อยแล้ว</p>
                    </div>
                    {team.isParticipation && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={isDeadlinePassed ? handleRequestRosterAddition : async () => {
                                setIsLocking(true);
                                const { toggleRosterLock } = await import("@/actions/manager/team");
                                const result = await toggleRosterLock(team.id, false);
                                setIsLocking(false);
                                if (result.success) {
                                    setIsLocked(false);
                                    toast({ title: tCommon("success"), description: "ปลดล็อกรายชื่อแล้ว" });
                                    router.refresh();
                                } else {
                                    toast({ title: tCommon("error"), description: result.error, variant: "destructive" });
                                }
                            }}
                            disabled={isRequestingUnlock || isLocking || (isDeadlinePassed && unlockRequested)}
                            className="h-8 text-xs border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
                        >
                            {isRequestingUnlock || isLocking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {isDeadlinePassed ? (unlockRequested ? "รออนุมัติปลดล็อก" : "ขอส่งรายชื่อเพิ่ม") : "แก้ไขรายชื่อ"}
                        </Button>
                    )}
                </div>
            )}

            {/* Custom Mobile Tab Switcher */}
            <div className="lg:hidden">
                <Tab
                    value={mobileTab}
                    onChange={(val) => setMobileTab(val as 'roster' | 'team')}
                    className="w-full"
                    fullWidth={true}
                    options={[
                        { label: tCommon("players"), value: 'roster', icon: Users },
                        { label: tCommon("team"), value: 'team', icon: LayoutGrid }
                    ]}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 lg:gap-4 items-start">
                <div className={cn(
                    "lg:col-span-2 w-full min-w-0",
                    mobileTab !== 'roster' && "hidden lg:block"
                )}>
                    {/* Combined Add Player Form & Player List Card */}
                    <div className="bg-card border rounded-sm divide-y divide-border overflow-hidden">
                        {!team.isParticipation && (
                            <div id="tour-add-player-form">
                                <AddPlayerForm
                                    teamId={team.id}
                                    onSuccess={refreshPlayers}
                                    effectivelyLocked={unlockRequested ? false : effectivelyLocked}
                                    sport={team.sport || team.sport_name || undefined}
                                    className="border-0 rounded-none bg-transparent"
                                />
                            </div>
                        )}
                        <div id="tour-squad-list">
                            <SquadList
                                players={players}
                                team={team}
                                effectivelyLocked={unlockRequested ? false : effectivelyLocked}
                                refreshPlayers={refreshPlayers}
                                onDeletePlayer={setPlayerToDelete}
                                t={t}
                                tCommon={tCommon}
                                readOnlyEdit={Boolean(team.isParticipation)}
                                className="border-0 rounded-none bg-transparent"
                            />
                        </div>
                    </div>
                </div>

                <div className={cn(
                    "lg:col-span-1 w-full min-w-0 space-y-4 lg:sticky lg:top-4",
                    mobileTab !== 'team' && "hidden lg:block"
                )}>
                    {team.isParticipation ? (
                        <div id="tour-team-info-card">
                            <TeamInfoCard team={team} isTeamRequest={isTeamRequest} />
                        </div>
                    ) : (
                        <div id="tour-edit-team-form">
                            <EditTeamForm
                                team={team}
                                onNameChange={setTeamName}
                                isLocked={effectivelyLocked}
                            />
                        </div>
                    )}
                </div>
            </div>

            <AlertDialog open={!!playerToDelete} onOpenChange={(open) => !open && setPlayerToDelete(null)}>
                <AlertDialogContent className="bg-card border rounded-sm shadow-2xl max-w-md p-0">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="p-2 md:p-4 border-b">
                            {t("remove_player")}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="p-2 md:p-4 text-sm font-medium text-muted-foreground/80">
                            {t("delete_confirm")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="p-2 md:p-4 border-t grid grid-cols-2 gap-1 md:gap-2">
                        <AlertDialogCancel className="mt-0">
                            {tCommon("cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                confirmDeletePlayer();
                            }}
                            className="bg-destructive hover:bg-destructive/90 transition-all flex items-center justify-center"
                        >
                            {tCommon("delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showCancelRequestDialog} onOpenChange={setShowCancelRequestDialog}>
                <AlertDialogContent className="bg-card border rounded-sm shadow-2xl max-w-md p-0">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="p-2 md:p-4 border-b">
                            {locale === 'th' ? "ยืนยันการยกเลิกคำขอ" : "Confirm Cancellation"}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="p-2 md:p-4 text-sm font-medium text-muted-foreground/80">
                            {locale === 'th'
                                ? "คุณแน่ใจหรือไม่ว่าต้องการยกเลิกคำขอจัดการทีมนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้"
                                : "Are you sure you want to cancel this team management request? This action cannot be undone."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="p-2 md:p-4 border-t grid grid-cols-2 gap-1 md:gap-2">
                        <AlertDialogCancel className="mt-0" disabled={isCancellingRequest}>
                            {tCommon("cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleCancelRequest();
                            }}
                            disabled={isCancellingRequest}
                            className="bg-destructive hover:bg-destructive/90 transition-all flex items-center justify-center gap-1.5"
                        >
                            {isCancellingRequest && <Loader2 className="h-4 w-4 animate-spin" />}
                            {locale === 'th' ? "ยืนยันการยกเลิก" : "Confirm Cancel"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
                <AlertDialogContent className="bg-card border rounded-sm shadow-2xl max-w-md p-0">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="p-2 md:p-4 border-b">
                            ยืนยันการถอนทีม
                        </AlertDialogTitle>
                        <AlertDialogDescription className="p-2 md:p-4 text-sm font-medium text-muted-foreground/80">
                            คุณแน่ใจหรือไม่ว่าต้องการถอนทีมออกจากการแข่งขันนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="p-2 md:p-4 border-t grid grid-cols-2 gap-1 md:gap-2">
                        <AlertDialogCancel className="mt-0">
                            ยกเลิก
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleWithdraw();
                            }}
                            disabled={isWithdrawing}
                            className="bg-destructive hover:bg-destructive/90 transition-all flex items-center justify-center gap-1.5"
                        >
                            {isWithdrawing && <Loader2 className="h-4 w-4 animate-spin" />}
                            ยืนยันการถอนทีม
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

