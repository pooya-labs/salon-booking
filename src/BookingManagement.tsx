import { useState } from 'react'
import { useDialogAccessibility } from './useDialogAccessibility'
import type { FormEvent } from 'react'
import { CalendarDays, Check, Search, ShieldCheck, X } from 'lucide-react'

type ManagedBooking = {
  reference: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  serviceName: string
  date: string
  time: string
  durationMinutes: number
  cancellable: boolean
}

type ApiPayload = { booking?: ManagedBooking; message?: string; alreadyCancelled?: boolean }

const statusLabels: Record<ManagedBooking['status'], string> = {
  pending: 'در انتظار تأیید',
  confirmed: 'تأیید شده',
  cancelled: 'لغو شده',
  completed: 'انجام شده',
  no_show: 'ثبت عدم حضور',
}
const toPersianDigits = (value: string | number) =>
  String(value).replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])

const formatJalaliDate = (date: string) => {
  const parsed = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(parsed)
}

export function BookingManagement({ onClose, demoMode }: { onClose: () => void; demoMode: boolean }) {
  const dialogRef = useDialogAccessibility<HTMLElement>(onClose)
  const [reference, setReference] = useState('')
  const [managementToken, setManagementToken] = useState('')
  const [booking, setBooking] = useState<ManagedBooking | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const lookupBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading || demoMode) return
    setLoading(true)
    setError('')
    setNotice('')
    setBooking(null)
    setConfirmCancel(false)
    try {
      const response = await fetch('/api/public/bookings/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ reference: reference.trim().toUpperCase(), managementToken: managementToken.trim() }),
      })
      const payload = await response.json() as ApiPayload
      if (!response.ok || !payload.booking) throw new Error(payload.message || 'اطلاعات پیگیری معتبر نیست.')
      setBooking(payload.booking)
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : 'دریافت اطلاعات رزرو ممکن نشد.')
    } finally {
      setLoading(false)
    }
  }

  const cancelBooking = async () => {
    if (!booking || cancelling || demoMode) return
    setCancelling(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/public/bookings/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ reference: booking.reference, managementToken: managementToken.trim() }),
      })
      const payload = await response.json() as ApiPayload
      if (!response.ok || !payload.booking) throw new Error(payload.message || 'لغو نوبت انجام نشد.')
      setBooking(payload.booking)
      setConfirmCancel(false)
      setNotice(payload.alreadyCancelled ? 'این نوبت پیش‌تر لغو شده است.' : 'نوبت شما با موفقیت لغو شد.')
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'لغو نوبت انجام نشد.')
    } finally {
      setCancelling(false)
    }
  }

  const resetLookup = () => {
    setBooking(null)
    setError('')
    setNotice('')
    setConfirmCancel(false)
  }

  return (
    <div className="booking-flow-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section ref={dialogRef} tabIndex={-1} className="booking-flow booking-manage-flow" role="dialog" aria-modal="true" aria-labelledby="booking-manage-title">
        <header className="booking-flow-header">
          <div className="booking-flow-brand">
            <span className="brand-mark"><CalendarDays size={18} /></span>
            <span><strong>پیگیری نوبت</strong><small>SHAYAN · BOOKING CARE</small></span>
          </div>
          <button type="button" className="icon-button" aria-label="بستن پنجره پیگیری" onClick={onClose}><X size={19} /></button>
        </header>

        <div className="booking-flow-body">
          <div className="booking-step">
            <div className="eyebrow"><span className="eyebrow-line" /> BOOKING MANAGEMENT</div>
            <h2 id="booking-manage-title">رزروتان را پیدا کنید.</h2>
            {demoMode ? (
              <div className="booking-preview-warning">
                <ShieldCheck size={18} />
                <span><strong>این نسخه فقط پیش‌نمایش است.</strong><small>پیگیری و لغو واقعی پس از راه‌اندازی Google Apps Script و صفحه‌گستردهٔ دیتابیس فعال می‌شود. اطلاعاتی در این صفحه ارسال یا ذخیره نمی‌شود.</small></span>
              </div>
            ) : !booking ? (
              <>
                <p className="booking-step-intro">کد پیگیری و کلید محرمانه‌ای را که هنگام ثبت رزرو دریافت کردید وارد کنید.</p>
                <form className="booking-manager-form" onSubmit={lookupBooking}>
                  <label className="booking-field">
                    <span><Search size={15} /> کد پیگیری رزرو</span>
                    <input required maxLength={10} autoCapitalize="characters" autoComplete="off" spellCheck={false} value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} placeholder="SB-XXXXXXX" dir="ltr" />
                  </label>
                  <label className="booking-field">
                    <span><ShieldCheck size={15} /> کلید محرمانه مدیریت</span>
                    <input required minLength={64} maxLength={64} autoComplete="off" spellCheck={false} value={managementToken} onChange={(event) => setManagementToken(event.target.value.toLowerCase())} placeholder="۶۴ نویسهٔ هگزادسیمال" dir="ltr" />
                  </label>
                  <div className="booking-privacy-note">
                    <ShieldCheck size={18} />
                    <span><strong>امنیت اطلاعات رزرو</strong><small>برای دسترسی، هر دو مقدار لازم‌اند. شماره تماس یا اطلاعات شخصی شما برای جست‌وجو درخواست نمی‌شود.</small></span>
                  </div>
                  <button className="button button-dark booking-manager-submit" disabled={loading}>
                    {loading ? 'در حال بررسی…' : 'نمایش جزئیات رزرو'} <Search size={15} />
                  </button>
                </form>
              </>
            ) : (
              <div className="booking-manager-result">
                <p className="booking-step-intro">جزئیات این رزرو با کلید محرمانه تأیید شد.</p>
                <div className="booking-review-card">
                  <div className="booking-review-top"><span className="review-mark"><CalendarDays size={18} /></span><span><small>BOOKING · {booking.reference}</small><strong>خلاصه رزرو شما</strong></span></div>
                  <div className="booking-review-row"><span>خدمت</span><strong>{booking.serviceName}</strong></div>
                  <div className="booking-review-row"><span>تاریخ</span><strong>{formatJalaliDate(booking.date)}</strong></div>
                  <div className="booking-review-row"><span>ساعت</span><strong dir="ltr">{toPersianDigits(booking.time)}</strong></div>
                  <div className="booking-review-row"><span>مدت</span><strong>{toPersianDigits(booking.durationMinutes)} دقیقه</strong></div>
                  <div className="booking-review-row"><span>وضعیت</span><strong>{statusLabels[booking.status]}</strong></div>
                </div>
                {notice && <p className="booking-manager-notice" role="status"><Check size={15} /> {notice}</p>}
                {error && <p className="booking-form-error" role="alert">{error}</p>}
                {confirmCancel ? (
                  <div className="booking-manager-confirm">
                    <p>از لغو این نوبت مطمئن هستید؟ این کار زمان را دوباره برای رزرو آزاد می‌کند.</p>
                    <div>
                      <button type="button" className="booking-manager-secondary" onClick={() => setConfirmCancel(false)}>بازگشت</button>
                      <button type="button" className="booking-manager-danger" disabled={cancelling} onClick={() => void cancelBooking()}>{cancelling ? 'در حال لغو…' : 'تأیید لغو نوبت'}</button>
                    </div>
                  </div>
                ) : booking.cancellable ? (
                  <button type="button" className="booking-manager-danger booking-manager-cancel" onClick={() => setConfirmCancel(true)}>لغو این نوبت</button>
                ) : booking.status === 'cancelled' ? (
                  <p className="booking-inline-state">این نوبت لغو شده و دیگر در برنامه کاری رزرو محسوب نمی‌شود.</p>
                ) : (
                  <p className="booking-inline-state">این نوبت از طریق سامانه قابل لغو نیست؛ برای هماهنگی با استودیو تماس بگیرید.</p>
                )}
                <button type="button" className="booking-manager-reset" onClick={resetLookup}>پیگیری رزرو دیگر</button>
              </div>
            )}
            {error && !booking && <p className="booking-form-error" role="alert">{error}</p>}
          </div>
        </div>

        <footer className="booking-flow-footer">
          <span className="booking-footer-caption">پیگیری امن با کلید محرمانه شما</span>
          <button type="button" className="button button-dark" onClick={onClose}>بستن <X size={15} /></button>
        </footer>
      </section>
    </div>
  )
}
