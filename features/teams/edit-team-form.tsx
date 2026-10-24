'use client';

import React, { useState, useEffect } from "react";
import { Team, TournamentTeam, Sport } from "@/types/index";
import { updateTeamGlobal, resetRoster, restoreRoster, hasSoftDeletedPlayers, getSports } from "@/actions/manager/team";
import { updateTeam } from "@/actions/tournaments/general";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/ui/header";
import { Badge } from "@/components/ui/badge";
import { DeleteTeamDialog } from "@/features/dialogs";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Lock, RotateCcw, AlertTriangle } from "lucide-react";
import { LogoUploader } from "@/components/shared/logo-uploader";
import { RadioBtn } from "@/components/ui/radio-btn";
import { resolveStorageUrl } from "@/lib/storage-utils";
import { cn } from "@/lib/utils";

type FormField = 'logo' | 'name' | 'sport' | 'description' | 'contactName' | 'contactPhone' | 'contactEmail';

interface EditTeamFormProps {
    team: (Team | TournamentTeam) & {
        isParticipation?: boolean;
    };
    onNameChange: (name: string) => void;
    onSportChange?: (sport: string) => void;
    isLocked: boolean;
    context?: 'manager' | 'organizer';
    tournamentId?: string;
    className?: string;
}

export function EditTeamForm({
    team,
    onNameChange,
    onSportChange,
    isLocked,
    context = 'manager',
    tournamentId = "",
    className,
}: EditTeamFormProps) {
    const t = useTranslations("Roster");
    const tCommon = useTranslations("Common");
    const tTeam = useTranslations("Team");
    const locale = useLocale();
    const isThai = locale === "th";
    const { toast } = useToast();
    const router = useRouter();

    // Initial values
    const initialName = team.name || "";
    const initialDescription = team.description || "";
    const initialContactName = team.contact_name || "";
    const initialContactPhone = team.contact_phone || "";
    const initialContactEmail = team.contact_email || "";
    const initialSport = String((team as { sport_id?: string }).sport_id || team.sport || "");
    const initialLogoUrl = resolveStorageUrl((team as { logo_img?: string }).logo_img || team.logo_url) || null;

    // Form states
    const [teamName, setTeamName] = useState(initialName);
    const [teamDescription, setTeamDescription] = useState(initialDescription);
    const [contactName, setContactName] = useState(initialContactName);
    const [contactPhone, setContactPhone] = useState(initialContactPhone);
    const [contactEmail, setContactEmail] = useState(initialContactEmail);
    const [teamSport, setTeamSport] = useState<string>(initialSport);
    const [previewUrl, setPreviewUrl] = useState<string | null>(initialLogoUrl);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Track last modified field for dynamic action buttons
    const [lastModifiedField, setLastModifiedField] = useState<FormField | null>(null);

    // Submission & operation states
    const [isUpdatingTeam, setIsUpdatingTeam] = useState(false);
    const [isResettingRoster, setIsResettingRoster] = useState(false);
    const [resetRosterDialogOpen, setResetRosterDialogOpen] = useState(false);
    const [hasResetRoster, setHasResetRoster] = useState(false);
    const [isRestoringRoster, setIsRestoringRoster] = useState(false);
    const [sportsList, setSportsList] = useState<Sport[]>([]);

    // Sync state when props change
    useEffect(() => {
        if (initialName) setTeamName(initialName);
        if (initialDescription !== undefined) setTeamDescription(initialDescription);
        if (initialContactName !== undefined) setContactName(initialContactName);
        if (initialContactPhone !== undefined) setContactPhone(initialContactPhone);
        if (initialContactEmail !== undefined) setContactEmail(initialContactEmail);
        if (initialSport) setTeamSport(initialSport);
        if (initialLogoUrl !== undefined) setPreviewUrl(initialLogoUrl);
        setSelectedFile(null);
        setLastModifiedField(null);
    }, [team.id, initialName, initialDescription, initialContactName, initialContactPhone, initialContactEmail, initialSport, initialLogoUrl]);

    // Load available sports
    useEffect(() => {
        async function loadSports() {
            const res = await getSports();
            if (res.success && res.data) {
                setSportsList(res.data);
                const currentSport = (team as { sport_id?: string }).sport_id || team.sport;
                if (currentSport) {
                    const match = res.data.find(s =>
                        String(s.id) === String(currentSport) ||
                        s.sport_name.toLowerCase() === String(currentSport).toLowerCase()
                    );
                    if (match) {
                        setTeamSport(String(match.id));
                    }
                }
            }
        }
        loadSports();
    }, [team.id, team.sport, (team as { sport_id?: string })?.sport_id]);

    // Check soft-deleted players for roster restore
    useEffect(() => {
        const checkRestore = async () => {
            const res = await hasSoftDeletedPlayers(team.id);
            if (res.success && res.data) {
                setHasResetRoster(true);
            } else {
                setHasResetRoster(false);
            }
        };
        checkRestore();
    }, [team.id]);

    // Check dirty state
    const isLogoDirty = selectedFile !== null || previewUrl !== initialLogoUrl;
    const isNameDirty = teamName !== initialName;
    const isSportDirty = Boolean(teamSport && teamSport !== initialSport);
    const isDescriptionDirty = teamDescription !== initialDescription;
    const isContactNameDirty = contactName !== initialContactName;
    const isContactPhoneDirty = contactPhone !== initialContactPhone;
    const isContactEmailDirty = contactEmail !== initialContactEmail;
    const isDirty = isLogoDirty || isNameDirty || isSportDirty || isDescriptionDirty || isContactNameDirty || isContactPhoneDirty || isContactEmailDirty;

    const isFieldDirty = (field: FormField) => {
        switch (field) {
            case 'logo': return isLogoDirty;
            case 'name': return isNameDirty;
            case 'sport': return isSportDirty;
            case 'description': return isDescriptionDirty;
            case 'contactName': return isContactNameDirty;
            case 'contactPhone': return isContactPhoneDirty;
            case 'contactEmail': return isContactEmailDirty;
            default: return false;
        }
    };

    const fallbackDirtyField: FormField | null =
        isContactEmailDirty ? 'contactEmail' :
            isContactPhoneDirty ? 'contactPhone' :
                isContactNameDirty ? 'contactName' :
                    isDescriptionDirty ? 'description' :
                        isSportDirty ? 'sport' :
                            isNameDirty ? 'name' :
                                isLogoDirty ? 'logo' : null;

    // Determine which field should display the action buttons
    const activeActionField: FormField | null = !isDirty
        ? null
        : lastModifiedField && isFieldDirty(lastModifiedField)
            ? lastModifiedField
            : fallbackDirtyField;

    const handleReset = () => {
        setSelectedFile(null);
        setPreviewUrl(initialLogoUrl);
        setTeamName(initialName);
        setTeamSport(initialSport);
        setTeamDescription(initialDescription);
        setContactName(initialContactName);
        setContactPhone(initialContactPhone);
        setContactEmail(initialContactEmail);
        setLastModifiedField(null);
    };

    const handleRestoreRoster = async () => {
        setIsRestoringRoster(true);
        const res = await restoreRoster(team.id);
        setIsRestoringRoster(false);
        if (res.success) {
            toast({
                title: tCommon("success"),
                description: t("roster_restored") || (isThai ? "กู้คืนรายชื่อนักกีฬาเรียบร้อยแล้ว" : "Roster restored successfully")
            });
            setHasResetRoster(false);
            router.refresh();
        } else {
            toast({
                title: tCommon("error"),
                description: res.error,
                variant: "destructive"
            });
        }
    };

    const handleUpdateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUpdatingTeam(true);

        const formData = new FormData();
        formData.append("name", teamName);
        formData.append("description", teamDescription);
        formData.append("contact_name", contactName);
        formData.append("contact_phone", contactPhone);
        formData.append("contact_email", contactEmail);
        formData.append("sport", teamSport);
        formData.append("tournament_id", "");
        formData.append("existing_logo_url", previewUrl || "");
        if (selectedFile) {
            formData.append("logo", selectedFile);
        }

        const result = context === 'organizer'
            ? await updateTeam(team.id, formData, tournamentId)
            : await updateTeamGlobal(team.id, formData, tournamentId);

        setIsUpdatingTeam(false);

        if (result.success) {
            toast({
                title: tCommon("success"),
                description: tTeam("updated_successfully") || (isThai ? "อัปเดตข้อมูลทีมสำเร็จเรียบร้อยแล้ว" : "Team updated successfully")
            });
            onNameChange(teamName);
            onSportChange?.(teamSport);
            setSelectedFile(null);
            setLastModifiedField(null);
            router.refresh();
        } else {
            toast({ title: tCommon("error"), description: result.error, variant: "destructive" });
        }
    };

    const handleResetRoster = async () => {
        setIsResettingRoster(true);
        const result = await resetRoster(team.id);

        setIsResettingRoster(false);
        if (result.success) {
            toast({
                title: tCommon("success"),
                description: t("roster_reset_success") || (isThai ? "รีเซ็ตรายชื่อเรียบร้อยแล้ว" : "Roster reset successfully")
            });
            setResetRosterDialogOpen(false);
            setHasResetRoster(true);
            router.refresh();
        } else {
            toast({ title: tCommon("error"), description: result.error, variant: "destructive" });
        }
    };

    const renderActionButtons = () => (
        <div className="flex items-center gap-2 pt-2 animate-in fade-in-50 duration-200">
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUpdatingTeam || isLocked}
                onClick={handleReset}
                className="text-xs"
            >
                {isThai ? "ยกเลิก" : "Cancel"}
            </Button>
            <Button
                type="submit"
                size="sm"
                disabled={isUpdatingTeam || isLocked}
                variant="default"
                className="text-xs font-semibold"
            >
                {isUpdatingTeam ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : null}
                <span>{isThai ? "บันทึก" : tCommon("save")}</span>
            </Button>
        </div>
    );

    return (
        <div className={cn("bg-card border rounded-sm overflow-hidden divide-y divide-border shadow-xs", className)}>
            {/* Form wrapping Section 1 and Section 2 */}
            <form onSubmit={handleUpdateTeam} className="divide-y divide-border">
                {/* 1. Section: ข้อมูลทีม (Team Details) */}
                <div className="p-4">
                    <div className="flex items-center justify-end">
                        {isLocked && (
                            <Badge variant="destructive">
                                <Lock className="size-4" />
                                <span>{t("team_details_locked") || (isThai ? "ล็อก" : "Locked")}</span>
                            </Badge>
                        )}
                    </div>

                    <div className="space-y-4">
                        {/* Hero Logo Uploader */}
                        <div className="space-y-2">
                            <div className="flex flex-col items-center justify-center pt-1 pb-1">
                                <LogoUploader
                                    id="edit-team-logo"
                                    initialUrl={previewUrl}
                                    onFileChange={(file) => {
                                        setSelectedFile(file);
                                        setLastModifiedField('logo');
                                        if (file) setPreviewUrl(URL.createObjectURL(file));
                                        else setPreviewUrl(null);
                                    }}
                                    onRemove={() => {
                                        setSelectedFile(null);
                                        setPreviewUrl(null);
                                        setLastModifiedField('logo');
                                    }}
                                    disabled={isLocked}
                                    uploadLabel={tTeam("upload_logo")}
                                    clickToUploadLabel={tTeam("click_to_upload")}
                                    previewLabel={tCommon("preview")}
                                    imageFit="cover"
                                />
                                <span className="text-[11px] text-muted-foreground mt-2 font-medium">
                                    {isThai ? "คลิกเพื่อเปลี่ยนโลโก้ทีม" : "Click to change team logo"}
                                </span>
                            </div>
                            {activeActionField === 'logo' && (
                                <div className="flex justify-center">
                                    {renderActionButtons()}
                                </div>
                            )}
                        </div>

                        {/* Team Name */}
                        <div className="space-y-1">
                            <Label>
                                {tTeam("team_name")} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="team-name"
                                value={teamName}
                                onChange={(e) => {
                                    setTeamName(e.target.value);
                                    setLastModifiedField('name');
                                }}
                                placeholder={tTeam("team_name_placeholder")}
                                size="sm"
                                required
                                disabled={isLocked}
                                className="w-full"
                            />
                            {activeActionField === 'name' && renderActionButtons()}
                        </div>

                        {/* Sport Type */}
                        <div className="space-y-1">
                            <Label>
                                {tCommon("sport")} <span className="text-destructive">*</span>
                            </Label>
                            <RadioBtn
                                value={teamSport}
                                onChange={(val) => {
                                    setTeamSport(val);
                                    setLastModifiedField('sport');
                                }}
                                sports={sportsList}
                                disabled={isLocked}
                            />
                            {activeActionField === 'sport' && renderActionButtons()}
                        </div>

                        {/* Team Description */}
                        <div className="space-y-1">
                            <Label>
                                {tTeam("team_description") || (isThai ? "คำอธิบายทีม" : "Team Description")}
                            </Label>
                            <Textarea
                                id="team-description"
                                value={teamDescription}
                                onChange={(e) => {
                                    setTeamDescription(e.target.value);
                                    setLastModifiedField('description');
                                }}
                                placeholder={tTeam("team_description_placeholder") || (isThai ? "สโลแกนหรือประวัติทีมแบบสั้น..." : "Short bio or motto...")}
                                size="sm"
                                disabled={isLocked}
                                className="w-full resize-none min-h-[72px]"
                            />
                            {activeActionField === 'description' && renderActionButtons()}
                        </div>
                    </div>
                </div>

                {/* 2. Section: ข้อมูลติดต่อ (Contact Information) */}
                <div className="p-4">
                    <div className="space-y-4">
                        {/* Contact Name */}
                        <div className="space-y-1">
                            <Label>
                                {tTeam("contact_name") || (isThai ? "ชื่อผู้ติดต่อ" : "Contact Name")} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="contact-name"
                                value={contactName}
                                onChange={(e) => {
                                    setContactName(e.target.value);
                                    setLastModifiedField('contactName');
                                }}
                                placeholder={tTeam("contact_name_placeholder")}
                                size="sm"
                                required
                                disabled={isLocked}
                                className="w-full"
                            />
                            {activeActionField === 'contactName' && renderActionButtons()}
                        </div>

                        {/* Contact Phone */}
                        <div className="space-y-1">
                            <Label>
                                {tTeam("contact_phone") || (isThai ? "เบอร์โทรศัพท์" : "Phone")} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="contact-phone"
                                value={contactPhone}
                                onChange={(e) => {
                                    setContactPhone(e.target.value);
                                    setLastModifiedField('contactPhone');
                                }}
                                placeholder={tTeam("contact_phone_placeholder")}
                                size="sm"
                                required
                                disabled={isLocked}
                                className="w-full"
                            />
                            {activeActionField === 'contactPhone' && renderActionButtons()}
                        </div>

                        {/* Contact Email */}
                        <div className="space-y-1">
                            <Label>
                                {tTeam("contact_email") || (isThai ? "อีเมลติดต่อ" : "Email Address")}
                            </Label>
                            <Input
                                id="contact-email"
                                type="email"
                                value={contactEmail}
                                onChange={(e) => {
                                    setContactEmail(e.target.value);
                                    setLastModifiedField('contactEmail');
                                }}
                                placeholder={tTeam("contact_email_placeholder") || "contact@example.com"}
                                size="sm"
                                disabled={isLocked}
                                className="w-full"
                            />
                            {activeActionField === 'contactEmail' && renderActionButtons()}
                        </div>
                    </div>
                </div>
            </form>

            {/* 3. Section: พื้นที่อันตราย (Danger Zone) - styled matching Settings Danger Zone */}
            {!isLocked && (
                <div className="p-4">
                    {/* Restore Roster (if applicable) */}
                    {hasResetRoster && (
                        <div className="flex items-center justify-between py-3 gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className="size-9 rounded-sm bg-primary/10 flex items-center justify-center shrink-0">
                                    <RotateCcw className="size-4 text-primary" />
                                </div>
                                <div className="space-y-0.5 min-w-0 flex-1">
                                    <Header level={6} className="text-primary font-semibold">
                                        {t("restore_roster") || (isThai ? "กู้คืนรายชื่อ" : "Restore Roster")}
                                    </Header>
                                    <p className="text-xs text-muted-foreground leading-normal">
                                        {isThai ? "กู้คืนรายชื่อนักกีฬาที่เคยถูกรีเซ็ตหรือลบออกจากทีม" : "Restore reset players back to the team roster."}
                                    </p>
                                </div>
                            </div>
                            <div className="shrink-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-primary/40 text-primary hover:bg-primary/10 transition-all text-xs"
                                    onClick={handleRestoreRoster}
                                    disabled={isRestoringRoster || isLocked}
                                >
                                    {isRestoringRoster ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <RotateCcw className="size-4 mr-1.5" />}
                                    {isThai ? "กู้คืนรายชื่อ" : "Restore Roster"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Reset Roster */}
                    <div className="flex items-center justify-between py-3 gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="size-9 rounded-sm bg-destructive/10 flex items-center justify-center shrink-0">
                                <RotateCcw className="size-4 text-destructive" />
                            </div>
                            <div className="space-y-0.5 min-w-0 flex-1">
                                <Header level={6} className="text-destructive font-semibold">
                                    {t("reset_roster") || (isThai ? "รีเซ็ตรายชื่อ" : "Reset Roster")}
                                </Header>
                                <p className="text-xs text-muted-foreground leading-normal">
                                    {isThai ? "ลบผู้เล่นทั้งหมดออกจากทีม รายชื่อสามารถกู้คืนได้ภายหลัง" : "Remove all players from roster. Can be restored later."}
                                </p>
                            </div>
                        </div>
                        <div className="shrink-0">
                            <AlertDialog open={resetRosterDialogOpen} onOpenChange={setResetRosterDialogOpen}>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all text-xs"
                                        disabled={isResettingRoster || isLocked}
                                    >
                                        {isResettingRoster && <Loader2 className="size-4 animate-spin mr-1.5" />}
                                        {isThai ? "รีเซ็ตรายชื่อ" : "Reset Roster"}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="sm:max-w-[760px] h-auto sm:h-auto max-h-[88vh] overflow-hidden flex flex-col bg-card border rounded-none sm:rounded-sm shadow-2xl p-0">
                                    <AlertDialogHeader className="p-4 sm:px-6 sm:py-4 border-b shrink-0 bg-card">
                                        <AlertDialogTitle asChild>
                                            <Header level={4} className="text-destructive">
                                                {t("reset_roster")}
                                            </Header>
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                                            {t("reset_roster_desc")}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="p-3 sm:px-6 sm:py-3.5 border-t bg-card shrink-0 flex flex-row items-center justify-end gap-2">
                                        <AlertDialogCancel className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-0")}>
                                            {tCommon("cancel")}
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleResetRoster}
                                            disabled={isResettingRoster}
                                            className={cn(buttonVariants({ size: "sm", variant: "destructive" }))}
                                        >
                                            {isResettingRoster && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                                            {t("confirm_reset") || "Confirm Reset"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>

                    {/* Delete Team */}
                    <div className="flex items-center justify-between py-3 gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="size-9 rounded-sm bg-destructive/10 flex items-center justify-center shrink-0">
                                <AlertTriangle className="size-4 text-destructive" />
                            </div>
                            <div className="space-y-0.5 min-w-0 flex-1">
                                <Header level={6} className="text-destructive font-semibold">
                                    {tTeam("delete_team") || (isThai ? "ลบทีม" : "Delete Team")}
                                </Header>
                                <p className="text-xs text-muted-foreground leading-normal">
                                    {isThai ? "ลบทีมนี้อย่างถาวร ข้อมูลและสถิติทั้งหมดของทีมจะหายไป" : "Permanently delete this team and remove all associated data."}
                                </p>
                            </div>
                        </div>
                        <div className="shrink-0">
                            <DeleteTeamDialog
                                teamId={team.id}
                                teamName={team.name}
                                tournamentId={tournamentId}
                                context={context}
                                disabled={isLocked}
                                trigger={
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={isLocked}
                                        className="border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all text-xs"
                                    >
                                        {isThai ? "ลบทีม" : "Delete Team"}
                                    </Button>
                                }
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
