import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from "lucide-react";
import { getAppointments } from "../../api/client";
import { patients } from "../../config/patients";
import type { Patient } from "../../config/patients";

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

type AppointmentItem = { time: string; patient_name: string; type: string };

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function patientForAppointment(patient_name: string): Patient {
  const found = patients.find(
    (p) => p.name.toLowerCase() === patient_name.toLowerCase(),
  );
  if (found) return found;
  return {
    id: `calendar-${patient_name.replace(/\s+/g, "-").toLowerCase()}`,
    name: patient_name,
    age: 0,
    urgency: "stable",
    condition: "—",
    lastVisit: "—",
    nextAppointment: "—",
    phone: "—",
  };
}

interface CalendarViewProps {
  onSelectPatient: (patient: Patient) => void;
}

export default function CalendarView({ onSelectPatient }: CalendarViewProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [appointmentsByDate, setAppointmentsByDate] = useState<Record<string, AppointmentItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const daysInMonth = getDaysInMonth(year, month);
    const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
    getAppointments(from, to)
      .then((res) => {
        if (cancelled || !res?.appointments) return;
        const byDate: Record<string, AppointmentItem[]> = {};
        for (const a of res.appointments) {
          const d = a.date;
          if (!byDate[d]) byDate[d] = [];
          byDate[d].push({
            time: a.time,
            patient_name: a.patient_name,
            type: a.type,
          });
        }
        setAppointmentsByDate(byDate);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [year, month]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

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
            const appts = day ? appointmentsByDate[key] || [] : [];
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
                        const patient = patientForAppointment(a.patient_name);
                        return (
                        <button
                          key={j}
                          type="button"
                          onClick={() => onSelectPatient(patient)}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 8,
                            backgroundColor: "#fdf2f8",
                            border: "1px solid #fbcfe8",
                            borderLeft: "3px solid #be185d",
                            cursor: "pointer",
                            transition: "transform 0.15s",
                            width: "100%",
                            textAlign: "left",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.02)";
                            e.currentTarget.style.backgroundColor = "#fce7f3";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                            e.currentTarget.style.backgroundColor = "#fdf2f8";
                          }}
                        >
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#be185d",
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
                            {a.patient_name}
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
                          <p
                            style={{
                              fontSize: 10,
                              color: "#be185d",
                              margin: "4px 0 0",
                              fontWeight: 600,
                            }}
                          >
                            View profile →
                          </p>
                        </button>
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
      {loading && (
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 12 }}>
          Loading appointments...
        </p>
      )}
    </div>
  );
}
