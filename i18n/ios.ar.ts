import type { iosEn } from './ios.en';
import type { DeepStrings } from './en';

/** Arabic strings for the Phase 5 iPhone integrations. Machine-authored; owner review pending (D8). */
export const iosAr: DeepStrings<typeof iosEn> = {
  restAlert: {
    title: 'الراحة خلصت',
    body: 'يلا على السِت اللي بعده.',
  },
  activity: {
    rest: 'راحة',
    restOver: 'الراحة خلصت',
    paused: 'متوقف مؤقتًا',
    workout: 'تمرينة',
    setOf: 'السِت %{n} من %{total}',
    done: 'كل السِتات خلصت',
  },
  settings: {
    section: 'iPhone',
    keepAwakeTitle: 'خلّي الشاشة منوّرة',
    keepAwakeDetail: 'وإنت بتتمرن. بتتقفل لوحدها في وضع الطاقة المنخفضة.',
    restAlertsTitle: 'تنبيهات الراحة',
    restAlertsDetail: 'تنبيه لما الراحة تخلص لو Gym RAT في الخلفية أو الهاتف مقفول.',
    restAlertsDenied: 'الإشعارات مقفولة لـ Gym RAT في إعدادات iOS.',
    liveActivityTitle: 'النشاط المباشر',
    liveActivityDetail: 'شاشة القفل والجزيرة الديناميكية بيعرضوا التمرينة والتمرين الحالي ومؤقت الراحة. من غير أوزان أو بيانات جسم.',
    healthTitle: 'تطبيق صحتي',
    healthDetail: 'بيحفظ التمرينات اللي خلّصتها كتمرينات قوة (البداية والنهاية والوقفات). مش بيقرا أي حاجة من تطبيق صحتي.',
    healthDenied: 'تطبيق صحتي مش سامح لـ Gym RAT يكتب فيه. اسمح بده من تطبيق صحتي: الملف الشخصي › التطبيقات › Gym RAT.',
    healthUnavailable: 'تطبيق صحتي مش متاح على الجهاز ده.',
    healthKept: 'التمرينات اللي اتحفظت قبل كده هتفضل في تطبيق صحتي؛ امسحها من هناك لو عايز.',
    openSettings: 'افتح إعدادات iOS',
    privacyTitle: 'الخصوصية',
    privacyDetail: 'تمريناتك وقياسات جسمك وأهدافك بتفضل على الـ iPhone ده، ومحمية بتشفير ملفات iOS. مفيش في Gym RAT حساب ولا تحليلات ولا خادم.',
  },
  video: {
    title: 'فيديو تعليمي',
    source: 'بيشتغل من YouTube. الروابط اللي جوه المشغّل بتفتح تطبيق YouTube أو Safari.',
    needsInternet: 'الفيديو محتاج إنترنت. كل حاجة تانية شغّالة من غير نت.',
    unavailable: 'مش هينفع نشغّل الفيديو ده جوه التطبيق دلوقتي.',
    retry: 'جرّب تاني',
    none: 'لسه مفيش فيديو تعليمي متأكدين منه للتمرين ده.',
  },
};
