/**
 * Copy for the transactional emails (ADR-019), English and Egyptian Arabic.
 * The Arabic follows the app's own auth wording (كلمة المرور، البريد
 * الإلكتروني، رابط، تسجيل الدخول، نسيت كلمة المرور؟) and avoids the terms the
 * owner has not decided yet (المسؤول/المدرب, الهاتف/الموبايل, الخادم).
 * Numbers stay in Western digits (D8). No string ever contains a password.
 */

export type EmailLocale = "en" | "ar";

/** Arabic count phrase with the CLDR categories the app uses (zero/one/two/few/many/other). */
function arabicCount(n: number, forms: { one: string; two: string; few: string; many: string }): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const mod100 = n % 100;
  if (mod100 >= 3 && mod100 <= 10) return `${n} ${forms.few}`;
  if (mod100 >= 11 && mod100 <= 99) return `${n} ${forms.many}`;
  return `${n} ${forms.many}`;
}

/** "72 hours" / "60 minutes" for a link lifetime given in minutes. */
export function lifetime(minutes: number, locale: EmailLocale): string {
  const hours = minutes % 60 === 0 ? minutes / 60 : null;
  if (locale === "ar") {
    return hours !== null ? arabicCount(hours, { one: "ساعة واحدة", two: "ساعتين", few: "ساعات", many: "ساعة" }) : arabicCount(minutes, { one: "دقيقة واحدة", two: "دقيقتين", few: "دقايق", many: "دقيقة" });
  }
  return hours !== null ? `${hours} hour${hours === 1 ? "" : "s"}` : `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** Absolute time in Cairo, Western digits in both languages. */
export function cairoTime(date: Date, locale: EmailLocale): string {
  const formatted = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
    timeZone: "Africa/Cairo",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: locale === "ar",
  }).format(date);
  return locale === "ar" ? `${formatted} بتوقيت القاهرة` : `${formatted} (Cairo time)`;
}

interface Common {
  eyebrow: string;
  fallbackLabel: string;
  footerTagline: string;
  footerAutomated: string;
  greeting: (name: string) => string;
}

export const COMMON: Record<EmailLocale, Common> = {
  en: {
    eyebrow: "Members only",
    fallbackLabel: "If the button does not work, copy this link into your browser:",
    footerTagline: "Your workouts stay on your iPhone.",
    footerAutomated: "This is an automated message. Replies to this address are not read.",
    greeting: (name) => `Hi ${name},`,
  },
  ar: {
    eyebrow: "للأعضاء بس",
    fallbackLabel: "لو الزرار مش شغال، انسخ الرابط ده وافتحه في المتصفح:",
    footerTagline: "تمريناتك متسجّلة على الآيفون بتاعك بس.",
    footerAutomated: "الرسالة دي اتبعتت أوتوماتيك، والردود على العنوان ده مش بتتقري.",
    greeting: (name) => `أهلًا ${name}،`,
  },
};

export interface LinkCopy {
  subject: string;
  preheader: string;
  heading: string;
  body: string[];
  cta: string;
  expiry: (lifetime: string, until: string) => string;
  notRequested: string;
}

export const INVITATION: Record<EmailLocale, LinkCopy> = {
  en: {
    subject: "Your GYM RAT account is ready. Set your password",
    preheader: "Choose your password to start training with GYM RAT.",
    heading: "Your account is ready",
    body: ["An account was created for you in GYM RAT. Choose the password you will use to sign in to the app on your iPhone.", "Nobody else sees or receives your password, and we will never send one by email."],
    cta: "Set my password",
    expiry: (span, until) => `This link works once and expires in ${span}, on ${until}.`,
    notRequested: "Not expecting this? You can ignore this email. Nobody can use the account until a password is set through this link.",
  },
  ar: {
    subject: "حسابك في GYM RAT جاهز. اختار كلمة المرور",
    preheader: "اختار كلمة المرور وابدأ تمرينك مع GYM RAT.",
    heading: "حسابك جاهز",
    body: ["اتعملك حساب في GYM RAT. اختار كلمة المرور اللي هتسجّل بيها الدخول من الأبلكيشن على الآيفون.", "محدش غيرك هيشوف كلمة المرور بتاعتك، وعمرنا ما هنبعتهالك في رسالة."],
    cta: "اختار كلمة المرور",
    expiry: (span, until) => `الرابط ده بيشتغل مرة واحدة بس، وبيخلص بعد ${span}، يوم ${until}.`,
    notRequested: "مكنتش مستني الرسالة دي؟ تجاهلها عادي. محدش هيقدر يستخدم الحساب غير لما كلمة المرور تتختار من الرابط ده.",
  },
};

export const INVITATION_RESENT: Record<EmailLocale, LinkCopy> = {
  en: {
    subject: "A new link to set up your GYM RAT account",
    preheader: "Here is a fresh link. Earlier links no longer work.",
    heading: "Here is a new link",
    body: ["We sent you a new link to choose your GYM RAT password. Any link you received before has stopped working, so please use this one."],
    cta: "Set my password",
    expiry: (span, until) => `This link works once and expires in ${span}, on ${until}.`,
    notRequested: "Not expecting this? You can ignore this email. Nobody can use the account until a password is set through this link.",
  },
  ar: {
    subject: "رابط جديد لتجهيز حسابك في GYM RAT",
    preheader: "ده رابط جديد. أي رابط قديم مبقاش شغال.",
    heading: "ده رابط جديد",
    body: ["بعتنالك رابط جديد عشان تختار كلمة المرور بتاعة GYM RAT. أي رابط وصلك قبل كده مبقاش شغال، فاستخدم الرابط ده."],
    cta: "اختار كلمة المرور",
    expiry: (span, until) => `الرابط ده بيشتغل مرة واحدة بس، وبيخلص بعد ${span}، يوم ${until}.`,
    notRequested: "مكنتش مستني الرسالة دي؟ تجاهلها عادي. محدش هيقدر يستخدم الحساب غير لما كلمة المرور تتختار من الرابط ده.",
  },
};

export const PASSWORD_RESET: Record<EmailLocale, LinkCopy> = {
  en: {
    subject: "Reset your GYM RAT password",
    preheader: "Choose a new password for your GYM RAT account.",
    heading: "Choose a new password",
    body: ["We received a request to reset the password of your GYM RAT account. Use the button below to choose a new one.", "When you do, every device signed in to your account is signed out."],
    cta: "Choose a new password",
    expiry: (span, until) => `This link works once and expires in ${span}, on ${until}.`,
    notRequested: "Did not ask for this? Ignore this email and your current password stays as it is.",
  },
  ar: {
    subject: "غيّر كلمة المرور بتاعة GYM RAT",
    preheader: "اختار كلمة مرور جديدة لحسابك في GYM RAT.",
    heading: "اختار كلمة مرور جديدة",
    body: ["وصلنا طلب لتغيير كلمة المرور بتاعة حسابك في GYM RAT. دوس على الزرار تحت واختار كلمة مرور جديدة.", "أول ما تغيّرها، هيتعمل تسجيل خروج من كل الأجهزة اللي داخلة على حسابك."],
    cta: "اختار كلمة مرور جديدة",
    expiry: (span, until) => `الرابط ده بيشتغل مرة واحدة بس، وبيخلص بعد ${span}، يوم ${until}.`,
    notRequested: "مش إنت اللي طلبت ده؟ تجاهل الرسالة، وكلمة المرور الحالية هتفضل زي ما هي.",
  },
};

export interface NoticeCopy {
  subject: string;
  preheader: string;
  heading: string;
  body: (email: string, when: string) => string[];
  steps?: string[];
  notRequested: string;
}

export const WELCOME: Record<EmailLocale, NoticeCopy> = {
  en: {
    subject: "Welcome to GYM RAT. Your account is active",
    preheader: "Your password is set. Sign in on your iPhone and start training.",
    heading: "Welcome to GYM RAT",
    body: (email, when) => [`Your account is active. Your password was set on ${when}.`, `Open GYM RAT on your iPhone and sign in with ${email} and the password you just chose.`],
    steps: ["Your workouts and progress are stored on your iPhone, not on our servers.", "The app keeps working offline and checks your account when it is back online."],
    notRequested: "If you did not set up this account, tell the gym right away.",
  },
  ar: {
    subject: "أهلًا بيك في GYM RAT. حسابك اتفعّل",
    preheader: "كلمة المرور اتحفظت. سجّل الدخول من الآيفون وابدأ تمرينك.",
    heading: "أهلًا بيك في GYM RAT",
    body: (email, when) => [`حسابك اتفعّل، وكلمة المرور اتحفظت يوم ${when}.`, `افتح GYM RAT على الآيفون وسجّل الدخول بـ ${email} وكلمة المرور اللي لسه مختارها.`],
    steps: ["تمريناتك وتقدّمك متسجّلين على الآيفون بتاعك، مش عندنا.", "الأبلكيشن بيشتغل من غير إنترنت، وبيتأكد من حسابك أول ما النت يرجع."],
    notRequested: "لو مش إنت اللي جهّزت الحساب ده، بلّغ الجيم فورًا.",
  },
};

export const PASSWORD_CHANGED: Record<EmailLocale, NoticeCopy> = {
  en: {
    subject: "Your GYM RAT password was changed",
    preheader: "Every device was signed out of your account.",
    heading: "Your password was changed",
    body: (email, when) => [`The password of your GYM RAT account (${email}) was changed on ${when}.`, "For your security, every device signed in to your account was signed out. Sign in again with the new password."],
    notRequested: "Was this not you? Open the app, tap “Forgot password?” on the sign-in screen to get a new reset link, and tell the gym right away.",
  },
  ar: {
    subject: "كلمة المرور بتاعة GYM RAT اتغيّرت",
    preheader: "اتعمل تسجيل خروج من كل الأجهزة اللي على حسابك.",
    heading: "كلمة المرور اتغيّرت",
    // The address gets its own line: an LTR address next to "GYM RAT" and parentheses reorders badly in RTL.
    body: (email, when) => [`كلمة المرور بتاعة حسابك في GYM RAT اتغيّرت يوم ${when}.`, `الحساب: ${email}`, "عشان أمانك، اتعمل تسجيل خروج من كل الأجهزة اللي كانت داخلة على حسابك. سجّل الدخول تاني بكلمة المرور الجديدة."],
    notRequested: "مش إنت اللي غيّرتها؟ افتح الأبلكيشن، ودوس «نسيت كلمة المرور؟» في شاشة الدخول عشان يوصلك رابط جديد، وبلّغ الجيم فورًا.",
  },
};
