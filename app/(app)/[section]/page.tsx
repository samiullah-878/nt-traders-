import { ComingSoon } from "@/components/coming-soon"

const titles: Record<string, string> = {
  dashboard: "ڈیش بورڈ",
  sales: "فروخت",
  collections: "وصولی",
  expenses: "اخراجات",
  tasks: "عملہ کے کام",
  salaries: "تنخواہیں",
  stock: "اسٹاک",
  purchases: "خریداری",
  manufacturing: "مینوفیکچرنگ",
  reports: "رپورٹس",
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  return <ComingSoon title={titles[section] ?? "صفحہ"} />
}
