"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { 
    Loader2, 
    ArrowRight, 
    Camera, 
    ChevronDown, 
    UserPlus, 
    Check, 
    Calendar,
    Mars,
    Venus,
    Footprints,
    Hand,
    X
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger, DropdownValue } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { RadioBtn } from "@/components/ui/radio-btn";
import { useToast } from "@/hooks/use-toast";
import { addPlayer } from "@/actions/manager/team";
import { searchMasterPlayers } from "@/actions/common/user";
import { validateUploadedFile } from "@/lib/file-validation";
import { compressAndConvertToAvif } from "@/lib/image-compression";
import { getPositionOptions } from "@/lib/positions";
import { cn } from "@/lib/utils";
import { resolveStorageUrl } from "@/lib/storage-utils";
import { isEnglishOrLatin, parseFullName } from "@/lib/name-helper";

interface AddPlayerFormProps {
    teamId: string;
    onSuccess: () => Promise<void>;
    effectivelyLocked: boolean;
    sport?: string;
    className?: string;
    addPlayerFn?: (teamId: string, formData: FormData) => Promise<import("@/types").ActionResponse>;
}

interface MasterPlayerSearchResult {
    id: string;
    name: string;
    first_name_local?: string | null;
    middle_name_local?: string | null;
    last_name_local?: string | null;
    first_name_intl?: string | null;
    middle_name_intl?: string | null;
    last_name_intl?: string | null;
    first_name_th?: string | null;
    middle_name_th?: string | null;
    last_name_th?: string | null;
    first_name_en?: string | null;
    middle_name_en?: string | null;
    last_name_en?: string | null;
    nickname?: string | null;
    date_of_birth: string | null;
    tel: string | null;
    photo_url: string | null;
    gender?: string | null;
    preferred_hand?: string | null;
    preferred_foot?: string | null;
}

interface MasterPlayerRow {
    id: string;
    name?: string;
    first_name?: string;
    middle_name?: string | null;
    last_name?: string;
    first_name_local?: string | null;
    middle_name_local?: string | null;
    last_name_local?: string | null;
    first_name_intl?: string | null;
    middle_name_intl?: string | null;
    last_name_intl?: string | null;
    first_name_th?: string | null;
    middle_name_th?: string | null;
    last_name_th?: string | null;
    first_name_en?: string | null;
    middle_name_en?: string | null;
    last_name_en?: string | null;
    nickname?: string | null;
    birthday?: string | null;
    tel?: string | null;
    photo_url?: string | null;
    profile_img?: string | null;
    gender?: string | null;
    preferred_hand?: string | null;
    preferred_foot?: string | null;
}

type MemberType = "player" | "manager" | "head_coach" | "assistant_coach";

