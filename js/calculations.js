/**
 * محرك العمليات الحسابية ومنظومة بوابات الاستحقاق التراكمية
 */

const CalcEngine = {
  getCollectionCommissionRate(collPct, tiers) {
    if (!tiers || !Array.isArray(tiers)) return 0;
    const tier = tiers.find(t => collPct >= t.minPct && collPct <= t.maxPct);
    return tier ? tier.rate : 0;
  },

  processRepData(rep, generalRules, groupRules) {
    if (!rep) return null;

    const gRules = generalRules || CONFIG.DEFAULT_GENERAL_RULES;
    const grpRulesList = (groupRules && Array.isArray(groupRules)) ? groupRules : CONFIG.FALLBACK_GROUPS;

    // البوابة 1: الهدف العام
    const genTarget = Number(rep.generalTarget) || 0;
    const genSales = Number(rep.generalSales) || 0;
    const genPct = genTarget > 0 ? (genSales / genTarget) * 100 : 0;
    const requiredGenThresholdPct = Number(gRules.generalThresholdPct) || 80;
    const passGate1_GeneralTarget = genTarget > 0 && genPct >= requiredGenThresholdPct;

    const requiredGenSales = genTarget * (requiredGenThresholdPct / 100);
    const remainingGenSales = genTarget > 0 ? Math.max(0, requiredGenSales - genSales) : 0;
    const remainingToFullTarget = genTarget > 0 ? Math.max(0, genTarget - genSales) : 0;

    // البوابة 2: المجموعات الـ 14
    let qualifiedGroupsCount = 0;
    let rawGroupCommSum = 0;
    const repGroups = Array.isArray(rep.groups) ? rep.groups : [];

    const detailedGroups = repGroups.map((grp, gIdx) => {
      const rule = grpRulesList[gIdx] || { 
        thresholdPct: 70, 
        commType: 'fixed', 
        commValue: 250, 
        name: `مجموعة ${gIdx + 1}` 
      };

      const grpTarget = Number(grp.target) || 0;
      const grpSales = Number(grp.sales) || 0;
      const grpPct = grpTarget > 0 ? (grpSales / grpTarget) * 100 : 0;
      
      const thresholdTargetSales = grpTarget * ((rule.thresholdPct || 70) / 100);
      const remainingToThreshold = grpTarget > 0 ? Math.max(0, thresholdTargetSales - grpSales) : 0;
      const isQualified = grpTarget > 0 && grpPct >= (rule.thresholdPct || 70);

      if (isQualified) qualifiedGroupsCount++;

      const effectiveCommVal = (grp.customComm !== undefined && grp.customComm !== null)
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
      rawGroupCommSum += potentialComm;

      return {
        ...grp,
        originalIndex: gIdx,
        name: grp.name || rule.name,
        thresholdPct: rule.thresholdPct || 70,
        commType: rule.commType || 'fixed',
        effectiveCommVal,
        grpPct,
        isQualified,
        thresholdTargetSales,
        remainingToThreshold,
        potentialComm
      };
    });

    const minGroupsReq = Number(gRules.minGroupsRequired) || 7;
    const passGate2_MinGroups = qualifiedGroupsCount >= minGroupsReq;

    // البوابة 3: شرط تحصيل الديون فوق 60 يوم (صافي)
    const debtOver60Net = Number(rep.debtOver60Net) || Number(rep.debt) || 0;
    const collOver60 = Number(rep.collOver60) || Number(rep.collection) || 0;
    const collOver60Pct = debtOver60Net > 0 ? (collOver60 / debtOver60Net) * 100 : 100;
    const minOver60RequiredPct = Number(gRules.minOver60RequiredPct) || 40;
    const passGate3_Over60Aging = collOver60Pct >= minOver60RequiredPct;

    // البوابة 4: التحصيل العام
    const debt = Number(rep.debt) || 0;
    const coll = Number(rep.collection) || 0;
    const remainingDebt = Math.max(0, debt - coll);
    const collPct = debt > 0 ? (coll / debt) * 100 : 0;
    const collCommRate = this.getCollectionCommissionRate(collPct, gRules.collectionTiers || []);
    
    // تطبيق القرار التراكمي
    const isEligibleForSalesCommissions = passGate1_GeneralTarget && passGate2_MinGroups && passGate3_Over60Aging;
    const totalGroupCommissionEarned = isEligibleForSalesCommissions ? rawGroupCommSum : 0;

    const baseGenCommVal = Number(gRules.generalTargetCommValue) || 0;
    const generalTargetCommEarned = (isEligibleForSalesCommissions && baseGenCommVal > 0) ? baseGenCommVal : 0;

    const isEligibleForCollectionComm = passGate1_GeneralTarget && passGate3_Over60Aging && (collCommRate > 0);
    const collectionCommission = isEligibleForCollectionComm ? (coll * collCommRate) : 0;

    const grandTotalCommission = collectionCommission + totalGroupCommissionEarned + generalTargetCommEarned;

    const finalDetailedGroups = detailedGroups.map(grp => ({
      ...grp,
      commEarned: isEligibleForSalesCommissions ? grp.potentialComm : 0
    }));

    let statusMsg = '';
    if (genTarget === 0) {
      statusMsg = 'غير محدد هدف';
    } else if (!passGate1_GeneralTarget) {
      statusMsg = `محجوبة (الهدف العام أقل من ${requiredGenThresholdPct}%)`;
    } else if (!passGate2_MinGroups) {
      statusMsg = `محجوبة (${qualifiedGroupsCount} من أصل ${minGroupsReq} مجموعات)`;
    } else if (!passGate3_Over60Aging) {
      statusMsg = `محجوبة (تحصيل فوق 60 يوم ${collOver60Pct.toFixed(1)}% < ${minOver60RequiredPct}%)`;
    } else {
      statusMsg = `مستحقة بالكامل ✅`;
    }

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
      passGate3_Over60Aging,
      debtOver60Net,
      collOver60,
      collOver60Pct,
      isEligibleForSalesCommissions,
      isEligibleForCollectionComm,
      statusMsg,
      detailedGroups: finalDetailedGroups,
      qualifiedGroupsCount,
      debt,
      collection: coll,
      remainingDebt,
      collPct,
      collCommRate,
      collectionCommission,
      potentialGroupCommSum: rawGroupCommSum,
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
        if (grp) {
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
