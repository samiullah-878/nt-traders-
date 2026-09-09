"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { LoginScreen } from "@/components/login-screen"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  ReceiptText,
  HandCoins,
  Wallet,
  CalendarCheck,
  ListTodo,
  BadgeDollarSign,
  Package,
  ShoppingCart,
  Factory,
  FileBarChart,
  Menu,
  X,
  LogOut,
  Loader2,
} from "lucide-react"

type NavItem = { label: string; href: string; icon: React.ElementType; ready?: boolean }
type NavGroup = { title: string; items: NavItem[] }

const groups: NavGroup[] = [
  {
    title: "حساب کتاب",
    items: [
      { label: "ڈیش بورڈ", href: "/dashboard", icon: LayoutDashboard },
      { label: "فروخت", href: "/sales", icon: ReceiptText },
      { label: "وصولی", href: "/collections", icon: HandCoins },
      { label: "اخراجات", href: "/expenses", icon: Wallet },
    ],
  },
  {
    title: "عملہ",
    items: [
      { label: "حاضری", href: "/attendance", icon: CalendarCheck, ready: true },
      { label: "عملہ کے کام", href: "/tasks", icon: ListTodo },
      { label: "تنخواہیں", href: "/salaries", icon: BadgeDollarSign },
    ],
  },
  {
    title: "اسٹاک و پیداوار",
    items: [
      { label: "اسٹاک", href: "/stock", icon: Package },
      { label: "خریداری", href: "/purchases", icon: ShoppingCart },
      { label: "مینوفیکچرنگ", href: "/manufacturing", icon: Factory },
    ],
  },
  {
    title: "رپورٹس",
    items: [{ label: "رپورٹس", href: "/reports", icon: FileBarChart }],
  },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-sidebar">
        <Loader2 className="size-6 animate-spin text-sidebar-foreground" />
      </div>
    )
  }

  if (!user) return <LoginScreen />

  return (
    <div className="min-h-dvh">
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground tnum">
            NT
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">نور ٹریڈرز</p>
            <p className="truncate text-xs text-sidebar-muted">بزنس مینجمنٹ</p>
          </div>
          <button
            className="mr-auto rounded-lg p-1.5 text-sidebar-muted hover:bg-white/10 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="بند کریں"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((group) => (
            <div key={group.title} className="mb-5">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-sidebar-muted">
                {group.title}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                          active
                            ? "bg-primary font-semibold text-primary-foreground"
                            : "text-sidebar-foreground/85 hover:bg-white/10",
                        )}
                      >
                        <Icon className="size-[18px] shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {!item.ready && (
                          <span className="mr-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-sidebar-muted">
                            جلد
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 truncate px-2 text-xs text-sidebar-muted" dir="ltr">
            {user.email}
          </div>
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/85 transition-colors hover:bg-white/10"
          >
            <LogOut className="size-[18px]" />
            لاگ آؤٹ
          </button>
        </div>
      </aside>

      <div className="lg:pr-72">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur lg:hidden">
          <button
            className="rounded-lg border border-border p-2"
            onClick={() => setOpen(true)}
            aria-label="مینو کھولیں"
          >
            <Menu className="size-5" />
          </button>
          <span className="font-bold">نور ٹریڈرز</span>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-5 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
