"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/ui/header";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { deleteTeamGlobal } from "@/actions/manager/team";
import { deleteTeam } from "@/actions/tournaments/general";

interface DeleteTeamDialogProps {
    teamId: string;
    teamName: string;
    tournamentId?: string;
    context?: "manager" | "organizer";
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
    disabled?: boolean;
    onSuccess?: () => void;
    redirectTo?: string;
}

export function DeleteTeamDialog({
    teamId,
    teamName,
    tournamentId,
    context = "manager",
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    trigger,
    disabled = false,
    onSuccess,
    redirectTo = "/my-teams",
}: DeleteTeamDialogProps) {
    const t = useTranslations("Team");
    const tCommon = useTranslations("Common");
    const locale = useLocale();
    const isThai = locale === "th";
    const { toast } = useToast();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;
    const setOpen = (val: boolean) => {
        if (isControlled) {
            controlledOnOpenChange?.(val);
        } else {
            setUncontrolledOpen(val);
        }
    };

    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const deleteScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            setDeleteConfirmText("");
            if (deleteScrollRef.current) {
                deleteScrollRef.current.scrollTop = 0;
            }
        }
    }, [open]);

    const handleDelete = () => {
        startTransition(async () => {
            if (context === "organizer" && !tournamentId) {
                toast({
                    title: tCommon("error"),
                    description: isThai ? "ไม่พบรหัสทัวร์นาเมนต์" : "Tournament ID is required",
                    variant: "destructive",
                });
                return;
            }

            const result = context === "organizer"
                ? await deleteTeam(teamId, tournamentId!)
                : await deleteTeamGlobal(teamId, tournamentId);

            if (result.success) {
                toast({
                    title: tCommon("success"),
                    description: t("deleted_successfully") || (isThai ? "ลบทีมเรียบร้อยแล้ว" : "Team deleted successfully"),
                });
                setOpen(false);
                if (onSuccess) {
                    onSuccess();
                } else if (context === "manager" && redirectTo) {
                    router.push(redirectTo);
                }
            } else {
                toast({
                    title: tCommon("error"),
                    description: result.error || (isThai ? "เกิดข้อผิดพลาดในการลบทีม" : "Failed to delete team"),
                    variant: "destructive",
                });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger !== undefined ? (
                trigger ? (
                    <DialogTrigger asChild>
                        {trigger}
                    </DialogTrigger>
                ) : null
            ) : (
                <DialogTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        className="w-full border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                        {t("delete_team")}
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[760px] h-auto sm:h-auto max-h-[88vh] p-0 flex flex-col overflow-hidden">
                <DialogHeader className="p-4 sm:px-6 sm:py-4 border-b shrink-0 bg-card">
                    <DialogTitle asChild>
                        <Header level={4} className="text-destructive">
                            {t("delete_team")}
                        </Header>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        {t("delete_desc")}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (deleteConfirmText === teamName && !isPending) {
                            handleDelete();
                        }
                    }}
                    className="flex flex-col"
                >
                    <div ref={deleteScrollRef} className="p-4 space-y-2 overflow-y-auto max-h-[60vh]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-destructive/10 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="size-4 text-destructive" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("type_to_confirm", { text: teamName }) || (isThai ? `โปรดพิมพ์ "${teamName}" เพื่อยืนยัน:` : `Please type "${teamName}" to confirm:`)}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {t("delete_desc")}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <Input
                                    id="confirm-team-delete"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder={teamName}
                                    autoComplete="off"
                                    size="sm"
                                    variant="destructive"
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-3 sm:px-6 sm:py-3.5 border-t bg-card shrink-0 flex flex-row items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setOpen(false)}
                            disabled={isPending}
                        >
                            {tCommon("cancel")}
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            size="sm"
                            disabled={deleteConfirmText !== teamName || isPending}
                        >
                            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                            {tCommon("delete")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
