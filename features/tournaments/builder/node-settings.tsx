"use client";

import React, { useEffect, useCallback } from "react";
import Image from "next/image";
import { useBracketStore } from "@/lib/stores/bracket-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Users, LayoutGrid, Trash2, ListOrdered, Megaphone, X, Heart, Loader2, GripVertical, Globe, ClipboardEdit, HelpCircle, MoreVertical, Pencil, Minus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { RankingNodeSettings } from "./ranking-node-settings";
import { MatchNodeSettings } from "./match-node-settings";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/dropdown";
import { Registrations } from "@/features/tournaments/management/registrations";
import { Announcements } from "@/features/tournaments/management/announcements";
import { AddTournamentTeamDialog, AddAnnouncementDialog, AddSponsorDialog } from "@/features/dialogs";
import { EmptyState } from "@/components/shared/empty-state";
import { Plus } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { Header } from "@/components/ui/header";

export interface NodeSettingsProps {
    currentTournamentStatus?: string;
    onStatusChange?: (status: TournamentStatus) => void;
}

export function NodeSettings({ currentTournamentStatus, onStatusChange }: NodeSettingsProps = {}) {
    const { nodes, updateNodeData, deleteNode, selectNode, setActiveNodeId, fetchTeams, activeNodeId, activeCategoryId } = useBracketStore();
    const params = useParams();
    const tournamentId = params.id as string;
    const selectedNode = nodes.find((node) => node.id === activeNodeId);
    const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
    const [isAddAnnouncementOpen, setIsAddAnnouncementOpen] = React.useState(false);
    const tSponsors = useTranslations("Sponsors");
    const locale = useLocale();
    const { toast } = useToast();

    // Sponsors state
    const [sponsorsList, setSponsorsList] = React.useState<Sponsor[]>([]);
    const [isSponsorLoading, setIsSponsorLoading] = React.useState(true);
    const [isAddSponsorOpen, setIsAddSponsorOpen] = React.useState(false);
    const [editingSponsor, setEditingSponsor] = React.useState<Sponsor | null>(null);
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

    // Registration settings state
    const [regOpen, setRegOpen] = React.useState(false);
    const [regFee, setRegFee] = React.useState<number | "">("");
    const [bankNumber, setBankNumber] = React.useState("");
    const [bankName, setBankName] = React.useState("PromptPay");
    const [accountName, setAccountName] = React.useState("");
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
                            setRegOpen(Boolean(tour.is_registration_open ?? tour.settings?.is_registration_open));
                            setRegFee(cat ? Number(cat.registration_fee || 0) : "");
                            setBankNumber(tour.settings?.bank_account_number || "");
                            setBankName(tour.settings?.bank_name || "PromptPay");
                            setAccountName(tour.settings?.bank_account_name || "");
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
                toast({
                    title: "Success",
                    description: "Registration settings updated successfully",
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
                    setDbMatches(results);
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
    }, [selectedNode, tournamentId, activeCategoryId]);

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
        } else if (nodeType === "teamListNode") {
            steps.push({
                element: "#node-settings-teamlist-add",
                popover: {
                    title: locale === "th" ? "จัดการทีมที่เข้าร่วม" : "Manage Teams",
                    description: locale === "th" ? "เพิ่ม ลบ หรือแก้ไขรายชื่อทีมทั้งหมดที่จะแข่งขันในรุ่นนี้" : "Add, remove, or edit the list of teams participating in this category.",
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
                    : (locale === "th" ? "การลงทะเบียน" : "Registration")
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
                            type === 'standingNode' ? 'bg-node-1/10' :
                                type === 'teamListNode' ? 'bg-node-3/10' :
                                    type === 'sponsorNode' ? 'bg-red-500/10' :
                                        type === 'registrationNode' ? 'bg-violet-500/10' :
                                            type === 'rankingNode' ? 'bg-amber-500/10' : 'bg-node-4/10'
                        }`}>
                        {type === 'groupNode' ? <LayoutGrid className="size-4 text-node-5" /> :
                            type === 'matchNode' ? <span className="text-sm font-bold text-node-2 select-none">VS</span> :
                                type === 'standingNode' ? <ListOrdered className="size-4 text-node-1" /> :
                                    type === 'teamListNode' ? <Users className="size-4 text-node-3" /> :
                                        type === 'sponsorNode' ? <Heart className="size-4 text-red-500" /> :
                                            type === 'registrationNode' ? <ClipboardEdit className="size-4 text-violet-500" /> :
                                                type === 'rankingNode' ? <Trophy className="size-4 text-amber-500" /> :
                                                    <Megaphone className="size-4 text-node-4" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <Header level={6} className="truncate">
                            {data.label as string}
                        </Header>
                        <p className="text-xs text-muted-foreground">
                            {type === 'rankingNode' ? (locale === 'th' ? "ตารางอันดับ" : "Standings") : type?.replace('Node', '')}
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
                        {!isRegistrationMode && !isPseudoNode && (
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
                        {isRegistrationMode && (
                            <div className="flex items-center gap-2 ml-1" id="node-settings-reg-status">
                                <Switch
                                    id="is_reg_open"
                                    checked={regOpen}
                                    onCheckedChange={setRegOpen}
                                    className="data-[state=checked]:bg-violet-500"
                                />
                            </div>
                        )}
                        {type === "announcementNode" && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => setIsAddAnnouncementOpen(true)}
                                className="bg-node-4 text-background hover:bg-node-4/90 h-8 text-xs px-2.5 gap-1 shrink-0 ml-1"
                            >
                                <Plus className="size-4" />
                                {locale === "th" ? "เพิ่มประกาศใหม่" : "New Announcement"}
                            </Button>
                        )}
                        {type === "sponsorNode" && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => setIsAddSponsorOpen(true)}
                                className="bg-red-500 text-white hover:bg-red-600 h-8 text-xs px-2.5 gap-1 shrink-0 ml-1"
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
                        if (typeof window !== "undefined") {
                            const url = new URL(window.location.href);
                            if (url.searchParams.get("tab") === "ranking") {
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
                    {type === "groupNode" && (
                        <>
                            <div className="space-y-1" id="node-settings-group-team-count">
                                <Label>{locale === "th" ? "จำนวนทีม" : "Team Count"}</Label>
                                <div className="flex items-center gap-1 lg:gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon-sm"
                                        onClick={() => {
                                            const current = Number(data.teamCount) || 0;
                                            const nextVal = Math.max(0, current - 1);
                                            updateNodeData(id, { teamCount: nextVal });
                                        }}
                                        disabled={(Number(data.teamCount) || 0) <= 0}
                                    >
                                        <Minus className="size-4" />
                                    </Button>
                                    <Input
                                        size="sm"
                                        type="text"
                                        inputMode="numeric"
                                        value={data.teamCount !== undefined && data.teamCount !== null ? String(data.teamCount) : "0"}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, "");
                                            const num = parseInt(val, 10) || 0;
                                            updateNodeData(id, { teamCount: Math.min(64, num) });
                                        }}
                                        className="text-center font-bold"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon-sm"
                                        onClick={() => {
                                            const current = Number(data.teamCount) || 0;
                                            const nextVal = Math.min(64, current + 1);
                                            updateNodeData(id, { teamCount: nextVal });
                                        }}
                                        disabled={(Number(data.teamCount) || 0) >= 64}
                                    >
                                        <Plus className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}

                    {type === "standingNode" && (() => {
                        const sport = useBracketStore.getState().sport || (selectedNode?.data?.sport as string) || 'football';
                        const isVolleyball = sport === 'volleyball';

                        const columnOptions = isVolleyball ? [
                            { label: "Matches Played", key: "showPlayed" },
                            { label: "Win / Loss", key: "showWL", composite: ["showWin", "showLoss"] },
                            { label: "SW / SL (Sets)", key: "showS", composite: ["showSW", "showSL"] },
                            { label: "Set Difference (SD)", key: "showSD" },
                            { label: "Points", key: "showPts" },
                            { label: "Form (Last 5)", key: "showForm", defaultOff: true },
                            { label: "Next Match", key: "showNextMatch", defaultOff: true },
                        ] : [
                            { label: "Matches Played", key: "showPlayed" },
                            { label: "Win / Draw / Loss", key: "showWDL", composite: ["showWin", "showDraw", "showLoss"] },
                            { label: "GF / GA (Goals)", key: "showG", composite: ["showGF", "showGA"], defaultOff: true },
                            { label: "Goal Difference (GD)", key: "showGD" },
                            { label: "Points", key: "showPts" },
                            { label: "Form (Last 5)", key: "showForm", defaultOff: true },
                            { label: "Next Match", key: "showNextMatch", defaultOff: true },
                        ];

                        return (
                            <div className="space-y-4">
                                <div className="space-y-1" id="node-settings-standing-advancing">
                                    <Label>{locale === "th" ? "จำนวนทีมที่เข้ารอบ" : "Advancing Teams"}</Label>
                                    <div className="flex items-center gap-1 lg:gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon-sm"
                                            onClick={() => {
                                                const current = Number(data.advancingCount) || 0;
                                                const nextVal = Math.max(0, current - 1);
                                                updateNodeData(id, { advancingCount: nextVal });
                                            }}
                                            disabled={(Number(data.advancingCount) || 0) <= 0}
                                        >
                                            -
                                        </Button>
                                        <Input
                                            size="sm"
                                            type="text"
                                            inputMode="numeric"
                                            value={data.advancingCount !== undefined && data.advancingCount !== null ? String(data.advancingCount) : "0"}
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
                                            disabled={(Number(data.advancingCount) || 0) >= 16}
                                        >
                                            +
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground font-medium">
                                        {locale === "th" ? "จำนวนทีมที่ผ่านเข้าสู่รอบถัดไป" : "Number of teams that move to the next stage."}
                                    </p>
                                </div>

                                <div className="border bg-card rounded-sm divide-y divide-border overflow-hidden" id="node-settings-standing-columns">
                                    {columnOptions.map((item) => (
                                        <div key={item.key} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-all">
                                            <Label className="text-[11px] font-bold text-foreground leading-none cursor-pointer" htmlFor={item.key}>
                                                {item.label}
                                            </Label>
                                            <Switch
                                                id={item.key}
                                                checked={item.composite
                                                    ? item.composite.every(k => item.defaultOff ? !!data[k] : data[k] !== false)
                                                    : item.defaultOff ? !!data[item.key] : data[item.key] !== false
                                                }
                                                onCheckedChange={(checked) => {
                                                    if (item.composite) {
                                                        const updates: Record<string, boolean> = {};
                                                        item.composite.forEach(k => updates[k] = checked);
                                                        updateNodeData(id, updates);
                                                    } else {
                                                        updateNodeData(id, { [item.key]: checked });
                                                    }
                                                }}
                                            />
                                        </div>
                                    ))}
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
                            dbMatches={dbMatches}
                        />
                    )}

                    {type === "teamListNode" && (
                        <div className="space-y-4" id="node-settings-teamlist-add">
                            <div className="flex justify-end">
                                <AddTournamentTeamDialog
                                    tournamentId={tournamentId}
                                    tournamentCategoryId={activeCategoryId || undefined}
                                    open={isAddDialogOpen}
                                    onOpenChange={setIsAddDialogOpen}
                                    onSuccess={() => {
                                        if (activeCategoryId) {
                                            fetchTeams(activeCategoryId);
                                        }
                                    }}
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="custom-scrollbar">
                                    <Registrations tournamentId={tournamentId} categoryId={activeCategoryId || undefined} />
                                </div>
                            </div>
                        </div>
                    )}

                    {type === "sponsorNode" && (
                        <div className="space-y-4" id="node-settings-sponsor-list">
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
                                    <p className="text-[10px] text-muted-foreground/60 italic">
                                         Drag handles to reorder sponsors. Reordering updates order_index automatically.
                                     </p>
                                    <div className="border bg-card rounded-sm divide-y divide-border overflow-hidden">
                                        {sponsorsList.map((sponsor, idx) => (
                                            <div
                                                key={sponsor.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, idx)}
                                                onDragOver={(e) => handleDragOver(e, idx)}
                                                onDragEnd={handleDragEnd}
                                                className={cn(
                                                    "flex items-center justify-between p-4 hover:bg-muted/40 transition-colors",
                                                    draggedIndex === idx && "opacity-50 bg-destructive/10"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground p-1">
                                                        <GripVertical className="size-4" />
                                                    </div>
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
                                isEditable={true}
                                isCompact={true}
                                mode="list"
                            />
                            <AddAnnouncementDialog
                                tournamentId={tournamentId}
                                open={isAddAnnouncementOpen}
                                onOpenChange={setIsAddAnnouncementOpen}
                                trigger={null}
                            />
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
                                    <div className="space-y-4" id="node-settings-reg-fee">
                                        <div className="grid grid-cols-2 gap-1 md:gap-2">
                                            <div className="space-y-1">
                                                <Label>{locale === "th" ? "ค่าสมัคร (บาท)" : "Registration Fee (THB)"}</Label>
                                                <Input
                                                    size="sm"
                                                    type="number"
                                                    id="reg_fee"
                                                    value={regFee}
                                                    onChange={(e) => setRegFee(e.target.value === "" ? "" : Number(e.target.value))}
                                                    placeholder={locale === "th" ? "500 (หรือ 0 สำหรับฟรี)" : "500 (or 0 for free)"}
                                                    min="0"
                                                    step="0.01"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <Label>{locale === "th" ? "หมายเลขพร้อมเพย์" : "PromptPay ID"}</Label>
                                                <Input
                                                    size="sm"
                                                    type="text"
                                                    id="reg_promptpay"
                                                    value={bankNumber}
                                                    onChange={(e) => setBankNumber(e.target.value)}
                                                    placeholder={locale === "th" ? "081-234-5678 หรือ 1234567890123" : "081-234-5678 or ID card / TAX ID"}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-1 md:gap-2">
                                            <div className="space-y-1">
                                                <Label>{locale === "th" ? "ชื่อธนาคาร" : "Bank Name"}</Label>
                                                <Select value={bankName} onValueChange={setBankName}>
                                                    <SelectTrigger size="sm" className="w-full">
                                                        <SelectValue placeholder={locale === "th" ? "เลือกธนาคาร" : "Select Bank"} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="PromptPay">PromptPay</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label>{locale === "th" ? "ชื่อบัญชี" : "Account Name"}</Label>
                                                <Input
                                                    size="sm"
                                                    type="text"
                                                    id="reg_acc_name"
                                                    value={accountName}
                                                    onChange={(e) => setAccountName(e.target.value)}
                                                    placeholder={locale === "th" ? "นายสมชาย ใจดี" : "John Doe"}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end mt-2 md:mt-4">
                                        <Button
                                            size="sm"
                                            type="submit"
                                            disabled={isRegSaving}
                                            className="w-full bg-violet-600 hover:bg-violet-700"
                                        >
                                            {isRegSaving && (
                                                <Loader2 className="size-4 animate-spin" />
                                            )}
                                            {locale === "th" ? "บันทึกการตั้งค่า" : "Save Settings"}
                                        </Button>
                                    </div>
                                </form>
                            )}

                            <div>
                                <Registrations
                                    tournamentId={tournamentId}
                                    categoryId={activeCategoryId || undefined}
                                />
                            </div>
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
        </aside>
    );
}

