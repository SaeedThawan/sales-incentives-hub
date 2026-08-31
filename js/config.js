/**
 * الإعدادات المركزية والافتراضية للمنظومة - v14.0 Dynamic
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
      thresholdPct: 60,
      commType: 'fixed',
      commValue: 500
    }
  },

  // خريطة الدمج الأساسية
  FALLBACK_GROUPS: [
    { id: 0, name: "شوكلاتة ايجلو", codes: ["501"], thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 1, name: "بيكاديلي /ديجستف", codes: ["210"], thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 2, name: "البقوليات + قشطة", codes: ["2010", "12020", "22020", "32020"], thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 3, name: "الطاقة", codes: ["70"], thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 4, name: "زيت زيتون + طحينة", codes: ["205", "2040"], thresholdPct: 70, commType: 'fixed', commValue: 300 },
    { id: 5, name: "جيلي جلب + كوزو", codes: ["40", "2301"], thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 6, name: "رز فايف  ستار", codes: ["206"], thresholdPct: 70, commType: 'fixed', commValue: 150 },
    { id: 7, name: "بيسكوزا + سما فود", codes: ["82", "81"], thresholdPct: 70, commType: 'fixed', commValue: 400 },
    { id: 8, name: "اكسيلو", codes: ["150"], thresholdPct: 70, commType: 'fixed', commValue: 300 },
    { id: 9, name: "عماني/دريم واي", codes: ["3010", "3015", "2305"], thresholdPct: 70, commType: 'fixed', commValue: 200 },
    { id: 10, name: "عسل", codes: ["215", "90"], thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 11, name: "تشوبا تشوبس", codes: ["800", "100"], thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 12, name: "كنجسي", codes: ["83"], thresholdPct: 70, commType: 'fixed', commValue: 250 },
    { id: 13, name: "سن لوب", codes: ["180", "140", "130", "110", "1200", "1001", "1208", "1234"], thresholdPct: 70, commType: 'fixed', commValue: 250 }
  ]
};
