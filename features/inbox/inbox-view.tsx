"use client";

import { useEffect, useState, useTransition, useMemo, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import {
    Check,
    X,
    ShieldCheck,
    Mail,
    Phone,
    Inbox,
    Trophy,
    Users,
    User,
    Bell,
    UserCheck,
    MessageSquareQuote,
    Eye,
    Receipt,
    Loader2,
    Search,
    CheckSquare,
    Square,
    ChevronDown,
    ChevronRight,
    AlertCircle,
    CreditCard
} from "lucide-react";
import {
    acceptInvite,
    rejectInvite,
    getTournamentTeamRoster,
    approveTeamManagementRequest,
    rejectTeamManagementRequest,
    cancelTeamManagementRequest
} from "@/actions/tournaments/staff";
import {
    approveRegistration,
    rejectRegistration,
    approveRoster,
    rejectRoster,
    approveRosterUnlock,
    rejectRosterUnlock,
    approveSingleRosterSubmission,
    rejectSingleRosterSubmission,
    approveSelectedRosterSubmissions
} from "@/actions/tournaments/registration";
import { EmptyState } from "@/components/shared/empty-state";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/ui/header";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TabOption } from "@/components/ui/tab";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import Image from "next/image";

type NotificationItem =
    | {
        type: 'invite';
        id: string;
        tournament_id: string;
        tournament_name?: string;
        tournament_logo?: string | null;
        role: string;
        status: 'pending' | 'accepted' | 'rejected';
        created_at: string;
    }
    | {
        type: 'registration';
        id: string;
        tournament_id?: string;
        team_id: string;
        team_name: string;
        team_logo?: string | null;
        tournament_name: string;
        tournament_logo?: string | null;
        registration_status: 'pending' | 'approved' | 'rejected';
        payment_status: 'pending' | 'paid' | 'waived' | 'failed';
        created_at: string;
    }
    | {
        type: 'team_request';
        id: string;
        team_id?: string;
        team_name: string;
        team_logo?: string | null;
        status: 'pending' | 'approved' | 'rejected' | 'cancelled';
        created_at: string;
    }
    | {
        type: 'incoming_team_request';
        id: string;
        team_id: string;
        team_name: string;
        team_logo?: string | null;
        requester_name: string;
        requester_email: string;
        requester_avatar?: string | null;
        contact_phone: string;
        message: string | null;
        status: 'pending' | 'approved' | 'rejected' | 'cancelled';
        created_at: string;
    }
    | {
        type: 'tournament_action';
        id: string;
        tournament_id: string;
        tournament_name: string;
        tournament_logo?: string | null;
        category_name?: string | null;
        max_teams?: number;
        approved_teams_count?: number;
        min_players?: number;
        max_players?: number;
        registration_fee?: number;
        team_id?: string | null;
        team_name: string;
        team_logo?: string | null;
        contact_name?: string | null;
        contact_phone?: string | null;
        slip_img?: string | null;
        action_type: 'tournament_registration' | 'tournament_roster_submission' | 'tournament_roster_unlock';
        status: 'pending' | 'approved' | 'rejected';
        registration_status?: string | null;
        payment_status?: string | null;
        roster_player_count?: number;
        created_at: string;
    }
    | {
        type: 'system';
        id: string;
        title: string;
        message: string;
        notification_type: 'invite' | 'payment' | 'system';
        link?: string | null;
        is_read: boolean;
        status?: 'pending' | 'approved' | 'rejected';
        created_at: string;
    };

type TabValue = 'all' | 'registrations' | 'invites' | 'team_requests' | 'system';

interface RosterPlayerItem {
    id: string;
    tournament_team_id: string;
    master_player_id?: string | null;
    player_id?: string | null;
    name: string;
    shirt_number?: string | null;
    position?: string | null;
    tel?: string | null;
    photo_url?: string | null;
    status: string;
    rejection_reason?: string | null;
    created_at: string;
}

function getInitials(name?: string | null): string {
    if (!name) return "";
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");
}

function getRoleLabel(role?: string | null, isTh: boolean = true): string {
    if (!role) return isTh ? "ทีมงาน" : "Staff";
    const normalized = role.toLowerCase().trim();
    if (normalized === "co_organizer" || normalized === "co-organizer") {
        return isTh ? "ผู้ร่วมจัดการแข่งขัน" : "Co-Organizer";
    }
    if (normalized === "referee") {
        return isTh ? "ผู้ตัดสิน / กรรมการ" : "Referee";
    }
    if (normalized === "staff") {
        return isTh ? "ทีมงาน" : "Staff";
    }
    if (normalized === "owner") {
        return isTh ? "เจ้าของ" : "Owner";
    }
    return role.replace(/_/g, ' ');
}

export function InboxesView() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tCommon = useTranslations("Common");
    const tReg = useTranslations("Registration");
    const locale = useLocale();
    const isTh = locale === "th";
    const { toast } = useToast();

    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [actionState, setActionState] = useState<Record<string, 'accepted' | 'approved' | 'rejected' | 'cancelled' | 'error' | null>>({});
    
    const tabParam = searchParams.get('tab') as TabValue | null;
    const [activeTab, setActiveTab] = useState<TabValue>(tabParam || 'all');

    useEffect(() => {
        if (tabParam && ['all', 'registrations', 'invites', 'team_requests', 'system'].includes(tabParam)) {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    const handleTabChange = (val: TabValue) => {
        setActiveTab(val);
        router.push(`/inboxes?tab=${val}`);
    };

    const [viewingSlipUrl, setViewingSlipUrl] = useState<string | null>(null);

    // Registration details dropdown state
    const [expandedDetailsTeamIds, setExpandedDetailsTeamIds] = useState<string[]>([]);

    // Roster inline dropdown state
    const [expandedRosterTeamId, setExpandedRosterTeamId] = useState<string | null>(null);
    const [expandedRosterItem, setExpandedRosterItem] = useState<{
        id: string;
        tournament_id: string;
        team_name: string;
        tournament_name: string;
        min_players?: number;
        max_players?: number;
        isTeamApproved?: boolean;
    } | null>(null);
    const [rosterPlayers, setRosterPlayers] = useState<RosterPlayerItem[]>([]);
    const [loadingRoster, setLoadingRoster] = useState(false);
    const [actioningPlayerId, setActioningPlayerId] = useState<string | null>(null);
    const [rosterSearchQuery, setRosterSearchQuery] = useState("");
    const [selectedRosterIds, setSelectedRosterIds] = useState<string[]>([]);
    const [isBatchApproving, setIsBatchApproving] = useState(false);

    const toggleExpandDetails = (id: string) => {
        setExpandedDetailsTeamIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const loadData = useCallback(async (isInitial = false) => {
        try {
            const url = expandedRosterTeamId
                ? `/api/inboxes?rosterTeamId=${encodeURIComponent(expandedRosterTeamId)}`
                : `/api/inboxes`;

            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) {
                if (isInitial) setIsLoading(false);
                return;
            }

            const json = await res.json();
            if (!json.success || !json.inbox) {
                if (isInitial) setIsLoading(false);
                return;
            }

            const { invites, registrations, teamRequests, incomingTeamRequests, systemNotifications, tournamentActions } = json.inbox;
            const combined: NotificationItem[] = [];

            // Tournament Organizer actions (ยืนยันทีม, ยอมรับเอกสาร, ปลดล็อครายชื่อ)
            if (tournamentActions?.length) {
                combined.push(...tournamentActions.map((item: any) => ({
                    ...item,
                    type: 'tournament_action' as const
                })));
            }

            if (invites?.length) {
                combined.push(...invites.map((item: any) => ({
                    ...item,
                    type: 'invite' as const
                })));
            }

            if (registrations?.length) {
                combined.push(...registrations.map((item: any) => ({
                    ...item,
                    type: 'registration' as const
                })));
            }

            if (teamRequests?.length) {
                combined.push(...teamRequests.map((item: any) => ({
                    ...item,
                    type: 'team_request' as const
                })));
            }

            if (incomingTeamRequests?.length) {
                combined.push(...incomingTeamRequests.map((item: any) => ({
                    ...item,
                    type: 'incoming_team_request' as const
                })));
            }

            if (systemNotifications?.length) {
                combined.push(...systemNotifications.map((item: any) => ({
                    type: 'system' as const,
                    id: item.id,
                    title: item.title,
                    message: item.message,
                    notification_type: item.type,
                    link: item.link,
                    is_read: item.is_read,
                    status: item.status,
                    created_at: item.created_at,
                })));
            }

            // Sort by created_at DESC
            combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setNotifications(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(combined)) {
                    return combined;
                }
                return prev;
            });

            // If roster data is present for open dropdown, update realtime
            if (json.roster && Array.isArray(json.roster)) {
                // Avoid replacing during active single/batch actions
                if (!actioningPlayerId && !isBatchApproving) {
                    setRosterPlayers(prev => {
                        if (JSON.stringify(prev) !== JSON.stringify(json.roster)) {
                            return json.roster;
                        }
                        return prev;
                    });
                }
            }
        } catch (e) {
            console.error("Error loading inboxes data:", e);
        } finally {
            if (isInitial) setIsLoading(false);
        }
    }, [expandedRosterTeamId, actioningPlayerId, isBatchApproving]);

    useEffect(() => {
        loadData(true);

        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                loadData(false);
            }
        }, 2500);

        const handleFocus = () => {
            loadData(false);
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, [loadData]);

    const toggleExpandRoster = async (item: {
        id: string;
        tournament_id: string;
        team_name: string;
        tournament_name: string;
        min_players?: number;
        max_players?: number;
        isTeamApproved?: boolean;
    }) => {
        if (expandedRosterTeamId === item.id) {
            setExpandedRosterTeamId(null);
            setExpandedRosterItem(null);
            return;
        }

        setExpandedRosterTeamId(item.id);
        setExpandedRosterItem(item);
        setLoadingRoster(true);
        setRosterSearchQuery("");
        setSelectedRosterIds([]);
        const res = await getTournamentTeamRoster(item.id);
        if (res.success && res.data) {
            setRosterPlayers(res.data);
            // Default select all pending players for convenient confirmation
            const pendingIds = res.data.filter(p => p.status === 'pending').map(p => p.id);
            setSelectedRosterIds(pendingIds);
        } else {
            setRosterPlayers([]);
        }
        setLoadingRoster(false);
    };

    const handleAcceptInvite = async (tournamentId: string, inviteId: string) => {
        startTransition(async () => {
            const res = await acceptInvite(tournamentId);
            if (res.success) {
                setActionState(prev => ({ ...prev, [inviteId]: 'accepted' }));
                toast({
                    title: locale === "th" ? "ตอบรับคำเชิญแล้ว" : "Accepted Invitation",
                    description: locale === "th" ? "คุณได้เข้าร่วมเป็นทีมงานของทัวร์นาเมนต์นี้เรียบร้อยแล้ว" : "You are now a collaborator on this tournament.",
                });
                loadData();
            } else {
                setActionState(prev => ({ ...prev, [inviteId]: 'error' }));
                toast({
                    title: locale === "th" ? "เกิดข้อผิดพลาด" : "Error",
                    description: res.error || (locale === "th" ? "ไม่สามารถตอบรับคำเชิญได้" : "Failed to accept the invitation."),
                    variant: "destructive",
                });
            }
        });
    };

    const handleRejectInvite = async (tournamentId: string, inviteId: string) => {
        startTransition(async () => {
            const res = await rejectInvite(tournamentId);
            if (res.success) {
                setActionState(prev => ({ ...prev, [inviteId]: 'rejected' }));
                toast({
                    title: locale === "th" ? "ปฏิเสธคำเชิญแล้ว" : "Declined Invitation",
                    description: locale === "th" ? "คุณได้ปฏิเสธคำเชิญเข้าร่วมจัดงานแล้ว" : "You have declined the invitation.",
                });
                loadData();
            } else {
                setActionState(prev => ({ ...prev, [inviteId]: 'error' }));
                toast({
                    title: locale === "th" ? "เกิดข้อผิดพลาด" : "Error",
                    description: res.error || (locale === "th" ? "ไม่สามารถปฏิเสธคำเชิญได้" : "Failed to decline the invitation."),
                    variant: "destructive",
                });
            }
        });
    };

    const handleApproveTeamRequest = async (requestId: string) => {
        startTransition(async () => {
            const res = await approveTeamManagementRequest(requestId);
            if (res.success) {
                setActionState(prev => ({ ...prev, [requestId]: 'accepted' }));
                toast({
                    title: isTh ? "อนุมัติคำขอสำเร็จ" : "Request Approved",
                    description: isTh ? "ผู้ใช้ได้รับสิทธิ์จัดการทีมเรียบร้อยแล้ว" : "The user now has rights to manage the team.",
                });
                loadData();
            } else {
                setActionState(prev => ({ ...prev, [requestId]: 'error' }));
                toast({
                    title: "Error",
                    description: res.error || "Failed to approve the request.",
                    variant: "destructive",
                });
            }
        });
    };

    const [teamReqToCancel, setTeamReqToCancel] = useState<{ id: string; team_id?: string } | null>(null);

    const handleConfirmCancelTeamRequest = () => {
        if (!teamReqToCancel) return;
        const targetId = teamReqToCancel.id;
        setActionState(prev => ({ ...prev, [targetId]: 'cancelled' }));
        startTransition(async () => {
            try {
                const res = await cancelTeamManagementRequest(targetId);
                if (res.success) {
                    toast({
                        title: isTh ? "สำเร็จ" : "Success",
                        description: isTh ? "ยกเลิกคำขอจัดการทีมเรียบร้อยแล้ว" : "Team request cancelled successfully."
                    });
                    setNotifications(prev => prev.map(n => (n.id === targetId && n.type === 'team_request') ? { ...n, status: 'cancelled' } : n));
                } else {
                    setActionState(prev => ({ ...prev, [targetId]: null }));
                    toast({
                        title: "Error",
                        description: res.error || "Failed to cancel request",
                        variant: "destructive"
                    });
                }
            } catch {
                setActionState(prev => ({ ...prev, [targetId]: null }));
                toast({
                    title: "Error",
                    description: "Failed to cancel request",
                    variant: "destructive"
                });
            } finally {
                setTeamReqToCancel(null);
            }
        });
    };

    const handleRejectTeamRequest = async (requestId: string) => {
        startTransition(async () => {
            const res = await rejectTeamManagementRequest(requestId);
            if (res.success) {
                setActionState(prev => ({ ...prev, [requestId]: 'rejected' }));
                toast({
                    title: isTh ? "ปฏิเสธคำขอสำเร็จ" : "Request Rejected",
                    description: isTh ? "ปฏิเสธคำขอจัดการทีมเรียบร้อยแล้ว" : "The team management request has been rejected.",
                });
                loadData();
            } else {
                setActionState(prev => ({ ...prev, [requestId]: 'error' }));
                toast({
                    title: "Error",
                    description: res.error || "Failed to reject the request.",
                    variant: "destructive",
                });
            }
        });
    };

    // --- Tournament Action Handlers ---
    const handleApproveTournamentReg = async (regId: string, tourId: string) => {
        setActionState(prev => ({
            ...prev,
            [`tournament_registration-${regId}`]: 'approved',
            [`team-${regId}`]: 'approved'
        }));
        setNotifications(prev => prev.map(n => {
            if (n.type === 'tournament_action' && n.id === regId) {
                if (n.action_type === 'tournament_registration') {
                    return { ...n, status: 'approved' as const, registration_status: 'approved' as const };
                }
                return { ...n, registration_status: 'approved' as const };
            }
            return n;
        }));
        if (expandedRosterItem?.id === regId) {
            setExpandedRosterItem(prev => prev ? { ...prev, isTeamApproved: true } : null);
        }
        startTransition(async () => {
            const res = await approveRegistration(regId, tourId);
            if (res.success) {
                toast({
                    title: isTh ? "ยืนยันทีมสำเร็จ" : "Team Approved",
                    description: isTh ? "อนุมัติการสมัครและยืนยันทีมเข้าสู่ทัวร์นาเมนต์แล้ว" : "Team registration has been approved.",
                });
                if (expandedRosterItem?.id === regId) {
                    setExpandedRosterItem(prev => prev ? { ...prev, isTeamApproved: true } : null);
                }
                loadData();
            } else {
                setActionState(prev => ({ ...prev, [`tournament_registration-${regId}`]: 'error' }));
                toast({
                    title: "Error",
                    description: res.error || "Failed to approve team registration.",
                    variant: "destructive",
                });
            }
        });
    };

    const handleRejectTournamentReg = async (regId: string, tourId: string) => {
        setActionState(prev => ({ ...prev, [`tournament_registration-${regId}`]: 'rejected' }));
        setNotifications(prev => prev.map(n => (n.id === regId && n.type === 'tournament_action' && n.action_type === 'tournament_registration') ? { ...n, status: 'rejected' as const } : n));
        startTransition(async () => {
            const res = await rejectRegistration(regId, tourId);
            if (res.success) {
                toast({
                    title: isTh ? "ปฏิเสธการสมัครสำเร็จ" : "Registration Rejected",
                    description: isTh ? "ปฏิเสธการสมัครทีมเรียบร้อยแล้ว" : "Team registration has been rejected.",
                });
                loadData();
            } else {
                setActionState(prev => ({ ...prev, [`tournament_registration-${regId}`]: 'error' }));
                toast({
                    title: "Error",
                    description: res.error || "Failed to reject team registration.",
                    variant: "destructive",
                });
            }
        });
    };

    const handleApproveTournamentRoster = async (regId: string, tourId: string) => {
        if (expandedRosterItem && expandedRosterItem.isTeamApproved === false) {
            toast({
                title: isTh ? "ไม่สามารถอนุมัติได้" : "Action not allowed",
                description: isTh ? "กรุณายืนยันทีมก่อนอนุมัติรายชื่อนักกีฬา" : "Please approve the team before approving roster.",
                variant: "destructive"
            });
            return;
        }

        setActionState(prev => ({
            ...prev,
            [`tournament_roster_submission-${regId}`]: 'accepted',
            [`roster-${regId}`]: 'accepted'
        }));
        setNotifications(prev => prev.map(n => (n.id === regId && n.type === 'tournament_action' && n.action_type === 'tournament_roster_submission') ? { ...n, status: 'approved' as const } : n));
        startTransition(async () => {
            const res = await approveRoster(regId, tourId);
            if (res.success) {
                toast({
                    title: isTh ? "ยอมรับเอกสาร/รายชื่อสำเร็จ" : "Roster Approved",
                    description: isTh ? "อนุมัติรายชื่อนักกีฬาและล็อครายชื่อเรียบร้อยแล้ว" : "Roster has been approved and locked.",
                });
                if (expandedRosterItem?.id === regId) {
                    setExpandedRosterItem(null);
                    setExpandedRosterTeamId(null);
                }
                loadData();
            } else {
                setActionState(prev => ({
                    ...prev,
                    [`tournament_roster_submission-${regId}`]: 'error',
                    [`roster-${regId}`]: 'error'
                }));
                toast({
                    title: "Error",
                    description: res.error || "Failed to approve roster.",
                    variant: "destructive",
                });
            }
        });
    };

    const handleApproveSinglePlayer = async (submissionId: string) => {
        if (!expandedRosterItem) return;

        if (expandedRosterItem.isTeamApproved === false) {
            toast({
                title: isTh ? "ไม่สามารถอนุมัติได้" : "Action not allowed",
                description: isTh ? "กรุณายืนยันทีมก่อนอนุมัตินักกีฬา" : "Please approve the team before approving players.",
                variant: "destructive"
            });
            return;
        }

        setActioningPlayerId(submissionId);
        try {
            const res = await approveSingleRosterSubmission(submissionId, expandedRosterItem.id, expandedRosterItem.tournament_id);
            if (res.success) {
                toast({
                    title: isTh ? "อนุมัตินักกีฬาแล้ว" : "Player Approved",
                    description: isTh ? "อนุมัติรายชื่อนักกีฬารายนี้สำเร็จ" : "Player has been approved.",
                });
                setRosterPlayers(prev => prev.map(p => p.id === submissionId ? { ...p, status: 'approved' } : p));
                loadData();
            } else {
                toast({
                    title: "Error",
                    description: res.error || "Failed to approve player.",
                    variant: "destructive",
                });
            }
        } finally {
            setActioningPlayerId(null);
        }
    };

    const handleRejectSinglePlayer = async (submissionId: string) => {
        if (!expandedRosterItem) return;
        setActioningPlayerId(submissionId);
        try {
            const res = await rejectSingleRosterSubmission(submissionId, expandedRosterItem.id, expandedRosterItem.tournament_id);
            if (res.success) {
                toast({
                    title: isTh ? "ปฏิเสธนักกีฬาแล้ว" : "Player Rejected",
                    description: isTh ? "ปฏิเสธรายชื่อนักกีฬารายนี้สำเร็จ" : "Player has been rejected.",
                });
                setRosterPlayers(prev => prev.map(p => p.id === submissionId ? { ...p, status: 'rejected' } : p));
                loadData();
            } else {
                toast({
                    title: "Error",
                    description: res.error || "Failed to reject player.",
                    variant: "destructive",
                });
            }
        } finally {
            setActioningPlayerId(null);
        }
    };

    const handleApproveSelectedPlayers = async () => {
        if (!expandedRosterItem || selectedRosterIds.length === 0) return;

        if (expandedRosterItem.isTeamApproved === false) {
            toast({
                title: isTh ? "ไม่สามารถอนุมัติได้" : "Action not allowed",
                description: isTh ? "กรุณายืนยันทีมก่อนอนุมัตินักกีฬา" : "Please approve the team before approving players.",
                variant: "destructive"
            });
            return;
        }

        setIsBatchApproving(true);
        try {
            const res = await approveSelectedRosterSubmissions(
                selectedRosterIds,
                expandedRosterItem.id,
                expandedRosterItem.tournament_id
            );
            if (res.success) {
                toast({
                    title: isTh ? "ยืนยันนักกีฬาที่เลือกแล้ว" : "Selected Players Approved",
                    description: isTh
                        ? `อนุมัตินักกีฬาจำนวน ${selectedRosterIds.length} คนเรียบร้อยแล้ว`
                        : `Successfully approved ${selectedRosterIds.length} players.`,
                });
                setRosterPlayers(prev => prev.map(p => selectedRosterIds.includes(p.id) ? { ...p, status: 'approved' } : p));
                setSelectedRosterIds([]);
                loadData();
            } else {
                toast({
                    title: "Error",
                    description: res.error || "Failed to approve selected players.",
                    variant: "destructive",
                });
            }
        } finally {
            setIsBatchApproving(false);
        }
    };

    const handleRejectTournamentRoster = async (regId: string, tourId: string) => {
        setActionState(prev => ({
            ...prev,
            [`tournament_roster_submission-${regId}`]: 'rejected',
            [`roster-${regId}`]: 'rejected'
        }));
        setNotifications(prev => prev.map(n => (n.id === regId && n.type === 'tournament_action' && n.action_type === 'tournament_roster_submission') ? { ...n, status: 'rejected' as const } : n));
        startTransition(async () => {
            const res = await rejectRoster(regId, tourId);
            if (res.success) {
                toast({
                    title: isTh ? "ปฏิเสธเอกสาร/รายชื่อสำเร็จ" : "Roster Rejected",
                    description: isTh ? "ปฏิเสธรายชื่อนักกีฬาเรียบร้อยแล้ว" : "Roster has been rejected.",
                });
                if (expandedRosterItem?.id === regId) {
                    setExpandedRosterItem(null);
                    setExpandedRosterTeamId(null);
                }
                loadData();
            } else {
                setActionState(prev => ({
                    ...prev,
                    [`tournament_roster_submission-${regId}`]: 'error',
                    [`roster-${regId}`]: 'error'
                }));
                toast({
                    title: "Error",
                    description: res.error || "Failed to reject roster.",
                    variant: "destructive",
                });
            }
        });
    };

    const handleApproveTournamentUnlock = async (regId: string, tourId: string) => {
        setActionState(prev => ({ ...prev, [`tournament_roster_unlock-${regId}`]: 'accepted' }));
        setNotifications(prev => prev.map(n => (n.id === regId && n.type === 'tournament_action' && n.action_type === 'tournament_roster_unlock') ? { ...n, status: 'approved' as const } : n));
        startTransition(async () => {
            const res = await approveRosterUnlock(regId, tourId);
            if (res.success) {
                toast({
                    title: isTh ? "ปลดล็อครายชื่อสำเร็จ" : "Roster Unlocked",
                    description: isTh ? "ปลดล็อคให้ทีมสามารถแก้ไข/เพิ่มรายชื่อได้แล้ว" : "Roster unlocked for modification.",
                });
                loadData();
            } else {
                setActionState(prev => ({ ...prev, [`tournament_roster_unlock-${regId}`]: 'error' }));
                toast({
                    title: "Error",
                    description: res.error || "Failed to approve unlock.",
                    variant: "destructive",
                });
            }
        });
    };

    const handleRejectTournamentUnlock = async (regId: string, tourId: string) => {
        setActionState(prev => ({ ...prev, [`tournament_roster_unlock-${regId}`]: 'rejected' }));
        setNotifications(prev => prev.map(n => (n.id === regId && n.type === 'tournament_action' && n.action_type === 'tournament_roster_unlock') ? { ...n, status: 'rejected' as const } : n));
        startTransition(async () => {
            const res = await rejectRosterUnlock(regId, tourId);
            if (res.success) {
                toast({
                    title: isTh ? "ปฏิเสธคำขอปลดล็อค" : "Unlock Rejected",
                    description: isTh ? "ปฏิเสธคำขอปลดล็อครายชื่อเรียบร้อยแล้ว" : "Roster unlock request rejected.",
                });
                loadData();
            } else {
                setActionState(prev => ({ ...prev, [`tournament_roster_unlock-${regId}`]: 'error' }));
                toast({
                    title: "Error",
                    description: res.error || "Failed to reject unlock.",
                    variant: "destructive",
                });
            }
        });
    };

    const getStatusText = (status: string) => {
        if (status === 'approved' || status === 'accepted') return tCommon("approved") || "Approved";
        if (status === 'rejected') return tCommon("rejected") || "Rejected";
        if (status === 'cancelled') return isTh ? "ยกเลิกแล้ว" : "Cancelled";
        return tCommon("pending") || "Pending";
    };

    // Tab counts
    const registrationsTotalCount = useMemo(() => notifications.filter(n => n.type === 'tournament_action' || n.type === 'registration').length, [notifications]);
    const invitesCount = useMemo(() => notifications.filter(n => n.type === 'invite').length, [notifications]);
    const teamReqsCount = useMemo(() => notifications.filter(n => n.type === 'team_request' || n.type === 'incoming_team_request').length, [notifications]);
    const systemCount = useMemo(() => notifications.filter(n => n.type === 'system').length, [notifications]);

    const tabOptions: TabOption<TabValue>[] = useMemo(() => [
        { value: 'all', label: isTh ? `ทั้งหมด (${notifications.length})` : `All (${notifications.length})`, icon: Inbox },
        { value: 'registrations', label: isTh ? `รายการที่สมัครแข่ง (${registrationsTotalCount})` : `Registrations (${registrationsTotalCount})`, icon: Trophy },
        { value: 'invites', label: isTh ? `คำเชิญ (${invitesCount})` : `Invitations (${invitesCount})`, icon: UserCheck },
        { value: 'team_requests', label: isTh ? `คำขอจัดการทีม (${teamReqsCount})` : `Team Requests (${teamReqsCount})`, icon: ShieldCheck },
        ...(systemCount > 0 ? [{ value: 'system' as TabValue, label: isTh ? `ระบบ (${systemCount})` : `System (${systemCount})`, icon: Bell }] : [])
    ], [notifications.length, registrationsTotalCount, invitesCount, teamReqsCount, systemCount, isTh]);

    const filteredNotifications = useMemo(() => {
        if (activeTab === 'all') return notifications;
        if (activeTab === 'registrations') return notifications.filter(n => n.type === 'tournament_action' || n.type === 'registration');
        if (activeTab === 'invites') return notifications.filter(n => n.type === 'invite');
        if (activeTab === 'team_requests') return notifications.filter(n => n.type === 'team_request' || n.type === 'incoming_team_request');
        if (activeTab === 'system') return notifications.filter(n => n.type === 'system');
        return notifications;
    }, [notifications, activeTab]);

    return (
        <div className="flex flex-col gap-3 md:gap-4 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <Header level={2} className="text-2xl md:text-3xl font-black tracking-tight">
                        {isTh ? "กล่องข้อความ" : "Inbox"}
                    </Header>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Left Column: Inbox Navigation Menu */}
                <aside className="lg:col-span-4 xl:col-span-3 sticky top-0 z-20 lg:top-4 self-start">
                    <div className="rounded-sm border bg-card p-2.5 sm:p-4 space-y-1 shadow-xs">
                        <div className="pb-4 hidden lg:block">
                            <Header level={6}>
                                {isTh ? "หมวดหมู่ข้อความ" : "Inbox Categories"}
                            </Header>
                        </div>
                        <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-0 pb-1 lg:pb-0 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {tabOptions.map((opt) => {
                                const Icon = opt.icon;
                                const isActive = activeTab === opt.value;

                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handleTabChange(opt.value)}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-sm text-xs md:text-sm font-medium transition-colors text-left shrink-0 lg:shrink lg:w-full group",
                                            isActive
                                                ? "bg-primary/10 text-primary font-semibold"
                                                : "text-muted-foreground hover:text-primary"
                                        )}
                                    >
                                        {Icon && (
                                            <Icon className={cn(
                                                "size-4 shrink-0 transition-colors",
                                                isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                                            )} />
                                        )}
                                        <span className="flex-1 whitespace-nowrap lg:whitespace-normal">{opt.label}</span>
                                        <ChevronRight className={cn(
                                            "size-4 hidden lg:block transition-transform",
                                            isActive ? "text-primary opacity-100 translate-x-0.5" : "opacity-0"
                                        )} />
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </aside>

                {/* Right Column: Inbox Content */}
                <div className="lg:col-span-8 xl:col-span-9 min-w-0">

            {isLoading ? (
                <div className="border bg-card rounded-sm divide-y divide-border overflow-hidden">
                    {[...Array(4)].map((_, idx) => (
                        <div
                            key={idx}
                            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card"
                        >
                            <div className="flex items-start gap-4 w-full">
                                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-4 w-3/4 rounded-sm" />
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-3 w-24 rounded-sm" />
                                        <span className="text-[10px] text-muted-foreground/30 font-bold">•</span>
                                        <Skeleton className="h-3 w-16 rounded-sm" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <Skeleton className="h-8 w-16 rounded-sm" />
                                <Skeleton className="h-8 w-20 rounded-sm" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredNotifications.length === 0 ? (
                <EmptyState
                    title={
                        activeTab === 'registrations'
                            ? (isTh ? "ไม่มีรายการที่สมัครแข่ง" : "No tournament registrations")
                            : activeTab === 'invites'
                                ? (isTh ? "ไม่มีคำเชิญที่รอตอบรับ" : "No pending invitations")
                                : activeTab === 'team_requests'
                                    ? (isTh ? "ไม่มีคำขอจัดการทีม" : "No team requests")
                                    : (isTh ? "ไม่มีข้อความในหมวดนี้" : "No messages found")
                    }
                    description={
                        activeTab === 'registrations'
                            ? (isTh ? "คุณยังไม่มีประวัติการสมัครเข้าร่วมการแข่งขันในขณะนี้" : "You have not registered for any tournaments yet.")
                            : activeTab === 'invites'
                                ? (isTh ? "ตอบรับคำเชิญเพื่อช่วยจัดการทัวร์นาเมนต์" : "Accept invitations to collaborate on tournaments.")
                                : activeTab === 'team_requests'
                                    ? (isTh ? "ไม่มีคำขอสิทธิ์การจัดการทีมในขณะนี้" : "No team management requests at the moment.")
                                    : (isTh ? "กล่องข้อความของคุณไม่มีรายการในขณะนี้" : "Your inbox is empty.")
                    }
                    icon={activeTab === 'registrations' ? Trophy : activeTab === 'invites' ? UserCheck : activeTab === 'team_requests' ? ShieldCheck : Inbox}
                    action={<div />}
                    className="bg-card rounded-sm border"
                />
            ) : (
                <div className="border bg-card rounded-sm divide-y divide-border overflow-hidden">
                    {filteredNotifications.map((item) => {
                        // 1. TOURNAMENT ORGANIZER ACTIONS
                        if (item.type === 'tournament_action') {
                            const actionKey = `${item.action_type}-${item.id}`;
                            const currentStatus = actionState[actionKey] || item.status;

                            const teamRegState = actionState[`tournament_registration-${item.id}`] || actionState[`team-${item.id}`];
                            const teamRegStatus = teamRegState || item.registration_status;

                            const isTeamApproved = item.action_type === 'tournament_registration'
                                ? (currentStatus === 'approved' || currentStatus === 'accepted')
                                : (teamRegStatus === 'approved' || teamRegStatus === 'accepted');

                            const isRosterActionApproved = actionState[`tournament_roster_submission-${item.id}`] === 'accepted'
                                || actionState[`roster-${item.id}`] === 'accepted'
                                || (item.action_type === 'tournament_roster_submission' && (currentStatus === 'accepted' || currentStatus === 'approved'));

                            const teamInitials = getInitials(item.team_name);
                            const hasRosterSubmissions = Boolean(item.roster_player_count && item.roster_player_count > 0);
                            const isRosterExpanded = expandedRosterTeamId === item.id;
                            const isDetailsExpanded = expandedDetailsTeamIds.includes(item.id);

                            return (
                                <div
                                    key={`tour-act-${item.id}-${item.action_type}`}
                                    onClick={(e) => {
                                        const target = e.target as HTMLElement | null;
                                        if (target?.closest('button, a, input, [role="button"], [role="menuitem"], [role="checkbox"]')) {
                                            return;
                                        }
                                        if (item.action_type === 'tournament_registration') {
                                            toggleExpandDetails(item.id);
                                        } else if (item.action_type === 'tournament_roster_submission' && hasRosterSubmissions) {
                                            toggleExpandRoster({
                                                id: item.id,
                                                tournament_id: item.tournament_id,
                                                team_name: item.team_name,
                                                tournament_name: item.tournament_name,
                                                min_players: item.min_players,
                                                max_players: item.max_players,
                                                isTeamApproved: isTeamApproved
                                            });
                                        }
                                    }}
                                    className={cn(
                                        "p-4 transition-colors space-y-4 group",
                                        (item.action_type === 'tournament_registration' || (item.action_type === 'tournament_roster_submission' && hasRosterSubmissions)) && "cursor-pointer",
                                        (isRosterExpanded || isDetailsExpanded) ? "" : "hover:bg-muted/30"
                                    )}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
                                        <div className="flex items-start gap-3 md:gap-4 min-w-0 flex-1">
                                            <Avatar className="h-10 w-10 rounded-full shrink-0 bg-muted/40 overflow-hidden">
                                                {item.team_logo && (
                                                    <AvatarImage
                                                        src={item.team_logo}
                                                        alt={item.team_name}
                                                        className="object-contain"
                                                    />
                                                )}
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                                    {teamInitials || <Users className="size-4" />}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="space-y-1.5 min-w-0 flex-1">
                                                {item.action_type === 'tournament_registration' ? (
                                                    <p className="text-sm font-normal leading-relaxed text-foreground">
                                                        ทีม <span className="font-semibold text-foreground">{item.team_name}</span> ขอสมัครเข้าร่วมรายการ <span className="font-semibold text-foreground">{item.tournament_name}</span>
                                                    </p>
                                                ) : item.action_type === 'tournament_roster_submission' ? (
                                                    <p className="text-sm font-normal leading-relaxed text-foreground">
                                                        ทีม <span className="font-semibold text-foreground">{item.team_name}</span> ได้ยื่นรายชื่อ/เอกสารนักกีฬา ({item.roster_player_count || 0} คน) สำหรับรายการ <span className="font-semibold text-foreground">{item.tournament_name}</span>
                                                    </p>
                                                ) : (
                                                    <p className="text-sm font-normal leading-relaxed text-foreground">
                                                        ทีม <span className="font-semibold text-foreground">{item.team_name}</span> ขอปลดล็อคแก้ไขรายชื่อนักกีฬาในรายการ <span className="font-semibold text-foreground">{item.tournament_name}</span>
                                                    </p>
                                                )}

                                                {/* Status/Action Tag & Timestamp */}
                                                <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                                                    {currentStatus === 'accepted' || currentStatus === 'approved' ? (
                                                        <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
                                                            {isTh ? "อนุมัติแล้ว" : "Approved"}
                                                        </Badge>
                                                    ) : currentStatus === 'rejected' ? (
                                                        <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10">
                                                            {isTh ? "ปฏิเสธแล้ว" : "Rejected"}
                                                        </Badge>
                                                    ) : currentStatus === 'error' ? (
                                                        <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10">
                                                            <span>Error occurred</span>
                                                        </Badge>
                                                    ) : item.action_type === 'tournament_registration' ? (
                                                        <Badge variant="outline" className="text-blue-600 border-blue-500/50 bg-blue-500/10">
                                                            <span>{isTh ? "ยืนยันทีมสมัคร" : "Team Approval"}</span>
                                                        </Badge>
                                                    ) : item.action_type === 'tournament_roster_submission' ? (
                                                        <Badge variant="outline" className="text-emerald-600 border-emerald-500/50 bg-emerald-500/10">
                                                            {isTh ? "ยอมรับเอกสาร/รายชื่อ" : "Roster Verification"}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-amber-600 border-amber-500/50 bg-amber-500/10">
                                                            {isTh ? "ขอปลดล็อครายชื่อ" : "Unlock Request"}
                                                        </Badge>
                                                    )}
                                                    <span className="text-xs text-muted-foreground font-bold">•</span>
                                                    <span className="text-xs text-muted-foreground font-medium">
                                                        {formatDate(item.created_at, "MMM d, yyyy · HH:mm", locale)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons & Menu */}
                                        <div className="flex items-center gap-1.5 md:gap-2 shrink-0 self-end sm:self-center">
                                            {currentStatus === 'accepted' || currentStatus === 'approved' ? (
                                                item.action_type === 'tournament_registration' && hasRosterSubmissions && !isRosterActionApproved ? (
                                                    <div className="flex items-center gap-1.5 md:gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleRejectTournamentRoster(item.id, item.tournament_id)}
                                                            disabled={isPending}
                                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                        >
                                                            {isPending && <Loader2 className="size-4 animate-spin" />}
                                                            {isTh ? "ปฏิเสธ" : "Reject"}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleApproveTournamentRoster(item.id, item.tournament_id)}
                                                            disabled={isPending}
                                                        >
                                                            {isPending && <Loader2 className="size-4 animate-spin" />}
                                                            {isTh ? "ยอมรับเอกสาร" : "Accept Roster"}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    item.action_type === 'tournament_registration' ? (
                                                        <Badge variant="outline" className="text-blue-600 border-blue-500/50 bg-blue-500/10">
                                                            {isTh ? "ยืนยันทีมสมัคร" : "Team Approval"}
                                                        </Badge>
                                                    ) : item.action_type === 'tournament_roster_submission' ? (
                                                        <Badge variant="outline" className="text-emerald-600 border-emerald-500/50 bg-emerald-500/10">
                                                            {isTh ? "ยอมรับเอกสาร/รายชื่อ" : "Roster Verification"}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-amber-600 border-amber-500/50 bg-amber-500/10">
                                                            {isTh ? "ขอปลดล็อครายชื่อ" : "Unlock Request"}
                                                        </Badge>
                                                    )
                                                )
                                            ) : currentStatus === 'rejected' || currentStatus === 'error' ? (
                                                item.action_type === 'tournament_registration' ? (
                                                    <Badge variant="outline" className="text-blue-600 border-blue-500/50 bg-blue-500/10">
                                                        {isTh ? "ยืนยันทีมสมัคร" : "Team Approval"}
                                                    </Badge>
                                                ) : item.action_type === 'tournament_roster_submission' ? (
                                                    <Badge variant="outline" className="text-emerald-600 border-emerald-500/50 bg-emerald-500/10">
                                                        {isTh ? "ยอมรับเอกสาร/รายชื่อ" : "Roster Verification"}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-amber-600 border-amber-500/50 bg-amber-500/10">
                                                        {isTh ? "ขอปลดล็อครายชื่อ" : "Unlock Request"}
                                                    </Badge>
                                                )
                                            ) : (
                                                <div className="flex items-center">
                                                    {item.action_type === 'tournament_registration' ? (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleRejectTournamentReg(item.id, item.tournament_id)}
                                                                disabled={isPending}
                                                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            >
                                                                {isPending && <Loader2 className="size-4 animate-spin" />}
                                                                {isTh ? "ปฏิเสธ" : "Reject"}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleApproveTournamentReg(item.id, item.tournament_id)}
                                                                disabled={isPending}
                                                            >
                                                                {isPending && <Loader2 className="size-4 animate-spin" />}
                                                                {isTh ? "ยืนยันทีม" : "Approve Team"}
                                                            </Button>
                                                        </>
                                                    ) : item.action_type === 'tournament_roster_submission' ? (
                                                        hasRosterSubmissions ? (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleRejectTournamentRoster(item.id, item.tournament_id)}
                                                                    disabled={isPending}
                                                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                >
                                                                    {isPending && <Loader2 className="size-4 animate-spin" />}
                                                                    {isTh ? "ปฏิเสธ" : "Reject"}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleApproveTournamentRoster(item.id, item.tournament_id)}
                                                                    disabled={!isTeamApproved || isPending}
                                                                    title={!isTeamApproved ? (isTh ? "กรุณายืนยันทีมก่อนยอมรับเอกสาร" : "Please approve team first") : undefined}
                                                                    className="disabled:opacity-50"
                                                                >
                                                                    {isPending && <Loader2 className="size-4 animate-spin" />}
                                                                    {isTh ? "ยอมรับเอกสาร" : "Accept Roster"}
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <Badge variant="outline" className="text-muted-foreground border-muted-foreground/50 bg-muted-foreground/10">
                                                                {isTh ? "ยังไม่มีการยื่นเอกสาร" : "No documents"}
                                                            </Badge>
                                                        )
                                                    ) : (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleRejectTournamentUnlock(item.id, item.tournament_id)}
                                                                disabled={isPending}
                                                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            >
                                                                {isPending && <Loader2 className="size-4 animate-spin" />}
                                                                {isTh ? "ปฏิเสธ" : "Reject"}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleApproveTournamentUnlock(item.id, item.tournament_id)}
                                                                disabled={isPending}
                                                            >
                                                                {isPending && <Loader2 className="size-4 animate-spin" />}
                                                                {isTh ? "ปลดล็อค" : "Unlock"}
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            {item.action_type === 'tournament_registration' ? (
                                                <ChevronDown className={cn(
                                                    "size-4 text-muted-foreground/60 transition-transform duration-200 shrink-0",
                                                    isDetailsExpanded && "rotate-180 text-foreground"
                                                )} />
                                            ) : item.action_type === 'tournament_roster_submission' && hasRosterSubmissions ? (
                                                <ChevronDown className={cn(
                                                    "size-4 text-muted-foreground/60 transition-transform duration-200 shrink-0",
                                                    isRosterExpanded && "rotate-180 text-foreground"
                                                )} />
                                            ) : null}
                                        </div>
                                    </div>

                                    {/* Inline Expandable Registration Details Dropdown Section */}
                                    {isDetailsExpanded && item.action_type === 'tournament_registration' && (
                                        <div
                                            onClick={(e) => e.stopPropagation()}
                                            className="pl-0 sm:pl-[54px] md:pl-[58px] animate-in fade-in-50 slide-in-from-top-1 duration-200"
                                        >
                                            <div className="rounded-sm border border-border bg-card overflow-hidden">
                                                {/* Header */}
                                                <div className="p-4 flex items-center justify-between border-b border-border">
                                                    <Header level={5}>
                                                        {isTh ? "ข้อมูลการสมัครทีม" : "Team Registration Details"}
                                                    </Header>
                                                    {item.category_name && (
                                                        <Badge variant="outline" className="text-primary border-primary/50 bg-primary/10">{item.category_name}</Badge>
                                                    )}
                                                </div>

                                                {/* 2-Column Split: Info rows on Left, Payment Slip on Right */}
                                                <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-border">
                                                    {/* Left side: Information Rows */}
                                                    <div className="md:col-span-7 lg:col-span-7">
                                                        {/* Row 1: Registration Fee */}
                                                        <div className="flex items-center gap-4 px-4 py-2">
                                                            <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                                                <CreditCard className="size-4 text-muted-foreground" />
                                                            </div>
                                                            <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                                                                <Header level={6} className="text-muted-foreground">{isTh ? "ค่าสมัครเข้าร่วม" : "Registration Fee"}</Header>
                                                                <Label className="text-primary">
                                                                    {item.registration_fee !== undefined
                                                                        ? item.registration_fee > 0
                                                                            ? `฿${item.registration_fee.toLocaleString()}`
                                                                            : isTh ? "ฟรี (ไม่มีค่าใช้จ่าย)" : "Free"
                                                                        : "-"}
                                                                </Label>
                                                            </div>
                                                        </div>

                                                        {/* Row 2: Contact Person */}
                                                        <div className="flex items-center gap-4 px-4 py-2">
                                                            <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                                                <User className="size-4 text-muted-foreground" />
                                                            </div>
                                                            <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                                                                <Header level={6} className="text-muted-foreground">{isTh ? "ชื่อผู้ติดต่อ/ผู้จัดการ" : "Contact Person"}</Header>
                                                                <Label>{item.contact_name || (isTh ? "ไม่ระบุ" : "Not specified")}</Label>
                                                            </div>
                                                        </div>

                                                        {/* Row 3: Contact Phone */}
                                                        <div className="flex items-center gap-4 px-4 py-2">
                                                            <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                                                <Phone className="size-4 text-muted-foreground" />
                                                            </div>
                                                            <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                                                                <Header level={6} className="text-muted-foreground">{isTh ? "เบอร์โทรศัพท์ติดต่อ" : "Phone Number"}</Header>
                                                                {item.contact_phone ? (
                                                                    <Label asChild className="hover:text-primary transition-colors block truncate cursor-pointer">
                                                                        <a href={`tel:${item.contact_phone}`} onClick={(e) => e.stopPropagation()}>
                                                                            {item.contact_phone}
                                                                        </a>
                                                                    </Label>
                                                                ) : (
                                                                    <Label>-</Label>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Row 4: Quota & Player Limits */}
                                                        {(item.min_players !== undefined || item.max_teams !== undefined) && (
                                                            <div className="flex items-center gap-4 px-4 py-2">
                                                                <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                                                    <Users className="size-4 text-muted-foreground" />
                                                                </div>
                                                                <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                                                                    <Header level={6} className="text-muted-foreground">{isTh ? "เกณฑ์นักกีฬา & โควตา" : "Limits & Quota"}</Header>
                                                                    <div className="flex items-center gap-4 flex-wrap justify-end">
                                                                        {item.min_players !== undefined && (
                                                                            <Label>
                                                                                {item.min_players}-{item.max_players || 20} {isTh ? "คน/ทีม" : "players"}
                                                                            </Label>
                                                                        )}
                                                                        {item.max_teams !== undefined && (
                                                                            <Label>
                                                                                {item.approved_teams_count || 0}/{item.max_teams} {isTh ? "ทีม" : "teams"}
                                                                            </Label>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Right side: Payment Slip Preview */}
                                                    <div className="md:col-span-5 lg:col-span-5 p-4 flex flex-col justify-between">
                                                        <div className="flex items-center justify-between gap-2">
                                                            {!item.slip_img && (
                                                                <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted-foreground/50 bg-muted-foreground/10">
                                                                    {isTh ? "ไม่มีสลิป" : "No slip"}
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        {item.slip_img ? (
                                                            <div className="space-y-4">
                                                                <div
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setViewingSlipUrl(item.slip_img!);
                                                                    }}
                                                                    className="group/slip relative w-full aspect-[4/3] rounded-sm overflow-hidden border border-border cursor-pointer shadow-2xs hover:border-primary/60 transition-all bg-muted"
                                                                >
                                                                    <Image
                                                                        src={item.slip_img}
                                                                        alt="Slip"
                                                                        fill
                                                                        sizes="(max-width: 768px) 100vw, 240px"
                                                                        className="object-cover group-hover/slip:scale-105 transition-transform duration-300"
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/slip:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs font-bold text-white">
                                                                        <Eye className="size-4" />
                                                                        <span>{isTh ? "ดูสลิปขนาดเต็ม" : "View Full Slip"}</span>
                                                                    </div>
                                                                </div>
                                                                <p className="text-[10px] text-muted-foreground text-center">
                                                                    {isTh ? "คลิกที่รูปเพื่อดูสลิปฉบับเต็ม" : "Click image to view full slip"}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <div className="flex-1 min-h-[90px] flex flex-col items-center justify-center py-4 border border-dashed border-border rounded-sm bg-muted/10 text-center">
                                                                <Receipt className="size-5 text-muted-foreground/40 mb-1" />
                                                                <span className="text-xs text-muted-foreground">
                                                                    {isTh ? "ไม่มีหลักฐานการชำระเงิน" : "No slip attached"}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Inline Expandable Roster Inspection Section */}
                                    {isRosterExpanded && (
                                        <div
                                            onClick={(e) => e.stopPropagation()}
                                            className="pl-0 sm:pl-[54px] md:pl-[58px] mt-2 space-y-3.5 animate-in fade-in-50 slide-in-from-top-1 duration-200"
                                        >
                                            {/* Alert banner if team registration has not been approved */}
                                            {!isTeamApproved && (
                                                <div className="p-3 rounded-sm bg-transparent border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
                                                    <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                                    <span>
                                                        {isTh
                                                            ? "กรุณากดยืนยันทีม (Approve Team) ก่อน จึงจะสามารถอนุมัติรายชื่อนักกีฬาได้"
                                                            : "Please approve the team registration first before approving players."}
                                                    </span>
                                                </div>
                                            )}

                                            {loadingRoster ? (
                                                <div className="py-6 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                    <span className="text-xs">{isTh ? "กำลังโหลดรายชื่อ..." : "Loading roster..."}</span>
                                                </div>
                                            ) : rosterPlayers.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-muted-foreground rounded-sm border border-border bg-card">
                                                    {isTh ? "ไม่พบข้อมูลรายชื่อนักกีฬาที่ส่งมา" : "No roster submissions found."}
                                                </div>
                                            ) : (() => {
                                                const query = rosterSearchQuery.trim().toLowerCase();
                                                const filtered = rosterPlayers.filter(p => {
                                                    if (!query) return true;
                                                    const nameMatch = (p.name || "").toLowerCase().includes(query);
                                                    const numMatch = (p.shirt_number || "").toString().includes(query);
                                                    const posMatch = (p.position || "").toLowerCase().includes(query);
                                                    const telMatch = (p.tel || "").toLowerCase().includes(query);
                                                    return nameMatch || numMatch || posMatch || telMatch;
                                                });

                                                const pendingFiltered = filtered.filter(p => p.status === 'pending');
                                                const allPendingSelected = pendingFiltered.length > 0 && pendingFiltered.every(p => selectedRosterIds.includes(p.id));

                                                const toggleSelectAll = () => {
                                                    if (allPendingSelected) {
                                                        setSelectedRosterIds(prev => prev.filter(id => !pendingFiltered.some(p => p.id === id)));
                                                    } else {
                                                        const newIds = Array.from(new Set([...selectedRosterIds, ...pendingFiltered.map(p => p.id)]));
                                                        setSelectedRosterIds(newIds);
                                                    }
                                                };

                                                const toggleSelectPlayer = (id: string) => {
                                                    setSelectedRosterIds(prev =>
                                                        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
                                                    );
                                                };

                                                return (
                                                    <div className="space-y-3">
                                                        {/* Summary Badges & Limit Header */}
                                                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <Badge variant="outline" className="text-muted-foreground border-muted-foreground/50 bg-muted-foreground/10">
                                                                    {isTh ? `ทั้งหมด ${rosterPlayers.length} คน` : `Total ${rosterPlayers.length}`}
                                                                </Badge>
                                                                <Badge variant="outline" className="border-emerald-500/50 text-emerald-600 bg-emerald-500/10">
                                                                    {isTh ? `อนุมัติแล้ว ${rosterPlayers.filter(p => p.status === 'approved').length} คน` : `Approved ${rosterPlayers.filter(p => p.status === 'approved').length}`}
                                                                </Badge>
                                                                <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-500/10">
                                                                    {isTh ? `รอตรวจ ${rosterPlayers.filter(p => p.status === 'pending').length} คน` : `Pending ${rosterPlayers.filter(p => p.status === 'pending').length}`}
                                                                </Badge>
                                                                {rosterPlayers.some(p => p.status === 'rejected') && (
                                                                    <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10">
                                                                        {isTh ? `ไม่ผ่าน ${rosterPlayers.filter(p => p.status === 'rejected').length} คน` : `Rejected ${rosterPlayers.filter(p => p.status === 'rejected').length}`}
                                                                    </Badge>
                                                                )}
                                                            </div>

                                                            {expandedRosterItem?.min_players && (
                                                                <span className="text-[11px] text-muted-foreground font-medium">
                                                                    {isTh
                                                                        ? `เกณฑ์: ${expandedRosterItem.min_players} - ${expandedRosterItem.max_players || 20} คน`
                                                                        : `Limit: ${expandedRosterItem.min_players}-${expandedRosterItem.max_players || 20}`}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Search and Selection Controls */}
                                                        <div className="flex items-center gap-2 flex-col sm:flex-row">
                                                            <div className="relative group w-full flex-1">
                                                                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50 group-focus-within:text-primary transition-all duration-300" />
                                                                <Input
                                                                    type="text"
                                                                    size="sm"
                                                                    className="bg-card pr-8 rounded-sm text-xs h-8"
                                                                    value={rosterSearchQuery}
                                                                    onChange={(e) => setRosterSearchQuery(e.target.value)}
                                                                    placeholder={isTh ? "ค้นหาชื่อ, เบอร์เสื้อ, หรือตำแหน่ง..." : "Search athlete, number, position..."}
                                                                />
                                                            </div>
                                                            {pendingFiltered.length > 0 && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={toggleSelectAll}
                                                                    disabled={!isTeamApproved}
                                                                    title={!isTeamApproved ? (isTh ? "กรุณายืนยันทีมก่อน" : "Please approve team first") : undefined}
                                                                >
                                                                    {allPendingSelected
                                                                        ? (isTh ? "ยกเลิกเลือกทั้งหมด" : "Deselect All")
                                                                        : (isTh ? "เลือกทั้งหมด" : "Select All")}
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {/* Players List Section */}
                                                        {filtered.length === 0 ? (
                                                            <div className="p-4 text-center text-xs text-muted-foreground rounded-sm border border-border bg-card">
                                                                {isTh ? "ไม่พบรายชื่อนักกีฬาที่ตรงกับการค้นหา" : "No players match your search."}
                                                            </div>
                                                        ) : (
                                                            <div className="border border-border rounded-sm bg-card overflow-hidden max-h-[340px] overflow-y-auto divide-y divide-border">
                                                                {filtered.map((player, idx) => {
                                                                    const isSelected = selectedRosterIds.includes(player.id);
                                                                    const isPendingStatus = player.status === 'pending';

                                                                    return (
                                                                        <div
                                                                            key={player.id || idx}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (isPendingStatus && isTeamApproved) {
                                                                                    toggleSelectPlayer(player.id);
                                                                                }
                                                                            }}
                                                                            className={cn(
                                                                                "p-3 flex items-center justify-between gap-3 transition-colors",
                                                                                isPendingStatus && isTeamApproved && "cursor-pointer select-none hover:bg-muted/30",
                                                                                isSelected ? "bg-primary/10 hover:bg-primary/15" : "bg-card"
                                                                            )}
                                                                        >
                                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                                {/* Individual Checkbox */}
                                                                                {isPendingStatus ? (
                                                                                    <div
                                                                                        role="checkbox"
                                                                                        aria-checked={isSelected}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            if (isTeamApproved) {
                                                                                                toggleSelectPlayer(player.id);
                                                                                            }
                                                                                        }}
                                                                                        className={cn(
                                                                                            "shrink-0 p-0.5 text-muted-foreground rounded-sm transition-colors",
                                                                                            isTeamApproved ? "hover:text-foreground cursor-pointer" : "opacity-40 cursor-not-allowed"
                                                                                        )}
                                                                                    >
                                                                                        {isSelected ? (
                                                                                            <CheckSquare className="size-4 text-primary" />
                                                                                        ) : (
                                                                                            <Square className="size-4 text-muted-foreground/60" />
                                                                                        )}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="w-5 shrink-0" />
                                                                                )}

                                                                                <Avatar className="h-8 w-8 rounded-full shrink-0 bg-transparent overflow-hidden">
                                                                                    {player.photo_url && (
                                                                                        <AvatarImage src={player.photo_url} alt={player.name} className="object-cover rounded-full" />
                                                                                    )}
                                                                                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-[11px] rounded-full">
                                                                                        {getInitials(player.name) || (idx + 1)}
                                                                                    </AvatarFallback>
                                                                                </Avatar>
                                                                                <div className="min-w-0">
                                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                                        <span className="text-xs font-bold text-foreground truncate">{player.name}</span>
                                                                                        {player.shirt_number && (
                                                                                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-muted-foreground border-muted-foreground/50 bg-muted-foreground/10">
                                                                                                #{player.shirt_number}
                                                                                            </Badge>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                                                                                        {player.position && (
                                                                                            <span className="font-medium text-foreground/80">{player.position}</span>
                                                                                        )}
                                                                                        {player.tel && (
                                                                                            <>
                                                                                                <span className="text-[10px] text-muted-foreground/30">•</span>
                                                                                                <a
                                                                                                    href={`tel:${player.tel}`}
                                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                                    className="text-primary hover:underline flex items-center gap-1"
                                                                                                >
                                                                                                    <Phone className="h-3 w-3" />
                                                                                                    <span>{player.tel}</span>
                                                                                                </a>
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                    {player.rejection_reason && (
                                                                                        <div className="text-[10px] text-destructive mt-0.5 font-medium bg-destructive/10 px-1.5 py-0.5 rounded-sm border border-destructive/50 inline-block">
                                                                                            {isTh ? "เหตุผล: " : "Reason: "}{player.rejection_reason}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-1 shrink-0">
                                                                                {player.status === 'approved' ? (
                                                                                    <Badge variant="outline" className="border-emerald-500/50 text-emerald-600 bg-emerald-500/10 text-[11px]">
                                                                                        {isTh ? "อนุมัติแล้ว" : "Approved"}
                                                                                    </Badge>
                                                                                ) : player.status === 'rejected' ? (
                                                                                    <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10 text-[11px]">
                                                                                        {isTh ? "ปฏิเสธแล้ว" : "Rejected"}
                                                                                    </Badge>
                                                                                ) : (
                                                                                    <div
                                                                                        className="flex items-center gap-1"
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                    >
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="icon-sm"
                                                                                            title={isTh ? "ปฏิเสธ" : "Reject"}
                                                                                            aria-label={isTh ? "ปฏิเสธ" : "Reject"}
                                                                                            disabled={actioningPlayerId === player.id || isPending || isBatchApproving}
                                                                                            onClick={() => handleRejectSinglePlayer(player.id)}
                                                                                        >
                                                                                            {actioningPlayerId === player.id ? (
                                                                                                <Loader2 className="size-4 animate-spin" />
                                                                                            ) : (
                                                                                                <X className="size-4 text-destructive" />
                                                                                            )}
                                                                                        </Button>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="icon-sm"
                                                                                            title={!isTeamApproved ? (isTh ? "กรุณายืนยันทีมก่อนอนุมัติ" : "Please approve team first") : (isTh ? "อนุมัติ" : "Approve")}
                                                                                            aria-label={isTh ? "อนุมัติ" : "Approve"}
                                                                                            disabled={!isTeamApproved || actioningPlayerId === player.id || isPending || isBatchApproving}
                                                                                            onClick={() => handleApproveSinglePlayer(player.id)}
                                                                                        >
                                                                                            {actioningPlayerId === player.id ? (
                                                                                                <Loader2 className="size-4 animate-spin" />
                                                                                            ) : (
                                                                                                <Check className={cn("size-4", isTeamApproved ? "text-primary" : "text-muted-foreground/30")} />
                                                                                            )}
                                                                                        </Button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* Action Footer for Inline Roster: HIDE if all are approved/rejected (no pending) */}
                                                        {expandedRosterItem && rosterPlayers.some(p => p.status === 'pending') && (
                                                            <div className="pt-1 flex flex-row items-center justify-between gap-2 flex-wrap">
                                                                <Button
                                                                    type="button"
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => handleRejectTournamentRoster(expandedRosterItem.id, expandedRosterItem.tournament_id)}
                                                                    disabled={isPending || isBatchApproving}
                                                                >
                                                                    {isPending && <Loader2 className="size-4 animate-spin" />}
                                                                    {isTh ? "ปฏิเสธทั้งหมด" : "Reject All"}
                                                                </Button>
                                                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                                                    {selectedRosterIds.length > 0 && (
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={handleApproveSelectedPlayers}
                                                                            disabled={!isTeamApproved || isPending || isBatchApproving}
                                                                            title={!isTeamApproved ? (isTh ? "กรุณายืนยันทีมก่อนอนุมัติ" : "Please approve team first") : undefined}
                                                                        >
                                                                            {isBatchApproving && <Loader2 className="size-4 animate-spin" />}
                                                                            {isTh
                                                                                ? `ยืนยันนักกีฬาที่เลือก (${selectedRosterIds.length})`
                                                                                : `Confirm Selected (${selectedRosterIds.length})`}
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        onClick={() => handleApproveTournamentRoster(expandedRosterItem.id, expandedRosterItem.tournament_id)}
                                                                        disabled={!isTeamApproved || isPending || isBatchApproving}
                                                                        title={!isTeamApproved ? (isTh ? "กรุณายืนยันทีมก่อนอนุมัติ" : "Please approve team first") : undefined}
                                                                    >
                                                                        {isPending && <Loader2 className="size-4 animate-spin" />}
                                                                        {isTh ? "ยอมรับทั้งหมดและล็อครายชื่อ" : "Accept All and Lock"}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {/* Expand / Collapse Roster Button: Compact Badge Style (like add-player-form) */}
                                    {(item.action_type === 'tournament_registration' || item.action_type === 'tournament_roster_submission') && hasRosterSubmissions && (
                                        <div
                                            onClick={(e) => e.stopPropagation()}
                                            className="pl-0 sm:pl-[54px] md:pl-[58px] flex items-center justify-center pt-1"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleExpandRoster({
                                                    id: item.id,
                                                    tournament_id: item.tournament_id,
                                                    team_name: item.team_name,
                                                    tournament_name: item.tournament_name,
                                                    min_players: item.min_players,
                                                    max_players: item.max_players,
                                                    isTeamApproved: isTeamApproved
                                                })}
                                                className={cn(
                                                    "inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer shadow-2xs select-none",
                                                    isRosterExpanded
                                                        ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20"
                                                        : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/70 hover:border-primary/40"
                                                )}
                                            >
                                                <span>
                                                    {isRosterExpanded
                                                        ? (isTh ? "ซ่อนรายชื่อนักกีฬา" : "Hide Roster")
                                                        : (isTh ? `รายชื่อนักกีฬา (${item.roster_player_count})` : `Roster (${item.roster_player_count})`)}
                                                </span>
                                                <ChevronDown className={cn("size-4 transition-transform duration-200", isRosterExpanded && "rotate-180")} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // 2. STAFF INVITATIONS
                        if (item.type === 'invite') {
                            const currentStatus = actionState[item.id] || item.status;
                            const tournamentInitials = getInitials(item.tournament_name);
                            const roleLabel = getRoleLabel(item.role, isTh);
                            const isApproved = currentStatus === 'accepted' || currentStatus === 'approved';

                            return (
                                <div
                                    key={`invite-${item.id}`}
                                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                                    onClick={() => {
                                        if (isApproved) {
                                            router.push(`/${locale}/my-tournaments/${item.tournament_id}`);
                                        } else {
                                            router.push(`/${locale}/tournaments/${item.tournament_id}`);
                                        }
                                    }}
                                >
                                    <div className="flex items-start gap-3 md:gap-4 min-w-0 flex-1">
                                        <Avatar className="h-10 w-10 rounded-full shrink-0 bg-muted/40 overflow-hidden">
                                            {item.tournament_logo && (
                                                <AvatarImage
                                                    src={item.tournament_logo}
                                                    alt={item.tournament_name || "Tournament"}
                                                    className="object-contain"
                                                />
                                            )}
                                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                                {tournamentInitials || <Trophy className="size-4" />}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="space-y-1.5 min-w-0 flex-1">
                                            <p className="text-sm font-normal leading-relaxed text-foreground">
                                                {isTh ? (
                                                    <>
                                                        คุณได้รับคำเชิญเข้าร่วมเป็นทีมงานในรายการแข่งขัน <span className="font-semibold text-foreground">{item.tournament_name || "Unknown Tournament"}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        You have been invited to join <span className="font-semibold text-foreground">{item.tournament_name || "Unknown Tournament"}</span> as staff
                                                    </>
                                                )}
                                            </p>

                                            {/* Status Badge & Timestamp */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {currentStatus === 'accepted' ? (
                                                    <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
                                                        <span>{isTh ? "ตอบรับแล้ว" : "Accepted"}</span>
                                                    </Badge>
                                                ) : currentStatus === 'rejected' ? (
                                                    <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10">
                                                        <span>{isTh ? "ปฏิเสธแล้ว" : "Declined"}</span>
                                                    </Badge>
                                                ) : currentStatus === 'error' ? (
                                                    <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10">
                                                        <span>Error occurred</span>
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-primary border-primary/50 bg-primary/10">
                                                        <span>{isTh ? `คำเชิญเข้าร่วมเป็น${roleLabel}` : `Invitation: ${roleLabel}`}</span>
                                                    </Badge>
                                                )}

                                                <span className="text-xs text-muted-foreground font-bold">•</span>
                                                <span className="text-xs text-muted-foreground font-medium">
                                                    {formatDate(item.created_at, "MMM d, yyyy · HH:mm", locale)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 md:gap-2 shrink-0 self-end sm:self-center">
                                        {currentStatus === 'accepted' || currentStatus === 'rejected' || currentStatus === 'error' ? (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className="text-primary border-primary/50 bg-primary/10">
                                                    <span>{isTh ? `คำเชิญเข้าร่วมเป็น${roleLabel}` : `Invitation: ${roleLabel}`}</span>
                                                </Badge>
                                            </div>
                                        ) : (
                                            <div className="flex items-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRejectInvite(item.tournament_id, item.id);
                                                    }}
                                                    disabled={isPending}
                                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                >
                                                    {isPending && <Loader2 className="size-4 animate-spin" />}
                                                    {isTh ? "ปฏิเสธ" : "Decline"}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAcceptInvite(item.tournament_id, item.id);
                                                    }}
                                                    disabled={isPending}
                                                >
                                                    {isPending && <Loader2 className="size-4 animate-spin" />}
                                                    {isTh ? "ตอบรับ" : "Accept"}
                                                </Button>
                                            </div>
                                        )}
                                        <ChevronRight className="size-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                                    </div>
                                </div>
                            );
                        }

                        // 3. TEAM REGISTRATION NOTIFICATIONS (FOR PARTICIPATING TEAMS)
                        if (item.type === 'registration') {
                            const regStatus = item.registration_status;
                            const displayLogo = item.team_logo || item.tournament_logo;
                            const initials = getInitials(item.team_name || item.tournament_name);
                            const squadViewQuery = typeof window !== "undefined" && (localStorage.getItem("squad_view_mode") === "card" || localStorage.getItem("squad_view_mode") === "grid") ? "?view=card" : "?view=list";

                            return (
                                <div
                                    key={`reg-${item.id}`}
                                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                                    onClick={() => router.push(`/${locale}/inboxes/teams/${item.id}${squadViewQuery}`)}
                                >
                                    <div className="flex items-start gap-3 md:gap-4">
                                        <Avatar className="h-10 w-10 rounded-full shrink-0 bg-muted/40 overflow-hidden">
                                            {displayLogo && (
                                                <AvatarImage
                                                    src={displayLogo}
                                                    alt={item.team_name}
                                                    className="object-contain"
                                                />
                                            )}
                                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                                {initials || <Users className="size-4" />}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="space-y-1.5 min-w-0 flex-1">
                                            {isTh ? (
                                                <p className="text-sm font-normal leading-relaxed text-foreground">
                                                    การสมัครของทีม <span className="font-semibold text-foreground">{item.team_name}</span> ในรายการ <span className="font-semibold text-foreground">{item.tournament_name}</span>
                                                </p>
                                            ) : (
                                                <p className="text-sm font-normal leading-relaxed text-foreground">
                                                    Registration for team <span className="font-semibold text-foreground">{item.team_name}</span> in <span className="font-semibold text-foreground">{item.tournament_name}</span>
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {regStatus === 'approved' ? (
                                                    <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
                                                        {getStatusText(regStatus)}
                                                    </Badge>
                                                ) : regStatus === 'rejected' ? (
                                                    <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10">
                                                        {getStatusText(regStatus)}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="border-warning/50 text-warning bg-warning/10">
                                                        {getStatusText(regStatus)}
                                                    </Badge>
                                                )}
                                                <span className="text-xs text-muted-foreground font-bold">•</span>
                                                <span className="text-xs text-muted-foreground font-medium">
                                                    {formatDate(item.created_at, "MMM d, yyyy · HH:mm", locale)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 md:gap-2 shrink-0 self-end sm:self-center">
                                        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/50 bg-muted-foreground/10">
                                            {tReg("nav_team_registration") || (isTh ? "การสมัครทีม" : "Team Registration")}
                                        </Badge>
                                        <ChevronRight className="size-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                                    </div>
                                </div>
                            );
                        }

                        // 4. TEAM MANAGEMENT REQUEST (SENT)
                        if (item.type === 'team_request') {
                            const reqStatus = item.status;
                            const teamInitials = getInitials(item.team_name);
                            const squadViewQuery = typeof window !== "undefined" && (localStorage.getItem("squad_view_mode") === "card" || localStorage.getItem("squad_view_mode") === "grid") ? "?view=card" : "?view=list";

                            return (
                                <div
                                    key={`team-req-${item.id}`}
                                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                                    onClick={() => router.push(item.team_id ? `/${locale}/inboxes/teams/${item.team_id}${squadViewQuery}&from=team_request` : `/${locale}/inboxes`)}
                                >
                                    <div className="flex items-start gap-3 md:gap-4 min-w-0 flex-1">
                                        <Avatar className="h-10 w-10 rounded-full shrink-0 bg-muted/40 overflow-hidden">
                                            {item.team_logo && (
                                                <AvatarImage
                                                    src={item.team_logo}
                                                    alt={item.team_name}
                                                    className="object-contain"
                                                />
                                            )}
                                            <AvatarFallback className="bg-amber-500/10 text-amber-600 font-bold text-xs">
                                                {teamInitials || <ShieldCheck className="size-4" />}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="space-y-1.5 min-w-0 flex-1">
                                            {isTh ? (
                                                <p className="text-sm font-normal leading-relaxed text-foreground">
                                                    คำขอสิทธิ์การจัดการทีม <span className="font-semibold text-foreground">{item.team_name}</span> {reqStatus === 'approved' ? 'ได้รับการอนุมัติแล้ว' : reqStatus === 'rejected' ? 'ถูกปฏิเสธ' : reqStatus === 'cancelled' ? 'ถูกยกเลิกแล้ว' : 'กำลังรอการอนุมัติ'}
                                                </p>
                                            ) : (
                                                <p className="text-sm font-normal leading-relaxed text-foreground">
                                                    Team management request for <span className="font-semibold text-foreground">{item.team_name}</span> is <span className="font-semibold text-foreground">{getStatusText(reqStatus)}</span>
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {reqStatus === 'approved' ? (
                                                    <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
                                                        {getStatusText(reqStatus)}
                                                    </Badge>
                                                ) : reqStatus === 'rejected' ? (
                                                    <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10">
                                                        {getStatusText(reqStatus)}
                                                    </Badge>
                                                ) : reqStatus === 'cancelled' ? (
                                                    <Badge variant="outline" className="border-muted-foreground/50 text-muted-foreground bg-muted-foreground/10">
                                                        {getStatusText(reqStatus)}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-500/10">
                                                        {getStatusText(reqStatus)}
                                                    </Badge>
                                                )}
                                                <span className="text-xs text-muted-foreground font-bold">•</span>
                                                <span className="text-xs text-muted-foreground font-medium">
                                                    {formatDate(item.created_at, "MMM d, yyyy · HH:mm", locale)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 md:gap-2 shrink-0 self-end sm:self-center">
                                        {reqStatus === 'pending' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTeamReqToCancel({ id: item.id, team_id: item.team_id });
                                                }}
                                                disabled={isPending}
                                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            >
                                                {isTh ? "ยกเลิกคำขอ" : "Cancel"}
                                            </Button>
                                        )}
                                        <Badge variant="outline" className="text-amber-600 border-amber-500/50 bg-amber-500/10">
                                            {isTh ? 'คำขอจัดการทีมที่ส่ง' : 'Team Request (Sent)'}
                                        </Badge>
                                        <ChevronRight className="size-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                                    </div>
                                </div>
                            );
                        }

                        // 5. INCOMING TEAM MANAGEMENT REQUEST
                        if (item.type === 'incoming_team_request') {
                            const currentStatus = actionState[item.id] || item.status;
                            const avatarSrc = item.requester_avatar || item.team_logo;
                            const displayInitials = getInitials(item.requester_name || item.team_name);
                            const squadViewQuery = typeof window !== "undefined" && (localStorage.getItem("squad_view_mode") === "card" || localStorage.getItem("squad_view_mode") === "grid") ? "?view=card" : "?view=list";
                            const isDetailsExpanded = expandedDetailsTeamIds.includes(item.id);

                            return (
                                <div
                                    key={`in-team-req-${item.id}`}
                                    onClick={(e) => {
                                        const target = e.target as HTMLElement | null;
                                        if (target?.closest('button, a, input, [role="button"], [role="menuitem"], [role="checkbox"]')) {
                                            return;
                                        }
                                        toggleExpandDetails(item.id);
                                    }}
                                    className={cn(
                                        "p-4 transition-colors space-y-4 cursor-pointer",
                                        isDetailsExpanded ? "" : "hover:bg-muted/30"
                                    )}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
                                        <div className="flex items-start gap-3 md:gap-4 min-w-0 flex-1">
                                            <Avatar className="h-10 w-10 rounded-full shrink-0 bg-muted/40 overflow-hidden">
                                                {avatarSrc && (
                                                    <AvatarImage
                                                        src={avatarSrc}
                                                        alt={item.requester_name}
                                                        className="object-contain"
                                                    />
                                                )}
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                                    {displayInitials || <User className="size-4" />}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="space-y-1.5 min-w-0 flex-1">
                                                {isTh ? (
                                                    <p className="text-sm font-normal leading-relaxed text-foreground">
                                                        <span className="font-semibold text-foreground">{item.requester_name}</span> ขอสิทธิ์การจัดการทีม <span className="font-semibold text-foreground">{item.team_name}</span>
                                                    </p>
                                                ) : (
                                                    <p className="text-sm font-normal leading-relaxed text-foreground">
                                                        <span className="font-semibold text-foreground">{item.requester_name}</span> is requesting management rights for team <span className="font-semibold text-foreground">{item.team_name}</span>
                                                    </p>
                                                )}

                                                {/* Status Badge & Timestamp */}
                                                <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                                                    {currentStatus === 'approved' || currentStatus === 'accepted' ? (
                                                        <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
                                                            {isTh ? "อนุมัติแล้ว" : "Approved"}
                                                        </Badge>
                                                    ) : currentStatus === 'rejected' ? (
                                                        <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10">
                                                            {isTh ? "ปฏิเสธแล้ว" : "Rejected"}
                                                        </Badge>
                                                    ) : currentStatus === 'error' ? (
                                                        <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10">
                                                            <span>Error occurred</span>
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-purple-600 border-purple-500/50 bg-purple-500/10">
                                                            {isTh ? 'คำขอจัดการทีมที่ได้รับ' : 'Team Request (Incoming)'}
                                                        </Badge>
                                                    )}
                                                    <span className="text-xs text-muted-foreground font-bold">•</span>
                                                    <span className="text-xs text-muted-foreground font-medium">
                                                        {formatDate(item.created_at, "MMM d, yyyy · HH:mm", locale)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 md:gap-2 shrink-0 self-end sm:self-center">
                                            {currentStatus === 'approved' || currentStatus === 'accepted' || currentStatus === 'rejected' || currentStatus === 'error' ? (
                                                <Badge variant="outline" className="text-purple-600 border-purple-500/50 bg-purple-500/10">
                                                    {isTh ? 'คำขอจัดการทีมที่ได้รับ' : 'Team Request (Incoming)'}
                                                </Badge>
                                            ) : (
                                                <div className="flex items-center gap-1.5 md:gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRejectTeamRequest(item.id);
                                                        }}
                                                        disabled={isPending}
                                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                    >
                                                        {isPending && <Loader2 className="size-4 animate-spin" />}
                                                        {isTh ? "ปฏิเสธ" : "Reject"}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleApproveTeamRequest(item.id);
                                                        }}
                                                        disabled={isPending}
                                                    >
                                                        {isPending && <Loader2 className="size-4 animate-spin" />}
                                                        {isTh ? "อนุมัติและโอนสิทธิ์" : "Approve"}
                                                    </Button>
                                                </div>
                                            )}
                                        
                                            <ChevronDown className={cn(
                                                "size-4 text-muted-foreground/60 transition-transform duration-200 shrink-0",
                                                isDetailsExpanded && "rotate-180 text-foreground"
                                            )} />
                                        </div>
                                    </div>

                                    {/* Inline Expandable Team Management Request Details Dropdown Section */}
                                    {isDetailsExpanded && (
                                        <div
                                            onClick={(e) => e.stopPropagation()}
                                            className="pl-0 sm:pl-[54px] md:pl-[58px] animate-in fade-in-50 slide-in-from-top-1 duration-200"
                                        >
                                            <div className="rounded-sm border border-border bg-card overflow-hidden">
                                                {/* Header */}
                                                <div className="p-4 flex items-center justify-between border-b border-border">
                                                    <Header level={5}>
                                                        {isTh ? "ข้อมูลคำขอสิทธิ์การจัดการทีม" : "Team Management Request Details"}
                                                    </Header>
                                                    {item.team_name && (
                                                        item.team_id ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-primary border-primary/50 bg-primary/10 cursor-pointer hover:bg-primary/20 transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    router.push(`/${locale}/inboxes/teams/${item.team_id}${squadViewQuery}&from=team_request`);
                                                                }}
                                                            >
                                                                {item.team_name}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-primary border-primary/50 bg-primary/10">
                                                                {item.team_name}
                                                            </Badge>
                                                        )
                                                    )}
                                                </div>

                                                {/* Information Rows */}
                                                <div className="divide-y divide-border">
                                                    {/* Row: Requester Name */}
                                                    <div className="flex items-center gap-4 px-4 py-2">
                                                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                                            <User className="size-4 text-muted-foreground" />
                                                        </div>
                                                        <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                                                            <Header level={6} className="text-muted-foreground">{isTh ? "ผู้ขอสิทธิ์" : "Requester"}</Header>
                                                            <Label>{item.requester_name || (isTh ? "ไม่ระบุ" : "Not specified")}</Label>
                                                        </div>
                                                    </div>

                                                    {/* Row: Contact Email */}
                                                    <div className="flex items-center gap-4 px-4 py-2">
                                                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                                            <Mail className="size-4 text-muted-foreground" />
                                                        </div>
                                                        <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                                                            <Header level={6} className="text-muted-foreground">{isTh ? "อีเมลติดต่อ" : "Email"}</Header>
                                                            {item.requester_email ? (
                                                                <Label asChild className="hover:text-primary transition-colors block truncate cursor-pointer">
                                                                    <a href={`mailto:${item.requester_email}`} onClick={(e) => e.stopPropagation()}>
                                                                        {item.requester_email}
                                                                    </a>
                                                                </Label>
                                                            ) : (
                                                                <Label>-</Label>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Row: Contact Phone */}
                                                    <div className="flex items-center gap-4 px-4 py-2">
                                                        <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center">
                                                            <Phone className="size-4 text-muted-foreground" />
                                                        </div>
                                                        <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                                                            <Header level={6} className="text-muted-foreground">{isTh ? "เบอร์โทรศัพท์ติดต่อ" : "Phone Number"}</Header>
                                                            {item.contact_phone ? (
                                                                <Label asChild className="hover:text-primary transition-colors block truncate cursor-pointer">
                                                                    <a href={`tel:${item.contact_phone}`} onClick={(e) => e.stopPropagation()}>
                                                                        {item.contact_phone}
                                                                    </a>
                                                                </Label>
                                                            ) : (
                                                                <Label>-</Label>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Row: Message / Reason */}
                                                    {item.message && (
                                                        <div className="flex items-start gap-4 px-4 py-3">
                                                            <div className="size-9 rounded-sm bg-muted-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                                                                <MessageSquareQuote className="size-4 text-muted-foreground" />
                                                            </div>
                                                            <div className="min-w-0 flex-1 space-y-1">
                                                                <Header level={6} className="text-muted-foreground">{isTh ? "ข้อความ / เหตุผลในการขอสิทธิ์" : "Message / Reason"}</Header>
                                                                <p className="text-xs text-foreground/80 leading-relaxed italic bg-muted/20 p-2.5 rounded-sm border border-border">
                                                                    &ldquo;{item.message}&rdquo;
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // 6. SYSTEM NOTIFICATIONS
                        const isApproved = item.status === 'approved' || item.title.startsWith("✅") || item.title.includes("อนุมัติ");
                        const isRejected = item.status === 'rejected' || item.title.startsWith("❌") || item.title.includes("ปฏิเสธ");
                        const targetUrl = item.link
                            ? (item.link.startsWith(`/${locale}`) ? item.link : `/${locale}${item.link.startsWith('/') ? '' : '/'}${item.link}`)
                            : null;

                        return (
                            <div
                                key={`sys-${item.id}`}
                                className={cn(
                                    "p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors",
                                    targetUrl && "cursor-pointer group"
                                )}
                                onClick={() => {
                                    if (targetUrl) router.push(targetUrl);
                                }}
                            >
                                <div className="flex items-start gap-3 md:gap-4 min-w-0 flex-1">
                                    <div className={cn(
                                        "h-10 w-10 rounded-full shrink-0 flex items-center justify-center",
                                        isApproved
                                            ? "bg-primary/10 text-primary"
                                            : isRejected
                                            ? "bg-destructive/10 text-destructive"
                                            : "bg-primary/10 text-primary"
                                    )}>
                                        {isApproved ? (
                                            <ShieldCheck className="size-4" />
                                        ) : isRejected ? (
                                            <AlertCircle className="size-4" />
                                        ) : (
                                            <Bell className="size-4" />
                                        )}
                                    </div>
                                    <div className="space-y-1.5 min-w-0 flex-1">
                                        <p className="text-sm font-semibold leading-relaxed text-foreground">
                                            {item.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {item.message}
                                        </p>
                                        <div className="flex items-center gap-2 pt-0.5">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "font-bold text-xs py-0.5 px-2",
                                                    isApproved
                                                        ? "text-emerald-500 border-emerald-500/50 bg-emerald-500/10"
                                                        : isRejected
                                                        ? "text-destructive border-destructive/50 bg-destructive/10"
                                                        : "text-amber-500 border-amber-500/50 bg-amber-500/10"
                                                )}
                                            >
                                                {isApproved
                                                    ? (isTh ? "อนุมัติแล้ว" : "Approved")
                                                    : isRejected
                                                    ? (isTh ? "ปฏิเสธคำขอ" : "Rejected")
                                                    : (isTh ? "รอดำเนินการ" : "Pending")}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground font-bold">•</span>
                                            <span className="text-xs text-muted-foreground font-medium">
                                                {formatDate(item.created_at, "MMM d, yyyy · HH:mm", locale)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                                    <Badge
                                        variant="outline"
                                        className="text-muted-foreground border-muted-foreground/50 bg-muted-foreground/10 font-semibold text-xs py-1 px-2.5 shadow-2xs"
                                    >
                                        {isTh ? "การแจ้งเตือนระบบ" : "System Notification"}
                                    </Badge>
                                    {targetUrl && (
                                        <ChevronRight className="size-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

                </div>
            </div>

            <AlertDialog open={!!teamReqToCancel} onOpenChange={(open) => !open && setTeamReqToCancel(null)}>
                <AlertDialogContent className="bg-card border rounded-sm shadow-2xl max-w-md p-0">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="p-2 md:p-4 border-b">
                            {isTh ? "ยืนยันการยกเลิกคำขอ" : "Confirm Cancellation"}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="p-2 md:p-4 text-sm font-medium text-muted-foreground/80">
                            {isTh
                                ? "คุณแน่ใจหรือไม่ว่าต้องการยกเลิกคำขอจัดการทีมนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้"
                                : "Are you sure you want to cancel this team management request? This action cannot be undone."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="p-2 md:p-4 border-t grid grid-cols-2 gap-1 md:gap-2">
                        <AlertDialogCancel className="mt-0" disabled={isPending}>
                            {tCommon("cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleConfirmCancelTeamRequest();
                            }}
                            disabled={isPending}
                            className="bg-destructive hover:bg-destructive/90 transition-all flex items-center justify-center gap-1.5"
                        >
                            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isTh ? "ยืนยันการยกเลิก" : "Confirm Cancel"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Payment Slip Preview Dialog */}
            <Dialog open={!!viewingSlipUrl} onOpenChange={(open) => !open && setViewingSlipUrl(null)}>
                <DialogContent className="max-w-md flex flex-col p-0 overflow-hidden bg-card border border-border rounded-sm">
                    <DialogHeader className="p-4 border-b border-border">
                        <DialogTitle className="text-lg md:text-xl font-black tracking-tighter text-foreground leading-none">
                            {isTh ? "หลักฐานการชำระเงิน" : "Payment Slip"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-4 bg-transparent">
                        {viewingSlipUrl && (
                            <div className="relative w-full aspect-[3/4] max-h-[70vh] bg-transparent rounded-sm overflow-hidden border border-border flex items-center justify-center">
                                <Image
                                    src={viewingSlipUrl}
                                    alt="Payment Slip"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

