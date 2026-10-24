import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");
    const error = searchParams.get("error");
    const locale = searchParams.get("locale") || "th";

    const origin = request.nextUrl.origin;

    if (error || !token) {
        const errorMsg = error || "authentication_failed";
        return NextResponse.redirect(`${origin}/${locale}/sign-in?error=${encodeURIComponent(errorMsg)}`);
    }

    // Redirect to home and attach session cookie
    const response = NextResponse.redirect(`${origin}/${locale}/home`);
    response.cookies.set("tourni_access_token", token, {
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        sameSite: "lax",
        httpOnly: false, // Accessible by client ApiClient as well
    });

    return response;
}
