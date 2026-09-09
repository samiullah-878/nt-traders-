export function todayStr(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60000)
  return local.toISOString().slice(0, 10)
}

export function nowTime(): string {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function money(n: number): string {
  return new Intl.NumberFormat("en-PK").format(Math.round(n || 0))
}

export function prettyDate(dateStr: string): string {
  if (!dateStr) return ""
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("ur-PK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function initials(name: string): string {
  const parts = (name || "").trim().split(/\s+/)
  return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "")
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}
