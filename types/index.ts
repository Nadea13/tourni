import type { Edge, Node } from "@xyflow/react";

export type TournamentStatus = 'draft' | 'ongoing' | 'completed' | 'cancelled';
export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'canceled' | 'warmup' | 'first_half' | 'half_time' | 'second_half' | 'extra_time' | 'penalties' | 'completed' | 'cancelled' | 'postponed';
export type SportCategoryType = 'team' | 'racket' | 'individual' | 'dual' | 'combat' | 'esports';
export type SportType = 'football' | 'volleyball' | 'basketball' | 'futsal' | 'badminton' | 'tennis' | 'takraw' | 'cricket' | string;

export interface BracketCanvasData {
    nodes: Node[];
    edges: Edge[];
}

export interface Tournament {
    id: string;
    user_id: string;
    name: string;
    format: string;
    status: TournamentStatus;
    description?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    number_of_pitches?: number | null;
    max_teams?: number | null;
    advancing_teams?: number | null;
    is_registration_open: boolean;
    bank_name?: string | null;
    bank_account_name?: string | null;
    bank_account_number?: string | null;
    plan?: 'free' | 'tournament' | 'monthly' | 'yearly';
    payment_status?: string | null;
    payment_id?: string | null;
    payment_method?: string | null;
    sport: SportType;
    sport_name?: string;
    sport_id?: string | number;
    created_at: string;
    updated_at?: string;
    document_deadline?: string | null;
    canvas_data?: BracketCanvasData | null;
    logo_img?: string | null;
    cover_img?: string | null;
    logo_url?: string | null;
    banner_url?: string | null;
    location_name?: string | null;
    location?: string | null;
    google_map_url?: string | null;
    registration_fee?: number | null;
    settings?: Record<string, any> | null;
}

export interface TournamentStatusRequest {
    id: string;
    tournament_id: string;
    tournament_name?: string;
    sport_name?: string;
    current_status: TournamentStatus;
    target_status: TournamentStatus;
    reason?: string;
    requested_by: string;
    requested_by_email?: string;
    requested_by_name?: string;
    requested_at: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    reviewed_by?: string;
    reviewed_at?: string;
    reject_reason?: string;
}

export interface Match {
    id: string;
    tournament_id: string;
    category_id?: string | null;
    tournament_category_id?: string | null; // Alias
    home_team_id: string | null;
    away_team_id: string | null;
    home_score: number | { total?: number } | null;
    away_score: number | { total?: number } | null;
    score_detail?: Record<string, any> | null;
    round: number;
    stage: 'league' | 'group' | 'knockout' | 'round_of_64' | 'round_of_32' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'final' | string;
    winner_id?: string | null;
    is_manual: boolean;
    status: MatchStatus;
    scheduled_at?: string | null;
    match_date?: string | null;
    match_time?: string | null;
    venue?: string | null;
    venue_id?: string | null;
    field_name?: string | null;
    pitch_number?: number | null;
    idx_match?: number | null;
    match_index?: number | null; // Alias
    node_id?: string | null;
    next_node_id?: string | null;
    winner_to_node_id?: string | null; // Alias
    ph_home?: string | null;
    ph_away?: string | null;
    placeholder_home?: string | null; // Alias
    placeholder_away?: string | null; // Alias
    placeholder_a?: string | null;    // Alias
    placeholder_b?: string | null;    // Alias
    created_at: string;
    // Timer Fields
    timer_status?: 'playing' | 'paused' | 'stopped' | string;
    elapsed_seconds?: number;
    elapsed_before_pause?: number; // Alias
    minute?: number | string | null;
    current_minute?: number | string | null; // Alias
    home_team?: { id: string; name: string; logo_url?: string | null; description?: string | null; contact_name?: string | null; contact_phone?: string | null };
    away_team?: { id: string; name: string; logo_url?: string | null; description?: string | null; contact_name?: string | null; contact_phone?: string | null };
    // Penalty Shootout (joined)
    penalty_home_score?: number | null;
    penalty_away_score?: number | null;
    home_penalty_score?: number | null;
    away_penalty_score?: number | null;
    updated_at?: string | null;
    deleted_at?: string | null;
}

export interface Team {
    id: string;
    user_id: string | null;
    name: string;
    description?: string | null;
    logo_url?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
    tournament_id?: string | null;
    group_name?: string | null;
    sport: SportType;
    sport_name?: string | null;
    created_at: string;
}

export type PaymentStatus = 'pending' | 'checking' | 'paid' | 'rejected';
export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface TournamentTeam {
    id: string;
    tournament_id: string | null;
    team_id: string | null; // Link to Global Team
    user_id: string | null;
    name: string;
    description?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
    group_name?: string | null;
    logo_url?: string | null;
    is_roster_locked: boolean;
    managed_by_manager?: boolean;
    sport: SportType;
    payment_status?: PaymentStatus | null;
    registration_status?: RegistrationStatus | null;
    roster_status?: RegistrationStatus | null;
    created_at: string;
}

