"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/dropdown";
import { Switch } from "@/components/ui/switch";
import { Player } from "@/types";
import { useTranslations, useLocale } from "next-intl";
import { X } from "lucide-react";
import { VOLLEYBALL_EVENT_TYPES } from "@/features/sports/volleyball/console/constants";

export interface VolleyballEventSaveData {
    playerId?: string;
    playerName?: string;
    outPlayerId?: string;
    outPlayerName?: string;
    inPlayerId?: string;
    inPlayerName?: string;
    foulType?: string;
    challengeReason?: string;
    challengeResult?: string;
    sanctionType?: 'yellow_card' | 'red_card' | 'expulsion' | 'disqualification';
    reason?: string;
    set?: number;
    awardOpponentPoint?: boolean;
}

export type VolleyballActionType = 'ace' | 'spike' | 'block' | 'point' | 'substitution' | 'foul' | 'challenge' | 'sanction' | 'timeout';

interface VolleyballEventDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teamSide: 'home' | 'away';
    teamName?: string;
    eventType: VolleyballActionType | null;
    initialSet?: number;
    players: Player[];
    opponentPlayers?: Player[];
    activeLineupIds?: string[];
    onSave: (data: VolleyballEventSaveData) => void;
}

export function VolleyballEventDialog({
    open,
    onOpenChange,
    teamSide,
    teamName,
    eventType,
    initialSet = 1,
    players,
    opponentPlayers = [],
    activeLineupIds = [],
    onSave
}: VolleyballEventDialogProps) {
    const tCommon = useTranslations("Common");
    const tConsole = useTranslations("Console");
    const locale = useLocale();
    const isTh = locale === "th";

    const [setNumber, setSetNumber] = useState<string>("1");
    const [playerId, setPlayerId] = useState<string>("unknown");
    const [subInPlayerId, setSubInPlayerId] = useState<string>("");
    const [foulType, setFoulType] = useState<string>("net_touch");
    const [challengeReason, setChallengeReason] = useState<string>("in_out");
    const [challengeResult, setChallengeResult] = useState<"successful" | "unsuccessful" | "reviewing">("successful");
    const [selectedCardType, setSelectedCardType] = useState<"yellow" | "red" | "expulsion" | "disqualification">("yellow");
    const [sanctionReason, setSanctionReason] = useState<string>("unsportsmanlike");
    const [awardOpponentPoint, setAwardOpponentPoint] = useState<boolean>(true);

    useEffect(() => {
        if (open) {
            setSetNumber(initialSet.toString());
            setPlayerId("unknown");

            const starting = activeLineupIds.length > 0
                ? players.filter(p => activeLineupIds.includes(p.id))
                : players;
            const bench = activeLineupIds.length > 0
                ? players.filter(p => !activeLineupIds.includes(p.id))
                : players;

            if (eventType === 'substitution') {
                setPlayerId(starting[0]?.id || "unknown");
                setSubInPlayerId(bench[0]?.id || "");
            } else {
                setPlayerId("unknown");
                setSubInPlayerId("");
            }

            setFoulType("net_touch");
            setChallengeReason("in_out");
            setChallengeResult("successful");
            setSelectedCardType("yellow");
            setSanctionReason("unsportsmanlike");
            setAwardOpponentPoint(true);
        }
    }, [open, eventType, initialSet, activeLineupIds, players]);

    if (!eventType) return null;

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

    const eventConfig = VOLLEYBALL_EVENT_TYPES.find(t => t.type === eventType);

    const getEventTitle = () => {
        const teamLabel = teamName || (teamSide === 'home' ? 'Home' : 'Away');
        let typeLabel = "";
        switch (eventType) {
            case 'point': typeLabel = isTh ? "ได้แต้ม (Point)" : "Point"; break;
            case 'ace': typeLabel = isTh ? "เสิร์ฟเอซ (Serve)" : "Serve (Ace)"; break;
            case 'spike': typeLabel = isTh ? "ตบทำแต้ม (Attack / Spike)" : "Attack / Spike"; break;
            case 'block': typeLabel = isTh ? "บล็อก (Block)" : "Block"; break;
            case 'substitution': typeLabel = isTh ? "เปลี่ยนตัว" : "Substitution"; break;
            case 'foul': typeLabel = isTh ? "ฟาวล์" : "Foul"; break;
            case 'challenge': typeLabel = isTh ? "วิดีโอชาเลนจ์" : "Video Challenge"; break;
            case 'sanction': typeLabel = isTh ? "การลงโทษ (คาดโทษ)" : "Sanctions"; break;
            default: typeLabel = eventConfig?.label ? tConsole(eventConfig.label) : String(eventType);
        }
        return `${typeLabel} - ${teamLabel}`;
    };

    const handleSave = () => {
        const chosenSet = parseInt(setNumber) || initialSet;

        if (eventType === 'substitution') {
            const outPlayer = players.find(p => p.id === playerId);
            const inPlayer = players.find(p => p.id === subInPlayerId);
            onSave({
                outPlayerId: playerId,
                outPlayerName: outPlayer?.name || "Unknown",
                inPlayerId: subInPlayerId,
                inPlayerName: inPlayer?.name || "Unknown",
                set: chosenSet
            });
        } else if (eventType === 'foul') {
            const selectedPlayer = players.find(p => p.id === playerId);
            const foulText = foulType === "net_touch" ? (isTh ? "เน็ตทัช (Net touch)" : "Net touch")
                : foulType === "line" ? (isTh ? "เหยียบเส้น/ข้ามแดน" : "Line violation")
                : foulType === "lift" ? (isTh ? "ลูกติด/แคร์รี่" : "Lift / Carry")
                : foulType === "double" ? (isTh ? "ดับเบิลบอล" : "Double contact")
                : foulType === "rotation" ? (isTh ? "ฟาวล์ตำแหน่ง" : "Rotational fault")
                : foulType === "out" ? (isTh ? "ลูกออก" : "Out of bounds")
                : (isTh ? "ฟาวล์อื่นๆ" : "Other fault");

            onSave({
                playerId: playerId === 'unknown' ? '' : playerId,
                playerName: selectedPlayer ? selectedPlayer.name : undefined,
                foulType: foulText,
                awardOpponentPoint,
                set: chosenSet
            });
        } else if (eventType === 'challenge') {
            const reasonText = challengeReason === "in_out" ? (isTh ? "ลูกลง/ออก (In/Out)" : "In/Out")
                : challengeReason === "net_touch" ? (isTh ? "สัมผัสตาข่าย (Net Touch)" : "Net Touch")
                : challengeReason === "block_touch" ? (isTh ? "ทัชบล็อก (Block Touch)" : "Block Touch")
                : challengeReason === "antenna" ? (isTh ? "สัมผัสเสาอากาศ" : "Antenna Touch")
                : (isTh ? "อื่นๆ" : "Other");

            const resultText = challengeResult === "successful" ? (isTh ? "ชาเลนจ์สำเร็จ" : "Successful")
                : challengeResult === "unsuccessful" ? (isTh ? "ชาเลนจ์ไม่สำเร็จ" : "Unsuccessful")
                : (isTh ? "กำลังตรวจสอบ" : "Reviewing");

            onSave({
                challengeReason: reasonText,
                challengeResult: resultText,
                set: chosenSet
            });
        } else if (eventType === 'sanction') {
            const selectedPlayer = players.find(p => p.id === playerId);
            const resolvedSanctionType: 'yellow_card' | 'red_card' | 'expulsion' | 'disqualification' =
                selectedCardType === 'red' ? 'red_card'
                : selectedCardType === 'expulsion' ? 'expulsion'
                : selectedCardType === 'disqualification' ? 'disqualification'
                : 'yellow_card';

            const reasonText = sanctionReason === "unsportsmanlike" ? (isTh ? "พฤติกรรมไม่เหมาะสม" : "Unsportsmanlike conduct")
                : sanctionReason === "delay" ? (isTh ? "ถ่วงเวลา" : "Delaying the game")
                : sanctionReason === "arguing" ? (isTh ? "โต้เถียงผู้ตัดสิน" : "Arguing with referee")
                : (isTh ? "อื่นๆ" : "Other");

            onSave({
                playerId: playerId === 'unknown' ? '' : playerId,
                playerName: playerId === 'staff' ? (isTh ? "เจ้าหน้าที่ทีม / โค้ช" : "Team Staff") : (selectedPlayer ? selectedPlayer.name : undefined),
                sanctionType: resolvedSanctionType,
                reason: reasonText,
                set: chosenSet
            });
        } else {
            const selectedPlayer = players.find(p => p.id === playerId);
            onSave({
                playerId: playerId === 'unknown' ? '' : playerId,
                playerName: selectedPlayer ? selectedPlayer.name : undefined,
                set: chosenSet
            });
        }
        onOpenChange(false);
    };

    const isSaveDisabled = () => {
        if (eventType === 'substitution') {
            return !playerId || !subInPlayerId || playerId === subInPlayerId || playerId === 'unknown';
        }
        return false;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="w-full h-full sm:h-auto sm:max-w-[640px] max-h-screen sm:max-h-[90vh] overflow-hidden flex flex-col bg-card p-0 shadow-2xl rounded-none sm:rounded-sm">
                <DialogHeader className="p-2 md:p-4 border-b relative pr-10 shrink-0">
                    <DialogTitle className="flex items-center text-xl font-black tracking-tighter">
                        {getEventTitle()}
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
                    {/* Set Number Input (matches Football's Minute input) */}
                    <div className="space-y-1">
                        <Label>{isTh ? "เซต (Set)" : "Set"}</Label>
                        <Input
                            value={setNumber}
                            onChange={e => setSetNumber(e.target.value)}
                            type="number"
                            min={1}
                        />
                    </div>

                    {/* EVENT-SPECIFIC SECTION 1: Substitution (matches Football substitution) */}
                    {eventType === 'substitution' && (
                        <div className="space-y-1 lg:space-y-2 p-2 border rounded-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {/* Player Out */}
                                <div className="space-y-1">
                                    <Label className="flex items-center gap-1.5 text-red-500 font-bold">
                                        <span>▼</span> {tConsole("player_out") || (isTh ? "ผู้เล่นที่ออก (Player OUT)" : "Player OUT")}
                                    </Label>
                                    <Select value={playerId} onValueChange={setPlayerId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={tConsole("player_name") || (isTh ? "เลือกผู้เล่นที่ออก" : "Select player")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {startingPlayers.map((player) => (
                                                <SelectItem key={player.id} value={player.id}>
                                                    {getPlayerLabel(player)}
                                                </SelectItem>
                                            ))}
                                            {substitutePlayers.length > 0 && startingPlayers.length === 0 && substitutePlayers.map((player) => (
                                                <SelectItem key={player.id} value={player.id}>
                                                    {getPlayerLabel(player)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Player In */}
                                <div className="space-y-1">
                                    <Label className="flex items-center gap-1.5 text-emerald-500 font-bold">
                                        <span>▲</span> {tConsole("player_in") || (isTh ? "ผู้เล่นที่เข้า (Player IN)" : "Player IN")}
                                    </Label>
                                    <Select value={subInPlayerId} onValueChange={setSubInPlayerId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={tConsole("select_player_in") || (isTh ? "เลือกผู้เล่นที่เข้า" : "Select player in")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {substitutePlayers.map((player) => (
                                                <SelectItem key={player.id} value={player.id}>
                                                    {getPlayerLabel(player)}
                                                </SelectItem>
                                            ))}
                                            {startingPlayers.map((player) => (
                                                <SelectItem key={player.id} value={player.id}>
                                                    {getPlayerLabel(player)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EVENT-SPECIFIC SECTION 2: Foul (matches Football foul layout) */}
                    {eventType === 'foul' && (
                        <div className="space-y-2 p-2 border rounded-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {/* Fouling Player */}
                                <div className="space-y-1">
                                    <Label>{tConsole("player") || (isTh ? "ผู้เล่นที่ทำฟาวล์" : "Fouling Player")}</Label>
                                    <Select value={playerId} onValueChange={setPlayerId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={tConsole("player_name") || (isTh ? "เลือกผู้เล่น" : "Select player")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unknown">{tConsole("unknown_player") || (isTh ? "ไม่ระบุชื่อ" : "Unknown player")}</SelectItem>
                                            {players.map((player) => (
                                                <SelectItem key={player.id} value={player.id}>
                                                    {getPlayerLabel(player)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Foul Type */}
                                <div className="space-y-1">
                                    <Label>{isTh ? "ลักษณะการฟาวล์" : "Foul Type"}</Label>
                                    <Select value={foulType} onValueChange={setFoulType}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="net_touch">{isTh ? "เน็ตทัช (Net touch)" : "Net touch"}</SelectItem>
                                            <SelectItem value="line">{isTh ? "เหยียบเส้น/ข้ามแดน (Line violation)" : "Line violation"}</SelectItem>
                                            <SelectItem value="lift">{isTh ? "ลูกติด/แคร์รี่ (Lift / Carry)" : "Lift / Carry"}</SelectItem>
                                            <SelectItem value="double">{isTh ? "สัมผัสสองครั้ง (Double contact)" : "Double contact"}</SelectItem>
                                            <SelectItem value="rotation">{isTh ? "ฟาวล์ตำแหน่ง (Rotational fault)" : "Rotational fault"}</SelectItem>
                                            <SelectItem value="out">{isTh ? "ลูกออก (Out of bounds)" : "Out of bounds"}</SelectItem>
                                            <SelectItem value="other">{isTh ? "อื่นๆ (Other)" : "Other"}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Award Point to Opponent Toggle */}
                            <div className="flex items-center justify-between pt-2 border-t mt-2">
                                <div className="space-y-0.5 pr-2">
                                    <Label className="text-sm font-semibold">
                                        {isTh ? "เพิ่มแต้มให้ทีมตรงข้าม (+1 แต้ม)" : "Award point to opponent (+1)"}
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        {isTh ? "ตามกติกา เมื่อทำฟาวล์ อีกฝ่ายจะได้ 1 แต้มและได้สิทธิ์เสิร์ฟ" : "When a foul occurs, opponent receives 1 point and service"}
                                    </p>
                                </div>
                                <Switch
                                    checked={awardOpponentPoint}
                                    onCheckedChange={setAwardOpponentPoint}
                                />
                            </div>
                        </div>
                    )}

                    {/* EVENT-SPECIFIC SECTION 3: Video Challenge (matches Football VAR / Goal review layout) */}
                    {eventType === 'challenge' && (
                        <div className="space-y-2 p-2 border rounded-sm">
                            <div className="flex items-center justify-between">
                                <Label>{isTh ? "ผลการชาเลนจ์" : "Challenge Result"}</Label>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setChallengeResult("successful")}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${challengeResult === "successful" ? "bg-primary text-primary-foreground font-black" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        {isTh ? "ชาเลนจ์สำเร็จ" : "Successful"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChallengeResult("unsuccessful")}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${challengeResult === "unsuccessful" ? "bg-destructive text-destructive-foreground font-black" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        {isTh ? "ชาเลนจ์ไม่สำเร็จ" : "Unsuccessful"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChallengeResult("reviewing")}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${challengeResult === "reviewing" ? "bg-amber-500 text-white font-black" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        {isTh ? "กำลังตรวจสอบ" : "Reviewing"}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label>{isTh ? "เหตุผลในการขอชาเลนจ์" : "Challenge Reason"}</Label>
                                <Select value={challengeReason} onValueChange={setChallengeReason}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="in_out">{isTh ? "ลูกลง/ออก (In / Out)" : "In / Out"}</SelectItem>
                                        <SelectItem value="net_touch">{isTh ? "สัมผัสตาข่าย (Net touch)" : "Net touch"}</SelectItem>
                                        <SelectItem value="block_touch">{isTh ? "ทัชบล็อก (Block touch)" : "Block touch"}</SelectItem>
                                        <SelectItem value="antenna">{isTh ? "สัมผัสเสาอากาศ (Antenna touch)" : "Antenna touch"}</SelectItem>
                                        <SelectItem value="other">{isTh ? "อื่นๆ (Other)" : "Other"}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {/* EVENT-SPECIFIC SECTION 4: Sanctions / Cards (matches Football Card Selection) */}
                    {eventType === 'sanction' && (
                        <div className="space-y-3 p-2 border rounded-sm">
                            <div className="flex items-center justify-between">
                                <Label>{tConsole("card_given") || (isTh ? "ประเภทโทษที่ลง" : "Sanction Given")}</Label>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCardType("yellow")}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${selectedCardType === "yellow" ? "bg-amber-500 text-white font-black shadow-xs" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        <span className="w-2.5 h-3.5 bg-amber-400 rounded-xs border border-amber-600 inline-block shadow-xs" />
                                        {tConsole("yellow_card") || (isTh ? "ใบเหลือง" : "Yellow")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCardType("red")}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${selectedCardType === "red" ? "bg-red-600 text-white font-black shadow-xs" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        <span className="w-2.5 h-3.5 bg-red-600 rounded-xs border border-red-800 inline-block shadow-xs" />
                                        {tConsole("red_card") || (isTh ? "ใบแดง" : "Red")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCardType("expulsion")}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${selectedCardType === "expulsion" ? "bg-primary text-primary-foreground font-black shadow-xs" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        {isTh ? "ไล่ออกในเซต" : "Expulsion"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCardType("disqualification")}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${selectedCardType === "disqualification" ? "bg-destructive text-destructive-foreground font-black shadow-xs" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                    >
                                        {isTh ? "ตัดสิทธิ์" : "Disqualify"}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label>{tConsole("player") || (isTh ? "บุคคลที่ถูกลงโทษ" : "Individual")}</Label>
                                    <Select value={playerId} onValueChange={setPlayerId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={tConsole("player_name") || (isTh ? "เลือกผู้เล่น" : "Select player")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unknown">{tConsole("unknown_player") || (isTh ? "ไม่ระบุชื่อ" : "Unknown")}</SelectItem>
                                            <SelectItem value="staff">{isTh ? "เจ้าหน้าที่ทีม / โค้ช (Team Staff)" : "Team Staff / Coach"}</SelectItem>
                                            {players.map((player) => (
                                                <SelectItem key={player.id} value={player.id}>
                                                    {getPlayerLabel(player)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>{isTh ? "สาเหตุ" : "Reason"}</Label>
                                    <Select value={sanctionReason} onValueChange={setSanctionReason}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unsportsmanlike">{isTh ? "พฤติกรรมไม่เหมาะสม" : "Unsportsmanlike"}</SelectItem>
                                            <SelectItem value="delay">{isTh ? "ถ่วงเวลาการแข่งขัน" : "Delaying game"}</SelectItem>
                                            <SelectItem value="arguing">{isTh ? "โต้เถียงผู้ตัดสิน" : "Arguing with referee"}</SelectItem>
                                            <SelectItem value="other">{isTh ? "อื่นๆ" : "Other"}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EVENT-SPECIFIC SECTION 5: Scoring Events (Point, Ace, Spike, Block) */}
                    {(eventType === 'point' || eventType === 'ace' || eventType === 'spike' || eventType === 'block') && (
                        <div className="space-y-1">
                            <Label>{tConsole("scorer") || (isTh ? "ผู้เล่นทำคะแนน (Scorer)" : "Scoring Player")}</Label>
                            <Select value={playerId} onValueChange={setPlayerId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder={tConsole("player_name") || (isTh ? "เลือกผู้เล่น" : "Select player")} />
                                </SelectTrigger>
                                <SelectContent>
                                    {startingPlayers.map((player) => (
                                        <SelectItem key={player.id} value={player.id}>
                                            {getPlayerLabel(player)}
                                        </SelectItem>
                                    ))}
                                    {substitutePlayers.map((player) => (
                                        <SelectItem key={player.id} value={player.id}>
                                            {getPlayerLabel(player)}
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="unknown">
                                        {tConsole("unknown_player") || (isTh ? "ไม่ระบุชื่อ (Unknown Player)" : "Unknown Player")}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-2 md:p-4 border-t shrink-0">
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaveDisabled()}
                        className="w-full"
                    >
                        {tCommon("save") || (isTh ? "บันทึกข้อมูล" : "Save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
