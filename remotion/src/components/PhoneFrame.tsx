import React from "react";
import { Img, staticFile } from "remotion";

interface Props {
  src: string;
  width?: number;
  rotateY?: number;
  scale?: number;
  glow?: string;
}

export const PhoneFrame: React.FC<Props> = ({
  src,
  width = 380,
  rotateY = 0,
  scale = 1,
  glow = "#FF2D87",
}) => {
  const height = (width * 844) / 390;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 48,
        background: "#000",
        padding: 10,
        boxShadow: `0 0 80px ${glow}55, 0 30px 80px rgba(0,0,0,0.6), inset 0 0 0 1.5px rgba(255,255,255,0.18)`,
        transform: `perspective(1800px) rotateY(${rotateY}deg) scale(${scale})`,
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 38,
          overflow: "hidden",
          position: "relative",
          background: "#fff",
        }}
      >
        <Img
          src={staticFile(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
        />
        {/* notch */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            width: 110,
            height: 28,
            background: "#000",
            borderRadius: 14,
          }}
        />
      </div>
    </div>
  );
};
