/**
 * محرك بوابات الاستحقاق الديناميكية وقواعد الأعمال المرنة
 * Dynamic Governance & Gating Incentive Engine v7.0
 */

const CalcEngine = {
  getCollectionTierRate(collPct, tiers) {
    if (!tiers || !Array.isArray(tiers) || tiers.length === 0) return 0;
    // ترتيب تنازلي لاختيار أعلى شريحة مؤهلة
    const sorted = [...tiers].sort((a, b) => b.minPct - a.minPct);
    const matched = sorted.find(t => collPct >= Number(t.minPct));
    return matched ? Number(matched.rate || 0) : 0;
  },

  processRepData(rep, generalRules, groupRules) {
    if (!rep) return null;

    const isRepActive = rep.isActive !== false;
    const gRules = generalRules || CONFIG.DEFAULT_GENERAL_RULES;
    const grpRulesList = (groupRules && Array.isArray(groupRules)) ? groupRules : CONFIG.FALLBACK_GROUPS;

    // =========================================================================
    // 1. تقييم بوابة الهدف العام (General Target Evaluation)
    // =========================================================================
    const genTarget = Number(rep.generalTarget) || 0;
    const genSales = Number(rep.generalSales) || 0;
    const genPct = genTarget > 0 ? (genSales / genTarget) * 100 : 0;
    
    const isGenTargetMandatory = gRules.isGenTargetMandatory !== false; // هل الهدف العام شرط إلزامي؟
    const genThresholdPct = Number(gRules.generalThresholdPct !== undefined ? gRules.generalThresholdPct : 80);
    const passGate_GenTarget = genTarget > 0 ? (genPct >= genThresholdPct) : false;

    const requiredGenSales = genTarget * (genThresholdPct / 100);
    const remainingGenSales = genTarget > 0 ? Math.max(0, requiredGenSales - genSales) : 0;

    // =========================================================================
    // 2. تقييم المجموعات الـ 14 والمجموعات الإلزامية (Mandatory Core Groups)
    // =========================================================================
    let qualifiedGroupsCount = 0;
    let failedMandatoryGroups = [];
    let rawGroupCommSum = 0;
    const repGroups = Array.isArray(rep.groups) ? rep.groups : [];

    const detailedGroups = repGroups.map((grp, gIdx) => {
      const rule = grpRulesList[gIdx] || { 
        thresholdPct: 70, 
        commType: 'fixed', 
        commValue: 250, 
        isActive: true,
        isMandatory: false,
        name: `مجموعة ${gIdx + 1}` 
      };

      const isGroupActive = rule.isActive !== false;
      const isGroupMandatory = rule.isMandatory === true;
      const grpTarget = Number(grp.target) || 0;
      const grpSales = Number(grp.sales) || 0;
      const grpPct = grpTarget > 0 ? (grpSales / grpTarget) * 100 : 0;
      
      const thresholdPct = Number(rule.thresholdPct !== undefined ? rule.thresholdPct : 70);
      const thresholdTargetSales = grpTarget * (thresholdPct / 100);
      const remainingToThreshold = grpTarget > 0 ? Math.max(0, thresholdTargetSales - grpSales) : 0;
      
      const isQualified = isGroupActive && grpTarget > 0 && grpPct >= thresholdPct;

      if (isQualified) qualifiedGroupsCount++;
      if (isGroupMandatory && !isQualified) {
        failedMandatoryGroups.push(grp.name || rule.name);
      }

      const effectiveCommVal = (grp.customComm !== undefined && grp.customComm !== null && grp.customComm !== '')
        ? Number(grp.customComm)
        : Number(rule.commValue || 0);

      let potentialComm = 0;
      if (isQualified) {
        if (rule.commType === 'fixed') {
          potentialComm = effectiveCommVal;
        } else if (rule.commType === 'percent') {
          potentialComm = Math.max(0, grpSales) * (effectiveCommVal / 100);
        }
      }
      
      if (isGroupActive) {
        rawGroupCommSum += potentialComm;
      }

      return {
        ...grp,
        originalIndex: gIdx,
        name: grp.name || rule.name,
        isActive: isGroupActive,
        isMandatory: isGroupMandatory,
        thresholdPct,
        commType: rule.commType || 'fixed',
        effectiveCommVal,
        grpPct,
        isQualified,
        thresholdTargetSales,
        remainingToThreshold,
        potentialComm
      };
    });

    const minGroupsReq = Number(gRules.minGroupsRequired !== undefined ? gRules.minGroupsRequired : 7);
    const passGate_MinGroupsCount = qualifiedGroupsCount >= minGroupsReq;
    const passGate_MandatoryGroups = failedMandatoryGroups.length === 0;

    // =========================================================================
    // 3. تقييم بوابات التحصيل والديون الصافية بعد استبعاد المتعثر
    // =========================================================================
    const collRules = gRules.collectionRules || {
      isCollMandatory: true,
      over60: {
        isMandatory: true,
        thresholdPct: 40,
        tiers: [
          { minPct: 40, rate: 0.01 }, // 40% يعطيه 1%
          { minPct: 50, rate: 0.02 }  // 50% يعطيه 2%
        ]
      },
      under60: {
        isActive: true,
        thresholdPct: 30,
        commType: 'percent',
        commValue: 0.5
      }
    };

    // أ) ديون فوق 60 يوم (صافي)
    const debtOver60Net = Number(rep.debtOver60Net) || 0;
    const collOver60 = Number(rep.collOver60) || 0;
    const collOver60Pct = debtOver60Net > 0 ? (collOver60 / debtOver60Net) * 100 : (collOver60 > 0 ? 100 : 0);
    
    const isOver60Mandatory = collRules.over60?.isMandatory === true;
    const over60ThresholdPct = Number(collRules.over60?.thresholdPct || 40);
    const passGate_Over60 = debtOver60Net > 0 ? (collOver60Pct >= over60ThresholdPct) : true;

    // عمولة فوق 60 بحسب الشرائح
    const over60Tiers = collRules.over60?.tiers || [{ minPct: 40, rate: 0.01 }, { minPct: 50, rate: 0.02 }];
    const over60CommRate = this.getCollectionTierRate(collOver60Pct, over60Tiers);
    const commOver60Earned = collOver60 * over60CommRate;

    // ب) ديون أقل من 60 يوم
    const debtUnder60 = Number(rep.debtUnder60) || Number(rep.debt) || 0;
    const collUnder60 = Number(rep.collUnder60) || Number(rep.collection) || 0;
    const collUnder60Pct = debtUnder60 > 0 ? (collUnder60 / debtUnder60) * 100 : 0;
    const passGate_Under60 = collUnder60Pct >= Number(collRules.under60?.thresholdPct || 30);
    
    let commUnder60Earned = 0;
    if (collRules.under60?.isActive && passGate_Under60) {
      commUnder60Earned = collRules.under60.commType === 'fixed'
        ? Number(collRules.under60.commValue || 0)
        : collUnder60 * (Number(collRules.under60.commValue || 0) / 100);
    }

    const totalCollectionCommission = isRepActive ? (commUnder60Earned + commOver60Earned) : 0;

    // =========================================================================
    // 4. البوابات الإلزامية المركزية (The Core Decision Engine)
    // =========================================================================
    // هل اجتاز شروط البوابات الأساسية المطلوبة لدخول نظام عمولات المجموعات والعام؟
    const meetsGenTargetReq = !isGenTargetMandatory || passGate_GenTarget;
    const meetsOver60Req = !isOver60Mandatory || passGate_Over60;
    const meetsMandatoryGroupsReq = passGate_MandatoryGroups;
    const meetsMinGroupsReq = passGate_MinGroupsCount;

    // استحقاق عمولات المجموعات
    const isEligibleForGroupCommissions = isRepActive && meetsGenTargetReq && meetsOver60Req && meetsMandatoryGroupsReq && meetsMinGroupsReq;
    const totalGroupCommissionEarned = isEligibleForGroupCommissions ? rawGroupCommSum : 0;

    // استحقاق عمولة الهدف العام
    const isEligibleForGenTargetComm = isRepActive && passGate_GenTarget && meetsOver60Req;
    const generalTargetCommEarned = isEligibleForGenTargetComm ? (Number(gRules.generalTargetCommValue) || 0) : 0;

    // الإجمالي الشامل المستحق
    const grandTotalCommission = totalGroupCommissionEarned + generalTargetCommEarned + totalCollectionCommission;

    const finalDetailedGroups = detailedGroups.map(grp => ({
      ...grp,
      commEarned: isEligibleForGroupCommissions ? grp.potentialComm : 0
    }));

    // تحديد أسباب الحجب بدقة للشفافية
    let blockers = [];
    if (isGenTargetMandatory && !passGate_GenTarget) {
      blockers.push(`باقي للهدف العام ${Math.round(remainingGenSales).toLocaleString()} ر.س`);
    }
    if (isOver60Mandatory && !passGate_Over60) {
      blockers.push(`تحصيل >60 يوم (${collOver60Pct.toFixed(1)}% < ${over60ThresholdPct}%)`);
    }
    if (!passGate_MandatoryGroups) {
      blockers.push(`لم يحقق مجموعات إلزامية: [${failedMandatoryGroups.join('، ')}]`);
    }
    if (!passGate_MinGroupsCount) {
      blockers.push(`حقق ${qualifiedGroupsCount} من أصل ${minGroupsReq} مجموعات`);
    }

    const eligibilityStatusText = blockers.length === 0 
      ? 'مستحق بالكامل ✅' 
      : `محجوبة: ${blockers.join(' | ')}`;

    return {
      ...rep,
      isActive: isRepActive,
      genTarget,
      genSales,
      genPct,
      requiredGenSales,
      remainingGenSales,
      passGate_GenTarget,
      isGeneralTargetQualified: isEligibleForGenTargetComm,
      generalTargetCommEarned,
      isGroupsGateQualified: isEligibleForGroupCommissions,
      qualifiedGroupsCount,
      minGroupsReq,
      failedMandatoryGroups,
      detailedGroups: finalDetailedGroups,
      totalGroupCommissionEarned,
      debt: Number(rep.debt) || 0,
      collection: Number(rep.collection) || 0,
      debtUnder60,
      collUnder60,
      collUnder60Pct,
      debtOver60Net,
      collOver60,
      collOver60Pct,
      passGate_Over60,
      over60CommRate,
      commOver60Earned,
      commUnder60Earned,
      collectionCommission: totalCollectionCommission,
      grandTotalCommission,
      eligibilityStatusText
    };
  },

  calculateCompanyTotals(processedReps, generalRules) {
    let genTarget = 0, genSales = 0, debt = 0, collection = 0;
    let collComm = 0, groupCommSum = 0, genTargetCommSum = 0, grandComm = 0;
    let fullyQualifiedCount = 0;
    let activeRepsCount = 0;

    (processedReps || []).forEach(r => {
      if (r.isActive !== false) {
        activeRepsCount++;
        genTarget += r.genTarget || 0;
        genSales += r.genSales || 0;
        debt += r.debt || 0;
        collection += r.collection || 0;
        collComm += r.collectionCommission || 0;
        groupCommSum += r.totalGroupCommissionEarned || 0;
        genTargetCommSum += r.generalTargetCommEarned || 0;
        grandComm += r.grandTotalCommission || 0;
        if (r.isGroupsGateQualified) fullyQualifiedCount++;
      }
    });

    const overallGenPct = genTarget > 0 ? (genSales / genTarget) * 100 : 0;
    const remainingGenSalesTotal = Math.max(0, genTarget - genSales);
    const overallCollPct = debt > 0 ? (collection / debt) * 100 : 0;

    return {
      genTarget,
      genSales,
      overallGenPct,
      remainingGenSalesTotal,
      debt,
      collection,
      overallCollPct,
      collComm,
      groupCommSum,
      genTargetCommSum,
      grandComm,
      qualifiedGroupsCount: fullyQualifiedCount,
      totalReps: activeRepsCount
    };
  },

  analyzeAndSortGroups(groupRules, processedReps, sortBy = 'highestPct') {
    const analytics = (groupRules || []).map((grpRule, gIdx) => {
      let totalTarget = 0;
      let totalSales = 0;
      let qualifyingRepsCount = 0;
      let totalEarnedComm = 0;

      (processedReps || []).forEach(rep => {
        if (rep.isActive !== false) {
          const grp = rep.detailedGroups ? rep.detailedGroups[gIdx] : null;
          if (grp && grp.isActive) {
            totalTarget += grp.target || 0;
            totalSales += grp.sales || 0;

            if (grp.isQualified) {
              qualifyingRepsCount++;
              if (rep.isGroupsGateQualified) {
                totalEarnedComm += grp.potentialComm;
              }
            }
          }
        }
      });

      const avgPct = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;

      return {
        gIdx,
        rule: grpRule,
        totalTarget,
        totalSales,
        avgPct,
        qualifyingRepsCount,
        totalEarnedComm
      };
    });

    return analytics.sort((a, b) => {
      if (sortBy === 'highestPct') return b.avgPct - a.avgPct;
      if (sortBy === 'highestSales') return b.totalSales - a.totalSales;
      if (sortBy === 'lowestPct') return a.avgPct - b.avgPct;
      return 0;
    });
  }
};
