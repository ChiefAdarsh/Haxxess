import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from "lucide-react";
import { patients } from "../../config/patients";

const urgencyColor = {
  critical: "#be185d",
  moderate: "#f59e0b",
  stable: "#10b981",
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const appointments: Record<
  string,
  { time: string; patient: (typeof patients)[0]; type: string }[]
> = {
  "2026-02-22": [
    { time: "9:00 AM", patient: patients[3], type: "Post-Op Follow-up" },
  ],
  "2026-02-24": [
    { time: "10:30 AM", patient: patients[0], type: "Endometriosis Check" },
    { time: "2:00 PM", patient: patients[2], type: "Prenatal" },
  ],
  "2026-02-25": [
    { time: "11:00 AM", patient: patients[4], type: "Annual Physical" },
  ],
  "2026-02-26": [
    { time: "9:30 AM", patient: patients[5], type: "BP Follow-up" },
  ],
  "2026-02-28": [
    { time: "1:00 PM", patient: patients[1], type: "Pelvic Pain Consult" },
  ],
  "2026-03-01": [{ time: "10:00 AM", patient: patients[2], type: "Prenatal" }],
  "2026-03-03": [
    { time: "2:00 PM", patient: patients[0], type: "Vitality Data Review" },
  ],
  "2026-03-05": [
    { time: "9:00 AM", patient: patients[3], type: "HRV Consult" },
  ],
  "2026-03-10": [{ time: "11:00 AM", patient: patients[4], type: "Physical" }],
  "2026-03-12": [{ time: "3:00 PM", patient: patients[5], type: "BP Check" }],
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CalendarView() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(1); // feb = 1

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const today = new Date("2026-02-22T18:00:00");
  const isToday = (d: number) =>
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === d;

  const prev = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else setMonth(month - 1);
  };
  const next = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else setMonth(month + 1);
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: "#fdf2f8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CalendarIcon size={20} color="#be185d" />
          </div>
          <div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#1e293b",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              {monthNames[month]} {year}
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "#64748b",
                margin: "2px 0 0",
                fontWeight: 500,
              }}
            >
              Schedule & Follow-ups
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={prev}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              backgroundColor: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#cbd5e1";
              e.currentTarget.style.backgroundColor = "#f8fafc";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.backgroundColor = "#fff";
            }}
          >
            <ChevronLeft size={18} color="#475569" />
          </button>

          <button
            onClick={next}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              backgroundColor: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#cbd5e1";
              e.currentTarget.style.backgroundColor = "#f8fafc";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.backgroundColor = "#fff";
            }}
          >
            <ChevronRight size={18} color="#475569" />
          </button>
        </div>
      </div>

      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 16,
          border: "1px solid #f1f5f9",
          overflow: "hidden",
          boxShadow:
            "0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            backgroundColor: "#f8fafc",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          {dayNames.map((d) => (
            <div
              key={d}
              style={{
                padding: "12px 10px",
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {cells.map((day, i) => {
            const key = day ? formatDateKey(year, month, day) : "";
            const appts = day ? appointments[key] || [] : [];
            const isCurrentDay = day && isToday(day);

            return (
              <div
                key={i}
                style={{
                  minHeight: 120,
                  padding: "10px",
                  borderRight: (i + 1) % 7 === 0 ? "none" : "1px solid #f1f5f9",
                  borderBottom: "1px solid #f1f5f9",
                  backgroundColor: isCurrentDay ? "#fffbfe" : "transparent",
                  transition: "background-color 0.2s",
                }}
              >
                {day && (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          fontSize: 13,
                          fontWeight: isCurrentDay ? 700 : 600,
                          color: isCurrentDay ? "#fff" : "#475569",
                          backgroundColor: isCurrentDay
                            ? "#be185d"
                            : "transparent",
                          boxShadow: isCurrentDay
                            ? "0 2px 8px rgba(190, 24, 93, 0.25)"
                            : "none",
                        }}
                      >
                        {day}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {appts.map((a, j) => {
                        const isCritical = a.patient.urgency === "critical";
                        return (
                          <div
                            key={j}
                            style={{
                              padding: "6px 8px",
                              borderRadius: 8,
                              backgroundColor: isCritical
                                ? "#fdf2f8"
                                : `${urgencyColor[a.patient.urgency]}10`,
                              border: `1px solid ${isCritical ? "#fbcfe8" : "transparent"}`,
                              borderLeft: `3px solid ${urgencyColor[a.patient.urgency]}`,
                              cursor: "pointer",
                              transition: "transform 0.15s",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.transform = "scale(1.02)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.transform = "scale(1)")
                            }
                          >
                            <p
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: urgencyColor[a.patient.urgency],
                                margin: 0,
                                letterSpacing: "0.02em",
                              }}
                            >
                              {a.time}
                            </p>
                            <p
                              style={{
                                fontSize: 12,
                                color: "#1e293b",
                                margin: "2px 0 0",
                                fontWeight: 600,
                              }}
                            >
                              {a.patient.name}
                            </p>
                            <p
                              style={{
                                fontSize: 11,
                                color: "#64748b",
                                margin: "2px 0 0",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {a.type}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
