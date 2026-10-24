"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createMasterPlayer, searchMasterPlayers, claimMasterPlayer } from "@/actions/common/user";
import { updateGlobalPlayerInfo, updateGlobalPlayerPhoto } from "@/actions/tournaments/master-player";
import { getSports } from "@/actions/manager/team";
import { Sport } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoUploader } from "@/components/shared/logo-uploader";
import { Tab } from "@/components/ui/tab";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AlertCircle, Loader2, Mars, Venus, UserCheck, Link as LinkIcon, Search, Hand, Footprints } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { RadioBtn } from "@/components/ui/radio-btn";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/shared/empty-state";
import { MasterPlayer } from "@/features/dashboard/dashboard-client";

interface VerifyPlayerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    masterPlayer: MasterPlayer | null;
    initialTab?: "create" | "claim";
    onSuccess: (updatedPlayer: MasterPlayer) => void;
}

export function VerifyPlayerDialog({
    open,
    onOpenChange,
    masterPlayer,
    initialTab = "create",
    onSuccess,
}: VerifyPlayerDialogProps) {
    const locale = useLocale();
    const isThai = locale === "th";
    const _t = useTranslations("Dashboard");
    const router = useRouter();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [activeTab, setActiveTab] = useState<"create" | "claim">(initialTab);

    // Form inputs state
    const [firstNameTh, setFirstNameTh] = useState(() => masterPlayer?.first_name_th || "");
    const [middleNameTh, setMiddleNameTh] = useState(() => masterPlayer?.middle_name_th || "");
    const [lastNameTh, setLastNameTh] = useState(() => masterPlayer?.last_name_th || "");
    const [firstNameEn, setFirstNameEn] = useState(() => masterPlayer?.first_name_en || "");
    const [middleNameEn, setMiddleNameEn] = useState(() => masterPlayer?.middle_name_en || "");
    const [lastNameEn, setLastNameEn] = useState(() => masterPlayer?.last_name_en || "");
    const [tel, setTel] = useState(() => masterPlayer?.tel || "");
    const [gender, setGender] = useState(() => masterPlayer?.gender || "male");
    const [birthday, setBirthday] = useState(() => (masterPlayer?.birthday ? masterPlayer.birthday.substring(0, 10) : ""));
    const [favoriteSportId, setFavoriteSportId] = useState(() => masterPlayer?.favorite_sport_id || "");
    const [preferredHand, setPreferredHand] = useState(() => masterPlayer?.preferred_hand || "right");
    const [preferredFoot, setPreferredFoot] = useState(() => masterPlayer?.preferred_foot || "right");

    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(() => masterPlayer?.profile_img || null);
    const [error, setError] = useState<string | null>(null);

    // Claim state
    const [claimQuery, setClaimQuery] = useState("");
    const [searchResults, setSearchResults] = useState<MasterPlayer[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [claimingId, setClaimingId] = useState<string | null>(null);

    // Sports
    const [sportsList, setSportsList] = useState<Sport[]>([]);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            getSports().then((res) => {
                if (res.success && res.data) {
                    setSportsList(res.data);
                }
            });
        }
    }, [open]);

    // Ensure scroll position is reset to top when dialog opens or activeTab switches
    useEffect(() => {
        if (open) {
            const timer = setTimeout(() => {
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = 0;
                }
            }, 10);
            return () => clearTimeout(timer);
        }
    }, [open, activeTab]);

    // Track previous open state to reset form when opening
    const prevOpenRef = useRef(open);
    useEffect(() => {
        if (open) {
            if (!prevOpenRef.current) {
                setActiveTab(initialTab);
                setError(null);

                if (masterPlayer) {
                    setFirstNameTh(masterPlayer.first_name_th || "");
                    setMiddleNameTh(masterPlayer.middle_name_th || "");
                    setLastNameTh(masterPlayer.last_name_th || "");
                    setFirstNameEn(masterPlayer.first_name_en || "");
                    setMiddleNameEn(masterPlayer.middle_name_en || "");
                    setLastNameEn(masterPlayer.last_name_en || "");
                    setTel(masterPlayer.tel || "");
                    setGender(masterPlayer.gender || "male");
                    const bday = masterPlayer.birthday ? masterPlayer.birthday.substring(0, 10) : "";
                    setBirthday(bday);
                    setFavoriteSportId(masterPlayer.favorite_sport_id || "");
                    setPreferredHand(masterPlayer.preferred_hand || "right");
                    setPreferredFoot(masterPlayer.preferred_foot || "right");
                    setPreviewUrl(masterPlayer.profile_img || null);
                } else {
                    setFirstNameTh("");
                    setMiddleNameTh("");
                    setLastNameTh("");
                    setFirstNameEn("");
                    setMiddleNameEn("");
                    setLastNameEn("");
                    setTel("");
                    setGender("male");
                    setBirthday("");
                    setFavoriteSportId("");
                    setPreferredHand("right");
                    setPreferredFoot("right");
                    setPhotoFile(null);
                    setPreviewUrl(null);
                }
            } else {
                setActiveTab(initialTab);
            }
        }
        prevOpenRef.current = open;
    }, [open, masterPlayer, initialTab]);

    const handleSearchClaimablePlayers = async (q: string) => {
        setClaimQuery(q);
        if (!q.trim()) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        const res = await searchMasterPlayers(q);
        setIsSearching(false);
        if (res.success && res.data) {
            setSearchResults(
                (res.data as MasterPlayer[]).filter(
                    (mp) => !(mp as MasterPlayer & { user_id?: string }).user_id
                )
            );
        } else {
            setSearchResults([]);
        }
    };

    const handleClaimPlayer = async (targetPlayer: MasterPlayer) => {
        setError(null);
        setClaimingId(targetPlayer.id);

        startTransition(async () => {
            const res = await claimMasterPlayer(targetPlayer.id);
            setClaimingId(null);
            if (res.success && res.data) {
                onSuccess(res.data as MasterPlayer);
                onOpenChange(false);
                router.refresh();
            } else {
                setError(res.error || (isThai ? "ไม่สามารถเชื่อมโยงโปรไฟล์ได้" : "Failed to claim player profile"));
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const hasRequiredName = isThai
            ? (firstNameTh && lastNameTh)
            : (firstNameEn && lastNameEn);

        if (!hasRequiredName || !gender || !birthday) {
            toast({
                title: isThai ? "ข้อมูลไม่ครบถ้วน" : "Required Fields Missing",
                description: isThai ? "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" : "Please fill in all required fields.",
                variant: "destructive",
            });
            return;
        }

        startTransition(async () => {
            if (masterPlayer?.id) {
                // Edit existing profile
                const updateRes = await updateGlobalPlayerInfo(masterPlayer.id, {
                    first_name_th: firstNameTh || undefined,
                    middle_name_th: middleNameTh || undefined,
                    last_name_th: lastNameTh || undefined,
                    first_name_en: firstNameEn || undefined,
                    middle_name_en: middleNameEn || undefined,
                    last_name_en: lastNameEn || undefined,
                    gender,
                    date_of_birth: birthday,
                    tel: tel || null,
                    favorite_sport_id: favoriteSportId || null,
                    preferred_hand: preferredHand || null,
                    preferred_foot: preferredFoot || null,
                    profile_img: previewUrl === null ? null : undefined,
                });

                if (!updateRes.success) {
                    setError(updateRes.error || (isThai ? "เกิดข้อผิดพลาดในการบันทึกข้อมูล" : "Failed to update profile"));
                    return;
                }

                let finalProfileImg = previewUrl === null ? null : masterPlayer.profile_img;

                if (photoFile) {
                    const photoData = new FormData();
                    photoData.append("photo", photoFile);
                    const photoRes = await updateGlobalPlayerPhoto(masterPlayer.id, photoData);
                    if (photoRes.success && photoRes.data) {
                        const data = photoRes.data as unknown as { profile_img?: string };
                        if (data.profile_img) finalProfileImg = data.profile_img;
                    }
                }

                const updated: MasterPlayer = {
                    ...masterPlayer,
                    first_name_th: firstNameTh,
                    middle_name_th: middleNameTh,
                    last_name_th: lastNameTh,
                    first_name_en: firstNameEn,
                    middle_name_en: middleNameEn,
                    last_name_en: lastNameEn,
                    gender,
                    birthday,
                    tel,
                    favorite_sport_id: favoriteSportId,
                    preferred_hand: preferredHand,
                    preferred_foot: preferredFoot,
                    profile_img: finalProfileImg,
                    verified: masterPlayer.verified ?? true,
                };

                onSuccess(updated);
                onOpenChange(false);
                router.refresh();
            } else {
                // Create new profile
                const formData = new FormData();
                formData.append("firstNameTh", firstNameTh);
                formData.append("middleNameTh", middleNameTh);
                formData.append("lastNameTh", lastNameTh);
                formData.append("firstNameEn", firstNameEn);
                formData.append("middleNameEn", middleNameEn);
                formData.append("lastNameEn", lastNameEn);
                formData.append("gender", gender);
                formData.append("birthday", birthday);
                formData.append("tel", tel);
                formData.append("favoriteSportId", favoriteSportId);
                formData.append("preferredHand", preferredHand);
                formData.append("preferredFoot", preferredFoot);

                const createRes = await createMasterPlayer(formData);
                if (createRes.success && createRes.data) {
                    let createdPlayer = createRes.data as MasterPlayer;
                    if (photoFile && createdPlayer.id) {
                        const photoData = new FormData();
                        photoData.append("photo", photoFile);
                        const photoRes = await updateGlobalPlayerPhoto(createdPlayer.id, photoData);
                        if (photoRes.success && photoRes.data) {
                            const data = photoRes.data as unknown as { profile_img?: string };
                            if (data.profile_img) {
                                createdPlayer = {
                                    ...createdPlayer,
                                    profile_img: data.profile_img,
                                };
                            }
                        }
                    }

                    onSuccess(createdPlayer);
                    onOpenChange(false);
                    router.refresh();
                } else {
                    setError(createRes.error || (isThai ? "เกิดข้อผิดพลาดในการลงทะเบียน" : "Failed to create player profile"));
                }
            }
        });
    };

    const isVerified = Boolean(masterPlayer?.verified);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {isVerified
                                ? (isThai ? "แก้ไขและยืนยันข้อมูลนักกีฬา" : "Edit & Verify Athlete Profile")
                                : activeTab === "claim"
                                    ? (isThai ? "เชื่อมโยงโปรไฟล์นักกีฬาที่มีอยู่" : "Claim Existing Player Profile")
                                    : (isThai ? "ลงทะเบียนและยืนยันตัวตนนักกีฬา" : "Athlete Registration & Verification")}
                        </DialogTitle>
                        <DialogDescription>
                            {isVerified
                                ? (isThai ? "แก้ไขรายละเอียดโปรไฟล์นักกีฬาของคุณ" : "Modify your athlete profile details.")
                                : activeTab === "claim"
                                    ? (isThai ? "ค้นหาโปรไฟล์ของคุณที่มีอยู่ในระบบเพื่อทำการเชื่อมโยงกับบัญชีผู้ใช้นี้" : "Search and claim your existing athlete profile to link with this account.")
                                    : (isThai ? "กรอกข้อมูลโปรไฟล์ของคุณเพื่อใช้ในการเข้าร่วมการแข่งขันและบันทึกสถิติ" : "Fill in your profile details to participate in tournaments and track match stats.")}
                        </DialogDescription>
                    </DialogHeader>

                    {!isVerified && (
                        <div className="p-3 md:p-4 border-b shrink-0">
                            <Tab
                                options={[
                                    { value: "create", label: isThai ? "กรอกข้อมูลโปรไฟล์ใหม่" : "Create Profile", icon: UserCheck },
                                    { value: "claim", label: isThai ? "เชื่อมโยงโปรไฟล์ที่มีอยู่" : "Claim Existing Profile", icon: LinkIcon },
                                ]}
                                value={activeTab}
                                onChange={(val) => {
                                    setActiveTab(val as "create" | "claim");
                                    setError(null);
                                }}
                                fullWidth
                            />
                        </div>
                    )}

                    <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 flex flex-col space-y-4">
                        {error && (
                            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-sm text-xs flex items-start gap-2 animate-shake shrink-0">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {isVerified || activeTab === "create" ? (
                            <form id="verify-player-form" onSubmit={handleSubmit} className="space-y-2">
                                {/* Photo Uploader */}
                                <div className="flex flex-col items-center justify-center space-y-1">
                                    <LogoUploader
                                        id="verify-player-photo"
                                        initialUrl={previewUrl}
                                        onFileChange={(file) => {
                                            setPhotoFile(file);
                                            if (file) {
                                                setPreviewUrl(URL.createObjectURL(file));
                                            } else {
                                                setPreviewUrl(null);
                                            }
                                        }}
                                        onRemove={() => {
                                            setPhotoFile(null);
                                            setPreviewUrl(null);
                                        }}
                                        disabled={isPending}
                                        uploadLabel={isThai ? "อัปโหลดรูปภาพนักกีฬา" : "Upload Athlete Photo"}
                                        clickToUploadLabel={isThai ? "เปลี่ยนรูปภาพ" : "Change Photo"}
                                        previewLabel={isThai ? "รูปตัวอย่าง" : "Preview"}
                                        imageFit="cover"
                                    />
                                </div>

                                {/* Thai Name */}
                                <div className="space-y-1">
                                    <Label>{isThai ? "ชื่อ-นามสกุล (ภาษาไทย)" : "Thai Name"}</Label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">
                                                {isThai ? "ชื่อจริง" : "First Name"} {isThai && <span className="text-destructive">*</span>}
                                            </Label>
                                            <Input
                                                size="sm"
                                                type="text"
                                                value={firstNameTh}
                                                onChange={(e) => setFirstNameTh(e.target.value)}
                                                placeholder="สมชาย"
                                                disabled={isPending}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">{isThai ? "ชื่อกลาง" : "Middle Name"}</Label>
                                            <Input
                                                size="sm"
                                                type="text"
                                                value={middleNameTh}
                                                onChange={(e) => setMiddleNameTh(e.target.value)}
                                                placeholder={isThai ? "ชื่อกลาง (ถ้ามี)" : "Middle (opt)"}
                                                disabled={isPending}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">
                                                {isThai ? "นามสกุล" : "Last Name"} {isThai && <span className="text-destructive">*</span>}
                                            </Label>
                                            <Input
                                                size="sm"
                                                type="text"
                                                value={lastNameTh}
                                                onChange={(e) => setLastNameTh(e.target.value)}
                                                placeholder="ใจดี"
                                                disabled={isPending}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* English Name */}
                                <div className="space-y-1">
                                    <Label>{isThai ? "ชื่อ-นามสกุล (ภาษาอังกฤษ)" : "English Name"}</Label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">
                                                {isThai ? "First Name (EN)" : "First Name"} {!isThai && <span className="text-destructive">*</span>}
                                            </Label>
                                            <Input
                                                size="sm"
                                                type="text"
                                                value={firstNameEn}
                                                onChange={(e) => setFirstNameEn(e.target.value)}
                                                placeholder="Somchai"
                                                disabled={isPending}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-muted-foreground">{isThai ? "Middle Name" : "Middle Name"}</Label>
                                            <Input
                                                size="sm"
                                                type="text"
                                                value={middleNameEn}
                                                onChange={(e) => setMiddleNameEn(e.target.value)}
                                                placeholder="Middle (opt)"
                                                disabled={isPending}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-muted-foreground">
                                                {isThai ? "Last Name (EN)" : "Last Name"} {!isThai && <span className="text-destructive">*</span>}
                                            </Label>
                                            <Input
                                                size="sm"
                                                type="text"
                                                value={lastNameEn}
                                                onChange={(e) => setLastNameEn(e.target.value)}
                                                placeholder="Jaidee"
                                                disabled={isPending}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Contact phone */}
                                <div className="space-y-1">
                                    <Label>{isThai ? "เบอร์โทรศัพท์ติดต่อ" : "Phone Number"}</Label>
                                    <Input
                                        size="sm"
                                        type="tel"
                                        value={tel}
                                        onChange={(e) => setTel(e.target.value)}
                                        placeholder="081-234-5678"
                                        disabled={isPending}
                                    />
                                </div>

                                {/* Gender */}
                                <div className="space-y-1">
                                    <Label>{isThai ? "เพศ" : "Gender"} <span className="text-destructive">*</span></Label>
                                    <RadioBtn
                                        value={gender}
                                        onChange={setGender}
                                        disabled={isPending}
                                        sports={[
                                            {
                                                id: "male",
                                                sport_name: isThai ? "ชาย" : "Male",
                                                icon: <Mars className="h-4 w-4" />,
                                            },
                                            {
                                                id: "female",
                                                sport_name: isThai ? "หญิง" : "Female",
                                                icon: <Venus className="h-4 w-4" />,
                                            },
                                        ]}
                                    />
                                </div>

                                {/* Date of Birth */}
                                <div className="space-y-1">
                                    <Label>{isThai ? "วัน/เดือน/ปีเกิด" : "Date of Birth"} <span className="text-destructive">*</span></Label>
                                    <DatePicker
                                        size="sm"
                                        value={birthday}
                                        onChange={setBirthday}
                                        disabled={isPending}
                                        minYear={1940}
                                        maxYear={new Date().getFullYear()}
                                        defaultViewYear={2000}
                                    />
                                </div>

                                {/* Favorite Sport */}
                                <div className="space-y-1">
                                    <Label>{isThai ? "กีฬาที่ชอบ" : "Favorite Sport"}</Label>
                                    <RadioBtn
                                        value={favoriteSportId}
                                        onChange={setFavoriteSportId}
                                        sports={sportsList}
                                        disabled={isPending}
                                        placeholder={isThai ? "เลือกกีฬาที่ชอบ..." : "Select favorite sport..."}
                                    />
                                </div>

                                {/* Preferred Hand & Foot */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label>{isThai ? "มือที่ถนัด" : "Preferred Hand"}</Label>
                                        <RadioBtn
                                            value={preferredHand}
                                            onChange={setPreferredHand}
                                            disabled={isPending}
                                            sports={[
                                                {
                                                    id: "right",
                                                    sport_name: isThai ? "ขวา" : "Right",
                                                    icon: <Hand className="h-4 w-4" />,
                                                },
                                                {
                                                    id: "left",
                                                    sport_name: isThai ? "ซ้าย" : "Left",
                                                    icon: <Hand className="h-4 w-4 scale-x-[-1]" />,
                                                },
                                                {
                                                    id: "both",
                                                    sport_name: isThai ? "สองข้าง" : "Both",
                                                    icon: <Hand className="h-4 w-4" />,
                                                },
                                            ]}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Label>{isThai ? "เท้าที่ถนัด" : "Preferred Foot"}</Label>
                                        <RadioBtn
                                            value={preferredFoot}
                                            onChange={setPreferredFoot}
                                            disabled={isPending}
                                            sports={[
                                                {
                                                    id: "right",
                                                    sport_name: isThai ? "ขวา" : "Right",
                                                    icon: <Footprints className="h-4 w-4" />,
                                                },
                                                {
                                                    id: "left",
                                                    sport_name: isThai ? "ซ้าย" : "Left",
                                                    icon: <Footprints className="h-4 w-4 scale-x-[-1]" />,
                                                },
                                                {
                                                    id: "both",
                                                    sport_name: isThai ? "สองข้าง" : "Both",
                                                    icon: <Footprints className="h-4 w-4" />,
                                                },
                                            ]}
                                        />
                                    </div>
                                </div>
                            </form>
                        ) : (
                            /* Claim Tab */
                            <div className="flex-1 flex flex-col space-y-2">
                                <div className="space-y-1 shrink-0">
                                    <Label>
                                        {isThai ? "ค้นหาโปรไฟล์นักกีฬาที่มีอยู่ในระบบ" : "Search Existing Player Profile"}
                                    </Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            size="sm"
                                            placeholder={isThai ? "พิมพ์ชื่อนักกีฬา (ภาษาไทย หรือ อังกฤษ)..." : "Type player name..."}
                                            value={claimQuery}
                                            onChange={(e) => handleSearchClaimablePlayers(e.target.value)}
                                            className="pl-8 text-xs"
                                        />
                                        {isSearching && (
                                            <Loader2 className="absolute right-3 top-2 h-4 w-4 text-muted-foreground animate-spin" />
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        {isThai
                                            ? "หากเคยมีผู้จัดการทีมหรือผู้จัดแข่งขันสร้างโปรไฟล์ของคุณไว้ สามารถค้นหาชื่อเพื่อเชื่อมโยงกับบัญชีของคุณได้ทันที"
                                            : "If your profile was previously created by a team manager or tournament organizer, search for your name to claim ownership."}
                                    </p>
                                </div>

                                <div className="flex-1">
                                    {!claimQuery.trim() && (
                                        <EmptyState
                                            icon={Search}
                                            title={isThai ? "ค้นหาโปรไฟล์นักกีฬา" : "Search Athlete Profile"}
                                            description={isThai
                                                ? "พิมพ์ชื่อนักกีฬาในช่องค้นหาด้านบน เพื่อค้นหาโปรไฟล์ที่ยังไม่มีผู้ถือสิทธิ์"
                                                : "Type player name in the search box above to find unclaimed profiles."}
                                            className="h-full border border-dashed rounded-sm"
                                        />
                                    )}

                                    {claimQuery.trim() && searchResults.length === 0 && !isSearching && (
                                        <EmptyState
                                            icon={AlertCircle}
                                            title={isThai ? "ไม่พบโปรไฟล์นักกีฬา" : "No Profile Found"}
                                            description={isThai
                                                ? `ไม่พบโปรไฟล์ที่ยังไม่มีผู้ครอบครองสำหรับ "${claimQuery}"`
                                                : `No unclaimed player profiles found matching "${claimQuery}"`}
                                            className="h-full border border-dashed rounded-sm"
                                        />
                                    )}

                                    {searchResults.length > 0 && (
                                        <div className="border rounded-sm divide-y overflow-hidden">
                                            {searchResults.map((player) => {
                                                const nameTh = `${player.first_name_th || ""} ${player.middle_name_th || ""} ${player.last_name_th || ""}`.trim();
                                                const nameEn = `${player.first_name_en || ""} ${player.middle_name_en || ""} ${player.last_name_en || ""}`.trim();
                                                const displayName = nameTh || nameEn || (isThai ? "ไม่มีชื่อนักกีฬา" : "Unnamed Player");
                                                const isClaiming = claimingId === player.id;

                                                return (
                                                    <div
                                                        key={player.id}
                                                        className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-xs"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-9 w-9 border rounded-full shrink-0">
                                                                {player.profile_img && <AvatarImage src={player.profile_img} alt={displayName} className="object-cover" />}
                                                                <AvatarFallback className="font-bold text-xs">
                                                                    {displayName.charAt(0).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-foreground">{displayName}</span>
                                                                {nameEn && nameTh && (
                                                                    <span className="text-[10px] text-muted-foreground">{nameEn}</span>
                                                                )}
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {isThai ? "วันเกิด:" : "DOB:"} {player.birthday || "-"} | {isThai ? "โทร:" : "Phone:"} {player.tel || "-"}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <Button
                                                            size="sm"
                                                            disabled={isPending || isClaiming}
                                                            onClick={() => handleClaimPlayer(player)}
                                                        >
                                                            {isClaiming ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <LinkIcon className="h-4 w-4" />
                                                            )}
                                                            {isClaiming ? (isThai ? "กำลังเชื่อมโยง..." : "Claiming...") : (isThai ? "เชื่อมโยงโปรไฟล์" : "Claim Profile")}
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => onOpenChange(false)}
                        >
                            {isThai ? "ยกเลิก" : "Cancel"}
                        </Button>
                        {(isVerified || activeTab === "create") && (
                            <Button
                                size="sm"
                                type="submit"
                                form="verify-player-form"
                                disabled={isPending}
                            >
                                {isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {isThai ? "กำลังบันทึกข้อมูล..." : "Saving..."}
                                    </>
                                ) : isVerified ? (
                                    isThai ? "บันทึกการเปลี่ยนแปลง" : "Save Changes"
                                ) : (
                                    isThai ? "บันทึกและยืนยันตัวตนนักกีฬา" : "Submit & Verify Profile"
                                )}
                            </Button>
                        )}
                    </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
