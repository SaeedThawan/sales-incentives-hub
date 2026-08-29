/**
 * الإعدادات المركزية والافتراضية للمنظومة
 */

const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbxE0uaJ6WoKzb6QPZE8yqkeJKb0x1DWog8-3nkYILdJHMknarUkd0JM3X0pNnZm9ZVzLQ/exec",

  DEFAULT_GENERAL_RULES: {
    generalThresholdPct: 80,
    generalTargetCommValue: 500,
    minGroupsRequired: 7,
    minOver60RequiredPct: 40,
    collectionTiers: [
      { minPct: 0, maxPct: 19.99, rate: 0.0000 },
      { minPct: 20, maxPct: 29.99, rate: 0.0025 },
      { minPct: 30, maxPct: 39.99, rate: 0.0050 },
      { minPct: 40, maxPct: 59.99, rate: 0.0075 },
      { minPct: 60, maxPct: 1000, rate: 0.0100 }
    ]
  },

  FALLBACK_GROUPS: [
    { id: 0, name: "شوكلاتة ايجلو", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 1, name: "بيكاديلي /ديجستف", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 2, name: "البقوليات + قشطة", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 3, name: "الطاقة", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 4, name: "زيت زيتون + طحينة", thresholdPct: 70, commType: 'fixed', commValue: 300 },
    { id: 5, name: "جيلي جلب + كوزو", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 6, name: "رز فايف ستار", thresholdPct: 70, commType: 'fixed', commValue: 150 },
    { id: 7, name: "بيسكوزا + سما فود", thresholdPct: 70, commType: 'fixed', commValue: 400 },
    { id: 8, name: "اكسيلو", thresholdPct: 70, commType: 'fixed', commValue: 300 },
    { id: 9, name: "عماني/دريم واي", thresholdPct: 70, commType: 'fixed', commValue: 200 },
    { id: 10, name: "عسل", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 11, name: "تشوبا تشوبس", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 12, name: "كنجسي", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 13, name: "سن لوب", thresholdPct: 70, commType: 'fixed', commValue: 250 }
  ]
};
