import type { iosEn } from './ios.en';

type DeepStrings<T> = { [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]> };

/** Arabic strings for the Phase 5 iPhone integrations. Machine-authored; owner review pending (D8). */
export const iosAr: DeepStrings<typeof iosEn> = {
  restAlert: {
    title: 'انتهت الراحة',
    body: 'حان وقت المجموعة التالية.',
  },
  activity: {
    rest: 'راحة',
    restOver: 'انتهت الراحة',
    paused: 'متوقف مؤقتًا',
    workout: 'تمرين',
    setOf: 'المجموعة %{n} من %{total}',
    done: 'اكتملت كل المجموعات',
  },
  settings: {
    section: 'iPhone',
    keepAwakeTitle: 'إبقاء الشاشة مضاءة',
    keepAwakeDetail: 'أثناء التمرين. يتوقف تلقائيًا في وضع الطاقة المنخفضة.',
    restAlertsTitle: 'تنبيهات الراحة',
    restAlertsDetail: 'تنبيه عند انتهاء الراحة إذا كان Gym RAT في الخلفية أو الهاتف مقفلًا.',
    restAlertsDenied: 'الإشعارات متوقفة لـ Gym RAT في إعدادات iOS.',
    liveActivityTitle: 'النشاط المباشر',
    liveActivityDetail: 'تعرض شاشة القفل والجزيرة الديناميكية التمرين والتمرين الحالي ومؤقت الراحة. بلا أوزان أو بيانات جسم.',
    healthTitle: 'تطبيق صحتي',
    healthDetail: 'حفظ التمارين المنتهية كتمارين قوة (البداية والنهاية والتوقفات). لا يُقرأ شيء من تطبيق صحتي.',
    healthDenied: 'لا يستطيع Gym RAT الكتابة في تطبيق صحتي. اسمح بذلك من تطبيق صحتي: الملف الشخصي › التطبيقات › Gym RAT.',
    healthUnavailable: 'تطبيق صحتي غير متاح على هذا الجهاز.',
    healthKept: 'التمارين المحفوظة سابقًا تبقى في تطبيق صحتي؛ احذفها من هناك إن أردت.',
    openSettings: 'فتح إعدادات iOS',
    privacyTitle: 'الخصوصية',
    privacyDetail: 'تمارينك وقياسات جسمك وأهدافك تبقى على هذا الـ iPhone، محمية بتشفير ملفات iOS. لا حساب ولا تحليلات ولا خادم في Gym RAT.',
  },
  video: {
    title: 'فيديو تعليمي',
    by: 'YouTube · %{channel}',
    needsInternet: 'الفيديو يحتاج إلى اتصال بالإنترنت. كل ما عداه يعمل دون اتصال.',
    unavailable: 'لا يمكن تشغيل هذا الفيديو داخل التطبيق الآن.',
    retry: 'إعادة المحاولة',
    none: 'لم يُتحقق بعد من فيديو تعليمي لهذا التمرين.',
  },
};
