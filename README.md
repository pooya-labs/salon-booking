# Shayan Barber Booking

A booking website and owner dashboard built for Shayan Barber Studio. Customers can check services, choose an available time and manage an appointment. The owner handles the schedule and bookings from a separate workspace.

**Version:** 1.0.0  
**Released:** 5 November 2026  
**Status:** Live · maintenance  
**Built by:** Pooya Goodarzi  
**Repository:** [pooya-labs/salon-booking](https://github.com/pooya-labs/salon-booking)

| | |
|---|---|
| Website | [Open the booking site](https://pooya-labs.github.io/salon-booking/) |
| Owner workspace | [Open management](https://pooya-labs.github.io/salon-booking/?admin=1) |
| Release notes | [v1.0.0](https://github.com/pooya-labs/salon-booking/releases/tag/v1.0.0) |

## What is included

### For customers
- A Persian, right-to-left booking experience for phones and desktop.
- Service details, prices and appointment durations.
- Live availability based on the salon's working hours and existing reservations.
- Booking confirmation with a reference code.
- Appointment lookup and cancellation using the details provided when the booking was made.

### For the salon owner
- A private sign-in area for managing the business.
- A booking list with date and status filters, plus a daily calendar.
- Service management: descriptions, prices, durations and visibility.
- Weekly opening hours, breaks, holiday closures and one-off schedule changes.
- Manual time blocks for appointments arranged by phone or in person.
- Push notifications on registered manager devices. Email alerts are optional and off by default.

The calendar uses the **Asia/Tehran** timezone. Dates are shown in the Jalali calendar, while the API uses Gregorian dates and 24-hour local times.

## How the live site works

The production version uses four services:

1. **GitHub Pages** serves the website and owner workspace.
2. A hidden iframe connects the frontend to the salon's **Google Apps Script** web app.
3. Apps Script handles booking requests and stores records in a **private Google Spreadsheet** owned by the salon.
4. **Firebase Cloud Messaging** delivers push notifications to the manager's registered browser or PWA.

The Apps Script web app runs under the deploying owner's Google account. Its web app address and the private spreadsheet are part of the live setup; they should not be replaced casually.

Cloudflare Workers and D1 are not used by the current production site. Their source and migrations remain in the repository as older recovery material. There is no automatic transfer from D1 to Google Sheets.

## Running the project

The project uses Node.js 22 and npm.

    npm install
    npm run dev

The local app uses sample data unless VITE_SALON_RELAY_URL is configured. Sample mode is for development only. Do not enter real customer details there.

Before opening a pull request, run the checks relevant to your change:

    npm run lint
    npm run test:unit
    npm run test:migrations
    npm run build
    npm run build:pages

The browser checks used by CI are also available through npm run test:browser and npm run test:browser:admin. They require the Playwright browser tooling installed by the workflow.

## Deployment

A push to main starts the GitHub Pages workflow. The build reads the repository Actions variable SALON_RELAY_URL and the public Firebase web configuration variables. If the relay URL is missing, the published build falls back to demo mode; it must not be used to accept real bookings.

The Apps Script project and spreadsheet belong to the salon owner and are managed separately from GitHub. See the deployment guide before creating a new instance or changing the existing one.

## Project notes

Version 1.0.0 was accepted by the salon owner on 5 November 2026. The project is now maintained rather than actively expanded. Future changes should address a reproducible bug, a security concern or a necessary compatibility update.

The latest Pages workflow completed the deployment and its read-only Apps Script relay check successfully. That check does not create bookings or modify customer records.

## Documentation

- [Release scope and verification](./ROADMAP.md)
- [Current project state and handoff](./docs/PROJECT-STATE.md)
- [Owner workspace guide](./docs/ADMIN.md)
- [API reference](./docs/API.md)
- [Deployment guide](./docs/DEPLOYMENT.md)
- [GitHub Pages and Apps Script setup](./docs/GITHUB-PAGES-RELAY.md)
- [Privacy and data handling](./docs/PRIVACY-OPERATIONS.md)
- [Security notes and remaining risks](./docs/SECURITY-THREAT-MODEL.md)

## راهنمای فارسی

**سامانه رزرو نوبت شایان** برای مجموعهٔ شایان باربر ساخته شده است. مشتری‌ها می‌توانند خدمات را ببینند، زمان‌های آزاد را بررسی کنند و نوبت خود را به‌صورت آنلاین ثبت یا پیگیری کنند. مدیریت برنامهٔ کاری و نوبت‌ها هم از پنل اختصاصی مجموعه انجام می‌شود.

- **نسخه:** ۱.۰.۰
- **تاریخ انتشار:** ۱۴ آبان ۱۴۰۵
- **وضعیت:** منتشرشده و فعال؛ در حال نگهداری
- **طراحی و توسعه:** پویا گودرزی
- **وب‌سایت:** [ورود به سامانه رزرو](https://pooya-labs.github.io/salon-booking/)
- **پنل مدیریت:** [ورود به پنل مدیریت](https://pooya-labs.github.io/salon-booking/?admin=1)
- **مخزن گیت‌هاب:** [pooya-labs/salon-booking](https://github.com/pooya-labs/salon-booking)

### امکانات مشتریان
- مشاهدهٔ خدمات، توضیحات، قیمت و مدت‌زمان هر خدمت
- نمایش زمان‌های آزاد بر اساس برنامهٔ واقعی مجموعه
- ثبت نوبت و دریافت کد پیگیری
- مشاهده یا لغو نوبت با استفاده از اطلاعات پیگیری

### امکانات پنل مدیریت
- مشاهده و مدیریت نوبت‌ها در فهرست و تقویم روزانه
- تأیید، لغو و ثبت وضعیت نهایی نوبت‌ها
- تعریف خدمات و ویرایش قیمت، مدت‌زمان و توضیحات
- تنظیم ساعات کاری هفتگی، زمان استراحت و تعطیلی‌ها
- مسدود کردن زمان‌های رزروشده از طریق تماس یا مراجعهٔ حضوری
- دریافت اعلان روی دستگاه مدیر از طریق Firebase

تقویم با منطقهٔ زمانی تهران کار می‌کند و تاریخ‌ها را به شمسی نمایش می‌دهد. زمان‌ها در قالب ۲۴ ساعته هستند.

### ساختار فنی نسخهٔ فعال

وب‌سایت و پنل مدیریت روی GitHub Pages قرار دارند. درخواست‌های رزرو از طریق یک پل ارتباطی به Google Apps Script فرستاده می‌شوند و اطلاعات در یک فایل خصوصی Google Sheets ذخیره می‌شوند. اعلان‌های مدیر هم با Firebase Cloud Messaging ارسال می‌شوند.

**Cloudflare Workers و D1 در نسخهٔ فعال استفاده نمی‌شوند.** فایل‌های مربوط به آن‌ها فقط برای نگهداری سوابق فنی و امکان بازیابی در مخزن باقی مانده‌اند.

### اجرای نسخهٔ توسعه

برای اجرای پروژه به Node.js نسخهٔ ۲۲ و npm نیاز دارید:

    npm install
    npm run dev

در صورت تنظیم نبودن آدرس پل ارتباطی Apps Script، برنامه با داده‌های نمونه اجرا می‌شود. از این حالت فقط برای توسعه و بررسی ظاهر استفاده کنید و اطلاعات واقعی مشتریان را در آن وارد نکنید.

برای بررسی تغییرات نیز می‌توانید فرمان‌های زیر را اجرا کنید:

    npm run lint
    npm run test:unit
    npm run test:migrations
    npm run build
    npm run build:pages

### وضعیت پروژه

نسخهٔ ۱.۰.۰ منتشر شده و تنظیمات عملیاتی آن به تأیید صاحب مجموعه رسیده است. پروژه در وضعیت نگهداری قرار دارد؛ بنابراین تغییرات بعدی به رفع ایرادهای قابل بازتولید، به‌روزرسانی‌های امنیتی و اصلاحات ضروری محدود می‌شوند.

برای جزئیات فنی، راهنمای پنل مدیریت، استقرار، API و حریم خصوصی، به فایل‌های مستندات در پوشهٔ docs مراجعه کنید.
