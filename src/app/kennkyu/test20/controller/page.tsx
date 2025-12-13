"use client";

import { useState, useEffect, useRef } from "react";
import {
    Settings,
    Image as ImageIcon,
    HelpCircle,
    ChevronDown,
    ChevronRight,
    Sliders,
    Mic,
    Square,
    Save,
    FileJson,
} from "lucide-react";
import { Sounds, SoundList, BackgroundImages } from "@/components/data";
import { EffectType } from "@/components/effects/effects";

// --- Types (Duplicated for simplicity) ---
type MoveNetModelType = "Lightning" | "Thunder" | "multiPose";
type BlazePoseModelType = "lite" | "full" | "heavy";
type DetectorType = "MoveNet" | "MediaPipe";
type MarkerConfig = {
    rightHand: boolean;
    leftHand: boolean;
    rightFoot: boolean;
    leftFoot: boolean;
    face: boolean;
};

export default function ControllerPage() {
    // --- State ---
    const [activeSections, setActiveSections] = useState<string[]>(["effects", "system", "rec"]);

    // Settings State
    const [selectedEffect, setSelectedEffect] = useState<EffectType>("Normal");
    const [selectedBackground, setSelectedBackground] = useState<string>(BackgroundImages[0].path);
    const [selectedSoundName, setSelectedSoundName] = useState<string>("");
    const [effectCount, setEffectCount] = useState<number>(10);
    const [moveThreshold, setMoveThreshold] = useState<number>(5);
    const [detectorType, setDetectorType] = useState<DetectorType>("MoveNet");
    const [moveNetModelType, setMoveNetModelType] = useState<MoveNetModelType>("Lightning");
    const [blazePoseModelType, setBlazePoseModelType] = useState<BlazePoseModelType>("full");
    const [inputMode, setInputMode] = useState<"Range" | "Full">("Range");
    const [selectedCameraId, setSelectedCameraId] = useState<string>("");
    const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
    const [selectedMarkers, setSelectedMarkers] = useState<MarkerConfig>({
        rightHand: true,
        leftHand: true,
        rightFoot: true,
        leftFoot: true,
        face: true,
    });

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
    const [showMemoInput, setShowMemoInput] = useState(false);
    const [memo, setMemo] = useState("");
    const [isRecordingVideo, setIsRecordingVideo] = useState(false);
    const [includePoseInVideo, setIncludePoseInVideo] = useState(false);

    const channelRef = useRef<BroadcastChannel | null>(null);

    // --- BroadcastChannel Init & Sync ---
    useEffect(() => {
        const channel = new BroadcastChannel("test20_settings_channel");
        channelRef.current = channel;

        // Request initial sync
        channel.postMessage({ type: "SYNC_REQUEST" });

        channel.onmessage = (event) => {
            if (event.data.type === "SYNC_RESPONSE") {
                const p = event.data.payload;
                if (p.selectedEffect) setSelectedEffect(p.selectedEffect);
                if (p.selectedBackground !== undefined) setSelectedBackground(p.selectedBackground);
                if (p.selectedSound !== undefined) setSelectedSoundName(p.selectedSound);
                if (p.effectCount !== undefined) setEffectCount(p.effectCount);
                if (p.moveThreshold !== undefined) setMoveThreshold(p.moveThreshold);
                if (p.detectorType) setDetectorType(p.detectorType);
                if (p.moveNetModelType) setMoveNetModelType(p.moveNetModelType);
                if (p.blazePoseModelType) setBlazePoseModelType(p.blazePoseModelType);
                if (p.selectedCameraId !== undefined) setSelectedCameraId(p.selectedCameraId);
                if (p.isRecordingVideo !== undefined) setIsRecordingVideo(p.isRecordingVideo);
                if (p.includePoseInVideo !== undefined) setIncludePoseInVideo(p.includePoseInVideo);
                if (p.selectedMarkers) setSelectedMarkers(p.selectedMarkers);
            } else if (event.data.type === "RECORDING_STARTED") {
                setIsRecording(true);
                setRecordingStartTime(event.data.payload.startTime);
                setShowMemoInput(false);
            } else if (event.data.type === "RECORDING_STOPPED") {
                setIsRecording(false);
                setShowMemoInput(true);
            }
        };

        // Get cameras locally for reference (though we might want to sync camera list from main app?
        // Actually, camera ID is specific to the device.
        // If Controller is on the SAME device, we can list cameras.
        // If Controller is on DIFFERENT device, listing *local* cameras doesn't help select *remote* camera.
        // Assumption: Controller is on SAME device (e.g. separate window).
        // If on different device, we'd need to receive the camera list from the main app.
        // Let's implement receiving camera list if possible, OR just assume same device for valid camera IDs.
        // For now, let's just list local cameras.
        navigator.mediaDevices.enumerateDevices().then(devs => {
            setCameras(devs.filter(d => d.kind === "videoinput"));
        });

        return () => {
            channel.close();
        };
    }, []);

    // --- Helper to send updates ---
    const updateSetting = (key: string, value: any) => {
        channelRef.current?.postMessage({
            type: "UPDATE_SETTING",
            payload: { key, value }
        });
    };

    // --- Components ---
    const HelpLabel = ({ label, description }: { label: string; description: string }) => (
        <div className="flex items-center space-x-1 cursor-help w-fit" title={description}>
            <label className="text-xs text-slate-400 pointer-events-none">{label}</label>
            <HelpCircle size={12} className="text-slate-500" />
        </div>
    );

    const SectionHeader = ({ id, label, icon: Icon }: { id: string; label: string; icon: any }) => {
        const isActive = activeSections.includes(id);
        return (
            <button
                onClick={() => {
                    if (isActive) setActiveSections(activeSections.filter((s) => s !== id));
                    else setActiveSections([...activeSections, id]);
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
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 font-sans">
            <header className="mb-6 flex items-center space-x-2">
                <Sliders className="text-blue-400" />
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    Test 20 Controller
                </h1>
            </header>

            <div className="max-w-md mx-auto space-y-2">
                {/* Effects Section */}
                <SectionHeader id="effects" label="エフェクト設定" icon={ImageIcon} />
                {activeSections.includes("effects") && (
                    <div className="p-3 bg-slate-900/30 rounded-lg space-y-4 mb-2 border border-slate-800">
                        <div className="space-y-2">
                            <HelpLabel label="Effect Type" description="エフェクトの種類を選択します。" />
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    "Normal", "Sparkle", "Fire", "Bubbles",
                                    "Snow", "Holiday", "GeometricSnow", "GiftBox",
                                ].map((e) => (
                                    <button
                                        key={e}
                                        onClick={() => {
                                            setSelectedEffect(e as EffectType);
                                            updateSetting("selectedEffect", e);
                                        }}
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
                            <HelpLabel label="背景" description="背景画像を変更します。" />
                            <select
                                value={selectedBackground}
                                onChange={(e) => {
                                    setSelectedBackground(e.target.value);
                                    updateSetting("selectedBackground", e.target.value);
                                }}
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
                            <HelpLabel label="音声" description="エフェクト発生時の効果音を設定します。" />
                            <select
                                value={selectedSoundName}
                                onChange={(e) => {
                                    setSelectedSoundName(e.target.value);
                                    updateSetting("selectedSound", e.target.value);
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
                                    <HelpLabel label="パーティクル数" description="一度に発生するエフェクトの数を調整します。" />
                                    <span className="text-xs text-slate-400">{effectCount}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="20"
                                    value={effectCount}
                                    onChange={(e) => {
                                        const v = Number(e.target.value);
                                        setEffectCount(v);
                                        updateSetting("effectCount", v);
                                    }}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <HelpLabel label="動作検出感度" description="動作を検出する感度を調整します。" />
                                    <span className="text-xs text-slate-400">{moveThreshold}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={moveThreshold}
                                    onChange={(e) => {
                                        const v = Number(e.target.value);
                                        setMoveThreshold(v);
                                        updateSetting("moveThreshold", v);
                                    }}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Marker Section */}
                <SectionHeader id="markers" label="マーカー設定" icon={Sliders} />
                {activeSections.includes("markers") && (
                    <div className="p-3 bg-slate-900/30 rounded-lg space-y-4 mb-2 border border-slate-800">
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
                                                updateSetting("selectedMarkers", newMarkers);
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
                <SectionHeader id="system" label="システム設定" icon={Settings} />
                {activeSections.includes("system") && (
                    <div className="p-3 bg-slate-900/30 rounded-lg space-y-4 mb-2 border border-slate-800">
                        <div className="space-y-2">
                            <HelpLabel label="検出器" description="MoveNetまたはMediaPipeを選択。" />
                            <div className="flex bg-slate-800 rounded-lg p-1">
                                <button
                                    onClick={() => {
                                        setDetectorType("MoveNet");
                                        updateSetting("detectorType", "MoveNet");
                                    }}
                                    className={`flex-1 py-1.5 text-xs rounded-md transition ${detectorType === "MoveNet" ? "bg-slate-600 text-white" : "text-slate-400"
                                        }`}
                                >
                                    MoveNet
                                </button>
                                <button
                                    onClick={() => {
                                        setDetectorType("MediaPipe");
                                        updateSetting("detectorType", "MediaPipe");
                                    }}
                                    className={`flex-1 py-1.5 text-xs rounded-md transition ${detectorType === "MediaPipe" ? "bg-slate-600 text-white" : "text-slate-400"
                                        }`}
                                >
                                    MediaPipe
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <HelpLabel label="モデルタイプ" description="各検出器のモデル精度を選択。" />
                            {detectorType === "MoveNet" ? (
                                <div className="flex bg-slate-800 rounded-lg p-1">
                                    {(["Lightning", "Thunder", "multiPose"] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => {
                                                setMoveNetModelType(t);
                                                updateSetting("moveNetModelType", t);
                                            }}
                                            className={`flex-1 py-1.5 text-xs rounded-md transition ${moveNetModelType === t ? "bg-slate-600 text-white" : "text-slate-400"
                                                }`}
                                        >
                                            {t === "multiPose" ? "Multi" : t}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex bg-slate-800 rounded-lg p-1">
                                    {(["lite", "full", "heavy"] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => {
                                                setBlazePoseModelType(t);
                                                updateSetting("blazePoseModelType", t);
                                            }}
                                            className={`flex-1 py-1.5 text-xs rounded-md transition ${blazePoseModelType === t ? "bg-slate-600 text-white" : "text-slate-400"
                                                }`}
                                        >
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <HelpLabel label="カメラ入力モード" description="指定範囲または全画面。" />
                            <div className="flex bg-slate-800 rounded-lg p-1">
                                <button
                                    onClick={() => {
                                        setInputMode("Range");
                                        updateSetting("inputMode", "Range");
                                    }}
                                    className={`flex-1 py-1.5 text-xs rounded-md transition ${inputMode === "Range" ? "bg-slate-600 text-white" : "text-slate-400"
                                        }`}
                                >
                                    指定範囲
                                </button>
                                <button
                                    onClick={() => {
                                        setInputMode("Full");
                                        updateSetting("inputMode", "Full");
                                    }}
                                    className={`flex-1 py-1.5 text-xs rounded-md transition ${inputMode === "Full" ? "bg-slate-600 text-white" : "text-slate-400"
                                        }`}
                                >
                                    全画面
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <HelpLabel label="カメラソース" description="カメラデバイスを選択 (デバイス間同期は未対応)。" />
                            <select
                                value={selectedCameraId}
                                onChange={(e) => {
                                    setSelectedCameraId(e.target.value);
                                    updateSetting("selectedCameraId", e.target.value);
                                }}
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
                <SectionHeader id="rec" label="記録制御" icon={Mic} />
                {activeSections.includes("rec") && (
                    <div className="p-3 bg-slate-900/30 rounded-lg space-y-4 mb-2 border border-slate-800">
                        {/* Recording Settings */}
                        <div className="bg-slate-800/50 p-2 rounded-lg space-y-2">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isRecordingVideo}
                                    onChange={(e) => {
                                        setIsRecordingVideo(e.target.checked);
                                        updateSetting("isRecordingVideo", e.target.checked);
                                    }}
                                    className="w-4 h-4 rounded text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                                />
                                <span className="text-xs text-slate-300">カメラ映像を記録</span>
                            </label>
                            <label className={`flex items-center space-x-2 cursor-pointer ${!isRecordingVideo ? 'opacity-50 pointer-events-none' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={includePoseInVideo}
                                    onChange={(e) => {
                                        setIncludePoseInVideo(e.target.checked);
                                        updateSetting("includePoseInVideo", e.target.checked);
                                    }}
                                    disabled={!isRecordingVideo}
                                    className="w-4 h-4 rounded text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                                />
                                <span className="text-xs text-slate-300">姿勢マーカーを含める</span>
                            </label>
                        </div>

                        {!showMemoInput ? (
                            <button
                                onClick={() => {
                                    if (isRecording) {
                                        channelRef.current?.postMessage({ type: "STOP_RECORDING" });
                                    } else {
                                        channelRef.current?.postMessage({ type: "START_RECORDING" });
                                    }
                                }}
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
                        ) : (
                            <div className="space-y-3 bg-slate-800 p-3 rounded-lg animate-in fade-in slide-in-from-bottom-2">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <FileJson size={16} className="text-blue-400" />
                                    <span>保存オプション</span>
                                </h3>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">メモ (任意)</label>
                                    <textarea
                                        value={memo}
                                        onChange={(e) => setMemo(e.target.value)}
                                        placeholder="記録に関するメモを入力..."
                                        className="w-full h-20 bg-slate-950 border border-slate-700 rounded-md p-2 text-sm text-white focus:border-blue-500 outline-none resize-none"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setShowMemoInput(false);
                                            setMemo("");
                                        }}
                                        className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition"
                                    >
                                        キャンセル
                                    </button>
                                    <button
                                        onClick={() => {
                                            channelRef.current?.postMessage({
                                                type: "SAVE_AND_DOWNLOAD",
                                                payload: { memo }
                                            });
                                            setShowMemoInput(false);
                                            setMemo("");
                                        }}
                                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm flex items-center justify-center space-x-2 transition"
                                    >
                                        <Save size={16} />
                                        <span>保存 & DL</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {isRecording && recordingStartTime && (
                            <div className="text-center text-xs text-slate-500 font-mono">
                                Recording...
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
