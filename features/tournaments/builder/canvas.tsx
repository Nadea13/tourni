"use client";

import { TournamentTemplateDialog } from "@/features/dialogs";
import { useCallback, useEffect, useState, useMemo } from "react";
import {
    Background,
    BackgroundVariant,
    ConnectionLineType,
    ConnectionMode,
    Controls,
    ReactFlow,
    ReactFlowProvider,
    useReactFlow,
    Connection,
    Edge,
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
    Plus, Users, X,
    Settings, ShieldAlert,
    Calendar, ChevronLeft, ChevronRight, ExternalLink, Megaphone,
    Calendar as CalendarIcon, Lock, Unlock, Share2, Trophy, MoreVertical, ClipboardEdit, Heart,
    LayoutGrid, ListOrdered, ArrowLeft, Loader2
} from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { HelpCircle } from "lucide-react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import {
    Dropdown,
    DropdownContent,
    DropdownGroup,
    DropdownItem,
    DropdownTrigger,
    DropdownValue,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/dropdown";
import {
    ActionMenu,
    ActionMenuContent,
    ActionMenuItem,
    ActionMenuTrigger,
} from "@/components/ui/action-menu";
import { addDays, subDays, addMonths, subMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { formatDate } from "@/lib/date";
import { saveBracketCanvas } from "@/actions/tournaments/bracket";
import { updateTournament } from "@/actions/tournaments/general";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/ui/header";
import { ApiClient } from "@/lib/api-client";
import { useBracketStore } from "@/lib/stores/bracket-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocale, useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { BracketCanvasData, Match, Tournament, TournamentTeam, TournamentStatus, TournamentCategory, Team } from "@/types";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { MatchManager } from "@/features/tournaments/matches/match-manager";
import { TournamentSettings } from "@/features/tournaments/settings/tournament-settings";
import { Tab, TabOption } from "@/components/ui/tab";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { GroupNode } from "./group-node";
import { MatchNode } from "./match-node";
import { StandingNode } from "./standing-node";
import { TeamListNode } from "./team-list-node";
import { NodeSettings } from "./node-settings";
import { CreateCategoryForm } from "@/features/dialogs";
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
import { Link } from "@/i18n/routing";

const nodeTypes = {
    matchNode: MatchNode,
    groupNode: GroupNode,
    standingNode: StandingNode,
    teamListNode: TeamListNode,
};

function DeletableEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    selected,
}: EdgeProps) {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });
    const { deleteElements } = useReactFlow();

    const edgeStyle: React.CSSProperties = {
        stroke: "var(--border)",
        strokeWidth: 2,
        ...style,
    };

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
            {selected && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'all',
                        }}
                        className="nodrag nopan z-50"
                    >
                        <button
                            type="button"
                            className="w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteElements({ edges: [{ id }] });
                            }}
                            title="Delete connection"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}

const edgeTypes = {
    default: DeletableEdge,
    bezier: DeletableEdge,
};

interface CanvasProps {
    tournamentId: string;
    tournamentName: string;
    initialCanvasData: BracketCanvasData | null;
    isCompact?: boolean;
    readonly?: boolean;
    onClose?: () => void;
    tournament?: Tournament;
    hasFixtures?: boolean;
    teams?: TournamentTeam[];
    matches?: Match[];
    userPlan?: string;
}

interface RegistrationNotificationItem {
    id: string;
    tournament_category_id?: string | number | null;
    category_id?: string | number | null;
    registration_status?: string | null;
    status?: string | null;
    payment_status?: string | null;
    roster_status?: string | null;
    unlock_requested?: boolean | null;
}

