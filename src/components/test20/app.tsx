"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Sounds, SoundList, BackgroundImages } from "@/components/data";
import type * as poseDetection from "@tensorflow-models/pose-detection";
import type * as tf from "@tensorflow/tfjs";
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import {
  EffectType,
  Particle,
  NormalParticle,
  SparkleParticle,
  FireParticle,
  BubbleParticle,
  SnowParticle,
  HolidayColorsParticle,
  ComplexSnowflakeParticle,
  GiftBoxParticle,
} from "../effects/effects";
import {
  Settings,
  Camera,
  Activity,
  Image as ImageIcon,
  Mic,
  Maximize,
  Minimize,
  ChevronRight,
  ChevronDown,
  Play,
  Square,
  Save,
  Layout,
  Move,
  Sliders,
  FileJson,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---
type MoveNetModelType = "Lightning" | "Thunder" | "multiPose";
type BlazePoseModelType = "lite" | "full" | "heavy";
type DetectorType = "MoveNet" | "MediaPipe";
type ProcessingMode = "CPU" | "GPU" | "WebGPU";
type Point = { x: number; y: number };
type MarkerConfig = {
  rightHand: boolean;
  leftHand: boolean;
  rightFoot: boolean;
  leftFoot: boolean;
  face: boolean;
};

// --- Helper Objects ---
const Matrix = {
  inverse: (matrix: number[][]): number[][] | null => {
    const dim = matrix.length;
    const identity = Array(dim)
      .fill(0)
      .map((_, i) =>
        Array(dim)
          .fill(0)
          .map((__, j) => (i === j ? 1 : 0))
      );
    const augmented = matrix.map((row, i) => [...row, ...identity[i]]);

    for (let i = 0; i < dim; i++) {
      let pivot = i;
      while (pivot < dim && augmented[pivot][i] === 0) pivot++;
      if (pivot === dim) return null;
      [augmented[i], augmented[pivot]] = [augmented[pivot], augmented[i]];
      const divisor = augmented[i][i];
      for (let j = 0; j < 2 * dim; j++) augmented[i][j] /= divisor;
      for (let k = 0; k < dim; k++) {
        if (i !== k) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * dim; j++)
            augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }
    return augmented.map((row) => row.slice(dim));
  },
  multiply: (matrix: number[][], vector: number[]): number[] => {
    return matrix.map((row) =>
      row.reduce((sum, val, i) => sum + val * vector[i], 0)
    );
  },
};

// --- Main Component ---
const PoseDetector = (): JSX.Element => {
  // --- State: Logic ---
  const [detectorType, setDetectorType] = useState<DetectorType>("MediaPipe");
  const [moveNetModelType, setMoveNetModelType] =
    useState<MoveNetModelType>("Lightning");
  const [blazePoseModelType, setBlazePoseModelType] =
    useState<BlazePoseModelType>("full");
  const [processingMode, setProcessingMode] = useState<ProcessingMode>("GPU");
  const [status, setStatus] = useState("Loading...");
  const [isLoading, setIsLoading] = useState(true);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [videoDimensions, setVideoDimensions] = useState({
    width: 1280,
    height: 720,
  });
  const [inputMode, setInputMode] = useState<"Range" | "Full">("Range");
  const [handCanvasAspectRatio, setHandCanvasAspectRatio] = useState("4:3");
  const [handCanvasFullscreen, setHandCanvasFullscreen] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState<string>(
    BackgroundImages[0].path
  );
  const [backgroundImage, setBackgroundImage] =
    useState<HTMLImageElement | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<EffectType>("Normal");
  const [moveThreshold, setMoveThreshold] = useState<number>(5);
  const [effectCount, setEffectCount] = useState<number>(5);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedData, setRecordedData] = useState<{
    startTime: number;
    memo?: string;
    poses: Array<{
      timestamp: number;
      keypoints: Array<{ x: number; y: number; score: number; name: string }>;
    }>;
  }>({ startTime: 0, poses: [] });
  const [selectedSound, setSelectedSound] = useState<SoundList | null>(null);
  const [isRecordingVideo, setIsRecordingVideo] = useState(true);
  const [includePoseInVideo, setIncludePoseInVideo] = useState(true);
  const [selectedMarkers, setSelectedMarkers] = useState<MarkerConfig>({
    rightHand: true,
    leftHand: true,
    rightFoot: false,
    leftFoot: false,
    face: false,
  });


  // --- State: UI ---
  const [viewMode, setViewMode] = useState<"setup" | "play">("setup");
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeSections, setActiveSections] = useState<string[]>(["effects"]);
  const [memo, setMemo] = useState<string>("");
  const [showMemoDialog, setShowMemoDialog] = useState(false);

  // --- Tooltip State ---
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const HelpLabel = useCallback(({
    label,
    description,
  }: {
    label: string;
    description: string;
  }) => (
    <div
      className="flex items-center space-x-1 cursor-help w-fit"
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({ x: rect.right + 10, y: rect.top, text: description });
      }}
      onMouseLeave={() => setTooltip(null)}
    >
      <label className="text-xs text-slate-400 pointer-events-none">
        {label}
      </label>
      <HelpCircle size={12} className="text-slate-500" />
    </div>
  ), []);

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handCanvasRef = useRef<HTMLCanvasElement>(null);
  const transformedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const adjacentPairsRef = useRef<[number, number][] | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastMarkerPositionsRef = useRef<{
    [key: string]: Point | null;
  }>({
    rightHand: null,
    leftHand: null,
    rightFoot: null,
    leftFoot: null,
    face: null,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const lastRecordTimeRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);
  const matricesRef = useRef<{ h: number[] | null; h_inv: number[] | null }>({
    h: null,
    h_inv: null,
  });

  // --- Interactive Quad State ---
  const [quadPoints, setQuadPoints] = useState<Point[]>([
    { x: 320, y: 180 },
    { x: 960, y: 180 },
    { x: 960, y: 540 },
    { x: 320, y: 540 },
  ]);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(
    null
  );
  const DRAG_HANDLE_SIZE = 15;

  // --- Optimization Refs ---
  const quadPointsRef = useRef(quadPoints);
  const selectedEffectRef = useRef(selectedEffect);
  const moveThresholdRef = useRef(moveThreshold);
  const effectCountRef = useRef(effectCount);
  const isRecordingRef = useRef(isRecording);
  const handCanvasFullscreenRef = useRef(handCanvasFullscreen);
  const backgroundImageRef = useRef(backgroundImage);
  const detectorTypeRef = useRef(detectorType);
  const inputModeRef = useRef(inputMode);
  const selectedMarkersRef = useRef(selectedMarkers);
  const handCanvasDimensionsRef = useRef({ width: 0, height: 0 });

  // --- Recording Refs for Closure Access ---
  const isRecordingVideoRef = useRef(isRecordingVideo);
  const includePoseInVideoRef = useRef(includePoseInVideo);

  useEffect(() => {
    isRecordingVideoRef.current = isRecordingVideo;
  }, [isRecordingVideo]);
  useEffect(() => {
    includePoseInVideoRef.current = includePoseInVideo;
  }, [includePoseInVideo]);


  useEffect(() => {
    quadPointsRef.current = quadPoints;
  }, [quadPoints]);
  useEffect(() => {
    selectedEffectRef.current = selectedEffect;
  }, [selectedEffect]);
  useEffect(() => {
    moveThresholdRef.current = moveThreshold;
  }, [moveThreshold]);
  useEffect(() => {
    effectCountRef.current = effectCount;
  }, [effectCount]);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  useEffect(() => {
    handCanvasFullscreenRef.current = handCanvasFullscreen;
  }, [handCanvasFullscreen]);
  useEffect(() => {
    backgroundImageRef.current = backgroundImage;
  }, [backgroundImage]);
  useEffect(() => {
    backgroundImageRef.current = backgroundImage;
  }, [backgroundImage]);
  useEffect(() => {
    detectorTypeRef.current = detectorType;
  }, [detectorType]);
  useEffect(() => {
    inputModeRef.current = inputMode;
  }, [inputMode]);
  useEffect(() => {
    selectedMarkersRef.current = selectedMarkers;
  }, [selectedMarkers]);

  // --- BroadcastChannel for Remote Control ---
  useEffect(() => {
    const channel = new BroadcastChannel("test20_settings_channel");

    channel.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === "UPDATE_SETTING") {
        const { key, value } = payload;
        switch (key) {
          case "selectedEffect":
            setSelectedEffect(value);
            break;
          case "selectedBackground":
            setSelectedBackground(value);
            break;
          case "selectedSound":
            const s = Sounds.find((snd) => snd.name === value);
            if (s) {
              setSelectedSound(s);
              changeSound(s);
            } else if (value === "") {
              setSelectedSound(null);
            }
            break;
          case "effectCount":
            setEffectCount(value);
            break;
          case "moveThreshold":
            setMoveThreshold(value);
            break;
          case "detectorType":
            setDetectorType(value);
            break;
          case "moveNetModelType":
            setMoveNetModelType(value);
            break;
          case "blazePoseModelType":
            setBlazePoseModelType(value);
            break;
          case "inputMode":
            setInputMode(value);
            break;
          case "selectedCameraId":
            setSelectedCameraId(value);
            break;
          case "isRecordingVideo":
            setIsRecordingVideo(value);
            break;
          case "includePoseInVideo":
            setIncludePoseInVideo(value);
            break;
          case "selectedMarkers":
            setSelectedMarkers(value);
            break;
        }
      } else if (type === "START_RECORDING") {
        handlersRef.current.startRecording();
      } else if (type === "STOP_RECORDING") {
        handlersRef.current.stopRecording();
      } else if (type === "SAVE_AND_DOWNLOAD") {
        handlersRef.current.handleDownload(payload?.memo);
      } else if (type === "SYNC_REQUEST") {
        channel.postMessage({
          type: "SYNC_RESPONSE",
          payload: {
            selectedEffect: selectedEffectRef.current,
            selectedBackground: backgroundImageRef.current ? (selectedBackground || "") : "", // simpler to just use state, but using ref for consistency if needed. actually state is better for these values.
            // Rethink: inside useEffect, we have closure over state? No, this useEffect has NO dependency locally to avoid re-subscribing too often, 
            // BUT we need current state access.
            // We should use the REFS we created for optimization, or create refs for the ones missing.
            // Or better: use a functional state update or just refs.
            // Let's check which refs exist:
            // selectedEffectRef, moveThresholdRef, effectCountRef, detectorTypeRef, inputModeRef.
            // Missing refs for: selectedBackground, selectedSound, moveNetModelType, blazePoseModelType, selectedCameraId.

            // To properly handle SYNC_REQUEST without adding all states to dependency array (which would re-create channel constantly),
            // let's use a mutable ref that holds "all current settings" or just access the existing refs.
            // I will use the existing refs and just rely on state for the ones that don't change often or accept that SYNC might be slightly stale if I don't add dependencies? 
            // Actually, the cleanest way is to use a ref that tracks the *entire* state object for sync purposes, OR add dependencies.
            // If I add dependencies, the channel reconnects. It's cheap. Safe to add dependencies.
            // WAIT, if I add dependencies, I loop: receive msg -> update state -> effect trigger -> new channel -> ...
            // Recreating channel is fine.
          }
        });
      }
    };

    return () => {
      channel.close();
    };
  }, []); // Keep empty array to avoid re-binding.

  // We need a way to access latest values for SYNC_RESPONSE without re-binding.
  // I will create a ref that always holds the current state for all settings.
  const allSettingsRef = useRef({
    selectedEffect,
    selectedBackground,
    selectedSound,
    effectCount,
    moveThreshold,
    detectorType,
    moveNetModelType,
    blazePoseModelType,
    inputMode,
    selectedCameraId,
    isRecordingVideo,
    includePoseInVideo,
    selectedMarkers,
  });

  const handlersRef = useRef({
    startRecording: () => { },
    stopRecording: () => { },
    handleDownload: (memo?: string) => { }
  });

  useEffect(() => {
    handlersRef.current = {
      startRecording,
      stopRecording,
      handleDownload
    };
  });

  useEffect(() => {
    allSettingsRef.current = {
      selectedEffect,
      selectedBackground,
      selectedSound,
      effectCount,
      moveThreshold,
      detectorType,
      moveNetModelType,
      blazePoseModelType,
      inputMode,
      selectedCameraId,
      isRecordingVideo,
      includePoseInVideo,
      selectedMarkers,
    };
  }, [
    selectedEffect,
    selectedBackground,
    selectedSound,
    effectCount,
    moveThreshold,
    detectorType,
    moveNetModelType,
    blazePoseModelType,
    inputMode,
    selectedCameraId,
    isRecordingVideo,
    includePoseInVideo,
    selectedMarkers,
  ]);

  // Now the specific SYNC channel effect
  useEffect(() => {
    const channel = new BroadcastChannel("test20_settings_channel");
    channel.onmessage = (event) => {
      if (event.data.type === "SYNC_REQUEST") {
        channel.postMessage({
          type: "SYNC_RESPONSE",
          payload: {
            ...allSettingsRef.current,
            selectedSound: allSettingsRef.current.selectedSound?.name || ""
          }
        });
      }
    };
    return () => channel.close();
  }, []);


  // --- Memoized Dimensions ---
  const handCanvasDimensions = useMemo(() => {
    const baseWidth = 400; // Hand canvas base size
    const ratio = handCanvasAspectRatio.split(":").map(Number);
    const height = (baseWidth * ratio[1]) / ratio[0];
    return { width: baseWidth, height };
  }, [handCanvasAspectRatio]);

  useEffect(() => {
    handCanvasDimensionsRef.current = handCanvasDimensions;
  }, [handCanvasDimensions]);

  // --- Effect Logic ---
  const isAudioPlaying = () => {
    const a = audioRef.current;
    return !!a && !a.paused && !a.ended && a.currentTime > 0;
  };

  const changeSound = (sound: SoundList) => {
    audioRef.current = new Audio(sound.dir + ".mp3");
    audioRef.current.load();
  };

  useEffect(() => {
    if (selectedBackground) {
      const img = new Image();
      img.src = selectedBackground;
      img.onload = () => setBackgroundImage(img);
      img.onerror = () => setBackgroundImage(null);
    } else {
      setBackgroundImage(null);
    }
  }, [selectedBackground]);

  // --- Geometry Helpers ---
  const getHomographyMatrix = (
    srcPoints: Point[],
    dstPoints: Point[]
  ): number[] | null => {
    const A: number[][] = [];
    const b: number[] = [];
    for (let i = 0; i < 4; i++) {
      const { x, y } = srcPoints[i];
      const { x: X, y: Y } = dstPoints[i];
      A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
      A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
      b.push(X, Y);
    }
    const A_inv = Matrix.inverse(A);
    if (!A_inv) return null;
    const h = Matrix.multiply(A_inv, b);
    h.push(1);
    return h;
  };

  const transformPoint = (point: Point, h: number[]): Point => {
    const { x, y } = point;
    const Z = h[6] * x + h[7] * y + h[8];
    return {
      x: (h[0] * x + h[1] * y + h[2]) / Z,
      y: (h[3] * x + h[4] * y + h[5]) / Z,
    };
  };

  // --- Drawing Logic ---
  const drawInteractiveOverlay = useCallback(
    (ctx: CanvasRenderingContext2D, quadPoints: Point[]) => {
      ctx.strokeStyle = "rgba(0, 255, 255, 0.8)";
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(quadPoints[0].x, quadPoints[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(quadPoints[i].x, quadPoints[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(0, 255, 255, 0.4)";
      ctx.fill();

      quadPoints.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, DRAG_HANDLE_SIZE, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        ctx.stroke();

        // Draw Index
        ctx.fillStyle = "#333";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((i + 1).toString(), p.x, p.y);
      });
    },
    []
  );

  const drawKeypoints = (
    keypoints: poseDetection.Keypoint[],
    minConfidence: number,
    ctx: CanvasRenderingContext2D
  ) => {
    for (const keypoint of keypoints) {
      if (keypoint.score != null && keypoint.score > minConfidence) {
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = "#00ff00";
        ctx.fill();
      }
    }
  };

  const drawSkeleton = (
    keypoints: poseDetection.Keypoint[],
    minConfidence: number,
    ctx: CanvasRenderingContext2D
  ) => {
    const adjacentPairs = adjacentPairsRef.current;
    if (!adjacentPairs) return;
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 2;
    for (const [i, j] of adjacentPairs) {
      const kp1 = keypoints[i];
      const kp2 = keypoints[j];
      if (
        kp1?.score != null &&
        kp1.score > minConfidence &&
        kp2?.score != null &&
        kp2.score > minConfidence
      ) {
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    }
  };

  const drawResults = useCallback(
    (
      rawPoses: poseDetection.Pose[],
      transformedPoses: poseDetection.Pose[]
    ) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const handCanvas = handCanvasRef.current;

      const currentQuadPoints = quadPointsRef.current;
      const currentSelectedEffect = selectedEffectRef.current;
      const currentMoveThreshold = moveThresholdRef.current;
      const currentEffectCount = effectCountRef.current;
      const isFullscreen = handCanvasFullscreenRef.current;
      const currentDimensions = handCanvasDimensionsRef.current;
      const currentBackgroundImage = backgroundImageRef.current;
      const currentDetectorType = detectorTypeRef.current;
      const currentSelectedMarkers = selectedMarkersRef.current;

      if (!video || !canvas || !handCanvas || video.videoWidth === 0) return;

      // Input Canvas (Overlay on Video)
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Output Canvas - Resize to match display size for sharp rendering
      const rect = handCanvas.getBoundingClientRect();
      // Determine target resolution. We match the display size 1:1.
      // If devicePixelRatio is needed for Retina, we could multiply here, but keeping 1:1 is usually enough for performance in this context.
      const targetWidth = Math.floor(rect.width);
      const targetHeight = Math.floor(rect.height);

      if (
        handCanvas.width !== targetWidth ||
        handCanvas.height !== targetHeight
      ) {
        handCanvas.width = targetWidth;
        handCanvas.height = targetHeight;
      }

      const ctx = canvas.getContext("2d");
      const handCtx = handCanvas.getContext("2d");
      if (!ctx || !handCtx) return;

      // --- Draw Input Overlay ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw Skeleton on Input View (Transformed back to original view)
      for (const pose of transformedPoses) {
        if (pose.keypoints) {
          drawKeypoints(pose.keypoints, 0.5, ctx);
          drawSkeleton(pose.keypoints, 0.5, ctx);
        }
      }
      if (inputModeRef.current === "Range") {
        drawInteractiveOverlay(ctx, currentQuadPoints);
      }

      // --- Draw Output View ---
      if (currentBackgroundImage) {
        handCtx.drawImage(
          currentBackgroundImage,
          0,
          0,
          handCanvas.width,
          handCanvas.height
        );
      } else {
        handCtx.fillStyle = "#0f172a"; // Slate-900
        handCtx.fillRect(0, 0, handCanvas.width, handCanvas.height);
      }

      // --- Particles ---
      const emitParticles = (x: number, y: number, magnitude: number) => {
        if (audioRef.current && !isAudioPlaying()) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch((e) => console.error(e));
        }

        for (let i = 0; i < currentEffectCount; i++) {
          let particle: Particle;
          switch (currentSelectedEffect) {
            case "Sparkle":
              particle = new SparkleParticle(x, y, magnitude);
              break;
            case "Fire":
              particle = new FireParticle(x, y, magnitude);
              break;
            case "Bubbles":
              particle = new BubbleParticle(x, y, magnitude);
              break;
            case "Snow":
              particle = new SnowParticle(x, y, magnitude);
              break;
            case "Holiday":
              particle = new HolidayColorsParticle(x, y, magnitude);
              break;
            case "GeometricSnow":
              particle = new ComplexSnowflakeParticle(x, y, magnitude);
              break;
            case "GiftBox":
              particle = new GiftBoxParticle(x, y, magnitude);
              break;
            case "Normal":
            default:
              particle = new NormalParticle(x, y, magnitude);
              break;
          }
          particlesRef.current.push(particle);
        }
      };

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.update();
        p.draw(handCtx);
        if (p.life <= 0) particlesRef.current.splice(i, 1);
      }

      // --- Scale Calculation ---
      let srcWidth = currentDimensions.width;
      let srcHeight = currentDimensions.height;
      if (isFullscreen) {
        // In fullscreen, detectPose uses the rect size if available
        // We approximate this by using the current canvas size since it matches rect
        if (handCanvas.width > 0) {
          srcWidth = handCanvas.width;
          srcHeight = handCanvas.height;
        }
      }

      const scaleX = handCanvas.width / srcWidth;
      const scaleY = handCanvas.height / srcHeight;

      // --- Hand Tracking Trigger ---

      const scaledThreshold = currentMoveThreshold * ((scaleX + scaleY) / 2);

      for (const pose of rawPoses) {
        if (!pose.keypoints) continue;

        let leftWristIdx: number, rightWristIdx: number, noseIdx: number, leftAnkleIdx: number, rightAnkleIdx: number;

        if (currentDetectorType === "MoveNet") {
          noseIdx = 0;
          leftWristIdx = 9;
          rightWristIdx = 10;
          leftAnkleIdx = 15;
          rightAnkleIdx = 16;
        } else {
          // BlazePose
          noseIdx = 0;
          leftWristIdx = 15;
          rightWristIdx = 16;
          leftAnkleIdx = 27;
          rightAnkleIdx = 28;
        }

        const checkAndEmit = (idx: number, key: string, isEnabled: boolean) => {
          // Reset if disabled
          if (!isEnabled) {
            lastMarkerPositionsRef.current[key] = null;
            return;
          }

          const kp = pose.keypoints[idx];
          if (kp?.score && kp.score > 0.5) {
            const pt = { x: kp.x * scaleX, y: kp.y * scaleY };
            const lastPos = lastMarkerPositionsRef.current[key];
            if (lastPos) {
              const dist = Math.hypot(pt.x - lastPos.x, pt.y - lastPos.y);
              if (dist > scaledThreshold) {
                emitParticles(pt.x, pt.y, dist);
              }
            }
            lastMarkerPositionsRef.current[key] = pt;
          } else {
            lastMarkerPositionsRef.current[key] = null;
          }
        };

        checkAndEmit(rightWristIdx, 'rightHand', currentSelectedMarkers.rightHand);
        checkAndEmit(leftWristIdx, 'leftHand', currentSelectedMarkers.leftHand);
        checkAndEmit(rightAnkleIdx, 'rightFoot', currentSelectedMarkers.rightFoot);
        checkAndEmit(leftAnkleIdx, 'leftFoot', currentSelectedMarkers.leftFoot);
        checkAndEmit(noseIdx, 'face', currentSelectedMarkers.face);
      }
    },
    [drawInteractiveOverlay]
  );

  const drawRecordingFrame = useCallback(
    (
      transformedPoses: poseDetection.Pose[]
    ) => {
      if (!isRecordingRef.current || !isRecordingVideoRef.current) return;

      const video = videoRef.current;
      const recCanvas = recordingCanvasRef.current;
      const ctx = recCanvas?.getContext("2d");

      if (!video || !recCanvas || !ctx) return;

      // Ensure canvas matches video size
      if (recCanvas.width !== video.videoWidth || recCanvas.height !== video.videoHeight) {
        recCanvas.width = video.videoWidth;
        recCanvas.height = video.videoHeight;
      }

      // 1. Draw Video Frame
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-recCanvas.width, 0);
      ctx.drawImage(video, 0, 0, recCanvas.width, recCanvas.height);
      ctx.restore();

      // 2. Draw Pose Overlay if enabled
      if (includePoseInVideoRef.current) {
        // We need to re-transform keypoints for the raw video frame?
        // Actually, transformedPoses are already transformed to "un-homographied" space if I recall correctly?
        // Let's check getHomography logic.
        // The `transformedPoses` in `drawResults` seem to be adjusted for the "Input View" which is the raw video view?
        // The code says: "Draw Skeleton on Input View (Transformed back to original view)"
        // So `transformedPoses` should be correct for the raw video frame.

        for (const pose of transformedPoses) {
          if (pose.keypoints) {
            drawKeypoints(pose.keypoints, 0.5, ctx);
            drawSkeleton(pose.keypoints, 0.5, ctx);
          }
        }
      }
    },
    []
  );

  // --- Core Detection Logic ---
  const detectPose = useCallback(async () => {
    const detector = detectorRef.current;
    const landmarker = landmarkerRef.current;
    const video = videoRef.current;
    const handCanvas = handCanvasRef.current;
    const currentQuadPoints = quadPointsRef.current;
    const currentDimensions = handCanvasDimensionsRef.current;
    const isFullscreen = handCanvasFullscreenRef.current;
    const isFullInputMode = inputModeRef.current === "Full";
    const currentDetectorType = detectorTypeRef.current;

    const hasDetector =
      currentDetectorType === "MediaPipe" ? landmarker : detector;
    if (hasDetector && video && video.readyState === 4 && handCanvas) {
      try {
        if (!transformedCanvasRef.current)
          transformedCanvasRef.current = document.createElement("canvas");
        const transformedCanvas = transformedCanvasRef.current;

        let targetWidth, targetHeight;
        if (isFullscreen) {
          const rect = handCanvas.getBoundingClientRect();
          targetWidth = rect.width > 0 ? rect.width : currentDimensions.width;
          targetHeight =
            rect.height > 0 ? rect.height : currentDimensions.height;
        } else {
          targetWidth = currentDimensions.width;
          targetHeight = currentDimensions.height;
        }

        if (
          transformedCanvas.width !== targetWidth ||
          transformedCanvas.height !== targetHeight
        ) {
          transformedCanvas.width = targetWidth;
          transformedCanvas.height = targetHeight;
        }

        // WebGL Processing
        let gl = transformedCanvas.getContext("webgl");
        if (!gl) return;

        type GLCanvas = HTMLCanvasElement & {
          glContextInitialized?: boolean;
          program?: WebGLProgram;
          positionBuffer?: WebGLBuffer;
          texture?: WebGLTexture;
        };
        const glCanvas = transformedCanvas as GLCanvas;

        if (!glCanvas.glContextInitialized) {
          const vs = `attribute vec2 a_pos; attribute vec2 a_tex; varying vec2 v_tex; void main(){gl_Position=vec4(a_pos,0,1);v_tex=a_tex;}`;
          const fs = `precision mediump float; uniform sampler2D u_img; uniform vec2 u_res; uniform vec2 u_vid_res; uniform float u_h[9];
                    void main(){
                        float x = gl_FragCoord.x; float y = u_res.y - gl_FragCoord.y;
                        float Z = u_h[6]*x + u_h[7]*y + u_h[8];
                        float srcX = (u_h[0]*x + u_h[1]*y + u_h[2])/Z;
                        float srcY = (u_h[3]*x + u_h[4]*y + u_h[5])/Z;
                        vec2 tex = vec2(srcX/u_vid_res.x, srcY/u_vid_res.y);
                        if(tex.x>=0.0 && tex.x<=1.0 && tex.y>=0.0 && tex.y<=1.0) gl_FragColor=texture2D(u_img, tex);
                        else gl_FragColor=vec4(0,0,0,1);
                    }`;

          const compile = (t: number, s: string) => {
            const sh = gl!.createShader(t);
            gl!.shaderSource(sh!, s);
            gl!.compileShader(sh!);
            return sh;
          };
          const prog = gl.createProgram();
          gl.attachShader(prog!, compile(gl.VERTEX_SHADER, vs)!);
          gl.attachShader(prog!, compile(gl.FRAGMENT_SHADER, fs)!);
          gl.linkProgram(prog!);
          glCanvas.program = prog!;

          const buf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW
          );
          glCanvas.positionBuffer = buf!;

          const tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          glCanvas.texture = tex!;
          glCanvas.glContextInitialized = true;
        }

        const prog = glCanvas.program!;
        gl.useProgram(prog);

        const ploc = gl.getAttribLocation(prog, "a_pos");
        gl.enableVertexAttribArray(ploc);
        gl.bindBuffer(gl.ARRAY_BUFFER, glCanvas.positionBuffer!);
        gl.vertexAttribPointer(ploc, 2, gl.FLOAT, false, 0, 0);

        const dstPoints = [
          { x: 0, y: 0 },
          { x: transformedCanvas.width, y: 0 },
          { x: transformedCanvas.width, y: transformedCanvas.height },
          { x: 0, y: transformedCanvas.height },
        ];

        // Determine source points based on mode
        let srcPoints = currentQuadPoints;
        if (isFullInputMode) {
          srcPoints = [
            { x: 0, y: 0 },
            { x: video.videoWidth, y: 0 },
            { x: video.videoWidth, y: video.videoHeight },
            { x: 0, y: video.videoHeight },
          ];
        }

        const h = getHomographyMatrix(srcPoints, dstPoints);
        const h_inv = getHomographyMatrix(dstPoints, srcPoints);
        if (!h || !h_inv) return;
        matricesRef.current = { h, h_inv };

        gl.uniform2f(
          gl.getUniformLocation(prog, "u_res"),
          transformedCanvas.width,
          transformedCanvas.height
        );
        gl.uniform2f(
          gl.getUniformLocation(prog, "u_vid_res"),
          video.videoWidth,
          video.videoHeight
        );
        gl.uniform1fv(
          gl.getUniformLocation(prog, "u_h"),
          new Float32Array(h_inv)
        );

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, glCanvas.texture!);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          video
        );
        gl.viewport(0, 0, transformedCanvas.width, transformedCanvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Estimate Poses
        let rawPoses: poseDetection.Pose[] = [];

        if (landmarker && currentDetectorType === "MediaPipe") {
          let timestamp = performance.now();
          // Ensure strictly monotonically increasing timestamp
          if (timestamp <= lastVideoTimeRef.current) {
            timestamp = lastVideoTimeRef.current + 0.1; // Minimal increment
          }
          lastVideoTimeRef.current = timestamp;

          const result = landmarker.detectForVideo(
            transformedCanvas,
            timestamp
          );
          if (result.landmarks && result.landmarks.length > 0) {
            // Convert MediaPipe Landmarks to TensorFlow.js Pose format
            rawPoses = result.landmarks.map((landmarks) => ({
              keypoints: landmarks.map((lm, i) => ({
                x: lm.x * transformedCanvas.width,
                y: lm.y * transformedCanvas.height,
                z: lm.z,
                score: (lm as any).visibility ?? 1.0, // PoseLandmarker has visibility/presence
                name: i.toString(), // Names mapped elsewhere or not crucial here
              })),
            }));
          }
        } else if (detector) {
          rawPoses = await detector.estimatePoses(transformedCanvas, {
            flipHorizontal: false,
          });
        }

        // Transform Poses back
        const transformedPoses = rawPoses.map((pose) => ({
          ...pose,
          keypoints: pose.keypoints.map((kp) => {
            const op = transformPoint(kp, h_inv);
            return { ...kp, x: op.x, y: op.y };
          }),
        }));

        // Record Data
        if (isRecordingRef.current) {
          const now = Date.now();
          if (now - lastRecordTimeRef.current >= 250) {
            lastRecordTimeRef.current = now;
            const keypointNames =
              detectorTypeRef.current === "MoveNet"
                ? [
                  "nose",
                  "left_eye",
                  "right_eye",
                  "left_ear",
                  "right_ear",
                  "left_shoulder",
                  "right_shoulder",
                  "left_elbow",
                  "right_elbow",
                  "left_wrist",
                  "right_wrist",
                  "left_hip",
                  "right_hip",
                  "left_knee",
                  "right_knee",
                  "left_ankle",
                  "right_ankle",
                ]
                : [
                  "nose",
                  "left_eye_inner",
                  "left_eye",
                  "left_eye_outer",
                  "right_eye_inner",
                  "right_eye",
                  "right_eye_outer",
                  "left_ear",
                  "right_ear",
                  "mouth_left",
                  "mouth_right",
                  "left_shoulder",
                  "right_shoulder",
                  "left_elbow",
                  "right_elbow",
                  "left_wrist",
                  "right_wrist",
                  "left_pinky",
                  "right_pinky",
                  "left_index",
                  "right_index",
                  "left_thumb",
                  "right_thumb",
                  "left_hip",
                  "right_hip",
                  "left_knee",
                  "right_knee",
                  "left_ankle",
                  "right_ankle",
                  "left_heel",
                  "right_heel",
                  "left_foot_index",
                  "right_foot_index",
                ];

            for (const pose of transformedPoses) {
              if (pose.keypoints && pose.keypoints.length > 0) {
                const kpData = pose.keypoints.map((kp, idx) => ({
                  x: Math.round(kp.x * 100) / 100,
                  y: Math.round(kp.y * 100) / 100,
                  score: kp.score || 0,
                  name: keypointNames[idx] || `kp_${idx}`,
                }));
                setRecordedData((prev) => ({
                  ...prev,
                  poses: [
                    ...prev.poses,
                    {
                      timestamp: now - recordingStartTimeRef.current,
                      keypoints: kpData,
                    },
                  ],
                }));
              }
            }
          }
        }

        drawResults(rawPoses, transformedPoses);
        drawRecordingFrame(transformedPoses);
      } catch (error) {
        console.error("Detection Error", error);
      }
    }
  }, [drawResults]);

  // --- Boot Sequence ---
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setIsModelReady(false);
      if (detectorRef.current) detectorRef.current.dispose();
      if (landmarkerRef.current) landmarkerRef.current.close();
      detectorRef.current = null;
      landmarkerRef.current = null;
      // Reset timestamp for MediaPipe - critical for model switching
      lastVideoTimeRef.current = -1;
      setStatus("Loading Model...");

      try {
        const [tfModule, pdModule] = await Promise.all([
          import("@tensorflow/tfjs"),
          import("@tensorflow-models/pose-detection"),
        ]);

        if (processingMode === "GPU")
          await import("@tensorflow/tfjs-backend-webgl");
        else if (processingMode === "CPU")
          await import("@tensorflow/tfjs-backend-cpu");
        else {
          await import("@tensorflow/tfjs-backend-webgpu");
          await import("@tensorflow/tfjs-backend-webgl");
        }

        await tfModule
          .setBackend(
            processingMode === "CPU"
              ? "cpu"
              : processingMode === "GPU"
                ? "webgl"
                : "webgpu"
          )
          .catch(() => tfModule.setBackend("webgl"));
        await tfModule.ready();

        let model;
        if (detectorType === "MoveNet") {
          model = pdModule.SupportedModels.MoveNet;
          detectorRef.current = await pdModule.createDetector(model, {
            modelType:
              moveNetModelType === "Lightning"
                ? pdModule.movenet.modelType.SINGLEPOSE_LIGHTNING
                : moveNetModelType === "Thunder"
                  ? pdModule.movenet.modelType.SINGLEPOSE_THUNDER
                  : pdModule.movenet.modelType.MULTIPOSE_LIGHTNING,
          });
          adjacentPairsRef.current = pdModule.util.getAdjacentPairs(model) as [
            number,
            number
          ][];
        } else {
          // MediaPipe Tasks Vision
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
          );
          const isLite = blazePoseModelType === "lite";
          const isHeavy = blazePoseModelType === "heavy";
          const modelAssetPath = isLite
            ? "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
            : isHeavy
              ? "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task"
              : "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

          landmarkerRef.current = await PoseLandmarker.createFromOptions(
            vision,
            {
              baseOptions: {
                modelAssetPath: modelAssetPath,
                delegate: processingMode === "GPU" ? "GPU" : "CPU",
              },
              runningMode: "VIDEO",
              numPoses: 1,
              minPoseDetectionConfidence: 0.5,
              minPosePresenceConfidence: 0.5,
              minTrackingConfidence: 0.5,
            }
          );
          // Define adjacent pairs for MediaPipe (Standard BlazePose Topology)
          adjacentPairsRef.current = PoseLandmarker.POSE_CONNECTIONS.map(
            (c) => [c.start, c.end]
          );
        }
        setIsModelReady(true);

        setStatus("Starting Camera...");
        if (videoRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: selectedCameraId
              ? {
                deviceId: { exact: selectedCameraId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
              : { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            videoRef.current?.play();
            setVideoDimensions({
              width: videoRef.current!.videoWidth,
              height: videoRef.current!.videoHeight,
            });
            setIsCameraReady(true);
            setIsLoading(false);
            setStatus("Ready");
            const devs = await navigator.mediaDevices.enumerateDevices();
            setCameras(devs.filter((d) => d.kind === "videoinput"));
            if (!selectedCameraId && devs.length > 0)
              setSelectedCameraId(devs[0].deviceId);
          };
        }
      } catch (e) {
        console.error(e);
        setStatus("Initialization Failed");
        setIsLoading(false);
      }
    };
    init();
    return () => {
      if (videoRef.current?.srcObject)
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
    };
  }, [
    detectorType,
    moveNetModelType,
    blazePoseModelType,
    processingMode,
    selectedCameraId,
  ]);

  // --- Loop ---
  useEffect(() => {
    let id: number;
    const loop = async () => {
      await detectPose();
      id = requestAnimationFrame(loop);
    };
    if (isModelReady && isCameraReady) loop();
    return () => cancelAnimationFrame(id);
  }, [isModelReady, isCameraReady, detectPose]);

  // --- Interaction Handlers ---
  const getPointerPos = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;

    const clientX =
      "touches" in e.nativeEvent
        ? e.nativeEvent.touches[0].clientX
        : (e as React.MouseEvent).clientX;
    const clientY =
      "touches" in e.nativeEvent
        ? e.nativeEvent.touches[0].clientY
        : (e as React.MouseEvent).clientY;

    // Calculate the actual displayed dimensions of the video (object-contain)
    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = rect.width / rect.height;

    let renderWidth, renderHeight, offsetX, offsetY;

    if (containerRatio > videoRatio) {
      // Container is wider than video - black bars on sides
      renderHeight = rect.height;
      renderWidth = rect.height * videoRatio;
      offsetX = (rect.width - renderWidth) / 2;
      offsetY = 0;
    } else {
      // Container is taller than video - black bars on top/bottom
      renderWidth = rect.width;
      renderHeight = rect.width / videoRatio;
      offsetX = 0;
      offsetY = (rect.height - renderHeight) / 2;
    }

    // Coordinates relative to the container
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;

    // Map to normalized video coordinates (0..1)
    // Note: The video and canvas are flipped horizontally via CSS (scaleX(-1))
    // So visual Left (0) corresponds to logical Right (1).
    // We enforce 0..1 clamping to avoid dragging outside the video area
    let normX = (relX - offsetX) / renderWidth;
    let normY = (relY - offsetY) / renderHeight;

    // Check if click is inside the video area (optional, but good for UX)
    // For dragging, we might want to allow slight overshoot, but for starting drag, likely inside.
    // Let's just clamp for robustness so points don't fly off to infinity if dragged into black bars.
    normX = Math.max(0, Math.min(1, normX));
    normY = Math.max(0, Math.min(1, normY));

    // Apply Flip
    normX = 1 - normX;

    return {
      x: normX * video.videoWidth,
      y: normY * video.videoHeight,
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPointerPos(e);
    if (!pos) return;
    quadPoints.some((p, i) => {
      if (Math.hypot(p.x - pos.x, p.y - pos.y) < DRAG_HANDLE_SIZE) {
        setDraggingPointIndex(i);
        return true;
      }
      return false;
    });
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (draggingPointIndex === null) return;
    e.preventDefault();
    const pos = getPointerPos(e);
    if (pos)
      setQuadPoints((prev) =>
        prev.map((p, i) => (i === draggingPointIndex ? pos : p))
      );
  };

  const handleDownload = (memoOverride?: string) => {
    // Download JSON
    const data = { ...recordedData, memo: (memoOverride ?? memo).trim() || "No Memo" };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pose_data_${new Date(recordedData.startTime)
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Download Video if available
    if (recordedChunksRef.current.length > 0) {
      const videoBlob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const videoUrl = URL.createObjectURL(videoBlob);
      const v = document.createElement("a");
      v.href = videoUrl;
      v.download = `recording_${new Date(recordedData.startTime)
        .toISOString()
        .replace(/[:.]/g, "-")}.webm`;
      v.click();
      URL.revokeObjectURL(videoUrl);
    }

    setShowMemoDialog(false);
    setMemo("");
  };

  const startRecording = () => {
    setIsRecording(true);
    const channel = new BroadcastChannel("test20_settings_channel");
    channel.postMessage({ type: "RECORDING_STARTED", payload: { startTime: Date.now() } });
    channel.close();

    recordingStartTimeRef.current = Date.now();
    lastRecordTimeRef.current = Date.now();
    setRecordedData({
      startTime: Date.now(),
      poses: [],
    });

    // Start Video Recording
    if (isRecordingVideo) {
      recordedChunksRef.current = [];
      const canvas = recordingCanvasRef.current;
      const video = videoRef.current;
      if (canvas && video) {
        // Ensure canvas size is set before stream capture
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const stream = canvas.captureStream(30); // 30 FPS
        const mimeType = MediaRecorder.isTypeSupported("video/webm; codecs=vp9")
          ? "video/webm; codecs=vp9"
          : "video/webm";

        try {
          const recorder = new MediaRecorder(stream, { mimeType });
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              recordedChunksRef.current.push(e.data);
            }
          };
          recorder.start();
          mediaRecorderRef.current = recorder;
        } catch (e) {
          console.error("MediaRecorder init failed", e);
        }
      }
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    const channel = new BroadcastChannel("test20_settings_channel");
    channel.postMessage({ type: "RECORDING_STOPPED" });
    channel.close();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  // --- UI Components ---
  const SectionHeader = ({
    id,
    label,
    icon: Icon,
  }: {
    id: string;
    label: string;
    icon: any;
  }) => {
    const isActive = activeSections.includes(id);
    return (
      <button
        onClick={() => {
          if (isActive) {
            setActiveSections(activeSections.filter((s) => s !== id));
          } else {
            setActiveSections([...activeSections, id]);
          }
        }}
        className={`flex items-center justify-between w-full p-3 rounded-lg transition-all mb-2 ${isActive
          ? "bg-slate-800 border-l-4 border-blue-500 shadow-lg"
          : "bg-slate-900/50 hover:bg-slate-800 border-l-4 border-transparent"
          }`}
      >
        <div className="flex items-center space-x-2 text-sm font-semibold text-slate-200">
          <Icon size={18} className={isActive ? "text-blue-400" : "text-slate-400"} />
          <span>{label}</span>
        </div>
        {isActive ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* --- Header --- */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Test 20: Interactive Pose
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <span
            className={`text-xs px-2 py-1 rounded-full ${isModelReady
              ? "bg-green-500/20 text-green-400"
              : "bg-yellow-500/20 text-yellow-400"
              }`}
          >
            {status}
          </span>
          <button
            onClick={() =>
              window.open(
                "/kennkyu/test20/controller",
                "Test20Controller",
                "width=400,height=800"
              )
            }
            className="p-2 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white flex items-center space-x-2"
            title="Open Controller"
          >
            <ExternalLink size={20} />
            <span className="text-sm font-medium">コントローラー</span>
          </button>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 hover:bg-slate-800 rounded-md transition-colors"
          >
            <Layout size={20} />
          </button>
        </div>
      </header>

      {/* --- Main Body --- */}
      <div className="flex flex-1 overflow-hidden">
        {/* --- Main Stage --- */}
        <div className="flex-1 relative flex flex-col p-4 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950">
          {/* View Switcher Tabs */}
          <div className="flex space-x-4 mb-4 z-10">
            <button
              onClick={() => setViewMode("play")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${viewMode === "play"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
            >
              <Play size={16} />
              <span>Play Mode</span>
            </button>
            <button
              onClick={() => setViewMode("setup")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${viewMode === "setup"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
            >
              <Sliders size={16} />
              <span>Setup Mode</span>
            </button>
          </div>

          <div className="flex-1 relative flex items-center justify-center min-h-0">
            {/* Output Canvas (The Result) */}
            {!handCanvasFullscreen && (
              <div
                className={`relative flex items-center justify-center transition-all duration-500 ease-in-out border border-slate-700 bg-slate-900 rounded-2xl overflow-hidden shadow-2xl ${viewMode === "play" ? "w-full h-full" : "w-1/2 h-2/3 mr-4"
                  }`}
              >
                <canvas
                  ref={handCanvasRef}
                  className="w-full h-full object-contain block"
                  style={{ transform: "scaleX(-1)" }}
                  onClick={(e) => e.stopPropagation()}
                />

                {/* Fullscreen Toggle Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setHandCanvasFullscreen(true);
                  }}
                  className="absolute bottom-4 right-4 p-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full backdrop-blur-md shadow-lg transition-transform hover:scale-105 z-[60] border border-slate-600"
                >
                  <Maximize size={24} />
                </button>

                {/* Label */}
                <div className="absolute top-4 left-4 text-xs font-mono text-slate-400 bg-slate-900/90 px-3 py-1.5 rounded-full border border-slate-700 z-[60]">
                  Output View
                </div>
              </div>
            )}

            {/* Input Video (The Setup) - Always rendered to keep videoRef alive */}
            <div
              className={`relative border border-slate-700 bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center cursor-crosshair transition-all duration-500 ease-in-out
                                ${viewMode === "setup"
                  ? "w-1/2 h-2/3 opacity-100 scale-100"
                  : "w-0 h-0 opacity-0 scale-0 overflow-hidden absolute pointer-events-none"
                }
                            `}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={() => setDraggingPointIndex(null)}
              onMouseLeave={() => setDraggingPointIndex(null)}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={() => setDraggingPointIndex(null)}
            >
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-contain"
                style={{ transform: "scaleX(-1)" }}
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-contain"
                style={{ transform: "scaleX(-1)" }}
              />
              <div className="absolute top-4 left-4 text-xs font-mono text-slate-500 bg-slate-900/80 px-2 py-1 rounded">
                Input / Adjustment
              </div>
              <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-blue-300 pointer-events-none">
                Drag yellow points to align detection area
              </div>
            </div>
          </div>
        </div>

        {/* --- Sidebar --- */}
        <AnimatePresence>
          {showSidebar && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-slate-950 border-l border-slate-800 flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-4 space-y-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:none]">
                {/* Effects Section */}
                <SectionHeader
                  id="effects"
                  label="エフェクト設定"
                  icon={ImageIcon}
                />
                {activeSections.includes("effects") && (
                  <div className="p-3 bg-slate-900/30 rounded-lg space-y-4 mb-2">
                    <div className="space-y-2">
                      <HelpLabel
                        label="Effect Type"
                        description="エフェクトの種類を選択します。"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          "Normal",
                          "Sparkle",
                          "Fire",
                          "Bubbles",
                          "Snow",
                          "Holiday",
                          "GeometricSnow",
                          "GiftBox",
                        ].map((e) => (
                          <button
                            key={e}
                            onClick={() => setSelectedEffect(e as EffectType)}
                            className={`px-2 py-2 text-xs rounded-md border text-center transition ${selectedEffect === e
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                              }`}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <HelpLabel
                        label="背景"
                        description="背景画像を変更します。"
                      />
                      <select
                        value={selectedBackground}
                        onChange={(e) => setSelectedBackground(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-md p-2"
                      >
                        {BackgroundImages.map((img) => (
                          <option key={img.name} value={img.path}>
                            {img.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <HelpLabel
                        label="音声"
                        description="エフェクト発生時の効果音を設定します。"
                      />
                      <select
                        value={selectedSound ? selectedSound.name : ""}
                        onChange={(e) => {
                          const s = Sounds.find(
                            (snd) => snd.name === e.target.value
                          );
                          if (s) {
                            setSelectedSound(s);
                            changeSound(s);
                          }
                        }}
                        className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-md p-2"
                      >
                        <option value="">None</option>
                        {Sounds.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-4 pt-2">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <HelpLabel
                            label="パーティクル数"
                            description="一度に発生するエフェクトの数を調整します。"
                          />
                          <span className="text-xs text-slate-400">{effectCount}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="20"
                          value={effectCount}
                          onChange={(e) =>
                            setEffectCount(Number(e.target.value))
                          }
                          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <HelpLabel
                            label="動作検出感度"
                            description="動作を検出する感度を調整します。値が小さいほど敏感になります。"
                          />
                          <span className="text-xs text-slate-400">{moveThreshold}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={moveThreshold}
                          onChange={(e) =>
                            setMoveThreshold(Number(e.target.value))
                          }
                          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Marker Section */}
                <SectionHeader id="markers" label="マーカー設定" icon={Sliders} />
                {activeSections.includes("markers") && (
                  <div className="p-3 bg-slate-900/30 rounded-lg space-y-4 mb-2">
                    <div className="space-y-2">
                      <HelpLabel label="有効なマーカー" description="パーティクルを発生させる部位を選択します。" />
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { k: "face", l: "顔 (Face)" },
                          { k: "rightHand", l: "右手 (R-Hand)" },
                          { k: "leftHand", l: "左手 (L-Hand)" },
                          { k: "rightFoot", l: "右足 (R-Foot)" },
                          { k: "leftFoot", l: "左足 (L-Foot)" },
                        ].map((item) => (
                          <label key={item.k} className="flex items-center space-x-2 bg-slate-800 p-2 rounded-lg cursor-pointer hover:bg-slate-750 transition">
                            <input
                              type="checkbox"
                              checked={selectedMarkers[item.k as keyof MarkerConfig]}
                              onChange={(e) => {
                                const newMarkers = { ...selectedMarkers, [item.k]: e.target.checked };
                                setSelectedMarkers(newMarkers);
                              }}
                              className="w-4 h-4 rounded text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                            />
                            <span className="text-xs text-slate-300">{item.l}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* System Section */}
                <SectionHeader
                  id="system"
                  label="システム設定"
                  icon={Settings}
                />
                {activeSections.includes("system") && (
                  <div className="p-3 bg-slate-900/30 rounded-lg space-y-4 mb-2">
                    <div className="space-y-2">
                      <HelpLabel
                        label="検出器"
                        description={`MoveNet: 高速で軽量。
MediaPipe: 高精度だが負荷が高い。`}
                      />
                      <div className="flex bg-slate-800 rounded-lg p-1">
                        <button
                          onClick={() => setDetectorType("MoveNet")}
                          className={`flex-1 py-1.5 text-xs rounded-md transition ${detectorType === "MoveNet"
                            ? "bg-slate-600 text-white"
                            : "text-slate-400"
                            }`}
                        >
                          MoveNet
                        </button>
                        <button
                          onClick={() => setDetectorType("MediaPipe")}
                          className={`flex-1 py-1.5 text-xs rounded-md transition ${detectorType === "MediaPipe"
                            ? "bg-slate-600 text-white"
                            : "text-slate-400"
                            }`}
                        >
                          MediaPipe
                        </button>
                      </div>
                    </div>

                    {/* Model Type Selection */}
                    <div className="space-y-2">
                      <HelpLabel
                        label="モデルタイプ"
                        description={
                          detectorType === "MoveNet"
                            ? `Lightning: 最速。
Thunder: 高精度。
MultiPose: 複数人対応。`
                            : `Lite: 軽量。
Full: 標準。
Heavy: 最高精度。`
                        }
                      />
                      {detectorType === "MoveNet" ? (
                        <div className="flex bg-slate-800 rounded-lg p-1">
                          {(["Lightning", "Thunder", "multiPose"] as const).map(
                            (t) => (
                              <button
                                key={t}
                                onClick={() => setMoveNetModelType(t)}
                                className={`flex-1 py-1.5 text-xs rounded-md transition ${moveNetModelType === t
                                  ? "bg-slate-600 text-white"
                                  : "text-slate-400"
                                  }`}
                              >
                                {t === "multiPose" ? "Multi" : t}
                              </button>
                            )
                          )}
                        </div>
                      ) : (
                        <div className="flex bg-slate-800 rounded-lg p-1">
                          {(["lite", "full", "heavy"] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setBlazePoseModelType(t)}
                              className={`flex-1 py-1.5 text-xs rounded-md transition ${blazePoseModelType === t
                                ? "bg-slate-600 text-white"
                                : "text-slate-400"
                                }`}
                            >
                              {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <HelpLabel
                        label="カメラ入力モード"
                        description={`指定範囲: 四角形で指定した範囲を切り抜いて認識します。
全画面: カメラ映像全体を認識します。`}
                      />
                      <div className="flex bg-slate-800 rounded-lg p-1">
                        <button
                          onClick={() => setInputMode("Range")}
                          className={`flex-1 py-1.5 text-xs rounded-md transition ${inputMode === "Range"
                            ? "bg-slate-600 text-white"
                            : "text-slate-400"
                            }`}
                        >
                          指定範囲
                        </button>
                        <button
                          onClick={() => setInputMode("Full")}
                          className={`flex-1 py-1.5 text-xs rounded-md transition ${inputMode === "Full"
                            ? "bg-slate-600 text-white"
                            : "text-slate-400"
                            }`}
                        >
                          全画面
                        </button>
                      </div>
                    </div>


                    <div className="space-y-2">
                      <HelpLabel
                        label="カメラソース"
                        description="使用するカメラデバイスを変更します。"
                      />
                      <select
                        value={selectedCameraId}
                        onChange={(e) => setSelectedCameraId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-md p-2"
                      >
                        {cameras.map((c, i) => (
                          <option key={c.deviceId} value={c.deviceId}>
                            {c.label || `Camera ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                  </div>
                )}

                {/* Recording Section */}
                <SectionHeader id="rec" label="記録" icon={Mic} />
                {activeSections.includes("rec") && (
                  <div className="p-3 bg-slate-900/30 rounded-lg space-y-4 mb-2">
                    {/* Recording Settings */}
                    <div className="bg-slate-800/50 p-2 rounded-lg space-y-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isRecordingVideo}
                          onChange={(e) => setIsRecordingVideo(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-slate-300">カメラの映像を同時に記録する</span>
                      </label>
                      <label className={`flex items-center space-x-2 cursor-pointer ${!isRecordingVideo ? 'opacity-50 pointer-events-none' : ''}`}>
                        <input
                          type="checkbox"
                          checked={includePoseInVideo}
                          onChange={(e) => setIncludePoseInVideo(e.target.checked)}
                          disabled={!isRecordingVideo}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-slate-300">姿勢検出マーカーを含める</span>
                      </label>
                    </div>

                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`w-full py-4 rounded-xl flex flex-col items-center justify-center space-y-2 transition-all ${isRecording
                        ? "bg-red-500/20 border-2 border-red-500 hover:bg-red-500/30"
                        : "bg-slate-800 border border-slate-700 hover:bg-slate-750 hover:border-blue-500"
                        }`}
                    >
                      {isRecording ? (
                        <Square className="text-red-500 fill-current" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-red-500" />
                      )}
                      <span
                        className={`text-xs font-bold ${isRecording ? "text-red-400" : "text-slate-300"
                          }`}
                      >
                        {isRecording ? "記録停止" : "記録開始"}
                      </span>
                    </button>
                    {isRecording && (
                      <div className="text-center space-y-1">
                        <div className="text-2xl font-mono text-white">
                          {(
                            (Date.now() - recordingStartTimeRef.current) /
                            1000
                          ).toFixed(1)}
                          s
                        </div>
                        <div className="text-xs text-slate-500">
                          {recordedData.poses.length} frames
                        </div>
                      </div>
                    )}
                    {!isRecording && recordedData.poses.length > 0 && (
                      <button
                        onClick={() => setShowMemoDialog(true)}
                        className="w-full flex items-center justify-center space-x-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
                      >
                        <FileJson size={16} />
                        <span>ダウンロード</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* --- Modals --- */}
      <AnimatePresence>
        {showMemoDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-96 shadow-2xl"
            >
              <h3 className="text-lg font-bold text-white mb-4">Export Data</h3>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Add a memo..."
                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-blue-500 outline-none resize-none mb-4"
              />
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowMemoDialog(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDownload()}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm flex items-center justify-center space-x-2"
                >
                  <Save size={16} />
                  <span>保存</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Fullscreen Overlay --- */}
      {handCanvasFullscreen && (
        <div
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center cursor-zoom-out"
          onClick={() => setHandCanvasFullscreen(false)}
        >
          <canvas
            ref={handCanvasFullscreen ? handCanvasRef : null}
            className="h-full w-auto object-contain"
            style={{ transform: "scaleX(-1)" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setHandCanvasFullscreen(false);
            }}
            className="absolute bottom-6 right-6 p-4 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full backdrop-blur-md shadow-lg transition-transform hover:scale-110 border border-slate-600 z-[10000]"
          >
            <Minimize size={28} />
          </button>
        </div>
      )}
      <canvas ref={recordingCanvasRef} className="hidden" />
      {/* --- Tooltip Overlay --- */}
      {tooltip && (
        <div
          className="fixed z-[100] px-2 py-1 bg-black/90 border border-slate-700 text-xs text-slate-200 rounded shadow-lg pointer-events-none max-w-[200px] whitespace-pre-wrap"
          style={{ top: tooltip.y, left: tooltip.x }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
};

export default PoseDetector;
