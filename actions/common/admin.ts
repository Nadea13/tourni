"use server"

import { ActionResponse, Payment, TournamentStatusRequest, TournamentStatus } from "@/types"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { getServerSession } from "@/lib/auth-server"
import { logActivity } from "@/lib/audit"

export interface AdminUser {
    id: string
    email: string
    full_name: string | null
    phone: string | null
    role: 'admin' | 'organizer' | 'team_manager' | 'player'
    is_organizer: boolean
    is_team_manager: boolean
    created_at: string
    updated_at?: string
}

async function verifyAdmin(): Promise<{ isAdmin: boolean; error?: string }> {
    const session = await getServerSession()
    if (session?.user) {
        const role = session.user.role
        if (role === 'admin' || role === 'super_admin') {
            return { isAdmin: true }
        }
        return { isAdmin: false, error: "Access denied: Admins only" }
    }
    return { isAdmin: false, error: "Authentication required" }
}

export async function getAdminPayments(): Promise<ActionResponse<Payment[]>> {
    try {
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return { success: false, error }

        const session = await getServerSession()
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`

        try {
            const res = await fetch(`${apiUrl}/payments`, { cache: 'no-store', headers })
            if (res.ok) {
                const apiData = await res.json()
                const list = Array.isArray(apiData) ? apiData : (apiData.data || [])
                return { success: true, data: list }
            }
        } catch (apiErr) {
            console.warn("[getAdminPayments] API error:", apiErr)
        }

        return { success: true, data: [] }
    } catch (e: unknown) {
        console.error("Error fetching admin payments:", e)
        return { success: true, data: [] }
    }
}

export async function updatePaymentStatus(
    paymentId: string,
    status: 'pending' | 'success' | 'failed'
): Promise<ActionResponse<void>> {
    try {
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return { success: false, error }

        const session = await getServerSession()
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`

        await fetch(`${apiUrl}/payments/${paymentId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ payment_status: status })
        })

        return { success: true }
    } catch (e: unknown) {
        console.error("Error updating payment status:", e)
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
}

export async function getAdminUsers(): Promise<ActionResponse<AdminUser[]>> {
    try {
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return { success: false, error }

        const session = await getServerSession()
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
        const headers: Record<string, string> = {}
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`

        try {
            const res = await fetch(`${apiUrl}/users`, { cache: 'no-store', headers })
            if (res.ok) {
                const data = await res.json()
                return { success: true, data: Array.isArray(data) ? data : [] }
            }
        } catch {
            // ignore
        }

        return { success: true, data: [] }
    } catch (e) {
        console.error("Error fetching admin users:", e)
        return { success: true, data: [] }
    }
}

export async function updateUserFields(
    userId: string,
    updates: {
        role?: 'admin' | 'organizer' | 'team_manager' | 'player'
        is_organizer?: boolean
        is_team_manager?: boolean
    }
): Promise<ActionResponse<void>> {
    try {
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return { success: false, error }

        const session = await getServerSession()
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`

        await fetch(`${apiUrl}/users/${userId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updates)
        })

        return { success: true }
    } catch (e) {
        console.error("Error updating user fields:", e)
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
}
export interface AdminMasterPlayer {
    id: string
    user_id: string | null
    name?: string | null
    first_name_local?: string | null
    middle_name_local?: string | null
    last_name_local?: string | null
    first_name_intl?: string | null
    middle_name_intl?: string | null
    last_name_intl?: string | null
    first_name_th?: string | null
    middle_name_th?: string | null
    last_name_th?: string | null
    first_name_en?: string | null
    middle_name_en?: string | null
    last_name_en?: string | null
    gender: string
    birthday: string
    tel: string | null
    photo_url?: string | null
    profile_img?: string | null
    status: string
    verified: boolean
    created_at: string
    user?: {
        email: string
        full_name: string | null
    } | null
}

