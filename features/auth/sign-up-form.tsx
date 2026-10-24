"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/ui/otp-input";
import { Loader2, Eye, EyeOff, MailCheck, ArrowLeft, KeyRound, Mail, Lock, RefreshCw, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type SignUpStep = 'email' | 'otp' | 'password';
const OTP_EXPIRY_SECONDS = 180; // 3 minutes

interface PasswordStrength {
    score: number; // 1 to 4
    label: string;
    colorClass: string;
}

function getPasswordStrength(pwd: string): PasswordStrength {
    if (!pwd) {
        return { score: 0, label: "", colorClass: "" };
    }

    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    const varietyCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

    // 4 levels:
    // Level 1 (Red): < 8 chars
    if (pwd.length < 8) {
        return {
            score: 1,
            label: "อ่อนมาก (ต้องมีอย่างน้อย 8 ตัวอักษร)",
            colorClass: "text-destructive",
        };
    }

    // Level 4 (Dark Green): >= 10 chars and high variety (>= 3)
    if (pwd.length >= 10 && varietyCount >= 3) {
        return {
            score: 4,
            label: "ปลอดภัยมาก",
            colorClass: "text-primary",
        };
    }
    // Level 3 (Light Green): >= 8 chars and moderate variety (>= 2)
    if (varietyCount >= 2) {
        return {
            score: 3,
            label: "ปลอดภัย",
            colorClass: "text-primary/50",
        };
    }
    // Level 2 (Yellow): >= 8 chars
    return {
        score: 2,
        label: "พอใช้",
        colorClass: "text-warning",
    };
}

export function SignUpForm() {
    const t = useTranslations('SignUp');
    const tCommon = useTranslations('Common');
    const locale = useLocale();
    const router = useRouter();
    const { toast } = useToast();

    // Multi-step: 1. Send OTP -> 2. Verify OTP -> 3. Set Password
    const [step, setStep] = useState<SignUpStep>('email');

    // Form data
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // Password strength & Real-time position matching for confirmPassword
    const passwordStrength = getPasswordStrength(password);
    const confirmLength = confirmPassword.length;
    const isConfirmStarted = confirmLength > 0;
    const expectedPrefix = password.slice(0, confirmLength);
    const isConfirmMismatch = isConfirmStarted && (confirmLength > password.length || confirmPassword !== expectedPrefix);
    const isConfirmMatched = isConfirmStarted && confirmPassword === password;

    // UI state
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [_error, setError] = useState<string | null>(null);

    // OTP Timer state (3 minutes / 180 seconds)
    const [otpTimeLeft, setOtpTimeLeft] = useState(OTP_EXPIRY_SECONDS);
    const [otpTimestamp, setOtpTimestamp] = useState<number>(0);
    const isOtpExpired = otpTimeLeft <= 0;

    // Countdown effect for Step 2 OTP
    useEffect(() => {
        if (step !== 'otp') return;

        setOtpTimeLeft(OTP_EXPIRY_SECONDS);
        const interval = setInterval(() => {
            setOtpTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [step, otpTimestamp]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Helper: ดึง default name จาก email (เช่น nathanon.idea@gmail.com -> Nathanon Idea)
    const extractDefaultName = (emailStr: string): string => {
        if (!emailStr || !emailStr.includes('@')) return "League User";
        const usernamePart = emailStr.split('@')[0];
        // Clean special characters (. _ -) to space and capitalize
        const cleaned = usernamePart
            .replace(/[._-]+/g, ' ')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        return cleaned || usernamePart;
    };

    // Step 1: Send 6-digit OTP code to email
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            await ApiClient.fetch('/auth/send-otp', {
                method: 'POST',
                body: JSON.stringify({ email }),
            });

            toast({
                title: t('otp_sent_title') || "รหัสยืนยันถูกส่งแล้ว",
                description: t('otp_sent_desc') || `ระบบได้ส่งรหัส OTP 6 หลักไปยัง ${email} (มีอายุ 3 นาที)`,
            });

            setOtp("");
            setOtpTimeLeft(OTP_EXPIRY_SECONDS);
            setOtpTimestamp(Date.now());
            setStep('otp');
        } catch (err: any) {
            const errorMsg = err.message || tCommon('something_went_wrong');
            setError(errorMsg);
            toast({
                variant: "destructive",
                title: tCommon('error') || "เกิดข้อผิดพลาด",
                description: errorMsg,
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Verify OTP code with Redis -> ข้ามไปหน้า Set Password ทันที
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isOtpExpired) {
            toast({
                variant: "destructive",
                title: tCommon('error') || "เกิดข้อผิดพลาด",
                description: "รหัส OTP หมดอายุแล้ว กรุณากดขอรหัสใหม่",
            });
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await ApiClient.fetch('/auth/verify-otp', {
                method: 'POST',
                body: JSON.stringify({ email, otp }),
            });

            toast({
                title: t('email_verified_title') || "ยืนยันอีเมลสำเร็จ",
                description: "กรุณาตั้งรหัสผ่านสำหรับเข้าสู่ระบบ",
            });

            setStep('password');
        } catch (err: any) {
            const errorMsg = err.message || "รหัส OTP ไม่ถูกต้องหรือหมดอายุ";
            setError(errorMsg);
            toast({
                variant: "destructive",
                title: tCommon('error') || "เกิดข้อผิดพลาด",
                description: errorMsg,
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Step 3: Set Password and Complete Registration (ใช้ชื่อ default จากอีเมล)
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (password.length < 8) {
            const errorMsg = "รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร";
            setError(errorMsg);
            toast({
                variant: "destructive",
                title: "ไม่สามารถสมัครได้",
                description: errorMsg,
            });
            setIsLoading(false);
            return;
        }

        if (!confirmPassword) {
            const errorMsg = "กรุณากรอกยืนยันรหัสผ่าน";
            setError(errorMsg);
            toast({
                variant: "destructive",
                title: tCommon('error') || "เกิดข้อผิดพลาด",
                description: errorMsg,
            });
            setIsLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            const errorMsg = t('password_mismatch') || "รหัสผ่านไม่ตรงกัน";
            setError(errorMsg);
            toast({
                variant: "destructive",
                title: tCommon('error') || "เกิดข้อผิดพลาด",
                description: errorMsg,
            });
            setIsLoading(false);
            return;
        }

        // ดึงชื่อเริ่มต้นจาก email
        const defaultFullName = extractDefaultName(email);

        try {
            const resp = await ApiClient.fetch<{
                access_token: string;
                refresh_token: string;
                user: any;
            }>('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    email,
                    password,
                    full_name: defaultFullName,
                    role: 'organizer',
                }),
            });

            if (resp.access_token) {
                ApiClient.setToken(resp.access_token);
                toast({
                    title: t('success_title') || "สร้างบัญชีสำเร็จ",
                    description: `ยินดีต้อนรับ ${resp.user.full_name}!`,
                });

                router.push(`/${locale}/home`);
                router.refresh();
            }
        } catch (err: any) {
            const errorMsg = err.message || tCommon('something_went_wrong');
            setError(errorMsg);
            toast({
                variant: "destructive",
                title: tCommon('error') || "เกิดข้อผิดพลาด",
                description: errorMsg,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full space-y-4">
            {/* STEP 1: Enter Email to Receive OTP */}
            {step === 'email' && (
                <form onSubmit={handleSendOtp} className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="email">{t('email') || "อีเมล"}</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50 pointer-events-none" />
                            <Input
                                id="email"
                                type="email"
                                size="sm"
                                placeholder={t('email_placeholder') || "name@example.com"}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="pl-9.5"
                                required
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        size="sm"
                        className="w-full"
                        disabled={isLoading || !email}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                <span>{t('sending_otp') || "กำลังส่งรหัส OTP..."}</span>
                            </>
                        ) : (
                            <span>{t('send_otp') || "รับรหัสยืนยัน OTP"}</span>
                        )}
                    </Button>
                </form>
            )}

            {/* STEP 2: Enter 6-digit OTP */}
            {step === 'otp' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="text-center space-y-2">
                        <div className="flex justify-center">
                            <MailCheck className="w-8 h-8 text-primary" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            กรอกรหัส 6 หลักที่ส่งไปยัง <b>{email}</b>
                        </p>

                        {/* OTP Expiration / Countdown */}
                        {!isOtpExpired ? (
                            <div className="inline-flex items-center gap-2 text-xs">
                                <span>รหัสจะหมดอายุใน</span>
                                <span className="font-mono text-foreground font-bold">{formatTime(otpTimeLeft)}</span>
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-2 text-xs font-semibold text-destructive">
                                <span>รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่</span>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center">
                        <OtpInput
                            value={otp}
                            onChange={setOtp}
                            length={6}
                            disabled={isLoading || isOtpExpired}
                        />
                    </div>

                    <Button
                        type="submit"
                        size="sm"
                        className="w-full"
                        disabled={isLoading || otp.length < 6 || isOtpExpired}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                <span>กำลังตรวจสอบรหัส...</span>
                            </>
                        ) : (
                            <span>ยืนยันรหัส OTP</span>
                        )}
                    </Button>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <button
                            type="button"
                            onClick={() => {
                                setStep('email');
                                setOtp("");
                            }}
                            className="flex items-center gap-1 hover:text-foreground"
                        >
                            <ArrowLeft className="size-4" /> เปลี่ยนอีเมล
                        </button>
                        <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={isLoading}
                            className={cn(
                                "flex items-center gap-1 transition-colors",
                                isOtpExpired
                                    ? "font-bold text-primary hover:underline"
                                    : "hover:underline text-primary/80"
                            )}
                        >
                            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
                            {isOtpExpired ? "ขอรหัส OTP ใหม่" : "ส่งรหัสอีกครั้ง"}
                        </button>
                    </div>
                </form>
            )}

            {/* STEP 3: Set Password Directly (Default name auto-generated from email) */}
            {step === 'password' && (
                <form onSubmit={handleRegister} noValidate className="space-y-4">
                    <div className="text-center space-y-2">
                        <div className="flex justify-center">
                            <KeyRound className="w-8 h-8 text-primary" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            ตั้งรหัสผ่านสำหรับ <b>{email}</b>
                        </p>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="password">{t('password') || "รหัสผ่านใหม่"}</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50 pointer-events-none" />
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                size="sm"
                                placeholder={t('password_placeholder') || "อย่างน้อย 8 ตัวอักษร"}
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
                                    <EyeOff className="size-4" />
                                ) : (
                                    <Eye className="size-4" />
                                )}
                            </button>
                        </div>

                        {/* Password Strength Gauge (4 Colors: Red, Yellow, Light Green, Dark Green) */}
                        {password.length > 0 && (
                            <div className="space-y-1">
                                <div className="grid grid-cols-4 gap-1 h-1 w-full">
                                    {[1, 2, 3, 4].map((level) => {
                                        const isActive = passwordStrength.score >= level;
                                        let activeColor = "bg-muted";
                                        if (isActive) {
                                            if (passwordStrength.score === 1) activeColor = "bg-destructive";
                                            else if (passwordStrength.score === 2) activeColor = "bg-warning";
                                            else if (passwordStrength.score === 3) activeColor = "bg-primary/50";
                                            else if (passwordStrength.score === 4) activeColor = "bg-primary";
                                        }
                                        return (
                                            <div
                                                key={level}
                                                className={cn(
                                                    "h-full rounded-full transition-all duration-300",
                                                    isActive ? activeColor : "bg-muted"
                                                )}
                                            />
                                        );
                                    })}
                                </div>
                                <div className="flex justify-end items-center text-[11px]">
                                    <span className={cn("font-bold tracking-tight", passwordStrength.colorClass)}>
                                        {passwordStrength.label}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="confirmPassword">
                                {t('confirm_password') || "ยืนยันรหัสผ่านอีกครั้ง"}
                            </Label>
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50 pointer-events-none" />
                            <Input
                                id="confirmPassword"
                                type="password"
                                size="sm"
                                placeholder={t('confirm_password_placeholder') || "กรอกรหัสผ่านให้ตรงกัน"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                onPaste={(e) => {
                                    e.preventDefault();
                                    toast({
                                        variant: "destructive",
                                        title: "ไม่อนุญาตให้วางข้อมูล",
                                        description: "กรุณาพิมพ์ยืนยันรหัสผ่านด้วยตนเองเพื่อความปลอดภัย",
                                    });
                                }}
                                onDrop={(e) => e.preventDefault()}
                                className={cn(
                                    "pl-9.5 pr-10 transition-colors",
                                    isConfirmMismatch && "border-destructive focus-visible:ring-destructive/20",
                                    isConfirmMatched && "border-primary/50 focus-visible:ring-primary/20"
                                )}
                                required
                                disabled={isLoading}
                            />
                            {/* Right side icon: Check if matched, X if mismatch */}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                                {isConfirmMatched && (
                                    <Check className="size-4 text-primary" />
                                )}
                                {isConfirmMismatch && (
                                    <X className="size-4 text-destructive" />
                                )}
                            </div>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        size="sm"
                        className="w-full"
                        disabled={isLoading || !password || isConfirmMismatch}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                <span>กำลังตั้งรหัสผ่านและสร้างบัญชี...</span>
                            </>
                        ) : (
                            <span>สร้างบัญชีและเข้าสู่ระบบ</span>
                        )}
                    </Button>
                </form>
            )}
        </div>
    );
}
