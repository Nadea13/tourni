"use client";

import { useEffect, useState } from "react";
import { SettingsView } from "@/components/settings/settings-view";
import { ApiClient } from "@/lib/api-client";
import { useSearchParams } from "next/navigation";

export default function SettingsPage() {
    const searchParams = useSearchParams();
    const tab = searchParams.get("tab") || "general";

    const [userProfile, setUserProfile] = useState<any>(null);
    const [_isLoading, setIsLoading] = useState(true);

    const fetchProfile = async (forceRefresh = false) => {
        try {
            const profile = await ApiClient.getUserProfile(forceRefresh);
            setUserProfile(profile);
        } catch (err) {
            console.warn("Failed to fetch settings profile:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const userObj = {
        id: userProfile?.id || "",
        email: userProfile?.email || "",
        user_metadata: {
            full_name: userProfile?.full_name || "",
            avatar_url: userProfile?.avatar_url || null,
        },
    } as any;

    const profileObj = {
        id: userProfile?.id || "",
        email: userProfile?.email || "",
        full_name: userProfile?.full_name || "",
        role: userProfile?.role || "organizer",
        profile_img: userProfile?.avatar_url || null,
        phone: userProfile?.phone || "",
    };

    return (
        <SettingsView 
            user={userObj} 
            profile={profileObj} 
            activeTab={tab} 
            onProfileUpdated={() => fetchProfile(true)}
        />
    );
}
