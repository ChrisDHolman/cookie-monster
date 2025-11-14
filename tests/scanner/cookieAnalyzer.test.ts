import { CookieAnalyzer, CookieAnalysis } from '../../src/scanner/cookieAnalyzer';
import { Cookie } from '../../src/scanner/types';

describe('CookieAnalyzer', () => {
  let analyzer: CookieAnalyzer;

  beforeEach(() => {
    analyzer = new CookieAnalyzer();
  });

  // Helper to create a cookie with defaults
  const createCookie = (overrides: Partial<Cookie>): Cookie => ({
    name: 'test_cookie',
    value: 'test_value',
    domain: 'example.com',
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
    isThirdParty: false,
    foundOnUrl: 'https://example.com',
    ...overrides,
  });

  describe('analyzeCookie', () => {
    it('should analyze a basic first-party cookie', () => {
      const cookie = createCookie({ name: 'session', isThirdParty: false });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.cookie).toBe(cookie);
      expect(analysis.actualVendor).toBe('First Party');
      expect(analysis.isActuallyThirdParty).toBe(false);
      expect(analysis.category).toBe('unknown');
      expect(analysis.purpose).toBe('Unknown');
      expect(analysis.riskLevel).toBe('low');
    });

    it('should identify Google Analytics cookies', () => {
      const gaCookie = createCookie({ name: '_ga', domain: 'example.com', isThirdParty: true });
      const analysis = analyzer.analyzeCookie(gaCookie);

      expect(analysis.actualVendor).toBe('Google Analytics');
      expect(analysis.category).toBe('analytics');
      expect(analysis.purpose).toBe('Analytics tracking');
    });

    it('should identify Google Tag Manager cookies', () => {
      const gtmCookie = createCookie({ name: '_gtm_12345', isThirdParty: true });
      const analysis = analyzer.analyzeCookie(gtmCookie);

      expect(analysis.actualVendor).toBe('Google Tag Manager');
      expect(analysis.category).toBe('analytics');
    });

    it('should identify Facebook Pixel cookies', () => {
      const fbCookie = createCookie({ name: '_fbp', domain: 'facebook.com', isThirdParty: true });
      const analysis = analyzer.analyzeCookie(fbCookie);

      expect(analysis.actualVendor).toBe('Facebook Pixel');
      expect(analysis.category).toBe('advertising');
      expect(analysis.purpose).toBe('Ad targeting');
    });

    it('should identify Microsoft Clarity cookies', () => {
      const clarityCookie = createCookie({ name: '_clck', domain: 'clarity.ms', isThirdParty: true });
      const analysis = analyzer.analyzeCookie(clarityCookie);

      expect(analysis.actualVendor).toBe('Microsoft Clarity');
      expect(analysis.category).toBe('analytics');
    });

    it('should identify LinkedIn cookies', () => {
      const linkedInCookie = createCookie({ name: 'lidc', domain: 'linkedin.com', isThirdParty: true });
      const analysis = analyzer.analyzeCookie(linkedInCookie);

      expect(analysis.actualVendor).toBe('LinkedIn');
      expect(analysis.category).toBe('social');
    });

    it('should identify cookies by domain when name is unknown', () => {
      const googleCookie = createCookie({
        name: 'unknown_cookie',
        domain: '.google.com',
        isThirdParty: true
      });
      const analysis = analyzer.analyzeCookie(googleCookie);

      expect(analysis.actualVendor).toBe('Google');
      expect(analysis.category).toBe('advertising');
    });

    it('should handle consent management cookies as necessary', () => {
      const consentCookie = createCookie({
        name: 'cookieyes-consent',
        isThirdParty: true
      });
      const analysis = analyzer.analyzeCookie(consentCookie);

      expect(analysis.actualVendor).toBe('CookieYes');
      expect(analysis.category).toBe('necessary');
    });
  });

  describe('risk calculation', () => {
    it('should assign low risk to secure first-party cookies', () => {
      const cookie = createCookie({
        name: 'session',
        isThirdParty: false,
        secure: true,
        httpOnly: true,
        sameSite: 'Strict',
      });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.riskLevel).toBe('low');
      expect(analysis.riskReasons).toHaveLength(0);
    });

    it('should assign appropriate risk to analytics cookies', () => {
      const cookie = createCookie({
        name: '_ga',
        isThirdParty: true,
        secure: true,
        httpOnly: false,
        sameSite: 'None',
      });
      const analysis = analyzer.analyzeCookie(cookie);

      // Should be at least medium, could be higher based on flags
      expect(['medium', 'high', 'critical']).toContain(analysis.riskLevel);
      expect(analysis.riskReasons).toContain('Third-party tracking service');
      expect(analysis.riskReasons).toContain('Analytics tracking');
    });

    it('should assign high/critical risk to advertising cookies', () => {
      const cookie = createCookie({
        name: '_fbp',
        domain: 'facebook.com',
        isThirdParty: true,
        secure: false,
        httpOnly: false,
        sameSite: 'None',
      });
      const analysis = analyzer.analyzeCookie(cookie);

      // Advertising cookies with poor security are high/critical risk
      expect(['high', 'critical']).toContain(analysis.riskLevel);
      expect(analysis.riskReasons.length).toBeGreaterThan(3);
    });

    it('should increase risk for cookies without Secure flag', () => {
      const cookie = createCookie({
        name: '_ga',
        isThirdParty: true,
        secure: false,
      });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.riskReasons).toContain('Not marked as Secure');
    });

    it('should increase risk for cookies accessible via JavaScript', () => {
      const cookie = createCookie({
        name: '_ga',
        isThirdParty: true,
        httpOnly: false,
      });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.riskReasons).toContain('Accessible via JavaScript');
    });

    it('should increase risk for cookies with SameSite=None', () => {
      const cookie = createCookie({
        name: 'test',
        sameSite: 'None',
        isThirdParty: true,
      });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.riskReasons).toContain('Can be sent in cross-site requests');
    });

    it('should increase risk for cookies without SameSite', () => {
      const cookie = createCookie({
        name: 'test',
        sameSite: undefined,
        isThirdParty: true,
      });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.riskReasons).toContain('Can be sent in cross-site requests');
    });

    it('should flag long expiration times', () => {
      const twoYearsFromNow = Date.now() / 1000 + (2 * 365 * 24 * 60 * 60);
      const cookie = createCookie({
        name: 'persistent',
        expires: twoYearsFromNow,
        isThirdParty: false,
      });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.riskReasons.some(r => r.includes('Long expiration'))).toBe(true);
    });

    it('should assign critical risk to highly risky cookies', () => {
      const oneYearFromNow = Date.now() / 1000 + (365 * 24 * 60 * 60);
      const cookie = createCookie({
        name: 'ide', // Google DoubleClick
        domain: 'doubleclick.net',
        isThirdParty: true,
        secure: false,
        httpOnly: false,
        sameSite: 'None',
        expires: oneYearFromNow,
      });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.riskLevel).toBe('critical');
      expect(analysis.riskReasons.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('vendor detection', () => {
    it('should detect Google from domain variations', () => {
      const domains = ['google.com', 'doubleclick.net', 'google-analytics.com'];

      domains.forEach(domain => {
        const cookie = createCookie({ domain, isThirdParty: true });
        const analysis = analyzer.analyzeCookie(cookie);

        expect(analysis.actualVendor).toContain('Google');
      });
    });

    it('should detect Facebook/Meta from domain', () => {
      const cookie = createCookie({
        name: 'unknown',
        domain: 'facebook.com',
        isThirdParty: true
      });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.actualVendor).toBe('Facebook/Meta');
      expect(analysis.category).toBe('social');
    });

    it('should detect Microsoft services from domain', () => {
      const cookie = createCookie({
        name: 'unknown',
        domain: 'clarity.ms',
        isThirdParty: true
      });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.actualVendor).toBe('Microsoft Clarity');
      expect(analysis.category).toBe('analytics');
    });

    it('should handle case-insensitive matching', () => {
      const cookie = createCookie({
        name: '_GA',
        domain: 'EXAMPLE.COM',
        isThirdParty: true
      });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.actualVendor).toBe('Google Analytics');
    });

    it('should prioritize cookie name patterns over domain', () => {
      const cookie = createCookie({
        name: '_fbp',
        domain: 'example.com', // Not facebook.com
        isThirdParty: true
      });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.actualVendor).toBe('Facebook Pixel');
    });
  });

  describe('category classification', () => {
    it('should classify analytics cookies correctly', () => {
      const analyticsCookies = ['_ga', '_gid', '_gat', '_clck'];

      analyticsCookies.forEach(name => {
        const cookie = createCookie({ name, isThirdParty: true });
        const analysis = analyzer.analyzeCookie(cookie);

        expect(analysis.category).toBe('analytics');
      });
    });

    it('should classify advertising cookies correctly', () => {
      const adCookies = ['_fbp', 'ide', 'test_cookie', 'hubspotutk'];

      adCookies.forEach(name => {
        const cookie = createCookie({ name, isThirdParty: true });
        const analysis = analyzer.analyzeCookie(cookie);

        expect(analysis.category).toBe('advertising');
      });
    });

    it('should classify social media cookies correctly', () => {
      const socialCookies = ['li_sugr', 'lidc', 'bcookie'];

      socialCookies.forEach(name => {
        const cookie = createCookie({ name, isThirdParty: true });
        const analysis = analyzer.analyzeCookie(cookie);

        expect(analysis.category).toBe('social');
      });
    });

    it('should classify consent cookies as necessary', () => {
      const consentCookies = ['cookieyes-consent', 'cookiebot', 'onetrust'];

      consentCookies.forEach(name => {
        const cookie = createCookie({ name });
        const analysis = analyzer.analyzeCookie(cookie);

        expect(analysis.category).toBe('necessary');
      });
    });
  });

  describe('analyzeCookies (batch)', () => {
    it('should analyze multiple cookies at once', () => {
      const cookies: Cookie[] = [
        createCookie({ name: '_ga', isThirdParty: true }),
        createCookie({ name: '_fbp', isThirdParty: true }),
        createCookie({ name: 'session', isThirdParty: false }),
      ];

      const analyses = analyzer.analyzeCookies(cookies);

      expect(analyses).toHaveLength(3);
      expect(analyses[0].actualVendor).toBe('Google Analytics');
      expect(analyses[1].actualVendor).toBe('Facebook Pixel');
      expect(analyses[2].actualVendor).toBe('First Party');
    });

    it('should return empty array for empty input', () => {
      const analyses = analyzer.analyzeCookies([]);
      expect(analyses).toEqual([]);
    });

    it('should handle large batches efficiently', () => {
      const cookies: Cookie[] = [];
      for (let i = 0; i < 100; i++) {
        cookies.push(createCookie({ name: `cookie_${i}` }));
      }

      const analyses = analyzer.analyzeCookies(cookies);
      expect(analyses).toHaveLength(100);
    });
  });

  describe('edge cases', () => {
    it('should handle cookies with no expiration', () => {
      const cookie = createCookie({ expires: undefined });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.riskReasons.every(r => !r.includes('expiration'))).toBe(true);
    });

    it('should handle cookies with empty names', () => {
      const cookie = createCookie({ name: '' });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis).toBeDefined();
      expect(analysis.actualVendor).toBe('First Party');
    });

    it('should handle cookies with special characters', () => {
      const cookie = createCookie({ name: '__Secure-ID' });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis).toBeDefined();
    });

    it('should handle third-party cookie marked as first-party', () => {
      const cookie = createCookie({
        name: '_ga',
        isThirdParty: false, // Incorrectly marked
      });
      const analysis = analyzer.analyzeCookie(cookie);

      // Should detect it's actually third-party based on vendor
      expect(analysis.isActuallyThirdParty).toBe(true);
      expect(analysis.actualVendor).toBe('Google Analytics');
    });

    it('should handle expired cookies', () => {
      const pastDate = Date.now() / 1000 - (30 * 24 * 60 * 60); // 30 days ago
      const cookie = createCookie({ expires: pastDate });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis).toBeDefined();
      // Should not flag as long expiration
      expect(analysis.riskReasons.every(r => !r.includes('Long expiration'))).toBe(true);
    });

    it('should handle domain with leading dot', () => {
      const cookie = createCookie({ domain: '.example.com' });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis).toBeDefined();
    });
  });

  describe('comprehensive risk scenarios', () => {
    it('should correctly assess a typical session cookie', () => {
      const cookie = createCookie({
        name: 'my_app_auth',
        isThirdParty: false,
        secure: true,
        httpOnly: true,
        sameSite: 'Strict',
      });
      const analysis = analyzer.analyzeCookie(cookie);

      // Session cookies with good security flags should be low risk
      expect(analysis.riskLevel).toBe('low');
      expect(analysis.category).toBe('unknown');
      expect(analysis.isCookieSyncing).toBe(false);
    });

    it('should correctly assess a HubSpot tracking cookie', () => {
      const cookie = createCookie({
        name: '__hstc',
        domain: 'hubspot.com',
        isThirdParty: true,
        secure: false,
        httpOnly: false,
        sameSite: 'None',
      });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.actualVendor).toBe('HubSpot');
      expect(analysis.category).toBe('advertising');
      expect(analysis.riskLevel).not.toBe('low');
    });

    it('should correctly assess a secure analytics cookie', () => {
      const cookie = createCookie({
        name: '_gid',
        isThirdParty: true,
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.actualVendor).toBe('Google Analytics');
      expect(analysis.riskLevel).toBe('medium');
    });
  });
});
