"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ApiClient } from "@/lib/api-client";

interface EmailLoginFormProps {
    authError?: string;
}

export function EmailLoginForm({ authError }: EmailLoginFormProps = {}) {
    const t = useTranslations('Login');
    const tCommon = useTranslations('Common');
    const locale = useLocale();
    const router = useRouter();
    const { toast } = useToast();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (authError) {
            toast({
                variant: "destructive",
                title: tCommon('error') || "เกิดข้อผิดพลาด",
                description: authError === 'authentication_failed'
                    ? (t('invalid_credentials') || "การเข้าสู่ระบบล้มเหลว กรุณาลองใหม่อีกครั้ง")
                    : decodeURIComponent(authError),
            });
        }
    }, [authError, t, tCommon, toast]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const resp = await ApiClient.fetch<{
                access_token: string;
                refresh_token: string;
                user: any;
            }>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email,
                    password,
                }),
            });

            if (resp.access_token) {
                ApiClient.setToken(resp.access_token);
                toast({
                    title: t('login_success') || "เข้าสู่ระบบสำเร็จ",
                    description: `ยินดีต้อนรับ ${resp.user?.full_name || ''}`,
                });

                router.push(`/${locale}/home`);
                router.refresh();
            }
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: tCommon('error') || "เกิดข้อผิดพลาด",
                description: err.message || t('invalid_credentials') || "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 w-full">
            <div className="space-y-1">
                <Label htmlFor="email">{t('email')}</Label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
                    <Input
                        id="email"
                        type="email"
                        size="sm"
                        placeholder={t('email_placeholder')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-9.5"
                        required
                        disabled={isLoading}
                    />
                </div>
            </div>
            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t('password')}</Label>
                    <Link
                        href="/forgot-password"
                        className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
                    >
                        {t('forgot_password')}
                    </Link>
                </div>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
                    <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        size="sm"
                        placeholder={t('password_placeholder')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-9.5 pr-10"
                        required
                        disabled={isLoading}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors p-0.5 rounded-sm"
                        tabIndex={-1}
                    >
                        {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                        ) : (
                            <Eye className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>

            <Button
                type="submit"
                size="sm"
                className="w-full"
                disabled={isLoading}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{t('signing_in') || "กำลังเข้าสู่ระบบ..."}</span>
                    </>
                ) : (
                    <span>{t('sign_in') || "เข้าสู่ระบบ"}</span>
                )}
            </Button>
        </form>
    );
}
