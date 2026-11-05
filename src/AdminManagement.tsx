import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarDays, Check, Clock3, Bell, Mail, Phone, Plus, Save, Scissors, Settings2, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react'
import { listenForOwnerPushMessages, registerOwnerPushDevice } from './push-notifications'
import { JalaliDatePicker } from './JalaliDatePicker'
import { formatJalaliDate } from './jalali-date'
import { nextAvailableInterval } from './schedule-intervals'

type Service = {
  id: string
  name: string
  description: string
  category: string
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
  category: 'عمومی',
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

export function AdminManagement({ onBookingCreated }: { onBookingCreated?: () => void }) {
  const [activeTab, setActiveTab] = useState<'services' | 'schedule' | 'phone-booking' | 'notifications'>('services')
  const [services, setServices] = useState<Service[]>([])
  const [serviceDraft, setServiceDraft] = useState<Omit<Service, 'id'> & { id?: string }>(emptyService())
  const [editingService, setEditingService] = useState(false)
  const [servicesLoading, setServicesLoading] = useState(true)
  const [serviceSaving, setServiceSaving] = useState(false)

  const [settings, setSettings] = useState<SalonSettings>({
    timezone: 'Asia/Tehran',
    slotIntervalMinutes: 15,
    minBookingNoticeMinutes: 120,
    bookingWindowDays: 30,
    bufferMinutes: 0,
  })
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

  const [manualDraft, setManualDraft] = useState({ serviceId: '', date: '', time: '', firstName: '', lastName: '', phone: '', note: '' })
  const [manualSlots, setManualSlots] = useState<string[]>([])
  const [manualSlotsLoading, setManualSlotsLoading] = useState(false)
  const [manualSlotsMessage, setManualSlotsMessage] = useState('')
  const [manualSaving, setManualSaving] = useState(false)
  const [manualBookingReference, setManualBookingReference] = useState('')

  const [notificationSettings, setNotificationSettings] = useState({ emailEnabled: false, firebaseProjectId: '', pushDeviceCount: 0, pushReady: false })
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsSaving, setNotificationsSaving] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushListenerRevision, setPushListenerRevision] = useState(0)

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
      const loaded = Array.isArray(payload.services) ? payload.services : []
      setServices(loaded)
      setManualDraft((current) => current.serviceId || !loaded.some((service) => service.isActive)
        ? current
        : { ...current, serviceId: loaded.find((service) => service.isActive)!.id })
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
        setSettings({ ...payload.settings, timezone: 'Asia/Tehran' })
      }
      setWeeklyHours(Array.isArray(payload.weeklyHours) ? payload.weeklyHours : [])
      setExceptions(Array.isArray(payload.exceptions) ? payload.exceptions : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'ارتباط با سرور برقرار نشد.')
    } finally {
      setScheduleLoading(false)
    }
  }

  const loadNotifications = async () => {
    setNotificationsLoading(true)
    try {
      const response = await fetch('/api/admin/notifications', { credentials: 'same-origin', headers: { accept: 'application/json' } })
      if (response.status === 401) throw new Error('نشست شما منقضی شده است؛ دوباره وارد پنل شوید.')
      if (!response.ok) throw new Error(await requestError(response, 'دریافت تنظیمات اعلان ممکن نشد.'))
      const payload = await response.json() as { emailEnabled?: boolean; firebaseProjectId?: string; pushDeviceCount?: number; pushReady?: boolean }
      setNotificationSettings({
        emailEnabled: payload.emailEnabled === true,
        firebaseProjectId: payload.firebaseProjectId || '',
        pushDeviceCount: Number(payload.pushDeviceCount || 0),
        pushReady: payload.pushReady === true,
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'دریافت تنظیمات اعلان ممکن نشد.')
    } finally {
      setNotificationsLoading(false)
    }
  }

  useEffect(() => {
    void loadServices()
    void loadSchedule()
    void loadNotifications()
  }, [])

  useEffect(() => {
    let unsubscribe: () => void = () => {}
    let active = true
    void listenForOwnerPushMessages().then((stop) => {
      if (active) unsubscribe = stop
      else stop()
    })
    return () => { active = false; unsubscribe() }
  }, [pushListenerRevision])

  useEffect(() => {
    if (!manualDraft.serviceId || !manualDraft.date) {
      setManualSlots([])
      setManualSlotsMessage('')
      setManualSlotsLoading(false)
      return
    }
    const controller = new AbortController()
    const loadManualSlots = async () => {
      setManualSlotsLoading(true)
      setManualSlotsMessage('')
      setManualSlots([])
      try {
        const params = new URLSearchParams({ date: manualDraft.date, serviceId: manualDraft.serviceId })
        const response = await fetch(`/api/admin/availability?${params.toString()}`, {
          credentials: 'same-origin', headers: { accept: 'application/json' }, signal: controller.signal,
        })
        if (response.status === 401) throw new Error('نشست شما منقضی شده است؛ دوباره وارد پنل شوید.')
        if (!response.ok) throw new Error(await requestError(response, 'دریافت ساعت‌های آزاد ممکن نشد.'))
        const payload = await response.json() as { slots?: string[] }
        if (!controller.signal.aborted) setManualSlots(Array.isArray(payload.slots) ? payload.slots : [])
      } catch (slotError) {
        if (!controller.signal.aborted) setManualSlotsMessage(slotError instanceof Error ? slotError.message : 'دریافت ساعت‌های آزاد ممکن نشد.')
      } finally {
        if (!controller.signal.aborted) setManualSlotsLoading(false)
      }
    }
    void loadManualSlots()
    return () => controller.abort()
  }, [manualDraft.serviceId, manualDraft.date])

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
          category: serviceDraft.category,
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

  const updateWeekdayInterval = (weekday: number, index: number, patch: Partial<TimeInterval>) => {
    setWeeklyHours((current) => current.map((day) => day.weekday !== weekday ? day : ({
      ...day,
      intervals: day.intervals.map((interval, intervalIndex) =>
        intervalIndex === index ? { ...interval, ...patch } : interval,
      ),
    })))
  }

  const addWeekdayInterval = (weekday: number) => {
    const day = weeklyHours.find((item) => item.weekday === weekday)
    if (!day || day.intervals.length >= 8) return
    const next = nextAvailableInterval(day.intervals)
    if (!next) {
      setError('برای این روز فضای خالی کافی جهت افزودن بازه وجود ندارد.')
      return
    }
    setError('')
    changeWeekday(weekday, {
      isClosed: false,
      intervals: [...day.intervals, next].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    })
    setNotice('بازه جدید اضافه شد؛ برای ثبت نهایی، برنامه همین روز را ذخیره کن.')
  }

  const removeWeekdayInterval = (weekday: number, index: number) => {
    setWeeklyHours((current) => current.map((day) => {
      if (day.weekday !== weekday) return day
      const intervals = day.intervals.filter((_, intervalIndex) => intervalIndex !== index)
      return { ...day, intervals, isClosed: intervals.length === 0 }
    }))
  }

  const updateExceptionInterval = (index: number, patch: Partial<TimeInterval>) => {
    setExceptionIntervals((current) => current.map((interval, intervalIndex) =>
      intervalIndex === index ? { ...interval, ...patch } : interval,
    ))
  }

  const addExceptionInterval = () => {
    if (exceptionIntervals.length >= 8) return
    const next = nextAvailableInterval(exceptionIntervals)
    if (!next) {
      setError('برای این تاریخ فضای خالی کافی جهت افزودن بازه وجود ندارد.')
      return
    }
    setError('')
    setExceptionIntervals((current) => [...current, next].sort((a, b) => a.startsAt.localeCompare(b.startsAt)))
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
          timezone: 'Asia/Tehran',
          slotIntervalMinutes: Number(settings.slotIntervalMinutes),
          minBookingNoticeMinutes: Number(settings.minBookingNoticeMinutes),
          bookingWindowDays: Number(settings.bookingWindowDays),
          bufferMinutes: Number(settings.bufferMinutes),
        }),
      })
      if (!response.ok) throw new Error(await requestError(response, 'ذخیره تنظیمات ممکن نشد.'))
      const payload = await response.json() as { settings?: SalonSettings }
      if (payload.settings) setSettings({ ...payload.settings, timezone: 'Asia/Tehran' })
      setNotice('تنظیمات رزرو ذخیره شد.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ذخیره تنظیمات ممکن نشد.')
    } finally {
      setSettingsSaving(false)
    }
  }

  const saveManualBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (manualSaving) return
    if (!manualDraft.date) {
      setError('لطفاً تاریخ نوبت را از تقویم شمسی انتخاب کن.')
      return
    }
    setManualSaving(true)
    setError('')
    setNotice('')
    setManualBookingReference('')
    try {
      const response = await fetch('/api/admin/bookings', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          serviceId: manualDraft.serviceId, date: manualDraft.date, time: manualDraft.time,
          firstName: manualDraft.firstName, lastName: manualDraft.lastName,
          phone: manualDraft.phone, note: manualDraft.note,
        }),
      })
      if (!response.ok) throw new Error(await requestError(response, 'ثبت نوبت تلفنی انجام نشد.'))
      const payload = await response.json() as { booking?: { reference?: string } }
      if (!payload.booking?.reference) throw new Error('نوبت ثبت شد، اما کد پیگیری دریافت نشد.')
      setManualBookingReference(payload.booking.reference)
      setNotice('نوبت تلفنی ثبت و زمان آن برای رزرو آنلاین مسدود شد.')
      setManualSlots((current) => current.filter((slot) => slot !== manualDraft.time))
      setManualDraft((current) => ({ ...current, time: '', firstName: '', lastName: '', phone: '', note: '' }))
      await loadServices()
      onBookingCreated?.()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ثبت نوبت تلفنی انجام نشد.')
    } finally {
      setManualSaving(false)
    }
  }

  const saveNotifications = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotificationsSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          emailEnabled: notificationSettings.emailEnabled,
          firebaseProjectId: notificationSettings.firebaseProjectId.trim(),
        }),
      })
      if (!response.ok) throw new Error(await requestError(response, 'ذخیره تنظیمات اعلان انجام نشد.'))
      const payload = await response.json() as { emailEnabled?: boolean; firebaseProjectId?: string; pushDeviceCount?: number; pushReady?: boolean }
      setNotificationSettings((current) => ({ ...current,
        emailEnabled: payload.emailEnabled === true,
        firebaseProjectId: payload.firebaseProjectId || '',
        pushDeviceCount: Number(payload.pushDeviceCount || 0),
        pushReady: payload.pushReady === true,
      }))
      setNotice('تنظیمات اعلان ذخیره شد.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ذخیره تنظیمات اعلان انجام نشد.')
    } finally {
      setNotificationsSaving(false)
    }
  }

  const enablePushNotifications = async () => {
    setPushBusy(true)
    setError('')
    setNotice('')
    try {
      await registerOwnerPushDevice()
      setPushListenerRevision((current) => current + 1)
      await loadNotifications()
      setNotice('این دستگاه برای دریافت اعلان رزرو ثبت شد.')
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : 'فعال‌سازی اعلان گوشی انجام نشد.')
    } finally {
      setPushBusy(false)
    }
  }

  const sendPushTest = async () => {
    setPushBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/notifications/test', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' }, body: '{}',
      })
      if (!response.ok) throw new Error(await requestError(response, 'ارسال اعلان آزمایشی ممکن نشد.'))
      setNotice('اعلان آزمایشی ارسال شد؛ نمایش آن را روی گوشی بررسی کن.')
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : 'ارسال اعلان آزمایشی ممکن نشد.')
    } finally {
      setPushBusy(false)
    }
  }

  const saveException = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (exceptionSaving) return
    if (!exceptionDate) {
      setError('لطفاً تاریخ را از تقویم شمسی انتخاب کن.')
      return
    }
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

  const tabButton = (key: 'services' | 'schedule' | 'phone-booking' | 'notifications', label: string, Icon: typeof Scissors) => (
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
          {tabButton('phone-booking', 'رزرو تلفنی', Phone)}
          {tabButton('notifications', 'اعلان‌ها', Bell)}
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
                    <div className="admin-service-info"><strong>{service.name}</strong><small>نوع: {service.category || 'عمومی'} · {toPersianDigits(service.durationMinutes)} دقیقه · {moneyLabel(service.priceAmount, service.priceCurrency)}</small><small>{service.description || 'بدون توضیحات'}</small></div>
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
              <label><span>نوع / دسته خدمت</span><input required maxLength={40} value={serviceDraft.category} onChange={(event) => setServiceDraft((current) => ({ ...current, category: event.target.value }))} placeholder="مثلاً کوتاهی، رنگ مو، ناخن" /></label>
              <label><span>توضیحات کوتاه</span><textarea maxLength={300} rows={3} value={serviceDraft.description} onChange={(event) => setServiceDraft((current) => ({ ...current, description: event.target.value }))} placeholder="توضیح کوتاه درباره این خدمت" /></label>
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

      {activeTab === 'phone-booking' && (
        <div className="admin-manage-grid admin-phone-booking-layout">
          <section className="admin-manage-panel">
            <div className="admin-manage-panel-heading"><div><h3>ثبت نوبت تلفنی</h3><p>اطلاعات تماس را از مشتری بگیر و ساعت را از طرف سالن قطعی کن.</p></div><Phone size={19} /></div>
            <form className="admin-manage-form" onSubmit={saveManualBooking}>
              <label><span>خدمت</span><select required value={manualDraft.serviceId} onChange={(event) => setManualDraft((current) => ({ ...current, serviceId: event.target.value, time: '' }))}>
                <option value="">انتخاب خدمت</option>
                {services.filter((service) => service.isActive).map((service) => <option key={service.id} value={service.id}>{service.name} · {service.durationMinutes} دقیقه</option>)}
              </select></label>
              <JalaliDatePicker label="تاریخ نوبت" value={manualDraft.date} onChange={(date) => setManualDraft((current) => ({ ...current, date, time: '' }))} />
              <label><span>ساعت‌های آزاد همان روز</span><select required value={manualDraft.time} disabled={!manualDraft.date || !manualDraft.serviceId || manualSlotsLoading || manualSlots.length === 0} onChange={(event) => setManualDraft((current) => ({ ...current, time: event.target.value }))}>
                <option value="">{manualSlotsLoading ? 'در حال بررسی ساعت‌ها…' : 'انتخاب ساعت آزاد'}</option>
                {manualSlots.map((time) => <option key={time} value={time}>{toPersianDigits(time)}</option>)}
              </select></label>
              {manualSlotsMessage && <p className="admin-error" role="alert">{manualSlotsMessage}</p>}
              {manualDraft.date && manualDraft.serviceId && !manualSlotsLoading && !manualSlotsMessage && manualSlots.length === 0 && <p className="admin-form-hint">برای این خدمت در این تاریخ ساعت آزادی وجود ندارد.</p>}
              <div className="admin-form-two-cols">
                <label><span>نام</span><input required minLength={2} maxLength={80} value={manualDraft.firstName} onChange={(event) => setManualDraft((current) => ({ ...current, firstName: event.target.value }))} placeholder="نام مشتری" /></label>
                <label><span>نام خانوادگی</span><input required minLength={2} maxLength={80} value={manualDraft.lastName} onChange={(event) => setManualDraft((current) => ({ ...current, lastName: event.target.value }))} placeholder="نام خانوادگی" /></label>
              </div>
              <label><span>شماره تماس</span><input required inputMode="tel" maxLength={24} value={manualDraft.phone} onChange={(event) => setManualDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="مثلاً ۰۹۱۲..." dir="ltr" /></label>
              <label><span>یادداشت (اختیاری)</span><textarea maxLength={500} rows={2} value={manualDraft.note} onChange={(event) => setManualDraft((current) => ({ ...current, note: event.target.value }))} placeholder="هماهنگی تلفنی یا درخواست مشتری…" /></label>
              <div className="admin-manual-booking-hint"><Check size={16} /><span>نوبت بلافاصله تأیید می‌شود و همان بازه از رزرو آنلاین حذف خواهد شد.</span></div>
              <button className="button button-dark admin-manage-submit" disabled={manualSaving || manualSlotsLoading || !manualSlots.includes(manualDraft.time)}>{manualSaving ? 'در حال ثبت…' : 'ثبت نوبت تلفنی و رزرو ساعت'} <Save size={15} /></button>
            </form>
          </section>
          <section className="admin-manage-panel admin-manual-booking-side">
            <div className="admin-manage-panel-heading"><div><h3>قواعد رزرو دستی</h3><p>همه رزروها در یک تقویم و یک دیتابیس ثبت می‌شوند.</p></div><CalendarDays size={19} /></div>
            <ul>
              <li>ساعت آزاد بر اساس بازه کاری، مدت خدمت، فاصله بین نوبت‌ها و رزروهای فعال محاسبه می‌شود.</li>
              <li>محدودیت حداقل زمان اطلاع‌رسانی آنلاین برای رزرو تلفنی اعمال نمی‌شود؛ اما زمان گذشته قابل رزرو نیست.</li>
              <li>ثبت نهایی زیر قفل مشترک انجام می‌شود تا مشتری آنلاین و مدیر نتوانند هم‌زمان یک ساعت را بگیرند.</li>
            </ul>
            {manualBookingReference && <div className="admin-manual-booking-result" role="status"><strong>نوبت ثبت شد</strong><span>کد پیگیری: <b dir="ltr">{manualBookingReference}</b></span></div>}
          </section>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="admin-manage-grid admin-notification-layout">
          <section className="admin-manage-panel">
            <div className="admin-manage-panel-heading"><div><h3>اعلان روی گوشی مدیر</h3><p>بعد از ثبت نوبت آنلاین یا تلفنی، اعلان مستقیم روی همین دستگاه ارسال می‌شود.</p></div><Bell size={19} /></div>
            <div className="admin-notification-status"><strong>{notificationSettings.pushReady ? 'اعلان گوشی آماده است' : 'اعلان گوشی هنوز راه‌اندازی نشده'}</strong><span>{toPersianDigits(notificationSettings.pushDeviceCount)} دستگاه ثبت‌شده</span></div>
            <p className="admin-form-hint">برای فعال‌سازی باید تنظیمات رایگان Firebase Web Push در GitHub و Google Apps Script یک‌بار تکمیل شود. سپس این دکمه اجازه اعلان را از همین گوشی می‌گیرد.</p>
            <div className="admin-notification-actions">
              <button type="button" className="button button-dark" disabled={pushBusy} onClick={() => void enablePushNotifications()}>{pushBusy ? 'در حال فعال‌سازی…' : 'فعال‌کردن اعلان این گوشی'} <Bell size={15} /></button>
              <button type="button" className="admin-light-button" disabled={pushBusy || !notificationSettings.pushReady} onClick={() => void sendPushTest()}>ارسال اعلان آزمایشی</button>
            </div>
          </section>
          <section className="admin-manage-panel">
            <div className="admin-manage-panel-heading"><div><h3>تنظیمات ایمیل</h3><p>اعلان ایمیل لازم نیست روشن باشد؛ پیش‌فرض خاموش است.</p></div><Mail size={19} /></div>
            <form className="admin-manage-form" onSubmit={saveNotifications}>
              <label><span>شناسه پروژه Firebase</span><input value={notificationSettings.firebaseProjectId} onChange={(event) => setNotificationSettings((current) => ({ ...current, firebaseProjectId: event.target.value.trim() }))} placeholder="firebase-project-id" dir="ltr" /></label>
              <label className="admin-check-line"><input type="checkbox" checked={notificationSettings.emailEnabled} onChange={(event) => setNotificationSettings((current) => ({ ...current, emailEnabled: event.target.checked }))} /><span>ارسال ایمیل برای هر نوبت {notificationSettings.emailEnabled ? 'فعال' : 'خاموش'}</span></label>
              <p className="admin-form-hint">برای اعلان گوشی، شناسه پروژه باید با تنظیمات Firebase وب‌اپ و متغیرهای GitHub Actions یکسان باشد. کلید خصوصی Firebase هرگز در این پنل وارد نمی‌شود.</p>
              <button className="button button-dark admin-manage-submit" disabled={notificationsSaving || notificationsLoading}>{notificationsSaving ? 'در حال ذخیره…' : 'ذخیره تنظیمات اعلان'} <Save size={15} /></button>
            </form>
          </section>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="admin-schedule-layout">
          <section className="admin-manage-panel">
            <div className="admin-manage-panel-heading"><div><h3>تنظیمات زمان‌بندی</h3><p>منطقه زمانی و قواعد محاسبه نوبت‌ها.</p></div><Settings2 size={19} /></div>
            <form className="admin-manage-form" onSubmit={saveSettings}>
              <div className="admin-fixed-timezone"><span>منطقه زمانی استودیو</span><strong>ایران · تهران</strong><small dir="ltr">Asia/Tehran · ثابت</small><p>تمام تاریخ‌ها و ساعت‌های رزرو بر اساس وقت رسمی ایران محاسبه می‌شوند.</p></div>
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
                          <label><span>{index === 0 ? 'ابتدای روز · شروع' : index === day.intervals.length - 1 ? 'انتهای روز · شروع' : `بازه میانی ${toPersianDigits(index + 1)} · شروع`}</span><input type="time" lang="en-GB" dir="ltr" aria-label={`شروع بازه ${index + 1} ${day.name}`} disabled={day.isClosed} value={interval.startsAt} onChange={(event) => updateWeekdayInterval(day.weekday, index, { startsAt: event.target.value })} /></label>
                          <label><span>{index === 0 ? 'پایان بازه اول' : index === day.intervals.length - 1 ? 'پایان روز' : 'پایان بازه میانی'}</span><input type="time" lang="en-GB" dir="ltr" aria-label={`پایان بازه ${index + 1} ${day.name}`} disabled={day.isClosed} value={interval.endsAt} onChange={(event) => updateWeekdayInterval(day.weekday, index, { endsAt: event.target.value })} /></label>
                          <button type="button" className="admin-icon-button" aria-label={`حذف بازه ${index + 1} ${day.name}`} onClick={() => removeWeekdayInterval(day.weekday, index)}><Trash2 size={14} /></button>
                        </div>
                      ))}
                      {!day.isClosed && day.intervals.length === 0 && <p className="admin-form-hint">برای این روز هنوز بازه‌ای ثبت نشده است.</p>}
                      <button type="button" className="admin-light-button" disabled={day.intervals.length >= 8} onClick={() => addWeekdayInterval(day.weekday)}><Plus size={13} /> افزودن بازه</button>
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
              <JalaliDatePicker label="تاریخ" value={exceptionDate} onChange={setExceptionDate} />
              <label className="admin-check-line"><input type="checkbox" checked={exceptionClosed} onChange={(event) => setExceptionClosed(event.target.checked)} /><span>این روز کاملاً تعطیل است</span></label>
              {!exceptionClosed && (
                <div className="admin-exception-intervals">
                  {exceptionIntervals.map((interval, index) => (
                    <div className="admin-form-two-cols admin-interval-row" key={index}>
                      <label><span>شروع بازه {toPersianDigits(index + 1)}</span><input type="time" lang="en-GB" dir="ltr" required value={interval.startsAt} onChange={(event) => updateExceptionInterval(index, { startsAt: event.target.value })} /></label>
                      <label><span>پایان</span><input type="time" lang="en-GB" dir="ltr" required value={interval.endsAt} onChange={(event) => updateExceptionInterval(index, { endsAt: event.target.value })} /></label>
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
                  <div><strong>{formatJalaliDate(exception.date)}</strong><small>{exception.isClosed ? 'تعطیل' : exception.intervals.map((interval) => `${interval.startsAt} تا ${interval.endsAt}`).join('، ')}{exception.note ? ` · ${exception.note}` : ''}</small></div>
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
