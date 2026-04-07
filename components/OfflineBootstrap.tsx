"use client";

import { useEffect } from "react";

export default function OfflineBootstrap() {
    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
            return;
        }

        const registerServiceWorker = async () => {
            try {
                await navigator.serviceWorker.register("/sw.js", { scope: "/" });
            } catch (error) {
                console.warn("Service worker registration failed", error);
            }
        };

        void registerServiceWorker();

        if (navigator.storage?.persist) {
            void navigator.storage.persist().catch(() => undefined);
        }
    }, []);

    return null;
}