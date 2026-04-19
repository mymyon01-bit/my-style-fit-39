// ─── FIT 3D VIEWER ──────────────────────────────────────────────────────────
// Procedural R3F-based avatar + garment renderer. No external GLB required.
// Designed so that real GLB models can later be dropped into /public/models
// and swapped in without touching the page-level integration.

import { Suspense, useMemo, useEffect, useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, useTexture } from "@react-three/drei";
import * as THREE from "three";

import { bodyToAvatar, type UserBody, type AvatarMorph } from "@/lib/fit/bodyToAvatar";
import { sizeToMorph } from "@/lib/fit/sizeToMorph";
import { applyGarmentFit } from "@/lib/fit/applyGarmentFit";
import { getGarmentType, getGarmentSubtype } from "@/lib/fit/getGarmentType";
import { extractDominantColor } from "@/lib/fit/extractDominantColor";

interface Fit3DViewerProps {
  productImage?: string | null;
  productName?: string;
  category?: string | null;
  size: string;
  fitType?: "slim" | "regular" | "relaxed" | "oversized";
  body?: UserBody | null;
  /** controls camera framing — tops zoom upper, bottoms zoom lower, full = full body */
  height?: number; // px
}

export default function Fit3DViewer({
  productImage,
  productName,
  category,
  size,
  fitType = "regular",
  body,
  height = 460,
}: Fit3DViewerProps) {
  const garmentType = getGarmentType({ category, name: productName });
  const subtype = getGarmentSubtype({ category, name: productName });
  const avatarMorph = useMemo(() => bodyToAvatar(body), [body]);
  const sizeMorph = useMemo(() => sizeToMorph(size), [size]);
  const transform = useMemo(
    () => applyGarmentFit({ avatar: avatarMorph, size: sizeMorph, garmentType, fitType }),
    [avatarMorph, sizeMorph, garmentType, fitType]
  );

  // dominant color extraction for tinting fallback
  const [color, setColor] = useState<string>("#7d7a78");
  const [textureFailed, setTextureFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    if (productImage) {
      extractDominantColor(productImage).then((c) => alive && setColor(c));
    }
    setTextureFailed(false);
    return () => { alive = false; };
  }, [productImage]);

  // camera framing
  const cameraTarget: [number, number, number] =
    garmentType === "bottom" ? [0, -0.5, 0] :
    garmentType === "full" ? [0, 0, 0] :
    [0, 0.4, 0];
  const cameraPos: [number, number, number] =
    garmentType === "bottom" ? [0, -0.2, 3.0] :
    garmentType === "full" ? [0, 0.2, 3.4] :
    [0, 0.5, 2.6];

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-foreground/[0.05] bg-gradient-to-b from-foreground/[0.03] via-foreground/[0.015] to-foreground/[0.05]"
      style={{ height }}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: cameraPos, fov: 28 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
      >
        <color attach="background" args={["#0d0d10"]} />
        <Suspense fallback={null}>
          {/* studio lighting */}
          <ambientLight intensity={0.45} />
          <directionalLight
            position={[2.5, 4, 3]}
            intensity={1.1}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight position={[-3, 2, -1]} intensity={0.4} color="#aab8ff" />
          <Environment preset="studio" />

          <group position={[0, -0.9, 0]}>
            <Avatar morph={avatarMorph} />
            <Garment
              subtype={subtype}
              type={garmentType}
              transform={transform}
              productImage={productImage ?? undefined}
              fallbackColor={color}
              onTextureError={() => setTextureFailed(true)}
              textureFailed={textureFailed}
            />
            <ContactShadows
              position={[0, 0, 0]}
              opacity={0.35}
              scale={3}
              blur={2.4}
              far={2}
            />
          </group>

          <OrbitControls
            enablePan={false}
            enableZoom={false}
            target={cameraTarget}
            minPolarAngle={Math.PI / 2.6}
            maxPolarAngle={Math.PI / 1.9}
            minAzimuthAngle={-Math.PI / 4}
            maxAzimuthAngle={Math.PI / 4}
          />
          <SubtleSpin />
        </Suspense>
      </Canvas>

      {/* corner label */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/60 px-2 py-1 backdrop-blur-sm">
        <p className="text-[8.5px] font-bold tracking-[0.22em] text-foreground/75">
          3D FIT · SIZE {size.toUpperCase()}
        </p>
      </div>
    </div>
  );
}

