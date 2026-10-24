"use client";

import { useActionState, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createTournamentCategory } from "@/actions/tournaments/general";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/dropdown";
import { ActionResponse } from "@/types/index";
import {
    Loader2,
    Users,
    UsersRound,
    Shield,
    CreditCard,
    QrCode,
    Building2,
    UserCheck,
} from "lucide-react";

interface CategorySetupProps {
    tournamentId: string;
    ageCategories: { id: number; category_name: string }[];
    tournamentName: string;
}

const defaultAgeCategories = [
    { id: 1, category_name: "Open" },
    { id: 2, category_name: "U12" },
    { id: 3, category_name: "U14" },
    { id: 4, category_name: "U16" },
    { id: 5, category_name: "U18" },
    { id: 6, category_name: "35+" },
    { id: 7, category_name: "40+" },
];

const initialState: ActionResponse = {
    success: false,
    error: undefined,
};

export function CategorySetup({ tournamentId, ageCategories, tournamentName }: CategorySetupProps) {
    const t = useTranslations("CategorySetup");
    const locale = useLocale();
    const isThai = locale === "th";

    const availableCategories = ageCategories && ageCategories.length > 0 ? ageCategories : defaultAgeCategories;

    const [selectedAge, setSelectedAge] = useState<string>(
        availableCategories[0]?.category_name || "Open"
    );
    const [customAge, setCustomAge] = useState<string>("");
    const [genderType, setGenderType] = useState<string>("male");
    const [maxTeams, setMaxTeams] = useState<string>("8");
    const [registrationFee, setRegistrationFee] = useState<string>("0");
    const [bankName, setBankName] = useState<string>("PromptPay");
    const [bankAccountNumber, setBankAccountNumber] = useState<string>("");
    const [bankAccountName, setBankAccountName] = useState<string>("");

    const [state, formAction, isPending] = useActionState(
        async (_prevState: ActionResponse, _formData: FormData) => {
            let targetCategoryName = selectedAge;
            let minAge = 0;
            let maxAge = 99;

            if (selectedAge === "custom") {
                if (!customAge.trim()) {
                    return {
                        success: false,
                        error: isThai ? "กรุณาระบุชื่อรุ่นอายุที่กำหนดเอง" : "Please enter custom age category name"
                    };
                }
                targetCategoryName = customAge.trim();
            }

            if (targetCategoryName.toUpperCase().startsWith("U")) {
                const parsed = parseInt(targetCategoryName.substring(1), 10);
                if (!isNaN(parsed)) {
                    minAge = 0;
                    maxAge = parsed;
                }
            } else if (targetCategoryName.endsWith("+")) {
                const parsed = parseInt(targetCategoryName.replace("+", ""), 10);
                if (!isNaN(parsed)) {
                    minAge = parsed;
                    maxAge = 99;
                }
            } else if (targetCategoryName.toLowerCase() === "open") {
                minAge = 0;
                maxAge = 99;
            }

            if (!maxTeams || parseInt(maxTeams) <= 0) {
                return { success: false, error: t("err_limit") };
            }

            const { getOrCreateAgeCategory } = await import("@/actions/tournaments/general");
            const ageCatRes = await getOrCreateAgeCategory(targetCategoryName, minAge, maxAge);
            if (!ageCatRes.success || !ageCatRes.id) {
                return { success: false, error: ageCatRes.error || "เกิดข้อผิดพลาดในการสร้างรุ่นอายุ" };
            }

            const hasBankInfo = bankAccountNumber.trim() || bankAccountName.trim();
            const bankDetails = hasBankInfo
                ? {
                      bank_name: bankName,
                      bank_account_name: bankAccountName.trim(),
                      bank_account_number: bankAccountNumber.trim(),
                  }
                : null;

            return createTournamentCategory(
                tournamentId,
                ageCatRes.id,
                genderType,
                parseInt(maxTeams),
                parseFloat(registrationFee) || 0,
                null,
                bankDetails
            );
        },
        initialState
    );

    return (
        <div className="flex items-center justify-center h-full min-h-[calc(100vh-6rem)] w-full p-2 sm:p-4 my-auto">
            <div className="w-full sm:max-w-[760px] h-[85vh] max-h-[90vh] bg-card border border-border shadow-2xl rounded-sm overflow-hidden flex flex-col my-auto">
                {/* Header */}
                <div className="flex flex-col gap-1 sm:text-left border-b p-4 sm:p-5 shrink-0 bg-card">
                    <h2 className="text-lg md:text-xl font-black tracking-tighter text-foreground leading-none">
                        {t("title")}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {t.rich("desc", {
                            name: tournamentName,
                            span: (chunks) => <span className="text-primary font-bold">{chunks}</span>
                        })}
                    </p>
                </div>

                {/* Form Body */}
                <form action={formAction} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
                        {/* 1. Age Category Selector */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Users className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("age_category")} <span className="text-destructive">*</span>
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {t("select_age")}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full space-y-2">
                                <Select value={selectedAge} onValueChange={setSelectedAge} disabled={isPending}>
                                    <SelectTrigger size="sm" className="w-full">
                                        <SelectValue placeholder={t("select_age")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableCategories.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.category_name}>
                                                {cat.category_name}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="custom">
                                            {isThai ? "กำหนดเอง..." : "Custom..."}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                {selectedAge === "custom" && (
                                    <div className="space-y-1 pt-1">
                                        <Label className="text-xs font-semibold text-muted-foreground">
                                            {isThai ? "ระบุชื่อรุ่นอายุ (เช่น U13, 30+, Open)" : "Enter age (e.g. U13, 30+, Open)"} <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            type="text"
                                            size="sm"
                                            value={customAge}
                                            disabled={isPending}
                                            onChange={(e) => setCustomAge(e.target.value)}
                                            placeholder={isThai ? "U13 หรือ 30+" : "U13 or 30+"}
                                            className="w-full"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Gender Group Selector */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <UsersRound className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("gender_group")} <span className="text-destructive">*</span>
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {t("select_gender")}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <Select value={genderType} onValueChange={setGenderType} disabled={isPending}>
                                    <SelectTrigger size="sm" className="w-full">
                                        <SelectValue placeholder={t("select_gender")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="open">{t("gender_open") || (isThai ? "ทั่วไป (ทุกเพศ)" : "Open (All Genders)")}</SelectItem>
                                        <SelectItem value="male">{t("gender_male") || (isThai ? "ชาย (ผู้ชายเท่านั้น)" : "Male (Men only)")}</SelectItem>
                                        <SelectItem value="female">{t("gender_female") || (isThai ? "หญิง (ผู้หญิงเท่านั้น)" : "Female (Women only)")}</SelectItem>
                                        <SelectItem value="mixed">{t("gender_mixed") || (isThai ? "ผสม (ชาย-หญิง)" : "Mixed (Men & Women)")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* 3. Team Limit */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Shield className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("team_limit")} <span className="text-destructive">*</span>
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {t("team_limit_hint")}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <Input
                                    type="text"
                                    size="sm"
                                    name="max_teams"
                                    value={maxTeams}
                                    disabled={isPending}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9]/g, "");
                                        setMaxTeams(val);
                                    }}
                                    placeholder={t("team_limit_hint")}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 4. Registration Fee */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <CreditCard className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("fee")}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {t("fee_hint")}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <Input
                                    type="text"
                                    size="sm"
                                    name="registration_fee"
                                    value={registrationFee}
                                    disabled={isPending}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9.]/g, "");
                                        if ((val.match(/\./g) || []).length <= 1) {
                                            setRegistrationFee(val);
                                        }
                                    }}
                                    placeholder={t("fee_hint")}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 5. Bank Details Section (แบบ profile form) */}
                        <div className="-mx-4 border-t border-border my-4" />
                        <div>
                            <Header level={5} className="font-bold text-foreground">
                                {t("bank_section_title")}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {t("bank_section_desc")}
                            </p>
                        </div>

                        {/* 5.1 PromptPay ID / Account Number */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <QrCode className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("promptpay_id")}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "หมายเลขพร้อมเพย์หรือเลขบัญชีสำหรับรับเงิน" : "PromptPay ID or bank account number"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <Input
                                    type="text"
                                    size="sm"
                                    value={bankAccountNumber}
                                    disabled={isPending}
                                    onChange={(e) => setBankAccountNumber(e.target.value)}
                                    placeholder={t("promptpay_placeholder")}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 5.2 Bank / Service Name */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Building2 className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("bank_name")}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "ชื่อธนาคารหรือผู้ให้บริการ" : "Bank name or service"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <Input
                                    type="text"
                                    size="sm"
                                    value={bankName}
                                    disabled={isPending}
                                    onChange={(e) => setBankName(e.target.value)}
                                    placeholder="PromptPay / ธนาคาร"
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 5.3 Account Holder Name */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <UserCheck className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("account_name")}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "ชื่อเจ้าของบัญชีรับเงิน" : "Account holder name"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <Input
                                    type="text"
                                    size="sm"
                                    value={bankAccountName}
                                    disabled={isPending}
                                    onChange={(e) => setBankAccountName(e.target.value)}
                                    placeholder={t("account_name_placeholder")}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {state.error && (
                            <div className="mx-4 text-xs font-medium text-destructive bg-destructive/10 rounded-sm border border-destructive/20 p-2.5">
                                {state.error}
                            </div>
                        )}
                    </div>

                    {/* Dialog-style Footer */}
                    <div className="shrink-0 flex flex-row items-center justify-end gap-2 border-t p-3 sm:px-6 sm:py-3.5 bg-card">
                        <Button
                            size="sm"
                            type="submit"
                            disabled={isPending}
                            className="w-full sm:w-auto min-w-[140px]"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                    {t("setting_up")}
                                </>
                            ) : (
                                t("setup_btn")
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
