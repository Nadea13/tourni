"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
    Plus, 
    Loader2, 
    ArrowRight, 
    Trash2, 
    Shield, 
    ChevronDown, 
    Calendar,
    Mars,
    Venus,
    Footprints,
    Hand
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Image from "next/image";
import { addPlayer, updatePlayer, deletePlayer } from "@/actions/manager/team";
import { searchMasterPlayers } from "@/actions/common/user";
import { updateGlobalPlayerPhoto } from "@/actions/tournaments/master-player";
import { submitTournamentRoster } from "@/actions/tournaments/registration";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger, DropdownValue } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { RadioBtn } from "@/components/ui/radio-btn";
import { getPositionOptions } from "@/lib/positions";
import { resolveStorageUrl } from "@/lib/storage-utils";
import { isEnglishOrLatin } from "@/lib/name-helper";
import { Player } from "@/types/index";
import { sortSquadPlayers } from "@/features/teams/squad-list";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LogoUploader } from "@/components/shared/logo-uploader";

type MemberType = "player" | "manager" | "head_coach" | "assistant_coach";

export interface ManageAndSubmitRosterDialogProps {
    teamId: string;
    sourceTeamId?: string;
    onSuccess: () => Promise<void> | void;
    effectivelyLocked?: boolean;
    sport?: string;
    existingPlayers?: Player[];
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export type AddPlayersDialogProps = ManageAndSubmitRosterDialogProps;
export type SubmitRosterDialogProps = ManageAndSubmitRosterDialogProps;

interface _OldAddPlayersDialogProps {
    teamId: string;
    sourceTeamId?: string;
    onSuccess: () => Promise<void>;
    effectivelyLocked: boolean;
    sport?: string;
    existingPlayers?: Player[];
}

interface BulkPlayerInput {
    id?: string;
    memberType: MemberType;
    fullName?: string;
    firstName: string;
    lastName: string;
    firstNameLocal: string;
    middleNameLocal: string;
    lastNameLocal: string;
    firstNameIntl: string;
    middleNameIntl: string;
    lastNameIntl: string;
    nickname: string;
    number: string;
    position: string;
    tel: string;
    gender: string;
    birthday: string;
    preferredFoot: string;
    preferredHand: string;
    photoFile: File | null;
    photoPreview: string | null;
    masterPlayerId?: string | null;
    isExisting?: boolean;
    showDetails?: boolean;
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

function parsePlayerName(rawName: string): { firstName: string; lastName: string; nickname: string } {
    let cleanName = rawName || "";
    let nickname = "";

    const match = cleanName.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
        cleanName = match[1].trim();
        nickname = match[2].trim();
    }

    const parts = cleanName.split(/\s+/).filter(Boolean);
    const firstName = parts[0] || "";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : (parts.length === 1 ? "" : "");

