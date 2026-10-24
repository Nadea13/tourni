'use server';

import { getServerSession } from "@/lib/auth-server";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { ActionResponse } from "@/types";
import { headers } from "next/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://leagueflow-v80x.onrender.com/api/v1';

export async function createStripeCheckoutSession({
    planId,
    planName,
    amount,
    currency = 'thb',
    tournamentId
}: {
    planId: string;
    planName: string;
    amount: number;
    currency?: 'thb' | 'usd';
    tournamentId?: string | null;
}): Promise<ActionResponse<{ sessionId: string; url: string | null }>> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }
        const user = session.user;

        const headersList = await headers();
        const originHeader = headersList.get("origin");
        const refererHeader = headersList.get("referer");
        let origin = originHeader;
        if (!origin && refererHeader) {
            try {
                origin = new URL(refererHeader).origin;
            } catch {
                origin = null;
            }
        }
        if (!origin) {
            origin = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        }

        // Check if Stripe key is configured
        if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("dummy")) {
            if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
                console.error("STRIPE_SECRET_KEY is not configured in production environment variables");
                return {
                    success: false,
                    error: "ยังไม่ได้ตั้งค่า STRIPE_SECRET_KEY ใน Vercel Environment Variables กรุณาใส่คีย์ใน Vercel Dashboard"
                };
            }

            // Simulated Stripe session mode for local development without actual Stripe keys
            const dummySessionId = `cs_test_${Math.random().toString(36).substring(2, 12)}`;
            const redirectUrl = `${origin}/settings?tab=billing&session_id=${dummySessionId}&success=true`;
            return {
                success: true,
                data: {
                    sessionId: dummySessionId,
                    url: redirectUrl
                }
            };
        }

        const isYearly = planId.includes('yearly') || planId.includes('annual') || planId === 'pro_yearly' || planId === 'cup_yearly';
        const isMonthly = planId === 'pro' || planId === 'event' || planId === 'cup' || planId === 'manager_pro' || planId === 'monthly';

        // Clean plan title
        const cleanPlanName = planName.replace(/^สมัครใช้\s*/i, '').replace(/^(สมัคร|Subscribe)\s*/i, '').trim();
        let displayTitle = `สมัครใช้ Tourni ${cleanPlanName}`;
        if (isYearly) {
            displayTitle = `สมัครใช้ Tourni ${cleanPlanName.replace(/yearly/i, '').trim()} (Annual)`;
        } else if (isMonthly) {
            displayTitle = `สมัครใช้ Tourni ${cleanPlanName.replace(/monthly/i, '').trim()} (Monthly)`;
        }

        let baseDesc = "ระบบบริหารจัดการการแข่งขันฟุตบอลแบบมืออาชีพ สร้างทัวร์นาเมนต์ได้ไม่จำกัด ตารางแข่งขันและสถิติ Real-time";
        if (planId === "pro" || planId === "event") {
            baseDesc = "ระบบบริหารจัดการการแข่งขันแบบมืออาชีพ ตารางคะแนน Real-time สถิตินักกีฬา และระบบลงทะเบียนทีมครบวงจร";
        } else if (planId === "pro_yearly") {
            baseDesc = "แพ็กเกจรายปีคุ้มสุด ระบบบริหารจัดการการแข่งขันครบวงจร ไม่จำกัดทัวร์นาเมนต์ พร้อมระบบซัพพอร์ตพิเศษ";
        } else if (planId === "cup") {
            baseDesc = "แพ็กเกจสำหรับการแข่งขันแบบถ้วยฟุตบอล บอลถ้วย ตารางสายการแข่งขัน น็อคเอ้าท์ อัตโนมัติ";
        } else if (planId === "cup_yearly") {
            baseDesc = "แพ็กเกจรายปีสำหรับบริหารจัดการบอลถ้วย น็อคเอ้าท์และแบ่งกลุ่ม ไม่จำกัดรายการแข่งขัน";
        } else if (planId === "manager_pro") {
            baseDesc = "สำหรับผู้จัดการทีม จัดการรายชื่อนักกีฬา สถิติส่วนตัว ชำระเงินค่าสมัครแข่งครบในที่เดียว";
        }

        // Full base price vs discount calculation
        let originalPrice = amount;
        let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined = undefined;

        // Pro Monthly Promo: Original 290 THB / $9 USD, Promo 145 THB / $4.50 USD (-50%)
        if ((planId === "pro" || planId === "event") && isMonthly && (amount === 145 || amount === 4.5)) {
            originalPrice = currency === 'usd' ? 9 : 290;
            try {
                const couponId = currency === 'usd' ? "PROMO50_LAUNCH_USD" : "PROMO50_LAUNCH";
                try {
                    await stripe.coupons.retrieve(couponId);
                } catch {
                    await stripe.coupons.create({
                        id: couponId,
                        name: currency === 'usd' ? "Launch Promo (-50%)" : "โปรโมชั่นเปิดตัว (-50%)",
                        percent_off: 50,
                        duration: "once", // First billing cycle 50% off
                    });
                }
                discounts = [{ coupon: couponId }];
            } catch (err) {
                console.error("Error setting up Stripe coupon:", err);
            }
        }

        const priceDataObj: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
            currency: currency,
            product_data: {
                name: displayTitle,
                description: baseDesc,
            },
            unit_amount: Math.round(originalPrice * 100), // Original amount in satang or cents
            recurring: {
                interval: isYearly ? 'year' : 'month',
            },
        };

        // Find or create Stripe Customer
        let customerId: string | undefined;
        if (user.email) {
            const existingCustomers = await stripe.customers.list({
                email: user.email,
                limit: 1,
            });
            if (existingCustomers.data.length > 0) {
                customerId = existingCustomers.data[0].id;
            } else {
                const newCustomer = await stripe.customers.create({
                    email: user.email,
                    metadata: {
                        userId: user.id,
                    },
                });
                customerId = newCustomer.id;
            }
        }

        const checkoutOptions: Stripe.Checkout.SessionCreateParams = {
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: priceDataObj,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            discounts: discounts,
            customer: customerId,
            customer_email: customerId ? undefined : (user.email || undefined),
            metadata: {
                userId: user.id,
                planId,
                planName: cleanPlanName,
                tournamentId: tournamentId || '',
            },
            success_url: `${origin}/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}&success=true`,
            cancel_url: `${origin}/settings?tab=billing&canceled=true`,
        };


        const checkoutSession = await stripe.checkout.sessions.create(checkoutOptions);

        return {
            success: true,
            data: {
                sessionId: checkoutSession.id,
                url: checkoutSession.url
            }
        };
    } catch (error) {
        console.error("Error creating Stripe Checkout Session:", error);

        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to initiate Stripe Checkout"
        };
    }
}

