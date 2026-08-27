const CalcEngine = {
  getCollectionCommissionRate(collPct, tiers) {
    const tier = tiers.find(t => collPct >= t.minPct && collPct <= t.maxPct);
    return tier ? tier.rate : 0;
  },

  processRepData(rep, generalRules, groupRules) {
    const genTarget = rep.generalTarget || 0;
    const genSales = rep.generalSales || 0;
    const genPct = genTarget > 0 ? (genSales / genTarget) * 100 : 0;
    const meetsGeneralRule = genPct >= generalRules.generalThresholdPct;

    let qualifiedGroupsCount = 0;
    let potentialGroupCommSum = 0;

    const detailedGroups = (rep.groups || []).map((grp, gIdx) => {
      const rule = groupRules[gIdx] || { thresholdPct: 70, commType: 'fixed', commValue: 250, name: `مجموعة ${gIdx+1}` };
      const grpTarget = grp.target || 0;
      const grpSales = grp.sales || 0;
      const grpPct = grpTarget > 0 ? (grpSales / grpTarget) * 100 : 0;
      const isQualified = grpTarget > 0 && grpPct >= rule.thresholdPct;

      if (isQualified) qualifiedGroupsCount++;

      const effectiveCommVal = grp.customComm !== undefined ? grp.customComm : rule.commValue;
      let potentialComm = 0;
      if (isQualified) {
        potentialComm = rule.commType === 'fixed' ? effectiveCommVal : Math.max(0, grpSales) * (effectiveCommVal / 100);
      }
      potentialGroupCommSum += potentialComm;

      return {
        ...grp,
        name: rule.name,
        thresholdPct: rule.thresholdPct,
        effectiveCommVal,
        grpPct,
        isQualified,
        potentialComm
      };
    });

    const meetsMinGroupsRule = qualifiedGroupsCount >= generalRules.minGroupsRequired;
    const isFullyEligibleForGroupComm = meetsGeneralRule && meetsMinGroupsRule;
    const totalGroupCommissionEarned = isFullyEligibleForGroupComm ? potentialGroupCommSum : 0;

    const baseGenCommVal = Number(generalRules.generalTargetCommValue) || 0;
    const generalTargetCommEarned = (isFullyEligibleForGroupComm && baseGenCommVal > 0) ? baseGenCommVal : 0;

    const debt = rep.debt || 0;
    const coll = rep.collection || 0;
    const collPct = debt > 0 ? (coll / debt) * 100 : 0;
    const collCommRate = this.getCollectionCommissionRate(collPct, generalRules.collectionTiers);
    const collectionCommission = coll * collCommRate;

    const grandTotalCommission = collectionCommission + totalGroupCommissionEarned + generalTargetCommEarned;

    return {
      ...rep,
      genPct,
      meetsGeneralRule,
      meetsMinGroupsRule,
      isFullyEligibleForGroupComm,
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