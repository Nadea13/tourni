"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MatchEvent, EventType } from "@/types";
import { addMatchEvent, deleteMatchEvent, getMatchEvents } from "@/actions/tournaments/event";
import { ApiClient } from "@/lib/api-client";

export interface QueuedAction {
    id: string;
    type: "add_event" | "delete_event";
    matchId: string;
    teamId: string | null;
    eventType?: EventType;
    minute?: number;
    playerId?: string | null;
    extraInfo?: Record<string, unknown>;
    playerName?: string;
    eventId?: string;
    createdAt: number;
    status: "pending" | "syncing" | "failed";
    error?: string;
}

export function useMatchEvents(matchId: string, tournamentId: string, initialData?: MatchEvent[], isReadOnly?: boolean) {
    const [events, setEvents] = useState<MatchEvent[]>(() => {
        if (initialData && initialData.length > 0) return initialData;
        if (typeof window !== "undefined") {
            try {
                const cached = localStorage.getItem(`leagueflow-events-cache-${matchId}`);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) return parsed;
                }
            } catch (_) {}
        }
        return [];
    });

    const [isLoading, setIsLoading] = useState(!initialData && events.length === 0);
    const [queue, setQueue] = useState<QueuedAction[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const isSyncingRef = useRef(false);
    const queueRef = useRef<QueuedAction[]>([]);
    queueRef.current = queue;

    // Load queue & cached events from localStorage on mount/match change
    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedQueue = localStorage.getItem(`leagueflow-pending-events-${matchId}`);
            if (savedQueue) {
                try {
                    const parsed = JSON.parse(savedQueue);
                    if (Array.isArray(parsed)) {
                        setQueue(parsed);
                    }
                } catch (e) {
                    console.error("Failed to parse local event queue", e);
                }
            }

            const cachedEvents = localStorage.getItem(`leagueflow-events-cache-${matchId}`);
            if (cachedEvents) {
                try {
                    const parsed = JSON.parse(cachedEvents);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setEvents(parsed);
                    }
                } catch (_) {}
            }
        }
    }, [matchId]);

    // Save queue to localStorage helper
    const persistQueue = useCallback((newQueue: QueuedAction[]) => {
        setQueue(newQueue);
        if (typeof window !== "undefined") {
            localStorage.setItem(`leagueflow-pending-events-${matchId}`, JSON.stringify(newQueue));
        }
    }, [matchId]);

    // Save events to localStorage cache helper
    const persistEventsCache = useCallback((newEvents: MatchEvent[]) => {
        setEvents(newEvents);
        if (typeof window !== "undefined") {
            localStorage.setItem(`leagueflow-events-cache-${matchId}`, JSON.stringify(newEvents));
        }
    }, [matchId]);

    // Handle incoming realtime event from WebSocket
    const handleIncomingEvent = useCallback((incomingEvent: MatchEvent) => {
        setEvents((prev) => {
            const exists = prev.some((e) => e.id === incomingEvent.id);
            const updated = exists
                ? prev.map((e) => (e.id === incomingEvent.id ? incomingEvent : e))
                : [incomingEvent, ...prev];
            if (typeof window !== "undefined") {
                localStorage.setItem(`leagueflow-events-cache-${matchId}`, JSON.stringify(updated));
            }
            return updated;
        });

        // Clean matching pending action if any
        setQueue((prevQueue) => {
            const nextQueue = prevQueue.filter((a) => {
                if (a.type === "add_event" && a.eventType === incomingEvent.event_type && a.minute === incomingEvent.minute && (a.playerId ?? null) === (incomingEvent.player_id ?? null)) {
                    return false;
                }
                return true;
            });
            if (nextQueue.length !== prevQueue.length && typeof window !== "undefined") {
                localStorage.setItem(`leagueflow-pending-events-${matchId}`, JSON.stringify(nextQueue));
            }
            return nextQueue;
        });
    }, [matchId]);

    // Handle incoming realtime event deletion from WebSocket
    const handleIncomingDelete = useCallback((deletedEventId: string) => {
        setEvents((prev) => {
            const updated = prev.filter((e) => e.id !== deletedEventId);
            if (typeof window !== "undefined") {
                localStorage.setItem(`leagueflow-events-cache-${matchId}`, JSON.stringify(updated));
            }
            return updated;
        });

        setQueue((prevQueue) => {
            const nextQueue = prevQueue.filter((a) => a.eventId !== deletedEventId);
            if (nextQueue.length !== prevQueue.length && typeof window !== "undefined") {
                localStorage.setItem(`leagueflow-pending-events-${matchId}`, JSON.stringify(nextQueue));
            }
            return nextQueue;
        });
    }, [matchId]);

    // Load initial events from API
    useEffect(() => {
        let isMounted = true;

        const loadEvents = async () => {
            try {
                const res = await getMatchEvents(matchId);
                if (isMounted && res.success && res.data) {
                    persistEventsCache(res.data);
                }
            } catch (err) {
                console.error("Failed to load match events:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadEvents();

        let pollInterval: NodeJS.Timeout | null = null;
        if (isReadOnly) {
            pollInterval = setInterval(loadEvents, 5000);
        }

        return () => {
            isMounted = false;
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [matchId, isReadOnly, persistEventsCache]);

    // Sync function with lock
    const syncQueue = useCallback(async () => {
        if (isSyncingRef.current || isReadOnly) return;

        const currentQueue = queueRef.current;
        const pendingItems = currentQueue.filter(a => a.status === 'pending' || a.status === 'failed');

        if (pendingItems.length === 0) return;

        isSyncingRef.current = true;
        setIsSyncing(true);

        let workingQueue = [...currentQueue];

        for (const action of pendingItems) {
            workingQueue = workingQueue.map(q => q.id === action.id ? { ...q, status: 'syncing' as const } : q);
            persistQueue(workingQueue);

            try {
                let isSuccess = false;
                let errorMsg = "";

                if (action.type === 'add_event') {
                    // 1. Try Next.js Server Action
                    try {
                        const res = await addMatchEvent(matchId, action.teamId, action.eventType!, action.minute!, action.playerId ?? null, action.extraInfo!, tournamentId);
                        isSuccess = !!res.success;
                        if (!isSuccess) errorMsg = res.error || "Server action failed";
                    } catch (saErr: any) {
                        errorMsg = saErr?.message || "Server action network error";
                    }

                    // 2. Direct API Fallback using client JWT if Server Action encountered any error
                    if (!isSuccess) {
                        try {
                            const fallbackRes = await ApiClient.fetch<MatchEvent>(`/matches/${matchId}/events`, {
                                method: 'POST',
                                body: JSON.stringify({
                                    team_id: action.teamId,
                                    player_id: action.playerId,
                                    type: action.eventType,
                                    event_type: action.eventType,
                                    minute: action.minute,
                                    detail: action.extraInfo || {},
                                    extra_info: action.extraInfo || {}
                                })
                            });
                            if (fallbackRes && fallbackRes.id) {
                                isSuccess = true;
                                errorMsg = "";
                            }
                        } catch (fallbackErr: any) {
                            console.error("Direct API Fallback for add_event error:", fallbackErr);
                            errorMsg = fallbackErr?.message || errorMsg;
                        }
                    }
                } else if (action.type === 'delete_event') {
                    try {
                        const res = await deleteMatchEvent(action.eventId!, tournamentId, matchId);
                        isSuccess = !!res.success || (!!res.error && res.error.toLowerCase().includes("not found"));
                        if (!isSuccess) errorMsg = res.error || "Delete action failed";
                    } catch (delErr: any) {
                        errorMsg = delErr?.message || "Delete network error";
                    }

                    if (!isSuccess) {
                        try {
                            await ApiClient.fetch(`/matches/${matchId}/events/${action.eventId}`, {
                                method: 'DELETE'
                            });
                            isSuccess = true;
                            errorMsg = "";
                        } catch (fallbackErr: any) {
                            if (String(fallbackErr?.message || "").toLowerCase().includes("not found")) {
                                isSuccess = true;
                                errorMsg = "";
                            } else {
                                console.error("Direct API Fallback for delete_event error:", fallbackErr);
                                errorMsg = fallbackErr?.message || errorMsg;
                            }
                        }
                    }
                }

                if (isSuccess) {
                    workingQueue = workingQueue.filter(q => q.id !== action.id);
                    persistQueue(workingQueue);
                } else {
                    workingQueue = workingQueue.map(q => q.id === action.id ? { ...q, status: 'failed' as const, error: errorMsg } : q);
                    persistQueue(workingQueue);
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                workingQueue = workingQueue.map(q => q.id === action.id ? { ...q, status: 'failed' as const, error: errorMsg } : q);
                persistQueue(workingQueue);
            }
        }

        isSyncingRef.current = false;
        setIsSyncing(false);
    }, [matchId, tournamentId, isReadOnly, persistQueue]);

    // Auto-sync when window becomes online
    useEffect(() => {
        if (typeof window !== "undefined") {
            const handleOnline = () => {
                syncQueue();
            };
            window.addEventListener("online", handleOnline);
            return () => window.removeEventListener("online", handleOnline);
        }
    }, [syncQueue]);

    const addEvent = async (
        teamId: string | null,
        type: EventType,
        minute: number,
        playerId: string | null = null,
        extraInfo: Record<string, unknown> = {},
        playerName: string = "Unknown"
    ): Promise<{ success: boolean; error?: string }> => {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const finalPlayerName = playerName && playerName !== "Unknown" ? playerName : (extraInfo?.player_name as string) || "Unknown";
        const enrichedExtraInfo: Record<string, unknown> = {
            ...extraInfo,
            player_name: finalPlayerName !== "Unknown" ? finalPlayerName : undefined,
            player_id: playerId || undefined
        };

        const newAction: QueuedAction = {
            id: tempId,
            type: "add_event",
            matchId,
            teamId,
            eventType: type,
            minute,
            playerId,
            extraInfo: enrichedExtraInfo,
            playerName: finalPlayerName,
            createdAt: Date.now(),
            status: "pending"
        };

        const nextQueue = [...queueRef.current, newAction];
        persistQueue(nextQueue);

        setTimeout(() => {
            syncQueue();
        }, 50);

        return { success: true };
    };

    const deleteEvent = async (eventId: string): Promise<{ success: boolean; error?: string }> => {
        if (eventId.startsWith("temp-")) {
            const nextQueue = queueRef.current.filter(a => a.id !== eventId);
            persistQueue(nextQueue);
            return { success: true };
        }

        const newAction: QueuedAction = {
            id: `del-${eventId}-${Date.now()}`,
            type: "delete_event",
            matchId,
            teamId: null,
            eventId,
            createdAt: Date.now(),
            status: "pending"
        };

        const nextQueue = [...queueRef.current, newAction];
        persistQueue(nextQueue);

        setTimeout(() => {
            syncQueue();
        }, 50);

        return { success: true };
    };

    const combinedEvents = [...events];
    queue.forEach(action => {
        if (action.type === 'add_event') {
            const exists = events.some(e => e.id === action.id || 
                (e.event_type === action.eventType && e.minute === action.minute && (e.player_id ?? null) === (action.playerId ?? null) && e.team_id === action.teamId));
            if (!exists) {
                combinedEvents.push({
                    id: action.id,
                    match_id: action.matchId,
                    team_id: action.teamId,
                    event_type: action.eventType!,
                    minute: action.minute!,
                    player_id: action.playerId!,
                    extra_info: action.extraInfo!,
                    created_at: new Date(action.createdAt).toISOString(),
                    player_name: action.playerName!,
                    isPending: true
                } as MatchEvent & { isPending?: boolean });
            }
        }
    });

    const deletedIds = new Set(queue.filter(a => a.type === 'delete_event').map(a => a.eventId));
    const visibleEvents = combinedEvents
        .filter(e => !deletedIds.has(e.id))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
        events: visibleEvents,
        rawEvents: events,
        queue,
        isSyncing,
        syncQueue,
        addEvent,
        deleteEvent,
        handleIncomingEvent,
        handleIncomingDelete,
        isLoading
    };
}
