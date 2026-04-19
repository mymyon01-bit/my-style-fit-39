// ─── FIT 3D VIEWER ──────────────────────────────────────────────────────────
// Procedural R3F-based avatar + draped garment renderer.
// Realism upgrades:
//   • Per-region drape (chest bulge / waist taper / hem flare)
//   • Soft fabric material (high roughness, no metalness, smooth normals)
//   • Breathing + slow drift idle motion
//   • Soft key + rim lighting, fashion-studio look
//   • Texture aspect-ratio guard → chest "patch" only, never full-body stretch

import { Suspense, useMemo, useEffect, useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, useTexture } from "@react-three/drei";
import * as THREE from "three";

import { bodyToAvatar, type UserBody, type AvatarMorph } from "@/lib/fit/bodyToAvatar";
import { sizeToMorph } from "@/lib/fit/sizeToMorph";
import { applyGarmentFit, type GarmentTransform } from "@/lib/fit/applyGarmentFit";
import { getGarmentType, getGarmentSubtype, type GarmentType } from "@/lib/fit/getGarmentType";
import { extractDominantColor } from "@/lib/fit/extractDominantColor";

interface Fit3DViewerProps {
  productImage?: string | null;
  productName?: string;
  category?: string | null;
  size: string;
  fitType?: "slim" | "regular" | "relaxed" | "oversized";
  body?: UserBody | null;
  height?: number;
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

  const [color, setColor] = useState<string>("#7d7a78");
  useEffect(() => {
    let alive = true;
    if (productImage) {
      extractDominantColor(productImage).then((c) => alive && setColor(c));
    }
    return () => { alive = false; };
  }, [productImage]);

  // Camera: slightly elevated, looking down a touch — adds depth + perspective.
  const cameraTarget: [number, number, number] =
    garmentType === "bottom" ? [0, -0.5, 0] :
    garmentType === "full" ? [0, 0, 0] :
    [0, 0.35, 0];
  const cameraPos: [number, number, number] =
    garmentType === "bottom" ? [0.25, 0.05, 3.0] :
    garmentType === "full" ? [0.3, 0.45, 3.2] :
    [0.3, 0.85, 2.55];

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-foreground/[0.05]"
      style={{
        height,
        background:
          "radial-gradient(ellipse at 50% 38%, hsl(var(--accent) / 0.07), transparent 60%), linear-gradient(180deg, #18181c 0%, #0e0e11 100%)",
      }}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: cameraPos, fov: 32 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
      >
        <Suspense fallback={null}>
          {/* Studio lighting — soft key, warm fill, cool rim */}
          <ambientLight intensity={0.55} />
          <directionalLight
            position={[2.2, 3.4, 2.6]}
            intensity={1.0}
            color="#fff4e8"
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0005}
          />
          <directionalLight position={[-1.5, 1.8, -2.2]} intensity={0.55} color="#9fb0ff" />
          <hemisphereLight args={["#cfd6ff", "#1a1a20", 0.35]} />

          <BreathingGroup>
            <group position={[0, -0.9, 0]}>
              <Avatar morph={avatarMorph} />
              <Garment
                subtype={subtype}
                type={garmentType}
                transform={transform}
                productImage={productImage ?? undefined}
                fallbackColor={color}
              />
              <ContactShadows
                position={[0, 0.005, 0]}
                opacity={0.42}
                scale={3.2}
                blur={2.8}
                far={2}
                resolution={512}
              />
            </group>
          </BreathingGroup>

          <OrbitControls
            enablePan={false}
            enableZoom={false}
            target={cameraTarget}
            minPolarAngle={Math.PI / 2.6}
            maxPolarAngle={Math.PI / 1.85}
            minAzimuthAngle={-Math.PI / 4}
            maxAzimuthAngle={Math.PI / 4}
          />
        </Suspense>
      </Canvas>

      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/55 px-2 py-1 backdrop-blur-sm">
        <p className="text-[8.5px] font-bold tracking-[0.22em] text-foreground/75">
          3D FIT · SIZE {size.toUpperCase()}
        </p>
      </div>
    </div>
  );
}

// ─── BREATHING / DRIFT ──────────────────────────────────────────────────
// Subtle ±1% Y scale + tiny rotation drift. No spinner, no spinnery vibes.

function BreathingGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.scale.y = 1 + Math.sin(t * 1.05) * 0.008;
    ref.current.rotation.y = Math.sin(t * 0.18) * 0.05;
  });
  return <group ref={ref}>{children}</group>;
}

// ─── AVATAR ───────────────────────────────────────────────────────────────
// Smooth capsules + subtle shoulder rounding. Higher segment counts to kill
// faceted edges. No box geometry — reads as a soft mannequin silhouette.

