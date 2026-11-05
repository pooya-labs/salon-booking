import { useEffect, useState } from 'react'
import { AdminManagement } from './AdminManagement'
import { addDateKeyDays } from './date-range'
import type { FormEvent } from 'react'
import {
  ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, LogOut, RefreshCw,
  ShieldCheck, UserRound, X,
} from 'lucide-react'

type AdminUser = { id: string; username: string }
type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
type Booking = {
  id: string
  reference: string
  name: string
  phone: string
  startsAt: string
  endsAt: string
  status: BookingStatus
  note: string
  service: string
  durationMinutes: number
  source?: 'phone' | 'online'
}

type View = 'checking' | 'demo' | 'login' | 'bootstrap' | 'setup-blocked' | 'dashboard'
type BookingRange = { from: string; to: string }

const statusLabels: Record<BookingStatus, string> = {
  pending: 'در انتظار تأیید',
  confirmed: 'تأیید شده',
  cancelled: 'لغو شده',
  completed: 'انجام شده',
  no_show: 'عدم مراجعه',
}

const statusClasses: Record<BookingStatus, string> = {
  pending: 'admin-status-pending',
  confirmed: 'admin-status-confirmed',
  cancelled: 'admin-status-cancelled',
  completed: 'admin-status-completed',
  no_show: 'admin-status-noshow',
}

const toPersianDigits = (value: string | number) =>
  String(value).replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])

const formatDateTime = (value: string, timezone: string) => {
  const date = new Date(value)
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(date)
}

const formatDateKey = (value: string) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(`${value}T12:00:00.000Z`))

