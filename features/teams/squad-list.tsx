"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Player, Team } from "@/types/index";
import { cn, getPlayerInitials } from "@/lib/utils";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import { PlayerUploader } from "@/components/shared/player-uploader";
import { updatePlayer } from "@/actions/manager/team";
import { updateGlobalPlayerPhoto } from "@/actions/tournaments/master-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/dropdown";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
    ActionMenu as DropdownMenu, 
    ActionMenuContent as DropdownMenuContent, 
    ActionMenuItem as DropdownMenuItem, 
    ActionMenuTrigger as DropdownMenuTrigger 
} from "@/components/ui/action-menu";
import { 
    Loader2, 
    Users, 
    Save, 
    X, 
    MoreVertical, 
    Edit2, 
    Trash2,
        List,
    LayoutGrid
} from "lucide-react";
import { useLocale } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PlayerDetailsView } from "@/features/dialogs";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Tab } from "@/components/ui/tab";
import { getPositionOptions } from "@/lib/positions";
import { Header } from "@/components/ui/header";

function getRolePriority(position?: string | null): number {
    if (!position) return 4;
    const pos = position.toLowerCase().trim();
    if (pos.includes("ผู้จัดการ") || pos.includes("manager")) return 1;
    if (pos.includes("ผู้ฝึกสอน") || pos.includes("coach")) return 2;
    return 3; // player
}

export function sortSquadPlayers(playerList: Player[]): Player[] {
    return [...playerList].sort((a, b) => {
        const priorityA = getRolePriority(a.position);
        const priorityB = getRolePriority(b.position);
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        const numA = typeof a.number === 'number' ? a.number : parseInt(a.number as any) || 999;
        const numB = typeof b.number === 'number' ? b.number : parseInt(b.number as any) || 999;
        return numA - numB;
    });
}

export interface SquadListProps {
    players: Player[];
    team: Team;
    effectivelyLocked: boolean;
    refreshPlayers: () => Promise<void>;
    onDeletePlayer: (playerId: string) => void;
    t: (key: string, values?: Record<string, string | number | Date>) => string;
    tCommon: (key: string) => string;
    className?: string;
    updatePlayerFn?: (playerId: string, teamId: string, data: Partial<Player>) => Promise<any>;
    readOnlyEdit?: boolean;
}

