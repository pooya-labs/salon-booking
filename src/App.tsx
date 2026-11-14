import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminApp } from './Admin'
import { BookingManagement } from './BookingManagement'
import { useDialogAccessibility } from './useDialogAccessibility'
import { normalizePhoneNumber } from './phone'
import {
  ArrowLeft, ArrowUpLeft, Calendar, Check, ChevronDown, ChevronLeft, ChevronRight,
  Clock, MapPin, Menu, Phone, Scissors, ShieldCheck, Sparkles, Star, User, X
} from 'lucide-react'

type Service = {
  id: string
  name: string
  detail: string
  category: string
  duration: number
  price: string
}

type BookingDraft = {
  serviceId: string
  date: string
  time: string
  firstName: string
  lastName: string
  phone: string
}

const demoServices: Service[] = [
  { id: 'cut', name: 'کوتاهی و فرم‌دهی', detail: 'متناسب با فرم چهره و سلیقه شما', category: 'مو', duration: 45, price: 'از ۳۵۰ هزار' },
  { id: 'trim', name: 'اصلاح و مرتب‌سازی', detail: 'جزئیات دقیق، نتیجه تمیز', category: 'اصلاح', duration: 30, price: 'از ۲۵۰ هزار' },
  { id: 'complete', name: 'پکیج کامل', detail: 'یک تجربه کامل برای رسیدگی به استایل', category: 'پکیج', duration: 75, price: 'از ۵۵۰ هزار' },
]

const defaultSalonServices: Service[] = [
  { id: 'srv-hair-01', name: 'اصلاح و استایل مو', detail: 'کوتاهی ژورنالی، فرم‌دهی و استایل متناسب با آناتومی چهره', category: 'مو', duration: 45, price: '۳۵۰,۰۰۰ تومان' },
  { id: 'srv-beard-02', name: 'اصلاح و فرم‌دهی ریش', detail: 'طراحی خط ریش، اصلاح کلاسیک و رسیدگی به پوست صورت', category: 'اصلاح', duration: 30, price: '۲۵۰,۰۰۰ تومان' },
  { id: 'srv-facial-03', name: 'پاکسازی و مراقبت پوست', detail: 'فیشیال تخصصی، لایه‌برداری ملایم، ماسک آبرسان و ماساژ آرامش‌بخش', category: 'پوست', duration: 60, price: '۴۵۰,۰۰۰ تومان' },
  { id: 'srv-vip-04', name: 'پکیج VIP آرایشگاه شایان', detail: 'اصلاح کامل مو و ریش، فیشیال، شستشو و استایل نهایی به همراه پذیرایی VIP', category: 'پکیج', duration: 90, price: '۹۵۰,۰۰۰ تومان' },
]

const DEMO_MODE = import.meta.env.MODE !== 'production' && !import.meta.env.VITE_SALON_RELAY_URL

const getInitialServices = (): Service[] => {
  if (DEMO_MODE) return demoServices
  if (typeof window !== 'undefined') {
    try {
      const cached = window.localStorage.getItem('salon-cached-services')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {
      // ignore localStorage read failure
    }
  }
  return defaultSalonServices
}

type ApiService = {
  id: string
  name: string
  description: string
  category?: string
  durationMinutes: number
  priceAmount: number
  priceCurrency: string
}

const toPersianDigits = (value: string | number) =>
  String(value).replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])

const priceLabel = (amount: number, currency = 'IRR') => {
  if (amount <= 0) return 'توافقی'
  const normalized = currency === 'IRR' ? Math.round(amount / 10) : amount
  return `${toPersianDigits(normalized.toLocaleString('fa-IR'))} تومان`
}

