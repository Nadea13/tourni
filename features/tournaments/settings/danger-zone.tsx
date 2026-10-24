"use client";

import { useState, useTransition, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, RefreshCw, Loader2, Ban, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/ui/header";
import { cn } from "@/lib/utils";
import { DeleteTournamentDialog } from "@/features/dialogs";
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
import { resetBracketFlow } from "@/actions/tournaments/fixtures";
import { cancelTournament, requestTournamentStatusChange, cancelTournamentStatusChangeRequest } from "@/actions/tournaments/general";
import { TournamentStatus, TournamentStatusRequest } from "@/types";

interface DangerZoneProps {
    tournamentId: string;
    tournamentName: string;
    activeCategoryId?: string | null;
    tournamentStatus?: string;
    tournamentSettings?: Record<string, any> | null;
    className?: string;
}

export function DangerZone({
    tournamentId,
    tournamentName,
    activeCategoryId,
    tournamentStatus,
    tournamentSettings,
    className
}: DangerZoneProps) {
    const t = useTranslations("Settings");
    const tCommon = useTranslations("Common");
    const locale = useLocale();
    const isThai = locale === "th";
    const { toast } = useToast();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [currentStatus, setCurrentStatus] = useState(tournamentStatus);
    const [resetFlowDialogOpen, setResetFlowDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [statusRequestDialogOpen, setStatusRequestDialogOpen] = useState(false);
    const [targetStatus, setTargetStatus] = useState<TournamentStatus>(
        (tournamentStatus === 'completed' || tournamentStatus === 'cancelled') ? 'ongoing' : 'draft'
    );
    const [statusReason, setStatusReason] = useState("");

    const activeRequest = tournamentSettings?.status_request as TournamentStatusRequest | undefined;
    const isPendingApproval = activeRequest?.status === 'pending';
    const isRejected = activeRequest?.status === 'rejected';

    useEffect(() => {
        setCurrentStatus(tournamentStatus);
    }, [tournamentStatus]);

    const handleStatusChangeRequest = () => {
        setStatusRequestDialogOpen(false);
        startTransition(async () => {
            const res = await requestTournamentStatusChange(tournamentId, targetStatus, statusReason.trim() || undefined);
            if (res.success) {
                toast({
                    title: tCommon("success"),
                    description: isThai
                        ? "ยื่นคำขอเปลี่ยนสถานะเรียบร้อยแล้ว คำขอถูกส่งไปยังผู้ดูแลระบบ (Admin) เพื่อรอการอนุมัติ"
                        : "Status change request submitted to System Admin for approval.",
                });
                setStatusReason("");
                router.refresh();
            } else {
                toast({
                    title: tCommon("error"),
                    description: res.error || (isThai ? "ไม่สามารถส่งคำขอได้" : "Failed to submit request"),
                    variant: "destructive",
                });
            }
        });
    };

    const handleCancelRequest = () => {
        startTransition(async () => {
            const res = await cancelTournamentStatusChangeRequest(tournamentId);
            if (res.success) {
                toast({
                    title: tCommon("success"),
                    description: isThai ? "ยกเลิกคำขอเรียบร้อยแล้ว" : "Status request cancelled.",
                });
                router.refresh();
            } else {
                toast({
                    title: tCommon("error"),
                    description: res.error || (isThai ? "ไม่สามารถยกเลิกคำขอได้" : "Failed to cancel request"),
                    variant: "destructive",
                });
            }
        });
    };

    const handleCancelTournament = () => {
        setCancelDialogOpen(false);
        startTransition(async () => {
            const res = await cancelTournament(tournamentId);
            if (res.success) {
                setCurrentStatus("cancelled");
                toast({
                    title: tCommon("success"),
                    description: isThai ? "ยกเลิกการแข่งขันเรียบร้อยแล้ว" : "Tournament has been cancelled.",
                });
                router.refresh();
            } else {
                toast({
                    title: tCommon("error"),
                    description: res.error,
                    variant: "destructive",
                });
            }
        });
    };

    const handleResetFlow = () => {
        setResetFlowDialogOpen(false);
        startTransition(async () => {
            const res = await resetBracketFlow(tournamentId, activeCategoryId);
            if (res.success) {
                toast({
                    title: tCommon("success"),
                    description: isThai ? "รีเซ็ตสายการแข่งขันเรียบร้อยแล้ว" : "Bracket flow reset successfully",
                });
                router.refresh();
            } else {
                toast({
                    title: tCommon("error"),
                    description: res.error,
                    variant: "destructive",
                });
            }
        });
    };

    return (
        <div className={cn("space-y-4 overflow-hidden", className)}>
            {/* Section Header (matches /dashboard/settings?tab=danger) */}
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

            {/* Danger Actions List */}
            <div className="space-y-2">
                {/* 0. Request Status Change (Revert / change status for completed or cancelled tournaments) */}
                <div className="flex flex-col gap-3 px-4 py-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-4">
                            <div className="size-9 rounded-sm bg-warning/10 flex items-center justify-center shrink-0">
                                <RotateCcw className="size-4 text-warning" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Header level={6} className="text-warning">
                                        {isThai ? "ยื่นคำขอเปลี่ยนสถานะการแข่งขัน" : "Request Status Change"}
                                    </Header>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {isThai
                                        ? "เมื่อการแข่งขันเสร็จสิ้นหรือยกเลิกแล้ว คำขอเปลี่ยนสถานะจะถูกส่งไปยังผู้ดูแลระบบ (Admin) เพื่อพิจารณาอนุมัติ"
                                        : "Status change requests will be submitted to the System Admin for approval."}
                                </p>
                            </div>
                        </div>

                        {!isPendingApproval && (
                            <div className="flex justify-start sm:justify-end shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isPending}
                                    onClick={() => {
                                        setTargetStatus(currentStatus === 'ongoing' ? 'draft' : 'ongoing');
                                        setStatusRequestDialogOpen(true);
                                    }}
                                    className="border-warning/40 text-warning hover:text-warning hover:bg-warning/10 transition-all text-xs"
                                >
                                    {isThai ? "ยื่นคำขอเปลี่ยนสถานะ" : "Request Status Change"}
                                </Button>
                            </div>
                        )}
                    </div>

                    {isPendingApproval && activeRequest && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-card/60 rounded-sm">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-warning text-foreground text-xs font-bold">
                                        {isThai ? "อยู่ระหว่างรอแอดมินอนุมัติ" : "Pending Admin Approval"}
                                    </Badge>
                                    <span className="font-semibold text-foreground">
                                        {isThai ? "ต้องการเปลี่ยนเป็น: " : "Target: "}
                                        <span className="text-primary font-bold">
                                            {activeRequest.target_status === 'ongoing' ? (isThai ? "กำลังแข่งขัน (Ongoing)" : "Ongoing")
                                                : activeRequest.target_status === 'draft' ? (isThai ? "แบบร่าง (Draft)" : "Draft")
                                                    : activeRequest.target_status === 'completed' ? (isThai ? "เสร็จสิ้น (Completed)" : "Completed")
                                                        : (isThai ? "ยกเลิก (Cancelled)" : "Cancelled")}
                                        </span>
                                    </span>
                                </div>
                                {activeRequest.reason && (
                                    <p className="text-muted-foreground text-[11px]">
                                        <span className="font-medium text-foreground">{isThai ? "เหตุผล: " : "Reason: "}</span>
                                        &ldquo;{activeRequest.reason}&rdquo;
                                    </p>
                                )}
                                <p className="text-[10px] text-muted-foreground">
                                    {isThai ? "ส่งคำขอเมื่อ: " : "Submitted: "}
                                    {new Date(activeRequest.requested_at).toLocaleString(locale === 'th' ? 'th-TH' : 'en-US')}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleCancelRequest}
                                disabled={isPending}
                                className="text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0"
                            >
                                {isPending && <Loader2 className="size-3 animate-spin mr-1.5" />}
                                {isThai ? "ยกเลิกคำขอ" : "Cancel Request"}
                            </Button>
                        </div>
                    )}

                    {isRejected && activeRequest && (
                        <div className="mt-2 pt-2 border-t border-destructive/20 text-xs text-destructive flex items-center justify-between gap-2">
                            <span>
                                {isThai
                                    ? `คำขอล่าสุดถูกปฏิเสธโดยแอดมิน ${activeRequest.reject_reason ? `(เหตุผล: ${activeRequest.reject_reason})` : ''}`
                                    : `Last request was rejected by admin ${activeRequest.reject_reason ? `(Reason: ${activeRequest.reject_reason})` : ''}`}
                            </span>
                        </div>
                    )}
                </div>

                {/* 1. Cancel Tournament */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-destructive/10 flex items-center justify-center shrink-0">
                            <Ban className="size-4 text-destructive" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6} className="text-destructive">
                                {isThai ? "ยกเลิกการแข่งขัน" : "Cancel Tournament"}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai
                                    ? "เปลี่ยนสถานะการแข่งขันเป็นยกเลิก (Cancelled) และปิดรับสมัครโดยทันที"
                                    : "Change tournament status to Cancelled and close registration immediately"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 flex justify-start sm:justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isPending || currentStatus === "cancelled"}
                            onClick={() => setCancelDialogOpen(true)}
                            className="border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all text-xs"
                        >
                            {isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
                            {currentStatus === "cancelled"
                                ? (isThai ? "ยกเลิกการแข่งขันแล้ว" : "Already Cancelled")
                                : (isThai ? "ยกเลิกการแข่งขัน" : "Cancel Tournament")}
                        </Button>
                    </div>
                </div>

                {/* 2. Reset Bracket Flow */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-destructive/10 flex items-center justify-center shrink-0">
                            <RefreshCw className="size-4 text-destructive" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6} className="text-destructive">
                                {t("reset_flow_title")}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {t("reset_flow_desc")}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 flex justify-start sm:justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isPending}
                            onClick={() => setResetFlowDialogOpen(true)}
                            className="border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all text-xs"
                        >
                            {isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
                            {t("reset_flow_btn")}
                        </Button>
                    </div>
                </div>

                {/* 3. Delete Tournament */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-destructive/10 flex items-center justify-center shrink-0">
                            <AlertTriangle className="size-4 text-destructive" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6} className="text-destructive">
                                {t("delete_tournament")}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {t("delete_desc")}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 flex justify-start sm:justify-end">
                        <DeleteTournamentDialog
                            tournamentId={tournamentId}
                            tournamentName={tournamentName}
                        />
                    </div>
                </div>
            </div>

            {/* Cancel Tournament Confirmation Dialog */}
            <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <AlertDialogContent className="sm:max-w-[760px] h-auto sm:h-auto max-h-[88vh] overflow-hidden flex flex-col bg-card border rounded-none sm:rounded-sm shadow-2xl p-0">
                    <AlertDialogHeader className="p-4 sm:px-6 sm:py-4 border-b shrink-0 bg-card">
                        <AlertDialogTitle asChild>
                            <Header level={4} className="text-destructive">
                                {isThai ? "ยกเลิกการแข่งขัน" : "Cancel Tournament"}
                            </Header>
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                            {isThai
                                ? `คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการแข่งขัน "${tournamentName}"? เมื่อยืนยัน สถานะทัวร์นาเมนต์จะถูกเปลี่ยนเป็นยกเลิก (Cancelled) และระบบจะปิดรับสมัครโดยทันที`
                                : `Are you sure you want to cancel "${tournamentName}"? The tournament status will be changed to Cancelled and registration will be closed immediately.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="p-3 sm:px-6 sm:py-3.5 border-t bg-card shrink-0 flex flex-row items-center justify-end gap-2">
                        <AlertDialogCancel
                            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-0")}
                            disabled={isPending}
                        >
                            {tCommon("cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleCancelTournament}
                            className={cn(buttonVariants({ size: "sm", variant: "destructive" }))}
                            disabled={isPending}
                        >
                            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                            {isThai ? "ยืนยันยกเลิกการแข่งขัน" : "Confirm Cancel"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reset Flow Confirmation Dialog */}
            <AlertDialog open={resetFlowDialogOpen} onOpenChange={setResetFlowDialogOpen}>
                <AlertDialogContent className="sm:max-w-[760px] h-auto sm:h-auto max-h-[88vh] overflow-hidden flex flex-col bg-card border rounded-none sm:rounded-sm shadow-2xl p-0">
                    <AlertDialogHeader className="p-4 sm:px-6 sm:py-4 border-b shrink-0 bg-card">
                        <AlertDialogTitle asChild>
                            <Header level={4} className="text-destructive">
                                {t("reset_flow_title")}
                            </Header>
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                            {t("reset_flow_confirm")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="p-3 sm:px-6 sm:py-3.5 border-t bg-card shrink-0 flex flex-row items-center justify-end gap-2">
                        <AlertDialogCancel
                            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-0")}
                            disabled={isPending}
                        >
                            {tCommon("cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleResetFlow}
                            className={cn(buttonVariants({ size: "sm", variant: "destructive" }))}
                            disabled={isPending}
                        >
                            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                            {t("confirm_reset")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Request Tournament Status Change Dialog */}
            <AlertDialog open={statusRequestDialogOpen} onOpenChange={setStatusRequestDialogOpen}>
                <AlertDialogContent className="sm:max-w-[560px] h-auto sm:h-auto max-h-[88vh] overflow-hidden flex flex-col bg-card border rounded-none sm:rounded-sm shadow-2xl p-0">
                    <AlertDialogHeader className="p-4 sm:px-6 sm:py-4 border-b shrink-0 bg-card">
                        <AlertDialogTitle asChild>
                            <Header level={4} className="text-foreground flex items-center gap-2">
                                <RotateCcw className="size-4 text-warning" />
                                {isThai ? "ยื่นคำขอเปลี่ยนสถานะการแข่งขัน (ส่งถึงแอดมิน)" : "Request Status Change (Sent to Admin)"}
                            </Header>
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                            {isThai
                                ? "คำขอนี้จะถูกส่งไปยังผู้ดูแลระบบ (Admin) เพื่อพิจารณาตรวจสอบและอนุมัติ โดยสถานะการแข่งขันจะยังไม่เปลี่ยนแปลงจนกว่าแอดมินจะกดอนุมัติ"
                                : "This request will be sent to the System Admin for review. Tournament status remains unchanged until approved."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="p-4 sm:px-6 space-y-4 text-xs overflow-y-auto">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-foreground">
                                {isThai ? "เลือกสถานะที่ต้องการเปลี่ยนเป็น:" : "Select target status:"}
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { val: 'ongoing', label: isThai ? "กำลังแข่งขัน (Ongoing)" : "Ongoing", color: "text-primary border-primary/30" },
                                    { val: 'draft', label: isThai ? "แบบร่าง (Draft)" : "Draft", color: "text-muted-foreground border-border" },
                                    { val: 'completed', label: isThai ? "เสร็จสิ้น (Completed)" : "Completed", color: "text-emerald-600 border-emerald-500/30" },
                                    { val: 'cancelled', label: isThai ? "ยกเลิก (Cancelled)" : "Cancelled", color: "text-destructive border-destructive/30" },
                                ].map(opt => (
                                    <button
                                        key={opt.val}
                                        type="button"
                                        onClick={() => setTargetStatus(opt.val as TournamentStatus)}
                                        className={cn(
                                            "flex items-center justify-between p-2.5 rounded-sm border text-xs font-bold transition-all text-left",
                                            targetStatus === opt.val
                                                ? "bg-accent/60 border-primary ring-1 ring-primary"
                                                : "bg-card hover:bg-muted/40",
                                            opt.color
                                        )}
                                    >
                                        <span>{opt.label}</span>
                                        {targetStatus === opt.val && <CheckCircle2 className="size-4 text-primary" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-foreground">
                                {isThai ? "ระบุเหตุผลในการยื่นคำขอถึงแอดมิน:" : "Reason for request (sent to admin):"}
                            </label>
                            <input
                                type="text"
                                value={statusReason}
                                onChange={(e) => setStatusReason(e.target.value)}
                                placeholder={isThai ? "ต้องการแข่งขันนัดตัดสินใหม่, แก้ไขผลคะแนนผิดพลาด" : "Replay playoff match, score correction"}
                                className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>

                        <div className="p-3 rounded-sm bg-warning/10 border border-warning/20 text-warning text-[11px] space-y-1">
                            <div className="font-semibold flex items-center gap-1.5">
                                <AlertTriangle className="size-4" />
                                <span>{isThai ? "ข้อควรทราบ" : "Important Note"}</span>
                            </div>
                            <p className="text-foreground/80">
                                {isThai
                                    ? "เมื่อแอดมินอนุมัติคำขอ ระบบจะเปลี่ยนสถานะการแข่งขันและปลดล็อคการจัดการสายการแข่งขันตามที่ขอโดยอัตโนมัติ"
                                    : "Once approved by the admin, the tournament status will be updated and management unlocked automatically."}
                            </p>
                        </div>
                    </div>
                    <AlertDialogFooter className="p-3 sm:px-6 sm:py-3.5 border-t bg-card shrink-0 flex flex-row items-center justify-end gap-2">
                        <AlertDialogCancel
                            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-0")}
                            disabled={isPending}
                        >
                            {tCommon("cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleStatusChangeRequest}
                            className={cn(buttonVariants({ size: "sm", variant: "default" }))}
                            disabled={isPending}
                        >
                            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                            {isThai ? "ส่งคำขอไปยังแอดมิน" : "Submit Request to Admin"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
