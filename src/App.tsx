import { useEffect, useMemo, useState } from 'react'
import { AdminApp } from './Admin'
import {
  ArrowLeft, ArrowUpLeft, Check, ChevronLeft, ChevronRight,
  Clock3, Instagram, MapPin, Menu, Phone, Scissors, ShieldCheck,
  Sparkles, Star, UserRound, X,
} from 'lucide-react'

type Service = {
  id: string
  name: string
  detail: string
  duration: number
  price: string
}

type BookingDraft = {
  serviceId: string
  date: string
  time: string
  name: string
  phone: string
}

const demoServices: Service[] = [
  { id: 'cut', name: 'کوتاهی و فرم‌دهی', detail: 'متناسب با فرم چهره و سلیقه شما', duration: 45, price: 'از ۳۵۰ هزار' },
  { id: 'trim', name: 'اصلاح و مرتب‌سازی', detail: 'جزئیات دقیق، نتیجه تمیز', duration: 30, price: 'از ۲۵۰ هزار' },
  { id: 'complete', name: 'پکیج کامل', detail: 'یک تجربه کامل برای رسیدگی به استایل', duration: 75, price: 'از ۵۵۰ هزار' },
]

const DEMO_MODE = import.meta.env.MODE !== 'production'

type ApiService = {
  id: string
  name: string
  description: string
  durationMinutes: number
  priceAmount: number
  priceCurrency: string
}

const toPersianDigits = (value: string | number) =>
  String(value).replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])

const priceLabel = (amount: number, currency: string) => {
  if (amount <= 0) return 'قیمت توافقی'
  const unit = currency === 'IRR' ? 'ریال' : currency
  return `${new Intl.NumberFormat('fa-IR').format(amount)} ${unit}`
}

const dateKeyInTimezone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const faqs = [
  { q: 'چطور نوبتم را رزرو کنم؟', a: 'خدمت و زمان دلخواهتان را انتخاب کنید و اطلاعات تماس را وارد کنید. جزئیات نهایی رزرو پیش از ثبت نمایش داده می‌شود.' },
  { q: 'اگر بخواهم زمان نوبتم را تغییر بدهم چه؟', a: 'پس از فعال‌شدن سامانه، با کد پیگیری رزرو می‌توانید وضعیت نوبت را بررسی کنید. قوانین تغییر زمان پیش از انتشار نهایی اعلام می‌شود.' },
  { q: 'چقدر زودتر باید در محل حاضر باشم؟', a: 'پیشنهاد می‌کنیم حدود پنج دقیقه پیش از زمان رزرو در استودیو باشید.' },
]

const timeSlots = ['09:00', '09:45', '10:30', '11:15', '12:00', '12:45', '14:00', '14:45', '15:30', '16:15', '17:00', '17:45']
const unavailableSlots = new Set(['10:30', '12:45'])

