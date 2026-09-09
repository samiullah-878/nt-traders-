"use client"

import { useEffect, useMemo, useState } from "react"
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
} from "firebase/firestore"
import { db, BUSINESS_ID } from "@/lib/firebase"
import type { Staff, DayAttendance } from "@/lib/types"
import { todayStr, nowTime, prettyDate, initials, cn } from "@/lib/utils"
import {
  UserPlus,
  LogIn,
  LogOut,
  MapPin,
  Users,
  UserCheck,
  UserX,
  Star,
  Trash2,
  X,
} from "lucide-react"

function statusOf(rec?: { in?: string; out?: string }) {
  if (rec?.out) return "checkedout" as const
  if (rec?.in) return "present" as const
  return "absent" as const
}

export function AttendanceView() {
  const [date, setDate] = useState(todayStr())
  const [staff, setStaff] = useState<Staff[]>([])
  const [day, setDay] = useState<DayAttendance>({})
  const [query, setQuery] = useState("")
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    const ref = collection(db, "businesses", BUSINESS_ID, "staff")
    return onSnapshot(ref, (snap) => {
      const list: Staff[] = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Staff, "id">) }))
      list.sort((a, b) => a.name.localeCompare(b.name, "ur"))
      setStaff(list)
    })
  }, [])

  useEffect(() => {
    const ref = doc(db, "businesses", BUSINESS_ID, "attendance", date)
    return onSnapshot(ref, (snap) => {
      setDay(snap.exists() ? (snap.data() as DayAttendance) : {})
    })
  }, [date])

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return staff
    return staff.filter((s) => s.name.includes(q))
  }, [staff, query])

  const stats = useMemo(() => {
    let present = 0
    let out = 0
    let scoreSum = 0
    let scoreCount = 0
    for (const s of staff) {
      const rec = day[s.id]
      const st = statusOf(rec)
      if (st === "present") present++
      if (st === "checkedout") out++
      if (rec && typeof rec.score === "number") {
        scoreSum += rec.score
        scoreCount++
      }
    }
    const attended = present + out
    return {
      total: staff.length,
      attended,
      absent: staff.length - attended,
      avg: scoreCount ? Math.round((scoreSum / scoreCount) * 10) / 10 : null,
    }
  }, [staff, day])

  async function writeRec(staffId: string, patch: Record<string, unknown>) {
    const ref = doc(db, "businesses", BUSINESS_ID, "attendance", date)
    await setDoc(ref, { [staffId]: patch }, { merge: true })
  }

  function checkIn(staffId: string) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) =>
          writeRec(staffId, {
            in: nowTime(),
            location: `${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`,
          }),
        () => writeRec(staffId, { in: nowTime(), location: "اجازت نہیں" }),
      )
    } else {
      writeRec(staffId, { in: nowTime() })
    }
  }

  function checkOut(staffId: string) {
    writeRec(staffId, { out: nowTime() })
  }

  function setScore(staffId: string, value: string) {
    writeRec(staffId, { score: value === "" ? "" : Number(value) })
  }

  async function addStaff(payload: Omit<Staff, "id">) {
    const id = String(Date.now())
    await setDoc(doc(db, "businesses", BUSINESS_ID, "staff", id), { ...payload })
    setShowAdd(false)
  }

  async function removeStaff(staffId: string) {
    if (!confirm("کیا آپ واقعی اس عملہ کو ہٹانا چاہتے ہیں؟")) return
    await deleteDoc(doc(db, "businesses", BUSINESS_ID, "staff", staffId))
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">حاضری</h1>
          <p className="mt-1 text-sm text-muted-foreground">{prettyDate(date)}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="tnum rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            dir="ltr"
          />
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <UserPlus className="size-4" />
            <span className="hidden sm:inline">عملہ شامل کریں</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="کل عملہ" value={stats.total} tone="neutral" />
        <StatCard icon={UserCheck} label="حاضر" value={stats.attended} tone="success" />
        <StatCard icon={UserX} label="غیر حاضر" value={stats.absent} tone="danger" />
        <StatCard
          icon={Star}
          label="اوسط اسکور"
          value={stats.avg ?? "—"}
          tone="accent"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="font-semibold">عملہ کی فہرست</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="نام تلاش کریں…"
            className="w-40 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 sm:w-52"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {staff.length === 0
              ? "ابھی کوئی عملہ شامل نہیں۔ اوپر سے عملہ شامل کریں۔"
              : "کوئی نتیجہ نہیں ملا۔"}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((s) => (
              <StaffRow
                key={s.id}
                staff={s}
                rec={day[s.id]}
                onCheckIn={() => checkIn(s.id)}
                onCheckOut={() => checkOut(s.id)}
                onScore={(v) => setScore(s.id, v)}
                onRemove={() => removeStaff(s.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {showAdd && <AddStaffModal onClose={() => setShowAdd(false)} onAdd={addStaff} />}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  tone: "neutral" | "success" | "danger" | "accent"
}) {
  const tones: Record<string, string> = {
    neutral: "bg-secondary text-primary",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    accent: "bg-accent/10 text-accent",
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={cn("flex size-9 items-center justify-center rounded-lg", tones[tone])}>
        <Icon className="size-[18px]" />
      </div>
      <p className="mt-3 text-2xl font-bold tnum">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function StaffRow({
  staff,
  rec,
  onCheckIn,
  onCheckOut,
  onScore,
  onRemove,
}: {
  staff: Staff
  rec?: DayAttendance[string]
  onCheckIn: () => void
  onCheckOut: () => void
  onScore: (v: string) => void
  onRemove: () => void
}) {
  const status = statusOf(rec)
  const badge = {
    present: { label: "حاضر", cls: "bg-success-soft text-success" },
    checkedout: { label: "چھٹی", cls: "bg-info-soft text-info" },
    absent: { label: "غیر حاضر", cls: "bg-danger-soft text-danger" },
  }[status]

  return (
    <li className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-bold text-primary">
          {initials(staff.name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{staff.name}</p>
            <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", badge.cls)}>
              {badge.label}
            </span>
          </div>

          {staff.meal && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              کھانا: {staff.meal}
              {staff.mealAmount ? ` · ${staff.mealAmount}` : ""}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <LogIn className="size-3.5 text-success" />
              <span className="tnum">{rec?.in || "—"}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <LogOut className="size-3.5 text-info" />
              <span className="tnum">{rec?.out || "—"}</span>
            </span>
            {rec?.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                <span className="tnum max-w-[120px] truncate" dir="ltr">
                  {rec.location}
                </span>
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={onCheckIn}
              className="rounded-lg bg-success-soft px-3 py-1.5 text-xs font-semibold text-success hover:opacity-80"
            >
              چیک اِن
            </button>
            <button
              onClick={onCheckOut}
              className="rounded-lg bg-info-soft px-3 py-1.5 text-xs font-semibold text-info hover:opacity-80"
            >
              چیک آؤٹ
            </button>
            <div className="inline-flex items-center gap-1.5">
              <Star className="size-3.5 text-accent" />
              <input
                type="number"
                min={0}
                max={10}
                value={rec?.score === undefined ? "" : rec.score}
                onChange={(e) => onScore(e.target.value)}
                placeholder="اسکور"
                className="tnum w-16 rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <button
              onClick={onRemove}
              className="mr-auto rounded-lg p-1.5 text-muted-foreground hover:bg-danger-soft hover:text-danger"
              aria-label="ہٹائیں"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}

function AddStaffModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (payload: Omit<Staff, "id">) => void
}) {
  const [name, setName] = useState("")
  const [meal, setMeal] = useState("")
  const [mealAmount, setMealAmount] = useState("")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({
      name: name.trim(),
      meal: meal.trim() || undefined,
      mealAmount: mealAmount ? Number(mealAmount) : undefined,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">نیا عملہ</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
            aria-label="بند کریں"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">نام</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              placeholder="عملہ کا نام"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">کھانا</label>
              <input
                value={meal}
                onChange={(e) => setMeal(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                placeholder="مثلاً دوپہر"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">رقم</label>
              <input
                type="number"
                value={mealAmount}
                onChange={(e) => setMealAmount(e.target.value)}
                className="tnum w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                placeholder="0"
                dir="ltr"
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            محفوظ کریں
          </button>
        </form>
      </div>
    </div>
  )
}
