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
  const [activeTab, setActiveTab] = useState('config'); // يبدأ من العقل المدبر
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRep, setSelectedRep] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showProposalDiffModal, setShowProposalDiffModal] = useState(false);
  const [notification, setNotification] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [analyticsSortBy, setAnalyticsSortBy] = useState('highestPct');

  const [expandedGroupIdx, setExpandedGroupIdx] = useState(null);
  const [selectedRepToAdd, setSelectedRepToAdd] = useState({});

  // 1. القواعد الرسمية المعتمدة (العقل المدبر)
  const [generalRules, setGeneralRules] = useState({
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
  });

  const [groupRules, setGroupRules] = useState(
    CONFIG.FALLBACK_GROUPS.map((g, idx) => ({ ...g, isActive: true, isMandatory: false }))
  );

  const [repsData, setRepsData] = useState([]);

  // 2. المطبخ التجريبي (Sandbox)
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
          const mergedRules = {
            isGenTargetMandatory: data.generalRules.isGenTargetMandatory !== false,
            generalThresholdPct: data.generalRules.generalThresholdPct ?? 80,
            generalTargetCommValue: (data.generalRules.generalTargetCommValue !== undefined && data.generalRules.generalTargetCommValue !== "") ? Number(data.generalRules.generalTargetCommValue) : 0,
            minGroupsRequired: data.generalRules.minGroupsRequired ?? 7,
            collectionRules: data.generalRules.collectionRules || {
              isCollMandatory: false,
              thresholdPct: 60,
              commType: 'fixed',
              commValue: 500
            }
          };
          setGeneralRules(mergedRules);
          if (!kitchenGeneralRules) setKitchenGeneralRules(JSON.parse(JSON.stringify(mergedRules)));
        }
        if (data.groupRules && data.groupRules.length > 0) {
          const formattedGroups = data.groupRules.map(g => ({
            ...g,
            codes: Array.isArray(g.codes) ? g.codes : String(g.codes || '').split(',').map(c => c.trim()).filter(Boolean),
            isActive: g.isActive !== false,
            isMandatory: g.isMandatory === true
          }));
          setGroupRules(formattedGroups);
          if (!kitchenGroupRules) setKitchenGroupRules(JSON.parse(JSON.stringify(formattedGroups)));
        }
        if (data.reps && data.reps.length > 0) {
          const formattedReps = data.reps.map(r => ({ ...r, isActive: r.isActive !== false }));
          setRepsData(formattedReps);
          if (!kitchenRepsData) setKitchenRepsData(JSON.parse(JSON.stringify(formattedReps)));
        } else if (data.rep) {
          setRepsData([{ ...data.rep, isActive: true }]);
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

  const handleSaveOfficialConfig = async () => {
    if (currentUser.role !== 'manager') {
      showToast('صلاحية الحفظ والتثبيت الرسمي للمدير العام فقط');
      return;
    }
    setSyncLoading(true);
    try {
      const res = await ApiService.saveOfficialConfig(monthKey, {
        generalRules,
        groupRules,
        reps: repsData
      }, currentUser);
      showToast(res.message || 'تم حفظ وتثبيت القواعد والأهداف بنجاح 🔒');
      loadData(currentUser);
    } catch (err) {
      showToast('تم حفظ التعديلات');
    }
    setSyncLoading(false);
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

  const handleAdoptProposal = () => {
    if (activeProposalInfo && activeProposalInfo.customRules) {
      try {
        const rules = typeof activeProposalInfo.customRules === 'string' 
          ? JSON.parse(activeProposalInfo.customRules) 
          : activeProposalInfo.customRules;
        
        if (rules.generalRules) setGeneralRules(rules.generalRules);
        if (rules.groupRules) setGroupRules(rules.groupRules);
        if (rules.repsTargets) {
          setRepsData(prev => prev.map(r => {
            const match = rules.repsTargets.find(t => Number(t.id) === Number(r.id));
            return match ? { ...r, generalTarget: match.generalTarget, groups: match.groups || r.groups } : r;
          }));
        }
        showToast('تم اعتماد وتطبيق مقترح المشرف في القواعد الرسمية');
        setShowProposalDiffModal(false);
      } catch(e){
        showToast('حدث خطأ أثناء قراءة المقترح');
      }
    }
  };

  const handleApproveMonth = async () => {
    if (currentUser.role !== 'manager') {
      showToast('صلاحية الاعتماد النهائي محصورة بالمدير العام فقط');
      return;
    }
    setSyncLoading(true);
    try {
      const res = await ApiService.approveMonth(monthKey, currentUser);
      showToast(res.message || 'تم الاعتماد النهائي وإقفال الشهر 🔒');
      setMonthStatus('approved');
      loadData(currentUser);
    } catch (err) {
      showToast('تم الاعتماد بنجاح');
    }
    setSyncLoading(false);
  };

  const toggleRepActive = (repId) => {
    setRepsData(prev => prev.map(r => Number(r.id) === Number(repId) ? { ...r, isActive: !r.isActive } : r));
  };

  const updateOfficialRepTarget = (repId, val) => {
    setRepsData(prev => prev.map(r => Number(r.id) === Number(repId) ? { ...r, generalTarget: val === '' ? '' : Number(val) } : r));
  };

  // تعديل الأكواد المدمجة للمجموعة
  const updateGroupCodes = (gIdx, codesStr) => {
    const updated = [...groupRules];
    updated[gIdx] = { ...updated[gIdx], codes: codesStr.split(',').map(c => c.trim()).filter(Boolean) };
    setGroupRules(updated);
  };

  // دوال تخصيص المطبخ
  const updateKitchenGroupRule = (gIdx, field, val) => {
    const updated = JSON.parse(JSON.stringify(kitchenGroupRules || groupRules));
    updated[gIdx] = { ...updated[gIdx], [field]: val === '' ? '' : (field === 'thresholdPct' || field === 'commValue' ? Number(val) : val) };
    setKitchenGroupRules(updated);
  };

  const updateKitchenRepGroupTarget = (repId, gIdx, val) => {
    const updated = (kitchenRepsData || repsData).map(r => {
      if (Number(r.id) === Number(repId)) {
        const grps = Array.isArray(r.groups) ? [...r.groups] : [];
        grps[gIdx] = { ...(grps[gIdx] || { sales: 0, customComm: null }), target: val === '' ? '' : Number(val) };
        return { ...r, groups: grps };
      }
      return r;
    });
    setKitchenRepsData(updated);
  };

  const updateKitchenRepCustomComm = (repId, gIdx, val) => {
    const updated = (kitchenRepsData || repsData).map(r => {
      if (Number(r.id) === Number(repId)) {
        const grps = Array.isArray(r.groups) ? [...r.groups] : [];
        grps[gIdx] = { ...(grps[gIdx] || { target: 0, sales: 0 }), customComm: val === '' ? null : Number(val) };
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

  const handleAddRepToGroup = (gIdx) => {
    const repId = selectedRepToAdd[gIdx];
    if (!repId) {
      showToast('يرجى اختيار مندوب أولاً');
      return;
    }
    updateKitchenRepGroupTarget(repId, gIdx, 10000);
    setSelectedRepToAdd(prev => ({ ...prev, [gIdx]: '' }));
    showToast('تم إشراك المندوب في المجموعة');
  };

  const handleAddNewDepartment = () => {
    const name = prompt('أدخل اسم المجموعة / القسم الجديد:');
    if (name && name.trim()) {
      const newGrp = {
        id: (kitchenGroupRules || groupRules).length,
        name: name.trim(),
        codes: [],
        thresholdPct: 70,
        commType: 'fixed',
        commValue: 250,
        isActive: true,
        isMandatory: false
      };
      setKitchenGroupRules([...(kitchenGroupRules || groupRules), newGrp]);
      setKitchenRepsData((kitchenRepsData || repsData).map(r => ({
        ...r,
        groups: [...(r.groups || []), { target: 0, sales: 0, customComm: null }]
      })));
      showToast(`تمت إضافة ${name} للمطبخ`);
    }
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
    return CalcEngine.calculateKitchenMetrics(kitchenGroupRules || groupRules, kitchenRepsData || repsData);
  }, [kitchenGroupRules, groupRules, kitchenRepsData, repsData]);

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

  const currentRep = useMemo(() => {
    return (currentUser && currentUser.role === 'rep' && visibleReps.length > 0) ? visibleReps[0] : null;
  }, [currentUser, visibleReps]);

  const parsedProposal = useMemo(() => {
    if (!activeProposalInfo || !activeProposalInfo.customRules) return null;
    try {
      return typeof activeProposalInfo.customRules === 'string'
        ? JSON.parse(activeProposalInfo.customRules)
        : activeProposalInfo.customRules;
    } catch(e){ return null; }
  }, [activeProposalInfo]);

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
    <div className="pb-16 dir-rtl font-sans">
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
              onClick={() => setActiveTab('config')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 ${activeTab === 'config' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-900 text-slate-300'}`}
            >
              <i className="fa-solid fa-sliders"></i> إعدادات البوابات والتحصيل (العقل المدبر) 🔒
            </button>
            <button
              onClick={() => setActiveTab('kitchen')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 ${activeTab === 'kitchen' ? 'bg-purple-600 text-white font-black' : 'bg-slate-900 text-purple-300'}`}
            >
              <i className="fa-solid fa-kitchen-set text-amber-300"></i> المطبخ الرئيسي لتخطيط الأهداف والعمولات 🧠
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 ${activeTab === 'summary' ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-900 text-slate-300'}`}
            >
              <i className="fa-solid fa-table-list"></i> خلاصة المندوبين وبوابات الاستحقاق
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 ${activeTab === 'analytics' ? 'bg-teal-500 text-slate-950 font-black' : 'bg-slate-900 text-slate-300'}`}
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 font-mono">
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block mb-1 font-sans">المبيعات العامة</span>
              <span className="text-base font-extrabold text-white">{formatNum(companyTotals.genSales)}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">هدف {formatNum(companyTotals.genTarget)}</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block mb-1 font-sans">نسبة الإنجاز</span>
              <span className={`text-base font-extrabold ${companyTotals.overallGenPct >= (Number(activeGeneralRules.generalThresholdPct) || 80) ? 'text-emerald-400' : 'text-amber-400'}`}>
                {companyTotals.overallGenPct.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">المتبقي: {formatNum(companyTotals.remainingGenSalesTotal)}</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block mb-1 font-sans">عمولات المجموعات</span>
              <span className="text-base font-extrabold text-teal-300">{formatNum(companyTotals.groupCommSum)} ر.س</span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">{companyTotals.qualifiedGroupsCount} مندوبين مؤهلين</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block mb-1 font-sans">عمولة الهدف العام</span>
              <span className="text-base font-extrabold text-amber-300">{formatNum(companyTotals.genTargetCommSum)} ر.س</span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">(شرط 80% = {generalRules.generalTargetCommValue || 0} ر.س)</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-2xl">
              <span className="text-slate-400 text-xs block mb-1 font-sans">عمولة التحصيل</span>
              <span className="text-base font-extrabold text-blue-300">{formatNum(companyTotals.collComm)} ر.س</span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">({companyTotals.overallCollPct.toFixed(1)}% من الدين)</span>
            </div>
            <div className="bg-slate-800 border border-emerald-500/40 bg-emerald-950/20 p-3.5 rounded-2xl">
              <span className="text-emerald-300 text-xs font-bold mb-1 font-sans">إجمالي العمولات المستحقة</span>
              <span className="text-lg font-black text-emerald-400">{formatNum(companyTotals.grandComm)} ر.س</span>
            </div>
          </div>
        )}

        {/* TAB 1: إعدادات البوابات والتحصيل والدمج (العقل المدبر) */}
        {activeTab === 'config' && currentUser.role !== 'rep' && (
          <div className="space-y-6">
            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <i className="fa-solid fa-sliders text-amber-400"></i> إدارة بوابات الاستحقاق وشروط العمولات والدمج الرسمي
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">تحكم كامل في الأكواد المدمجة والشروط والنسب والعمولات (الحساب لحظي ومباشر)</p>
                </div>
                
                <div className="flex items-center gap-2">
                  {currentUser.role === 'manager' && activeProposalInfo && (
                    <button
                      onClick={() => setShowProposalDiffModal(true)}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md"
                    >
                      <i className="fa-solid fa-code-compare text-amber-300"></i>
                      <span>مقارنة مقترح المشرف 🔍</span>
                    </button>
                  )}
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
              </div>

              {/* بوابة الهدف العام */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={currentUser.role !== 'manager' || monthStatus === 'approved'}
                    checked={generalRules.isGenTargetMandatory !== false}
                    onChange={(e) => setGeneralRules({ ...generalRules, isGenTargetMandatory: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                  <span className="font-bold text-white text-sm">تفعيل بوابة الهدف العام كشرط إلزامي أساسي لدخول عمولات المجموعات</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
                  <div>
                    <label className="text-slate-400 block mb-1">نسبة شرط الهدف العام (%)</label>
                    <input
                      type="number"
                      disabled={currentUser.role !== 'manager' || monthStatus === 'approved'}
                      value={generalRules.generalThresholdPct ?? 80}
                      onChange={(e) => setGeneralRules({ ...generalRules, generalThresholdPct: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-center text-emerald-400 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">قيمة عمولة الهدف العام (ر.س - افتراضي 0)</label>
                    <input
                      type="number"
                      disabled={currentUser.role !== 'manager' || monthStatus === 'approved'}
                      value={generalRules.generalTargetCommValue ?? 0}
                      onChange={(e) => setGeneralRules({ ...generalRules, generalTargetCommValue: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-center text-amber-300 font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">أدنى عدد مجموعات مطلوبة للعمولة</label>
                    <input
                      type="number"
                      disabled={currentUser.role !== 'manager' || monthStatus === 'approved'}
                      value={generalRules.minGroupsRequired ?? 7}
                      onChange={(e) => setGeneralRules({ ...generalRules, minGroupsRequired: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-center text-teal-300 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* جدول المجموعات وأكواد الجمع الديناميكية */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold text-teal-400 flex items-center gap-2">
                  <i className="fa-solid fa-boxes-stacked"></i> شروط المجموعات وتحديد الأكواد المدمجة (تعديل الأكواد والعمولات مباشرة):
                </h3>
                <div className="overflow-x-auto border border-slate-700 rounded-xl">
                  <table className="w-full text-xs text-right bg-slate-900">
                    <thead className="bg-slate-950 text-slate-300 border-b border-slate-700">
                      <tr>
                        <th className="p-3 text-center">تفعيل ✅</th>
                        <th className="p-3 text-center">أساسية ⭐</th>
                        <th className="p-3">#</th>
                        <th className="p-3">اسم المجموعة</th>
                        <th className="p-3 text-amber-300 font-mono">أكواد الجمع المدمجة (Category Codes)</th>
                        <th className="p-3">نسبة الشرط (%)</th>
                        <th className="p-3">نوع العمولة</th>
                        <th className="p-3">قيمة العمولة (ر.س)</th>
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
                              onChange={(e) => {
                                const updated = [...groupRules];
                                updated[idx] = { ...updated[idx], isActive: e.target.checked };
                                setGroupRules(updated);
                              }}
                              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              disabled={currentUser.role !== 'manager' || monthStatus === 'approved' || !grpRule.isActive}
                              checked={grpRule.isMandatory === true}
                              onChange={(e) => {
                                const updated = [...groupRules];
                                updated[idx] = { ...updated[idx], isMandatory: e.target.checked };
                                setGroupRules(updated);
                              }}
                              className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                            />
                          </td>
                          <td className="p-3 text-slate-500 font-sans">{idx + 1}</td>
                          <td className="p-3 font-sans font-bold text-white text-sm">{grpRule.name}</td>
                          <td className="p-3">
                            <input
                              type="text"
                              disabled={currentUser.role !== 'manager' || monthStatus === 'approved'}
                              value={Array.isArray(grpRule.codes) ? grpRule.codes.join(', ') : (grpRule.codes || '')}
                              onChange={(e) => updateGroupCodes(idx, e.target.value)}
                              placeholder="مثال: 2010, 12020"
                              className="w-48 bg-slate-950 border border-amber-500/40 rounded p-1.5 text-center text-amber-300 font-bold"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              disabled={currentUser.role !== 'manager' || monthStatus === 'approved' || !grpRule.isActive}
                              value={grpRule.thresholdPct ?? 70}
                              onChange={(e) => {
                                const updated = [...groupRules];
                                updated[idx] = { ...updated[idx], thresholdPct: e.target.value === '' ? '' : Number(e.target.value) };
                                setGroupRules(updated);
                              }}
                              className="w-16 bg-slate-800 border border-slate-700 rounded p-1.5 text-center text-teal-300 font-bold"
                            />
                          </td>
                          <td className="p-3 font-sans">
                            <select
                              disabled={currentUser.role !== 'manager' || monthStatus === 'approved' || !grpRule.isActive}
                              value={grpRule.commType || 'fixed'}
                              onChange={(e) => {
                                const updated = [...groupRules];
                                updated[idx] = { ...updated[idx], commType: e.target.value };
                                setGroupRules(updated);
                              }}
                              className="bg-slate-800 border border-slate-700 text-slate-200 rounded p-1.5 text-xs"
                            >
                              <option value="fixed">مبلغ ثابت (ر.س)</option>
                              <option value="percent">نسبة (% من المبيعات)</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              disabled={currentUser.role !== 'manager' || monthStatus === 'approved' || !grpRule.isActive}
                              value={grpRule.commValue}
                              onChange={(e) => {
                                const updated = [...groupRules];
                                updated[idx] = { ...updated[idx], commValue: e.target.value === '' ? '' : Number(e.target.value) };
                                setGroupRules(updated);
                              }}
                              className="w-20 bg-slate-800 border border-slate-700 rounded p-1.5 text-center text-emerald-400 font-bold"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* التحصيل */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3">
                <h3 className="text-xs font-bold text-blue-300">شروط وعمولة التحصيل الإجمالي (صافي بعد استبعاد المتعثرات):</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block mb-1 font-sans">شرط نسبة التحصيل الصافي (%)</span>
                    <input
                      type="number"
                      disabled={currentUser.role !== 'manager' || monthStatus === 'approved'}
                      value={generalRules.collectionRules?.thresholdPct ?? 60}
                      onChange={(e) => {
                        setGeneralRules({
                          ...generalRules,
                          collectionRules: { ...generalRules.collectionRules, thresholdPct: Number(e.target.value) }
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-center text-blue-300 font-bold"
                    />
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block mb-1 font-sans">قيمة عمولة التحصيل (مبلغ ثابت ر.س)</span>
                    <input
                      type="number"
                      disabled={currentUser.role !== 'manager' || monthStatus === 'approved'}
                      value={generalRules.collectionRules?.commValue ?? 500}
                      onChange={(e) => {
                        setGeneralRules({
                          ...generalRules,
                          collectionRules: { ...generalRules.collectionRules, commValue: Number(e.target.value) }
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-center text-emerald-400 font-bold"
                    />
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-center font-sans text-slate-300">
                    <span>عمولة ثابتة 500 ر.س عند تحقيق $\ge 60\%$</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: المطبخ الرئيسي لتخطيط الأهداف والعمولات */}
        {activeTab === 'kitchen' && currentUser.role !== 'rep' && (
          <div className="bg-slate-800 p-6 rounded-3xl border border-purple-500/40 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700 pb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <i className="fa-solid fa-kitchen-set text-purple-400"></i> المطبخ الرئيسي لتخطيط الأهداف والعمولات / الحوافز
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  تحكم دقيق بالأصناف وتفكيك الأهداف وتخصيص العمولات الفردية مع المزامنة اللحظية.
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

            {/* جدول المجموعات الرئيسي بالمطبخ */}
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
                    <th className="p-3.5">شرط التأهل (%)</th>
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
                                ضعيف الإنجاز أقل من 60% 🔥
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
                          <span className={`font-bold ${km.avgAchievementPct >= Number(km.group.thresholdPct || 70) ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {km.avgAchievementPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={km.group.thresholdPct ?? 70}
                            onChange={(e) => updateKitchenGroupRule(km.gIdx, 'thresholdPct', e.target.value)}
                            className="w-16 bg-slate-950 border border-slate-700 rounded p-1.5 text-center text-teal-300 font-bold"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={km.group.commValue}
                            onChange={(e) => updateKitchenGroupRule(km.gIdx, 'commValue', e.target.value)}
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

                      {/* درج التفكيك والتخصيص الفردي */}
                      {expandedGroupIdx === km.gIdx && (
                        <tr>
                          <td colSpan="11" className="bg-slate-950 p-5 border-y-2 border-purple-500/30">
                            <div className="space-y-4">
                              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                <div>
                                  <h4 className="text-xs font-bold text-purple-300 flex items-center gap-2">
                                    <i className="fa-solid fa-users"></i> الموظفون المكلفون بمجموعة: <b className="text-white">{km.group.name}</b>
                                  </h4>
                                  <span className="text-[11px] text-slate-400">تعديل الأهداف والعمولات الخاصة الفردية (Override)</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <select
                                    value={selectedRepToAdd[km.gIdx] || ''}
                                    onChange={(e) => setSelectedRepToAdd(prev => ({ ...prev, [km.gIdx]: e.target.value }))}
                                    className="bg-slate-900 border border-purple-500/40 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none"
                                  >
                                    <option value="">-- إشراك مندوب جديد في المجموعة --</option>
                                    {(kitchenRepsData || repsData)
                                      .filter(r => !r.groups || !r.groups[km.gIdx] || (Number(r.groups[km.gIdx].target) === 0 && Number(r.groups[km.gIdx].sales) === 0))
                                      .map(r => (
                                        <option key={r.id} value={r.id}>مندوب #{r.id} - {r.name}</option>
                                      ))}
                                  </select>
                                  <button
                                    onClick={() => handleAddRepToGroup(km.gIdx)}
                                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-md"
                                  >
                                    <i className="fa-solid fa-user-plus"></i>
                                    <span>إضافة للمجموعة</span>
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-sans">
                                {(kitchenRepsData || repsData)
                                  .filter(rep => rep.groups && rep.groups[km.gIdx] && (Number(rep.groups[km.gIdx].target) > 0 || Number(rep.groups[km.gIdx].sales) > 0))
                                  .map((rep) => {
                                    const rGrp = rep.groups[km.gIdx];
                                    const pct = Number(rGrp.target) > 0 ? (Number(rGrp.sales) / Number(rGrp.target)) * 100 : 0;
                                    const effectiveComm = rGrp.customComm !== null && rGrp.customComm !== undefined && rGrp.customComm !== '' ? Number(rGrp.customComm) : Number(km.group.commValue || 0);
                                    const personalCommPctFromTarget = Number(rGrp.target) > 0 ? (effectiveComm / Number(rGrp.target)) * 100 : 0;

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
                                            <label className="text-[10px] text-slate-400 block mb-1 font-sans">الهدف الفردي (ر.س)</label>
                                            <input
                                              type="number"
                                              value={rGrp.target}
                                              onChange={(e) => updateKitchenRepGroupTarget(rep.id, km.gIdx, e.target.value)}
                                              className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-center text-emerald-400 font-bold"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-400 block mb-1 font-sans">عمولة فردية مخصصة</label>
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
                                          <span className={`font-bold ${pct >= Number(km.group.thresholdPct || 70) ? 'text-emerald-400' : 'text-amber-400'}`}>
                                            الإنجاز: {pct.toFixed(1)}%
                                          </span>
                                          <span className="text-purple-300">({personalCommPctFromTarget.toFixed(2)}% من الهدف)</span>
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

        {/* TAB 3: خلاصة المندوبين */}
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
                      <th className="py-3.5 px-3 text-center">تفعيل ✅</th>
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
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={rep.isActive !== false}
                            onChange={() => toggleRepActive(rep.id)}
                            className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3 text-slate-400">{rep.id}</td>
                        <td className="py-3 px-3 font-sans font-bold text-white">{rep.name}</td>
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            disabled={currentUser.role !== 'manager' || monthStatus === 'approved'}
                            value={rep.generalTarget}
                            onChange={(e) => updateOfficialRepTarget(rep.id, e.target.value)}
                            className="w-24 bg-slate-900 border border-slate-700 rounded p-1.5 text-center text-emerald-400 font-bold disabled:opacity-70"
                          />
                        </td>
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
                            {rep.qualifiedGroupsCount} / {rep.assignedGroupsCount || 14}
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

        {/* TAB 4: التحليل المالي */}
        {activeTab === 'analytics' && currentUser.role !== 'rep' && (
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-chart-pie text-teal-400"></i> التحليل المالي والترتيب للمجموعات الـ 14
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
              {groupAnalyticsData.map((item) => (
                <div key={item.gIdx} className={`bg-slate-900 border border-slate-700 p-4 rounded-xl space-y-3 ${!item.rule.isActive ? 'opacity-40' : ''}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-white font-sans">{item.rule.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${item.avgPct >= item.rule.thresholdPct ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                      {item.avgPct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.avgPct >= item.rule.thresholdPct ? 'bg-emerald-400' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(100, item.avgPct)}%` }}
                    ></div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-950 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-sans">إجمالي المبيعات</span>
                      <span className="font-bold text-emerald-400">{formatNum(item.totalSales)}</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-sans">الناجحون</span>
                      <span className="font-bold text-teal-300 font-sans">{item.qualifyingRepsCount} مندوبين</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* نافذة تفاصيل أداء المندوب */}
      {selectedRep && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 font-sans">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-user-check text-emerald-400"></i> تفاصيل أداء وبوابات المندوب: {selectedRep.name}
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
                    <th className="p-2.5">النوع</th>
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
                      <td className="p-2.5 font-sans">
                        {grp.isMandatory ? <span className="text-purple-300 font-bold">إلزامية ⭐</span> : <span className="text-slate-500">اختيارية</span>}
                      </td>
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
                      <td className="p-2.5 text-teal-300 font-bold">{formatNum(grp.commEarned)} ر.س</td>
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
          <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 font-sans">
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
