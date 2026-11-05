"use client";

import React, { useEffect, useCallback } from "react";
import Image from "next/image";
import { useBracketStore } from "@/lib/stores/bracket-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LayoutGrid, Trash2, Megaphone, X, Heart, Loader2, GripVertical, Globe, Shield, HelpCircle, MoreVertical, Pencil, Minus, Trophy, CreditCard, QrCode, Building2, UserCheck, ChevronDown, RotateCcw, Dices, Shuffle, Layers, GitBranch, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    sortStandingsByTieBreak,
    getTiedTeamGroups,
    TIE_BREAK_CRITERIA_INFO,
    DEFAULT_FOOTBALL_TIE_BREAK,
    DEFAULT_VOLLEYBALL_TIE_BREAK,
    type TieBreakCriterionKey,
} from "./tie-break-utils";
import { useParams } from "next/navigation";
import { getSponsors, updateSponsorsOrder, deleteSponsor, Sponsor } from "@/actions/tournaments/sponsor";
import { updateTournament } from "@/actions/tournaments/general";
import { ApiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
    ActionMenu,
    ActionMenuContent,
    ActionMenuItem,
    ActionMenuTrigger,
} from "@/components/ui/action-menu";

import { Match, Tournament, TournamentStatus } from "@/types";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectSeparator,
} from "@/components/ui/dropdown";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { RankingNodeSettings } from "./ranking-node-settings";
import { MatchNodeSettings } from "./match-node-settings";
import { Registrations } from "@/features/tournaments/management/registrations";
import { Announcements } from "@/features/tournaments/management/announcements";
import { AddTournamentTeamDialog, AddAnnouncementDialog, AddSponsorDialog } from "@/features/dialogs";
import { saveBracketCanvas } from "@/actions/tournaments/bracket";
import { EmptyState } from "@/components/shared/empty-state";
import { Plus } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { Header } from "@/components/ui/header";

export interface NodeSettingsProps {
    currentTournamentStatus?: string;
    onStatusChange?: (status: TournamentStatus) => void;
    onClose?: () => void;
    isLocked?: boolean;
}

export const isTeamApproved = (item: any) => {
    const ps = String(item?.payment_status || "").toLowerCase();
    const rs = String(item?.registration_status || "").toLowerCase();
    const s = String(item?.status || "").toLowerCase();
    if (rs === "rejected" || ps === "rejected" || s === "rejected") return false;
    return (
        rs === "approved" ||
        rs === "confirmed" ||
        s === "approved" ||
        (s === "registered" && rs !== "pending" && ps !== "pending")
    );
};

