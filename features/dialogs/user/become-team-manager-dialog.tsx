"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Shield, Zap, AlertCircle } from "lucide-react";
import { registerAsTeamManager } from "@/actions/common/user";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface BecomeTeamManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function BecomeTeamManagerDialog({ open, onOpenChange }: BecomeTeamManagerDialogProps) {
    const locale = useLocale();
    const isThai = locale === 'th';
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleRegister = async () => {
        setIsLoading(true);
        try {
            const result = await registerAsTeamManager();
            if (result.success) {
                toast({
                    title: isThai ? "ยินดีต้อนรับ ผู้จัดการทีม!" : "Welcome, Team Manager!",
                    description: isThai ? "คุณสมัครเป็นผู้จัดการทีมเรียบร้อยแล้ว" : "You have successfully registered as a team manager.",
                });

                onOpenChange(false);

                // Navigate immediately to teams page
                router.push('/my-teams');

                // Refresh to update server-side role check
                setTimeout(() => {
                    router.refresh();
                }, 100);
            } else {
                toast({
                    title: "Registration Failed",
                    description: result.error,
                    variant: "destructive"
                });
            }
        } catch {
            toast({
                title: "Error",
                description: "Something went wrong. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border bg-card shadow-2xl rounded-sm">
                {/* Header with Premium Feel */}
                <div className="relative p-2 md:p-4 border-b">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black tracking-tighter text-foreground leading-none">
                            {isThai ? "สมัครเป็น " : "Become a "} <span className="text-primary">{isThai ? "ผู้จัดการทีม" : "Team Manager"}</span>
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground font-medium text-xs">
                            {isThai
                                ? "จัดการทีมสโมสรฟุตบอลของคุณ ลงทะเบียนนักเตะ และส่งรายชื่อเข้าแข่งขันลีกต่างๆ"
                                : "Manage your football club teams, register players, and submit lineups for various tournaments."}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Features List */}
                <div className="p-2 md:p-4 space-y-1 md:space-y-2">
                    <div className="grid gap-1 md:gap-2">
                        <div className="flex items-center gap-1 md:gap-2">
                            <div className="shrink-0 p-2 bg-primary/10 border border-primary/20 rounded-sm">
                                <Users className="h-4 w-4 text-primary" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold tracking-widest text-foreground">
                                    {isThai ? "จัดการทีมของคุณ" : "Manage Your Teams"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {isThai ? "สร้างทีมและตั้งค่าโปรไฟล์ข้อมูลสโมสร" : "Create teams and configure club profile information."}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 md:gap-2">
                            <div className="shrink-0 p-2 bg-primary/10 border border-primary/20 rounded-sm">
                                <Shield className="h-4 w-4 text-primary" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold tracking-widest text-foreground">
                                    {isThai ? "ลงทะเบียนนักเตะ" : "Register Players"}
                                </p>
                                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                                    {isThai ? "เพิ่มรายชื่อและข้อมูลรูปภาพ/เอกสารนักเตะประจำทีม" : "Add player rosters and photo/document records for your team."}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 md:gap-2">
                            <div className="shrink-0 p-2 bg-primary/10 border border-primary/20 rounded-sm">
                                <Zap className="h-4 w-4 text-primary" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold tracking-widest text-foreground">
                                    {isThai ? "เข้าร่วมลีกการแข่งขัน" : "Join Tournament Leagues"}
                                </p>
                                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                                    {isThai ? "ส่งใบสมัครและติดตามผลคะแนนสถิติของทีมคุณ" : "Submit registrations and track your team's match statistics."}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Explicit Confirmation Step */}
                    <div className="flex items-center gap-1 md:gap-2 p-1 md:p-2 bg-primary/5 border border-primary/20 rounded-sm">
                        <AlertCircle className="h-4 w-4 text-primary shrink-0" />
                        <p className="text-sm font-bold text-foreground">
                            {isThai ? "คุณพร้อมที่จะเป็นผู้จัดการทีมแล้วหรือยัง?" : "Are you ready to become a team manager?"}
                        </p>
                    </div>

                </div>
                <DialogFooter className="p-2 md:p-4 border-t">
                    <Button
                        className="flex-1 h-10 bg-primary text-primary-foreground hover:bg-primary cursor-pointer"
                        onClick={handleRegister}
                        disabled={isLoading}
                    >
                        {isThai ? "ยืนยันการสมัคร" : "Confirm Registration"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
