/**
 * نظام إدارة الأهداف والعمولات الشامل - ملف الإعدادات المركزية
 * Central Configuration & System Rules
 */

const CONFIG = {
  // رابط Google Apps Script Web App
  API_URL: "https://script.google.com/macros/s/AKfycbxE0uaJ6WoKzb6QPZE8yqkeJKb0x1DWog8-3nkYILdJHMknarUkd0JM3X0pNnZm9ZVzLQ/exec",

  // الشروط العامة الافتراضية
  DEFAULT_GENERAL_RULES: {
    generalThresholdPct: 80,       // نسبة شرط الهدف العام (80%)
    generalTargetCommValue: 500,   // عمولة الهدف العام المستقلة (500 ر.س)
    minGroupsRequired: 7,          // أدنى عدد مجموعات مطلوبة للتأهل (7 مجموعات)
    
    // شرائح عمولات التحصيل من إجمالي التحصيل المحقق
    collectionTiers: [
      { minPct: 0,  maxPct: 19.99, rate: 0.0000, label: "أقل من 20% (0%)" },
      { minPct: 20, maxPct: 29.99, rate: 0.0025, label: "20% - 29.99% (0.25%)" },
      { minPct: 30, maxPct: 39.99, rate: 0.0050, label: "30% - 39.99% (0.50%)" },
      { minPct: 40, maxPct: 59.99, rate: 0.0075, label: "40% - 59.99% (0.75%)" },
      { minPct: 60, maxPct: 1000,  rate: 0.0100, label: "60% فأعلى (1.00%)" }
    ]
  },

  // بيانات المجموعات الـ 14 الافتراضية
  FALLBACK_GROUPS: [
    { id: 0,  name: "شوكلاتة ايجلو",      thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 1,  name: "بيكاديلي /ديجستف",    thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 2,  name: "البقوليات + قشطة",     thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 3,  name: "الطاقة",             thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 4,  name: "زيت زيتون + طحينة",    thresholdPct: 70, commType: 'fixed', commValue: 300 },
    { id: 5,  name: "جيلي جلب + كوزو",    thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 6,  name: "رز فايف ستار",        thresholdPct: 70, commType: 'fixed', commValue: 150 },
    { id: 7,  name: "بيسكوزا + سما فود",   thresholdPct: 70, commType: 'fixed', commValue: 400 },
    { id: 8,  name: "اكسيلو",              thresholdPct: 70, commType: 'fixed', commValue: 300 },
    { id: 9,  name: "عماني/دريم واي",      thresholdPct: 70, commType: 'fixed', commValue: 200 },
    { id: 10, name: "عسل",                thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 11, name: "تشوبا تشوبس",        thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 12, name: "كنجسي",              thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 13, name: "سن لوب",             thresholdPct: 70, commType: 'fixed', commValue: 250 }
  ]
};
