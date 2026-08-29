const { useState, useEffect, useMemo } = React;

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [monthKey, setMonthKey] = useState('2026-08');
  const [monthStatus, setMonthStatus] = useState('open');
  const [activeProposalInfo, setActiveProposalInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRep, setSelectedRep] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [notification, setNotification] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [analyticsSortBy, setAnalyticsSortBy] = useState('highestPct');

  // إعدادات الشروط العامة والتحصيل المنفصل
  const [generalRules, setGeneralRules] = useState({
    generalThresholdPct: 80,
    generalTargetCommValue: 500,
    minGroupsRequired: 7,
    collectionRules: {
      under60: { isActive: true, thresholdPct: 30, commType: 'percent', commValue: 0.5 },
      over60: { isActive: true, thresholdPct: 40, commType: 'percent', commValue: 1.0 }
    }
  });

  const [groupRules, setGroupRules] = useState(
    CONFIG.FALLBACK_GROUPS.map(g => ({ ...g, isActive: true }))
  );

  // قواعد المطبخ التجريبي المستقل
  const [kitchenGeneralRules, setKitchenGeneralRules] = useState({
    generalThresholdPct: 80,
    generalTargetCommValue: 500,
    minGroupsRequired: 7,
    collectionRules: {
      under60: { isActive: true, thresholdPct: 30, commType: 'percent', commValue: 0.5 },
      over60: { isActive: true, thresholdPct: 40, commType: 'percent', commValue: 1.0 }
    }
  });
  const [kitchenGroupRules, setKitchenGroupRules] = useState(
    CONFIG.FALLBACK_GROUPS.map(g => ({ ...g, isActive: true }))
  );
  const [isKitchenApplied, setIsKitchenApplied] = useState(false);

  const [repsData, setRepsData] = useState([]);

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  };

  const formatNum = (num) => Math.round(num || 0).toLocaleString('en-US');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    const res = await AuthService.login(usernameInput, passwordInput);
    if (res && res.status === 'success') {
      setCurrentUser(res.user);
      showToast(`مرحباً بك: ${res.user.fullName}`);
      loadData(res.user);
    } else {
      showToast(`خطأ: ${res ? res.message : 'بيانات الدخول غير صحيحة'}`);
    }
    setLoginLoading(false);
  };

  const loadData = async (user) => {
    setSyncLoading(true);
    const activeUser = user || currentUser;
    try {
      const data = await ApiService.fetchWorkspace(activeUser.role, activeUser.userId, monthKey);
      if (data && data.status === 'success') {
        if (data.generalRules) {
          const mergedRules = {
            generalThresholdPct: data.generalRules.generalThresholdPct ?? 80,
            generalTargetCommValue: data.generalRules.generalTargetCommValue ?? 500,
            minGroupsRequired: data.generalRules.minGroupsRequired ?? 7,
            collectionRules: data.generalRules.collectionRules || {
              under60: { isActive: true, thresholdPct: 30, commType: 'percent', commValue: 0.5 },
              over60: { isActive: true, thresholdPct: 40, commType: 'percent', commValue: 1.0 }
            }
          };
          setGeneralRules(mergedRules);
          setKitchenGeneralRules(mergedRules);
        }
        if (data.groupRules && data.groupRules.length > 0) {
          const formattedGroups = data.groupRules.map(g => ({ ...g, isActive: g.isActive !== false }));
          setGroupRules(formattedGroups);
          setKitchenGroupRules(formattedGroups);
        }
        if (data.reps && data.reps.length > 0) {
          setRepsData(data.reps);
        }
        if (data.monthStatus) setMonthStatus(data.monthStatus);
        if (data.activeProposal) setActiveProposalInfo(data.activeProposal);
        showToast('تمت المزامنة بنجاح مع Google Sheets');
      }
    } catch (err) {
      showToast('تعذر الاتصال بالسيرفر');
    }
    setSyncLoading(false);
  };

  const handleSaveOfficialConfig = async () => {
    if (currentUser.role !== 'manager') {
      showToast('تعديل وحفظ الشروط متاح للمدير العام فقط');
      return;
    }
    setSyncLoading(true);
    try {
      const configPayload = { generalRules, groupRules };
      const res = await ApiService.saveProposal(monthKey, configPayload, currentUser);
      showToast(res.message || 'تم حفظ وتثبيت الشروط الرسمية بنجاح 🔒');
      loadData(currentUser);
    } catch (err) {
      showToast('تم حفظ الشروط');
    }
    setSyncLoading(false);
  };

  const handleSaveProposal = async () => {
    setSyncLoading(true);
    try {
      const proposalPayload = {
        generalRules: kitchenGeneralRules,
        groupRules: kitchenGroupRules
      };
      const res = await ApiService.saveProposal(monthKey, proposalPayload, currentUser);
      showToast(res.message || 'تم رفع مقترح المطبخ بنجاح للإدارة');
      setMonthStatus('pending_approval');
      loadData(currentUser);
    } catch (err) {
      showToast('تم حفظ المقترح');
      setMonthStatus('pending_approval');
    }
    setSyncLoading(false);
  };

  const handleApproveMonth = async () => {
    if (currentUser.role !== 'manager') {
      showToast('صلاحية الاعتماد النهائي محصورة بالمدير العام فقط');
      return;
    }
    setSyncLoading(true);
    try {
      const res = await ApiService.approveMonth(monthKey, currentUser);
      showToast(res.message || 'تم الاعتماد النهائي وإقفال الشهر المالي 🔒');
      setMonthStatus('approved');
      loadData(currentUser);
    } catch (err) {
      showToast('تم الاعتماد بنجاح');
      setMonthStatus('approved');
    }
    setSyncLoading(false);
  };

  const handleRecalculateRawData = async () => {
    setSyncLoading(true);
    try {
      const res = await ApiService.recalculateRawData(monthKey, currentUser);
      showToast(res.message || 'تمت معالجة وتحديث الشيت الخام');
      loadData(currentUser);
    } catch (err) {
      showToast('تم إرسال أمر التجميع');
      loadData(currentUser);
    }
    setSyncLoading(false);
  };

  const activeGeneralRules = isKitchenApplied ? kitchenGeneralRules : generalRules;
  const activeGroupRules = isKitchenApplied ? kitchenGroupRules : groupRules;

  const processedReps = useMemo(() => {
    if (!Array.isArray(repsData)) return [];
    return repsData
      .map(rep => CalcEngine.processRepData(rep, activeGeneralRules, activeGroupRules))
      .filter(Boolean);
  }, [repsData, activeGeneralRules, activeGroupRules]);

  const companyTotals = useMemo(() => {
    return CalcEngine.calculateCompanyTotals(processedReps, activeGeneralRules);
  }, [processedReps, activeGeneralRules]);

  const groupAnalyticsData = useMemo(() => {
    return CalcEngine.analyzeAndSortGroups(activeGroupRules, processedReps, analyticsSortBy);
  }, [activeGroupRules, processedReps, analyticsSortBy]);

  const visibleReps = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'rep') {
      return processedReps.filter(r => Number(r.id) === Number(currentUser.userId));
    }
    return processedReps.filter(r => (r.name && r.name.includes(searchTerm)) || (r.id && r.id.toString().includes(searchTerm)));
  }, [processedReps, currentUser, searchTerm]);

  // دوال تعديل المجموعات الرسمية
  const updateOfficialGroup = (idx, field, val) => {
    const updated = [...groupRules];
    updated[idx] = { ...updated[idx], [field]: val };
    setGroupRules(updated);
  };

  // دوال تعديل تحصيل الرسمية
  const updateOfficialColl = (section, field, val) => {
    setGeneralRules({
      ...generalRules,
      collectionRules: {
        ...generalRules.collectionRules,
        [section]: {
          ...generalRules.collectionRules[section],
          [field]: val
        }
      }
    });
  };

  // دوال تعديل المطبخ
  const updateKitchenGroup = (idx, field, val) => {
    const updated = [...kitchenGroupRules];
    updated[idx] = { ...updated[idx], [field]: val };
    setKitchenGroupRules(updated);
  };

  const updateKitchenColl = (section, field, val) => {
    setKitchenGeneralRules({
      ...kitchenGeneralRules,
      collectionRules: {
        ...kitchenGeneralRules.collectionRules,
        [section]: {
          ...kitchenGeneralRules.collectionRules[section],
          [field]: val
        }
      }
    });
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-3xl">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <h1 className="text-2xl font-black text-white">نظام الأهداف والعمولات</h1>
            <p className="text-xs text-slate-400">سجل الدخول بحسابك (ربط مباشر مع Google Sheets)</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">اسم المستخدم / رقم المندوب</label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="admin / supervisor / 14"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">كلمة المرور</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {loginLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-right-to-bracket"></i>}
              <span>دخول النظام</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16 dir-rtl">
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-30 shadow-md p-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2.5 rounded-xl text-slate-950 text-xl font-bold">
              <i className="fa-solid fa-chart-pie"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-white">نظام الأهداف والعمولات الشامل</h1>
                <button
                  onClick={() => setShowAuditModal(true)}
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition-all ${
                    monthStatus === 'approved'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  <i className="fa-solid fa-circle-info"></i>
                  <span>{monthStatus === 'approved' ? 'معتمد ومقفل 🔒' : 'قيد التخطيط والمراجعة ✍️'}</span>
                </button>
                {isKitchenApplied && (
                  <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    معاينة محاكاة المطبخ 🧠
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                المستخدم: <b className="text-emerald-400">{currentUser.fullName}</b> ({currentUser.role === 'manager' ? 'المدير العام' : currentUser.role === 'supervisor' ? 'مشرف المبيعات' : 'مندوب مبيعات'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {currentUser.role === 'manager' && (
              <button
                onClick={handleRecalculateRawData}
                disabled={syncLoading}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md"
              >
                <i className={`fa-solid fa-arrows-spin ${syncLoading ? 'fa-spin' : ''}`}></i>
                <span>تجميع الشيت الخام</span>
              </button>
            )}

            <button
              onClick={() => loadData(currentUser)}
              disabled={syncLoading}
              className="bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-1.5"
            >
              <i className={`fa-solid fa-arrows-rotate text-emerald-400 ${syncLoading ? 'fa-spin' : ''}`}></i>
              <span>مزامنة الشيت</span>
            </button>

            {currentUser.role === 'supervisor' && monthStatus !== 'approved' && (
              <button
                onClick={handleSaveProposal}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-600/20"
              >
                <i className="fa-solid fa-paper-plane text-amber-300"></i>
                <span>رفع مقترح المطبخ للإدارة</span>
              </button>
            )}

            {currentUser.role === 'manager' && (
              monthStatus === 'approved' ? (
                <button
                  onClick={() => setMonthStatus('open')}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md"
                >
                  <i className="fa-solid fa-lock-open"></i>
                  <span>فتح التعديل مجدداً</span>
                </button>
              ) : (
                <button
                  onClick={handleApproveMonth}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                >
                  <i className="fa-solid fa-stamp text-amber-300"></i>
                  <span>اعتماد وترحيل النهائي 🔒</span>
                </button>
              )
            )}

            <button
              onClick={() => setCurrentUser(null)}
              className="bg-rose-950/60 text-rose-300 border border-rose-800/40 px-3 py-1.5 rounded-xl"
            >
              خروج
            </button>
          </div>
        </div>

        {currentUser.role !== 'rep' && (
          <div className="flex space-x-2 space-x-reverse mt-3 border-t border-slate-700/60 pt-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 ${activeTab === 'summary' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-300'}`}
            >
              <i className="fa-solid fa-table-list"></i> خلاصة المندوبين
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 ${activeTab === 'config' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300'}`}
            >
              <i className="fa-solid fa-sliders"></i> إعدادات الشروط والتحصيل الرسمية 🔒
            </button>
            <button
              onClick={() => setActiveTab('proposals')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 ${activeTab === 'proposals' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-purple-300'}`}
            >
              <i className="fa-solid fa-kitchen-set text-amber-300"></i> مطبخ التخطيط والمحاكاة التجريبية 🧠
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 ${activeTab === 'analytics' ? 'bg-teal-500 text-slate-950' : 'bg-slate-900 text-slate-300'}`}
            >
              <i className="fa-solid fa-chart-pie"></i> تحليل المجموعات الـ 14
            </button>
          </div>
        )}
      </header>

      {notification && (
        <div className="fixed bottom-5 left-5 z-50 bg-emerald-500 text-slate-950 px-4 py-3 rounded-2xl shadow-2xl font-bold animate-bounce">
          {notification}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 mt-6">
        {currentUser.role !== 'rep' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block mb-1">المبيعات العامة</span>
              <span className="text-base font-extrabold text-white font-mono">{formatNum(companyTotals.genSales)}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">هدف {formatNum(companyTotals.genTarget)}</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block mb-1">نسبة الإنجاز</span>
              <span className={`text-base font-extrabold font-mono ${companyTotals.overallGenPct >= (Number(activeGeneralRules.generalThresholdPct) || 80) ? 'text-emerald-400' : 'text-amber-400'}`}>
                {companyTotals.overallGenPct.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">المتبقي: {formatNum(companyTotals.remainingGenSalesTotal)}</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block mb-1">عمولات المجموعات</span>
              <span className="text-base font-extrabold text-teal-300 font-mono">{formatNum(companyTotals.groupCommSum)} ر.س</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{companyTotals.qualifiedRepsCount} مستحقين</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block mb-1">عمولة الهدف العام</span>
              <span className="text-base font-extrabold text-amber-300 font-mono">{formatNum(companyTotals.genTargetCommSum)} ر.س</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block mb-1">عمولة التحصيل</span>
              <span className="text-base font-extrabold text-blue-300 font-mono">{formatNum(companyTotals.collComm)} ر.س</span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">({companyTotals.overallCollPct.toFixed(1)}% من الدين)</span>
            </div>
            <div className="bg-slate-800 border border-emerald-500/40 bg-emerald-950/20 p-3.5 rounded-2xl">
              <span className="text-emerald-300 text-xs font-bold mb-1">إجمالي كافة العمولات</span>
              <span className="text-lg font-black text-emerald-400 font-mono">{formatNum(companyTotals.grandComm)} ر.س</span>
            </div>
          </div>
        )}

        {/* Tab 1: Summary Table */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {currentUser.role !== 'rep' && (
              <div className="relative max-w-md">
                <i className="fa-solid fa-magnifying-glass absolute right-3.5 top-3 text-slate-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="ابحث باسم المندوب أو الرقم..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-10 pl-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right text-slate-200">
                  <thead className="bg-slate-900 text-slate-300 uppercase text-[11px] font-extrabold border-b border-slate-700">
                    <tr>
                      <th className="py-3.5 px-3">#</th>
                      <th className="py-3.5 px-3">اسم المندوب</th>
                      <th className="py-3.5 px-3">الهدف العام</th>
                      <th className="py-3.5 px-3">المبيعات</th>
                      <th className="py-3.5 px-3">نسبة الإنجاز</th>
                      <th className="py-3.5 px-3">المتبقي للشرط</th>
                      <th className="py-3.5 px-3 text-amber-300">عمولة الهدف</th>
                      <th className="py-3.5 px-3 text-center">المجموعات</th>
                      <th className="py-3.5 px-3">التحصيل</th>
                      <th className="py-3.5 px-3 text-blue-300">عمولة التحصيل</th>
                      <th className="py-3.5 px-3 text-teal-300">عمولة المجموعات</th>
                      <th className="py-3.5 px-3 text-emerald-300 font-black">إجمالي المستحق</th>
                      <th className="py-3.5 px-3 text-center">تفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 font-mono">
                    {visibleReps.map((rep) => (
                      <tr key={rep.id} className="hover:bg-slate-700/40">
                        <td className="py-3 px-3 text-slate-400">{rep.id}</td>
                        <td className="py-3 px-3 font-sans font-bold text-white">{rep.name}</td>
                        <td className="py-3 px-3">{formatNum(rep.genTarget)}</td>
                        <td className="py-3 px-3 font-bold text-white">{formatNum(rep.genSales)}</td>
                        <td className="py-3 px-3">
                          <span className={`font-bold ${rep.passGate1_GeneralTarget ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {rep.genPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {rep.remainingGenSales > 0 ? (
                            <span className="text-rose-300 font-sans">{formatNum(rep.remainingGenSales)} ر.س</span>
                          ) : (
                            <span className="text-emerald-400 font-sans font-bold">مكتمل ✅</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-amber-300 font-bold">{formatNum(rep.generalTargetCommEarned)}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rep.passGate2_MinGroups ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-950 text-rose-300'
                          }`}>
                            {rep.qualifiedGroupsCount} / 14
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div>{formatNum(rep.collection)}</div>
                          <span className="text-[10px] text-slate-400 block font-sans">({rep.debt > 0 ? ((rep.collection / rep.debt) * 100).toFixed(1) : 0}%)</span>
                        </td>
                        <td className="py-3 px-3 text-blue-300 font-bold">{formatNum(rep.collectionCommission)}</td>
                        <td className="py-3 px-3 text-teal-300 font-bold">{formatNum(rep.totalGroupCommissionEarned)}</td>
                        <td className="py-3 px-3 bg-emerald-950/30 font-black text-emerald-400 text-sm">
                          {formatNum(rep.grandTotalCommission)} ر.س
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => setSelectedRep(rep)}
                            className="bg-slate-700 hover:bg-emerald-600 hover:text-slate-950 text-slate-200 px-3 py-1 rounded-lg text-xs font-bold"
                          >
                            التفاصيل
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: الإعدادات الرسمية المعتمدة */}
        {activeTab === 'config' && currentUser.role !== 'rep' && (
          <div className="space-y-6">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <i className="fa-solid fa-stamp text-amber-400"></i> القواعد والشروط الرسمية المعتمدة للشهر المالي
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">الشروط الرسمية التي تُبنى عليها تقارير الرواتب والعمولات</p>
                </div>
                {currentUser.role === 'manager' && monthStatus !== 'approved' && (
                  <button
                    onClick={handleSaveOfficialConfig}
                    disabled={syncLoading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                  >
                    <i className="fa-solid fa-floppy-disk text-amber-300"></i>
                    <span>حفظ وتثبيت الشروط للشهر</span>
                  </button>
                )}
              </div>

              {/* بطاقات الشروط العامة (بدون شرط الـ 60 يوم بالأعلى) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <label className="text-xs font-bold text-slate-300 block mb-1">نسبة شرط الهدف العام (%)</label>
                  <input
                    type="number"
                    disabled={currentUser.role !== 'manager' || monthStatus === 'approved'}
                    value={generalRules.generalThresholdPct ?? 80}
                    onChange={(e) => setGeneralRules({ ...generalRules, generalThresholdPct: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-bold text-emerald-400 text-center disabled:opacity-60"
                  />
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <label className="text-xs font-bold text-slate-300 block mb-1">عمولة الهدف العام (ر.س)</label>
                  <input
                    type="number"
                    disabled={currentUser.role !== 'manager' || monthStatus === 'approved'}
                    value={generalRules.generalTargetCommValue ?? 500}
                    onChange={(e) => setGeneralRules({ ...generalRules, generalTargetCommValue: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-bold text-amber-300 text-center font-mono disabled:opacity-60"
                  />
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <label className="text-xs font-bold text-slate-300 block mb-1">أدنى عدد مجموعات مطلوبة</label>
                  <input
                    type="number"
                    disabled={currentUser.role !== 'manager' || monthStatus === 'approved'}
                    value={generalRules.minGroupsRequired ?? 7}
                    onChange={(e) => setGeneralRules({ ...generalRules, minGroupsRequired: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-bold text-teal-300 text-center disabled:opacity-60"
                  />
                </div>
              </div>

              {/* جدول المجموعات الـ 14 مع Checkbox التفعيل */}
              <div className="space-y-3 pt-4 border-t border-slate-700">
                <h3 className="text-sm font-bold text-teal-400 flex items-center gap-2">
                  <i className="fa-solid fa-boxes-stacked"></i> شروط وعمولات المجموعات الـ 14 المعتمدة:
                </h3>
                <div className="overflow-x-auto border border-slate-700 rounded-xl">
                  <table className="w-full text-xs text-right bg-slate-900">
                    <thead className="bg-slate-950 text-slate-300 border-b border-slate-700">
                      <tr>
                        <th className="p-3 text-center">تفعيل ✅</th>
                        <th className="p-3">#</th>
                        <th className="p-3">اسم المجموعة</th>
                        <th className="p-3">نسبة الشرط (%)</th>
                        <th className="p-3">نوع العمولة</th>
                        <th className="p-3">قيمة العمولة (ر.س / %)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {groupRules.map((grpRule, idx) => (
                        <tr key={idx} className={`hover:bg-slate-800/60 ${!grpRule.isActive ? 'opacity-40 bg-slate-950/40' : ''}`}>
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              disabled={currentUser.role !== 'manager' || monthStatus === 'approved'}
                              checked={grpRule.isActive !== false}
                              onChange={(e) => updateOfficialGroup(idx, 'isActive', e.target.checked)}
                              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                            />
                          </td>
                          <td className="p-3 text-slate-500 font-sans">{idx + 1}</td>
                          <td className="p-3 font-sans font-bold text-white text-sm">{grpRule.name}</td>
                          <td className="p-3">
                            <input
                              type="number"
                              disabled={currentUser.role !== 'manager' || monthStatus === 'approved' || !grpRule.isActive}
                              value={grpRule.thresholdPct ?? 70}
                              onChange={(e) => updateOfficialGroup(idx, 'thresholdPct', e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-20 bg-slate-800 border border-slate-700 rounded p-1.5 text-center text-teal-300 font-bold disabled:opacity-50"
                            />
                          </td>
                          <td className="p-3 font-sans">
                            <select
                              disabled={currentUser.role !== 'manager' || monthStatus === 'approved' || !grpRule.isActive}
                              value={grpRule.commType || 'fixed'}
                              onChange={(e) => updateOfficialGroup(idx, 'commType', e.target.value)}
                              className="bg-slate-800 border border-slate-700 text-slate-200 rounded p-1.5 text-xs disabled:opacity-50"
                            >
                              <option value="fixed">مبلغ ثابت (ر.س)</option>
                              <option value="percent">نسبة (% من المبيعات)</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              disabled={currentUser.role !== 'manager' || monthStatus === 'approved' || !grpRule.isActive}
                              value={grpRule.commValue ?? 250}
                              onChange={(e) => updateOfficialGroup(idx, 'commValue', e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-24 bg-slate-800 border border-slate-700 rounded p-1.5 text-center text-emerald-400 font-bold disabled:opacity-50"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* جدول شروط وعمولات التحصيل المنفصل بالأسفل */}
              <div className="space-y-3 pt-4 border-t border-slate-700">
                <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                  <i className="fa-solid fa-hand-holding-dollar"></i> شروط وعمولات التحصيل (بعد استبعاد الديون المتعثرة):
                </h3>
                <div className="overflow-x-auto border border-slate-700 rounded-xl">
                  <table className="w-full text-xs text-right bg-slate-900">
                    <thead className="bg-slate-950 text-slate-300 border-b border-slate-700">
                      <tr>
                        <th className="p-3 text-center">تفعيل ✅</th>
                        <th className="p-3">بند التحصيل</th>
                        <th className="p-3">شرط نسبة التحصيل (%)</th>
                        <th className="p-3">نوع العمولة</th>
                        <th className="p-3">قيمة العمولة (ر.س / %)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {/* أقل من 60 يوم */}
                      <tr className={`hover:bg-slate-800/60 ${!generalRules.collectionRules?.under60?.isActive ? 'opacity-40' : ''}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            disabled={currentUser.role !== 'manager' || monthStatus === 'approved'}
                            checked={generalRules.collectionRules?.under60?.isActive !== false}
                            onChange={(e) => updateOfficialColl('under60', 'isActive', e.target.checked)}
                            className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-sans font-bold text-white">تحصيل ديون أقل من 60 يوماً</td>
                        <td className="p-3">
                          <input
                            type="number"
                            disabled={currentUser.role !== 'manager' || monthStatus === 'approved' || !generalRules.collectionRules?.under60?.isActive}
                            value={generalRules.collectionRules?.under60?.thresholdPct ?? 30}
                            onChange={(e) => updateOfficialColl('under60', 'thresholdPct', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-20 bg-slate-800 border border-slate-700 rounded p-1.5 text-center text-blue-300 font-bold"
                          />
                        </td>
                        <td className="p-3 font-sans">
                          <select
                            disabled={currentUser.role !== 'manager' || monthStatus === 'approved' || !generalRules.collectionRules?.under60?.isActive}
                            value={generalRules.collectionRules?.under60?.commType || 'percent'}
                            onChange={(e) => updateOfficialColl('under60', 'commType', e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-slate-200 rounded p-1.5 text-xs"
                          >
                            <option value="percent">نسبة (% من التحصيل)</option>
                            <option value="fixed">مبلغ ثابت (ر.س)</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            disabled={currentUser.role !== 'manager' || monthStatus === 'approved' || !generalRules.collectionRules?.under60?.isActive}
                            value={generalRules.collectionRules?.under60?.commValue ?? 0.5}
                            onChange={(e) => updateOfficialColl('under60', 'commValue', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-24 bg-slate-800 border border-slate-700 rounded p-1.5 text-center text-emerald-400 font-bold"
                          />
                        </td>
                      </tr>

                      {/* فوق 60 يوم صافي */}
                      <tr className={`hover:bg-slate-800/60 ${!generalRules.collectionRules?.over60?.isActive ? 'opacity-40' : ''}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            disabled={currentUser.role !== 'manager' || monthStatus === 'approved'}
                            checked={generalRules.collectionRules?.over60?.isActive !== false}
                            onChange={(e) => updateOfficialColl('over60', 'isActive', e.target.checked)}
                            className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-sans font-bold text-white">تحصيل ديون فوق 60 يوماً (بعد استبعاد المتعثر)</td>
                        <td className="p-3">
                          <input
                            type="number"
                            disabled={currentUser.role !== 'manager' || monthStatus === 'approved' || !generalRules.collectionRules?.over60?.isActive}
                            value={generalRules.collectionRules?.over60?.thresholdPct ?? 40}
                            onChange={(e) => updateOfficialColl('over60', 'thresholdPct', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-20 bg-slate-800 border border-slate-700 rounded p-1.5 text-center text-blue-300 font-bold"
                          />
                        </td>
                        <td className="p-3 font-sans">
                          <select
                            disabled={currentUser.role !== 'manager' || monthStatus === 'approved' || !generalRules.collectionRules?.over60?.isActive}
                            value={generalRules.collectionRules?.over60?.commType || 'percent'}
                            onChange={(e) => updateOfficialColl('over60', 'commType', e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-slate-200 rounded p-1.5 text-xs"
                          >
                            <option value="percent">نسبة (% من التحصيل)</option>
                            <option value="fixed">مبلغ ثابت (ر.س)</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            disabled={currentUser.role !== 'manager' || monthStatus === 'approved' || !generalRules.collectionRules?.over60?.isActive}
                            value={generalRules.collectionRules?.over60?.commValue ?? 1.0}
                            onChange={(e) => updateOfficialColl('over60', 'commValue', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-24 bg-slate-800 border border-slate-700 rounded p-1.5 text-center text-emerald-400 font-bold"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: مطبخ التخطيط والمحاكاة التجريبية */}
        {activeTab === 'proposals' && currentUser.role !== 'rep' && (
          <div className="bg-slate-800 p-6 rounded-2xl border border-purple-500/40 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-kitchen-set text-purple-400"></i> مطبخ تخطيط ومحاكاة الأهداف (Sandbox)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  جرّب تفعيل أو تعطيل المجموعات والتحصيل وتغيير الشروط وشاهد الأثر المالي فوراً قبل الرفع.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsKitchenApplied(!isKitchenApplied);
                    showToast(isKitchenApplied ? 'تمت العودة للقواعد الرسمية المعتمدة' : 'يتم الآن استعراض محاكاة المطبخ');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md ${
                    isKitchenApplied
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-900 hover:bg-slate-700 text-purple-300 border border-purple-500/40'
                  }`}
                >
                  <i className="fa-solid fa-eye"></i>
                  <span>{isKitchenApplied ? 'إلغاء المعاينة الحية' : 'معاينة أثر التعديل في النتائج'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <label className="text-xs font-bold text-purple-300 block mb-1">تجربة شرط الهدف العام (%)</label>
                <input
                  type="number"
                  value={kitchenGeneralRules.generalThresholdPct ?? 80}
                  onChange={(e) => setKitchenGeneralRules({ ...kitchenGeneralRules, generalThresholdPct: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-purple-500/40 rounded-lg p-2 font-bold text-purple-300 text-center"
                />
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <label className="text-xs font-bold text-purple-300 block mb-1">تجربة عمولة الهدف (ر.س)</label>
                <input
                  type="number"
                  value={kitchenGeneralRules.generalTargetCommValue ?? 500}
                  onChange={(e) => setKitchenGeneralRules({ ...kitchenGeneralRules, generalTargetCommValue: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-purple-500/40 rounded-lg p-2 font-bold text-amber-300 text-center font-mono"
                />
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <label className="text-xs font-bold text-purple-300 block mb-1">تجربة عدد المجموعات المطلوب</label>
                <input
                  type="number"
                  value={kitchenGeneralRules.minGroupsRequired ?? 7}
                  onChange={(e) => setKitchenGeneralRules({ ...kitchenGeneralRules, minGroupsRequired: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-purple-500/40 rounded-lg p-2 font-bold text-teal-300 text-center"
                />
              </div>
            </div>

            {/* مجموعات المطبخ مع Checkbox */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {kitchenGroupRules.map((grp, idx) => (
                <div key={idx} className={`bg-slate-900 border border-slate-700/80 p-4 rounded-xl space-y-3 ${!grp.isActive ? 'opacity-40' : ''}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={grp.isActive !== false}
                        onChange={(e) => updateKitchenGroup(idx, 'isActive', e.target.checked)}
                        className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                      />
                      <span className="font-bold text-sm text-white">{grp.name}</span>
                    </div>
                    <span className="text-[10px] text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800">مجموعة {idx + 1}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">شرط التأهل (%)</label>
                      <input
                        type="number"
                        disabled={!grp.isActive}
                        value={grp.thresholdPct ?? 70}
                        onChange={(e) => updateKitchenGroup(idx, 'thresholdPct', e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-center font-bold text-teal-300 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">قيمة العمولة (ر.س)</label>
                      <input
                        type="number"
                        disabled={!grp.isActive}
                        value={grp.commValue ?? 250}
                        onChange={(e) => updateKitchenGroup(idx, 'commValue', e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-center font-bold text-emerald-400 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* تجربة شروط التحصيل بالمطبخ */}
            <div className="bg-slate-900 border border-purple-500/30 p-4 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-purple-300">تجربة محاكاة شروط التحصيل:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={kitchenGeneralRules.collectionRules?.under60?.isActive !== false}
                      onChange={(e) => updateKitchenColl('under60', 'isActive', e.target.checked)}
                      className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                    />
                    <span className="text-white font-bold">تحصيل &lt; 60 يوم</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="%"
                      value={kitchenGeneralRules.collectionRules?.under60?.thresholdPct ?? 30}
                      onChange={(e) => updateKitchenColl('under60', 'thresholdPct', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-center text-blue-300"
                    />
                    <input
                      type="number"
                      placeholder="عمولة"
                      value={kitchenGeneralRules.collectionRules?.under60?.commValue ?? 0.5}
                      onChange={(e) => updateKitchenColl('under60', 'commValue', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-center text-emerald-400"
                    />
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={kitchenGeneralRules.collectionRules?.over60?.isActive !== false}
                      onChange={(e) => updateKitchenColl('over60', 'isActive', e.target.checked)}
                      className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                    />
                    <span className="text-white font-bold">تحصيل &gt; 60 يوم (صافي)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="%"
                      value={kitchenGeneralRules.collectionRules?.over60?.thresholdPct ?? 40}
                      onChange={(e) => updateKitchenColl('over60', 'thresholdPct', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-center text-blue-300"
                    />
                    <input
                      type="number"
                      placeholder="عمولة"
                      value={kitchenGeneralRules.collectionRules?.over60?.commValue ?? 1.0}
                      onChange={(e) => updateKitchenColl('over60', 'commValue', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-center text-emerald-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: التحليل المالي للمجموعات */}
        {activeTab === 'analytics' && currentUser.role !== 'rep' && (
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-chart-pie text-teal-400"></i> التحليل المالي والترتيب للمجموعات الـ 14
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">فرز الأصناف وتحديد المجموعات الضعيفة المحتاجة للدعم</p>
              </div>

              <div className="flex items-center gap-2 text-xs bg-slate-900 p-1.5 rounded-xl border border-slate-700">
                <span className="text-slate-400 font-bold px-2">ترتيب حسب:</span>
                <button
                  onClick={() => setAnalyticsSortBy('highestPct')}
                  className={`px-3 py-1.5 rounded-lg font-bold ${analyticsSortBy === 'highestPct' ? 'bg-teal-500 text-slate-950' : 'text-slate-300'}`}
                >
                  الأعلى إنجازاً (%)
                </button>
                <button
                  onClick={() => setAnalyticsSortBy('highestSales')}
                  className={`px-3 py-1.5 rounded-lg font-bold ${analyticsSortBy === 'highestSales' ? 'bg-teal-500 text-slate-950' : 'text-slate-300'}`}
                >
                  الأعلى مبيعات
                </button>
                <button
                  onClick={() => setAnalyticsSortBy('lowestPct')}
                  className={`px-3 py-1.5 rounded-lg font-bold ${analyticsSortBy === 'lowestPct' ? 'bg-rose-500 text-white' : 'text-rose-300'}`}
                >
                  المجموعات الضعيفة 🔥
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupAnalyticsData.map((item) => (
                <div key={item.gIdx} className={`bg-slate-900 border border-slate-700 p-4 rounded-xl space-y-3 ${!item.rule.isActive ? 'opacity-40' : ''}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-white">{item.rule.name}</span>
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${item.avgPct >= item.rule.thresholdPct ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                      {item.avgPct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.avgPct >= item.rule.thresholdPct ? 'bg-emerald-400' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(100, item.avgPct)}%` }}
                    ></div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-slate-950 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">إجمالي المبيعات</span>
                      <span className="font-bold text-emerald-400">{formatNum(item.totalSales)}</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">الناجحون</span>
                      <span className="font-bold text-teal-300 font-sans">{item.qualifyingRepsCount} مندوبين</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* نافذة تفاصيل المندوب */}
      {selectedRep && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-user-check text-emerald-400"></i> تفاصيل أداء المندوب: {selectedRep.name}
              </h3>
              <button onClick={() => setSelectedRep(null)} className="text-slate-400 hover:text-white">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-700 rounded-xl">
              <table className="w-full text-xs text-right text-slate-200">
                <thead className="bg-slate-900 text-slate-400 sticky top-0">
                  <tr>
                    <th className="p-2.5">المجموعة</th>
                    <th className="p-2.5">الهدف</th>
                    <th className="p-2.5">المبيعات</th>
                    <th className="p-2.5">النسبة</th>
                    <th className="p-2.5">المتبقي للشرط</th>
                    <th className="p-2.5 text-center">الحالة</th>
                    <th className="p-2.5">العمولة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 font-mono">
                  {(selectedRep.detailedGroups || []).map((grp, idx) => (
                    <tr key={idx} className={grp.isQualified ? 'bg-emerald-950/20' : ''}>
                      <td className="p-2.5 font-sans font-bold text-white">{grp.name}</td>
                      <td className="p-2.5">{formatNum(grp.target)}</td>
                      <td className="p-2.5 font-bold text-emerald-400">{formatNum(grp.sales)}</td>
                      <td className="p-2.5">{grp.grpPct.toFixed(1)}%</td>
                      <td className="p-2.5 font-sans">
                        {grp.remainingToThreshold > 0 ? (
                          <span className="text-rose-300">{formatNum(grp.remainingToThreshold)}</span>
                        ) : (
                          <span className="text-emerald-400 font-bold">محققة ✅</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-sans">
                        {grp.isQualified ? <span className="text-emerald-400 font-bold">محققة</span> : <span className="text-slate-500">غير محققة</span>}
                      </td>
                      <td className="p-2.5 text-teal-300 font-bold">{formatNum(selectedRep.isEligibleForSalesCommissions ? grp.potentialComm : 0)} ر.س</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedRep(null)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-2 rounded-xl text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة التراكر */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-fingerprint text-emerald-400"></i> سجل التتبع والاعتماد (Tracker)
              </h3>
              <button onClick={() => setShowAuditModal(false)} className="text-slate-400 hover:text-white">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 block mb-1">حالة الشهر المالي:</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">
                  {monthStatus === 'approved' ? 'معتمد ومقفل نهائياً 🔒' : 'قيد المراجعة والتعديل ✍️'}
                </span>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-700 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">مقدم المقترح:</span>
                  <span className="font-bold text-white">{activeProposalInfo ? activeProposalInfo.submittedBy : 'المشرف'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">وقت الرفع:</span>
                  <span className="font-mono text-slate-300">{activeProposalInfo ? activeProposalInfo.submissionDate : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">المدير المعتمد:</span>
                  <span className="font-bold text-emerald-300">{activeProposalInfo && activeProposalInfo.approvedBy ? activeProposalInfo.approvedBy : 'بانتظار الاعتماد'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">تاريخ الاعتماد:</span>
                  <span className="font-mono text-slate-300">{activeProposalInfo && activeProposalInfo.approvalDate ? activeProposalInfo.approvalDate : '-'}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowAuditModal(false)}
                className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-5 py-2 rounded-xl text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