    return { firstName, lastName, nickname };
}

function detectMemberType(position?: string | null): MemberType {
    if (!position) return "player";
    const pos = position.toLowerCase().trim();
    if (pos.includes("ผู้จัดการ") || pos.includes("manager")) return "manager";
    if (pos.includes("ผู้ช่วย") || pos.includes("assistant") || pos.includes("asst")) return "assistant_coach";
    if (pos.includes("ผู้ฝึกสอน") || pos.includes("โค้ช") || pos.includes("coach")) return "head_coach";
    return "player";
}

export function ManageAndSubmitRosterDialog({ 
    teamId, 
    sourceTeamId, 
    onSuccess, 
    effectivelyLocked = false, 
    sport, 
    existingPlayers = [],
    trigger: _trigger,
    open: propOpen,
    onOpenChange: propOnOpenChange
}: ManageAndSubmitRosterDialogProps) {
    const t = useTranslations("Roster");
    const tCommon = useTranslations("Common");
    const locale = useLocale();
    const isThai = locale === "th";
    const { toast } = useToast();

    const positionOptions = getPositionOptions(sport);
    const sportPlayerPositions = positionOptions.filter(p => !p.category || p.category === "player");

    const memberTypeOptions: { value: MemberType; labelTh: string; labelEn: string }[] = [
        { value: "player", labelTh: "นักกีฬา", labelEn: "Player" },
        { value: "manager", labelTh: "ผู้จัดการ", labelEn: "Manager" },
        { value: "head_coach", labelTh: "โค้ช", labelEn: "Head Coach" },
        { value: "assistant_coach", labelTh: "ผู้ช่วยโค้ช", labelEn: "Asst. Coach" },
    ];

    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = propOpen !== undefined;
    const isBulkOpen = isControlled ? propOpen : internalOpen;
    const setIsBulkOpen = useCallback((val: boolean) => {
        if (!isControlled) {
            setInternalOpen(val);
        }
        propOnOpenChange?.(val);
    }, [isControlled, propOnOpenChange]);
    const [sourcePlayers, setSourcePlayers] = useState<Player[]>([]);

    useEffect(() => {
        if (isBulkOpen && sourceTeamId && (!existingPlayers || existingPlayers.length === 0)) {
            (async () => {
                const { getPlayers } = await import("@/actions/manager/team");
                const res = await getPlayers(sourceTeamId);
                if (res.success && res.data && res.data.length > 0) {
                    setSourcePlayers(res.data);
                }
            })();
        }
    }, [isBulkOpen, sourceTeamId, existingPlayers]);
    const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
    const [deletedPlayerIds, setDeletedPlayerIds] = useState<string[]>([]);

    const createEmptyPlayer = (): BulkPlayerInput => ({
        memberType: "player",
        fullName: "",
        firstName: "",
        lastName: "",
        firstNameLocal: "",
        middleNameLocal: "",
        lastNameLocal: "",
        firstNameIntl: "",
        middleNameIntl: "",
        lastNameIntl: "",
        nickname: "",
        number: "",
        position: "",
        tel: "",
        gender: "male",
        birthday: "",
        preferredFoot: "right",
        preferredHand: "right",
        photoFile: null,
        photoPreview: null,
        masterPlayerId: null,
        isExisting: false,
        showDetails: false
    });

    const generateInitialPlayers = useCallback((): BulkPlayerInput[] => {
        const active = (existingPlayers || []).filter(p => !p.deleted_at);
        const sorted = sortSquadPlayers(active);

        const existingInputs: BulkPlayerInput[] = sorted.map((p) => {
            const rawFullName = (p.name || `${p.first_name || ''} ${p.last_name && p.last_name !== '-' ? p.last_name : ''}`).trim();
            const { firstName, lastName, nickname } = parsePlayerName(rawFullName);
            const mType = detectMemberType(p.position);

            return {
                id: p.id,
                memberType: mType,
                fullName: rawFullName,
                firstName: p.first_name || firstName,
                lastName: p.last_name && p.last_name !== "-" ? p.last_name : lastName,
                firstNameLocal: "",
                middleNameLocal: "",
                lastNameLocal: "",
                firstNameIntl: "",
                middleNameIntl: "",
                lastNameIntl: "",
                nickname: nickname,
                number: p.number != null ? String(p.number) : "",
                position: p.position || "",
                tel: p.tel || "",
                gender: "male",
                birthday: p.birth_date || p.birthday || "",
                preferredFoot: "right",
                preferredHand: "right",
                photoFile: null,
                photoPreview: resolveStorageUrl(p.photo_url || (p as any).profile_img || null),
                masterPlayerId: p.master_player_id || p.global_player_id || null,
                isExisting: true,
                showDetails: false
            };
        });

        const extraCount = Math.max(3, 12 - existingInputs.length);
        const blankRows: BulkPlayerInput[] = Array.from({ length: extraCount }, () => createEmptyPlayer());

        if (existingInputs.length === 0 && sourcePlayers.length > 0) {
            const sourceInputs: BulkPlayerInput[] = sourcePlayers.map((p) => {
                const rawFullName = (p.name || `${p.first_name || ''} ${p.last_name && p.last_name !== '-' ? p.last_name : ''}`).trim();
                const { firstName, lastName, nickname } = parsePlayerName(rawFullName);
                const mType = detectMemberType(p.position);
                return {
                    id: undefined,
                    memberType: mType,
                    fullName: rawFullName,
                    firstName: p.first_name || firstName,
                    lastName: p.last_name && p.last_name !== "-" ? p.last_name : lastName,
                    firstNameLocal: "",
                    middleNameLocal: "",
                    lastNameLocal: "",
                    firstNameIntl: "",
                    middleNameIntl: "",
                    lastNameIntl: "",
                    nickname: nickname,
                    number: p.number != null ? String(p.number) : "",
                    position: p.position || "",
                    tel: p.tel || "",
                    gender: "male",
                    birthday: p.birth_date || p.birthday || "",
                    preferredFoot: "right",
                    preferredHand: "right",
                    photoFile: null,
                    photoPreview: resolveStorageUrl(p.photo_url || (p as any).profile_img || null),
                    masterPlayerId: p.master_player_id || p.global_player_id || null,
                    isExisting: false,
                    showDetails: false
                };
            });
            const extraCount = Math.max(3, 12 - sourceInputs.length);
            const blankRows: BulkPlayerInput[] = Array.from({ length: extraCount }, () => createEmptyPlayer());
            return [...sourceInputs, ...blankRows];
        }

        return [...existingInputs, ...blankRows];
    }, [existingPlayers, sourcePlayers]);

    const [bulkPlayers, setBulkPlayers] = useState<BulkPlayerInput[]>([]);

    useEffect(() => {
        if (isBulkOpen) {
            setDeletedPlayerIds([]);
            setBulkPlayers(generateInitialPlayers());
        }
    }, [isBulkOpen, generateInitialPlayers]);

    const [focusedBulkIndex, setFocusedBulkIndex] = useState<number | null>(null);
    const [bulkSearchResults, setBulkSearchResults] = useState<MasterPlayerSearchResult[]>([]);
    const [isBulkSearching, setIsBulkSearching] = useState(false);

    const updateBulkPlayer = <K extends keyof BulkPlayerInput>(
        index: number,
        field: K,
        value: BulkPlayerInput[K]
    ) => {
        setBulkPlayers(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handlePhotoChange = (index: number, file: File | null) => {
        if (!file) {
            updateBulkPlayer(index, "photoFile", null);
            updateBulkPlayer(index, "photoPreview", null);
            return;
        }

        updateBulkPlayer(index, "photoFile", file);
        try {
            updateBulkPlayer(index, "photoPreview", URL.createObjectURL(file));
        } catch {
            const reader = new FileReader();
            reader.onloadend = () => {
                updateBulkPlayer(index, "photoPreview", reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const addBulkRow = () => {
        setBulkPlayers(prev => [
            ...prev,
            ...Array.from({ length: 3 }, () => createEmptyPlayer())
        ]);
    };

    const removeBulkRow = (index: number) => {
        const playerToRemove = bulkPlayers[index];
        if (playerToRemove?.isExisting && playerToRemove.id) {
            setDeletedPlayerIds(prev => [...prev, playerToRemove.id!]);
        }
        setBulkPlayers(prev => {
            if (prev.length <= 1) return prev;
            return prev.filter((_, idx) => idx !== index);
        });
    };

    const handleBulkSearch = async (val: string) => {
        const query = val.trim();
        if (!query) {
            setBulkSearchResults([]);
            return;
        }

        setIsBulkSearching(true);
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
                setBulkSearchResults(mapped);
            } else {
                setBulkSearchResults([]);
            }
        } catch (err) {
            console.error("Error searching global players:", err);
            setBulkSearchResults([]);
        } finally {
            setIsBulkSearching(false);
        }
    };

    const handleFullNameChange = (index: number, val: string) => {
        const { firstName, lastName, nickname } = parsePlayerName(val);
        const isEnglish = isEnglishOrLatin(val);

        setBulkPlayers(prev => {
            const next = [...prev];
            const p = next[index];
            next[index] = {
                ...p,
                fullName: val,
                firstName: firstName,
                lastName: lastName,
                nickname: nickname || p.nickname,
                firstNameLocal: !isEnglish ? firstName : p.firstNameLocal,
                lastNameLocal: !isEnglish ? lastName : p.lastNameLocal,
                firstNameIntl: isEnglish ? firstName : p.firstNameIntl,
                lastNameIntl: isEnglish ? lastName : p.lastNameIntl,
                masterPlayerId: null,
            };
            return next;
        });

        const query = val.trim();
        if (query.length > 0 && !bulkPlayers[index]?.isExisting) {
            setFocusedBulkIndex(index);
            handleBulkSearch(query);
        } else {
            setFocusedBulkIndex(null);
            setBulkSearchResults([]);
        }
    };


    const handleSelectMasterPlayer = (index: number, gp: MasterPlayerSearchResult) => {
        const localFirst = gp.first_name_local || gp.first_name_th || "";
        const localLast = gp.last_name_local || gp.last_name_th || "";
        const intlFirst = gp.first_name_intl || gp.first_name_en || "";
        const intlLast = gp.last_name_intl || gp.last_name_en || "";

        const chosenFirst = (isThai ? (localFirst || intlFirst) : (intlFirst || localFirst)) || "";
        const chosenLast = (isThai ? (localLast || intlLast) : (intlLast || localLast)) || "";

        let finalFirst = "";
        let finalLast = "";
        if (chosenFirst) {
            finalFirst = chosenFirst;
            finalLast = chosenLast || "";
        } else {
            const parts = gp.name.split(" ");
            finalFirst = parts[0] || "";
            finalLast = parts.slice(1).join(" ") || "";
        }
        const chosenFull = [finalFirst, finalLast].filter(Boolean).join(" ").trim() || gp.name;
        updateBulkPlayer(index, "fullName", chosenFull);
        updateBulkPlayer(index, "firstName", finalFirst);
        updateBulkPlayer(index, "lastName", finalLast);

        if (localFirst) updateBulkPlayer(index, "firstNameLocal", localFirst);
        if (gp.middle_name_local || gp.middle_name_th) updateBulkPlayer(index, "middleNameLocal", gp.middle_name_local || gp.middle_name_th || "");
        if (localLast && localLast !== "-") updateBulkPlayer(index, "lastNameLocal", localLast);
        if (intlFirst) updateBulkPlayer(index, "firstNameIntl", intlFirst);
        if (gp.middle_name_intl || gp.middle_name_en) updateBulkPlayer(index, "middleNameIntl", gp.middle_name_intl || gp.middle_name_en || "");
        if (intlLast && intlLast !== "-") updateBulkPlayer(index, "lastNameIntl", intlLast);
        if (gp.nickname) updateBulkPlayer(index, "nickname", gp.nickname);
        if (gp.gender) updateBulkPlayer(index, "gender", gp.gender);
        if (gp.preferred_hand) updateBulkPlayer(index, "preferredHand", gp.preferred_hand);
        if (gp.preferred_foot) updateBulkPlayer(index, "preferredFoot", gp.preferred_foot);
        if (gp.date_of_birth) updateBulkPlayer(index, "birthday", gp.date_of_birth.substring(0, 10));
        if (gp.tel) updateBulkPlayer(index, "tel", gp.tel);
        if (gp.photo_url) updateBulkPlayer(index, "photoPreview", gp.photo_url);

        updateBulkPlayer(index, "masterPlayerId", gp.id);
        setFocusedBulkIndex(null);
        setBulkSearchResults([]);
    };

    const handleBulkFormSubmit = async () => {
        const filledPlayers = bulkPlayers.filter(p => (p.fullName?.trim() || p.firstName?.trim() || "").length > 0);
        if (filledPlayers.length === 0 && deletedPlayerIds.length === 0) {
            toast({
                title: isThai ? "กรุณากรอกข้อมูล" : "Input Required",
                description: isThai ? "อย่างน้อยต้องกรอกชื่อนักกีฬา 1 คน" : "At least 1 player name is required.",
                variant: "destructive"
            });
            return;
        }

        setIsSubmittingBulk(true);
        try {
            // 1. Build FormData for tournament staging table `tournament_roster_submissions`
            const submitFormData = new FormData();
            submitFormData.append("players", JSON.stringify(filledPlayers));
            submitFormData.append("deleted_player_ids", JSON.stringify(deletedPlayerIds));

            filledPlayers.forEach((p, idx) => {
                if (p.photoFile) {
                    submitFormData.append(`photo_${idx}`, p.photoFile);
                }
            });

            // Stage in tournament_roster_submissions
            await submitTournamentRoster(teamId, submitFormData);

            // 2. Process deleted players from team if needed
            if (deletedPlayerIds.length > 0) {
                for (const pId of deletedPlayerIds) {
                    try {
                        await deletePlayer(pId, teamId);
                    } catch (delErr) {
                        console.error("Error deleting player from squad:", delErr);
                    }
                }
            }

            const newPlayers = filledPlayers.filter(p => !p.isExisting);
            const existingToUpdate = filledPlayers.filter(p => p.isExisting && p.id);

            // 3. Update existing players
            for (const p of existingToUpdate) {
                if (!p.id) continue;
                let uploadedPhotoUrl: string | null = null;
                if (p.photoFile) {
                    const formData = new FormData();
                    formData.append("photo", p.photoFile);
                    const targetGlobalId = p.masterPlayerId || p.id;
                    const photoResult = await updateGlobalPlayerPhoto(targetGlobalId, formData);
                    if (photoResult.success) {
                        uploadedPhotoUrl = (photoResult as { url?: string; data?: { url?: string } }).url || (photoResult as { url?: string; data?: { url?: string } }).data?.url || null;
                    }
                }

                let resolvedPosition = p.position;
                if (p.memberType === "manager") resolvedPosition = "ผู้จัดการทีม";
                else if (p.memberType === "head_coach") resolvedPosition = "ผู้ฝึกสอน";
                else if (p.memberType === "assistant_coach") resolvedPosition = "ผู้ช่วยผู้ฝึกสอน";

                const fullName = p.fullName?.trim() || `${p.firstName.trim()} ${p.lastName.trim()}`.trim();
                const fullNameWithNickname = p.nickname?.trim() ? `${fullName} (${p.nickname.trim()})` : fullName;

                await updatePlayer(p.id, teamId, {
                    name: fullNameWithNickname,
                    number: p.memberType === "player" && p.number ? parseInt(p.number) : null,
                    position: resolvedPosition || null,
                    tel: p.tel || null,
                    birth_date: p.birthday || null,
                    ...(uploadedPhotoUrl ? { photo_url: uploadedPhotoUrl } : {})
                });
            }

            // 4. Add new players
            for (const p of newPlayers) {
                const formData = new FormData();
                const parsed = parsePlayerName(p.fullName?.trim() || "");
                const effectiveFirst = p.firstName.trim() || parsed.firstName || p.firstNameLocal.trim() || p.firstNameIntl.trim();
                const effectiveLast = p.lastName.trim() || parsed.lastName || p.lastNameLocal.trim() || p.lastNameIntl.trim();
                const fullName = p.fullName?.trim() || `${effectiveFirst} ${effectiveLast}`.trim();

                formData.append("name", fullName);
                formData.append("first_name_local", p.firstNameLocal.trim());
                formData.append("middle_name_local", p.middleNameLocal.trim());
                formData.append("last_name_local", p.lastNameLocal.trim());
                formData.append("first_name_intl", p.firstNameIntl.trim());
                formData.append("middle_name_intl", p.middleNameIntl.trim());
                formData.append("last_name_intl", p.lastNameIntl.trim());
                formData.append("nickname", p.nickname.trim());
                formData.append("gender", p.gender);
                formData.append("birthday", p.birthday);
                formData.append("date_of_birth", p.birthday);
                formData.append("preferred_hand", p.preferredHand);
                formData.append("preferred_foot", p.preferredFoot);

                let resolvedPosition = p.position;
                if (p.memberType === "manager") resolvedPosition = "ผู้จัดการทีม";
                else if (p.memberType === "head_coach") resolvedPosition = "ผู้ฝึกสอน";
                else if (p.memberType === "assistant_coach") resolvedPosition = "ผู้ช่วยผู้ฝึกสอน";

                formData.append("position", resolvedPosition || "");
                if (p.memberType === "player" && p.number.trim()) {
                    formData.append("number", p.number.trim());
                }
                formData.append("tel", p.tel.trim());

                if (p.masterPlayerId) {
                    formData.append("master_player_id", p.masterPlayerId);
                }
                if (p.photoFile) {
                    formData.append("photo", p.photoFile);
                }

                await addPlayer(teamId, formData);
            }

            toast({
                title: isThai ? "ส่งรายชื่อเรียบร้อยแล้ว" : "Roster Submitted Successfully",
                description: isThai 
                    ? `ส่งรายชื่อเข้าสู่ระบบเพื่อรอการตรวจสอบจาก Organizer เรียบร้อยแล้ว` 
                    : `Successfully submitted squad roster for review`,
            });
            setIsBulkOpen(false);
            await onSuccess();
        } catch (_err) {
            toast({
                title: tCommon("error"),
                description: isThai ? "เกิดข้อผิดพลาดในการบันทึกข้อมูล" : "An error occurred while saving",
                variant: "destructive"
            });
        } finally {
            setIsSubmittingBulk(false);
        }
    };

    if (effectivelyLocked) return null;

    const existingCount = bulkPlayers.filter(p => p.isExisting).length;
    const newFilledCount = bulkPlayers.filter(p => !p.isExisting && p.firstName.trim().length > 0).length;

    return (
        <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline"
                    size="sm" 
                >
                    <Plus className="h-4 w-4" />
                    <span className="hidden lg:block">{isThai ? "ส่งรายชื่อ" : "Submit Roster"}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl md:max-w-6xl xl:max-w-7xl">
                <DialogHeader>
                    <div className="flex items-center gap-2 flex-wrap">
                        <DialogTitle>
                            {isThai ? "จัดการและส่งรายชื่อนักกีฬาหลายคน" : "Manage & Submit Multiple Players"}
                        </DialogTitle>
                        {existingCount > 0 && (
                            <Badge variant="outline">
                                {isThai ? `ในทีมเดิม ${existingCount} คน` : `${existingCount} existing`}
                            </Badge>
                        )}
                        {newFilledCount > 0 && (
                            <Badge variant="default">
                                {isThai ? `เพิ่มใหม่ ${newFilledCount} คน` : `+${newFilledCount} new`}
                            </Badge>
                        )}
                        {existingCount === 0 && sourcePlayers.length > 0 && (
                            <Badge variant="outline" className="text-primary border-primary/40 bg-primary/5">
                                {isThai ? `ดึงข้อมูลจากทีมของฉัน ${sourcePlayers.length} คน` : `${sourcePlayers.length} from My Team`}
                            </Badge>
                        )}
                    </div>
                    <DialogDescription>
                        {isThai 
                            ? "กรอกข้อมูลนักกีฬาและเจ้าหน้าที่ทีมในแต่ละการ์ดด้านล่าง จากนั้นกดปุ่มส่งรายชื่อด้านล่าง" 
                            : "Fill in player and staff details in each card below, then click Submit Roster."}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto space-y-4 p-2 md:p-4 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {bulkPlayers.map((player, idx) => {
                            return (
                                <div
                                    key={player.id || idx}
                                    className={`flex flex-col gap-3 p-3.5 rounded-sm border relative transition-all ${
                                        player.isExisting 
                                            ? "border-primary/40 bg-primary/[0.02]" 
                                            : "border-border bg-card/60 hover:border-primary/40"
                                    }`}
                                >
                                    {/* Card Header: Role Selector & Badges & Delete */}
                                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {/* Role Selector */}
                                            {memberTypeOptions.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => {
                                                        updateBulkPlayer(idx, "memberType", opt.value);
                                                        if (opt.value !== "player") {
                                                            updateBulkPlayer(idx, "position", "");
                                                            updateBulkPlayer(idx, "number", "");
                                                        }
                                                    }}
                                                    className={cn(
                                                        "px-2 py-0.5 text-[10px] rounded-sm font-bold transition-all border",
                                                        player.memberType === opt.value
                                                            ? "bg-primary text-primary-foreground border-primary"
                                                            : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-transparent"
                                                    )}
                                                >
                                                    {isThai ? opt.labelTh : opt.labelEn}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {player.isExisting ? (
                                                <Badge variant="default" size="sm">
                                                    <Shield className="h-4 w-4" />
                                                    {isThai ? "ในทีม" : "In Team"}
                                                </Badge>
                                            ) : (
                                                <span className="text-[10px] font-bold text-muted-foreground/60 font-mono">
                                                    #{idx + 1}
                                                </span>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => removeBulkRow(idx)}
                                                className="text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all p-1 rounded-sm"
                                                title={player.isExisting ? (isThai ? "ลบออกจากทีม" : "Remove from team") : (isThai ? "ลบแถวนี้" : "Remove row")}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Photo Uploader on Top */}
                                    <div className="flex justify-center pt-1 pb-0.5">
                                        <LogoUploader
                                            id={`bulk-photo-${player.id || idx}`}
                                            initialUrl={player.photoPreview}
                                            onFileChange={(file) => handlePhotoChange(idx, file)}
                                            onRemove={() => handlePhotoChange(idx, null)}
                                            imageFit="cover"
                                            previewLabel={player.fullName || player.firstName || (isThai ? "รูปนักกีฬา" : "Player Photo")}
                                        />
                                    </div>

                                    {/* Name & Quick Inputs */}
                                    <div className="space-y-2">
                                        {/* Full Name */}
                                        <div className="space-y-1 relative">
                                            <Label className="text-[10px]">
                                                {isThai ? "ชื่อ - นามสกุล" : "Full Name"} <span className="text-destructive">*</span>
                                            </Label>
                                            <Input
                                                type="text"
                                                size="sm"
                                                value={player.fullName !== undefined ? player.fullName : (player.firstName ? `${player.firstName} ${player.lastName}`.trim() : "")}
                                                onChange={(e) => handleFullNameChange(idx, e.target.value)}
                                                onFocus={() => {
                                                    const full = (player.fullName ?? `${player.firstName} ${player.lastName}`).trim();
                                                    if (full.length > 0 && !player.isExisting) {
                                                        setFocusedBulkIndex(idx);
                                                        handleBulkSearch(full);
                                                    }
                                                }}
                                                placeholder={isThai ? "สมชาย ใจดี" : "John Doe"}
                                                className="text-xs"
                                            />

                                            {/* Master Player Auto-Suggest Dropdown */}
                                            {focusedBulkIndex === idx && (isBulkSearching || bulkSearchResults.length > 0) && (
                                                <div className="absolute left-0 right-0 top-full mt-1 z-[100] rounded-sm border border-border bg-card text-foreground shadow-2xl max-h-[180px] overflow-y-auto custom-scrollbar">
                                                    {isBulkSearching ? (
                                                        <div className="flex flex-col items-center justify-center py-4 gap-1">
                                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                            <span className="text-[8px] font-black tracking-widest text-muted-foreground/40">{isThai ? "กำลังค้นหา..." : "Searching..."}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="p-1 space-y-0.5">
                                                            <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground border-b border-border/40">
                                                                {isThai ? "พบข้อมูลนักกีฬาในระบบกลาง" : "Master Player Suggestions"}
                                                            </div>
                                                            {bulkSearchResults.map((gp) => (
                                                                <button
                                                                    key={gp.id}
                                                                    type="button"
                                                                    className="w-full text-left px-2 py-1.5 hover:bg-primary/10 rounded-xs group flex items-center justify-between transition-colors border-b border-foreground/5 last:border-0"
                                                                    onMouseDown={() => handleSelectMasterPlayer(idx, gp)}
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <div className="h-6 w-6 rounded-full bg-muted/30 border flex items-center justify-center overflow-hidden shrink-0">
                                                                            {gp.photo_url ? (
                                                                                <Image src={gp.photo_url} alt={gp.name} width={24} height={24} className="h-full w-full object-cover" />
                                                                            ) : (
                                                                                <span className="text-[9px] font-bold text-muted-foreground">{gp.name.charAt(0)}</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="font-bold text-[11px] truncate group-hover:text-primary">{gp.name}</span>
                                                                            <span className="text-[9px] font-mono text-muted-foreground/60">{gp.tel || gp.date_of_birth || ""}</span>
                                                                        </div>
                                                                    </div>
                                                                    <ArrowRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary shrink-0 ml-1" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Number, Position & Tel */}
                                        <div className="grid grid-cols-12 gap-2">
                                            {player.memberType === "player" ? (
                                                <>
                                                    <div className="col-span-3 space-y-1">
                                                        <Label className="text-[10px]">{t("number")}</Label>
                                                        <Input
                                                            type="text"
                                                            size="sm"
                                                            value={player.number}
                                                            onChange={(e) => updateBulkPlayer(idx, "number", e.target.value)}
                                                            placeholder="10"
                                                            className="text-xs text-center font-bold"
                                                        />
                                                    </div>
                                                    <div className="col-span-4 space-y-1">
                                                        <Label className="text-[10px]">{t("position")}</Label>
                                                        <Dropdown value={player.position} onValueChange={(val) => updateBulkPlayer(idx, "position", val)}>
                                                            <DropdownTrigger size="sm" className="w-full text-xs">
                                                                <DropdownValue placeholder={isThai ? "เลือกตำแหน่ง" : "Position"} />
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
                                                    <div className="col-span-5 space-y-1">
                                                        <Label className="text-[10px]">{t("tel") || "เบอร์โทร"}</Label>
                                                        <Input
                                                            type="tel"
                                                            size="sm"
                                                            value={player.tel}
                                                            onChange={(e) => updateBulkPlayer(idx, "tel", e.target.value)}
                                                            placeholder="081-xxx-xxxx"
                                                            className="text-xs"
                                                        />
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="col-span-12 space-y-1">
                                                    <Label className="text-[10px]">{t("tel") || "เบอร์โทร"}</Label>
                                                    <Input
                                                        type="tel"
                                                        size="sm"
                                                        value={player.tel}
                                                        onChange={(e) => updateBulkPlayer(idx, "tel", e.target.value)}
                                                        placeholder="081-xxx-xxxx"
                                                        className="text-xs"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Collapsible Details Section */}
                                    {player.showDetails && (
                                        <div className="pt-2 border-t border-border/40 space-y-3 animate-in fade-in-50 duration-200">
                                            {/* Local Name Grid */}
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-semibold text-muted-foreground">
                                                    {isThai ? "ชื่อ - นามสกุล (ภาษาท้องถิ่น)" : "Full Name (Local Language)"}
                                                </Label>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    <Input
                                                        value={player.firstNameLocal}
                                                        onChange={e => {
                                                            updateBulkPlayer(idx, "firstNameLocal", e.target.value);
                                                            if (isThai && !isEnglishOrLatin(e.target.value)) updateBulkPlayer(idx, "firstName", e.target.value);
                                                        }}
                                                        placeholder={isThai ? "ชื่อจริง" : "First name"}
                                                        size="sm"
                                                        className="text-xs"
                                                    />
                                                    <Input
                                                        value={player.middleNameLocal}
                                                        onChange={e => updateBulkPlayer(idx, "middleNameLocal", e.target.value)}
                                                        placeholder={isThai ? "ชื่อกลาง" : "Middle name"}
                                                        size="sm"
                                                        className="text-xs"
                                                    />
                                                    <Input
                                                        value={player.lastNameLocal}
                                                        onChange={e => {
                                                            updateBulkPlayer(idx, "lastNameLocal", e.target.value);
                                                            if (isThai && !isEnglishOrLatin(e.target.value)) updateBulkPlayer(idx, "lastName", e.target.value);
                                                        }}
                                                        placeholder={isThai ? "นามสกุล" : "Last name"}
                                                        size="sm"
                                                        className="text-xs"
                                                    />
                                                </div>
                                            </div>

                                            {/* International Name Grid */}
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-semibold text-muted-foreground">
                                                    {isThai ? "ชื่อ - นามสกุล (ภาษาอังกฤษ)" : "Full Name (English)"}
                                                </Label>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    <Input
                                                        value={player.firstNameIntl}
                                                        onChange={e => {
                                                            updateBulkPlayer(idx, "firstNameIntl", e.target.value);
                                                            if (!isThai || isEnglishOrLatin(e.target.value)) updateBulkPlayer(idx, "firstName", e.target.value);
                                                        }}
                                                        placeholder="First name"
                                                        size="sm"
                                                        className="text-xs"
                                                    />
                                                    <Input
                                                        value={player.middleNameIntl}
                                                        onChange={e => updateBulkPlayer(idx, "middleNameIntl", e.target.value)}
                                                        placeholder="Middle name"
                                                        size="sm"
                                                        className="text-xs"
                                                    />
                                                    <Input
                                                        value={player.lastNameIntl}
                                                        onChange={e => {
                                                            updateBulkPlayer(idx, "lastNameIntl", e.target.value);
                                                            if (!isThai || isEnglishOrLatin(e.target.value)) updateBulkPlayer(idx, "lastName", e.target.value);
                                                        }}
                                                        placeholder="Last name"
                                                        size="sm"
                                                        className="text-xs"
                                                    />
                                                </div>
                                            </div>

                                            {/* Nickname, Gender, Birthday */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px]">{isThai ? "ชื่อเล่น" : "Nickname"}</Label>
                                                    <Input
                                                        value={player.nickname}
                                                        onChange={e => updateBulkPlayer(idx, "nickname", e.target.value)}
                                                        placeholder={isThai ? "บอย" : "Nick"}
                                                        size="sm"
                                                        className="text-xs"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <Label className="text-[10px]">{isThai ? "เพศ" : "Gender"}</Label>
                                                    <RadioBtn
                                                        value={player.gender}
                                                        onChange={(val) => updateBulkPlayer(idx, "gender", val)}
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

                                                <div className="space-y-1">
                                                    <Label className="text-[10px] flex items-center gap-1">
                                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                                        {isThai ? "วันเกิด" : "Birthday"}
                                                    </Label>
                                                    <DatePicker
                                                        value={player.birthday}
                                                        onChange={(val) => updateBulkPlayer(idx, "birthday", val)}
                                                        size="sm"
                                                        minYear={1940}
                                                        maxYear={new Date().getFullYear()}
                                                        defaultViewYear={2000}
                                                        placeholder={isThai ? "เลือกวันเกิด" : "Select date"}
                                                        className="text-xs"
                                                    />
                                                </div>
                                            </div>

                                            {/* Preferred Foot & Hand */}
                                            <div className="grid grid-cols-2 gap-2 pt-1">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] flex items-center gap-1">
                                                        <Footprints className="h-4 w-4 text-muted-foreground" />
                                                        {isThai ? "เท้าที่ถนัด" : "Preferred Foot"}
                                                    </Label>
                                                    <RadioBtn
                                                        value={player.preferredFoot}
                                                        onChange={(val) => updateBulkPlayer(idx, "preferredFoot", val)}
                                                        sports={[
                                                            { id: "right", sport_name: isThai ? "ขวา" : "Right", icon: <Footprints className="h-4 w-4" /> },
                                                            { id: "left", sport_name: isThai ? "ซ้าย" : "Left", icon: <Footprints className="h-4 w-4 scale-x-[-1]" /> },
                                                            { id: "both", sport_name: isThai ? "สองข้าง" : "Both", icon: <Footprints className="h-4 w-4" /> },
                                                        ]}
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <Label className="text-[10px] flex items-center gap-1">
                                                        <Hand className="h-4 w-4 text-muted-foreground" />
                                                        {isThai ? "มือที่ถนัด" : "Preferred Hand"}
                                                    </Label>
                                                    <RadioBtn
                                                        value={player.preferredHand}
                                                        onChange={(val) => updateBulkPlayer(idx, "preferredHand", val)}
                                                        sports={[
                                                            { id: "right", sport_name: isThai ? "ขวา" : "Right", icon: <Hand className="h-4 w-4" /> },
                                                            { id: "left", sport_name: isThai ? "ซ้าย" : "Left", icon: <Hand className="h-4 w-4 scale-x-[-1]" /> },
                                                            { id: "both", sport_name: isThai ? "สองข้าง" : "Both", icon: <Hand className="h-4 w-4" /> },
                                                        ]}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Toggle Details Button */}
                                    <div className="flex items-center justify-center pt-1 border-t border-border/30">
                                        <button
                                            type="button"
                                            onClick={() => updateBulkPlayer(idx, "showDetails", !player.showDetails)}
                                            className={cn(
                                                "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all cursor-pointer select-none",
                                                player.showDetails
                                                    ? "bg-primary/10 border-primary/40 text-primary"
                                                    : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/70"
                                            )}
                                        >
                                            <span>
                                                {player.showDetails 
                                                    ? (isThai ? "ซ่อนรายละเอียด" : "Hide Details") 
                                                    : (isThai ? "+ รายละเอียดเพิ่มเติม" : "+ More Details")}
                                            </span>
                                            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", player.showDetails && "rotate-180")} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="flex justify-end pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addBulkRow}
                        >
                            <Plus className="h-4 w-4" />
                            {isThai ? "เพิ่มช่องแถวใหม่" : "Add More Rows"}
                        </Button>
                    </div>
                </div>

                <DialogFooter className="border-t pt-3 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground font-medium">
                        {isThai 
                            ? `รวมสมาชิกทั้งหมด ${bulkPlayers.filter(p => (p.fullName?.trim() || p.firstName.trim()).length > 0).length} คน` 
                            : `Total ${bulkPlayers.filter(p => (p.fullName?.trim() || p.firstName.trim()).length > 0).length} members`}
                    </div>
                    <Button
                        size="sm"
                        onClick={handleBulkFormSubmit}
                        disabled={isSubmittingBulk || (bulkPlayers.filter(p => p.firstName.trim().length > 0).length === 0 && deletedPlayerIds.length === 0)}
                        className="font-bold gap-1.5 px-5"
                    >
                        {isSubmittingBulk ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {isThai ? "กำลังส่งรายชื่อ..." : "Submitting..."}
                            </>
                        ) : (
                            <span>{isThai ? "ส่งรายชื่อ" : "Submit Roster"}</span>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export const AddPlayersDialog = ManageAndSubmitRosterDialog;
export const SubmitRosterDialog = ManageAndSubmitRosterDialog;
