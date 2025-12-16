"use client";

import { useState, useRef, useEffect } from "react";
import {
    Layout,
    Upload,
    FileJson, // Changed from JSON to FileJson to match Lucide
    ChevronRight,
    ChevronDown,
    Activity,
    CheckCircle2,
    Clock,
    TrendingUp,
    Maximize
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- Types (Copied from DataViewer) ---
interface PoseData {
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
}

interface HandData {
    startTime: number;
    memo?: string;
    hands: Array<{
        timestamp: number;
        landmarks: Array<{
            x: number;
            y: number;
            z: number;
            handedness: string;
            index: number;
        }>;
    }>;
}

type DetectionData = PoseData | HandData;

// --- Constants (Copied from DataViewer) ---
const MOVENET_KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle"
];

const MEDIAPIPE_KEYPOINT_NAMES = [
    "nose", "left_eye_inner", "left_eye", "left_eye_outer",
    "right_eye_inner", "right_eye", "right_eye_outer",
    "left_ear", "right_ear", "mouth_left", "mouth_right",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_pinky", "right_pinky",
    "left_index", "right_index", "left_thumb", "right_thumb",
    "left_hip", "right_hip", "left_knee", "right_knee",
    "left_ankle", "right_ankle", "left_heel", "right_heel",
    "left_foot_index", "right_foot_index"
];

const HAND_LANDMARK_NAMES = [
    "wrist", "thumb_cmc", "thumb_mcp", "thumb_ip", "thumb_tip",
    "index_mcp", "index_pip", "index_dip", "index_tip",
    "middle_mcp", "middle_pip", "middle_dip", "middle_tip",
    "ring_mcp", "ring_pip", "ring_dip", "ring_tip",
    "pinky_mcp", "pinky_pip", "pinky_dip", "pinky_tip"
];

const COLOR_PALETTE = [
    "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981",
    "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef",
    "#f43f5e", "#db2777"
];

// --- Helper Functions (Copied from DataViewer) ---
const calculateMovementIntensities = (
    currentPose: PoseData["poses"][0],
    previousPose: PoseData["poses"][0] | null,
    keypointCount: number
): { average: number; byMarker: number[] } => {
    const byMarker = new Array(keypointCount).fill(0);
    if (!previousPose) return { average: 0, byMarker };

    let totalMovement = 0;
    let validPoints = 0;

    currentPose.keypoints.forEach((currentKp, index) => {
        const prevKp = previousPose.keypoints[index];
        if (currentKp && prevKp && currentKp.score > 0.5 && prevKp.score > 0.5) {
            const distance = Math.sqrt(
                Math.pow(currentKp.x - prevKp.x, 2) +
                Math.pow(currentKp.y - prevKp.y, 2)
            );
            byMarker[index] = distance;
            totalMovement += distance;
            validPoints++;
        }
    });

    return {
        average: validPoints > 0 ? totalMovement / validPoints : 0,
        byMarker
    };
};

const calculateHandMovementIntensities = (
    currentHand: HandData["hands"][0],
    previousHand: HandData["hands"][0] | null
): { average: number; byMarker: number[] } => {
    const byMarker = new Array(21).fill(0);
    if (!previousHand) return { average: 0, byMarker };

    let totalMovement = 0;
    let validPoints = 0;

    const importantLandmarks = [0, 4, 8, 12, 16, 20];

    currentHand.landmarks.forEach((currentLm) => {
        const prevLm = previousHand.landmarks.find(
            (p) =>
                p.index === currentLm.index && p.handedness === currentLm.handedness
        );
        if (prevLm) {
            const distance = Math.sqrt(
                Math.pow(currentLm.x - prevLm.x, 2) +
                Math.pow(currentLm.y - prevLm.y, 2) +
                Math.pow(currentLm.z - prevLm.z, 2) * 0.5
            );
            byMarker[currentLm.index] = distance;
            const weight = importantLandmarks.includes(currentLm.index) ? 2 : 1;
            totalMovement += distance * weight;
            validPoints += weight;
        }
    });

    return {
        average: validPoints > 0 ? totalMovement / validPoints : 0,
        byMarker
    };
};

