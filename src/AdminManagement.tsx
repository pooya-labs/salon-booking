import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarDays, Check, Clock3, Plus, Save, Scissors, Settings2, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react'

type Service = {
  id: string
  name: string
  description: string
  durationMinutes: number
  priceAmount: number
  priceCurrency: string
  isActive: boolean
  sortOrder: number
}

type TimeInterval = { startsAt: string; endsAt: string }

type WeeklyHour = {
  weekday: number
  name: string
  intervals: TimeInterval[]
  isClosed: boolean
  configured: boolean
}

type ScheduleException = {
  id: string
  date: string
  startsAt: string | null
  endsAt: string | null
  intervals: TimeInterval[]
  isClosed: boolean
  note: string
}

type SalonSettings = {
  timezone: string
  slotIntervalMinutes: number
  minBookingNoticeMinutes: number
  bookingWindowDays: number
  bufferMinutes: number
}

type ApiError = { message?: string }

const emptyService = (): Omit<Service, 'id'> => ({
  name: '',
  description: '',
  durationMinutes: 45,
  priceAmount: 0,
  priceCurrency: 'IRR',
  isActive: true,
  sortOrder: 0,
})

const toPersianDigits = (value: string | number) =>
  String(value).replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])

const moneyLabel = (amount: number, currency: string) =>
  amount > 0 ? `${new Intl.NumberFormat('fa-IR').format(amount)} ${currency}` : 'قیمت توافقی'

const requestError = async (response: Response, fallback: string) => {
  try {
    const payload = await response.json() as ApiError
    return payload.message || fallback
  } catch {
    return fallback
  }
}

