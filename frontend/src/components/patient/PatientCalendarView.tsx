import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
} from "lucide-react";
import { getAppointments, createAppointment } from "../../api/client";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const visitTypes = ["Visit", "Follow-up", "Check-up", "Consult", "Other"];

export default function PatientCalendarView() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [appointments, setAppointments] = useState<Record<string, { time: string; type: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleType, setScheduleType] = useState("Visit");
  const [submitting, setSubmitting] = useState(false);

  const patientName =
    typeof window !== "undefined"
      ? localStorage.getItem("vitality_patient_name") || "Patient"
      : "Patient";

  useEffect(() => {
    let cancelled = false;
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const to = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(getDaysInMonth(nextYear, nextMonth)).padStart(2, "0")}`;
    getAppointments(from, to)
      .then((res) => {
        if (cancelled || !res?.appointments) return;
        const byDate: Record<string, { time: string; type: string }[]> = {};
        for (const a of res.appointments) {
          const d = a.date;
          if (!byDate[d]) byDate[d] = [];
          byDate[d].push({ time: a.time, type: a.type });
        }
        setAppointments(byDate);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [year, month]);

  const handleSchedule = async () => {
    if (!scheduleDate) return;
    setSubmitting(true);
    try {
      await createAppointment({
        date: scheduleDate,
        time: scheduleTime,
        type: scheduleType,
        patient_name: patientName,
      });
      setAppointments((prev) => {
        const next = { ...prev };
        const list = next[scheduleDate] || [];
        list.push({ time: scheduleTime, type: scheduleType });
        next[scheduleDate] = list;
        return next;
      });
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const openModalForDate = (dateKey: string) => {
    setScheduleDate(dateKey);
    setScheduleTime("09:00");
    setScheduleType("Visit");
    setModalOpen(true);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
            <CalendarIcon size={20} className="text-pink-700" />
          </div>
          <div>
            <h2 className="text-[22px] font-bold text-slate-800 tracking-tight m-0">
              My Calendar
            </h2>
            <p className="text-sm text-slate-500 mt-0.5 m-0">
              Schedule visits — they appear on your care team’s calendar
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            const d = new Date(year, month, 1);
            setScheduleDate(formatDateKey(year, month, 1));
            setScheduleTime("09:00");
            setScheduleType("Visit");
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-semibold shadow-sm hover:bg-pink-700 transition"
        >
          <Plus size={18} /> Schedule visit
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={prev}
          className="w-9 h-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50"
        >
          <ChevronLeft size={18} className="text-slate-600" />
        </button>
        <span className="flex items-center text-lg font-bold text-slate-800">
          {monthNames[month]} {year}
        </span>
        <button
          type="button"
          onClick={next}
          className="w-9 h-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50"
        >
          <ChevronRight size={18} className="text-slate-600" />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
          {dayNames.map((d) => (
            <div
              key={d}
              className="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wide"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const key = day ? formatDateKey(year, month, day) : "";
            const appts = day ? appointments[key] || [] : [];
            const currentDay = day && isToday(day);
            return (
              <div
                key={i}
                className={`min-h-[100px] p-2 border-b border-r border-slate-100 ${
                  (i + 1) % 7 === 0 ? "border-r-0" : ""
                } ${currentDay ? "bg-pink-50/50" : ""}`}
              >
                {day && (
                  <>
                    <button
                      type="button"
                      onClick={() => openModalForDate(key)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mb-1 ${
                        currentDay
                          ? "bg-pink-600 text-white"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {day}
                    </button>
                    <div className="space-y-1">
                      {appts.map((a, j) => (
                        <div
                          key={j}
                          className="text-xs px-2 py-1 rounded-lg bg-pink-50 border border-pink-100 text-pink-800 font-medium truncate"
                        >
                          {a.time} · {a.type}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400 mt-2">Loading appointments...</p>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => !submitting && setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 m-0 mb-4">
              Schedule a visit
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Type
                </label>
                <select
                  value={scheduleType}
                  onChange={(e) => setScheduleType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-800"
                >
                  {visitTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => !submitting && setModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSchedule}
                disabled={submitting || !scheduleDate}
                className="flex-1 py-2.5 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-700 disabled:opacity-50"
              >
                {submitting ? "Scheduling..." : "Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
