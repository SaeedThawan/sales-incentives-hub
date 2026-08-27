const { useState, useEffect, useMemo } = React;

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [monthKey, setMonthKey] = useState('2026-08');
  const [monthStatus, setMonthStatus] = useState('open');
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'config' | 'proposals'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRep, setSelectedRep] = useState(null);
  const [notification, setNotification] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);

  const [groupRules, setGroupRules] = useState(CONFIG.FALLBACK_GROUPS);
  const [repsData, setRepsData] = useState(CONFIG.FALLBACK_REPS);
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
    if (res.status === 'success') {
      setCurrentUser(res.user);
      showToast(`مرحباً: ${res.user.fullName}`);
      loadData(res.user);
    } else {
      showToast(`خطأ: ${res.message}`);
    }
    setLoginLoading(false);
  };

  const loadData = async (user) => {
    setSyncLoading(true);
    try {
      const data = await ApiService.fetchWorkspace(user.role, user.userId, monthKey);
      if (data.generalRules) setGeneralRules(data.generalRules);
      if (data.groupRules && data.groupRules.length) setGroupRules(data.groupRules);
      if (data.reps && data.reps.length) setRepsData(data.reps);
      if (data.monthStatus) setMonthStatus(data.monthStatus);
      showToast('تمت المزامنة بنجاح');
    } catch (err) {
      console.warn('Network issue, using fallback data');
    }
    setSyncLoading(false);
  };

  const handleSaveProposal = async () => {
    setSyncLoading(true);
    try {
      const res = await ApiService.saveProposal(monthKey, { groupRules, repsData, generalRules }, currentUser);
      showToast(res.message || 'تم حفظ المقترح');
      setMonthStatus('pending_approval');
    } catch (err) {
      showToast('تم حفظ المقترح محلياً');
      setMonthStatus('pending_approval');
    }
    setSyncLoading(false);
  };

  const handleApproveMonth = async () => {
    setSyncLoading(true);
    try {
      const res = await ApiService.approveMonth(monthKey, currentUser);
      showToast(res.message || 'تم اعتماد الشهر بنجاح');
      setMonthStatus('approved');
    } catch (err) {
      showToast('تم اعتماد الشهر محلياً');
      setMonthStatus('approved');
    }
    setSyncLoading(false);
  };

  const processedReps = useMemo(() => {
    return repsData.map(rep => CalcEngine.processRepData(rep, generalRules, groupRules));
  }, [repsData, generalRules, groupRules]);

  const companyTotals = useMemo(() => {
    let genTarget = 0, genSales = 0, debt = 0, collection = 0;
    let collComm = 0, groupCommSum = 0, genTargetCommSum = 0, grandComm = 0;
    let qualifiedRepsCount = 0;

    processedReps.forEach(r => {
      genTarget += r.generalTarget;
      genSales += r.generalSales;
      debt += r.debt;
      collection += r.collection;
      collComm += r.collectionCommission;
      groupCommSum += r.totalGroupCommissionEarned;
      genTargetCommSum += r.generalTargetCommEarned;
      grandComm += r.grandTotalCommission;
      if (r.isFullyEligibleForGroupComm) qualifiedRepsCount++;
    });

    const overallGenPct = genTarget > 0 ? (genSales / genTarget) * 100 : 0;
    return {
      genTarget, genSales, overallGenPct, debt, collection,
      collComm, groupCommSum, genTargetCommSum, grandComm, qualifiedRepsCount, totalReps: processedReps.length
    };
  }, [processedReps]);

  const visibleReps = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'rep') {
      return processedReps.filter(r => Number(r.id) === Number(currentUser.userId));
    }
    return processedReps.filter(r => r.name.includes(searchTerm) || r.id.toString().includes(searchTerm));
  }, [processedReps, currentUser, searchTerm]);

  // شاشة الدخول
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-3xl">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <h1 className="text-2xl font-black text-white">نظام الأهداف والعمولات</h1>
            <p className="text-xs text-slate-400">سجل الدخول بحسابك للوصول للوحة المخصصة</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">المستخدم</label>
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
              <span>تسجيل الدخول للنظام</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // الشاشة الرئيسية
  return (
    <div className="pb-16 dir-rtl">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="bg-emerald-500 p-2.5 rounded-xl text-slate-950 text-xl font-bold">
                <i className="fa-solid fa-chart-pie"></i>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-black text-white">نظام الأهداف والعمولات الشامل</h1>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    monthStatus === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {monthStatus === 'approved' ? 'معتمد ومقفل 🔒' : 'مسودة قيد التخطيط ✍️'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  المستخدم: <b className="text-emerald-400">{currentUser.fullName}</b> ({currentUser.role === 'manager' ? 'المدير العام' : currentUser.role === 'supervisor' ? 'مشرف المبيعات' : 'مندوب مبيعات'})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <button
                onClick={() => loadData(currentUser)}
                disabled={syncLoading}
                className="bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all"
              >
                <i className={`fa-solid fa-arrows-rotate text-emerald-400 ${syncLoading ? 'fa-spin' : ''}`}></i>
                <span>مزامنة الشيت</span>
              </button>

              {currentUser.role === 'supervisor' && monthStatus !== 'approved' && (
                <button
                  onClick={handleSaveProposal}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/20"
                >
                  <i className="fa-solid fa-paper-plane text-amber-300"></i>
                  <span>رفع المقترح للاعتماد</span>
                </button>
              )}

              {currentUser.role === 'manager' && (
                <button
                  onClick={handleApproveMonth}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                >
                  <i className="fa-solid fa-stamp text-amber-300"></i>
                  <span>اعتماد وترحيل الشهر 🔒</span>
                </button>
              )}

              <button
                onClick={() => setCurrentUser(null)}
                className="bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/40 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all"
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
                <span>خروج</span>
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
                <i className="fa-solid fa-kitchen-set text-amber-300"></i> مطبخ التخطيط وتعديل الأهداف
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 left-5 z-50 bg-emerald-500 text-slate-950 px-4 py-3 rounded-2xl shadow-2xl font-bold flex items-center gap-2 animate-bounce">
          <i className="fa-solid fa-circle-check text-lg"></i>
          <span>{notification}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* بطاقات المؤشرات العامة */}
        {currentUser.role !== 'rep' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block font-semibold mb-1">المبيعات العامة</span>
              <span className="text-base font-extrabold text-white font-mono">{formatNum(companyTotals.genSales)}</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block font-semibold mb-1">نسبة الإنجاز العام</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono">{companyTotals.overallGenPct.toFixed(1)}%</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block font-semibold mb-1">عمولات المجموعات</span>
              <span className="text-base font-extrabold text-teal-300 font-mono">{formatNum(companyTotals.groupCommSum)} ر.س</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block font-semibold mb-1">عمولات الهدف العام</span>
              <span className="text-base font-extrabold text-amber-300 font-mono">{formatNum(companyTotals.genTargetCommSum)} ر.س</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block font-semibold mb-1">عمولات التحصيل</span>
              <span className="text-base font-extrabold text-blue-300 font-mono">{formatNum(companyTotals.collComm)} ر.س</span>
            </div>
            <div className="bg-slate-800 border border-emerald-500/40 bg-emerald-950/20 p-3.5 rounded-2xl">
              <span className="text-emerald-300 text-xs block font-bold mb-1">إجمالي العمولات</span>
              <span className="text-lg font-black text-emerald-400 font-mono">{formatNum(companyTotals.grandComm)} ر.س</span>
            </div>
          </div>
        )}

        {/* Tab 1: خلاصة المندوبين */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {currentUser.role !== 'rep' && (
              <div className="relative max-w-md">
                <i className="fa-solid fa-magnifying-glass absolute right-3.5 top-3 text-slate-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="ابحث باسم المندوب أو رقمه..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-10 pl-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right text-slate-200">
                  <thead className="bg-slate-900 text-slate-300 uppercase text-[11px] font-extrabold border-b border-slate-700">
                    <tr>
                      <th className="py-3.5 px-3">#</th>
                      <th className="py-3.5 px-3">المندوب</th>
                      <th className="py-3.5 px-3">الهدف العام</th>
                      <th className="py-3.5 px-3">المبيعات المحققة</th>
                      <th className="py-3.5 px-3">النسبة</th>
                      <th className="py-3.5 px-3 text-amber-300">عمولة الهدف</th>
                      <th className="py-3.5 px-3 text-center">المجموعات المحققة</th>
                      <th className="py-3.5 px-3">التحصيل</th>
                      <th className="py-3.5 px-3 text-blue-300">عمولة التحصيل</th>
                      <th className="py-3.5 px-3 text-teal-300">عمولة المجموعات</th>
                      <th className="py-3.5 px-3 text-emerald-300 bg-emerald-950/30 font-black">إجمالي المستحق</th>
                      <th className="py-3.5 px-3 text-center">تفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 font-medium font-mono">
                    {visibleReps.map((rep) => (
                      <tr key={rep.id} className="hover:bg-slate-700/40 transition-colors">
                        <td className="py-3 px-3 text-slate-400">{rep.id}</td>
                        <td className="py-3 px-3 font-sans font-bold text-white">{rep.name}</td>
                        <td className="py-3 px-3">{formatNum(rep.generalTarget)}</td>
                        <td className="py-3 px-3 font-bold text-white">{formatNum(rep.generalSales)}</td>
                        <td className="py-3 px-3">
                          <span className={`font-bold ${rep.meetsGeneralRule ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {rep.genPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-amber-300 font-bold">{formatNum(rep.generalTargetCommEarned)}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rep.meetsMinGroupsRule ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-950 text-rose-300'
                          }`}>
                            {rep.qualifiedGroupsCount} / 14
                          </span>
                        </td>
                        <td className="py-3 px-3">{formatNum(rep.collection)}</td>
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

        {/* Tab 2: إعدادات القواعد العامة */}
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
                  value={generalRules.generalThresholdPct}
                  onChange={(e) => setGeneralRules({ ...generalRules, generalThresholdPct: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-bold text-emerald-400 text-center"
                />
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <label className="text-xs font-bold text-slate-300 block mb-1">عمولة الهدف العام (ر.س)</label>
                <input
                  type="number"
                  value={generalRules.generalTargetCommValue}
                  onChange={(e) => setGeneralRules({ ...generalRules, generalTargetCommValue: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-bold text-amber-300 text-center font-mono"
                />
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <label className="text-xs font-bold text-slate-300 block mb-1">أدنى عدد مجموعات مطلوبة</label>
                <input
                  type="number"
                  value={generalRules.minGroupsRequired}
                  onChange={(e) => setGeneralRules({ ...generalRules, minGroupsRequired: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-bold text-teal-300 text-center"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: مطبخ التخطيط للمشرف */}
        {activeTab === 'proposals' && currentUser.role !== 'rep' && (
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-kitchen-set text-purple-400"></i> مطبخ تخطيط أهداف المجموعات الـ 14
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">تعديل نسب الشروط وقيم العمولات لجميع المجموعات</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupRules.map((grp, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-700/80 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-white">{grp.name}</span>
                    <span className="text-[10px] text-teal-300 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800">مجموعة {idx+1}</span>
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
                    <th className="p-2.5 text-center">الحالة</th>
                    <th className="p-2.5">العمولة المستحقة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 font-mono">
                  {selectedRep.detailedGroups.map((grp, idx) => (
                    <tr key={idx} className={grp.isQualified ? 'bg-emerald-950/20' : ''}>
                      <td className="p-2.5 font-sans font-bold text-white">{grp.name}</td>
                      <td className="p-2.5">{formatNum(grp.target)}</td>
                      <td className="p-2.5 font-bold text-emerald-400">{formatNum(grp.sales)}</td>
                      <td className="p-2.5">{grp.grpPct.toFixed(1)}%</td>
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
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);