const isHandData = (data: DetectionData): data is HandData => {
    return "hands" in data;
};

const isPoseData = (data: DetectionData): data is PoseData => {
    return "poses" in data;
};

const getIntensityColor = (intensity: number, maxIntensity: number): string => {
    if (maxIntensity === 0) return "rgb(0, 100, 200)";
    const normalizedIntensity = Math.min(intensity / maxIntensity, 1);
    if (normalizedIntensity < 0.33) {
        const ratio = normalizedIntensity / 0.33;
        const r = Math.round(0 * (1 - ratio) + 0 * ratio);
        const g = Math.round(100 * (1 - ratio) + 255 * ratio);
        const b = Math.round(200 * (1 - ratio) + 0 * ratio);
        return `rgb(${r}, ${g}, ${b})`;
    } else if (normalizedIntensity < 0.66) {
        const ratio = (normalizedIntensity - 0.33) / 0.33;
        const r = Math.round(0 * (1 - ratio) + 255 * ratio);
        const g = Math.round(255 * (1 - ratio) + 255 * ratio);
        const b = Math.round(0 * (1 - ratio) + 0 * ratio);
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        const ratio = (normalizedIntensity - 0.66) / 0.34;
        const r = Math.round(255 * (1 - ratio) + 255 * ratio);
        const g = Math.round(255 * (1 - ratio) + 0 * ratio);
        const b = Math.round(0 * (1 - ratio) + 0 * ratio);
        return `rgb(${r}, ${g}, ${b})`;
    }
};

