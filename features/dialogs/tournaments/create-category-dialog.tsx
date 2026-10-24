"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { ApiClient } from "@/lib/api-client";
import { createTournamentCategory, getOrCreateAgeCategory } from "@/actions/tournaments/general";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/ui/header";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/dropdown";
import {
    Loader2,
    Users,
    UsersRound,
    Shield,
    CreditCard,
    Layers,
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

import { useBracketStore } from "@/lib/stores/bracket-store";

interface CreateCategoryFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tournamentId: string;
    ageCategories: { id: number; category_name: string }[];
    onSuccess: (id: string) => void;
    sport?: string;
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

export function CreateCategoryForm({
    open,
    onOpenChange,
    tournamentId,
    ageCategories,
    onSuccess,
    sport: initialSport
}: CreateCategoryFormProps) {
    const locale = useLocale();
    const isThai = locale === "th";
    const { toast } = useToast();
    const storeSport = useBracketStore((state) => state.sport);

    const availableCategories = ageCategories && ageCategories.length > 0 ? ageCategories : defaultAgeCategories;

    const [selectedAge, setSelectedAge] = useState<string>(
        availableCategories[0]?.category_name || "Open"
    );
    const [customAge, setCustomAge] = useState<string>("");
    const [genderType, setGenderType] = useState<string>("male");
    const [maxTeams, setMaxTeams] = useState<string>("8");
    const [registrationFee, setRegistrationFee] = useState<string>("0");
    const [maxSets, setMaxSets] = useState<string>("3");
    const [sport, setSport] = useState<string>(initialSport || storeSport || "football");
    const [isPending, setIsPending] = useState(false);
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

    useEffect(() => {
        if (initialSport || storeSport) {
            setSport((initialSport || storeSport || "").toLowerCase());
            return;
        }
        if (!tournamentId) return;
        async function fetchSport() {
            try {
                const data = await ApiClient.fetch<{ tournament?: { name?: string; sport?: string }; sport?: string; name?: string }>(`/tournaments/${tournamentId}`);
                const rawSport = data?.tournament?.sport || data?.sport ||
                    (data?.tournament?.name?.toLowerCase().includes("volleyball") || data?.name?.toLowerCase().includes("volleyball") || data?.tournament?.name?.includes("วอลเลย์บอล") || data?.name?.includes("วอลเลย์บอล") ? "volleyball" : null);

                if (rawSport) {
                    setSport(rawSport.toLowerCase());
                }
            } catch {
                // Ignore error
            }
        }
        fetchSport();
    }, [tournamentId, initialSport, storeSport]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let targetCategoryName = selectedAge;
        let minAge = 0;
        let maxAge = 99;

        if (selectedAge === "custom") {
            if (!customAge.trim()) {
                toast({
                    title: isThai ? "ข้อมูลไม่ครบถ้วน" : "Required Fields Missing",
                    description: isThai ? "กรุณาระบุชื่อรุ่นอายุที่กำหนดเอง" : "Please enter custom age category name.",
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
                title: isThai ? "ข้อมูลไม่ถูกต้อง" : "Invalid Input",
                description: isThai ? "กรุณาระบุจำนวนทีมสูงสุดที่ถูกต้อง" : "Please enter a valid team limit.",
                variant: "destructive"
            });
            return;
        }

        setIsPending(true);
        try {
            // Get or create Age Category ID
            const ageCatRes = await getOrCreateAgeCategory(targetCategoryName, minAge, maxAge);
            if (!ageCatRes.success || !ageCatRes.id) {
                toast({
                    title: isThai ? "เกิดข้อผิดพลาด" : "Error",
                    description: ageCatRes.error || (isThai ? "เกิดข้อผิดพลาดในการสร้างรุ่นอายุ" : "Failed to process age category"),
                    variant: "destructive"
                });
                setIsPending(false);
                return;
            }

            const targetAgeCategoryId = ageCatRes.id;

            // Client-side Subscription & Limit Check
            const { getUserSubscriptionPlan } = await import("@/actions/common/user");
            const activePlan = await getUserSubscriptionPlan();
            const isUnlimitedPlan = activePlan === "yearly" || activePlan === "pro_yearly" || activePlan === "cup_yearly" || activePlan === "customs";
            const isCupPlan = activePlan === "cup";
            const isEventPlan = activePlan === "event" || activePlan === "monthly" || activePlan === "pro" || activePlan === "manager_pro";

            if (!isUnlimitedPlan) {
                let categoryCount = 0;
                try {
                    const categories = await ApiClient.fetch<any[]>(`/tournaments/${tournamentId}/categories`);
                    categoryCount = Array.isArray(categories) ? categories.length : 0;
                } catch (categoryCountError) {
                    console.error("Error counting categories:", categoryCountError);
                }

                const maxAllowedCategories = isCupPlan ? Infinity : isEventPlan ? 3 : 1;

                if (categoryCount >= maxAllowedCategories) {
                    toast({
                        title: isThai ? "เกิดข้อผิดพลาด" : "Error",
                        description: isThai
                            ? isCupPlan
                                ? "แพ็คเกจ Cup สามารถสร้างรุ่นการแข่งขันได้สูงสุด 5 รุ่นต่อทัวร์นาเมนต์เท่านั้น"
                                : isEventPlan
                                    ? "แพ็คเกจ Event สามารถสร้างรุ่นการแข่งขันได้สูงสุด 3 รุ่นต่อทัวร์นาเมนต์เท่านั้น"
                                    : "ผู้ใช้ทั่วไปสามารถสร้างรุ่นการแข่งขันได้สูงสุด 1 รุ่นเท่านั้น กรุณาอัพเกรดแพ็คเกจ"
                            : isCupPlan
                                ? "Cup plan allows up to 5 categories per tournament."
                                : isEventPlan
                                    ? "Event plan allows up to 3 categories per tournament."
                                    : "Free plan users can create only 1 tournament category. Please upgrade your plan.",
                        variant: "destructive"
                    });
                    setIsPending(false);
                    return;
                }

                const maxAllowedTeams = isCupPlan ? 128 : isEventPlan ? 32 : 12;
                if (parseInt(maxTeams) > maxAllowedTeams) {
                    toast({
                        title: isThai ? "เกิดข้อผิดพลาด" : "Error",
                        description: isThai
                            ? isCupPlan
                                ? "แพ็คเกจ Cup สามารถจำกัดจำนวนทีมได้สูงสุด 128 ทีมต่อรุ่นเท่านั้น"
                                : isEventPlan
                                    ? "แพ็คเกจ Event สามารถจำกัดจำนวนทีมได้สูงสุด 32 ทีมต่อรุ่นเท่านั้น"
                                    : "ผู้ใช้ทั่วไปสามารถจำกัดจำนวนทีมได้สูงสุด 12 ทีมต่อรุ่นเท่านั้น กรุณาอัพเกรดแพ็คเกจ"
                            : isCupPlan
                                ? "Cup plan allows a maximum of 128 teams per category."
                                : isEventPlan
                                    ? "Event plan allows a maximum of 32 teams per category."
                                    : "Free plan users can set a maximum limit of 12 teams per category. Please upgrade your plan.",
                        variant: "destructive"
                    });
                    setIsPending(false);
                    return;
                }
            }
            const rulesConfig = (sport === 'volleyball' || sport.includes('volleyball') || sport.includes('วอลเลย์บอล'))
                ? { max_sets: parseInt(maxSets) || 3 }
                : null;

            const res = await createTournamentCategory(
                tournamentId,
                targetAgeCategoryId,
                genderType,
                parseInt(maxTeams),
                parseFloat(registrationFee) || 0,
                rulesConfig
            );
            if (res.success) {
                toast({
                    title: isThai ? "สร้างสำเร็จ" : "Created Successfully",
                    description: isThai ? "สร้างประเภทการแข่งขันเรียบร้อยแล้ว" : "New category has been created."
                });

                try {
                    const categories = await ApiClient.fetch<any[]>(`/tournaments/${tournamentId}/categories`);
                    const found = categories?.find(
                        (c: any) => c.age_category_id === targetAgeCategoryId && c.gender_type === genderType
                    );
                    if (found) {
                        onSuccess(found.id);
                    } else {
                        onSuccess("");
                    }
                } catch {
                    onSuccess("");
                }
                onOpenChange(false);
            } else {
                toast({
                    title: isThai ? "เกิดข้อผิดพลาด" : "Error",
                    description: res.error || (isThai ? "ไม่สามารถสร้างประเภทการแข่งขันได้" : "Failed to create category"),
                    variant: "destructive"
                });
            }
        } catch (err) {
            const error = err as Error;
            toast({
                title: isThai ? "เกิดข้อผิดพลาด" : "Error",
                description: error.message || (isThai ? "เกิดข้อผิดพลาดที่ไม่คาดคิด" : "An unexpected error occurred"),
                variant: "destructive"
            });
        } finally {
            setIsPending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[760px] sm:max-h-[88vh] p-0 flex flex-col overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                    <DialogHeader className="p-4 border-b shrink-0">
                        <DialogTitle asChild>
                            <Header level={4}>
                                {isThai ? "สร้างประเภทการแข่งขันใหม่" : "Create New Category"}
                            </Header>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                            {isThai
                                ? "กำหนดรุ่นอายุ ประเภทเพศ และรายละเอียดการรับสมัครสำหรับรุ่นนี้"
                                : "Define age category, gender, and registration limits for this category."}
                        </DialogDescription>
                    </DialogHeader>

                    <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4">
                        {/* 1. Age Category Selector */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
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
                            <div className="sm:w-1/2 w-full space-y-2">
                                <Select value={selectedAge} onValueChange={setSelectedAge} disabled={isPending}>
                                    <SelectTrigger size="sm" className="w-full">
                                        <SelectValue placeholder={isThai ? "เลือกรุ่นอายุ" : "Select age"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableCategories.map((cat) => (
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
                                            disabled={isPending}
                                            onChange={(e) => setCustomAge(e.target.value)}
                                            placeholder={isThai ? "U13 หรือ 30+" : "U13 or 30+"}
                                            className="w-full"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Gender Group Selector */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
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
                            <div className="sm:w-1/2 w-full">
                                <Select value={genderType} onValueChange={setGenderType} disabled={isPending}>
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
                            </div>
                        </div>

                        {/* 3. Team Limit */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
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
                            <div className="sm:w-1/2 w-full">
                                <Input
                                    type="text"
                                    size="sm"
                                    value={maxTeams}
                                    disabled={isPending}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9]/g, "");
                                        setMaxTeams(val);
                                    }}
                                    placeholder="8, 16, 32"
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 4. Registration Fee */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                            <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
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
                            <div className="sm:w-1/2 w-full">
                                <Input
                                    type="text"
                                    size="sm"
                                    value={registrationFee}
                                    disabled={isPending}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9.]/g, "");
                                        if ((val.match(/\./g) || []).length <= 1) {
                                            setRegistrationFee(val);
                                        }
                                    }}
                                    placeholder={isThai ? "500 (หรือ 0 สำหรับฟรี)" : "500 (or 0 for free)"}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* 5. Match Sets (Volleyball only) */}
                        {(sport === "volleyball" || sport.includes("volleyball") || sport.includes("วอลเลย์บอล")) && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                                <div className="flex items-start gap-3 sm:gap-4 sm:w-1/2">
                                    <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                        <Layers className="size-4 text-muted-foreground" />
                                    </div>
                                    <div className="space-y-1">
                                        <Header level={6}>
                                            {isThai ? "จำนวนเซ็ตการแข่งขัน" : "Match Sets"}
                                        </Header>
                                        <p className="text-xs text-muted-foreground">
                                            {isThai ? "รูปแบบการตัดสินจำนวนเซ็ตของกีฬาวอลเลย์บอล" : "Set format for volleyball matches"}
                                        </p>
                                    </div>
                                </div>
                                <div className="sm:w-1/2 w-full">
                                    <Select value={maxSets} onValueChange={setMaxSets} disabled={isPending}>
                                        <SelectTrigger size="sm" className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="3">{isThai ? "ชนะ 2 ใน 3 เซ็ต (Best of 3)" : "Best of 3 Sets"}</SelectItem>
                                            <SelectItem value="5">{isThai ? "ชนะ 3 ใน 5 เซ็ต (Best of 5)" : "Best of 5 Sets"}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-3 sm:px-6 sm:py-3.5 border-t bg-card shrink-0 flex flex-row items-center justify-end gap-2">
                        <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => onOpenChange(false)}
                        >
                            {isThai ? "ยกเลิก" : "Cancel"}
                        </Button>
                        <Button size="sm" type="submit" disabled={isPending}>
                            {isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                    {isThai ? "กำลังสร้าง..." : "Creating..."}
                                </>
                            ) : (
                                isThai ? "สร้างรุ่นการแข่งขัน" : "Create Category"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
