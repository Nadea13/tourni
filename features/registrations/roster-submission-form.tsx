"use client";

import React, { useState, useTransition, useEffect } from "react";
import { Plus, X, Loader2, ArrowRight, User, ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayerUploader } from "@/components/shared/player-uploader";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/dropdown";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { searchMasterPlayers } from "@/actions/common/user";
import { submitRosterWithSender } from "@/actions/tournaments/registration";
import { EmptyState } from "@/components/shared/empty-state";

import { Player } from "@/types/index";
import { Header } from "@/components/ui/header";
import { resolveStorageUrl } from "@/lib/storage-utils";

export interface UserRegisteredTeam {
    id: string;
    contact_name: string | null;
    contact_phone: string | null;
    team: {
        id: string;
        name: string;
        logo_img: string | null;
    } | null;
    tournament_categories: {
        id: string;
        gender_type: string;
        age_categories: {
            category_name: string | null;
        } | null;
    } | null;
}

interface RosterSubmissionFormProps {
    registeredTeams: UserRegisteredTeam[];
    locale: string;
}

interface BulkPlayerInput {
    name: string;
    number: string;
    position: string;
    tel: string;
    photoFile: File | null;
    photoPreview: string | null;
}

interface MasterPlayerSearchResult {
    id: string;
    name: string;
    date_of_birth: string | null;
    tel: string | null;
}

interface MasterPlayerRow {
    id: string;
    first_name_local?: string | null;
    last_name_local?: string | null;
    first_name_intl?: string | null;
    last_name_intl?: string | null;
    first_name_th?: string | null;
    last_name_th?: string | null;
    first_name_en?: string | null;
    last_name_en?: string | null;
    birthday: string | null;
    tel: string | null;
}

const createInitialBulkPlayers = () => Array.from({ length: 3 }, () => ({
    name: "",
    number: "",
    position: "",
    tel: "",
    photoFile: null,
    photoPreview: null
}));