export type RosterSubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface TournamentRosterSubmission {
    id: string;
    tournament_team_id: string;
    name: string;
    shirt_number?: string | null;
    position?: string | null;
    tel?: string | null;
    photo_url?: string | null;
    status: RosterSubmissionStatus;
    created_at: string;
    updated_at: string;
}

export interface Player {
    id: string;
    team_id?: string | null;
    global_team_id?: string | null;
    name: string;
    first_name?: string | null;
    last_name?: string | null;
    number?: number | null;
    position?: string | null;
    birth_date?: string | null;
    birthday?: string | null;
    photo_url?: string | null;
    global_player_id?: string | null;
    master_player_id?: string | null;
    created_at: string;
    status?: RosterSubmissionStatus; // Status for submissions if mapped
    // Join
    global_player?: GlobalPlayer | null;
    deleted_at?: string | null;
    tel?: string | null;
    profile_img?: string | null;
    master_player?: MasterPlayer | null;
}

export interface MasterPlayer {
    id: string;
    user_id?: string | null;
    name?: string;
    first_name_local?: string | null;
    middle_name_local?: string | null;
    last_name_local?: string | null;
    first_name_intl?: string | null;
    middle_name_intl?: string | null;
    last_name_intl?: string | null;
    // Legacy support
    first_name_th?: string | null;
    middle_name_th?: string | null;
    last_name_th?: string | null;
    first_name_en?: string | null;
    middle_name_en?: string | null;
    last_name_en?: string | null;
    nickname?: string | null;
    birthday?: string | null;
    photo_url?: string | null;
    profile_img?: string | null;
    tel?: string | null;
    favorite_sport_id?: number | null;
    preferred_hand?: string | null;
    preferred_foot?: string | null;
    gender?: string | null;
    status?: string;
    verified?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface GlobalPlayer {
    id: string;
    name: string;
    first_name_local?: string | null;
    middle_name_local?: string | null;
    last_name_local?: string | null;
    first_name_intl?: string | null;
    middle_name_intl?: string | null;
    last_name_intl?: string | null;
    photo_url?: string | null;
    profile_img?: string | null;
    id_card_url?: string | null;
    date_of_birth?: string | null;
    birthday?: string | null;
    athlete_types: SportType[];
    created_by?: string | null;
    created_at: string;
}

export type EventType = 'goal' | 'own_goal' | 'penalty_goal' | 'missed_penalty' | 'assist' | 'yellow_card' | 'red_card' | 'foul' | 'foul_drawn' | 'penalty' | 'substitution' | 'var' | 'add_time' | 'kick_off' | 'first_half' | 'half_time' | 'second_half' | 'full_time' | 'extra_time' | 'extra_time_half_time' | 'extra_time_second_half' | 'penalties' | 'match_paused' | 'match_resumed' | 'penalty_shot' | 'save' | 'corner' | 'injury' | 'walkover' | 'point' | 'ace' | 'spike' | 'block' | 'timeout' | 'set_win' | 'set_end' | 'set_start' | 'match_end' | 'possession' | 'pass' | 'missed_shot' | 'bad_pass' | 'offside' | 'cross' | 'miss_cross' | 'challenge' | 'sanction';

export interface MatchEvent {
    id: string;
    match_id: string;
    team_id: string | null;
    player_id?: string | null;
    type?: EventType | string;
    event_type: EventType; // Primary/alias
    minute: number;
    detail?: Record<string, unknown>; // JSONB
    extra_info?: Record<string, unknown>; // Alias
    created_at: string;
    deleted_at?: string | null;
    isPending?: boolean;
    // Join
    player_name?: string; // For display convenience if joined
    team_name?: string;
    team_logo?: string | null;
}

export interface Goal {
    id: string;
    match_id: string;
    team_id: string;
    player_name: string;
    goal_time?: string;
    created_at: string;
}

export interface Standing {
    tournament_id: string;
    team_id: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
    gd: number;
    pts: number;
    sw?: number;
    sl?: number;
    sd?: number;
    // Join
    team?: { name: string; logo_url?: string | null };
}

export interface TournamentMember {
    id: string;
    tournament_id: string;
    user_id: string | null;
    email: string | null;
    role: 'owner' | 'co_organizer' | 'staff' | 'referee';
    status: 'pending' | 'accepted' | 'rejected';
    avatar_url?: string | null;
    full_name?: string | null;
    created_at: string;
}

export interface Profile {
    id: string;
    email: string | null;
    full_name: string | null;
    role: string | null;
    profile_img?: string | null;
    created_at?: string;
    phone?: string | null;
}

export type ActionResponse<T = unknown> = {
    success: boolean;
    message?: string;
    error?: string;
    data?: T;
};

export interface AuditLog {
    id: string;
    user_id: string | null;
    action: string;
    target_type: string;
    target_id: string;
    details: Record<string, unknown>;
    ip_address?: string | null;
    created_at: string;
    // Join
    user?: { email: string };
}

export interface Notification {
    id: string;
    user_id: string;
    type: 'invite' | 'payment' | 'system';
    title: string;
    message: string;
    link?: string | null;
    is_read: boolean;
    created_at: string;
}

export interface Payment {
    id: string;
    amount: number;
    status: string;
    payment_method: string;
    plan: string | null;
    created_at: string;
    tournament_id: string | null;
    provider_id: string | null; // PG Transaction ID
    subscription_expires_at: string | null;
    slip_url?: string | null;
    // Join
    user?: { email: string; full_name?: string };
}

export interface ManagerPlan {
    id: string;
    name: string;
    description?: string[] | null;
    price: number;
    discounted_price?: number | null;
    duration?: string | null;
    max_teams: number; // 0 = infinity
    max_players_per_team: number; // 0 = infinity
    support_level: string;
    recommended: boolean;
    created_at: string;
    updated_at: string;
}

export interface OrganizerPlan {
    id: string;
    name: string;
    description?: string[] | null;
    price: number;
    discounted_price?: number | null;
    duration?: string | null;
    max_tournaments: number; // 0 = infinity
    max_teams_per_tournament: number; // 0 = infinity
    format_support: string;
    invite_enabled: boolean;
    register_enabled: boolean;
    stats_support: string;
    support_level: string;
    recommended: boolean;
    created_at: string;
    updated_at: string;
}

export type Plan = ManagerPlan | OrganizerPlan;

export interface Product {
    id: string;
    name: string;
    description: string[];
    price: number;
    discounted_price: number | null;
    duration: string | null;
    user_limit?: number | null;
    teams_limit: number;
    format_support?: string;
    invite_enabled: boolean;
    register_enabled: boolean;
    stats_support?: string;
    support_level?: string;
    recommended: boolean;
    target_role: 'manager' | 'organizer' | 'admin';
    created_at: string;
    updated_at: string;
}

// ========== New Types for Feature Improvements ==========

export interface Venue {
    id: string;
    tournament_id: string;
    name: string;
    address?: string | null;
    google_maps_url?: string | null;
    capacity?: number | null;
    notes?: string | null;
    created_at: string;
}

export interface TournamentRules {
    tournament_id: string;
    half_duration: number;
    extra_time_duration: number;
    max_squad_size?: number | null;
    min_squad_size?: number | null;
    max_substitutions: number;
    yellow_card_ban_threshold: number;
    red_card_ban_matches: number;
    points_for_win: number;
    points_for_draw: number;
    points_for_loss: number;
    created_at?: string;
    updated_at?: string;
}

export interface PenaltyShot {
    id: string;
    match_id: string;
    team_id: string;
    player_id?: string | null;
    round: number;
    scored: boolean;
    created_at: string;
    // Join
    player?: { name: string } | null;
}

export interface Announcement {
    id: string;
    tournament_id: string;
    title: string;
    content?: string | null;
    is_pinned: boolean;
    created_at: string;
}

export interface TeamPayment {
    id: string;
    tournament_id: string;
    team_id: string;
    amount: number;
    status: 'pending' | 'paid' | 'waived';
    paid_at?: string | null;
    notes?: string | null;
    created_at: string;
    team?: { name: string; logo_url?: string | null };
}

export interface Registration {
    id: string;
    tournament_id: string;
    team_name: string;
    contact_name: string;
    contact_phone: string;
    logo_url?: string | null;
    existing_team_id?: string | null;
    slip_url?: string | null;
    payment_status: 'PENDING' | 'PAID' | 'REJECTED';
    trans_ref?: string | null;
    description?: string | null;
    tournament_team_id?: string | null;
    created_at: string;
}

export interface Sport {
    id: number | string;
    sport_name: string;
    sport_type?: SportCategoryType | string;
    created_at?: string;
}

export interface AgeCategory {
    id: number;
    category_name: string;
    min_age?: number | null;
    max_age?: number | null;
}

export interface TournamentCategory {
    id: string;
    tournament_id: string;
    name?: string;
    age_category_id?: number | null;
    gender_type: string;
    max_teams: number;
    team_limit?: number;
    registration_fee?: number | null;
    rules_config?: Record<string, unknown> | null;
    canvas_data: BracketCanvasData | null;
    deleted_at?: string | null;
    created_at?: string;
    updated_at?: string;
    age_categories?: AgeCategory | null;
    category_name?: string;
}

export interface Sponsor {
    id: string;
    tournament_id: string;
    sponsor_name: string;
    logo_img: string;
    cover_url?: string | null;
    link_url: string | null;
    order_index: number;
    created_at: string;
    updated_at?: string;
}

export type TournamentSponsor = Sponsor;


