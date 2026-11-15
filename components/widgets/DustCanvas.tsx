"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Solar Panel Dusting Canvas — drag to wipe #B45309 regolith off the arrays.
 * Power is derived from the cleared-pixel ratio, exactly as specified.
 */
export default function DustCanvas({
  image,
  minPower = 132,
  maxPower = 600,
}: {
  image?: string;
  minPower?: number;
  maxPower?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef(false);
  const [efficiency, setEfficiency] = useState(0);
  const [seed, setSeed] = useState(0);
  const [completionToast, setCompletionToast] = useState(false);

  const paintDust = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "rgba(180, 83, 9, 0.94)";
    ctx.fillRect(0, 0, rect.width, rect.height);

    for (let i = 0; i < 1100; i++) {
      const x = Math.random() * rect.width;
      const y = Math.random() * rect.height;
      const r = Math.random() * 2.4 + 0.4;
      ctx.fillStyle = `rgba(${110 + Math.floor(Math.random() * 70)},${40 + Math.floor(Math.random() * 30)},${6},${0.12 + Math.random() * 0.28})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    setEfficiency(0);
  }, []);

  useEffect(() => {
    paintDust();
    const onResize = () => paintDust();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [paintDust, seed]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { width, height } = canvas;
      if (width === 0 || height === 0) return;
      const data = ctx.getImageData(0, 0, width, height).data;
      let clear = 0;
      let total = 0;
      for (let i = 3; i < data.length; i += 4 * 8) {
        total += 1;
        if (data[i] < 40) clear += 1;
      }
      setEfficiency(total ? clear / total : 0);
    }, 320);
    return () => window.clearInterval(timer);
  }, [seed]);

  useEffect(() => {
    if (efficiency >= 0.85) setCompletionToast(true);
  }, [efficiency]);

  const erase = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const radius = 30;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  };

  const operateWindCleaner = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    for (const fraction of [0.22, 0.5, 0.78]) {
      const y = rect.top + rect.height * fraction;
      for (let x = rect.left - 24; x < rect.right + 24; x += 18) erase(x, y);
    }
  };

  const power = Math.round(minPower + (maxPower - minPower) * Math.min(efficiency / 0.85, 1));
  const powerEfficiency = Math.round((power / maxPower) * 100);
  const soilCoverage = Math.round(78 * (1 - Math.min(efficiency / 0.85, 1)));
  const done = efficiency >= 0.85;

  return (
    <div className="widget">
      <div className="widget-head">
        <div>
          <div className="widget-title">Mars Solar Dust &amp; Power</div>
          <div className="widget-sub">Drag to sweep away simulated Martian regolith · 85 μm dust layer</div>
        </div>
      </div>

      <div className="experiment-story-box">
        <span>WHAT IS THIS EXPERIMENT?</span>
        <p>Mars can be swept by fine red dust that coats solar panels and cuts the sunlight a rover can use. Wipe the simulated dust or run the wind cleaner, then watch the power efficiency readout respond.</p>
      </div>

      <div className="dust-actions">
        <button className="btn btn-blue btn-sm" onClick={operateWindCleaner}>OPERATE WIND CLEANER</button>
        <button className="btn btn-sm" onClick={() => { setCompletionToast(false); setSeed((s) => s + 1); }}>RESET DUST</button>
      </div>

      <div className="dust-wrap" ref={wrapRef}>
        {image ? (
          <img className="dust-photo" src={image} alt="" aria-hidden="true" />
        ) : (
          <div className="dust-photo dust-photo-empty" />
        )}
        <canvas
          ref={canvasRef}
          className="dust-canvas"
          onPointerDown={(e) => {
            drawing.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            erase(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (drawing.current) erase(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            drawing.current = false;
          }}
          onPointerLeave={() => {
            drawing.current = false;
          }}
        />
      </div>

      <div className="widget-stats">
        <div className="widget-stat">
          <span className="widget-stat-value">{soilCoverage}%</span>
          <span className="widget-stat-label">SOIL COVERAGE</span>
        </div>
        <div className="widget-stat">
          <span className="widget-stat-value power-efficiency">{powerEfficiency}%</span>
          <span className="widget-stat-label">POWER EFFICIENCY</span>
        </div>
        <div className={`widget-status ${done ? "is-ok" : ""}`}>
          {done ? `Arrays cleared. ${power} Wh per day restored.` : `Power output ${power} Wh per day. Clear dust to recharge.`}
        </div>
      </div>
      {completionToast ? <div className="dust-toast" role="status">Solar arrays cleared · power restored to {maxPower} Wh/day</div> : null}
    </div>
  );
}