export async function getAdminMasterPlayers(): Promise<ActionResponse<AdminMasterPlayer[]>> {
    try {
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return { success: false, error }

        const session = await getServerSession()
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`

        try {
            const res = await fetch(`${apiUrl}/master-players`, { cache: 'no-store', headers })
            if (res.ok) {
                const apiData = await res.json()
                const list = Array.isArray(apiData) ? apiData : (apiData.data || [])
                return { success: true, data: list }
            }
        } catch (apiErr) {
            console.warn("[getAdminMasterPlayers] API error:", apiErr)
        }

        return { success: true, data: [] }
    } catch (e) {
        console.error("Error fetching admin master players:", e)
        return { success: true, data: [] }
    }
}

export async function linkMasterPlayerToUser(
    masterPlayerId: string,
    userId: string | null
): Promise<ActionResponse<void>> {
    try {
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return { success: false, error }

        const session = await getServerSession()
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`

        await fetch(`${apiUrl}/master-players/${masterPlayerId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ user_id: userId })
        })

        return { success: true }
    } catch (e) {
        console.error("Error linking master player to user:", e)
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
}

export async function approveMasterPlayerRequest(
    masterPlayerId: string
): Promise<ActionResponse<void>> {
    try {
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return { success: false, error }

        const session = await getServerSession()
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`

        await fetch(`${apiUrl}/master-players/${masterPlayerId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ verified: true })
        })

        return { success: true }
    } catch (e) {
        console.error("Error approving master player request:", e)
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
}

export async function rejectMasterPlayerRequest(
    masterPlayerId: string
): Promise<ActionResponse<void>> {
    try {
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return { success: false, error }

        const session = await getServerSession()
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`

        await fetch(`${apiUrl}/master-players/${masterPlayerId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ user_id: null, verified: false })
        })

        return { success: true }
    } catch (e) {
        console.error("Error rejecting master player request:", e)
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
}



export interface SystemLogItem {
    id: string
    event: string
    level: 'info' | 'warning' | 'error'
    message: string
    timestamp: string
    isAuthenticated?: boolean
}

export interface ActiveUserInfo {
    id: string
    email: string
    full_name: string | null
    ip: string
    lastActive: string
}

export interface SystemMonitorStats {
    dbConnected: boolean
    latencyMs: number
    tableCounts: {
        users: number
        tournaments: number
        teams: number
        matches: number
        payments: number
        players: number
    }
    recentErrorsCount: number
    services: {
        database: 'operational' | 'degraded' | 'down'
        auth: 'operational' | 'degraded' | 'down'
        storage: 'operational' | 'degraded' | 'down'
    }
    activeUsers?: ActiveUserInfo[]
    recentLogs?: SystemLogItem[]
}

export async function getSystemMonitorStats(): Promise<ActionResponse<SystemMonitorStats>> {
    try {
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return { success: false, error }

        const session = await getServerSession()
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
        const headerList = await headers()
        const clientIp = headerList.get("x-client-ip") || headerList.get("x-forwarded-for")?.split(",")[0] || headerList.get("x-real-ip") || "127.0.0.1"

        const startTime = Date.now()
        let isHealthy = true
        try {
            const healthUrl = apiUrl.replace(/\/api\/v1\/?$/, '') + '/health'
            const pingRes = await fetch(healthUrl, { cache: 'no-store' })
            isHealthy = pingRes.ok
        } catch {
            isHealthy = false
        }
        const latencyMs = Date.now() - startTime

        // Fetch counts from available endpoints
        const usersRes = await getAdminUsers()
        const usersList = (usersRes.success && usersRes.data) ? usersRes.data : []
        const paymentsRes = await getAdminPayments()
        const paymentsList = (paymentsRes.success && paymentsRes.data) ? paymentsRes.data : []
        const masterPlayersRes = await getAdminMasterPlayers()
        const masterPlayersList = (masterPlayersRes.success && masterPlayersRes.data) ? masterPlayersRes.data : []

        const activeUsersList: ActiveUserInfo[] = usersList.slice(0, 15).map(u => ({
            id: u.id,
            email: u.email,
            full_name: u.full_name,
            ip: u.id === session?.user?.id ? clientIp : '127.0.0.1',
            lastActive: u.updated_at || u.created_at || new Date().toISOString()
        }))

        const logs: SystemLogItem[] = usersList.slice(0, 10).map(u => ({
            id: `usr_reg_${u.id}`,
            event: "USER_REGISTERED",
            level: "info",
            message: `New user registered: ${u.full_name ? `${u.full_name} (${u.email})` : u.email}`,
            timestamp: u.created_at,
            isAuthenticated: true
        }))

        // Fetch real-time live table counts from Go backend
        let tableCounts = {
            users: usersList.length,
            tournaments: 0,
            teams: 0,
            matches: 0,
            payments: paymentsList.length,
            players: masterPlayersList.length
        }
        try {
            const countsRes = await fetch(`${apiUrl}/admin/table-counts`, { cache: 'no-store' })
            if (countsRes.ok) {
                const cData = await countsRes.json()
                tableCounts = {
                    users: typeof cData.users === 'number' ? cData.users : usersList.length,
                    tournaments: typeof cData.tournaments === 'number' ? cData.tournaments : 0,
                    teams: typeof cData.teams === 'number' ? cData.teams : 0,
                    matches: typeof cData.matches === 'number' ? cData.matches : 0,
                    payments: typeof cData.payments === 'number' ? cData.payments : paymentsList.length,
                    players: typeof cData.players === 'number' ? cData.players : masterPlayersList.length
                }
            }
        } catch (countsErr) {
            console.warn("[getSystemMonitorStats] table-counts fetch error:", countsErr)
        }

        return {
            success: true,
            data: {
                dbConnected: isHealthy,
                latencyMs,
                tableCounts,
                recentErrorsCount: 0,
                services: {
                    database: isHealthy ? (latencyMs > 500 ? 'degraded' : 'operational') : 'down',
                    auth: isHealthy ? 'operational' : 'down',
                    storage: 'operational'
                },
                activeUsers: activeUsersList,
                recentLogs: logs
            }
        }
    } catch (e) {
        console.error("Error fetching system monitor stats:", e)
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
}

export async function getAdminTablePreview(
    table: 'users' | 'tournaments' | 'teams' | 'matches' | 'payments' | 'players'
): Promise<ActionResponse<Record<string, any>[]>> {
    try {
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return { success: false, error }

        const session = await getServerSession()
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
        const headers: Record<string, string> = {}
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`

        const res = await fetch(`${apiUrl}/admin/table-preview?table=${table}`, {
            cache: 'no-store',
            headers
        })
        if (res.ok) {
            const data = await res.json()
            return { success: true, data: Array.isArray(data) ? data : [] }
        }
        return { success: false, error: "Failed to fetch table preview" }
    } catch (e) {
        console.error("Error fetching table preview:", e)
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
}

export async function getAdminTournamentStatusRequests(): Promise<ActionResponse<TournamentStatusRequest[]>> {
    try {
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return { success: false, error }

        const session = await getServerSession()
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`

        // 1. Try fetching from dedicated Go backend table tournament_status_requests
        try {
            const res = await fetch(`${apiUrl}/admin/tournament-status-requests`, {
                cache: 'no-store',
                headers
            })
            if (res.ok) {
                const json = await res.json()
                if (json.data && Array.isArray(json.data) && json.data.length > 0) {
                    const requests: TournamentStatusRequest[] = json.data.map((r: any) => ({
                        id: r.id,
                        tournament_id: r.tournament_id,
                        tournament_name: r.tournament_name || "",
                        sport_name: r.sport_name || "",
                        current_status: (r.previous_status || 'ongoing') as TournamentStatus,
                        target_status: (r.target_status || 'ongoing') as TournamentStatus,
                        reason: r.reason || "",
                        requested_by: r.requested_by,
                        requested_by_email: r.requester_email || "",
                        requested_by_name: r.requester_name || "",
                        requested_at: r.created_at,
                        status: r.status || 'pending',
                        reviewed_by: r.reviewed_by,
                        reviewed_at: r.reviewed_at,
                        reject_reason: r.reject_reason
                    }))
                    return { success: true, data: requests }
                }
            }
        } catch (backendErr) {
            console.warn("[getAdminTournamentStatusRequests] Go backend endpoint error:", backendErr)
        }

        return { success: true, data: [] }
    } catch (e) {
        console.error("Error fetching tournament status requests:", e)
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
}

export async function approveTournamentStatusRequest(tournamentId: string): Promise<ActionResponse> {
    try {
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return { success: false, error }

        const session = await getServerSession()
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`

        // 1. Call Go backend approve endpoint
        let targetStatus: TournamentStatus = 'ongoing'
        let reqData: any = null
        let goBackendSuccess = false

        try {
            const approveRes = await fetch(`${apiUrl}/admin/tournaments/${tournamentId}/status-request/approve`, {
                method: 'POST',
                headers
            })
            if (approveRes.ok) {
                const json = await approveRes.json()
                if (json.success && json.data) {
                    goBackendSuccess = true
                    reqData = json.data
                    targetStatus = json.data.target_status as TournamentStatus
                }
            }
        } catch (backendErr) {
            console.warn("[approveTournamentStatusRequest] Go backend endpoint error:", backendErr)
        }

        // 2. Fetch tournament to get details and sync settings if needed
        const tourRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, { cache: 'no-store', headers })
        if (!tourRes.ok) return { success: false, error: "Tournament not found" }
        const tourData = await tourRes.json()
        const currentTour = tourData.tournament
        const settings = (currentTour?.settings as Record<string, any>) || {}
        const req = settings.status_request || reqData

        // If Go backend didn't approve it and there's no pending request, error out
        if (!goBackendSuccess && (!req || req.status !== 'pending')) {
            return { success: false, error: "No pending status request found for this tournament" }
        }

        if (!goBackendSuccess && req?.target_status) {
            targetStatus = req.target_status
            // Update status via PATCH /tournaments/:id/status
            const statusRes = await fetch(`${apiUrl}/tournaments/${tournamentId}/status`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ status: targetStatus })
            })
            if (!statusRes.ok) {
                await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ id: tournamentId, status: targetStatus })
                })
            }
        }

        // 3. Ensure settings has status_unlocked = true and status = approved
        settings.status_unlocked = true
        settings.status_unlocked_at = new Date().toISOString()
        settings.status_request = {
            ...(req || {}),
            status: 'approved',
            reviewed_by: session?.user?.id,
            reviewed_at: new Date().toISOString()
        }

        await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                id: tournamentId,
                settings
            })
        })

        // 4. Activity notification logged
        console.log(`[approveTournamentStatusRequest] Status approved for tournament ${tournamentId} to ${targetStatus}`)

        revalidatePath(`/my-tournaments/${tournamentId}`)
        revalidatePath(`/dashboard/tournaments/${tournamentId}`)
        revalidatePath(`/tournaments/${tournamentId}`)
        revalidatePath(`/organizer/tournaments/${tournamentId}`)
        revalidatePath(`/inboxes`)
        revalidatePath(`/dashboard/inboxes`)
        revalidatePath(`/dashboard/notifications`)
        revalidatePath(`/admin`)
        await logActivity('APPROVE_TOURNAMENT_STATUS_REQUEST', 'tournament', tournamentId, { targetStatus, req: req || reqData })

        return { success: true }
    } catch (e) {
        console.error("Error approving tournament status request:", e)
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
}

