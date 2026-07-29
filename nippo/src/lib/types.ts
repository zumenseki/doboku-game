export type Sub = {
  id: string
  name: string
  display_order: number
  is_active: boolean
  created_at: string
}

export type WorkType = {
  id: string
  name: string
  display_order: number
  is_active: boolean
}

export type SiteStatus = 'active' | 'closed'

export type Site = {
  id: string
  token: string
  name: string
  address: string | null
  drawing_key: string | null
  scale_m_per_px: number | null
  status: SiteStatus
  opened_on: string | null
  closed_at: string | null
  created_at: string
}

export type Report = {
  id: string
  site_id: string
  sub_id: string
  work_date: string
  workers: number
  work_type: string
  area_m2: number | null
  note: string | null
  created_at: string
}

export type ReportPhoto = {
  id: string
  report_id: string
  object_key: string
  created_at: string
}

/** 一覧表示用に現場名・業者名を結合した日報 */
export type ReportRow = Report & {
  sites: { name: string } | null
  subs: { name: string } | null
  report_photos: { id: string; object_key: string }[]
}
