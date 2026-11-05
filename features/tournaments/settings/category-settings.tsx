"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocale } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import {
    updateTournamentCategory,
    deleteTournamentCategory,
    getOrCreateAgeCategory
} from "@/actions/tournaments/general";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/ui/header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/dropdown";
import { RadioBtn } from "@/components/ui/radio-btn";
import {
    Loader2,
    Trophy,
    Users,
    UsersRound,
    Shield,
    CreditCard,
    Layers,
    AlertTriangle
} from "lucide-react";
import { TournamentCategory } from "@/types";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useBracketStore } from "@/lib/stores/bracket-store";
import { cn } from "@/lib/utils";

interface CategorySettingsProps {
    tournamentId: string;
    sport?: string;
    onCategoryUpdated?: () => void;
    className?: string;
}

const defaultAgeCategories = [
    { id: 1, category_name: "Open" },
    { id: 2, category_name: "U12" },
    { id: 3, category_name: "U14" },
    { id: 4, category_name: "U16" },
    { id: 5, category_name: "U18" },
    { id: 6, category_name: "35+" },
    { id: 7, category_name: "40+" },
];

export function CategorySettings({
    tournamentId,
    sport: initialSport,
    onCategoryUpdated,
    className
}: CategorySettingsProps) {
    const locale = useLocale();
    const isThai = locale === "th";
    const { toast } = useToast();
    const storeSport = useBracketStore((state) => state.sport);

    const [categories, setCategories] = useState<TournamentCategory[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [sport, setSport] = useState<string>(initialSport || storeSport || "football");
    const [isLoading, setIsLoading] = useState(true);

    // Form states
    const [selectedAge, setSelectedAge] = useState<string>("Open");
    const [customAge, setCustomAge] = useState<string>("");
    const [genderType, setGenderType] = useState<string>("male");
    const [maxTeams, setMaxTeams] = useState<string>("8");
    const [registrationFee, setRegistrationFee] = useState<string>("0");
    const [maxSets, setMaxSets] = useState<string>("3");
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Track last modified field for profile-form style action buttons
    const [lastModifiedField, setLastModifiedField] = useState<'age' | 'gender' | 'maxTeams' | 'fee' | 'maxSets' | null>(null);

    // Initial values tracking for reset and dirty detection
    const [initialValues, setInitialValues] = useState<{
        age: string;
        customAge: string;
        gender: string;
        maxTeams: string;
        fee: string;
        maxSets: string;
    }>({
        age: "Open",
        customAge: "",
        gender: "male",
        maxTeams: "8",
        fee: "0",
        maxSets: "3"
    });

    // Delete dialog states
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const deleteScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialSport) {
            setSport(initialSport.toLowerCase());
        } else if (storeSport) {
            setSport(storeSport.toLowerCase());
        }
    }, [initialSport, storeSport]);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
            const res = await fetch(`${apiUrl}/tournaments/${tournamentId}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                const tournamentData = data.tournament;
                const catData = data.categories || [];

                if (tournamentData) {
                    const rawSport = (typeof tournamentData.sport === 'object' && tournamentData.sport !== null ? tournamentData.sport.sport_name || tournamentData.sport.name : null) ||
                                     tournamentData.sport_name ||
                                     (typeof tournamentData.sport === 'string' ? tournamentData.sport : null) ||
                                     (tournamentData.sport_id === 2 || tournamentData.settings?.sport_id === "2" || tournamentData.settings?.sport_id === 2 ? "volleyball" : "") ||
                                     (tournamentData.sport_id === 4 || tournamentData.settings?.sport_id === "4" || tournamentData.settings?.sport_id === 4 ? "futsal" : "") ||
                                     (tournamentData.sport_id === 1 || tournamentData.settings?.sport_id === "1" || tournamentData.settings?.sport_id === 1 ? "football" : "") ||
                                     tournamentData.settings?.sport_id ||
                                     (tournamentData.name?.toLowerCase().includes("volleyball") || tournamentData.name?.includes("วอลเลย์บอล") ? "volleyball" : tournamentData.name?.toLowerCase().includes("futsal") || tournamentData.name?.includes("ฟุตซอล") ? "futsal" : "football");
                    setSport(String(rawSport || "football").toLowerCase());
                }

                if (catData) {
                    setCategories(catData);
                    if (catData.length > 0) {
                        setSelectedCategoryId((current) => {
                            const exists = catData.some((c: any) => c.id.toString() === current);
                            return exists ? current : catData[0].id.toString();
                        });
                    } else {
                        setSelectedCategoryId(null);
                    }
                }
            }
        } catch (error) {
            console.error("Error loading categories settings:", error);
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (selectedCategoryId) {
            const cat = categories.find(c => c.id.toString() === selectedCategoryId.toString());
            if (cat) {
                const name = cat.age_categories?.category_name || "Open";
                const isPredefined = defaultAgeCategories.some(
                    (d) => d.category_name.toLowerCase() === name.toLowerCase()
                );
                const ageVal = isPredefined ? name : "custom";
                const customVal = isPredefined ? "" : name;
                const genderVal = cat.gender_type || "male";
                const maxTeamsVal = cat.max_teams ? cat.max_teams.toString() : "8";
                const feeVal = Number(cat.registration_fee ?? 0).toFixed(0);
                const maxSetsVal = cat.rules_config?.max_sets ? String(cat.rules_config.max_sets) : "3";

                setSelectedAge(ageVal);
                setCustomAge(customVal);
                setGenderType(genderVal);
                setMaxTeams(maxTeamsVal);
                setRegistrationFee(feeVal);
                setMaxSets(maxSetsVal);

                setInitialValues({
                    age: ageVal,
                    customAge: customVal,
                    gender: genderVal,
                    maxTeams: maxTeamsVal,
                    fee: feeVal,
                    maxSets: maxSetsVal
                });
                setLastModifiedField(null);
            }
        }
    }, [selectedCategoryId, categories]);

    useEffect(() => {
        if (deleteDialogOpen) {
            setDeleteConfirmText("");
            if (deleteScrollRef.current) {
                deleteScrollRef.current.scrollTop = 0;
            }
        }
    }, [deleteDialogOpen]);

    const isVolleyball = sport === "volleyball" || sport.includes("volleyball") || sport.includes("วอลเลย์บอล");

    // Dirty checking (profile-form style)
    const isAgeDirty = selectedAge !== initialValues.age || (selectedAge === 'custom' && customAge !== initialValues.customAge);
    const isGenderDirty = genderType !== initialValues.gender;
    const isMaxTeamsDirty = maxTeams !== initialValues.maxTeams;
    const isFeeDirty = registrationFee !== initialValues.fee;
    const isSetsDirty = isVolleyball && maxSets !== initialValues.maxSets;
    const isDirty = isAgeDirty || isGenderDirty || isMaxTeamsDirty || isFeeDirty || isSetsDirty;

    const activeActionField: 'age' | 'gender' | 'maxTeams' | 'fee' | 'maxSets' | null = !isDirty
        ? null
        : lastModifiedField && (
            (lastModifiedField === 'age' && isAgeDirty) ||
            (lastModifiedField === 'gender' && isGenderDirty) ||
            (lastModifiedField === 'maxTeams' && isMaxTeamsDirty) ||
            (lastModifiedField === 'fee' && isFeeDirty) ||
            (lastModifiedField === 'maxSets' && isSetsDirty)
        )
        ? lastModifiedField
        : isSetsDirty ? 'maxSets'
        : isFeeDirty ? 'fee'
        : isMaxTeamsDirty ? 'maxTeams'
        : isGenderDirty ? 'gender'
        : isAgeDirty ? 'age'
        : null;

    const handleReset = () => {
        setSelectedAge(initialValues.age);
        setCustomAge(initialValues.customAge);
        setGenderType(initialValues.gender);
        setMaxTeams(initialValues.maxTeams);
        setRegistrationFee(initialValues.fee);
        setMaxSets(initialValues.maxSets);
        setLastModifiedField(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCategoryId) return;

        let targetCategoryName = selectedAge;
        let minAge = 0;
        let maxAge = 99;

        if (selectedAge === "custom") {
            if (!customAge.trim()) {
                toast({
                    title: "Error",
                    description: isThai ? "กรุณาระบุชื่อรุ่นอายุที่กำหนดเอง" : "Please enter custom age category name",
                    variant: "destructive"
                });
                return;
            }
            targetCategoryName = customAge.trim();
        }

        if (targetCategoryName.toUpperCase().startsWith("U")) {
            const parsed = parseInt(targetCategoryName.substring(1), 10);
            if (!isNaN(parsed)) {
                minAge = 0;
                maxAge = parsed;
            }
        } else if (targetCategoryName.endsWith("+")) {
            const parsed = parseInt(targetCategoryName.replace("+", ""), 10);
            if (!isNaN(parsed)) {
                minAge = parsed;
                maxAge = 99;
            }
        } else if (targetCategoryName.toLowerCase() === "open") {
            minAge = 0;
            maxAge = 99;
        }

        if (!maxTeams || parseInt(maxTeams) <= 0) {
            toast({
                title: "Error",
                description: isThai ? "กรุณาระบุจำนวนทีมสูงสุดที่ถูกต้อง" : "Please enter a valid team limit.",
                variant: "destructive"
            });
            return;
        }

        setIsSaving(true);
        try {
            const ageCatRes = await getOrCreateAgeCategory(targetCategoryName, minAge, maxAge);
            if (!ageCatRes.success || !ageCatRes.id) {
                toast({
                    title: "Error",
                    description: ageCatRes.error || (isThai ? "เกิดข้อผิดพลาดในการสร้างรุ่นอายุ" : "Failed to process age category"),
                    variant: "destructive"
                });
                setIsSaving(false);
                return;
            }

            const targetAgeCategoryId = ageCatRes.id;
            const cat = categories.find(c => c.id.toString() === selectedCategoryId.toString());
            const currentRulesConfig = cat?.rules_config || {};
            const rulesConfig = isVolleyball 
                ? { ...currentRulesConfig, max_sets: parseInt(maxSets) || 3 }
                : currentRulesConfig;

            const res = await updateTournamentCategory(
                tournamentId,
                selectedCategoryId,
                targetAgeCategoryId,
                genderType,
                parseInt(maxTeams),
                parseFloat(registrationFee) || 0,
                rulesConfig
            );

            if (res.success) {
                toast({
                    title: isThai ? "บันทึกสำเร็จ" : "Saved Successfully",
                    description: isThai ? "อัปเดตข้อมูลรุ่นการแข่งขันเรียบร้อยแล้ว" : "Tournament category has been updated."
                });
                setLastModifiedField(null);
                await loadData();
                onCategoryUpdated?.();
            } else {
                toast({
                    title: "Error",
                    description: res.error || "Failed to update category",
                    variant: "destructive"
                });
            }
        } catch (err) {
            const error = err as Error;
            toast({
                title: "Error",
                description: error.message || "An unexpected error occurred",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedCategoryId) return;

        setIsDeleting(true);
        try {
            const res = await deleteTournamentCategory(tournamentId, selectedCategoryId);
            if (res.success) {
                toast({
                    title: isThai ? "ลบสำเร็จ" : "Deleted Successfully",
                    description: isThai ? "ลบรุ่นการแข่งขันเรียบร้อยแล้ว" : "Tournament category has been deleted."
                });
                setDeleteDialogOpen(false);
                setSelectedCategoryId(null);
                await loadData();
                onCategoryUpdated?.();
            } else {
                toast({
                    title: "Error",
                    description: res.error || "Failed to delete category",
                    variant: "destructive"
                });
            }
        } catch (err) {
            const error = err as Error;
            toast({
                title: "Error",
                description: error.message || "An unexpected error occurred",
                variant: "destructive"
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const renderActionButtons = () => (
        <div className="flex items-center gap-2 pt-4 animate-in fade-in-50 duration-200">
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSaving}
                onClick={handleReset}
                className="text-xs"
            >
                {isThai ? "ยกเลิก" : "Cancel"}
            </Button>
            <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                variant="default"
                className="text-xs font-semibold"
            >
                {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : null}
                <span>{isThai ? "บันทึก" : "Save"}</span>
            </Button>
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    if (categories.length === 0) {
        return (
            <Card className="border border-border bg-card">
                <CardHeader>
                    <CardTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        {isThai ? "รุ่นการแข่งขัน" : "Tournament Categories"}
                    </CardTitle>
                    <CardDescription>
                        {isThai
                            ? "ยังไม่มีการสร้างรุ่นการแข่งขันในทัวร์นาเมนต์นี้"
                            : "No categories have been created for this tournament yet."}
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const selectedCategory = categories.find(c => c.id.toString() === selectedCategoryId?.toString());
    const selectedAgeName = selectedCategory?.age_categories?.category_name || "Category";
    const selectedGenderLabel = selectedCategory?.gender_type === "open"
        ? (isThai ? "ทั่วไป" : "Open")
        : selectedCategory?.gender_type === "male"
            ? (isThai ? "ชาย" : "Male")
            : selectedCategory?.gender_type === "female"
                ? (isThai ? "หญิง" : "Female")
                : (isThai ? "คู่ผสม" : "Mixed");
    const categoryDisplayName = `${selectedAgeName} • ${selectedGenderLabel}`;

    return (
        <div className={cn(className)}>
            {/* Card Section Header (profile-form style) */}
            <div>
                <Header level={4}>
                    {isThai ? "ตั้งค่ารุ่นการแข่งขัน" : "Category Settings"}
                </Header>
                <p className="text-xs text-muted-foreground">
                    {isThai
                        ? "กำหนดกฎระเบียบและรุ่นการแข่งขัน เพื่อเริ่มสร้างตารางการแข่งขันและเพิ่มทีม"
                        : "Configure rules and category details for this tournament."}
                </p>
            </div>

            <form onSubmit={handleSave}>
                {/* 1. Category Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <Trophy className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {isThai ? "เลือกรุ่นการแข่งขัน" : "Tournament Category"}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "เลือกรุ่นการแข่งขันที่ต้องการแก้ไขข้อมูล" : "Select category to view or edit settings"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3">
                        <Select
                            value={selectedCategoryId || ""}
                            onValueChange={setSelectedCategoryId}
                            disabled={isSaving || isDeleting}
                        >
                            <SelectTrigger size="sm" className="w-full">
                                <SelectValue placeholder={isThai ? "เลือกรุ่นการแข่งขัน..." : "Select category..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((cat) => {
                                    const ageName = cat.age_categories?.category_name || "Unknown";
                                    const genderLabel = cat.gender_type === "open"
                                        ? (isThai ? "ทั่วไป" : "Open")
                                        : cat.gender_type === "male"
                                            ? (isThai ? "ชาย" : "Male")
                                            : cat.gender_type === "female"
                                                ? (isThai ? "หญิง" : "Female")
                                                : (isThai ? "คู่ผสม" : "Mixed");
                                    return (
                                        <SelectItem key={cat.id} value={cat.id.toString()} className="font-semibold py-2">
                                            {ageName} • {genderLabel} • {cat.max_teams} {isThai ? "ทีม" : "Teams"}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* 2. Age Category */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <Users className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {isThai ? "รุ่นอายุ" : "Age Category"} <span className="text-destructive">*</span>
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "เลือกรุ่นอายุสำหรับการแข่งขัน" : "Select age group"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 space-y-2">
                        <Select
                            value={selectedAge}
                            onValueChange={(val) => {
                                setSelectedAge(val);
                                setLastModifiedField('age');
                            }}
                            disabled={isSaving || isDeleting}
                        >
                            <SelectTrigger size="sm" className="w-full">
                                <SelectValue placeholder={isThai ? "เลือกรุ่นอายุ" : "Select age"} />
                            </SelectTrigger>
                            <SelectContent>
                                {defaultAgeCategories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.category_name}>
                                        {cat.category_name}
                                    </SelectItem>
                                ))}
                                <SelectItem value="custom">
                                    {isThai ? "กำหนดเอง..." : "Custom..."}
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        {selectedAge === "custom" && (
                            <div className="space-y-1 pt-1">
                                <Label className="text-xs font-semibold text-muted-foreground">
                                    {isThai ? "ระบุชื่อรุ่นอายุ (เช่น U13, 30+, Open)" : "Enter age (e.g. U13, 30+, Open)"} <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    type="text"
                                    size="sm"
                                    value={customAge}
                                    disabled={isSaving || isDeleting}
                                    onChange={(e) => {
                                        setCustomAge(e.target.value);
                                        setLastModifiedField('age');
                                    }}
                                    placeholder={isThai ? "U13 หรือ 30+" : "U13 or 30+"}
                                    className="w-full"
                                />
                            </div>
                        )}
                        {activeActionField === 'age' && renderActionButtons()}
                    </div>
                </div>

                {/* 3. Gender Group */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <UsersRound className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {isThai ? "ประเภทเพศ" : "Gender Group"} <span className="text-destructive">*</span>
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "กำหนดเพศของผู้เข้าแข่งขันในรุ่นนี้" : "Target gender category for participants"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 space-y-1">
                        <Select
                            value={genderType}
                            onValueChange={(val) => {
                                setGenderType(val);
                                setLastModifiedField('gender');
                            }}
                            disabled={isSaving || isDeleting}
                        >
                            <SelectTrigger size="sm" className="w-full">
                                <SelectValue placeholder={isThai ? "เลือกกลุ่มเพศ" : "Select gender"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="open">{isThai ? "ทั่วไป (ทุกเพศ)" : "Open (All Genders)"}</SelectItem>
                                <SelectItem value="male">{isThai ? "ชาย (ผู้ชายเท่านั้น)" : "Male (Men only)"}</SelectItem>
                                <SelectItem value="female">{isThai ? "หญิง (ผู้หญิงเท่านั้น)" : "Female (Women only)"}</SelectItem>
                                <SelectItem value="mixed">{isThai ? "ผสม (ชาย-หญิง)" : "Mixed (Men & Women)"}</SelectItem>
                            </SelectContent>
                        </Select>
                        {activeActionField === 'gender' && renderActionButtons()}
                    </div>
                </div>

                {/* 4. Team Limit */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <Shield className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {isThai ? "จำนวนทีมสูงสุด" : "Team Limit"} <span className="text-destructive">*</span>
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "จำนวนทีมที่เปิดรับสมัครสูงสุดในรุ่นนี้" : "Maximum number of teams allowed to register"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 space-y-1">
                        <Input
                            type="text"
                            size="sm"
                            value={maxTeams}
                            disabled={isSaving || isDeleting}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, "");
                                setMaxTeams(val);
                                setLastModifiedField('maxTeams');
                            }}
                            placeholder="8, 16, 32"
                            className="w-full"
                        />
                        {activeActionField === 'maxTeams' && renderActionButtons()}
                    </div>
                </div>

                {/* 5. Registration Fee */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-start gap-4 sm:w-2/3">
                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                            <CreditCard className="size-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <Header level={6}>
                                {isThai ? "ค่าสมัคร (บาท)" : "Registration Fee (THB)"}
                            </Header>
                            <p className="text-xs text-muted-foreground">
                                {isThai ? "ระบุ 0 หากสมัครฟรี" : "Set 0 for free registration"}
                            </p>
                        </div>
                    </div>
                    <div className="sm:w-2/3 space-y-1">
                        <Input
                            type="text"
                            size="sm"
                            value={registrationFee}
                            disabled={isSaving || isDeleting}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9.]/g, "");
                                if ((val.match(/\./g) || []).length <= 1) {
                                    setRegistrationFee(val);
                                    setLastModifiedField('fee');
                                }
                            }}
                            placeholder={isThai ? "500 (หรือ 0 สำหรับฟรี)" : "500 (or 0 for free)"}
                            className="w-full"
                        />
                        {activeActionField === 'fee' && renderActionButtons()}
                    </div>
                </div>

                {/* 6. Match Sets (Volleyball only) */}
                {isVolleyball && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                        <div className="flex items-start gap-4 sm:w-2/3">
                            <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                <Layers className="size-4 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                                <Header level={6}>
                                    {isThai ? "จำนวนเซ็ตการแข่งขัน" : "Match Sets"}
                                </Header>
                                <p className="text-xs text-muted-foreground">
                                    {isThai ? "กำหนดรูปแบบการแข่งขัน" : "Define match format and number of sets"}
                                </p>
                            </div>
                        </div>
                        <div className="sm:w-2/3 space-y-1">
                            <RadioBtn
                                value={maxSets}
                                onChange={(val) => {
                                    setMaxSets(val);
                                    setLastModifiedField('maxSets');
                                }}
                                disabled={isSaving || isDeleting}
                                options={[
                                    { id: "3", label: isThai ? "3 เซ็ต" : "3 Sets", icon: <span className="font-bold w-4 h-4 flex items-center justify-center leading-none">3</span> },
                                    { id: "5", label: isThai ? "5 Sets" : "5 Sets", icon: <span className="font-bold w-4 h-4 flex items-center justify-center leading-none">5</span> },
                                ]}
                            />
                            {activeActionField === 'maxSets' && renderActionButtons()}
                        </div>
                    </div>
                )}

                {/* 7. Danger Action Row: Delete Category (matches settings-view style) */}
                {selectedCategory && (
                    <>
                        <div className="-mx-4 border-t border-border my-4" />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                            <div className="flex items-start gap-4 sm:w-2/3">
                                <div className="size-9 rounded-sm bg-destructive/10 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="size-4 text-destructive" />
                                </div>
                                <div className="space-y-1">
                                    <Header level={6} className="text-destructive">
                                        {isThai ? "ลบรุ่นการแข่งขัน" : "Delete Category"}
                                    </Header>
                                    <p className="text-xs text-muted-foreground">
                                        {isThai
                                            ? "ลบรุ่นการแข่งขันนี้และข้อมูลที่เกี่ยวข้องทั้งหมดออกจากการแข่งขัน"
                                            : "Permanently delete this tournament category and all associated matches"}
                                    </p>
                                </div>
                            </div>
                            <div className="sm:w-2/3 flex justify-start sm:justify-end">
                                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all text-xs"
                                            disabled={isDeleting || isSaving}
                                        >
                                            {isThai ? "ลบรุ่นการแข่งขัน" : "Delete Category"}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[760px] h-auto sm:h-auto max-h-[88vh] p-0 flex flex-col overflow-hidden">
                                        <DialogHeader className="p-4 sm:px-6 sm:py-4 border-b shrink-0 bg-card">
                                            <DialogTitle asChild>
                                                <Header level={4} className="text-destructive">
                                                    {isThai ? "ลบรุ่นการแข่งขัน" : "Delete Category"}
                                                </Header>
                                            </DialogTitle>
                                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                                {isThai
                                                    ? "คุณแน่ใจหรือไม่ว่าต้องการลบรุ่นการแข่งขันนี้? ข้อมูลในรุ่นการแข่งขันนี้จะถูกลบทั้งหมด"
                                                    : "Are you sure you want to delete this category? All matches and data for this category will be removed."}
                                            </DialogDescription>
                                        </DialogHeader>

                                        <form
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                if (!isDeleting && deleteConfirmText === categoryDisplayName) {
                                                    handleDelete();
                                                }
                                            }}
                                            className="flex flex-col"
                                        >
                                            <div ref={deleteScrollRef} className="p-4 space-y-2 overflow-y-auto max-h-[60vh]">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-3">
                                                    <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                                        <div className="size-9 rounded-sm bg-destructive/10 flex items-center justify-center shrink-0">
                                                            <AlertTriangle className="size-4 text-destructive" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Header level={6}>
                                                                {isThai ? `โปรดพิมพ์ "${categoryDisplayName}" เพื่อยืนยัน:` : `Please type "${categoryDisplayName}" to confirm:`}
                                                            </Header>
                                                            <p className="text-xs text-muted-foreground">
                                                                {isThai ? "การดำเนินการนี้ไม่สามารถย้อนกลับได้" : "This action cannot be undone."}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="sm:w-1/2 w-full">
                                                        <Input
                                                            id="confirm-category-delete"
                                                            value={deleteConfirmText}
                                                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                                                            placeholder={categoryDisplayName}
                                                            autoComplete="off"
                                                            size="sm"
                                                            variant="destructive"
                                                            className="w-full"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <DialogFooter className="p-3 sm:px-6 sm:py-3.5 border-t bg-card shrink-0 flex flex-row items-center justify-end gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setDeleteDialogOpen(false)}
                                                    disabled={isDeleting}
                                                >
                                                    {isThai ? "ยกเลิก" : "Cancel"}
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    variant="destructive"
                                                    size="sm"
                                                    disabled={isDeleting || deleteConfirmText !== categoryDisplayName}
                                                >
                                                    {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                                                    {isThai ? "ลบ" : "Delete"}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                    </>
                )}
            </form>
        </div>
    );
}
