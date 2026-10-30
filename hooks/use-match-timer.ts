import { useState, useRef, useEffect } from "react";
import { Match, MatchEvent } from "@/types";

export function useMatchTimer(match: Match, tournamentId: string, events: MatchEvent[], delaySeconds: number = 0) {
    const getElapsedBase = (m?: Match) => m?.elapsed_before_pause ?? m?.elapsed_seconds ?? 0;

    // Initialize time with strict trust in elapsed_before_pause or elapsed_seconds
    const [time, setTime] = useState(() => getElapsedBase(match));
    const [isRunning, setIsRunning] = useState(match.timer_status === 'playing');

    // Sync isRunning with server state
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsRunning(match.timer_status === 'playing');
        }, 0);
        return () => clearTimeout(timer);
    }, [match.timer_status]);

    const localStartRef = useRef<number | null>(null);
    const lastStatusRef = useRef<string>(match.timer_status || 'paused');

    // Timer calculation logic
    useEffect(() => {
        // When status changes to playing, record local start time for optimistic counting
        if (isRunning && (!localStartRef.current || lastStatusRef.current !== 'playing')) {
            localStartRef.current = Date.now();
        } else if (!isRunning) {
            localStartRef.current = null;
        }
        lastStatusRef.current = isRunning ? 'playing' : 'paused';

        const updateTimer = () => {
            const elapsedBase = getElapsedBase(match);

            if (!isRunning) {
                // When paused, don't overwrite a positive local time with 0 if match state hasn't updated yet
                setTime(prev => (prev > 0 && elapsedBase === 0 ? prev : elapsedBase));
                return;
            }

            // 1. Try to find the latest marker event (first_half, second_half, extra_time, kick_off or match_resumed)
            const markers = events.filter(e =>
                e.event_type === 'first_half' ||
                e.event_type === 'second_half' ||
                e.event_type === 'extra_time' ||
                e.event_type === 'extra_time_second_half' ||
                e.event_type === 'kick_off' ||
                e.event_type === 'match_resumed'
            );
            const latestMarker = markers.length > 0 
                ? [...markers].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                : null;

            if (latestMarker) {
                const now = Date.now() - (delaySeconds * 1000);
                const markerTimestamp = (latestMarker.extra_info?.start_timestamp as number) || new Date(latestMarker.created_at).getTime();
                const diffSeconds = Math.max(0, Math.floor((now - markerTimestamp) / 1000));
                const finalTime = elapsedBase + diffSeconds;
                
                setTime(prev => prev !== finalTime ? finalTime : prev);
            } else if (match?.updated_at && !isNaN(new Date(match.updated_at).getTime())) {
                const now = Date.now() - (delaySeconds * 1000);
                const updatedTime = new Date(match.updated_at).getTime();
                const diffSeconds = Math.max(0, Math.floor((now - updatedTime) / 1000));
                const finalTime = elapsedBase + diffSeconds;
                
                setTime(prev => prev !== finalTime ? finalTime : prev);
            } else if (localStartRef.current) {
                // 2. Fallback to local start time (optimistic UI)
                const now = Date.now();
                const diffSeconds = Math.max(0, Math.floor((now - localStartRef.current) / 1000));
                const finalTime = elapsedBase + diffSeconds;
                
                setTime(prev => prev !== finalTime ? finalTime : prev);
            }
        };

        // Initial update
        updateTimer();

        // 100ms interval for high-precision responsiveness, but updateTimer uses Date.now() so it's accurate
        const interval = setInterval(updateTimer, 100);
        return () => clearInterval(interval);
    }, [isRunning, match.id, match.elapsed_before_pause, match.elapsed_seconds, match.updated_at, events, delaySeconds]);

    return {
        time,
        setTime,
        isRunning,
        setIsRunning
    };
}
