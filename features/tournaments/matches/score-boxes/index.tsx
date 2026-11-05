"use client";

import { MatchScoreBoxProps } from "./types";
import { FootballScoreBox } from "./football-score-box";
import { VolleyballScoreBox } from "./volleyball-score-box";

export function MatchScoreBox(props: MatchScoreBoxProps) {
    let scoreDetail = props.match?.score_detail as Record<string, unknown> | null | undefined;
    if (typeof scoreDetail === 'string') {
        try {
            scoreDetail = JSON.parse(scoreDetail);
        } catch (_) {}
    }
    const hasVolleyballEvents = props.events?.some(e => ['point', 'ace', 'spike', 'block', 'set_end', 'set_win'].includes(e.event_type || (e as any).type));
    const hasVolleyballDetail = Boolean(scoreDetail?.sets || scoreDetail?.set_scores || scoreDetail?.set_history);
    const isVolleyball = props.sport === "volleyball" || props.sport?.includes("volleyball") || props.sport?.includes("วอลเลย์บอล") || hasVolleyballEvents || hasVolleyballDetail;

    if (isVolleyball) {
        return <VolleyballScoreBox {...props} />;
    }

    return <FootballScoreBox {...props} />;
}

export type { MatchScoreBoxProps };