export function SquadList({
    players,
    team,
    effectivelyLocked,
    refreshPlayers,
    onDeletePlayer,
    t,
    tCommon,
    className,
    updatePlayerFn,
    readOnlyEdit,
}: SquadListProps) {
    const locale = useLocale();
    const isThai = locale === "th";
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const positionOptions = getPositionOptions(team.sport || team.sport_name);
    
    const viewParam = searchParams.get("view");
    const [viewMode, setViewMode] = useState<"list" | "card">(() => {
        if (viewParam === "card" || viewParam === "list") return viewParam;
        if (viewParam === "grid") return "card";
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem("squad_view_mode");
                if (saved === "card" || saved === "list") return saved;
                if (saved === "grid") return "card";
            } catch {}
        }
        return "list";
    });

    useEffect(() => {
        if (viewParam === "card" || viewParam === "list") {
            setViewMode(viewParam);
            try {
                localStorage.setItem("squad_view_mode", viewParam);
            } catch {}
        } else if (viewParam === "grid") {
            setViewMode("card");
            try {
                localStorage.setItem("squad_view_mode", "card");
            } catch {}
            const params = new URLSearchParams(window.location.search);
            params.set("view", "card");
            const newUrl = `${pathname}?${params.toString()}`;
            window.history.replaceState(null, "", newUrl);
            router.replace(newUrl, { scroll: false });
        } else {
            try {
                const saved = localStorage.getItem("squad_view_mode");
                const targetMode = saved === "card" || saved === "grid" ? "card" : "list";
                setViewMode(targetMode);
                const params = new URLSearchParams(window.location.search);
                params.set("view", targetMode);
                const newUrl = `${pathname}?${params.toString()}`;
                window.history.replaceState(null, "", newUrl);
                router.replace(newUrl, { scroll: false });
            } catch {}
        }
    }, [viewParam, pathname, router, searchParams]);

    const handleViewModeChange = (mode: "list" | "card") => {
        setViewMode(mode);
        try {
            localStorage.setItem("squad_view_mode", mode);
        } catch {}
        const params = new URLSearchParams(searchParams.toString());
        params.set("view", mode);
        const queryString = params.toString();
        router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll: false });
    };

    const [openProfileId, setOpenProfileId] = useState<string | null>(null);
    const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editNumber, setEditNumber] = useState("");
    const [editPosition, setEditPosition] = useState("");
    const [editTel, setEditTel] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
    const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
    
    const handleUpdatePlayer = async (player: Player) => {
        setIsSaving(true);
        try {
            if (editPhotoFile && player.global_player_id) {
                const formData = new FormData();
                formData.append("photo", editPhotoFile);
                const photoResult = await updateGlobalPlayerPhoto(player.global_player_id, formData);
                if (!photoResult.success) {
                    toast({ title: tCommon("error"), description: photoResult.error || "Failed to update photo", variant: "destructive" });
                    setIsSaving(false);
                    return;
                }
            }

            const updateData = {
                name: editName,
                number: editNumber ? parseInt(editNumber) : null,
                position: editPosition,
                tel: editTel
            };

            const submitUpdate = updatePlayerFn || updatePlayer;
            const result = await submitUpdate(player.id, team.id, updateData);
            if (result.success) {
                toast({ title: tCommon("success"), description: t("updated_success") });
                setEditingPlayerId(null);
                setEditPhotoFile(null);
                setEditPhotoPreview(null);
                refreshPlayers();
            } else {
                toast({ title: tCommon("error"), description: result.error, variant: "destructive" });
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "An error occurred";
            toast({ title: tCommon("error"), description: errorMessage, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const isReadOnly = readOnlyEdit || Boolean((team as any).isParticipation);
    const activePlayers = players.filter((player) => !player.deleted_at);
    const sortedPlayers = sortSquadPlayers(activePlayers);

    return (
        <div className={cn("bg-card space-y-2 md:space-y-4 border rounded-sm p-2 md:p-4", className)}>
            {/* Squad Header Bar with View Mode Switcher */}
            <div className="flex items-center justify-end">
                <Tab<"list" | "card">
                    value={viewMode}
                    onChange={handleViewModeChange}
                    size="sm"
                    showLabels={false}
                    showIcons={true}
                    itemClassName="size-7"
                    options={[
                        { label: isThai ? "รายการ" : "List", value: "list", icon: List },
                        { label: isThai ? "การ์ด" : "Card", value: "card", icon: LayoutGrid },
                    ]}
                />
            </div>

            {activePlayers.length === 0 ? (
                <EmptyState
                    title={t("no_players_desc")}
                    description={t("get_started_by_adding_your_first_player_above") || "Get started by adding your first player above"}
                    icon={Users}
                    className="min-h-[300px] rounded-sm"
                />
            ) : viewMode === "list" ? (
                /* ================= LIST VIEW ================= */
                <div className="border bg-card rounded-sm divide-y divide-border overflow-hidden">
                    {sortedPlayers.map((player) => (
                        <Dialog key={player.id} open={openProfileId === player.id} onOpenChange={(isOpen) => setOpenProfileId(isOpen ? player.id : null)}>
                            <>
                                <div
                                    className={cn(
                                        "group relative transition-all",
                                        player.status !== 'pending' && "hover:bg-muted/30 cursor-pointer",
                                        player.status === 'pending' && "opacity-50 bg-muted/10",
                                        editingPlayerId === player.id && "bg-muted/20"
                                    )}
                                    onClick={() => {
                                        if (editingPlayerId !== player.id && player.status !== 'pending') {
                                            setOpenProfileId(player.id);
                                        }
                                    }}
                                >
                                    <div className={cn(
                                        "p-4 flex gap-3 md:gap-6",
                                        editingPlayerId === player.id ? "flex-col md:flex-row" : "flex-row items-center"
                                    )}>
                                        {/* Number & Basic Info */}
                                        <div className={cn(
                                            "flex flex-1 min-w-0 gap-3",
                                            editingPlayerId === player.id ? "flex-col md:flex-row md:items-end" : "flex-row items-center"
                                        )}>
                                            {editingPlayerId === player.id ? (
                                                <>
                                                    <div className="space-y-1 shrink-0 flex flex-col items-center">
                                                        <PlayerUploader
                                                            id={`edit-player-photo-${player.id}`}
                                                            size="sm"
                                                            initialUrl={editPhotoPreview || player.photo_url || player.profile_img || player.master_player?.profile_img || player.global_player?.photo_url || player.global_player?.profile_img || null}
                                                            onFileChange={(file) => {
                                                                setEditPhotoFile(file);
                                                                if (file) {
                                                                    setEditPhotoPreview(URL.createObjectURL(file));
                                                                } else {
                                                                    setEditPhotoPreview(null);
                                                                }
                                                            }}
                                                            onRemove={() => {
                                                                setEditPhotoFile(null);
                                                                setEditPhotoPreview(null);
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="space-y-1 w-full md:w-[60px] shrink-0">
                                                        <Label>{t("number")}</Label>
                                                        <Input
                                                            value={editNumber}
                                                            onChange={(e) => setEditNumber(e.target.value)}
                                                            placeholder={isThai ? "10" : "10"}
                                                            size="sm"
                                                            className="w-full focus-visible:ring-0"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
     
                                                    <div className="space-y-1 w-full md:flex-1 md:min-w-[150px]">
                                                        <Label>{t("player_name")}</Label>
                                                        <Input
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            placeholder={isThai ? "ชื่อนักกีฬา..." : "Player name..."}
                                                            size="sm"
                                                            className="focus-visible:ring-0"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
     
                                                    <div className="space-y-1 w-full md:w-[120px] shrink-0">
                                                        <Label>{t("position")}</Label>
                                                        <Select value={editPosition} onValueChange={setEditPosition}>
                                                            <SelectTrigger 
                                                                size="sm"
                                                                className="w-full"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <SelectValue placeholder={isThai ? "ตำแหน่ง" : "POS"} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {positionOptions.map((pos) => (
                                                                    <SelectItem key={pos.value} value={pos.value} className="text-[10px] font-black">
                                                                        {isThai ? pos.labelTh : pos.labelEn}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
     
                                                    <div className="space-y-1 w-full md:w-[130px] shrink-0">
                                                        <Label>{t("tel") || "Telephone"}</Label>
                                                        <Input
                                                            value={editTel}
                                                            onChange={(e) => setEditTel(e.target.value)}
                                                            type="tel"
                                                            size="sm"
                                                            placeholder={isThai ? "เบอร์โทร..." : "Phone number..."}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <PlayerAvatar player={player} size="md" showNumberBadge={true} />

                                                    <div className="min-w-0 flex-1 flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <Header level={6} className="text-muted-foreground">{player.position || "N/A"}</Header>
                                                            {player.status === 'pending' && (
                                                                <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20" variant="outline">
                                                                    รออนุมัติ
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <Header level={5}>{player.name}</Header>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        {!isReadOnly && (
                                            <div className="flex items-center justify-end gap-2 shrink-0">
                                                {editingPlayerId === player.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            className="text-primary hover:bg-primary/10 transition-all"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleUpdatePlayer(player);
                                                            }}
                                                            disabled={isSaving}
                                                        >
                                                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            className="text-red-500 hover:bg-red-500/10 transition-all"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingPlayerId(null);
                                                                setEditPhotoFile(null);
                                                                setEditPhotoPreview(null);
                                                            }}
                                                            disabled={isSaving}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        {(!effectivelyLocked || player.status === 'pending') && (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon-sm"
                                                                        className="text-muted-foreground hover:text-primary hover:bg-muted/10 transition-all"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <MoreVertical className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-36 rounded-sm">
                                                                    {player.status !== 'pending' && (
                                                                        <DropdownMenuItem
                                                                            className="flex items-center rounded"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setEditingPlayerId(player.id);
                                                                                setEditNumber(player.number?.toString() || "");
                                                                                setEditPosition(player.position || "");
                                                                                setEditTel(player.tel || "");
                                                                                setEditName(player.name || "");
                                                                                setEditPhotoFile(null);
                                                                                setEditPhotoPreview(null);
                                                                            }}
                                                                        >
                                                                            <Edit2 className="h-4 w-4" />
                                                                            {tCommon("edit")}
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuItem
                                                                        className="flex items-center rounded"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onDeletePlayer(player.id);
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                        {tCommon("delete")}
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <DialogContent>
                                    <PlayerDetailsView
                                        player={player}
                                        team={team}
                                    />
                                </DialogContent>
                            </>
                        </Dialog>
                    ))}
                </div>
            ) : (
                /* ================= GRID VIEW ================= */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
                    {sortedPlayers.map((player) => (
                        <Dialog key={player.id} open={openProfileId === player.id} onOpenChange={(isOpen) => setOpenProfileId(isOpen ? player.id : null)}>
                            <>
                                <div
                                    className={cn(
                                        "group relative border border-border rounded-sm p-0 flex flex-col items-center text-center transition-all overflow-hidden",
                                        player.status !== 'pending' && "hover:bg-muted/30 hover:border-primary/50 cursor-pointer",
                                        player.status === 'pending' && "opacity-60 bg-muted/10"
                                    )}
                                    onClick={() => {
                                        if (player.status !== 'pending') {
                                            setOpenProfileId(player.id);
                                        }
                                    }}
                                >
                                    {/* Action Dropdown Menu (Top Right) */}
                                    {!isReadOnly && (!effectivelyLocked || player.status === 'pending') && (
                                        <div className="absolute top-4 right-4 z-10">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <MoreVertical className="size-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-36 rounded-sm">
                                                    {player.status !== 'pending' && (
                                                        <DropdownMenuItem
                                                            className="flex items-center rounded"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleViewModeChange("list");
                                                                setEditingPlayerId(player.id);
                                                                setEditNumber(player.number?.toString() || "");
                                                                setEditPosition(player.position || "");
                                                                setEditTel(player.tel || "");
                                                                setEditName(player.name || "");
                                                                setEditPhotoFile(null);
                                                                setEditPhotoPreview(null);
                                                            }}
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                            {tCommon("edit")}
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem
                                                        className="flex items-center rounded"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeletePlayer(player.id);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        {tCommon("delete")}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    )}

                                    {/* Full-Bleed 1:1 Image / Placeholder (w-full aspect-square) */}
                                    <div className="relative w-full aspect-square overflow-hidden border-b border-border group-hover:border-primary/50 transition-colors">
                                        {(() => {
                                            const photoUrl = player.photo_url || player.profile_img || player.master_player?.profile_img || player.global_player?.photo_url || player.global_player?.profile_img;
                                            const initials = getPlayerInitials(player.name);
                                            const hasNumber = player.number != null && String(player.number).trim() !== "" && String(player.number).trim() !== "-";

                                            if (photoUrl) {
                                                return (
                                                    <>
                                                        <Image
                                                            src={photoUrl}
                                                            alt={player.name}
                                                            fill
                                                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                                            className="object-cover"
                                                        />
                                                        {hasNumber &&
                                                            <div className="absolute -bottom-2 right-1 text-primary/50 font-black text-7xl">
                                                                {hasNumber ? player.number : ""}
                                                            </div>
                                                        }

                                                    </>
                                                );
                                            }

                                            return (
                                                <div className="h-full w-full flex items-center justify-center">
                                                    {hasNumber ? (
                                                        <span className="text-6xl sm:text-7xl font-black text-primary">
                                                            {player.number}
                                                        </span>
                                                    ) : (
                                                        <span className="text-6xl sm:text-7xl font-black text-primary uppercase">
                                                            {initials}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Player Info Section */}
                                    <div className="p-4 w-full flex flex-col items-center text-center gap-2">
                                        {/* Player Name */}
                                        <div className="w-full">
                                            <Header level={3}>
                                                {player.name}
                                            </Header>
                                        </div>

                                        {/* Position Badge & Status */}
                                        <div className="flex flex-wrap items-center justify-center">
                                            <Header className="text-muted-foreground" level={6}>
                                                {player.position || "N/A"}
                                            </Header>
                                            {player.status === 'pending' && (
                                                <Badge variant="outline">
                                                    รออนุมัติ
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <DialogContent>
                                    <PlayerDetailsView
                                        player={player}
                                        team={team}
                                    />
                                </DialogContent>
                            </>
                        </Dialog>
                    ))}
                </div>
            )}
        </div>
    );
}