const normalizeDigits = (value: string) =>
  value.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))

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
    serviceId: initialServiceId ?? '',
    date: '',
    time: '',
    name: '',
    phone: '',
  })
  const [error, setError] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsMessage, setSlotsMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [bookingReference, setBookingReference] = useState<string | null>(null)

  const dates = useMemo(() => {
    const timezone = salonTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    const todayKey = dateKeyInTimezone(new Date(), timezone)
    const [year, month, day] = todayKey.split('-').map(Number)
    const jalaliWeekday = new Intl.DateTimeFormat('fa-IR', { weekday: 'short', timeZone: 'UTC' })
    const jalaliDay = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', timeZone: 'UTC' })
    const jalaliMonth = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'short', timeZone: 'UTC' })
    const jalaliFull = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
    })

    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(Date.UTC(year, month - 1, day + index, 12))
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
      return {
        key,
        weekday: jalaliWeekday.format(date),
        day: jalaliDay.format(date),
        month: jalaliMonth.format(date),
        full: jalaliFull.format(date),
      }
    })
  }, [salonTimezone])

  useEffect(() => {
    if (step !== 1 || !draft.date || !draft.serviceId) return

    if (demoMode) {
      setAvailableSlots([])
      setSlotsMessage('')
      setSlotsLoading(false)
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
        setAvailableSlots(Array.isArray(payload.slots) ? payload.slots : [])
      } catch (loadError) {
        if (controller.signal.aborted) return
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
    if (step === 1 && (!draft.date || !draft.time)) {
      setError('لطفاً تاریخ و ساعت دلخواهتان را انتخاب کنید.')
      return
    }
    if (step === 2) {
      const phone = normalizeDigits(draft.phone).replace(/[\s()-]/g, '')
      if (draft.name.trim().length < 2) {
        setError('لطفاً نام و نام خانوادگی را وارد کنید.')
        return
      }
      if (!/^\+?[0-9]{10,15}$/.test(phone)) {
        setError('شماره تماس را با کد کشور یا به‌صورت کامل وارد کنید.')
        return
      }
      setDraft((current) => ({ ...current, phone }))
    }
    setStep((current) => Math.min(current + 1, 3))
  }

  const goBack = () => {
    setError('')
    setStep((current) => Math.max(current - 1, 0))
  }

  const confirmBooking = async () => {
    if (demoMode) {
      onClose()
      return
    }
    if (submitting || bookingReference) return
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/public/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          serviceId: draft.serviceId,
          date: draft.date,
          time: draft.time,
          name: draft.name.trim(),
          phone: normalizeDigits(draft.phone).replace(/[\\s()-]/g, ''),
        }),
      })
      const payload = await response.json() as {
        booking?: { reference?: string }
        message?: string
      }
      if (!response.ok || !payload.booking?.reference) {
        throw new Error(payload.message ?? 'ثبت نوبت انجام نشد. دوباره تلاش کنید.')
      }
      setBookingReference(payload.booking.reference)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ثبت نوبت انجام نشد.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="booking-flow-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="booking-flow" role="dialog" aria-modal="true" aria-labelledby="booking-flow-title">
        <header className="booking-flow-header">
          <div className="booking-flow-brand">
            <span className="brand-mark"><Scissors size={18} /></span>
            <span><strong>رزرو نوبت</strong><small>FORM STUDIO · BOOKING</small></span>
          </div>
          <button className="icon-button" aria-label="بستن پنجره رزرو" onClick={onClose}><X size={19} /></button>
        </header>

        <div className="booking-flow-progress" aria-label={`مرحله ${step + 1} از ۴`}>
          {['خدمت', 'زمان', 'مشخصات', 'بازبینی'].map((label, index) => (
            <div className={index <= step ? 'flow-progress-step is-active' : 'flow-progress-step'} key={label}>
              <span>{index < step ? <Check size={13} /> : `۰${index + 1}`}</span>
              <small>{label}</small>
            </div>
          ))}
        </div>

        <div className="booking-flow-body">
          {step === 0 && (
            <div className="booking-step">
              <div className="eyebrow"><span className="eyebrow-line" /> STEP 01 · SERVICE</div>
              <h2 id="booking-flow-title">چه خدمتی مدنظرتونه؟</h2>
              <p className="booking-step-intro">خدمت موردنظرتان را انتخاب کنید تا زمان مناسب را پیدا کنیم.</p>
              {services.length > 0 ? <div className="booking-service-options">
                {services.map((service, index) => (
                  <button type="button" className={draft.serviceId === service.id ? 'booking-service-option is-selected' : 'booking-service-option'} key={service.id} onClick={() => updateDraft('serviceId', service.id)}>
                    <span className="booking-service-number">۰{index + 1}</span>
                    <span className="booking-service-copy"><strong>{service.name}</strong><small>{service.detail}</small><small className="booking-service-meta"><Clock3 size={13} /> {service.duration} دقیقه <i /> {service.price}</small></span>
                    <span className="booking-radio">{draft.serviceId === service.id && <span />}</span>
                  </button>
                ))}
              </div> : <p className="booking-inline-state">فهرست خدمات هنوز در سامانه ثبت نشده است.</p>}
              <p className="booking-demo-note"><ShieldCheck size={14} /> {demoMode ? 'قیمت‌ها و خدمات فعلی نمونه‌اند و پیش از راه‌اندازی نهایی تأیید می‌شوند.' : 'خدمات و قیمت‌ها از سامانه استودیو دریافت می‌شوند.'}</p>
            </div>
          )}

          {step === 1 && (
            <div className="booking-step">
              <div className="eyebrow"><span className="eyebrow-line" /> STEP 02 · DATE & TIME</div>
              <h2 id="booking-flow-title">چه زمانی براتون مناسبه؟</h2>
              <p className="booking-step-intro">روز و ساعت دلخواهتان را انتخاب کنید.</p>
              <div className="booking-date-heading"><strong>انتخاب روز</strong><span>۱۴ روز آینده</span></div>
              <div className="booking-date-list">
                {dates.map((date, index) => (
                  <button type="button" key={date.key} className={draft.date === date.key ? 'booking-date-option is-selected' : 'booking-date-option'} onClick={() => { updateDraft('date', date.key); updateDraft('time', '') }}>
                    <small>{index === 0 ? 'امروز' : date.weekday}</small>
                    <strong>{date.day}</strong>
                    <small>{date.month}</small>
                  </button>
                ))}
              </div>
              <div className="booking-date-heading booking-time-heading"><strong>ساعت‌های قابل انتخاب</strong><span>{selectedDate?.full ?? 'ابتدا روز را انتخاب کنید'}</span></div>
              {!draft.date && <p className="booking-inline-state">ابتدا یک روز را انتخاب کنید.</p>}
              {draft.date && slotsLoading && <p className="booking-inline-state"><span className="booking-spinner" /> در حال بررسی زمان‌های آزاد…</p>}
              {draft.date && slotsMessage && <p className="booking-inline-state is-error">{slotsMessage}</p>}
              {draft.date && !slotsLoading && !slotsMessage && (
                <div className="booking-time-grid">
                  {(demoMode ? timeSlots : availableSlots).map((time) => {
                    const unavailable = demoMode && unavailableSlots.has(time)
                    return <button type="button" key={time} disabled={unavailable} className={draft.time === time ? 'booking-time-option is-selected' : 'booking-time-option'} onClick={() => updateDraft('time', time)}>{toPersianDigits(time)}{unavailable && <small>پر</small>}</button>
                  })}
                </div>
              )}
              {draft.date && !slotsLoading && !slotsMessage && !demoMode && availableSlots.length === 0 && <p className="booking-inline-state">برای این روز زمان آزادی ثبت نشده است.</p>}
              <p className="booking-demo-note"><Clock3 size={14} /> {demoMode ? 'ساعت‌ها در این پیش‌نمایش نمونه هستند.' : 'زمان‌های نمایش‌داده‌شده از برنامه کاری استودیو محاسبه شده‌اند.'}</p>
            </div>
          )}

          {step === 2 && (
            <div className="booking-step">
              <div className="eyebrow"><span className="eyebrow-line" /> STEP 03 · YOUR DETAILS</div>
              <h2 id="booking-flow-title">چطور صداتون کنیم؟</h2>
              <p className="booking-step-intro">برای پیگیری نوبت، اطلاعات تماس را وارد کنید.</p>
              <label className="booking-field"><span><UserRound size={15} /> نام و نام خانوادگی</span><input autoComplete="name" value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} placeholder="مثلاً پویا رضایی" /></label>
              <label className="booking-field"><span><Phone size={15} /> شماره تماس</span><input inputMode="tel" autoComplete="tel" value={draft.phone} onChange={(event) => updateDraft('phone', event.target.value)} placeholder="شماره موبایل یا تلفن همراه با کد کشور" /></label>
              <div className="booking-privacy-note"><ShieldCheck size={18} /><span><strong>اطلاعات شما محرمانه می‌ماند.</strong><small>در نسخه نهایی، اطلاعات فقط برای مدیریت و پیگیری همین نوبت استفاده می‌شود.</small></span></div>
            </div>
          )}

          {step === 3 && !bookingReference && (
            <div className="booking-step">
              <div className="eyebrow"><span className="eyebrow-line" /> STEP 04 · REVIEW</div>
              <h2 id="booking-flow-title">همه‌چیز آماده‌ست؟</h2>
              <p className="booking-step-intro">جزئیات انتخابتان را یک بار بررسی کنید.</p>
              <div className="booking-review-card">
                <div className="booking-review-top"><span className="review-mark"><Scissors size={18} /></span><span><small>FORM STUDIO</small><strong>خلاصه انتخاب شما</strong></span><span className="review-preview-label">{demoMode ? 'پیش‌نمایش' : 'بازبینی'}</span></div>
                <div className="booking-review-row"><span>خدمت</span><strong>{selectedService?.name}</strong></div>
                <div className="booking-review-row"><span>تاریخ</span><strong>{selectedDate?.full}</strong></div>
                <div className="booking-review-row"><span>ساعت</span><strong>{draft.time}</strong></div>
                <div className="booking-review-row"><span>مدت تقریبی</span><strong>{selectedService?.duration} دقیقه</strong></div>
                <div className="booking-review-row"><span>نام</span><strong>{draft.name}</strong></div>
                <div className="booking-review-row"><span>شماره تماس</span><strong dir="ltr">{draft.phone}</strong></div>
              </div>
              <div className="booking-preview-warning"><ShieldCheck size={17} /><span><strong>{demoMode ? 'این یک پیش‌نمایش تعاملی است.' : 'پیش از ثبت نهایی بررسی کنید.'}</strong><small>{demoMode ? 'هنوز نوبتی ثبت نشده و اطلاعات شما به سرور ارسال نمی‌شود.' : 'با انتخاب ثبت نوبت، اطلاعات ضروری برای ایجاد رزرو به سامانه استودیو ارسال می‌شود.'}</small></span></div>
            </div>
          )}

          {step === 3 && bookingReference && (
            <div className="booking-step booking-success">
              <div className="booking-success-icon"><Check size={28} /></div>
              <div className="eyebrow"><span className="eyebrow-line" /> BOOKING REQUESTED</div>
              <h2 id="booking-flow-title">درخواست نوبت ثبت شد.</h2>
              <p className="booking-step-intro">کد پیگیری را نگه دارید تا بعداً بتوانید نوبت خود را بررسی کنید.</p>
              <div className="booking-reference-card">
                <small>کد پیگیری رزرو</small>
                <strong dir="ltr">{bookingReference}</strong>
                <button type="button" onClick={() => { void navigator.clipboard?.writeText(bookingReference) }}>کپی کد</button>
              </div>
              <div className="booking-preview-warning"><ShieldCheck size={17} /><span><strong>وضعیت درخواست: در انتظار تأیید</strong><small>این درخواست در سامانه ثبت شده است. جزئیات تأیید نهایی باید از پنل مدیریت پیگیری شود.</small></span></div>
            </div>
          )}

          {error && <p className="booking-form-error" role="alert">{error}</p>}
        </div>

        <footer className="booking-flow-footer">
          {step > 0 ? <button className="booking-back-button" onClick={goBack}><ChevronRight size={16} /> مرحله قبل</button> : <span className="booking-footer-caption">ساده، شفاف و در چند قدم</span>}
          {step < 3 ? <button className="button button-dark" onClick={goNext}>ادامه <ArrowLeft size={16} /></button> : <button className="button button-dark" onClick={bookingReference ? onClose : confirmBooking} disabled={submitting}>{bookingReference ? 'پایان' : demoMode ? 'پایان پیش‌نمایش' : submitting ? 'در حال ثبت…' : 'ثبت نوبت'} <Check size={16} /></button>}
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
  const [initialServiceId, setInitialServiceId] = useState<string | undefined>()
  const [services, setServices] = useState<Service[]>(DEMO_MODE ? demoServices : [])
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
          duration: service.durationMinutes,
          price: priceLabel(service.priceAmount, service.priceCurrency),
        }))
        setServices(loadedServices)
        setSalonTimezone(configResponse.ok && configPayload.configured ? configPayload.timezone ?? null : null)
        setCatalogMessage(loadedServices.length ? '' : 'هنوز خدمتی برای رزرو در سامانه ثبت نشده است.')
      } catch (loadError) {
        if (controller.signal.aborted) return
        setCatalogMessage(loadError instanceof Error ? loadError.message : 'اتصال به سامانه رزرو ممکن نیست.')
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

  return (
    <div className="site-shell">
      <div className="announcement"><span className="status-dot" /> {DEMO_MODE ? 'پیش‌نمایش طراحی · سامانه رزرو در حال توسعه است' : 'سامانه نوبت‌دهی آنلاین'} <span className="announcement-separator">✳</span> فرم استودیو</div>
      <header className="site-header">
        <a className="brand" href="#home" aria-label="صفحه اصلی استودیو">
          <span className="brand-mark"><Scissors size={20} strokeWidth={1.5} /></span>
          <span><strong>فُرم</strong><small>استودیو مراقبت و استایل</small></span>
        </a>
        <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="ناوبری اصلی">
          <a href="#services" onClick={() => setMenuOpen(false)}>خدمات</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>درباره استودیو</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>سؤالات متداول</a>
        </nav>
        <div className="header-actions">
          <a className="owner-link" href={DEMO_MODE ? '?admin=1' : '/admin'}>پنل مدیریت</a>
          <button className="button button-dark button-small header-book" onClick={() => startBooking()}>رزرو نوبت <ArrowLeft size={15} /></button>
          <button className="icon-button menu-toggle" aria-label={menuOpen ? 'بستن منو' : 'باز کردن منو'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      <main>
        <section className="hero section-wrap" id="home">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> THE ART OF PERSONAL STYLE</div>
            <h1>استایل شما،<br /><em>امضای شماست.</em></h1>
            <p className="hero-description">برای لحظه‌ای مکث کنید. ما اینجاییم تا با دقت، سلیقه و توجه به جزئیات، تجربه‌ای خوشایند از رسیدگی به استایل شخصی‌تان بسازیم.</p>
            <div className="hero-actions">
              <button className="button button-dark" onClick={() => startBooking()}>انتخاب زمان و رزرو <ArrowLeft size={17} /></button>
              <a className="text-link" href="#services">مشاهده خدمات <ArrowUpLeft size={16} /></a>
            </div>
            <div className="hero-proof"><div className="proof-icon"><Star size={16} /></div><div><strong>توجه به جزئیات</strong><span>از انتخاب خدمت تا پایان تجربه</span></div><span className="proof-divider" /><div><strong>رزرو آسان</strong><span>بدون تماس و انتظار</span></div></div>
          </div>
          <div className="hero-art" aria-label="تصویر انتزاعی و هنری استودیو">
            <div className="art-grain" />
            <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
            <div className="art-sculpture"><div className="sculpture-light" /><div className="sculpture-shadow" /></div>
            <div className="art-caption"><span>01 / THE STUDIO</span><span>CRAFTED WITH INTENTION</span></div>
            <div className="art-stamp"><Sparkles size={16} /><span>EST.<br />WITH CARE</span></div>
          </div>
          <div className="hero-side-note">A LITTLE TIME FOR YOURSELF <span>—</span> FORM STUDIO</div>
        </section>

        <section className="trust-strip"><div><span className="trust-number">۰۱</span><span>انتخاب آسان خدمت</span></div><div><span className="trust-number">۰۲</span><span>زمان‌بندی شفاف</span></div><div><span className="trust-number">۰۳</span><span>رزرو در چند قدم</span></div><div><span className="trust-number">۰۴</span><span>توجه به وقت شما</span></div></section>

        <section className="services-section section-wrap" id="services">
          <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> WHAT WE DO</div><h2>خدماتی برای <em>حالِ بهتر.</em></h2></div><p>هر خدمت با توجه به نیاز شما و با دقت به جزئیات ارائه می‌شود. خدمت موردنظرتان را انتخاب کنید.</p></div>
          {services.length > 0 ? <div className="service-grid">{services.map((service, index) => <article className="service-card" key={service.id}><div className="service-top"><span className="service-index">{toPersianDigits(String(index + 1).padStart(2, '0'))}</span><span className="service-icon"><Scissors size={19} strokeWidth={1.4} /></span></div><h3>{service.name}</h3><p>{service.detail}</p><div className="service-meta"><span><Clock3 size={14} />{toPersianDigits(service.duration)} دقیقه</span><strong>{service.price}</strong></div><button className="service-cta" onClick={() => startBooking(service.id)}>رزرو این خدمت <ArrowLeft size={15} /></button></article>)}</div> : <p className="service-empty">{catalogMessage || 'در حال دریافت فهرست خدمات…'}</p>}
          {DEMO_MODE && <p className="price-note">* خدمات و قیمت‌های نمایش‌داده‌شده فعلاً نمونه هستند و پیش از انتشار نهایی با اطلاعات واقعی آرایشگاه جایگزین می‌شوند.</p>}
        </section>

        <section className="manifesto" id="about"><div className="manifesto-mark">“</div><div className="manifesto-content"><div className="eyebrow eyebrow-light"><span className="eyebrow-line" /> OUR PHILOSOPHY</div><h2>کیفیت، در جزئیات<br /><em>خودش را نشان می‌دهد.</em></h2><p>قرار نیست تجربه‌ای پیچیده داشته باشید. از لحظه انتخاب زمان تا وقتی که با رضایت از استودیو بیرون می‌روید، همه‌چیز باید ساده، دقیق و خوشایند باشد.</p><span className="manifesto-signature">FORM STUDIO — A PERSONAL EXPERIENCE</span></div><div className="manifesto-graphic"><div className="manifesto-ring" /><div className="manifesto-core"><Sparkles size={28} /></div></div></section>

        <section className="booking-banner section-wrap"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR TIME, YOUR STYLE</div><h2>وقتِ خودتان را<br /><em>برای خودتان رزرو کنید.</em></h2><p>زمان مناسب را انتخاب کنید؛ بقیه مسیر ساده است.</p></div><button className="button button-dark" onClick={() => startBooking()}>شروع رزرو <ArrowLeft size={17} /></button><div className="banner-decoration">F.</div></section>

        <section className="faq-section section-wrap" id="faq"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> GOOD TO KNOW</div><h2>سؤال‌های <em>شما.</em></h2></div><p>اگر پیش از رزرو سؤالی دارید، شاید پاسخ آن را اینجا پیدا کنید.</p></div><div className="faq-list">{faqs.map((faq, i) => <div className={faqOpen === i ? 'faq-item active' : 'faq-item'} key={faq.q}><button onClick={() => setFaqOpen(faqOpen === i ? null : i)} aria-expanded={faqOpen === i}><span className="faq-index">۰{i + 1}</span><strong>{faq.q}</strong><span className="faq-plus">{faqOpen === i ? '−' : '+'}</span></button>{faqOpen === i && <p>{faq.a}</p>}</div>)}</div></section>

        <section className="contact-strip section-wrap"><div><div className="eyebrow"><span className="eyebrow-line" /> COME SAY HELLO</div><h2>مشتاق دیدار شما هستیم.</h2></div><div className="contact-items"><span><MapPin size={16} /> آدرس استودیو به‌زودی</span><span><Clock3 size={16} /> ساعات کاری قابل مشاهده هنگام رزرو</span><a href="https://instagram.com/" target="_blank" rel="noreferrer"><Instagram size={16} /> اینستاگرام</a></div></section>
      </main>

      <footer className="site-footer"><a className="footer-brand" href="#home"><span className="brand-mark"><Scissors size={18} /></span><strong>فُرم</strong></a><span className="footer-note">یک تجربه شخصی، با دقت و سلیقه.</span><span className="footer-credit">Crafted with care by <strong>Pooya</strong> <span>© ۲۰۲۶</span></span></footer>

      {bookingOpen && <BookingWizard onClose={() => setBookingOpen(false)} initialServiceId={initialServiceId} services={services} demoMode={DEMO_MODE} salonTimezone={salonTimezone} />}
      <div className="mobile-book-bar"><span><strong>وقت خودت رو رزرو کن</strong><small>سریع، ساده، آنلاین</small></span><button className="button button-dark" onClick={() => startBooking()}>رزرو نوبت <ChevronLeft size={17} /></button></div>
    </div>
  )
}

export default App
