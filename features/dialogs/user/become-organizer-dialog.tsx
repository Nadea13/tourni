"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Rocket, Shield, Zap, AlertCircle } from "lucide-react";
import { registerAsOrganizer } from "@/actions/common/user";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface BecomeOrganizerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function BecomeOrganizerDialog({ open, onOpenChange }: BecomeOrganizerDialogProps) {
    const tDash = useTranslations("Dashboard");
    const locale = useLocale();
    const isThai = locale === 'th';
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleRegister = async () => {
        setIsLoading(true);
        try {
            const result = await registerAsOrganizer();
            if (result.success) {
                // Update local storage
                localStorage.setItem('dashboard-mode', 'organizer');
                // Dispatch event for other components (Navbar/Sidebar)
                window.dispatchEvent(new StorageEvent('storage', {
                    key: 'dashboard-mode',
                    newValue: 'organizer'
                }));

                toast({
                    title: isThai ? "ยินดีต้อนรับ ผู้จัดการแข่งขัน!" : "Welcome, Organizer!",
                    description: isThai ? "คุณสมัครเป็นผู้จัดการแข่งขันเรียบร้อยแล้ว" : "You have successfully registered as a tournament organizer.",
                });

                onOpenChange(false);

                // Navigate immediately to organizer dashboard
                router.push('/home');

                // Refresh to update server-side role check if any
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
                            {tDash("become_organizer").split(' ')[0]} <span className="text-primary">{tDash("become_organizer").split(' ').slice(1).join(' ')}</span>
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-xs">
                            {tDash("become_organizer_desc")}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Features List */}
                <div className="p-2 md:p-4 space-y-1 md:space-y-2">
                    <div className="grid gap-1 md:gap-2">
                        <div className="flex items-center gap-1 md:gap-2">
                            <div className="shrink-0 p-2 bg-primary/10 border border-primary/20 rounded-sm transition-transform">
                                <Rocket className="h-4 w-4 text-primary" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold tracking-widest text-foreground">
                                    {isThai ? "การสร้างทัวร์นาเมนต์" : "Tournament Creation"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {isThai ? "สร้างลีกและสายการแข่งระดับมืออาชีพได้อย่างง่ายดาย" : "Build professional leagues and brackets with ease."}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 md:gap-2">
                            <div className="shrink-0 p-2 bg-primary/10 border border-primary/20 rounded-sm transition-transform">
                                <Shield className="h-4 w-4 text-primary" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold tracking-widest text-foreground">
                                    {isThai ? "การควบคุมการเงิน" : "Financial Controls"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {isThai ? "จัดการค่าสมัครและการชำระเงินที่ปลอดภัย" : "Manage registration fees and secure payments."}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 md:gap-2">
                            <div className="shrink-0 p-2 bg-primary/10 border border-primary/20 rounded-sm transition-transform">
                                <Zap className="h-4 w-4 text-primary" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold tracking-widest text-foreground">
                                    {isThai ? "คอนโซลการแข่งขัน" : "Match Console"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {isThai ? "ตารางแข่งแบบเรียลไทม์และติดตามผลคะแนนสด" : "Real-time scheduling and live score tracking."}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Explicit Confirmation Step */}
                    <div className="flex items-center gap-1 md:gap-2 p-1 md:p-2 bg-primary/5 border border-primary/20 rounded-sm">
                        <AlertCircle className="h-4 w-4 text-primary shrink-0" />
                        <p className="text-xs font-bold text-foreground tracking-widest">
                            {isThai ? "คุณพร้อมที่จะเป็นผู้จัดการแข่งขันแล้วหรือยัง?" : "Are you ready to become an organizer?"}
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
