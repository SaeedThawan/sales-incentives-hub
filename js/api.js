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
        userContext,
        notes: 'مقترح أهداف وعمولات مرفوع من المشرف'
      })
    });
    return await res.json();
  },

  async approveMonth(monthKey, userContext) {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'approveProposal',
        proposalId: `PROP_${monthKey}`,
        monthKey,
        userContext,
        notes: 'تم الاعتماد النهائي والإقفال من المدير العام'
      })
    });
    return await res.json();
  }
};