import { useState, useRef } from "react";
import {
  Mic,
  MicOff,
  Upload,
  Phone,
  AlertTriangle,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { callTriage } from "../../api/client";
import { triageLevelConfig } from "../../engine/triage";
import type { TriageLevel } from "../../types";

type TriageResult = {
  transcript: string;
  extraction: {
    symptoms: string[];
    regions: string[];
    severity: number | null;
    red_flags: string[];
    distress_score: number;
    triage_level: string;
    triage_reasons: string[];
  };
};

export default function CallIn() {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        const file = new File([blob], "recording.webm", { type: "audio/webm" });
        await submitAudio(file);
      };

      recorder.start();
      mediaRecorder.current = recorder;
      setRecording(true);
    } catch {
      setError("microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && recording) {
      mediaRecorder.current.stop();
      setRecording(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    await submitAudio(file);
  };

  const submitAudio = async (file: File) => {
    setProcessing(true);
    try {
      const res = await callTriage(file);
      setResult({ transcript: res.transcript, extraction: res.extraction });
    } catch {
      setError("failed to process audio — is the backend running?");
    } finally {
      setProcessing(false);
    }
  };

  const triageColor = (level: string) => {
    const cfg = triageLevelConfig[level as TriageLevel];
    return cfg || { label: level, color: "#6b7280", bg: "#f3f4f6" };
  };

  return (
    <div>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "#1f2937",
          margin: "0 0 8px",
        }}
      >
        Call In
      </h2>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px" }}>
        Record or upload a voice note describing your symptoms. Vitality will
        transcribe, extract key information, and triage.
      </p>

      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: recording ? "#fef2f2" : "#f3f4f6",
            border: `2px solid ${recording ? "#dc2626" : "#e5e7eb"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s",
          }}
        >
          {recording ? (
            <MicOff size={32} color="#dc2626" />
          ) : (
            <Mic size={32} color="#6b7280" />
          )}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {!recording ? (
            <button
              onClick={startRecording}
              disabled={processing}
              style={{
                padding: "12px 24px",
                borderRadius: 10,
                border: "none",
                backgroundColor: "#dc2626",
                color: "#fff",
                fontWeight: 600,
                cursor: processing ? "not-allowed" : "pointer",
                opacity: processing ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
              }}
            >
              <Phone size={16} /> Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              style={{
                padding: "12px 24px",
                borderRadius: 10,
                border: "none",
                backgroundColor: "#374151",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
              }}
            >
              <MicOff size={16} /> Stop & Submit
            </button>
          )}

          <label
            style={{
              padding: "12px 24px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              backgroundColor: "#fff",
              fontWeight: 600,
              cursor: processing ? "not-allowed" : "pointer",
              opacity: processing ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              color: "#374151",
            }}
          >
            <Upload size={16} /> Upload Audio
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              disabled={processing}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {recording && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#dc2626",
                animation: "pulse 1s infinite",
              }}
            />
            <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 500 }}>
              recording...
            </span>
            <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
          </div>
        )}

        {processing && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2
              size={16}
              color="#6b7280"
              style={{ animation: "spin 1s linear infinite" }}
            />
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              transcribing and analyzing...
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            borderRadius: 10,
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <AlertTriangle size={16} color="#dc2626" />
          <span style={{ fontSize: 13, color: "#991b1b" }}>{error}</span>
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 20,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* triage level */}
          {(() => {
            const cfg = triageColor(result.extraction.triage_level);
            return (
              <div
                style={{
                  padding: "16px 20px",
                  borderRadius: 12,
                  backgroundColor: cfg.bg,
                  border: `1px solid ${cfg.color}30`,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <CheckCircle size={22} color={cfg.color} />
                <div>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: cfg.color,
                      margin: 0,
                    }}
                  >
                    {cfg.label}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#4b5563",
                      margin: "4px 0 0",
                    }}
                  >
                    {result.extraction.triage_reasons.join(" • ")}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* transcript */}
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: "16px 20px",
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#9ca3af",
                margin: "0 0 8px",
                textTransform: "uppercase",
              }}
            >
              transcript
            </p>
            <p
              style={{
                fontSize: 14,
                color: "#374151",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              {result.transcript}
            </p>
          </div>

          {/* extracted entities */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: "16px 20px",
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#9ca3af",
                  margin: "0 0 8px",
                  textTransform: "uppercase",
                }}
              >
                symptoms detected
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.extraction.symptoms.length > 0 ? (
                  result.extraction.symptoms.map((s) => (
                    <span
                      key={s}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        backgroundColor: "#f3f4f6",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#374151",
                      }}
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: 13, color: "#9ca3af" }}>
                    none detected
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: "16px 20px",
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#9ca3af",
                  margin: "0 0 8px",
                  textTransform: "uppercase",
                }}
              >
                regions mentioned
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.extraction.regions.length > 0 ? (
                  result.extraction.regions.map((r) => (
                    <span
                      key={r}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        backgroundColor: "#fdf2f8",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#be185d",
                      }}
                    >
                      {r}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: 13, color: "#9ca3af" }}>
                    none mentioned
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* red flags */}
          {result.extraction.red_flags.length > 0 && (
            <div
              style={{
                backgroundColor: "#fef2f2",
                borderRadius: 12,
                border: "1px solid #fecaca",
                padding: "16px 20px",
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#dc2626",
                  margin: "0 0 8px",
                  textTransform: "uppercase",
                }}
              >
                red flags
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.extraction.red_flags.map((f) => (
                  <span
                    key={f}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      backgroundColor: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#dc2626",
                      border: "1px solid #fecaca",
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* severity + distress */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: "16px 20px",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 6px" }}>
                severity
              </p>
              <p
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#1f2937",
                  margin: 0,
                }}
              >
                {result.extraction.severity ?? "—"}
                <span style={{ fontSize: 14, color: "#9ca3af" }}>/10</span>
              </p>
            </div>
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: "16px 20px",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 6px" }}>
                distress cues
              </p>
              <p
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#1f2937",
                  margin: 0,
                }}
              >
                {result.extraction.distress_score}
                <span style={{ fontSize: 14, color: "#9ca3af" }}>/5</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
