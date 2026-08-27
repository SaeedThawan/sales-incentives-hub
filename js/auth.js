const AuthService = {
  getUserLocation() {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({ lat: 0, lng: 0 })
        );
      } else {
        resolve({ lat: 0, lng: 0 });
      }
    });
  },

  async login(username, password) {
    const location = await this.getUserLocation();
    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'login',
          username,
          password,
          latitude: location.lat,
          longitude: location.lng,
          deviceInfo: navigator.userAgent
        })
      });
      return await res.json();
    } catch (err) {
      // وضع العمل دون اتصال (Offline Mock Fallback)
      if (username === 'admin') {
        return { status: 'success', user: { userId: 1, username: 'admin', fullName: 'المدير العام', role: 'manager' } };
      } else if (username === 'supervisor') {
        return { status: 'success', user: { userId: 2, username: 'supervisor', fullName: 'مشرف المبيعات', role: 'supervisor' } };
      }
      return { status: 'success', user: { userId: 14, username: 'soliman', fullName: 'سليمان سيف', role: 'rep' } };
    }
  }
};