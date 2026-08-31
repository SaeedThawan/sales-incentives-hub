/**
 * الإعدادات المركزية وخريطة المجموعات الرسمية - v17.0
 */

const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbxE0uaJ6WoKzb6QPZE8yqkeJKb0x1DWog8-3nkYILdJHMknarUkd0JM3X0pNnZm9ZVzLQ/exec",

  DEFAULT_GENERAL_RULES: {
    isGenTargetMandatory: true,
    generalThresholdPct: 80,
    generalTargetCommValue: 0,
    minGroupsRequired: 7,
    collectionRules: {
      isCollMandatory: false,
      thresholdPct: 0,
      commType: 'fixed',
      commValue: 0
    }
  },

  FALLBACK_GROUPS: [
    { id: 0, code: "501", name: "شوكلاتة ايجلو", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 1, code: "210", name: "بيكاديلي /ديجستف", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 2, code: "2010", name: "البقوليات + قشطة", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 3, code: "70", name: "الطاقة", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 4, code: "205", name: "زيت زيتون +طحينة", thresholdPct: 70, commType: 'fixed', commValue: 300 },
    { id: 5, code: "40", name: "جيلي جلب + كوزو", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 6, code: "206", name: "رز فايف  ستار", thresholdPct: 70, commType: 'fixed', commValue: 150 },
    { id: 7, code: "82", name: "بيسكوزا + سما فود", thresholdPct: 70, commType: 'fixed', commValue: 400 },
    { id: 8, code: "150", name: "اكسيلو", thresholdPct: 70, commType: 'fixed', commValue: 300 },
    { id: 9, code: "3010", name: "عماني/دريم واي", thresholdPct: 70, commType: 'fixed', commValue: 200 },
    { id: 10, code: "215", name: "عسل", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 11, code: "800", name: "تشوبا تشوبس", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 12, code: "83", name: "كنجسي", thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 13, code: "180", name: "سن لوب", thresholdPct: 70, commType: 'fixed', commValue: 250 }
  ]
};
