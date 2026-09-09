"use client"

import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { Lock, Mail, Loader2 } from "lucide-react"

export function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      await login(email, password)
    } catch (err: any) {
      setError(
        err?.code === "auth/invalid-credential"
          ? "ای میل یا پاسورڈ درست نہیں۔"
          : err?.code === "auth/too-many-requests"
            ? "کوششیں زیادہ ہو گئیں۔ کچھ دیر بعد دوبارہ کریں۔"
            : "لاگ اِن نہیں ہوا۔ دوبارہ کوشش کریں۔",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground tnum">
            NT
          </div>
          <h1 className="mt-4 text-2xl font-bold text-sidebar-foreground">نور ٹریڈرز</h1>
          <p className="mt-1 text-sm text-sidebar-muted">بزنس مینجمنٹ سسٹم</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl bg-card p-6 shadow-xl"
        >
          <h2 className="mb-1 text-lg font-bold text-card-foreground">لاگ اِن کریں</h2>
          <p className="mb-5 text-sm text-muted-foreground">اپنے اکاؤنٹ سے داخل ہوں</p>

          <label className="mb-1.5 block text-sm font-medium">ای میل</label>
          <div className="relative mb-4">
            <Mail className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-background py-2.5 pr-10 pl-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              placeholder="you@example.com"
              dir="ltr"
            />
          </div>

          <label className="mb-1.5 block text-sm font-medium">پاسورڈ</label>
          <div className="relative mb-5">
            <Lock className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-input bg-background py-2.5 pr-10 pl-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              placeholder="••••••••"
              dir="ltr"
            />
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? "لاگ اِن ہو رہا ہے…" : "لاگ اِن"}
          </button>
        </form>
      </div>
    </div>
  )
}
