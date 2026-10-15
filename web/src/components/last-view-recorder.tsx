"use client";

import { useEffect } from "react";
import { LAST_AREA_COOKIE, LAST_GAME_COOKIE, type Area } from "@/lib/last-view";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Cookies can't be set while rendering, so record the last-used view from the browser. */
export function LastViewRecorder({ area, gameId }: { area: Area; gameId?: string }) {
  useEffect(() => {
    const attrs = `; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    document.cookie = `${LAST_AREA_COOKIE}=${area}${attrs}`;
    if (gameId) document.cookie = `${LAST_GAME_COOKIE}=${encodeURIComponent(gameId)}${attrs}`;
  }, [area, gameId]);
  return null;
}
