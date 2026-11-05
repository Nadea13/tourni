import { useState, useRef, useEffect } from "react";
import { Match, MatchEvent } from "@/types";

export function useMatchTimer(
    match: Match,
    tournamentId: string,
    events: MatchEvent[],
    delaySeconds: number = 0,
    isCountdown: boolean = false,
    defaultCountdownSeconds: number = 20 * 60
) {
    const getElapsedBase = (m?: Match) => {
        const val = m?.elapsed_before_pause ?? m?.elapsed_seconds;
        if (val !== undefined && val !== null) return val;
        return isCountdown ? defaultCountdownSeconds : 0;
    };

    // Initialize time with strict trust in elapsed_before_pause or elapsed_seconds
    const [time, setTime] = useState(() => {
        const base = getElapsedBase(match);
        if (isCountdown && (match.status === 'scheduled' || (!match.status && base === 0))) {
            return defaultCountdownSeconds;
        }
        return base;
    });
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
                if (isCountdown) {
                    setTime(prev => (prev > 0 && elapsedBase === 0 && match.status !== 'finished' ? prev : elapsedBase));
                } else {
                    setTime(prev => (prev > 0 && elapsedBase === 0 ? prev : elapsedBase));
                }
                return;
            }

            // 1. High precision local timer (running in active client)
            if (localStartRef.current) {
                const now = Date.now();
                const diffSeconds = Math.max(0, Math.floor((now - localStartRef.current) / 1000));
                const finalTime = isCountdown
                    ? Math.max(0, elapsedBase - diffSeconds)
                    : elapsedBase + diffSeconds;
                setTime(prev => prev !== finalTime ? finalTime : prev);
                if (isCountdown && finalTime <= 0) {
                    setIsRunning(false);
                }
                return;
            }

            // 2. Server sync: check updated_at timestamp from match update
            if (match?.updated_at && !isNaN(new Date(match.updated_at).getTime())) {
                const now = Date.now() - (delaySeconds * 1000);
                const updatedTime = new Date(match.updated_at).getTime();
                const diffSeconds = Math.max(0, Math.floor((now - updatedTime) / 1000));
                const finalTime = isCountdown
                    ? Math.max(0, elapsedBase - diffSeconds)
                    : elapsedBase + diffSeconds;
                setTime(prev => prev !== finalTime ? finalTime : prev);
                if (isCountdown && finalTime <= 0) {
                    setIsRunning(false);
                }
                return;
            }

            // 3. Fallback: marker events (first_half, second_half, extra_time)
            const markers = events.filter(e =>
                e.event_type === 'first_half' ||
                e.event_type === 'second_half' ||
                e.event_type === 'extra_time' ||
                e.event_type === 'extra_time_second_half' ||
                e.event_type === 'kick_off'
            );
            const latestMarker = markers.length > 0 
                ? [...markers].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                : null;

            if (latestMarker) {
                const now = Date.now() - (delaySeconds * 1000);
                const markerTimestamp = (latestMarker.extra_info?.start_timestamp as number) || new Date(latestMarker.created_at).getTime();
                const diffSeconds = Math.max(0, Math.floor((now - markerTimestamp) / 1000));
                const finalTime = isCountdown
                    ? Math.max(0, elapsedBase - diffSeconds)
                    : elapsedBase + diffSeconds;
                setTime(prev => prev !== finalTime ? finalTime : prev);
                if (isCountdown && finalTime <= 0) {
                    setIsRunning(false);
                }
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