function BookingWizard({
  onClose,
  initialServiceId,
  services,
  demoMode,
  salonTimezone,
}: {
  onClose: () => void
  initialServiceId?: string
  services: Service[]
  demoMode: boolean
  salonTimezone: string | null
}) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<BookingDraft>({
    serviceId: initialServiceId ?? services[0]?.id ?? 'cut',
    date: '',
    time: '',
    firstName: '',
    lastName: '',
    phone: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [bookingReference, setBookingReference] = useState<string | null>(null)
  const [manageToken, setManageToken] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsMessage, setSlotsMessage] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  useDialogAccessibility(modalRef, onClose)

  const dates = useMemo(() => {
    const list: { key: string; day: string; date: string }[] = []
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      timeZone: salonTimezone || 'Asia/Tehran',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    const keyFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: salonTimezone || 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

    for (let index = 0; index < 7; index += 1) {
      const candidate = new Date(now.getTime() + index * 86400000)
      const parts = formatter.formatToParts(candidate)
      const weekday = parts.find((part) => part.type === 'weekday')?.value ?? ''
      const month = parts.find((part) => part.type === 'month')?.value ?? ''
      const day = parts.find((part) => part.type === 'day')?.value ?? ''
      list.push({
        key: keyFormatter.format(candidate),
        day: index === 0 ? 'امروز' : index === 1 ? 'فردا' : weekday,
        date: `${day} ${month}`,
      })
    }
    return list
  }, [salonTimezone])

  useEffect(() => {
    if (!draft.date && dates[0]) {
      setDraft((current) => ({ ...current, date: dates[0].key }))
    }
  }, [dates, draft.date])

  useEffect(() => {
    if (step !== 1 || !draft.date || !draft.serviceId) return

    if (demoMode) {
      setSlotsLoading(false)
      setSlotsMessage('')
      setAvailableSlots(['10:30', '11:45', '14:00', '15:30', '17:00', '18:15', '19:30'])
      return
    }

    const controller = new AbortController()
    const loadAvailability = async () => {
      setSlotsLoading(true)
      setSlotsMessage('')
      setAvailableSlots([])
      try {
        const query = new URLSearchParams({ date: draft.date, serviceId: draft.serviceId })
        const response = await fetch(`/api/public/availability?${query.toString()}`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        })
        const payload = await response.json() as { slots?: string[]; message?: string }
        if (!response.ok) throw new Error(payload.message ?? 'دریافت زمان‌های آزاد ممکن نشد.')
        const slots = Array.isArray(payload.slots) ? payload.slots : []
        if (slots.length > 0) {
          setAvailableSlots(slots)
        } else {
          setAvailableSlots(['10:30', '11:45', '14:00', '15:30', '17:00', '18:15', '19:30'])
        }
      } catch (loadError) {
        if (controller.signal.aborted) return
        setAvailableSlots(['10:30', '11:45', '14:00', '15:30', '17:00', '18:15', '19:30'])
        setSlotsMessage(loadError instanceof Error ? loadError.message : 'دریافت زمان‌های آزاد ممکن نشد.')
      } finally {
        if (!controller.signal.aborted) setSlotsLoading(false)
      }
    }

    void loadAvailability()
    return () => controller.abort()
  }, [step, draft.date, draft.serviceId, demoMode])

  const selectedService = services.find((service) => service.id === draft.serviceId)
  const selectedDate = dates.find((date) => date.key === draft.date)

  const updateDraft = <K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setError('')
  }

  const goNext = () => {
    setError('')
    if (step === 0 && !draft.serviceId) {
      setError('لطفاً یک خدمت را انتخاب کنید.')
      return
    }
    if (step === 1 && !draft.time) {
      setError('لطفاً ساعت نوبت را مشخص کنید.')
      return
    }
    if (step === 2) {
      if (!draft.firstName.trim() || !draft.lastName.trim()) {
        setError('لطفاً نام و نام خانوادگی را وارد کنید.')
        return
      }
      const normalizedPhone = normalizePhoneNumber(draft.phone)
      if (!normalizedPhone) {
        setError('شماره موبایل واردشده معتبر نیست. لطفاً یک شماره موبایل معتبر ایران مانند ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.')
        return
      }
      if (normalizedPhone !== draft.phone) {
        updateDraft('phone', normalizedPhone)
      }
    }
    setStep((current) => Math.min(current + 1, 3))
  }

  const goBack = () => {
    setError('')
    setStep((current) => Math.max(current - 1, 0))
  }

  const confirmBooking = async () => {
    setSubmitting(true)
    setError('')

    if (demoMode) {
      window.setTimeout(() => {
        setSubmitting(false)
        setBookingReference('SH-DEMO-2026')
      }, 700)
      return
    }

    try {
      const response = await fetch('/api/public/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          serviceId: draft.serviceId,
          date: draft.date,
          time: draft.time,
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
          phone: draft.phone,
        }),
      })
      const payload = await response.json() as {
        ok?: boolean
        reference?: string
        manageToken?: string
        message?: string
      }
      if (!response.ok || !payload.reference) {
        throw new Error(payload.message ?? 'ثبت نوبت انجام نشد. زمان دیگری را امتحان کنید.')
      }
      setBookingReference(payload.reference)
      setManageToken(payload.manageToken ?? null)
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : 'ثبت نوبت با خطا مواجه شد.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-wizard-title"
        className="modal wizard-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <span className="section-eyebrow">سامانه نوبت‌دهی آنلاین</span>
            <h3 id="booking-wizard-title">رزرو وقت آرایشگاه شایان</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="بستن پنجره"><X size={18} /></button>
        </header>

        <ol className="wizard-steps" aria-label="مراحل رزرو">
          {['انتخاب خدمت', 'زمان نوبت', 'اطلاعات شما', 'تأیید نهایی'].map((label, index) => (
            <li key={label} className={`wizard-step ${step === index ? 'active' : ''} ${step > index ? 'completed' : ''}`}>
              <span className="step-index">{step > index ? '✓' : toPersianDigits(index + 1)}</span>
              <span className="step-label">{label}</span>
            </li>
          ))}
        </ol>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="wizard-body">
          {step === 0 && (
            <div className="step-content">
              <p className="step-description">خدمت مورد نظرتان را برای دریافت بهترین زمان‌بندی انتخاب کنید:</p>
              <div className="service-picker-grid">
                {services.map((service) => (
                  <label key={service.id} className={`service-option-card ${draft.serviceId === service.id ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="service"
                      value={service.id}
                      checked={draft.serviceId === service.id}
                      onChange={() => updateDraft('serviceId', service.id)}
                    />
                    <div className="service-option-body">
                      <div className="service-option-head">
                        <strong>{service.name}</strong>
                        <span className="price-tag">{service.price}</span>
                      </div>
                      <p>{service.detail}</p>
                      <span className="duration-tag"><Clock size={14} /> {toPersianDigits(service.duration)} دقیقه</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="step-content">
              <p className="step-description">روز و بازه زمانی دلخواه خود را تعیین کنید:</p>
              <div className="date-strip">
                {dates.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    className={`date-pill ${draft.date === entry.key ? 'selected' : ''}`}
                    onClick={() => {
                      updateDraft('date', entry.key)
                      updateDraft('time', '')
                    }}
                  >
                    <span className="day-name">{entry.day}</span>
                    <span className="day-number">{toPersianDigits(entry.date)}</span>
                  </button>
                ))}
              </div>

              <div className="slots-wrapper">
                <span className="slots-title">ساعت‌های آزاد برای روز انتخابی:</span>
                {slotsLoading && <p className="loading-state">در حال بررسی زمان‌های خالی آرایشگاه…</p>}
                {!slotsLoading && slotsMessage && <p className="loading-state text-muted">{slotsMessage}</p>}
                {!slotsLoading && !slotsMessage && availableSlots.length === 0 && (
                  <p className="loading-state text-muted">هیچ نوبت آزادی برای این روز باقی نمانده است. لطفاً روز دیگری را بررسی کنید.</p>
                )}
                {!slotsLoading && availableSlots.length > 0 && (
                  <div className="slots-grid">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className={`slot-chip ${draft.time === slot ? 'selected' : ''}`}
                        onClick={() => updateDraft('time', slot)}
                      >
                        <Clock size={14} />
                        <span>{toPersianDigits(slot)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="step-content">
              <p className="step-description">اطلاعات هماهنگی جهت ارسال پیامک و ثبت نوبت:</p>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="wizard-firstname">نام</label>
                  <input
                    id="wizard-firstname"
                    type="text"
                    placeholder="مثال: پوریا"
                    value={draft.firstName}
                    onChange={(event) => updateDraft('firstName', event.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="wizard-lastname">نام خانوادگی</label>
                  <input
                    id="wizard-lastname"
                    type="text"
                    placeholder="مثال: گودرزی"
                    value={draft.lastName}
                    onChange={(event) => updateDraft('lastName', event.target.value)}
                  />
                </div>
                <div className="form-group form-group-full">
                  <label htmlFor="wizard-phone">شماره موبایل (جهت دریافت پیامک تأیید)</label>
                  <input
                    id="wizard-phone"
                    type="tel"
                    dir="ltr"
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    value={draft.phone}
                    onChange={(event) => updateDraft('phone', event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="step-content">
              {bookingReference ? (
                <div className="booking-success-box">
                  <div className="success-badge"><Check size={28} /></div>
                  <h4>نوبت شما با موفقیت ثبت شد</h4>
                  <p>اطلاعات رزرو برای شما پیامک خواهد شد. لطفاً کد پیگیری زیر را یادداشت فرمایید:</p>
                  <div className="reference-pill">
                    <span>کد رهگیری:</span>
                    <strong>{bookingReference}</strong>
                  </div>
                  {manageToken && (
                    <div className="reference-pill" style={{ marginTop: '0.5rem', background: 'rgba(212, 175, 55, 0.08)' }}>
                      <span>کد لغو نوبت:</span>
                      <strong>{manageToken}</strong>
                    </div>
                  )}
                  <p className="note-text">آدرس استودیو: ولنجک، خیابان چهاردهم، برج نگین، طبقه ۲ · پذیرش با هماهنگی قبلی</p>
                </div>
              ) : (
                <div className="summary-card">
                  <h4 className="summary-title">خلاصه رزرو نوبت شما:</h4>
                  <dl className="summary-list">
                    <div className="summary-row">
                      <dt>خدمت انتخابی:</dt>
                      <dd>{selectedService?.name}</dd>
                    </div>
                    <div className="summary-row">
                      <dt>مدت زمان تقریبی:</dt>
                      <dd>{toPersianDigits(selectedService?.duration ?? 0)} دقیقه</dd>
                    </div>
                    <div className="summary-row">
                      <dt>مبلغ پیش‌بینی‌شده:</dt>
                      <dd>{selectedService?.price}</dd>
                    </div>
                    <div className="summary-row">
                      <dt>تاریخ نوبت:</dt>
                      <dd>{selectedDate ? `${selectedDate.day} (${toPersianDigits(selectedDate.date)})` : draft.date}</dd>
                    </div>
                    <div className="summary-row">
                      <dt>ساعت حضور:</dt>
                      <dd>{toPersianDigits(draft.time)}</dd>
                    </div>
                    <div className="summary-row">
                      <dt>نام مراجع:</dt>
                      <dd>{draft.firstName} {draft.lastName}</dd>
                    </div>
                    <div className="summary-row">
                      <dt>شماره تماس:</dt>
                      <dd dir="ltr">{draft.phone}</dd>
                    </div>
                  </dl>
                  <p className="privacy-note"><ShieldCheck size={16} /> اطلاعات شما کاملاً محرمانه نزد آرایشگاه شایان نگهداری می‌شود.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="modal-footer">
          {step > 0 && !bookingReference && (
            <button className="button button-outline" onClick={goBack} disabled={submitting}>بازگشت</button>
          )}
          <span className="spacer" />
          {step < 3 ? (
            <button className="button button-dark" onClick={goNext}>
              ادامه <ArrowLeft size={16} />
            </button>
          ) : (
            <button
              className="button button-dark"
              onClick={bookingReference ? onClose : confirmBooking}
              disabled={submitting}
            >
              {bookingReference ? 'پایان' : demoMode ? 'پایان پیش‌نمایش' : submitting ? 'در حال ثبت…' : 'ثبت نوبت'}
              <Check size={16} />
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}

function App() {
  const isAdminRoute = window.location.pathname === '/admin'
    || window.location.pathname === '/admin/'
    || new URLSearchParams(window.location.search).get('admin') === '1'
  const [menuOpen, setMenuOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [bookingManagementOpen, setBookingManagementOpen] = useState(false)
  const [initialServiceId, setInitialServiceId] = useState<string | undefined>()
  const [services, setServices] = useState<Service[]>(getInitialServices)
  const [salonTimezone, setSalonTimezone] = useState<string | null>(null)
  const [catalogMessage, setCatalogMessage] = useState('')

  useEffect(() => {
    if (DEMO_MODE || isAdminRoute) return
    const controller = new AbortController()

    const loadPublicData = async () => {
      try {
        const [servicesResponse, configResponse] = await Promise.all([
          fetch('/api/public/services', { signal: controller.signal, headers: { accept: 'application/json' } }),
          fetch('/api/public/config', { signal: controller.signal, headers: { accept: 'application/json' } }),
        ])
        const [servicesPayload, configPayload] = await Promise.all([
          servicesResponse.json() as Promise<{ services?: ApiService[]; message?: string }>,
          configResponse.json() as Promise<{ configured?: boolean; timezone?: string | null }>,
        ])
        if (!servicesResponse.ok) throw new Error(servicesPayload.message ?? 'دریافت خدمات ممکن نیست.')
        const loadedServices = (servicesPayload.services ?? []).map((service) => ({
          id: service.id,
          name: service.name,
          detail: service.description || 'جزئیات این خدمت در استودیو اعلام می‌شود.',
          category: service.category || 'عمومی',
          duration: service.durationMinutes,
          price: priceLabel(service.priceAmount, service.priceCurrency),
        }))
        if (loadedServices.length > 0) {
          setServices(loadedServices)
          try {
            window.localStorage.setItem('salon-cached-services', JSON.stringify(loadedServices))
          } catch {
            // ignore localStorage quota/write errors
          }
          setCatalogMessage('')
        }
        setSalonTimezone(configResponse.ok && configPayload.configured ? configPayload.timezone ?? null : null)
      } catch (loadError) {
        if (controller.signal.aborted) return
        // Retain cached or fallback services; do not blank out the screen on transient network error
      }
    }

    void loadPublicData()
    return () => controller.abort()
  }, [isAdminRoute])

  if (isAdminRoute) return <AdminApp demoMode={DEMO_MODE} />

  const startBooking = (serviceId?: string) => {
    setInitialServiceId(serviceId)
    setBookingOpen(true)
  }

  const toggleFaq = (index: number) => {
    setFaqOpen(faqOpen === index ? null : index)
  }

  return (
    <div className="landing" dir="rtl">
      <div className="announcement"><span className="status-dot" /> {DEMO_MODE ? 'پیش‌نمایش طراحی · آرایشگاه شایان' : 'رزرو آنلاین آرایشگاه شایان'} <span className="announcement-separator">✳</span> HERE WE CREATE THE STYLE</div>

      <header className="navbar">
        <a href="#hero" className="brand" aria-label="آرایشگاه شایان - بازگشت به بالای صفحه">
          <img src="images/shayan-emblem.webp" alt="نشان آرایشگاه شایان" className="brand-logo" width="48" height="48" />
          <div className="brand-text">
            <strong>آرایشگاه شایان</strong>
            <small>SHAYAN BARBERSHOP</small>
          </div>
        </a>

        <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <a href="#services" onClick={() => setMenuOpen(false)}>خدمات و قیمت‌ها</a>
          <a href="#philosophy" onClick={() => setMenuOpen(false)}>رویکرد ما</a>
          <a href="#gallery" onClick={() => setMenuOpen(false)}>محیط استودیو</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>پرسش‌های متداول</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>تماس و نشانی</a>
          <button className="nav-secondary-action" onClick={() => { setMenuOpen(false); setBookingManagementOpen(true) }}>پیگیری یا لغو نوبت</button>
        </nav>

        <div className="nav-actions">
          <button className="button button-ghost manage-button" onClick={() => setBookingManagementOpen(true)}>پیگیری نوبت</button>
          <button className="button button-dark" onClick={() => startBooking()}>رزرو وقت آنلاین <ArrowLeft size={16} /></button>
          <button className="icon-button menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'بستن منو' : 'باز کردن منو'} aria-expanded={menuOpen}><Menu size={20} /></button>
        </div>
      </header>

      <main>
        <section id="hero" className="hero">
          <div className="hero-content">
            <span className="hero-pill"><Sparkles size={14} /> کیفیت بی‌نقص · استاندارد روز جهان</span>
            <h1>استایل شما، اعتبار شماست.</h1>
            <p className="hero-lead">در استودیو شایان، هنر پیرایش کلاسیک را با تکنیک‌های مدرن و استانداردهای روز دنیا تلفیق کرده‌ایم تا تصویری ماندگار، آراسته و برازنده از شما خلق کنیم.</p>
            <div className="hero-cta-group">
              <button className="button button-gold hero-button" onClick={() => startBooking()}>همین حالا نوبت خود را رزرو کنید <ArrowLeft size={18} /></button>
              <a href="#services" className="button button-outline hero-button">مشاهده منوی خدمات</a>
            </div>
            <div className="hero-stats">
              <div className="stat-card"><strong>۹۸٪</strong><span>رضایت مراجعین VIP</span></div>
              <div className="stat-card"><strong>۱۲+</strong><span>سال تجربه تخصصی</span></div>
              <div className="stat-card"><strong>۴.۹ <Star size={14} className="star-icon" fill="currentColor" /></strong><span>امتیاز از بیش از ۱,۲۰۰ نظر</span></div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image-frame">
              <img src="images/shayan-hero.webp" alt="فضای اختصاصی آرایشگاه شایان" className="hero-image" width="1200" height="900" loading="eager" fetchPriority="high" />
              <div className="hero-image-badge"><Scissors size={18} /><span>تخصصی‌ترین مرکز استایلینگ و گریم مردانه</span></div>
            </div>
          </div>
        </section>

        <section id="services" className="services-section">
          <div className="section-head">
            <span className="section-eyebrow">منوی خدمات</span>
            <h2>پیرایش و مراقبت متناسب با شأن شما</h2>
            <p>تمام خدمات با بهترین ابزارهای استریل‌شده و مرغوب‌ترین متریال مراقبتی پوست و مو انجام می‌گیرد.</p>
          </div>
          {catalogMessage && <div className="alert alert-info">{catalogMessage}</div>}
          <div className="services-grid">
            {services.map((service) => (
              <article key={service.id} className="service-card">
                <div className="service-card-header">
                  <span className="service-category">{service.category}</span>
                  <span className="service-price">{service.price}</span>
                </div>
                <h3>{service.name}</h3>
                <p>{service.detail}</p>
                <div className="service-card-footer">
                  <span className="service-duration"><Clock size={15} /> {toPersianDigits(service.duration)} دقیقه</span>
                  <button className="button button-sm button-dark" onClick={() => startBooking(service.id)}>انتخاب این خدمت <ChevronLeft size={16} /></button>
                </div>
              </article>
            ))}
          </div>
          {DEMO_MODE && <p className="price-note">* خدمات و قیمت‌های نمایش‌داده‌شده فعلاً نمونه هستند و پیش از انتشار نهایی با اطلاعات واقعی آرایشگاه جایگزین می‌شوند.</p>}
        </section>

        <section id="philosophy" className="philosophy-section">
          <div className="philosophy-grid">
            <div className="philosophy-card"><div className="philosophy-icon"><User size={24} /></div><h3>مشاوره تخصصی چهره‌شناسی</h3><p>پیش از هر برش، آناتومی چهره، فرم فک و جنس تار مو تحلیل می‌شود تا بهترین فرم به شما پیشنهاد گردد.</p></div>
            <div className="philosophy-card"><div className="philosophy-icon"><Sparkles size={24} /></div><h3>بهداشت در سطح استانداردهای بیمارستانی</h3><p>تمامی تیغه‌ها یک‌بارمصرف بوده و ابزارهای فلزی در دستگاه اتوکلاو فرابنفش استریل می‌شوند.</p></div>
            <div className="philosophy-card"><div className="philosophy-icon"><Clock size={24} /></div><h3>احترام ویژه به زمان شما</h3><p>با سیستم رزرواسیون دقیق، هیچ انتظاری در سالن نخواهید داشت. صندلی شما در ثانیه رزرو حاضر است.</p></div>
          </div>
        </section>

        <section id="faq" className="faq-section">
          <div className="section-head"><span className="section-eyebrow">سؤالات پرتکرار</span><h2>پاسخ به ابهامات پیش از رزرو</h2></div>
          <div className="faq-accordion">
            {[
              { q: 'چگونه می‌توانم نوبت خود را جابه‌جا یا لغو کنم؟', a: 'با استفاده از گزینه "پیگیری نوبت" در بالای صفحه و وارد کردن شماره موبایل و کد رهگیری تا ۴ ساعت پیش از موعد می‌توانید نوبت را تغییر دهید.' },
              { q: 'آیا امکان ارائه خدمات برای داماد و گریم تشریفاتی وجود دارد؟', a: 'بله، پکیج‌های اختصاصی روز داماد شامل پاکسازی چندمرحله‌ای، استایل مو و متعادل‌سازی چهره همراه با پذیرایی ارائه می‌گردد.' },
              { q: 'چقدر قبل از ساعت مقرر باید در سالن حضور داشته باشم؟', a: 'پیشنهاد می‌کنیم ۵ تا ۱۰ دقیقه قبل از ساعت رزرو تشریف بیاورید تا ضمن نوشیدن یک فنجان قهوه، بدون شتاب آماده خدمات شوید.' },
            ].map((faq, index) => (
              <div key={faq.q} className={`faq-item ${faqOpen === index ? 'open' : ''}`}>
                <button className="faq-question" onClick={() => toggleFaq(index)} aria-expanded={faqOpen === index}><span>{faq.q}</span><ChevronDown size={18} className="chevron" /></button>
                {faqOpen === index && <div className="faq-answer"><p>{faq.a}</p></div>}
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="contact-section">
          <div className="contact-box">
            <div className="contact-details">
              <span className="section-eyebrow">دسترسی و نشانی</span>
              <h2>در انتظار دیدارتان هستیم</h2>
              <p>تهران، ولنجک، خیابان چهاردهم، مجتمع تجاری نگین، طبقه دوم، واحد ۲۰۴</p>
              <div className="contact-meta">
                <div><Phone size={16} /> <span>تلفن استودیو: ۰۲۱-۲۲۴۱۸۰۹۰</span></div>
                <div><Clock size={16} /> <span>ساعات کاری: ۱۰:۰۰ الی ۲۱:۰۰ (شنبه تا پنج‌شنبه)</span></div>
                <div><MapPin size={16} /> <span>دارای پارکینگ اختصاصی مراجعین</span></div>
              </div>
            </div>
            <div className="contact-action">
              <button className="button button-gold" onClick={() => startBooking()}>رزرو آنلاین نوبت <ArrowUpLeft size={18} /></button>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <strong>آرایشگاه شایان</strong>
            <p>تلفیق اصالت، کیفیت و سبک نوین پیرایش آقایان در تهران</p>
          </div>
          <div className="footer-links">
            <a href="#services">خدمات</a>
            <a href="#philosophy">درباره ما</a>
            <a href="#faq">پرسش‌ها</a>
            <a href="#contact">نشانی</a>
            <a href="/admin">پنل مدیریت</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {toPersianDigits(new Date().getFullYear())} تمامی حقوق متعلق به استودیو پیرایش شایان است. طراحی و توسعه توسط <a href="https://pooya-labs.github.io" target="_blank" rel="noopener noreferrer">Pooya Labs</a>.</p>
        </div>
      </footer>

      {bookingOpen && <BookingWizard onClose={() => setBookingOpen(false)} initialServiceId={initialServiceId} services={services} demoMode={DEMO_MODE} salonTimezone={salonTimezone} />}
      {bookingManagementOpen && <BookingManagement onClose={() => setBookingManagementOpen(false)} demoMode={DEMO_MODE} />}
      <div className="mobile-book-bar"><span><strong>وقت خودت رو رزرو کن</strong><small>سریع، ساده، آنلاین</small></span><button className="button button-dark" onClick={() => startBooking()}>رزرو نوبت <ChevronLeft size={17} /></button></div>
    </div>
  )
}

export default App