export async function createStripeCustomerPortalSession(): Promise<ActionResponse<{ url: string }>> {
    try {
        const session = await getServerSession();
        if (!session?.user || !session.user.email) {
            return { success: false, error: "Authentication required" };
        }
        const user = session.user;

        const headersList = await headers();
        const originHeader = headersList.get("origin");
        const refererHeader = headersList.get("referer");
        let origin = originHeader;
        if (!origin && refererHeader) {
            try {
                origin = new URL(refererHeader).origin;
            } catch {
                origin = null;
            }
        }
        if (!origin) {
            origin = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        }

        if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("dummy")) {
            if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
                return {
                    success: false,
                    error: "ยังไม่ได้ตั้งค่า STRIPE_SECRET_KEY ใน Vercel"
                };
            }
            return {
                success: true,
                data: {
                    url: `${origin}/settings?tab=billing`
                }
            };
        }

        // Find Stripe Customer by email or create
        const existingCustomers = await stripe.customers.list({
            email: user.email,
            limit: 1,
        });

        let customerId: string;
        if (existingCustomers.data.length > 0) {
            customerId = existingCustomers.data[0].id;
        } else {
            const newCustomer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    userId: user.id,
                },
            });
            customerId = newCustomer.id;
        }

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${origin}/settings?tab=billing`,
        });

        return {
            success: true,
            data: {
                url: portalSession.url
            }
        };
    } catch (error) {
        console.error("Error creating Stripe Billing Portal session:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to open Stripe customer portal"
        };
    }
}


export async function verifyStripeCheckoutSession(sessionId: string): Promise<ActionResponse<{ paid: boolean }>> {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return { success: false, error: "Authentication required" };
        }
        const user = session.user;

        let isPaid = false;
        let planId = "pro";
        let amount = 0;
        let tournamentId: string | null = null;
        let transactionId = sessionId;

        if (sessionId.startsWith("cs_test_") && (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("dummy"))) {
            // Simulated verification mode for local test sessions
            isPaid = true;
            planId = "pro";
            amount = 145;
        } else if (process.env.STRIPE_SECRET_KEY) {
            const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
            if (stripeSession.payment_status === "paid" || stripeSession.status === "complete") {
                isPaid = true;
                planId = stripeSession.metadata?.planId || "pro";
                amount = (stripeSession.amount_total || 0) / 100;
                tournamentId = stripeSession.metadata?.tournamentId || null;
                transactionId = (stripeSession.subscription as string) || (stripeSession.payment_intent as string) || stripeSession.id;
            }
        }

        if (!isPaid) {
            return { success: false, error: "Payment not completed" };
        }

        // Record payment in Go Backend database
        const res = await fetch(`${API_BASE_URL}/payments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.token}`,
            },
            body: JSON.stringify({
                user_id: user.id,
                tournament_id: tournamentId || null,
                amount,
                payment_status: "completed",
                payment_method: "stripe",
                plan_name: planId,
                transaction_id: transactionId,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("Error saving Stripe payment record:", errText);
            return { success: false, error: "Failed to record payment: " + errText };
        }

        revalidatePath("/", "layout");
        revalidatePath("/settings", "page");
        revalidatePath("/dashboard/settings", "page");

        return { success: true, data: { paid: true } };
    } catch (error) {
        console.error("Error verifying Stripe session:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to verify Stripe payment"
        };
    }
}