export function RosterSubmissionForm({ registeredTeams }: RosterSubmissionFormProps) {
    const t = useTranslations("Roster");

    const [isOpen, setIsOpen] = useState(false);
    const [selectedRegId, setSelectedRegId] = useState<string>("");
    const [senderName, setSenderName] = useState<string>("");
    const [senderPhone, setSenderPhone] = useState<string>("");
    const [isPending, startTransition] = useTransition();

    const [bulkPlayers, setBulkPlayers] = useState<BulkPlayerInput[]>(createInitialBulkPlayers());

    const [focusedBulkIndex, setFocusedBulkIndex] = useState<number | null>(null);
    const [bulkSearchResults, setBulkSearchResults] = useState<MasterPlayerSearchResult[]>([]);
    const [isBulkSearching, setIsBulkSearching] = useState(false);
    const [existingPlayers, setExistingPlayers] = useState<Player[]>([]);
    const [isLoadingExisting, setIsLoadingExisting] = useState(false);

    useEffect(() => {
        if (selectedRegId) {
            const fetchExisting = async () => {
                setIsLoadingExisting(true);
                const { getPlayers } = await import("@/actions/manager/team");
                const res = await getPlayers(selectedRegId);
                if (res.success && res.data) {
                    setExistingPlayers(res.data);
                    const remainder = res.data.length % 3;
                    const needed = remainder === 0 ? 3 : (3 - remainder);
                    setBulkPlayers(Array.from({ length: needed }, () => ({
                        name: "",
                        number: "",
                        position: "",
                        tel: "",
                        photoFile: null,
                        photoPreview: null
                    })));
                } else {
                    setExistingPlayers([]);
                    setBulkPlayers(createInitialBulkPlayers());
                }
                setIsLoadingExisting(false);
            };
            fetchExisting();
        } else {
            setExistingPlayers([]);
            setBulkPlayers(createInitialBulkPlayers());
        }
    }, [selectedRegId]);

    // Prefill sender info when team is selected
    useEffect(() => {
        if (selectedRegId) {
            const team = registeredTeams.find(t => t.id === selectedRegId);
            if (team) {
                setSenderName(team.contact_name || "");
                setSenderPhone(team.contact_phone || "");
            }
        } else {
            setSenderName("");
            setSenderPhone("");
        }
    }, [selectedRegId, registeredTeams]);

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
        const reader = new FileReader();
        reader.onloadend = () => {
            updateBulkPlayer(index, "photoPreview", reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const addBulkRow = () => {
        setBulkPlayers(prev => [
            ...prev,
            ...Array.from({ length: 3 }, () => ({
                name: "",
                number: "",
                position: "",
                tel: "",
                photoFile: null,
                photoPreview: null
            }))
        ]);
    };

    const handleBulkSearch = async (val: string) => {
        setIsBulkSearching(true);
        try {
            const res = await searchMasterPlayers(val);
            if (res.success && res.data) {
                const mapped = (res.data as MasterPlayerRow[]).map((mp) => {
                    const localFirst = mp.first_name_local || mp.first_name_th;
                    const localLast = mp.last_name_local || mp.last_name_th;
                    const intlFirst = mp.first_name_intl || mp.first_name_en;
                    const intlLast = mp.last_name_intl || mp.last_name_en;

                    const localName = [localFirst, localLast && localLast !== '-' ? localLast : null].filter(Boolean).join(" ").trim();
                    const intlName = [intlFirst, intlLast && intlLast !== '-' ? intlLast : null].filter(Boolean).join(" ").trim();

                    return {
                        id: mp.id,
                        name: localName || intlName || "Unnamed Player",
                        date_of_birth: mp.birthday,
                        tel: mp.tel
                    };
                });
                const uniqueMapped = mapped.filter((item, index, self) =>
                    index === self.findIndex((t) => t.name === item.name)
                );
                setBulkSearchResults(uniqueMapped);
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

    const handleBulkNameChange = (index: number, val: string) => {
        updateBulkPlayer(index, "name", val);
        if (val.trim().length > 0) {
            setFocusedBulkIndex(index);
            handleBulkSearch(val);
        } else {
            setFocusedBulkIndex(null);
            setBulkSearchResults([]);
        }
    };

    const handleSelectBulkMasterPlayer = (index: number, gp: MasterPlayerSearchResult) => {
        updateBulkPlayer(index, "name", gp.name);
        updateBulkPlayer(index, "tel", gp.tel || "");
        setFocusedBulkIndex(null);
        setBulkSearchResults([]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("handleSubmit triggered", {
            selectedRegId,
            senderName,
            senderPhone,
            bulkPlayers
        });

        if (!selectedRegId) {
            console.warn("selectedRegId is missing");
            toast.error("กรุณาเลือกทีมที่ต้องการส่งรายชื่อ");
            return;
        }
        if (!senderName.trim()) {
            console.warn("senderName is missing");
            toast.error("กรุณากรอกชื่อผู้ส่ง");
            return;
        }
        if (!senderPhone.trim()) {
            console.warn("senderPhone is missing");
            toast.error("กรุณากรอกเบอร์โทรผู้ส่ง");
            return;
        }

        const activePlayers = bulkPlayers.filter(p => p.name.trim().length > 0);
        if (activePlayers.length === 0) {
            toast.error("กรุณากรอกชื่อนักกีฬาอย่างน้อย 1 คน");
            return;
        }

        const formData = new FormData();
        formData.append("tournamentTeamId", selectedRegId);
        formData.append("senderName", senderName);
        formData.append("senderPhone", senderPhone);
        formData.append("count", activePlayers.length.toString());

        activePlayers.forEach((p, idx) => {
            formData.append(`name_${idx}`, p.name);
            formData.append(`number_${idx}`, p.number);
            formData.append(`position_${idx}`, p.position);
            formData.append(`tel_${idx}`, p.tel);
            if (p.photoFile) {
                formData.append(`photo_${idx}`, p.photoFile);
            }
        });

        console.log("Calling submitRosterWithSender server action with players count:", activePlayers.length);
        startTransition(async () => {
            try {
                console.log("transition started");
                const res = await submitRosterWithSender(formData);
                console.log("submitRosterWithSender response:", res);
                if (res.success) {
                    toast.success(res.message || "ส่งรายชื่อนักกีฬาเรียบร้อยแล้ว");
                    setBulkPlayers(createInitialBulkPlayers());
                    setSelectedRegId("");
                    setSenderName("");
                    setSenderPhone("");
                    setIsOpen(false);
                } else {
                    toast.error(res.error || "เกิดข้อผิดพลาดในการส่งรายชื่อ");
                }
            } catch (err: unknown) {
                console.error("submitRosterWithSender threw exception:", err);
                toast.error("เกิดข้อผิดพลาดในการส่งรายชื่อนักกีฬา");
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="default"
                >
                    <ClipboardList className="h-4 w-4" />
                    <span className="hidden md:block">ส่งรายชื่อนักกีฬา</span>
                </Button>
            </DialogTrigger>
            <DialogContent showCloseButton={false} className="min-w-[1280px] bg-card border rounded-sm max-h-[95vh] md:max-h-[90vh] flex flex-col">
                <DialogHeader className="relative pr-10">
                    <DialogTitle>
                        ส่งรายชื่อนักกีฬาเข้าร่วมแข่งขัน
                    </DialogTitle>
                    <DialogDescription>
                        กรุณาเลือกทีมที่ลงทะเบียนแล้ว กรอกข้อมูลผู้ติดต่อ และเพิ่มรายชื่อนักกีฬาลงในตารางด้านล่าง จากนั้นกดปุ่มส่งรายชื่อนักกีฬา
                    </DialogDescription>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute right-2 top-2"
                        onClick={() => setIsOpen(false)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </DialogHeader>

                {registeredTeams.length === 0 ? (
                    <EmptyState
                        icon={ClipboardList}
                        title="ไม่พบประวัติการลงทะเบียนทีม"
                        description="บัญชีของคุณยังไม่มีทีมที่ผ่านการสมัครลงทะเบียนในรายการนี้ จึงไม่สามารถส่งรายชื่อนักกีฬาได้"
                    />
                ) : (
                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto space-y-4 p-2 md:p-4">
                            {/* Team Selection */}
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">เลือกทีมที่ลงทะเบียนแล้ว <span className="text-destructive">*</span></Label>
                                <Select value={selectedRegId} onValueChange={setSelectedRegId}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="เลือกทีมที่ลงทะเบียนในรายการนี้" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {registeredTeams.map((rt) => {
                                            const categoryName = rt.tournament_categories?.age_categories?.category_name || "ทั่วไป";
                                            const gender = rt.tournament_categories?.gender_type === 'open' ? 'ทั่วไป'
                                                : rt.tournament_categories?.gender_type === 'male' ? 'ชาย'
                                                    : rt.tournament_categories?.gender_type === 'female' ? 'หญิง'
                                                        : 'ผสม';
                                            return (
                                                <SelectItem key={rt.id} value={rt.id}>
                                                    {rt.team?.name || "ไม่ทราบชื่อทีม"} - รุ่น {categoryName} ({gender})
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Sender Details */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold">ชื่อผู้ส่งรายชื่อ / ผู้ติดต่อ <span className="text-destructive">*</span></Label>
                                    <div className="relative">
                                        <Input
                                            type="text"
                                            placeholder="ชื่อ-นามสกุล"
                                            value={senderName}
                                            onChange={(e) => setSenderName(e.target.value)}
                                            className="pl-9"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold">เบอร์โทรศัพท์ผู้ติดต่อ <span className="text-destructive">*</span></Label>
                                    <div className="relative">
                                        <Input
                                            type="tel"
                                            placeholder="เบอร์โทรศัพท์มือถือ"
                                            value={senderPhone}
                                            onChange={(e) => setSenderPhone(e.target.value)}
                                            className="pl-9"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Bulk Roster Grid */}
                            <div className="space-y-2">
                                <Header level={4}>รายชื่อนักกีฬา</Header>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 border rounded-sm max-h-[46.4vh] overflow-auto no-scrollbar">
                                    {/* Existing Players (Read-Only / Disabled) */}
                                    {selectedRegId && !isLoadingExisting && existingPlayers.map((player) => (
                                        <div key={`existing-${player.id}`} className="border relative flex flex-col items-center gap-2">
                                            {/* Photo Display */}
                                            <div className="relative">
                                                <div className="h-24 w-24 rounded-full border flex items-center justify-center overflow-hidden bg-muted">
                                                    {resolveStorageUrl(player.photo_url) ? (
                                                        <Image
                                                            src={resolveStorageUrl(player.photo_url) || ""}
                                                            alt={player.name}
                                                            width={56}
                                                            height={56}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <User className="h-6 w-6 text-muted-foreground/60" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Fields */}
                                            <div className="w-full space-y-1.5 text-center">
                                                <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">ลงทะเบียนแล้ว</span>
                                                <Input
                                                    type="text"
                                                    value={player.name}
                                                    disabled
                                                    className="h-8 text-xs"
                                                />
                                                <div className="grid grid-cols-2 gap-1 lg:gap-2">
                                                    <Input
                                                        type="text"
                                                        value={player.number || ""}
                                                        disabled
                                                        placeholder="เบอร์เสื้อ"
                                                        className="h-8 text-xs"
                                                    />
                                                    <Input
                                                        type="text"
                                                        value={player.position === 'GK' ? t("goalkeeper") : player.position === 'DF' ? t("defender") : player.position === 'MF' ? t("midfielder") : player.position === 'FW' ? t("forward") : player.position || "ตำแหน่ง"}
                                                        disabled
                                                        className="h-8 text-xs px-1.5 bg-muted/30"
                                                    />
                                                </div>
                                                <Input
                                                    type="tel"
                                                    value={player.tel || ""}
                                                    disabled
                                                    placeholder="เบอร์โทรศัพท์"
                                                    className="h-8 text-xs bg-muted/30"
                                                />
                                            </div>
                                        </div>
                                    ))}

                                    {/* Loading State */}
                                    {isLoadingExisting && (
                                        <div className="col-span-full flex items-center gap-2 text-xs text-muted-foreground justify-center py-8">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            <span>กำลังโหลดรายชื่อที่มีอยู่เดิม...</span>
                                        </div>
                                    )}

                                    {bulkPlayers.map((player, idx) => (
                                        <div key={idx} className="border rounded-sm p-2 relative flex flex-col items-center gap-2 bg-card">

                                            {/* Photo Selector */}
                                            <div className="relative">
                                                <PlayerUploader
                                                    id={`roster-photo-input-${idx}`}
                                                    size="lg"
                                                    initialUrl={player.photoPreview}
                                                    onFileChange={(file) => handlePhotoChange(idx, file)}
                                                    onRemove={() => handlePhotoChange(idx, null)}
                                                />
                                            </div>

                                            {/* Fields */}
                                            <div className="w-full space-y-1.5">
                                                <div className="relative">
                                                    <Input
                                                        type="text"
                                                        value={player.name}
                                                        placeholder="ชื่อ-นามสกุลนักกีฬา"
                                                        onChange={(e) => handleBulkNameChange(idx, e.target.value)}
                                                        className="h-8 text-xs"
                                                        onFocus={() => {
                                                            if (player.name.trim().length > 0) {
                                                                setFocusedBulkIndex(idx);
                                                                handleBulkSearch(player.name);
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            setTimeout(() => {
                                                                setFocusedBulkIndex(null);
                                                            }, 200);
                                                        }}
                                                    />
                                                    {focusedBulkIndex === idx && (isBulkSearching || bulkSearchResults.length > 0) && (
                                                        <div className="absolute left-0 right-0 top-full mt-1 z-[100] rounded-sm border border-border bg-card text-foreground shadow-2xl max-h-[150px] overflow-y-auto custom-scrollbar">
                                                            {isBulkSearching ? (
                                                                <div className="flex flex-col items-center justify-center py-4 gap-1">
                                                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                                    <span className="text-[8px] font-black tracking-widest text-muted-foreground/40">Searching...</span>
                                                                </div>
                                                            ) : (
                                                                <div className="py-0.5">
                                                                    {bulkSearchResults.map((gp) => (
                                                                        <button
                                                                            key={gp.id}
                                                                            type="button"
                                                                            className="w-full text-left px-2 py-1 hover:bg-primary/10 group flex items-center justify-between transition-colors border-b border-foreground/5 last:border-0"
                                                                            onMouseDown={() => handleSelectBulkMasterPlayer(idx, gp)}
                                                                        >
                                                                            <div className="flex flex-col">
                                                                                <span className="font-bold text-[10px] tracking-tight group-hover:text-primary">{gp.name}</span>
                                                                            </div>
                                                                            <ArrowRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-1">
                                                    <Input
                                                        type="text"
                                                        value={player.number}
                                                        onChange={(e) => updateBulkPlayer(idx, "number", e.target.value)}
                                                        placeholder="เบอร์เสื้อ"
                                                        className="h-8 text-xs px-1.5"
                                                    />
                                                    <Select
                                                        value={player.position}
                                                        onValueChange={(val) => updateBulkPlayer(idx, "position", val)}
                                                    >
                                                        <SelectTrigger className="w-full h-8 text-xs px-1.5">
                                                            <SelectValue placeholder="ตำแหน่ง" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="GK">{t("goalkeeper")}</SelectItem>
                                                            <SelectItem value="DF">{t("defender")}</SelectItem>
                                                            <SelectItem value="MF">{t("midfielder")}</SelectItem>
                                                            <SelectItem value="FW">{t("forward")}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <Input
                                                    type="tel"
                                                    value={player.tel}
                                                    onChange={(e) => updateBulkPlayer(idx, "tel", e.target.value)}
                                                    placeholder="เบอร์โทรศัพท์"
                                                    className="h-8 text-xs"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addBulkRow}
                                    >
                                        <Plus className="h-4 w-4" />
                                        เพิ่มช่องแถวนักกีฬา
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="border-t p-4 flex items-center justify-end bg-muted/20">
                            <Button
                                type="submit"
                                disabled={isPending || !selectedRegId}
                                className="w-full sm:w-auto"
                            >
                                {isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        กำลังบันทึกข้อมูลและส่งรายชื่อ...
                                    </>
                                ) : (
                                    "ส่งรายชื่อนักกีฬา"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

