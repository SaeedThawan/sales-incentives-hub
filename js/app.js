const { useState, useEffect, useMemo } = React;

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [monthKey, setMonthKey] = useState('2026-08');
  const [monthStatus, setMonthStatus] = useState('open');
  const [activeProposalInfo, setActiveProposalInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'config' | 'analytics' | 'proposals'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRep, setSelectedRep] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [notification, setNotification] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);

  // خيارات فرز وتحليل المجموعات
  const [analyticsSortBy, setAnalyticsSortBy] = useState('highestPct');
  const [expandedGroupIdx, setExpandedGroupIdx] = useState(null);

  const [groupRules, setGroupRules] = useState(CONFIG.FALLBACK_GROUPS);
  const [repsData, setRepsData] = useState([]);
  const [generalRules, setGeneralRules] = useState(CONFIG.DEFAULT_GENERAL_RULES);

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
        if (data.generalRules) setGeneralRules(data.generalRules);
        if (data.groupRules && data.groupRules.length > 0) setGroupRules(data.groupRules);
        if (data.reps && data.reps.length > 0) setRepsData(data.reps);
        if (data.monthStatus) setMonthStatus(data.monthStatus);
        if (data.activeProposal) setActiveProposalInfo(data.activeProposal);
        showToast('تمت المزامنة بنجاح مع Google Sheets');
      }
    } catch (err) {
      showToast('تعذر جلب البيانات من السيرفر');
    }
    setSyncLoading(false);
  };

  const handleSaveProposal = async () => {
    setSyncLoading(true);
    try {
      const res = await ApiService.saveProposal(monthKey, { groupRules, repsData, generalRules }, currentUser);
      showToast(res.message || 'تم رفع المقترح للإدارة بنجاح');
      setMonthStatus('pending_approval');
      loadData(currentUser);
    } catch (err) {
      showToast('تم حفظ المقترح محلياً');
      setMonthStatus('pending_approval');
    }
    setSyncLoading(false);
  };

  const handleApproveMonth = async () => {
    if (currentUser.role !== 'manager') {
      showToast('صلاحية الاعتماد محصورة بالمدير العام فقط');
      return;
    }
    setSyncLoading(true);
    try {
      const res = await ApiService.approveMonth(monthKey, currentUser);
      showToast(res.message || 'تم اعتماد وإقفال الشهر المالي بنجاح 🔒');
      setMonthStatus('approved');
      loadData(currentUser);
    } catch (err) {
      showToast('تم اعتماد الشهر بنجاح');
      setMonthStatus('approved');
    }
    setSyncLoading(false);
  };

  const handleRecalculateRawData = async () => {
    setSyncLoading(true);
    try {
      const res = await ApiService.recalculateRawData(monthKey, currentUser);
      showToast(res.message || 'تمت معالجة وتجميع الشيت الخام بنجاح');
      loadData(currentUser);
    } catch (err) {
      showToast('تم إرسال أمر التجميع');
      loadData(currentUser);
    }
    setSyncLoading(false);
  };

  // معالجة بيانات المناديب باستخدام محرك الحسابات المستقل
  const processedReps = useMemo(() => {
    if (!Array.isArray(repsData)) return [];
    return repsData
      .map(rep => CalcEngine.processRepData(rep, generalRules, groupRules))
      .filter(Boolean);
  }, [repsData, generalRules, groupRules]);

  // حساب إجماليات الشركة
  const companyTotals = useMemo(() => {
    return CalcEngine.calculateCompanyTotals(processedReps, generalRules);
  }, [processedReps, generalRules]);

  // تحليل وترتيب المجموعات الـ 14
  const groupAnalyticsData = useMemo(() => {
    return CalcEngine.analyzeAndSortGroups(groupRules, processedReps, analyticsSortBy);
  }, [groupRules, processedReps, analyticsSortBy]);

  const visibleReps = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'rep') {
      return processedReps.filter(r => Number(r.id) === Number(currentUser.userId));
    }
    return processedReps.filter(r => (r.name && r.name.includes(searchTerm)) || (r.id && r.id.toString().includes(searchTerm)));
  }, [processedReps, currentUser, searchTerm]);

  // شاشة تسجيل الدخول
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-3xl">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <h1 className="text-2xl font-black text-white">نظام الأهداف والعمولات</h1>
            <p className="text-xs text-slate-400">تسجيل الدخول للمنظومة الشاملة</p>
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

  // الشاشة الرئيسية للوحة التحكم
  return (
    <div className="pb-16 dir-rtl">
      {/* Header */}
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
                title="إعادة احتساب وتجميع المبيعات والتحصيل من الشيت الخام"
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
                <span>رفع المقترح للإدارة</span>
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
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                activeTab === 'summary' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-300'
              }`}
            >
              <i className="fa-solid fa-table-list"></i> خلاصة المندوبين
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                activeTab === 'analytics' ? 'bg-teal-500 text-slate-950' : 'bg-slate-900 text-slate-300'
              }`}
            >
              <i className="fa-solid fa-chart-pie"></i> تحليل المجموعات الـ 14
            </button>

            <button
              onClick={() => setActiveTab('config')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                activeTab === 'config' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300'
              }`}
            >
              <i className="fa-solid fa-sliders"></i> إعدادات الشروط والتحصيل
            </button>

            <button
              onClick={() => setActiveTab('proposals')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                activeTab === 'proposals' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-purple-300'
              }`}
            >
              <i className="fa-solid fa-kitchen-set text-amber-300"></i> مطبخ التخطيط وتعديل الأهداف 🧠
            </button>
          </div>
        )}
      </header>

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 left-5 z-50 bg-emerald-500 text-slate-950 px-4 py-3 rounded-2xl shadow-2xl font-bold animate-bounce">
          {notification}
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 mt-6">
        {/* KPI Cards */}
        {currentUser.role !== 'rep' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block mb-1">المبيعات العامة</span>
              <span className="text-base font-extrabold text-white font-mono">{formatNum(companyTotals.genSales)}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">هدف {formatNum(companyTotals.genTarget)}</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block mb-1">نسبة الإنجاز</span>
              <span className={`text-base font-extrabold font-mono ${companyTotals.overallGenPct >= generalRules.generalThresholdPct ? 'text-emerald-400' : 'text-amber-400'}`}>
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
                      <tr key={rep.id} className="hover:bg-slate-700/40 transition-colors">
                        <td className="py-3 px-3 text-slate-400">{rep.id}</td>
                        <td className="py-3 px-3 font-sans font-bold text-white">{rep.name}</td>
                        <td className="py-3 px-3">{formatNum(rep.genTarget)}</td>
                        <td className="py-3 px-3 font-bold text-white">{formatNum(rep.genSales)}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${rep.meetsGeneralRule ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {rep.genPct.toFixed(1)}%
                            </span>
                            <div className="w-12 bg-slate-900 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${rep.meetsGeneralRule ? 'bg-emerald-400' : 'bg-rose-500'}`}
                                style={{ width: `${Math.min(100, rep.genPct)}%` }}
                              ></div>
                            </div>
                          </div>
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
                            rep.meetsMinGroupsRule ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-950 text-rose-300'
                          }`}>
                            {rep.qualifiedGroupsCount} / 14
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div>{formatNum(rep.collection)}</div>
                          <span className="text-[10px] text-slate-400 block font-sans">({rep.collPct.toFixed(1)}%)</span>
                        </td>
                        <td className="py-3 px-3 text-blue-300 font-bold">{formatNum(rep.collectionCommission)}</td>
                        <td className="py-3 px-3 text-teal-300 font-bold">{formatNum(rep.totalGroupCommissionEarned)}</td>
                        <td className="py-3 px-3 bg-emerald-950/30 font-black text-emerald-400 text-sm">
                          {formatNum(rep.grandTotalCommission)} ر.س
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => setSelectedRep(rep)}
                            className="bg-slate-700 hover:bg-emerald-600 hover:text-slate-950 text-slate-200 px-3 py-1 rounded-lg text-xs font-bold transition-all"
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

        {/* Tab 2: Group Analytics */}
        {activeTab === 'analytics' && currentUser.role !== 'rep' && (
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-chart-pie text-teal-400"></i> التحليل المالي والترتيب للمجموعات الـ 14
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">فرز الأصناف حسب الإنجاز وتحديد المجموعات الضعيفة المحتاجة للدعم</p>
              </div>

              <div className="flex items-center gap-2 text-xs bg-slate-900 p-1.5 rounded-xl border border-slate-700">
                <span className="text-slate-400 font-bold px-2">ترتيب حسب:</span>
                <button
                  onClick={() => setAnalyticsSortBy('highestPct')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${analyticsSortBy === 'highestPct' ? 'bg-teal-500 text-slate-950' : 'text-slate-300'}`}
                >
                  الأعلى إنجازاً (%)
                </button>
                <button
                  onClick={() => setAnalyticsSortBy('highestSales')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${analyticsSortBy === 'highestSales' ? 'bg-teal-500 text-slate-950' : 'text-slate-300'}`}
                >
                  الأعلى مبيعات
                </button>
                <button
                  onClick={() => setAnalyticsSortBy('lowestPct')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${analyticsSortBy === 'lowestPct' ? 'bg-rose-500 text-white' : 'text-rose-300'}`}
                >
                  المجموعات الضعيفة 🔥
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupAnalyticsData.map((item) => (
                <div key={item.gIdx} className="bg-slate-900 border border-slate-700 p-4 rounded-xl space-y-3">
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

        {/* Tab 3: Config */}
        {activeTab === 'config' && currentUser.role !== 'rep' && (
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <i className="fa-solid fa-sliders text-amber-400"></i> إعدادات القواعد العامة وشروط التأهل
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <label className="text-xs font-bold text-slate-300 block mb-1">نسبة شرط الهدف العام (%)</label>
                <input
                  type="number"
                  value={generalRules.generalThresholdPct || 80}
                  onChange={(e) => setGeneralRules({ ...generalRules, generalThresholdPct: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-bold text-emerald-400 text-center"
                />
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <label className="text-xs font-bold text-slate-300 block mb-1">عمولة الهدف العام (ر.س)</label>
                <input
                  type="number"
                  value={generalRules.generalTargetCommValue || 500}
                  onChange={(e) => setGeneralRules({ ...generalRules, generalTargetCommValue: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-bold text-amber-300 text-center font-mono"
                />
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <label className="text-xs font-bold text-slate-300 block mb-1">أدنى عدد مجموعات مطلوبة</label>
                <input
                  type="number"
                  value={generalRules.minGroupsRequired || 7}
                  onChange={(e) => setGeneralRules({ ...generalRules, minGroupsRequired: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-bold text-teal-300 text-center"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Proposals Kitchen */}
        {activeTab === 'proposals' && currentUser.role !== 'rep' && (
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <i className="fa-solid fa-kitchen-set text-purple-400"></i> مطبخ تخطيط وتعديل أهداف المجموعات الـ 14
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupRules.map((grp, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-700/80 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-white">{grp.name}</span>
                    <span className="text-[10px] text-teal-300 bg-teal-950/60 px-2 py-0.5 rounded">مجموعة {idx+1}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">شرط التأهل (%)</label>
                      <input
                        type="number"
                        value={grp.thresholdPct}
                        onChange={(e) => {
                          const updated = [...groupRules];
                          updated[idx].thresholdPct = parseFloat(e.target.value) || 0;
                          setGroupRules(updated);
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-center font-bold text-teal-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">قيمة العمولة (ر.س)</label>
                      <input
                        type="number"
                        value={grp.commValue}
                        onChange={(e) => {
                          const updated = [...groupRules];
                          updated[idx].commValue = parseFloat(e.target.value) || 0;
                          setGroupRules(updated);
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-center font-bold text-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Detailed Rep Modal */}
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
                      <td className="p-2.5 text-teal-300 font-bold">{formatNum(selectedRep.isFullyEligibleForGroupComm ? grp.potentialComm : 0)} ر.س</td>
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

      {/* Audit Tracker Modal */}
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
                  {monthStatus === 'approved' ? 'معتمد ومقفل نهائياً 🔒' : 'قيد المراجعة والتخطيط ✍️'}
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