function Avatar({ morph }: { morph: AvatarMorph }) {
  const skin = "#d6c0a8";
  const skinMat = (
    <meshStandardMaterial color={skin} roughness={0.78} metalness={0} flatShading={false} />
  );

  return (
    <group scale={[1, morph.heightScale, 1]}>
      {/* head */}
      <mesh position={[0, 1.65, 0]} castShadow>
        <sphereGeometry args={[0.16, 48, 48]} />
        {skinMat}
      </mesh>
      {/* neck */}
      <mesh position={[0, 1.45, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.085, 0.14, 32]} />
        {skinMat}
      </mesh>
      {/* shoulders (rounded) */}
      <mesh position={[0, 1.32, 0]} scale={[morph.shoulderWidth, 1, 1]} castShadow>
        <capsuleGeometry args={[0.085, 0.4, 16, 32]} />
        {skinMat}
      </mesh>
      {/* shoulder caps */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.27 * morph.shoulderWidth, 1.3, 0]} castShadow>
          <sphereGeometry args={[0.11, 32, 32]} />
          {skinMat}
        </mesh>
      ))}
      {/* torso */}
      <mesh position={[0, 1.05, 0]} scale={[morph.torsoWidth, 1, morph.torsoWidth * 0.82]} castShadow>
        <capsuleGeometry args={[0.22, 0.36, 24, 48]} />
        {skinMat}
      </mesh>
      {/* waist */}
      <mesh position={[0, 0.7, 0]} scale={[morph.waistWidth * 0.94, 1, morph.waistWidth * 0.76]} castShadow>
        <capsuleGeometry args={[0.2, 0.18, 20, 40]} />
        {skinMat}
      </mesh>
      {/* hips */}
      <mesh position={[0, 0.5, 0]} scale={[morph.hipWidth, 1, morph.hipWidth * 0.85]} castShadow>
        <capsuleGeometry args={[0.22, 0.1, 20, 40]} />
        {skinMat}
      </mesh>
      {/* arms */}
      <Limb side={-1} y={1.05} radius={0.06} length={0.5} skinMat={skinMat} widthAnchor={morph.shoulderWidth * 0.3} />
      <Limb side={1}  y={1.05} radius={0.06} length={0.5} skinMat={skinMat} widthAnchor={morph.shoulderWidth * 0.3} />
      {/* legs */}
      <Leg side={-1} hipWidth={morph.hipWidth} legLength={morph.legLength} skinMat={skinMat} />
      <Leg side={1}  hipWidth={morph.hipWidth} legLength={morph.legLength} skinMat={skinMat} />
    </group>
  );
}

function Limb({ side, y, radius, length, skinMat, widthAnchor }: {
  side: -1 | 1; y: number; radius: number; length: number; skinMat: React.ReactNode; widthAnchor: number;
}) {
  return (
    <group position={[side * widthAnchor, y, 0]}>
      <mesh castShadow position={[0, -length / 2, 0]}>
        <capsuleGeometry args={[radius, length, 12, 24]} />
        {skinMat}
      </mesh>
    </group>
  );
}

function Leg({ side, hipWidth, legLength, skinMat }: {
  side: -1 | 1; hipWidth: number; legLength: number; skinMat: React.ReactNode;
}) {
  return (
    <group position={[side * 0.11 * hipWidth, 0.35, 0]} scale={[1, legLength, 1]}>
      <mesh castShadow position={[0, -0.4, 0]}>
        <capsuleGeometry args={[0.085, 0.7, 14, 28]} />
        {skinMat}
      </mesh>
    </group>
  );
}

// ─── GARMENT ──────────────────────────────────────────────────────────────
// Per-region drape:
//   chest (bulged) → waist (tapered) → hem (flared)
// Texture is applied as a small CHEST PATCH only (centered decal-ish quad)
// to avoid full-body UV stretching of flat product photos.

interface GarmentProps {
  subtype: "tee" | "hoodie" | "jacket" | "pants" | "dress";
  type: GarmentType;
  transform: GarmentTransform;
  productImage?: string;
  fallbackColor: string;
}

function Garment(props: GarmentProps) {
  return (
    <Suspense fallback={<GarmentMesh {...props} chestTexture={null} />}>
      {props.productImage ? (
        <TexturedGarment {...props} url={props.productImage} />
      ) : (
        <GarmentMesh {...props} chestTexture={null} />
      )}
    </Suspense>
  );
}

function TexturedGarment(props: GarmentProps & { url: string }) {
  const tex = useTexture(props.url);
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
  }, [tex]);

  // Aspect-ratio guard: reject extreme ratios that would stretch ugly.
  const usable =
    !!tex.image &&
    tex.image.width > 0 &&
    tex.image.height > 0 &&
    Math.abs(tex.image.width / tex.image.height - 1) < 0.5; // ratio in [0.5..1.5]

  return <GarmentMesh {...props} chestTexture={usable ? tex : null} />;
}