const formatClock = (value: string, timezone: string) =>
  new Intl.DateTimeFormat('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(value))

const apiMessage = async (response: Response, fallback: string) => {
  try {
    const payload = await response.json() as { message?: string }
    return payload.message || fallback
  } catch {
    return fallback
  }
}

export function AdminApp({ demoMode }: { demoMode: boolean }) {
  const [view, setView] = useState<View>(demoMode ? 'demo' : 'checking')
  const [user, setUser] = useState<AdminUser | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [bootstrapToken, setBootstrapToken] = useState('')
  const [formError, setFormError] = useState('')
  const [formBusy, setFormBusy] = useState(false)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [timezone, setTimezone] = useState('UTC')
  const [filter, setFilter] = useState('all')
  const [bookingRange, setBookingRange] = useState<BookingRange | null>(null)
  const [loadingBookings, setLoadingBookings] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [updatingBooking, setUpdatingBooking] = useState<string | null>(null)
  const [statusConfirmation, setStatusConfirmation] = useState<{ bookingId: string; status: BookingStatus } | null>(null)

  const loadBookings = async (
    status = filter,
    range: BookingRange | null = bookingRange,
  ) => {
    setLoadingBookings(true)
    setDashboardError('')
    try {
      const params = new URLSearchParams({ status })
      if (range) {
        params.set('from', range.from)
        params.set('to', range.to)
      }
      const response = await fetch(`/api/admin/bookings?${params.toString()}`, {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (response.status === 401) {
        setUser(null)
        setView('login')
        return
      }
      if (!response.ok) throw new Error(await apiMessage(response, 'دریافت فهرست نوبت‌ها ممکن نشد.'))
      const payload = await response.json() as {
        bookings?: Booking[]
        timezone?: string
        from?: string
        to?: string
      }
      setBookings(Array.isArray(payload.bookings) ? payload.bookings : [])
      setTimezone(payload.timezone || 'UTC')
      if (payload.from && payload.to) setBookingRange({ from: payload.from, to: payload.to })
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : 'ارتباط با سرور برقرار نشد.')
    } finally {
      setLoadingBookings(false)
    }
  }

  const shiftBookingRange = (days: number) => {
    if (!bookingRange || loadingBookings) return
    const from = addDateKeyDays(bookingRange.from, days)
    const to = addDateKeyDays(bookingRange.to, days)
    if (!from || !to) return
    const nextRange = { from, to }
    setBookingRange(nextRange)
    void loadBookings(filter, nextRange)
  }

  const resetBookingRange = () => {
    if (loadingBookings) return
    setBookingRange(null)
    void loadBookings(filter, null)
  }

  useEffect(() => {
    if (demoMode) return
    const controller = new AbortController()

    const initialize = async () => {
      try {
        const response = await fetch('/api/admin/me', {
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
          signal: controller.signal,
        })
        if (response.ok) {
          const payload = await response.json() as { user?: AdminUser }
          if (payload.user) {
            setUser(payload.user)
            setView('dashboard')
            return
          }
        }

        const setupResponse = await fetch('/api/admin/setup-status', {
          headers: { accept: 'application/json' },
          signal: controller.signal,
        })
        if (!setupResponse.ok) throw new Error('وضعیت راه‌اندازی پنل قابل دریافت نیست.')
        const setup = await setupResponse.json() as { initialized?: boolean; bootstrapAvailable?: boolean }
        setView(!setup.initialized && setup.bootstrapAvailable ? 'bootstrap' : setup.initialized ? 'login' : 'setup-blocked')
      } catch (error) {
        if (!controller.signal.aborted) {
          setFormError(error instanceof Error ? error.message : 'ارتباط با سرور برقرار نشد.')
          setView('setup-blocked')
        }
      }
    }

    void initialize()
    return () => controller.abort()
  }, [demoMode])

  useEffect(() => {
    if (user && view === 'dashboard') void loadBookings(filter)
    // The filter and authenticated user define the visible booking list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, view, filter])

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (formBusy) return
    setFormBusy(true)
    setFormError('')

    try {
      const isBootstrap = view === 'bootstrap'
      const response = await fetch(isBootstrap ? '/api/admin/bootstrap' : '/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(isBootstrap ? { 'x-admin-bootstrap-token': bootstrapToken } : {}),
        },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      if (!response.ok) {
        throw new Error(await apiMessage(response, 'ورود یا راه‌اندازی انجام نشد.'))
      }
      const payload = await response.json() as { user?: AdminUser }
      if (!payload.user) throw new Error('پاسخ سرور معتبر نیست.')
      setUser(payload.user)
      setView('dashboard')
      setPassword('')
      setBootstrapToken('')
      setFormError('')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'ارتباط با سرور برقرار نشد.')
    } finally {
      setFormBusy(false)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
    } finally {
      setUser(null)
      setBookings([])
      setView('login')
    }
  }

  const requestStatusChange = (booking: Booking, nextStatus: BookingStatus) => {
    if (['cancelled', 'completed', 'no_show'].includes(nextStatus)) {
      setStatusConfirmation({ bookingId: booking.id, status: nextStatus })
      return
    }
    void updateStatus(booking, nextStatus)
  }

  const updateStatus = async (booking: Booking, nextStatus: BookingStatus) => {
    if (updatingBooking) return
    setUpdatingBooking(booking.id)
    setDashboardError('')
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}/status`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!response.ok) throw new Error(await apiMessage(response, 'تغییر وضعیت انجام نشد.'))
      setStatusConfirmation(null)
      await loadBookings(filter)
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : 'تغییر وضعیت انجام نشد.')
    } finally {
      setUpdatingBooking(null)
    }
  }

  if (view === 'demo') {
    return (
      <main className="admin-page">
        <header className="admin-topbar">
          <a href="./" className="admin-brand"><img className="admin-brand-logo" src={`${import.meta.env.BASE_URL}images/shayan-emblem.webp`} alt="" /><span className="admin-brand-copy"><strong>شایان</strong><small>BARBER STUDIO · OWNER WORKSPACE</small></span></a>
          <a className="admin-return-link" href="./">بازگشت به سایت <ArrowLeft size={15} /></a>
        </header>
        <section className="admin-auth-wrap">
          <div className="admin-auth-card">
            <div className="admin-auth-icon"><ShieldCheck size={24} /></div>
            <div className="eyebrow"><span className="eyebrow-line" /> OWNER ACCESS</div>
            <h1>پنل مدیریت</h1>
            <p>رابط پنل در حال توسعه است. برای حفظ امنیت، ورود و اطلاعات نوبت‌ها در پیش‌نمایش GitHub Pages فعال نیستند.</p>
            <div className="admin-notice"><ShieldCheck size={17} /><span>این نسخه فقط پیش‌نمایش طراحی است و به اطلاعات مشتریان دسترسی ندارد.</span></div>
            <a className="button button-dark admin-auth-submit" href="./">بازگشت به صفحه اصلی <ArrowLeft size={16} /></a>
          </div>
        </section>
        <footer className="admin-footer">Crafted with care by <strong>Pooya</strong></footer>
      </main>
    )
  }

  if (view !== 'dashboard') {
    return (
      <main className="admin-page">
        <header className="admin-topbar">
          <a href={import.meta.env.BASE_URL} className="admin-brand"><img className="admin-brand-logo" src={`${import.meta.env.BASE_URL}images/shayan-emblem.webp`} alt="" /><span className="admin-brand-copy"><strong>شایان</strong><small>BARBER STUDIO · OWNER WORKSPACE</small></span></a>
          <a className="admin-return-link" href={import.meta.env.BASE_URL}>بازگشت به سایت <ArrowLeft size={15} /></a>
        </header>
        <section className="admin-auth-wrap">
          <div className="admin-auth-card">
            <div className="admin-auth-icon"><ShieldCheck size={24} /></div>
            <div className="eyebrow"><span className="eyebrow-line" /> SECURE OWNER ACCESS</div>
            {view === 'checking' ? (
              <><h1>در حال بررسی دسترسی…</h1><p>وضعیت نشست امن شما بررسی می‌شود.</p></>
            ) : view === 'setup-blocked' ? (
              <><h1>پنل هنوز آماده نیست.</h1><p>برای فعال‌کردن مدیریت، ابتدا Web App اپس‌اسکریپت و دیتابیس Google Sheets باید توسط صاحب حساب راه‌اندازی شوند.</p><div className="admin-notice"><ShieldCheck size={17} /><span>هیچ گذرواژه پیش‌فرضی وجود ندارد. راه‌اندازی مدیر باید با کلید یک‌بارمصرف امن انجام شود.</span></div>{formError && <p className="admin-error" role="alert">{formError}</p>}</>
            ) : (
              <>
                <h1>{view === 'bootstrap' ? 'ساخت حساب مدیر' : 'خوش برگشتید.'}</h1>
                <p>{view === 'bootstrap' ? 'این فرم فقط برای ساخت نخستین حساب مدیر سامانه استفاده می‌شود.' : 'برای مشاهده و مدیریت نوبت‌ها وارد شوید.'}</p>
                <form className="admin-auth-form" onSubmit={submitAuth}>
                  {view === 'bootstrap' && <label><span>کلید راه‌اندازی یک‌بارمصرف</span><input type="password" autoComplete="off" required value={bootstrapToken} onChange={(event) => setBootstrapToken(event.target.value)} placeholder="Bootstrap secret" /></label>}
                  <label><span>نام کاربری</span><input autoComplete="username" required minLength={3} maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="نام کاربری مدیر" /></label>
                  <label><span>گذرواژه {view === 'bootstrap' && '(حداقل ۱۲ نویسه)'}</span><input type="password" autoComplete={view === 'bootstrap' ? 'new-password' : 'current-password'} required minLength={view === 'bootstrap' ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="گذرواژه" /></label>
                  {formError && <p className="admin-error" role="alert">{formError}</p>}
                  <button className="button button-dark admin-auth-submit" disabled={formBusy}>{formBusy ? 'در حال بررسی…' : view === 'bootstrap' ? 'ساخت حساب امن' : 'ورود به پنل'} <ArrowLeft size={16} /></button>
                </form>
              </>
            )}
            <div className="admin-security-footnote"><ShieldCheck size={14} /> اتصال امن · نشست محدود به ۶ ساعت</div>
          </div>
        </section>
        <footer className="admin-footer">Crafted with care by <strong>Pooya</strong></footer>
      </main>
    )
  }

  const pendingCount = bookings.filter((booking) => booking.status === 'pending').length
  const confirmedCount = bookings.filter((booking) => booking.status === 'confirmed').length
  const finishedCount = bookings.filter((booking) => booking.status === 'completed').length

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <a href={import.meta.env.BASE_URL} className="admin-brand"><img className="admin-brand-logo" src={`${import.meta.env.BASE_URL}images/shayan-emblem.webp`} alt="" /><span className="admin-brand-copy"><strong>شایان</strong><small>BARBER STUDIO · OWNER WORKSPACE</small></span></a>
        <div className="admin-topbar-actions"><span className="admin-user-chip"><UserRound size={14} /> {user?.username}</span><button className="admin-logout" onClick={() => void logout()}><LogOut size={15} /> خروج</button></div>
      </header>

      <section className="admin-dashboard">
        <div className="admin-dashboard-heading">
          <div><div className="eyebrow"><span className="eyebrow-line" /> SALON MANAGEMENT</div><h1>سلام، {user?.username}.</h1><p>برنامه نوبت‌ها را از همین‌جا مدیریت کنید.</p></div>
          <button className="admin-refresh" onClick={() => void loadBookings(filter)} disabled={loadingBookings}><RefreshCw size={15} className={loadingBookings ? 'is-spinning' : ''} /> به‌روزرسانی</button>
        </div>

        <div className="admin-stat-grid">
          <article><span>در انتظار تأیید</span><strong>{toPersianDigits(pendingCount)}</strong><small>درخواست‌های جدید</small></article>
          <article><span>نوبت‌های تأییدشده</span><strong>{toPersianDigits(confirmedCount)}</strong><small>برنامه قطعی</small></article>
          <article><span>انجام‌شده</span><strong>{toPersianDigits(finishedCount)}</strong><small>نوبت‌های تکمیل‌شده</small></article>
        </div>

        <AdminManagement />

        <section className="admin-bookings-panel">
          <div className="admin-bookings-heading">
            <div>
              <h2>نوبت‌ها</h2>
              <p>منطقه زمانی سالن: {timezone}</p>
              <div className="admin-date-navigation" aria-label="جابجایی بازه نوبت‌ها">
                <button type="button" aria-label="هفت روز قبل" title="هفت روز قبل" disabled={!bookingRange || loadingBookings} onClick={() => shiftBookingRange(-7)}><ChevronRight size={15} /></button>
                <span role="status" aria-live="polite">{bookingRange ? `${formatDateKey(bookingRange.from)} تا ${formatDateKey(bookingRange.to)}` : 'در حال دریافت بازه…'}</span>
                <button type="button" aria-label="هفت روز بعد" title="هفت روز بعد" disabled={!bookingRange || loadingBookings} onClick={() => shiftBookingRange(7)}><ChevronLeft size={15} /></button>
                <button type="button" className="admin-date-reset" disabled={loadingBookings || !bookingRange} onClick={resetBookingRange}>هفت روز آینده</button>
              </div>
            </div>
            <label className="admin-filter"><span>فیلتر</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">همه وضعیت‌ها</option><option value="pending">در انتظار تأیید</option><option value="confirmed">تأییدشده</option><option value="cancelled">لغوشده</option><option value="completed">انجام‌شده</option><option value="no_show">عدم مراجعه</option></select></label>
          </div>

          {dashboardError && <p className="admin-error" role="alert">{dashboardError}</p>}
          {loadingBookings ? <div className="admin-empty-state"><span className="booking-spinner" /> در حال دریافت نوبت‌ها…</div> : bookings.length === 0 ? <div className="admin-empty-state"><CalendarDays size={26} /><strong>هنوز نوبتی در این بازه نیست.</strong><span>با ثبت رزرو جدید، نوبت‌ها اینجا نمایش داده می‌شوند.</span></div> : (
            <div className="admin-booking-list">
              {bookings.map((booking) => (
                <article className="admin-booking-card" key={booking.id}>
                  <div className="admin-booking-time"><strong>{formatClock(booking.startsAt, timezone)}</strong><small>{formatDateTime(booking.startsAt, timezone).split('،').slice(0, 2).join('،')}</small></div>
                  <div className="admin-booking-main">
                    <div className="admin-booking-title"><strong>{booking.name}</strong><span className={`admin-status ${statusClasses[booking.status]}`}>{statusLabels[booking.status]}</span></div>
                    <p>{booking.service} · {toPersianDigits(booking.durationMinutes)} دقیقه</p>
                    <small className="admin-booking-origin">{booking.source === 'phone' ? 'ثبت‌شده با تماس تلفنی' : 'رزرو آنلاین'}</small>
                    <div className="admin-booking-meta"><a href={`tel:${booking.phone}`}>{booking.phone}</a><span>کد {booking.reference}</span></div>
                    {booking.note && <small className="admin-booking-note">{booking.note}</small>}
                  </div>
                  <div className="admin-booking-actions">
                    {booking.status === 'pending' && <><button disabled={updatingBooking === booking.id} onClick={() => requestStatusChange(booking, 'confirmed')}><Check size={14} /> تأیید</button><button className="is-danger" disabled={updatingBooking === booking.id} onClick={() => requestStatusChange(booking, 'cancelled')}><X size={14} /> لغو</button></>}
                    {booking.status === 'confirmed' && <><button disabled={updatingBooking === booking.id} onClick={() => requestStatusChange(booking, 'completed')}><Check size={14} /> انجام شد</button><button className="is-danger" disabled={updatingBooking === booking.id} onClick={() => requestStatusChange(booking, 'no_show')}>عدم مراجعه</button></>}
                    {statusConfirmation?.bookingId === booking.id && (
                      <div className="admin-status-confirmation" role="group" aria-label="تأیید تغییر وضعیت">
                        <p>{statusConfirmation.status === 'cancelled' ? 'آیا از لغو این نوبت مطمئن هستید؟' : statusConfirmation.status === 'completed' ? 'انجام این نوبت را تأیید می‌کنید؟' : 'عدم مراجعهٔ مشتری را ثبت می‌کنید؟'}</p>
                        <div className="admin-status-confirmation-actions">
                          <button type="button" className="is-danger" disabled={updatingBooking === booking.id} aria-label={statusConfirmation.status === 'cancelled' ? 'تأیید لغو نوبت' : statusConfirmation.status === 'completed' ? 'تأیید انجام نوبت' : 'تأیید عدم مراجعه'} onClick={() => void updateStatus(booking, statusConfirmation.status)}>تأیید نهایی</button>
                          <button type="button" disabled={updatingBooking === booking.id} onClick={() => setStatusConfirmation(null)}>انصراف</button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="admin-next-step"><Clock3 size={17} /><span><strong>تنظیمات استودیو</strong><small>خدمات، برنامه هفتگی، فاصله‌های کاری و تعطیلات را از بخش مدیریت بالاتر همین صفحه به‌روزرسانی کنید.</small></span></div>
      </section>
      <footer className="admin-footer">Crafted with care by <strong>Pooya</strong></footer>
    </main>
  )
}
