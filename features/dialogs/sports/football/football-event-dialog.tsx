import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/dropdown";
import { EVENT_TYPES } from "@/features/sports/football/console/constants";
import { EventType, Player, MatchEvent } from "@/types";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
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

interface MatchEventDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teamId: string;
    eventType: EventType | null;
    initialMinute: number;
    players: Player[]; // Players of the selected team
    opponentPlayers?: Player[]; // Players of the opponent team for own goal
    existingEvents: MatchEvent[]; // To check for previous cards
    activeLineupIds?: string[]; // To highlight starting vs bench players
    onSave: (data: { minute: number; playerId: string; extraInfo: Record<string, unknown>; autoRed?: boolean; overrideEventType?: EventType }) => void;
}

export function MatchEventDialog({
    open,
    onOpenChange,
    teamId: _teamId,
    eventType,
    initialMinute,
    players,
    opponentPlayers = [],
    existingEvents,
    activeLineupIds,
    onSave
}: MatchEventDialogProps) {
    const t = useTranslations("Console");
    const tCommon = useTranslations("Common");

    const [minute, setMinute] = useState<string>("");
    const [playerId, setPlayerId] = useState<string>("unknown");
    const [assistPlayerId, setAssistPlayerId] = useState<string>("");
    const [subInPlayerId, setSubInPlayerId] = useState<string>("");
    const [isOwnGoal, setIsOwnGoal] = useState<boolean>(false);
    const [ownGoalPlayerId, setOwnGoalPlayerId] = useState<string>("");
    const [fouledPlayerId, setFouledPlayerId] = useState<string>("none");
    const [isPenalty, setIsPenalty] = useState<boolean>(false);
    const [foulCardType, setFoulCardType] = useState<"none" | "yellow" | "red">("none");
    const [selectedCardType, setSelectedCardType] = useState<"yellow" | "red">("yellow");
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        if (open) {
            const timer = setTimeout(() => {
                setMinute(initialMinute.toString());
                setPlayerId("unknown");
                setAssistPlayerId("");
                setSubInPlayerId("");
                setIsOwnGoal(false);
                setOwnGoalPlayerId("");
                setFouledPlayerId("none");
                setIsPenalty(false);
                setFoulCardType("none");
                setSelectedCardType(eventType === 'red_card' ? 'red' : 'yellow');
                setShowConfirm(false);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [open, initialMinute, eventType]);

    const startingPlayers = activeLineupIds && activeLineupIds.length > 0
        ? players.filter(p => activeLineupIds.includes(p.id))
        : players;

    const substitutePlayers = activeLineupIds && activeLineupIds.length > 0
        ? players.filter(p => !activeLineupIds.includes(p.id))
        : players;

    const getPlayerLabel = (player: Player) => {
        const numPart = player.number ? `#${player.number} ` : "";
        return `${numPart}${player.name}`;
    };

    const checkPlayerHasYellow = (targetPlayerId: string, targetPlayerName?: string, eventsList: MatchEvent[] = []) => {
        if (!targetPlayerId || targetPlayerId === 'unknown') return false;
        return eventsList.some(e => {
            const pid = e.player_id || (e.extra_info as Record<string, unknown> | null)?.player_id || (e.detail as Record<string, unknown> | null)?.player_id;
            const isSameId = pid && String(pid) === String(targetPlayerId);
            const isSameName = targetPlayerName && e.player_name && e.player_name.trim().toLowerCase() === targetPlayerName.trim().toLowerCase();
            if (!isSameId && !isSameName) return false;

            const type = e.event_type || e.type;
            if (type === 'yellow_card') return true;
            const cardType = (e.extra_info as Record<string, unknown> | null)?.card_type || (e.detail as Record<string, unknown> | null)?.card_type;
            return cardType === 'yellow';
        });
    };

    const handleSave = (bypassConfirm = false) => {
        const min = parseInt(minute) || 0;
        const extraInfo: Record<string, unknown> = {};
        let autoRed = false;
        let finalPlayerId = playerId;
        let finalEventType = eventType;

        if (eventType === 'yellow_card' || eventType === 'red_card') {
            finalEventType = selectedCardType === 'red' ? 'red_card' : 'yellow_card';
        }

        const selectedPlayer = players.find(p => p.id === finalPlayerId);
        const selectedPlayerName = selectedPlayer?.name;
        const hasPreviousYellow = checkPlayerHasYellow(finalPlayerId, selectedPlayerName, existingEvents);

        // Own Goal Handling
        if (eventType === 'goal' && isOwnGoal) {
            extraInfo.is_own_goal = true;
            finalPlayerId = ownGoalPlayerId || "unknown";
            const ogPlayer = opponentPlayers.find(p => p.id === ownGoalPlayerId);
            if (ogPlayer) {
                extraInfo.own_goal_player_name = ogPlayer.name;
            }
        }

        // Foul Handling
        if (eventType === 'foul') {
            if (fouledPlayerId && fouledPlayerId !== 'none') {
                extraInfo.fouled_player_id = fouledPlayerId;
                const fouledPlayer = opponentPlayers.find(p => p.id === fouledPlayerId);
                if (fouledPlayer) {
                    extraInfo.fouled_player_name = fouledPlayer.name;
                }
            }
            if (isPenalty) {
                extraInfo.is_penalty = true;
            }
            if (foulCardType !== 'none') {
                extraInfo.card_type = foulCardType;
                if (foulCardType === 'yellow' && finalPlayerId && finalPlayerId !== 'unknown') {
                    if (!bypassConfirm && hasPreviousYellow) {
                        setShowConfirm(true);
                        return;
                    }
                    if (bypassConfirm && hasPreviousYellow) {
                        autoRed = true;
                        extraInfo.is_second_yellow = true;
                    }
                }
            }
        }

        // Card Ban Logic: Check if player already has a yellow card
        if (finalEventType === 'yellow_card' && finalPlayerId && finalPlayerId !== 'unknown') {
            if (!bypassConfirm && hasPreviousYellow) {
                setShowConfirm(true);
                return;
            }
            if (bypassConfirm && hasPreviousYellow) {
                autoRed = true;
                extraInfo.is_second_yellow = true;
            }
        }

        if (eventType === 'goal' && !isOwnGoal && assistPlayerId && assistPlayerId !== 'none') {
            extraInfo.assist_player_id = assistPlayerId;
            const assistPlayer = players.find(p => p.id === assistPlayerId);
            if (assistPlayer) {
                extraInfo.assist_player_name = assistPlayer.name;
            }
        }
        if (eventType === 'substitution') {
            extraInfo.out_player_id = finalPlayerId;
            extraInfo.in_player_id = subInPlayerId;
            const outPlayer = players.find(p => p.id === finalPlayerId);
            const inPlayer = players.find(p => p.id === subInPlayerId);
            extraInfo.out_player_name = outPlayer?.name || "Unknown";
            extraInfo.in_player_name = inPlayer?.name || "Unknown";
        }
        onSave({
            minute: min,
            playerId: finalPlayerId,
            extraInfo,
            autoRed,
            overrideEventType: (eventType === 'yellow_card' || eventType === 'red_card') ? (finalEventType || undefined) : undefined
        });
        onOpenChange(false);
    };

    if (!eventType) return null;

    const isNoPlayerRequired = eventType === 'missed_shot' || eventType === 'offside' || eventType === 'save';
    const eventConfig = EVENT_TYPES.find(t => t.type === eventType);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="w-full h-full sm:h-auto sm:max-w-[640px] max-h-screen sm:max-h-[90vh] overflow-hidden flex flex-col bg-card p-0 shadow-2xl rounded-none sm:rounded-sm">
                <DialogHeader className="p-2 md:p-4 border-b relative pr-10 shrink-0">
                    <DialogTitle className="flex items-center text-xl font-black tracking-tighter">
                        {eventConfig?.label && t(eventConfig.label)}
                    </DialogTitle>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute right-2 top-2"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3 md:space-y-4">
                    {/* Time Input */}
                    <div className="space-y-1">
                        <Label>{t("time")}</Label>
                        <Input
                            value={minute}
                            onChange={e => setMinute(e.target.value)}
                            type="number"
                        />
                    </div>

                    {/* Goal Specific Inputs: Normal Goal vs Own Goal */}
                    {eventType === 'goal' ? (
                        <div className="space-y-1 lg:space-y-2 p-2 border rounded-sm">
                            <div className="flex items-center justify-between">
                                <Label>{t("goal_type")}</Label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsOwnGoal(false)}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${!isOwnGoal ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        {t("normal_goal") || "ทำประตูปกติ"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsOwnGoal(true)}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${isOwnGoal ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        {t("own_goal")}
                                    </button>
                                </div>
                            </div>

                            {!isOwnGoal ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {/* Scorer */}
                                    <div className="space-y-1">
                                        <Label>{t("scorer") || "ผู้ทำประตู (Scorer)"}</Label>
                                        <Select value={playerId} onValueChange={setPlayerId}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder={t("player_name")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {startingPlayers.map((player) => (
                                                    <SelectItem key={player.id} value={player.id}>
                                                        {getPlayerLabel(player)}
                                                    </SelectItem>
                                                ))}
                                                <SelectItem value="unknown">
                                                    {t("unknown_player")}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Assist */}
                                    <div className="space-y-1">
                                        <Label>{t("assist") || "ผู้ส่งบอล (Assist)"}</Label>
                                        <Select value={assistPlayerId} onValueChange={setAssistPlayerId}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder={t("no_assist")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">{t("no_assist")}</SelectItem>
                                                {startingPlayers.map((player) => (
                                                    <SelectItem key={player.id} value={player.id}>
                                                        {getPlayerLabel(player)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            ) : (
                                /* Own Goal: Select player from opponent team */
                                <div className="space-y-1">
                                    <Label>
                                        {t("own_goal_player")}
                                    </Label>
                                    <Select value={ownGoalPlayerId} onValueChange={setOwnGoalPlayerId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={t("select_opponent_player")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {opponentPlayers.map((player) => (
                                                <SelectItem key={player.id} value={player.id}>
                                                    {getPlayerLabel(player)}
                                                </SelectItem>
                                            ))}
                                            <SelectItem value="unknown">
                                                {t("unknown_player")}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    ) : eventType === 'foul' ? (
                        /* Foul Event Layout (styled like Goal layout) */
                        <div className="space-y-1 lg:space-y-2 p-2 border rounded-sm">
                            <div className="flex items-center justify-between">
                                <Label>{t("is_penalty")}</Label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsPenalty(false)}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${!isPenalty ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        {t("is_penalty_no")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsPenalty(true)}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${isPenalty ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        {t("is_penalty_yes")}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {/* Fouling Player */}
                                <div className="space-y-1">
                                    <Label>{t("player")}</Label>
                                    <Select value={playerId} onValueChange={setPlayerId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={t("player_name")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {startingPlayers.map((player) => (
                                                <SelectItem key={player.id} value={player.id}>
                                                    {getPlayerLabel(player)}
                                                </SelectItem>
                                            ))}
                                            <SelectItem value="unknown">
                                                {t("unknown_player")}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Fouled Player (Opponent) */}
                                <div className="space-y-1">
                                    <Label>{t("fouled_player")}</Label>
                                    <Select value={fouledPlayerId} onValueChange={setFouledPlayerId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={t("select_opponent_player")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">{t("unknown_player")}</SelectItem>
                                            {opponentPlayers.map((player) => (
                                                <SelectItem key={player.id} value={player.id}>
                                                    {getPlayerLabel(player)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Card Selection for Foul */}
                            <div className="flex items-center justify-between">
                                <Label>{t("card_given") || "คาดโทษใบเตือน"}</Label>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setFoulCardType("none")}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${foulCardType === "none" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        {t("no_card") || "ไม่มีใบ"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFoulCardType("yellow")}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${foulCardType === "yellow" ? "bg-amber-500 text-white font-black" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        <span className="w-2.5 h-3.5 bg-amber-400 rounded-xs border border-amber-600 inline-block shadow-sm" />
                                        {t("yellow_card")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFoulCardType("red")}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${foulCardType === "red" ? "bg-red-600 text-white font-black" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        <span className="w-2.5 h-3.5 bg-red-600 rounded-xs border border-red-800 inline-block shadow-sm" />
                                        {t("red_card")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : eventType === 'substitution' ? (
                        /* Substitution Layout (styled like Goal layout) */
                        <div className="space-y-1 lg:space-y-2 p-2 border rounded-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {/* Player Out */}
                                <div className="space-y-1">
                                    <Label>{t("player_out")}</Label>
                                    <Select value={playerId} onValueChange={setPlayerId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={t("player_name")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {startingPlayers.map((player) => (
                                                <SelectItem key={player.id} value={player.id}>
                                                    {getPlayerLabel(player)}
                                                </SelectItem>
                                            ))}
                                            <SelectItem value="unknown">
                                                {t("unknown_player")}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Player In */}
                                <div className="space-y-1">
                                    <Label>{t("player_in")}</Label>
                                    <Select value={subInPlayerId} onValueChange={setSubInPlayerId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={t("select_player_in")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {substitutePlayers.map((player) => (
                                                <SelectItem key={player.id} value={player.id}>
                                                    {getPlayerLabel(player)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    ) : (eventType === 'yellow_card' || eventType === 'red_card') ? (
                        /* Card Event Layout (Yellow / Red Card Selection) */
                        <div className="space-y-3 p-2 border rounded-sm">
                            <div className="flex items-center justify-between">
                                <Label>{t("card_given")}</Label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCardType("yellow")}
                                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${selectedCardType === "yellow" ? "bg-amber-500 text-white font-black shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        <span className="w-3 h-4 bg-amber-400 rounded-xs border border-amber-600 inline-block shadow-xs" />
                                        {t("yellow_card")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCardType("red")}
                                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${selectedCardType === "red" ? "bg-red-600 text-white font-black shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        <span className="w-3 h-4 bg-red-600 rounded-xs border border-red-800 inline-block shadow-xs" />
                                        {t("red_card")}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label>{t("player")}</Label>
                                <Select value={playerId} onValueChange={setPlayerId}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder={t("player_name")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {players.map((player) => (
                                            <SelectItem key={player.id} value={player.id}>
                                                {getPlayerLabel(player)}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="unknown">
                                            {t("unknown_player")}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {playerId !== 'unknown' && selectedCardType === 'yellow' && checkPlayerHasYellow(playerId, players.find(p => p.id === playerId)?.name, existingEvents) && (
                                <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-amber-600 dark:text-amber-400 text-xs font-semibold">
                                    <span className="w-2.5 h-3.5 bg-amber-400 rounded-xs inline-block shrink-0 shadow-xs" />
                                    <span>{t("second_yellow_hint")}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Standard Player Selection for other events */
                        !isNoPlayerRequired && (
                            <div className="space-y-1">
                                <Label>{t("player")}</Label>
                                <Select value={playerId} onValueChange={setPlayerId}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder={t("player_name")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {startingPlayers.map((player) => (
                                            <SelectItem key={player.id} value={player.id}>
                                                {getPlayerLabel(player)}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="unknown">
                                            {t("unknown_player")}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )
                    )}
                </div>

                <DialogFooter className="p-2 md:p-4 border-t shrink-0">
                    <Button
                        type="button"
                        onClick={() => handleSave(false)}
                        disabled={!isNoPlayerRequired && (isOwnGoal ? !ownGoalPlayerId : !playerId)}
                        className="w-full"
                    >
                        {tCommon("save")}
                    </Button>
                </DialogFooter>
            </DialogContent>

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent className="bg-card border rounded-sm shadow-2xl max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black tracking-tighter text-foreground border-b p-2 md:p-4">
                            {t("second_yellow_warning_title") || "Second Yellow Card"}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium text-muted-foreground/80 p-2 md:p-4">
                            {t("second_yellow_warning") || "Player already has a yellow card. This will be recorded as a Second Yellow (Red Card). Proceed?"}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-1 md:gap-2 border-t p-2 md:p-4">
                        <AlertDialogCancel>
                            {tCommon("cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                handleSave(true);
                                setShowConfirm(false);
                            }}
                        >
                            {tCommon("confirm") || "Confirm"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
}


