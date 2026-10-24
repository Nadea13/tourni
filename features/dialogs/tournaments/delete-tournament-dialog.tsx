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
import { deleteTournament } from "@/actions/tournaments/general";

interface DeleteTournamentDialogProps {
    tournamentId: string;
    tournamentName: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
    redirectTo?: string;
}

export function DeleteTournamentDialog({
    tournamentId,
    tournamentName,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    trigger,
    onSuccess,
    redirectTo = "/my-tournaments",
}: DeleteTournamentDialogProps) {
    const t = useTranslations("Settings");
    const tCommon = useTranslations("Common");
    const tTournament = useTranslations("Tournament");
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
            const res = await deleteTournament(tournamentId);
            if (res.success) {
                toast({
                    title: tCommon("success"),
                    description: t("delete_success_desc") || (isThai ? "ลบทัวร์นาเมนต์เรียบร้อยแล้ว" : "Tournament deleted successfully"),
                });
                setOpen(false);
                if (onSuccess) {
                    onSuccess();
                } else if (redirectTo) {
                    router.push(redirectTo);
                }
            } else {
                toast({
                    title: tCommon("error"),
                    description: res.error || (isThai ? "เกิดข้อผิดพลาดในการลบ" : "Failed to delete tournament"),
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
                    <Button variant="destructive" size="sm">
                        {t("delete_tournament")}
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[760px] h-auto sm:h-auto max-h-[88vh] p-0 flex flex-col overflow-hidden">
                <DialogHeader className="p-4 sm:px-6 sm:py-4 border-b shrink-0 bg-card">
                    <DialogTitle asChild>
                        <Header level={4} className="text-destructive">
                            {t("delete_tournament")}
                        </Header>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        {t("delete_desc")}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (deleteConfirmText === tournamentName && !isPending) {
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
                                        {t("type_to_confirm", { text: tournamentName })}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {t("delete_desc")}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <Input
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder={tTournament("delete_confirm_placeholder", { text: tournamentName }) || tournamentName}
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
                            disabled={deleteConfirmText !== tournamentName || isPending}
                        >
                            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                            {t("confirm_delete")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