// ─── AVATAR ───────────────────────────────────────────────────────────────
// Stylized procedural human built from primitives. Premium fashion-minimal,
// not game-like. All pieces respond to AvatarMorph.

function Avatar({ morph }: { morph: AvatarMorph }) {
  const skin = "#d6c0a8";

  return (
    <group scale={[1, morph.heightScale, 1]}>
      {/* head */}
      <mesh position={[0, 1.65, 0]} castShadow>
        <sphereGeometry args={[0.16, 32, 32]} />
        <meshStandardMaterial color={skin} roughness={0.75} />
      </mesh>
      {/* neck */}
      <mesh position={[0, 1.45, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.085, 0.14, 24]} />
        <meshStandardMaterial color={skin} roughness={0.8} />
      </mesh>
      {/* shoulders bar (visual anchor) */}
      <mesh position={[0, 1.32, 0]} scale={[morph.shoulderWidth, 1, 1]} castShadow>
        <capsuleGeometry args={[0.07, 0.42, 8, 16]} />
        <meshStandardMaterial color={skin} roughness={0.8} />
      </mesh>
      {/* torso (chest) */}
      <mesh position={[0, 1.05, 0]} scale={[morph.torsoWidth, 1, morph.torsoWidth * 0.85]} castShadow>
        <capsuleGeometry args={[0.22, 0.36, 12, 24]} />
        <meshStandardMaterial color={skin} roughness={0.78} />
      </mesh>
      {/* waist */}
      <mesh position={[0, 0.7, 0]} scale={[morph.waistWidth * 0.95, 1, morph.waistWidth * 0.78]} castShadow>
        <capsuleGeometry args={[0.2, 0.18, 10, 20]} />
        <meshStandardMaterial color={skin} roughness={0.8} />
      </mesh>
      {/* hips */}
      <mesh position={[0, 0.5, 0]} scale={[morph.hipWidth, 1, morph.hipWidth * 0.85]} castShadow>
        <capsuleGeometry args={[0.22, 0.1, 10, 20]} />
        <meshStandardMaterial color={skin} roughness={0.8} />
      </mesh>
      {/* arms */}
      <Arm side="left" shoulderWidth={morph.shoulderWidth} skin={skin} />
      <Arm side="right" shoulderWidth={morph.shoulderWidth} skin={skin} />
      {/* legs */}
      <Leg side="left" hipWidth={morph.hipWidth} legLength={morph.legLength} skin={skin} />
      <Leg side="right" hipWidth={morph.hipWidth} legLength={morph.legLength} skin={skin} />
    </group>
  );
}

function Arm({ side, shoulderWidth, skin }: { side: "left" | "right"; shoulderWidth: number; skin: string }) {
  const sign = side === "left" ? -1 : 1;
  return (
    <group position={[sign * 0.3 * shoulderWidth, 1.05, 0]}>
      <mesh castShadow position={[0, -0.25, 0]}>
        <capsuleGeometry args={[0.06, 0.5, 8, 16]} />
        <meshStandardMaterial color={skin} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Leg({ side, hipWidth, legLength, skin }: { side: "left" | "right"; hipWidth: number; legLength: number; skin: string }) {
  const sign = side === "left" ? -1 : 1;
  return (
    <group position={[sign * 0.11 * hipWidth, 0.35, 0]} scale={[1, legLength, 1]}>
      <mesh castShadow position={[0, -0.4, 0]}>
        <capsuleGeometry args={[0.085, 0.7, 10, 16]} />
        <meshStandardMaterial color={skin} roughness={0.85} />
      </mesh>
    </group>
  );
}

// ─── GARMENT ──────────────────────────────────────────────────────────────
// Procedural garment shells. Texture is attempted via useTexture; if it
// fails (CORS / 404), we silently fall back to dominant-color material.

interface GarmentProps {
  subtype: "tee" | "hoodie" | "jacket" | "pants" | "dress";
  type: "top" | "outerwear" | "bottom" | "full";
  transform: ReturnType<typeof applyGarmentFit>;
  productImage?: string;
  fallbackColor: string;
  onTextureError: () => void;
  textureFailed: boolean;
}

function Garment(props: GarmentProps) {
  const { subtype, transform, productImage, fallbackColor, textureFailed } = props;

  // Try to load texture (drei suspends; we wrap in our own boundary via key fallback)
  return (
    <Suspense fallback={<GarmentMesh {...props} useTexture={false} />}>
      {productImage && !textureFailed ? (
        <TexturedGarmentMesh {...props} url={productImage} />
      ) : (
        <GarmentMesh {...props} useTexture={false} />
      )}
    </Suspense>
  );
}

function TexturedGarmentMesh(props: GarmentProps & { url: string }) {
  // useTexture throws on load failure → caught by Suspense → fallback path.
  const tex = useTexture(props.url);
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  }, [tex]);
  return <GarmentMesh {...props} useTexture map={tex} />;
}

