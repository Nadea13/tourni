import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';

const handleI18nRouting = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
    // 1. Extract IP address
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || '127.0.0.1');
    request.headers.set('x-client-ip', clientIp);

    // Bypass redirects for Server Actions (POST requests with Next-Action header)
    if (request.headers.has('next-action')) {
        return handleI18nRouting(request);
    }

    // 2. Check JWT Session Cookie
    const token = request.cookies.get('tourni_access_token')?.value;
    const path = request.nextUrl.pathname;

    // Check if user is navigating to auth pages while already logged in
    const isAuthPage = path.includes('/sign-in') || path.includes('/sign-up') || path.includes('/login') || path.includes('/forgot-password');

    // Extract current locale or default to th
    const matchLocale = path.match(/^\/(th|en)/);
    const locale = matchLocale ? matchLocale[1] : 'th';

    // If user accesses /dashboard root directly, redirect to /home
    const isDashboardRoot = path === '/dashboard' || path === `/${locale}/dashboard`;
    if (isDashboardRoot) {
        const homeUrl = new URL(`/${locale}/home${request.nextUrl.search}`, request.url);
        return NextResponse.redirect(homeUrl);
    }

    // If user accesses /dashboard/tournaments or /dashboard/tournaments/*, redirect to /my-tournaments/*
    if (path.startsWith(`/${locale}/dashboard/tournaments`) || path.startsWith('/dashboard/tournaments')) {
        const targetPath = path
            .replace(new RegExp(`^\\/${locale}\\/dashboard\\/tournaments`), `/${locale}/my-tournaments`)
            .replace(/^\/dashboard\/tournaments/, `/${locale}/my-tournaments`);
        const myTournamentsUrl = new URL(`${targetPath}${request.nextUrl.search}`, request.url);
        return NextResponse.redirect(myTournamentsUrl);
    }

    // If user accesses /dashboard/teams or /dashboard/teams/*, redirect to /my-teams/*
    if (path.startsWith(`/${locale}/dashboard/teams`) || path.startsWith('/dashboard/teams')) {
        const targetPath = path
            .replace(new RegExp(`^\\/${locale}\\/dashboard\\/teams`), `/${locale}/my-teams`)
            .replace(/^\/dashboard\/teams/, `/${locale}/my-teams`);
        const myTeamsUrl = new URL(`${targetPath}${request.nextUrl.search}`, request.url);
        return NextResponse.redirect(myTeamsUrl);
    }

    // If user accesses /dashboard/inboxes or /dashboard/notifications, redirect to /inboxes
    if (
        path.startsWith(`/${locale}/dashboard/inboxes`) ||
        path.startsWith('/dashboard/inboxes') ||
        path.startsWith(`/${locale}/dashboard/notifications`) ||
        path.startsWith('/dashboard/notifications')
    ) {
        const targetPath = path
            .replace(new RegExp(`^\\/${locale}\\/dashboard\\/(inboxes|notifications)`), `/${locale}/inboxes`)
            .replace(/^\/dashboard\/(inboxes|notifications)/, `/${locale}/inboxes`);
        const inboxesUrl = new URL(`${targetPath}${request.nextUrl.search}`, request.url);
        return NextResponse.redirect(inboxesUrl);
    }


    // If user accesses /dashboard/tournament-teams or /dashboard/tournament-teams/*, redirect to /inboxes/teams/*
    if (path.startsWith(`/${locale}/dashboard/tournament-teams`) || path.startsWith('/dashboard/tournament-teams')) {
        const targetPath = path
            .replace(new RegExp(`^\\/${locale}\\/dashboard\\/tournament-teams`), `/${locale}/inboxes/teams`)
            .replace(/^\/dashboard\/tournament-teams/, `/${locale}/inboxes/teams`);
        const targetUrl = new URL(`${targetPath}${request.nextUrl.search}`, request.url);
        return NextResponse.redirect(targetUrl);
    }


    // If user accesses /dashboard/registrations or /dashboard/registrations/*, redirect to /home/registrations/*
    if (path.startsWith(`/${locale}/dashboard/registrations`) || path.startsWith('/dashboard/registrations')) {
        const targetPath = path
            .replace(new RegExp(`^\\/${locale}\\/dashboard\\/registrations`), `/${locale}/home/registrations`)
            .replace(/^\/dashboard\/registrations/, `/${locale}/home/registrations`);
        const registrationsUrl = new URL(`${targetPath}${request.nextUrl.search}`, request.url);
        return NextResponse.redirect(registrationsUrl);
    }

    // If user accesses /dashboard/settings, redirect to /settings
    if (path.startsWith(`/${locale}/dashboard/settings`) || path.startsWith('/dashboard/settings')) {
        const targetPath = path
            .replace(new RegExp(`^\\/${locale}\\/dashboard\\/settings`), `/${locale}/settings`)
            .replace(/^\/dashboard\/settings/, `/${locale}/settings`);
        const settingsUrl = new URL(`${targetPath}${request.nextUrl.search}`, request.url);
        return NextResponse.redirect(settingsUrl);
    }


    // Catch-all fallback for any other /dashboard route -> redirect to /home
    if (path.startsWith(`/${locale}/dashboard`) || path.startsWith('/dashboard')) {
        const homeUrl = new URL(`/${locale}/home${request.nextUrl.search}`, request.url);
        return NextResponse.redirect(homeUrl);
    }

    if (token && isAuthPage) {
        const homeUrl = new URL(`/${locale}/home`, request.url);
        return NextResponse.redirect(homeUrl);
    }

    // Protect Dashboard / Home / My Tournaments / My Teams / Inboxes / Settings routes: redirect to sign-in if no token
    const isProtectedPage = path.includes('/dashboard') || path.includes('/home') || path.includes('/my-tournaments') || path.includes('/my-teams') || path.includes('/inboxes') || path.includes('/settings') || path.includes('/manager');
    if (!token && isProtectedPage) {
        const signInUrl = new URL(`/${locale}/sign-in`, request.url);
        return NextResponse.redirect(signInUrl);
    }

    // 3. Run next-intl middleware
    const response = handleI18nRouting(request);
    return response;
}

export const config = {
    matcher: [
        // Enable a redirect to a matching locale at the root
        '/',

        // Set a cookie to remember the previous locale for
        // all requests that have a locale prefix
        '/(th|en)/:path*',

        // Enable redirects that add missing locales
        // (e.g. `/pathnames` -> `/en/pathnames`)
        '/((?!_next|_vercel|api|auth|.*\\..*).*)'
    ]
};
