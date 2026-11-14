"use client";

import { useEffect, useRef, useState } from "react";

const MV_SRC = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";

function ensureScript() {
  if (typeof document === "undefined") return;
  if (document.querySelector("script[data-model-viewer]")) return;
  const s = document.createElement("script");
  s.type = "module";
  s.src = MV_SRC;
  s.setAttribute("data-model-viewer", "");
  document.head.appendChild(s);
}

type Props = {
  src?: string;
  poster?: string;
  fallback?: string;
  alt: string;
  credit?: string;
};

export default function ModelViewer({ src, poster, fallback, alt, credit }: Props) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    ensureScript();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onError = () => setFailed(true);
    el.addEventListener("error", onError);
    return () => el.removeEventListener("error", onError);
  }, [src, failed]);

  if (!src || failed) {
    const img = fallback ?? poster;
    return (
      <div className="viewer viewer-fallback targeting-frame">
        {img ? <img src={img} alt={alt} /> : <div style={{ height: "100%" }} />}
        <span className="viewer-label">
          {failed ? "3D model unavailable — showing NASA imagery" : "Showing NASA imagery"}
        </span>
      </div>
    );
  }

  const Mv = "model-viewer" as unknown as React.FC<Record<string, unknown>>;

  const attrs: Record<string, unknown> = {
    src,
    alt,
    "camera-controls": "",
    "auto-rotate": "",
    "auto-rotate-delay": "900",
    "rotation-per-second": "16deg",
    "shadow-intensity": "1",
    "environment-image": "neutral",
    exposure: "1.05",
    "interaction-prompt": "auto",
    "camera-orbit": "35deg 68deg 2.6m",
  };
  if (poster) attrs.poster = poster;

  return (
    <div className="viewer targeting-frame">
      <Mv ref={ref as unknown as React.Ref<HTMLElement>} {...attrs} />
      <span className="viewer-hint">drag to rotate</span>
      <span className="viewer-label">{credit ?? "NASA 3D Resources"}</span>
    </div>
  );
}