function GarmentMesh({
  subtype,
  type,
  transform,
  fallbackColor,
  useTexture: hasTex,
  map,
}: GarmentProps & { useTexture: boolean; map?: THREE.Texture }) {
  const material = (
    <meshPhysicalMaterial
      color={hasTex ? "#ffffff" : fallbackColor}
      map={hasTex ? map : undefined}
      roughness={transform.roughness}
      clearcoat={transform.clearcoat}
      metalness={0}
      side={THREE.DoubleSide}
    />
  );

  const [sx, sy, sz] = transform.scale;
  const [px, py, pz] = transform.position;

  if (type === "bottom" || subtype === "pants") {
    return (
      <group position={[px, py, pz]} scale={[sx, sy, sz]}>
        {/* waistband */}
        <mesh position={[0, 0.46, 0]}>
          <torusGeometry args={[0.24, 0.03, 12, 32]} />
          {material}
        </mesh>
        {/* legs */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.11, 0.05, 0]}>
            <cylinderGeometry args={[0.11, 0.13, 0.85, 18]} />
            {material}
          </mesh>
        ))}
      </group>
    );
  }

  if (subtype === "dress" || type === "full") {
    return (
      <group position={[px, py, pz]} scale={[sx, sy, sz]}>
        <mesh>
          <cylinderGeometry args={[0.27, 0.4, 1.1, 32, 1, false]} />
          {material}
        </mesh>
        {/* shoulder caps */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.27, 0.5, 0]}>
            <sphereGeometry args={[0.09, 16, 16]} />
            {material}
          </mesh>
        ))}
      </group>
    );
  }

  // TOP / OUTERWEAR — body + sleeves (+ hood for hoodie)
  return (
    <group position={[px, py, pz]} scale={[sx, sy, sz]}>
      {/* body */}
      <mesh>
        <capsuleGeometry args={[0.27, 0.5, 12, 28]} />
        {material}
      </mesh>
      {/* hem flare for drape */}
      <mesh position={[0, -0.32, 0]}>
        <cylinderGeometry args={[0.3, 0.34, 0.12, 28, 1, true]} />
        {material}
      </mesh>
      {/* sleeves */}
      {[-1, 1].map((s) => (
        <group
          key={s}
          position={[s * 0.32, 0.18 + transform.shoulderDrop, 0]}
          rotation={[0, 0, s * 0.18]}
        >
          <mesh position={[s * 0.05, -0.22 * transform.limbScale, 0]} scale={[1, transform.limbScale, 1]}>
            <capsuleGeometry args={[0.085, 0.42, 8, 16]} />
            {material}
          </mesh>
        </group>
      ))}
      {/* hood */}
      {subtype === "hoodie" && (
        <mesh position={[0, 0.42, -0.09]}>
          <sphereGeometry args={[0.21, 18, 18, 0, Math.PI * 2, 0, Math.PI / 1.6]} />
          {material}
        </mesh>
      )}
      {/* jacket lapel hint */}
      {subtype === "jacket" && (
        <mesh position={[0, 0.2, 0.18]}>
          <boxGeometry args={[0.36, 0.32, 0.02]} />
          {material}
        </mesh>
      )}
    </group>
  );
}

// ─── SUBTLE SPIN ─────────────────────────────────────────────────────────
// Very gentle idle rotation so the user perceives 3D depth on first paint.

function SubtleSpin() {
  const ref = useRef<{ azimuth: number }>({ azimuth: 0 });
  useFrame((state, delta) => {
    ref.current.azimuth += delta * 0.05;
    state.camera.position.x = Math.sin(ref.current.azimuth * 0.15) * 0.4 + state.camera.position.x * 0.99;
  });
  return null;
}
