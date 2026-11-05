"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { PenaltyShot, Player } from "@/types/index";
import { getPenaltyShootout, addPenaltyShot, clearPenaltyShootout } from "@/actions/tournaments/penalty";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
    Dropdown,
    DropdownTrigger,
    DropdownValue,
    DropdownContent,
    DropdownItem,
} from "@/components/ui/dropdown";
import { Loader2, Check, X, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

interface PenaltyShootoutDialogProps {
    matchId: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeTeamName: string;
    awayTeamName: string;
    homePlayers?: Player[];
    awayPlayers?: Player[];
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
    onComplete?: (homeScore: number, awayScore: number, winnerId: string) => void;
    onUpdate?: () => void;
    readOnly?: boolean;
}

export function PenaltyShootoutDialog({
    matchId,
    homeTeamId,
    awayTeamId,
    homeTeamName,
    awayTeamName,
    homePlayers = [],
    awayPlayers = [],
    open: openProp,
    onOpenChange: onOpenChangeProp,
    trigger,
    onComplete,
    onUpdate,
    readOnly = false,
}: PenaltyShootoutDialogProps) {
    const { toast } = useToast();
    const t = useTranslations("Penalty");
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = openProp !== undefined;
    const open = isControlled ? openProp : internalOpen;
    const setOpen = (newOpen: boolean) => {
        if (onOpenChangeProp) {
            onOpenChangeProp(newOpen);
        }
        if (!isControlled) {
            setInternalOpen(newOpen);
        }
    };
    const [shots, setShots] = useState<PenaltyShot[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [homeSelectedPlayers, setHomeSelectedPlayers] = useState<Record<number, string>>({});
    const [awaySelectedPlayers, setAwaySelectedPlayers] = useState<Record<number, string>>({});

    const fetchShots = useCallback(async () => {
        setIsLoading(true);
        const result = await getPenaltyShootout(matchId);
        if (result.success && result.data) {
            setShots(result.data);
        }
        setIsLoading(false);
    }, [matchId]);

    useEffect(() => {
        if (open) {
            const timer = setTimeout(() => fetchShots(), 0);
            return () => clearTimeout(timer);
        }
    }, [open, fetchShots]);

    const homeShots = shots.filter(s => s.team_id === homeTeamId);
    const awayShots = shots.filter(s => s.team_id === awayTeamId);
    const homeScore = homeShots.filter(s => s.scored).length;
    const awayScore = awayShots.filter(s => s.scored).length;

    // Calculate total display rounds:
    // - Always show at least 5 regulation rounds
    // - If all 5 are completed AND scores are tied, show sudden death rounds (current + 1 empty)
    const totalRounds = useMemo(() => {
        const completedHomRounds = homeShots.length;
        const completedAwayRounds = awayShots.length;
        const maxCompleted = Math.max(completedHomRounds, completedAwayRounds);

        if (maxCompleted < 5) {
            return 5; // Still in regulation
        }

        // All 5 regulation rounds done
        // If there's a winner after regulation OR during sudden death with equal shots, show + 1 for next round
        const isTied = homeScore === awayScore;
        const bothComplete = completedHomRounds === completedAwayRounds;

        if (isTied && bothComplete) {
            // Tied and both teams shot same number | show one more empty row for sudden death
            return maxCompleted + 1;
        }

        if (!bothComplete) {
            // One team hasn't shot yet this round | show current max
            return maxCompleted;
        }

        // Winner decided
        return maxCompleted;
    }, [homeShots.length, awayShots.length, homeScore, awayScore]);

    const isSuddenDeath = homeShots.length >= 5 || awayShots.length >= 5;

    const handleAddShot = async (teamId: string, scored: boolean, roundIdx: number) => {
        setIsSaving(true);
        const teamShots = shots.filter(s => s.team_id === teamId);
        const round = teamShots.length + 1;
        const playerId = teamId === homeTeamId
            ? (homeSelectedPlayers[roundIdx] || null)
            : (awaySelectedPlayers[roundIdx] || null);

        const result = await addPenaltyShot(matchId, teamId, round, scored, playerId);
        if (result.success) {
            await fetchShots();
            onUpdate?.();
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
        setIsSaving(false);
    };

    const handleClear = async () => {
        if (!confirm(t("clear_confirm"))) return;
        const result = await clearPenaltyShootout(matchId);
        if (result.success) {
            setShots([]);
            setHomeSelectedPlayers({});
            setAwaySelectedPlayers({});
            onUpdate?.();
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
    };

    // Determine winner based on mathematical possibility
    const hasWinner = useMemo(() => {
        const hLen = homeShots.length;
        const aLen = awayShots.length;
        const maxShots = Math.max(hLen, aLen);

        // 1. Regulation Phase (up to 5 shots each)
        if (maxShots <= 5) {
            const hRemaining = 5 - hLen;
            const aRemaining = 5 - aLen;

            // Check if home team has already won
            if (homeScore > awayScore + aRemaining) return 'home';
            // Check if away team has already won
            if (awayScore > homeScore + hRemaining) return 'away';

            return null;
        }

        // 2. Sudden Death Phase (more than 5 shots)
        // Winner is decided ONLY when both teams have taken the same number of shots in a round (hLen === aLen) and scores are not equal.
        if (hLen === aLen) {
            if (homeScore > awayScore) return 'home';
            if (awayScore > homeScore) return 'away';
        }

        return null;
    }, [homeShots.length, awayShots.length, homeScore, awayScore]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger && (
                <DialogTrigger asChild>
                    {trigger}
                </DialogTrigger>
            )}
            <DialogContent className="bg-card rounded-sm overflow-hidden max-w-xl lg:max-w-2xl max-h-[90vh] flex flex-col p-0 border border-border">
                <DialogHeader className="p-4 border-b border-border shrink-0">
                    <DialogTitle>{t("title")}</DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="p-4 space-y-4 relative overflow-y-auto">
                        {/* Score Summary Scoreboard Style */}
                        <div className="flex items-center justify-center gap-8 md:gap-12 py-3 border border-border rounded-sm bg-transparent">
                            <div className="text-center">
                                <p className="text-[10px] font-black tracking-widest text-foreground/50 mb-1 truncate max-w-[140px]">{homeTeamName}</p>
                                <span className={cn(
                                    "text-4xl md:text-5xl font-black tracking-tighter transition-all",
                                    hasWinner === 'home' ? "text-primary" : "text-foreground"
                                )}>
                                    {homeScore}
                                </span>
                            </div>
                            <span className="text-2xl md:text-3xl font-black tracking-tighter text-foreground/30">-</span>
                            <div className="text-center">
                                <p className="text-[10px] font-black tracking-widest text-foreground/50 mb-1 truncate max-w-[140px]">{awayTeamName}</p>
                                <span className={cn(
                                    "text-4xl md:text-5xl font-black tracking-tighter transition-all",
                                    hasWinner === 'away' ? "text-primary" : "text-foreground"
                                )}>
                                    {awayScore}
                                </span>
                            </div>
                        </div>

                        {/* Winner/Status Banner */}
                        {hasWinner ? (
                            <div className="flex flex-col items-center justify-center gap-2">
                                <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1.5 text-xs font-black tracking-widest rounded-sm">
                                    {t("wins_on_penalties", { team: hasWinner === 'home' ? homeTeamName : awayTeamName })}
                                </Badge>
                                {!readOnly && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="bg-primary text-black hover:bg-primary/90 font-bold text-xs h-8 gap-1.5 px-4 cursor-pointer mt-1"
                                        onClick={() => {
                                            const winnerId = hasWinner === 'home' ? homeTeamId : awayTeamId;
                                            if (winnerId) {
                                                onComplete?.(homeScore, awayScore, winnerId);
                                                setOpen(false);
                                            }
                                        }}
                                    >
                                        <Check className="h-4 w-4" />
                                        <span>{t("confirm_penalty_winner") || "ยืนยันผลการดวลจุดโทษ"}</span>
                                    </Button>
                                )}
                            </div>
                        ) : isSuddenDeath ? (
                            <div className="flex items-center justify-center">
                                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-4 py-1.5 animate-pulse flex items-center gap-1.5 rounded-sm">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span className="text-[10px] font-black tracking-[0.2em]">{t("sudden_death")}</span>
                                </Badge>
                            </div>
                        ) : null}

                        {/* Shot Grid */}
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-3 relative z-10 items-center">
                            <div className="text-[11px] font-black tracking-widest text-right pr-2 text-foreground/70 truncate">{homeTeamName}</div>
                            <div className="w-8 text-center text-[10px] font-black text-foreground/40">#</div>
                            <div className="text-[11px] font-black tracking-widest text-left pl-2 text-foreground/70 truncate">{awayTeamName}</div>

                            {Array.from({ length: totalRounds }, (_, i) => {
                                const homeShot = homeShots[i];
                                const awayShot = awayShots[i];
                                const homePlayerMatch = homeShot?.player_id ? homePlayers.find(p => p.id === homeShot.player_id) : null;
                                const homeShooterName = homeShot ? (homePlayerMatch ? `${homePlayerMatch.number ? '#' + homePlayerMatch.number + ' ' : ''}${homePlayerMatch.name}` : (homeShot.player?.name || null)) : null;

                                const awayPlayerMatch = awayShot?.player_id ? awayPlayers.find(p => p.id === awayShot.player_id) : null;
                                const awayShooterName = awayShot ? (awayPlayerMatch ? `${awayPlayerMatch.number ? '#' + awayPlayerMatch.number + ' ' : ''}${awayPlayerMatch.name}` : (awayShot.player?.name || null)) : null;

                                return (
                                    <div key={i} className="contents">
                                        {/* Home Shot (Left: Dropdown in front, then Buttons/Result) */}
                                        <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                                            {homeShot ? (
                                                <>
                                                    {homeShooterName && (
                                                        <span className="text-[11px] font-semibold text-foreground/80 truncate max-w-[100px] sm:max-w-[140px] text-right" title={homeShooterName}>
                                                            {homeShooterName}
                                                        </span>
                                                    )}
                                                    <div className={cn(
                                                        "w-8 h-8 flex items-center justify-center border transition-all rounded-sm shrink-0 bg-transparent",
                                                        homeShot.scored ? "border-primary/40 text-primary" : "border-destructive/40 text-destructive"
                                                    )}>
                                                        {homeShot.scored ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                                    </div>
                                                </>
                                            ) : (!hasWinner && !readOnly) ? (
                                                <>
                                                    {/* Dropdown หน้าปุ่ม */}
                                                    {homePlayers.length > 0 && (
                                                        <Dropdown
                                                            value={homeSelectedPlayers[i] || "none"}
                                                            onValueChange={(val) => setHomeSelectedPlayers(prev => ({ ...prev, [i]: val === "none" ? "" : val }))}
                                                        >
                                                            <DropdownTrigger size="sm" className="h-8 w-24 sm:w-32 text-xs bg-transparent border border-border rounded-sm px-2 text-foreground truncate shrink-0">
                                                                <DropdownValue placeholder={t("select_player") || "เลือกคนยิง"} />
                                                            </DropdownTrigger>
                                                            <DropdownContent className="z-[70] max-h-56">
                                                                <DropdownItem value="none">{t("select_player") || "เลือกคนยิง"}</DropdownItem>
                                                                {homePlayers.map(p => (
                                                                    <DropdownItem key={p.id} value={p.id}>
                                                                        {p.number ? `#${p.number} ` : ''}{p.name}
                                                                    </DropdownItem>
                                                                ))}
                                                            </DropdownContent>
                                                        </Dropdown>
                                                    )}
                                                    <div className="flex gap-1 shrink-0">
                                                        <button
                                                            className="w-8 h-8 rounded-sm border border-border bg-transparent hover:bg-primary/10 hover:border-primary/40 hover:text-primary flex items-center justify-center group/btn transition-all disabled:opacity-20 active:scale-95 text-foreground"
                                                            onClick={() => homeTeamId && handleAddShot(homeTeamId, true, i)}
                                                            disabled={isSaving || !homeTeamId}
                                                            title="ยิงเข้า"
                                                        >
                                                            <Check className="h-3.5 w-3.5 group-hover/btn:scale-110 transition-transform" />
                                                        </button>
                                                        <button
                                                            className="w-8 h-8 rounded-sm border border-border bg-transparent hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive flex items-center justify-center group/btn transition-all disabled:opacity-20 active:scale-95 text-foreground"
                                                            onClick={() => homeTeamId && handleAddShot(homeTeamId, false, i)}
                                                            disabled={isSaving || !homeTeamId}
                                                            title="ยิงไม่เข้า"
                                                        >
                                                            <X className="h-3.5 w-3.5 group-hover/btn:scale-110 transition-transform" />
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="w-8 h-8 rounded-sm border border-border/40 bg-transparent opacity-30" />
                                            )}
                                        </div>

                                        {/* Round Number */}
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <span className="w-5 h-5 flex items-center justify-center rounded-full border border-border bg-transparent text-[10px] font-black tracking-tighter text-foreground/70">
                                                {i + 1}
                                            </span>
                                        </div>

                                        {/* Away Shot (Right: Buttons/Result first, then Dropdown behind) */}
                                        <div className="flex items-center justify-start gap-1.5 sm:gap-2">
                                            {awayShot ? (
                                                <>
                                                    <div className={cn(
                                                        "w-8 h-8 flex items-center justify-center border transition-all rounded-sm shrink-0 bg-transparent",
                                                        awayShot.scored ? "border-primary/40 text-primary" : "border-destructive/40 text-destructive"
                                                    )}>
                                                        {awayShot.scored ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                                    </div>
                                                    {awayShooterName && (
                                                        <span className="text-[11px] font-semibold text-foreground/80 truncate max-w-[100px] sm:max-w-[140px] text-left" title={awayShooterName}>
                                                            {awayShooterName}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (!hasWinner && !readOnly) ? (
                                                <>
                                                    <div className="flex gap-1 shrink-0">
                                                        <button
                                                            className="w-8 h-8 rounded-sm border border-border bg-transparent hover:bg-primary/10 hover:border-primary/40 hover:text-primary flex items-center justify-center group/btn transition-all disabled:opacity-20 active:scale-95 text-foreground"
                                                            onClick={() => awayTeamId && handleAddShot(awayTeamId, true, i)}
                                                            disabled={isSaving || !awayTeamId}
                                                            title="ยิงเข้า"
                                                        >
                                                            <Check className="h-3.5 w-3.5 group-hover/btn:scale-110 transition-transform" />
                                                        </button>
                                                        <button
                                                            className="w-8 h-8 rounded-sm border border-border bg-transparent hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive flex items-center justify-center group/btn transition-all disabled:opacity-20 active:scale-95 text-foreground"
                                                            onClick={() => awayTeamId && handleAddShot(awayTeamId, false, i)}
                                                            disabled={isSaving || !awayTeamId}
                                                            title="ยิงไม่เข้า"
                                                        >
                                                            <X className="h-3.5 w-3.5 group-hover/btn:scale-110 transition-transform" />
                                                        </button>
                                                    </div>
                                                    {/* Dropdown หลังปุ่ม */}
                                                    {awayPlayers.length > 0 && (
                                                        <Dropdown
                                                            value={awaySelectedPlayers[i] || "none"}
                                                            onValueChange={(val) => setAwaySelectedPlayers(prev => ({ ...prev, [i]: val === "none" ? "" : val }))}
                                                        >
                                                            <DropdownTrigger size="sm" className="h-8 w-24 sm:w-32 text-xs bg-transparent border border-border rounded-sm px-2 text-foreground truncate shrink-0">
                                                                <DropdownValue placeholder={t("select_player") || "เลือกคนยิง"} />
                                                            </DropdownTrigger>
                                                            <DropdownContent className="z-[70] max-h-56">
                                                                <DropdownItem value="none">{t("select_player") || "เลือกคนยิง"}</DropdownItem>
                                                                {awayPlayers.map(p => (
                                                                    <DropdownItem key={p.id} value={p.id}>
                                                                        {p.number ? `#${p.number} ` : ''}{p.name}
                                                                    </DropdownItem>
                                                                ))}
                                                            </DropdownContent>
                                                        </Dropdown>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="w-8 h-8 rounded-sm border border-border/40 bg-transparent opacity-30" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Footer Actions */}
                {!readOnly && shots.length > 0 && (
                    <DialogFooter className="p-4 border-t border-border bg-card justify-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs font-semibold text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            onClick={handleClear}
                            disabled={isSaving}
                        >
                            {t("clear_all")}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
