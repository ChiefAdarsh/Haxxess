import { useSymptoms } from "../../context/SymptomContext";
import type { BodyRegion } from "../../types";

const regionLabels: Record<BodyRegion, string> = {
  LLQ: "Left Lower Quad.",
  RLQ: "Right Lower Quad.",
  pelvic_midline: "Pelvic Midline",
  suprapubic: "Suprapubic",
  vulva: "Vulva",
  low_back: "Lower Back",
  left_thigh: "Left Thigh",
  right_thigh: "Right Thigh",
};

function severityColor(sev: number): string {
  if (sev <= 3) return "#fde68a";
  if (sev <= 6) return "#fb923c";
  return "#dc2626";
}

export default function SymptomHistory() {
  const { symptoms, getRecent } = useSymptoms();

  // Sort symptoms descending so the newest are at the top of the timeline
  const sortedSymptoms = [...symptoms].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const recent = getRecent(30);

  // Region frequency
  const regionFreq: Partial<Record<BodyRegion, number>> = {};
  for (const s of recent) {
    regionFreq[s.region] = (regionFreq[s.region] || 0) + 1;
  }
  const sortedRegions = Object.entries(regionFreq).sort((a, b) => b[1] - a[1]);
  const maxFreq = sortedRegions.length > 0 ? sortedRegions[0][1] : 1;

  return (
    <div>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "#1f2937",
          margin: "0 0 20px",
        }}
      >
        Pelvic Symptom History
      </h2>

      {/* Region Frequency Chart */}
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          padding: "20px",
          marginBottom: 20,
        }}
      >
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#9ca3af",
            textTransform: "uppercase",
            margin: "0 0 14px",
          }}
        >
          Most Frequent Regions (Last 30 Days)
        </h3>

        {sortedRegions.length === 0 ? (
          <p
            style={{
              fontSize: 13,
              color: "#6b7280",
              fontStyle: "italic",
              margin: 0,
            }}
          >
            No symptoms logged in the last 30 days.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sortedRegions.map(([region, count]) => (
              <div
                key={region}
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: "#4b5563",
                    width: 120,
                    flexShrink: 0,
                  }}
                >
                  {regionLabels[region as BodyRegion] || region}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 20,
                    backgroundColor: "#f3f4f6",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 4,
                      width: `${(count / maxFreq) * 100}%`,
                      backgroundColor: "#ec4899",
                      opacity: 0.8, // Pinkish theme
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#4b5563",
                    width: 24,
                    textAlign: "right",
                  }}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          padding: "20px",
        }}
      >
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#9ca3af",
            textTransform: "uppercase",
            margin: "0 0 14px",
          }}
        >
          Timeline
        </h3>

        {sortedSymptoms.length === 0 ? (
          <p
            style={{
              fontSize: 13,
              color: "#6b7280",
              fontStyle: "italic",
              margin: 0,
            }}
          >
            Your timeline is empty.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {sortedSymptoms.map((s, i) => {
              const date = new Date(s.timestamp);
              const dateStr = date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
              const timeStr = date.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const color = severityColor(s.severity);
              const isLast = i === sortedSymptoms.length - 1;

              return (
                <div key={s.id} style={{ display: "flex", gap: 14 }}>
                  {/* Timeline line */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      width: 20,
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: color,
                        border: "2px solid #fff",
                        boxShadow: `0 0 0 2px ${color}40`,
                        flexShrink: 0,
                        marginTop: 4,
                      }}
                    />
                    {!isLast && (
                      <div
                        style={{
                          width: 2,
                          flex: 1,
                          minHeight: 40,
                          backgroundColor: "#e5e7eb",
                          margin: "4px 0",
                        }}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ paddingBottom: isLast ? 0 : 20, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#4b5563",
                        }}
                      >
                        {dateStr}
                      </span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>
                        {timeStr}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 20,
                          backgroundColor: `${color}20`,
                          color,
                        }}
                      >
                        {s.severity}/10
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#1f2937",
                        margin: "0 0 2px",
                        textTransform: "capitalize",
                      }}
                    >
                      {s.type} — {regionLabels[s.region] || s.region}
                    </p>
                    {s.qualities.length > 0 && (
                      <p
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          margin: "0 0 4px",
                          textTransform: "lowercase",
                        }}
                      >
                        {s.qualities.join(", ")}
                      </p>
                    )}
                    {s.notes && (
                      <p
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          margin: "4px 0 0",
                          fontStyle: "italic",
                          backgroundColor: "#f9fafb",
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #f3f4f6",
                        }}
                      >
                        "{s.notes}"
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