// --- Main Component ---
export default function DataViewer2() {
    const [detectionData, setDetectionData] = useState<DetectionData | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedMarkers, setSelectedMarkers] = useState<number[]>([]);
    const [showSidebar, setShowSidebar] = useState(true);
    const [activeSections, setActiveSections] = useState<string[]>(["file", "stats", "markers"]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Logic Handlers ---
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string) as DetectionData;
                setDetectionData(data);
                setSelectedMarkers([]);
            } catch (error) {
                alert("JSONファイルの読み込みに失敗しました。");
                console.error("JSON parse error:", error);
            }
        };
        reader.readAsText(file);
    };

    const getPoseKeypointCount = (data: PoseData) => {
        if (data.poses.length > 0 && data.poses[0].keypoints) {
            return data.poses[0].keypoints.length;
        }
        return 17;
    };

    const processTimelineData = (data: DetectionData) => {
        const intensities: number[] = [];
        const markerIntensities: number[][] = [];
        let markerCount = 0;
        if (isPoseData(data)) {
            markerCount = getPoseKeypointCount(data);
        } else {
            markerCount = 21;
        }
        for (let i = 0; i < markerCount; i++) markerIntensities[i] = [];

        if (isPoseData(data)) {
            for (let i = 0; i < data.poses.length; i++) {
                const currentPose = data.poses[i];
                const previousPose = i > 0 ? data.poses[i - 1] : null;
                const { average, byMarker } = calculateMovementIntensities(currentPose, previousPose, markerCount);
                intensities.push(average);
                byMarker.forEach((val, idx) => {
                    if (markerIntensities[idx]) markerIntensities[idx].push(val);
                });
            }
        } else if (isHandData(data)) {
            for (let i = 0; i < data.hands.length; i++) {
                const currentHand = data.hands[i];
                const previousHand = i > 0 ? data.hands[i - 1] : null;
                const { average, byMarker } = calculateHandMovementIntensities(currentHand, previousHand);
                intensities.push(average);
                byMarker.forEach((val, idx) => markerIntensities[idx].push(val));
            }
        }

        let maxVal = Math.max(...intensities, 0.1);
        selectedMarkers.forEach(markerIdx => {
            const mMax = Math.max(...markerIntensities[markerIdx]);
            if (mMax > maxVal) maxVal = mMax;
        });

        let displayIntensities = intensities;
        if (selectedMarkers.length > 0) {
            displayIntensities = intensities.map((_, timeIdx) => {
                let sum = 0;
                let count = 0;
                selectedMarkers.forEach(markerIdx => {
                    const val = markerIntensities[markerIdx][timeIdx];
                    if (val !== undefined) {
                        sum += val;
                        count++;
                    }
                });
                return count > 0 ? sum / count : 0;
            });
        }

        return { intensities, markerIntensities, maxIntensity: maxVal, displayIntensities };
    };

    const getDataStats = (data: DetectionData) => {
        let duration = 0;
        let totalCount = 0;
        let dataType = "";

        if (isPoseData(data)) {
            duration = data.poses.length > 0 ? data.poses[data.poses.length - 1].timestamp / 1000 : 0;
            totalCount = data.poses.length;
            dataType = "ポーズ";
        } else if (isHandData(data)) {
            duration = data.hands.length > 0 ? data.hands[data.hands.length - 1].timestamp / 1000 : 0;
            totalCount = data.hands.length;
            dataType = "手";
        }

        const { displayIntensities } = processTimelineData(data);
        const avgIntensity = displayIntensities.length > 0 ? displayIntensities.reduce((sum, val) => sum + val, 0) / displayIntensities.length : 0;
        const maxIntensity = displayIntensities.length > 0 ? Math.max(...displayIntensities) : 0;

        return {
            totalCount,
            dataType,
            duration: duration.toFixed(1),
            avgIntensity: avgIntensity.toFixed(2),
            maxIntensity: maxIntensity.toFixed(2),
            startTime: new Date(data.startTime).toLocaleString("ja-JP"),
            hasMemo: !!data.memo,
        };
    };

    const getMarkerName = (idx: number, isPose: boolean, totalPoints: number) => {
        if (isPose) {
            if (totalPoints > 17) {
                return MEDIAPIPE_KEYPOINT_NAMES[idx] || `Point ${idx}`;
            }
            return MOVENET_KEYPOINT_NAMES[idx] || `Point ${idx}`;
        }
        return HAND_LANDMARK_NAMES[idx] || `Landmark ${idx}`;
    };

    const toggleMarkerSelection = (idx: number) => {
        setSelectedMarkers(prev => {
            if (prev.includes(idx)) {
                return prev.filter(i => i !== idx);
            } else {
                return [...prev, idx];
            }
        });
    };

    // --- UI Components ---
    const SectionHeader = ({ id, label, icon: Icon }: { id: string; label: string; icon: any }) => {
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
                    <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        データビューアー 2.0
                    </h1>

                </div>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => setShowSidebar(!showSidebar)}
                        className="p-2 hover:bg-slate-800 rounded-md transition-colors"
                    >
                        <Layout size={20} />
                    </button>
                </div>
            </header>

            {/* --- Body --- */}
            <div className="flex flex-1 overflow-hidden">
                {/* --- Main Stage --- */}
                <div className="flex-1 relative flex flex-col p-4 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950">
                    {detectionData ? (
                        <div className="flex flex-col h-full space-y-4 overflow-y-auto">
                            {/* Memo */}
                            {detectionData.memo && (
                                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 shadow-lg backdrop-blur-sm">
                                    <h3 className="text-sm font-bold text-slate-400 mb-2 flex items-center">
                                        <CheckCircle2 size={16} className="mr-2 text-blue-400" />
                                        メモ
                                    </h3>
                                    <p className="text-slate-200 whitespace-pre-wrap">{detectionData.memo}</p>
                                </div>
                            )}

                            {/* Data Visualization */}
                            <div className="flex-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg overflow-hidden flex flex-col">
                                <div className="p-4 border-b border-slate-800 bg-slate-800/50">
                                    <h2 className="text-lg font-semibold text-slate-200 flex items-center">
                                        <TrendingUp size={20} className="mr-2 text-green-400" />
                                        動作分析
                                    </h2>
                                </div>

                                <div className="flex-1 p-6 overflow-y-auto">
                                    {(() => {
                                        const { intensities, markerIntensities, maxIntensity, displayIntensities } = processTimelineData(detectionData);
                                        const isPose = isPoseData(detectionData);
                                        let totalDuration = 0;
                                        if (isPose) {
                                            totalDuration = detectionData.poses.length > 0 ? detectionData.poses[detectionData.poses.length - 1].timestamp : 0;
                                        } else if (isHandData(detectionData)) {
                                            totalDuration = detectionData.hands.length > 0 ? detectionData.hands[detectionData.hands.length - 1].timestamp : 0;
                                        }

                                        return (
                                            <div className="space-y-8">
                                                {/* Timeline Bar */}
                                                <div>
                                                    <h4 className="text-sm font-medium text-slate-400 mb-2">強度ヒートマップ</h4>

                                                    <div className="h-16 bg-slate-800 rounded-lg overflow-hidden flex">
                                                        {displayIntensities.map((intensity, index) => {
                                                            const color = getIntensityColor(intensity, maxIntensity);
                                                            const width = 100 / displayIntensities.length;
                                                            return (
                                                                <div
                                                                    key={index}
                                                                    className="h-full hover:opacity-80 transition-opacity"
                                                                    style={{ backgroundColor: color, width: `${width}%` }}
                                                                    title={`強度: ${intensity.toFixed(2)}`}
                                                                />
                                                            )
                                                        })}
                                                    </div>
                                                    <div className="flex justify-between mt-1 text-xs text-slate-500 font-mono">
                                                        <span>0s</span>
                                                        <span>{(totalDuration / 1000).toFixed(1)}s</span>
                                                    </div>
                                                </div>

                                                {/* SVG Graph */}
                                                <div>
                                                    <h4 className="text-sm font-medium text-slate-400 mb-2">動作グラフ</h4>

                                                    <div className="h-64 bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden">
                                                        <svg width="100%" height="100%" viewBox="0 0 800 200" preserveAspectRatio="none" className="absolute top-0 left-0">
                                                            {/* Grid Lines */}
                                                            {[0, 50, 100, 150, 200].map(y => (
                                                                <line key={y} x1="0" y1={y} x2="800" y2={y} stroke="#1e293b" strokeWidth="1" />
                                                            ))}

                                                            {/* Average Line */}
                                                            <polyline
                                                                fill="none"
                                                                stroke="#475569"
                                                                strokeWidth="2"
                                                                strokeDasharray="4 4"
                                                                points={intensities.map((v, i) => {
                                                                    const x = (i / (intensities.length - 1)) * 800;
                                                                    const y = 200 - (v / maxIntensity) * 180;
                                                                    return `${x},${y}`;
                                                                }).join(" ")}
                                                            />

                                                            {/* Selected Markers */}
                                                            {selectedMarkers.map(markerIdx => {
                                                                const mIntensities = markerIntensities[markerIdx];
                                                                const color = COLOR_PALETTE[markerIdx % COLOR_PALETTE.length];
                                                                return (
                                                                    <polyline
                                                                        key={markerIdx}
                                                                        fill="none"
                                                                        stroke={color}
                                                                        strokeWidth="2"
                                                                        points={mIntensities.map((v, i) => {
                                                                            const x = (i / (intensities.length - 1)) * 800;
                                                                            const y = 200 - (v / maxIntensity) * 180;
                                                                            return `${x},${y}`;
                                                                        }).join(" ")}
                                                                    />
                                                                )
                                                            })}
                                                        </svg>
                                                        <div className="absolute top-2 right-2 flex flex-col items-end space-y-1 bg-slate-900/80 p-2 rounded backdrop-blur-sm border border-slate-700">
                                                            <div className="flex items-center space-x-2 text-xs text-slate-400">
                                                                <div className="w-3 h-0.5 bg-slate-500 border-dashed border-t border-slate-500"></div>
                                                                <span>平均</span>
                                                            </div>
                                                            {selectedMarkers.map(markerIdx => (
                                                                <div key={markerIdx} className="flex items-center space-x-2 text-xs text-slate-300">
                                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_PALETTE[markerIdx % COLOR_PALETTE.length] }}></div>
                                                                    <span>{getMarkerName(markerIdx, isPoseData(detectionData), isPose ? getPoseKeypointCount(detectionData) : 21)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <FileJson size={64} className="mb-4 opacity-50" />
                            <h2 className="text-xl font-medium mb-2">データが読み込まれていません</h2>
                            <p className="max-w-md text-center">サイドバーからJSONファイルをアップロードして、ポーズ/ハンド検出データを可視化してください。</p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-blue-900/20"
                            >
                                ファイルを選択
                            </button>
                        </div>
                    )}
                </div>

                {/* --- Sidebar --- */}
                <AnimatePresence>
                    {showSidebar && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 320, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="bg-slate-900/95 border-l border-slate-800 backdrop-blur-md flex flex-col shadow-2xl z-20"
                        >
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

                                {/* File Upload Section */}
                                <SectionHeader id="file" label="データソース" icon={Upload} />

                                <AnimatePresence>
                                    {activeSections.includes("file") && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden mb-4"
                                        >
                                            <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 space-y-3">
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept=".json"
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                />
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 rounded-md transition-colors flex items-center justify-center space-x-2"
                                                >
                                                    <Upload size={16} />
                                                    <span>JSONをアップロード</span>
                                                </button>
                                                {selectedFile && (
                                                    <div className="text-xs text-slate-400 break-all bg-slate-900 p-2 rounded border border-slate-800">
                                                        選択中: <span className="text-slate-200">{selectedFile.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Statistics Section */}
                                {detectionData && (
                                    <>
                                        <SectionHeader id="stats" label="統計情報" icon={Activity} />
                                        <AnimatePresence>
                                            {activeSections.includes("stats") && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden mb-4"
                                                >
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {(() => {
                                                            const stats = getDataStats(detectionData);
                                                            return (
                                                                <>
                                                                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                                                                        <div className="text-xs text-slate-500 mb-1">カウント</div>
                                                                        <div className="text-lg font-bold text-blue-400">{stats.totalCount}</div>
                                                                    </div>
                                                                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                                                                        <div className="text-xs text-slate-500 mb-1">時間</div>
                                                                        <div className="text-lg font-bold text-green-400">{stats.duration}s</div>
                                                                    </div>
                                                                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                                                                        <div className="text-xs text-slate-500 mb-1">平均強度</div>
                                                                        <div className="text-lg font-bold text-yellow-500">{stats.avgIntensity}</div>
                                                                    </div>
                                                                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                                                                        <div className="text-xs text-slate-500 mb-1">最大強度</div>
                                                                        <div className="text-lg font-bold text-red-500">{stats.maxIntensity}</div>
                                                                    </div>
                                                                    <div className="col-span-2 bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                                                                        <div className="text-xs text-slate-500">開始時刻</div>
                                                                        <div className="text-xs font-mono text-slate-300">{stats.startTime.split(' ')[1]}</div>
                                                                    </div>
                                                                </>
                                                            )
                                                        })()}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Marker Selection Section */}
                                        <SectionHeader id="markers" label="表示マーカー" icon={CheckCircle2} />
                                        <AnimatePresence>
                                            {activeSections.includes("markers") && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden mb-4"
                                                >
                                                    <div className="flex flex-wrap gap-2">
                                                        {(() => {
                                                            const isPose = isPoseData(detectionData);
                                                            let count = 21;
                                                            if (isPose) count = getPoseKeypointCount(detectionData);

                                                            return Array.from({ length: count }).map((_, i) => (
                                                                <button
                                                                    key={i}
                                                                    onClick={() => toggleMarkerSelection(i)}
                                                                    className={`px-2 py-1 text-xs rounded border transition-all ${selectedMarkers.includes(i)
                                                                        ? "bg-slate-800 border-slate-500 text-white shadow"
                                                                        : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600"
                                                                        }`}
                                                                    style={{
                                                                        borderColor: selectedMarkers.includes(i) ? COLOR_PALETTE[i % COLOR_PALETTE.length] : undefined,
                                                                        color: selectedMarkers.includes(i) ? COLOR_PALETTE[i % COLOR_PALETTE.length] : undefined
                                                                    }}
                                                                >
                                                                    {getMarkerName(i, isPose, count)}
                                                                </button>
                                                            ))
                                                        })()}
                                                    </div>
                                                    {selectedMarkers.length > 0 && (
                                                        <button
                                                            onClick={() => setSelectedMarkers([])}
                                                            className="mt-4 text-xs text-red-400 hover:text-red-300 w-full text-center"
                                                        >
                                                            選択をクリア
                                                        </button>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </>
                                )}

                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