export async function rejectTournamentStatusRequest(tournamentId: string, rejectReason: string): Promise<ActionResponse> {
    try {
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return { success: false, error }

        const session = await getServerSession()
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (session?.token) headers['Authorization'] = `Bearer ${session.token}`

        // 1. Call Go backend reject endpoint to update tournament_status_requests table
        let reqData: any = null
        let goBackendSuccess = false
        try {
            const rejectRes = await fetch(`${apiUrl}/admin/tournaments/${tournamentId}/status-request/reject`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ reason: rejectReason })
            })
            if (rejectRes.ok) {
                const json = await rejectRes.json()
                if (json.success && json.data) {
                    goBackendSuccess = true
                    reqData = json.data
                }
            }
        } catch (backendErr) {
            console.warn("[rejectTournamentStatusRequest] Go backend endpoint error:", backendErr)
        }

        // 2. Fetch tournament
        const tourRes = await fetch(`${apiUrl}/tournaments/${tournamentId}`, { cache: 'no-store', headers })
        if (!tourRes.ok) return { success: false, error: "Tournament not found" }
        const tourData = await tourRes.json()
        const currentTour = tourData.tournament
        const settings = (currentTour?.settings as Record<string, any>) || {}
        const req = settings.status_request || reqData

        if (!goBackendSuccess && (!req || req.status !== 'pending')) {
            return { success: false, error: "No pending status request found for this tournament" }
        }

        // 3. Update settings: mark rejected
        settings.status_request = {
            ...(req || {}),
            status: 'rejected',
            reject_reason: rejectReason,
            reviewed_by: session?.user?.id,
            reviewed_at: new Date().toISOString()
        }

        await fetch(`${apiUrl}/tournaments/${tournamentId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                id: tournamentId,
                settings
            })
        })

        // 4. Activity notification logged
        console.log(`[rejectTournamentStatusRequest] Status rejected for tournament ${tournamentId}`)

        revalidatePath(`/my-tournaments/${tournamentId}`)
        revalidatePath(`/dashboard/tournaments/${tournamentId}`)
        revalidatePath(`/tournaments/${tournamentId}`)
        revalidatePath(`/organizer/tournaments/${tournamentId}`)
        revalidatePath(`/inboxes`)
        revalidatePath(`/dashboard/inboxes`)
        revalidatePath(`/dashboard/notifications`)
        revalidatePath(`/admin`)
        await logActivity('REJECT_TOURNAMENT_STATUS_REQUEST', 'tournament', tournamentId, { rejectReason, req: req || reqData })

        return { success: true }
    } catch (e) {
        console.error("Error rejecting tournament status request:", e)
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
}
