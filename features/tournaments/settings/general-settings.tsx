"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { updateTournament } from "@/actions/tournaments/general";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/ui/header";
import { useTranslations, useLocale } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import {
    Camera,
    Trophy,
    Activity,
    Calendar,
    CalendarCheck,
    FileText,
    MapPin,
    Globe,
    Loader2,
    Upload,
    Lock,
    ShieldAlert
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ActionResponse, Tournament } from "@/types/index";
import dynamic from "next/dynamic";
import Image from "next/image";
import { LogoUploader } from "@/components/shared/logo-uploader";
import { DateRangePicker, DatePicker } from "@/components/ui/date-picker";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });
const MapPicker = dynamic(() => import("./map-picker"), {
    ssr: false,
    loading: () => (
        <div className="w-full aspect-[2/1] rounded-sm bg-muted/20 animate-pulse flex items-center justify-center border border-foreground/10">
            <span className="text-xs text-muted-foreground">Loading interactive map...</span>
        </div>
    )
});

const initialState: ActionResponse = {
    success: false,
    error: undefined,
};

interface GeneralSettingsProps {
    tournament: Tournament;
    className?: string;
    onNavigateDangerZone?: () => void;
}

type ActionField = 'media' | 'name' | 'status' | 'period' | 'deadline' | 'description' | 'location' | 'map';

