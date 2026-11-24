export class DeviceDetector {
  static isTouchDevice() {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    );
  }

  static isAndroid() {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('android');
  }

  static isMobile() {
    const ua = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone', 'mobile'];
    const isMobileUA = mobileKeywords.some(keyword => ua.includes(keyword));
    return isMobileUA || (DeviceDetector.isTouchDevice() && window.innerWidth <= 1024);
  }

  static isLandscape() {
    return window.innerWidth > window.innerHeight;
  }

  static getScreenCategory() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isLand = w > h;
    const maxDim = Math.max(w, h);
    const minDim = Math.min(w, h);

    if (minDim <= 480) return 'mobile-compact';
    if (minDim <= 768) return 'mobile-large';
    if (maxDim <= 1280 && DeviceDetector.isTouchDevice()) return 'tablet';
    return 'desktop';
  }
}
