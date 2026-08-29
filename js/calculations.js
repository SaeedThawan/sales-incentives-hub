const CalcEngine = {
  getCollectionCommissionRate(collPct, tiers) {
    if (!tiers || !Array.isArray(tiers)) return 0;
    const tier = tiers.find(t => collPct >= t.minPct && collPct <= t.maxPct);
    return tier ? tier.rate : 0;
  },

  processRepData(rep, generalRules, groupRules) {
    if (!rep) return null;

    const gRules = generalRules || {
      generalThresholdPct: 80,
      generalTargetCommValue: 500,
      minGroupsRequired: 7,
      collectionTiers: []
    };

    const grpRulesList = (groupRules && Array.isArray(groupRules)) ? groupRules : [];

    const genTarget = rep.generalTarget || 0;
    const genSales = rep.generalSales || 0;
    const genPct = genTarget > 0 ? (genSales / genTarget) * 100 : 0;
    const meetsGeneralRule = genPct >= (gRules.generalThresholdPct || 80);

    let qualifiedGroupsCount = 0;
    let potentialGroupCommSum = 0;

    const repGroups = Array.isArray(rep.groups) ? rep.groups : [];

    const detailedGroups = repGroups.map((grp, gIdx) => {
      const rule = grpRulesList[gIdx] || { thresholdPct: 70, commType: 'fixed', commValue: 250, name: `مجموعة ${gIdx + 1}` };
      const grpTarget = (grp && grp.target) ? grp.target : 0;
      const grpSales = (grp && grp.sales) ? grp.sales : 0;
      const grpPct = grpTarget > 0 ? (grpSales / grpTarget) * 100 : 0;
      const isQualified = grpTarget > 0 && grpPct >= (rule.thresholdPct || 70);

      if (isQualified) qualifiedGroupsCount++;

      const effectiveCommVal = (grp && grp.customComm !== undefined) ? grp.customComm : (rule.commValue || 0);
      let potentialComm = 0;
      if (isQualified) {
        potentialComm = rule.commType === 'fixed' ? effectiveCommVal : Math.max(0, grpSales) * (effectiveCommVal / 100);
      }
      potentialGroupCommSum += potentialComm;

      return {
        ...grp,
        name: rule.name,
        thresholdPct: rule.thresholdPct || 70,
        effectiveCommVal,
        grpPct,
        isQualified,
        potentialComm
      };
    });

    const meetsMinGroupsRule = qualifiedGroupsCount >= (gRules.minGroupsRequired || 7);
    const isFullyEligibleForGroupComm = meetsGeneralRule && meetsMinGroupsRule;
    const totalGroupCommissionEarned = isFullyEligibleForGroupComm ? potentialGroupCommSum : 0;

    const baseGenCommVal = Number(gRules.generalTargetCommValue) || 0;
    const generalTargetCommEarned = (isFullyEligibleForGroupComm && baseGenCommVal > 0) ? baseGenCommVal : 0;

    const debt = rep.debt || 0;
    const coll = rep.collection || 0;
    const collPct = debt > 0 ? (coll / debt) * 100 : 0;
    const collCommRate = this.getCollectionCommissionRate(collPct, gRules.collectionTiers || []);
    const collectionCommission = coll * collCommRate;

    const grandTotalCommission = collectionCommission + totalGroupCommissionEarned + generalTargetCommEarned;

    let groupCommStatusMsg = '';
    if (!meetsGeneralRule) {
      groupCommStatusMsg = `محجوبة (لم يحقق الهدف العام ${gRules.generalThresholdPct || 80}%)`;
    } else if (!meetsMinGroupsRule) {
      groupCommStatusMsg = `محجوبة (حقق ${qualifiedGroupsCount} من أصل ${gRules.minGroupsRequired || 7} مجموعات)`;
    } else {
      groupCommStatusMsg = `مستحقة (${qualifiedGroupsCount} مجموعات محققة)`;
    }

    return {
      ...rep,
      genPct,
      meetsGeneralRule,
      meetsMinGroupsRule,
      isFullyEligibleForGroupComm,
      groupCommStatusMsg,
      detailedGroups,
      qualifiedGroupsCount,
      collPct,
      collCommRate,
      collectionCommission,
      totalGroupCommissionEarned,
      generalTargetCommEarned,
      grandTotalCommission
    };
  }
};
