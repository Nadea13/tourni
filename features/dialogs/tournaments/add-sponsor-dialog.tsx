"use client";

import { useState, useRef, useEffect } from "react";

import { useLocale, useTranslations } from "next-intl";
import { addSponsor, updateSponsor, Sponsor } from "@/actions/tournaments/sponsor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/ui/header";
import { LogoUploader } from "@/components/shared/logo-uploader";
import { CoverUploader } from "@/components/shared/cover-uploader";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Camera, Award, Globe } from "lucide-react";

interface AddSponsorDialogProps {
    tournamentId: string;
    sponsorToEdit?: Sponsor | null;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSuccess?: () => void;
    trigger?: React.ReactNode;
}

export function AddSponsorDialog({
    tournamentId,
    sponsorToEdit,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    onSuccess,
    trigger,
}: AddSponsorDialogProps) {
    const { toast } = useToast();
    const tSponsors = useTranslations("Sponsors");
    const locale = useLocale();
    const isThai = locale === "th";
    const isEditing = !!sponsorToEdit;

    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;
    const setOpen = (val: boolean) => {
        if (isControlled) {
            controlledOnOpenChange?.(val);
        } else {
            setUncontrolledOpen(val);
        }
    };

    const [sponsorName, setSponsorName] = useState("");
    const [sponsorLink, setSponsorLink] = useState("");
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverUrl, setCoverUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);


    // Initialize or reset form state
    useEffect(() => {
        if (open) {
            if (sponsorToEdit) {
                setSponsorName(sponsorToEdit.sponsor_name || "");
                setSponsorLink(sponsorToEdit.link_url || "");
                setLogoUrl(sponsorToEdit.logo_img || null);
                setLogoFile(null);
                setCoverUrl(sponsorToEdit.cover_url || null);
                setCoverFile(null);
            } else {
                setSponsorName("");
                setSponsorLink("");
                setLogoFile(null);
                setLogoUrl(null);
                setCoverFile(null);
                setCoverUrl(null);
            }

            const timer = setTimeout(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = 0;
                }
            }, 10);
            return () => clearTimeout(timer);
        }
    }, [open, sponsorToEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = sponsorName.trim();
        if (!trimmedName) return;

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("sponsorName", trimmedName);
            if (sponsorLink) formData.append("linkUrl", sponsorLink.trim());

            if (isEditing && sponsorToEdit) {
                if (logoFile) {
                    formData.append("logoFile", logoFile);
                } else if (logoUrl) {
                    formData.append("logoUrl", logoUrl);
                }
                if (coverFile) {
                    formData.append("coverFile", coverFile);
                } else if (coverUrl) {
                    formData.append("coverUrl", coverUrl);
                }

                const res = await updateSponsor(sponsorToEdit.id, tournamentId, trimmedName, formData, sponsorLink.trim());
                if (res.success) {
                    toast({
                        title: isThai ? "แก้ไขผู้สนับสนุนสำเร็จ" : "Sponsor updated",
                        description: isThai ? "บันทึกการแก้ไขข้อมูลผู้สนับสนุนเรียบร้อยแล้ว" : "The sponsor has been updated successfully."
                    });
                    setOpen(false);
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new Event("reload-sponsors"));
                    }
                    if (onSuccess) onSuccess();
                } else {
                    toast({
                        title: isThai ? "เกิดข้อผิดพลาด" : "Error",
                        description: res.error || (isThai ? "ไม่สามารถแก้ไขข้อมูลผู้สนับสนุนได้" : "Failed to update sponsor"),
                        variant: "destructive"
                    });
                }
            } else {
                if (logoFile) formData.append("logoFile", logoFile);
                if (coverFile) formData.append("coverFile", coverFile);
                else if (coverUrl) formData.append("coverUrl", coverUrl);

                const res = await addSponsor(tournamentId, trimmedName, formData, sponsorLink.trim());
                if (res.success) {
                    toast({
                        title: isThai ? "เพิ่มผู้สนับสนุนสำเร็จ" : "Sponsor added",
                        description: isThai ? "เพิ่มผู้สนับสนุนเข้าสู่การแข่งขันเรียบร้อยแล้ว" : "The sponsor has been added successfully."
                    });
                    setOpen(false);
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new Event("reload-sponsors"));
                    }
                    if (onSuccess) onSuccess();
                } else {
                    toast({
                        title: isThai ? "เกิดข้อผิดพลาด" : "Error",
                        description: res.error || (isThai ? "ไม่สามารถเพิ่มผู้สนับสนุนได้" : "Failed to add sponsor"),
                        variant: "destructive"
                    });
                }
            }
        } catch (error: unknown) {
            toast({
                title: isThai ? "เกิดข้อผิดพลาด" : "Error",
                description: error instanceof Error ? error.message : "Failed to process sponsor",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger !== undefined ? (
                trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null
            ) : (
                <DialogTrigger asChild>
                    <Button
                        variant="default"
                        size="sm"
                        className="bg-red-500 text-white hover:bg-red-600 h-8 text-xs px-2.5 gap-1 shrink-0"
                    >
                        <Plus className="h-4 w-4" />
                        {isThai ? "เพิ่มผู้สนับสนุนใหม่" : "New Sponsor"}
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[760px] sm:max-h-[88vh] p-0 flex flex-col overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                    <DialogHeader className="p-4 border-b shrink-0 bg-card">
                        <DialogTitle asChild>
                            <Header level={4}>
                                {isEditing
                                    ? (tSponsors("edit_title") || (isThai ? "แก้ไขผู้สนับสนุน" : "Edit Sponsor"))
                                    : (isThai ? "เพิ่มผู้สนับสนุนใหม่" : "New Sponsor")}
                            </Header>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                            {isThai
                                ? "กำหนดรูปโลโก้ ภาพหน้าปก แบนเนอร์ และลิงก์สำหรับผู้สนับสนุนการแข่งขัน"
                                : "Configure sponsor logo, banner image, and external link."}
                        </DialogDescription>
                    </DialogHeader>

                    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4">
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
                                        {isThai ? "อัปโหลดภาพแบนเนอร์และตราสัญลักษณ์ผู้สนับสนุน" : "Upload banner and sponsor logo"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <CoverUploader
                                    id={isEditing ? "edit-sponsor-cover-upload" : "sponsor-cover-upload"}
                                    name="cover_img"
                                    initialUrl={coverUrl}
                                    onFileChange={(file: File | null) => {
                                        setCoverFile(file);
                                        if (file) {
                                            setCoverUrl(URL.createObjectURL(file));
                                        } else {
                                            setCoverUrl(null);
                                        }
                                    }}
                                    onRemove={() => {
                                        setCoverFile(null);
                                        setCoverUrl(null);
                                    }}
                                    disabled={isSubmitting}
                                    uploadLabel={isThai ? "คลิกเพื่ออัปโหลดภาพหน้าปก" : "Click to upload cover banner"}
                                    changeLabel={isThai ? "เปลี่ยนรูป" : "Change Image"}
                                    removeLabel={isThai ? "ลบรูป" : "Remove"}
                                    dimensionHint="(1440x720)"
                                    aspectRatio="aspect-[2/1]"
                                    cropAspectRatio={2}
                                    enableCrop={true}
                                >
                                    <LogoUploader
                                        id={isEditing ? "edit-sponsor-logo-upload" : "sponsor-logo-upload"}
                                        initialUrl={logoUrl}
                                        onFileChange={(file: File | null) => {
                                            setLogoFile(file);
                                            if (file) {
                                                setLogoUrl(URL.createObjectURL(file));
                                            } else {
                                                setLogoUrl(null);
                                            }
                                        }}
                                        onRemove={() => {
                                            setLogoFile(null);
                                            setLogoUrl(null);
                                        }}
                                        disabled={isSubmitting}
                                        uploadLabel={isThai ? "อัปโหลดโลโก้" : "Upload Logo"}
                                        clickToUploadLabel={isThai ? "คลิกเพื่อเปลี่ยน" : "Click to Change"}
                                        previewLabel={isThai ? "ตัวอย่าง" : "Preview"}
                                        imageFit="contain"
                                    />
                                </CoverUploader>
                            </div>
                        </div>

                        {/* 2. Sponsor Name */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Award className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {tSponsors("name_label") || (isThai ? "ชื่อผู้สนับสนุน" : "Sponsor Name")} <span className="text-destructive">*</span>
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "ชื่อแบรนด์หรือบริษัทผู้ให้การสนับสนุน" : "Company or brand name of sponsor"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <Input
                                    id="sponsor-name-input"
                                    size="sm"
                                    value={sponsorName}
                                    onChange={(e) => setSponsorName(e.target.value)}
                                    placeholder={tSponsors("name_placeholder") || (isThai ? "ระบุชื่อผู้สนับสนุน..." : "Enter sponsor name...")}
                                    required
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 3. Website Link */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                    <Globe className="size-4 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6}>
                                        {tSponsors("link_label") || (isThai ? "ลิงก์เว็บไซต์" : "Website URL")}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai ? "ลิงก์เว็บไซต์หรือเพจทางการของผู้สนับสนุน (ถ้ามี)" : "Official website or social page link (optional)"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-1/2 w-full">
                                <Input
                                    id="sponsor-link-input"
                                    size="sm"
                                    value={sponsorLink}
                                    onChange={(e) => setSponsorLink(e.target.value)}
                                    placeholder={tSponsors("link_placeholder") || "https://example.com"}
                                    type="url"
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
                            onClick={() => setOpen(false)}
                            disabled={isSubmitting}
                        >
                            {isThai ? "ยกเลิก" : "Cancel"}
                        </Button>
                        <Button
                            size="sm"
                            type="submit"
                            disabled={isSubmitting || !sponsorName.trim()}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                    {isThai ? "กำลังบันทึก..." : "Saving..."}
                                </>
                            ) : (
                                isEditing
                                    ? (tSponsors("edit_button") || (isThai ? "บันทึก" : "Save Changes"))
                                    : (tSponsors("add_button") || (isThai ? "เพิ่มผู้สนับสนุน" : "Add Sponsor"))
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
