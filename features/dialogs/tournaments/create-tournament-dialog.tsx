"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, ImageIcon, Loader2, Trophy, Calendar, Clock, MapPin, Map, FileText, Activity, Camera } from "lucide-react";
import Image from "next/image";
import { createTournament } from "@/actions/tournaments/general";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ActionResponse, Sport } from "@/types/index";
import { getSports } from "@/actions/manager/team";
import { LogoUploader } from "@/components/shared/logo-uploader";
import { RadioBtn } from "@/components/ui/radio-btn";
import { DatePicker, DateRangePicker } from "@/components/ui/date-picker";
import { ApiClient } from "@/lib/api-client";
import { Header } from "@/components/ui/header";

import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });
const MapPicker = dynamic(() => import("@/features/tournaments/settings/map-picker"), {
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

interface TournamentCreateProps {
    iconOnlyMobile?: boolean;
    isDisabled?: boolean;
}

export function TournamentCreate({ iconOnlyMobile = false, isDisabled = false }: TournamentCreateProps) {
    const t = useTranslations("Dialog");
    const tCommon = useTranslations("Common");
    const { toast } = useToast();
    const locale = useLocale();
    const isThai = locale === 'th';
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [open, setOpen] = useState(false);
    const [name, setName] = useState<string>("");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [docDeadline, setDocDeadline] = useState<string>("");
    const [sportsList, setSportsList] = useState<Sport[]>([]);
    const [selectedSport, setSelectedSport] = useState<string>("");
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
    const [description, setDescription] = useState<string>("");
    const [locationName, setLocationName] = useState<string>("");
    const [googleMapUrl, setGoogleMapUrl] = useState<string>("");
    const coverInputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Reset scroll to top on dialog open
    useEffect(() => {
        if (open) {
            const timer = setTimeout(() => {
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = 0;
                }
            }, 10);
            return () => clearTimeout(timer);
        }
    }, [open]);

    // Load sports dynamically from database
    useEffect(() => {
        if (open) {
            ApiClient.getToken();
            async function loadSports() {
                const res = await getSports();
                if (res.success && res.data) {
                    setSportsList(res.data);
                }
            }
            loadSports();
        }
    }, [open]);

    const handleButtonClick = (e: React.MouseEvent) => {
        if (isDisabled) {
            e.preventDefault();
            e.stopPropagation();
            toast({
                title: isThai ? "เกิดข้อผิดพลาด" : "Error",
                description: isThai
                    ? "คุณถึงขีดจำกัดการสร้างทัวร์นาเมนต์สำหรับแพ็คเกจของคุณแล้ว กรุณาอัพเกรดแพ็คเกจ"
                    : "You have reached the tournament creation limit for your plan. Please upgrade your plan.",
                variant: "destructive"
            });
            return;
        }
        setOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim() || !selectedSport || !startDate || !endDate) {
            toast({
                title: isThai ? "ข้อมูลไม่ครบถ้วน" : "Required Fields Missing",
                description: isThai ? "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" : "Please fill in all required fields.",
                variant: "destructive",
            });
            return;
        }

        if (endDate < startDate) {
            toast({
                title: isThai ? "วันที่ไม่ถูกต้อง" : "Invalid Dates",
                description: isThai ? "วันสิ้นสุดการแข่งขันต้องไม่อยู่ก่อนวันเริ่มต้น" : "End date cannot be earlier than start date.",
                variant: "destructive",
            });
            return;
        }

        startTransition(async () => {
            const formData = new FormData();
            formData.append("name", name.trim());
            formData.append("sport_id", selectedSport);
            formData.append("start_date", startDate);
            formData.append("end_date", endDate);
            formData.append("document_deadline", docDeadline || "");
            formData.append("location_name", locationName || "");
            formData.append("google_map_url", googleMapUrl || "");
            formData.append("description", description || "");

            if (logoFile) {
                formData.append("logo_img", logoFile);
            }
            if (coverFile) {
                formData.append("cover_img", coverFile);
            }

            const res = await createTournament(initialState, formData);
            if (res.success) {
                toast({
                    title: isThai ? "สร้างทัวร์นาเมนต์สำเร็จ" : "Tournament Created",
                    description: isThai ? "สร้างข้อมูลการแข่งขันเรียบร้อยแล้ว" : "Tournament has been created successfully.",
                });
                setLogoFile(null);
                setLogoPreviewUrl(null);
                setCoverFile(null);
                setCoverPreviewUrl(null);
                setName("");
                setStartDate("");
                setEndDate("");
                setDocDeadline("");
                setDescription("");
                setLocationName("");
                setGoogleMapUrl("");
                setSelectedSport("");
                setOpen(false);
                router.refresh();
            } else {
                toast({
                    title: isThai ? "เกิดข้อผิดพลาด" : "Error",
                    description: res.error || (isThai ? "ไม่สามารถสร้างทัวร์นาเมนต์ได้" : "Failed to create tournament"),
                    variant: "destructive",
                });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    size="sm"
                    className={iconOnlyMobile ? "h-8 w-8 p-0 lg:h-8 lg:w-auto lg:px-3 gap-1.5" : "gap-1.5"}
                    onClick={handleButtonClick}
                >
                    <Plus className="h-4 w-4" />
                    <span className={iconOnlyMobile ? "hidden lg:inline" : ""}>{t("create_button")}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[760px] sm:max-h-[88vh] p-0 flex flex-col overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                    <DialogHeader className="p-4 sm:px-6 sm:py-4 border-b shrink-0">
                        <DialogTitle asChild>
                            <Header level={4}>{t("create_title")}</Header>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                            {t("create_desc")}
                        </DialogDescription>
                    </DialogHeader>

                    <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4">
                        {/* 1. Cover & Logo Section */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Camera className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {isThai ? "ภาพหน้าปกและโลโก้" : "Cover & Logo"}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "อัปโหลดภาพแบนเนอร์และตราสัญลักษณ์ทัวร์นาเมนต์" : "Upload banner and tournament crest"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <div className="relative pb-10">
                                    <div
                                        onClick={() => coverInputRef.current?.click()}
                                        className="relative aspect-[2/1] w-full border-2 border-dashed hover:border-primary/50 transition-all rounded-sm overflow-hidden flex flex-col items-center justify-center cursor-pointer group"
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
                                                            setCoverFile(null);
                                                            setCoverPreviewUrl(null);
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
                                                    <ImageIcon className="h-4 w-4" />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-bold text-muted-foreground">
                                                        {isThai ? "คลิกเพื่ออัปโหลดภาพหน้าปก" : "Click to upload cover banner"}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground/60">
                                                        (1440x720)
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10 bg-card rounded-full shadow-md">
                                        <LogoUploader
                                            id="logo_img"
                                            name="logo_img"
                                            initialUrl={logoPreviewUrl}
                                            onFileChange={(file: File | null) => {
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
                                            disabled={isPending}
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
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Tournament Name */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Trophy className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("name")} <span className="text-destructive">*</span>
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "ชื่อที่จะแสดงผลในตารางแข่งขันและหน้าทัวร์นาเมนต์" : "Official tournament title in schedules and brackets"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <Input
                                    id="name"
                                    name="name"
                                    size="sm"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={isThai ? "ฟุตบอลเยาวชน ชิงถ้วยนายก ครั้งที่ 1" : "Youth Champions League 2026"}
                                    disabled={isPending}
                                    required
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 3. Sport Type */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Activity className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {tCommon("sport")} <span className="text-destructive">*</span>
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "ประเภทกีฬาหลักของรายการแข่งขันนี้" : "Primary sport category for this tournament"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <RadioBtn
                                    name="sport_id"
                                    value={selectedSport}
                                    onChange={setSelectedSport}
                                    sports={sportsList}
                                    disabled={isPending}
                                    placeholder={isThai ? "เลือกประเภทกีฬา..." : "Select sport..."}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 4. Tournament Period */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Calendar className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {isThai ? "ระยะเวลาการแข่งขัน" : "Tournament Period"} <span className="text-destructive">*</span>
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "วันเริ่มต้น - วันสิ้นสุดการแข่งขัน" : "Tournament start and end dates"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <DateRangePicker
                                    startDate={startDate}
                                    endDate={endDate}
                                    onChange={({ startDate: s, endDate: e }) => {
                                        setStartDate(s);
                                        setEndDate(e);
                                    }}
                                    size="sm"
                                    minYear={new Date().getFullYear() - 1}
                                    maxYear={new Date().getFullYear() + 5}
                                    defaultViewYear={new Date().getFullYear()}
                                    placeholder={isThai ? "เลือกวันเริ่มต้น - สิ้นสุดการแข่งขัน" : "Select start - end date"}
                                    disabled={isPending}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 5. Document Deadline */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Clock className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("document_deadline") || (isThai ? "วันปิดรับเอกสาร" : "Document Deadline")}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "กำหนดวันสุดท้ายในการส่งเอกสารและรายชื่อ (ถ้ามี)" : "Deadline for submitting rosters and forms"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <DatePicker
                                    value={docDeadline}
                                    onChange={setDocDeadline}
                                    size="sm"
                                    clearable
                                    minYear={new Date().getFullYear() - 1}
                                    maxYear={new Date().getFullYear() + 5}
                                    defaultViewYear={new Date().getFullYear()}
                                    placeholder={isThai ? "เลือกวันปิดรับเอกสาร (ถ้ามี)" : "Select document deadline (optional)"}
                                    disabled={isPending}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 6. Venue / Location */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <MapPin className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {isThai ? "สถานที่จัดการแข่งขัน" : "Location / Venue Name"}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "ชื่อสนาม หรือศูนย์กีฬาสำหรับจัดแข่ง" : "Name of the stadium, arena, or sports complex"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <Input
                                    id="location_name"
                                    name="location_name"
                                    size="sm"
                                    value={locationName}
                                    onChange={(e) => setLocationName(e.target.value)}
                                    placeholder={isThai ? "สนามกีฬาเฉลิมพระเกียรติ 80 พรรษา" : "National Stadium Bangkok"}
                                    disabled={isPending}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 7. Interactive Map */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Map className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {isThai ? "แผนที่สถานที่แข่งขัน" : "Interactive Map"}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "ค้นหาและปักหมุดตำแหน่งสนามแข่งขันบนแผนที่" : "Search and pin tournament coordinates"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <MapPicker
                                    value={googleMapUrl}
                                    onChange={(url) => setGoogleMapUrl(url)}
                                    onLocationNameSelect={(locName) => setLocationName(locName)}
                                />
                            </div>
                        </div>

                        {/* 8. Description / Details */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <FileText className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {isThai ? "รายละเอียดเพิ่มเติม" : "Description / Details"}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "กติกาการแข่งขัน เงินรางวัล และข้อมูลติดต่อผู้จัด" : "Tournament rules, prize pool, and contact info"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <div className="pro-editor-wrapper relative w-full">
                                    <ReactQuill
                                        theme="snow"
                                        value={description}
                                        onChange={setDescription}
                                        className="pro-editor h-auto text-foreground"
                                        placeholder={isThai ? "กติกาการแข่งขัน เงินรางวัล และช่องทางการติดต่อผู้จัด..." : "Tournament rules, prize pool, and contact details..."}
                                        readOnly={isPending}
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
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-3 sm:px-6 sm:py-3.5 border-t bg-card shrink-0 flex flex-row items-center justify-end gap-2">
                        <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => setOpen(false)}
                            className="text-xs"
                        >
                            {isThai ? "ยกเลิก" : "Cancel"}
                        </Button>
                        <Button
                            size="sm"
                            type="submit"
                            disabled={isPending}
                            className="text-xs font-semibold gap-1.5"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>{isThai ? "กำลังสร้าง..." : "Creating..."}</span>
                                </>
                            ) : (
                                <>
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>{isThai ? "สร้างการแข่งขัน" : "Create Tournament"}</span>
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}


