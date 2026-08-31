/**
 * طبقة استدعاء البيانات والـ API
 */

const ApiService = {
  async fetchWorkspace(role, userId, monthKey) {
    const url = `${CONFIG.API_URL}?action=${role === 'rep' ? 'getRepDashboard' : 'getSupervisorWorkspace'}&userId=${userId}&monthKey=${monthKey}`;
    const res = await fetch(url);
    return await res.json();
  },

  async saveProposal(monthKey, proposalData, userContext) {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'saveSupervisorProposal',
        monthKey,
        ...proposalData,
        userContext
      })
    });
    return await res.json();
  },

  async saveOfficialConfig(monthKey, officialData, userContext) {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'saveOfficialConfig',
        monthKey,
        ...officialData,
        userContext
      })
    });
    return await res.json();
  },

  async approveMonth(monthKey, userContext) {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'approveProposal',
        monthKey,
        userContext
      })
    });
    return await res.json();
  },

  async unlockMonth(monthKey, userContext) {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'unlockMonth',
        monthKey,
        userContext
      })
    });
    return await res.json();
  },

  async recalculateRawData(monthKey, userContext) {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'recalculateRawData',
        monthKey,
        userContext
      })
    });
    return await res.json();
  }
};