export function NodeSettings({ currentTournamentStatus, onStatusChange, onClose, isLocked }: NodeSettingsProps = {}) {
    const { nodes, updateNodeData, deleteNode, selectNode, setActiveNodeId, fetchTeams, activeNodeId, activeCategoryId, matches: storeMatches, setMatches: setStoreMatches, teams: storeTeams = [], generateRoundRobinMatches, generateRoundRobinMatchDays, shuffleDrawNode, generateNextRoundFromDraw, updateDrawPair, swapDrawPairSlots } = useBracketStore();
    const params = useParams();
    const tournamentId = params.id as string;
    const selectedNode = nodes.find((node) => node.id === activeNodeId);
    const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
    const [isAddAnnouncementOpen, setIsAddAnnouncementOpen] = React.useState(false);
    const [customTeamDialog, setCustomTeamDialog] = React.useState<{ nodeId: string; slotIndex: number; initialName: string } | null>(null);
    const [customTeamInput, setCustomTeamInput] = React.useState("");

    const handleSaveCustomTeam = () => {
        if (!customTeamDialog) return;
        const { nodeId, slotIndex } = customTeamDialog;
        const targetNode = nodes.find((n) => n.id === nodeId);
        if (targetNode) {
            const teams = Array.isArray(targetNode.data.teams) ? [...targetNode.data.teams] : [];
            while (teams.length <= slotIndex) {
                teams.push("TBD");
            }
            teams[slotIndex] = customTeamInput.trim() || "TBD";
            updateNodeData(nodeId, { teams });
            useBracketStore.setState({ isDirty: true });
        }
        setCustomTeamDialog(null);
        setCustomTeamInput("");
    };
    const tSponsors = useTranslations("Sponsors");
    const locale = useLocale();
    const { toast } = useToast();

    // Sponsors state
    const [sponsorsList, setSponsorsList] = React.useState<Sponsor[]>([]);
    const [isSponsorLoading, setIsSponsorLoading] = React.useState(true);
    const [isAddSponsorOpen, setIsAddSponsorOpen] = React.useState(false);
    const [editingSponsor, setEditingSponsor] = React.useState<Sponsor | null>(null);
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [draggedTieBreakIndex, setDraggedTieBreakIndex] = React.useState<number | null>(null);
    const [draggedTiedTeam, setDraggedTiedTeam] = React.useState<{ name: string; groupId: string } | null>(null);
    const [dragOverTiedTeam, setDragOverTiedTeam] = React.useState<string | null>(null);

    // Registration settings state
    const [regOpen, setRegOpen] = React.useState(false);
    const [regFee, setRegFee] = React.useState<number | "">("");
    const [bankNumber, setBankNumber] = React.useState("");
    const [bankName, setBankName] = React.useState("PromptPay");
    const [accountName, setAccountName] = React.useState("");
    const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = React.useState(false);
    const [lastModifiedField, setLastModifiedField] = React.useState<'regFee' | 'bankNumber' | 'bankName' | 'accountName' | null>(null);
    const [initialRegValues, setInitialRegValues] = React.useState<{
        regFee: number | "";
        bankNumber: string;
        bankName: string;
        accountName: string;
    }>({
        regFee: "",
        bankNumber: "",
        bankName: "PromptPay",
        accountName: "",
    });
    const [isRegSaving, setIsRegSaving] = React.useState(false);
    const [isRegLoading, setIsRegLoading] = React.useState(false);
    const [tournamentRecord, setTournamentRecord] = React.useState<Tournament | null>(null);

    const isRegistrationMode = activeNodeId === "registration-setting-node";

    useEffect(() => {
        if (isRegistrationMode) {
            setIsRegLoading(true);
            const fetchRegDetails = async () => {
                try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
                    const res = await fetch(`${apiUrl}/tournaments/${tournamentId}`, { cache: 'no-store' });
                    if (res.ok) {
                        const data = await res.json();
                        const tour = data.tournament;
                        const cat = data.categories?.find((c: any) => c.id === activeCategoryId) || data.categories?.[0];
                        if (tour) {
                            setTournamentRecord({
                                ...tour,
                                max_teams: cat ? (cat.max_teams || cat.team_limit || 8) : 8,
                                registration_fee: cat ? Number(cat.registration_fee || 0) : 0,
                            });
                            const feeVal = cat ? Number(cat.registration_fee || 0) : "";
                            const bNum = tour.settings?.bank_account_number || "";
                            const bName = tour.settings?.bank_name || "PromptPay";
                            const accName = tour.settings?.bank_account_name || "";

                            setRegOpen(Boolean(tour.is_registration_open ?? tour.settings?.is_registration_open));
                            setRegFee(feeVal);
                            setBankNumber(bNum);
                            setBankName(bName);
                            setAccountName(accName);
                            setInitialRegValues({
                                regFee: feeVal,
                                bankNumber: bNum,
                                bankName: bName,
                                accountName: accName,
                            });
                            setLastModifiedField(null);
                        }
                    }
                } catch (e) {
                    console.error("Error fetching tournament for registration settings:", e);
                } finally {
                    setIsRegLoading(false);
                }
            };
            fetchRegDetails();
        }
    }, [isRegistrationMode, tournamentId, activeCategoryId]);

    const categoryEligibleTeams = React.useMemo(() => {
        return (storeTeams || []).filter((t: any) => {
            if (!t || !t.name || t.name === "TBD") return false;
            return isTeamApproved(t);
        });
    }, [storeTeams]);

    const maxTeams = Number(tournamentRecord?.max_teams || 0);
    const isTeamsFull = maxTeams > 0 ? categoryEligibleTeams.length >= maxTeams : categoryEligibleTeams.length > 0;

    const handleAutoFillTeams = React.useCallback(async () => {
        if (!isTeamsFull) {
            toast({
                title: locale === "th" ? "ทีมยังไม่ครบตามจำนวน" : "Teams Not Full",
                description: locale === "th"
                    ? `สามารถสุ่มจัดสายได้เมื่อมีทีมสมัครครบแล้ว (${categoryEligibleTeams.length}/${maxTeams} ทีม)`
                    : `Auto fill is only available when all teams are registered (${categoryEligibleTeams.length}/${maxTeams} teams)`,
                variant: "destructive",
            });
            return;
        }

        const result = useBracketStore.getState().autoFillTeams(categoryEligibleTeams);
        if (!result.success) {
            if (result.error === "no_nodes") {
                toast({
                    title: locale === "th" ? "ยังไม่มีสายการแข่งขัน" : "No Bracket Found",
                    description: locale === "th"
                        ? "กรุณาวางสายการแข่งขันก่อน (เลือกจาก Template หรือเพิ่มองค์ประกอบ)"
                        : "Please place bracket nodes on the canvas first (select a template or add elements)",
                    variant: "destructive",
                });
            } else if (result.error === "no_first_round") {
                toast({
                    title: locale === "th" ? "ไม่พบแมตช์รอบแรก" : "No First Round",
                    description: locale === "th"
                        ? "ไม่พบโหนดการแข่งขันรอบแรกในสายแข่งขัน"
                        : "Could not find any first round match nodes in the bracket",
                    variant: "destructive",
                });
            } else {
                toast({
                    title: locale === "th" ? "ไม่สามารถเพิ่มทีมได้" : "Cannot Auto Fill",
                    description: locale === "th" ? "ไม่มีทีมที่ผ่านการอนุมัติสำหรับจัดสาย" : "No approved teams found to fill",
                    variant: "destructive",
                });
            }
            return;
        }

        toast({
            title: locale === "th" ? "สุ่มจัดทีมลงสายสำเร็จ" : "Auto Fill Complete",
            description: result.target === "group"
                ? (locale === "th" ? `สุ่มเพิ่มทีม ${result.count} ทีมลงในทุกกลุ่มเรียบร้อยแล้ว` : `Randomly filled ${result.count} ทีมลงในทุกกลุ่ม`)
                : (locale === "th" ? `สุ่มเพิ่มทีม ${result.count} ทีมลงในรอบแรกเรียบร้อยแล้ว` : `Randomly filled ${result.count} teams into first round matches`),
        });

        try {
            const canvasData = useBracketStore.getState().getCanvasData();
            await saveBracketCanvas(tournamentId, canvasData, activeCategoryId || undefined);
            useBracketStore.getState().markClean();
        } catch (e) {
            console.error("Error auto-saving bracket after auto fill:", e);
        }
    }, [isTeamsFull, categoryEligibleTeams, maxTeams, locale, toast, tournamentId, activeCategoryId]);

    const handleRegSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tournamentRecord) {
            toast({
                title: "Error",
                description: "Tournament record is not loaded yet. Please try again.",
                variant: "destructive"
            });
            return;
        }
        setIsRegSaving(true);

        const formData = new FormData();
        formData.append("form_type", "registration");
        formData.append("name", tournamentRecord.name);
        formData.append("status", tournamentRecord.status || "draft");
        formData.append("max_teams", String(tournamentRecord.max_teams || 8));

        formData.append("is_registration_open", regOpen ? "true" : "false");
        formData.append("registration_fee", regFee === "" ? "" : String(regFee));
        formData.append("bank_account_number", bankNumber);
        formData.append("bank_name", bankName);
        formData.append("bank_account_name", accountName);
        if (activeCategoryId) {
            formData.append("tournament_category_id", activeCategoryId);
        }

        try {
            const res = await updateTournament(tournamentId, null, formData);
            if (res.success) {
                // Update local state to keep in sync
                setTournamentRecord(prev => prev ? {
                    ...prev,
                    is_registration_open: regOpen,
                    bank_account_number: bankNumber,
                    bank_name: bankName,
                    bank_account_name: accountName
                } : null);

                console.log("Dispatching registration-updated event with detail:", {
                    tournamentId,
                    is_registration_open: regOpen,
                    registration_fee: regFee === "" ? null : Number(regFee),
                    bank_account_number: bankNumber,
                    bank_name: bankName,
                    bank_account_name: accountName
                });
                window.dispatchEvent(new CustomEvent("registration-updated", {
                    detail: {
                        tournamentId,
                        is_registration_open: regOpen,
                        registration_fee: regFee === "" ? null : Number(regFee),
                        bank_account_number: bankNumber,
                        bank_name: bankName,
                        bank_account_name: accountName
                    }
                }));
                setInitialRegValues({
                    regFee: regFee,
                    bankNumber: bankNumber,
                    bankName: bankName,
                    accountName: accountName,
                });
                setLastModifiedField(null);
                toast({
                    title: locale === "th" ? "บันทึกสำเร็จ" : "Success",
                    description: locale === "th" ? "อัปเดตการตั้งค่าการจัดการทีมเรียบร้อยแล้ว" : "Team management settings updated successfully",
                });
            } else {
                toast({
                    title: "Error",
                    description: res.error || "Failed to update registration settings",
                    variant: "destructive"
                });
            }
        } catch {
            toast({
                title: "Error",
                description: "An unexpected error occurred",
                variant: "destructive"
            });
        } finally {
            setIsRegSaving(false);
        }
    };

    const handleToggleRegOpen = async (checked: boolean) => {
        setRegOpen(checked);
        if (!tournamentRecord) return;
        try {
            const formData = new FormData();
            formData.append("form_type", "registration");
            formData.append("name", tournamentRecord.name);
            formData.append("status", tournamentRecord.status || "draft");
            formData.append("max_teams", String(tournamentRecord.max_teams || 8));
            formData.append("is_registration_open", checked ? "true" : "false");
            formData.append("registration_fee", regFee === "" ? "" : String(regFee));
            formData.append("bank_account_number", bankNumber);
            formData.append("bank_name", bankName);
            formData.append("bank_account_name", accountName);
            if (activeCategoryId) {
                formData.append("tournament_category_id", activeCategoryId);
            }
            const res = await updateTournament(tournamentId, null, formData);
            if (res.success) {
                setTournamentRecord(prev => prev ? { ...prev, is_registration_open: checked } : null);
                window.dispatchEvent(new CustomEvent("registration-updated", {
                    detail: {
                        tournamentId,
                        is_registration_open: checked,
                        registration_fee: regFee === "" ? null : Number(regFee),
                        bank_account_number: bankNumber,
                        bank_name: bankName,
                        bank_account_name: accountName
                    }
                }));
                toast({
                    title: locale === "th" ? "บันทึกสำเร็จ" : "Success",
                    description: locale === "th"
                        ? (checked ? "เปิดรับสมัครเรียบร้อยแล้ว" : "ปิดรับสมัครเรียบร้อยแล้ว")
                        : (checked ? "Registration opened" : "Registration closed"),
                });
            }
        } catch (e) {
            console.error("Error updating registration status:", e);
            setRegOpen(!checked);
        }
    };

    // Dirty state checking for registration inputs (profile-form style)
    const isRegFeeDirty = regFee !== initialRegValues.regFee;
    const isBankNumberDirty = bankNumber !== initialRegValues.bankNumber;
    const isBankNameDirty = bankName !== initialRegValues.bankName;
    const isAccountNameDirty = accountName !== initialRegValues.accountName;
    const isRegDirty = isRegFeeDirty || isBankNumberDirty || isBankNameDirty || isAccountNameDirty;

    const activeRegActionField: 'regFee' | 'bankNumber' | 'bankName' | 'accountName' | null = !isRegDirty
        ? null
        : lastModifiedField && (
            (lastModifiedField === 'regFee' && isRegFeeDirty) ||
            (lastModifiedField === 'bankNumber' && isBankNumberDirty) ||
            (lastModifiedField === 'bankName' && isBankNameDirty) ||
            (lastModifiedField === 'accountName' && isAccountNameDirty)
        )
            ? lastModifiedField
            : isAccountNameDirty ? 'accountName'
                : isBankNameDirty ? 'bankName'
                    : isBankNumberDirty ? 'bankNumber'
                        : isRegFeeDirty ? 'regFee'
                            : null;

    const handleResetReg = () => {
        setRegFee(initialRegValues.regFee);
        setBankNumber(initialRegValues.bankNumber);
        setBankName(initialRegValues.bankName);
        setAccountName(initialRegValues.accountName);
        setLastModifiedField(null);
    };

    const renderActionButtons = () => (
        <div className="flex items-center gap-2 pt-2 animate-in fade-in-50 duration-200">
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRegSaving}
                onClick={handleResetReg}
                className="text-xs h-7 px-2.5"
            >
                {locale === "th" ? "ยกเลิก" : "Cancel"}
            </Button>
            <Button
                type="submit"
                size="sm"
                disabled={isRegSaving}
                variant="default"
                className="text-xs h-7 px-2.5 font-semibold bg-violet-600 hover:bg-violet-700"
            >
                {isRegSaving && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                )}
                <span>{locale === "th" ? "บันทึก" : "Save"}</span>
            </Button>
        </div>
    );

    const loadSponsors = React.useCallback(async () => {
        setIsSponsorLoading(true);
        const res = await getSponsors(tournamentId);
        if (res.success && res.data) {
            setSponsorsList(res.data);
        }
        setIsSponsorLoading(false);
    }, [tournamentId]);

    useEffect(() => {
        if (selectedNode?.type === "sponsorNode" || activeNodeId === "sponsor-setting-node") {
            loadSponsors();
        }
    }, [selectedNode?.type, activeNodeId, loadSponsors]);

    // DnD handlers
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, hoverIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === hoverIndex) return;

        const list = [...sponsorsList];
        const draggedItem = list[draggedIndex];
        list.splice(draggedIndex, 1);
        list.splice(hoverIndex, 0, draggedItem);

        setDraggedIndex(hoverIndex);
        setSponsorsList(list);
    };

    const handleDragEnd = async () => {
        setDraggedIndex(null);
        const updates = sponsorsList.map((s, idx) => ({ id: s.id, order_index: idx }));
        const res = await updateSponsorsOrder(tournamentId, updates);
        if (res.success) {
            window.dispatchEvent(new Event("reload-sponsors"));
        } else {
            toast({
                title: "Error",
                description: res.error || "Failed to update sponsor order",
                variant: "destructive"
            });
            loadSponsors();
        }
    };

    const handleEditSponsorClick = (sponsor: Sponsor) => {
        setEditingSponsor(sponsor);
    };

    const handleDeleteSponsorClick = async (sponsorId: string) => {
        const res = await deleteSponsor(sponsorId, tournamentId);
        if (res.success) {
            toast({
                title: "Sponsor deleted",
                description: "The sponsor has been deleted successfully."
            });
            loadSponsors();
            window.dispatchEvent(new Event("reload-sponsors"));
        } else {
            toast({
                title: "Error",
                description: res.error || "Failed to delete sponsor",
                variant: "destructive"
            });
        }
    };

    useEffect(() => {
        if (activeCategoryId) {
            fetchTeams(activeCategoryId);
        }
    }, [activeCategoryId, fetchTeams]);


    const [dbMatches, setDbMatches] = React.useState<Match[]>([]);

    useEffect(() => {
        let isMounted = true;
        async function fetchScores() {
            if (selectedNode?.type !== "matchNode" || !tournamentId) return;
            try {
                const targetCatId = activeCategoryId || undefined;
                const endpoint = targetCatId
                    ? `/tournaments/${tournamentId}/categories/${targetCatId}/matches`
                    : `/tournaments/${tournamentId}/matches`;
                const results = await ApiClient.fetch<Match[]>(endpoint);
                if (isMounted && results) {
                    const isDirty = useBracketStore.getState().isDirty;
                    if (isDirty) {
                        const mergePreservingTeams = (prevList: Match[]) => {
                            if (prevList.length === 0) return results;
                            return results.map((incoming) => {
                                const local = prevList.find((p) => p.id === incoming.id);
                                if (!local) return incoming;
                                return {
                                    ...incoming,
                                    home_team_id: local.home_team_id,
                                    home_team: local.home_team,
                                    away_team_id: local.away_team_id,
                                    away_team: local.away_team,
                                    placeholder_a: local.placeholder_a,
                                    placeholder_b: local.placeholder_b,
                                    placeholder_home: local.placeholder_home,
                                    placeholder_away: local.placeholder_away,
                                };
                            });
                        };
                        setDbMatches((prev) => mergePreservingTeams(prev));
                        setStoreMatches((prev) => mergePreservingTeams(prev));
                    } else {
                        setDbMatches(results);
                        setStoreMatches(results);
                    }
                }
            } catch {
                // non-blocking
            }
        }

        fetchScores();
        const interval = setInterval(fetchScores, 3000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [selectedNode?.id, selectedNode?.type, tournamentId, activeCategoryId, setStoreMatches]);

    const nodeType = selectedNode?.type;

    const startNodeTutorial = useCallback(() => {
        if (!nodeType) return;
        const steps = [];

        // Label input step
        steps.push({
            element: "#node-settings-label-wrapper",
            popover: {
                title: locale === "th" ? "ชื่อโหนด (Label)" : "Node Label",
                description: locale === "th" ? "กำหนดชื่อที่แสดงของโหนดนี้บนบอร์ด เช่น รอบแบ่งกลุ่ม A, แมตช์ชิงชนะเลิศ" : "Set the display label for this node on the canvas.",
                side: "left" as const,
                align: "start" as const
            }
        });

        if (nodeType === "groupNode") {
            steps.push({
                element: "#node-settings-group-team-count",
                popover: {
                    title: locale === "th" ? "จำนวนทีมในกลุ่ม" : "Team Count",
                    description: locale === "th" ? "กำหนดจำนวนทีมที่จะอยู่ในกลุ่มนี้" : "Set the number of teams that will be in this group.",
                    side: "left" as const,
                    align: "start" as const
                }
            });
        } else if (nodeType === "standingNode") {
            steps.push({
                element: "#node-settings-standing-advancing",
                popover: {
                    title: locale === "th" ? "จำนวนทีมที่เข้ารอบ" : "Advancing Teams",
                    description: locale === "th" ? "กำหนดจำนวนทีมจากตารางคะแนนนี้ที่จะได้ผ่านเข้าไปเล่นในรอบถัดไป" : "Set the number of teams from this standings table that advance to the next stage.",
                    side: "left" as const,
                    align: "start" as const
                }
            });
            steps.push({
                element: "#node-settings-standing-columns",
                popover: {
                    title: locale === "th" ? "แสดงคอลัมน์ตารางคะแนน" : "Standings Columns",
                    description: locale === "th" ? "เลือกแสดงหรือซ่อนคอลัมน์สถิติต่างๆ ในตารางคะแนน เช่น จำนวนนัด, ชนะ/เสมอ/แพ้, ประตูได้เสีย, คะแนนสะสม" : "Choose which statistics columns to show or hide in the standings table.",
                    side: "left" as const,
                    align: "start" as const
                }
            });
        } else if (nodeType === "matchNode") {
            steps.push({
                element: "#node-settings-match-schedule",
                popover: {
                    title: locale === "th" ? "ตารางและผลการแข่งขัน" : "Match Schedule & Scoring",
                    description: locale === "th" ? "กรอกรายชื่อทีม ตั้งวัน/เวลาแข่งขัน หรือกดปุ่ม MATCH CONSOLE เพื่อเข้าไปกรอกคะแนนผลแพ้ชนะ" : "Configure team participants, match date/time, or click MATCH CONSOLE to record scores.",
                    side: "left" as const,
                    align: "start" as const
                }
            });
        } else if (nodeType === "sponsorNode") {
            steps.push({
                element: "#node-settings-sponsor-list",
                popover: {
                    title: locale === "th" ? "ผู้สนับสนุนการแข่งขัน" : "Sponsors List",
                    description: locale === "th" ? "อัปโหลดโลโก้ของผู้สนับสนุนและใส่ลิงก์เว็บไซต์ของแต่ละราย เพื่อนำไปแสดงผลประชาสัมพันธ์" : "Upload logo and link for sponsors to showcase them on public layouts.",
                    side: "left" as const,
                    align: "start" as const
                }
            });
        } else if (nodeType === "registrationNode") {
            steps.push({
                element: "#node-settings-reg-status",
                popover: {
                    title: locale === "th" ? "เปิดรับสมัครออนไลน์" : "Online Registration Toggle",
                    description: locale === "th" ? "สวิตช์เปิด/ปิดรับสมัครทีมใหม่เข้าทัวร์นาเมนต์รุ่นนี้แบบสาธารณะ" : "Toggle whether the public registration page is accepting teams.",
                    side: "left" as const,
                    align: "start" as const
                }
            });
            steps.push({
                element: "#node-settings-reg-fee",
                popover: {
                    title: locale === "th" ? "ค่าสมัครและช่องทางชำระเงิน" : "Registration Fee & Payment",
                    description: locale === "th" ? "กำหนดค่าสมัครแข่งขัน และกรอกข้อมูลธนาคาร/PromptPay เพื่อให้ทีมที่สมัครสามารถโอนจ่ายและอัปโหลดสลิปได้" : "Set registration fee and banking/PromptPay details for team payment slips.",
                    side: "left" as const,
                    align: "start" as const
                }
            });
        }

        const driverObj = driver({
            showProgress: true,
            animate: true,
            steps
        });
        driverObj.drive();
    }, [nodeType, locale]);

    useEffect(() => {
        if (!activeNodeId || !nodeType) return;
        const tourKey = `has_seen_node_tour_${nodeType}`;
        const hasSeen = localStorage.getItem(tourKey);
        if (!hasSeen) {
            const timer = setTimeout(() => {
                startNodeTutorial();
                localStorage.setItem(tourKey, "true");
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [activeNodeId, nodeType, startNodeTutorial]);

    if ((!selectedNode && activeNodeId !== "registration-setting-node" && activeNodeId !== "announcement-setting-node" && activeNodeId !== "sponsor-setting-node" && activeNodeId !== "ranking-setting-node") || !activeNodeId) {
        return null;
    }

    const isPseudoRegistration = activeNodeId === "registration-setting-node" && !selectedNode;
    const isPseudoAnnouncement = activeNodeId === "announcement-setting-node" && !selectedNode;
    const isPseudoSponsor = activeNodeId === "sponsor-setting-node" && !selectedNode;
    const isPseudoRanking = activeNodeId === "ranking-setting-node" && !selectedNode;
    const isPseudoNode = isPseudoRegistration || isPseudoAnnouncement || isPseudoSponsor || isPseudoRanking;
    const id = selectedNode?.id || (isPseudoAnnouncement ? "announcement-setting-node" : isPseudoSponsor ? "sponsor-setting-node" : isPseudoRanking ? "ranking-setting-node" : "registration-setting-node");
    const type = selectedNode?.type || (isPseudoAnnouncement ? "announcementNode" : isPseudoSponsor ? "sponsorNode" : isPseudoRanking ? "rankingNode" : "registrationNode");
    const data = selectedNode?.data || {
        label: isPseudoAnnouncement
            ? (locale === "th" ? "ประกาศ" : "Announcements")
            : isPseudoSponsor
                ? (locale === "th" ? "ผู้สนับสนุน" : "Sponsors")
                : isPseudoRanking
                    ? (locale === "th" ? "อันดับการแข่งขัน" : "Tournament Rankings")
                    : (locale === "th" ? "การจัดการทีม" : "Team Management")
    };

    return (
        <aside className={cn(
            "w-full md:w-[512px] absolute inset-0 md:relative md:inset-auto z-40 md:z-auto border-l bg-card flex flex-col shrink-0 animate-in slide-in-from-right h-full max-h-full min-h-0 overflow-hidden"
        )}>
            {/* ── Header based on type ── */}
            <div className="p-2 md:p-4 border-b flex items-center justify-between gap-2 md:gap-4 shrink-0 bg-card z-10">
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    <div className={`size-9 rounded-sm flex items-center justify-center shrink-0 ${type === 'groupNode' ? 'bg-node-5/10' :
                        type === 'matchNode' ? 'bg-node-2/10' :
                            type === 'drawNode' ? 'bg-node-4/10' :
                                type === 'sponsorNode' ? 'bg-red-500/10' :
                                    type === 'registrationNode' ? 'bg-violet-500/10' :
                                        type === 'rankingNode' ? 'bg-node-4/10' : 'bg-node-4/10'
                        }`}>
                        {type === 'groupNode' ? <LayoutGrid className="size-4 text-node-5" /> :
                            type === 'matchNode' ? <span className="text-sm font-bold text-node-2 select-none">VS</span> :
                                type === 'drawNode' ? <Dices className="size-4 text-node-4" /> :
                                    type === 'sponsorNode' ? <Heart className="size-4 text-red-500" /> :
                                        type === 'registrationNode' ? <Shield className="size-4 text-violet-500" /> :
                                            type === 'rankingNode' ? <Trophy className="size-4 text-node-4" /> :
                                                <Megaphone className="size-4 text-node-4" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <Header level={6} className="truncate">
                            {data.label as string}
                        </Header>
                        <p className="text-xs text-muted-foreground">
                            {type === 'rankingNode' ? (locale === 'th' ? "ตารางอันดับ" : "Standings") :
                                type === 'registrationNode' ? (locale === 'th' ? "การจัดการทีม" : "Team Management") :
                                    type === 'groupNode' ? (locale === 'th' ? "กลุ่มการแข่งขัน (ตารางคะแนน)" : "Group Stage (Standings)") :
                                        type === 'drawNode' ? (locale === 'th' ? "โหนดสุ่มจับสลากประกบคู่" : "Draw / Shuffle Node") :
                                            type?.replace('Node', '')}
                        </p>
                    </div>

                    <div className="flex items-center -ml-2 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={startNodeTutorial}
                            className="text-muted-foreground"
                            title={locale === "th" ? "สอนการใช้งาน" : "Help Tutorial"}
                        >
                            <HelpCircle className="size-4 text-muted-foreground" />
                        </Button>
                        {(isRegistrationMode || type === "registrationNode") && !isLocked && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => setIsAddDialogOpen(true)}
                                className="bg-violet-500 hover:bg-violet-500/90"
                            >
                                <Plus className="size-4" />
                                {locale === "th" ? "เพิ่มทีมใหม่" : "Add New Team"}
                            </Button>
                        )}
                        {!isRegistrationMode && !isPseudoNode && !isLocked && (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => deleteNode(id)}
                                className="text-muted-foreground hover:text-destructive"
                                title={locale === "th" ? "ลบโหนด" : "Delete node"}
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        )}

                        {type === "announcementNode" && !isLocked && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => setIsAddAnnouncementOpen(true)}
                                className="bg-node-4 text-background hover:bg-node-4/90"
                            >
                                <Plus className="size-4" />
                                {locale === "th" ? "เพิ่มประกาศใหม่" : "New Announcement"}
                            </Button>
                        )}
                        {type === "sponsorNode" && !isLocked && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => setIsAddSponsorOpen(true)}
                                className="bg-red-500 hover:bg-red-600"
                            >
                                <Plus className="size-4" />
                                {locale === "th" ? "เพิ่มผู้สนับสนุนใหม่" : "New Sponsor"}
                            </Button>
                        )}
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                        setActiveNodeId(null);
                        selectNode(null);
                        if (onClose) {
                            onClose();
                        } else if (typeof window !== "undefined") {
                            const url = new URL(window.location.href);
                            if (url.searchParams.has("tab") || url.searchParams.has("subtab")) {
                                url.searchParams.delete("tab");
                                url.searchParams.delete("subtab");
                                window.history.replaceState({}, "", url.toString());
                            }
                        }
                    }}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    title={locale === "th" ? "ปิด" : "Close"}
                >
                    <X className="size-4" />
                </Button>
            </div>

            {type === "rankingNode" ? (
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    <RankingNodeSettings
                        tournamentId={tournamentId}
                        categoryId={activeCategoryId || undefined}
                        currentTournamentStatus={currentTournamentStatus}
                        onStatusChange={onStatusChange}
                    />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto min-h-0 p-2 md:p-4 space-y-4 md:space-y-4 custom-scrollbar">

                    {/* ── Common Settings ── */}
                    <div className="space-y-4">
                        {!isPseudoNode && (
                            <div className="space-y-1" id="node-settings-label-wrapper">
                                <Label>
                                    {locale === "th" ? "ชื่อหัวข้อ" : "Label"}
                                </Label>
                                <Input
                                    size="sm"
                                    value={data.label as string}
                                    onChange={(e) => updateNodeData(id, { label: e.target.value })}
                                    placeholder={locale === "th" ? "สาย A, รอบ 8 ทีมสุดท้าย, ผู้สนับสนุน..." : "Group A, Quarter Finals, Sponsors..."}
                                />
                            </div>
                        )}

                        {/* ── Type Specific Settings ── */}
                        {type === "groupNode" && (() => {
                            const sport = useBracketStore.getState().sport || (selectedNode?.data?.sport as string) || 'football';
                            const isVolleyball = sport === 'volleyball';
                            const advancingCount = Number(data.advancingCount !== undefined ? data.advancingCount : 2);
                            const currentTeamCount = Math.max(0, Number(data.teamCount) || (Array.isArray(data.teams) ? data.teams.length : 0));
                            const currentTeams = Array.isArray(data.teams) ? data.teams : [];

                            const handleSetTeamCount = (nextCount: number) => {
                                const count = Math.max(0, Math.min(64, nextCount));
                                const updated = [...currentTeams];
                                while (updated.length < count) {
                                    updated.push("TBD");
                                }
                                if (updated.length > count) {
                                    updated.length = count;
                                }
                                updateNodeData(id, { teamCount: count, teams: updated });
                            };

                            const handleSlotChange = (index: number, teamName: string) => {
                                const updated = [...currentTeams];
                                while (updated.length <= index) {
                                    updated.push("TBD");
                                }
                                updated[index] = teamName;
                                updateNodeData(id, { teams: updated });
                            };

                            const handleRemoveSlot = (index: number) => {
                                const updated = [...currentTeams];
                                updated.splice(index, 1);
                                updateNodeData(id, {
                                    teamCount: Math.max(0, currentTeamCount - 1),
                                    teams: updated,
                                });
                            };

                            const defaultTieBreak = isVolleyball ? DEFAULT_VOLLEYBALL_TIE_BREAK : DEFAULT_FOOTBALL_TIE_BREAK;
                            const currentTieBreakOrder: TieBreakCriterionKey[] = (() => {
                                const raw = (data.tieBreakOrder as TieBreakCriterionKey[]) || [];
                                const validKeys = defaultTieBreak;
                                const filtered = raw.filter((k) => validKeys.includes(k));
                                const missing = validKeys.filter((k) => !filtered.includes(k));
                                return [...filtered, ...missing];
                            })();

                            const handleTieBreakDragStart = (e: React.DragEvent, index: number) => {
                                setDraggedTieBreakIndex(index);
                                e.dataTransfer.effectAllowed = "move";
                            };

                            const handleTieBreakDragOver = (e: React.DragEvent, hoverIndex: number) => {
                                e.preventDefault();
                                if (draggedTieBreakIndex === null || draggedTieBreakIndex === hoverIndex) return;

                                const list = [...currentTieBreakOrder];
                                const draggedItem = list[draggedTieBreakIndex];
                                list.splice(draggedTieBreakIndex, 1);
                                list.splice(hoverIndex, 0, draggedItem);

                                setDraggedTieBreakIndex(hoverIndex);
                                updateNodeData(id, { tieBreakOrder: list });
                                useBracketStore.setState({ isDirty: true });
                            };

                            const handleTieBreakDragEnd = () => {
                                setDraggedTieBreakIndex(null);
                            };

                            const handleResetTieBreak = () => {
                                updateNodeData(id, { tieBreakOrder: defaultTieBreak });
                                useBracketStore.setState({ isDirty: true });
                            };

                            const getInitials = (n: string) => {
                                const parts = n.trim().split(/\s+/);
                                if (parts.length > 1 && parts[0] && parts[1]) {
                                    return (parts[0][0] + parts[1][0]).toUpperCase();
                                }
                                return n.slice(0, 2).toUpperCase();
                            };

                            const findTeamObj = (name?: string | null) => {
                                if (!name || name === "TBD") return null;
                                const lower = name.trim().toLowerCase();
                                for (const item of storeTeams) {
                                    const t = item as any;
                                    const tName = t.team?.name || t.name;
                                    if (tName && tName.trim().toLowerCase() === lower) {
                                        const logoUrl = t.team?.logo_img || t.team?.logo_url || t.logo_img || t.logo_url || null;
                                        return {
                                            id: String(t.team?.id || t.team_id || t.id || tName),
                                            name: tName,
                                            logoUrl,
                                        };
                                    }
                                }
                                return null;
                            };

                            const allMatches = storeMatches.length > 0 ? storeMatches : dbMatches;

                            // Calculate Full Standings for this group
                            const groupStandings = (() => {
                                const statsMap: Record<string, {
                                    name: string;
                                    originalIndex: number;
                                    mp: number;
                                    w: number;
                                    d: number;
                                    l: number;
                                    gf: number;
                                    ga: number;
                                    gd: number;
                                    sw: number;
                                    sl: number;
                                    sd: number;
                                    pts: number;
                                }> = {};

                                currentTeams.forEach((teamName, idx) => {
                                    const key = teamName === "TBD" ? `TBD-${idx}` : teamName;
                                    statsMap[key] = {
                                        name: teamName,
                                        originalIndex: idx,
                                        mp: 0,
                                        w: 0,
                                        d: 0,
                                        l: 0,
                                        gf: 0,
                                        ga: 0,
                                        gd: 0,
                                        sw: 0,
                                        sl: 0,
                                        sd: 0,
                                        pts: 0,
                                    };
                                });

                                const findStats = (rawName?: string | null) => {
                                    if (!rawName) return undefined;
                                    const trimmed = rawName.trim();
                                    if (statsMap[trimmed]) return statsMap[trimmed];
                                    const lower = trimmed.toLowerCase();
                                    for (const key of Object.keys(statsMap)) {
                                        if (key.trim().toLowerCase() === lower) {
                                            return statsMap[key];
                                        }
                                    }
                                    return undefined;
                                };

                                let totalMatchesPlayed = 0;

                                allMatches.forEach((m: any) => {
                                    const homeName = m.home_team?.name || m.placeholder_home || m.placeholder_a || m.placeholderA;
                                    const awayName = m.away_team?.name || m.placeholder_away || m.placeholder_b || m.placeholderB;
                                    if (!homeName || !awayName) return;

                                    const h = findStats(homeName);
                                    const a = findStats(awayName);
                                    if (!h || !a) return;

                                    const isPlayed = ['finished', 'completed', 'live', 'first_half', 'second_half', 'half_time', 'extra_time', 'penalties'].includes(m.status);
                                    if (isPlayed) {
                                        totalMatchesPlayed++;
                                        if (isVolleyball) {
                                            const hSets = typeof m.home_score === "object" && m.home_score !== null && "sets" in m.home_score
                                                ? Number((m.home_score as { sets?: number }).sets) || 0
                                                : Number(m.home_score) || 0;
                                            const aSets = typeof m.away_score === "object" && m.away_score !== null && "sets" in m.away_score
                                                ? Number((m.away_score as { sets?: number }).sets) || 0
                                                : Number(m.away_score) || 0;

                                            h.mp++;
                                            a.mp++;
                                            h.sw += hSets;
                                            h.sl += aSets;
                                            a.sw += aSets;
                                            a.sl += hSets;

                                            if (hSets > aSets) {
                                                h.w++;
                                                a.l++;
                                                if (hSets === 3 && (aSets === 0 || aSets === 1)) {
                                                    h.pts += 3;
                                                } else if (hSets === 3 && aSets === 2) {
                                                    h.pts += 2;
                                                    a.pts += 1;
                                                } else {
                                                    h.pts += 3;
                                                }
                                            } else if (aSets > hSets) {
                                                a.w++;
                                                h.l++;
                                                if (aSets === 3 && (hSets === 0 || hSets === 1)) {
                                                    a.pts += 3;
                                                } else if (aSets === 3 && hSets === 2) {
                                                    a.pts += 2;
                                                    h.pts += 1;
                                                } else {
                                                    a.pts += 3;
                                                }
                                            }
                                        } else {
                                            // Football
                                            const hScore = typeof m.home_score === "object" && m.home_score !== null && "total" in m.home_score
                                                ? Number((m.home_score as { total?: number }).total) || 0
                                                : Number(m.home_score) || 0;
                                            const aScore = typeof m.away_score === "object" && m.away_score !== null && "total" in m.away_score
                                                ? Number((m.away_score as { total?: number }).total) || 0
                                                : Number(m.away_score) || 0;

                                            h.mp++;
                                            a.mp++;
                                            h.gf += hScore;
                                            h.ga += aScore;
                                            a.gf += aScore;
                                            a.ga += hScore;

                                            if (hScore > aScore) {
                                                h.w++;
                                                h.pts += 3;
                                                a.l++;
                                            } else if (hScore < aScore) {
                                                a.w++;
                                                a.pts += 3;
                                                h.l++;
                                            } else {
                                                h.d++;
                                                h.pts += 1;
                                                a.d++;
                                                a.pts += 1;
                                            }
                                        }
                                    }
                                });

                                const list = Object.values(statsMap).map((s) => ({
                                    ...s,
                                    gd: s.gf - s.ga,
                                    sd: s.sw - s.sl,
                                }));

                                if (totalMatchesPlayed > 0) {
                                    return sortStandingsByTieBreak(
                                        list,
                                        data.tieBreakOrder as string[] | undefined,
                                        allMatches,
                                        isVolleyball,
                                        data.manualDrawOrder as Record<string, number> | undefined
                                    );
                                }

                                return list;
                            })();

                            const tiedGroupsMap = getTiedTeamGroups(
                                groupStandings,
                                data.tieBreakOrder as string[] | undefined,
                                allMatches,
                                isVolleyball
                            );
                            const hasTiedTeams = tiedGroupsMap.size > 0;

                            const handleTiedTeamDragStart = (e: React.DragEvent, teamName: string, groupId: string) => {
                                setDraggedTiedTeam({ name: teamName, groupId });
                                e.dataTransfer.effectAllowed = "move";
                            };

                            const handleTiedTeamDragOver = (e: React.DragEvent, teamName: string, groupId: string) => {
                                if (!draggedTiedTeam || draggedTiedTeam.groupId !== groupId || draggedTiedTeam.name === teamName) return;
                                e.preventDefault();
                                setDragOverTiedTeam(teamName);
                            };

                            const handleTiedTeamDrop = (e: React.DragEvent, targetTeamName: string, groupId: string) => {
                                e.preventDefault();
                                if (!draggedTiedTeam || draggedTiedTeam.groupId !== groupId || draggedTiedTeam.name === targetTeamName) {
                                    setDraggedTiedTeam(null);
                                    setDragOverTiedTeam(null);
                                    return;
                                }

                                const tiedTeamsInOrder = groupStandings
                                    .filter((row) => tiedGroupsMap.get(row.name) === groupId)
                                    .map((row) => row.name);

                                const fromIdx = tiedTeamsInOrder.indexOf(draggedTiedTeam.name);
                                const toIdx = tiedTeamsInOrder.indexOf(targetTeamName);

                                if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
                                    tiedTeamsInOrder.splice(fromIdx, 1);
                                    tiedTeamsInOrder.splice(toIdx, 0, draggedTiedTeam.name);

                                    const newManualDrawOrder: Record<string, number> = {
                                        ...(data.manualDrawOrder as Record<string, number> || {})
                                    };
                                    tiedTeamsInOrder.forEach((tName, rank) => {
                                        newManualDrawOrder[tName] = rank;
                                    });

                                    updateNodeData(id, { manualDrawOrder: newManualDrawOrder });
                                    useBracketStore.setState({ isDirty: true });
                                }

                                setDraggedTiedTeam(null);
                                setDragOverTiedTeam(null);
                            };

                            const handleTiedTeamDragEnd = () => {
                                setDraggedTiedTeam(null);
                                setDragOverTiedTeam(null);
                            };

                            const showPlayed = data.showPlayed !== false;
                            const showWin = data.showWin !== false;
                            const showDraw = !isVolleyball && data.showDraw !== false;
                            const showLoss = data.showLoss !== false;
                            const showGF = !isVolleyball && data.showGF !== false;
                            const showGA = !isVolleyball && data.showGA !== false;
                            const showGD = !isVolleyball && data.showGD !== false;
                            const showSW = isVolleyball && data.showSW !== false;
                            const showSL = isVolleyball && data.showSL !== false;
                            const showSD = isVolleyball && data.showSD !== false;
                            const showPts = data.showPts !== false;

                            const columnOptions = isVolleyball ? [
                                { key: "showPlayed", code: "MP", label: locale === "th" ? "แข่ง" : "Played", checked: showPlayed },
                                { key: "showWin", code: "W", label: locale === "th" ? "ชนะ" : "Won", checked: showWin },
                                { key: "showLoss", code: "L", label: locale === "th" ? "แพ้" : "Lost", checked: showLoss },
                                { key: "showSW", code: "SW", label: locale === "th" ? "เซ็ตได้" : "Sets Won", checked: showSW },
                                { key: "showSL", code: "SL", label: locale === "th" ? "เซ็ตเสีย" : "Sets Lost", checked: showSL },
                                { key: "showSD", code: "SD", label: locale === "th" ? "ต่างเซ็ต" : "Set Diff", checked: showSD },
                                { key: "showPts", code: "PTS", label: locale === "th" ? "คะแนน" : "Points", checked: showPts },
                            ] : [
                                { key: "showPlayed", code: "MP", label: locale === "th" ? "แข่ง" : "Played", checked: showPlayed },
                                { key: "showWin", code: "W", label: locale === "th" ? "ชนะ" : "Won", checked: showWin },
                                { key: "showDraw", code: "D", label: locale === "th" ? "เสมอ" : "Drawn", checked: showDraw },
                                { key: "showLoss", code: "L", label: locale === "th" ? "แพ้" : "Lost", checked: showLoss },
                                { key: "showGF", code: "GF", label: locale === "th" ? "ประตูได้" : "Goals For", checked: showGF },
                                { key: "showGA", code: "GA", label: locale === "th" ? "ประตูเสีย" : "Goals Against", checked: showGA },
                                { key: "showGD", code: "GD", label: locale === "th" ? "ผลต่าง" : "Goal Diff", checked: showGD },
                                { key: "showPts", code: "PTS", label: locale === "th" ? "คะแนน" : "Points", checked: showPts },
                            ];

                            const handleToggleAll = (enableAll: boolean) => {
                                if (isVolleyball) {
                                    updateNodeData(id, {
                                        showPlayed: enableAll,
                                        showWin: enableAll,
                                        showLoss: enableAll,
                                        showSW: enableAll,
                                        showSL: enableAll,
                                        showSD: enableAll,
                                        showPts: enableAll,
                                    });
                                } else {
                                    updateNodeData(id, {
                                        showPlayed: enableAll,
                                        showWin: enableAll,
                                        showDraw: enableAll,
                                        showLoss: enableAll,
                                        showGF: enableAll,
                                        showGA: enableAll,
                                        showGD: enableAll,
                                        showPts: enableAll,
                                    });
                                }
                                useBracketStore.setState({ isDirty: true });
                            };

                            const handleResetDefault = () => {
                                if (isVolleyball) {
                                    updateNodeData(id, {
                                        showPlayed: true,
                                        showWin: true,
                                        showLoss: true,
                                        showSW: true,
                                        showSL: true,
                                        showSD: true,
                                        showPts: true,
                                    });
                                } else {
                                    updateNodeData(id, {
                                        showPlayed: true,
                                        showWin: true,
                                        showDraw: true,
                                        showLoss: true,
                                        showGF: true,
                                        showGA: true,
                                        showGD: true,
                                        showPts: true,
                                    });
                                }
                                useBracketStore.setState({ isDirty: true });
                            };

                            return (
                                <div className="space-y-4">
                                    {/* Team Count & Advancing Teams on the same line */}
                                    <div className="grid grid-cols-2 gap-3 items-start">
                                        {/* Team Count */}
                                        <div className="space-y-1.5" id="node-settings-group-team-count">
                                            <Label className="text-xs font-bold">{locale === "th" ? "จำนวนทีมในกลุ่ม" : "Team Count"}</Label>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon-sm"
                                                    onClick={() => handleSetTeamCount(currentTeamCount - 1)}
                                                    disabled={isLocked || currentTeamCount <= 0}
                                                >
                                                    <Minus className="size-4" />
                                                </Button>
                                                <Input
                                                    size="sm"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={String(currentTeamCount)}
                                                    disabled={isLocked}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^0-9]/g, "");
                                                        const num = parseInt(val, 10) || 0;
                                                        handleSetTeamCount(num);
                                                    }}
                                                    className="text-center font-bold"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon-sm"
                                                    onClick={() => handleSetTeamCount(currentTeamCount + 1)}
                                                    disabled={isLocked || currentTeamCount >= 64}
                                                >
                                                    <Plus className="size-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Advancing Teams */}
                                        <div className="space-y-1.5" id="node-settings-standing-advancing">
                                            <Label className="text-xs font-bold">{locale === "th" ? "จำนวนทีมที่เข้ารอบ" : "Advancing Teams"}</Label>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon-sm"
                                                    onClick={() => {
                                                        const current = Number(data.advancingCount) || 0;
                                                        const nextVal = Math.max(0, current - 1);
                                                        updateNodeData(id, { advancingCount: nextVal });
                                                    }}
                                                    disabled={isLocked || (Number(data.advancingCount) || 0) <= 0}
                                                >
                                                    <Minus className="size-4" />
                                                </Button>
                                                <Input
                                                    size="sm"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={data.advancingCount !== undefined && data.advancingCount !== null ? String(data.advancingCount) : "0"}
                                                    disabled={isLocked}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^0-9]/g, "");
                                                        const num = parseInt(val, 10) || 0;
                                                        updateNodeData(id, { advancingCount: Math.min(16, num) });
                                                    }}
                                                    className="text-center font-bold"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon-sm"
                                                    onClick={() => {
                                                        const current = Number(data.advancingCount) || 0;
                                                        const nextVal = Math.min(16, current + 1);
                                                        updateNodeData(id, { advancingCount: nextVal });
                                                    }}
                                                    disabled={isLocked || (Number(data.advancingCount) || 0) >= 16}
                                                >
                                                    <Plus className="size-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Full Standings Table */}
                                    <div className="space-y-1" id="node-settings-group-roster">
                                        <div className="flex items-center justify-between">
                                            <Header level={5}>
                                                {locale === "th" ? "รายชื่อทีมและตารางคะแนนในกลุ่ม" : "Group Standings & Teams"}
                                            </Header>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleSetTeamCount(currentTeamCount + 1)}
                                                className="h-8 text-xs text-muted-foreground"
                                            >
                                                <Plus className="size-4" />
                                                {locale === "th" ? "เพิ่มทีม" : "Add Team"}
                                            </Button>
                                        </div>

                                        {hasTiedTeams && (
                                            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-sm bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-xs">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <Dices className="size-3.5 shrink-0 text-amber-500" />
                                                    <span className="truncate text-[11px] font-medium">
                                                        {locale === "th"
                                                            ? "มีทีมที่สถิติเท่ากันในเกณฑ์จับสลาก — ลากสลับตำแหน่งเฉพาะแถวทีมที่เสมอกันเพื่อบันทึกผลจับสลาก"
                                                            : "Teams tied on all criteria — Drag & drop tied rows in table to record draw results"}
                                                    </span>
                                                </div>
                                                {Boolean(data.manualDrawOrder && Object.keys(data.manualDrawOrder as Record<string, number>).length > 0) && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            updateNodeData(id, { manualDrawOrder: undefined });
                                                            useBracketStore.setState({ isDirty: true });
                                                        }}
                                                        className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                                                        title={locale === "th" ? "คืนค่าลำดับตามผังเดิม" : "Reset to initial bracket slot order"}
                                                    >
                                                        <RotateCcw className="size-2.5 mr-1" />
                                                        {locale === "th" ? "รีเซ็ต" : "Reset"}
                                                    </Button>
                                                )}
                                            </div>
                                        )}

                                        <div className="border bg-card rounded-sm overflow-hidden">
                                            {currentTeamCount === 0 ? (
                                                <div className="p-4 text-center text-xs text-muted-foreground">
                                                    {locale === "th" ? "ยังไม่มีทีมในกลุ่ม" : "No teams in group"}
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-[11px] border-collapse whitespace-nowrap">
                                                        <thead>
                                                            <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground">
                                                                <th className="px-1.5 py-1.5 text-center w-11">#</th>
                                                                <th className="px-2 py-1.5 text-left min-w-[140px]">{locale === "th" ? "ทีม" : "TEAM"}</th>
                                                                {showPlayed && <th className="px-1 py-1.5 text-center w-6">MP</th>}
                                                                {showWin && <th className="px-1 py-1.5 text-center w-6">W</th>}
                                                                {showDraw && <th className="px-1 py-1.5 text-center w-6">D</th>}
                                                                {showLoss && <th className="px-1 py-1.5 text-center w-6">L</th>}
                                                                {showGF && <th className="px-1 py-1.5 text-center w-6">GF</th>}
                                                                {showGA && <th className="px-1 py-1.5 text-center w-6">GA</th>}
                                                                {showGD && <th className="px-1 py-1.5 text-center w-6">GD</th>}
                                                                {showSW && <th className="px-1 py-1.5 text-center w-6">SW</th>}
                                                                {showSL && <th className="px-1 py-1.5 text-center w-6">SL</th>}
                                                                {showSD && <th className="px-1 py-1.5 text-center w-6">SD</th>}
                                                                {showPts && <th className="px-2 py-1.5 text-center font-black text-foreground w-8">PTS</th>}
                                                                <th className="px-1 py-1.5 text-center w-8"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border">
                                                            {groupStandings.map((row, rankIdx) => {
                                                                const isPromoted = rankIdx < advancingCount;
                                                                const origIdx = row.originalIndex;
                                                                const isTbd = !row.name || row.name === "TBD";
                                                                const tiedGroupId = tiedGroupsMap.get(row.name);
                                                                const isTiedTeam = Boolean(tiedGroupId && !isTbd);
                                                                const isDragging = draggedTiedTeam?.name === row.name;
                                                                const isDragOver = dragOverTiedTeam === row.name && draggedTiedTeam?.groupId === tiedGroupId;
                                                                const teamObj = findTeamObj(row.name);
                                                                const approvedStoreTeams = storeTeams.filter((t) => isTeamApproved(t));
                                                                const isStoreTeam = approvedStoreTeams.some((t) => {
                                                                    const tName = (t as any).team?.name || t.name;
                                                                    return tName && tName.trim().toLowerCase() === row.name?.trim().toLowerCase();
                                                                });
                                                                const isCustomCurrentTeam = !isTbd && !isStoreTeam;

                                                                const otherCustomTeams = currentTeams.filter((name) =>
                                                                    name &&
                                                                    name !== "TBD" &&
                                                                    name !== row.name &&
                                                                    !approvedStoreTeams.some((t) => ((t as any).team?.name || t.name)?.trim().toLowerCase() === name.trim().toLowerCase())
                                                                );
                                                                const uniqueOtherCustom = Array.from(new Set(otherCustomTeams));

                                                                return (
                                                                    <tr
                                                                        key={origIdx}
                                                                        draggable={isTiedTeam}
                                                                        onDragStart={(e) => {
                                                                            if (isTiedTeam && tiedGroupId) {
                                                                                handleTiedTeamDragStart(e, row.name, tiedGroupId);
                                                                            }
                                                                        }}
                                                                        onDragOver={(e) => {
                                                                            if (isTiedTeam && tiedGroupId) {
                                                                                handleTiedTeamDragOver(e, row.name, tiedGroupId);
                                                                            }
                                                                        }}
                                                                        onDrop={(e) => {
                                                                            if (isTiedTeam && tiedGroupId) {
                                                                                handleTiedTeamDrop(e, row.name, tiedGroupId);
                                                                            }
                                                                        }}
                                                                        onDragEnd={handleTiedTeamDragEnd}
                                                                        className={cn(
                                                                            "hover:bg-muted/30 transition-colors",
                                                                            isPromoted && "bg-node-5/10",
                                                                            isTiedTeam && "transition-all",
                                                                            isDragging && "opacity-40 bg-amber-500/10",
                                                                            isDragOver && "bg-amber-500/20 border-y-2 border-amber-500"
                                                                        )}
                                                                    >
                                                                        <td className="px-1.5 py-1.5 text-center font-bold">
                                                                            <div className="flex items-center justify-center gap-1">
                                                                                <div
                                                                                    className={cn(
                                                                                        "p-0.5 rounded transition-all select-none shrink-0",
                                                                                        isTiedTeam
                                                                                            ? "cursor-grab active:cursor-grabbing text-amber-500 hover:text-amber-400 hover:bg-amber-500/15 opacity-100"
                                                                                            : "cursor-not-allowed text-muted-foreground/30 opacity-30 hover:opacity-50"
                                                                                    )}
                                                                                    title={
                                                                                        isTiedTeam
                                                                                            ? (locale === "th" ? "สถิติเท่ากันทั้งหมด - ลากเพื่อสลับผลจับสลาก" : "Tied on all criteria - Drag to reorder draw result")
                                                                                            : (locale === "th" ? "สามารถลากสลับอันดับได้เมื่อทีมมีสถิติเท่ากันในเกณฑ์จับสลาก" : "Draggable only when teams are tied on all criteria for a draw")
                                                                                    }
                                                                                >
                                                                                    <GripVertical className="size-4" />
                                                                                </div>
                                                                                <span className={cn(
                                                                                    "inline-flex items-center justify-center size-5 rounded-full text-[10px]",
                                                                                    isPromoted ? "bg-node-5/20 text-node-5 font-black" : "text-muted-foreground",
                                                                                    isTiedTeam && "ring-1 ring-amber-500/60 text-amber-500 font-bold"
                                                                                )}>
                                                                                    {rankIdx + 1}
                                                                                </span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-2 py-1.5">
                                                                            <div className="flex items-center min-w-[140px]">
                                                                                <Select
                                                                                    value={row.name || "TBD"}
                                                                                    onValueChange={(val) => {
                                                                                        if (val === "__custom__") {
                                                                                            const currentVal = isCustomCurrentTeam ? (row.name || "") : "";
                                                                                            setCustomTeamDialog({
                                                                                                nodeId: id,
                                                                                                slotIndex: origIdx,
                                                                                                initialName: currentVal,
                                                                                            });
                                                                                            setCustomTeamInput(currentVal);
                                                                                            return;
                                                                                        }
                                                                                        handleSlotChange(origIdx, val);
                                                                                    }}
                                                                                >
                                                                                    <SelectTrigger
                                                                                        size="sm"
                                                                                        className="h-7 px-1.5 py-0.5 border-0 border-transparent bg-transparent bg-none focus:bg-none shadow-none hover:bg-muted/60 focus:bg-muted/60 focus:ring-0 flex items-center justify-between gap-1.5 cursor-pointer w-full text-left rounded-sm group/team transition-colors [&>svg:last-child]:size-4 [&>svg:last-child]:text-muted-foreground [&>svg:last-child]:opacity-0 group-hover/team:[&>svg:last-child]:opacity-70 group-focus/team:[&>svg:last-child]:opacity-70"
                                                                                    >
                                                                                        <span className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                                            <span className="size-5 rounded-full border border-border/60 bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                                                                                                {teamObj?.logoUrl ? (
                                                                                                    <Image
                                                                                                        src={teamObj.logoUrl}
                                                                                                        alt={row.name || "Team"}
                                                                                                        width={20}
                                                                                                        height={20}
                                                                                                        className="w-full h-full object-cover"
                                                                                                    />
                                                                                                ) : !isTbd ? (
                                                                                                    <span className="text-[9px] font-black text-muted-foreground group-hover/team:text-node-5">
                                                                                                        {getInitials(row.name)}
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <Shield className="size-3 text-muted-foreground/50" />
                                                                                                )}
                                                                                            </span>
                                                                                            <span
                                                                                                className={cn(
                                                                                                    "text-xs truncate font-semibold transition-colors",
                                                                                                    isTbd ? "text-muted-foreground italic font-normal" : "text-foreground group-hover/team:underline"
                                                                                                )}
                                                                                            >
                                                                                                {row.name || "TBD"}
                                                                                            </span>
                                                                                        </span>
                                                                                    </SelectTrigger>
                                                                                    <SelectContent position="popper" align="start" className="min-w-[190px] max-h-60">
                                                                                        <SelectItem value="TBD">
                                                                                            <span className="flex items-center gap-2">
                                                                                                <span className="size-5 rounded-full border border-border/60 bg-muted/50 flex items-center justify-center shrink-0">
                                                                                                    <Shield className="size-3 text-muted-foreground/50" />
                                                                                                </span>
                                                                                                <span className="text-muted-foreground italic text-xs">TBD</span>
                                                                                            </span>
                                                                                        </SelectItem>
                                                                                        {approvedStoreTeams.map((t) => {
                                                                                            const tName = (t as any).team?.name || t.name;
                                                                                            if (!tName) return null;
                                                                                            const tLogo = (t as any).team?.logo_img || (t as any).team?.logo_url || (t as any).logo_img || t.logo_url || null;
                                                                                            return (
                                                                                                <SelectItem key={String(t.id || (t as any).team_id || tName)} value={tName}>
                                                                                                    <span className="flex items-center gap-2 min-w-0">
                                                                                                        <span className="size-5 rounded-full border border-border/60 bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                                                                                                            {tLogo ? (
                                                                                                                <Image
                                                                                                                    src={tLogo}
                                                                                                                    alt={tName}
                                                                                                                    width={20}
                                                                                                                    height={20}
                                                                                                                    className="w-full h-full object-cover"
                                                                                                                />
                                                                                                            ) : (
                                                                                                                <span className="text-[9px] font-black text-muted-foreground">
                                                                                                                    {getInitials(tName)}
                                                                                                                </span>
                                                                                                            )}
                                                                                                        </span>
                                                                                                        <span className="text-xs font-medium truncate">{tName}</span>
                                                                                                    </span>
                                                                                                </SelectItem>
                                                                                            );
                                                                                        })}
                                                                                        {uniqueOtherCustom.map((cName) => (
                                                                                            <SelectItem key={`custom-${cName}`} value={cName}>
                                                                                                <span className="flex items-center gap-2 min-w-0">
                                                                                                    <span className="size-5 rounded-full border border-node-5/40 bg-node-5/10 text-node-5 flex items-center justify-center font-black text-[9px] shrink-0">
                                                                                                        {getInitials(cName)}
                                                                                                    </span>
                                                                                                    <span className="text-xs font-medium truncate">{cName}</span>
                                                                                                </span>
                                                                                            </SelectItem>
                                                                                        ))}
                                                                                        {isCustomCurrentTeam && !uniqueOtherCustom.includes(row.name) && (
                                                                                            <SelectItem value={row.name}>
                                                                                                <span className="flex items-center gap-2 min-w-0">
                                                                                                    <span className="size-5 rounded-full border border-node-5/40 bg-node-5/10 text-node-5 flex items-center justify-center font-black text-[9px] shrink-0">
                                                                                                        {getInitials(row.name)}
                                                                                                    </span>
                                                                                                    <span className="text-xs font-semibold truncate text-foreground">{row.name}</span>
                                                                                                </span>
                                                                                            </SelectItem>
                                                                                        )}
                                                                                        <SelectSeparator />
                                                                                        <SelectItem value="__custom__" className="text-primary focus:text-primary font-medium cursor-pointer">
                                                                                            <span className="flex items-center gap-2 min-w-0">
                                                                                                <span className="size-5 rounded-full border border-dashed border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
                                                                                                    <Pencil className="size-2.5 text-primary" />
                                                                                                </span>
                                                                                                <span className="text-xs truncate">
                                                                                                    {locale === "th" ? "อื่นๆ (ระบุชื่อเอง)..." : "Other (Specify name)..."}
                                                                                                </span>
                                                                                            </span>
                                                                                        </SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                        </td>
                                                                        {showPlayed && <td className="px-1 py-1.5 text-center text-muted-foreground">{row.mp}</td>}
                                                                        {showWin && <td className="px-1 py-1.5 text-center text-muted-foreground">{row.w}</td>}
                                                                        {showDraw && <td className="px-1 py-1.5 text-center text-muted-foreground">{row.d}</td>}
                                                                        {showLoss && <td className="px-1 py-1.5 text-center text-muted-foreground">{row.l}</td>}
                                                                        {showGF && <td className="px-1 py-1.5 text-center text-muted-foreground">{row.gf}</td>}
                                                                        {showGA && <td className="px-1 py-1.5 text-center text-muted-foreground">{row.ga}</td>}
                                                                        {showGD && (
                                                                            <td className={cn(
                                                                                "px-1 py-1.5 text-center font-medium",
                                                                                row.gd > 0 ? "text-emerald-500" : row.gd < 0 ? "text-destructive" : "text-muted-foreground"
                                                                            )}>
                                                                                {row.gd > 0 ? `+${row.gd}` : row.gd}
                                                                            </td>
                                                                        )}
                                                                        {showSW && <td className="px-1 py-1.5 text-center text-muted-foreground">{row.sw}</td>}
                                                                        {showSL && <td className="px-1 py-1.5 text-center text-muted-foreground">{row.sl}</td>}
                                                                        {showSD && (
                                                                            <td className={cn(
                                                                                "px-1 py-1.5 text-center font-medium",
                                                                                row.sd > 0 ? "text-emerald-500" : row.sd < 0 ? "text-destructive" : "text-muted-foreground"
                                                                            )}>
                                                                                {row.sd > 0 ? `+${row.sd}` : row.sd}
                                                                            </td>
                                                                        )}
                                                                        {showPts && <td className="px-2 py-1.5 text-center font-black text-foreground">{row.pts}</td>}
                                                                        <td className="px-1 py-1.5 text-center">
                                                                            <div className="flex items-center justify-center gap-0.5">
                                                                                {!isTbd && (
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="ghost"
                                                                                        size="icon-sm"
                                                                                        onClick={() => handleSlotChange(origIdx, "TBD")}
                                                                                        className="size-6 text-muted-foreground hover:text-destructive"
                                                                                        title={locale === "th" ? "ล้างทีม" : "Clear team"}
                                                                                    >
                                                                                        <X className="size-3" />
                                                                                    </Button>
                                                                                )}
                                                                                {currentTeamCount > 1 && (
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="ghost"
                                                                                        size="icon-sm"
                                                                                        onClick={() => handleRemoveSlot(origIdx)}
                                                                                        className="size-6 text-muted-foreground hover:text-destructive"
                                                                                        title={locale === "th" ? "ลบช่องนี้" : "Remove slot"}
                                                                                    >
                                                                                        <Trash2 className="size-3" />
                                                                                    </Button>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tie Break Criteria Priority Management (DnD) */}
                                    <div className="space-y-1" id="node-settings-group-tiebreak">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <Header level={5}>
                                                    {locale === "th" ? "การจัดอันดับไทเบรก" : "Tie Break Priority"}
                                                </Header>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleResetTieBreak}
                                                className="h-8 px-2 text-xs text-muted-foreground shrink-0"
                                                title={locale === "th" ? "คืนค่าเกณฑ์เริ่มต้น" : "Reset to default criteria"}
                                            >
                                                <RotateCcw className="size-4" />
                                                <span>{locale === "th" ? "คืนค่าเริ่มต้น" : "Reset"}</span>
                                            </Button>
                                        </div>

                                        <div className="border border-border bg-card rounded-sm divide-y divide-border overflow-hidden">
                                            {currentTieBreakOrder.map((critKey, idx) => {
                                                const info = TIE_BREAK_CRITERIA_INFO[critKey];
                                                if (!info) return null;
                                                const isDragging = draggedTieBreakIndex === idx;

                                                return (
                                                    <div
                                                        key={critKey}
                                                        draggable
                                                        onDragStart={(e) => handleTieBreakDragStart(e, idx)}
                                                        onDragOver={(e) => handleTieBreakDragOver(e, idx)}
                                                        onDragEnd={handleTieBreakDragEnd}
                                                        className={cn(
                                                            "group flex items-center justify-between gap-2 p-2 hover:bg-muted/40 transition-colors select-none",
                                                            isDragging && "opacity-40 bg-primary/10"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div
                                                                className="cursor-grab active:cursor-grabbing text-muted-foreground transition-colors"
                                                                title={locale === "th" ? "ลากเพื่อจัดลำดับ" : "Drag to reorder"}
                                                            >
                                                                <GripVertical className="size-4" />
                                                            </div>
                                                            <span className="flex items-center justify-center size-5 rounded-full bg-node-5/10 text-node-5 font-bold text-[10px] shrink-0">
                                                                {idx + 1}
                                                            </span>
                                                            <div className="flex flex-col min-w-0">
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <span className="text-xs font-semibold text-foreground truncate">
                                                                        {locale === "th" ? info.labelTh : info.labelEn}
                                                                    </span>
                                                                    <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-sm bg-node-5/10 text-node-5 text-[10px] font-bold font-mono shrink-0">
                                                                        {info.code}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] text-muted-foreground/80 truncate">
                                                                    {locale === "th" ? info.descTh : info.descEn}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Column Visibility Toggles */}
                                    <div className="space-y-1" id="node-settings-group-columns">
                                        <div className="flex items-center justify-between">
                                            <Header level={5}>
                                                {locale === "th" ? "แสดงค่าในตารางคะแนน" : "Standings Columns"}
                                            </Header>
                                            <div className="flex items-center gap-2 text-xs">
                                                <button
                                                    type="button"
                                                    onClick={handleResetDefault}
                                                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
                                                >
                                                    {locale === "th" ? "ค่าเริ่มต้น" : "Default"}
                                                </button>
                                                <span className="text-muted-foreground text-[10px]">•</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleAll(true)}
                                                    className="text-[11px] text-primary hover:underline underline-offset-2 transition-colors font-medium cursor-pointer"
                                                >
                                                    {locale === "th" ? "เปิดทั้งหมด" : "Show All"}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            {columnOptions.map((opt) => (
                                                <div
                                                    key={opt.key}
                                                    onClick={() => {
                                                        updateNodeData(id, { [opt.key]: !opt.checked });
                                                        useBracketStore.setState({ isDirty: true });
                                                    }}
                                                    className="flex items-center justify-between px-4 py-2 cursor-pointer select-none rounded-sm transition-colors hover:bg-muted/40"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <span className={cn(
                                                            "inline-flex items-center justify-center min-w-8 h-8 px-1 rounded-sm font-bold text-[10px] font-mono transition-colors shrink-0",
                                                            opt.checked
                                                                ? "bg-node-5/10 text-node-5"
                                                                : "bg-muted/40 text-muted-foreground"
                                                        )}>
                                                            {opt.code}
                                                        </span>
                                                        <span className={cn(
                                                            "text-xs transition-colors",
                                                            opt.checked ? "text-foreground" : "text-muted-foreground"
                                                        )}>
                                                            {opt.label}
                                                        </span>
                                                    </div>
                                                    <Switch
                                                        id={`toggle-col-${opt.key}`}
                                                        checked={opt.checked}
                                                        onCheckedChange={(checked) => {
                                                            updateNodeData(id, { [opt.key]: checked });
                                                            useBracketStore.setState({ isDirty: true });
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="data-[state=checked]:bg-node-5 shrink-0 scale-90"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Generate Round Robin Fixtures */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => generateRoundRobinMatches(id)}
                                            className="text-node-5"
                                            disabled={isLocked || currentTeamCount < 2}
                                            title={locale === "th" ? "สร้างแมตช์พบกันหมด (รวมในโหนดเดียว)" : "Generate Round Robin (Single Node)"}
                                        >
                                            <LayoutGrid className="size-4" />
                                            <span className="truncate">
                                                {locale === "th" ? "พบกันหมด (รวม)" : "Round Robin"}
                                            </span>
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => generateRoundRobinMatchDays(id)}
                                            className="text-node-5"
                                            disabled={isLocked || currentTeamCount < 2}
                                            title={locale === "th" ? "สร้างแมตช์แยกตาม Match Day (สุ่มประกบคู่)" : "Generate Match Days (Randomized)"}
                                        >
                                            <Layers className="size-4" />
                                            <span className="truncate">
                                                {locale === "th" ? "แยก Match Day" : "Match Days"}
                                            </span>
                                        </Button>
                                    </div>
                                </div>
                            );
                        })()}

                        {type === "matchNode" && (
                            <MatchNodeSettings
                                id={id}
                                data={data}
                                tournamentId={tournamentId}
                                activeCategoryId={activeCategoryId}
                                dbMatches={storeMatches.length > 0 ? storeMatches : dbMatches}
                                tournament={tournamentRecord || undefined}
                                isLocked={isLocked}
                            />
                        )}

                        {type === "drawNode" && (() => {
                            const drawData = data as any;
                            const teams: string[] = Array.isArray(drawData.teams) ? drawData.teams : [];
                            const drawnPairs: { id: string; teamA: string; teamB: string }[] = Array.isArray(drawData.drawnPairs) ? drawData.drawnPairs : [];

                            const getInitials = (n: string) => {
                                const parts = n.trim().split(/\s+/);
                                if (parts.length > 1 && parts[0] && parts[1]) {
                                    return (parts[0][0] + parts[1][0]).toUpperCase();
                                }
                                return n.slice(0, 2).toUpperCase();
                            };

                            const availableTeams = storeTeams
                                .filter((t) => isTeamApproved(t))
                                .filter((t) => {
                                    const tName = ((t as any).team?.name || t.name || "").trim();
                                    if (!tName) return false;
                                    return !teams.some((existing) => existing.trim().toLowerCase() === tName.toLowerCase());
                                });

                            return (
                                <div className="space-y-6">
                                    {/* Pool Teams Management */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold text-foreground">
                                                {locale === "th" ? `รายชื่อทีมในโถจับสลาก (${teams.length} ทีม)` : `Team Pool (${teams.length})`}
                                            </Label>
                                            {teams.length > 0 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => updateNodeData(id, { teams: [], drawnPairs: [] })}
                                                    className="text-xs text-muted-foreground hover:text-destructive h-7"
                                                >
                                                    {locale === "th" ? "ล้างทั้งหมด" : "Clear All"}
                                                </Button>
                                            )}
                                        </div>

                                        {/* Add Team Dropdown */}
                                        <div className="space-y-1.5">
                                            <Select
                                                key={`select-add-team-${teams.length}`}
                                                onValueChange={(val) => {
                                                    if (val) {
                                                        updateNodeData(id, { teams: [...teams, val] });
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="w-full text-xs h-8">
                                                    <SelectValue placeholder={locale === "th" ? "เลือกทีมจากระบบเพื่อเพิ่มเข้าโถ..." : "Select a team from management to add..."} />
                                                </SelectTrigger>
                                                <SelectContent position="popper" align="start" className="min-w-[220px] max-h-60">
                                                    {availableTeams.length === 0 ? (
                                                        <div className="p-2 text-center text-xs text-muted-foreground">
                                                            {locale === "th" ? "ไม่มีทีมให้เลือกเพิ่มเติม" : "No more teams available"}
                                                        </div>
                                                    ) : (
                                                        availableTeams.map((t) => {
                                                            const tName = (t as any).team?.name || t.name;
                                                            const tLogo = (t as any).team?.logo_img || (t as any).team?.logo_url || (t as any).logo_img || t.logo_url || null;
                                                            return (
                                                                <SelectItem key={String(t.id || (t as any).team_id || tName)} value={tName}>
                                                                    <span className="flex items-center gap-2 min-w-0">
                                                                        <span className="size-5 rounded-full border border-border/60 bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                                                                            {tLogo ? (
                                                                                <Image
                                                                                    src={tLogo}
                                                                                    alt={tName}
                                                                                    width={20}
                                                                                    height={20}
                                                                                    className="w-full h-full object-cover"
                                                                                />
                                                                            ) : (
                                                                                <span className="text-[9px] font-black text-muted-foreground">
                                                                                    {getInitials(tName)}
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                        <span className="text-xs font-medium truncate">{tName}</span>
                                                                    </span>
                                                                </SelectItem>
                                                            );
                                                        })
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Pool List */}
                                        <div className="border bg-card rounded-sm overflow-hidden divide-y divide-border">
                                            {teams.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-muted-foreground">
                                                    {locale === "th"
                                                        ? "ยังไม่มีทีมในโถ ลากเส้นเชื่อมทีมจากรอบก่อนหน้าเข้ามาที่นี่"
                                                        : "No teams in pool. Connect incoming edges here."}
                                                </div>
                                            ) : (
                                                teams.map((tName, idx) => (
                                                    <div key={`${tName}-${idx}`} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/30">
                                                        <span className="font-semibold truncate flex-1 min-w-0">
                                                            <span className="text-muted-foreground mr-2 font-normal">#{idx + 1}</span>
                                                            {tName}
                                                        </span>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            onClick={() => {
                                                                const nextTeams = [...teams];
                                                                nextTeams.splice(idx, 1);
                                                                updateNodeData(id, { teams: nextTeams });
                                                            }}
                                                            className="size-6 text-muted-foreground hover:text-destructive"
                                                        >
                                                            <Trash2 className="size-3" />
                                                        </Button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Shuffle Action */}
                                    <div className="space-y-2 pt-2 border-t">
                                        <Label className="text-xs font-bold text-foreground block">
                                            {locale === "th" ? "การจับสลากประกบคู่" : "Draw Action"}
                                        </Label>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => shuffleDrawNode(id)}
                                            disabled={isLocked || teams.length < 2}
                                            className="w-full bg-node-4 hover:bg-node-4/90"
                                        >
                                            <Shuffle className="size-4" />
                                            {drawnPairs.length > 0
                                                ? (locale === "th" ? "สุ่มใหม่อีกครั้ง (Reshuffle)" : "Reshuffle Draw")
                                                : (locale === "th" ? "กดสุ่มจับสลากประกบคู่" : "Shuffle & Draw Pairs")}
                                        </Button>
                                    </div>

                                    {/* Drawn Pairs List */}
                                    {drawnPairs.length > 0 && (
                                        <div className="space-y-3 pt-2 border-t">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs font-bold text-foreground">
                                                    {locale === "th" ? `ผลการจับสลาก (${drawnPairs.length} คู่)` : `Drawn Pairings (${drawnPairs.length})`}
                                                </Label>
                                            </div>
                                            <div className="border bg-card rounded-sm overflow-hidden divide-y divide-border">
                                                {drawnPairs.map((pair, idx) => (
                                                    <div key={pair.id || idx} className="flex items-center justify-between px-3 py-2 text-xs">
                                                        <span className="text-[10px] font-bold text-node-4 mr-2 shrink-0">#{idx + 1}</span>
                                                        <div className="flex items-center gap-2 flex-1 justify-between min-w-0">
                                                            <Select
                                                                value={pair.teamA}
                                                                onValueChange={(val) => updateDrawPair(id, idx, "teamA", val)}
                                                            >
                                                                <SelectTrigger className="h-7 w-auto min-w-[120px] max-w-[140px] px-1 border-0 bg-transparent shadow-none hover:bg-muted/40 text-xs font-semibold truncate">
                                                                    {pair.teamA}
                                                                </SelectTrigger>
                                                                <SelectContent position="popper" align="start" className="min-w-[180px] max-h-60">
                                                                    {teams.map((t) => (
                                                                        <SelectItem key={`side-a-${t}`} value={t}>
                                                                            {t}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>

                                                            <button
                                                                type="button"
                                                                onClick={() => swapDrawPairSlots(id, idx)}
                                                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-node-4 transition-colors shrink-0"
                                                                title={locale === "th" ? "สลับทีมเหย้า-เยือน" : "Swap Teams"}
                                                            >
                                                                <ArrowLeftRight className="size-3" />
                                                            </button>

                                                            <Select
                                                                value={pair.teamB}
                                                                onValueChange={(val) => updateDrawPair(id, idx, "teamB", val)}
                                                            >
                                                                <SelectTrigger className="h-7 w-auto min-w-[120px] max-w-[140px] px-1 border-0 bg-transparent shadow-none hover:bg-muted/40 text-xs font-semibold truncate">
                                                                    {pair.teamB}
                                                                </SelectTrigger>
                                                                <SelectContent position="popper" align="start" className="min-w-[180px] max-h-60">
                                                                    {teams.map((t) => (
                                                                        <SelectItem key={`side-b-${t}`} value={t}>
                                                                            {t}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Generation to next round */}
                                            <div className="space-y-2 pt-2 border-t">
                                                <Label className="text-xs font-bold text-foreground block">
                                                    {locale === "th" ? "สร้างโหนดรอบถัดไปบน Canvas" : "Generate to Next Stage"}
                                                </Label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={isLocked}
                                            onClick={() => generateNextRoundFromDraw(id, "round")}
                                                        className="text-node-4"
                                                    >
                                                        <Layers className="size-4" />
                                                        {locale === "th" ? "แบบ Round (กล่องเดียว)" : "Single Round Node"}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={isLocked}
                                            onClick={() => generateNextRoundFromDraw(id, "matches")}
                                                        className="text-node-4"
                                                    >
                                                        <GitBranch className="size-4" />
                                                        {locale === "th" ? "แบบ Match (แยกคู่)" : "Separate Match Nodes"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {type === "sponsorNode" && (
                            <div className="space-y-4" id="node-settings-sponsor-list">
                                {!isLocked && (
                                    <>
                                        <AddSponsorDialog
                                            tournamentId={tournamentId}
                                            open={isAddSponsorOpen}
                                            onOpenChange={setIsAddSponsorOpen}
                                            onSuccess={loadSponsors}
                                            trigger={null}
                                        />

                                        <AddSponsorDialog
                                            tournamentId={tournamentId}
                                            sponsorToEdit={editingSponsor}
                                            open={!!editingSponsor}
                                            onOpenChange={(open) => {
                                                if (!open) setEditingSponsor(null);
                                            }}
                                            onSuccess={loadSponsors}
                                            trigger={null}
                                        />
                                    </>
                                )}

                                {isSponsorLoading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-red-500" />
                                    </div>
                                ) : sponsorsList.length === 0 ? (
                                    <EmptyState
                                        icon={Heart}
                                        title={locale === "th" ? "ยังไม่มีผู้สนับสนุน" : "No sponsors added yet"}
                                        description={locale === "th" ? "คลิก 'New Sponsor' เพื่อเพิ่มผู้สนับสนุน" : "Click 'New Sponsor' to add a sponsor"}
                                    />
                                ) : (
                                    <div className="space-y-4">
                                        {!isLocked && (
                                            <p className="text-[10px] text-muted-foreground/60 italic">
                                                Drag handles to reorder sponsors. Reordering updates order_index automatically.
                                            </p>
                                        )}
                                        <div className="border bg-card rounded-sm divide-y divide-border overflow-hidden">
                                            {sponsorsList.map((sponsor, idx) => (
                                                <div
                                                    key={sponsor.id}
                                                    draggable={!isLocked}
                                                    onDragStart={!isLocked ? (e) => handleDragStart(e, idx) : undefined}
                                                    onDragOver={!isLocked ? (e) => handleDragOver(e, idx) : undefined}
                                                    onDragEnd={!isLocked ? handleDragEnd : undefined}
                                                    className={cn(
                                                        "flex items-center justify-between p-4 hover:bg-muted/40 transition-colors",
                                                        !isLocked && draggedIndex === idx && "opacity-50 bg-destructive/10"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        {!isLocked && (
                                                            <div className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground p-1">
                                                                <GripVertical className="size-4" />
                                                            </div>
                                                        )}
                                                        <div className="h-8 w-8 rounded-full bg-muted/40 flex items-center justify-center overflow-hidden border p-0.5 shrink-0">
                                                            {sponsor.logo_img ? (
                                                                <Image
                                                                    src={sponsor.logo_img}
                                                                    alt={sponsor.sponsor_name || "Sponsor logo"}
                                                                    className="max-h-full max-w-full object-contain rounded-full"
                                                                    width={32}
                                                                    height={32}
                                                                />
                                                            ) : (
                                                                <Heart className="size-4 text-muted-foreground/20" />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <span className="text-xs font-bold truncate leading-none text-foreground">
                                                                    {sponsor.sponsor_name}
                                                                </span>
                                                                {sponsor.cover_url && (
                                                                    <span className="text-[9px] px-1 py-0.2 rounded bg-primary/15 text-primary font-medium shrink-0">Cover</span>
                                                                )}
                                                            </div>
                                                            {sponsor.link_url && (
                                                                <a href={sponsor.link_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:underline truncate flex items-center gap-1 mt-0.5">
                                                                    <Globe className="size-4" />
                                                                    {sponsor.link_url}
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {!isLocked && (
                                                        <ActionMenu>
                                                            <ActionMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    className="text-muted-foreground hover:text-foreground shrink-0"
                                                                >
                                                                    <MoreVertical className="size-4" />
                                                                </Button>
                                                            </ActionMenuTrigger>
                                                            <ActionMenuContent align="end" className="w-32 bg-card shadow-xl">
                                                                <ActionMenuItem
                                                                    className="cursor-pointer text-xs flex items-center gap-2"
                                                                    onClick={() => handleEditSponsorClick(sponsor)}
                                                                >
                                                                    <Pencil className="size-4 text-muted-foreground" />
                                                                    <span>{tSponsors("edit")}</span>
                                                                </ActionMenuItem>
                                                                <ActionMenuItem
                                                                    className="cursor-pointer text-xs flex items-center gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                                                    onClick={() => handleDeleteSponsorClick(sponsor.id)}
                                                                >
                                                                    <Trash2 className="size-4" />
                                                                    <span>{tSponsors("delete")}</span>
                                                                </ActionMenuItem>
                                                            </ActionMenuContent>
                                                        </ActionMenu>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {type === "announcementNode" && (
                            <div className="space-y-4">
                                <Announcements
                                    tournamentId={tournamentId}
                                    isEditable={!isLocked}
                                    isCompact={true}
                                    mode="list"
                                />
                                {!isLocked && (
                                    <AddAnnouncementDialog
                                        tournamentId={tournamentId}
                                        open={isAddAnnouncementOpen}
                                        onOpenChange={setIsAddAnnouncementOpen}
                                        trigger={null}
                                    />
                                )}
                            </div>
                        )}

                        {type === "registrationNode" && (
                            <div className="space-y-4">
                                {isRegLoading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                                    </div>
                                ) : (
                                    <form onSubmit={handleRegSave} className="space-y-4">
                                        <div id="node-settings-reg-fee">
                                            {/* Dropdown / Collapsible Header with Switch */}
                                            <div className="w-full flex items-center justify-between gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsPaymentDetailsOpen(prev => !prev)}
                                                    className="space-y-0.5 min-w-0 flex-1 text-left group cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Header level={5} className="font-bold text-foreground">
                                                            {locale === "th" ? "ค่าสมัครและข้อมูลบัญชีรับเงิน" : "Registration Fee & Payment Details"}
                                                        </Header>
                                                        {regFee !== "" && Number(regFee) > 0 ? (
                                                            <span className="text-xs text-violet-600 dark:text-violet-400">
                                                                {Number(regFee).toLocaleString()} ฿
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">
                                                                {locale === "th" ? "ฟรี" : "Free"}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {locale === "th"
                                                            ? "กำหนดค่าสมัครแข่งขัน และข้อมูลบัญชีธนาคาร/พร้อมเพย์สำหรับโอนเงิน"
                                                            : "Set registration fee and banking/PromptPay details."}
                                                    </p>
                                                </button>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <div id="node-settings-reg-status" className="flex items-center">
                                                        <Switch
                                                            id="is_reg_open"
                                                            checked={regOpen}
                                                            onCheckedChange={handleToggleRegOpen}
                                                            className="data-[state=checked]:bg-violet-500"
                                                            title={locale === 'th' ? (regOpen ? "เปิดรับสมัคร" : "ปิดรับสมัคร") : (regOpen ? "Registration Open" : "Registration Closed")}
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsPaymentDetailsOpen(prev => !prev)}
                                                        className="size-8 rounded-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                        title={locale === 'th' ? (isPaymentDetailsOpen ? "ย่อ" : "ขยาย") : (isPaymentDetailsOpen ? "Collapse" : "Expand")}
                                                    >
                                                        <ChevronDown className={cn("size-4 transition-transform duration-200", isPaymentDetailsOpen && "rotate-180")} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Collapsible Content */}
                                            {isPaymentDetailsOpen && (
                                                <div>
                                                    {/* Profile-form style container */}
                                                    <div className="overflow-hidden">
                                                        {/* 1. Registration Fee */}
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                                                            <div className="flex items-start gap-3 sm:w-1/2">
                                                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                                                    <CreditCard className="size-4 text-muted-foreground" />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Header level={6}>
                                                                        {locale === "th" ? "ค่าสมัครแข่งขัน" : "Registration Fee"}
                                                                    </Header>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {locale === "th" ? "กำหนดค่าสมัคร (0 หากฟรี)" : "Fee per team (0 for free)"}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="sm:w-1/2 w-full space-y-1">
                                                                <Input
                                                                    size="sm"
                                                                    type="numeric"
                                                                    id="reg_fee"
                                                                    value={regFee}
                                                                    onChange={(e) => {
                                                                        setRegFee(e.target.value === "" ? "" : Number(e.target.value));
                                                                        setLastModifiedField('regFee');
                                                                    }}
                                                                    placeholder={locale === "th" ? "0 (ไม่มีค่าสมัคร)" : "0 (Free)"}
                                                                    min="0"
                                                                    step="0.01"
                                                                    className="w-full bg-transparent"
                                                                />
                                                                {activeRegActionField === 'regFee' && renderActionButtons()}
                                                            </div>
                                                        </div>

                                                        {/* 2. PromptPay ID / Account Number */}
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                                                            <div className="flex items-start gap-3 sm:w-1/2">
                                                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                                                    <QrCode className="size-4 text-muted-foreground" />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Header level={6}>
                                                                        {locale === "th" ? "หมายเลขพร้อมเพย์ / เลขบัญชี" : "PromptPay ID / Account"}
                                                                    </Header>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {locale === "th" ? "เบอร์พร้อมเพย์หรือเลขบัญชี" : "PromptPay ID or account number"}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="sm:w-1/2 w-full space-y-1">
                                                                <Input
                                                                    size="sm"
                                                                    type="text"
                                                                    id="reg_promptpay"
                                                                    value={bankNumber}
                                                                    onChange={(e) => {
                                                                        setBankNumber(e.target.value);
                                                                        setLastModifiedField('bankNumber');
                                                                    }}
                                                                    placeholder={locale === "th" ? "081-234-5678 หรือ 1234567890123" : "081-234-5678 or account number"}
                                                                    className="w-full bg-transparent"
                                                                />
                                                                {activeRegActionField === 'bankNumber' && renderActionButtons()}
                                                            </div>
                                                        </div>

                                                        {/* 3. Bank Name / Service */}
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                                                            <div className="flex items-start gap-3 sm:w-1/2">
                                                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                                                    <Building2 className="size-4 text-muted-foreground" />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Header level={6}>
                                                                        {locale === "th" ? "ธนาคาร / บริการ" : "Bank / Service"}
                                                                    </Header>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {locale === "th" ? "ชื่อธนาคารหรือผู้ให้บริการ" : "Bank name or service"}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="sm:w-1/2 w-full space-y-1">
                                                                <Input
                                                                    size="sm"
                                                                    type="text"
                                                                    id="reg_bank_name"
                                                                    value={bankName}
                                                                    onChange={(e) => {
                                                                        setBankName(e.target.value);
                                                                        setLastModifiedField('bankName');
                                                                    }}
                                                                    placeholder={locale === "th" ? "PromptPay / ธนาคาร" : "PromptPay / Bank Name"}
                                                                    className="w-full bg-transparent"
                                                                />
                                                                {activeRegActionField === 'bankName' && renderActionButtons()}
                                                            </div>
                                                        </div>

                                                        {/* 4. Account Holder Name */}
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2">
                                                            <div className="flex items-start gap-3 sm:w-1/2">
                                                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                                                    <UserCheck className="size-4 text-muted-foreground" />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Header level={6}>
                                                                        {locale === "th" ? "ชื่อเจ้าของบัญชี" : "Account Holder Name"}
                                                                    </Header>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {locale === "th" ? "ชื่อบัญชีรับเงิน" : "Account holder name"}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="sm:w-1/2 w-full space-y-1">
                                                                <Input
                                                                    size="sm"
                                                                    type="text"
                                                                    id="reg_acc_name"
                                                                    value={accountName}
                                                                    onChange={(e) => {
                                                                        setAccountName(e.target.value);
                                                                        setLastModifiedField('accountName');
                                                                    }}
                                                                    placeholder={locale === "th" ? "สมชาย ใจดี" : "John Doe"}
                                                                    className="w-full bg-transparent"
                                                                />
                                                                {activeRegActionField === 'accountName' && renderActionButtons()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </form>
                                )}

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2 px-0.5 pt-1">
                                        <div className="flex items-center gap-2">
                                            <Header level={5} className="font-bold text-foreground">
                                                {locale === "th" ? "รายชื่อทีมที่สมัคร" : "Registered Teams"}
                                            </Header>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-bold text-foreground">
                                                {categoryEligibleTeams.length}/{maxTeams || categoryEligibleTeams.length}
                                            </span>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleAutoFillTeams}
                                            disabled={!isTeamsFull}
                                            className={cn(
                                                "gap-1.5 shadow-xs transition-all text-xs h-7",
                                                isTeamsFull
                                                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                                                    : "opacity-60 cursor-not-allowed"
                                            )}
                                            title={
                                                !isTeamsFull
                                                    ? (locale === "th"
                                                        ? `สามารถใช้งานได้เมื่อมีทีมสมัครครบแล้ว (${categoryEligibleTeams.length}/${maxTeams || "-"} ทีม)`
                                                        : `Available when all teams are registered (${categoryEligibleTeams.length}/${maxTeams || "-"} teams)`)
                                                    : (locale === "th"
                                                        ? `สุ่มเพิ่มทีม ${categoryEligibleTeams.length} ทีมลงในสายการแข่งขันอัตโนมัติ`
                                                        : `Auto-fill ${categoryEligibleTeams.length} registered teams randomly`)
                                            }
                                        >
                                            <Shuffle className="size-3 text-emerald-500" />
                                            <span>{locale === "th" ? "เพิ่มทีมอัตโนมัติ" : "Auto Fill"}</span>
                                        </Button>
                                    </div>
                                    <Registrations
                                        tournamentId={tournamentId}
                                        categoryId={activeCategoryId || undefined}
                                    />
                                </div>

                                <AddTournamentTeamDialog
                                    tournamentId={tournamentId}
                                    tournamentCategoryId={activeCategoryId || undefined}
                                    open={isAddDialogOpen}
                                    onOpenChange={setIsAddDialogOpen}
                                    trigger={null}
                                    onSuccess={() => {
                                        if (activeCategoryId) {
                                            fetchTeams(activeCategoryId);
                                        }
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!isPseudoRanking && (
                <div className="shrink-0 p-3 md:p-4 border-t bg-muted/10">
                    <p className="text-[9px] text-muted-foreground font-bold leading-relaxed">
                        ID: {id}
                    </p>
                </div>
            )}

            {/* Custom Team Name Dialog */}
            <Dialog
                open={customTeamDialog !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setCustomTeamDialog(null);
                        setCustomTeamInput("");
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-bold">
                            <Pencil className="size-4 text-node-5" />
                            {locale === "th" ? "ระบุชื่อทีม" : "Specify Team Name"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            {locale === "th"
                                ? "กำหนดชื่อทีมสำหรับช่องนี้ในกลุ่ม เช่น Team C1, สาย A1 หรือชื่อทีมที่ต้องการ"
                                : "Specify a custom team name for this group slot, e.g. Team C1"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 space-y-1.5">
                        <Label className="text-xs font-bold text-foreground">
                            {locale === "th" ? "ชื่อทีม" : "Team Name"}
                        </Label>
                        <Input
                            autoFocus
                            value={customTeamInput}
                            onChange={(e) => setCustomTeamInput(e.target.value)}
                            placeholder={locale === "th" ? "เช่น Team C1" : "e.g. Team C1"}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveCustomTeam();
                                }
                            }}
                            className="text-sm font-semibold"
                        />
                    </div>
                    <DialogFooter className="flex items-center justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setCustomTeamDialog(null);
                                setCustomTeamInput("");
                            }}
                        >
                            {locale === "th" ? "ยกเลิก" : "Cancel"}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleSaveCustomTeam}
                            disabled={!customTeamInput.trim()}
                            className="bg-node-5 hover:bg-node-5/90 text-white font-bold"
                        >
                            {locale === "th" ? "บันทึกชื่อทีม" : "Save Team"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </aside>
    );
}

