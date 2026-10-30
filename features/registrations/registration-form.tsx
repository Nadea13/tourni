"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Team } from "@/types/index";
import { useTranslations, useLocale } from "next-intl";
import { AlertCircle, CheckCircle2, X, Upload, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PromptPayQR } from "./promptpay-qr";
import { registerTeam } from "@/actions/manager/register-team";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/dropdown";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { LogoUploader } from "@/components/shared/logo-uploader";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Schema generator based on fee
const createFormSchema = (isFree: boolean, t: (key: string) => string) => z.object({
    teamName: z.string().min(2, t("team_name_error")),
    contactName: z.string().min(2, t("contact_name_error")),
    contactPhone: z.string().min(10, t("contact_phone_error")),
    contactEmail: z.string().email().optional().or(z.literal("")),
    description: z.string().optional(),
    logoFile: z.unknown().optional(),
    slipFile: isFree
        ? z.unknown().optional()
        : z.unknown()
            .refine((files: unknown) => {
                if (typeof FileList === "undefined") return true;
                return files instanceof FileList && files.length === 1;
            }, t("slip_required"))
            .refine(
                (files: unknown) => {
                    if (typeof FileList === "undefined") return true;
                    return files instanceof FileList && files[0]?.size <= 5 * 1024 * 1024;
                },
                t("slip_size_error")
            )
            .refine(
                (files: unknown) => {
                    if (typeof FileList === "undefined") return true;
                    return files instanceof FileList && ["image/jpeg", "image/png", "image/webp"].includes(files[0]?.type);
                },
                t("slip_type_error")
            ),
});

interface RegistrationFormProps {
    tournament: {
        id: string;
        name: string;
        registration_fee: number;
        bank_account_number: string;
        bank_name: string;
        bank_account_name: string;
        is_registration_open: boolean;
        status: string;
    };
    tournamentCategoryId?: string;
    initialTeams?: Team[];
    categories?: {
        id: string | number;
        gender_type: string;
        max_teams: number;
        age_categories?: unknown;
    }[];
    isRegistrationDisabled?: boolean;
    isFull?: boolean;
    isPastDeadline?: boolean;
    className?: string;
}

