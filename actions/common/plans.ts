'use server'

import { Plan, ActionResponse } from "@/types";

const ALL_PLANS: Plan[] = [
    {
        id: 'match',
        name: 'Match',
        description: [
            "สร้างทัวร์นาเมนต์ได้สูงสุด 1 รายการ",
            "สร้างรุ่นการแข่งขันสูงสุด 1 รุ่น",
            "จำกัดจำนวนทีมสูงสุด 12 ทีม",
            "ระบบรับเงินค่าสมัครผ่าน QR Code พร้อมแนบสลิป",
            "บันทึกเหตุการณ์สด/ผู้ทำประตู/การฟาวล์ แบบเรียลไทม์",
            "หน้าแสดงผลคะแนนสดสำหรับต่อเข้าจอถ่ายทอดสด (OBS Overlay)"
        ],
        price: 0,
        discounted_price: null,
        duration: 'lifetime',
        max_tournaments: 1,
        max_teams_per_tournament: 12,
        format_support: 'All',
        invite_enabled: false,
        register_enabled: true,
        stats_support: 'Basic',
        support_level: 'Community',
        recommended: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'event',
        name: 'Event',
        description: [
            "สร้างทัวร์นาเมนต์ได้สูงสุด 1 รายการ",
            "สร้างรุ่นการแข่งขันสูงสุด 3 รุ่นต่อทัวร์นาเมนต์",
            "จำกัดจำนวนทีมสูงสุด 32 ทีม",
            "บันทึกเหตุการณ์สด/ผู้ทำประตู/การฟาวล์ แบบเรียลไทม์",
            "เพิ่มสตาฟดูแลการแข่งขันร่วมกันสูงสุด 3 คน",
            "ระบบรับเงินค่าสมัครผ่าน QR Code พร้อมแนบสลิป",
            "หน้าแสดงผลคะแนนสดสำหรับต่อเข้าจอถ่ายทอดสด (OBS Overlay)"
        ],
        price: 290,
        discounted_price: 145,
        duration: 'one-time',
        max_tournaments: 1,
        max_teams_per_tournament: 32,
        format_support: 'All',
        invite_enabled: true,
        register_enabled: true,
        stats_support: 'Advanced',
        support_level: 'Priority',
        recommended: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'tournament',
        name: 'Tournament',
        description: [
            "สร้างทัวร์นาเมนต์ได้สูงสุด 3 รายการ",
            "สร้างรุ่นการแข่งขันสูงสุด 7 รุ่นต่อทัวร์นาเมนต์",
            "จำกัดจำนวนทีมสูงสุด 128 ทีมต่อรุ่น",
            "บันทึกเหตุการณ์สด/ผู้ทำประตู/การฟาวล์ แบบเรียลไทม์",
            "เพิ่มสตาฟดูแลการแข่งขันร่วมกันสูงสุด 7 คน",
            "ระบบรับเงินค่าสมัครผ่าน QR Code พร้อมแนบสลิป",
            "หน้าแสดงผลคะแนนสดสำหรับต่อเข้าจอถ่ายทอดสด (OBS Overlay)"
        ],
        price: 590,
        discounted_price: 295,
        duration: 'one-time',
        max_tournaments: 3,
        max_teams_per_tournament: 128,
        format_support: 'All',
        invite_enabled: true,
        register_enabled: true,
        stats_support: 'Advanced',
        support_level: 'Priority',
        recommended: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

export async function getPlans(_options?: { role?: 'organizer' | 'manager' }): Promise<ActionResponse<Plan[]>> {
    try {
        return { success: true, data: ALL_PLANS };
    } catch (error) {
        console.error('Unexpected error in getPlans:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}