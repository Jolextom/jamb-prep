"use client";

import { useState, useEffect } from "react";

const APP_VERSION = "1.0.0"; // Current version of the running code

export default function useCheckUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    async function checkVersion() {
      try {
        // Fetch with cache-busting to ensure we get the latest version.json
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.version && data.version !== APP_VERSION) {
            setUpdateAvailable(true);
          }
        }
      } catch (e) {
        console.warn("Version check failed", e);
      }
    }

    // Initial check
    checkVersion();

    // Check periodically (every 5 minutes)
    const interval = setInterval(checkVersion, 5 * 60 * 1000);

    // Check when user returns to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkVersion();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return updateAvailable;
}
