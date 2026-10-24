"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Shield, ArrowRight, Settings, Plus, Minus, RotateCcw, LayoutGrid, Play, Pause, Copy, ExternalLink, ChevronRight, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ApiClient } from "@/lib/api-client";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { updateBroadcastSettings } from "@/actions/tournaments/general";

import { CanvasBlock, CanvasSettings, BlankCanvas, DEFAULT_BLOCKS } from "./types";
import { CanvasPreview } from "./canvas-preview";
import { EditorSidebar } from "./editor-sidebar";
import { LayerSidebar } from "./layer-sidebar";
import { Header } from "@/components/ui/header";
import { LogoUploader } from "@/components/shared/logo-uploader";

export interface BroadcastDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    matchId: string;
    tournamentId: string;
    sport?: string;
}

export interface BroadcastEditorProps {
    matchId?: string;
    tournamentId?: string;
    sport?: string;
    active?: boolean;
    standalone?: boolean;
}

const SPORTS_OPTIONS = [
    { id: "football", name: "ฟุตบอล (Football)", icon: "⚽" },
    { id: "volleyball", name: "วอลเลย์บอล (Volleyball)", icon: "🏐" },
];

export function BroadcastEditor({ matchId, tournamentId, sport = "football", active = true, standalone = !tournamentId }: BroadcastEditorProps) {
    const locale = useLocale();
    const { toast } = useToast();
    const [copiedScoreboard, setCopiedScoreboard] = useState(false);
    const [copiedBlank, setCopiedBlank] = useState(false);
    const [delay, setDelay] = useState<number>(0);

    // Step state: "setup" (Form for sport, teams, logos), "editor" (Canvas grid), "console" (Live Score Keeper)
    const [step, setStep] = useState<"setup" | "editor" | "console">(standalone ? "setup" : "editor");

    // Match & Team Details
    const [selectedSport, setSelectedSport] = useState<string>(sport || "football");
    const [nameHome, setNameHome] = useState<string>("");
    const [nameAway, setNameAway] = useState<string>("");
    const [logoHome, setLogoHome] = useState<string>("");
    const [logoAway, setLogoAway] = useState<string>("");
    const [logoTournament, setLogoTournament] = useState<string>("");

    // Live Score Keeping States
    const [scoreHome, setScoreHome] = useState<string>("0");
    const [scoreAway, setScoreAway] = useState<string>("0");
    const [timerText, setTimerText] = useState<string>("00:00");
    const [timerIsRunning, setTimerIsRunning] = useState<boolean>(false);
    const [addTimeText, setAddTimeText] = useState<string>("+0");
    const [homeScorer, setHomeScorer] = useState<string>("");
    const [awayScorer, setAwayScorer] = useState<string>("");
    const [homeScorerInput, setHomeScorerInput] = useState<string>("");
    const [awayScorerInput, setAwayScorerInput] = useState<string>("");

    // Configuration states
    const [layout, setLayout] = useState<"top-bar" | "minimal-left" | "minimal-right">("top-bar");
    const [bg, setBg] = useState<string>("transparent");
    const [size, setSize] = useState<"small" | "medium" | "large">("medium");
    const [showTimeline, setShowTimeline] = useState(false);

    // Customization states
    const [font, setFont] = useState<string>("inter");
    const [scoreBg, setScoreBg] = useState<string>("#ef4444");
    const [teamNameMode, setTeamNameMode] = useState<"abbr" | "full">("abbr");
    const [showLogos, setShowLogos] = useState<boolean>(true);
    const [headerText, setHeaderText] = useState<string>("");
    const [posX, setPosX] = useState<"left" | "center" | "right">("center");
    const [posY, setPosY] = useState<"top" | "bottom">("top");
    const [alertDuration, setAlertDuration] = useState<number>(6);
    const [linkCorners, setLinkCorners] = useState<boolean>(true);

    // Custom match-by-match color bar states
    const [homeBarDir, setHomeBarDir] = useState<"none" | "top" | "right" | "bottom" | "left">("none");
    const [homeBarColor, setHomeBarColor] = useState<string>("#10b981");
    const [awayBarDir, setAwayBarDir] = useState<"none" | "top" | "right" | "bottom" | "left">("none");
    const [awayBarColor, setAwayBarColor] = useState<string>("#3b82f6");

    // Canvas Block Editor States
    const [blocks, setBlocks] = useState<CanvasBlock[]>([]);
    const [selectedBlockId, setSelectedBlockId] = useState<string>("");
    const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
    const [blockGap, setBlockGap] = useState<number>(0);
    const [blockBg, setBlockBg] = useState<"spaced" | "docked">("spaced");
    const [rounded, setRounded] = useState<"none" | "md" | "full">("md");

    const [blankCanvases, setBlankCanvases] = useState<BlankCanvas[]>([
        {
            id: "default",
            name: "Blank Canvas (Alerts Only)",
            delay: 0,
            bg: "transparent",
            posX: "center",
            posY: "top",
            alertDuration: 6,
            font: "inter",
            layout: "top-bar",
            size: "medium",
            showTimeline: false,
            scoreBg: "#ef4444",
            teamNameMode: "abbr",
            showLogos: true,
            headerText: "",
            homeBarDir: "none",
            homeBarColor: "#10b981",
            awayBarDir: "none",
            awayBarColor: "#3b82f6",
            blockGap: 0,
            blockBg: "spaced",
            rounded: "md",
            blocks: []
        }
    ]);
    const [selectedCanvasId, setSelectedCanvasId] = useState<string>("scoreboard");

    // Backup of scoreboard settings
    const mainCanvasSettingsRef = useRef<CanvasSettings>({
        bg: "transparent",
        posX: "center",
        posY: "top",
        alertDuration: 6,
        font: "inter",
        layout: "top-bar",
        size: "medium",
        showTimeline: false,
        scoreBg: "#ef4444",
        teamNameMode: "abbr",
        showLogos: true,
        headerText: "",
        homeBarDir: "none",
        homeBarColor: "#10b981",
        awayBarDir: "none",
        awayBarColor: "#3b82f6",
        blockGap: 0,
        blockBg: "spaced",
        rounded: "md",
        blocks: []
    });

    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const isInitialLoadedRef = useRef(false);

    // Timer Ticking Effect
    useEffect(() => {
        if (!timerIsRunning) return;
        const interval = setInterval(() => {
            setTimerText((prev) => {
                const parts = prev.split(":");
                if (parts.length === 2) {
                    const m = parseInt(parts[0]) || 0;
                    const s = parseInt(parts[1]) || 0;
                    const totalSeconds = m * 60 + s + 1;
                    const nextM = Math.floor(totalSeconds / 60);
                    const nextS = totalSeconds % 60;
                    return `${String(nextM).padStart(2, "0")}:${String(nextS).padStart(2, "0")}`;
                }
                return "00:00";
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [timerIsRunning]);

    const handleLogoUpload = (file: File, callback: (url: string) => void) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = 128;
                canvas.height = 128;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0, 128, 128);
                    const compressed = canvas.toDataURL("image/webp", 0.85);
                    callback(compressed);
                }
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    // Load template on mount / active
    useEffect(() => {
        if (!active) return;
        const loadTemplate = async () => {
            try {
                let fetchedNameHome = "";
                let fetchedNameAway = "";
                let fetchedLogoHome = "";
                let fetchedLogoAway = "";

                // 1. Fetch Match details (if matchId is provided or find the latest match in tournament)
                let activeMatchId = matchId;
                if (!activeMatchId && tournamentId) {
                    try {
                        const matches = await ApiClient.fetch<any[]>(`/tournaments/${tournamentId}/matches`);
                        if (Array.isArray(matches) && matches.length > 0) {
                            activeMatchId = matches[0].id;
                        }
                    } catch {
                        // ignore error
                    }
                }

                if (activeMatchId) {
                    try {
                        const matchData = await ApiClient.fetch<any>(`/matches/${activeMatchId}`);
                        if (matchData) {
                            const home = matchData.home_team;
                            const away = matchData.away_team;

                            fetchedNameHome = home?.name || "";
                            fetchedLogoHome = home?.logo_url || home?.logo_img || "";
                            fetchedNameAway = away?.name || "";
                            fetchedLogoAway = away?.logo_url || away?.logo_img || "";

                            if (fetchedNameHome) setNameHome(fetchedNameHome);
                            if (fetchedLogoHome) setLogoHome(fetchedLogoHome);
                            if (fetchedNameAway) setNameAway(fetchedNameAway);
                            if (fetchedLogoAway) setLogoAway(fetchedLogoAway);

                            if (matchData.home_score !== null && matchData.home_score !== undefined) setScoreHome(String(matchData.home_score));
                            if (matchData.away_score !== null && matchData.away_score !== undefined) setScoreAway(String(matchData.away_score));
                        }
                    } catch {
                        // ignore error
                    }
                }

                if (tournamentId) {
                    let broadcastSettings: any = null;
                    try {
                        const tourData = await ApiClient.fetch<any>(`/tournaments/${tournamentId}`);
                        const t = tourData?.tournament || tourData;
                        broadcastSettings = t?.broadcast_settings;
                    } catch {
                        // ignore error
                    }

                    if (broadcastSettings) {
                        const settings = broadcastSettings as Partial<CanvasSettings> & {
                            blankCanvases?: BlankCanvas[];
                            blankDelay?: number;
                            selectedCanvasId?: string;
                            delay?: number;
                            nameHome?: string;
                            nameAway?: string;
                            logoHome?: string;
                            logoAway?: string;
                            logoTournament?: string;
                            selectedSport?: string;
                            scoreHome?: string;
                            scoreAway?: string;
                            timerText?: string;
                            addTimeText?: string;
                            homeScorer?: string;
                            awayScorer?: string;
                        };

                        const mergedMainBlocks = (settings.blocks && Array.isArray(settings.blocks))
                            ? settings.blocks
                            : DEFAULT_BLOCKS;

                        mainCanvasSettingsRef.current = {
                            bg: settings.bg || "transparent",
                            posX: settings.posX || "center",
                            posY: settings.posY || "top",
                            alertDuration: settings.alertDuration || 6,
                            font: settings.font || "inter",
                            layout: settings.layout || "top-bar",
                            size: settings.size || "medium",
                            showTimeline: settings.showTimeline ?? false,
                            scoreBg: settings.scoreBg || "#ef4444",
                            teamNameMode: settings.teamNameMode || "abbr",
                            showLogos: settings.showLogos ?? true,
                            headerText: settings.headerText || "",
                            homeBarDir: settings.homeBarDir || "none",
                            homeBarColor: settings.homeBarColor || "#10b981",
                            awayBarDir: settings.awayBarDir || "none",
                            awayBarColor: settings.awayBarColor || "#3b82f6",
                            blockGap: settings.blockGap ?? 0,
                            blockBg: settings.blockBg || "spaced",
                            rounded: settings.rounded || "md",
                            blocks: mergedMainBlocks
                        };

                        if (settings.layout) setLayout(settings.layout);
                        if (settings.bg) setBg(settings.bg);
                        if (settings.size) setSize(settings.size);
                        if (settings.showTimeline !== undefined) setShowTimeline(settings.showTimeline);
                        if (settings.font) setFont(settings.font);
                        if (settings.scoreBg) setScoreBg(settings.scoreBg);
                        if (settings.teamNameMode) setTeamNameMode(settings.teamNameMode);
                        if (settings.showLogos !== undefined) setShowLogos(settings.showLogos);
                        if (settings.headerText !== undefined) setHeaderText(settings.headerText);
                        if (settings.posX) setPosX(settings.posX);
                        if (settings.posY) setPosY(settings.posY);
                        if (settings.alertDuration) setAlertDuration(settings.alertDuration);
                        if (settings.homeBarDir) setHomeBarDir(settings.homeBarDir);
                        if (settings.homeBarColor) setHomeBarColor(settings.homeBarColor);
                        if (settings.awayBarDir) setAwayBarDir(settings.awayBarDir);
                        if (settings.awayBarColor) setAwayBarColor(settings.awayBarColor);
                        if (settings.nameHome && !fetchedNameHome && !activeMatchId) setNameHome(settings.nameHome);
                        if (settings.nameAway && !fetchedNameAway && !activeMatchId) setNameAway(settings.nameAway);
                        if (settings.logoHome && !fetchedLogoHome && !activeMatchId) setLogoHome(settings.logoHome);
                        if (settings.logoAway && !fetchedLogoAway && !activeMatchId) setLogoAway(settings.logoAway);
                        if (settings.logoTournament) setLogoTournament(settings.logoTournament);
                        if (settings.selectedSport) setSelectedSport(settings.selectedSport);
                        if (settings.scoreHome && !activeMatchId) setScoreHome(settings.scoreHome);
                        if (settings.scoreAway && !activeMatchId) setScoreAway(settings.scoreAway);
                        if (settings.timerText) setTimerText(settings.timerText);
                        if (settings.addTimeText) setAddTimeText(settings.addTimeText);
                        if (settings.homeScorer) setHomeScorer(settings.homeScorer);
                        if (settings.awayScorer) setAwayScorer(settings.awayScorer);

                        setBlocks(mergedMainBlocks);
                        if (settings.selectedBlockId) setSelectedBlockId(settings.selectedBlockId);
                        if (settings.orientation) setOrientation(settings.orientation);
                        if (settings.blockGap !== undefined) setBlockGap(settings.blockGap);
                        if (settings.blockBg) setBlockBg(settings.blockBg);
                        if (settings.rounded) setRounded(settings.rounded);
                        if (settings.delay !== undefined) setDelay(settings.delay);

                        if (settings.blankCanvases) {
                            setBlankCanvases(settings.blankCanvases.map(c => ({
                                id: c.id,
                                name: c.name,
                                delay: c.delay ?? 0,
                                bg: c.bg ?? "transparent",
                                posX: c.posX ?? "center",
                                posY: c.posY ?? "top",
                                alertDuration: c.alertDuration ?? 6,
                                font: c.font ?? "inter",
                                layout: c.layout ?? "top-bar",
                                size: c.size ?? "medium",
                                showTimeline: c.showTimeline ?? false,
                                scoreBg: c.scoreBg ?? "#ef4444",
                                teamNameMode: c.teamNameMode ?? "abbr",
                                showLogos: c.showLogos ?? true,
                                headerText: c.headerText ?? "",
                                homeBarDir: c.homeBarDir ?? "none",
                                homeBarColor: c.homeBarColor ?? "#10b981",
                                awayBarDir: c.awayBarDir ?? "none",
                                awayBarColor: c.awayBarColor ?? "#3b82f6",
                                blockGap: c.blockGap ?? 0,
                                blockBg: c.blockBg ?? "spaced",
                                rounded: c.rounded ?? "md",
                                blocks: (c.blocks && Array.isArray(c.blocks)) ? c.blocks : []
                            })));
                        }

                        setSelectedCanvasId("scoreboard");
                    }
                } else {
                    // Standalone mode: load from localStorage
                    const saved = localStorage.getItem("overlay_playground_setup");
                    if (saved) {
                        try {
                            const data = JSON.parse(saved);
                            if (data.bg) setBg(data.bg);
                            if (data.scoreBg) setScoreBg(data.scoreBg);
                            if (data.blockGap !== undefined) setBlockGap(data.blockGap);
                            if (data.headerText !== undefined) setHeaderText(data.headerText);
                            if (data.nameHome) setNameHome(data.nameHome);
                            if (data.nameAway) setNameAway(data.nameAway);
                            if (data.logoHome) setLogoHome(data.logoHome);
                            if (data.logoAway) setLogoAway(data.logoAway);
                            if (data.logoTournament) setLogoTournament(data.logoTournament);
                            if (data.selectedSport) setSelectedSport(data.selectedSport);
                            if (data.homeBarDir) setHomeBarDir(data.homeBarDir);
                            if (data.homeBarColor) setHomeBarColor(data.homeBarColor);
                            if (data.awayBarDir) setAwayBarDir(data.awayBarDir);
                            if (data.awayBarColor) setAwayBarColor(data.awayBarColor);
                            if (data.blocks && Array.isArray(data.blocks)) setBlocks(data.blocks);
                            if (data.font) setFont(data.font);
                            if (data.posX) setPosX(data.posX);
                            if (data.posY) setPosY(data.posY);
                            if (data.blankCanvases) setBlankCanvases(data.blankCanvases);
                            if (data.selectedCanvasId) setSelectedCanvasId(data.selectedCanvasId);
                            if (data.orientation) setOrientation(data.orientation);
                            if (data.rounded) setRounded(data.rounded);
                            if (data.blockBg) setBlockBg(data.blockBg);
                            if (data.delay !== undefined) setDelay(data.delay);
                            if (data.scoreHome !== undefined) setScoreHome(data.scoreHome);
                            if (data.scoreAway !== undefined) setScoreAway(data.scoreAway);
                            if (data.timerText !== undefined) setTimerText(data.timerText);
                            if (data.addTimeText !== undefined) setAddTimeText(data.addTimeText);
                            if (data.homeScorer !== undefined) setHomeScorer(data.homeScorer);
                            if (data.awayScorer !== undefined) setAwayScorer(data.awayScorer);
                        } catch (e) {
                            console.error("Failed to parse standalone broadcast setup", e);
                        }
                    }
                }
            } catch (e) {
                console.error("Error loading broadcast template:", e);
            } finally {
                setTimeout(() => {
                    isInitialLoadedRef.current = true;
                    setIsDirty(false);
                }, 100);
            }
        };
        loadTemplate();
    }, [active, tournamentId, matchId]);

    // Undo / Redo History Stacks
    const historyPastRef = useRef<CanvasBlock[][]>([]);
    const historyFutureRef = useRef<CanvasBlock[][]>([]);
    const isUndoRedoActionRef = useRef<boolean>(false);

    // Keep fresh refs for keyboard shortcut event listeners
    const blocksRef = useRef(blocks);
    blocksRef.current = blocks;
    const selectedBlockIdRef = useRef(selectedBlockId);
    selectedBlockIdRef.current = selectedBlockId;
    const copiedBlocksRef = useRef<CanvasBlock[]>([]);

    // Track blocks state changes into history stack
    useEffect(() => {
        if (!isInitialLoadedRef.current || !active) return;
        if (isUndoRedoActionRef.current) {
            isUndoRedoActionRef.current = false;
            return;
        }

        const lastPast = historyPastRef.current[historyPastRef.current.length - 1];
        if (JSON.stringify(lastPast) !== JSON.stringify(blocks)) {
            historyPastRef.current.push(blocks);
            if (historyPastRef.current.length > 50) {
                historyPastRef.current.shift();
            }
            historyFutureRef.current = [];
        }
    }, [blocks, active]);

    // Global keyboard shortcuts
    useEffect(() => {
        if (!active || step !== "editor") return;

        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || (activeEl as HTMLElement).isContentEditable)) {
                return;
            }

            const currentBlocks = blocksRef.current;
            const currentSelectedId = selectedBlockIdRef.current;
            const selectedIds = (currentSelectedId || "").split(",").filter(Boolean);

            const isCtrl = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();
            const code = e.code;

            const isC = key === "c" || code === "KeyC";
            const isV = key === "v" || code === "KeyV";
            const isX = key === "x" || code === "KeyX";
            const isA = key === "a" || code === "KeyA";
            const isD = key === "d" || code === "KeyD";
            const isZ = key === "z" || code === "KeyZ";
            const isY = key === "y" || code === "KeyY";

            // Redo
            if (isCtrl && ((isZ && e.shiftKey) || isY)) {
                if (historyFutureRef.current.length > 0) {
                    e.preventDefault();
                    const nextState = historyFutureRef.current.pop();
                    if (nextState) {
                        historyPastRef.current.push(currentBlocks);
                        isUndoRedoActionRef.current = true;
                        setBlocks(nextState);
                    }
                }
                return;
            }

            // Undo
            if (isCtrl && isZ && !e.shiftKey) {
                if (historyPastRef.current.length > 1) {
                    e.preventDefault();
                    const currentState = historyPastRef.current.pop();
                    const previousState = historyPastRef.current[historyPastRef.current.length - 1];
                    if (currentState && previousState) {
                        historyFutureRef.current.push(currentState);
                        isUndoRedoActionRef.current = true;
                        setBlocks(previousState);
                    }
                }
                return;
            }

            // Copy
            if (isCtrl && isC) {
                if (selectedIds.length > 0) {
                    const targets = currentBlocks.filter(b => selectedIds.includes(b.id) && b.active);
                    if (targets.length > 0) {
                        e.preventDefault();
                        copiedBlocksRef.current = targets;
                    }
                }
                return;
            }

            // Paste
            if (isCtrl && isV) {
                if (copiedBlocksRef.current.length > 0) {
                    e.preventDefault();
                    const pastedBlocks: CanvasBlock[] = copiedBlocksRef.current.map((b, idx) => ({
                        ...b,
                        id: `shape-${b.shapeType || 'pasted'}-${crypto.randomUUID()}-${idx}`,
                        name: `${b.name || 'Block'} (Copy)`,
                        x: b.x + 20,
                        y: b.y + 20,
                    }));
                    setBlocks(prev => [...prev, ...pastedBlocks]);
                    setSelectedBlockId(pastedBlocks.map(b => b.id).join(","));
                }
                return;
            }

            // Cut
            if (isCtrl && isX) {
                if (selectedIds.length > 0) {
                    const targets = currentBlocks.filter(b => selectedIds.includes(b.id) && b.active);
                    if (targets.length > 0) {
                        e.preventDefault();
                        copiedBlocksRef.current = targets;
                        setBlocks(prev => prev.filter(b => !selectedIds.includes(b.id)));
                        setSelectedBlockId("");
                    }
                }
                return;
            }

            // Select All
            if (isCtrl && isA) {
                e.preventDefault();
                const allActiveIds = currentBlocks.filter(b => b.active).map(b => b.id);
                if (allActiveIds.length > 0) {
                    setSelectedBlockId(allActiveIds.join(","));
                }
                return;
            }

            // Duplicate
            if (isCtrl && isD) {
                if (selectedIds.length > 0) {
                    const targets = currentBlocks.filter(b => selectedIds.includes(b.id) && b.active);
                    if (targets.length > 0) {
                        e.preventDefault();
                        const dupBlocks: CanvasBlock[] = targets.map((b, idx) => ({
                            ...b,
                            id: `shape-${b.shapeType || 'dup'}-${crypto.randomUUID()}-${idx}`,
                            name: `${b.name || 'Block'} (Copy)`,
                            x: b.x + 15,
                            y: b.y + 15,
                        }));
                        setBlocks(prev => [...prev, ...dupBlocks]);
                        setSelectedBlockId(dupBlocks.map(b => b.id).join(","));
                    }
                }
                return;
            }

            const isG = key === "g" || code === "KeyG";

            // Ungroup
            if (isCtrl && isG && e.shiftKey) {
                if (selectedIds.length > 0) {
                    e.preventDefault();
                    setBlocks(prev => prev.map(b => selectedIds.includes(b.id) ? { ...b, groupId: undefined } : b));
                }
                return;
            }

            // Group
            if (isCtrl && isG && !e.shiftKey) {
                if (selectedIds.length > 1) {
                    e.preventDefault();
                    const newGroupId = `group-${crypto.randomUUID()}`;
                    setBlocks(prev => prev.map(b => selectedIds.includes(b.id) ? { ...b, groupId: newGroupId } : b));
                }
                return;
            }

            // Delete
            if (e.key === "Backspace" || e.key === "Delete") {
                if (selectedIds.length > 0) {
                    e.preventDefault();
                    setBlocks(prev => prev.filter(b => !selectedIds.includes(b.id)));
                    setSelectedBlockId("");
                }
                return;
            }

            // Arrow keys
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                if (selectedIds.length > 0) {
                    e.preventDefault();
                    const stepVal = e.shiftKey ? 5 : 0.5;
                    let deltaX = 0;
                    let deltaY = 0;
                    if (e.key === "ArrowLeft") deltaX = -stepVal;
                    if (e.key === "ArrowRight") deltaX = stepVal;
                    if (e.key === "ArrowUp") deltaY = -stepVal;
                    if (e.key === "ArrowDown") deltaY = stepVal;

                    setBlocks(prev => prev.map(b => {
                        if (selectedIds.includes(b.id) && b.active) {
                            return {
                                ...b,
                                x: Math.round((b.x + deltaX) * 10) / 10,
                                y: Math.round((b.y + deltaY) * 10) / 10,
                            };
                        }
                        return b;
                    }));
                }
                return;
            }
        };

        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, [active, step]);

    // Mark dirty
    useEffect(() => {
        if (!isInitialLoadedRef.current || !active) return;
        setIsDirty(true);
    }, [
        active, blocks, bg, posX, posY, alertDuration, font, layout, size, showTimeline,
        scoreBg, teamNameMode, showLogos, headerText, nameHome, nameAway, logoHome, logoAway,
        logoTournament, selectedSport, homeBarDir, homeBarColor, awayBarDir, awayBarColor,
        blockGap, blockBg, rounded, delay, blankCanvases, selectedCanvasId, orientation, selectedBlockId,
        scoreHome, scoreAway, addTimeText, homeScorer, awayScorer
    ]);

    const saveTemplate = useCallback(async (showToast: boolean = false) => {
        setSaving(true);
        try {
            let finalMain = mainCanvasSettingsRef.current;
            let finalBlanks = [...blankCanvases];

            if (selectedCanvasId === "scoreboard") {
                finalMain = {
                    bg, posX, posY, alertDuration, font,
                    layout, size, showTimeline, scoreBg, teamNameMode, showLogos,
                    headerText, homeBarDir, homeBarColor, awayBarDir, awayBarColor,
                    blockGap, blockBg, rounded, blocks
                };
            } else {
                const activeId = selectedCanvasId.replace("blank-", "");
                finalBlanks = finalBlanks.map(c => c.id === activeId ? {
                    ...c,
                    bg, posX, posY, alertDuration, font,
                    layout, size, showTimeline, scoreBg, teamNameMode, showLogos,
                    headerText, homeBarDir, homeBarColor, awayBarDir, awayBarColor,
                    blockGap, blockBg, rounded, blocks: [...blocks]
                } : c);
            }

            const currentBlankDelay = finalBlanks.find(c => `blank-${c.id}` === selectedCanvasId)?.delay ?? 0;

            if (tournamentId) {
                const res = await updateBroadcastSettings(tournamentId, {
                    ...finalMain,
                    selectedBlockId,
                    orientation,
                    delay,
                    blankDelay: currentBlankDelay,
                    blankCanvases: finalBlanks,
                    selectedCanvasId,
                });

                if (res.success) {
                    setIsDirty(false);
                    if (showToast) {
                        toast({
                            title: locale === 'th' ? "บันทึกเรียบร้อย!" : "Settings Saved!",
                            description: locale === 'th' ? "การตั้งค่าทั้งหมดถูกบันทึกสำเร็จ" : "Broadcast settings have been saved successfully.",
                        });
                    }
                } else if (showToast) {
                    toast({
                        variant: "destructive",
                        title: locale === 'th' ? "เกิดข้อผิดพลาด" : "Error saving",
                        description: res.error,
                    });
                }
            } else {
                // Standalone mode: save to localStorage
                const standaloneData = {
                    bg, posX, posY, alertDuration, font, layout, size, showTimeline,
                    scoreBg, teamNameMode, showLogos, headerText, nameHome, nameAway,
                    logoHome, logoAway, logoTournament, selectedSport, homeBarDir, homeBarColor,
                    awayBarDir, awayBarColor, blockGap, blockBg, rounded, blocks,
                    selectedBlockId, orientation, delay, blankCanvases, selectedCanvasId,
                    scoreHome, scoreAway, timerText, addTimeText, homeScorer, awayScorer
                };
                localStorage.setItem("overlay_playground_setup", JSON.stringify(standaloneData));
                setIsDirty(false);
                if (showToast) {
                    toast({
                        title: locale === 'th' ? "บันทึกเรียบร้อย!" : "Settings Saved!",
                        description: locale === 'th' ? "บันทึกการตั้งค่าลงเบราว์เซอร์สำเร็จ" : "Settings saved to local storage.",
                    });
                }
            }
        } catch (err: unknown) {
            if (showToast) {
                toast({
                    variant: "destructive",
                    title: locale === 'th' ? "เกิดข้อผิดพลาด" : "Error saving",
                    description: err instanceof Error ? err.message : String(err),
                });
            }
        } finally {
            setSaving(false);
        }
    }, [tournamentId, selectedCanvasId, bg, posX, posY, alertDuration, font, layout, size, showTimeline, scoreBg, teamNameMode, showLogos, headerText, nameHome, nameAway, logoHome, logoAway, logoTournament, selectedSport, homeBarDir, homeBarColor, awayBarDir, awayBarColor, blockGap, blockBg, rounded, blocks, blankCanvases, selectedBlockId, orientation, delay, scoreHome, scoreAway, timerText, addTimeText, homeScorer, awayScorer, locale, toast]);

    // Auto-save effect
    useEffect(() => {
        if (!isDirty || saving || !active) return;

        const timer = setTimeout(() => {
            saveTemplate(false);
        }, 800);

        return () => clearTimeout(timer);
    }, [isDirty, saving, active, saveTemplate]);

    // Real-time broadcast sync effect for OBS renderer
    useEffect(() => {
        try {
            const saved = localStorage.getItem("overlay_playground_setup");
            const existing = saved ? JSON.parse(saved) : {};
            const updated = {
                ...existing,
                timerText,
                timerIsRunning,
                scoreHome,
                scoreAway,
                nameHome,
                nameAway,
                headerText,
                logoHome,
                logoAway,
                logoTournament,
                addTimeText,
                homeScorer,
                awayScorer,
                blocks
            };
            localStorage.setItem("overlay_playground_setup", JSON.stringify(updated));
        } catch (_e) { }
    }, [timerText, timerIsRunning, scoreHome, scoreAway, nameHome, nameAway, headerText, logoHome, logoAway, logoTournament, addTimeText, homeScorer, awayScorer, blocks]);

    // Save on focusout
    useEffect(() => {
        if (!active) return;

        const handleFocusOut = (e: FocusEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true')) {
                if (isDirty && !saving) {
                    saveTemplate(false);
                }
            }
        };

        window.addEventListener('focusout', handleFocusOut);
        return () => window.removeEventListener('focusout', handleFocusOut);
    }, [active, isDirty, saving, saveTemplate]);

    const toggleBlock = (index: number) => {
        const updated = [...blocks];
        updated[index] = { ...updated[index], active: !updated[index].active };
        setBlocks(updated);
    };

    const updateCoordinates = (id: string, x: number, y: number) => {
        const ids = id.split(",").filter(Boolean);
        if (ids.length === 0) return;
        if (ids.length === 1) {
            const idx = blocks.findIndex(b => b.id === ids[0]);
            if (idx === -1) return;
            const updated = [...blocks];
            updated[idx] = { ...updated[idx], x, y };
            setBlocks(updated);
        } else {
            const primary = blocks.find(b => b.id === ids[0]);
            if (!primary) return;
            const deltaX = x - primary.x;
            const deltaY = y - primary.y;
            setBlocks(prev => prev.map(b => ids.includes(b.id) ? { ...b, x: b.x + deltaX, y: b.y + deltaY } : b));
        }
    };

    const updateBlockProperty = (id: string, props: Partial<CanvasBlock>) => {
        const ids = id.split(",").filter(Boolean);
        if (ids.length === 0) return;
        setBlocks(prev => prev.map(b => ids.includes(b.id) ? { ...b, ...props } : b));
    };

    const primarySelectedId = (selectedBlockId || "").split(",")[0];
    const selectedBlock = blocks.find(b => b.id === primarySelectedId);

    const applyRadiiToAll = () => {
        if (!selectedBlock) return;
        const { rTL, rTR, rBL, rBR } = selectedBlock;
        setBlocks(prev => prev.map(b => ({ ...b, rTL, rTR, rBL, rBR })));
        toast({
            title: locale === 'th' ? "คัดลอกส่วนโค้งแล้ว" : "Radii applied to all blocks",
        });
    };

    const dict = locale === 'th' ? {
        desc: "คลิกเลือกและวางบล็อกส่วนประกอบในตำแหน่งที่ต้องการบนตารางกริดจำลองได้อย่างอิสระ",
        pos_spacing: "ตำแหน่ง",
        x_offset: "X",
        y_offset: "Y",
        width: "ความกว้าง",
        height: "ความสูง",
        opacity: "ความโปร่งใส",
        bg_color: "สีพื้นหลัง",
        stroke_width: "ขนาดเส้นขอบ (Stroke)",
        stroke_color: "สีเส้นขอบ (Stroke)",
        corner_radius: "ความโค้งมนของมุม",
        top_left: "บน-ซ้าย",
        top_right: "บน-ขวา",
        bottom_left: "ล่าง-ซ้าย",
        bottom_right: "ล่าง-ขวา",
        link_corners: "เชื่อมโยงมุมทุกด้าน",
        appearance: "การปรากฏและสไตล์",
        typography: "รูปแบบตัวอักษร",
        font_family: "แบบอักษร",
        font_size: "ขนาดตัวอักษร",
        font_color: "สีตัวอักษร",
        select_font: "เลือกรูปแบบอักษร",
        content: "เนื้อหา",
        team_names_mode: "โหมดชื่อทีม",
        abbr: "ชื่อย่อ",
        full_name: "ชื่อเต็มของทีม",
        team_color_bars: "แถบสีประจำทีม",
        home_team: "ทีมเหย้า",
        away_team: "ทีมเยือน",
        direction: "ทิศทาง",
        none: "ไม่มี",
        bar_color: "สีของแถบ",
        obs_settings: "การตั้งค่า OBS",
        obs_bg: "สีพื้นหลัง",
        canvas_type: "ประเภทของพื้นที่ทำงาน (Canvas)",
        main_canvas: "พื้นที่ทำงานหลัก (Main Canvas)",
        save_template_settings: "บันทึก",
        saving: "กำลังบันทึก...",
        delete_canvas: "ลบ Canvas นี้",
        left: "ซ้าย",
        center: "กลาง",
        right: "ขวา",
        top: "บน",
        bottom: "ล่าง",
    } : {
        desc: "Select a block and place it anywhere on the virtual grid. Build complex stacked layouts freely.",
        pos_spacing: "Position",
        x_offset: "X",
        y_offset: "Y",
        width: "Width",
        height: "Height",
        opacity: "Opacity",
        bg_color: "BG Color",
        stroke_width: "Stroke Width",
        stroke_color: "Stroke Color",
        corner_radius: "Corner Radius",
        top_left: "Top-Left",
        top_right: "Top-Right",
        bottom_left: "Bottom-Left",
        bottom_right: "Bottom-Right",
        link_corners: "Link Corners",
        appearance: "Appearance",
        typography: "Typography",
        font_family: "Font Family",
        font_size: "Font Size",
        font_color: "Font Color",
        select_font: "Select font",
        content: "Content",
        team_names_mode: "Team Names Mode",
        abbr: "Abbreviations",
        full_name: "Full Team Name",
        team_color_bars: "Team Color Bars",
        home_team: "Home Team",
        away_team: "Away Team",
        direction: "Direction",
        none: "None",
        bar_color: "Bar Color",
        obs_settings: "OBS Settings",
        obs_bg: "Background",
        canvas_type: "Canvas Type",
        main_canvas: "Main Canvas",
        save_template_settings: "Save",
        saving: "Saving...",
        delete_canvas: "Delete Canvas",
        left: "Left",
        center: "Center",
        right: "Right",
        top: "Top",
        bottom: "Bottom",
    };

    const getBlockName = (id: string, name: string) => {
        if (locale === 'th') {
            switch (id) {
                case "header-text": return "ชื่อรายการแข่งขัน";
                case "logo-tournament": return "โลโก้รายการแข่งขัน";
                case "logo-home": return "โลโก้ทีมเหย้า";
                case "name-home": return "ชื่อ/ตัวย่อทีมเหย้า";
                case "score-home": return "กล่องคะแนนทีมเหย้า";
                case "score-away": return "กล่องคะแนนทีมเยือน";
                case "name-away": return "ชื่อ/ตัวย่อทีมเยือน";
                case "logo-away": return "โลโก้ทีมเยือน";
                case "timer": return "เวลาและนาฬิกาการแข่งขัน";
                case "add-time": return "ทดเวลาบาดเจ็บ";
                case "timeline-home": return "ไทม์ไลน์ผู้ทำประตู (ทีมเหย้า)";
                case "timeline-away": return "ไทม์ไลน์ผู้ทำประตู (ทีมเยือน)";
                default:
                    if (name === "Rectangle" || name === "สี่เหลี่ยม") return "สี่เหลี่ยม";
                    if (name === "Circle" || name === "วงกลม") return "วงกลม";
                    if (name === "Triangle" || name === "สามเหลี่ยม") return "สามเหลี่ยม";
                    if (name === "Star" || name === "ดาว") return "ดาว";
                    if (name === "Text" || name === "ข้อความ") return "ข้อความ";
                    return name;
            }
        } else {
            switch (id) {
                case "header-text": return "Tournament Name";
                case "logo-tournament": return "Tournament Logo";
                case "logo-home": return "Home Logo";
                case "name-home": return "Home Team Name";
                case "score-home": return "Home Score Box";
                case "score-away": return "Away Score Box";
                case "name-away": return "Away Team Name";
                case "logo-away": return "Away Logo";
                case "timer": return "Match Clock / Timer";
                case "add-time": return "Added Time";
                case "timeline-home": return "Home Scorers Timeline";
                case "timeline-away": return "Away Scorers Timeline";
                default:
                    if (name === "Rectangle" || name === "สี่เหลี่ยม") return "Rectangle";
                    if (name === "Circle" || name === "วงกลม") return "Circle";
                    if (name === "Triangle" || name === "สามเหลี่ยม") return "Triangle";
                    if (name === "Star" || name === "ดาว") return "Star";
                    if (name === "Text" || name === "ข้อความ") return "Text";
                    return name;
            }
        }
    };

    const handleCanvasSwitch = (targetId: string) => {
        if (selectedCanvasId === "scoreboard") {
            mainCanvasSettingsRef.current = {
                bg, posX, posY, alertDuration, font,
                layout, size, showTimeline, scoreBg, teamNameMode, showLogos,
                headerText, homeBarDir, homeBarColor, awayBarDir, awayBarColor,
                blockGap, blockBg, rounded, blocks
            };
        } else {
            const activeId = selectedCanvasId.replace("blank-", "");
            setBlankCanvases(prev => prev.map(c => c.id === activeId ? {
                ...c,
                bg, posX, posY, alertDuration, font,
                layout, size, showTimeline, scoreBg, teamNameMode, showLogos,
                headerText, homeBarDir, homeBarColor, awayBarDir, awayBarColor,
                blockGap, blockBg, rounded, blocks: [...blocks]
            } : c));
        }

        if (targetId === "create_blank") {
            const name = window.prompt(locale === 'th' ? "ป้อนชื่อ Blank Canvas ใหม่:" : "Enter new Blank Canvas name:");
            if (name && name.trim()) {
                const newId = `${Date.now()}`;
                const newCanvas: BlankCanvas = {
                    id: newId,
                    name: name.trim(),
                    delay: 0,
                    bg: "transparent",
                    posX: "center",
                    posY: "top",
                    alertDuration: 6,
                    font: "inter",
                    layout: "top-bar",
                    size: "medium",
                    showTimeline: false,
                    scoreBg: "#ef4444",
                    teamNameMode: "abbr",
                    showLogos: true,
                    headerText: "",
                    homeBarDir: "none",
                    homeBarColor: "#10b981",
                    awayBarDir: "none",
                    awayBarColor: "#3b82f6",
                    blockGap: 8,
                    blockBg: "spaced",
                    rounded: "md",
                    blocks: []
                };
                setBlankCanvases(prev => [...prev, newCanvas]);
                setSelectedCanvasId(`blank-${newId}`);
                setBg("transparent");
                setPosX("center");
                setPosY("top");
                setAlertDuration(6);
                setFont("inter");
                setLayout("top-bar");
                setSize("medium");
                setShowTimeline(false);
                setScoreBg("#ef4444");
                setTeamNameMode("abbr");
                setShowLogos(true);
                setHeaderText("");
                setHomeBarDir("none");
                setHomeBarColor("#10b981");
                setAwayBarDir("none");
                setAwayBarColor("#3b82f6");
                setBlockGap(8);
                setBlockBg("spaced");
                setRounded("md");
                setBlocks(DEFAULT_BLOCKS.map(b => ({ ...b, active: false })));
            }
            return;
        }

        setSelectedCanvasId(targetId);

        if (targetId === "scoreboard") {
            const s = mainCanvasSettingsRef.current;
            setBg(s.bg);
            setPosX(s.posX);
            setPosY(s.posY);
            setAlertDuration(s.alertDuration);
            setFont(s.font);
            setLayout(s.layout);
            setSize(s.size);
            setShowTimeline(s.showTimeline);
            setScoreBg(s.scoreBg);
            setTeamNameMode(s.teamNameMode);
            setShowLogos(s.showLogos);
            setHeaderText(s.headerText);
            setHomeBarDir(s.homeBarDir);
            setHomeBarColor(s.homeBarColor);
            setAwayBarDir(s.awayBarDir);
            setAwayBarColor(s.awayBarColor);
            setBlockGap(s.blockGap);
            setBlockBg(s.blockBg);
            setRounded(s.rounded);
            setBlocks(s.blocks || DEFAULT_BLOCKS);
        } else {
            const activeCanvas = blankCanvases.find(c => `blank-${c.id}` === targetId);
            if (activeCanvas) {
                setBg(activeCanvas.bg || "transparent");
                setPosX(activeCanvas.posX || "center");
                setPosY(activeCanvas.posY || "top");
                setAlertDuration(activeCanvas.alertDuration || 6);
                setFont(activeCanvas.font || "inter");
                setLayout(activeCanvas.layout || "top-bar");
                setSize(activeCanvas.size || "medium");
                setShowTimeline(activeCanvas.showTimeline ?? false);
                setScoreBg(activeCanvas.scoreBg || "#ef4444");
                setTeamNameMode(activeCanvas.teamNameMode || "abbr");
                setShowLogos(activeCanvas.showLogos ?? true);
                setHeaderText(activeCanvas.headerText || "");
                setHomeBarDir(activeCanvas.homeBarDir || "none");
                setHomeBarColor(activeCanvas.homeBarColor || "#10b981");
                setAwayBarDir(activeCanvas.awayBarDir || "none");
                setAwayBarColor(activeCanvas.awayBarColor || "#3b82f6");
                setBlockGap(activeCanvas.blockGap ?? 0);
                setBlockBg(activeCanvas.blockBg || "spaced");
                setRounded(activeCanvas.rounded || "md");
                setBlocks(activeCanvas.blocks || []);
            }
        }
    };

    // Generate OBS URLs
    const activeBlocksString = blocks
        .filter(b => b.active)
        .map(b => b.id)
        .join(",");

    const positionsString = blocks
        .filter(b => b.active)
        .map(b => [
            b.id,
            b.x,
            b.y,
            b.w,
            b.h,
            b.fontSize,
            b.rTL,
            b.rTR,
            b.rBL,
            b.rBR,
            b.opacity ?? 100,
            encodeURIComponent(b.bg ?? (b.id.startsWith("score") ? scoreBg : "#737373")),
            (b.color ?? "#ffffff").replace("#", ""),
            b.shapeType || "rectangle",
            encodeURIComponent(b.text || ""),
            b.bindTo || "none",
            b.strokeWidth ?? 0,
            (b.strokeColor ?? "#ffffff").replace("#", ""),
            b.strokePos || "inside",
            b.skewX ?? 0,
            b.skewY ?? 0,
            b.fontWeight ?? "400",
            b.fontStyle || "normal",
            b.textDecoration || "none"
        ].join(":"))
        .join(";");

    const scoreboardParams = new URLSearchParams({
        layout,
        bg,
        size,
        timeline: String(showTimeline),
        font,
        scoreBg,
        teamNameMode,
        showLogos: String(showLogos),
        headerText,
        posX,
        posY,
        alertDuration: String(alertDuration),
        blocks: activeBlocksString,
        positions: positionsString,
        orientation,
        blockGap: String(blockGap),
        blockBg,
        rounded,
        homeBarDir,
        homeBarColor,
        awayBarDir,
        awayBarColor,
        delay: String(delay)
    });

    const origin = typeof window !== "undefined" ? window.location.origin : "";

    let scoreboardUrl = "";
    let blankUrl = "";

    const activeBlankCanvas = blankCanvases.find(c => `blank-${c.id}` === selectedCanvasId) || blankCanvases[0];
    const activeBlankDelay = activeBlankCanvas?.delay ?? 0;

    const blankParamsObj: Record<string, string> = {
        bg,
        posX,
        posY,
        alertDuration: String(alertDuration),
        delay: String(activeBlankDelay),
    };

    blankParamsObj.layout = layout;
    blankParamsObj.size = size;
    blankParamsObj.timeline = String(showTimeline);
    blankParamsObj.font = font;
    blankParamsObj.scoreBg = scoreBg;
    blankParamsObj.teamNameMode = teamNameMode;
    blankParamsObj.showLogos = String(showLogos);
    blankParamsObj.headerText = headerText;
    blankParamsObj.blocks = activeBlocksString;
    blankParamsObj.positions = positionsString;
    blankParamsObj.orientation = orientation;
    blankParamsObj.blockGap = String(blockGap);
    blankParamsObj.blockBg = blockBg;
    blankParamsObj.rounded = rounded;
    blankParamsObj.homeBarDir = homeBarDir;
    blankParamsObj.homeBarColor = homeBarColor;
    blankParamsObj.awayBarDir = awayBarDir;
    blankParamsObj.awayBarColor = awayBarColor;

    const blankParams = new URLSearchParams(blankParamsObj);

    if (tournamentId && matchId) {
        scoreboardUrl = `${origin}/${locale}/tournaments/${tournamentId}/matches/${matchId}/overlay?${scoreboardParams.toString()}`;
        blankUrl = `${origin}/${locale}/tournaments/${tournamentId}/matches/${matchId}/overlay?${blankParams.toString()}`;
    } else {
        const standaloneConfig = {
            blocks, scoreBg, headerText, nameHome, nameAway,
            homeBarDir, homeBarColor, awayBarDir, awayBarColor,
            font, posX, posY, bg, blockGap, selectedBlockId, orientation, delay, rounded, sport: selectedSport,
            scoreHome, scoreAway, timerText, timerIsRunning, addTimeText, homeScorer, awayScorer
        };
        const configJson = encodeURIComponent(JSON.stringify(standaloneConfig));
        scoreboardUrl = `${origin}/${locale}/overlay/render?config=${configJson}&${scoreboardParams.toString()}`;
        blankUrl = `${origin}/${locale}/overlay/render?config=${configJson}&${blankParams.toString()}`;
    }

    const handleCopy = (url: string, type: "scoreboard" | "blank") => {
        navigator.clipboard.writeText(url);
        if (type === "scoreboard") {
            setCopiedScoreboard(true);
            setTimeout(() => setCopiedScoreboard(false), 2000);
        } else {
            setCopiedBlank(true);
            setTimeout(() => setCopiedBlank(false), 2000);
        }
        toast({
            title: locale === 'th' ? "คัดลอกสำเร็จ!" : "Copied successfully!",
            description: locale === 'th' ? "นำ URL ไปวางใน Browser Source ของ OBS ได้ทันที" : "Paste this URL as a Browser Source in OBS or vMix.",
        });
    };

    const getShortPreviewLabel = (id: string) => {
        switch (id) {
            case "header-text": return headerText || "Tournament Name";
            case "logo-tournament": return "Tour. Logo";
            case "logo-home": return "Home logo";
            case "logo-away": return "Away logo";
            case "name-home": return nameHome || "Home name";
            case "name-away": return nameAway || "Away name";
            case "score-home": return scoreHome || "0";
            case "score-away": return scoreAway || "0";
            case "timer": return timerText || "00:00";
            case "add-time": return addTimeText || "+0";
            case "timeline-home": return "Home Goals";
            case "timeline-away": return "Away Goals";
            case "substitution": return "Sub: In ⇄ Out";
            default: return id;
        }
    };

    // Goal Scorer Handlers for Football / Futsal
    const addHomeGoal = () => {
        const current = parseInt(scoreHome) || 0;
        setScoreHome(String(current + 1));
        if (homeScorerInput.trim()) {
            setHomeScorer(prev => prev ? `${prev}, ${homeScorerInput.trim()}` : homeScorerInput.trim());
            setHomeScorerInput("");
        }
    };

    const addAwayGoal = () => {
        const current = parseInt(scoreAway) || 0;
        setScoreAway(String(current + 1));
        if (awayScorerInput.trim()) {
            setAwayScorer(prev => prev ? `${prev}, ${awayScorerInput.trim()}` : awayScorerInput.trim());
            setAwayScorerInput("");
        }
    };

    const renderStandaloneNavbar = () => {
        if (!standalone) return null;

        return (
            <header className="w-full h-14 border-b backdrop-blur supports-[backdrop-filter]:bg-background/60 bg-background/80 px-4 flex items-center justify-between shrink-0 sticky top-0 z-50 print:hidden">
                {/* Left: Previous / Home Button & Title */}
                <div className="flex items-center gap-1 lg:gap-2">
                    {step === "setup" ? (
                        <Button variant="ghost" asChild className="w-8 lg:w-10">
                            <Link href="/">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                                if (step === "editor") setStep("setup");
                                if (step === "console") setStep("editor");
                            }}
                            className="w-8 lg:w-10"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )}

                    <div className="flex items-center gap-2">
                        <span className="font-black text-sm lg:text-base tracking-tight hidden lg:inline-block">
                            Tourni Broadcast
                        </span>
                    </div>
                </div>

                {/* Center: Step Progress Navigation Badges */}
                <div className="flex items-center gap-1 sm:gap-2">
                    <button
                        type="button"
                        onClick={() => setStep("setup")}
                        className={`flex items-center gap-1 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-sm text-xs font-bold transition-all ${step === "setup"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted/80"
                            }`}
                    >
                        <span className="h-4 w-4 rounded-full bg-background/20 flex items-center justify-center text-xs font-black">1</span>
                        <span className="hidden sm:inline">{locale === 'th' ? "ตั้งค่าทีม" : "Setup"}</span>
                    </button>

                    <span className="text-muted-foreground text-xs font-bold"><ChevronRight className="h-4 w-4 sm:h-4 sm:w-4" /></span>

                    <button
                        type="button"
                        onClick={() => setStep("editor")}
                        className={`flex items-center gap-1 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-sm text-xs font-bold transition-all ${step === "editor"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted/80"
                            }`}
                    >
                        <span className="h-4 w-4 rounded-full bg-background/20 flex items-center justify-center text-xs font-black">2</span>
                        <span className="hidden sm:inline">{locale === 'th' ? "ออกแบบ" : "Design"}</span>
                    </button>

                    <span className="text-muted-foreground text-xs font-bold"><ChevronRight className="h-4 w-4 sm:h-4 sm:w-4" /></span>

                    <button
                        type="button"
                        onClick={() => setStep("console")}
                        className={`flex items-center gap-1 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-sm text-xs font-bold transition-all ${step === "console"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted/80"
                            }`}
                    >
                        <span className="h-4 w-4 rounded-full bg-background/20 flex items-center justify-center text-xs font-black">3</span>
                        <span className="hidden sm:inline">{locale === 'th' ? "จดคะแนนสด" : "Live Score"}</span>
                    </button>
                </div>

                {/* Right: Next / Open OBS Action Button */}
                <div className="flex items-center gap-2">
                    {step === "setup" && (
                        <Button
                            type="button"
                            onClick={() => {
                                saveTemplate(false);
                                setStep("editor");
                            }}
                        >
                            <span className="hidden sm:inline">{locale === 'th' ? "ถัดไป" : "Next"}</span>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    )}

                    {step === "editor" && (
                        <Button
                            type="button"
                            onClick={() => {
                                saveTemplate(false);
                                setStep("console");
                            }}
                        >
                            <span className="hidden sm:inline">{locale === 'th' ? "ถัดไป" : "Next"}</span>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    )}

                    {step === "console" && (
                        <Button
                            asChild
                            variant="outline"
                            className="text-primary hover:bg-primary/10"
                        >
                            <a href={scoreboardUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                                <span className="hidden sm:inline">{locale === 'th' ? "เปิดดู OBS" : "Open OBS"}</span>
                            </a>
                        </Button>
                    )}
                </div>
            </header>
        );
    };

    // Step 1: Initial Setup Form Wizard
    if (standalone && step === "setup") {
        return (
            <div className="flex flex-col h-full w-full min-h-0 overflow-hidden">
                {renderStandaloneNavbar()}
                <div className="flex-1 flex flex-col p-2 lg:p-4 overflow-hidden min-h-0">
                    <div className="w-full h-full bg-card border rounded-sm shadow-sm flex flex-col min-h-0 overflow-hidden">
                        {/* Setup Title Header */}
                        <div className="p-4 border-b shrink-0 flex flex-col gap-1">
                            <Header level={2}>
                                {locale === 'th' ? "ตั้งค่าข้อมูลแมตช์ & ทีม" : "Broadcast & Match Setup"}
                            </Header>
                            <p className="text-xs text-muted-foreground mt-1">
                                {locale === 'th' ? "กรอกชื่อทีม อัปโหลดโลโก้ และเลือกประเภทกีฬาก่อนเข้าสู่กระดานออกแบบป้ายคะแนน" : "Enter team names, upload logos, and select a sport before entering the broadcast editor."}
                            </p>
                        </div>

                        {/* Scrollable Form Body */}
                        <div className="flex-1 p-2 lg:p-4 overflow-y-auto min-h-0">
                            <div className="max-w-6xl mx-auto space-y-2 lg:space-y-4">

                                {/* Section 1: Sport Selection */}
                                <div className="space-y-1 lg:space-y-2 border rounded-sm p-2 lg:p-4">
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-black">1</span>
                                        <Header level={5} >
                                            {locale === 'th' ? "เลือกประเภทกีฬา" : "Select Sport"}
                                        </Header>
                                    </div>

                                    <div className="grid grid-cols-2 gap-1 lg:gap-2 max-w-sm">
                                        {SPORTS_OPTIONS.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => setSelectedSport(item.id)}
                                                className={`flex items-center justify-center p-4 rounded-sm border text-xs font-bold transition-all gap-2.5 ${selectedSport === item.id
                                                    ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30"
                                                    : "border-border hover:bg-muted/60 text-foreground bg-card"
                                                    }`}
                                            >
                                                <span className="text-xl">{item.icon}</span>
                                                <span className="truncate font-black">{item.name.split(" ")[0]}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Section 2: Tournament Info */}
                                <div className="space-y-1 lg:space-y-2 border rounded-sm p-2 lg:p-4">
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-black">2</span>
                                        <Header level={5}>
                                            {locale === 'th' ? "ข้อมูลรายการแข่งขัน" : "Tournament Info"}
                                        </Header>
                                    </div>

                                    <div className="grid lg:grid-cols-12 gap-1 lg:gap-2 items-start">
                                        <div className="lg:col-span-8 space-y-1">
                                            <Label>{locale === 'th' ? "ชื่อรายการแข่งขัน / ข้อความส่วนหัว" : "Tournament Name / Header Text"}</Label>
                                            <Input
                                                value={headerText}
                                                onChange={(e) => setHeaderText(e.target.value)}
                                                placeholder="TOURNI CHAMPIONSHIP 2026"
                                                className="h-10 text-xs font-bold"
                                            />
                                            <p className="text-[11px] text-muted-foreground">
                                                {locale === 'th' ? "ข้อความนี้จะแสดงบนแถบ Tournament Banner หรือส่วนหัวของป้ายคะแนน" : "Displayed on tournament banners and header blocks."}
                                            </p>
                                        </div>

                                        <div className="lg:col-span-4 space-y-1">
                                            <Label>{locale === 'th' ? "โลโก้รายการแข่งขัน" : "Tournament Logo"}</Label>
                                            <LogoUploader
                                                id="logo-tournament"
                                                initialUrl={logoTournament || null}
                                                onFileChange={(file) => {
                                                    if (file) handleLogoUpload(file, setLogoTournament);
                                                    else setLogoTournament("");
                                                }}
                                                onRemove={() => setLogoTournament("")}
                                                uploadLabel={locale === 'th' ? "อัปโหลดโลโก้รายการ" : "Upload Tournament Logo"}
                                                clickToUploadLabel={locale === 'th' ? "คลิกอัปโหลด" : "Click to upload"}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Home & Away Teams */}
                                <div className="space-y-1 lg:space-y-2 border rounded-sm p-2 lg:p-4">
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-black">3</span>
                                        <Header level={5}>
                                            {locale === 'th' ? "รายละเอียดทีมเหย้า & ทีมเยือน" : "Home & Away Teams"}
                                        </Header>
                                    </div>

                                    <div className="grid lg:grid-cols-2 gap-1 lg:gap-2">
                                        {/* Home Team Card */}
                                        <div className="border rounded-sm p-1 lg:p-2 space-y-1 lg:space-y-2">
                                            <div className="flex items-center justify-between border-b pb-2">
                                                <h3 className="font-black text-xs lg:text-sm text-primary flex items-center gap-2">
                                                    <Shield className="h-4 w-4" />
                                                    {locale === 'th' ? "ทีมเหย้า" : "Home Team"}
                                                </h3>
                                            </div>

                                            <div className="space-y-1">
                                                <Label>{locale === 'th' ? "ชื่อทีมเหย้า / ชื่อย่อ" : "Team Name / Abbr"}</Label>
                                                <Input
                                                    value={nameHome}
                                                    onChange={(e) => setNameHome(e.target.value)}
                                                    placeholder="TEAM ALPHA"
                                                    className="h-10 text-xs font-bold"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <Label>{locale === 'th' ? "โลโก้ทีมเหย้า" : "Home Team Logo"}</Label>
                                                <LogoUploader
                                                    id="logo-home"
                                                    initialUrl={logoHome || null}
                                                    onFileChange={(file) => {
                                                        if (file) handleLogoUpload(file, setLogoHome);
                                                        else setLogoHome("");
                                                    }}
                                                    onRemove={() => setLogoHome("")}
                                                    uploadLabel={locale === 'th' ? "อัปโหลดโลโก้ทีมเหย้า" : "Upload Home Logo"}
                                                    clickToUploadLabel={locale === 'th' ? "คลิกอัปโหลด" : "Click to upload"}
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <Label>{locale === 'th' ? "สีประจำทีมเหย้า" : "Home Team Color"}</Label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="color"
                                                        value={homeBarColor}
                                                        onChange={(e) => setHomeBarColor(e.target.value)}
                                                        className="w-10 h-10 cursor-pointer shrink-0 rounded-sm border"
                                                    />
                                                    <Input
                                                        type="text"
                                                        value={homeBarColor}
                                                        onChange={(e) => setHomeBarColor(e.target.value)}
                                                        className="h-10 text-xs font-mono font-bold"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Away Team Card */}
                                        <div className="border rounded-sm p-1 lg:p-2 space-y-1 lg:space-y-2">
                                            <div className="flex items-center justify-between border-b pb-2.5">
                                                <h3 className="font-black text-xs lg:text-sm text-destructive flex items-center gap-2">
                                                    <Shield className="h-4 w-4" />
                                                    {locale === 'th' ? "ทีมเยือน" : "Away Team"}
                                                </h3>
                                            </div>

                                            <div className="space-y-1">
                                                <Label>{locale === 'th' ? "ชื่อทีมเยือน / ชื่อย่อ" : "Team Name / Abbr"}</Label>
                                                <Input
                                                    value={nameAway}
                                                    onChange={(e) => setNameAway(e.target.value)}
                                                    placeholder="TEAM BETA"
                                                    className="h-10 text-xs font-bold"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <Label>{locale === 'th' ? "โลโก้ทีมเยือน" : "Away Team Logo"}</Label>
                                                <LogoUploader
                                                    id="logo-away"
                                                    initialUrl={logoAway || null}
                                                    onFileChange={(file) => {
                                                        if (file) handleLogoUpload(file, setLogoAway);
                                                        else setLogoAway("");
                                                    }}
                                                    onRemove={() => setLogoAway("")}
                                                    uploadLabel={locale === 'th' ? "อัปโหลดโลโก้ทีมเยือน" : "Upload Away Logo"}
                                                    clickToUploadLabel={locale === 'th' ? "คลิกอัปโหลด" : "Click to upload"}
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <Label>{locale === 'th' ? "สีประจำทีมเยือน" : "Away Team Color"}</Label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="color"
                                                        value={awayBarColor}
                                                        onChange={(e) => setAwayBarColor(e.target.value)}
                                                        className="w-10 h-10 cursor-pointer shrink-0 rounded-sm border"
                                                    />
                                                    <Input
                                                        type="text"
                                                        value={awayBarColor}
                                                        onChange={(e) => setAwayBarColor(e.target.value)}
                                                        className="h-10 text-xs font-mono font-bold"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Action Button Footer */}
                        <div className="p-4 border-t shrink-0 flex items-center justify-end gap-3">
                            <Button
                                type="button"
                                onClick={() => {
                                    saveTemplate(false);
                                    setStep("editor");
                                }}
                            >
                                <span>{locale === 'th' ? "เข้าสู่กระดานปรับแต่ง Scoreboard" : "Enter Broadcast Editor"}</span>
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Step 3: Live Score Keeping Console
    if (standalone && step === "console") {
        return (
            <div className="flex flex-col h-full w-full min-h-0 bg-background overflow-hidden">
                {renderStandaloneNavbar()}
                <div className="flex-1 flex flex-col gap-4 p-2 lg:p-4 overflow-y-auto min-h-0">
                    {/* Header Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-card border rounded-sm p-3 shadow-sm shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{SPORTS_OPTIONS.find(s => s.id === selectedSport)?.icon}</span>
                            <div>
                                <div className="font-black text-sm lg:text-base flex items-center gap-2">
                                    <span>{nameHome || "HOME"}</span>
                                    <span className="text-primary font-black">
                                        {scoreHome} - {scoreAway}
                                    </span>
                                    <span>{nameAway || "AWAY"}</span>
                                </div>
                                <p className="text-xs text-muted-foreground font-semibold">
                                    {headerText || "TOURNI MATCH"} • {selectedSport.toUpperCase()}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStep("setup")}
                            >
                                <Settings className="h-4 w-4 text-primary" />
                                <span>{locale === 'th' ? "ตั้งค่าทีม" : "Setup"}</span>
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStep("editor")}
                            >
                                <LayoutGrid className="h-4 w-4 text-primary" />
                                <span>{locale === 'th' ? "แก้ไขดีไซน์" : "Design Editor"}</span>
                            </Button>
                            <Button
                                type="button"
                                onClick={() => handleCopy(scoreboardUrl, "scoreboard")}
                            >
                                <Copy className="h-4 w-4" />
                                <span>{copiedScoreboard ? (locale === 'th' ? "คัดลอกแล้ว!" : "Copied!") : (locale === 'th' ? "คัดลอกลิงก์ OBS" : "Copy OBS Link")}</span>
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                            >
                                <a href={scoreboardUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                    <span>{locale === 'th' ? "เปิดดู OBS" : "Open OBS"}</span>
                                </a>
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
                        {/* Left Column: Controls (Match Clock & Live Score Keeping) */}
                        <div className="lg:col-span-7 space-y-4">
                            {/* Match Timer Card (Dialog Style) */}
                            <div className="bg-card border rounded-sm shadow-sm overflow-hidden flex flex-col">
                                {/* Dialog Header Style */}
                                <div className="p-2 lg:p-4 border-b flex items-center justify-between bg-card/80">
                                    <Header level={5} className="font-black text-sm tracking-tight">
                                        {locale === 'th' ? "นาฬิกาและเวลาแข่งขัน (Match Clock)" : "Match Clock"}
                                    </Header>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${timerIsRunning ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 animate-pulse" : "bg-muted text-muted-foreground"}`}>
                                        {timerIsRunning ? (locale === 'th' ? "● กำลังเดินเวลา" : "● RUNNING") : (locale === 'th' ? "หยุดเวลา" : "STOPPED")}
                                    </span>
                                </div>

                                {/* Dialog Content Style */}
                                <div className="p-4 flex items-center justify-between gap-4">
                                    <div className="font-mono font-black text-4xl lg:text-5xl tracking-widest text-primary bg-muted/20 px-4 py-2 rounded-sm border">
                                        {timerText}
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Button
                                            type="button"
                                            size="lg"
                                            onClick={() => setTimerIsRunning(!timerIsRunning)}
                                            className={`${timerIsRunning ? "bg-warning hover:bg-warning/90" : "bg-primary hover:bg-primary/90"}`}
                                        >
                                            {timerIsRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                            <span>{timerIsRunning ? (locale === 'th' ? "หยุดเวลา" : "Pause") : (locale === 'th' ? "เริ่มเดินเวลา" : "Start")}</span>
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="lg"
                                            onClick={() => {
                                                setTimerIsRunning(false);
                                                setTimerText("00:00");
                                            }}
                                        >
                                            <RotateCcw className="h-4 w-4" />
                                            <span>Reset</span>
                                        </Button>
                                    </div>
                                </div>

                                {/* Dialog Footer Style */}
                                <div className="p-2 lg:p-4 border-t flex items-center gap-2 text-xs">
                                    <Header level={5}>{locale === 'th' ? "เพิ่มนาฬิกาด่วน:" : "Quick Add:"}</Header>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            const [m, s] = timerText.split(":").map(n => parseInt(n) || 0);
                                            setTimerText(`${String(m + 1).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
                                        }}
                                        className="h-7 text-xs font-bold border"
                                    >
                                        +1 Min
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            const [m, s] = timerText.split(":").map(n => parseInt(n) || 0);
                                            setTimerText(`${String(m + 5).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
                                        }}
                                        className="h-7 text-xs font-bold border"
                                    >
                                        +5 Min
                                    </Button>
                                    <div className="ml-auto flex items-center gap-1.5">
                                        <Header level={5}>{locale === 'th' ? "ทดเวลา:" : "Injury Time:"}</Header>
                                        <Input
                                            value={addTimeText}
                                            onChange={(e) => setAddTimeText(e.target.value)}
                                            className="w-16 h-7 text-xs font-bold text-center"
                                            placeholder="+0"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Live Score Keeping Cards */}
                            <div className="grid lg:grid-cols-2 gap-2 lg:gap-4">
                                {/* Home Team Live Score Control */}
                                <div className="bg-card border rounded-sm p-2 lg:p-4 space-y-1 lg:space-y-2 shadow-sm">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <div className="flex items-center gap-2">
                                            {logoHome && (
                                                 
                                                <img src={logoHome} alt="" className="h-4 w-4 object-contain" />
                                            )}
                                            <span className="font-black text-sm text-primary truncate max-w-[140px]">
                                                {nameHome || "HOME"}
                                            </span>
                                        </div>
                                        <Header level={2} className="text-primary">
                                            {scoreHome}
                                        </Header>
                                    </div>

                                    {/* Main Score Buttons */}
                                    <div className="flex items-center gap-1 lg:gap-2">
                                        <Button
                                            type="button"
                                            size="lg"
                                            onClick={addHomeGoal}
                                            className="flex-1"
                                        >
                                            <Plus className="h-4 w-4" />
                                            <span>{locale === 'th' ? "+1 ได้ประตู / แต้ม" : "+1 Goal / Point"}</span>
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="lg"
                                            onClick={() => {
                                                const current = parseInt(scoreHome) || 0;
                                                setScoreHome(String(Math.max(0, current - 1)));
                                            }}
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Football Scorer Input (Optional) */}
                                    {(selectedSport === "football" || selectedSport === "futsal") && (
                                        <div className="space-y-1 pt-2 border-t">
                                            <Label>
                                                {locale === 'th' ? "ระบุชื่อคนทำประตู (Optional Scorer):" : "Goal Scorer (Optional):"}
                                            </Label>
                                            <div className="flex items-center gap-1.5">
                                                <Input
                                                    value={homeScorerInput}
                                                    onChange={(e) => setHomeScorerInput(e.target.value)}
                                                    placeholder="Somchai (12')"
                                                    className="h-8 text-xs font-semibold"
                                                />
                                                <Button
                                                    type="button"
                                                    onClick={addHomeGoal}
                                                    className="shrink-0 bg-primary/10 text-primary hover:bg-primary/30"
                                                >
                                                    + ยิงประตู
                                                </Button>
                                            </div>

                                            {homeScorer && (
                                                <div className="text-xs font-semibold text-muted-foreground p-1 lg:p-2 rounded-sm border flex items-center justify-between gap-1">
                                                    <span className="truncate">👟 {homeScorer}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setHomeScorer("")}
                                                        className="text-destructive hover:underline text-[10px] shrink-0 font-bold"
                                                    >
                                                        ล้าง
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Away Team Live Score Control */}
                                <div className="bg-card border rounded-sm p-2 lg:p-4 space-y-1 lg:space-y-2 shadow-sm">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <div className="flex items-center gap-2">
                                            {logoAway && (
                                                 
                                                <img src={logoAway} alt="" className="h-4 w-4 object-contain" />
                                            )}
                                            <span className="font-black text-sm text-destructive truncate max-w-[140px]">
                                                {nameAway || "AWAY"}
                                            </span>
                                        </div>
                                        <Header level={2} className="text-destructive">
                                            {scoreAway}
                                        </Header>
                                    </div>

                                    {/* Main Score Buttons */}
                                    <div className="flex items-center gap-1 lg:gap-2">
                                        <Button
                                            type="button"
                                            size="lg"
                                            variant="destructive"
                                            onClick={addAwayGoal}
                                            className="flex-1"
                                        >
                                            <Plus className="h-4 w-4" />
                                            <span>{locale === 'th' ? "+1 ได้ประตู / แต้ม" : "+1 Goal / Point"}</span>
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="lg"
                                            onClick={() => {
                                                const current = parseInt(scoreAway) || 0;
                                                setScoreAway(String(Math.max(0, current - 1)));
                                            }}
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Football Scorer Input (Optional) */}
                                    {(selectedSport === "football" || selectedSport === "futsal") && (
                                        <div className="space-y-1 pt-2 border-t">
                                            <Label>
                                                {locale === 'th' ? "ระบุชื่อคนทำประตู (Optional Scorer):" : "Goal Scorer (Optional):"}
                                            </Label>
                                            <div className="flex items-center gap-1.5">
                                                <Input
                                                    value={awayScorerInput}
                                                    onChange={(e) => setAwayScorerInput(e.target.value)}
                                                    placeholder="John (45')"
                                                    className="h-8 text-xs font-semibold"
                                                />
                                                <Button
                                                    type="button"
                                                    onClick={addAwayGoal}
                                                    className="shrink-0 bg-destructive/10 text-destructive hover:bg-destructive/30"
                                                >
                                                    + ยิงประตู
                                                </Button>
                                            </div>

                                            {awayScorer && (
                                                <div className="text-xs font-semibold text-muted-foreground p-1 lg:p-2 rounded-sm border flex items-center justify-between gap-1">
                                                    <span className="truncate">👟 {awayScorer}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAwayScorer("")}
                                                        className="text-destructive hover:underline text-[10px] shrink-0 font-bold"
                                                    >
                                                        ล้าง
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Live Mini Canvas Preview (Dialog Style & 2-Language) */}
                        <div className="lg:col-span-5 flex flex-col min-h-0">
                            <div className="bg-card border rounded-sm shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                                {/* Dialog Header Style */}
                                <div className="p-2 lg:p-4 border-b flex items-center justify-between bg-card/80 shrink-0">
                                    <Header level={5} className="font-black text-xs lg:text-sm tracking-tight">
                                        {locale === 'th' ? "ตัวอย่างป้ายคะแนนสด (Live Canvas Preview)" : "Live Canvas Preview"}
                                    </Header>
                                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-sm border border-emerald-500/20">
                                        {locale === 'th' ? "● ถ่ายทอดสด" : "● LIVE BROADCAST"}
                                    </span>
                                </div>

                                {/* Dialog Content Body Style */}
                                <div className="p-2 lg:p-4 flex-1 flex flex-col items-center justify-center min-h-[220px] bg-card/60 relative overflow-hidden">
                                    <CanvasPreview
                                        readOnly={true}
                                        bg={bg}
                                        blocks={blocks}
                                        selectedBlockId={selectedBlockId}
                                        setSelectedBlockId={setSelectedBlockId}
                                        scoreBg={scoreBg}
                                        font={font}
                                        homeBarDir={homeBarDir}
                                        homeBarColor={homeBarColor}
                                        awayBarDir={awayBarDir}
                                        awayBarColor={awayBarColor}
                                        headerText={headerText}
                                        nameHome={nameHome}
                                        nameAway={nameAway}
                                        logoHome={logoHome}
                                        logoAway={logoAway}
                                        logoTournament={logoTournament}
                                        scoreHome={scoreHome}
                                        scoreAway={scoreAway}
                                        timerText={timerText}
                                        addTimeText={addTimeText}
                                        homeScorer={homeScorer}
                                        awayScorer={awayScorer}
                                        blockGap={blockGap}
                                        locale={locale}
                                        toggleBlock={toggleBlock}
                                        getBlockName={getBlockName}
                                        getShortPreviewLabel={getShortPreviewLabel}
                                        onUpdateBlockPosition={updateCoordinates}
                                    />
                                </div>

                                {/* Dialog Footer Style */}
                                <div className="p-2 lg:p-4 border-t flex items-center justify-between text-xs text-muted-foreground shrink-0">
                                    <span className="font-semibold text-[11px]">
                                        {locale === 'th' ? "แสดงผลลัพธ์บนหน้าจอ OBS แบบเรียลไทม์" : "Real-time OBS output display"}
                                    </span>
                                    <span className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded-sm border font-bold">
                                        1920 x 1080 Full HD
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Step 2: Scoreboard Canvas Editor
    return (
        <div className="flex flex-col h-full w-full min-h-0 overflow-hidden">
            {standalone && renderStandaloneNavbar()}
            <div className="flex-1 flex flex-col gap-2 overflow-hidden min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 flex-1 min-h-0">
                    {/* Left Column: Layer Sidebar */}
                    <LayerSidebar
                        blocks={blocks}
                        setBlocks={setBlocks}
                        selectedBlockId={selectedBlockId}
                        setSelectedBlockId={setSelectedBlockId}
                        toggleBlock={toggleBlock}
                        getBlockName={getBlockName}
                        locale={locale}
                    />

                    {/* Center Column: Canvas Preview */}
                    <CanvasPreview
                        bg={bg}
                        blocks={blocks}
                        setBlocks={setBlocks}
                        selectedBlockId={selectedBlockId}
                        setSelectedBlockId={setSelectedBlockId}
                        scoreBg={scoreBg}
                        font={font}
                        homeBarDir={homeBarDir}
                        homeBarColor={homeBarColor}
                        awayBarDir={awayBarDir}
                        awayBarColor={awayBarColor}
                        headerText={headerText}
                        nameHome={nameHome}
                        nameAway={nameAway}
                        logoHome={logoHome}
                        logoAway={logoAway}
                        logoTournament={logoTournament}
                        scoreHome={scoreHome}
                        scoreAway={scoreAway}
                        timerText={timerText}
                        addTimeText={addTimeText}
                        homeScorer={homeScorer}
                        awayScorer={awayScorer}
                        blockGap={blockGap}
                        locale={locale}
                        toggleBlock={toggleBlock}
                        getBlockName={getBlockName}
                        getShortPreviewLabel={getShortPreviewLabel}
                        onUpdateBlockPosition={updateCoordinates}
                    />

                    {/* Right Column: Editor Sidebar */}
                    <EditorSidebar
                        blocks={blocks}
                        setBlocks={setBlocks}
                        selectedBlockId={selectedBlockId}
                        setSelectedBlockId={setSelectedBlockId}
                        selectedBlock={selectedBlock}
                        updateCoordinates={updateCoordinates}
                        updateBlockProperty={updateBlockProperty}
                        blockGap={blockGap}
                        setBlockGap={setBlockGap}
                        scoreBg={scoreBg}
                        applyRadiiToAll={applyRadiiToAll}
                        linkCorners={linkCorners}
                        setLinkCorners={setLinkCorners}
                        font={font}
                        setFont={setFont}
                        teamNameMode={teamNameMode}
                        setTeamNameMode={setTeamNameMode}
                        homeBarDir={homeBarDir}
                        setHomeBarDir={setHomeBarDir}
                        homeBarColor={homeBarColor}
                        setHomeBarColor={setHomeBarColor}
                        awayBarDir={awayBarDir}
                        setAwayBarDir={setAwayBarDir}
                        awayBarColor={awayBarColor}
                        setAwayBarColor={setAwayBarColor}
                        posX={posX}
                        setPosX={setPosX}
                        posY={posY}
                        setPosY={setPosY}
                        bg={bg}
                        setBg={setBg}
                        locale={locale}
                        dict={dict}
                        selectedCanvasId={selectedCanvasId}
                        activeBlankCanvas={activeBlankCanvas}
                        blankCanvases={blankCanvases}
                        setBlankCanvases={setBlankCanvases}
                        setSelectedCanvasId={setSelectedCanvasId}
                        handleCanvasSwitch={handleCanvasSwitch}
                        scoreboardUrl={scoreboardUrl}
                        blankUrl={blankUrl}
                        copiedScoreboard={copiedScoreboard}
                        copiedBlank={copiedBlank}
                        handleCopy={handleCopy}
                        saveTemplate={saveTemplate}
                        saving={saving}
                        sport={selectedSport}
                    />
                </div>
            </div>
        </div>
    );
}

export function BroadcastDialog({ open, onOpenChange, matchId, tournamentId, sport = "football" }: BroadcastDialogProps) {
    const t = useTranslations("Console");
    const locale = useLocale();

    const desc = locale === 'th'
        ? "คลิกเลือกและวางบล็อกส่วนประกอบในตำแหน่งที่ต้องการบนตารางกริดจำลองได้อย่างอิสระ"
        : "Select a block and place it anywhere on the virtual grid. Build complex stacked layouts freely.";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="bg-card rounded-sm border overflow-hidden min-w-[80vw] max-w-[96vw] h-[92vh] max-h-[96vh] flex flex-col p-0">
                <DialogHeader className="relative pr-10 p-2 lg:p-4 border-b shrink-0">
                    <DialogTitle>{t("board_editor")}</DialogTitle>
                    <DialogDescription>{desc}</DialogDescription>
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

                <div className="flex-1 overflow-hidden min-h-0 p-2 lg:p-4">
                    <BroadcastEditor
                        matchId={matchId}
                        tournamentId={tournamentId}
                        sport={sport}
                        active={open}
                        standalone={false}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
