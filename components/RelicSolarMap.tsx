"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { Item, ZoneSummary } from "@/lib/types";
import { sectorPosition, zoneMeta, type ZoneMeta } from "@/lib/zones";

const OVERVIEW_POS = new THREE.Vector3(0, 12, 26);
const ORIGIN = new THREE.Vector3(0, 0, 0);
const AMBER = "#F59E0B";

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

type WorldKind = "sun" | "earth" | "moon" | "mars";

function makeWorldMaps(kind: WorldKind) {
  const width = 1024;
  const height = 512;
  const mapCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  const map = mapCanvas.getContext("2d");
  const bump = bumpCanvas.getContext("2d");
  if (!map || !bump) return null;
  mapCanvas.width = bumpCanvas.width = width;
  mapCanvas.height = bumpCanvas.height = height;

  let seed = kind === "earth" ? 127 : kind === "moon" ? 811 : kind === "mars" ? 493 : 202;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const polygon = (ctx: CanvasRenderingContext2D, points: [number, number][], color: string) => {
    ctx.beginPath();
    points.forEach(([x, y], index) => {
      const px = x * width;
      const py = y * height;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  if (kind === "earth") {
    const ocean = map.createLinearGradient(0, 0, 0, height);
    ocean.addColorStop(0, "#b8d8e8");
    ocean.addColorStop(0.13, "#14516f");
    ocean.addColorStop(0.55, "#075078");
    ocean.addColorStop(0.87, "#114b68");
    ocean.addColorStop(1, "#d9e8ed");
    map.fillStyle = ocean;
    map.fillRect(0, 0, width, height);
    bump.fillStyle = "#626262";
    bump.fillRect(0, 0, width, height);
    const continents: [number, number][][] = [
      [[.08,.22],[.13,.17],[.18,.19],[.2,.24],[.25,.25],[.27,.3],[.24,.34],[.22,.4],[.18,.42],[.16,.48],[.13,.45],[.12,.38],[.09,.34]],
      [[.23,.48],[.28,.47],[.3,.52],[.29,.59],[.27,.67],[.24,.73],[.22,.68],[.23,.6],[.21,.55]],
      [[.42,.23],[.46,.19],[.5,.21],[.53,.25],[.58,.25],[.62,.3],[.6,.36],[.55,.37],[.53,.43],[.49,.45],[.47,.39],[.43,.37],[.4,.31]],
      [[.48,.45],[.53,.44],[.57,.48],[.56,.56],[.53,.64],[.51,.73],[.48,.69],[.46,.6],[.45,.52]],
      [[.6,.29],[.67,.27],[.72,.3],[.76,.34],[.82,.35],[.84,.4],[.8,.44],[.74,.43],[.7,.47],[.66,.43],[.63,.38]],
      [[.79,.56],[.83,.53],[.87,.55],[.89,.61],[.86,.68],[.82,.7],[.79,.65]],
      [[.03,.53],[.07,.5],[.1,.53],[.1,.58],[.06,.61],[.02,.59]],
    ];
    continents.forEach((shape, index) => {
      polygon(map, shape, index % 2 ? "#66865b" : "#76945c");
      polygon(bump, shape, "#b8b8b8");
      map.save();
      map.globalAlpha = 0.35;
      polygon(map, shape.map(([x, y]) => [x + .004, y + .006] as [number, number]), "#c4a977");
      map.restore();
    });
    map.fillStyle = "rgba(245,250,252,.94)";
    map.fillRect(0, 0, width, 24);
    map.fillRect(0, height - 24, width, 24);
    for (let i = 0; i < 58; i++) {
      const x = random() * width;
      const y = random() * height;
      const r = 8 + random() * 42;
      map.fillStyle = `rgba(230,246,250,${0.04 + random() * 0.15})`;
      map.beginPath(); map.ellipse(x, y, r * 1.8, r * .55, random() * 2, 0, Math.PI * 2); map.fill();
    }
  } else if (kind === "moon") {
    const lunar = map.createLinearGradient(0, 0, width, height);
    lunar.addColorStop(0, "#aaa9a4"); lunar.addColorStop(.5, "#777873"); lunar.addColorStop(1, "#c5c2b9");
    map.fillStyle = lunar; map.fillRect(0, 0, width, height);
    bump.fillStyle = "#777"; bump.fillRect(0, 0, width, height);
    // Maria: broad, low-contrast basalt seas.
    [[.24,.36,.16,.105],[.44,.52,.12,.09],[.68,.34,.18,.11],[.79,.58,.1,.07],[.13,.62,.11,.07]].forEach(([x,y,rx,ry]) => {
      map.fillStyle = "rgba(47,49,48,.62)"; map.beginPath(); map.ellipse(x*width,y*height,rx*width,ry*height,-.2,0,Math.PI*2); map.fill();
      bump.fillStyle = "#555"; bump.beginPath(); bump.ellipse(x*width,y*height,rx*width,ry*height,-.2,0,Math.PI*2); bump.fill();
    });
    for (let i = 0; i < 170; i++) {
      const x = random() * width, y = 28 + random() * (height - 56), r = 3 + random() * 22;
      const shade = Math.floor(105 + random() * 95);
      const crater = map.createRadialGradient(x-r*.22,y-r*.3,r*.22,x,y,r);
      crater.addColorStop(0, `rgba(28,29,29,.7)`); crater.addColorStop(.68, `rgba(${shade},${shade},${shade-4},.25)`); crater.addColorStop(.9,"rgba(239,236,226,.8)"); crater.addColorStop(1,"rgba(62,64,63,.62)");
      map.fillStyle = crater; map.beginPath(); map.ellipse(x,y,r,r*(.68+random()*.3),random()*.3,0,Math.PI*2); map.fill();
      bump.strokeStyle = "#e2e2e2"; bump.lineWidth = Math.max(2,r*.12); bump.beginPath(); bump.ellipse(x,y,r,r*.76,0,0,Math.PI*2); bump.stroke();
      bump.fillStyle = "#4c4c4c"; bump.beginPath(); bump.ellipse(x,y,r*.73,r*.53,0,0,Math.PI*2); bump.fill();
    }
  } else if (kind === "mars") {
    const rust = map.createLinearGradient(0, 0, width, height);
    rust.addColorStop(0, "#9a3412"); rust.addColorStop(.32, "#d95326"); rust.addColorStop(.68, "#bd4b24"); rust.addColorStop(1, "#7c2d12");
    map.fillStyle = rust; map.fillRect(0, 0, width, height);
    bump.fillStyle = "#878787"; bump.fillRect(0, 0, width, height);
    polygon(map, [[.08,.35],[.18,.31],[.29,.34],[.4,.32],[.49,.37],[.57,.35],[.69,.39],[.8,.36],[.94,.4],[.92,.46],[.78,.44],[.66,.49],[.53,.45],[.41,.48],[.29,.42],[.17,.45],[.08,.41]], "rgba(75,35,24,.72)");
    polygon(bump, [[.08,.35],[.18,.31],[.29,.34],[.4,.32],[.49,.37],[.57,.35],[.69,.39],[.8,.36],[.94,.4],[.92,.46],[.78,.44],[.66,.49],[.53,.45],[.41,.48],[.29,.42],[.17,.45],[.08,.41]], "#626262");
    // Valles Marineris and branching canyon streaks.
    map.strokeStyle = "rgba(69,30,23,.82)"; map.lineWidth = 10; map.lineCap = "round";
    map.beginPath(); map.moveTo(width*.1,height*.55); map.bezierCurveTo(width*.35,height*.49,width*.53,height*.58,width*.9,height*.5); map.stroke();
    bump.strokeStyle = "#454545"; bump.lineWidth = 14; bump.beginPath(); bump.moveTo(width*.1,height*.55); bump.bezierCurveTo(width*.35,height*.49,width*.53,height*.58,width*.9,height*.5); bump.stroke();
    map.fillStyle = "#f0e8d4"; map.beginPath(); map.ellipse(width*.5, 14, width*.18, 28, 0, 0, Math.PI*2); map.fill();
    map.beginPath(); map.ellipse(width*.5, height-14, width*.2, 30, 0, 0, Math.PI*2); map.fill();
    for (let i=0;i<115;i++) { const x=random()*width,y=45+random()*(height-90),r=3+random()*13; map.fillStyle=`rgba(90,39,24,${.12+random()*.3})`; map.beginPath(); map.ellipse(x,y,r,r*.5,random(),0,Math.PI*2); map.fill(); bump.fillStyle="#b0b0b0"; bump.beginPath(); bump.arc(x,y,r*.8,0,Math.PI*2); bump.stroke(); }
  } else {
    const solar = map.createRadialGradient(width*.45,height*.45,10,width*.5,height*.5,width*.6);
    solar.addColorStop(0,"#fff4b0"); solar.addColorStop(.35,"#ffc447"); solar.addColorStop(.72,"#e98216"); solar.addColorStop(1,"#8f310b");
    map.fillStyle=solar; map.fillRect(0,0,width,height); bump.fillStyle="#a0a0a0"; bump.fillRect(0,0,width,height);
    for(let i=0;i<260;i++){const x=random()*width,y=random()*height; map.strokeStyle=`rgba(255,${120+Math.floor(random()*110)},35,${.1+random()*.45})`;map.lineWidth=1+random()*4;map.beginPath();map.moveTo(x,y);map.bezierCurveTo(x+18,y-18,x+42,y+14,x+72,y-10);map.stroke();}
  }

  const makeTexture = (canvas: HTMLCanvasElement, color: boolean) => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  };
  return { map: makeTexture(mapCanvas, true), bump: makeTexture(bumpCanvas, false) };
}

function World({ kind, radius, rotationSpeed = 0.04 }: { kind: WorldKind; radius: number; rotationSpeed?: number }) {
  const group = useRef<THREE.Group>(null);
  const maps = useMemo(() => makeWorldMaps(kind), [kind]);
  useFrame((_, dt) => { if (group.current) group.current.rotation.y += dt * rotationSpeed; });
  useEffect(() => () => { maps?.map.dispose(); maps?.bump.dispose(); }, [maps]);
  if (!maps) return null;
  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[radius, 96, 64]} />
        <meshStandardMaterial map={maps.map} bumpMap={maps.bump} bumpScale={kind === "moon" ? 0.045 : kind === "mars" ? 0.035 : 0.015} roughness={kind === "sun" ? 0.55 : 0.88} metalness={kind === "moon" ? 0.08 : 0.02} emissive={kind === "sun" ? "#b45309" : "#000000"} emissiveIntensity={kind === "sun" ? 0.24 : 0} />
      </mesh>
      {kind === "earth" ? <CloudLayer radius={radius * 1.025} /> : null}
    </group>
  );
}

