"use client";

import { useCallback, useRef, useState } from "react";

export type ShareFormat = "story" | "square";
/** Canvas pixel size per format. Story = 9:16 (MyDay), Square = 1:1 (FB/IG feed). */
export const SHARE_DIMS: Record<ShareFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
};

/**
 * Client-only share-image helper shared by the celebration + promo modals.
 * Rasterizes an off-screen card (referenced by `ref`) at the requested format
 * via lazy html2canvas, then supports Web Share / download. No backend.
 */
export function useShareImage() {
  const ref = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<ShareFormat>("story");
  const [genning, setGenning] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!ref.current) return;
    setGenning(true);
    try {
      const { w, h } = SHARE_DIMS[format];
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(ref.current, {
        backgroundColor: "#1e1b4b", scale: 1, width: w, height: h, useCORS: true, logging: false,
      });
      setImgUrl(canvas.toDataURL("image/png"));
    } catch (e) {
      console.error("[share] image generation failed:", e);
    }
    setGenning(false);
  }, [format]);

  // Switching format invalidates the current image so the user regenerates.
  const chooseFormat = useCallback((f: ShareFormat) => { setFormat(f); setImgUrl(null); }, []);

  const download = useCallback((name: string) => {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = name;
    a.click();
  }, [imgUrl]);

  const nativeShare = useCallback(async (text: string) => {
    if (!imgUrl) return;
    try {
      const blob = await (await fetch(imgUrl)).blob();
      const file = new File([blob], "quantumx.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "QuantumX", text });
        return;
      }
    } catch { /* fall through to download */ }
    download("quantumx.png");
  }, [imgUrl, download]);

  return { ref, format, chooseFormat, genning, imgUrl, generate, download, nativeShare, dims: SHARE_DIMS[format] };
}
