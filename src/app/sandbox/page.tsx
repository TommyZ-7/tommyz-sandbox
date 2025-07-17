"use client";
import React, { useState, Suspense, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  RoundedBox,
  MeshTransmissionMaterial,
  Environment,
  Text,
  useGLTF,
  Float,
  MeshDistortMaterial,
} from "@react-three/drei";
import { useSpring, a } from "@react-spring/three";
import * as THREE from "three";

// --- 3D Components ---

/**
 * トグルスイッチの3Dシーン全体
 * @param {boolean} isOn - スイッチがONかどうか
 */
function ToggleScene({ isOn }: { isOn: boolean }) {
  // 背景となるオブジェクト（トラック）を格納するための参照
  const backgroundRef = useRef<THREE.Group>(null);

  return (
    <>
      {/* 屈折させる対象となる背景グループ */}
      {/* transmissionSamplerは、このグループ内だけをレンダリングして屈折計算に使う */}
      <group ref={backgroundRef}>
        <Track isOn={isOn} />
      </group>

      {/* ガラスのつまみ部分 */}
      <GlassThumb isOn={isOn} backgroundRef={backgroundRef} />
    </>
  );
}

/**
 * 背景となるトラック部分（3Dオブジェクト）
 * @param {boolean} isOn - スイッチがONかどうか
 */
function Track({ isOn }: { isOn: boolean }) {
  const { color } = useSpring({
    color: isOn ? "#34d399" : "#d1d5db",
    config: { duration: 400 },
  });

  return (
    <RoundedBox args={[2.2, 1, 0.2]} radius={0.5} position={[0, 0, -0.1]}>
      <a.meshStandardMaterial color={color} />
    </RoundedBox>
  );
}

/**
 * ガラスのスイッチ部分（3Dオブジェクト）
 * @param {boolean} isOn - スイッチがONかどうか
 * @param {React.RefObject} backgroundRef - 屈折させる背景オブジェクトの参照
 */
function GlassThumb({
  isOn,
  backgroundRef,
}: {
  isOn: boolean;
  backgroundRef: React.RefObject<any>;
}) {
  const { position } = useSpring({
    position: isOn
      ? ([0.7, 0, 0.2] as [number, number, number])
      : ([-0.7, 0, 0.2] as [number, number, number]),
    config: { mass: 1, tension: 280, friction: 22 },
  });

  // メモ化して不要な再計算を防ぐ
  const materialProps = useMemo(
    () => ({
      thickness: 0.4,
      roughness: 0.05,
      ior: 1.45,
      chromaticAberration: 0.1,
      anisotropy: 0.5,
      distortion: 0.2,
      distortionScale: 0.05,
      temporalDistortion: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    }),
    []
  );

  // カスタム法線マップを作成（滑らかな凹レンズ効果用）
  const customNormalMap = useMemo(() => {
    const size = 256; // 解像度を2倍に向上
    const data = new Uint8Array(size * size * 4);

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const index = (i * size + j) * 4;

        // UV座標を-1から1の範囲に正規化（より精密に）
        const u = (j / (size - 1)) * 2 - 1;
        const v = (i / (size - 1)) * 2 - 1;

        // 中心からの距離
        const distance = Math.sqrt(u * u + v * v);

        // 滑らかなフォールオフ関数を使用
        const smoothFalloff = Math.min(distance, 1);

        // より滑らかな凹レンズ効果（複数の関数を組み合わせ）
        const concaveStrength = 0.6;

        // スムーズステップ関数で滑らかな遷移を作成
        const smoothStep = (x: number) => x * x * (3 - 2 * x);
        const smoothDistance = smoothStep(smoothFalloff);

        // ガウシアン関数と組み合わせてより自然な凹面を作成
        const gaussian = Math.exp(-distance * distance * 2);
        const height = (1 - smoothDistance) * gaussian * concaveStrength;

        // 法線ベクトルを滑らかに計算
        const gradientX = u * (1 - gaussian) * concaveStrength * 0.8;
        const gradientY = v * (1 - gaussian) * concaveStrength * 0.8;

        // 法線ベクトルを正規化
        const normalLength = Math.sqrt(
          gradientX * gradientX + gradientY * gradientY + 1
        );
        const normalX = gradientX / normalLength;
        const normalY = gradientY / normalLength;
        const normalZ = 1 / normalLength;

        // 0-255の範囲に変換（より精密に）
        data[index] = Math.floor(
          Math.max(0, Math.min(255, (normalX * 0.5 + 0.5) * 255))
        ); // R
        data[index + 1] = Math.floor(
          Math.max(0, Math.min(255, (normalY * 0.5 + 0.5) * 255))
        ); // G
        data[index + 2] = Math.floor(
          Math.max(0, Math.min(255, (normalZ * 0.5 + 0.5) * 255))
        ); // B
        data[index + 3] = 255; // A
      }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.needsUpdate = true;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }, []);

  return (
    <a.group position={position}>
      <RoundedBox args={[2, 1.3, 0.5]} radius={0.6} smoothness={4}>
        <MeshTransmissionMaterial
          // bufferに背景オブジェクトの参照を渡す
          buffer={backgroundRef.current}
          // transmissionSamplerを有効にすることで、確実な屈折効果を得る
          transmissionSampler
          {...materialProps}
          normalMap={customNormalMap}
          normalScale={new THREE.Vector2(1.2, 1.2)}
        />
      </RoundedBox>
    </a.group>
  );
}

// --- Main Application ---

export default function App() {
  const [isOn, setIsOn] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: "2rem",
        width: "100%",
        height: "100%",
        minHeight: "100vh",
        background: "linear-gradient(to top, #d1e3ff 0%, #f3e7e9 100%)",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div
        style={{
          padding: "2rem",
          background: "rgba(255,255,255,0.5)",
          borderRadius: "20px",
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
          backdropFilter: "blur(4px)",
        }}
      >
        <h1
          style={{
            fontWeight: 600,
            fontSize: "1.5rem",
            textAlign: "center",
            color: "#333",
          }}
        >
          React Three Fiber Toggle Switch
        </h1>
        <p
          style={{
            maxWidth: "300px",
            textAlign: "center",
            color: "#555",
            marginTop: "1rem",
          }}
        >
          下のスイッチをクリックしてください。凹レンズ効果でガラスが屈折します。
        </p>
        <div
          onClick={() => setIsOn(!isOn)}
          style={{
            marginTop: "2rem",
            width: "240px",
            height: "120px",
            cursor: "pointer",
            margin: "2rem auto 0",
          }}
        >
          <Canvas orthographic camera={{ position: [0, 0, 10], zoom: 50 }}>
            <ambientLight intensity={Math.PI} />
            <directionalLight position={[10, 10, 5]} intensity={2.5} />
            <directionalLight position={[-10, -10, -5]} intensity={1} />

            <Suspense fallback={null}>
              <ToggleScene isOn={isOn} />
              <Environment preset="city" />
            </Suspense>
          </Canvas>
        </div>
      </div>
    </div>
  );
}
