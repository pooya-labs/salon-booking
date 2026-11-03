import { useState } from 'react'
import {
  ArrowLeft, ArrowUpLeft, CalendarDays, Check, ChevronLeft, Clock3,
  Instagram, MapPin, Menu, Scissors, ShieldCheck, Sparkles, Star,
  X,
} from 'lucide-react'

const services = [
  { name: 'کوتاهی و فرم‌دهی', detail: 'متناسب با فرم چهره و سلیقه شما', duration: '۴۵ دقیقه', price: 'از ۳۵۰ هزار' },
  { name: 'اصلاح و مرتب‌سازی', detail: 'جزئیات دقیق، نتیجه تمیز', duration: '۳۰ دقیقه', price: 'از ۲۵۰ هزار' },
  { name: 'پکیج کامل', detail: 'یک تجربه کامل برای رسیدگی به استایل', duration: '۷۵ دقیقه', price: 'از ۵۵۰ هزار' },
]

const faqs = [
  { q: 'چطور نوبتم را رزرو کنم؟', a: 'خدمت و زمان دلخواهتان را انتخاب کنید و اطلاعات تماس را وارد کنید. جزئیات نهایی رزرو نمایش داده می‌شود.' },
  { q: 'اگر بخواهم زمان نوبتم را تغییر بدهم چه؟', a: 'با کد پیگیری رزرو می‌توانید وضعیت نوبت را بررسی کنید. قوانین تغییر زمان در زمان نهایی‌سازی اعلام می‌شود.' },
  { q: 'چقدر زودتر باید در محل حاضر باشم؟', a: 'پیشنهاد می‌کنیم حدود پنج دقیقه پیش از زمان رزرو در استودیو باشید.' },
]

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  const [bookingOpen, setBookingOpen] = useState(false)

  const startBooking = () => setBookingOpen(true)

  return (
    <div className="site-shell">
      <div className="announcement"><span className="status-dot" /> رزرو آنلاین؛ هر زمان که برای شما مناسب است <span className="announcement-separator">✳</span> تجربه‌ای با دقت و آرامش</div>
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
          <a className="owner-link" href="/admin">ورود مدیریت</a>
          <button className="button button-dark button-small header-book" onClick={startBooking}>رزرو نوبت <ArrowLeft size={15} /></button>
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
              <button className="button button-dark" onClick={startBooking}>انتخاب زمان و رزرو <ArrowLeft size={17} /></button>
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
          <div className="service-grid">{services.map((service, index) => <article className="service-card" key={service.name}><div className="service-top"><span className="service-index">۰{index + 1}</span><span className="service-icon"><Scissors size={19} strokeWidth={1.4} /></span></div><h3>{service.name}</h3><p>{service.detail}</p><div className="service-meta"><span><Clock3 size={14} />{service.duration}</span><strong>{service.price}</strong></div><button className="service-cta" onClick={startBooking}>رزرو این خدمت <ArrowLeft size={15} /></button></article>)}</div>
          <p className="price-note">* خدمات و قیمت‌های نمایش‌داده‌شده فعلاً نمونه هستند و پیش از انتشار نهایی با اطلاعات واقعی آرایشگاه جایگزین می‌شوند.</p>
        </section>

        <section className="manifesto" id="about"><div className="manifesto-mark">“</div><div className="manifesto-content"><div className="eyebrow eyebrow-light"><span className="eyebrow-line" /> OUR PHILOSOPHY</div><h2>کیفیت، در جزئیات<br /><em>خودش را نشان می‌دهد.</em></h2><p>قرار نیست تجربه‌ای پیچیده داشته باشید. از لحظه انتخاب زمان تا وقتی که با رضایت از استودیو بیرون می‌روید، همه‌چیز باید ساده، دقیق و خوشایند باشد.</p><span className="manifesto-signature">FORM STUDIO — A PERSONAL EXPERIENCE</span></div><div className="manifesto-graphic"><div className="manifesto-ring" /><div className="manifesto-core"><Sparkles size={28} /></div></div></section>

        <section className="booking-banner section-wrap"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR TIME, YOUR STYLE</div><h2>وقتِ خودتان را<br /><em>برای خودتان رزرو کنید.</em></h2><p>زمان مناسب را انتخاب کنید؛ بقیه مسیر ساده است.</p></div><button className="button button-dark" onClick={startBooking}>شروع رزرو <ArrowLeft size={17} /></button><div className="banner-decoration">F.</div></section>

        <section className="faq-section section-wrap" id="faq"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> GOOD TO KNOW</div><h2>سؤال‌های <em>شما.</em></h2></div><p>اگر پیش از رزرو سؤالی دارید، شاید پاسخ آن را اینجا پیدا کنید.</p></div><div className="faq-list">{faqs.map((faq, i) => <div className={faqOpen === i ? 'faq-item active' : 'faq-item'} key={faq.q}><button onClick={() => setFaqOpen(faqOpen === i ? null : i)} aria-expanded={faqOpen === i}><span className="faq-index">۰{i + 1}</span><strong>{faq.q}</strong><span className="faq-plus">{faqOpen === i ? '−' : '+'}</span></button>{faqOpen === i && <p>{faq.a}</p>}</div>)}</div></section>

        <section className="contact-strip section-wrap"><div><div className="eyebrow"><span className="eyebrow-line" /> COME SAY HELLO</div><h2>مشتاق دیدار شما هستیم.</h2></div><div className="contact-items"><span><MapPin size={16} /> آدرس استودیو به‌زودی</span><span><Clock3 size={16} /> ساعات کاری قابل مشاهده هنگام رزرو</span><a href="https://instagram.com/" target="_blank" rel="noreferrer"><Instagram size={16} /> اینستاگرام</a></div></section>
      </main>

      <footer className="site-footer"><a className="footer-brand" href="#home"><span className="brand-mark"><Scissors size={18} /></span><strong>فُرم</strong></a><span className="footer-note">یک تجربه شخصی، با دقت و سلیقه.</span><span className="footer-credit">Crafted with care by <strong>Pooya</strong> <span>© ۲۰۲۶</span></span></footer>

      {bookingOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBookingOpen(false) }}><section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title"><button className="icon-button modal-close" aria-label="بستن" onClick={() => setBookingOpen(false)}><X /></button><div className="modal-icon"><CalendarDays size={23} /></div><div className="eyebrow"><span className="eyebrow-line" /> BOOK YOUR MOMENT</div><h2 id="booking-title">رزرو نوبت به‌زودی</h2><p>در حال آماده‌سازی سیستم رزرو آنلاین هستیم. به‌زودی می‌توانید خدمت، روز و ساعت دلخواهتان را همین‌جا انتخاب کنید.</p><div className="modal-progress"><span /><span /><span /></div><small><ShieldCheck size={14} /> اطلاعات و زمان‌های رزرو با دقت مدیریت می‌شوند.</small><button className="button button-dark modal-ok" onClick={() => setBookingOpen(false)}>متوجه شدم <Check size={16} /></button></section></div>}
      <div className="mobile-book-bar"><span><strong>وقت خودت رو رزرو کن</strong><small>سریع، ساده، آنلاین</small></span><button className="button button-dark" onClick={startBooking}>رزرو نوبت <ChevronLeft size={17} /></button></div>
    </div>
  )
}

export default App
