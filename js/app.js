const { useState, useEffect, useMemo } = React;

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('hub_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

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
  const [expandedGroupIdx, setExpandedGroupIdx] = useState(null); // للدرج التفكيكي بالمطبخ

  // القواعد الرسمية
  const [generalRules, setGeneralRules] = useState({
    isGenTargetMandatory: true,
    generalThresholdPct: 80,
    generalTargetCommValue: 0,
    minGroupsRequired: 7,
    collectionRules: {
      isCollMandatory: false,
      over60: {
        isMandatory: false,
        thresholdPct: 40,
        tiers: [{ minPct: 40, rate: 0.01 }, { minPct: 50, rate: 0.02 }]
      },
      under60: { isActive: true, thresholdPct: 30, commType: 'percent', commValue: 0.5 }
    }
  });

  const [groupRules, setGroupRules] = useState(
    CONFIG.FALLBACK_GROUPS.map(g => ({ ...g, isActive: true, isMandatory: false }))
  );

  const [repsData, setRepsData] = useState([]);

  // قواعد وأهداف المطبخ التجريبي (مستقلة لحظياً)
  const [kitchenGeneralRules, setKitchenGeneralRules] = useState(null);
  const [kitchenGroupRules, setKitchenGroupRules] = useState(null);
  const [kitchenRepsData, setKitchenRepsData] = useState(null);
  const [isKitchenApplied, setIsKitchenApplied] = useState(false);

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
      localStorage.setItem('hub_user_session', JSON.stringify(res.user));
      showToast(`مرحباً بك: ${res.user.fullName}`);
      loadData(res.user);
    } else {
      showToast(`خطأ: ${res ? res.message : 'بيانات الدخول غير صحيحة'}`);
    }
    setLoginLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('hub_user_session');
    setCurrentUser(null);
  };

  const loadData = async (user) => {
    setSyncLoading(true);
    const activeUser = user || currentUser;
    try {
      const data = await ApiService.fetchWorkspace(activeUser.role, activeUser.userId, monthKey);
      if (data && data.status === 'success') {
        if (data.generalRules) {
          setGeneralRules(data.generalRules);
          if (!kitchenGeneralRules) setKitchenGeneralRules(data.generalRules);
        }
        if (data.groupRules && data.groupRules.length > 0) {
          const formattedGroups = data.groupRules.map(g => ({ ...g, isActive: g.isActive !== false, isMandatory: g.isMandatory === true }));
          setGroupRules(formattedGroups);
          if (!kitchenGroupRules) setKitchenGroupRules(formattedGroups);
        }
        if (data.reps && data.reps.length > 0) {
          const formattedReps = data.reps.map(r => ({ ...r, isActive: r.isActive !== false }));
          setRepsData(formattedReps);
          if (!kitchenRepsData) setKitchenRepsData(JSON.parse(JSON.stringify(formattedReps)));
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

  useEffect(() => {
    if (currentUser) loadData(currentUser);
  }, []);

  // تعديلات المطبخ التفاعلية
  const updateKitchenGroupComm = (gIdx, val) => {
    const updated = [...(kitchenGroupRules || groupRules)];
    updated[gIdx] = { ...updated[gIdx], commValue: val === '' ? '' : Number(val) };
    setKitchenGroupRules(updated);
  };

  const updateKitchenRepGroupTarget = (repId, gIdx, val) => {
    const updated = (kitchenRepsData || repsData).map(r => {
      if (Number(r.id) === Number(repId)) {
        const grps = [...r.groups];
        grps[gIdx] = { ...grps[gIdx], target: val === '' ? '' : Number(val) };
        return { ...r, groups: grps };
      }
      return r;
    });
    setKitchenRepsData(updated);
  };

  const updateKitchenRepCustomComm = (repId, gIdx, val) => {
    const updated = (kitchenRepsData || repsData).map(r => {
      if (Number(r.id) === Number(repId)) {
        const grps = [...r.groups];
        grps[gIdx] = { ...grps[gIdx], customComm: val === '' ? null : Number(val) };
        return { ...r, groups: grps };
      }
      return r;
    });
    setKitchenRepsData(updated);
  };

  const removeRepFromKitchenGroup = (repId, gIdx) => {
    updateKitchenRepGroupTarget(repId, gIdx, 0);
    showToast('تم استبعاد المندوب من المجموعة');
  };

  const handleAddNewDepartment = () => {
    const name = prompt('أدخل اسم المجموعة / القسم الجديد (مثال: قسم التجميل، كاش فان):');
    if (name && name.trim()) {
      const newGrp = {
        id: (kitchenGroupRules || groupRules).length,
        name: name.trim(),
        thresholdPct: 70,
        commType: 'fixed',
        commValue: 250,
        isActive: true,
        isMandatory: false
      };
      setKitchenGroupRules([...(kitchenGroupRules || groupRules), newGrp]);
      setKitchenRepsData((kitchenRepsData || repsData).map(r => ({
        ...r,
        groups: [...r.groups, { target: 0, sales: 0, customComm: null }]
      })));
      showToast(`تمت إضافة ${name} بنجاح لمطبخ التخطيط`);
    }
  };

  const handleSaveSupervisorProposal = async () => {
    setSyncLoading(true);
    try {
      const proposalPayload = {
        generalRules: kitchenGeneralRules || generalRules,
        groupRules: kitchenGroupRules || groupRules,
        repsTargets: (kitchenRepsData || repsData).map(r => ({ id: r.id, name: r.name, generalTarget: r.generalTarget, groups: r.groups }))
      };
      const res = await ApiService.saveProposal(monthKey, proposalPayload, currentUser);
      showToast(res.message || 'تم رفع مقترح المطبخ بنجاح للإدارة');
      setMonthStatus('pending_approval');
      loadData(currentUser);
    } catch (err) {
      showToast('تم حفظ المقترح');
    }
    setSyncLoading(false);
  };

  const handleSaveOfficialConfig = async () => {
    if (currentUser.role !== 'manager') {
      showToast('صلاحية الحفظ والتثبيت للمدير العام فقط');
      return;
    }
    setSyncLoading(true);
    try {
      const res = await ApiService.saveOfficialConfig(monthKey, {
        generalRules,
        groupRules,
        reps: repsData
      }, currentUser);
      showToast(res.message || 'تم تثبيت الشروط والأهداف الرسمية بنجاح 🔒');
      loadData(currentUser);
    } catch (err) {
      showToast('تم حفظ التعديلات');
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
    }
    setSyncLoading(false);
  };

  const activeGeneralRules = isKitchenApplied ? (kitchenGeneralRules || generalRules) : generalRules;
  const activeGroupRules = isKitchenApplied ? (kitchenGroupRules || groupRules) : groupRules;
  const activeRepsSource = isKitchenApplied ? (kitchenRepsData || repsData) : repsData;

  const processedReps = useMemo(() => {
    if (!Array.isArray(activeRepsSource)) return [];
    return activeRepsSource.map(rep => CalcEngine.processRepData(rep, activeGeneralRules, activeGroupRules)).filter(Boolean);
  }, [activeRepsSource, activeGeneralRules, activeGroupRules]);

  const companyTotals = useMemo(() => {
    return CalcEngine.calculateCompanyTotals(processedReps, activeGeneralRules);
  }, [processedReps, activeGeneralRules]);

  const kitchenMetrics = useMemo(() => {
    return CalcEngine.calculateKitchenMetrics(activeGroupRules, activeRepsSource);
  }, [activeGroupRules, activeRepsSource]);

  const visibleReps = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'rep') {
      return processedReps.filter(r => Number(r.id) === Number(currentUser.userId));
    }
    return processedReps.filter(r => (r.name && r.name.includes(searchTerm)) || (r.id && r.id.toString().includes(searchTerm)));
  }, [processedReps, currentUser, searchTerm]);

  const currentRep = useMemo(() => {
    return (currentUser && currentUser.role === 'rep' && visibleReps.length > 0) ? visibleReps[0] : null;
  }, [currentUser, visibleReps]);

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-3xl">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <h1 className="text-2xl font-black text-white">نظام الأهداف والعمولات</h1>
            <p className="text-xs text-slate-400">سجل الدخول برقم المندوب أو اسم المستخدم</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">اسم المستخدم / رقم المندوب</label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="admin / supervisor / 19"
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
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                    monthStatus === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
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
                onClick={() => ApiService.recalculateRawData(monthKey, currentUser).then(loadData)}
                disabled={syncLoading}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md"
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
                onClick={handleSaveSupervisorProposal}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-600/20"
              >
                <i className="fa-solid fa-paper-plane text-amber-300"></i>
                <span>رفع مقترح المطبخ للإدارة</span>
              </button>
            )}

            {currentUser.role === 'manager' && (
              monthStatus === 'approved' ? (
                <button onClick={() => setMonthStatus('open')} className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-xl shadow-md">
                  <i className="fa-solid fa-lock-open"></i> فتح التعديل مجدداً
                </button>
              ) : (
                <button onClick={handleApproveMonth} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl shadow-md">
                  <i className="fa-solid fa-stamp text-amber-300"></i> اعتماد وترحيل النهائي 🔒
                </button>
              )
            )}

            <button onClick={handleLogout} className="bg-rose-950/60 text-rose-300 border border-rose-800/40 px-3 py-1.5 rounded-xl hover:bg-rose-900">
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
              <i className="fa-solid fa-table-list"></i> خلاصة المندوبين وبوابات الاستحقاق
            </button>
            <button
              onClick={() => setActiveTab('kitchen')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 ${activeTab === 'kitchen' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-purple-300'}`}
            >
              <i className="fa-solid fa-kitchen-set text-amber-300"></i> المطبخ الرئيسي لتخطيط الأهداف والعمولات 🧠
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 ${activeTab === 'config' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300'}`}
            >
              <i className="fa-solid fa-sliders"></i> إعدادات البوابات والتحصيل 🔒
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
        {/* بطاقات الإجماليات */}
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
              <span className="text-[10px] text-slate-400 block mt-0.5">{companyTotals.qualifiedGroupsCount} مندوبين مؤهلين</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block mb-1">عمولة الهدف العام</span>
              <span className="text-base font-extrabold text-amber-300 font-mono">{formatNum(companyTotals.genTargetCommSum)} ر.س</span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">(شرط 80% = 0 ر.س)</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block mb-1">عمولة التحصيل</span>
              <span className="text-base font-extrabold text-blue-300 font-mono">{formatNum(companyTotals.collComm)} ر.س</span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">({companyTotals.overallCollPct.toFixed(1)}% من الدين)</span>
            </div>
            <div className="bg-slate-800 border border-emerald-500/40 bg-emerald-950/20 p-3.5 rounded-2xl">
              <span className="text-emerald-300 text-xs font-bold mb-1">إجمالي العمولات المستحقة</span>
              <span className="text-lg font-black text-emerald-400 font-mono">{formatNum(companyTotals.grandComm)} ر.س</span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: خلاصة المندوبين وبوابات الاستحقاق (Summary Table) */}
        {/* ========================================================================= */}
        {activeTab === 'summary' && currentUser.role !== 'rep' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="relative max-w-md w-full">
                <i className="fa-solid fa-magnifying-glass absolute right-3.5 top-3 text-slate-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="ابحث باسم المندوب أو الرقم..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-10 pl-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {currentUser.role === 'manager' && monthStatus !== 'approved' && (
                <button
                  onClick={handleSaveOfficialConfig}
                  disabled={syncLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
                >
                  <i className="fa-solid fa-floppy-disk text-amber-300"></i>
                  <span>حفظ وتثبيت الأهداف والعمولات 💾</span>
                </button>
              )}
            </div>

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
                      <th className="py-3.5 px-3 text-center">المجموعات المؤهلة (≥70%)</th>
                      <th className="py-3.5 px-3 text-teal-300 font-bold">عمولة المجموعات</th>
                      <th className="py-3.5 px-3">التحصيل الصافي</th>
                      <th className="py-3.5 px-3 text-blue-300">عمولة التحصيل</th>
                      <th className="py-3.5 px-3 text-emerald-300 font-black">إجمالي المستحق</th>
                      <th className="py-3.5 px-3">حالة البوابات والشروط</th>
                      <th className="py-3.5 px-3 text-center">تفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 font-mono">
                    {visibleReps.map((rep) => (
                      <tr key={rep.id} className={`hover:bg-slate-700/40 ${!rep.isActive ? 'opacity-35 bg-slate-950/60' : ''}`}>
                        <td className="py-3 px-3 text-slate-400">{rep.id}</td>
                        <td className="py-3 px-3 font-sans font-bold text-white">{rep.name}</td>
                        <td className="py-3 px-3">{formatNum(rep.genTarget)}</td>
                        <td className="py-3 px-3 font-bold text-white">{formatNum(rep.genSales)}</td>
                        <td className="py-3 px-3">
                          <span className={`font-bold ${rep.passGate_GenTarget ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {rep.genPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rep.isGroupsGateQualified ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-950 text-rose-300'
                          }`}>
                            {rep.qualifiedGroupsCount} / 14
                          </span>
                        </td>
                        <td className="py-3 px-3 text-teal-300 font-bold text-sm">{formatNum(rep.totalGroupCommissionEarned)} ر.س</td>
                        <td className="py-3 px-3">
                          <div>{formatNum(rep.collection)}</div>
                          <span className="text-[10px] text-slate-400 block font-sans">({rep.debt > 0 ? ((rep.collection / rep.debt) * 100).toFixed(1) : 0}%)</span>
                        </td>
                        <td className="py-3 px-3 text-blue-300 font-bold">{formatNum(rep.collectionCommission)}</td>
                        <td className="py-3 px-3 bg-emerald-950/30 font-black text-emerald-400 text-sm">
                          {formatNum(rep.grandTotalCommission)} ر.س
                        </td>
                        <td className="py-3 px-3 font-sans text-[11px]">
                          <span className={rep.isGroupsGateQualified ? 'text-emerald-400 font-bold' : 'text-rose-300'}>
                            {rep.eligibilityStatusText}
                          </span>
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

        {/* ========================================================================= */}
        {/* TAB 2: المطبخ الرئيسي لتخطيط الأهداف والعمولات (Planning Kitchen Dashboard) */}
        {/* ========================================================================= */}
        {activeTab === 'kitchen' && currentUser.role !== 'rep' && (
          <div className="bg-slate-800 p-6 rounded-3xl border border-purple-500/40 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700 pb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <i className="fa-solid fa-kitchen-set text-purple-400"></i> المطبخ الرئيسي لتخطيط الأهداف والعمولات / الحوافز
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  تحكم دقيق بالأصناف الاستراتيجية وتفكيك الأهداف وتخصيص العمولات الفردية مع المزامنة اللحظية.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddNewDepartment}
                  className="bg-purple-700 hover:bg-purple-600 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md"
                >
                  <i className="fa-solid fa-plus text-amber-300"></i>
                  <span>إضافة قسم / مجموعة جديدة</span>
                </button>
                <button
                  onClick={() => {
                    setIsKitchenApplied(!isKitchenApplied);
                    showToast(isKitchenApplied ? 'تمت العودة للقواعد الرسمية' : 'يتم الآن استعراض محاكاة المطبخ حياً');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md ${
                    isKitchenApplied ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-900 text-purple-300 border border-purple-500/40'
                  }`}
                >
                  <i className="fa-solid fa-eye"></i>
                  <span>{isKitchenApplied ? 'إلغاء المعاينة' : 'معاينة الخلاصة بالتقرير'}</span>
                </button>
              </div>
            </div>

            {/* جدول المجموعات الرئيسي (Master Table) */}
            <div className="border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-xs text-right bg-slate-900">
                <thead className="bg-slate-950 text-slate-300 uppercase text-[11px] font-extrabold border-b border-slate-700">
                  <tr>
                    <th className="p-3.5">#</th>
                    <th className="p-3.5">المجموعة / القسم الاستراتيجي</th>
                    <th className="p-3.5 text-center">المكلفين</th>
                    <th className="p-3.5">إجمالي الهدف</th>
                    <th className="p-3.5">المبيعات المحققة</th>
                    <th className="p-3.5">نسبة الإنجاز</th>
                    <th className="p-3.5">العمولة العامة (ر.س)</th>
                    <th className="p-3.5 text-amber-300">متوسط % العمولة من الهدف</th>
                    <th className="p-3.5 text-teal-300">تكلفة العمولة % من المبيعات</th>
                    <th className="p-3.5 text-center">التفكيك والتخصيص الفردي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {kitchenMetrics.map((km) => (
                    <React.Fragment key={km.gIdx}>
                      <tr className={`hover:bg-slate-800/60 ${km.isWeak ? 'bg-rose-950/20' : ''}`}>
                        <td className="p-3 text-slate-500 font-sans">{km.gIdx + 1}</td>
                        <td className="p-3 font-sans font-bold text-white text-sm">
                          <div className="flex items-center gap-2">
                            <span>{km.group.name}</span>
                            {km.isWeak && (
                              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] px-2 py-0.5 rounded-full font-sans">
                                ضعيف الإنجاز &lt;60% 🔥
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="bg-slate-800 px-2.5 py-0.5 rounded-full text-slate-300 font-sans">{km.assignedRepsCount} مندوبين</span>
                        </td>
                        <td className="p-3">{formatNum(km.totalTarget)}</td>
                        <td className="p-3 font-bold text-emerald-400">{formatNum(km.totalSales)}</td>
                        <td className="p-3">
                          <span className={`font-bold ${km.avgAchievementPct >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {km.avgAchievementPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={km.group.commValue}
                            onChange={(e) => updateKitchenGroupComm(km.gIdx, e.target.value)}
                            className="w-20 bg-slate-950 border border-purple-500/40 rounded p-1.5 text-center text-purple-300 font-bold"
                          />
                        </td>
                        <td className="p-3 text-amber-300">{km.avgCommissionFromTargetPct.toFixed(2)}%</td>
                        <td className="p-3 text-teal-300 font-bold">{km.commCostFromSalesPct.toFixed(2)}%</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setExpandedGroupIdx(expandedGroupIdx === km.gIdx ? null : km.gIdx)}
                            className={`px-3 py-1 rounded-xl font-sans font-bold text-xs flex items-center gap-1.5 mx-auto transition-all ${
                              expandedGroupIdx === km.gIdx ? 'bg-purple-600 text-white' : 'bg-slate-800 text-purple-300 border border-purple-500/30 hover:bg-slate-700'
                            }`}
                          >
                            <i className={`fa-solid ${expandedGroupIdx === km.gIdx ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                            <span>تفكيك وتخصيص الأفراد</span>
                          </button>
                        </td>
                      </tr>

                      {/* درج التفكيك والتخصيص الفردي (Accordion Drilldown) */}
                      {expandedGroupIdx === km.gIdx && (
                        <tr>
                          <td colSpan="10" className="bg-slate-950 p-5 border-y-2 border-purple-500/30">
                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <h4 className="text-xs font-bold text-purple-300 flex items-center gap-2">
                                  <i className="fa-solid fa-users"></i> الموظفون المكلفون بمجموعة: <b className="text-white">{km.group.name}</b>
                                </h4>
                                <span className="text-[11px] text-slate-400">تعديل الأهداف والعمولات الخاصة الفردية (Override)</span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-sans">
                                {(kitchenRepsData || repsData).map((rep) => {
                                  const rGrp = (rep.groups && rep.groups[km.gIdx]) || { target: 0, sales: 0, customComm: null };
                                  const pct = rGrp.target > 0 ? (rGrp.sales / rGrp.target) * 100 : 0;
                                  const effectiveComm = rGrp.customComm !== null && rGrp.customComm !== undefined ? rGrp.customComm : km.group.commValue;

                                  return (
                                    <div key={rep.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3 shadow-md">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <span className="font-bold text-white text-xs block">{rep.name}</span>
                                          <span className="text-[10px] text-slate-400 font-mono">مندوب #{rep.id}</span>
                                        </div>
                                        <button
                                          onClick={() => removeRepFromKitchenGroup(rep.id, km.gIdx)}
                                          title="استبعاد من هذه المجموعة"
                                          className="text-slate-500 hover:text-rose-400 text-xs p-1"
                                        >
                                          <i className="fa-solid fa-user-xmark"></i>
                                        </button>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                        <div>
                                          <label className="text-[10px] text-slate-400 block mb-1 font-sans">الهدف الفردي</label>
                                          <input
                                            type="number"
                                            value={rGrp.target}
                                            onChange={(e) => updateKitchenRepGroupTarget(rep.id, km.gIdx, e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-center text-emerald-400 font-bold"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[10px] text-slate-400 block mb-1 font-sans">العمولة المخصصة</label>
                                          <input
                                            type="number"
                                            placeholder={`افتراضي (${km.group.commValue})`}
                                            value={rGrp.customComm !== null && rGrp.customComm !== undefined ? rGrp.customComm : ''}
                                            onChange={(e) => updateKitchenRepCustomComm(rep.id, km.gIdx, e.target.value)}
                                            className="w-full bg-slate-950 border border-purple-500/30 rounded p-1.5 text-center text-purple-300 font-bold"
                                          />
                                        </div>
                                      </div>

                                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-2 border-t border-slate-800 font-mono">
                                        <span>مبيعات: <b className="text-white">{formatNum(rGrp.sales)}</b></span>
                                        <span className={`font-bold ${pct >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                          الإنجاز: {pct.toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: إعدادات البوابات والتحصيل الرسمية (Config) */}
        {/* ========================================================================= */}
        {activeTab === 'config' && currentUser.role !== 'rep' && (
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-sliders text-amber-400"></i> إعدادات البوابات والتحصيل الرسمية للشهر المالي
              </h2>
              {currentUser.role === 'manager' && (
                <button
                  onClick={handleSaveOfficialConfig}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg"
                >
                  <i className="fa-solid fa-floppy-disk text-amber-300"></i>
                  <span>حفظ وتثبيت الشروط 🔒</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <label className="text-xs font-bold text-slate-300 block mb-1">نسبة شرط الهدف العام (%)</label>
                <input
                  type="number"
                  value={generalRules.generalThresholdPct ?? 80}
                  onChange={(e) => setGeneralRules({ ...generalRules, generalThresholdPct: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-center text-emerald-400 font-bold"
                />
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <label className="text-xs font-bold text-slate-300 block mb-1">عمولة الهدف العام (ر.س - افتراضي 0)</label>
                <input
                  type="number"
                  value={generalRules.generalTargetCommValue ?? 0}
                  onChange={(e) => setGeneralRules({ ...generalRules, generalTargetCommValue: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-center text-amber-300 font-bold font-mono"
                />
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <label className="text-xs font-bold text-slate-300 block mb-1">أدنى عدد مجموعات مطلوبة (≥70%)</label>
                <input
                  type="number"
                  value={generalRules.minGroupsRequired ?? 7}
                  onChange={(e) => setGeneralRules({ ...generalRules, minGroupsRequired: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-center text-teal-300 font-bold"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
