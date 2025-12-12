"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Sounds, SoundList, BackgroundImages } from "@/components/data";
import type * as poseDetection from "@tensorflow-models/pose-detection";
import type * as tf from "@tensorflow/tfjs";
import { EffectType, Particle, NormalParticle, SparkleParticle, FireParticle, BubbleParticle, SnowParticle, HolidayColorsParticle, ComplexSnowflakeParticle, GiftBoxParticle } from "../effects/effects";

// モデルタイプを型として定義
type MoveNetModelType = "Lightning" | "Thunder" | "multiPose";
type BlazePoseModelType = "lite" | "full" | "heavy";
type DetectorType = "MoveNet" | "MediaPipe";

// 処理方法を型として定義
type ProcessingMode = "CPU" | "GPU" | "WebGPU";

// 2D座標の型定義
type Point = { x: number; y: number };

/**
 * 行列計算のためのヘルパーオブジェクト
 */
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
            while (pivot < dim && augmented[pivot][i] === 0) {
                pivot++;
            }
            if (pivot === dim) return null;
            [augmented[i], augmented[pivot]] = [augmented[pivot], augmented[i]];

            const divisor = augmented[i][i];
            for (let j = 0; j < 2 * dim; j++) {
                augmented[i][j] /= divisor;
            }

            for (let k = 0; k < dim; k++) {
                if (i !== k) {
                    const factor = augmented[k][i];
                    for (let j = 0; j < 2 * dim; j++) {
                        augmented[k][j] -= factor * augmented[i][j];
                    }
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

const PoseDetector = (): JSX.Element => {
    // --- State Hooks ---
    const [detectorType, setDetectorType] = useState<DetectorType>("MoveNet");
    const [moveNetModelType, setMoveNetModelType] = useState<MoveNetModelType>("Lightning");
    const [blazePoseModelType, setBlazePoseModelType] = useState<BlazePoseModelType>("full");
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
    const [handCanvasAspectRatio, setHandCanvasAspectRatio] = useState("4:3");
    const [handCanvasFullscreen, setHandCanvasFullscreen] = useState(false);

    // 背景画像管理用のState
    const [selectedBackground, setSelectedBackground] = useState<string>(
        BackgroundImages[0].path
    );
    const [backgroundImage, setBackgroundImage] =
        useState<HTMLImageElement | null>(null);

    // エフェクト選択用のState
    const [selectedEffect, setSelectedEffect] = useState<EffectType>("Normal");
    const [moveThreshold, setMoveThreshold] = useState<number>(5);
    const [effectCount, setEffectCount] = useState<number>(10);

    // データ記録機能用のState
    const [isRecording, setIsRecording] = useState(false);
    const [recordedData, setRecordedData] = useState<{
        startTime: number;
        memo?: string;
        poses: Array<{
            timestamp: number;
            keypoints: Array<{
                x: number;
                y: number;
                score: number;
                name: string;
            }>;
        }>;
    }>({ startTime: 0, poses: [] });
    const [memo, setMemo] = useState<string>("");
    const [showMemoDialog, setShowMemoDialog] = useState(false);
    const recordingStartTimeRef = useRef<number>(0);
    const lastRecordTimeRef = useRef<number>(0);

    // --- Refs for DOM elements and detection logic ---
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const handCanvasRef = useRef<HTMLCanvasElement>(null);
    const transformedCanvasRef = useRef<HTMLCanvasElement | null>(null); // ホモグラフィ変換用の仮想キャンバス
    const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
    const adjacentPairsRef = useRef<[number, number][] | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const lastHandPositionsRef = useRef<{
        left: Point | null;
        right: Point | null;
    }>({
        left: null,
        right: null,
    });
    const [selectedSound, setSelectedSound] = useState<SoundList | null>(null);

    // 音声再生用のRef
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // --- State for interactive quadrilateral ---
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
    // 最新のStateをRefに保持して、アニメーションループ内で参照する
    const quadPointsRef = useRef(quadPoints);
    const selectedEffectRef = useRef(selectedEffect);
    const moveThresholdRef = useRef(moveThreshold);
    const effectCountRef = useRef(effectCount);
    const isRecordingRef = useRef(isRecording);
    const handCanvasFullscreenRef = useRef(handCanvasFullscreen);
    const backgroundImageRef = useRef(backgroundImage);

    // Stateが更新されたらRefも更新
    useEffect(() => { quadPointsRef.current = quadPoints; }, [quadPoints]);
    useEffect(() => { selectedEffectRef.current = selectedEffect; }, [selectedEffect]);
    useEffect(() => { moveThresholdRef.current = moveThreshold; }, [moveThreshold]);
    useEffect(() => { effectCountRef.current = effectCount; }, [effectCount]);
    useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
    useEffect(() => { handCanvasFullscreenRef.current = handCanvasFullscreen; }, [handCanvasFullscreen]);
    useEffect(() => { backgroundImageRef.current = backgroundImage; }, [backgroundImage]);

    const detectorTypeRef = useRef(detectorType);
    useEffect(() => { detectorTypeRef.current = detectorType; }, [detectorType]);

    // マトリックス計算のメモ化用Ref
    const matricesRef = useRef<{ h: number[] | null, h_inv: number[] | null }>({ h: null, h_inv: null });

    // --- Memoized calculations ---
    const handCanvasDimensions = useMemo(() => {
        const baseWidth = 400;
        const ratio = handCanvasAspectRatio.split(":").map(Number);
        const height = (baseWidth * ratio[1]) / ratio[0];
        return { width: baseWidth, height };
    }, [handCanvasAspectRatio]);

    const handCanvasDimensionsRef = useRef(handCanvasDimensions);
    useEffect(() => { handCanvasDimensionsRef.current = handCanvasDimensions; }, [handCanvasDimensions]);


    const keypointNames = [
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
    ];

    const blazePoseKeypointNames = [
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
        "right_foot_index"
    ];

    // データ記録機能
    const startRecording = () => {
        const now = Date.now();
        recordingStartTimeRef.current = now;
        lastRecordTimeRef.current = now;
        setRecordedData({ startTime: now, poses: [] });
        setIsRecording(true);
        console.log("Recording started at:", new Date(now).toLocaleTimeString());
    };

    const stopRecording = () => {
        setIsRecording(false);
        console.log(
            "Recording stopped. Total poses recorded:",
            recordedData.poses.length
        );
    };

    const downloadData = () => {
        if (recordedData.poses.length === 0) {
            alert("記録されたデータがありません。");
            return;
        }
        setShowMemoDialog(true);
    };

    const confirmDownload = () => {
        const dataWithMemo = {
            ...recordedData,
            memo: memo.trim() || "メモなし",
        };

        const blob = new Blob([JSON.stringify(dataWithMemo, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pose_data_${new Date(recordedData.startTime)
            .toISOString()
            .replace(/[:.]/g, "-")}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShowMemoDialog(false);
        setMemo("");
    };

    const recordPoseData = (poses: poseDetection.Pose[]) => {
        if (!isRecordingRef.current) return;

        const now = Date.now();
        // 0.25秒 = 250ms 間隔でデータを記録
        if (now - lastRecordTimeRef.current >= 250) {
            lastRecordTimeRef.current = now;

            // console.log(
            //     `Recording pose data at ${now}, poses detected: ${poses.length}`
            // );

            for (const pose of poses) {
                if (pose.keypoints && pose.keypoints.length > 0) {
                    // 全てのキーポイントを記録（信頼度チェックなし）
                    const currentKeypointNames = detectorType === "MoveNet" ? keypointNames : blazePoseKeypointNames;
                    const keypointsData = pose.keypoints.map((kp, index) => ({
                        x: Math.round(kp.x * 100) / 100, // 小数点2桁に丸める
                        y: Math.round(kp.y * 100) / 100, // 小数点2桁に丸める
                        score: kp.score || 0,
                        name: currentKeypointNames[index] || `keypoint_${index}`,
                    }));

                    // console.log(`Recording keypoints: ${keypointsData.length} points`);

                    setRecordedData((prev) => ({
                        ...prev,
                        poses: [
                            ...prev.poses,
                            {
                                timestamp: now - recordingStartTimeRef.current,
                                keypoints: keypointsData,
                            },
                        ],
                    }));
                } else {
                    console.warn("No keypoints detected in pose");
                }
            }
        }
    };

    // 追加: 現在再生中かどうかを判定するヘルパー
    const isAudioPlaying = () => {
        const a = audioRef.current;
        return !!a && !a.paused && !a.ended && a.currentTime > 0;
    };

    const changeSound = (sound: SoundList) => {
        audioRef.current = new Audio(sound.dir + ".mp3");
        audioRef.current.load();
        console.log("Changed sound to:", sound.dir + ".mp3");
    };

    // --- Effect for loading background image ---
    useEffect(() => {
        if (selectedBackground) {
            const img = new Image();
            img.src = selectedBackground;
            img.onload = () => setBackgroundImage(img);
            img.onerror = () => {
                console.error("背景画像の読み込みに失敗しました:", selectedBackground);
                setBackgroundImage(null);
            };
        } else {
            setBackgroundImage(null);
        }
    }, [selectedBackground]);

    // --- Keyboard Shortcut for Recording ---
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === "r") {
                if (isRecording) {
                    stopRecording();
                } else {
                    startRecording();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isRecording, recordedData]); // Re-bind when state changes to ensure fresh closures


    // --- Helper Functions for Geometry and Transformation ---

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
        const X = (h[0] * x + h[1] * y + h[2]) / Z;
        const Y = (h[3] * x + h[4] * y + h[5]) / Z;
        return { x: X, y: Y };
    };

    const isPointInQuad = (point: Point, quad: Point[]): boolean => {
        const signs: number[] = [];
        for (let i = 0; i < 4; i++) {
            const p1 = quad[i];
            const p2 = quad[(i + 1) % 4];
            const crossProduct =
                (p2.x - p1.x) * (point.y - p1.y) - (p2.y - p1.y) * (point.x - p1.x);
            signs.push(Math.sign(crossProduct));
        }
        return signs.every((s) => s === signs[0] || s === 0);
    };

    // --- Drawing Functions ---

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
                kp1.score != null &&
                kp1.score > minConfidence &&
                kp2.score != null &&
                kp2.score > minConfidence
            ) {
                ctx.beginPath();
                ctx.moveTo(kp1.x, kp1.y);
                ctx.lineTo(kp2.x, kp2.y);
                ctx.stroke();
            }
        }
    };

    const drawInteractiveOverlay = useCallback(
        (ctx: CanvasRenderingContext2D, quadPoints: Point[]) => {
            ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(quadPoints[0].x, quadPoints[0].y);
            for (let i = 1; i < 4; i++) {
                ctx.lineTo(quadPoints[i].x, quadPoints[i].y);
            }
            ctx.closePath();
            ctx.stroke();

            ctx.fillStyle = "rgba(255, 255, 0, 1)";
            quadPoints.forEach((p) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, DRAG_HANDLE_SIZE, 0, 2 * Math.PI);
                ctx.fill();
            });
        },
        []
    );

    // パーティクルエフェクトと手の描画ロジックを統合した関数
    const drawResults = useCallback(
        (rawPoses: poseDetection.Pose[], transformedPoses: poseDetection.Pose[]) => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const handCanvas = handCanvasRef.current;
            // Refから最新の値を取得
            const currentQuadPoints = quadPointsRef.current;
            const currentSelectedEffect = selectedEffectRef.current;
            const currentMoveThreshold = moveThresholdRef.current;
            const currentEffectCount = effectCountRef.current;
            const isFullscreen = handCanvasFullscreenRef.current;
            const currentDimensions = handCanvasDimensionsRef.current;
            const currentBackgroundImage = backgroundImageRef.current;
            const h = matricesRef.current.h;
            const currentDetectorType = detectorTypeRef.current; // Refから取得

            if (!video || !canvas || !handCanvas || video.videoWidth === 0) return;

            // --- キャンバスの解像度設定 ---
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            if (isFullscreen) {
                const rect = handCanvas.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    if (
                        handCanvas.width !== rect.width ||
                        handCanvas.height !== rect.height
                    ) {
                        handCanvas.width = rect.width;
                        handCanvas.height = rect.height;
                    }
                }
            } else {
                handCanvas.width = currentDimensions.width;
                handCanvas.height = currentDimensions.height;
            }

            const ctx = canvas.getContext("2d");
            const handCtx = handCanvas.getContext("2d");
            if (!ctx || !handCtx) return;

            // --- メインキャンバスの描画 ---
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // 元の映像上の骨格は rawPoses ではなく transformedPoses の逆変換版が必要だが、
            // 簡略化のため、rawPoses (handCanvas座標) に対応するものは draw していない。
            // そもそも transformedPoses は「手元カメラ」の映像から検出したポーズを「元のカメラ座標」に戻したものなので、これを描画する。
            for (const pose of transformedPoses) {
                if (pose.keypoints) {
                    drawKeypoints(pose.keypoints, 0.5, ctx);
                    drawSkeleton(pose.keypoints, 0.5, ctx);
                }
            }
            drawInteractiveOverlay(ctx, currentQuadPoints);

            // --- 手のキャンバスの背景描画 ---
            if (currentBackgroundImage) {
                // 背景画像があれば描画
                handCtx.drawImage(
                    currentBackgroundImage,
                    0,
                    0,
                    handCanvas.width,
                    handCanvas.height
                );
            } else {
                // なければ単色で塗りつぶし
                handCtx.fillStyle = "#1a1a1a";
                handCtx.fillRect(0, 0, handCanvas.width, handCanvas.height);
            }

            // --- パーティクルの生成関数（音声再生付き） ---
            const emitParticles = (x: number, y: number, magnitude: number) => {
                // 音声を再生
                if (audioRef.current) {
                    if (isAudioPlaying()) {
                        // console.log("Audio is still playing. Skip starting new one.");
                    } else {
                        audioRef.current.currentTime = 0;
                        audioRef.current.play().catch((error) => {
                            console.error("Audio playback failed:", error);
                        });
                    }
                }

                // const particleCount = Math.min(Math.max(Math.floor(magnitude * 2), 5), 30);
                const particleCount = currentEffectCount;
                for (let i = 0; i < particleCount; i++) {
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
                        case "Normal":
                        default:
                            particle = new NormalParticle(x, y, magnitude);
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
                    }
                    particlesRef.current.push(particle);
                }
            };

            // --- パーティクルの更新と描画 ---
            for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                const p = particlesRef.current[i];
                p.update();
                p.draw(handCtx);
                if (p.life <= 0) {
                    particlesRef.current.splice(i, 1); // 寿命が尽きたら削除
                }
            }

            // --- 手の検出、マーカー描画、エフェクトトリガー ---
            // rawPoses (= 手元キャンバス座標系でのポーズ) を使用する
            let isLeftHandVisible = false;
            let isRightHandVisible = false;

            for (const pose of rawPoses) {
                if (!pose.keypoints) continue;

                // 手首のインデックスを取得 (Detectorによって異なる)
                // MoveNet: 9 (Left), 10 (Right)
                // BlazePose: 15 (Left), 16 (Right)
                const leftWristIdx = currentDetectorType === "MoveNet" ? 9 : 15;
                const rightWristIdx = currentDetectorType === "MoveNet" ? 10 : 16;

                const leftWrist = pose.keypoints[leftWristIdx];
                const rightWrist = pose.keypoints[rightWristIdx];

                // 左手の処理
                if (leftWrist?.score && leftWrist.score > 0.5) {
                    isLeftHandVisible = true;
                    // ここでは rawPoses (handCanvasの座標) をそのまま使える
                    const currentPoint = { x: leftWrist.x, y: leftWrist.y };

                    const lastPos = lastHandPositionsRef.current.left;
                    if (lastPos) {
                        const distance = Math.sqrt(
                            (currentPoint.x - lastPos.x) ** 2 +
                            (currentPoint.y - lastPos.y) ** 2
                        );
                        if (distance > currentMoveThreshold) {
                            emitParticles(currentPoint.x, currentPoint.y, distance);
                        }
                    }
                    lastHandPositionsRef.current.left = currentPoint;
                }

                // 右手の処理
                if (rightWrist?.score && rightWrist.score > 0.5) {
                    isRightHandVisible = true;
                    const currentPoint = { x: rightWrist.x, y: rightWrist.y };

                    const lastPos = lastHandPositionsRef.current.right;
                    if (lastPos) {
                        const distance = Math.sqrt(
                            (currentPoint.x - lastPos.x) ** 2 +
                            (currentPoint.y - lastPos.y) ** 2
                        );
                        if (distance > currentMoveThreshold) {
                            emitParticles(currentPoint.x, currentPoint.y, distance);
                        }
                    }
                    lastHandPositionsRef.current.right = currentPoint;
                }
            }

            // 手が範囲外に出たら、最後の位置をリセット
            if (!isLeftHandVisible) lastHandPositionsRef.current.left = null;
            if (!isRightHandVisible) lastHandPositionsRef.current.right = null;
        },
        [drawInteractiveOverlay] // 依存関係を最小限に。Refsを使うことで再生成を防ぐ
    );

    // --- Pointer Event Handlers for Interactive Quad (Mouse & Touch) ---
    const getPointerPos = (
        e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
    ): Point | null => {
        const rect = e.currentTarget.getBoundingClientRect();
        const video = videoRef.current;
        if (!video) return null;

        let clientX, clientY;
        if ("touches" in e.nativeEvent) {
            if (e.nativeEvent.touches.length === 0) return null;
            clientX = e.nativeEvent.touches[0].clientX;
            clientY = e.nativeEvent.touches[0].clientY;
        } else {
            clientX = e.nativeEvent.clientX;
            clientY = e.nativeEvent.clientY;
        }

        let x = clientX - rect.left;
        let y = clientY - rect.top;

        const scaleX = rect.width / video.videoWidth;
        const scaleY = rect.height / video.videoHeight;

        x /= scaleX;
        y /= scaleY;

        const flippedX = video.videoWidth - x;

        return { x: flippedX, y: y };
    };

    const handlePointerDown = (
        e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
    ) => {
        const pos = getPointerPos(e);
        if (!pos) return;
        for (let i = 0; i < quadPoints.length; i++) {
            const p = quadPoints[i];
            const distance = Math.sqrt((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2);
            if (distance < DRAG_HANDLE_SIZE) {
                setDraggingPointIndex(i);
                return;
            }
        }
    };

    const handlePointerMove = (
        e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
    ) => {
        if (draggingPointIndex === null) return;
        e.preventDefault();
        const pos = getPointerPos(e);
        if (!pos) return;
        setQuadPoints((prevPoints) =>
            prevPoints.map((p, i) => (i === draggingPointIndex ? pos : p))
        );
    };

    const handlePointerUp = () => {
        setDraggingPointIndex(null);
    };

    const handleSliderChange = (
        pointIndex: number,
        axis: "x" | "y",
        value: string
    ) => {
        const numericValue = Number(value);
        setQuadPoints((prevPoints) => {
            const newPoints = [...prevPoints];
            newPoints[pointIndex] = {
                ...newPoints[pointIndex],
                [axis]: numericValue,
            };
            return newPoints;
        });
    };

    // --- Core Detection and Initialization Logic ---

    // 行列更新ロジック
    const updateMatrices = useCallback(() => {
        const transformedCanvas = transformedCanvasRef.current;
        const handCanvas = handCanvasRef.current;
        const video = videoRef.current;

        if (!transformedCanvas || !handCanvas || !video) return;

        // handCanvasのサイズに合わせる (リサイズが必要な場合のみ)
        // ここでのサイズ変更は描画サイクル外で行うべきだが、
        // 簡易的にdetectPose内でサイズチェックしているため、ここでは計算のみ行う
        // 実際にはwidth/heightはこの関数内で確定できない(Fullscreenなどがあるため)ので、
        // detectPose内でサイズ確定後に計算する。

        // なので、ここはヘルパーとして定義し、detectPoseから呼ぶ形にする。
    }, []);

    const detectPose = useCallback(async () => {
        const detector = detectorRef.current;
        const video = videoRef.current;
        const handCanvas = handCanvasRef.current;
        const currentQuadPoints = quadPointsRef.current;
        const isFullscreen = handCanvasFullscreenRef.current;
        const currentDimensions = handCanvasDimensionsRef.current;

        if (detector && video && video.readyState === 4 && handCanvas) {
            try {
                // 仮想キャンバスを作成または再利用
                if (!transformedCanvasRef.current) {
                    transformedCanvasRef.current = document.createElement('canvas');
                }
                const transformedCanvas = transformedCanvasRef.current;

                // handCanvasのサイズに合わせる
                let targetWidth, targetHeight;
                if (isFullscreen) {
                    const rect = handCanvas.getBoundingClientRect();
                    targetWidth = rect.width > 0 ? rect.width : currentDimensions.width;
                    targetHeight = rect.height > 0 ? rect.height : currentDimensions.height;
                } else {
                    targetWidth = currentDimensions.width;
                    targetHeight = currentDimensions.height;
                }

                if (transformedCanvas.width !== targetWidth || transformedCanvas.height !== targetHeight) {
                    transformedCanvas.width = targetWidth;
                    transformedCanvas.height = targetHeight;
                    // サイズが変わったので行列再計算フラグを立てても良いが、
                    // 毎フレームチェックして更新するほうがシンプル（計算コストは低い）
                }

                // WebGLコンテキストの取得
                let gl = transformedCanvas.getContext('webgl');
                if (!gl) {
                    console.error("WebGL not supported");
                    return;
                }

                // シェーダープログラムの初期化
                type GLCanvas = HTMLCanvasElement & { glContextInitialized?: boolean; program?: WebGLProgram; positionBuffer?: WebGLBuffer; texCoordBuffer?: WebGLBuffer; texture?: WebGLTexture };
                const glCanvas = transformedCanvas as GLCanvas;

                if (!glCanvas.glContextInitialized) {
                    // ... (Shader initialization code is same, omitted for brevity but logic must exist)
                    const vertexShaderSource = `
                        attribute vec2 a_position;
                        attribute vec2 a_texCoord;
                        varying vec2 v_texCoord;
                        void main() {
                            gl_Position = vec4(a_position, 0.0, 1.0);
                            v_texCoord = a_texCoord;
                        }
                    `;
                    const fragmentShaderSource = `
                        precision mediump float;
                        uniform sampler2D u_image;
                        uniform vec2 u_resolution;
                        uniform vec2 u_videoResolution;
                        uniform float u_h[9]; // 3x3 matrix flattened

                        void main() {
                            float x = gl_FragCoord.x;
                            float y = u_resolution.y - gl_FragCoord.y; 
                            float Z = u_h[6] * x + u_h[7] * y + u_h[8];
                            float srcX = (u_h[0] * x + u_h[1] * y + u_h[2]) / Z;
                            float srcY = (u_h[3] * x + u_h[4] * y + u_h[5]) / Z;
                            vec2 texCoord = vec2(srcX / u_videoResolution.x, srcY / u_videoResolution.y);

                            if (texCoord.x >= 0.0 && texCoord.x <= 1.0 && texCoord.y >= 0.0 && texCoord.y <= 1.0) {
                                gl_FragColor = texture2D(u_image, texCoord);
                            } else {
                                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                            }
                        }
                    `;
                    const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
                        const shader = gl.createShader(type);
                        if (!shader) return null;
                        gl.shaderSource(shader, source);
                        gl.compileShader(shader);
                        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                            console.error(gl.getShaderInfoLog(shader));
                            gl.deleteShader(shader);
                            return null;
                        }
                        return shader;
                    };
                    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
                    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
                    if (!vertexShader || !fragmentShader) return;
                    const program = gl.createProgram();
                    if (!program) return;
                    gl.attachShader(program, vertexShader);
                    gl.attachShader(program, fragmentShader);
                    gl.linkProgram(program);
                    glCanvas.program = program;

                    const positionBuffer = gl.createBuffer();
                    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                        -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
                    ]), gl.STATIC_DRAW);
                    glCanvas.positionBuffer = positionBuffer || undefined;

                    const texture = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    glCanvas.texture = texture || undefined;
                    glCanvas.glContextInitialized = true;
                }

                const program = glCanvas.program;
                if (!program) return;

                gl.useProgram(program);
                const positionLocation = gl.getAttribLocation(program, "a_position");
                gl.enableVertexAttribArray(positionLocation);
                gl.bindBuffer(gl.ARRAY_BUFFER, glCanvas.positionBuffer!);
                gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

                const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
                const videoResolutionLocation = gl.getUniformLocation(program, "u_videoResolution");
                const hLocation = gl.getUniformLocation(program, "u_h");

                gl.uniform2f(resolutionLocation, transformedCanvas.width, transformedCanvas.height);
                gl.uniform2f(videoResolutionLocation, video.videoWidth, video.videoHeight);

                // --- 行列計算 (最適化: 前回の値を再利用するかチェック) ---
                // 本来は依存値が変わった時のみ計算すべきですが、ここでは計算コスト削減のため
                // 行列計算結果をmatricesRefにキャッシュし、detectPose内では常に最新のQuadで再計算してRefを更新する
                // (requestAnimationFrameループ内なので、Refの同期ズレを防ぐため毎回計算してもWebAssembly負荷よりは軽い)
                // ただし、座標が変わっていないなら計算をスキップするロジックを入れるとさらに良い。

                const dstPoints: Point[] = [
                    { x: 0, y: 0 },
                    { x: transformedCanvas.width, y: 0 },
                    { x: transformedCanvas.width, y: transformedCanvas.height },
                    { x: 0, y: transformedCanvas.height },
                ];

                // 毎回計算 (安定性重視)
                const h = getHomographyMatrix(currentQuadPoints, dstPoints);
                const h_inv = getHomographyMatrix(dstPoints, currentQuadPoints);

                if (!h || !h_inv) return;
                matricesRef.current = { h, h_inv }; // キャッシュ更新

                gl.uniform1fv(hLocation, new Float32Array(h_inv));

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, glCanvas.texture!);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
                gl.viewport(0, 0, transformedCanvas.width, transformedCanvas.height);
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.drawArrays(gl.TRIANGLES, 0, 6);

                // --- 手の検出 (transformedCanvasを使用) ---
                const rawPoses = await detector.estimatePoses(transformedCanvas, {
                    flipHorizontal: false,
                });

                // --- 座標変換 (HandCanvas -> Original Video) ---
                // rawPoses = HandCanvas上の座標
                // transformedPoses = OriginalVideo上の座標 (メインキャンバス表示用)
                const transformedPoses = rawPoses.map(pose => {
                    if (!pose.keypoints) return pose;
                    const transformedKeypoints = pose.keypoints.map(kp => {
                        const originalPoint = transformPoint({ x: kp.x, y: kp.y }, h_inv);
                        return { ...kp, x: originalPoint.x, y: originalPoint.y };
                    });
                    return { ...pose, keypoints: transformedKeypoints };
                });

                recordPoseData(transformedPoses);
                drawResults(rawPoses, transformedPoses); // rawPosesも渡す

                if (isRecordingRef.current && transformedPoses.length > 0) {
                    // ログ出力など...
                }

            } catch (error) {
                console.error("姿勢検出中にエラーが発生しました:", error);
            }
        }
    }, [drawResults]); // 依存関係を空にするか、不変なものだけにする

    // Effect for heavy initialization (model loading, camera setup)
    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            setIsModelReady(false);
            setIsCameraReady(false);
            if (detectorRef.current) detectorRef.current.dispose();

            setStatus(detectorType === "MoveNet"
                ? `ライブラリと"${moveNetModelType}"モデルを読み込み中...`
                : `ライブラリとMediaPipe(${blazePoseModelType})モデルを読み込み中...`
            );
            try {
                const [tfModule, poseDetectionModule] = await Promise.all([
                    import("@tensorflow/tfjs"),
                    import("@tensorflow-models/pose-detection"),
                ]);
                if (processingMode === "CPU")
                    await import("@tensorflow/tfjs-backend-cpu");
                if (processingMode === "GPU")
                    await import("@tensorflow/tfjs-backend-webgl");
                if (processingMode === "WebGPU") {
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
                    .catch(async () => {
                        console.warn(
                            `${processingMode} backend failed, falling back to webgl.`
                        );
                        await tfModule.setBackend("webgl");
                    });
                await tfModule.ready();

                let model;
                if (detectorType === "MoveNet") {
                    model = poseDetectionModule.SupportedModels.MoveNet;
                    detectorRef.current = await poseDetectionModule.createDetector(model, {
                        modelType:
                            moveNetModelType === "Lightning"
                                ? poseDetectionModule.movenet.modelType.SINGLEPOSE_LIGHTNING
                                : moveNetModelType === "Thunder"
                                    ? poseDetectionModule.movenet.modelType.SINGLEPOSE_THUNDER
                                    : poseDetectionModule.movenet.modelType.MULTIPOSE_LIGHTNING,
                    });
                } else {
                    // MediaPipe (BlazePose)
                    model = poseDetectionModule.SupportedModels.BlazePose;
                    detectorRef.current = await poseDetectionModule.createDetector(model, {
                        runtime: 'mediapipe',
                        modelType: blazePoseModelType,
                        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose',
                        enableSmoothing: true,
                    });
                }

                adjacentPairsRef.current = poseDetectionModule.util.getAdjacentPairs(
                    model
                ) as [number, number][];
                setIsModelReady(true);

                setStatus("カメラを準備中...");
                if (videoRef.current) {
                    try {
                        let stream: MediaStream;
                        if (selectedCameraId) {
                            stream = await navigator.mediaDevices.getUserMedia({
                                video: {
                                    deviceId: { exact: selectedCameraId },
                                    width: { ideal: 1280 },
                                    height: { ideal: 720 },
                                },
                            });
                        } else {
                            stream = await navigator.mediaDevices.getUserMedia({
                                video: {
                                    width: { ideal: 1280 },
                                    height: { ideal: 720 },
                                },
                            });
                        }

                        videoRef.current.srcObject = stream;
                        videoRef.current.onloadedmetadata = async () => {
                            if (videoRef.current) {
                                videoRef.current.play();
                                setVideoDimensions({
                                    width: videoRef.current.videoWidth,
                                    height: videoRef.current.videoHeight,
                                });
                            }
                            setIsCameraReady(true);
                            setIsLoading(false);
                            setStatus("準備完了");
                            await getCameraDevices();
                        };
                    } catch (error) {
                        console.error("基本カメラ初期化エラー:", error);
                        setStatus("カメラの起動に失敗しました。カメラの許可設定を確認してください。");
                        setIsLoading(false);
                    }
                }
            } catch (error) {
                console.error("初期化に失敗しました:", error);
                setStatus("エラーが発生しました。");
                setIsLoading(false);
            }
        };
        init();

        return () => {
            if (videoRef.current?.srcObject) {
                (videoRef.current.srcObject as MediaStream)
                    .getTracks()
                    .forEach((track) => track.stop());
            }
        };
    }, [detectorType, moveNetModelType, blazePoseModelType, processingMode, selectedCameraId, cameras.length]);

    // Effect for starting/stopping the animation loop
    useEffect(() => {
        let animationId: number;
        const loop = async () => {
            await detectPose();
            animationId = requestAnimationFrame(loop);
        };

        if (isModelReady && isCameraReady) {
            loop();
        }

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    }, [isModelReady, isCameraReady, detectPose]);

    const getCameraDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter((d) => d.kind === "videoinput");
            setCameras(videoDevices);
            if (videoDevices.length > 0 && !selectedCameraId) {
                setSelectedCameraId(videoDevices[0].deviceId);
            }
        } catch (error) {
            console.error("カメラデバイスの取得に失敗しました:", error);
        }
    };

    return (
        <div className="flex flex-col items-center p-4 md:p-6 bg-gray-50 min-h-screen">
            <h1 className="text-2xl md:text-3xl font-bold mb-4 text-gray-800">
                リアルタイム姿勢検出 (Test 19: MoveNet/MediaPipe 切り替え)
            </h1>

            {isLoading && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p>{status}</p>
                </div>
            )}

            {/* --- Controls --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 w-full max-w-5xl">
                {/* Controls for Camera, Mode, Model */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        カメラ
                    </label>
                    <select
                        value={selectedCameraId}
                        onChange={(e) => setSelectedCameraId(e.target.value)}
                        disabled={isLoading || cameras.length <= 1}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                    >
                        {cameras.map((camera, index) => (
                            <option key={camera.deviceId} value={camera.deviceId}>
                                {camera.label || `カメラ ${index + 1}`}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        処理モード
                    </label>
                    <div className="flex space-x-1 rounded-md shadow-sm" role="group">
                        <button
                            onClick={() => setProcessingMode("WebGPU")}
                            disabled={isLoading}
                            className={`px-4 py-2 text-sm font-medium border rounded-l-lg ${processingMode === "WebGPU"
                                ? "bg-purple-600 text-white"
                                : "bg-white"
                                }`}
                        >
                            WebGPU
                        </button>
                        <button
                            onClick={() => setProcessingMode("GPU")}
                            disabled={isLoading}
                            className={`px-4 py-2 text-sm font-medium border-t border-b ${processingMode === "GPU" ? "bg-red-600 text-white" : "bg-white"
                                }`}
                        >
                            GPU
                        </button>
                        <button
                            onClick={() => setProcessingMode("CPU")}
                            disabled={isLoading}
                            className={`px-4 py-2 text-sm font-medium border rounded-r-lg ${processingMode === "CPU"
                                ? "bg-orange-500 text-white"
                                : "bg-white"
                                }`}
                        >
                            CPU
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        検出器タイプ
                    </label>
                    <div className="flex space-x-1 rounded-md shadow-sm mb-2" role="group">
                        <button
                            onClick={() => setDetectorType("MoveNet")}
                            disabled={isLoading}
                            className={`px-3 py-2 text-sm font-medium border rounded-l-lg ${detectorType === "MoveNet"
                                ? "bg-blue-600 text-white"
                                : "bg-white"
                                }`}
                        >
                            MoveNet (TensorFlow)
                        </button>
                        <button
                            onClick={() => setDetectorType("MediaPipe")}
                            disabled={isLoading}
                            className={`px-3 py-2 text-sm font-medium border rounded-r-lg ${detectorType === "MediaPipe"
                                ? "bg-green-600 text-white"
                                : "bg-white"
                                }`}
                        >
                            MediaPipe (BlazePose)
                        </button>
                    </div>

                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        モデル種別
                    </label>
                    {detectorType === "MoveNet" ? (
                        <div className="flex space-x-1 rounded-md shadow-sm" role="group">
                            <button
                                onClick={() => setMoveNetModelType("Lightning")}
                                disabled={isLoading}
                                className={`px-4 py-2 text-sm font-medium border rounded-l-lg ${moveNetModelType === "Lightning"
                                    ? "bg-blue-600 text-white"
                                    : "bg-white"
                                    }`}
                            >
                                Lightning
                            </button>
                            <button
                                onClick={() => setMoveNetModelType("Thunder")}
                                disabled={isLoading}
                                className={`px-4 py-2 text-sm font-medium border-t border-b ${moveNetModelType === "Thunder"
                                    ? "bg-indigo-600 text-white"
                                    : "bg-white"
                                    }`}
                            >
                                Thunder
                            </button>
                            <button
                                onClick={() => setMoveNetModelType("multiPose")}
                                disabled={isLoading}
                                className={`px-4 py-2 text-sm font-medium border rounded-r-lg ${moveNetModelType === "multiPose"
                                    ? "bg-green-600 text-white"
                                    : "bg-white"
                                    }`}
                            >
                                MultiPose
                            </button>
                        </div>
                    ) : (
                        <div className="flex space-x-1 rounded-md shadow-sm" role="group">
                            <button
                                onClick={() => setBlazePoseModelType("lite")}
                                disabled={isLoading}
                                className={`px-4 py-2 text-sm font-medium border rounded-l-lg ${blazePoseModelType === "lite"
                                    ? "bg-blue-600 text-white"
                                    : "bg-white"
                                    }`}
                            >
                                Lite
                            </button>
                            <button
                                onClick={() => setBlazePoseModelType("full")}
                                disabled={isLoading}
                                className={`px-4 py-2 text-sm font-medium border-t border-b ${blazePoseModelType === "full"
                                    ? "bg-indigo-600 text-white"
                                    : "bg-white"
                                    }`}
                            >
                                Full
                            </button>
                            <button
                                onClick={() => setBlazePoseModelType("heavy")}
                                disabled={isLoading}
                                className={`px-4 py-2 text-sm font-medium border rounded-r-lg ${blazePoseModelType === "heavy"
                                    ? "bg-green-600 text-white"
                                    : "bg-white"
                                    }`}
                            >
                                Heavy
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* --- Canvases --- */}
            <div className="flex flex-col lg:flex-row items-start justify-center gap-6 w-full max-w-7xl">
                <div className="flex-grow w-full lg:w-auto">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                        全身ポーズ検出 (枠内をドラッグ or 下のスライダーで範囲指定)
                    </h3>
                    <div
                        className="relative border-2 border-gray-300 rounded-lg overflow-hidden max-w-full aspect-[16/9] cursor-pointer touch-none"
                        onMouseDown={handlePointerDown}
                        onMouseMove={handlePointerMove}
                        onMouseUp={handlePointerUp}
                        onMouseLeave={handlePointerUp}
                        onTouchStart={handlePointerDown}
                        onTouchMove={handlePointerMove}
                        onTouchEnd={handlePointerUp}
                    >
                        <video
                            ref={videoRef}
                            className="block w-full h-full object-cover"
                            style={{ transform: "scaleX(-1)" }}
                            playsInline
                        />
                        <canvas
                            ref={canvasRef}
                            className="absolute top-0 left-0 w-full h-full"
                            style={{ transform: "scaleX(-1)" }}
                        />
                    </div>
                </div>
                <div className="flex-shrink-0 w-full lg:w-auto">
                    <div className="flex items-center mb-3">
                        <div>
                            <label className="block text-lg font-semibold text-gray-700 mb-2">
                                手の位置 (アスペクト比)
                            </label>
                            <div className="flex space-x-1 rounded-md shadow-sm" role="group">
                                {["4:3", "16:9", "1:1", "3:4"].map((ratio) => (
                                    <button
                                        key={ratio}
                                        onClick={() => setHandCanvasAspectRatio(ratio)}
                                        className={`px-4 py-2 text-sm font-medium border first:rounded-l-lg last:rounded-r-lg ${handCanvasAspectRatio === ratio
                                            ? "bg-teal-500 text-white"
                                            : "bg-white"
                                            }`}
                                    >
                                        {ratio}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* フルスクリーン切り替えボタン */}
                        <button
                            onClick={() => setHandCanvasFullscreen(!handCanvasFullscreen)}
                            className="ml-4 mt-8 px-3 py-2 text-sm font-medium border rounded-lg shadow-sm bg-white hover:bg-gray-50 transition"
                            aria-label={
                                handCanvasFullscreen ? "通常表示に戻す" : "フルスクリーンで表示"
                            }
                        >
                            {handCanvasFullscreen ? "戻す" : "最大化"}
                        </button>
                    </div>
                    {/* handCanvasのコンテナとスタイル */}
                    <div
                        className={
                            handCanvasFullscreen
                                ? "fixed top-0 left-0 w-screen h-screen bg-black flex justify-center items-center z-50 cursor-zoom-out"
                                : "border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-800 mx-auto"
                        }
                        style={
                            !handCanvasFullscreen
                                ? {
                                    width: `${handCanvasDimensions.width}px`,
                                    height: `${handCanvasDimensions.height}px`,
                                }
                                : {}
                        }
                        onClick={() => {
                            if (handCanvasFullscreen) setHandCanvasFullscreen(false);
                        }}
                    >
                        <canvas
                            ref={handCanvasRef}
                            className={handCanvasFullscreen ? "cursor-default" : ""}
                            style={
                                handCanvasFullscreen
                                    ? { height: "100%", width: "auto", transform: "scaleX(-1)" }
                                    : { display: "block", transform: "scaleX(-1)" }
                            }
                            onClick={(e) => {
                                if (handCanvasFullscreen) e.stopPropagation();
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* --- Sliders for Quad Points --- */}
            {!isLoading && isCameraReady && (
                <div className="w-full max-w-5xl mt-6 p-4 bg-white rounded-lg border">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">
                        検出範囲の座標調整
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                        {quadPoints.map((point, index) => (
                            <div key={index}>
                                <h4 className="font-semibold text-gray-600">
                                    頂点 {index + 1}
                                </h4>
                                <div className="mt-1">
                                    <label className="flex items-center space-x-2 text-sm">
                                        <span>X:</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max={videoDimensions.width}
                                            value={point.x}
                                            onChange={(e) =>
                                                handleSliderChange(index, "x", e.target.value)
                                            }
                                            className="w-full"
                                        />
                                        <span>{point.x.toFixed(0)}</span>
                                    </label>
                                </div>
                                <div className="mt-1">
                                    <label className="flex items-center space-x-2 text-sm">
                                        <span>Y:</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max={videoDimensions.height}
                                            value={point.y}
                                            onChange={(e) =>
                                                handleSliderChange(index, "y", e.target.value)
                                            }
                                            className="w-full"
                                        />
                                        <span>{point.y.toFixed(0)}</span>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- Sound, Background, and Effect Settings --- */}
            <div className="mt-6 w-full max-w-5xl p-4 bg-white rounded-lg border">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                    エフェクト設定
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="flex items-center space-x-2 text-sm">
                            <span className="text-gray-700 font-medium">音声:</span>
                            <select
                                value={selectedSound?.name}
                                onChange={(e) => {
                                    const foundSound = Sounds.find(
                                        (sound) => sound.name === e.target.value
                                    );
                                    if (foundSound) {
                                        changeSound(foundSound);
                                    }
                                }}
                                className="border rounded-md text-gray-700 p-1 w-full"
                            >
                                <option value="" className="text-gray-700">
                                    選択してください
                                </option>
                                {Sounds.map((sound) => (
                                    <option
                                        key={sound.name}
                                        value={sound.name}
                                        className="text-gray-700"
                                    >
                                        {sound.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="flex items-center space-x-2 text-sm">
                            <span className="text-gray-700 font-medium">背景画像:</span>
                            <select
                                value={selectedBackground}
                                onChange={(e) => setSelectedBackground(e.target.value)}
                                className="border rounded-md text-gray-700 p-1 w-full"
                            >
                                {BackgroundImages.map((img) => (
                                    <option key={img.name} value={img.path}>
                                        {img.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="flex items-center space-x-2 text-sm">
                            <span className="text-gray-700 font-medium">エフェクト:</span>
                            <select
                                value={selectedEffect}
                                onChange={(e) => setSelectedEffect(e.target.value as EffectType)}
                                className="border rounded-md text-gray-700 p-1 w-full"
                            >
                                <option value="Normal">Normal</option>
                                <option value="Sparkle">Sparkle</option>
                                <option value="Fire">Fire</option>
                                <option value="Bubbles">Bubbles</option>
                                <option value="Snow">Snow</option>
                                <option value="Holiday">Holiday</option>
                                <option value="GeometricSnow">Geometric Snow</option>
                                <option value="GiftBox">Gift Box</option>
                            </select>
                        </label>
                    </div>
                </div>

                {/* エフェクト調整スライダー */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                    <div>
                        <label className="flex flex-col space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-700">動きの反応感度 (しきい値)</span>
                                <span className="text-sm font-bold text-blue-600">{moveThreshold}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="50"
                                value={moveThreshold}
                                onChange={(e) => setMoveThreshold(Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <span className="text-xs text-gray-500">値が小さいほど敏感に反応します</span>
                        </label>
                    </div>
                    <div>
                        <label className="flex flex-col space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-700">エフェクト数 (パーティクル)</span>
                                <span className="text-sm font-bold text-blue-600">{effectCount}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="100"
                                value={effectCount}
                                onChange={(e) => setEffectCount(Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <span className="text-xs text-gray-500">1回の反応で描画される数</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* データ記録制御パネル */}
            <div className="mt-6 w-full max-w-5xl p-4 bg-white rounded-lg border">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">データ記録[R]</h3>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`px-6 py-2 rounded-lg font-medium transition-colors ${isRecording
                                ? "bg-red-500 hover:bg-red-600 text-white"
                                : "bg-green-500 hover:bg-green-600 text-white"
                                }`}
                            disabled={!isModelReady || !isCameraReady}
                        >
                            {isRecording ? "記録停止" : "記録開始"}
                        </button>
                        <div
                            className={`w-3 h-3 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-gray-300"
                                }`}
                        />
                        <span className="text-sm text-gray-600">
                            {isRecording ? "記録中..." : "記録待機"}
                        </span>
                    </div>
                    {recordedData.poses.length > 0 && !isRecording && (
                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-600">
                                記録されたポーズ数: {recordedData.poses.length}
                            </span>
                            <button
                                onClick={downloadData}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                            >
                                JSONダウンロード
                            </button>
                        </div>
                    )}
                </div>
                {isRecording && (
                    <div className="mt-3 text-sm text-gray-600">
                        <p>• 0.25秒間隔でポーズデータが記録されています</p>
                        <p>• 現在のポーズ数: {recordedData.poses.length}</p>
                        <p>
                            • 記録開始時刻:{" "}
                            {new Date(recordingStartTimeRef.current).toLocaleTimeString()}
                        </p>
                        <p>
                            • 経過時間:{" "}
                            {((Date.now() - recordingStartTimeRef.current) / 1000).toFixed(1)}
                            秒
                        </p>
                    </div>
                )}
                {recordedData.poses.length > 0 && (
                    <div className="mt-3 text-sm text-green-600">
                        <p>
                            ✓ 最新記録:{" "}
                            {recordedData.poses.length > 0
                                ? `${recordedData.poses[recordedData.poses.length - 1].keypoints
                                    .length
                                }個のキーポイント`
                                : "なし"}
                        </p>
                    </div>
                )}
            </div>

            {/* メモ入力ダイアログ */}
            {showMemoDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-gray-700 mb-4">
                            データにメモを追加
                        </h3>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                メモ（任意）
                            </label>
                            <textarea
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                                rows={4}
                                maxLength={500}
                            />
                            <div className="text-right text-xs text-gray-500 mt-1">
                                {memo.length}/500文字
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowMemoDialog(false);
                                    setMemo("");
                                }}
                                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={confirmDownload}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                            >
                                ダウンロード
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PoseDetector;
