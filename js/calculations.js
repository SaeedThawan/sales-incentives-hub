/**
 * محرك احتساب الأداء وبوابات الاستحقاق والتحصيل المتقدم ومؤشرات المطبخ v9.5
 */

const CalcEngine = {
  getTierRate(pct, tiers) {
    if (!tiers || !Array.isArray(tiers) || tiers.length === 0) return 0;
    const sorted = [...tiers].sort((a, b) => Number(b.minPct) - Number(a.minPct));
    const matched = sorted.find(t => pct >= Number(t.minPct));
    return matched ? Number(matched.rate || 0) : 0;
  },

  processRepData(rep, generalRules, groupRules) {
    if (!rep) return null;

    const isRepActive = rep.isActive !== false;
    const gRules = generalRules || CONFIG.DEFAULT_GENERAL_RULES;
    const grpRulesList = (groupRules && Array.isArray(groupRules)) ? groupRules : CONFIG.FALLBACK_GROUPS;

    // 1. بوابة الهدف العام
    const genTarget = Number(rep.generalTarget) || 0;
    const genSales = Number(rep.generalSales) || 0;
    const genPct = genTarget > 0 ? (genSales / genTarget) * 100 : 0;
    
    const isGenTargetMandatory = gRules.isGenTargetMandatory !== false;
    const genThresholdPct = Number(gRules.generalThresholdPct !== undefined ? gRules.generalThresholdPct : 80);
    const passGate_GenTarget = genTarget > 0 ? (genPct >= genThresholdPct) : false;
    const remainingGenSales = genTarget > 0 ? Math.max(0, (genTarget * (genThresholdPct / 100)) - genSales) : 0;

    // 2. بوابة المجموعات الـ 14 والتفكيك الفردي
    let qualifiedGroupsCount = 0;
    let failedMandatoryGroups = [];
    let rawGroupCommSum = 0;
    const repGroups = Array.isArray(rep.groups) ? rep.groups : [];

    const detailedGroups = grpRulesList.map((rule, gIdx) => {
      const repGrp = repGroups[gIdx] || { target: 0, sales: 0, customComm: null };
      const isGroupActive = rule.isActive !== false;
      const isGroupMandatory = rule.isMandatory === true;

      const grpTarget = Number(repGrp.target) || 0;
      const grpSales = Number(repGrp.sales) || 0;
      const grpPct = grpTarget > 0 ? (grpSales / grpTarget) * 100 : 0;
      
      const thresholdPct = Number(rule.thresholdPct !== undefined ? rule.thresholdPct : 70);
      const thresholdTargetSales = grpTarget * (thresholdPct / 100);
      const remainingToThreshold = grpTarget > 0 ? Math.max(0, thresholdTargetSales - grpSales) : 0;
      
      const isQualified = isGroupActive && grpTarget > 0 && grpPct >= thresholdPct;

      if (isQualified) qualifiedGroupsCount++;
      if (isGroupMandatory && !isQualified) {
        failedMandatoryGroups.push(rule.name);
      }

      const effectiveCommVal = (repGrp.customComm !== undefined && repGrp.customComm !== null && repGrp.customComm !== '')
        ? Number(repGrp.customComm)
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
        id: rule.id !== undefined ? rule.id : gIdx,
        originalIndex: gIdx,
        name: rule.name,
        target: grpTarget,
        sales: grpSales,
        customComm: repGrp.customComm,
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

    // 3. التحصيل
    const collRules = gRules.collectionRules || {
      isCollMandatory: false,
      thresholdPct: 30,
      commType: 'percent',
      commValue: 0.5,
      over60: {
        isMandatory: false,
        thresholdPct: 40,
        tiers: [{ minPct: 40, rate: 0.01 }, { minPct: 50, rate: 0.02 }]
      },
      under60: { isActive: true, thresholdPct: 30, commType: 'percent', commValue: 0.5 }
    };

    const debt = Number(rep.debt) || 0;
    const collection = Number(rep.collection) || 0;
    const overallCollPct = debt > 0 ? (collection / debt) * 100 : 0;

    let totalCollectionCommission = 0;
    if (collRules.commType === 'percent') {
      totalCollectionCommission = collection * (Number(collRules.commValue || 0.5) / 100);
    } else {
      totalCollectionCommission = Number(collRules.commValue || 0);
    }

    // 4. استحقاق العمولات التراكمي
    const meetsGenTargetReq = !isGenTargetMandatory || passGate_GenTarget;
    const isEligibleForGroupCommissions = isRepActive && meetsGenTargetReq && passGate_MandatoryGroups && passGate_MinGroupsCount;
    const totalGroupCommissionEarned = isEligibleForGroupCommissions ? rawGroupCommSum : 0;

    const isEligibleForGenTargetComm = isRepActive && passGate_GenTarget;
    const generalTargetCommEarned = isEligibleForGenTargetComm ? (Number(gRules.generalTargetCommValue) || 0) : 0;

    const grandTotalCommission = totalGroupCommissionEarned + generalTargetCommEarned + (isRepActive ? totalCollectionCommission : 0);

    const finalDetailedGroups = detailedGroups.map(grp => ({
      ...grp,
      commEarned: isEligibleForGroupCommissions ? grp.potentialComm : 0
    }));

    let blockers = [];
    if (isGenTargetMandatory && !passGate_GenTarget) {
      blockers.push(`باقي للهدف العام ${Math.round(remainingGenSales).toLocaleString()} ر.س`);
    }
    if (!passGate_MandatoryGroups) {
      blockers.push(`أصناف إلزامية غير مكتملة: [${failedMandatoryGroups.join('، ')}]`);
    }
    if (!passGate_MinGroupsCount) {
      blockers.push(`حقق ${qualifiedGroupsCount} من أصل ${minGroupsReq} مجموعات`);
    }

    const eligibilityStatusText = blockers.length === 0 ? 'مستحق بالكامل ✅' : `محجوبة: ${blockers.join(' | ')}`;

    return {
      ...rep,
      isActive: isRepActive,
      genTarget,
      genSales,
      genPct,
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
      debt,
      collection,
      overallCollPct,
      collectionCommission: isRepActive ? totalCollectionCommission : 0,
      grandTotalCommission,
      eligibilityStatusText
    };
  },

  calculateCompanyTotals(processedReps, generalRules) {
    let genTarget = 0, genSales = 0, debt = 0, collection = 0;
    let collComm = 0, groupCommSum = 0, genTargetCommSum = 0, grandComm = 0;
    let qualifiedCount = 0, activeCount = 0;

    (processedReps || []).forEach(r => {
      if (r.isActive !== false) {
        activeCount++;
        genTarget += r.genTarget || 0;
        genSales += r.genSales || 0;
        debt += r.debt || 0;
        collection += r.collection || 0;
        collComm += r.collectionCommission || 0;
        groupCommSum += r.totalGroupCommissionEarned || 0;
        genTargetCommSum += r.generalTargetCommEarned || 0;
        grandComm += r.grandTotalCommission || 0;
        if (r.isGroupsGateQualified) qualifiedCount++;
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
      qualifiedGroupsCount: qualifiedCount,
      totalReps: activeCount
    };
  },

  calculateKitchenMetrics(groupRules, repsData) {
    return (groupRules || []).map((grp, gIdx) => {
      let totalTarget = 0;
      let totalSales = 0;
      let assignedRepsCount = 0;
      let qualifyingCount = 0;
      let totalPotentialComm = 0;

      (repsData || []).forEach(rep => {
        if (rep.isActive !== false && rep.groups && rep.groups[gIdx]) {
          const rGrp = rep.groups[gIdx];
          const t = Number(rGrp.target) || 0;
          const s = Number(rGrp.sales) || 0;
          if (t > 0 || s > 0) assignedRepsCount++;
          totalTarget += t;
          totalSales += s;

          const pct = t > 0 ? (s / t) * 100 : 0;
          const isQ = t > 0 && pct >= Number(grp.thresholdPct || 70);
          if (isQ) {
            qualifyingCount++;
            const comm = (rGrp.customComm !== undefined && rGrp.customComm !== null && rGrp.customComm !== '')
              ? Number(rGrp.customComm)
              : Number(grp.commValue || 0);
            totalPotentialComm += grp.commType === 'percent' ? (s * (comm / 100)) : comm;
          }
        }
      });

      const avgAchievementPct = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
      const avgRepTarget = assignedRepsCount > 0 ? totalTarget / assignedRepsCount : 0;
      const avgCommissionFromTargetPct = avgRepTarget > 0 ? (Number(grp.commValue || 0) / avgRepTarget) * 100 : 0;
      const commCostFromSalesPct = totalSales > 0 ? (totalPotentialComm / totalSales) * 100 : 0;
      const isWeak = avgAchievementPct < 60 && totalTarget > 0;

      return {
        gIdx,
        group: grp,
        assignedRepsCount,
        totalTarget,
        totalSales,
        avgAchievementPct,
        qualifyingCount,
        totalPotentialComm,
        avgCommissionFromTargetPct,
        commCostFromSalesPct,
        isWeak
      };
    });
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
