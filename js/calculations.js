/**
 * محرك العمليات الحسابية والتحليل المالي للعمولات والتحصيل
 * Core Calculation & Commission Engine
 */

const CalcEngine = {
  /**
   * تحديد نسبة عمولة التحصيل بناءً على الشرائح
   */
  getCollectionCommissionRate(collPct, tiers) {
    if (!tiers || !Array.isArray(tiers)) return 0;
    const tier = tiers.find(t => collPct >= t.minPct && collPct <= t.maxPct);
    return tier ? tier.rate : 0;
  },

  /**
   * معالجة وتحليل بيانات مندوب مبيعات منفرد
   */
  processRepData(rep, generalRules, groupRules) {
    if (!rep) return null;

    const gRules = generalRules || CONFIG.DEFAULT_GENERAL_RULES;
    const grpRulesList = (groupRules && Array.isArray(groupRules)) ? groupRules : CONFIG.FALLBACK_GROUPS;

    // 1. حسابات الهدف العام والمبيعات والمتبقي
    const genTarget = Number(rep.generalTarget) || 0;
    const genSales = Number(rep.generalSales) || 0;
    const genPct = genTarget > 0 ? (genSales / genTarget) * 100 : 0;
    
    // المبيعات المطلوبة للوصول لشرط الهدف العام والمتبقي لتحقيقه
    const requiredGenSales = genTarget * ((gRules.generalThresholdPct || 80) / 100);
    const remainingGenSales = Math.max(0, requiredGenSales - genSales);
    const remainingToFullTarget = Math.max(0, genTarget - genSales);
    const meetsGeneralRule = genPct >= (gRules.generalThresholdPct || 80);

    // 2. تحليل أداء المجموعات الـ 14
    let qualifiedGroupsCount = 0;
    let potentialGroupCommSum = 0;
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
      const remainingToThreshold = Math.max(0, thresholdTargetSales - grpSales);
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
      potentialGroupCommSum += potentialComm;

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

    // 3. التحقق من شرط المجموعات وأهلية صرف عمولة المجموعات والهدف العام
    const minGroupsReq = Number(gRules.minGroupsRequired) || 7;
    const meetsMinGroupsRule = qualifiedGroupsCount >= minGroupsReq;
    const isFullyEligibleForGroupComm = meetsGeneralRule && meetsMinGroupsRule;

    // العمولات المستحقة بعد فحص الشروط
    const totalGroupCommissionEarned = isFullyEligibleForGroupComm ? potentialGroupCommSum : 0;
    const baseGenCommVal = Number(gRules.generalTargetCommValue) || 0;
    const generalTargetCommEarned = (isFullyEligibleForGroupComm && baseGenCommVal > 0) ? baseGenCommVal : 0;

    // إضافة العمولة المستحقة الفعلية لكل مجموعة
    const finalDetailedGroups = detailedGroups.map(grp => ({
      ...grp,
      commEarned: isFullyEligibleForGroupComm ? grp.potentialComm : 0
    }));

    // 4. حسابات التحصيل والمديونية
    const debt = Number(rep.debt) || 0;
    const coll = Number(rep.collection) || 0;
    const remainingDebt = Math.max(0, debt - coll);
    const collPct = debt > 0 ? (coll / debt) * 100 : 0;
    
    const collCommRate = this.getCollectionCommissionRate(collPct, gRules.collectionTiers || []);
    const collectionCommission = coll * collCommRate;

    // 5. إجمالي كافة العمولات المستحقة
    const grandTotalCommission = collectionCommission + totalGroupCommissionEarned + generalTargetCommEarned;

    // رسالة حالة الاستحقاق
    let groupCommStatusMsg = '';
    if (!meetsGeneralRule) {
      groupCommStatusMsg = `محجوبة (لم يحقق شرط الهدف العام ${gRules.generalThresholdPct || 80}%)`;
    } else if (!meetsMinGroupsRule) {
      groupCommStatusMsg = `محجوبة (حقق ${qualifiedGroupsCount} من أصل ${minGroupsReq} مجموعات مطلوبة)`;
    } else {
      groupCommStatusMsg = `مستحقة بالكامل (${qualifiedGroupsCount} مجموعات محققة)`;
    }

    return {
      ...rep,
      genTarget,
      genSales,
      genPct,
      requiredGenSales,
      remainingGenSales,
      remainingToFullTarget,
      meetsGeneralRule,
      meetsMinGroupsRule,
      isFullyEligibleForGroupComm,
      groupCommStatusMsg,
      detailedGroups: finalDetailedGroups,
      qualifiedGroupsCount,
      debt,
      collection: coll,
      remainingDebt,
      collPct,
      collCommRate,
      collectionCommission,
      potentialGroupCommSum,
      totalGroupCommissionEarned,
      generalTargetCommEarned,
      grandTotalCommission
    };
  },

  /**
   * حساب إجماليات الشركة بالكامل
   */
  calculateCompanyTotals(processedReps, generalRules) {
    let genTarget = 0, genSales = 0, debt = 0, collection = 0;
    let collComm = 0, groupCommSum = 0, genTargetCommSum = 0, grandComm = 0;
    let qualifiedRepsCount = 0;

    (processedReps || []).forEach(r => {
      genTarget += r.genTarget || 0;
      genSales += r.genSales || 0;
      debt += r.debt || 0;
      collection += r.collection || 0;
      collComm += r.collectionCommission || 0;
      groupCommSum += r.totalGroupCommissionEarned || 0;
      genTargetCommSum += r.generalTargetCommEarned || 0;
      grandComm += r.grandTotalCommission || 0;
      if (r.isFullyEligibleForGroupComm) qualifiedRepsCount++;
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
      qualifiedRepsCount,
      totalReps: (processedReps || []).length
    };
  },

  /**
   * تحليل وترتيب المجموعات الـ 14 حسب معايير الفرز
   */
  analyzeAndSortGroups(groupRules, processedReps, sortBy = 'highestPct') {
    const analytics = (groupRules || []).map((grpRule, gIdx) => {
      let totalTarget = 0;
      let totalSales = 0;
      let qualifyingRepsCount = 0;
      let totalEarnedComm = 0;
      let totalPotentialComm = 0;
      let repsWithTargetCount = 0;
      
      let topSalesRep = { name: 'لا يوجد', sales: 0, grpPct: 0 };
      const qualifyingRepsList = [];

      (processedReps || []).forEach(rep => {
        const grp = rep.detailedGroups ? rep.detailedGroups[gIdx] : null;
        if (grp) {
          totalTarget += grp.target || 0;
          totalSales += grp.sales || 0;
          if (grp.target > 0) repsWithTargetCount++;

          if (grp.sales > topSalesRep.sales) {
            topSalesRep = { name: rep.name, sales: grp.sales, grpPct: grp.grpPct };
          }

          if (grp.isQualified) {
            qualifyingRepsCount++;
            totalPotentialComm += grp.potentialComm;
            if (rep.isFullyEligibleForGroupComm) {
              totalEarnedComm += grp.potentialComm;
            }
            qualifyingRepsList.push({
              id: rep.id,
              name: rep.name,
              sales: grp.sales,
              grpPct: grp.grpPct,
              commEarned: grp.commEarned,
              potentialComm: grp.potentialComm,
              isFullyEligible: rep.isFullyEligibleForGroupComm
            });
          }
        }
      });

      const avgPct = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
      const blockedComm = totalPotentialComm - totalEarnedComm;
      const avgTargetPerRep = repsWithTargetCount > 0 ? totalTarget / repsWithTargetCount : 0;

      return {
        gIdx,
        rule: grpRule,
        totalTarget,
        totalSales,
        avgPct,
        repsWithTargetCount,
        avgTargetPerRep,
        qualifyingRepsCount,
        totalEarnedComm,
        totalPotentialComm,
        blockedComm,
        topSalesRep,
        qualifyingRepsList
      };
    });

    // تطبيق الفرز
    return analytics.sort((a, b) => {
      if (sortBy === 'highestPct') return b.avgPct - a.avgPct;
      if (sortBy === 'highestSales') return b.totalSales - a.totalSales;
      if (sortBy === 'highestBlockedComm') return b.blockedComm - a.blockedComm;
      if (sortBy === 'lowestPct') return a.avgPct - b.avgPct; // للأصناف الضعيفة
      return 0;
    });
  }
};