function GarmentMesh({
  subtype,
  type,
  transform,
  fallbackColor,
  chestTexture,
}: GarmentProps & { chestTexture: THREE.Texture | null }) {
  const baseMaterial = (
    <meshStandardMaterial
      color={fallbackColor}
      roughness={transform.roughness}
      metalness={0.04}
      side={THREE.DoubleSide}
      flatShading={false}
    />
  );

  const [sx, sy, sz] = transform.scale;
  const [px, py, pz] = transform.position;

  // BOTTOM
  if (type === "bottom" || subtype === "pants") {
    return (
      <group position={[px, py, pz]} scale={[sx, sy, sz]}>
        {/* waistband */}
        <mesh position={[0, 0.46, 0]}>
          <torusGeometry args={[0.24, 0.035, 16, 48]} />
          {baseMaterial}
        </mesh>
        {/* legs (slightly tapered) */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.11, 0.05, 0]}>
            <cylinderGeometry args={[0.115, 0.135, 0.85, 28]} />
            {baseMaterial}
          </mesh>
        ))}
      </group>
    );
  }

  // DRESS / FULL
  if (subtype === "dress" || type === "full") {
    return (
      <group position={[px, py, pz]} scale={[sx, sy, sz]}>
        <mesh>
          <cylinderGeometry args={[0.27 * transform.chestScale, 0.42 * transform.hemScale, 1.1, 48, 1, false]} />
          {baseMaterial}
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.27, 0.5, 0]}>
            <sphereGeometry args={[0.09, 24, 24]} />
            {baseMaterial}
          </mesh>
        ))}
      </group>
    );
  }

  // TOP / OUTERWEAR — CHEST + WAIST + HEM (drape)
  const chestY = 0.06;
  const waistY = -0.18;
  const hemY = -0.36;

  return (
    <group position={[px, py, pz]} scale={[sx, sy, sz]}>
      {/* chest (bulged) */}
      <mesh position={[0, chestY, 0]} scale={[transform.chestScale, 1, transform.chestScale * 0.92]}>
        <capsuleGeometry args={[0.27, 0.22, 20, 40]} />
        {baseMaterial}
      </mesh>
      {/* waist (slight taper) */}
      <mesh position={[0, waistY, 0]} scale={[transform.waistScale, 1, transform.waistScale * 0.9]}>
        <cylinderGeometry args={[0.27, 0.27, 0.16, 40, 1, true]} />
        {baseMaterial}
      </mesh>
      {/* hem (flared) — open at bottom for soft drape silhouette */}
      <mesh position={[0, hemY, 0]} scale={[transform.hemScale, 1, transform.hemScale * 0.95]}>
        <cylinderGeometry args={[0.27, 0.32, 0.14, 48, 1, true]} />
        {baseMaterial}
      </mesh>

      {/* sleeves with subtle elbow bend */}
      {[-1, 1].map((s) => (
        <group
          key={s}
          position={[s * 0.32, 0.18 + transform.shoulderDrop, 0]}
          rotation={[0, 0, s * (0.2 + transform.sleeveBend)]}
        >
          <mesh position={[s * 0.05, -0.22 * transform.limbScale, 0]} scale={[1, transform.limbScale, 1]}>
            <capsuleGeometry args={[0.09, 0.42, 16, 28]} />
            {baseMaterial}
          </mesh>
          {/* sleeve cuff hint */}
          <mesh position={[s * 0.09, -0.46 * transform.limbScale, 0]} rotation={[0, 0, s * 0.15]}>
            <torusGeometry args={[0.075, 0.012, 8, 20]} />
            {baseMaterial}
          </mesh>
        </group>
      ))}

      {/* hood */}
      {subtype === "hoodie" && (
        <mesh position={[0, 0.42, -0.09]}>
          <sphereGeometry args={[0.21, 28, 28, 0, Math.PI * 2, 0, Math.PI / 1.6]} />
          {baseMaterial}
        </mesh>
      )}

      {/* jacket lapel hint */}
      {subtype === "jacket" && (
        <mesh position={[0, 0.18, 0.19]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[0.36, 0.32, 0.015]} />
          {baseMaterial}
        </mesh>
      )}

      {/* CHEST PATCH — texture decal only, never full-body stretch */}
      {chestTexture && (
        <mesh position={[0, chestY + 0.02, 0.255 * transform.chestScale]} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.28, 0.28]} />
          <meshStandardMaterial
            map={chestTexture}
            transparent
            roughness={0.7}
            metalness={0}
            side={THREE.FrontSide}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      )}
    </group>
  );
}
