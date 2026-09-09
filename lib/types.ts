export interface Staff {
  id: string
  name: string
  meal?: string
  mealAmount?: number
  phone?: string
}

export interface AttendanceRecord {
  in?: string
  out?: string
  location?: string
  score?: number | ""
}

export type DayAttendance = Record<string, AttendanceRecord>
