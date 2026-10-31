"use client";

import React, { useState, useTransition, useEffect, useRef } from "react";
import { 
    Plus, 
        Loader2, 
    ArrowRight, 
        User, 
    Upload, 
    Download, 
    CheckCircle2, 
    FileText, 
    Trash2,
    Clock,
    ShieldCheck,
    AlertCircle
} from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayerUploader } from "@/components/shared/player-uploader";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/dropdown";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { searchMasterPlayers } from "@/actions/common/user";
import { submitRosterWithSender } from "@/actions/tournaments/registration";
import { EmptyState } from "@/components/shared/empty-state";
import { Player } from "@/types/index";
import { formatDate, isPastDocumentDeadline } from "@/lib/date";
import { cn } from "@/lib/utils";
import { getPositionOptions } from "@/lib/positions";
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

export interface TournamentDetails {
    id: string;
    name: string;
    description?: string | null;
    status: string;
    start_date?: string | null;
    end_date?: string | null;
    document_deadline?: string | null;
    location_name?: string | null;
    cover_img?: string | null;
    logo_img?: string | null;
    sport_name?: string;
    is_registration_open: boolean;
}

interface BulkPlayerInput {
    name: string;
    nickname: string;
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

interface DocumentSubmissionClientProps {
    tournament: TournamentDetails;
    registeredTeams: UserRegisteredTeam[];
    locale: string;
    initialTeamId?: string;
    hideHeader?: boolean;
    backHref?: string;
}

const createInitialPlayers = (count = 5): BulkPlayerInput[] =>
    Array.from({ length: count }, () => ({
        name: "",
        nickname: "",
        number: "",
        position: "",
        tel: "",
        photoFile: null,
        photoPreview: null
    }));

export function DocumentSubmissionClient({
    tournament,
    registeredTeams,
    locale,
    initialTeamId,
}: DocumentSubmissionClientProps) {
    const [selectedRegId, setSelectedRegId] = useState<string>(
        initialTeamId || (registeredTeams.length > 0 ? registeredTeams[0].id : "")
    );
    const [senderName, setSenderName] = useState<string>("");
    const [senderPhone, setSenderPhone] = useState<string>("");
    const [isPending, startTransition] = useTransition();

    const [players, setPlayers] = useState<BulkPlayerInput[]>(createInitialPlayers(6));
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const [searchResults, setSearchResults] = useState<MasterPlayerSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const [existingPlayers, setExistingPlayers] = useState<Player[]>([]);
    const [isLoadingExisting, setIsLoadingExisting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [isParsingFile, setIsParsingFile] = useState(false);

    // Reset or clear sender verification info when team changes so user verifies by typing
    useEffect(() => {
        setSenderName("");
        setSenderPhone("");
    }, [selectedRegId]);

    // Fetch existing players for the team
    useEffect(() => {
        if (selectedRegId) {
            const fetchExisting = async () => {
                setIsLoadingExisting(true);
                try {
                    const { getPlayers } = await import("@/actions/manager/team");
                    const res = await getPlayers(selectedRegId);
                    if (res.success && res.data) {
                        setExistingPlayers(res.data);
                    } else {
                        setExistingPlayers([]);
                    }
                } catch {
                    setExistingPlayers([]);
                } finally {
                    setIsLoadingExisting(false);
                }
            };
            fetchExisting();
        } else {
            setExistingPlayers([]);
        }
    }, [selectedRegId]);

    const updatePlayer = <K extends keyof BulkPlayerInput>(
        index: number,
        field: K,
        value: BulkPlayerInput[K]
    ) => {
        setPlayers((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handlePhotoChange = (index: number, file: File | null) => {
        if (!file) {
            updatePlayer(index, "photoFile", null);
            updatePlayer(index, "photoPreview", null);
            return;
        }
        updatePlayer(index, "photoFile", file);
        const reader = new FileReader();
        reader.onloadend = () => {
            updatePlayer(index, "photoPreview", reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const addPlayerRow = (count = 3) => {
        setPlayers((prev) => [...prev, ...createInitialPlayers(count)]);
    };

    const removePlayerRow = (index: number) => {
        setPlayers((prev) => {
            if (prev.length <= 1) return createInitialPlayers(1);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleSearch = async (val: string) => {
        setIsSearching(true);
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
                const unique = mapped.filter(
                    (item, idx, self) => idx === self.findIndex((t) => t.name === item.name)
                );
                setSearchResults(unique);
            } else {
                setSearchResults([]);
            }
        } catch (err) {
            console.error("Master player search error:", err);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleNameChange = (index: number, val: string) => {
        updatePlayer(index, "name", val);
        if (val.trim().length > 0) {
            setFocusedIndex(index);
            handleSearch(val);
        } else {
            setFocusedIndex(null);
            setSearchResults([]);
        }
    };

    const handleSelectMasterPlayer = (index: number, gp: MasterPlayerSearchResult) => {
        updatePlayer(index, "name", gp.name);
        updatePlayer(index, "tel", gp.tel || "");
        setFocusedIndex(null);
        setSearchResults([]);
    };

    const isThai = locale === "th";
    const positionOptions = getPositionOptions(tournament.sport_name);

    // Download clean template Excel
    const handleDownloadTemplate = () => {
        // Collect position examples from positionOptions
        const playerPosValues = positionOptions
            .filter((p) => p.category !== "staff")
            .map((p) => p.value)
            .join("/");
        const staffPosValues = "ผู้จัดการทีม/ผู้ฝึกสอน/ผู้ช่วยผู้ฝึกสอน";
        const positionHeader = `ตำแหน่ง (Position: ${playerPosValues ? `${playerPosValues}/` : ""}${staffPosValues})`;

        const headers = [
            "หมายเลขเสื้อ (Number)",
            "ชื่อ-นามสกุล (Full Name)",
            "ชื่อเล่น (Nickname)",
            positionHeader,
            "เบอร์โทรศัพท์ (Phone)"
        ];

        // Prepare sample rows matching the sport
        const nonStaffPositions = positionOptions.filter((p) => p.category !== "staff");
        const samplePlayer1 = nonStaffPositions[0]?.value || "1";
        const samplePlayer2 = nonStaffPositions[1]?.value || nonStaffPositions[0]?.value || "2";
        const samplePlayer3 = nonStaffPositions[2]?.value || nonStaffPositions[0]?.value || "3";

        const sampleData = [
            ["", "สมชาย สายลม", "บอล", "ผู้จัดการทีม", "0812345678"],
            ["", "เอกชัย นำโชค", "เอก", "ผู้ฝึกสอน", "0891112233"],
            ["", "เกรียงไกร ชนะภัย", "ไก่", "ผู้ช่วยผู้ฝึกสอน", "0894445566"],
            ["1", "กิตติพงษ์ วงศ์ดี", "กิต", samplePlayer1, "0898765432"],
            ["7", "วรวุฒิ สุขใจ", "อาร์ม", samplePlayer2, "0823456789"],
            ["10", "ธนากร แก้วกล้า", "บาส", samplePlayer3, "0856789012"]
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        // Set column widths
        ws["!cols"] = [
            { wch: 22 },
            { wch: 30 },
            { wch: 20 },
            { wch: Math.max(35, positionHeader.length + 2) },
            { wch: 22 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "RosterTemplate");
        const safeTournamentName = (tournament.name || "tournament").replace(/[/\\?%*:|"<>]/g, "_");
        XLSX.writeFile(wb, `Template_รายชื่อนักกีฬา_${safeTournamentName}.xlsx`);
        toast.success("ดาวน์โหลดแบบฟอร์ม Template สำเร็จ");
    };

    // Normalize position string to valid position code based on sport position options
    const normalizePosition = (val: string): string => {
        const raw = (val || "").trim();
        const clean = raw.toUpperCase();
        if (!clean) return "";

        // Common staff roles for all sports
        if (clean.includes("ผู้จัดการ") || clean.includes("MANAGER")) return "ผู้จัดการทีม";
        if (clean.includes("ผู้ช่วย") || clean.includes("ASST") || clean.includes("ASSISTANT")) return "ผู้ช่วยผู้ฝึกสอน";
        if (clean.includes("ผู้ฝึกสอน") || clean.includes("โค้ช") || clean.includes("COACH")) return "ผู้ฝึกสอน";

        // Try to match against available sport positions
        const matched = positionOptions.find((p) => {
            const pValUpper = p.value.toUpperCase();
            const pThUpper = p.labelTh.toUpperCase();
            const pEnUpper = p.labelEn.toUpperCase();
            return clean === pValUpper || clean === pThUpper || clean === pEnUpper || pThUpper.includes(clean) || pEnUpper.includes(clean);
        });

        if (matched) {
            return matched.value;
        }

        return raw;
    };

    // Handle File Upload and Parsing (.xlsx, .xls, .csv)
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsParsingFile(true);
        setUploadedFileName(file.name);

        try {
            const ext = file.name.split(".").pop()?.toLowerCase();
            const parsedRows: { number: string; name: string; nickname: string; position: string; tel: string }[] = [];

            if (ext === "csv") {
                const text = await file.text();
                Papa.parse(text, {
                    header: false,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const data = results.data as string[][];
                        data.forEach((row, idx) => {
                            if (idx === 0 && (row[0]?.includes("Number") || row[0]?.includes("หมายเลข") || row[1]?.includes("ชื่อ"))) {
                                return; // Header row
                            }
                            if (row.length >= 2 && (row[0]?.trim() || row[1]?.trim())) {
                                // If 5 columns: number, name, nickname, position, tel
                                // If 4 columns: number, name, position, tel
                                const hasNicknameCol = row.length >= 5;
                                parsedRows.push({
                                    number: String(row[0] || "").trim(),
                                    name: String(row[1] || "").trim(),
                                    nickname: hasNicknameCol ? String(row[2] || "").trim() : "",
                                    position: normalizePosition(String(hasNicknameCol ? row[3] : row[2] || "")),
                                    tel: String((hasNicknameCol ? row[4] : row[3]) || "").trim()
                                });
                            }
                        });
                        applyParsedRows(parsedRows);
                    }
                });
            } else if (ext === "xlsx" || ext === "xls") {
                const arrayBuffer = await file.arrayBuffer();
                const wb = XLSX.read(arrayBuffer, { type: "array" });
                const firstSheetName = wb.SheetNames[0];
                const ws = wb.Sheets[firstSheetName];
                const rawJson = XLSX.utils.sheet_to_json(ws, { header: 1 }) as (string | number)[][];

                rawJson.forEach((row, idx) => {
                    const row0 = String(row[0] || "");
                    const row1 = String(row[1] || "");
                    if (idx === 0 && (row0.includes("Number") || row0.includes("หมายเลข") || row1.includes("ชื่อ"))) {
                        return; // Header row
                    }
                    if (row && row.length >= 2 && (row0.trim() || row1.trim())) {
                        const hasNicknameCol = row.length >= 5;
                        parsedRows.push({
                            number: String(row[0] ?? "").trim(),
                            name: String(row[1] ?? "").trim(),
                            nickname: hasNicknameCol ? String(row[2] ?? "").trim() : "",
                            position: normalizePosition(String(hasNicknameCol ? row[3] : row[2] ?? "")),
                            tel: String((hasNicknameCol ? row[4] : row[3]) ?? "").trim()
                        });
                    }
                });
                applyParsedRows(parsedRows);
            } else {
                toast.error("รองรับเฉพาะไฟล์ .xlsx, .xls หรือ .csv เท่านั้น");
                setIsParsingFile(false);
            }
        } catch (err) {
            console.error("File parse error:", err);
            toast.error("เกิดข้อผิดพลาดในการอ่านไฟล์ กรุณาตรวจสอบรูปแบบไฟล์");
            setIsParsingFile(false);
        }
    };

    const applyParsedRows = (rows: { number: string; name: string; nickname: string; position: string; tel: string }[]) => {
        const validRows = rows.filter((r) => r.name.trim().length > 0);
        if (validRows.length === 0) {
            toast.error("ไม่พบข้อมูลรายชื่อนักกีฬาในไฟล์ที่อัปโหลด");
            setIsParsingFile(false);
            return;
        }

        const newPlayers: BulkPlayerInput[] = validRows.map((r) => ({
            name: r.name,
            nickname: r.nickname,
            number: r.number,
            position: r.position,
            tel: r.tel,
            photoFile: null,
            photoPreview: null
        }));

        setPlayers(newPlayers);
        toast.success(`นำเข้ารายชื่อ ${validRows.length} คน จากไฟล์สำเร็จ! กรุณาตรวจสอบและกดส่งเอกสาร`);
        setIsParsingFile(false);
    };

    const currentSelectedTeam = registeredTeams.find((t) => t.id === selectedRegId);
    const registeredPhoneClean = (currentSelectedTeam?.contact_phone || "").replace(/\D/g, "");
    const senderPhoneClean = senderPhone.replace(/\D/g, "");
    const isPhoneEntered = senderPhoneClean.length >= 9;
    const isPhoneMatched = registeredPhoneClean ? senderPhoneClean === registeredPhoneClean : true;
    const isPhoneMismatch = Boolean(registeredPhoneClean && isPhoneEntered && senderPhoneClean !== registeredPhoneClean);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedRegId) {
            toast.error("กรุณาเลือกทีมที่ต้องการส่งเอกสาร");
            return;
        }
        if (!senderName.trim()) {
            toast.error("กรุณากรอกชื่อผู้สมัคร / ผู้ยื่นเอกสาร");
            return;
        }
        if (!senderPhone.trim()) {
            toast.error("กรุณากรอกเบอร์โทรศัพท์ของผู้สมัคร");
            return;
        }

        // Verify phone matches registered phone
        if (registeredPhoneClean && senderPhoneClean !== registeredPhoneClean) {
            toast.error("เบอร์โทรศัพท์ไม่ถูกต้อง (ไม่ตรงกับเบอร์ที่ใช้สมัครลงทะเบียนทีมนี้)");
            return;
        }

        const activePlayers = players.filter((p) => p.name.trim().length > 0);
        if (activePlayers.length === 0) {
            toast.error("กรุณากรอกหรือนำเข้ารายชื่อนักกีฬาอย่างน้อย 1 คน");
            return;
        }

        const formData = new FormData();
        formData.append("tournamentTeamId", selectedRegId);
        formData.append("senderName", senderName);
        formData.append("senderPhone", senderPhone);
        formData.append("count", activePlayers.length.toString());

        activePlayers.forEach((p, idx) => {
            // Include nickname with name if provided e.g. "สมชาย สายลม (บอล)"
            const fullNameWithNickname = p.nickname.trim()
                ? `${p.name.trim()} (${p.nickname.trim()})`
                : p.name.trim();
            formData.append(`name_${idx}`, fullNameWithNickname);
            formData.append(`number_${idx}`, p.number);
            formData.append(`position_${idx}`, p.position);
            formData.append(`tel_${idx}`, p.tel);
            if (p.photoFile) {
                formData.append(`photo_${idx}`, p.photoFile);
            }
        });

        startTransition(async () => {
            try {
                const res = await submitRosterWithSender(formData);
                if (res.success) {
                    toast.success(res.message || "ส่งเอกสารและรายชื่อนักกีฬาเรียบร้อยแล้ว");
                    // Refresh existing
                    const { getPlayers } = await import("@/actions/manager/team");
                    const pRes = await getPlayers(selectedRegId);
                    if (pRes.success && pRes.data) {
                        setExistingPlayers(pRes.data);
                    }
                    setUploadedFileName(null);
                    setPlayers(createInitialPlayers(3));
                } else {
                    toast.error(res.error || "เกิดข้อผิดพลาดในการส่งเอกสาร");
                }
            } catch (err) {
                console.error("submit error:", err);
                toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์");
            }
        });
    };

    const isPastDeadline = isPastDocumentDeadline(tournament.document_deadline);

    return (
        <div className="space-y-2 md:space-y-4 pb-4">
            {/* Tournament Deadline Notice */}
            {tournament.document_deadline && (
                <div
                    className={cn(
                        "p-3 md:p-4 rounded-sm border backdrop-blur-lg flex items-center justify-between gap-3 text-xs",
                        isPastDeadline
                            ? "bg-destructive/10 border-destructive/30 text-destructive"
                            : "bg-primary/5 border-primary/20 text-foreground"
                    )}
                >
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0 text-primary" />
                        <div>
                            <span className="font-bold">กำหนดวันปิดรับเอกสาร: </span>
                            <span>{formatDate(tournament.document_deadline, "d MMMM yyyy", locale)}</span>
                            {isPastDeadline && (
                                <span className="ml-2 font-black text-destructive">(หมดเขตรับเอกสารแล้ว)</span>
                            )}
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadTemplate}
                        className="gap-1.5 h-9 text-xs font-bold"
                    >
                        <Download className="h-4 w-4 text-primary" />
                        ดาวน์โหลด Template (.xlsx)
                    </Button>
                </div>
            )}

            {registeredTeams.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title="ไม่พบทีมที่ลงทะเบียนในรายการนี้"
                    description="บัญชีของคุณยังไม่มีทีมที่สมัครลงทะเบียนในรายการนี้ จึงไม่สามารถส่งเอกสารหรือรายชื่อนักกีฬาได้"
                    action={
                        <Button asChild variant="default" size="sm">
                            <Link href={`/registrations/${tournament.id}`}>
                                ไปที่หน้าลงทะเบียนทีม
                            </Link>
                        </Button>
                    }
                />
            ) : (
                <form onSubmit={handleSubmit} className="space-y-2 md:space-y-4">
                    {/* Step 1: Select Team & Contact Info */}
                    <Card className="rounded-sm border bg-card/50 backdrop-blur-lg">
                        <CardHeader className="p-4">
                            <div className="flex items-center gap-1">
                                <CardTitle className="text-base font-bold">เลือกทีมและข้อมูลผู้ยื่นเอกสาร</CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                เลือกทีมที่ต้องการส่งรายชื่อนักกีฬา พร้อมยืนยันตัวตนด้วยชื่อและเบอร์โทรศัพท์ที่ใช้สมัคร
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 px-4 pb-4">
                                {/* Team Selection */}
                                <div className="space-y-1 md:col-span-1">
                                    <Label>เลือกทีมที่ลงทะเบียน <span className="text-destructive">*</span></Label>
                                    <Select value={selectedRegId} onValueChange={setSelectedRegId}>
                                        <SelectTrigger className="w-full h-9 text-xs lg:text-xs font-medium">
                                            <SelectValue placeholder="เลือกทีม" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {registeredTeams.map((rt) => {
                                                const catName =
                                                    rt.tournament_categories?.age_categories?.category_name || "ทั่วไป";
                                                const gender =
                                                    rt.tournament_categories?.gender_type === "open"
                                                        ? "ทั่วไป"
                                                        : rt.tournament_categories?.gender_type === "male"
                                                        ? "ชาย"
                                                        : rt.tournament_categories?.gender_type === "female"
                                                        ? "หญิง"
                                                        : "ผสม";
                                                return (
                                                    <SelectItem key={rt.id} value={rt.id} className="text-xs">
                                                        {rt.team?.name || "ไม่ทราบชื่อทีม"} - รุ่น {catName} ({gender})
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Sender Name */}
                                <div className="space-y-1 md:col-span-1">
                                    <Label>ชื่อผู้สมัคร / ผู้ยื่นเอกสาร <span className="text-destructive">*</span></Label>
                                    <Input
                                        type="text"
                                        placeholder="ชื่อ-นามสกุล ผู้จัดการทีม/ผู้สมัคร"
                                        value={senderName}
                                        onChange={(e) => setSenderName(e.target.value)}
                                        className="h-9 text-xs"
                                        required
                                    />
                                </div>

                                {/* Sender Phone */}
                                <div className="space-y-1 md:col-span-1">
                                    <div className="flex items-center justify-between">
                                        <Label>เบอร์โทรศัพท์ผู้สมัคร <span className="text-destructive">*</span></Label>
                                        {registeredPhoneClean && isPhoneEntered && (
                                            isPhoneMatched ? (
                                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                                    <ShieldCheck className="h-4 w-4" />
                                                    เบอร์ถูกต้อง
                                                </span>
                                            ) : (
                                                <span className="text-[11px] text-destructive font-bold flex items-center gap-1">
                                                    <AlertCircle className="h-4 w-4" />
                                                    เบอร์ไม่ตรงกับที่สมัคร
                                                </span>
                                            )
                                        )}
                                    </div>
                                    <Input
                                        type="tel"
                                        placeholder="เบอร์โทรศัพท์ที่ใช้ลงทะเบียน"
                                        value={senderPhone}
                                        onChange={(e) => setSenderPhone(e.target.value)}
                                        className={cn(
                                            "h-9 text-xs transition-colors",
                                            isPhoneMismatch && "border-destructive focus-visible:ring-destructive",
                                            registeredPhoneClean && isPhoneEntered && isPhoneMatched && "border-emerald-500 focus-visible:ring-emerald-500"
                                        )}
                                        required
                                    />
                                    {isPhoneMismatch && (
                                        <p className="text-[10px] text-destructive mt-1">
                                            * กรุณากรอกเบอร์โทรศัพท์เดียวกับที่ใช้ลงทะเบียนทีมนี้
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Step 2: Upload File or Manual Form Entry */}
                    <Card className="rounded-sm border bg-card/50 backdrop-blur-lg">
                        <CardHeader className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <CardTitle className="text-base font-bold">ข้อมูลรายชื่อนักกีฬา</CardTitle>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept=".xlsx,.xls,.csv"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isParsingFile}
                                        className="gap-1.5 h-8 text-xs font-bold border-primary/40 text-primary hover:bg-primary/10"
                                    >
                                        {isParsingFile ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Upload className="h-4 w-4" />
                                        )}
                                        อัปโหลดไฟล์รายชื่อ (.xlsx, .csv)
                                    </Button>
                                </div>
                            </div>
                            <CardDescription className="text-xs">
                                คุณสามารถดาวน์โหลด Template ไปกรอกแล้วนำมาอัปโหลด หรือกรอกรายชื่อลงในตารางด้านล่างโดยตรงได้ทันที
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4 px-4 pb-4">
                            {/* Uploaded File Banner */}
                            {uploadedFileName && (
                                <div className="flex items-center justify-between p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-sm text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>นำเข้าข้อมูลจากไฟล์: {uploadedFileName}</span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[10px] px-2"
                                        onClick={() => {
                                            setUploadedFileName(null);
                                            setPlayers(createInitialPlayers(3));
                                        }}
                                    >
                                        ล้างข้อมูล
                                    </Button>
                                </div>
                            )}

                            {/* Existing Registered Players (Read-Only) */}
                            {selectedRegId && !isLoadingExisting && existingPlayers.length > 0 && (
                                <div className="space-y-2 pb-3 border-b border-border">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                            รายชื่อนักกีฬาที่ลงทะเบียนและอนุมัติแล้ว ({existingPlayers.length} คน)
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                        {existingPlayers.map((player) => (
                                            <div
                                                key={`existing-${player.id}`}
                                                className="border rounded-sm p-2 flex items-center gap-3 bg-muted/20"
                                            >
                                                <div className="h-10 w-10 rounded-full border flex items-center justify-center overflow-hidden bg-muted shrink-0">
                                                    {resolveStorageUrl(player.photo_url) ? (
                                                        <Image
                                                            src={resolveStorageUrl(player.photo_url) || ""}
                                                            alt={player.name}
                                                            width={40}
                                                            height={40}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <User className="h-4 w-4 text-muted-foreground/50" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        {player.number && (
                                                            <Badge variant="outline">
                                                                #{player.number}
                                                            </Badge>
                                                        )}
                                                        <span className="text-xs font-bold truncate">{player.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                                        <span>{player.position || "-"}</span>
                                                        {player.tel && <span>• {player.tel}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {isLoadingExisting && (
                                <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    <span>กำลังโหลดรายชื่อนักกีฬาของทีม...</span>
                                </div>
                            )}

                            {/* Player Input Cards */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold">
                                        รายชื่อที่จะยื่นเอกสาร (ระบุข้อมูลนักกีฬา)
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        กรอกแล้ว {players.filter((p) => p.name.trim().length > 0).length} คน
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {players.map((player, idx) => (
                                        <div
                                            key={idx}
                                            className="border rounded-sm p-3 relative flex flex-col items-center gap-2`1 hover:border-primary/40 transition-colors"
                                        >
                                            {/* Remove row button */}
                                            {players.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removePlayerRow(idx)}
                                                    className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors p-1"
                                                    title="ลบแถวนี้"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}

                                            {/* Photo Selector */}
                                            <div className="relative mt-1">
                                                <PlayerUploader
                                                    id={`doc-roster-photo-${idx}`}
                                                    size="md"
                                                    initialUrl={player.photoPreview}
                                                    onFileChange={(file) => handlePhotoChange(idx, file)}
                                                    onRemove={() => handlePhotoChange(idx, null)}
                                                />
                                            </div>

                                            {/* Fields */}
                                            <div className="w-full space-y-1.5 mt-1">
                                                {/* Player Name with Autocomplete Search */}
                                                <div className="relative">
                                                    <Input
                                                        type="text"
                                                        value={player.name}
                                                        placeholder="ชื่อ-นามสกุล *"
                                                        onChange={(e) => handleNameChange(idx, e.target.value)}
                                                        className="h-8 text-xs font-semibold"
                                                        onFocus={() => {
                                                            if (player.name.trim().length > 0) {
                                                                setFocusedIndex(idx);
                                                                handleSearch(player.name);
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            setTimeout(() => {
                                                                setFocusedIndex(null);
                                                            }, 200);
                                                        }}
                                                    />
                                                    {focusedIndex === idx &&
                                                        (isSearching || searchResults.length > 0) && (
                                                            <div className="absolute left-0 right-0 top-full mt-1 z-[100] rounded-sm border border-border bg-card shadow-2xl max-h-[140px] overflow-y-auto">
                                                                {isSearching ? (
                                                                    <div className="flex items-center justify-center py-3 gap-1 text-[10px] text-muted-foreground">
                                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                                        <span>กำลังค้นหา...</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="py-0.5">
                                                                        {searchResults.map((gp) => (
                                                                            <button
                                                                                key={gp.id}
                                                                                type="button"
                                                                                className="w-full text-left px-2 py-1.5 hover:bg-primary/10 flex items-center justify-between text-xs transition-colors border-b last:border-0"
                                                                                onMouseDown={() =>
                                                                                    handleSelectMasterPlayer(idx, gp)
                                                                                }
                                                                            >
                                                                                <span className="font-bold">
                                                                                    {gp.name}
                                                                                </span>
                                                                                <ArrowRight className="h-4 w-4 text-primary" />
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                </div>

                                                {/* Nickname (ชื่อเล่น) */}
                                                <Input
                                                    type="text"
                                                    value={player.nickname}
                                                    onChange={(e) => updatePlayer(idx, "nickname", e.target.value)}
                                                    placeholder="ชื่อเล่น"
                                                    className="h-8 text-xs"
                                                />

                                                {/* Number & Position */}
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <Input
                                                        type="text"
                                                        value={player.number}
                                                        onChange={(e) =>
                                                            updatePlayer(idx, "number", e.target.value)
                                                        }
                                                        placeholder="เบอร์เสื้อ"
                                                        className="h-8 text-xs"
                                                    />
                                                    <Select
                                                        value={player.position}
                                                        onValueChange={(val) =>
                                                             updatePlayer(idx, "position", val)
                                                         }
                                                     >
                                                         <SelectTrigger className="w-full h-8 text-xs lg:text-xs font-medium">
                                                             <SelectValue placeholder="ตำแหน่ง" />
                                                         </SelectTrigger>
                                                         <SelectContent>
                                                             {positionOptions.map((pos) => (
                                                                 <SelectItem key={pos.value} value={pos.value} className="text-xs">
                                                                     {isThai ? pos.labelTh : pos.labelEn}
                                                                 </SelectItem>
                                                             ))}
                                                         </SelectContent>
                                                     </Select>
                                                </div>

                                                {/* Phone Number */}
                                                <Input
                                                    type="tel"
                                                    value={player.tel}
                                                    onChange={(e) => updatePlayer(idx, "tel", e.target.value)}
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
                                        onClick={() => addPlayerRow(3)}
                                        className="h-8 text-xs font-bold gap-1"
                                    >
                                        <Plus className="h-4 w-4" />
                                        เพิ่มช่องกรอกนักกีฬา (+3)
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Submit Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border rounded-sm bg-card/50 backdrop-blur-lg">
                        <div className="text-xs text-muted-foreground text-center sm:text-left">
                            ตรวจสอบความถูกต้องของรายชื่อและข้อมูลผู้ส่งก่อนกดยืนยันส่งเอกสาร
                        </div>
                        <Button
                            type="submit"
                            size="default"
                            disabled={isPending || !selectedRegId || !senderName.trim() || !senderPhone.trim() || (Boolean(registeredPhoneClean) && !isPhoneMatched)}
                            className="w-full sm:w-auto font-bold text-sm px-8"
                        >
                            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isPending ? "กำลังบันทึกและส่งเอกสาร..." : "ยืนยันส่งเอกสาร"}
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}

