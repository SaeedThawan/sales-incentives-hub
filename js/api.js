const ApiService = {
  async fetchWorkspace(role, userId, monthKey) {
    const endpoint = role === 'rep'
      ? `${CONFIG.API_URL}?action=getRepDashboard&userId=${userId}&monthKey=${monthKey}`
      : `${CONFIG.API_URL}?action=getSupervisorWorkspace&monthKey=${monthKey}`;
    const res = await fetch(endpoint);
    return await res.json();
  },

  async saveProposal(monthKey, customRules, userContext) {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'saveProposal',
        monthKey,
        customRules,
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
