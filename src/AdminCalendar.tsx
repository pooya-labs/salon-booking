import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Check, ChevronLeft, ChevronRight, Clock3, LockKeyhole, RefreshCw, Unlock, X } from 'lucide-react'
import { JalaliDatePicker } from './JalaliDatePicker'
import { formatJalaliDate, getIranTodayDateKey } from './jalali-date'
import { availableBlockDurations, buildDaySlots, type TimeRange } from './day-schedule'

type DayBooking = {
  id: string
  time: string
  endTime: string
  status: 'pending' | 'confirmed' | 'completed' | 'no_show'
  serviceName: string
  durationMinutes: number
}
type DayBlock = {
  id: string
  time: string
  endTime: string
  durationMinutes: number
}
type DaySchedule = {
  date: string
  timezone: string
  slotIntervalMinutes: number
  workingIntervals: TimeRange[]
  bookings: DayBooking[]
  blocks: DayBlock[]
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]
const toFa = (value: string | number) => String(value).replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])
const shiftDate = (dateKey: string, amount: number) => {
  const date = new Date(dateKey + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}
const statusLabel = (status: DayBooking['status']) => ({ pending: 'در انتظار تأیید', confirmed: 'تأییدشده', completed: 'انجام‌شده', no_show: 'عدم مراجعه' })[status]

export function AdminCalendar({ slotIntervalMinutes }: { slotIntervalMinutes: number }) {
  const [date, setDate] = useState(getIranTodayDateKey)
  const [schedule, setSchedule] = useState<DaySchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [duration, setDuration] = useState(60)
  const [savingBlock, setSavingBlock] = useState(false)
  const [removingBlock, setRemovingBlock] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadDay = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/day-schedule?date=${encodeURIComponent(date)}`, {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
        signal,
      })
      const payload = await response.json() as DaySchedule & { ok?: boolean; message?: string }
      if (!response.ok) throw new Error(payload.message || 'دریافت برنامه روز ممکن نشد.')
      setSchedule(payload)
    } catch (loadError) {
      if (signal?.aborted) return
      setError(loadError instanceof Error ? loadError.message : 'دریافت برنامه روز ممکن نشد.')
      setSchedule(null)
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [date])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setSelectedTime(null)
    void loadDay(controller.signal)
    return () => controller.abort()
  }, [date, loadDay])

  const bookings = schedule?.bookings ?? []
  const blocks = schedule?.blocks ?? []
  const intervals = schedule?.workingIntervals ?? []
  const step = schedule?.slotIntervalMinutes ?? slotIntervalMinutes
  const slots = useMemo(
    () => buildDaySlots(intervals, step, bookings, blocks),
    [intervals, step, bookings, blocks],
  )
  const availableDurations = selectedTime && schedule
    ? availableBlockDurations(date, selectedTime, DURATION_OPTIONS, intervals, bookings, blocks)
    : []
  const selectedEnd = selectedTime
    ? (() => {
        const [hour, minute] = selectedTime.split(':').map(Number)
        const total = hour * 60 + minute + duration
        return total <= 1440 ? `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` : ''
      })()
    : ''

  const selectTime = (time: string) => {
    setSelectedTime(time)
    setError('')
    const options = schedule
      ? availableBlockDurations(date, time, DURATION_OPTIONS, intervals, bookings, blocks)
      : []
    setDuration(options.includes(60) ? 60 : options[options.length - 1] ?? 15)
  }

  const confirmBlock = async () => {
    if (!selectedTime || !availableDurations.includes(duration) || savingBlock) return
    setSavingBlock(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/admin/time-blocks', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ date, time: selectedTime, durationMinutes: duration }),
      })
      const payload = await response.json() as { message?: string }
      if (!response.ok) throw new Error(payload.message || 'مسدود کردن زمان انجام نشد.')
      setMessage(`زمان ${toFa(selectedTime)} تا ${toFa(selectedEnd)} مسدود شد.`)
      setSelectedTime(null)
      await loadDay()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'مسدود کردن زمان انجام نشد.')
    } finally {
      setSavingBlock(false)
    }
  }

  const deleteBlock = async (block: DayBlock) => {
    if (removingBlock) return
    setRemovingBlock(block.id)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/admin/time-blocks/${block.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      const payload = await response.json() as { message?: string }
      if (!response.ok) throw new Error(payload.message || 'رفع مسدودی انجام نشد.')
      setMessage(`محدودیت ساعت ${toFa(block.time)} برداشته شد.`)
      setConfirmRemoveId(null)
      await loadDay()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'رفع مسدودی انجام نشد.')
    } finally {
      setRemovingBlock(null)
    }
  }

  const availableCount = slots.filter(slot => slot.state === 'free' && availableBlockDurations(date, slot.time, DURATION_OPTIONS, intervals, bookings, blocks).length > 0).length
  const bookedCount = bookings.length
  const dateTitle = formatJalaliDate(date)

  return (
    <section className="admin-calendar">
      <div className="admin-calendar-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> DAILY APPOINTMENT MAP</div>
          <h3>تقویم رزرو و زمان‌های آزاد</h3>
          <p>نوبت‌های مشتری و زمان‌های مسدودشده را یک‌جا ببین؛ برای بستن یک زمان آزاد فقط انتخاب و تأیید لازم است.</p>
        </div>
        <button type="button" className="admin-refresh" onClick={() => void loadDay()} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'is-spinning' : ''} /> به‌روزرسانی
        </button>
      </div>

      <div className="admin-calendar-toolbar">
        <button type="button" aria-label="روز قبل" onClick={() => setDate(current => shiftDate(current, -1))}><ChevronRight size={17} /></button>
        <div className="admin-calendar-selected-date">
          <JalaliDatePicker label="روز موردنظر" value={date} onChange={setDate} />
          <strong>{dateTitle}</strong>
        </div>
        <button type="button" aria-label="روز بعد" onClick={() => setDate(current => shiftDate(current, 1))}><ChevronLeft size={17} /></button>
        <button type="button" className="admin-calendar-today" onClick={() => setDate(getIranTodayDateKey())}>امروز</button>
      </div>

      <div className="admin-calendar-stats">
        <article><span className="admin-calendar-stat-dot is-booked" /><div><strong>{toFa(bookedCount)}</strong><small>نوبت فعال</small></div></article>
        <article><span className="admin-calendar-stat-dot is-blocked" /><div><strong>{toFa(blocks.length)}</strong><small>زمان مسدودشده</small></div></article>
        <article><span className="admin-calendar-stat-dot is-free" /><div><strong>{toFa(availableCount)}</strong><small>بازه آزاد {toFa(step)} دقیقه‌ای</small></div></article>
      </div>

      {message && <p className="admin-inline-success" role="status"><Check size={15} /> {message}</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}

      {loading ? <div className="admin-manage-empty">در حال دریافت تقویم روز…</div> : !schedule ? (
        <div className="admin-manage-empty">برنامه‌ی این روز دریافت نشد. به‌روزرسانی را بزن.</div>
      ) : intervals.length === 0 ? (
        <div className="admin-calendar-closed"><CalendarClock size={25} /><strong>این روز در برنامه‌ی کاری تعطیل است.</strong><span>برای باز کردن روز، ساعات هفتگی یا استثناهای برنامه را ویرایش کن.</span></div>
      ) : (
        <>
          <div className="admin-calendar-legend" aria-label="راهنمای وضعیت زمان‌ها">
            <span><i className="is-free" /> آزاد</span>
            <span><i className="is-booked" /> نوبت مشتری</span>
            <span><i className="is-blocked" /> مسدودشده توسط مدیر</span>
          </div>
          <div className="admin-day-timeline-list">
            {intervals.map((interval, index) => {
              const windowSlots = slots.filter(slot => slot.time >= interval.startsAt && slot.time < interval.endsAt)
              return (
                <section className="admin-day-window" key={`${interval.startsAt}-${index}`}>
                  <header><strong>{toFa(interval.startsAt)} تا {toFa(interval.endsAt)}</strong><small>{toFa(windowSlots.length)} بازه‌ی زمانی</small></header>
                  <div className="admin-day-slot-grid">
                    {windowSlots.map(slot => {
                      const isSelected = selectedTime === slot.time
                      const today = getIranTodayDateKey()
                      const currentParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
                      const currentClock = currentParts.filter(part => part.type === 'hour' || part.type === 'minute').map(part => part.value).join(':')
                      const isPast = date < today || (date === today && slot.time <= currentClock)
                      const canBlock = !isPast && slot.state === 'free' && availableBlockDurations(date, slot.time, DURATION_OPTIONS, intervals, bookings, blocks).length > 0
                      const label = slot.state === 'free' ? 'آزاد' : slot.state === 'booked' ? 'نوبت' : 'مسدود'
                      return (
                        <button type="button" key={slot.time} disabled={!canBlock}
                          className={['admin-day-slot', `is-${slot.state}`, isSelected ? 'is-selected' : ''].filter(Boolean).join(' ')}
                          aria-label={`${toFa(slot.time)} · ${slot.title}`}
                          aria-pressed={isSelected}
                          onClick={() => selectTime(slot.time)}>
                          <strong dir="ltr">{slot.time}</strong><small>{label}</small>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>

          {selectedTime && (
            <section className="admin-block-confirm">
              <div className="admin-block-confirm-copy">
                <span className="admin-block-confirm-icon"><LockKeyhole size={18} /></span>
                <div><strong>مسدود کردن {toFa(selectedTime)} تا {toFa(selectedEnd || '—')}</strong><small>این زمان از رزرو آنلاین حذف می‌شود؛ هیچ نام، شماره یا رزرو مشتری ساخته نخواهد شد.</small></div>
                <button type="button" className="admin-icon-button" aria-label="بستن تأیید" onClick={() => setSelectedTime(null)}><X size={16} /></button>
              </div>
              <div className="admin-block-duration">
                <span>مدت مسدودسازی</span>
                <div>{DURATION_OPTIONS.map(option => (
                  <button type="button" key={option} disabled={!availableDurations.includes(option)}
                    className={duration === option ? 'is-selected' : ''}
                    onClick={() => setDuration(option)}>{toFa(option)} دقیقه</button>
                ))}</div>
              </div>
              <button type="button" className="button button-dark admin-block-confirm-submit" disabled={savingBlock || !availableDurations.includes(duration)} onClick={() => void confirmBlock()}>
                {savingBlock ? 'در حال ثبت…' : 'تأیید و مسدود کردن زمان'} <Check size={16} />
              </button>
            </section>
          )}

          <section className="admin-calendar-lists">
            <div className="admin-calendar-list-panel">
              <header><h4>نوبت‌های مشتری</h4><span>{toFa(bookings.length)}</span></header>
              {bookings.length === 0 ? <p>برای این روز نوبت فعالی ثبت نشده است.</p> : bookings.map(booking => (
                <article key={booking.id}><time dir="ltr">{booking.time}–{booking.endTime}</time><div><strong>{booking.serviceName}</strong><small>{statusLabel(booking.status)} · {toFa(booking.durationMinutes)} دقیقه</small></div></article>
              ))}
            </div>
            <div className="admin-calendar-list-panel">
              <header><h4>زمان‌های مسدودشده</h4><span>{toFa(blocks.length)}</span></header>
              {blocks.length === 0 ? <p>زمان دستی مسدودشده‌ای وجود ندارد.</p> : blocks.map(block => (
                <article key={block.id}><time dir="ltr">{block.time}–{block.endTime}</time><div><strong>بسته‌شده توسط مدیر</strong><small>{toFa(block.durationMinutes)} دقیقه</small></div>
                  {confirmRemoveId === block.id ? (
                    <span className="admin-block-remove-confirm"><button type="button" onClick={() => void deleteBlock(block)} disabled={removingBlock === block.id}>{removingBlock === block.id ? '…' : 'تأیید'}</button><button type="button" onClick={() => setConfirmRemoveId(null)}>انصراف</button></span>
                  ) : <button type="button" className="admin-block-remove" onClick={() => setConfirmRemoveId(block.id)} aria-label={`رفع مسدودی ${block.time}`}><Unlock size={15} /></button>}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  )
}
