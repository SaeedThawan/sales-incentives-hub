/**
 * محرك العمليات الحسابية والتحصيل المرن
 * Multi-Tier Flexible Commission Engine v4.0
 */

const CalcEngine = {
  processRepData(rep, generalRules, groupRules) {
    if (!rep) return null;

    const gRules = generalRules || CONFIG.DEFAULT_GENERAL_RULES;
    const grpRulesList = (groupRules && Array.isArray(groupRules)) ? groupRules : CONFIG.FALLBACK_GROUPS;

    // 1. الهدف العام
    const genTarget = Number(rep.generalTarget) || 0;
    const genSales = Number(rep.generalSales) || 0;
    const genPct = genTarget > 0 ? (genSales / genTarget) * 100 : 0;
    const requiredGenThresholdPct = (gRules.generalThresholdPct !== undefined && gRules.generalThresholdPct !== '') 
      ? Number(gRules.generalThresholdPct) 
      : 80;
    
    const passGate1_GeneralTarget = genTarget > 0 && genPct >= requiredGenThresholdPct;
    const requiredGenSales = genTarget * (requiredGenThresholdPct / 100);
    const remainingGenSales = genTarget > 0 ? Math.max(0, requiredGenSales - genSales) : 0;
    const remainingToFullTarget = genTarget > 0 ? Math.max(0, genTarget - genSales) : 0;

    // 2. المجموعات الـ 14 (مع فحص التفعيل isActive)
    let qualifiedGroupsCount = 0;
    let rawGroupCommSum = 0;
    const repGroups = Array.isArray(rep.groups) ? rep.groups : [];

    const detailedGroups = repGroups.map((grp, gIdx) => {
      const rule = grpRulesList[gIdx] || { 
        thresholdPct: 70, 
        commType: 'fixed', 
        commValue: 250, 
        isActive: true,
        name: `مجموعة ${gIdx + 1}` 
      };

      const isGroupActive = rule.isActive !== false;
      const grpTarget = Number(grp.target) || 0;
      const grpSales = Number(grp.sales) || 0;
      const grpPct = grpTarget > 0 ? (grpSales / grpTarget) * 100 : 0;
      
      const thresholdPct = Number(rule.thresholdPct) || 0;
      const thresholdTargetSales = grpTarget * (thresholdPct / 100);
      const remainingToThreshold = grpTarget > 0 ? Math.max(0, thresholdTargetSales - grpSales) : 0;
      
      const isQualified = isGroupActive && grpTarget > 0 && grpPct >= thresholdPct;

      if (isQualified) qualifiedGroupsCount++;

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
        thresholdPct: thresholdPct,
        commType: rule.commType || 'fixed',
        effectiveCommVal,
        grpPct,
        isQualified,
        thresholdTargetSales,
        remainingToThreshold,
        potentialComm
      };
    });

    const minGroupsReq = (gRules.minGroupsRequired !== undefined && gRules.minGroupsRequired !== '') 
      ? Number(gRules.minGroupsRequired) 
      : 7;
    const passGate2_MinGroups = qualifiedGroupsCount >= minGroupsReq;

    // استحقاق عمولات المبيعات
    const isEligibleForSalesCommissions = passGate1_GeneralTarget && passGate2_MinGroups;
    const totalGroupCommissionEarned = isEligibleForSalesCommissions ? rawGroupCommSum : 0;
    const baseGenCommVal = Number(gRules.generalTargetCommValue) || 0;
    const generalTargetCommEarned = (isEligibleForSalesCommissions && baseGenCommVal > 0) ? baseGenCommVal : 0;

    // 3. احتساب عمولات التحصيل المنفصلة (تحت 60 وفوق 60 صافي)
    const collRules = gRules.collectionRules || {
      under60: { isActive: true, thresholdPct: 30, commType: 'percent', commValue: 0.5 },
      over60: { isActive: true, thresholdPct: 40, commType: 'percent', commValue: 1.0 }
    };

    // أ) تحت 60 يوم
    const debtUnder60 = Number(rep.debtUnder60) || Number(rep.debt) || 0;
    const collUnder60 = Number(rep.collUnder60) || Number(rep.collection) || 0;
    const collUnder60Pct = debtUnder60 > 0 ? (collUnder60 / debtUnder60) * 100 : (collUnder60 > 0 ? 100 : 0);
    const passUnder60 = collRules.under60.isActive && collUnder60Pct >= Number(collRules.under60.thresholdPct || 0);

    let commUnder60Earned = 0;
    if (passUnder60) {
      commUnder60Earned = collRules.under60.commType === 'fixed'
        ? Number(collRules.under60.commValue || 0)
        : collUnder60 * (Number(collRules.under60.commValue || 0) / 100);
    }

    // ب) فوق 60 يوم (بعد استبعاد المتعثرات)
    const debtOver60Net = Number(rep.debtOver60Net) || 0;
    const collOver60 = Number(rep.collOver60) || 0;
    const collOver60Pct = debtOver60Net > 0 ? (collOver60 / debtOver60Net) * 100 : (collOver60 > 0 ? 100 : 0);
    const passOver60 = collRules.over60.isActive && collOver60Pct >= Number(collRules.over60.thresholdPct || 0);

    let commOver60Earned = 0;
    if (passOver60) {
      commOver60Earned = collRules.over60.commType === 'fixed'
        ? Number(collRules.over60.commValue || 0)
        : collOver60 * (Number(collRules.over60.commValue || 0) / 100);
    }

    const totalCollectionCommission = commUnder60Earned + commOver60Earned;
    const grandTotalCommission = totalCollectionCommission + totalGroupCommissionEarned + generalTargetCommEarned;

    const finalDetailedGroups = detailedGroups.map(grp => ({
      ...grp,
      commEarned: isEligibleForSalesCommissions ? grp.potentialComm : 0
    }));

    return {
      ...rep,
      genTarget,
      genSales,
      genPct,
      requiredGenSales,
      remainingGenSales,
      remainingToFullTarget,
      passGate1_GeneralTarget,
      passGate2_MinGroups,
      isEligibleForSalesCommissions,
      detailedGroups: finalDetailedGroups,
      qualifiedGroupsCount,
      debt: Number(rep.debt) || 0,
      collection: Number(rep.collection) || 0,
      debtUnder60,
      collUnder60,
      collUnder60Pct,
      passUnder60,
      commUnder60Earned,
      debtOver60Net,
      collOver60,
      collOver60Pct,
      passOver60,
      commOver60Earned,
      collectionCommission: totalCollectionCommission,
      totalGroupCommissionEarned,
      generalTargetCommEarned,
      grandTotalCommission
    };
  },

  calculateCompanyTotals(processedReps, generalRules) {
    let genTarget = 0, genSales = 0, debt = 0, collection = 0;
    let collComm = 0, groupCommSum = 0, genTargetCommSum = 0, grandComm = 0;
    let fullyQualifiedCount = 0;

    (processedReps || []).forEach(r => {
      genTarget += r.genTarget || 0;
      genSales += r.genSales || 0;
      debt += r.debt || 0;
      collection += r.collection || 0;
      collComm += r.collectionCommission || 0;
      groupCommSum += r.totalGroupCommissionEarned || 0;
      genTargetCommSum += r.generalTargetCommEarned || 0;
      grandComm += r.grandTotalCommission || 0;
      if (r.isEligibleForSalesCommissions) fullyQualifiedCount++;
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
      qualifiedRepsCount: fullyQualifiedCount,
      totalReps: (processedReps || []).length
    };
  },

  analyzeAndSortGroups(groupRules, processedReps, sortBy = 'highestPct') {
    const analytics = (groupRules || []).map((grpRule, gIdx) => {
      let totalTarget = 0;
      let totalSales = 0;
      let qualifyingRepsCount = 0;
      let totalEarnedComm = 0;
      let totalPotentialComm = 0;

      (processedReps || []).forEach(rep => {
        const grp = rep.detailedGroups ? rep.detailedGroups[gIdx] : null;
        if (grp && grp.isActive) {
          totalTarget += grp.target || 0;
          totalSales += grp.sales || 0;

          if (grp.isQualified) {
            qualifyingRepsCount++;
            totalPotentialComm += grp.potentialComm;
            if (rep.isEligibleForSalesCommissions) {
              totalEarnedComm += grp.potentialComm;
            }
          }
        }
      });

      const avgPct = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
      const blockedComm = totalPotentialComm - totalEarnedComm;

      return {
        gIdx,
        rule: grpRule,
        totalTarget,
        totalSales,
        avgPct,
        qualifyingRepsCount,
        totalEarnedComm,
        totalPotentialComm,
        blockedComm
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
