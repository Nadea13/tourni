"use client"

import { Button } from "@/components/ui/button"
import { LayoutGrid, Dices, Trophy } from "lucide-react"
import { useLocale } from "next-intl"

interface NodeToolsProps {
    onAddMatch: () => void
    onAddRound?: () => void
    onAddGroup: () => void
    onAddStanding?: () => void
    onAddDraw?: () => void
}

export function NodeTools({
    onAddMatch,
    onAddRound,
    onAddGroup,
    onAddDraw,
}: NodeToolsProps) {
    const isThai = useLocale() === "th"
    return (
        <div className="flex flex-col gap-1 p-1">
            <Button
                variant="ghost"
                onClick={onAddMatch}
                className="w-full justify-start gap-3 h-auto py-2 px-3 hover:bg-node-2/10 border border-transparent hover:border-node-2/30 transition-all group"
            >
                <div className="w-8 h-8 bg-node-2/10 rounded-sm flex items-center justify-center shrink-0 group-hover:bg-node-2/20 transition-colors">
                    <span className="text-xs font-bold text-node-2 select-none">VS</span>
                </div>
                <div className="flex flex-col items-start gap-0.5">
                    <span className="text-[11px] font-black tracking-tight">{isThai ? "เพิ่มแมตช์" : "Add Match"}</span>
                    <span className="text-[9px] text-muted-foreground tracking-tighter font-medium text-left">
                        {isThai ? "รอบน็อคเอาท์ (ตามคู่)" : "Knockout Slot (Per Match)"}
                    </span>
                </div>
            </Button>

            {onAddRound && (
                <Button
                    variant="ghost"
                    onClick={onAddRound}
                    className="w-full justify-start gap-3 h-auto py-2 px-3 hover:bg-node-2/10 border border-transparent hover:border-node-2/30 transition-all group"
                >
                    <div className="w-8 h-8 bg-node-2/10 rounded-sm flex items-center justify-center shrink-0 group-hover:bg-node-2/20 transition-colors">
                        <Trophy className="h-4 w-4 text-node-2" />
                    </div>
                    <div className="flex flex-col items-start gap-0.5">
                        <span className="text-[11px] font-black tracking-tight">{isThai ? "เพิ่มรอบการแข่งขัน" : "Add Round"}</span>
                        <span className="text-[9px] text-muted-foreground tracking-tighter font-medium text-left">
                            {isThai ? "โหมดรอบ (เส้นเดียว เข้า-ออก)" : "Single-Wire Round"}
                        </span>
                    </div>
                </Button>
            )}

            <Button
                variant="ghost"
                onClick={onAddGroup}
                className="w-full justify-start gap-3 h-auto py-2 px-3 hover:bg-node-5/10 border border-transparent hover:border-node-5/30 transition-all group"
            >
                <div className="w-8 h-8 bg-node-5/10 rounded-sm flex items-center justify-center shrink-0 group-hover:bg-node-5/20 transition-colors">
                    <LayoutGrid className="h-4 w-4 text-node-5" />
                </div>
                <div className="flex flex-col items-start gap-0.5">
                    <span className="text-[11px] font-black tracking-tight">{isThai ? "เพิ่มกลุ่ม (ตารางคะแนน)" : "Add Group (Standings)"}</span>
                    <span className="text-[9px] text-muted-foreground tracking-tighter font-medium text-left">
                        {isThai ? "แบ่งสายและตารางคะแนน" : "Group Stage & Standings"}
                    </span>
                </div>
            </Button>

            {onAddDraw && (
                <Button
                    variant="ghost"
                    onClick={onAddDraw}
                    className="w-full justify-start gap-3 h-auto py-2 px-3 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/30 transition-all group"
                >
                    <div className="w-8 h-8 bg-amber-500/10 rounded-sm flex items-center justify-center shrink-0 group-hover:bg-amber-500/20 transition-colors">
                        <Dices className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="flex flex-col items-start gap-0.5">
                        <span className="text-[11px] font-black tracking-tight">{isThai ? "เพิ่มโหนดสุ่มจับสลาก" : "Add Draw Node"}</span>
                        <span className="text-[9px] text-muted-foreground tracking-tighter font-medium text-left">
                            {isThai ? "สุ่มประกบคู่รอบถัดไป" : "Shuffle & Draw Next Round"}
                        </span>
                    </div>
                </Button>
            )}
        </div>
    )
}