function CanvasInternal({
    tournamentId,
    tournamentName,
    readonly = false,
    onClose,
    tournament,
    hasFixtures = false,
    teams: initialTeamsData = [],
    matches: initialMatchesData = [],
    userPlan,
}: CanvasProps) {
    const locale = useLocale();
    const { toast } = useToast();
    const t = useTranslations("Tournament");
    const tSettings = useTranslations("Settings");
    const { screenToFlowPosition } = useReactFlow();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const updateUrlParams = useCallback((updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                params.delete(key);
            } else {
                params.set(key, value);
            }
        });
        const newQuery = params.toString();
        const targetUrl = newQuery ? `${pathname}?${newQuery}` : pathname;
        router.replace(targetUrl, { scroll: false });
    }, [pathname, router, searchParams]);

    const startTour = useCallback(() => {
        const driverObj = driver({
            showProgress: true,
            animate: true,
            steps: [
                {
                    element: "#tour-console-header",
                    popover: {
                        title: t("tour_console_welcome_title"),
                        description: t("tour_console_welcome_desc"),
                        side: "bottom" as const,
                        align: "start" as const
                    }
                },
                {
                    element: "#tour-console-name",
                    popover: {
                        title: t("tour_console_name_title"),
                        description: t("tour_console_name_desc"),
                        side: "bottom" as const,
                        align: "start" as const
                    }
                },
                {
                    element: "#tour-console-category",
                    popover: {
                        title: t("tour_console_category_title"),
                        description: t("tour_console_category_desc"),
                        side: "bottom" as const,
                        align: "start" as const
                    }
                },
                ...(document.getElementById("tour-console-add-components") ? [{
                    element: "#tour-console-add-components",
                    popover: {
                        title: t("tour_console_add_title"),
                        description: t("tour_console_add_desc"),
                        side: "left" as const,
                        align: "start" as const
                    }
                }] : []),
                ...(document.getElementById("tour-console-canvas-wrapper") ? [{
                    element: "#tour-console-canvas-wrapper",
                    popover: {
                        title: t("tour_console_canvas_title"),
                        description: t("tour_console_canvas_desc"),
                        side: "top" as const,
                        align: "start" as const
                    }
                }] : []),
                ...(document.getElementById("tour-console-sidebar-buttons") ? [{
                    element: "#tour-console-sidebar-buttons",
                    popover: {
                        title: t("tour_console_sidebar_title"),
                        description: t("tour_console_sidebar_desc"),
                        side: "left" as const,
                        align: "start" as const
                    }
                }] : [])
            ]
        });
        driverObj.drive();
    }, [t]);

    useEffect(() => {
        const hasSeenTour = localStorage.getItem("has_seen_console_tour");
        if (!hasSeenTour) {
            const timer = setTimeout(() => {
                startTour();
                localStorage.setItem("has_seen_console_tour", "true");
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [startTour]);

    // Dialog state for unsaved changes warning
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ type: 'navigate'; href: string } | { type: 'close' } | null>(null);

    // Lifted Filter States
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [filterStage, setFilterStage] = useState<string>("all");
    const [filterTeam, setFilterTeam] = useState<string>("all");
    const [viewDate, setViewDate] = useState(new Date());
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const [activeMatches, setActiveMatches] = useState<Match[]>([]);

    useEffect(() => {
        if (tournament?.sport) {
            useBracketStore.getState().setSport(tournament.sport);
        }
    }, [tournament?.sport]);

    const fetchMatches = useCallback(async (categoryId: string) => {
        if (!categoryId) return;
        try {
            const data = await ApiClient.fetch<any[]>(`/tournaments/${tournamentId}/categories/${categoryId}/matches`);
            if (data) {
                const mappedMatches = (data as Match[]).map(match => {
                    let match_date = match.match_date;
                    let match_time = match.match_time;
                    if (match.scheduled_at) {
                        const parts = match.scheduled_at.split('T');
                        match_date = parts[0];
                        match_time = parts[1]?.substring(0, 5) || null;
                    }

                    const home_team = match.home_team ? {
                        id: match.home_team.id || match.home_team_id || "",
                        name: match.home_team.name || "",
                        logo_url: (match.home_team as { logo_img?: string | null }).logo_img || match.home_team.logo_url || undefined
                    } : undefined;

                    const away_team = match.away_team ? {
                        id: match.away_team.id || match.away_team_id || "",
                        name: match.away_team.name || "",
                        logo_url: (match.away_team as { logo_img?: string | null }).logo_img || match.away_team.logo_url || undefined
                    } : undefined;

                    return {
                        ...match,
                        match_date,
                        match_time,
                        home_team,
                        away_team
                    };
                });

                // Sort mapped matches by date and time in JavaScript
                mappedMatches.sort((a, b) => {
                    if (a.match_date && b.match_date) {
                        if (a.match_date !== b.match_date) {
                            return a.match_date.localeCompare(b.match_date);
                        }
                        if (a.match_time && b.match_time) {
                            return a.match_time.localeCompare(b.match_time);
                        }
                    }
                    return 0;
                });

                setActiveMatches(mappedMatches);
                useBracketStore.getState().setMatches(mappedMatches);
            }
        } catch (error) {
            console.error("[Canvas Internal] Failed to fetch matches:", error);
        }
    }, [tournamentId]);


    // Calendar logic helpers
    const calendarDays = useMemo(() => {
        const days = [];
        const startOfViewMonth = startOfMonth(viewDate);
        const endOfViewMonth = endOfMonth(viewDate);
        const firstDay = getDay(startOfViewMonth);

        for (let i = 0; i < firstDay; i++) days.push(null);
        const interval = eachDayOfInterval({ start: startOfViewMonth, end: endOfViewMonth });
        interval.forEach(day => days.push(day));
        return days;
    }, [viewDate]);

    const {
        nodes,
        edges,
        isDirty,
        onNodesChange,
        onEdgesChange,
        onConnect,
        onReconnect,
        addMatchNode,
        addGroupNode,
        addStandingNode,
        addTeamListNode,
        hydrate,
        selectNode,
        activeNodeId,
        setActiveNodeId,
        markClean,
        getCanvasData,
        fetchTeams,
        teams,
        setTeams: setStoreTeams,
        activeCategoryId: storeCategoryId,
        setActiveCategoryId: setStoreCategoryId,
    } = useBracketStore();

    const canvasMatches = useMemo(() => {
        const result: Match[] = [];
        const processedMatchIds = new Set<string>();

        // 1. Iterate through all matchNodes on the canvas
        const matchNodes = nodes.filter(n => n.type === 'matchNode');

        matchNodes.forEach(node => {
            const nodeMatches = (node.data as {
                matches?: Array<{
                    id?: string;
                    dbId?: string;
                    matchId?: string;
                    placeholderA?: string;
                    placeholderB?: string;
                    match_date?: string;
                    match_time?: string;
                }>
            })?.matches || [];

            nodeMatches.forEach((m, idx) => {
                const matchIndex = idx + 1;
                // Look for existing active match from DB
                const dbMatch = activeMatches.find(am =>
                    (m.dbId && am.id === m.dbId) ||
                    (m.matchId && am.id === m.matchId) ||
                    (am.node_id === node.id && (am.match_index === matchIndex || (am as any).match_number === matchIndex))
                );

                if (dbMatch) {
                    processedMatchIds.add(dbMatch.id);
                    result.push({
                        ...dbMatch,
                        node_id: node.id,
                        match_index: matchIndex,
                        placeholder_a: dbMatch.placeholder_a || m.placeholderA || null,
                        placeholder_b: dbMatch.placeholder_b || m.placeholderB || null,
                        placeholder_home: dbMatch.placeholder_home || dbMatch.placeholder_a || m.placeholderA || null,
                        placeholder_away: dbMatch.placeholder_away || dbMatch.placeholder_b || m.placeholderB || null,
                        match_date: dbMatch.match_date || m.match_date || null,
                        match_time: dbMatch.match_time || m.match_time || null,
                    });
                } else {
                    // Match exists on canvas but not yet in DB
                    const syntheticId = m.dbId || m.matchId || m.id || `${node.id}-${matchIndex}`;
                    processedMatchIds.add(syntheticId);

                    // Check if placeholder matches an enrolled team
                    const homeTeam = teams.find(t => t.name === m.placeholderA);
                    const awayTeam = teams.find(t => t.name === m.placeholderB);

                    result.push({
                        id: syntheticId,
                        tournament_id: tournamentId,
                        tournament_category_id: storeCategoryId || null,
                        home_team_id: homeTeam ? (homeTeam.team_id || homeTeam.id) : null,
                        away_team_id: awayTeam ? (awayTeam.team_id || awayTeam.id) : null,
                        home_score: null,
                        away_score: null,
                        round: 1,
                        stage: nodeMatches.length > 1 ? 'group' : 'knockout',
                        is_manual: true,
                        status: 'scheduled',
                        match_date: m.match_date || null,
                        match_time: m.match_time || null,
                        scheduled_at: (m.match_date && m.match_time) ? `${m.match_date}T${m.match_time}:00Z` : null,
                        match_index: matchIndex,
                        node_id: node.id,
                        placeholder_a: m.placeholderA || null,
                        placeholder_b: m.placeholderB || null,
                        placeholder_home: m.placeholderA || null,
                        placeholder_away: m.placeholderB || null,
                        created_at: new Date().toISOString(),
                        home_team: homeTeam ? { id: homeTeam.team_id || homeTeam.id, name: homeTeam.name, logo_url: homeTeam.logo_url } : undefined,
                        away_team: awayTeam ? { id: awayTeam.team_id || awayTeam.id, name: awayTeam.name, logo_url: awayTeam.logo_url } : undefined,
                    });
                }
            });
        });

        // 2. Also include any remaining activeMatches that were not attached to nodes
        activeMatches.forEach(am => {
            if (!processedMatchIds.has(am.id)) {
                result.push(am);
            }
        });

        return result;
    }, [activeMatches, nodes, teams, tournamentId, storeCategoryId]);

    const datesWithMatches = useMemo(() => {
        return new Set(canvasMatches.map(m => m.match_date).filter(Boolean));
    }, [canvasMatches]);

    // Sync server-provided teams as initial state (before category-specific fetch runs)
    useEffect(() => {
        if (initialTeamsData && initialTeamsData.length > 0 && teams.length === 0) {
            const filtered = storeCategoryId
                ? initialTeamsData.filter((t: TournamentTeam & { tournament_category_id?: string | null }) => !t.tournament_category_id || String(t.tournament_category_id) === String(storeCategoryId))
                : initialTeamsData;
            setStoreTeams(filtered);
        }
    }, [initialTeamsData, storeCategoryId, teams.length, setStoreTeams]);
    const initialTab = searchParams.get("tab");
    const initialSubtab = searchParams.get("subtab");

    const [activeSidebar, setActiveSidebar] = useState<'teams' | 'settings' | 'schedule' | 'registration'>(() => {
        if (initialTab === 'schedule') return 'schedule';
        if (initialTab === 'settings') return 'settings';
        return 'teams';
    });
    type SettingsTab = 'general' | 'categories' | 'location' | 'bank' | 'staff' | 'danger';
    const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>(() => {
        if (initialSubtab && ['general', 'categories', 'location', 'bank', 'staff', 'danger'].includes(initialSubtab)) {
            return initialSubtab as SettingsTab;
        }
        return 'general';
    });

    const handleOpenRegistrationSettings = useCallback(() => {
        const currentActiveId = useBracketStore.getState().activeNodeId;
        if (currentActiveId === 'registration-setting-node') {
            setActiveNodeId(null);
            selectNode(null);
            updateUrlParams({ tab: null, subtab: null });
        } else {
            setActiveSidebar('teams');
            setActiveNodeId('registration-setting-node');
            selectNode('registration-setting-node');
            updateUrlParams({ tab: 'registration', subtab: null });
        }
    }, [setActiveNodeId, selectNode, updateUrlParams]);

    const handleOpenAnnouncementSettings = useCallback(() => {
        const currentActiveId = useBracketStore.getState().activeNodeId;
        if (currentActiveId === 'announcement-setting-node') {
            setActiveNodeId(null);
            selectNode(null);
            updateUrlParams({ tab: null, subtab: null });
        } else {
            setActiveSidebar('teams');
            setActiveNodeId('announcement-setting-node');
            selectNode('announcement-setting-node');
            updateUrlParams({ tab: 'announcements', subtab: null });
        }
    }, [setActiveNodeId, selectNode, updateUrlParams]);

    const handleOpenSponsorSettings = useCallback(() => {
        const currentActiveId = useBracketStore.getState().activeNodeId;
        if (currentActiveId === 'sponsor-setting-node') {
            setActiveNodeId(null);
            selectNode(null);
            updateUrlParams({ tab: null, subtab: null });
        } else {
            setActiveSidebar('teams');
            setActiveNodeId('sponsor-setting-node');
            selectNode('sponsor-setting-node');
            updateUrlParams({ tab: 'sponsors', subtab: null });
        }
    }, [setActiveNodeId, selectNode, updateUrlParams]);

    const handleOpenRankingSettings = useCallback(() => {
        const currentActiveId = useBracketStore.getState().activeNodeId;
        if (currentActiveId === 'ranking-setting-node') {
            setActiveNodeId(null);
            selectNode(null);
            updateUrlParams({ tab: null, subtab: null });
        } else {
            setActiveSidebar('teams');
            setActiveNodeId('ranking-setting-node');
            selectNode('ranking-setting-node');
            updateUrlParams({ tab: 'ranking', subtab: null });
        }
    }, [setActiveNodeId, selectNode, updateUrlParams]);



    const [categories, setCategories] = useState<TournamentCategory[]>([]);
    const [registrationTeams, setRegistrationTeams] = useState<RegistrationNotificationItem[]>([]);

    const fetchRegistrationNotifications = useCallback(async () => {
        if (!tournamentId) return;
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
            const res = await fetch(`${apiUrl}/tournaments/${tournamentId}/teams`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setRegistrationTeams(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Error fetching registration notifications:", err);
        }
    }, [tournamentId]);

    useEffect(() => {
        fetchRegistrationNotifications();
    }, [fetchRegistrationNotifications]);

    // Synchronize tab and subtab from URL
    useEffect(() => {
        const tab = searchParams.get("tab");
        const subtab = searchParams.get("subtab");

        if (tab === "announcements" || tab === "announcement") {
            setActiveSidebar("teams");
            setActiveNodeId("announcement-setting-node");
            selectNode("announcement-setting-node");
        } else if (tab === "registration") {
            setActiveSidebar("teams");
            setActiveNodeId("registration-setting-node");
            selectNode("registration-setting-node");
            fetchRegistrationNotifications();
        } else if (tab === "sponsors" || tab === "sponsor") {
            setActiveSidebar("teams");
            setActiveNodeId("sponsor-setting-node");
            selectNode("sponsor-setting-node");
        } else if (tab === "ranking" || tab === "rankings") {
            setActiveSidebar("teams");
            setActiveNodeId("ranking-setting-node");
            selectNode("ranking-setting-node");
        } else if (tab === "schedule") {
            setActiveNodeId(null);
            selectNode(null);
            setActiveSidebar("schedule");
        } else if (tab === "settings") {
            setActiveNodeId(null);
            selectNode(null);
            setActiveSidebar("settings");
            if (subtab && ['general', 'categories', 'location', 'bank', 'staff', 'danger'].includes(subtab)) {
                setActiveSettingsTab(subtab as SettingsTab);
            }
        } else if (!tab) {
            setActiveSidebar(prev => (prev === 'schedule' || prev === 'settings' ? 'teams' : prev));
            const currentActiveId = useBracketStore.getState().activeNodeId;
            if (['announcement-setting-node', 'registration-setting-node', 'sponsor-setting-node', 'ranking-setting-node'].includes(currentActiveId || '')) {
                setActiveNodeId(null);
                selectNode(null);
            }
        }
    }, [searchParams, fetchRegistrationNotifications, setActiveNodeId, selectNode]);

    const [isEditingName, setIsEditingName] = useState(false);
    const [currentName, setCurrentName] = useState(tournamentName);
    const [tempName, setTempName] = useState(tournamentName);
    const [currentStatus, setCurrentStatus] = useState<TournamentStatus>(tournament?.status || 'draft');
    const [isLocked, setIsLocked] = useState(readonly || tournament?.status === 'completed');
    const [isCategoryLoading, setIsCategoryLoading] = useState(false);
    const [userInvitationRole, setUserInvitationRole] = useState<string | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<TournamentStatus | null>(null);
    const [lockedStatusDialogOpen, setLockedStatusDialogOpen] = useState(false);

    const isStatusLocked = currentStatus === 'completed' || currentStatus === 'cancelled';

    const handleRequestStatusChange = (newStatus: TournamentStatus) => {
        if (readonly || isUpdatingStatus) return;
        if (newStatus === currentStatus) return;

        // If currently completed or cancelled, cannot change from toolbar dropdown
        if (isStatusLocked) {
            setLockedStatusDialogOpen(true);
            return;
        }

        setPendingStatus(newStatus);
        setStatusConfirmOpen(true);
    };

    const handleConfirmStatusChange = async () => {
        if (!pendingStatus) return;
        const target = pendingStatus;
        setStatusConfirmOpen(false);
        setPendingStatus(null);
        await handleSetStatus(target);
    };

    const handleSetStatus = async (newStatus: TournamentStatus) => {
        if (readonly || isUpdatingStatus) return;
        setIsUpdatingStatus(true);
        try {
            const formData = new FormData();
            formData.set("status", newStatus);
            const res = await updateTournament(tournamentId, null, formData);
            if (res.success) {
                setCurrentStatus(newStatus);
                const statusLabels: Record<TournamentStatus, { th: string; en: string }> = {
                    draft: { th: "แบบร่าง", en: "Draft" },
                    ongoing: { th: "กำลังแข่งขัน", en: "Ongoing" },
                    completed: { th: "เสร็จสิ้น", en: "Completed" },
                    cancelled: { th: "ยกเลิก", en: "Cancelled" },
                };
                const label = statusLabels[newStatus]?.[locale === 'th' ? 'th' : 'en'] || newStatus;
                toast({
                    title: locale === 'th' ? "สำเร็จ" : "Success",
                    description: locale === 'th'
                        ? `เปลี่ยนสถานะเป็น "${label}" เรียบร้อยแล้ว`
                        : `Status changed to "${label}" successfully`,
                });
            } else {
                toast({
                    title: "Error",
                    description: res.error || (locale === 'th' ? "ไม่สามารถเปลี่ยนสถานะได้" : "Failed to update status"),
                    variant: "destructive"
                });
            }
        } catch (err: any) {
            toast({
                title: "Error",
                description: err?.message || "An error occurred",
                variant: "destructive"
            });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    // Fetch user's invitation role for this tournament
    useEffect(() => {
        let isSubscribed = true;
        async function checkRole() {
            if (!tournamentId) return;
            try {
                const { getUserRole } = await import("@/actions/tournaments/staff");
                const roleRes = await getUserRole(tournamentId);
                if (isSubscribed && roleRes.success && roleRes.data) {
                    if (roleRes.data.isOwner) {
                        setUserInvitationRole("organizer");
                    } else {
                        // Check specific role from invitations
                        const { getAllUserInvites } = await import("@/actions/tournaments/staff");
                        const invitesRes = await getAllUserInvites();
                        const myInvite = (invitesRes.data || []).find((inv: any) => inv.tournament_id === tournamentId && inv.status === 'accepted');
                        setUserInvitationRole(myInvite?.role || (roleRes.data.role === 'admin' ? 'organizer' : 'staff'));
                    }
                }
            } catch (err) {
                console.error("Error checking user role in canvas:", err);
            }
        }
        checkRole();
        return () => {
            isSubscribed = false;
        };
    }, [tournamentId]);

    const settingsTabOptions = useMemo<TabOption<SettingsTab>[]>(() => {
        const options: TabOption<SettingsTab>[] = [
            { value: 'general', label: tSettings("general_info"), icon: Settings },
            { value: 'categories', label: tSettings("categories"), icon: Trophy },
        ];

        const possessesStaffAccess = Boolean(
            userPlan && (
                userPlan === "event" ||
                userPlan === "cup" ||
                userPlan === "cup_yearly" ||
                userPlan === "monthly" ||
                userPlan === "pro" ||
                userPlan === "yearly" ||
                userPlan === "pro_yearly" ||
                userPlan === "manager_pro" ||
                userPlan === "customs"
            )
        );

        if (possessesStaffAccess) {
            options.push({ value: 'staff', label: tSettings("staff"), icon: Users });
        }

        // Only show Danger Zone for owner / organizer (hide for co_organizer, staff, referee)
        const isCoOrganizer = userInvitationRole === 'co_organizer' || userInvitationRole === 'co-organizer';
        const isStaff = userInvitationRole === 'staff' || userInvitationRole === 'referee';
        if (!isCoOrganizer && !isStaff) {
            options.push({ value: 'danger', label: tSettings("danger_zone"), icon: ShieldAlert });
        }

        return options;
    }, [tSettings, userPlan, userInvitationRole]);


    // Sync isLocked with readonly prop or completed status if it changes
    useEffect(() => {
        if (currentStatus === 'completed') {
            setIsLocked(true);
        } else {
            setIsLocked(readonly);
        }
    }, [readonly, currentStatus]);

    // Warning popup when reloading/closing tab with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty && !readonly) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isDirty, readonly]);

    // Intercept client-side Next.js route navigation clicks
    useEffect(() => {
        if (readonly || isLocked || !isDirty) return;

        const handleAnchorClick = (e: MouseEvent) => {
            let target = e.target as HTMLElement | null;
            while (target && target.tagName !== 'A') {
                target = target.parentElement;
            }

            if (target instanceof HTMLAnchorElement) {
                const href = target.getAttribute('href');
                if (href) {
                    const currentPath = window.location.pathname;
                    let targetPath = '';
                    try {
                        const url = new URL(href, window.location.origin);
                        if (url.origin === window.location.origin) {
                            targetPath = url.pathname;
                        }
                    } catch {
                        // ignore
                    }

                    if (targetPath && targetPath !== currentPath) {
                        e.preventDefault();
                        e.stopPropagation();
                        setPendingAction({ type: 'navigate', href });
                        setShowUnsavedDialog(true);
                    }
                }
            }
        };

        document.addEventListener('click', handleAnchorClick, true);
        return () => {
            document.removeEventListener('click', handleAnchorClick, true);
        };
    }, [isDirty, readonly, isLocked]);

    const handleConfirmLeave = () => {
        setShowUnsavedDialog(false);
        if (pendingAction?.type === 'navigate') {
            router.push(pendingAction.href);
        } else if (pendingAction?.type === 'close') {
            if (onClose) onClose();
        }
        setPendingAction(null);
    };

    const handleCancelLeave = () => {
        setShowUnsavedDialog(false);
        setPendingAction(null);
    };

    // Read persisted category from URL (?category=id), fallback to null (first category)
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
        searchParams.get("category")
    );
    const hasPendingRegistration = useMemo(() => {
        return registrationTeams.some(item => {
            const itemCatId = item.tournament_category_id ?? item.category_id;
            const isCategoryMatch = !activeCategoryId || !itemCatId || String(itemCatId) === String(activeCategoryId);
            if (!isCategoryMatch) return false;
            return (
                item.registration_status === 'pending' ||
                item.status === 'pending' ||
                item.payment_status === 'pending' ||
                item.roster_status === 'pending' ||
                Boolean(item.unlock_requested)
            );
        });
    }, [registrationTeams, activeCategoryId]);
    const [ageCategories, setAgeCategories] = useState<{ id: number; category_name: string }[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const toCategoryId = useCallback((id: unknown) => String(id), []);

    useEffect(() => {
        if (initialMatchesData && initialMatchesData.length > 0 && activeCategoryId) {
            const filtered = initialMatchesData.filter(
                m => String(m.tournament_category_id) === String(activeCategoryId)
            );
            const mapped = filtered.map(match => {
                let match_date = match.match_date;
                let match_time = match.match_time;
                if (match.scheduled_at) {
                    const parts = match.scheduled_at.split('T');
                    match_date = parts[0];
                    match_time = parts[1]?.substring(0, 5) || null;
                }
                return {
                    ...match,
                    match_date,
                    match_time
                };
            });

            // Sort mapped matches by date and time in JavaScript
            mapped.sort((a, b) => {
                if (a.match_date && b.match_date) {
                    if (a.match_date !== b.match_date) {
                        return a.match_date.localeCompare(b.match_date);
                    }
                    if (a.match_time && b.match_time) {
                        return a.match_time.localeCompare(b.match_time);
                    }
                }
                return 0;
            });

            setActiveMatches(mapped);
            useBracketStore.getState().setMatches(mapped);
        }
    }, [initialMatchesData, activeCategoryId]);

    // Periodic refresh for live scores on canvas
    useEffect(() => {
        if (!activeCategoryId) return;
        const interval = setInterval(() => {
            fetchMatches(activeCategoryId);
        }, 5000);
        return () => clearInterval(interval);
    }, [activeCategoryId, fetchMatches]);

    // Fetch categories and age categories.
    // Pass targetCategoryId to switch to a specific category after loading (e.g. after creating one).
    const loadCategories = useCallback(async (targetCategoryId?: string) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
            const res = await fetch(`${apiUrl}/tournaments/${tournamentId}`, { cache: 'no-store' });
            if (!res.ok) return [];
            const data = await res.json();
            const rawCategories = data.categories || [];

            const catData: TournamentCategory[] = rawCategories.map((c: any) => ({
                id: c.id,
                tournament_id: c.tournament_id || tournamentId,
                name: c.name || c.category_name || "Open",
                age_category_id: c.age_category_id || c.age_min || 1,
                gender_type: c.gender_type || c.settings?.gender_type || 'male',
                max_teams: Number(c.max_teams || c.team_limit || 16),
                registration_fee: Number(c.registration_fee ?? c.settings?.registration_fee ?? 0),
                rules_config: c.rules_config ?? c.settings?.rules_config ?? null,
                canvas_data: c.canvas_data ?? c.settings?.canvas_data ?? null,
                age_categories: c.age_categories || {
                    category_name: c.category_name || c.name || "Open"
                }
            }));

            if (catData && catData.length > 0) {
                setCategories(catData);

                const fallbackCategoryId = toCategoryId(catData[0].id);
                const requestedCategoryId = targetCategoryId ?? searchParams.get("category") ?? activeCategoryId;
                const matchedCategory = requestedCategoryId
                    ? catData.find((c: TournamentCategory) => toCategoryId(c.id) === requestedCategoryId)
                    : null;
                const resolvedCategoryId = matchedCategory ? toCategoryId(matchedCategory.id) : fallbackCategoryId;
                const resolvedCategory = matchedCategory ?? catData[0];

                hydrate(resolvedCategory?.canvas_data ?? null);
                setActiveCategoryId(resolvedCategoryId);
                setStoreCategoryId(resolvedCategoryId);
                fetchTeams(resolvedCategoryId);
                fetchMatches(resolvedCategoryId);
            }

            return catData;
        } catch (err) {
            console.error("Error loading categories:", err);
            return [];
        }
    }, [tournamentId, hydrate, toCategoryId, searchParams, activeCategoryId, fetchMatches, fetchTeams, setStoreCategoryId]);

    useEffect(() => {
        loadCategories();

    }, []);

    useEffect(() => {
        const urlCategoryId = searchParams.get("category");
        if (!urlCategoryId || categories.length === 0 || urlCategoryId === activeCategoryId) {
            return;
        }

        const matchedCategory = categories.find((category) => toCategoryId(category.id) === urlCategoryId);
        if (!matchedCategory) {
            return;
        }

        hydrate(matchedCategory.canvas_data ?? null);
        setActiveCategoryId(urlCategoryId);
        setStoreCategoryId(urlCategoryId);
        fetchTeams(urlCategoryId);
        fetchMatches(urlCategoryId);
    }, [searchParams, categories, activeCategoryId, hydrate, setStoreCategoryId, fetchTeams, toCategoryId, fetchMatches]);

    useEffect(() => {
        setAgeCategories([
            { id: 1, category_name: "Open" },
            { id: 2, category_name: "U12" },
            { id: 3, category_name: "U14" },
            { id: 4, category_name: "U16" },
            { id: 5, category_name: "U18" },
            { id: 6, category_name: "35+" },
            { id: 7, category_name: "40+" }
        ]);
    }, []);

    // (Hydration is now handled directly in loadCategories and handleCategorySwitch)

    const getCategoryDisplayName = useCallback((cat: TournamentCategory) => {
        let ageName = cat.age_categories?.category_name || cat.name || (locale === 'th' ? 'รุ่นทั่วไป' : 'Open');
        if (locale === 'th' && (ageName.toLowerCase() === 'open' || ageName === 'Open')) {
            ageName = 'รุ่นทั่วไป';
        }
        const genderVal = cat.gender_type || (cat as any).settings?.gender_type;
        if (!genderVal || genderVal === 'open' || ageName === 'รุ่นทั่วไป' || ageName.toLowerCase() === 'open') {
            return ageName;
        }
        const gender = genderVal === 'male' ? (locale === 'th' ? 'ชาย' : 'Male')
            : genderVal === 'female' ? (locale === 'th' ? 'หญิง' : 'Female')
                : (locale === 'th' ? 'ผสม' : 'Mixed');
        return `${ageName} ${gender}`;
    }, [locale]);

    useEffect(() => {
        if (tournament?.status) {
            setCurrentStatus(tournament.status);
        }
    }, [tournament?.status]);

    const getCenterPos = () => {
        return screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
        });
    };

    const goToPrevDay = () => {
        const current = selectedDate ? new Date(selectedDate) : new Date();
        const prev = subDays(current, 1);
        setSelectedDate(format(prev, 'yyyy-MM-dd'));
    };

    const goToNextDay = () => {
        const current = selectedDate ? new Date(selectedDate) : new Date();
        const next = addDays(current, 1);
        setSelectedDate(format(next, 'yyyy-MM-dd'));
    };



    const [isSaving, setIsSaving] = useState(false);
    const [_lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

    // initialCanvasData is intentionally NOT used to hydrate here.
    // Each category's canvas_data is loaded independently via loadCategories.

    const handleSave = useCallback(async (showToast = false, force = false) => {
        if ((!isDirty && !force) || isSaving || readonly) return;

        setIsSaving(true);
        try {
            const canvasData = getCanvasData();
            const result = await saveBracketCanvas(tournamentId, canvasData, activeCategoryId || undefined);
            if (result.success) {
                markClean();
                setLastSavedAt(new Date());
                if (result.data) {
                    // Update local categories list cache
                    setCategories(prev => prev.map(c =>
                        c.id === activeCategoryId
                            ? { ...c, canvas_data: result.data ?? null }
                            : c
                    ));

                    // Sync dbIds into store nodes so subsequent edits don't recreate new matches
                    if (result.data.nodes) {
                        const storeNodes = useBracketStore.getState().nodes;
                        let hasChanges = false;
                        const updatedStoreNodes = storeNodes.map(storeNode => {
                            const serverNode = result.data?.nodes?.find(n => n.id === storeNode.id);
                            if (serverNode && serverNode.type === 'matchNode') {
                                const serverMatches = (serverNode.data as { matches?: unknown[] })?.matches;
                                if (serverMatches && JSON.stringify(serverMatches) !== JSON.stringify((storeNode.data as { matches?: unknown[] })?.matches)) {
                                    hasChanges = true;
                                    return {
                                        ...storeNode,
                                        data: {
                                            ...storeNode.data,
                                            matches: serverMatches
                                        }
                                    };
                                }
                            }
                            return storeNode;
                        });

                        if (hasChanges) {
                            useBracketStore.setState({ nodes: updatedStoreNodes });
                        }
                    }

                    if (activeCategoryId) {
                        fetchMatches(activeCategoryId);
                    }
                }
                if (showToast) {
                    toast({
                        title: locale === 'th' ? "บันทึกเรียบร้อย" : "Saved",
                        description: locale === 'th' ? "บันทึกข้อมูล Canvas เรียบร้อยแล้ว" : "Bracket canvas and matches saved successfully.",
                    });
                }
                return;
            }

            if (showToast) {
                toast({
                    title: locale === 'th' ? "เกิดข้อผิดพลาด" : "Error",
                    description: result.error || "Failed to save bracket canvas.",
                    variant: "destructive",
                });
            }
        } catch {
            if (showToast) {
                toast({
                    title: locale === 'th' ? "เกิดข้อผิดพลาด" : "Error",
                    description: "An unexpected error occurred.",
                    variant: "destructive",
                });
            }
        } finally {
            setIsSaving(false);
        }
    }, [getCanvasData, isDirty, isSaving, markClean, readonly, toast, tournamentId, activeCategoryId, locale, fetchMatches]);

    // Auto-save effect: save seamlessly in background like Figma/Canva
    // 1. Debounce timer is set to 800ms after user stops typing/dragging.
    // 2. Triggers INSTANT auto-save as soon as user blurs (clicks out of) an input field.
    useEffect(() => {
        if (!isDirty || isSaving || readonly) return;

        const timer = setTimeout(() => {
            handleSave(false);
        }, 800);

        return () => clearTimeout(timer);
    }, [isDirty, isSaving, readonly, handleSave, nodes, edges]);

    // Save immediately on focusout (when user finishes typing and clicks outside or presses Tab/Enter)
    useEffect(() => {
        if (readonly) return;

        const handleFocusOut = (e: FocusEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true')) {
                if (isDirty && !isSaving) {
                    handleSave(false);
                }
            }
        };

        window.addEventListener('focusout', handleFocusOut);
        return () => window.removeEventListener('focusout', handleFocusOut);
    }, [isDirty, isSaving, readonly, handleSave]);

    const handleCategorySwitch = useCallback(async (newCategoryId: string) => {
        const normalizedCategoryId = toCategoryId(newCategoryId);
        if (normalizedCategoryId === activeCategoryId) return;

        setIsCategoryLoading(true);
        if (isDirty) {
            await handleSave(false);
        }
        // Hydrate canvas from local cache and fetch teams for the new category
        const cached = categories.find(c => toCategoryId(c.id) === normalizedCategoryId);
        hydrate(cached?.canvas_data ?? null);
        setActiveCategoryId(normalizedCategoryId);
        setStoreCategoryId(normalizedCategoryId);

        try {
            await Promise.all([
                fetchTeams(normalizedCategoryId),
                fetchMatches(normalizedCategoryId)
            ]);
        } catch (error) {
            console.error("Error fetching category data:", error);
        } finally {
            setIsCategoryLoading(false);
        }

        // Persist to URL without adding a history entry
        const params = new URLSearchParams(searchParams.toString());
        params.set("category", normalizedCategoryId);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [activeCategoryId, isDirty, handleSave, categories, hydrate, fetchTeams, setStoreCategoryId, searchParams, pathname, toCategoryId, fetchMatches, router]);

    const [_isDragging, setIsDragging] = useState(false);

    // Keyboard shortcuts for undo, redo, copy, paste, cut
    useEffect(() => {
        if (readonly || isLocked) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            if (
                activeEl &&
                (activeEl.tagName === 'INPUT' ||
                    activeEl.tagName === 'TEXTAREA' ||
                    activeEl.getAttribute('contenteditable') === 'true')
            ) {
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifierKey = isMac ? e.metaKey : e.ctrlKey;

            if (modifierKey) {
                const key = e.key.toLowerCase();

                if (key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        useBracketStore.getState().redo();
                    } else {
                        useBracketStore.getState().undo();
                    }
                } else if (key === 'y') {
                    e.preventDefault();
                    useBracketStore.getState().redo();
                } else if (key === 'c') {
                    e.preventDefault();
                    useBracketStore.getState().copyNodes();
                } else if (key === 'v') {
                    e.preventDefault();
                    useBracketStore.getState().pasteNodes();
                } else if (key === 'x') {
                    e.preventDefault();
                    useBracketStore.getState().cutNodes();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [readonly, isLocked]);

    // Event-based state triggers
    const onNodeDragStart = useCallback(() => {
        setIsDragging(true);
        useBracketStore.getState().takeSnapshot();
    }, []);

    const handleClose = useCallback(() => {
        if (isDirty && !readonly) {
            setPendingAction({ type: 'close' });
            setShowUnsavedDialog(true);
        } else {
            if (onClose) onClose();
        }
    }, [isDirty, readonly, onClose]);

    const onDragStop = useCallback(() => {
        setIsDragging(false);
    }, []);

    const isValidConnection = useCallback((connection: Edge | Connection) => {
        return connection.source !== connection.target;
    }, []);

    const onConnectWithSave = useCallback((params: Connection) => {
        onConnect(params);
    }, [onConnect]);

    const onReconnectWithSave = useCallback((oldEdge: Edge, newConnection: Connection) => {
        onReconnect(oldEdge, newConnection);
    }, [onReconnect]);

    const onReconnectEnd = useCallback((event: MouseEvent | TouchEvent, edge: Edge) => {
        const targetIsHandle = (event.target as HTMLElement)?.classList?.contains('react-flow__handle');
        if (!targetIsHandle) {
            useBracketStore.getState().takeSnapshot();
            onEdgesChange([{ id: edge.id, type: 'remove' }]);
        }
    }, [onEdgesChange]);




    const handleOpenLinkRegister = useCallback(() => {
        const categoryQuery = activeCategoryId ? `?category=${activeCategoryId}` : "";
        const url = `${window.location.origin}/${locale}/registrations/${tournamentId}${categoryQuery}`;
        window.open(url, '_blank');
    }, [tournamentId, locale, activeCategoryId]);

    const handleOpenLinkDocumentions = useCallback(() => {
        const url = `${window.location.origin}/${locale}/documentions/${tournamentId}`;
        window.open(url, '_blank');
    }, [tournamentId, locale]);

    const handleOpenLink = useCallback(() => {
        const url = `${window.location.origin}/${locale}/tournaments/${tournamentId}`;
        window.open(url, '_blank');
    }, [tournamentId, locale]);

    const handleNameSave = async () => {
        if (!tempName || tempName === currentName) {
            setIsEditingName(false);
            setTempName(currentName);
            return;
        }

        const formData = new FormData();
        formData.append("name", tempName);
        formData.append("form_type", "general");

        try {
            const res = await updateTournament(tournamentId, null, formData);
            if (res.success) {
                setCurrentName(tempName);
                toast({
                    title: "Success",
                    description: "Tournament name updated successfully",
                });
            } else {
                setTempName(currentName);
                toast({
                    title: "Error",
                    description: res.error || "Failed to update tournament name",
                    variant: "destructive",
                });
            }
        } catch {
            setTempName(currentName);
        } finally {
            setIsEditingName(false);
        }
    };


    return (
        <div className={cn("flex flex-col h-full w-full border bg-card rounded-sm")}>
            {/* Mobile Portrait Orientation Warning removed - full portrait mobile layout enabled */}

            <div className="flex items-center justify-between p-2 lg:p-4 border-b gap-1" id="tour-console-header">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon-sm" asChild className="shrink-0 hover:bg-primary/10 hover:text-primary transition-all">
                            <Link href="/my-tournaments">
                                <ArrowLeft className="size-4" />
                            </Link>
                        </Button>
                        {isEditingName && !readonly ? (
                            <Input
                                size="sm"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onBlur={handleNameSave}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleNameSave();
                                    if (e.key === "Escape") {
                                        setIsEditingName(false);
                                        setTempName(currentName);
                                    }
                                }}
                                className="max-w-[200px]"
                                autoFocus
                            />
                        ) : (
                            <span
                                id="tour-console-name"
                                className={cn(
                                    "lg:text-lg text-base font-bold tracking-tight cursor-pointer hover:text-primary transition-colors",
                                    readonly && "cursor-default hover:text-foreground"
                                )}
                                onClick={() => !readonly && setIsEditingName(true)}
                            >
                                {currentName}
                            </span>
                        )}

                        <div className="flex items-center">
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={startTour}
                            >
                                <HelpCircle className="size-4" />
                            </Button>

                            {userInvitationRole !== 'staff' && userInvitationRole !== 'referee' && (
                                <Button
                                    variant={isLocked ? "default" : "ghost"}
                                    size="icon-sm"
                                    onClick={() => setIsLocked(!isLocked)}
                                    disabled={currentStatus === 'completed' || readonly}
                                    className={cn(
                                        "transition-all",
                                        isLocked
                                            ? "bg-warning"
                                            : "text-warning"
                                    )}
                                >
                                    {isLocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                                </Button>
                            )}
                        </div>

                        {/* Category Select Selector */}
                        <div id="tour-console-category">
                            <Select
                                value={activeCategoryId || ""}
                                onValueChange={(val) => {
                                    if (val === "create_new") {
                                        const isUnlimitedPlan = userPlan === "yearly" || userPlan === "pro_yearly" || userPlan === "cup_yearly" || userPlan === "customs";
                                        const isEventPlan = userPlan === "event" || userPlan === "monthly" || userPlan === "pro" || userPlan === "manager_pro" || userPlan === "cup";
                                        const maxAllowedCategories = isUnlimitedPlan ? Infinity : (isEventPlan ? 3 : 1);

                                        if (categories.length >= maxAllowedCategories) {
                                            toast({
                                                title: "Error",
                                                description: locale === 'th'
                                                    ? isEventPlan
                                                        ? "แพ็คเกจ Event สามารถสร้างรุ่นการแข่งขันได้สูงสุด 3 รุ่นต่อทัวร์นาเมนต์เท่านั้น"
                                                        : "ผู้ใช้ทั่วไปสามารถสร้างรุ่นการแข่งขันได้สูงสุด 1 รุ่นเท่านั้น กรุณาอัพเกรดแพ็คเกจ"
                                                    : isEventPlan
                                                        ? "Event plan allows up to 3 categories per tournament."
                                                        : "Free plan users can create only 1 tournament category. Please upgrade your plan.",
                                                variant: "destructive"
                                            });
                                            return;
                                        }
                                        setIsCreateOpen(true);
                                    } else {
                                        handleCategorySwitch(val);
                                    }
                                }}
                            >
                                <SelectTrigger size="sm" className="w-fit h-8 text-xs font-semibold">
                                    <SelectValue placeholder={locale === 'th' ? "เลือกรุ่นการแข่งขัน" : "Select Category"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.length === 0 ? (
                                        <SelectItem value="none" disabled className="text-muted-foreground text-xs font-semibold">
                                            {locale === 'th' ? "ยังไม่ได้ตั้งค่าประเภทการแข่งขัน" : "No categories configured yet"}
                                        </SelectItem>
                                    ) : (
                                        categories.map((cat) => {
                                            const catName = getCategoryDisplayName(cat);
                                            const teamCountText = cat.max_teams ? `${cat.max_teams} ${locale === 'th' ? 'ทีม' : 'Teams'}` : '';
                                            return (
                                                <SelectItem
                                                    key={cat.id}
                                                    value={toCategoryId(cat.id)}
                                                    className="cursor-pointer text-xs font-bold"
                                                >
                                                    {catName} {teamCountText}
                                                </SelectItem>
                                            );
                                        })
                                    )}
                                    {!readonly && userInvitationRole !== 'staff' && userInvitationRole !== 'referee' && (
                                        <SelectItem
                                            value="create_new"
                                            className="cursor-pointer text-xs font-bold text-primary focus:text-primary focus:bg-primary/10 flex items-center gap-1.5"
                                        >
                                            + {locale === 'th' ? "สร้างประเภทการแข่งขัน..." : "Create Category..."}
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Tournament Status Controller Dropdown */}
                        <div id="tour-console-status-toggle">
                            {readonly || userInvitationRole === 'staff' || userInvitationRole === 'referee' ? (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        currentStatus === 'ongoing' && "border-primary/40 bg-primary/10 text-primary",
                                        currentStatus === 'completed' && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
                                        currentStatus === 'cancelled' && "border-destructive/40 bg-destructive/10 text-destructive",
                                        (!currentStatus || currentStatus === 'draft') && "border-border bg-muted/40 text-muted-foreground"
                                    )}
                                >
                                    <span>
                                        {currentStatus === 'ongoing' && (locale === 'th' ? "กำลังแข่งขัน" : "Ongoing")}
                                        {currentStatus === 'completed' && (locale === 'th' ? "เสร็จสิ้น" : "Completed")}
                                        {currentStatus === 'cancelled' && (locale === 'th' ? "ยกเลิก" : "Cancelled")}
                                        {(!currentStatus || currentStatus === 'draft') && (locale === 'th' ? "แบบร่าง" : "Draft")}
                                    </span>
                                </Badge>
                            ) : isStatusLocked ? (
                                <Badge
                                    variant="outline"
                                    onClick={() => setLockedStatusDialogOpen(true)}
                                    className={cn(
                                        "w-fit h-8 rounded-sm text-xs font-bold gap-1.5 cursor-pointer transition-all px-2.5 select-none",
                                        currentStatus === 'completed' && "border-primary/50 bg-primary/10 text-primary hover:bg-primary/30",
                                        currentStatus === 'cancelled' && "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/30"
                                    )}
                                    title={locale === 'th' ? "สถานะถูกล็อค (คลิกเพื่อดูวิธีเปลี่ยนสถานะในพื้นที่อันตราย)" : "Status locked (Click for Danger Zone options)"}
                                >
                                    <span>
                                        {currentStatus === 'completed' && (locale === 'th' ? "เสร็จสิ้น (Completed)" : "Completed")}
                                        {currentStatus === 'cancelled' && (locale === 'th' ? "ยกเลิก (Cancelled)" : "Cancelled")}
                                    </span>
                                </Badge>
                            ) : (
                                <Dropdown
                                    value={currentStatus || 'draft'}
                                    onValueChange={(val) => handleRequestStatusChange(val as TournamentStatus)}
                                    disabled={isUpdatingStatus}
                                >
                                    <DropdownTrigger
                                        size="sm"
                                        className={cn(
                                            "w-fit h-8 text-xs font-bold gap-2 cursor-pointer transition-all",
                                            currentStatus === 'ongoing' && "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
                                            (!currentStatus || currentStatus === 'draft') && "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                                        )}
                                    >
                                        <DropdownValue placeholder={locale === 'th' ? "เลือกสถานะ" : "Select Status"} />
                                    </DropdownTrigger>
                                    <DropdownContent>
                                        <DropdownGroup>
                                            <DropdownItem
                                                value="draft"
                                                className="cursor-pointer text-xs font-semibold py-1.5 text-muted-foreground focus:bg-muted focus:text-foreground"
                                            >
                                                {locale === 'th' ? "แบบร่าง (Draft)" : "Draft"}
                                            </DropdownItem>
                                            <DropdownItem
                                                value="ongoing"
                                                className="cursor-pointer text-xs font-semibold py-1.5 text-primary focus:bg-primary/10 focus:text-primary"
                                            >
                                                {locale === 'th' ? "กำลังแข่งขัน (Ongoing)" : "Ongoing"}
                                            </DropdownItem>
                                            <DropdownItem
                                                value="completed"
                                                className="cursor-pointer text-xs font-semibold py-1.5 text-emerald-600 focus:bg-emerald-500/10 focus:text-emerald-600"
                                            >
                                                {locale === 'th' ? "เสร็จสิ้น (Completed)" : "Completed"}
                                            </DropdownItem>
                                            <DropdownItem
                                                value="cancelled"
                                                className="cursor-pointer text-xs font-semibold py-1.5 text-destructive focus:bg-destructive/10 focus:text-destructive"
                                            >
                                                {locale === 'th' ? "ยกเลิก (Cancelled)" : "Cancelled"}
                                            </DropdownItem>
                                        </DropdownGroup>
                                    </DropdownContent>
                                </Dropdown>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 lg:gap-2">
                    {onClose && (
                        <Button variant="ghost" size="icon-sm" onClick={handleClose}>
                            <X className="size-4" />
                        </Button>
                    )}
                    <div className="flex items-center">
                        {!readonly && (
                            <>
                                {/* Desktop Sidebar & Tool Buttons */}
                                <div className="hidden md:flex items-center" id="tour-console-sidebar-buttons">

                                    <div id="tour-console-share-select">
                                        <ActionMenu>
                                            <ActionMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    title={locale === 'th' ? "แชร์ลิงก์" : "Share"}
                                                    className="text-foreground"
                                                >
                                                    <Share2 className="size-4" />
                                                </Button>
                                            </ActionMenuTrigger>
                                            <ActionMenuContent align="end" className="w-fit min-w-[180px] bg-card shadow-2xl rounded-sm p-1">
                                                <ActionMenuItem
                                                    onClick={handleOpenLink}
                                                    className="cursor-pointer text-xs font-semibold flex items-center gap-2 py-1.5"
                                                >
                                                    <ExternalLink className="size-4 text-muted-foreground" />
                                                    <span>{locale === 'th' ? "เปิดหน้าทัวร์นาเมนต์" : "Open Tournament Page"}</span>
                                                </ActionMenuItem>
                                                <ActionMenuItem
                                                    onClick={handleOpenLinkRegister}
                                                    className="cursor-pointer text-xs font-semibold flex items-center gap-2 py-1.5"
                                                >
                                                    <ExternalLink className="size-4 text-muted-foreground" />
                                                    <span>{locale === 'th' ? "เปิดหน้าลงทะเบียน" : "Open Registration Page"}</span>
                                                </ActionMenuItem>
                                                <ActionMenuItem
                                                    onClick={handleOpenLinkDocumentions}
                                                    className="cursor-pointer text-xs font-semibold flex items-center gap-2 py-1.5"
                                                >
                                                    <ExternalLink className="size-4 text-muted-foreground" />
                                                    <span>{locale === 'th' ? "เปิดหน้ายื่นเอกสาร" : "Open Document Submission"}</span>
                                                </ActionMenuItem>
                                            </ActionMenuContent>
                                        </ActionMenu>
                                    </div>

                                    <Button
                                        variant={activeNodeId === 'announcement-setting-node' ? "default" : "ghost"}
                                        size="icon-sm"
                                        onClick={handleOpenAnnouncementSettings}
                                        title={locale === 'th' ? "ประกาศ" : "Announcements"}
                                        className={cn(
                                            "transition-all",
                                            activeNodeId === 'announcement-setting-node'
                                                ? "bg-primary"
                                                : "text-foreground"
                                        )}
                                    >
                                        <Megaphone className="size-4" />
                                    </Button>

                                    <Button
                                        variant={activeNodeId === 'registration-setting-node' ? "default" : "ghost"}
                                        size="icon-sm"
                                        onClick={handleOpenRegistrationSettings}
                                        title={locale === 'th' ? "การลงทะเบียน" : "Registration"}
                                        className={cn(
                                            "relative transition-all",
                                            activeNodeId === 'registration-setting-node'
                                                ? "bg-primary"
                                                : "text-foreground"
                                        )}
                                    >
                                        <ClipboardEdit className="size-4" />
                                        {hasPendingRegistration && (
                                            <span className="absolute top-0 right-0 bg-destructive rounded-full h-2 w-2 ring-2 ring-card" />
                                        )}
                                    </Button>

                                    <Button
                                        variant={activeNodeId === 'sponsor-setting-node' ? "default" : "ghost"}
                                        size="icon-sm"
                                        onClick={handleOpenSponsorSettings}
                                        title={locale === 'th' ? "ผู้สนับสนุน" : "Sponsors"}
                                        className={cn(
                                            "transition-all",
                                            activeNodeId === 'sponsor-setting-node'
                                                ? "bg-primary"
                                                : "text-foreground"
                                        )}
                                    >
                                        <Heart className="size-4" />
                                    </Button>

                                    <Button
                                        variant={activeNodeId === 'ranking-setting-node' ? "default" : "ghost"}
                                        size="icon-sm"
                                        onClick={handleOpenRankingSettings}
                                        title={locale === 'th' ? "อันดับการแข่งขัน" : "Tournament Rankings"}
                                        className={cn(
                                            "transition-all",
                                            activeNodeId === 'ranking-setting-node'
                                                ? "bg-primary"
                                                : "text-foreground"
                                        )}
                                    >
                                        <Trophy className="size-4" />
                                    </Button>

                                    <Button
                                        variant={activeSidebar === 'schedule' ? "default" : "ghost"}
                                        size="icon-sm"
                                        onClick={async () => {
                                            if (activeSidebar === 'schedule') {
                                                setActiveSidebar('teams');
                                                updateUrlParams({ tab: null, subtab: null });
                                            } else {
                                                setActiveNodeId(null);
                                                selectNode(null);
                                                setActiveSidebar('schedule');
                                                updateUrlParams({ tab: 'schedule', subtab: null });
                                                if (isDirty) {
                                                    await handleSave(false);
                                                }
                                                if (activeCategoryId) {
                                                    fetchMatches(activeCategoryId);
                                                }
                                            }
                                        }}
                                        className={cn(
                                            "transition-all",
                                            activeSidebar === 'schedule'
                                                ? "bg-primary"
                                                : "text-foreground"
                                        )}
                                    >
                                        <Calendar className="size-4" />
                                    </Button>

                                    {userInvitationRole !== 'staff' && userInvitationRole !== 'referee' && (
                                        <Button
                                            variant={activeSidebar === 'settings' ? "default" : "ghost"}
                                            size="icon-sm"
                                            onClick={() => {
                                                if (activeSidebar === 'settings') {
                                                    setActiveSidebar('teams');
                                                    updateUrlParams({ tab: null, subtab: null });
                                                } else {
                                                    setActiveNodeId(null);
                                                    selectNode(null);
                                                    setActiveSidebar('settings');
                                                    updateUrlParams({ tab: 'settings', subtab: activeSettingsTab || 'general' });
                                                }
                                            }}
                                            className={cn(
                                                "transition-all",
                                                activeSidebar === 'settings'
                                                    ? "bg-primary"
                                                    : "text-foreground"
                                            )}
                                        >
                                            <Settings className="size-4" />
                                        </Button>
                                    )}
                                </div>

                                {/* Mobile Menu (...) Dropdown or Close (X) button */}
                                <div className="flex md:hidden items-center" id="tour-console-mobile-menu">
                                    {(activeSidebar === 'schedule' || activeSidebar === 'settings' || Boolean(activeNodeId)) ? (
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => {
                                                setActiveSidebar('teams');
                                                setActiveNodeId(null);
                                                selectNode(null);
                                                updateUrlParams({ tab: null, subtab: null });
                                            }}
                                            className="text-foreground transition-all"
                                        >
                                            <X className="size-4" />
                                        </Button>
                                    ) : (
                                        <ActionMenu>
                                            <ActionMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="relative text-foreground"
                                                >
                                                    <MoreVertical className="size-4" />
                                                    {hasPendingRegistration && (
                                                        <span className="absolute top-2 right-2 bg-destructive rounded-full h-2 w-2 ring-2 ring-background animate-pulse" />
                                                    )}
                                                </Button>
                                            </ActionMenuTrigger>
                                            <ActionMenuContent align="end" className="w-56 bg-card shadow-2xl rounded-sm p-1">
                                                <ActionMenuItem
                                                    onClick={handleOpenAnnouncementSettings}
                                                    className="cursor-pointer text-xs font-semibold flex items-center gap-2 py-2"
                                                >
                                                    <Megaphone className="size-4" />
                                                    <span>{locale === 'th' ? "ประกาศ" : "Announcement"}</span>
                                                </ActionMenuItem>

                                                <ActionMenuItem
                                                    onClick={handleOpenRegistrationSettings}
                                                    className="cursor-pointer text-xs font-semibold flex items-center justify-between py-2"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <ClipboardEdit className="size-4" />
                                                        <span>{locale === 'th' ? "การลงทะเบียน" : "Registration"}</span>
                                                    </div>
                                                    {hasPendingRegistration && (
                                                        <span className="bg-destructive text-destructive-foreground text-[9px] px-1.5 py-0.5 rounded-full font-bold">New</span>
                                                    )}
                                                </ActionMenuItem>

                                                <ActionMenuItem
                                                    onClick={handleOpenSponsorSettings}
                                                    className="cursor-pointer text-xs font-semibold flex items-center gap-2 py-2"
                                                >
                                                    <Heart className="size-4" />
                                                    <span>{locale === 'th' ? "ผู้สนับสนุน" : "Sponsors"}</span>
                                                </ActionMenuItem>

                                                <ActionMenuItem
                                                    onClick={async () => {
                                                        setActiveNodeId(null);
                                                        selectNode(null);
                                                        setActiveSidebar('schedule');
                                                        updateUrlParams({ tab: 'schedule', subtab: null });
                                                        if (isDirty) {
                                                            await handleSave(false);
                                                        }
                                                        if (activeCategoryId) {
                                                            fetchMatches(activeCategoryId);
                                                        }
                                                    }}
                                                    className="cursor-pointer text-xs font-semibold flex items-center gap-2 py-2"
                                                >
                                                    <Calendar className="size-4" />
                                                    <span>{locale === 'th' ? "ตารางการแข่งขัน" : "Schedule"}</span>
                                                </ActionMenuItem>

                                                {userInvitationRole !== 'staff' && userInvitationRole !== 'referee' && (
                                                    <ActionMenuItem
                                                        onClick={() => {
                                                            setActiveNodeId(null);
                                                            selectNode(null);
                                                            setActiveSidebar('settings');
                                                            updateUrlParams({ tab: 'settings', subtab: activeSettingsTab || 'general' });
                                                        }}
                                                        className="cursor-pointer text-xs font-semibold flex items-center gap-2 py-2"
                                                    >
                                                        <Settings className="size-4" />
                                                        <span>{locale === 'th' ? "ตั้งค่าทัวร์นาเมนต์" : "Settings"}</span>
                                                    </ActionMenuItem>
                                                )}

                                                <div className="border-t my-1" />

                                                <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground/60">
                                                    {locale === 'th' ? "ลิงก์และการแชร์" : "Links & Share"}
                                                </div>

                                                <ActionMenuItem
                                                    onClick={handleOpenLink}
                                                    className="cursor-pointer text-xs flex items-center gap-2 py-1.5"
                                                >
                                                    <ExternalLink className="size-4" />
                                                    <span>{locale === 'th' ? "เปิดหน้าทัวร์นาเมนต์" : "Open Tournament Page"}</span>
                                                </ActionMenuItem>

                                                <ActionMenuItem
                                                    onClick={handleOpenLinkRegister}
                                                    className="cursor-pointer text-xs flex items-center gap-2 py-1.5"
                                                >
                                                    <ExternalLink className="size-4" />
                                                    <span>{locale === 'th' ? "เปิดหน้าลงทะเบียน" : "Open Registration Page"}</span>
                                                </ActionMenuItem>

                                                <ActionMenuItem
                                                    onClick={handleOpenLinkDocumentions}
                                                    className="cursor-pointer text-xs flex items-center gap-2 py-1.5"
                                                >
                                                    <ExternalLink className="size-4" />
                                                    <span>{locale === 'th' ? "เปิดหน้ายื่นเอกสาร" : "Open Document Submission"}</span>
                                                </ActionMenuItem>
                                            </ActionMenuContent>
                                        </ActionMenu>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative min-h-0">
                {isCategoryLoading ? (
                    <>
                        {/* Main Flow Editor Area Skeleton */}
                        <div className="flex-1 relative flex items-center justify-center bg-muted/5 overflow-hidden animate-pulse">
                            {/* Grid Background Lines (Dot Pattern style representation) */}
                            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] opacity-50" />

                            {/* Floating Nodes Skeletons */}
                            <div className="relative w-full h-full flex items-center justify-center gap-12 p-8">
                                {/* Round 1 Column */}
                                <div className="space-y-16">
                                    {[...Array(2)].map((_, idx) => (
                                        <div key={idx} className="w-64 border rounded-sm p-3 bg-card space-y-2 relative shadow-sm">
                                            <div className="flex justify-between">
                                                <Skeleton className="h-4 w-12 rounded-sm" />
                                                <Skeleton className="h-4 w-20 rounded-sm" />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center p-1 bg-muted/20 rounded-sm">
                                                    <Skeleton className="h-4 w-24 rounded-sm" />
                                                    <Skeleton className="h-4 w-6 rounded-sm" />
                                                </div>
                                                <div className="flex justify-between items-center p-1 bg-muted/20 rounded-sm">
                                                    <Skeleton className="h-4 w-24 rounded-sm" />
                                                    <Skeleton className="h-4 w-6 rounded-sm" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Round 2 Column */}
                                <div className="space-y-32">
                                    <div className="w-64 border rounded-sm p-3 bg-card space-y-2 relative shadow-sm">
                                        <div className="flex justify-between">
                                            <Skeleton className="h-4 w-12 rounded-sm" />
                                            <Skeleton className="h-4 w-20 rounded-sm" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center p-1 bg-muted/20 rounded-sm">
                                                <Skeleton className="h-4 w-24 rounded-sm" />
                                                <Skeleton className="h-4 w-6 rounded-sm" />
                                            </div>
                                            <div className="flex justify-between items-center p-1 bg-muted/20 rounded-sm">
                                                <Skeleton className="h-4 w-24 rounded-sm" />
                                                <Skeleton className="h-4 w-6 rounded-sm" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {activeSidebar === 'schedule' && tournament ? (
                            <div className="absolute inset-0 z-20 flex flex-col">
                                <div className="flex flex-col md:flex-row flex-1 overflow-hidden bg-card">
                                    {/* Mobile Schedule Controls Bar */}
                                    <div className="flex md:hidden flex-row overflow-x-auto border-b p-2 gap-2 bg-card shrink-0 custom-scrollbar items-center whitespace-nowrap z-10">
                                        {/* Date Filter */}
                                        <div className="flex items-center border bg-card rounded-sm shrink-0 h-8">
                                            <button
                                                onClick={() => setSelectedDate(null)}
                                                className={cn(
                                                    "px-2.5 h-full text-xs font-semibold tracking-tight transition-all border-r rounded-l-sm flex items-center",
                                                    selectedDate === null
                                                        ? "bg-primary text-black"
                                                        : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                {locale === 'th' ? "ทั้งหมด" : "ALL"}
                                            </button>
                                            <div className="flex items-center justify-between px-1 gap-0.5 h-full">
                                                <button onClick={goToPrevDay} className="p-1 hover:text-primary text-muted-foreground transition-colors">
                                                    <ChevronLeft className="size-4" />
                                                </button>
                                                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-7 gap-1 px-1.5 hover:bg-muted transition-all">
                                                            <CalendarIcon className="size-4 text-primary" />
                                                            <span className="text-xs font-semibold tracking-tight truncate">
                                                                {selectedDate ? formatDate(selectedDate, "d MMM yyyy", locale) : (locale === 'th' ? "วันนี้" : "TODAY")}
                                                            </span>
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-80 p-0 bg-card rounded-sm shadow-2xl" align="start" side="bottom" sideOffset={5}>
                                                        <div className="p-3 border-b flex items-center justify-between bg-muted/20">
                                                            <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1 hover:text-primary transition-colors">
                                                                <ChevronLeft className="size-4" />
                                                            </button>
                                                            <span className="text-xs font-black tracking-widest">
                                                                {viewDate.toLocaleString(locale === 'th' ? 'th-TH' : 'en-US', { month: 'long', year: 'numeric' })}
                                                            </span>
                                                            <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1 hover:text-primary transition-colors">
                                                                <ChevronRight className="size-4" />
                                                            </button>
                                                        </div>
                                                        <div className="p-4 space-y-4">
                                                            <div className="grid grid-cols-7 gap-1">
                                                                {(locale === 'th' ? ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map((d, idx) => (
                                                                    <div key={`${d}-${idx}`} className="text-[9px] text-center font-black opacity-30">{d}</div>
                                                                ))}
                                                            </div>
                                                            <div className="grid grid-cols-7 gap-1">
                                                                {calendarDays.map((day, i) => {
                                                                    if (!day) return <div key={`empty-${i}`} />;
                                                                    const dateStr = format(day, 'yyyy-MM-dd');
                                                                    const isSel = selectedDate === dateStr;
                                                                    const hasMatch = datesWithMatches.has(dateStr);
                                                                    const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
                                                                    const isOutsideRange = !!((tournament?.start_date && dateStr < tournament.start_date) || (tournament?.end_date && dateStr > tournament.end_date));

                                                                    return (
                                                                        <button
                                                                            key={dateStr}
                                                                            disabled={isOutsideRange}
                                                                            onClick={() => {
                                                                                setSelectedDate(dateStr);
                                                                                setIsCalendarOpen(false);
                                                                            }}
                                                                            className={cn(
                                                                                "h-9 flex flex-col items-center justify-center relative transition-all",
                                                                                isSel ? "bg-primary text-black font-black" : "hover:bg-muted text-muted-foreground hover:text-foreground",
                                                                                isToday && !isSel && "border border-primary text-primary",
                                                                                isOutsideRange && "opacity-20 cursor-not-allowed grayscale"
                                                                            )}
                                                                        >
                                                                            <span className="text-[11px]">{format(day, 'd')}</span>
                                                                            {hasMatch && (
                                                                                <div className={cn(
                                                                                    "absolute bottom-1.5 h-1 w-1 rounded-full",
                                                                                    isSel ? "bg-black" : "bg-primary"
                                                                                )} />
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                                                                    setViewDate(new Date());
                                                                    setIsCalendarOpen(false);
                                                                }}
                                                                className="w-full text-[10px] font-black tracking-widest h-9 hover:bg-primary hover:text-black hover:border-primary transition-all"
                                                            >
                                                                {locale === 'th' ? "กลับไปที่วันนี้" : "BACK TO TODAY"}
                                                            </Button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                                <button onClick={goToNextDay} className="p-1 hover:text-primary text-muted-foreground transition-colors">
                                                    <ChevronRight className="size-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Stage Filter */}
                                        <Select value={filterStage} onValueChange={setFilterStage}>
                                            <SelectTrigger size="sm" className="w-[130px] shrink-0">
                                                <SelectValue placeholder={locale === 'th' ? "รอบการแข่งขัน" : "Stage"} />
                                            </SelectTrigger>
                                            <SelectContent className="bg-card shadow-2xl">
                                                <SelectItem value="all" className="font-semibold text-xs">
                                                    {locale === 'th' ? "ทั้งหมด" : "ALL"}
                                                </SelectItem>
                                                <SelectItem value="group" className="font-semibold text-xs">
                                                    {locale === 'th' ? "รอบแบ่งกลุ่ม (ทั้งหมด)" : "GROUP STAGE (ALL)"}
                                                </SelectItem>
                                                {nodes
                                                    .filter(n => n.type === 'groupNode')
                                                    .map(node => {
                                                        const label = (node.data as { label?: string })?.label || "Group";
                                                        return (
                                                            <SelectItem
                                                                key={node.id}
                                                                value={label}
                                                                className="font-semibold text-xs pl-4"
                                                            >
                                                                - {label}
                                                            </SelectItem>
                                                        );
                                                    })
                                                }
                                                <SelectItem value="knockout" className="font-semibold text-xs">
                                                    {locale === 'th' ? "รอบน็อคเอาท์" : "KNOCKOUT STAGE"}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>

                                        {/* Team Filter */}
                                        <Select value={filterTeam} onValueChange={setFilterTeam}>
                                            <SelectTrigger size="sm" className="w-[130px] shrink-0">
                                                <SelectValue placeholder={locale === 'th' ? "เลือกทีม" : "Select Team"} />
                                            </SelectTrigger>
                                            <SelectContent className="bg-card shadow-2xl">
                                                <SelectItem value="all" className="font-semibold text-xs">
                                                    {locale === 'th' ? "แสดงทั้งหมด" : "SHOW ALL"}
                                                </SelectItem>
                                                {teams.map(team => (
                                                    <SelectItem key={team.id} value={team.id} className="font-semibold text-xs">
                                                        {team.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Desktop Controls Sidebar */}
                                    <aside className="hidden md:flex w-64 border-r flex-col shrink-0 p-3 bg-card gap-4 z-10">
                                        {/* Date Filter */}
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                {locale === 'th' ? "เลือกวันที่" : "Date Selection"}
                                            </Label>
                                            <div className="flex items-center border bg-card rounded-sm h-9 overflow-hidden">
                                                <button
                                                    onClick={() => setSelectedDate(null)}
                                                    className={cn(
                                                        "px-3 h-full text-xs font-semibold tracking-tight transition-all border-r flex items-center shrink-0",
                                                        selectedDate === null
                                                            ? "bg-primary text-black"
                                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                    )}
                                                >
                                                    {locale === 'th' ? "ทั้งหมด" : "ALL"}
                                                </button>
                                                <div className="flex items-center justify-between flex-1 px-1 h-full">
                                                    <button onClick={goToPrevDay} className="p-1 hover:text-primary text-muted-foreground transition-colors rounded-sm hover:bg-muted">
                                                        <ChevronLeft className="size-4" />
                                                    </button>
                                                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 hover:bg-muted transition-all flex-1 justify-center">
                                                                <CalendarIcon className="size-4 text-primary shrink-0" />
                                                                <span className="text-xs font-semibold tracking-tight truncate">
                                                                    {selectedDate ? formatDate(selectedDate, "d MMM yyyy", locale) : (locale === 'th' ? "วันนี้" : "TODAY")}
                                                                </span>
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-80 p-0 bg-card rounded-sm shadow-2xl" align="start" side="right" sideOffset={10}>
                                                            <div className="p-3 border-b flex items-center justify-between bg-muted/20">
                                                                <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1 hover:text-primary transition-colors">
                                                                    <ChevronLeft className="size-4" />
                                                                </button>
                                                                <span className="text-xs font-black tracking-widest">
                                                                    {viewDate.toLocaleString(locale === 'th' ? 'th-TH' : 'en-US', { month: 'long', year: 'numeric' })}
                                                                </span>
                                                                <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1 hover:text-primary transition-colors">
                                                                    <ChevronRight className="size-4" />
                                                                </button>
                                                            </div>
                                                            <div className="p-4 space-y-4">
                                                                <div className="grid grid-cols-7 gap-1">
                                                                    {(locale === 'th' ? ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map((d, idx) => (
                                                                        <div key={`${d}-${idx}`} className="text-[9px] text-center font-black opacity-30">{d}</div>
                                                                    ))}
                                                                </div>
                                                                <div className="grid grid-cols-7 gap-1">
                                                                    {calendarDays.map((day, i) => {
                                                                        if (!day) return <div key={`empty-${i}`} />;
                                                                        const dateStr = format(day, 'yyyy-MM-dd');
                                                                        const isSel = selectedDate === dateStr;
                                                                        const hasMatch = datesWithMatches.has(dateStr);
                                                                        const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
                                                                        const isOutsideRange = !!((tournament?.start_date && dateStr < tournament.start_date) || (tournament?.end_date && dateStr > tournament.end_date));

                                                                        return (
                                                                            <button
                                                                                key={dateStr}
                                                                                disabled={isOutsideRange}
                                                                                onClick={() => {
                                                                                    setSelectedDate(dateStr);
                                                                                    setIsCalendarOpen(false);
                                                                                }}
                                                                                className={cn(
                                                                                    "h-9 flex flex-col items-center justify-center relative transition-all",
                                                                                    isSel ? "bg-primary text-black font-black" : "hover:bg-muted text-muted-foreground hover:text-foreground",
                                                                                    isToday && !isSel && "border border-primary text-primary",
                                                                                    isOutsideRange && "opacity-20 cursor-not-allowed grayscale"
                                                                                )}
                                                                            >
                                                                                <span className="text-[11px]">{format(day, 'd')}</span>
                                                                                {hasMatch && (
                                                                                    <div className={cn(
                                                                                        "absolute bottom-1.5 h-1 w-1 rounded-full",
                                                                                        isSel ? "bg-black" : "bg-primary"
                                                                                    )} />
                                                                                )}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                                                                        setViewDate(new Date());
                                                                        setIsCalendarOpen(false);
                                                                    }}
                                                                    className="w-full text-[10px] font-black tracking-widest h-9 hover:bg-primary hover:text-black hover:border-primary transition-all"
                                                                >
                                                                    {locale === 'th' ? "กลับไปที่วันนี้" : "BACK TO TODAY"}
                                                                </Button>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                    <button onClick={goToNextDay} className="p-1 hover:text-primary text-muted-foreground transition-colors rounded-sm hover:bg-muted">
                                                        <ChevronRight className="size-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Stage Filter */}
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                {locale === 'th' ? "ตัวกรองรอบการแข่งขัน" : "Stage Filter"}
                                            </Label>
                                            <Select value={filterStage} onValueChange={setFilterStage}>
                                                <SelectTrigger size="sm" className="w-full">
                                                    <SelectValue placeholder={locale === 'th' ? "รอบการแข่งขัน" : "Stage"} />
                                                </SelectTrigger>
                                                <SelectContent className="bg-card shadow-2xl">
                                                    <SelectItem value="all" className="font-semibold text-xs">
                                                        {locale === 'th' ? "ทั้งหมด" : "ALL"}
                                                    </SelectItem>
                                                    <SelectItem value="group" className="font-semibold text-xs">
                                                        {locale === 'th' ? "รอบแบ่งกลุ่ม (ทั้งหมด)" : "GROUP STAGE (ALL)"}
                                                    </SelectItem>
                                                    {nodes
                                                        .filter(n => n.type === 'groupNode')
                                                        .map(node => {
                                                            const label = (node.data as { label?: string })?.label || "Group";
                                                            return (
                                                                <SelectItem
                                                                    key={node.id}
                                                                    value={label}
                                                                    className="font-semibold text-xs pl-4"
                                                                >
                                                                    - {label}
                                                                </SelectItem>
                                                            );
                                                        })
                                                    }
                                                    <SelectItem value="knockout" className="font-semibold text-xs">
                                                        {locale === 'th' ? "รอบน็อคเอาท์" : "KNOCKOUT STAGE"}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Team Filter */}
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                {locale === 'th' ? "ตัวกรองทีม" : "Team Filter"}
                                            </Label>
                                            <Select value={filterTeam} onValueChange={setFilterTeam}>
                                                <SelectTrigger size="sm" className="w-full">
                                                    <SelectValue placeholder={locale === 'th' ? "เลือกทีม" : "Select Team"} />
                                                </SelectTrigger>
                                                <SelectContent className="bg-card shadow-2xl">
                                                    <SelectItem value="all" className="font-semibold text-xs">
                                                        {locale === 'th' ? "แสดงทั้งหมด" : "SHOW ALL"}
                                                    </SelectItem>
                                                    {teams.map(team => (
                                                        <SelectItem key={team.id} value={team.id} className="font-semibold text-xs">
                                                            {team.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </aside>

                                    {/* Main Content */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        <div className="p-2 lg:p-4">
                                            <MatchManager
                                                matches={filterTeam === "all"
                                                    ? canvasMatches
                                                    : canvasMatches.filter(m => {
                                                        const selTeam = teams.find(t => t.id === filterTeam);
                                                        const targetIds = selTeam
                                                            ? [selTeam.id, selTeam.team_id].filter(Boolean) as string[]
                                                            : [filterTeam];
                                                        return targetIds.includes(m.home_team_id || "") ||
                                                            targetIds.includes(m.away_team_id || "") ||
                                                            (m.home_team?.id && targetIds.includes(m.home_team.id)) ||
                                                            (m.away_team?.id && targetIds.includes(m.away_team.id));
                                                    })
                                                }
                                                teams={teams as unknown as Team[]}
                                                tournamentId={tournament.id}
                                                format={tournament.format}
                                                startDate={tournament.start_date}
                                                endDate={tournament.end_date}
                                                externalFilterStage={filterStage}
                                                externalSelectedDate={selectedDate}
                                                canvasData={getCanvasData()}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {activeSidebar === 'settings' && tournament && userInvitationRole !== 'staff' && userInvitationRole !== 'referee' ? (
                            <div className="absolute inset-0 z-20 flex flex-col">
                                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                                    {/* Mobile Settings Tabs Bar using Tab component */}
                                    <div className="md:hidden border-b p-2 bg-card shrink-0 overflow-x-auto custom-scrollbar">
                                        <Tab
                                            options={settingsTabOptions}
                                            value={activeSettingsTab}
                                            onChange={(val) => {
                                                setActiveSettingsTab(val);
                                                updateUrlParams({ tab: 'settings', subtab: val });
                                            }}
                                            orientation="horizontal"
                                            className="border-none p-0 flex-nowrap min-w-max"
                                            variant="sidebar"
                                        />
                                    </div>

                                    {/* Desktop Settings Sidebar using Tab component */}
                                    <aside className="hidden md:flex w-64 border-r flex-col shrink-0 p-3 bg-card">
                                        <div className="pb-3 px-1">
                                            <Header level={6}>
                                                {locale === 'th' ? "การตั้งค่าทัวร์นาเมนต์" : "Tournament Settings"}
                                            </Header>
                                        </div>
                                        <Tab
                                            options={settingsTabOptions}
                                            value={activeSettingsTab}
                                            onChange={(val) => {
                                                setActiveSettingsTab(val);
                                                updateUrlParams({ tab: 'settings', subtab: val });
                                            }}
                                            orientation="vertical"
                                            className="w-full border-none p-0 gap-0"
                                            itemClassName="justify-start py-2.5 px-3 text-xs rounded-sm"
                                            variant="sidebar"
                                        />
                                    </aside>

                                    {/* Settings Content Area */}
                                    <main className="flex-1 overflow-y-auto custom-scrollbar p-4">
                                        <TournamentSettings
                                            tournament={tournament}
                                            hasFixtures={hasFixtures}
                                            teams={initialTeamsData}
                                            activeTab={activeSettingsTab}
                                            activeCategoryId={activeCategoryId}
                                            onCategoryUpdated={() => loadCategories()}
                                            userRole={userInvitationRole}
                                            onTabChange={(tab) => {
                                                setActiveSettingsTab(tab);
                                                updateUrlParams({ tab: 'settings', subtab: tab });
                                            }}
                                        />
                                    </main>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 relative flex overflow-hidden">
                                    {!readonly && !isLocked && activeSidebar !== 'schedule' && !activeNodeId && (
                                        <div className="absolute top-4 right-4 z-50 flex items-center gap-2" id="tour-console-add-components">
                                            <TournamentTemplateDialog
                                                getCenterPos={getCenterPos}
                                                maxTeams={(categories.find((c) => toCategoryId(c.id) === activeCategoryId)?.max_teams ?? tournament?.max_teams) || 8}
                                                onApplyTemplate={() => handleSave(false)}
                                            />
                                            <ActionMenu>
                                                <ActionMenuTrigger asChild>
                                                    <Button size="sm">
                                                        <Plus className="size-4" />
                                                        <span>{t("new_element")}</span>
                                                    </Button>
                                                </ActionMenuTrigger>
                                                <ActionMenuContent align="end" className="w-fit min-w-[200px] bg-card shadow-2xl rounded-sm p-1">
                                                    <ActionMenuItem
                                                        onClick={() => addMatchNode(getCenterPos())}
                                                        className="cursor-pointer text-xs font-semibold flex items-center gap-2 py-1.5 hover:bg-node-2/10 focus:bg-node-2/10 group"
                                                    >
                                                        <div className="w-6 h-6 bg-node-2/10 rounded flex items-center justify-center shrink-0">
                                                            <span className="text-node-2 text-xs font-bold">VS</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-foreground">{locale === 'th' ? "เพิ่มแมตช์" : "Add Match"}</span>
                                                            <span className="text-[10px] text-muted-foreground">{locale === 'th' ? "รอบน็อคเอาท์" : "Knockout Slot"}</span>
                                                        </div>
                                                    </ActionMenuItem>

                                                    <ActionMenuItem
                                                        onClick={() => addGroupNode(getCenterPos())}
                                                        className="cursor-pointer text-xs font-semibold flex items-center gap-2 py-1.5 hover:bg-node-5/10 focus:bg-node-5/10 group"
                                                    >
                                                        <div className="w-6 h-6 bg-node-5/10 rounded flex items-center justify-center shrink-0">
                                                            <LayoutGrid className="size-4 text-node-5" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-foreground">{locale === 'th' ? "เพิ่มกลุ่ม" : "Add Group"}</span>
                                                            <span className="text-[10px] text-muted-foreground">{locale === 'th' ? "แบ่งกลุ่ม / สาย" : "Stage / Pool"}</span>
                                                        </div>
                                                    </ActionMenuItem>

                                                    <ActionMenuItem
                                                        onClick={() => addStandingNode(getCenterPos())}
                                                        className="cursor-pointer text-xs font-semibold flex items-center gap-2 py-1.5 hover:bg-node-1/10 focus:bg-node-1/10 group"
                                                    >
                                                        <div className="w-6 h-6 bg-node-1/10 rounded flex items-center justify-center shrink-0">
                                                            <ListOrdered className="size-4 text-node-1" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-foreground">{locale === 'th' ? "เพิ่มตารางคะแนน" : "Add Standing"}</span>
                                                            <span className="text-[10px] text-muted-foreground">{locale === 'th' ? "อันดับคะแนนในกลุ่ม" : "Group Ranking"}</span>
                                                        </div>
                                                    </ActionMenuItem>

                                                    <ActionMenuItem
                                                        onClick={() => addTeamListNode(teams, getCenterPos())}
                                                        className="cursor-pointer text-xs font-semibold flex items-center gap-2 py-1.5 hover:bg-node-3/10 focus:bg-node-3/10 group"
                                                    >
                                                        <div className="w-6 h-6 bg-node-3/10 rounded flex items-center justify-center shrink-0">
                                                            <Users className="size-4 text-node-3" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-foreground">{locale === 'th' ? "รายชื่อทีม" : "Teams List"}</span>
                                                            <span className="text-[10px] text-muted-foreground">{locale === 'th' ? "กล่องรายชื่อทีม" : "Team List"}</span>
                                                        </div>
                                                    </ActionMenuItem>
                                                </ActionMenuContent>
                                            </ActionMenu>
                                        </div>
                                    )}
                                    <div className="w-full h-full" id="tour-console-canvas-wrapper">
                                        <ReactFlow
                                            nodes={nodes}
                                            edges={edges}
                                            proOptions={{ hideAttribution: true }}
                                            onNodesChange={readonly ? undefined : onNodesChange}
                                            onEdgesChange={readonly ? undefined : onEdgesChange}
                                            onConnect={readonly ? undefined : onConnectWithSave}
                                            onReconnect={readonly || isLocked ? undefined : onReconnectWithSave}
                                            isValidConnection={isValidConnection}
                                            onNodeDragStart={readonly ? undefined : onNodeDragStart}
                                            onNodeDragStop={readonly ? undefined : onDragStop}
                                            onSelectionDragStop={readonly ? undefined : onDragStop}
                                            onNodeClick={(_, node) => {
                                                if (isLocked) return;
                                                setActiveNodeId(node.id);
                                                selectNode(node.id);
                                            }}
                                            onPaneClick={() => {
                                                if (isLocked) return;
                                                setActiveNodeId(null);
                                                selectNode(null);
                                            }}
                                            onEdgeClick={() => {
                                                if (isLocked) return;
                                                setActiveNodeId(null);
                                                selectNode(null);
                                            }}
                                            nodeTypes={nodeTypes}
                                            edgeTypes={edgeTypes}
                                            onReconnectEnd={readonly || isLocked ? undefined : onReconnectEnd}
                                            fitView={false}
                                            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                                            minZoom={0.1}
                                            maxZoom={1.5}
                                            nodesDraggable={!readonly && !isLocked}
                                            nodesConnectable={!readonly && !isLocked}
                                            elementsSelectable={!readonly && !isLocked}
                                            panOnDrag={!readonly}
                                            panOnScroll={!readonly}
                                            zoomOnScroll={!readonly}
                                            zoomOnPinch={!readonly}
                                            zoomOnDoubleClick={!readonly}
                                            deleteKeyCode={readonly || isLocked ? null : ["Backspace", "Delete"]}
                                            autoPanOnConnect={!readonly && !isLocked}
                                            autoPanOnNodeDrag={!readonly && !isLocked}
                                            colorMode="light"
                                            connectionMode={ConnectionMode.Loose}
                                            connectionRadius={50}
                                            connectionLineStyle={{ stroke: "var(--border)", strokeWidth: 2 }}
                                            connectionLineType={ConnectionLineType.Bezier}
                                            snapToGrid
                                            snapGrid={[10, 10]}
                                            defaultEdgeOptions={{
                                                type: "default",
                                                style: {
                                                    stroke: "var(--border)",
                                                    strokeWidth: 2,
                                                },
                                            }}
                                        >
                                            <Background color="#555" variant={BackgroundVariant.Dots} gap={16} size={1} style={{ opacity: 1 }} />
                                            <Controls
                                                showInteractive={false}
                                                className="!bg-card !border-border !!shadow-none [&>button]:!bg-card [&>button]:!border-border [&>button:hover]:!bg-muted"
                                            />
                                        </ReactFlow>
                                    </div>
                                </div>

                                {((!readonly && !isLocked) || activeNodeId === 'ranking-setting-node') && (
                                    <NodeSettings
                                        currentTournamentStatus={currentStatus}
                                        onStatusChange={setCurrentStatus}
                                    />
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Create Category Dialog */}
            <CreateCategoryForm
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                tournamentId={tournamentId}
                sport={tournament?.sport}
                ageCategories={ageCategories}
                onSuccess={async (newCatId) => {
                    setIsCreateOpen(false);
                    await loadCategories(newCatId || undefined);
                    if (newCatId) {
                        setStoreCategoryId(newCatId);
                        fetchTeams(newCatId);
                        // Persist new category to URL
                        const params = new URLSearchParams(searchParams.toString());
                        params.set("category", newCatId);
                        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                    }
                }}
            />

            {/* Unsaved Changes Warning Dialog */}
            <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
                <AlertDialogContent className="rounded-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="p-2 lg:p-4 border-b">
                            {locale === 'th' ? 'คุณแน่ใจหรือไม่?' : 'Are you sure?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="p-2 lg:p-4">
                            {locale === 'th'
                                ? "คุณยังไม่ได้บันทึกการเปลี่ยนแปลงบนบอร์ด! ข้อมูลที่แก้ไขจะหายไป คุณแน่ใจหรือไม่ว่าต้องการออกจากหน้านี้โดยไม่บันทึก?"
                                : "You have unsaved changes on the canvas! Your modifications will be lost. Are you sure you want to leave without saving?"}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="p-2 lg:p-4 border-t grid grid-cols-2 gap-1 md:gap-2">
                        <AlertDialogCancel onClick={handleCancelLeave} className="mt-0">
                            {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmLeave}>
                            {locale === 'th' ? 'ยืนยันออกจากหน้า' : 'Confirm'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Alert Dialog: Confirm Status Change */}
            <AlertDialog open={statusConfirmOpen} onOpenChange={setStatusConfirmOpen}>
                <AlertDialogContent className="rounded-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="p-2 lg:p-4 border-b">
                            <Header level={4}>
                                {locale === 'th' ? "ยืนยันการเปลี่ยนสถานะการแข่งขัน" : "Confirm Tournament Status Change"}
                            </Header>
                        </AlertDialogTitle>
                        <AlertDialogDescription className="p-2 lg:p-4 text-xs text-foreground/80 space-y-2">
                            <p>
                                {pendingStatus === 'ongoing' && (locale === 'th'
                                    ? "คุณต้องการเปลี่ยนสถานะเป็น \"กำลังแข่งขัน (Ongoing)\" ใช่หรือไม่? ระบบจะเปิดให้บันทึกผลการแข่งขันและดำเนินการจัดการแข่งขันต่อไป"
                                    : "Are you sure you want to change status to 'Ongoing'? The system will allow recording match results and ongoing tournament management.")}
                                {pendingStatus === 'draft' && (locale === 'th'
                                    ? "คุณต้องการเปลี่ยนสถานะกลับเป็น \"แบบร่าง (Draft)\" ใช่หรือไม่? การแข่งขันจะกลับสู่สถานะร่างสำหรับการเตรียมการ"
                                    : "Are you sure you want to change status back to 'Draft'? The tournament will return to draft preparation mode.")}
                                {pendingStatus === 'completed' && (locale === 'th'
                                    ? "คุณต้องการเปลี่ยนสถานะเป็น \"เสร็จสิ้น (Completed)\" ใช่หรือไม่? เมื่อเสร็จสิ้นแล้ว จะไม่สามารถเปลี่ยนสถานะกลับจากแถบเครื่องมือได้โดยตรง (ต้องไปที่พื้นที่อันตรายในการตั้งค่า)"
                                    : "Are you sure you want to change status to 'Completed'? Once completed, you will not be able to revert the status directly from the toolbar (must go to Danger Zone in settings).")}
                                {pendingStatus === 'cancelled' && (locale === 'th'
                                    ? "คุณต้องการเปลี่ยนสถานะเป็น \"ยกเลิก (Cancelled)\" ใช่หรือไม่? การแข่งขันและระบบรับสมัครจะถูกปิด และจะไม่สามารถเปลี่ยนสถานะกลับจากแถบเครื่องมือได้โดยตรง"
                                    : "Are you sure you want to cancel this tournament? Registration will close, and this status cannot be reverted directly from the toolbar.")}
                            </p>
                            {(pendingStatus === 'completed' || pendingStatus === 'cancelled') && (
                                <p className="text-destructive font-medium text-[11px]">
                                    {locale === 'th'
                                        ? "*หมายเหตุ: สถานะนี้จะล็อคการสลับสถานะบนแถบเครื่องมือ หากต้องการเปลี่ยนกลับจะต้องดำเนินการผ่านพื้นที่อันตราย (Danger Zone)"
                                        : "*Note: This status will lock toolbar status switching. Any revert must be done via Danger Zone."}
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
                            disabled={isUpdatingStatus}
                            className="mt-0"
                        >
                            {locale === 'th' ? "ยกเลิก" : "Cancel"}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmStatusChange}
                            disabled={isUpdatingStatus}
                            className={cn(
                                pendingStatus === 'cancelled' && "bg-destructive hover:bg-destructive/90",
                                pendingStatus === 'completed' && "bg-primary hover:bg-primary/90"
                            )}
                        >
                            {isUpdatingStatus ? (
                                <Loader2 className="size-4 animate-spin mr-1.5" />
                            ) : null}
                            {locale === 'th' ? "ยืนยันเปลี่ยนสถานะ" : "Confirm"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Alert Dialog: Locked Status Information */}
            <AlertDialog open={lockedStatusDialogOpen} onOpenChange={setLockedStatusDialogOpen}>
                <AlertDialogContent className="rounded-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="p-2 lg:p-4 border-b flex items-center gap-2">
                            <Lock className="size-4 text-warning" />
                            <Header level={4}>
                                {locale === 'th' ? "สถานะการแข่งขันถูกล็อค" : "Tournament Status Locked"}
                            </Header>
                        </AlertDialogTitle>
                        <AlertDialogDescription className="p-2 lg:p-4 text-xs text-foreground/80 space-y-2">
                            <p>
                                {locale === 'th'
                                    ? `ทัวร์นาเมนต์นี้มีสถานะเป็น "${currentStatus === 'completed' ? 'เสร็จสิ้น (Completed)' : 'ยกเลิก (Cancelled)'}" แล้ว จึงไม่สามารถเปลี่ยนสถานะกลับจากแถบเครื่องมือได้โดยตรง`
                                    : `This tournament is marked as '${currentStatus === 'completed' ? 'Completed' : 'Cancelled'}' and cannot be reverted from the toolbar directly.`}
                            </p>
                            <p className="text-muted-foreground text-[11px]">
                                {locale === 'th'
                                    ? "หากต้องการเปลี่ยนสถานะการแข่งขันกลับเป็นกำลังแข่งขันหรือแบบร่าง กรุณาไปที่ 'การตั้งค่า > พื้นที่อันตราย (Danger Zone)' แล้วกดยื่นคำขอเปลี่ยนสถานะการแข่งขัน"
                                    : "To revert the tournament status back to Ongoing or Draft, please go to 'Settings > Danger Zone' and submit a status change request."}
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="p-2 lg:p-4 border-t flex flex-row items-center justify-end gap-2">
                        <AlertDialogCancel className="mt-0">
                            {locale === 'th' ? "ปิด" : "Close"}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setLockedStatusDialogOpen(false);
                                setActiveNodeId(null);
                                selectNode(null);
                                setActiveSidebar('settings');
                                setActiveSettingsTab('danger');
                                updateUrlParams({ tab: 'settings', subtab: 'danger' });
                            }}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            <ShieldAlert className="size-4 mr-1.5" />
                            {locale === 'th' ? "ไปยังพื้นที่อันตราย (Danger Zone)" : "Go to Danger Zone"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export function Canvas(props: CanvasProps) {
    return (
        <ReactFlowProvider>
            <CanvasInternal {...props} />
        </ReactFlowProvider>
    );
}