export function AddPlayerForm({ teamId, onSuccess, effectivelyLocked, sport, className, addPlayerFn }: AddPlayerFormProps) {
    const t = useTranslations("Roster");
    const tCommon = useTranslations("Common");
    const locale = useLocale();
    const isThai = locale === "th";
    const { toast } = useToast();

    // Toggle for expanded master player dropdown inputs
    const [showFullDetails, setShowFullDetails] = useState(false);

    // Primary Quick inputs
    const [memberType, setMemberType] = useState<MemberType>("player");
    const [fullName, setFullName] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [newNumber, setNewNumber] = useState("");
    const [newPosition, setNewPosition] = useState("");
    const [newTel, setNewTel] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Master Player Detailed Inputs (Expanded via Dropdown)
    const [firstNameLocal, setFirstNameLocal] = useState("");
    const [middleNameLocal, setMiddleNameLocal] = useState("");
    const [lastNameLocal, setLastNameLocal] = useState("");
    const [firstNameIntl, setFirstNameIntl] = useState("");
    const [middleNameIntl, setMiddleNameIntl] = useState("");
    const [lastNameIntl, setLastNameIntl] = useState("");
    const [nickname, setNickname] = useState("");
    const [gender, setGender] = useState("male");
    const [birthday, setBirthday] = useState("");
    const [preferredFoot, setPreferredFoot] = useState("right");
    const [preferredHand, setPreferredHand] = useState("right");

    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Search dropdown state
    const [searchResults, setSearchResults] = useState<MasterPlayerSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [selectedMasterPlayerId, setSelectedMasterPlayerId] = useState<string | null>(null);

    const positionOptions = getPositionOptions(sport);
    const sportPlayerPositions = positionOptions.filter(p => !p.category || p.category === "player");

    const memberTypeOptions = [
        { value: "player", labelTh: "นักกีฬา", labelEn: "Player" },
        { value: "manager", labelTh: "ผู้จัดการทีม", labelEn: "Team Manager" },
        { value: "head_coach", labelTh: "ผู้ฝึกสอน (โค้ช)", labelEn: "Head Coach" },
        { value: "assistant_coach", labelTh: "ผู้ช่วยผู้ฝึกสอน", labelEn: "Assistant Coach" },
    ];

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const fileCheck = validateUploadedFile(file);
            if (!fileCheck.valid) {
                toast({ title: tCommon("error"), description: fileCheck.error, variant: "destructive" });
                return;
            }
            try {
                const compressed = await compressAndConvertToAvif(file);
                setPhotoFile(compressed);
                setPhotoPreview(URL.createObjectURL(compressed));
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Failed to compress image";
                toast({ title: tCommon("error"), description: errorMessage, variant: "destructive" });
            }
        }
    };

    const handleSearch = async (val: string) => {
        const query = val.trim();
        if (!query) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const res = await searchMasterPlayers(query);
            if (res.success && res.data) {
                const mapped: MasterPlayerSearchResult[] = (res.data as MasterPlayerRow[]).map((mp) => {
                    const localFirst = mp.first_name_local || mp.first_name_th;
                    const localLast = mp.last_name_local || mp.last_name_th;
                    const intlFirst = mp.first_name_intl || mp.first_name_en;
                    const intlLast = mp.last_name_intl || mp.last_name_en;

                    const localName = [localFirst, localLast].filter(Boolean).join(" ").trim();
                    const intlName = [intlFirst, intlLast].filter(Boolean).join(" ").trim();
                    const rawName = mp.name || (isThai ? (localName || intlName) : (intlName || localName));
                    const cleanName = (rawName || "").replace(/\s*-\s*$/, "").trim();

                    return {
                        id: mp.id,
                        name: cleanName || (isThai ? "ไม่มีชื่อ" : "Unnamed Player"),
                        first_name_local: localFirst,
                        middle_name_local: mp.middle_name_local || mp.middle_name_th,
                        last_name_local: localLast,
                        first_name_intl: intlFirst,
                        middle_name_intl: mp.middle_name_intl || mp.middle_name_en,
                        last_name_intl: intlLast,
                        first_name_th: localFirst,
                        middle_name_th: mp.middle_name_local || mp.middle_name_th,
                        last_name_th: localLast,
                        first_name_en: intlFirst,
                        middle_name_en: mp.middle_name_intl || mp.middle_name_en,
                        last_name_en: intlLast,
                        nickname: mp.nickname,
                        date_of_birth: mp.birthday || null,
                        tel: mp.tel || null,
                        photo_url: resolveStorageUrl(mp.photo_url || mp.profile_img || null),
                        gender: mp.gender || null,
                        preferred_hand: mp.preferred_hand || null,
                        preferred_foot: mp.preferred_foot || null,
                    };
                });
                setSearchResults(mapped);
            } else {
                setSearchResults([]);
            }
        } catch (err) {
            console.error("Error searching global players:", err);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleFullNameChange = (val: string) => {
        setFullName(val);
        const parsed = parseFullName(val);
        setFirstName(parsed.firstName);
        setLastName(parsed.lastName);

        if (isEnglishOrLatin(val)) {
            setFirstNameIntl(parsed.firstName);
            setMiddleNameIntl(parsed.middleName);
            setLastNameIntl(parsed.lastName);
            if (isEnglishOrLatin(firstNameLocal)) {
                setFirstNameLocal("");
                setMiddleNameLocal("");
                setLastNameLocal("");
            }
        } else {
            setFirstNameLocal(parsed.firstName);
            setMiddleNameLocal(parsed.middleName);
            setLastNameLocal(parsed.lastName);
        }

        if (selectedMasterPlayerId) {
            setSelectedMasterPlayerId(null);
        }

        const query = val.trim();
        if (query.length > 0) {
            setIsPopoverOpen(true);
            handleSearch(query);
        } else {
            setIsPopoverOpen(false);
            setSearchResults([]);
        }
    };
    const handleSelectGlobalPlayer = (gp: MasterPlayerSearchResult) => {
        const localFirst = gp.first_name_local || gp.first_name_th || "";
        const localLast = gp.last_name_local || gp.last_name_th || "";
        const intlFirst = gp.first_name_intl || gp.first_name_en || "";
        const intlLast = gp.last_name_intl || gp.last_name_en || "";

        const chosenFirst = (isThai ? (localFirst || intlFirst) : (intlFirst || localFirst)) || "";
        const chosenLast = (isThai ? (localLast || intlLast) : (intlLast || localLast)) || "";

        const displayName = gp.name || [chosenFirst, chosenLast].filter(Boolean).join(" ");
        setFullName(displayName);

        if (chosenFirst) {
            setFirstName(chosenFirst);
            setLastName(chosenLast || "");
        } else {
            const parts = parseFullName(displayName);
            setFirstName(parts.firstName || "");
            setLastName(parts.lastName || "");
        }

        // Fill detailed fields
        if (localFirst) setFirstNameLocal(localFirst);
        if (gp.middle_name_local || gp.middle_name_th) setMiddleNameLocal(gp.middle_name_local || gp.middle_name_th || "");
        if (localLast && localLast !== "-") setLastNameLocal(localLast);
        if (intlFirst) setFirstNameIntl(intlFirst);
        if (gp.middle_name_intl || gp.middle_name_en) setMiddleNameIntl(gp.middle_name_intl || gp.middle_name_en || "");
        if (intlLast && intlLast !== "-") setLastNameIntl(intlLast);
        if (gp.nickname) setNickname(gp.nickname);
        if (gp.gender) setGender(gp.gender);
        if (gp.preferred_hand) setPreferredHand(gp.preferred_hand);
        if (gp.preferred_foot) setPreferredFoot(gp.preferred_foot);
        if (gp.date_of_birth) setBirthday(gp.date_of_birth.substring(0, 10));

        if (gp.tel) setNewTel(gp.tel);
        if (gp.photo_url) setPhotoPreview(gp.photo_url);
        setSelectedMasterPlayerId(gp.id);
        setIsPopoverOpen(false);
        setSearchResults([]);
    };

    const handleClearSelectedMaster = () => {
        setSelectedMasterPlayerId(null);
    };

    const handleAddPlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        const effectiveFull = fullName.trim();
        const parsed = parseFullName(effectiveFull);
        const effectiveFirst = parsed.firstName || firstName.trim() || firstNameLocal.trim() || firstNameIntl.trim();
        const effectiveMiddle = parsed.middleName || middleNameLocal.trim() || middleNameIntl.trim();
        const effectiveLast = parsed.lastName || lastName.trim() || lastNameLocal.trim() || lastNameIntl.trim();

        if (!effectiveFirst) return;

        setIsSaving(true);
        const formData = new FormData();
        const submissionName = effectiveFull || `${effectiveFirst} ${effectiveLast}`.trim();
        
        formData.append("name", submissionName);

        const isEng = isEnglishOrLatin(submissionName);
        const localFirst = firstNameLocal.trim() || (!isEng ? effectiveFirst : "");
        const localMiddle = middleNameLocal.trim() || (!isEng ? effectiveMiddle : "");
        const localLast = lastNameLocal.trim() || (!isEng ? effectiveLast : "");
        const intlFirst = firstNameIntl.trim() || (isEng ? effectiveFirst : "");
        const intlMiddle = middleNameIntl.trim() || (isEng ? effectiveMiddle : "");
        const intlLast = lastNameIntl.trim() || (isEng ? effectiveLast : "");

        formData.append("first_name_local", localFirst);
        formData.append("middle_name_local", localMiddle);
        formData.append("last_name_local", localLast);
        formData.append("first_name_intl", intlFirst);
        formData.append("middle_name_intl", intlMiddle);
        formData.append("last_name_intl", intlLast);
        // Backward compatibility keys
        formData.append("firstNameTh", localFirst);
        formData.append("middleNameTh", localMiddle);
        formData.append("lastNameTh", localLast);
        formData.append("firstNameEn", intlFirst);
        formData.append("middleNameEn", intlMiddle);
        formData.append("lastNameEn", intlLast);
        formData.append("first_name_th", localFirst);
        formData.append("middle_name_th", localMiddle);
        formData.append("last_name_th", localLast);
        formData.append("first_name_en", intlFirst);
        formData.append("middle_name_en", middleNameIntl.trim());
        formData.append("last_name_en", intlLast);
        formData.append("first_name", effectiveFirst);
        formData.append("last_name", effectiveLast);
        formData.append("nickname", nickname.trim());
        formData.append("gender", gender);
        formData.append("birthday", birthday);
        formData.append("date_of_birth", birthday);
        formData.append("preferred_hand", preferredHand);
        formData.append("preferred_foot", preferredFoot);

        // Resolve position based on memberType
        let resolvedPosition = newPosition;
        if (memberType === "manager") resolvedPosition = "ผู้จัดการทีม";
        else if (memberType === "head_coach") resolvedPosition = "ผู้ฝึกสอน";
        else if (memberType === "assistant_coach") resolvedPosition = "ผู้ช่วยผู้ฝึกสอน";

        formData.append("position", resolvedPosition);
        if (memberType === "player" && newNumber.trim()) {
            formData.append("number", newNumber.trim());
        }
        formData.append("tel", newTel.trim());

        if (selectedMasterPlayerId) {
            formData.append("master_player_id", selectedMasterPlayerId);
        }
        if (photoFile) {
            formData.append("photo", photoFile);
        }

        const submitFn = addPlayerFn || addPlayer;
        const result = await submitFn(teamId, formData);
        setIsSaving(false);

        if (result.success) {
            toast({ title: tCommon("success"), description: t("added_success") });
            setFullName("");
            setFirstName("");
            setLastName("");
            setFirstNameLocal("");
            setMiddleNameLocal("");
            setLastNameLocal("");
            setFirstNameIntl("");
            setMiddleNameIntl("");
            setLastNameIntl("");
            setNickname("");
            setBirthday("");
            setNewNumber("");
            setNewPosition("");
            setNewTel("");
            setSelectedMasterPlayerId(null);
            setPhotoFile(null);
            setPhotoPreview(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            onSuccess();
        } else {
            toast({ title: tCommon("error"), description: result.error, variant: "destructive" });
        }
    };

    return (
        <div className={cn("bg-card border relative rounded-sm p-2 md:p-4", className)}>
            {/* Top Bar: Title & Linked Master Badge */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                    {selectedMasterPlayerId && (
                        <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                            <Check className="h-4 w-4" />
                            <span>{isThai ? "เชื่อมโยงโปรไฟล์กลางแล้ว" : "Linked Master Player"}</span>
                            <button
                                type="button"
                                onClick={handleClearSelectedMaster}
                                className="hover:opacity-75 ml-0.5"
                                title={isThai ? "ยกเลิกการเชื่อมโยง" : "Unlink"}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <form onSubmit={handleAddPlayer} className="space-y-3">
                {/* Member Type / Role Selection */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                        {isThai ? "ประเภท:" : "Type:"}
                    </span>
                    {memberTypeOptions.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                                setMemberType(opt.value as MemberType);
                                if (opt.value !== "player") {
                                    setNewPosition("");
                                    setNewNumber("");
                                }
                            }}
                            className={cn(
                                "px-2.5 py-1 text-xs rounded-sm font-medium transition-all border",
                                memberType === opt.value
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                    : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-transparent"
                            )}
                        >
                            {isThai ? opt.labelTh : opt.labelEn}
                        </button>
                    ))}
                </div>

                {/* Main Row */}
                <div className="flex flex-wrap items-end gap-2 relative">
                    {/* Photo Uploader */}
                    <div className="space-y-1 shrink-0 flex flex-col items-center">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            ref={fileInputRef}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            title={isThai ? "อัปโหลดรูปภาพ" : "Upload photo"}
                            className="h-8 w-8 rounded-full border-2 border-dashed transition-all flex items-center justify-center overflow-hidden relative group hover:border-primary/50 bg-muted/20"
                        >
                            {photoPreview ? (
                                <Image src={photoPreview} alt="Preview" width={32} height={32} className="h-full w-full object-cover" />
                            ) : (
                                <Camera className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all" />
                            )}
                        </button>
                    </div>

                    {/* Full Name (ชื่อ - นามสกุล) with Master Search Popover */}
                    <div className="space-y-1 flex-1 sm:flex-[2] min-w-[200px] relative">
                        <Label className="text-[11px]">
                            {isThai ? "ชื่อ - นามสกุล" : "Full Name"} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            value={fullName}
                            onChange={e => handleFullNameChange(e.target.value)}
                            placeholder={isThai ? "สมชาย ใจดี" : "John Doe"}
                            size="sm"
                            onFocus={() => {
                                if (fullName.trim().length > 0) {
                                    setIsPopoverOpen(true);
                                    handleSearch(fullName.trim());
                                }
                            }}
                            onBlur={() => {
                                setTimeout(() => setIsPopoverOpen(false), 250);
                            }}
                            required
                            className="focus-visible:ring-0 w-full text-xs"
                        />
                    </div>

                    {/* Player Specific: Number & Position */}
                    {memberType === "player" && (
                        <>
                            <div className="space-y-1 w-[70px] shrink-0">
                                <Label className="text-[11px]">{t("number")}</Label>
                                <Input
                                    value={newNumber}
                                    onChange={e => setNewNumber(e.target.value)}
                                    type="text"
                                    size="sm"
                                    placeholder="10"
                                    className="focus-visible:ring-0 text-xs text-center"
                                />
                            </div>

                            <div className="space-y-1 w-[130px] shrink-0">
                                <Label className="text-[11px]">{t("position")}</Label>
                                <Dropdown value={newPosition} onValueChange={setNewPosition}>
                                    <DropdownTrigger size="sm" className="w-full focus-visible:ring-0 text-xs">
                                        <DropdownValue placeholder={isThai ? "เลือกตำแหน่ง" : "Select position"} />
                                    </DropdownTrigger>
                                    <DropdownContent>
                                        {sportPlayerPositions.map((pos) => (
                                            <DropdownItem key={pos.value} value={pos.value} className="text-xs">
                                                {isThai ? pos.labelTh : pos.labelEn}
                                            </DropdownItem>
                                        ))}
                                    </DropdownContent>
                                </Dropdown>
                            </div>
                        </>
                    )}

                    {/* Phone Number */}
                    <div className="space-y-1 w-[120px] shrink-0">
                        <Label className="text-[11px]">{t("tel") || (isThai ? "เบอร์โทรศัพท์" : "Phone")}</Label>
                        <Input
                            value={newTel}
                            onChange={e => setNewTel(e.target.value)}
                            type="tel"
                            size="sm"
                            placeholder={isThai ? "081-xxx-xxxx" : "Phone number"}
                            className="focus-visible:ring-0 text-xs"
                        />
                    </div>

                    {/* Submit Button */}
                    <div className="shrink-0 w-full sm:w-auto">
                        <Button
                            type="submit"
                            size="sm"
                            className="w-full sm:w-auto h-8 px-4 text-xs font-bold"
                            disabled={isSaving || !fullName.trim() || effectivelyLocked}
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <UserPlus className="h-4 w-4" />
                            )}
                            {isThai ? "เพิ่มข้อมูล" : "Add Member"}
                        </Button>
                    </div>

                    {/* Master Player Search Auto-Suggest Popover */}
                    {isPopoverOpen && (isSearching || searchResults.length > 0) && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-[100] rounded-sm border border-border bg-card text-foreground shadow-2xl max-h-[260px] overflow-y-auto custom-scrollbar">
                            {isSearching ? (
                                <div className="flex flex-col items-center justify-center py-6 gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    <span className="text-[10px] font-bold tracking-widest text-muted-foreground/60">
                                        {isThai ? "กำลังค้นหาฐานข้อมูลกลาง..." : "Searching master players..."}
                                    </span>
                                </div>
                            ) : (
                                <div className="p-1 space-y-0.5">
                                    <div className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground/60 border-b border-border/40 uppercase tracking-wider flex items-center justify-between">
                                        <span>{isThai ? "พบข้อมูลนักกีฬาในระบบกลาง" : "Master Player Suggestions"}</span>
                                        <span>{searchResults.length} {isThai ? "คน" : "results"}</span>
                                    </div>
                                    {searchResults.map((gp) => (
                                        <button
                                            key={gp.id}
                                            type="button"
                                            className="w-full text-left px-3 py-2 hover:bg-primary/10 rounded-sm group flex items-center justify-between transition-colors border-b border-foreground/5 last:border-0"
                                            onMouseDown={() => handleSelectGlobalPlayer(gp)}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="h-7 w-7 rounded-full bg-muted/30 border flex items-center justify-center overflow-hidden shrink-0">
                                                    {gp.photo_url ? (
                                                        <Image src={gp.photo_url} alt={gp.name} width={28} height={28} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-muted-foreground">{gp.name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-xs truncate group-hover:text-primary">{gp.name}</span>
                                                        {gp.nickname && (
                                                            <span className="text-[10px] text-muted-foreground/80 font-normal">
                                                                ({gp.nickname})
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground/60">
                                                        {gp.date_of_birth && <span>DOB: {gp.date_of_birth}</span>}
                                                        {gp.tel && <span>Tel: {gp.tel}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ========================================================= */}
                {/* Collapsible Section: Detailed Player Fields */}
                {/* ========================================================= */}
                {showFullDetails && (
                    <div className="mt-3 space-y-3.5 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                        {/* Local Name Grid */}
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-semibold text-muted-foreground">
                                {isThai ? "ชื่อ - นามสกุล (ภาษาท้องถิ่น เช่น ไทย, เวียดนาม)" : "Full Name (Local Language)"}
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <Input
                                        value={firstNameLocal}
                                        onChange={e => {
                                            setFirstNameLocal(e.target.value);
                                            if (isThai && !isEnglishOrLatin(e.target.value)) { setFirstName(e.target.value); setFullName([e.target.value, lastNameLocal].filter(Boolean).join(" ")); }
                                        }}
                                        placeholder={isThai ? "ชื่อจริง (ภาษาท้องถิ่น)" : "First name (Local)"}
                                        size="sm"
                                        className="text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Input
                                        value={middleNameLocal}
                                        onChange={e => setMiddleNameLocal(e.target.value)}
                                        placeholder={isThai ? "ชื่อกลาง (ถ้ามี)" : "Middle name (Local)"}
                                        size="sm"
                                        className="text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Input
                                        value={lastNameLocal}
                                        onChange={e => {
                                            setLastNameLocal(e.target.value);
                                            if (isThai && !isEnglishOrLatin(e.target.value)) { setLastName(e.target.value); setFullName([firstNameLocal, e.target.value].filter(Boolean).join(" ")); }
                                        }}
                                        placeholder={isThai ? "นามสกุล (ภาษาท้องถิ่น)" : "Last name (Local)"}
                                        size="sm"
                                        className="text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* International Name Grid */}
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-semibold text-muted-foreground">
                                {isThai ? "ชื่อ - นามสกุล (ภาษาสากล / ภาษาอังกฤษ)" : "Full Name (International / English)"}
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <Input
                                        value={firstNameIntl}
                                        onChange={e => {
                                            setFirstNameIntl(e.target.value);
                                            if (!isThai || isEnglishOrLatin(e.target.value)) { setFirstName(e.target.value); setFullName([e.target.value, lastNameIntl].filter(Boolean).join(" ")); }
                                        }}
                                        placeholder={isThai ? "ชื่อจริง (English)" : "First name (Intl)"}
                                        size="sm"
                                        className="text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Input
                                        value={middleNameIntl}
                                        onChange={e => setMiddleNameIntl(e.target.value)}
                                        placeholder={isThai ? "ชื่อกลาง (English)" : "Middle name (Intl)"}
                                        size="sm"
                                        className="text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Input
                                        value={lastNameIntl}
                                        onChange={e => {
                                            setLastNameIntl(e.target.value);
                                            if (!isThai || isEnglishOrLatin(e.target.value)) { setLastName(e.target.value); setFullName([firstNameIntl, e.target.value].filter(Boolean).join(" ")); }
                                        }}
                                        placeholder={isThai ? "นามสกุล (English)" : "Last name (Intl)"}
                                        size="sm"
                                        className="text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Personal Details: Nickname, Gender, Birthday */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {/* Nickname */}
                            <div className="space-y-1">
                                <Label className="text-[11px]">{isThai ? "ชื่อเล่น" : "Nickname"}</Label>
                                <Input
                                    value={nickname}
                                    onChange={e => setNickname(e.target.value)}
                                    placeholder={isThai ? "บอย, ตั้ม" : "Nick"}
                                    size="sm"
                                    className="text-xs"
                                />
                            </div>

                            {/* Gender */}
                            <div className="space-y-1">
                                <Label className="text-[11px]">{isThai ? "เพศ" : "Gender"}</Label>
                                <RadioBtn
                                    value={gender}
                                    onChange={setGender}
                                    sports={[
                                        {
                                            id: "male",
                                            sport_name: isThai ? "ชาย" : "Male",
                                            icon: <Mars className="h-4 w-4 text-blue-500" />,
                                        },
                                        {
                                            id: "female",
                                            sport_name: isThai ? "หญิง" : "Female",
                                            icon: <Venus className="h-4 w-4 text-pink-500" />,
                                        },
                                    ]}
                                />
                            </div>

                            {/* Birthday */}
                            <div className="space-y-1">
                                <Label className="text-[11px] flex items-center gap-1">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    {isThai ? "วันเกิด" : "Date of Birth"}
                                </Label>
                                <DatePicker
                                    value={birthday}
                                    onChange={setBirthday}
                                    size="sm"
                                    minYear={1940}
                                    maxYear={new Date().getFullYear()}
                                    defaultViewYear={2000}
                                    placeholder={isThai ? "เลือกวันเกิด" : "Select date"}
                                    className="text-xs"
                                />
                            </div>
                        </div>

                        {/* Sports Skill Details: Preferred Foot & Preferred Hand */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            {/* Preferred Foot */}
                            <div className="space-y-1">
                                <Label className="text-[11px] flex items-center gap-1">
                                    <Footprints className="h-4 w-4 text-muted-foreground" />
                                    {isThai ? "เท้าที่ถนัด" : "Preferred Foot"}
                                </Label>
                                <RadioBtn
                                    value={preferredFoot}
                                    onChange={setPreferredFoot}
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

                            {/* Preferred Hand */}
                            <div className="space-y-1">
                                <Label className="text-[11px] flex items-center gap-1">
                                    <Hand className="h-4 w-4 text-muted-foreground" />
                                    {isThai ? "มือที่ถนัด" : "Preferred Hand"}
                                </Label>
                                <RadioBtn
                                    value={preferredHand}
                                    onChange={setPreferredHand}
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
                        </div>
                    </div>
                )}

                {/* Expand / Collapse Details Button: Compact Badge Style */}
                <div className="flex items-center justify-center pt-1.5">
                    <button
                        type="button"
                        onClick={() => setShowFullDetails(prev => !prev)}
                        className={cn(
                            "inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer shadow-2xs select-none",
                            showFullDetails
                                ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20"
                                : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/70 hover:border-primary/40"
                        )}
                    >
                        <span>
                            {showFullDetails 
                                ? (isThai ? "ซ่อนรายละเอียด" : "Hide Details") 
                                : (isThai ? "+ รายละเอียดเพิ่มเติม" : "+ More Details")}
                        </span>
                        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", showFullDetails && "rotate-180")} />
                    </button>
                </div>
            </form>
        </div>
    );
}