function CloudLayer({ radius }: { radius: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext("2d"); if (!ctx) return null;
    let seed = 191; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 260; i++) { const x=rand()*1024,y=rand()*512,r=8+rand()*42; const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(245,250,255,${.18+rand()*.28})`);g.addColorStop(1,"rgba(245,250,255,0)");ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,r*1.8,r*.5,rand()*2,0,Math.PI*2);ctx.fill(); }
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }, []);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.055; });
  useEffect(() => () => texture?.dispose(), [texture]);
  return <mesh ref={ref} scale={1.08}><sphereGeometry args={[radius, 64, 48]} /><meshBasicMaterial map={texture ?? undefined} transparent opacity={0.5} depthWrite={false} /></mesh>;
}

/* ------------------------------------------------------------------ */
/* camera                                                              */
/* ------------------------------------------------------------------ */

function Rig({ target }: { target: ZoneMeta | null }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as
    | { target: THREE.Vector3; update: () => void }
    | null;

  const progress = useRef(1);
  const fromPos = useRef(OVERVIEW_POS.clone());
  const fromTarget = useRef(ORIGIN.clone());

  const { toPos, toTarget } = useMemo(() => {
    if (!target) {
      return { toPos: OVERVIEW_POS.clone(), toTarget: ORIGIN.clone() };
    }
    const base = new THREE.Vector3(...sectorPosition(target));
    const dir = base.clone().normalize();
    const distance = target.hasBody ? target.bodyRadius * 6 + 1.6 : 4.6;
    const pos = base
      .clone()
      .add(dir.multiplyScalar(distance))
      .add(new THREE.Vector3(0, target.hasBody ? target.bodyRadius * 2.2 : 1.4, 0));
    return { toPos: pos, toTarget: base };
  }, [target]);

  useEffect(() => {
    fromPos.current.copy(camera.position);
    fromTarget.current.copy(controls?.target ?? ORIGIN);
    progress.current = 0;
  }, [target, camera, controls]);

  useFrame((_, dt) => {
    if (progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + dt / 1.1);
    const t = easeInOutCubic(progress.current);
    camera.position.lerpVectors(fromPos.current, toPos, t);
    if (controls) {
      controls.target.lerpVectors(fromTarget.current, toTarget, t);
      controls.update();
    }
  });

  return null;
}

/* ------------------------------------------------------------------ */
/* labels (canvas textures — no DOM portals, so no React root churn)   */
/* ------------------------------------------------------------------ */

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function LabelSprite({
  text,
  active = false,
  color = "#CBD5E1",
  size = 0.24,
  position = [0, 0, 0],
}: {
  text: string;
  active?: boolean;
  color?: string;
  size?: number;
  position?: [number, number, number];
}) {
  const texture = useMemo(() => {
    const fontSize = 46;
    const padX = 26;
    const padY = 16;
    const measure = document.createElement("canvas").getContext("2d");
    if (!measure) return null;
    measure.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
    const width = Math.ceil(measure.measureText(text).width) + padX * 2;
    const height = fontSize + padY * 2;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.fillStyle = active ? "rgba(251, 191, 36, 0.96)" : "rgba(4, 6, 13, 0.86)";
    roundedRect(ctx, 3, 3, width - 6, height - 6, height / 2);
    ctx.fill();
    ctx.strokeStyle = active ? "#FEF3C7" : "rgba(56, 189, 248, 0.38)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = active ? "#04060D" : color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, width / 2, height / 2 + 1);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }, [text, active, color]);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  if (!texture || !texture.image) return null;
  const aspect = texture.image.width / texture.image.height;

  return (
    <sprite position={position} scale={[size * aspect, size, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} depthTest={false} toneMapped={false} />
    </sprite>
  );
}

/* ------------------------------------------------------------------ */
/* scene pieces                                                        */
/* ------------------------------------------------------------------ */

function Sun() {
  const corona = useRef<THREE.Group>(null);
  const flare = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (corona.current) corona.current.rotation.y = t * 0.025;
    if (flare.current) flare.current.scale.setScalar(1.48 + Math.sin(t * 1.25) * 0.07);
  });
  return (
    <group>
      <World kind="sun" radius={0.9} rotationSpeed={0.018} />
      <group ref={corona}>
        <mesh ref={flare} scale={1.48}>
          <sphereGeometry args={[0.9, 32, 32]} />
          <meshBasicMaterial color="#F59E0B" transparent opacity={0.12} side={THREE.BackSide} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh scale={2.12}>
          <sphereGeometry args={[0.9, 32, 32]} />
          <meshBasicMaterial color="#B45309" transparent opacity={0.055} side={THREE.BackSide} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.24, 0.012, 6, 96]} />
          <meshBasicMaterial color="#FBBF24" transparent opacity={0.5} toneMapped={false} />
        </mesh>
      </group>
      <pointLight color="#FDBA38" intensity={4.5} distance={70} decay={2} />
      <LabelSprite text="THE SUN" color="#FCD34D" size={0.3} position={[0, 1.45, 0]} />
    </group>
  );
}

function OrbitRing({ radius }: { radius: number }) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push([Math.cos(a) * radius, 0, Math.sin(a) * radius]);
    }
    return pts;
  }, [radius]);

  return <Line points={points} color="#94A3B8" lineWidth={1.1} transparent opacity={0.28} />;
}

function Atmosphere({ meta }: { meta: ZoneMeta }) {
  return (
    <mesh scale={1.14}>
      <sphereGeometry args={[meta.bodyRadius, 32, 32]} />
      <meshBasicMaterial
        color={meta.atmosphere}
        transparent
        opacity={0.14}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function PlanetBody({ meta }: { meta: ZoneMeta }) {
  const kind: WorldKind | null =
    meta.id === "moon" ? "moon" : meta.id === "mars" ? "mars" : meta.id === "earth-orbit" ? "earth" : null;
  return (
    <>
      {kind ? (
        <World kind={kind} radius={meta.bodyRadius} rotationSpeed={kind === "moon" ? 0.012 : 0.035} />
      ) : (
        <mesh>
          <sphereGeometry args={[meta.bodyRadius, 48, 40]} />
          <meshStandardMaterial color={meta.bodyColor} roughness={0.78} metalness={0.06} />
        </mesh>
      )}
      {kind === "earth" ? (
        <mesh scale={1.16}>
          <sphereGeometry args={[meta.bodyRadius, 48, 40]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.12} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      ) : null}
      <Atmosphere meta={meta} />
    </>
  );
}

function Beacon({ meta, active }: { meta: ZoneMeta; active: boolean }) {
  const pulse = useRef<THREE.Mesh>(null);
  const dot = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 2.2;
    if (pulse.current) pulse.current.scale.setScalar(1 + Math.sin(t) * 0.18 + (active ? 0.2 : 0));
    if (dot.current) dot.current.scale.setScalar(1 + Math.abs(Math.sin(t)) * 0.2);
  });

  const base = meta.hasBody ? meta.bodyRadius * 0.94 : 0.15;
  const ringInner = meta.hasBody ? 0.1 : 0.13;

  return (
    <group position={[0, base, 0]}>
      <mesh ref={dot}>
        <sphereGeometry args={[0.035, 10, 10]} />
        <meshStandardMaterial color="#B45309" emissive={AMBER} emissiveIntensity={2.6} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ringInner, ringInner + 0.028, 40]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={pulse} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ringInner + 0.05, ringInner + 0.062, 40]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight color={AMBER} intensity={active ? 1.5 : 0.9} distance={2.4} />
    </group>
  );
}

function SatelliteRing({ radius }: { radius: number }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.14;
  });

  const dots = useMemo(() => Array.from({ length: 40 }, (_, i) => (i / 40) * Math.PI * 2), []);

  return (
    <group ref={ref} rotation={[Math.PI / 2.8, 0, 0.22]}>
      {dots.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * radius, 0, Math.sin(a) * radius]}>
          <boxGeometry args={[0.045, 0.045, 0.09]} />
          <meshStandardMaterial color="#93C5FD" emissive="#38BDF8" emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function ProbeCraft({ pioneer = false }: { pioneer?: boolean }) {
  const craft = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (craft.current) craft.current.rotation.z = Math.sin(clock.elapsedTime * .4) * .025; });
  const gold = pioneer ? "#D6A84F" : "#E7BD57";
  return (
    <group ref={craft} rotation={[0.28, 0.3, -0.18]} scale={pioneer ? 0.72 : 0.82}>
      <mesh>
        <boxGeometry args={[0.24, 0.26, 0.2]} />
        <meshStandardMaterial color={gold} metalness={0.78} roughness={0.3} emissive="#754b10" emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.35, 0.075, 32, 1, true]} />
        <meshStandardMaterial color="#d9d7c9" side={THREE.DoubleSide} metalness={0.6} roughness={0.36} />
      </mesh>
      <mesh position={[0, 0.01, 0.24]}>
        <cylinderGeometry args={[0.018, 0.018, 0.34, 8]} />
        <meshStandardMaterial color="#d8b65d" metalness={0.65} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.48, 0, -0.02]}>
          <mesh><boxGeometry args={[0.68, 0.018, 0.3]} /><meshStandardMaterial color="#1d3552" metalness={0.55} roughness={0.4} /></mesh>
          {[-0.22, 0, 0.22].map((x) => <mesh key={x} position={[x, 0.012, 0]}><boxGeometry args={[0.012, 0.008, 0.28]} /><meshBasicMaterial color="#93c5fd" /></mesh>)}
          <mesh position={[side * 0.45, 0, 0]}><cylinderGeometry args={[0.045, 0.045, 0.18, 10]} /><meshStandardMaterial color="#c58b27" metalness={0.8} /></mesh>
        </group>
      ))}
      <mesh position={[0, -0.2, -0.05]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.035, 0.035, 0.38, 8]} /><meshStandardMaterial color="#9b762f" metalness={0.7} /></mesh>
    </group>
  );
}

function SectorBody({
  meta,
  active,
  onSelect,
  children,
}: {
  meta: ZoneMeta;
  active: boolean;
  onSelect: (id: string) => void;
  children?: React.ReactNode;
}) {
  const pos = sectorPosition(meta);

  return (
    <group
      position={pos}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(meta.id);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {children}
      <Beacon meta={meta} active={active} />
      <LabelSprite
        text={meta.label.toUpperCase()}
        active={active}
        color={meta.rimHex}
        size={0.22}
        position={[0, meta.labelOffset + (meta.hasBody ? meta.bodyRadius : 0.2), 0]}
      />
    </group>
  );
}

function EscapeTrajectories({ items, onSelect }: { items: Item[]; onSelect: (id: string) => void }) {
  const routes = useMemo(() => items.map((item, index) => {
    const pair = Math.floor(index / 2);
    const angle = 0.52 + pair * 0.42 + (index % 2) * Math.PI;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const normal = new THREE.Vector3(-direction.z, index % 2 ? 0.2 : -0.2, direction.x).normalize();
    const start = new THREE.Vector3(2.05, 0.12 + (index % 3) * 0.08, 0.5);
    const distance = 10.5 + pair * 2.4 + (index % 2) * 0.7;
    const points: THREE.Vector3[] = [];
    for (let step = 0; step <= 80; step++) {
      const t = step / 80;
      // A swept conic that accelerates outward and bends away from the Sun.
      const radius = distance * (0.12 * t + 0.88 * t * t);
      const bend = Math.sinh(t * 1.25) * 0.38;
      points.push(start.clone().addScaledVector(direction, radius).addScaledVector(normal, bend));
    }
    return { item, points, end: points[points.length - 1], normal, index };
  }), [items]);

  return (
    <group>
      {routes.map(({ item, points, end, normal, index }) => (
        <group key={item.id}>
          <Line
            points={points}
            color={index % 2 === 0 ? "#38BDF8" : "#A78BFA"}
            lineWidth={1.45}
            transparent
            opacity={0.78}
          />
          <Line points={points.slice(0, 2)} color="#F8FAFC" lineWidth={2} transparent opacity={0.9} />
          <group
            position={end}
            onPointerDown={(event) => {
              event.stopPropagation();
              onSelect("deep-space");
            }}
            onPointerOver={() => { document.body.style.cursor = "pointer"; }}
            onPointerOut={() => { document.body.style.cursor = "auto"; }}
          >
            <ProbeCraft pioneer={/pioneer/i.test(item.id + item.short_name)} />
            <pointLight color={index % 2 === 0 ? "#38BDF8" : "#A78BFA"} intensity={0.7} distance={1.8} />
            <LabelSprite
              text={item.short_name.toUpperCase()}
              color={index % 2 === 0 ? "#BAE6FD" : "#DDD6FE"}
              size={0.15}
              position={[normal.x * 0.72, 0.38 + (index % 3) * 0.15, normal.z * 0.72]}
            />
          </group>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* panel                                                               */
/* ------------------------------------------------------------------ */

function RelicPanel({
  items,
  zone,
  meta,
  onClose,
}: {
  items: Item[];
  zone: string | null;
  meta: ZoneMeta | null;
  onClose: () => void;
}) {
  const list = zone ? items.filter((i) => i.zone === zone) : [];

  return (
    <aside className={`relic-panel ${zone ? "is-open" : ""}`} aria-hidden={!zone}>
      <div className="relic-panel-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            {meta ? meta.hall : "Sector"}
          </div>
          <h3 style={{ margin: 0 }}>{meta ? meta.label : ""}</h3>
          <p className="card-meta" style={{ margin: "4px 0 0" }}>
            {list.length} abandoned {list.length === 1 ? "relic" : "relics"}
          </p>
        </div>
        <button className="tab" onClick={onClose} aria-label="Close sector panel">
          ✕
        </button>
      </div>

      <div className="relic-list">
        {list.map((item) => (
          <div key={item.id} className="relic-item">
            {item.images[0] ? (
              <img src={item.images[0].src} alt={item.images[0].caption} />
            ) : (
              <div className="relic-thumb-empty" />
            )}
            <div className="relic-item-body">
              <strong>{item.short_name}</strong>
              <span className="card-meta">{item.years_active}</span>
              <Link href={`/item/${item.id}`} className="btn btn-sm">
                Inspect 3D Relic →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <p className="relic-panel-foot">{meta ? meta.tagline : ""}</p>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* exported                                                            */
/* ------------------------------------------------------------------ */

export default function RelicSolarMap({
  items,
  zones,
}: {
  items: Item[];
  zones: ZoneSummary[];
}) {
  const [active, setActive] = useState<string | null>(null);

  const liveZones = useMemo(
    () =>
      zones
        .filter((z) => z.item_count > 0)
        .map((z) => ({ summary: z, meta: zoneMeta(z.id) })),
    [zones]
  );

  const activeMeta = active ? zoneMeta(active) : null;
  const deepSpaceItems = useMemo(() => items.filter((item) => item.zone === "deep-space"), [items]);

  const orbitRadii = useMemo(
    () => Array.from(new Set(liveZones.filter((z) => z.meta.hasBody).map((z) => z.meta.orbitRadius))),
    [liveZones]
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const zone of zones) map[zone.id] = zone.item_count;
    return map;
  }, [zones]);

  return (
    <div className="relic-map targeting-frame">
      <div className="map-canvas">
        <Canvas camera={{ position: [0, 12, 26], fov: 45 }} dpr={[1, 2]} gl={{ alpha: true }}>
          <fog attach="fog" args={["#04060D", 34, 78]} />

          <ambientLight intensity={0.48} color="#a8b8ff" />
          <directionalLight position={[6, 10, 8]} intensity={0.92} color="#fff0cf" />
          <Stars radius={110} depth={50} count={2600} factor={3.4} fade speed={0.45} />

          <Sun />
          {orbitRadii.map((r) => (
            <OrbitRing key={r} radius={r} />
          ))}

          {liveZones.map(({ meta }) =>
            meta.hasBody ? (
              <SectorBody key={meta.id} meta={meta} active={active === meta.id} onSelect={setActive}>
                <PlanetBody meta={meta} />
                {meta.id === "earth-orbit" ? <SatelliteRing radius={meta.bodyRadius * 1.9} /> : null}
              </SectorBody>
            ) : (
              <SectorBody key={meta.id} meta={meta} active={active === meta.id} onSelect={setActive} />
            )
          )}

          {deepSpaceItems.length ? <EscapeTrajectories items={deepSpaceItems} onSelect={setActive} /> : null}

          <Rig target={activeMeta} />

          <OrbitControls
            makeDefault
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            minDistance={2.5}
            maxDistance={48}
            maxPolarAngle={Math.PI / 1.8}
          />
        </Canvas>

        <div className="map-hud" aria-live="polite">
          <div className="map-hud-kicker"><span className="hud-live-dot" /> DEEP SPACE TRACKING</div>
          <strong>{activeMeta ? activeMeta.label : "SOLAR SYSTEM OVERVIEW"}</strong>
          <div className="map-hud-readouts">
            <span><small>SECTOR OBJECTS</small><b>{active ? counts[active] ?? 0 : items.length}</b></span>
            <span><small>VECTOR POSITION</small><b>{activeMeta ? `${(Math.cos(activeMeta.angle) * activeMeta.orbitRadius).toFixed(2)}, ${(Math.sin(activeMeta.angle) * activeMeta.orbitRadius).toFixed(2)}` : "ORIGIN / 00"}</b></span>
            <span><small>CAMERA MODE</small><b>{active ? "SECTOR LOCK" : "SYSTEM SCAN"}</b></span>
          </div>
        </div>

        <div className="map-hint">
          DRAG TO ORBIT <span>·</span> SELECT A SECTOR TO FLY IN
        </div>

        <button
          className={`btn btn-sm map-reset ${active ? "is-visible" : ""}`}
          onClick={() => setActive(null)}
        >
          ← Overview
        </button>

        <div className="sector-tabs">
          {liveZones.map(({ meta }) => (
            <button
              key={meta.id}
              className={`tab ${active === meta.id ? "is-active" : ""}`}
              onClick={() => setActive(meta.id)}
              style={active === meta.id ? { borderColor: meta.rimHex, color: meta.rimHex } : undefined}
            >
              {meta.label}
              <span className="sector-count">{counts[meta.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <RelicPanel items={items} zone={active} meta={activeMeta} onClose={() => setActive(null)} />
    </div>
  );
}
