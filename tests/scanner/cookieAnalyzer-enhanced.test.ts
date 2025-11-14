import { CookieAnalyzer } from '../../src/scanner/cookieAnalyzer';
import { Cookie } from '../../src/scanner/types';

describe('CookieAnalyzer - Enhanced Features', () => {
  let analyzer: CookieAnalyzer;

  beforeEach(() => {
    analyzer = new CookieAnalyzer();
  });

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

  describe('Expanded Vendor Database', () => {
    describe('Google Analytics cookies', () => {
      it('should recognize modern GA4 cookies', () => {
        const cookies = ['_ga', '_gid', '_gat', '_gac'].map(name =>
          createCookie({ name, isThirdParty: true })
        );

        cookies.forEach(cookie => {
          const analysis = analyzer.analyzeCookie(cookie);
          expect(analysis.actualVendor).toContain('Google Analytics');
          expect(analysis.category).toBe('analytics');
        });
      });

      it('should recognize legacy Universal Analytics cookies', () => {
        const legacyCookies = ['__utma', '__utmb', '__utmc', '__utmt', '__utmz'];

        legacyCookies.forEach(name => {
          const cookie = createCookie({ name, isThirdParty: true });
          const analysis = analyzer.analyzeCookie(cookie);

          expect(analysis.actualVendor).toBe('Google Analytics (Legacy)');
          expect(analysis.category).toBe('analytics');
        });
      });
    });

    describe('Facebook/Meta cookies', () => {
      it('should recognize Facebook Pixel cookies', () => {
        const cookie = createCookie({ name: '_fbp', domain: 'facebook.com', isThirdParty: true });
        const analysis = analyzer.analyzeCookie(cookie);

        expect(analysis.actualVendor).toBe('Facebook Pixel');
        expect(analysis.category).toBe('advertising');
      });

      it('should recognize Facebook authentication cookies', () => {
        const authCookies = ['xs', 'c_user', 'datr'];

        authCookies.forEach(name => {
          const cookie = createCookie({ name, domain: 'facebook.com', isThirdParty: true });
          const analysis = analyzer.analyzeCookie(cookie);

          expect(analysis.actualVendor).toBe('Facebook');
          expect(analysis.category).toBe('advertising');
        });
      });
    });

    describe('Social media cookies', () => {
      it('should recognize LinkedIn cookies', () => {
        const linkedInCookies = ['li_sugr', 'lidc', 'bcookie', 'bscookie', 'lang', 'lissc'];

        linkedInCookies.forEach(name => {
          const cookie = createCookie({ name, domain: 'linkedin.com', isThirdParty: true });
          const analysis = analyzer.analyzeCookie(cookie);

          expect(analysis.actualVendor).toBe('LinkedIn');
          expect(analysis.category).toBe('social');
        });
      });

      it('should recognize Twitter/X cookies', () => {
        const twitterCookies = ['personalization_id', 'guest_id', 'ct0'];

        twitterCookies.forEach(name => {
          const cookie = createCookie({ name, domain: 'twitter.com', isThirdParty: true });
          const analysis = analyzer.analyzeCookie(cookie);

          expect(analysis.actualVendor).toBe('Twitter/X');
          expect(analysis.category).toBe('social');
        });
      });

      it('should recognize TikTok cookies', () => {
        const tikTokCookies = ['_ttp', 'tt_webid'];

        tikTokCookies.forEach(name => {
          const cookie = createCookie({ name, domain: 'tiktok.com', isThirdParty: true });
          const analysis = analyzer.analyzeCookie(cookie);

          expect(analysis.actualVendor).toBe('TikTok');
          expect(analysis.category).toBe('social');
        });
      });

      it('should recognize Pinterest cookies', () => {
        const pinterestCookies = ['_pinterest_sess', '_pin_unauth'];

        pinterestCookies.forEach(name => {
          const cookie = createCookie({ name, domain: 'pinterest.com', isThirdParty: true });
          const analysis = analyzer.analyzeCookie(cookie);

          expect(analysis.actualVendor).toBe('Pinterest');
          expect(analysis.category).toBe('social');
        });
      });
    });

    describe('Analytics platforms', () => {
      it('should recognize Hotjar cookies', () => {
        const hotjarCookies = ['_hjid', '_hjSessionID', '_hjIncludedInSample'];

        hotjarCookies.forEach(name => {
          const cookie = createCookie({ name, isThirdParty: true });
          const analysis = analyzer.analyzeCookie(cookie);

          expect(analysis.actualVendor).toBe('Hotjar');
          expect(analysis.category).toBe('analytics');
        });
      });

      it('should recognize Mixpanel cookies', () => {
        const cookie = createCookie({ name: 'mp_123456_mixpanel', isThirdParty: true });
        const analysis = analyzer.analyzeCookie(cookie);

        expect(analysis.actualVendor).toBe('Mixpanel');
        expect(analysis.category).toBe('analytics');
      });

      it('should recognize Segment cookies', () => {
        const cookie = createCookie({ name: 'ajs_user_id', isThirdParty: true });
        const analysis = analyzer.analyzeCookie(cookie);

        expect(analysis.actualVendor).toBe('Segment');
        expect(analysis.category).toBe('analytics');
      });
    });

    describe('Advertising platforms', () => {
      it('should recognize Google Ads cookies', () => {
        // Test with domain-based detection for Google/DoubleClick
        const cookie1 = createCookie({ name: 'test_ad_cookie', domain: 'doubleclick.net', isThirdParty: true });
        const analysis1 = analyzer.analyzeCookie(cookie1);

        expect(analysis1.actualVendor).toContain('Google');
        expect(analysis1.category).toBe('advertising');

        // Test specific ad cookies from vendor database
        const cookie2 = createCookie({ name: 'ide', domain: 'doubleclick.net', isThirdParty: true });
        const analysis2 = analyzer.analyzeCookie(cookie2);

        expect(analysis2.actualVendor).toBe('Google DoubleClick');
        expect(analysis2.category).toBe('advertising');
      });

      it('should recognize Taboola cookies', () => {
        const cookie = createCookie({ name: 'taboola_session', isThirdParty: true });
        const analysis = analyzer.analyzeCookie(cookie);

        expect(analysis.actualVendor).toBe('Taboola');
        expect(analysis.category).toBe('advertising');
      });

      it('should recognize Criteo cookies', () => {
        const cookie = createCookie({ name: 'criteo_id', isThirdParty: true });
        const analysis = analyzer.analyzeCookie(cookie);

        expect(analysis.actualVendor).toBe('Criteo');
        expect(analysis.category).toBe('advertising');
      });
    });

    describe('Marketing automation', () => {
      it('should recognize HubSpot cookies', () => {
        const hubspotCookies = ['hubspotutk', '__hstc', '__hssc', '__hssrc'];

        hubspotCookies.forEach(name => {
          const cookie = createCookie({ name, isThirdParty: true });
          const analysis = analyzer.analyzeCookie(cookie);

          expect(analysis.actualVendor).toBe('HubSpot');
        });
      });

      it('should recognize Marketo cookies', () => {
        const cookie = createCookie({ name: '_mkto_trk', isThirdParty: true });
        const analysis = analyzer.analyzeCookie(cookie);

        expect(analysis.actualVendor).toBe('Marketo');
        expect(analysis.category).toBe('advertising');
      });
    });

    describe('Consent management cookies', () => {
      it('should recognize new consent vendors', () => {
        const consentCookies = [
          { name: 'osano_consent', vendor: 'Osano' },
          { name: 'termly_consent', vendor: 'Termly' },
          { name: 'trustarc_consent', vendor: 'TrustArc' },
        ];

        consentCookies.forEach(({ name, vendor }) => {
          const cookie = createCookie({ name, isThirdParty: true });
          const analysis = analyzer.analyzeCookie(cookie);

          expect(analysis.actualVendor).toBe(vendor);
          expect(analysis.category).toBe('necessary');
        });
      });
    });
  });

  describe('Cookie Syncing Detection', () => {
    it('should detect cookies with "sync" in name', () => {
      const cookie = createCookie({ name: 'user_sync_token', domain: 'ad-network.com', isThirdParty: true });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.isCookieSyncing).toBe(true);
    });

    it('should detect cookies with "match" in name', () => {
      const cookie = createCookie({ name: 'match_id_123', domain: 'tracker.com', isThirdParty: true });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.isCookieSyncing).toBe(true);
    });

    it('should detect UUID cookies used for syncing', () => {
      const cookie = createCookie({ name: 'tuuid', domain: 'taboola.com', isThirdParty: true });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.isCookieSyncing).toBe(true);
    });

    it('should detect cookies from known syncing domains', () => {
      const syncingDomains = ['demdex.net', 'everesttech.net', 'adsrvr.org', 'mathtag.com'];

      syncingDomains.forEach(domain => {
        const cookie = createCookie({ name: 'test_cookie', domain, isThirdParty: true });
        const analysis = analyzer.analyzeCookie(cookie);

        expect(analysis.isCookieSyncing).toBe(true);
      });
    });

    it('should not flag regular cookies as syncing', () => {
      const cookie = createCookie({ name: '_ga', domain: 'example.com', isThirdParty: false });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.isCookieSyncing).toBe(false);
    });
  });

  describe('Unnecessary Cookie Detection', () => {
    it('should flag Google conversion linker cookies as unnecessary', () => {
      const conversionCookies = ['_gcl_aw', '_gcl_dc', '_gcl_gb', '_gcl_gf', '_gcl_ha'];

      conversionCookies.forEach(name => {
        const cookie = createCookie({ name, isThirdParty: true });
        const analysis = analyzer.analyzeCookie(cookie);

        expect(analysis.isUnnecessary).toBe(true);
      });
    });

    it('should flag legacy GA cookies as unnecessary', () => {
      const cookie = createCookie({ name: '__utma', isThirdParty: true });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.isUnnecessary).toBe(true);
    });

    it('should not flag necessary cookies as unnecessary', () => {
      const cookie = createCookie({ name: 'session_id', isThirdParty: false });
      const analysis = analyzer.analyzeCookie(cookie);

      expect(analysis.isUnnecessary).toBe(false);
    });
  });

  describe('Excessive Cookies Detection (Batch Analysis)', () => {
    it('should flag cookies when vendor has more than 5 cookies', () => {
      const cookies: Cookie[] = [];

      // Create 7 Google Analytics cookies
      for (let i = 0; i < 7; i++) {
        cookies.push(createCookie({
          name: `_ga_${i}`,
          domain: 'google-analytics.com',
          isThirdParty: true
        }));
      }

      const analyses = analyzer.analyzeCookies(cookies);

      // Should flag all as unnecessary due to excessive count
      const flaggedCount = analyses.filter(a => a.isUnnecessary).length;
      expect(flaggedCount).toBeGreaterThan(0);
    });

    it('should not flag necessary cookies as excessive', () => {
      const cookies: Cookie[] = [];

      // Create 7 consent cookies (necessary category)
      for (let i = 0; i < 7; i++) {
        cookies.push(createCookie({
          name: `cookieyes_consent_${i}`,
          isThirdParty: true
        }));
      }

      const analyses = analyzer.analyzeCookies(cookies);

      // Should not flag necessary cookies even if many
      const flaggedCount = analyses.filter(a =>
        a.riskReasons.includes('Excessive cookies from vendor')
      ).length;
      expect(flaggedCount).toBe(0);
    });

    it('should not flag vendors with 5 or fewer cookies', () => {
      const cookies: Cookie[] = [];

      // Create exactly 5 Facebook cookies
      for (let i = 0; i < 5; i++) {
        cookies.push(createCookie({
          name: `_fbp_${i}`,
          domain: 'facebook.com',
          isThirdParty: true
        }));
      }

      const analyses = analyzer.analyzeCookies(cookies);

      // Should not flag as excessive (5 is the threshold)
      const flaggedCount = analyses.filter(a =>
        a.riskReasons.includes('Excessive cookies from vendor')
      ).length;
      expect(flaggedCount).toBe(0);
    });
  });

  describe('Integration - Complex Scenarios', () => {
    it('should correctly analyze a cookie with multiple issues', () => {
      const cookie = createCookie({
        name: 'id_sync_token',
        domain: 'demdex.net',
        isThirdParty: true,
        secure: false,
        httpOnly: false,
        sameSite: 'None',
        expires: Date.now() / 1000 + (2 * 365 * 24 * 60 * 60) // 2 years
      });

      const analysis = analyzer.analyzeCookie(cookie);

      // Should detect multiple problems
      expect(analysis.isCookieSyncing).toBe(true);
      expect(analysis.isActuallyThirdParty).toBe(true);
      expect(analysis.riskLevel).not.toBe('low');
      expect(analysis.riskReasons.length).toBeGreaterThan(3);
    });

    it('should handle mixed cookie types in batch analysis', () => {
      const cookies: Cookie[] = [
        // Necessary
        createCookie({ name: 'session_id', isThirdParty: false }),

        // Analytics
        createCookie({ name: '_ga', isThirdParty: true }),
        createCookie({ name: '_gid', isThirdParty: true }),

        // Advertising
        createCookie({ name: '_fbp', domain: 'facebook.com', isThirdParty: true }),

        // Cookie syncing
        createCookie({ name: 'user_sync', domain: 'demdex.net', isThirdParty: true }),
      ];

      const analyses = analyzer.analyzeCookies(cookies);

      expect(analyses).toHaveLength(5);

      // Verify different categories
      const categories = new Set(analyses.map(a => a.category));
      expect(categories.size).toBeGreaterThan(1);

      // At least one should be flagged as syncing
      const syncingCount = analyses.filter(a => a.isCookieSyncing).length;
      expect(syncingCount).toBeGreaterThan(0);
    });
  });
});
