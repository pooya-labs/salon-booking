import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatJalaliDate, getIranTodayDateKey, getJalaliMonthGrid, gregorianToJalali, toPersianDigits } from './jalali-date'

const MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']

type Props = { label: string; value: string; onChange: (dateKey: string) => void; disabled?: boolean; allowPast?: boolean }

export function JalaliDatePicker({ label, value, onChange, disabled = false, allowPast = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const today = getIranTodayDateKey()
  const initial = gregorianToJalali(value || today) ?? { year: 1405, month: 1, day: 1 }
  const [visibleMonth, setVisibleMonth] = useState({ year: initial.year, month: initial.month })

  useEffect(() => {
    if (!value) return
    const selected = gregorianToJalali(value)
    if (selected) setVisibleMonth({ year: selected.year, month: selected.month })
  }, [value])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const calendar = useMemo(() => getJalaliMonthGrid(visibleMonth.year, visibleMonth.month), [visibleMonth.year, visibleMonth.month])
  const moveMonth = (delta: number) => {
    let year = visibleMonth.year
    let month = visibleMonth.month + delta
    if (month < 1) { month = 12; year -= 1 }
    if (month > 12) { month = 1; year += 1 }
    setVisibleMonth({ year, month })
  }

  return (
    <div className="admin-jalali-date-picker" ref={rootRef}>
      <span className="admin-jalali-date-label">{label}</span>
      <button type="button" className="admin-jalali-date-trigger" disabled={disabled}
        aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <CalendarDays size={16} />
        <span>{value ? formatJalaliDate(value) : 'انتخاب تاریخ شمسی'}</span>
        <ChevronLeft size={15} />
      </button>
      {open && (
        <div className="admin-jalali-calendar-popover" role="dialog" aria-label={`انتخاب تاریخ شمسی · ${label}`}>
          <div className="admin-jalali-calendar-header">
            <button type="button" aria-label="ماه قبل" onClick={() => moveMonth(-1)}><ChevronRight size={17} /></button>
            <strong>{MONTH_NAMES[visibleMonth.month - 1]} {toPersianDigits(visibleMonth.year)}</strong>
            <button type="button" aria-label="ماه بعد" onClick={() => moveMonth(1)}><ChevronLeft size={17} /></button>
          </div>
          <div className="admin-jalali-calendar-grid admin-jalali-weekdays">
            {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday.slice(0, 1)}</span>)}
          </div>
          <div className="admin-jalali-calendar-grid">
            {calendar.map((day, index) => {
              if (!day) return <span className="admin-jalali-calendar-empty" key={`empty-${index}`} />
              const selected = value === day.dateKey
              const isToday = today === day.dateKey
              const isPast = day.dateKey < today
              return <button type="button" key={day.dateKey}
                className={['admin-jalali-calendar-day', selected ? 'is-selected' : '', isToday ? 'is-today' : ''].filter(Boolean).join(' ')}
                disabled={disabled || (!allowPast && isPast)} aria-pressed={selected} aria-current={isToday ? 'date' : undefined}
                aria-label={`${toPersianDigits(day.day)} ${MONTH_NAMES[visibleMonth.month - 1]} ${toPersianDigits(visibleMonth.year)}`}
                onClick={() => { onChange(day.dateKey); setOpen(false) }}>
                {toPersianDigits(day.day)}
              </button>
            })}
          </div>
          <div className="admin-jalali-calendar-footer">تاریخ‌ها بر اساس تقویم شمسی و منطقه زمانی ایران هستند.</div>
        </div>
      )}
    </div>
  )
}
