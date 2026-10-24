"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Camera, Shield, Trophy, FileText, User, Phone, Mail } from "lucide-react";
import { createTeam, getSports } from "@/actions/manager/team";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionResponse, Sport } from "@/types/index";
import { LogoUploader } from "@/components/shared/logo-uploader";
import { RadioBtn } from "@/components/ui/radio-btn";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/ui/header";

interface CreateTeamFormProps {
    iconOnlyMobile?: boolean;
}

export function CreateTeamForm({ iconOnlyMobile = false }: CreateTeamFormProps) {
    const t = useTranslations("Team");
    const tCommon = useTranslations("Common");
    const locale = useLocale();
    const isThai = locale === "th";
    const { toast } = useToast();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [selectedSport, setSelectedSport] = useState<string>("");
    const [description, setDescription] = useState("");
    const [contactName, setContactName] = useState("");
    const [contactPhone, setContactPhone] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const [sportsList, setSportsList] = useState<Sport[]>([]);
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
        async function loadSports() {
            const res = await getSports();
            if (res.success && res.data && res.data.length > 0) {
                setSportsList(res.data);
                setSelectedSport((curr) => curr || String(res.data![0].id));
            }
        }
        if (open) {
            loadSports();
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim() || !selectedSport || !contactName.trim() || !contactPhone.trim()) {
            toast({
                title: isThai ? "ข้อมูลไม่ครบถ้วน" : "Required Fields Missing",
                description: isThai ? "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" : "Please fill in all required fields.",
                variant: "destructive",
            });
            return;
        }

        startTransition(async () => {
            const formData = new FormData();
            formData.append("name", name.trim());
            formData.append("sport_id", selectedSport);
            formData.append("description", description.trim());
            formData.append("contact_name", contactName.trim());
            formData.append("contact_phone", contactPhone.trim());
            if (contactEmail.trim()) {
                formData.append("contact_email", contactEmail.trim());
            }
            if (logoFile) {
                formData.append("logo", logoFile);
            }

            const initialState: ActionResponse = {
                success: false,
                error: undefined,
            };
            const res = await createTeam(initialState, formData);
            if (res.success) {
                toast({
                    title: isThai ? "สร้างทีมสำเร็จ" : "Team Created",
                    description: isThai ? "สร้างทีมของคุณเรียบร้อยแล้ว" : "Your team has been created successfully.",
                });
                setOpen(false);
                setName("");
                setSelectedSport("");
                setDescription("");
                setContactName("");
                setContactPhone("");
                setContactEmail("");
                setLogoFile(null);
                setPreviewUrl(null);
                router.refresh();
            } else {
                toast({
                    title: isThai ? "เกิดข้อผิดพลาด" : "Error",
                    description: res.error || (isThai ? "ไม่สามารถสร้างทีมได้" : "Failed to create team"),
                    variant: "destructive",
                });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className={iconOnlyMobile ? "h-8 w-8 p-0 sm:w-auto gap-1.5" : "gap-1.5"}>
                    <Plus className="h-4 w-4" />
                    <span className={iconOnlyMobile ? "hidden sm:inline" : ""}>{t("add_team")}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] sm:max-h-[88vh] p-0 flex flex-col overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                    <DialogHeader className="p-4 sm:px-6 sm:py-4 border-b shrink-0">
                        <DialogTitle asChild>
                            <Header level={4}>
                                {t("add_team") || (isThai ? "สร้างทีมใหม่" : "Create New Team")}
                            </Header>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                            {isThai
                                ? "กรอกรายละเอียดและข้อมูลการติดต่อเพื่อสร้างทีมสำหรับการลงแข่งขัน"
                                : "Fill in team details and contact info to create your team."}
                        </DialogDescription>
                    </DialogHeader>

                    <div
                        ref={scrollContainerRef}
                        className="flex-1 min-h-0 overflow-y-auto p-4"
                    >
                        {/* 1. Logo */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between px-4 py-2">
                            <div className="flex items-center gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Camera className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("team_logo") || (isThai ? "โลโก้ทีม" : "Team Logo")}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "รูปภาพตราสัญลักษณ์ประจำทีมของคุณ" : "Official crest or logo image for your team"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 flex flex-col items-start gap-1">
                                <LogoUploader
                                    id="logo"
                                    name="logo"
                                    initialUrl={previewUrl}
                                    onFileChange={(file) => {
                                        setLogoFile(file);
                                        if (file) {
                                            setPreviewUrl(URL.createObjectURL(file));
                                        } else {
                                            setPreviewUrl(null);
                                        }
                                    }}
                                    onRemove={() => {
                                        setLogoFile(null);
                                        setPreviewUrl(null);
                                    }}
                                    uploadLabel={t("upload_logo")}
                                    clickToUploadLabel={t("click_to_upload")}
                                    previewLabel={tCommon("preview")}
                                    imageFit="cover"
                                />
                            </div>
                        </div>

                        {/* 2. Team Name */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Shield className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("team_name")} <span className="text-destructive">*</span>
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "ชื่อที่จะแสดงผลในตารางแข่งขันและสถิติต่างๆ" : "Display name in fixtures, brackets, and standings"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 space-y-1">
                                <Input
                                    id="name"
                                    name="name"
                                    size="sm"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={t("team_name_placeholder")}
                                    disabled={isPending}
                                    required
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 3. Sport Type */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Trophy className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {tCommon("sport")} <span className="text-destructive">*</span>
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "ประเภทกีฬาหลักที่ทีมนี้ลงทำการแข่งขัน" : "Primary sport category for team participation"}
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
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 4. Team Description */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between px-4 py-2">
                            <div className="flex items-start gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <FileText className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("team_description")}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "ประวัติสโมสร สโลแกน หรือคำอธิบายเพิ่มเติม" : "Club history, motto, or short biography"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 space-y-1">
                                <Textarea
                                    id="description"
                                    name="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={t("team_description_placeholder")}
                                    disabled={isPending}
                                    className="w-full text-xs focus-visible:ring-0 resize-none min-h-[70px]"
                                />
                            </div>
                        </div>

                        {/* 5. Contact Name */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <User className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("contact_name") || (isThai ? "ชื่อผู้ประสานงาน" : "Contact Person")} <span className="text-destructive">*</span>
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "ชื่อ-นามสกุลของผู้จัดการหรือตัวแทนทีม" : "Full name of team manager or coordinator"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 space-y-1">
                                <Input
                                    id="contact_name"
                                    name="contact_name"
                                    size="sm"
                                    value={contactName}
                                    onChange={(e) => setContactName(e.target.value)}
                                    placeholder={t("contact_name_placeholder")}
                                    disabled={isPending}
                                    required
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 6. Contact Phone */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Phone className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("contact_phone") || (isThai ? "เบอร์โทรศัพท์ติดต่อ" : "Contact Phone")} <span className="text-destructive">*</span>
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "เบอร์โทรศัพท์สำหรับติดต่อประสานงานด่วน" : "Primary phone for urgent communication"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 space-y-1">
                                <Input
                                    id="contact_phone"
                                    name="contact_phone"
                                    size="sm"
                                    value={contactPhone}
                                    onChange={(e) => setContactPhone(e.target.value)}
                                    placeholder={t("contact_phone_placeholder")}
                                    disabled={isPending}
                                    required
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 7. Contact Email */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Mail className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {t("contact_email") || (isThai ? "อีเมลติดต่อ" : "Contact Email")}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "อีเมลสำหรับรับเอกสารและการแจ้งเตือน (ถ้ามี)" : "Optional email for documents and notices"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 space-y-1">
                                <Input
                                    id="contact_email"
                                    name="contact_email"
                                    type="email"
                                    size="sm"
                                    value={contactEmail}
                                    onChange={(e) => setContactEmail(e.target.value)}
                                    placeholder={t("contact_email_placeholder") || "contact@example.com"}
                                    disabled={isPending}
                                    className="w-full"
                                />
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
                                    <span>{tCommon("create_btn")}</span>
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

