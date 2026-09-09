import { Construction } from "lucide-react"

export function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Construction className="size-7" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">یہ حصہ جلد آ رہا ہے</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
          ری ڈیزائن مرحلہ وار ہو رہا ہے۔ فی الحال حاضری اور عملہ کا حصہ تیار ہے — باقی
          ماڈیولز اگلے مرحلے میں شامل ہوں گے۔
        </p>
      </div>
    </div>
  )
}
