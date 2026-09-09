import type { Metadata, Viewport } from "next"
import { Noto_Naskh_Arabic, Geist_Mono } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/components/auth-provider"

const urdu = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-urdu",
})

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "نور ٹریڈرز — بزنس مینجمنٹ",
  description: "نور ٹریڈرز کے لیے حاضری، عملہ اور کاروبار کا مکمل انتظام",
}

export const viewport: Viewport = {
  themeColor: "#0b3a36",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ur" dir="rtl" className="bg-background">
      <body className={`${urdu.variable} ${mono.variable} font-sans antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