export function GeneralSettings({ tournament, className, onNavigateDangerZone }: GeneralSettingsProps) {
    const t = useTranslations("Settings");
    const tCommon = useTranslations("Common");
    const locale = useLocale();
    const isThai = locale === 'th';
    const { toast } = useToast();

    const updateTournamentWithId = updateTournament.bind(null, tournament.id);
    const [state, formAction, isPending] = useActionState(updateTournamentWithId, initialState);

    // Initial values
    const initialName = tournament.name || "";
    const initialStatus = tournament.status || "draft";
    const initialLocationName = tournament.location_name || "";
    const initialGoogleMapUrl = tournament.google_map_url || "";
    const initialDescription = tournament.description || "";
    const initialStartDate = tournament.start_date ? new Date(tournament.start_date).toISOString().split('T')[0] : "";
    const initialEndDate = tournament.end_date ? new Date(tournament.end_date).toISOString().split('T')[0] : "";
    const initialDocDeadline = tournament.document_deadline ? new Date(tournament.document_deadline).toISOString().split('T')[0] : "";
    const initialLogoUrl = tournament.logo_img || (tournament as any).logo_url || null;
    const initialCoverUrl = tournament.cover_img || (tournament as any).banner_url || null;

    // Form states
    const [name, setName] = useState(initialName);
    const [status, setStatus] = useState<string>(initialStatus);
    const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);
    const isStatusLocked = initialStatus === 'completed' || initialStatus === 'cancelled';
    const [locationName, setLocationName] = useState(initialLocationName);
    const [googleMapUrl, setGoogleMapUrl] = useState(initialGoogleMapUrl);
    const [description, setDescription] = useState(initialDescription);
    const [startDate, setStartDate] = useState<string>(initialStartDate);
    const [endDate, setEndDate] = useState<string>(initialEndDate);
    const [docDeadline, setDocDeadline] = useState<string>(initialDocDeadline);

    const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(initialLogoUrl);
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(initialCoverUrl);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [logoRemoved, setLogoRemoved] = useState(false);
    const [coverRemoved, setCoverRemoved] = useState(false);
    const coverInputRef = useRef<HTMLInputElement>(null);

    // Track last modified field for profile-form style inline action buttons
    const [lastModifiedField, setLastModifiedField] = useState<ActionField | null>(null);

    // Sync when tournament changes
    useEffect(() => {
        setName(initialName);
        setStatus(initialStatus);
        setLocationName(initialLocationName);
        setGoogleMapUrl(initialGoogleMapUrl);
        setDescription(initialDescription);
        setStartDate(initialStartDate);
        setEndDate(initialEndDate);
        setDocDeadline(initialDocDeadline);
        setLogoPreviewUrl(initialLogoUrl);
        setCoverPreviewUrl(initialCoverUrl);
        setLogoFile(null);
        setCoverFile(null);
        setLogoRemoved(false);
        setCoverRemoved(false);
        setLastModifiedField(null);
    }, [initialName, initialStatus, initialLocationName, initialGoogleMapUrl, initialDescription, initialStartDate, initialEndDate, initialDocDeadline, initialLogoUrl, initialCoverUrl]);

    useEffect(() => {
        if (state.success) {
            toast({
                title: tCommon("success"),
                description: t("update_success_desc") || (isThai ? "อัปเดตข้อมูลทัวร์นาเมนต์เรียบร้อยแล้ว" : "Tournament updated successfully"),
            });
            setLastModifiedField(null);
            setLogoFile(null);
            setCoverFile(null);
            setLogoRemoved(false);
            setCoverRemoved(false);
        } else if (state.error) {
            toast({
                title: tCommon("error"),
                description: state.error,
                variant: "destructive",
            });
        }
    }, [state, tCommon, t, toast, isThai]);

    // Check dirty states
    const isMediaDirty = logoFile !== null || coverFile !== null || logoRemoved || coverRemoved || logoPreviewUrl !== initialLogoUrl || coverPreviewUrl !== initialCoverUrl;
    const isNameDirty = name !== initialName;
    const isStatusDirty = status !== initialStatus;
    const isPeriodDirty = startDate !== initialStartDate || endDate !== initialEndDate;
    const isDeadlineDirty = docDeadline !== initialDocDeadline;
    const isDescriptionDirty = description !== initialDescription;
    const isLocationDirty = locationName !== initialLocationName;
    const isMapDirty = googleMapUrl !== initialGoogleMapUrl;

    const isDirty = isMediaDirty || isNameDirty || isStatusDirty || isPeriodDirty || isDeadlineDirty || isDescriptionDirty || isLocationDirty || isMapDirty;

    const activeActionField: ActionField | null = !isDirty
        ? null
        : lastModifiedField && (
            (lastModifiedField === 'media' && isMediaDirty) ||
            (lastModifiedField === 'name' && isNameDirty) ||
            (lastModifiedField === 'status' && isStatusDirty) ||
            (lastModifiedField === 'period' && isPeriodDirty) ||
            (lastModifiedField === 'deadline' && isDeadlineDirty) ||
            (lastModifiedField === 'description' && isDescriptionDirty) ||
            (lastModifiedField === 'location' && isLocationDirty) ||
            (lastModifiedField === 'map' && isMapDirty)
        )
        ? lastModifiedField
        : isNameDirty
        ? 'name'
        : isStatusDirty
        ? 'status'
        : isPeriodDirty
        ? 'period'
        : isDeadlineDirty
        ? 'deadline'
        : isDescriptionDirty
        ? 'description'
        : isLocationDirty
        ? 'location'
        : isMapDirty
        ? 'map'
        : isMediaDirty
        ? 'media'
        : null;

    const handleReset = () => {
        setName(initialName);
        setStatus(initialStatus);
        setLocationName(initialLocationName);
        setGoogleMapUrl(initialGoogleMapUrl);
        setDescription(initialDescription);
        setStartDate(initialStartDate);
        setEndDate(initialEndDate);
        setDocDeadline(initialDocDeadline);
        setLogoPreviewUrl(initialLogoUrl);
        setCoverPreviewUrl(initialCoverUrl);
        setLogoFile(null);
        setCoverFile(null);
        setLogoRemoved(false);
        setCoverRemoved(false);
        if (coverInputRef.current) coverInputRef.current.value = "";
        setLastModifiedField(null);
    };

    const renderActionButtons = () => (
        <div className="flex items-center gap-2 pt-4 animate-in fade-in-50 duration-200">
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={handleReset}
                className="text-xs"
            >
                {isThai ? "ยกเลิก" : "Cancel"}
            </Button>
            <Button
                type="submit"
                size="sm"
                disabled={isPending}
                variant="default"
                className="text-xs font-semibold"
            >
                {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : null}
                <span>{isThai ? "บันทึก" : "Save"}</span>
            </Button>
        </div>
    );

    return (
        <div className={cn("space-y-4", className)}>
            {/* Card Section Header (CategorySettings & profile-form style) */}
            <div>
                <Header level={4}>
                    {isThai ? "ข้อมูลทั่วไปของทัวร์นาเมนต์" : "General Information"}
                </Header>
                <p className="text-xs text-muted-foreground">
                    {isThai
                        ? "จัดการรายละเอียดพื้นฐาน รูปภาพ วันที่ และสถานที่จัดการแข่งขัน"
                        : "Manage tournament basic details, banners, dates, and venue information."}
                </p>
            </div>

            <form action={formAction}>
                <input type="hidden" name="form_type" value="general" />
                <input type="hidden" name="logo_img_remove" value={String(logoRemoved)} />
                <input type="hidden" name="cover_img_remove" value={String(coverRemoved)} />

                {/* 1. Cover Banner & Logo */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <Camera className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {isThai ? "รูปภาพหน้าปกและโลโก้" : "Cover Banner & Logo"}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai
                                    ? "ภาพหน้าปก (1440x720) และโลโก้สำหรับการประชาสัมพันธ์การแข่งขัน"
                                    : "Cover banner (1440x720) and tournament logo"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 space-y-2">
                        <div className="relative pb-10">
                            <div
                                onClick={() => coverInputRef.current?.click()}
                                className="relative aspect-[2/1] w-full border border-dashed border-2 hover:border-primary/50 transition-all rounded-sm overflow-hidden flex flex-col items-center justify-center cursor-pointer group bg-muted/10"
                            >
                                {coverPreviewUrl ? (
                                    <>
                                        <Image
                                            src={coverPreviewUrl}
                                            alt="Cover Preview"
                                            fill
                                            className="object-cover p-1 rounded-sm transition-transform group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="font-bold text-xs"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    coverInputRef.current?.click();
                                                }}
                                            >
                                                {isThai ? "เปลี่ยนรูป" : "Change Image"}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                className="font-bold text-xs"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCoverPreviewUrl(null);
                                                    setCoverFile(null);
                                                    setCoverRemoved(true);
                                                    setLastModifiedField('media');
                                                    if (coverInputRef.current) coverInputRef.current.value = "";
                                                }}
                                            >
                                                {isThai ? "ลบรูป" : "Remove"}
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-4 text-center space-y-2 pb-12">
                                        <div className="group p-3 bg-muted rounded-full text-muted-foreground transition-transform group-hover:bg-primary/10 group-hover:text-primary">
                                            <Upload className="h-4 w-4" />
                                        </div>
                                        <p className="text-xs font-bold text-muted-foreground">
                                            {isThai ? "คลิกเพื่ออัปโหลดภาพหน้าปก" : "Click to upload cover banner"}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                            (1440x720)
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10 bg-card rounded-full shadow-sm">
                                <LogoUploader
                                    id="logo_img"
                                    name="logo_img"
                                    initialUrl={logoPreviewUrl}
                                    onFileChange={(file) => {
                                        setLogoFile(file);
                                        if (file) {
                                            setLogoPreviewUrl(URL.createObjectURL(file));
                                            setLogoRemoved(false);
                                        } else {
                                            setLogoPreviewUrl(null);
                                            setLogoRemoved(true);
                                        }
                                        setLastModifiedField('media');
                                    }}
                                    onRemove={() => {
                                        setLogoFile(null);
                                        setLogoPreviewUrl(null);
                                        setLogoRemoved(true);
                                        setLastModifiedField('media');
                                    }}
                                    uploadLabel={isThai ? "อัปโหลดโลโก้" : "Upload Logo"}
                                    clickToUploadLabel={isThai ? "คลิกเพื่อเปลี่ยน" : "Click to Change"}
                                    previewLabel={isThai ? "ตัวอย่าง" : "Preview"}
                                    imageFit="contain"
                                />
                            </div>

                            <input
                                id="cover_img"
                                name="cover_img"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={coverInputRef}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setCoverFile(file);
                                        setCoverPreviewUrl(URL.createObjectURL(file));
                                        setCoverRemoved(false);
                                        setLastModifiedField('media');
                                    }
                                }}
                            />
                        </div>
                        {activeActionField === 'media' && renderActionButtons()}
                    </div>
                </div>

                {/* 2. Tournament Name */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <Trophy className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {isThai ? "ชื่อทัวร์นาเมนต์" : "Tournament Name"} <span className="text-destructive">*</span>
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "ระบุชื่อการแข่งขันอย่างเป็นทางการ" : "Official tournament or league name"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 space-y-1">
                        <Input
                            type="text"
                            size="sm"
                            id="name"
                            name="name"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                setLastModifiedField('name');
                            }}
                            placeholder={isThai ? "ฟุตบอลเยาวชน ชิงถ้วยนายก ครั้งที่ 1" : "Youth Champions League 2026"}
                            className="w-full"
                            required
                        />
                        {activeActionField === 'name' && renderActionButtons()}
                    </div>
                </div>

                {/* 3. Tournament Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <Activity className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {isThai ? "สถานะการแข่งขัน" : "Tournament Status"}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "ควบคุมการแสดงผลและสถานะเปิดรับสมัคร" : "Control tournament progress and registration state"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 space-y-2">
                        <Select
                            name="status"
                            value={status}
                            disabled={isStatusLocked}
                            onValueChange={(val) => {
                                if (val === status) return;
                                setPendingStatus(val);
                                setStatusConfirmOpen(true);
                            }}
                        >
                            <SelectTrigger size="sm" className={cn("w-full", isStatusLocked && "opacity-80 cursor-not-allowed bg-muted/40")}>
                                <div className="flex items-center gap-2">
                                    {isStatusLocked && <Lock className="size-3.5 text-warning shrink-0" />}
                                    <SelectValue />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="bg-card">
                                <SelectItem value="draft" className="text-muted-foreground font-semibold text-xs cursor-pointer">
                                    {isThai ? "แบบร่าง (Draft)" : "Draft"}
                                </SelectItem>
                                <SelectItem value="ongoing" className="text-primary font-semibold text-xs cursor-pointer">
                                    {isThai ? "กำลังแข่งขัน (Ongoing)" : "Ongoing"}
                                </SelectItem>
                                <SelectItem value="completed" className="text-emerald-600 font-semibold text-xs cursor-pointer">
                                    {isThai ? "เสร็จสิ้น (Completed)" : "Completed"}
                                </SelectItem>
                                <SelectItem value="cancelled" className="text-destructive font-semibold text-xs cursor-pointer">
                                    {isThai ? "ยกเลิก (Cancelled)" : "Cancelled"}
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        {isStatusLocked && (
                            <div className="flex items-start gap-2.5 p-3 rounded-sm bg-muted/40 border border-border text-xs text-muted-foreground mt-2">
                                <Lock className="size-4 text-warning shrink-0 mt-0.5" />
                                <div className="space-y-1.5 flex-1">
                                    <p className="font-semibold text-foreground">
                                        {isThai ? "สถานะการแข่งขันถูกล็อค" : "Tournament Status Locked"}
                                    </p>
                                    <p className="text-[11px] leading-relaxed">
                                        {isThai
                                            ? `ทัวร์นาเมนต์นี้มีสถานะเป็น "${status === 'completed' ? 'เสร็จสิ้น (Completed)' : 'ยกเลิก (Cancelled)'}" แล้ว จึงไม่สามารถเปลี่ยนสถานะได้จากส่วนนี้ หากต้องการเปลี่ยนสถานะ กรุณาไปที่เมนู "พื้นที่อันตราย (Danger Zone)" เพื่อยื่นคำขอเปลี่ยนสถานะ`
                                            : `This tournament is '${status === 'completed' ? 'Completed' : 'Cancelled'}' and locked. To change status, please go to 'Danger Zone' to submit a change request.`}
                                    </p>
                                    {onNavigateDangerZone && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={onNavigateDangerZone}
                                            className="mt-1 text-xs h-7 text-destructive border-destructive/30 hover:bg-destructive/10"
                                        >
                                            <ShieldAlert className="size-3.5 mr-1 text-destructive" />
                                            {isThai ? "ไปยังพื้นที่อันตราย (Danger Zone)" : "Go to Danger Zone"}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {!isStatusLocked && activeActionField === 'status' && renderActionButtons()}
                    </div>
                </div>

                {/* 4. Tournament Period */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <Calendar className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {isThai ? "ระยะเวลาการแข่งขัน" : "Tournament Period"} <span className="text-destructive">*</span>
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "วันเริ่มต้นและสิ้นสุดการแข่งขัน" : "Tournament start and end date"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 space-y-1">
                        <input type="hidden" name="start_date" value={startDate} required />
                        <input type="hidden" name="end_date" value={endDate} required />
                        <DateRangePicker
                            startDate={startDate}
                            endDate={endDate}
                            onChange={({ startDate: s, endDate: e }) => {
                                setStartDate(s);
                                setEndDate(e);
                                setLastModifiedField('period');
                            }}
                            size="sm"
                            minYear={new Date().getFullYear() - 5}
                            maxYear={new Date().getFullYear() + 5}
                            defaultViewYear={startDate ? new Date(startDate).getFullYear() : new Date().getFullYear()}
                            placeholder={isThai ? "เลือกวันเริ่มต้น - สิ้นสุดการแข่งขัน" : "Select start - end date"}
                            disabled={isPending}
                        />
                        {activeActionField === 'period' && renderActionButtons()}
                    </div>
                </div>

                {/* 5. Document Deadline */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <CalendarCheck className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {isThai ? "วันปิดรับเอกสาร" : "Document Deadline"}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "กำหนดวันสุดท้ายสำหรับการส่งหลักฐานทีม (ถ้ามี)" : "Deadline for team document submissions (optional)"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 space-y-1">
                        <input type="hidden" name="document_deadline" value={docDeadline} />
                        <DatePicker
                            value={docDeadline}
                            onChange={(val) => {
                                setDocDeadline(val);
                                setLastModifiedField('deadline');
                            }}
                            size="sm"
                            clearable
                            minYear={new Date().getFullYear() - 5}
                            maxYear={new Date().getFullYear() + 5}
                            defaultViewYear={docDeadline ? new Date(docDeadline).getFullYear() : new Date().getFullYear()}
                            placeholder={isThai ? "เลือกวันปิดรับเอกสาร (ถ้ามี)" : "Select document deadline (optional)"}
                            disabled={isPending}
                        />
                        {activeActionField === 'deadline' && renderActionButtons()}
                    </div>
                </div>

                {/* 6. Description / Details */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <FileText className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {isThai ? "รายละเอียดเพิ่มเติม" : "Description / Details"}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "กติกาการแข่งขัน เงินรางวัล และข้อกำหนดอื่นๆ" : "Tournament rules, prize pool, terms and conditions"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 space-y-1">
                        <div className="pro-editor-wrapper relative">
                            <ReactQuill
                                theme="snow"
                                value={description}
                                onChange={(content) => {
                                    setDescription(content);
                                    setLastModifiedField('description');
                                }}
                                className="pro-editor h-auto text-foreground"
                                placeholder={isThai ? "กติกาการแข่งขัน เงินรางวัล และช่องทางการติดต่อผู้จัด..." : "Tournament rules, prize pool, and contact details..."}
                                modules={{
                                    toolbar: [
                                        [{ 'header': [1, 2, false] }],
                                        ['bold', 'underline'],
                                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                        ['clean']
                                    ]
                                }}
                            />
                        </div>
                        <input type="hidden" name="description" value={description} />
                        {activeActionField === 'description' && renderActionButtons()}
                    </div>
                </div>

                {/* 7. Location Name */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <MapPin className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {isThai ? "สถานที่จัดการแข่งขัน" : "Location / Venue Name"}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "ชื่อสนาม หรือสถานที่จัดงานหลัก" : "Venue name or sports facility"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 space-y-1">
                        <Input
                            id="location_name"
                            name="location_name"
                            size="sm"
                            value={locationName}
                            onChange={(e) => {
                                setLocationName(e.target.value);
                                setLastModifiedField('location');
                            }}
                            placeholder={isThai ? "สนามกีฬาเฉลิมพระเกียรติ 80 พรรษา" : "National Stadium Bangkok"}
                            className="w-full"
                        />
                        {activeActionField === 'location' && renderActionButtons()}
                    </div>
                </div>

                {/* 8. Map Location */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <Globe className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {isThai ? "แผนที่และพิกัด" : "Map Location"}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "ปักหมุดหรือระบุพิกัด Google Maps เพื่อให้ผู้เข้าแข่งขันเดินทางสะดวก" : "Interactive map and coordinates for participants"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 space-y-1">
                        <MapPicker
                            value={googleMapUrl}
                            onChange={(url) => {
                                setGoogleMapUrl(url);
                                setLastModifiedField('map');
                            }}
                            onLocationNameSelect={(name) => {
                                setLocationName(name);
                                setLastModifiedField('location');
                            }}
                        />
                        <input type="hidden" name="google_map_url" value={googleMapUrl} />
                        {activeActionField === 'map' && renderActionButtons()}
                    </div>
                </div>
            </form>

            {/* Status Change Confirmation Dialog */}
            <AlertDialog open={statusConfirmOpen} onOpenChange={setStatusConfirmOpen}>
                <AlertDialogContent className="rounded-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="p-2 lg:p-4 border-b">
                            <Header level={4}>
                                {isThai ? "ยืนยันการเปลี่ยนสถานะการแข่งขัน" : "Confirm Status Change"}
                            </Header>
                        </AlertDialogTitle>
                        <AlertDialogDescription className="p-2 lg:p-4 text-xs text-foreground/80 space-y-2">
                            <p>
                                {pendingStatus === 'draft' && (isThai
                                    ? "คุณต้องการเปลี่ยนสถานะเป็น \"แบบร่าง (Draft)\" ใช่หรือไม่? ข้อมูลและการตั้งค่าต่างๆ จะยังคงอยู่"
                                    : "Are you sure you want to change status to 'Draft'?")}
                                {pendingStatus === 'ongoing' && (isThai
                                    ? "คุณต้องการเปลี่ยนสถานะเป็น \"กำลังแข่งขัน (Ongoing)\" ใช่หรือไม่? ทัวร์นาเมนต์จะเปิดใช้งานและดำเนินการแข่งขัน"
                                    : "Are you sure you want to change status to 'Ongoing'?")}
                                {pendingStatus === 'completed' && (isThai
                                    ? "คุณต้องการเปลี่ยนสถานะเป็น \"เสร็จสิ้น (Completed)\" ใช่หรือไม่? เมื่อเสร็จสิ้นแล้ว จะไม่สามารถเปลี่ยนสถานะกลับจากหน้านี้ได้โดยตรง (ต้องไปที่พื้นที่อันตรายในการตั้งค่า)"
                                    : "Are you sure you want to change status to 'Completed'? Once completed, you will not be able to revert the status directly from here.")}
                                {pendingStatus === 'cancelled' && (isThai
                                    ? "คุณต้องการเปลี่ยนสถานะเป็น \"ยกเลิก (Cancelled)\" ใช่หรือไม่? การแข่งขันและระบบรับสมัครจะถูกปิด และจะไม่สามารถเปลี่ยนสถานะกลับจากหน้านี้ได้โดยตรง"
                                    : "Are you sure you want to cancel this tournament? This status cannot be reverted directly from here.")}
                            </p>
                            {(pendingStatus === 'completed' || pendingStatus === 'cancelled') && (
                                <p className="text-destructive font-medium text-[11px]">
                                    {isThai
                                        ? "*หมายเหตุ: สถานะนี้จะล็อคการเปลี่ยนสถานะทั่วไป หากต้องการเปลี่ยนกลับจะต้องดำเนินการผ่านพื้นที่อันตราย (Danger Zone)"
                                        : "*Note: This status will lock standard status changes. Any revert must be done via Danger Zone."}
                                </p>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="p-2 lg:p-4 border-t grid grid-cols-2 gap-1 md:gap-2">
                        <AlertDialogCancel
                            onClick={() => {
                                setPendingStatus(null);
                                setStatusConfirmOpen(false);
                            }}
                            className="mt-0"
                        >
                            {isThai ? "ยกเลิก" : "Cancel"}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (pendingStatus) {
                                    setStatus(pendingStatus);
                                    setLastModifiedField('status');
                                }
                                setStatusConfirmOpen(false);
                                setPendingStatus(null);
                            }}
                            className={cn(
                                pendingStatus === 'cancelled' && "bg-destructive hover:bg-destructive/90",
                                pendingStatus === 'completed' && "bg-primary hover:bg-primary/90"
                            )}
                        >
                            {isThai ? "ยืนยันเปลี่ยนสถานะ" : "Confirm"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