export function RegistrationForm({
    tournament,
    tournamentCategoryId,
    initialTeams,
    categories,
    isRegistrationDisabled,
    isFull,
    isPastDeadline,
    className
}: RegistrationFormProps) {
    const tCommon = useTranslations("Common");
    const { toast } = useToast();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [slipPreviewUrl, setSlipPreviewUrl] = useState<string | null>(null);
    const [selectedTeamId, setSelectedTeamId] = useState<string>("");

    const t = useTranslations("Registration");
    const tTeam = useTranslations("Team");
    const isFree = Number(tournament.registration_fee) <= 0;
    const formSchema = useMemo(() => createFormSchema(isFree, t), [isFree, t]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            teamName: "",
            contactName: "",
            contactPhone: "",
            contactEmail: "",
            description: "",
        },
    });

    const handleSelectTeam = (teamId: string) => {
        setSelectedTeamId(teamId);
        if (teamId === "new") {
            form.setValue("teamName", "");
            form.setValue("description", "");
            form.setValue("contactName", "");
            form.setValue("contactPhone", "");
            form.setValue("contactEmail", "");
            form.setValue("logoFile", undefined);
            setLogoPreviewUrl(null);
            setLogoFile(null);
            return;
        }

        const selectedTeam = initialTeams?.find(t => t.id === teamId);
        if (selectedTeam) {
            form.setValue("teamName", selectedTeam.name);
            form.setValue("description", selectedTeam.description || "");
            form.setValue("contactName", selectedTeam.contact_name || "");
            form.setValue("contactPhone", selectedTeam.contact_phone || "");
            form.setValue("contactEmail", (selectedTeam as unknown as { contact_email?: string }).contact_email || "");
            setLogoPreviewUrl(selectedTeam.logo_url || null);
            setLogoFile(null);
        }
    };

    const locale = useLocale();
    const isThai = locale === "th";
    const isRegistrationClosed = !tournament.is_registration_open || tournament.status === 'completed' || tournament.status === 'cancelled';
    const isExistingTeam = selectedTeamId !== "" && selectedTeamId !== "new";
    const isFormDisabled = Boolean(isFull || isPastDeadline || isRegistrationClosed || isRegistrationDisabled);
    const isFieldDisabled = Boolean(isExistingTeam || isFormDisabled || isSubmitting);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (isFormDisabled) {
            const errorMsg = isFull ? (t("registration_closed_full_desc") || "ทัวร์นาเมนต์นี้มีทีมสมัครครบตามจำนวนที่กำหนดแล้ว") : t("registration_closed_desc");
            toast({
                title: isThai ? "ไม่สามารถลงทะเบียนได้" : "Registration Closed",
                description: errorMsg,
                variant: "destructive",
            });
            return;
        }
        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("tournamentId", tournament.id);
            if (tournamentCategoryId) {
                formData.append("tournamentCategoryId", tournamentCategoryId);
            }
            formData.append("teamName", values.teamName);
            formData.append("contactName", values.contactName);
            formData.append("contactPhone", values.contactPhone);
            if (values.contactEmail) {
                formData.append("contactEmail", values.contactEmail);
            }
            if (values.description) {
                formData.append("description", values.description);
            }
            if (selectedTeamId && selectedTeamId !== "new") {
                formData.append("existingTeamId", selectedTeamId);
            }
            if (logoFile) {
                formData.append("logoFile", logoFile);
            } else if (logoPreviewUrl && !logoPreviewUrl.startsWith('data:')) {
                formData.append("logoUrl", logoPreviewUrl);
            }

            const slipFileList = values.slipFile as FileList | undefined;
            if (!isFree && slipFileList?.[0]) {
                formData.append("slipFile", slipFileList[0]);
            }

            const result = await registerTeam(formData);

            if (result.success) {
                setSuccess(true);
                const successMsg = result.message || t("reg_success_toast") || (isThai ? "ส่งใบสมัครเรียบร้อยแล้ว" : "Registration submitted successfully");
                toast({
                    title: tCommon("success") || (isThai ? "สำเร็จ" : "Success"),
                    description: successMsg,
                });
            } else {
                const errorMsg = result.error || t("reg_failed_toast") || (isThai ? "ไม่สามารถลงทะเบียนได้" : "Registration failed");
                toast({
                    title: isThai ? "ลงทะเบียนไม่สำเร็จ" : "Registration Failed",
                    description: errorMsg,
                    variant: "destructive",
                });
            }
        } catch (_error: any) {
            const errorMsg = _error?.message || (isThai ? "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง" : "An unexpected error occurred");
            toast({
                title: isThai ? "เกิดข้อผิดพลาด" : "Error",
                description: errorMsg,
                variant: "destructive",
            });
            console.error(_error);
        } finally {
            setIsSubmitting(false);
        }
    }

    if (success) {
        return (
            <div className="space-y-3 md:space-y-4">
                <div className="relative overflow-hidden">
                    <EmptyState
                        title={t("success_title")}
                        description={`${t("success_desc")} ${!isFree ? t("success_desc_paid") : ""}`}
                        icon={CheckCircle2}
                        className="py-12"
                        action={
                            <div className="flex gap-3">
                                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                                    {t("register_another")}
                                </Button>
                                <Button size="sm" onClick={() => router.push('/dashboard')}>
                                    {t("go_to_dashboard")}
                                </Button>
                            </div>
                        }
                    />
                </div>
            </div>
        );
    }

    return (
        <Card className={cn("border rounded-sm overflow-hidden py-0 space-y-0", className)}>
            <CardContent className="p-0">
                <form onSubmit={form.handleSubmit(onSubmit)} className="divide-y divide-border">
                    {/* Status Alert Banners */}
                    {isFull ? (
                        <div className="p-3 md:p-4">
                            <div className="flex items-center gap-2.5 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-sm">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <div className="space-y-0.5">
                                    <p className="font-bold text-xs">{t("registration_closed_title")}</p>
                                    <p className="text-[11px] opacity-90">{t("registration_closed_full_desc") || "ทัวร์นาเมนต์นี้มีทีมสมัครครบตามจำนวนที่กำหนดแล้ว"}</p>
                                </div>
                            </div>
                        </div>
                    ) : isPastDeadline ? (
                        <div className="p-3 md:p-4">
                            <div className="flex items-center gap-2.5 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-sm">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <div className="space-y-0.5">
                                    <p className="font-bold text-xs">{t("registration_closed_title")}</p>
                                    <p className="text-[11px] opacity-90">{t("registration_closed_deadline_desc") || "หมดเขตระยะเวลาการส่งเอกสารและสมัครเข้าร่วมแล้ว"}</p>
                                </div>
                            </div>
                        </div>
                    ) : isRegistrationClosed ? (
                        <div className="p-3 md:p-4">
                            <div className="flex items-center gap-2.5 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-sm">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <div className="space-y-0.5">
                                    <p className="font-bold text-xs">{t("registration_closed_title")}</p>
                                    <p className="text-[11px] opacity-90">{t("registration_closed_desc")}</p>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* Section 1: Tournament & Team Selection */}
                    <div className={cn(
                        "grid grid-cols-1",
                        initialTeams && initialTeams.length > 0 && categories && categories.length > 0
                            ? "md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border"
                            : ""
                    )}>
                        {initialTeams && initialTeams.length > 0 && (
                            <div className="p-3 md:p-4 space-y-1">
                                <Label className="text-xs font-semibold">{t("use_existing_team")}</Label>
                                <Select 
                                    value={selectedTeamId} 
                                    onValueChange={handleSelectTeam}
                                    disabled={isFormDisabled || isSubmitting}
                                >
                                    <SelectTrigger size="sm" className="w-full bg-transparent text-xs md:text-sm">
                                        <SelectValue placeholder={t("select_team_placeholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {initialTeams.map((team) => (
                                            <SelectItem key={team.id} value={team.id} className="text-xs md:text-sm">
                                                {team.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {categories && categories.length > 0 && (
                            <div className="p-3 md:p-4 space-y-1">
                                <Label className="text-xs font-semibold">{t("category_title")}</Label>
                                <Select
                                    value={tournamentCategoryId || ""}
                                    onValueChange={(val) => {
                                        const params = new URLSearchParams(searchParams.toString());
                                        params.set("category", val);
                                        router.push(`${pathname}?${params.toString()}`);
                                    }}
                                    disabled={isSubmitting}
                                >
                                    <SelectTrigger size="sm" className="w-full bg-transparent text-xs md:text-sm">
                                        <SelectValue placeholder={t("select_category")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((cat) => {
                                            const ageCategoriesData = (Array.isArray(cat.age_categories) ? cat.age_categories[0] : cat.age_categories) as unknown as { category_name: string | null } | null;
                                            const ageName = ageCategoriesData?.category_name || t("general");
                                            const gender = cat.gender_type === 'open' ? t("gender_open")
                                                : cat.gender_type === 'male' ? t("gender_male")
                                                    : cat.gender_type === 'female' ? t("gender_female")
                                                        : t("gender_mixed");
                                            const label = `${ageName} (${gender})`;
                                            return (
                                                <SelectItem key={String(cat.id)} value={String(cat.id)} className="text-xs md:text-sm">
                                                    {label}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {/* Section 2: Team Details */}
                    <div className="p-3 md:p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 md:gap-4">
                            <div className="flex flex-col items-center gap-1.5 shrink-0">
                                <LogoUploader
                                    id="logo-upload"
                                    initialUrl={logoPreviewUrl}
                                    disabled={isFieldDisabled}
                                    onFileChange={(file) => {
                                        setLogoFile(file);
                                        if (file) {
                                            setLogoPreviewUrl(URL.createObjectURL(file));
                                        } else {
                                            setLogoPreviewUrl(null);
                                        }
                                    }}
                                    onRemove={() => {
                                        setLogoFile(null);
                                        setLogoPreviewUrl(null);
                                    }}
                                    uploadLabel={t("team_logo_label")}
                                    clickToUploadLabel={t("click_to_upload_logo")}
                                    previewLabel="Logo preview"
                                />
                                <span className="text-[11px] font-bold text-muted-foreground">{t("team_logo_label")}</span>
                            </div>

                            <div className="flex-1 w-full space-y-2.5">
                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold">{t("team_name_label")} <span className="text-destructive">*</span></Label>
                                    <Input
                                        id="teamName"
                                        size="sm"
                                        {...form.register("teamName")}
                                        disabled={isFieldDisabled}
                                        placeholder={t("team_name_placeholder")}
                                        className="bg-transparent text-xs md:text-sm"
                                    />
                                    {form.formState.errors.teamName && (
                                        <p className="text-[11px] font-medium text-destructive mt-0.5">
                                            {form.formState.errors.teamName.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="teamDesc" className="text-xs font-semibold">{t("team_description_label")}</Label>
                                    <Textarea
                                        id="teamDesc"
                                        {...form.register("description")}
                                        className="bg-transparent w-full resize-none min-h-[64px] text-xs md:text-sm p-2 rounded-sm"
                                        disabled={isFieldDisabled}
                                        placeholder={t("team_description_placeholder")}
                                    />
                                    {form.formState.errors.description && (
                                        <p className="text-[11px] font-medium text-destructive mt-0.5">
                                            {form.formState.errors.description.message}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Contact Information */}
                    <div className="p-3 md:p-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">{t("contact_name_label")} <span className="text-destructive">*</span></Label>
                                <Input
                                    id="contactName"
                                    size="sm"
                                    {...form.register("contactName")}
                                    disabled={isFieldDisabled}
                                    placeholder={t("contact_name_placeholder")}
                                    className="bg-transparent text-xs md:text-sm"
                                />
                                {form.formState.errors.contactName && (
                                    <p className="text-[11px] font-medium text-destructive mt-0.5">
                                        {form.formState.errors.contactName.message}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">{t("contact_phone_label")} <span className="text-destructive">*</span></Label>
                                <Input
                                    id="contactPhone"
                                    size="sm"
                                    {...form.register("contactPhone")}
                                    className="bg-transparent text-xs md:text-sm"
                                    disabled={isFieldDisabled}
                                    placeholder={t("contact_phone_placeholder")}
                                />
                                {form.formState.errors.contactPhone && (
                                    <p className="text-[11px] font-medium text-destructive mt-0.5">
                                        {form.formState.errors.contactPhone.message}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1 md:col-span-2">
                                <Label className="text-xs font-semibold">{tTeam("contact_email")}</Label>
                                <Input
                                    id="contactEmail"
                                    size="sm"
                                    type="email"
                                    {...form.register("contactEmail")}
                                    className="bg-transparent text-xs md:text-sm"
                                    disabled={isFieldDisabled}
                                    placeholder={tTeam("contact_email_placeholder")}
                                />
                                {form.formState.errors.contactEmail && (
                                    <p className="text-[11px] font-medium text-destructive mt-0.5">
                                        {form.formState.errors.contactEmail.message}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section 4: PromptPay QR and Slip Upload - Hidden when free OR when full/disabled */}
                    {!isFree && !isFormDisabled && (
                        <div className="bg-muted/10">
                            <div className={cn(
                                tournament.bank_account_number
                                    ? "grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border"
                                    : "flex flex-col"
                            )}>
                                {tournament.bank_account_number && (
                                    <div className="flex flex-col">
                                        {/* PromptPay Header on the left side */}
                                        <div className="flex justify-center bg-[#113566] p-2">
                                            <svg width="761" height="227" viewBox="0 0 761 227" className="h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M595.456 145.496V161.836H624.416V174.086H595.476V188.956H627.806V201.776H581.266V132.766H626.246V145.506H595.466L595.456 145.496Z" fill="#FFFEFE" />
                                                <path d="M429.286 201.756H428.476C424.076 201.756 419.676 201.746 415.276 201.766C414.656 201.766 414.366 201.606 414.146 200.966C412.506 196.196 410.816 191.446 409.166 186.686C408.976 186.136 408.726 185.936 408.146 185.936C400.126 185.956 392.116 185.956 384.096 185.936C383.476 185.936 383.236 186.136 383.026 186.726C381.346 191.446 379.616 196.156 377.906 200.876C377.806 201.146 377.706 201.406 377.586 201.716H363.666C364.396 199.806 365.116 197.946 365.836 196.086C373.906 175.236 381.986 154.376 390.036 133.516C390.286 132.876 390.586 132.676 391.246 132.686C394.786 132.726 398.326 132.716 401.866 132.686C402.396 132.686 402.656 132.826 402.866 133.366C411.576 155.916 420.316 178.466 429.036 201.016C429.116 201.226 429.176 201.446 429.276 201.756H429.286ZM396.196 150.316C396.136 150.316 396.086 150.296 396.026 150.296C393.166 158.276 390.306 166.266 387.436 174.296H404.686C401.846 166.266 399.016 158.286 396.196 150.316Z" fill="#FFFEFE" />
                                                <path d="M318.536 132.766C318.736 132.746 318.916 132.716 319.086 132.716C328.366 132.736 337.646 132.636 346.926 132.816C352.666 132.926 357.966 134.646 362.436 138.456C365.926 141.426 367.876 145.247 368.556 149.727C369.186 153.887 369.016 158.006 367.556 161.986C365.576 167.396 361.596 170.826 356.386 172.956C352.976 174.346 349.396 174.936 345.726 174.966C341.306 175.006 336.876 174.986 332.446 174.986C332.216 174.986 331.996 174.986 331.686 174.986V201.786H318.536V132.776V132.766ZM331.676 162.917C331.846 162.937 331.946 162.956 332.046 162.956C336.416 162.956 340.796 163.006 345.166 162.906C346.636 162.876 348.136 162.576 349.556 162.176C352.256 161.426 354.216 159.806 354.896 156.946C355.366 154.966 355.376 152.996 354.896 151.016C354.386 148.916 353.146 147.416 351.196 146.486C349.606 145.716 347.916 145.256 346.166 145.216C341.466 145.126 336.766 145.126 332.066 145.096C331.946 145.096 331.826 145.146 331.686 145.176V162.906L331.676 162.917Z" fill="#FFFEFE" />
                                                <path d="M459.276 201.776H446.096C446.096 201.446 446.096 201.136 446.096 200.836C446.096 191.706 446.096 182.576 446.076 173.456C446.076 172.966 445.916 172.416 445.666 172.006C437.786 159.226 429.886 146.456 421.996 133.686C421.826 133.406 421.656 133.126 421.436 132.746C421.796 132.726 422.036 132.706 422.276 132.706C426.756 132.706 431.226 132.716 435.706 132.686C436.296 132.686 436.596 132.886 436.896 133.396C442.016 142.076 447.156 150.736 452.296 159.406C452.436 159.646 452.586 159.886 452.786 160.216C452.996 159.886 453.176 159.616 453.336 159.336C458.506 150.716 463.676 142.107 468.816 133.477C469.166 132.887 469.546 132.686 470.206 132.696C474.506 132.726 478.806 132.716 483.106 132.716H484.076C483.846 133.116 483.686 133.397 483.516 133.667C475.596 146.427 467.676 159.176 459.776 171.946C459.486 172.416 459.306 173.047 459.296 173.607C459.266 182.687 459.276 191.756 459.276 200.836V201.796V201.776Z" fill="#FFFEFE" />
                                                <path d="M760.886 145.516H739.566V201.776H726.386V145.566H705.136V132.766H760.896V145.516H760.886Z" fill="#FFFEFE" />
                                                <path d="M553.776 132.766V132.686H546.646L528.936 181.406L510.206 132.766H506.126H492.976V148.096V201.776H506.126V153.126L522.316 196.446H534.496L550.726 155.756V201.776H563.876V148.096V132.766H553.776Z" fill="#FFFEFE" />
                                                <path d="M684.026 132.766V181.977L653.906 132.766H641.836V201.776H653.906V155.076L684.026 201.776H696.096V132.766H684.026Z" fill="#FFFEFE" />
                                                <path d="M739.886 74.6565C746.866 85.6465 753.826 96.5965 760.886 107.696H759.866C754.726 107.696 749.596 107.687 744.456 107.716C743.816 107.716 743.476 107.516 743.136 106.956C737.226 97.0465 731.286 87.1465 725.386 77.2365C725.016 76.6165 724.616 76.3965 723.926 76.4065C721.286 76.4465 718.646 76.4265 715.916 76.4265V107.636H700.656V27.8265C700.906 27.8065 701.106 27.7665 701.306 27.7665C712.046 27.7865 722.786 27.6965 733.526 27.8765C739.666 27.9865 745.466 29.6165 750.536 33.4265C755.526 37.1765 758.036 42.3465 758.616 48.5865C759.046 53.1965 758.666 57.7165 756.726 61.9665C754.106 67.7265 749.586 71.2665 743.906 73.3765C742.626 73.8565 741.296 74.1965 739.866 74.6465L739.886 74.6565ZM715.926 62.2165C716.296 62.2365 716.556 62.2565 716.816 62.2565C721.486 62.2565 726.146 62.2765 730.816 62.2465C732.106 62.2465 733.396 62.1265 734.676 61.9465C740.246 61.1365 743.196 57.5165 742.936 51.8265C742.776 48.1865 741.396 45.2765 737.946 43.9065C736.406 43.2965 734.726 42.8265 733.096 42.7765C727.526 42.6065 721.946 42.6465 716.366 42.6065C716.226 42.6065 716.096 42.6665 715.926 42.7065V62.2265V62.2165Z" fill="#FFFEFE" />
                                                <path d="M455.606 107.666H440.406V75.0965H407.476V107.636H392.236V27.8465H407.426V60.1065H440.366V27.8365H455.616V107.666H455.606Z" fill="#FFFEFE" />
                                                <path d="M543.456 107.696C539.156 107.696 534.996 107.696 530.826 107.696C529.566 107.696 528.296 107.656 527.036 107.716C526.406 107.746 526.126 107.526 525.906 106.906C523.996 101.386 522.026 95.8965 520.126 90.3765C519.866 89.6265 519.526 89.3965 518.756 89.3965C509.506 89.4265 500.266 89.4265 491.016 89.3965C490.326 89.3965 490.006 89.5665 489.746 90.2765C487.796 95.7465 485.796 101.196 483.806 106.646C483.686 106.986 483.546 107.316 483.416 107.666H467.296C467.426 107.286 467.526 106.946 467.656 106.626C477.746 80.6365 487.836 54.6465 497.906 28.6565C498.156 28.0065 498.446 27.7365 499.176 27.7465C503.316 27.7865 507.456 27.7865 511.596 27.7465C512.256 27.7465 512.556 27.9465 512.806 28.5865C522.906 54.6665 533.036 80.7365 543.156 106.806C543.256 107.056 543.326 107.306 543.456 107.686V107.696ZM494.876 75.8865H514.886C511.576 66.5665 508.296 57.3265 504.936 47.8565C501.526 57.3565 498.216 66.5765 494.876 75.8865Z" fill="#FFFEFE" />
                                                <path d="M341.506 42.6065H318.536V27.8365H379.866V42.5465H356.816V107.636H341.516V42.6065H341.506Z" fill="#FFFEFE" />
                                                <path d="M552.806 27.8165H567.946V107.636H552.806V27.8165Z" fill="#FFFEFE" />
                                                <path d="M688.016 106.476L676.146 94.6765C677.616 92.9065 678.926 90.9665 680.066 88.8465C683.376 82.6665 685.036 75.6665 685.036 67.8365C685.036 60.0065 683.466 53.2065 680.316 47.1165C677.166 41.0265 672.596 36.2765 666.606 32.8765C660.606 29.4765 653.876 27.7665 646.406 27.7665C635.006 27.7665 625.696 31.3865 618.486 38.6365C611.276 45.8865 607.666 55.9165 607.666 68.7265C607.666 75.4965 609.206 81.9265 612.306 87.9965C615.396 94.0665 619.936 98.8565 625.936 102.366C631.936 105.876 638.736 107.626 646.356 107.626C653.386 107.626 659.926 106.036 665.996 102.866C666.186 102.766 666.356 102.656 666.536 102.556L679.246 115.196L688.016 106.476ZM646.356 95.1865C640.966 95.1865 636.366 94.0265 632.296 91.6465C628.376 89.3465 625.496 86.3165 623.486 82.3765C621.276 78.0365 620.196 73.5665 620.196 68.7265C620.196 59.2365 622.546 52.2665 627.396 47.3965C632.266 42.4965 638.306 40.2165 646.416 40.2165C651.716 40.2165 656.296 41.3465 660.406 43.6865C664.286 45.8865 667.156 48.8665 669.186 52.8065C671.426 57.1465 672.516 62.0665 672.516 67.8365C672.516 73.6065 671.376 78.5965 669.026 82.9865C668.486 83.9965 667.886 84.9365 667.246 85.8165L655.136 73.7765L646.366 82.4965L657.156 93.2265C653.766 94.5365 650.216 95.1865 646.366 95.1865H646.356Z" fill="#FFFEFE" />
                                                <path d="M58.9459 0.28646C62.4859 0.10646 66.0359 -0.153523 69.5759 0.116477C101.166 0.146477 132.766 0.116457 164.356 0.126457C178.556 0.196457 193.256 3.25647 205.006 11.6065C214.906 18.5265 221.906 29.0665 225.566 40.4865C227.826 47.4665 229.056 54.7865 229.256 62.1165C229.226 93.3965 229.266 124.686 229.236 155.966C252.056 177.976 274.926 199.946 297.756 221.946C298.516 222.696 299.546 223.666 299.246 224.846C298.696 225.906 297.316 226.006 296.266 226.126C220.706 226.106 145.146 226.126 69.5959 226.126C56.3259 226.196 42.7159 224.226 30.8159 218.056C23.8959 214.486 17.7159 209.436 12.9759 203.256C5.03589 192.966 1.0559 180.056 0.185902 167.206C-0.124098 164.046 0.0358959 160.866 0.0858959 157.696C0.0858959 122.676 0.0858959 87.6565 0.0858959 52.6365C0.345896 41.8965 3.4159 30.9765 10.0859 22.4165C16.7459 13.7065 26.5559 7.91646 36.8459 4.53646C43.9959 2.17646 51.4559 0.87646 58.9459 0.28646ZM45.6559 29.3365C40.6459 30.9665 36.0359 34.1265 33.1659 38.5965C30.2259 43.1565 28.8559 48.6765 29.0259 54.0765C29.0259 69.3165 29.0259 84.5565 29.0259 99.7965C42.3259 99.7965 55.6259 99.8065 68.9359 99.7965V77.9665C68.8959 74.3665 70.4959 70.6865 73.4659 68.5765C76.4559 66.4165 80.2759 65.8465 83.8959 65.9365C89.9559 65.9365 96.0159 65.9365 102.076 65.9365C102.106 53.2065 102.066 40.4765 102.096 27.7465C88.3259 27.7065 74.5559 27.7465 60.7959 27.7265C55.7159 27.2365 50.5159 27.7565 45.6559 29.3365ZM128.986 27.7165C128.926 40.4565 128.966 53.1965 128.966 65.9365C135.386 65.9465 141.816 65.9365 148.236 65.9365C151.666 65.9565 155.276 66.7165 158.006 68.9065C160.716 71.0465 162.146 74.5465 162.106 77.9565C162.106 85.2365 162.036 92.5165 162.066 99.7965C175.386 99.8165 188.706 99.7965 202.016 99.7965V53.3465C202.106 49.6565 201.516 45.9365 200.216 42.4765C198.416 37.5865 194.706 33.4765 190.086 31.0965C184.026 27.9465 176.976 27.1365 170.246 27.7265C156.496 27.7165 142.746 27.7565 128.996 27.7065L128.986 27.7165ZM29.0359 126.326C29.0259 142.416 29.0359 158.496 29.0359 174.586C29.1459 178.406 29.8959 182.276 31.7359 185.666C33.9259 189.816 37.6659 193.016 41.8959 194.976C47.9859 197.826 54.8459 198.696 61.5059 198.396C75.0359 198.406 88.5659 198.396 102.086 198.396C102.086 185.666 102.096 172.926 102.086 160.196C95.6559 160.196 89.2359 160.196 82.8159 160.196C79.3859 160.186 75.7759 159.416 73.0459 157.226C70.3359 155.076 68.9159 151.576 68.9559 148.156V126.326C55.6559 126.326 42.3559 126.326 29.0459 126.326H29.0359ZM162.016 127.896C161.976 134.766 162.006 141.636 162.006 148.496C162.116 151.426 161.366 154.516 159.336 156.716C157.066 159.106 153.676 160.146 150.446 160.106C143.026 160.076 135.606 160.146 128.186 160.066C128.016 161.726 128.146 163.386 128.106 165.056C128.096 175.986 128.136 186.906 128.086 197.836C131.236 197.956 134.396 197.856 137.546 197.886C169.096 197.866 200.646 197.926 232.196 197.856C218.636 184.236 204.986 170.716 191.416 157.106C181.576 147.416 171.946 137.496 162.026 127.896H162.016Z" fill="white" />
                                                <path d="M162.016 127.896C171.946 137.496 181.566 147.417 191.406 157.107C204.976 170.717 218.626 184.237 232.186 197.857C200.636 197.927 169.086 197.866 137.536 197.886C134.376 197.856 131.226 197.956 128.076 197.836C128.126 186.906 128.076 175.986 128.096 165.056C128.136 163.386 128.006 161.716 128.176 160.066C135.596 160.146 143.016 160.067 150.436 160.107C153.666 160.147 157.066 159.106 159.326 156.716C161.356 154.516 162.106 151.426 161.996 148.496C161.996 141.626 161.966 134.756 162.006 127.896H162.016Z" fill="#54A69A" />
                                            </svg>
                                        </div>
                                        <div className="p-3 md:p-4 flex flex-col items-center justify-center space-y-2.5 flex-1">
                                            <Image
                                                src="/prompt-pay.png"
                                                alt="PromptPay Logo"
                                                width={110}
                                                height={36}
                                                className="h-7 w-auto object-contain"
                                            />
                                            {tournament.bank_name === 'PromptPay' && (
                                                <PromptPayQR
                                                    phoneNumber={tournament.bank_account_number}
                                                    amount={Number(tournament.registration_fee)}
                                                />
                                            )}
                                            <div className="text-center space-y-0.5 text-xs">
                                                <div className="flex justify-center items-center gap-1.5 flex-wrap">
                                                    <span className="text-muted-foreground">{t("account_name_label")}:</span>
                                                    <span className="font-bold text-foreground">{tournament.bank_account_name}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Right Side: Clean Slip Upload Box */}
                                <div className="flex flex-col justify-center">
                                    <div className="flex-1 flex flex-col space-y-1">
                                        <div className="group relative h-full flex flex-col">
                                            {!slipPreviewUrl ? (
                                                <div className="py-8 md:py-10 hover:border-primary/40 transition-colors text-center cursor-pointer relative flex-1 flex items-center justify-center hover:bg-primary/5 min-h-[180px]">
                                                    <input
                                                        type="file"
                                                        accept="image/jpeg,image/png,image/webp"
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                        {...form.register("slipFile", {
                                                            onChange: (e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    setSlipPreviewUrl(URL.createObjectURL(file));
                                                                }
                                                            }
                                                        })}
                                                    />
                                                    <div className="flex flex-col items-center gap-2.5 p-4">
                                                        <div className="p-2.5 bg-primary/10 text-primary rounded-sm transition-transform group-hover:scale-105">
                                                            <Upload className="w-4 h-4" />
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <div className="text-xs font-semibold tracking-wide text-foreground">
                                                                {t("click_to_upload")}
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground">
                                                                JPG, PNG, WebP (Max 5MB)
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="relative overflow-hidden border p-2.5 rounded-sm bg-card/60">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="relative aspect-[3/4] w-full max-h-[220px] overflow-hidden flex items-center justify-center rounded-sm">
                                                            <Image
                                                                src={slipPreviewUrl}
                                                                alt="Slip preview"
                                                                width={240}
                                                                height={320}
                                                                className="object-contain w-full h-full"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="icon"
                                                                className="absolute top-1 right-1 h-7 w-7 bg-destructive/80 hover:bg-destructive shadow-sm"
                                                                onClick={() => {
                                                                    form.setValue("slipFile", undefined);
                                                                    setSlipPreviewUrl(null);
                                                                }}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                        <div className="flex items-center justify-between px-1">
                                                            <div className="flex-1 space-y-0.5">
                                                                <p className="text-xs font-bold tracking-wide truncate text-foreground">{t("slip_preview")}</p>
                                                                <p className="text-[10px] text-muted-foreground">{t("ready_to_submit")}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {form.formState.errors.slipFile && (
                                            <p className="text-[11px] font-medium text-destructive mt-1 px-3">
                                                {form.formState.errors.slipFile.message as string}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="p-3 md:p-4 space-y-2">
                        <Button
                            type="submit"
                            variant="default"
                            size="sm"
                            disabled={isSubmitting || isFormDisabled}
                            className="w-full h-9 font-bold text-xs md:text-sm"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {isFree ? t("registering") : t("verifying_registering")}
                                </>
                            ) : isFull ? (
                                isThai ? "ทีมสมัครเต็มแล้ว (ปิดรับสมัคร)" : "Registration Full"
                            ) : isPastDeadline ? (
                                isThai ? "หมดเขตรับสมัครแล้ว" : "Registration Deadline Passed"
                            ) : isRegistrationClosed ? (
                                t("registration_closed_title")
                            ) : (
                                isFree ? t("confirm_registration") : t("confirm_and_pay")
                            )}
                        </Button>
                        <p className="text-center text-[10px] font-medium text-muted-foreground/60">
                            {isFree
                                ? t("terms_free")
                                : t("terms_paid")}
                        </p>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

