"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfile } from "@/actions/common/user";
import { Loader2, Camera, Mail, User, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Profile } from "@/types";
import { LogoUploader } from "@/components/shared/logo-uploader";
import { SettingsUser } from "./settings-view";
import { cn } from "@/lib/utils";
import { Header } from "../ui/header";

export function ProfileForm({
    user,
    profile,
    onSuccess,
    className,
}: {
    user: SettingsUser;
    profile?: Profile;
    onSuccess?: () => void;
    className?: string;
}) {
    const t = useTranslations("Profile");
    const tCommon = useTranslations("Common");
    const tTeam = useTranslations("Team");
    const locale = useLocale();
    const isThai = locale === "th";
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    // Initial values
    const initialAvatarUrl = profile?.profile_img || user?.user_metadata?.avatar_url || null;
    const initialFullName = profile?.full_name || user?.user_metadata?.full_name || "";
    const initialPhone = profile?.phone || "";

    // Form states
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(initialAvatarUrl);
    const [removeAvatar, setRemoveAvatar] = useState(false);
    const [fullName, setFullName] = useState(initialFullName);
    const [phone, setPhone] = useState(initialPhone);

    // Track last modified field
    const [lastModifiedField, setLastModifiedField] = useState<'avatar' | 'fullName' | 'phone' | null>(null);

    // Sync when props change
    useEffect(() => {
        setFullName(initialFullName);
        setPhone(initialPhone);
        setPreviewUrl(initialAvatarUrl);
        setSelectedFile(null);
        setRemoveAvatar(false);
        setLastModifiedField(null);
    }, [initialFullName, initialPhone, initialAvatarUrl]);

    // Check dirty state
    const isAvatarDirty = selectedFile !== null || removeAvatar || previewUrl !== initialAvatarUrl;
    const isFullNameDirty = fullName !== initialFullName;
    const isPhoneDirty = phone !== initialPhone;
    const isDirty = isAvatarDirty || isFullNameDirty || isPhoneDirty;

    // Determine which field should display the action buttons
    const activeActionField: 'avatar' | 'fullName' | 'phone' | null = !isDirty
        ? null
        : lastModifiedField && (
            (lastModifiedField === 'avatar' && isAvatarDirty) ||
            (lastModifiedField === 'fullName' && isFullNameDirty) ||
            (lastModifiedField === 'phone' && isPhoneDirty)
        )
        ? lastModifiedField
        : isPhoneDirty
        ? 'phone'
        : isFullNameDirty
        ? 'fullName'
        : isAvatarDirty
        ? 'avatar'
        : null;

    const handleReset = () => {
        setSelectedFile(null);
        setPreviewUrl(initialAvatarUrl);
        setRemoveAvatar(false);
        setFullName(initialFullName);
        setPhone(initialPhone);
        setLastModifiedField(null);
    };

    async function handleUpdate(formData: FormData) {
        setIsLoading(true);

        if (selectedFile) {
            formData.append("avatar", selectedFile);
        }
        formData.append("existing_avatar_url", previewUrl || "");
        formData.append("remove_avatar", removeAvatar ? "true" : "false");
        formData.append("fullName", fullName);
        formData.append("phone", phone);

        const result = await updateProfile(formData);
        setIsLoading(false);

        if (result?.error) {
            toast({
                title: tCommon("error"),
                description: result.error,
                variant: "destructive",
            });
        } else {
            toast({
                title: tCommon("success"),
                description: isThai ? "อัปเดตข้อมูลโปรไฟล์สำเร็จเรียบร้อยแล้ว" : "Profile updated successfully",
            });
            setLastModifiedField(null);
            setSelectedFile(null);
            setRemoveAvatar(false);
            if (onSuccess) {
                onSuccess();
            }
        }
    }

    const renderActionButtons = () => (
        <div className="flex items-center gap-2 pt-4 animate-in fade-in-50 duration-200">
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={handleReset}
                className="text-xs"
            >
                {isThai ? "ยกเลิก" : "Cancel"}
            </Button>
            <Button
                type="submit"
                size="sm"
                disabled={isLoading}
                variant="default"
                className="text-xs font-semibold"
            >
                {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : null}
                <span>{tCommon("save")}</span>
            </Button>
        </div>
    );

    return (
        <div className={cn("p-4 space-y-4", className)}>
            {/* Card Section Header */}
            <div>
                <Header level={4}>
                    {isThai ? "ข้อมูลโปรไฟล์" : "Profile Information"}
                </Header>
                <p className="text-xs text-muted-foreground">
                    {isThai
                        ? "จัดการข้อมูลส่วนตัว รูปโปรไฟล์ และข้อมูลการติดต่อสำหรับบัญชีของคุณ"
                        : "Manage your personal info, avatar, and contact details."}
                </p>
            </div>

            <form action={handleUpdate}>
                {/* 1. Avatar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <Camera className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {tTeam("upload_logo") || (isThai ? "รูปโปรไฟล์" : "Profile Avatar")}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "รูปภาพประจำตัวที่จะแสดงในระบบ" : "Avatar image displayed across the platform."}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 flex flex-col items-start gap-1">
                        <LogoUploader
                            id="profile-avatar"
                            initialUrl={previewUrl}
                            onFileChange={(file) => {
                                setSelectedFile(file);
                                setRemoveAvatar(false);
                                setLastModifiedField('avatar');
                                if (file) {
                                    setPreviewUrl(URL.createObjectURL(file));
                                } else {
                                    setPreviewUrl(null);
                                }
                            }}
                            onRemove={() => {
                                setSelectedFile(null);
                                setPreviewUrl(null);
                                setRemoveAvatar(true);
                                setLastModifiedField('avatar');
                            }}
                            uploadLabel={tTeam("upload_logo") || (isThai ? "อัปโหลดรูปโปรไฟล์" : "Upload Photo")}
                            clickToUploadLabel={tTeam("click_to_upload") || (isThai ? "เปลี่ยนรูปภาพ" : "Change Photo")}
                            previewLabel={tCommon("preview") || "Preview"}
                            imageFit="cover"
                        />
                        {activeActionField === 'avatar' && renderActionButtons()}
                    </div>
                </div>

                {/* 2. Email */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <Mail className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {t("email")}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "อีเมลที่ใช้เข้าสู่ระบบ" : "Primary login email"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3">
                        <Input
                            size="sm"
                            id="email"
                            value={user?.email}
                            disabled
                            className="bg-muted/40 text-muted-foreground cursor-not-allowed w-full"
                        />
                    </div>
                </div>

                {/* 3. Full Name */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <User className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {isThai ? "ชื่อ-นามสกุล / ชื่อแสดงในระบบ" : "Full Name / Display Name"}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "ชื่อที่ใช้แสดงผลในระบบ" : "Your public display name"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 space-y-1">
                        <Input
                            size="sm"
                            id="fullName"
                            name="fullName"
                            value={fullName}
                            onChange={(e) => {
                                setFullName(e.target.value);
                                setLastModifiedField('fullName');
                            }}
                            placeholder={isThai ? "สมชาย ใจดี" : "John Doe"}
                            required
                            className="w-full"
                        />
                        {activeActionField === 'fullName' && renderActionButtons()}
                    </div>
                </div>

                {/* 4. Phone */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <Phone className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {isThai ? "เบอร์โทรศัพท์ติดต่อ" : "Contact Phone Number"}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "เบอร์โทรสำหรับติดต่อประสานงาน" : "For contact and communication"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 space-y-1">
                        <Input
                            size="sm"
                            id="phone"
                            name="phone"
                            value={phone}
                            onChange={(e) => {
                                setPhone(e.target.value);
                                setLastModifiedField('phone');
                            }}
                            placeholder="081-234-5678"
                            className="w-full"
                        />
                        {activeActionField === 'phone' && renderActionButtons()}
                    </div>
                </div>
            </form>
        </div>
    );
}