export function AdminManagement() {
  const [activeTab, setActiveTab] = useState<'services' | 'schedule'>('services')
  const [services, setServices] = useState<Service[]>([])
  const [serviceDraft, setServiceDraft] = useState<Omit<Service, 'id'> & { id?: string }>(emptyService())
  const [editingService, setEditingService] = useState(false)
  const [servicesLoading, setServicesLoading] = useState(true)
  const [serviceSaving, setServiceSaving] = useState(false)

  const [settings, setSettings] = useState<SalonSettings>({
    timezone: 'unset',
    slotIntervalMinutes: 15,
    minBookingNoticeMinutes: 120,
    bookingWindowDays: 30,
    bufferMinutes: 0,
  })
  const [timezoneDraft, setTimezoneDraft] = useState('unset')
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHour[]>([])
  const [exceptions, setExceptions] = useState<ScheduleException[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [savingWeekday, setSavingWeekday] = useState<number | null>(null)
  const [exceptionSaving, setExceptionSaving] = useState(false)
  const [exceptionDate, setExceptionDate] = useState('')
  const [exceptionClosed, setExceptionClosed] = useState(true)
  const [exceptionIntervals, setExceptionIntervals] = useState<TimeInterval[]>([
    { startsAt: '09:00', endsAt: '17:00' },
  ])
  const [exceptionNote, setExceptionNote] = useState('')
  const [busyException, setBusyException] = useState<string | null>(null)

  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const loadServices = async () => {
    setServicesLoading(true)
    try {
      const response = await fetch('/api/admin/services', {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (response.status === 401) throw new Error('نشست شما منقضی شده است؛ دوباره وارد پنل شوید.')
      if (!response.ok) throw new Error(await requestError(response, 'دریافت فهرست خدمات ممکن نشد.'))
      const payload = await response.json() as { services?: Service[] }
      setServices(Array.isArray(payload.services) ? payload.services : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'ارتباط با سرور برقرار نشد.')
    } finally {
      setServicesLoading(false)
    }
  }

  const loadSchedule = async () => {
    setScheduleLoading(true)
    try {
      const response = await fetch('/api/admin/schedule', {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (response.status === 401) throw new Error('نشست شما منقضی شده است؛ دوباره وارد پنل شوید.')
      if (!response.ok) throw new Error(await requestError(response, 'دریافت برنامه کاری ممکن نشد.'))
      const payload = await response.json() as {
        settings?: SalonSettings
        weeklyHours?: WeeklyHour[]
        exceptions?: ScheduleException[]
      }
      if (payload.settings) {
        setSettings(payload.settings)
        setTimezoneDraft(payload.settings.timezone || 'unset')
      }
      setWeeklyHours(Array.isArray(payload.weeklyHours) ? payload.weeklyHours : [])
      setExceptions(Array.isArray(payload.exceptions) ? payload.exceptions : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'ارتباط با سرور برقرار نشد.')
    } finally {
      setScheduleLoading(false)
    }
  }

  useEffect(() => {
    void loadServices()
    void loadSchedule()
  }, [])

  const saveService = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (serviceSaving) return
    setServiceSaving(true)
    setNotice('')
    setError('')
    try {
      const endpoint = serviceDraft.id
        ? `/api/admin/services/${serviceDraft.id}`
        : '/api/admin/services'
      const response = await fetch(endpoint, {
        method: serviceDraft.id ? 'PATCH' : 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          name: serviceDraft.name,
          description: serviceDraft.description,
          durationMinutes: Number(serviceDraft.durationMinutes),
          priceAmount: Number(serviceDraft.priceAmount),
          priceCurrency: serviceDraft.priceCurrency.toUpperCase(),
          isActive: serviceDraft.isActive,
          sortOrder: Number(serviceDraft.sortOrder),
        }),
      })
      if (!response.ok) throw new Error(await requestError(response, 'ذخیره خدمت انجام نشد.'))
      setNotice(serviceDraft.id ? 'تغییرات خدمت ذخیره شد.' : 'خدمت جدید اضافه شد.')
      setServiceDraft(emptyService())
      setEditingService(false)
      await loadServices()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ذخیره خدمت انجام نشد.')
    } finally {
      setServiceSaving(false)
    }
  }

  const beginEditService = (service: Service) => {
    setServiceDraft({ ...service })
    setEditingService(true)
    setNotice('')
    setError('')
  }

  const toggleService = async (service: Service) => {
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/admin/services/${service.id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ isActive: !service.isActive }),
      })
      if (!response.ok) throw new Error(await requestError(response, 'تغییر وضعیت خدمت انجام نشد.'))
      setNotice(service.isActive ? 'خدمت غیرفعال شد؛ رزروهای قبلی حفظ می‌شوند.' : 'خدمت دوباره فعال شد.')
      await loadServices()
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'تغییر وضعیت خدمت انجام نشد.')
    }
  }

  const changeWeekday = (weekday: number, patch: Partial<WeeklyHour>) => {
    setWeeklyHours((current) => current.map((day) => day.weekday === weekday ? { ...day, ...patch } : day))
  }

  const addIntervalAfter = (intervals: TimeInterval[]): TimeInterval | null => {
    const start = intervals[intervals.length - 1]?.endsAt ?? '09:00'
    const [hours, minutes] = start.split(':').map(Number)
    const startMinutes = hours * 60 + minutes
    const endMinutes = Math.min(startMinutes + 60, 23 * 60 + 59)
    if (endMinutes <= startMinutes) return null
    return {
      startsAt: start,
      endsAt: String(Math.floor(endMinutes / 60)).padStart(2, '0') + ':' + String(endMinutes % 60).padStart(2, '0'),
    }
  }

  const updateWeekdayInterval = (weekday: number, index: number, patch: Partial<TimeInterval>) => {
    setWeeklyHours((current) => current.map((day) => day.weekday !== weekday ? day : ({
      ...day,
      intervals: day.intervals.map((interval, intervalIndex) =>
        intervalIndex === index ? { ...interval, ...patch } : interval,
      ),
    })))
  }

  const addWeekdayInterval = (weekday: number) => {
    setWeeklyHours((current) => current.map((day) => {
      if (day.weekday !== weekday || day.isClosed || day.intervals.length >= 8) return day
      const next = addIntervalAfter(day.intervals)
      return next ? { ...day, intervals: [...day.intervals, next] } : day
    }))
  }

  const removeWeekdayInterval = (weekday: number, index: number) => {
    setWeeklyHours((current) => current.map((day) => day.weekday === weekday
      ? { ...day, intervals: day.intervals.filter((_, intervalIndex) => intervalIndex !== index) }
      : day))
  }

  const updateExceptionInterval = (index: number, patch: Partial<TimeInterval>) => {
    setExceptionIntervals((current) => current.map((interval, intervalIndex) =>
      intervalIndex === index ? { ...interval, ...patch } : interval,
    ))
  }

  const addExceptionInterval = () => {
    if (exceptionIntervals.length >= 8) return
    const next = addIntervalAfter(exceptionIntervals)
    if (next) setExceptionIntervals((current) => [...current, next])
  }

  const removeExceptionInterval = (index: number) => {
    setExceptionIntervals((current) => current.filter((_, intervalIndex) => intervalIndex !== index))
  }

  const saveWeekday = async (day: WeeklyHour) => {
    setSavingWeekday(day.weekday)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/admin/schedule/weekly/${day.weekday}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          isClosed: day.isClosed,
          intervals: day.intervals,
        }),
      })
      if (!response.ok) throw new Error(await requestError(response, 'ذخیره ساعات این روز ممکن نشد.'))
      changeWeekday(day.weekday, { configured: true })
      setNotice(`برنامه ${day.name} ذخیره شد.`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ذخیره برنامه انجام نشد.')
    } finally {
      setSavingWeekday(null)
    }
  }

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (settingsSaving) return
    setSettingsSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          timezone: timezoneDraft.trim() || 'unset',
          slotIntervalMinutes: Number(settings.slotIntervalMinutes),
          minBookingNoticeMinutes: Number(settings.minBookingNoticeMinutes),
          bookingWindowDays: Number(settings.bookingWindowDays),
          bufferMinutes: Number(settings.bufferMinutes),
        }),
      })
      if (!response.ok) throw new Error(await requestError(response, 'ذخیره تنظیمات ممکن نشد.'))
      const payload = await response.json() as { settings?: SalonSettings }
      if (payload.settings) setSettings(payload.settings)
      setTimezoneDraft(payload.settings?.timezone ?? timezoneDraft)
      setNotice('تنظیمات رزرو ذخیره شد.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ذخیره تنظیمات ممکن نشد.')
    } finally {
      setSettingsSaving(false)
    }
  }

  const saveException = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (exceptionSaving) return
    setExceptionSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/schedule/exceptions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          date: exceptionDate,
          isClosed: exceptionClosed,
          intervals: exceptionIntervals,
          note: exceptionNote,
        }),
      })
      if (!response.ok) throw new Error(await requestError(response, 'ثبت استثنای برنامه ممکن نشد.'))
      setExceptionDate('')
      setExceptionClosed(true)
      setExceptionIntervals([{ startsAt: '09:00', endsAt: '17:00' }])
      setExceptionNote('')
      setNotice('استثنای برنامه ذخیره شد.')
      await loadSchedule()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ثبت استثنا انجام نشد.')
    } finally {
      setExceptionSaving(false)
    }
  }

  const deleteException = async (exception: ScheduleException) => {
    if (busyException) return
    setBusyException(exception.id)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/admin/schedule/exceptions/${exception.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error(await requestError(response, 'حذف استثنا ممکن نشد.'))
      setNotice('استثنای برنامه حذف شد.')
      await loadSchedule()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'حذف استثنا انجام نشد.')
    } finally {
      setBusyException(null)
    }
  }

  const tabButton = (key: 'services' | 'schedule', label: string, Icon: typeof Scissors) => (
    <button type="button" className={activeTab === key ? 'admin-manage-tab is-active' : 'admin-manage-tab'} onClick={() => setActiveTab(key)}>
      <Icon size={15} /> {label}
    </button>
  )

  return (
    <section className="admin-management">
      <div className="admin-management-top">
        <div><div className="eyebrow"><span className="eyebrow-line" /> SALON SETTINGS</div><h2>تنظیمات استودیو</h2><p>خدمات و برنامه کاری را بدون تغییر کد مدیریت کنید.</p></div>
        <div className="admin-manage-tabs">
          {tabButton('services', 'خدمات', Scissors)}
          {tabButton('schedule', 'برنامه کاری', CalendarDays)}
        </div>
      </div>

      {notice && <p className="admin-inline-success" role="status"><Check size={15} /> {notice}</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}

      {activeTab === 'services' && (
        <div className="admin-manage-grid">
          <section className="admin-manage-panel">
            <div className="admin-manage-panel-heading"><div><h3>فهرست خدمات</h3><p>خدمت غیرفعال در صفحه رزرو مشتری نمایش داده نمی‌شود.</p></div><button type="button" className="admin-light-button" onClick={() => { setServiceDraft(emptyService()); setEditingService(false) }}><Plus size={14} /> خدمت جدید</button></div>
            {servicesLoading ? <div className="admin-manage-empty">در حال دریافت خدمات…</div> : services.length === 0 ? <div className="admin-manage-empty"><Scissors size={24} /><strong>هنوز خدمتی ثبت نشده است.</strong><span>اولین خدمت را از فرم کنار صفحه اضافه کنید.</span></div> : (
              <div className="admin-service-list">
                {services.map((service) => (
                  <article className={service.isActive ? 'admin-service-row' : 'admin-service-row is-inactive'} key={service.id}>
                    <span className="admin-service-icon"><Scissors size={16} /></span>
                    <div className="admin-service-info"><strong>{service.name}</strong><small>{toPersianDigits(service.durationMinutes)} دقیقه · {moneyLabel(service.priceAmount, service.priceCurrency)}</small><small>{service.description || 'بدون توضیحات'}</small></div>
                    <div className="admin-service-actions"><button type="button" onClick={() => beginEditService(service)}>ویرایش</button><button type="button" className={service.isActive ? 'is-on' : ''} onClick={() => void toggleService(service)} aria-label={service.isActive ? 'غیرفعال کردن خدمت' : 'فعال کردن خدمت'}>{service.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</button></div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="admin-manage-panel">
            <div className="admin-manage-panel-heading"><div><h3>{editingService ? 'ویرایش خدمت' : 'افزودن خدمت'}</h3><p>اطلاعاتی که مشتری در صفحه رزرو می‌بیند.</p></div>{editingService && <button type="button" className="admin-icon-button" onClick={() => { setEditingService(false); setServiceDraft(emptyService()) }} aria-label="لغو ویرایش"><X size={17} /></button>}</div>
            <form className="admin-manage-form" onSubmit={saveService}>
              <label><span>نام خدمت</span><input required minLength={2} maxLength={80} value={serviceDraft.name} onChange={(event) => setServiceDraft((current) => ({ ...current, name: event.target.value }))} placeholder="مثلاً کوتاهی و فرم‌دهی" /></label>
              <label><span>توضیحات کوتاه</span><textarea maxLength={300} rows={2} value={serviceDraft.description} onChange={(event) => setServiceDraft((current) => ({ ...current, description: event.target.value }))} placeholder="توضیح کوتاه درباره این خدمت" /></label>
              <div className="admin-form-two-cols">
                <label><span>مدت (دقیقه)</span><input type="number" required min={5} max={480} step={5} value={serviceDraft.durationMinutes} onChange={(event) => setServiceDraft((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} /></label>
                <label><span>مبلغ</span><input type="number" required min={0} max={2000000000} step={1} value={serviceDraft.priceAmount} onChange={(event) => setServiceDraft((current) => ({ ...current, priceAmount: Number(event.target.value) }))} /></label>
              </div>
              <div className="admin-form-two-cols">
                <label><span>واحد پول (کد سه‌حرفی)</span><input required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" value={serviceDraft.priceCurrency} onChange={(event) => setServiceDraft((current) => ({ ...current, priceCurrency: event.target.value.toUpperCase() }))} placeholder="IRR" /></label>
                <label><span>ترتیب نمایش</span><input type="number" min={0} max={10000} value={serviceDraft.sortOrder} onChange={(event) => setServiceDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))} /></label>
              </div>
              <label className="admin-check-line"><input type="checkbox" checked={serviceDraft.isActive} onChange={(event) => setServiceDraft((current) => ({ ...current, isActive: event.target.checked }))} /><span>این خدمت در صفحه رزرو نمایش داده شود</span></label>
              <button className="button button-dark admin-manage-submit" disabled={serviceSaving}>{serviceSaving ? 'در حال ذخیره…' : editingService ? 'ذخیره تغییرات' : 'افزودن خدمت'} <Save size={15} /></button>
            </form>
          </section>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="admin-schedule-layout">
          <section className="admin-manage-panel">
            <div className="admin-manage-panel-heading"><div><h3>تنظیمات زمان‌بندی</h3><p>منطقه زمانی و قواعد محاسبه نوبت‌ها.</p></div><Settings2 size={19} /></div>
            <form className="admin-manage-form" onSubmit={saveSettings}>
              <label><span>منطقه زمانی استودیو (IANA)</span><input required value={timezoneDraft === 'unset' ? '' : timezoneDraft} onChange={(event) => setTimezoneDraft(event.target.value)} placeholder="مثلاً Europe/Berlin یا Asia/Tehran" dir="ltr" /></label>
              <p className="admin-form-hint">این منطقه زمانی باید با محل واقعی آرایشگاه مطابقت داشته باشد؛ انتخاب آن روی تاریخ و ساعت تمام رزروها اثر می‌گذارد.</p>
              <div className="admin-form-two-cols">
                <label><span>گام زمانی (دقیقه)</span><input type="number" min={5} max={120} step={5} value={settings.slotIntervalMinutes} onChange={(event) => setSettings((current) => ({ ...current, slotIntervalMinutes: Number(event.target.value) }))} /></label>
                <label><span>فاصله بین نوبت‌ها (دقیقه)</span><input type="number" min={0} max={240} step={5} value={settings.bufferMinutes} onChange={(event) => setSettings((current) => ({ ...current, bufferMinutes: Number(event.target.value) }))} /></label>
              </div>
              <div className="admin-form-two-cols">
                <label><span>حداقل فاصله تا رزرو (دقیقه)</span><input type="number" min={0} max={10080} step={15} value={settings.minBookingNoticeMinutes} onChange={(event) => setSettings((current) => ({ ...current, minBookingNoticeMinutes: Number(event.target.value) }))} /></label>
                <label><span>رزرو تا چند روز آینده</span><input type="number" min={1} max={365} value={settings.bookingWindowDays} onChange={(event) => setSettings((current) => ({ ...current, bookingWindowDays: Number(event.target.value) }))} /></label>
              </div>
              <button className="button button-dark admin-manage-submit" disabled={settingsSaving}>{settingsSaving ? 'در حال ذخیره…' : 'ذخیره تنظیمات زمان‌بندی'} <Save size={15} /></button>
            </form>
          </section>

          <section className="admin-manage-panel">
            <div className="admin-manage-panel-heading"><div><h3>ساعات هفتگی</h3><p>برای ذخیره ساعت‌ها ابتدا منطقه زمانی را تنظیم کنید.</p></div><Clock3 size={19} /></div>
            {scheduleLoading ? <div className="admin-manage-empty">در حال دریافت برنامه…</div> : (
              <div className="admin-weekly-list">
                {weeklyHours.map((day) => (
                  <article className={day.isClosed ? 'admin-weekday-row is-closed' : 'admin-weekday-row'} key={day.weekday}>
                    <div className="admin-weekday-name">
                      <strong>{day.name}</strong>
                      <label>
                        <input type="checkbox" checked={!day.isClosed} onChange={(event) => changeWeekday(day.weekday, {
                          isClosed: !event.target.checked,
                          intervals: !event.target.checked && day.intervals.length === 0
                            ? [{ startsAt: '09:00', endsAt: '17:00' }]
                            : day.intervals,
                        })} />
                        <span>{day.isClosed ? 'تعطیل' : 'فعال'}</span>
                      </label>
                    </div>
                    <div className="admin-weekday-hours">
                      {day.intervals.map((interval, index) => (
                        <div className="admin-form-two-cols admin-interval-row" key={index}>
                          <label><span>شروع بازه {toPersianDigits(index + 1)}</span><input type="time" aria-label={`شروع بازه ${index + 1} ${day.name}`} disabled={day.isClosed} value={interval.startsAt} onChange={(event) => updateWeekdayInterval(day.weekday, index, { startsAt: event.target.value })} /></label>
                          <label><span>پایان</span><input type="time" aria-label={`پایان بازه ${index + 1} ${day.name}`} disabled={day.isClosed} value={interval.endsAt} onChange={(event) => updateWeekdayInterval(day.weekday, index, { endsAt: event.target.value })} /></label>
                          {day.intervals.length > 1 && <button type="button" className="admin-icon-button" aria-label="حذف بازه" onClick={() => removeWeekdayInterval(day.weekday, index)}><Trash2 size={14} /></button>}
                        </div>
                      ))}
                      {!day.isClosed && day.intervals.length === 0 && <p className="admin-form-hint">برای این روز هنوز بازه‌ای ثبت نشده است.</p>}
                      <button type="button" className="admin-light-button" disabled={day.isClosed || day.intervals.length >= 8} onClick={() => addWeekdayInterval(day.weekday)}><Plus size={13} /> افزودن بازه</button>
                    </div>
                    <button type="button" className="admin-save-day" disabled={savingWeekday === day.weekday} onClick={() => void saveWeekday(day)}>{savingWeekday === day.weekday ? '…' : <Save size={14} />} ذخیره</button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="admin-manage-panel admin-exceptions-panel">
            <div className="admin-manage-panel-heading"><div><h3>تعطیلات و ساعت‌های استثنایی</h3><p>تعطیلی یا ساعت متفاوت برای یک تاریخ خاص.</p></div><CalendarDays size={19} /></div>
            <form className="admin-exception-form" onSubmit={saveException}>
              <label><span>تاریخ</span><input type="date" required value={exceptionDate} onChange={(event) => setExceptionDate(event.target.value)} /></label>
              <label className="admin-check-line"><input type="checkbox" checked={exceptionClosed} onChange={(event) => setExceptionClosed(event.target.checked)} /><span>این روز کاملاً تعطیل است</span></label>
              {!exceptionClosed && (
                <div className="admin-exception-intervals">
                  {exceptionIntervals.map((interval, index) => (
                    <div className="admin-form-two-cols admin-interval-row" key={index}>
                      <label><span>شروع بازه {toPersianDigits(index + 1)}</span><input type="time" required value={interval.startsAt} onChange={(event) => updateExceptionInterval(index, { startsAt: event.target.value })} /></label>
                      <label><span>پایان</span><input type="time" required value={interval.endsAt} onChange={(event) => updateExceptionInterval(index, { endsAt: event.target.value })} /></label>
                      {exceptionIntervals.length > 1 && <button type="button" className="admin-icon-button" aria-label="حذف بازه" onClick={() => removeExceptionInterval(index)}><Trash2 size={14} /></button>}
                    </div>
                  ))}
                  <button type="button" className="admin-light-button" disabled={exceptionIntervals.length >= 8} onClick={addExceptionInterval}><Plus size={13} /> افزودن بازه</button>
                </div>
              )}
              <label><span>توضیحات (اختیاری)</span><input maxLength={160} value={exceptionNote} onChange={(event) => setExceptionNote(event.target.value)} placeholder="مثلاً تعطیلی رسمی یا ساعت کاری ویژه" /></label>
              <button className="button button-dark admin-manage-submit" disabled={exceptionSaving || settings.timezone === 'unset'}>{exceptionSaving ? 'در حال ذخیره…' : 'ثبت استثنای برنامه'} <Plus size={15} /></button>
            </form>
            <div className="admin-exception-list">
              {exceptions.length === 0 ? <p className="admin-manage-empty">هنوز تعطیلی یا ساعت استثنایی ثبت نشده است.</p> : exceptions.map((exception) => (
                <article className="admin-exception-row" key={exception.id}>
                  <div><strong dir="ltr">{exception.date}</strong><small>{exception.isClosed ? 'تعطیل' : exception.intervals.map((interval) => `${interval.startsAt} تا ${interval.endsAt}`).join('، ')}{exception.note ? ` · ${exception.note}` : ''}</small></div>
                  <button type="button" aria-label="حذف استثنا" disabled={busyException === exception.id} onClick={() => void deleteException(exception)}><Trash2 size={15} /></button>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
