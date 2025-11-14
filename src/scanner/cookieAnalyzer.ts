import { Cookie } from './types';
import { logger } from '../utils/logger';

export interface CookieAnalysis {
  cookie: Cookie;
  actualVendor: string;
  isActuallyThirdParty: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskReasons: string[];
  purpose: string;
  category: 'necessary' | 'functional' | 'analytics' | 'advertising' | 'social' | 'unknown';
  isCookieSyncing?: boolean;
  isUnnecessary?: boolean;
}

export class CookieAnalyzer {
  private knownVendors: Map<string, VendorInfo>;

  constructor() {
    this.knownVendors = this.loadKnownVendors();
  }

  /**
   * Analyze a cookie to determine its actual vendor and risk
   */
  analyzeCookie(cookie: Cookie): CookieAnalysis {
    // Detect actual vendor from cookie name/domain
    const vendorInfo = this.detectActualVendor(cookie);

    // Determine if it's actually third-party
    const isActuallyThirdParty = vendorInfo.isThirdParty || cookie.isThirdParty;

    // Calculate risk level
    const { riskLevel, riskReasons } = this.calculateRisk(cookie, vendorInfo);

    // Detect cookie syncing
    const isCookieSyncing = this.detectCookieSyncing(cookie);

    // Detect unnecessary cookies
    const isUnnecessary = this.detectUnnecessary(cookie, vendorInfo);

    return {
      cookie,
      actualVendor: vendorInfo.vendor,
      isActuallyThirdParty,
      riskLevel,
      riskReasons,
      purpose: vendorInfo.purpose,
      category: vendorInfo.category,
      isCookieSyncing,
      isUnnecessary
    };
  }

  /**
   * Detect the actual vendor of a cookie
   */
  private detectActualVendor(cookie: Cookie): VendorInfo {
    const cookieName = cookie.name.toLowerCase();
    const domain = cookie.domain.toLowerCase();

    // Check known vendor patterns
    for (const [pattern, info] of this.knownVendors.entries()) {
      if (cookieName.includes(pattern) || domain.includes(pattern)) {
        return info;
      }
    }

    // Check domain-based vendors
    if (domain.includes('google') || domain.includes('doubleclick')) {
      return { vendor: 'Google', isThirdParty: true, purpose: 'Analytics/Advertising', category: 'advertising' };
    }
    if (domain.includes('facebook') || domain.includes('meta')) {
      return { vendor: 'Facebook/Meta', isThirdParty: true, purpose: 'Social Media Tracking', category: 'social' };
    }
    if (domain.includes('linkedin')) {
      return { vendor: 'LinkedIn', isThirdParty: true, purpose: 'Social Media Tracking', category: 'social' };
    }
    if (domain.includes('twitter') || domain.includes('twimg')) {
      return { vendor: 'Twitter/X', isThirdParty: true, purpose: 'Social Media Tracking', category: 'social' };
    }
    if (domain.includes('clarity.ms') || domain.includes('bing.com')) {
      return { vendor: 'Microsoft Clarity', isThirdParty: true, purpose: 'Analytics/Session Recording', category: 'analytics' };
    }
    if (domain.includes('cloudflare')) {
      // Cloudflare cookies like _cfuvid are for bot protection (security)
      return { vendor: 'Cloudflare', isThirdParty: true, purpose: 'Security/Bot protection', category: 'functional' };
    }

    // Default
    return {
      vendor: cookie.isThirdParty ? domain : 'First Party',
      isThirdParty: cookie.isThirdParty,
      purpose: 'Unknown',
      category: 'unknown'
    };
  }

  /**
   * Calculate risk level for a cookie
   */
  private calculateRisk(cookie: Cookie, vendorInfo: VendorInfo): { riskLevel: 'low' | 'medium' | 'high' | 'critical', riskReasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    // Third-party increases risk
    if (vendorInfo.isThirdParty) {
      score += 3;
      reasons.push('Third-party tracking service');
    }

    // Category-based risk
    if (vendorInfo.category === 'advertising') {
      score += 3;
      reasons.push('Advertising/tracking cookie');
    } else if (vendorInfo.category === 'analytics') {
      score += 2;
      reasons.push('Analytics tracking');
    } else if (vendorInfo.category === 'social') {
      score += 2;
      reasons.push('Social media tracking');
    }

    // Security flags
    if (!cookie.secure && vendorInfo.isThirdParty) {
      score += 2;
      reasons.push('Not marked as Secure');
    }
    if (!cookie.httpOnly && vendorInfo.isThirdParty) {
      score += 1;
      reasons.push('Accessible via JavaScript');
    }
    if (cookie.sameSite === 'None' || !cookie.sameSite) {
      score += 2;
      reasons.push('Can be sent in cross-site requests');
    }

    // Long expiration
    if (cookie.expires) {
      const now = Date.now() / 1000;
      const daysUntilExpiry = (cookie.expires - now) / (24 * 60 * 60);
      if (daysUntilExpiry > 365) {
        score += 1;
        reasons.push(`Long expiration (${Math.round(daysUntilExpiry / 365)} years)`);
      }
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (score >= 8) riskLevel = 'critical';
    else if (score >= 6) riskLevel = 'high';
    else if (score >= 3) riskLevel = 'medium';
    else riskLevel = 'low';

    return { riskLevel, riskReasons: reasons };
  }

  /**
   * Load known vendor patterns
   */
  private loadKnownVendors(): Map<string, VendorInfo> {
    const vendors = new Map<string, VendorInfo>();

    // Analytics - Google
    vendors.set('_ga', { vendor: 'Google Analytics', isThirdParty: true, purpose: 'Analytics tracking', category: 'analytics' });
    vendors.set('_gid', { vendor: 'Google Analytics', isThirdParty: true, purpose: 'Analytics tracking', category: 'analytics' });
    vendors.set('_gat', { vendor: 'Google Analytics', isThirdParty: true, purpose: 'Analytics tracking', category: 'analytics' });
    vendors.set('_gac', { vendor: 'Google Analytics', isThirdParty: true, purpose: 'Campaign tracking', category: 'analytics' });
    vendors.set('__utma', { vendor: 'Google Analytics (Legacy)', isThirdParty: true, purpose: 'User identification', category: 'analytics' });
    vendors.set('__utmb', { vendor: 'Google Analytics (Legacy)', isThirdParty: true, purpose: 'Session tracking', category: 'analytics' });
    vendors.set('__utmc', { vendor: 'Google Analytics (Legacy)', isThirdParty: true, purpose: 'Session tracking', category: 'analytics' });
    vendors.set('__utmt', { vendor: 'Google Analytics (Legacy)', isThirdParty: true, purpose: 'Throttle requests', category: 'analytics' });
    vendors.set('__utmz', { vendor: 'Google Analytics (Legacy)', isThirdParty: true, purpose: 'Traffic source', category: 'analytics' });
    vendors.set('_gtm', { vendor: 'Google Tag Manager', isThirdParty: true, purpose: 'Tag management', category: 'analytics' });

    // Analytics - Microsoft
    vendors.set('_clck', { vendor: 'Microsoft Clarity', isThirdParty: true, purpose: 'Session recording', category: 'analytics' });
    vendors.set('_clsk', { vendor: 'Microsoft Clarity', isThirdParty: true, purpose: 'Session recording', category: 'analytics' });
    vendors.set('clid', { vendor: 'Microsoft Clarity', isThirdParty: true, purpose: 'User identification', category: 'analytics' });
    vendors.set('muid', { vendor: 'Microsoft Bing', isThirdParty: true, purpose: 'User identification', category: 'analytics' });
    vendors.set('anonchk', { vendor: 'Microsoft', isThirdParty: true, purpose: 'Anonymous user check', category: 'analytics' });
    vendors.set('_uetsid', { vendor: 'Microsoft Bing Ads', isThirdParty: true, purpose: 'Session tracking', category: 'analytics' });
    vendors.set('_uetvid', { vendor: 'Microsoft Bing Ads', isThirdParty: true, purpose: 'Visitor identification', category: 'analytics' });

    // Analytics - Other
    vendors.set('_hjid', { vendor: 'Hotjar', isThirdParty: true, purpose: 'User identification', category: 'analytics' });
    vendors.set('_hjsessionid', { vendor: 'Hotjar', isThirdParty: true, purpose: 'Session tracking', category: 'analytics' });
    vendors.set('_hjincludedinsample', { vendor: 'Hotjar', isThirdParty: true, purpose: 'Sampling control', category: 'analytics' });
    vendors.set('mp_', { vendor: 'Mixpanel', isThirdParty: true, purpose: 'Product analytics', category: 'analytics' });
    vendors.set('ajs_', { vendor: 'Segment', isThirdParty: true, purpose: 'Analytics platform', category: 'analytics' });
    vendors.set('_hp2_', { vendor: 'Heap Analytics', isThirdParty: true, purpose: 'User analytics', category: 'analytics' });
    vendors.set('intercom', { vendor: 'Intercom', isThirdParty: true, purpose: 'Customer messaging', category: 'functional' });
    vendors.set('__hssrc', { vendor: 'HubSpot', isThirdParty: true, purpose: 'Session identification', category: 'analytics' });
    vendors.set('__hssc', { vendor: 'HubSpot', isThirdParty: true, purpose: 'Session count', category: 'analytics' });
    
    // Advertising - Facebook/Meta
    vendors.set('_fbp', { vendor: 'Facebook Pixel', isThirdParty: true, purpose: 'Ad targeting', category: 'advertising' });
    vendors.set('_fbc', { vendor: 'Facebook Pixel', isThirdParty: true, purpose: 'Click tracking', category: 'advertising' });
    vendors.set('fr', { vendor: 'Facebook', isThirdParty: true, purpose: 'Ad targeting', category: 'advertising' });
    vendors.set('xs', { vendor: 'Facebook', isThirdParty: true, purpose: 'Authentication', category: 'advertising' });
    vendors.set('c_user', { vendor: 'Facebook', isThirdParty: true, purpose: 'User identification', category: 'advertising' });
    vendors.set('datr', { vendor: 'Facebook', isThirdParty: true, purpose: 'Browser identification', category: 'advertising' });

    // Advertising - Google
    vendors.set('ide', { vendor: 'Google DoubleClick', isThirdParty: true, purpose: 'Ad targeting', category: 'advertising' });
    vendors.set('test_cookie', { vendor: 'Google DoubleClick', isThirdParty: true, purpose: 'Ad testing', category: 'advertising' });
    vendors.set('__gads', { vendor: 'Google Ads', isThirdParty: true, purpose: 'Ad serving', category: 'advertising' });
    vendors.set('__gpi', { vendor: 'Google Ads', isThirdParty: true, purpose: 'Ad personalization', category: 'advertising' });
    vendors.set('nid', { vendor: 'Google', isThirdParty: true, purpose: 'Ad preferences', category: 'advertising' });
    vendors.set('anid', { vendor: 'Google', isThirdParty: true, purpose: 'Anonymous ID', category: 'advertising' });
    vendors.set('dsid', { vendor: 'Google', isThirdParty: true, purpose: 'Ad targeting', category: 'advertising' });

    // Advertising - Other
    vendors.set('uuid', { vendor: 'MediaMath', isThirdParty: true, purpose: 'User identification', category: 'advertising' });
    vendors.set('tuuid', { vendor: 'Taboola', isThirdParty: true, purpose: 'User tracking', category: 'advertising' });
    vendors.set('taboola_', { vendor: 'Taboola', isThirdParty: true, purpose: 'Content recommendations', category: 'advertising' });
    vendors.set('outbrain', { vendor: 'Outbrain', isThirdParty: true, purpose: 'Content recommendations', category: 'advertising' });
    vendors.set('__atuvc', { vendor: 'AddThis', isThirdParty: true, purpose: 'Share tracking', category: 'advertising' });
    vendors.set('__atuvs', { vendor: 'AddThis', isThirdParty: true, purpose: 'Share tracking', category: 'advertising' });
    vendors.set('criteo', { vendor: 'Criteo', isThirdParty: true, purpose: 'Retargeting', category: 'advertising' });
    
    // Social Media - LinkedIn
    vendors.set('li_', { vendor: 'LinkedIn', isThirdParty: true, purpose: 'Social tracking', category: 'social' });
    vendors.set('lidc', { vendor: 'LinkedIn', isThirdParty: true, purpose: 'Social tracking', category: 'social' });
    vendors.set('bcookie', { vendor: 'LinkedIn', isThirdParty: true, purpose: 'Browser identification', category: 'social' });
    vendors.set('bscookie', { vendor: 'LinkedIn', isThirdParty: true, purpose: 'Secure browser identification', category: 'social' });
    vendors.set('lang', { vendor: 'LinkedIn', isThirdParty: true, purpose: 'Language preference', category: 'social' });
    vendors.set('lissc', { vendor: 'LinkedIn', isThirdParty: true, purpose: 'Member state tracking', category: 'social' });

    // Social Media - Twitter/X
    vendors.set('personalization_id', { vendor: 'Twitter/X', isThirdParty: true, purpose: 'Content personalization', category: 'social' });
    vendors.set('guest_id', { vendor: 'Twitter/X', isThirdParty: true, purpose: 'Guest tracking', category: 'social' });
    vendors.set('ct0', { vendor: 'Twitter/X', isThirdParty: true, purpose: 'CSRF protection', category: 'social' });

    // Social Media - Pinterest
    vendors.set('_pinterest_sess', { vendor: 'Pinterest', isThirdParty: true, purpose: 'Session tracking', category: 'social' });
    vendors.set('_pin_unauth', { vendor: 'Pinterest', isThirdParty: true, purpose: 'User tracking', category: 'social' });

    // Social Media - TikTok
    vendors.set('_ttp', { vendor: 'TikTok', isThirdParty: true, purpose: 'User identification', category: 'social' });
    vendors.set('tt_webid', { vendor: 'TikTok', isThirdParty: true, purpose: 'Web visitor ID', category: 'social' });
    
    // Marketing/Lead tracking
    vendors.set('snitcher', { vendor: 'Snitcher', isThirdParty: true, purpose: 'B2B visitor tracking', category: 'advertising' });
    vendors.set('_fuid', { vendor: 'Freshworks', isThirdParty: true, purpose: 'User identification', category: 'functional' });
    vendors.set('hubspotutk', { vendor: 'HubSpot', isThirdParty: true, purpose: 'Visitor tracking', category: 'advertising' });
    vendors.set('__hstc', { vendor: 'HubSpot', isThirdParty: true, purpose: 'Visitor tracking', category: 'advertising' });
    vendors.set('__hssc', { vendor: 'HubSpot', isThirdParty: true, purpose: 'Session count', category: 'advertising' });
    vendors.set('_mkto_trk', { vendor: 'Marketo', isThirdParty: true, purpose: 'Lead tracking', category: 'advertising' });
    vendors.set('_sfmc_sub', { vendor: 'Salesforce Marketing Cloud', isThirdParty: true, purpose: 'Subscriber tracking', category: 'advertising' });
    vendors.set('pardot', { vendor: 'Pardot', isThirdParty: true, purpose: 'B2B marketing automation', category: 'advertising' });
    vendors.set('vuid', { vendor: 'Vimeo', isThirdParty: true, purpose: 'Video analytics', category: 'functional' });
    vendors.set('_gcl_', { vendor: 'Google Click Identifier', isThirdParty: true, purpose: 'Campaign tracking', category: 'advertising' });
    
    // Consent Management
    vendors.set('cookieyes', { vendor: 'CookieYes', isThirdParty: true, purpose: 'Consent management', category: 'necessary' });
    vendors.set('cookiebot', { vendor: 'Cookiebot', isThirdParty: true, purpose: 'Consent management', category: 'necessary' });
    vendors.set('onetrust', { vendor: 'OneTrust', isThirdParty: true, purpose: 'Consent management', category: 'necessary' });
    vendors.set('fs-consent', { vendor: 'Consent Manager', isThirdParty: false, purpose: 'Store consent preferences', category: 'necessary' });
    vendors.set('osano', { vendor: 'Osano', isThirdParty: true, purpose: 'Consent management', category: 'necessary' });
    vendors.set('termly', { vendor: 'Termly', isThirdParty: true, purpose: 'Consent management', category: 'necessary' });
    vendors.set('trustarc', { vendor: 'TrustArc', isThirdParty: true, purpose: 'Consent management', category: 'necessary' });
    vendors.set('optanon', { vendor: 'OneTrust', isThirdParty: true, purpose: 'Consent management', category: 'necessary' });

    // E-commerce & Shopping
    vendors.set('_shopify_', { vendor: 'Shopify', isThirdParty: false, purpose: 'E-commerce functionality', category: 'functional' });
    vendors.set('cart', { vendor: 'Shopping Cart', isThirdParty: false, purpose: 'Shopping cart', category: 'necessary' });
    vendors.set('secure_customer_sig', { vendor: 'Shopify', isThirdParty: false, purpose: 'Customer authentication', category: 'necessary' });

    // CDN & Performance
    vendors.set('__cfduid', { vendor: 'Cloudflare', isThirdParty: true, purpose: 'Bot protection', category: 'necessary' });
    vendors.set('cf_', { vendor: 'Cloudflare', isThirdParty: true, purpose: 'Performance optimization', category: 'necessary' });

    // A/B Testing & Optimization
    vendors.set('optimizely', { vendor: 'Optimizely', isThirdParty: true, purpose: 'A/B testing', category: 'functional' });
    vendors.set('_vwo_', { vendor: 'VWO', isThirdParty: true, purpose: 'A/B testing', category: 'functional' });
    vendors.set('_ab', { vendor: 'A/B Testing Platform', isThirdParty: true, purpose: 'Experiment tracking', category: 'functional' });

    return vendors;
  }

  /**
   * Detect if cookie is used for syncing/data sharing
   */
  private detectCookieSyncing(cookie: Cookie): boolean {
    const name = cookie.name.toLowerCase();
    const domain = cookie.domain.toLowerCase();

    // Common cookie syncing patterns
    const syncingPatterns = [
      'sync',
      'match',
      'pixel',
      'uuid',
      'tuuid',
      'usync',
      'cm',
      'visitor_id',
      'id_sync',
      'user_sync',
      'match_id',
      'sync_token'
    ];

    // Check cookie name for syncing patterns
    if (syncingPatterns.some(pattern => name.includes(pattern))) {
      return true;
    }

    // Known syncing domains
    const syncingDomains = [
      'demdex',
      'everesttech',
      'adsrvr',
      'mathtag',
      'rlcdn',
      'crwdcntrl',
      'bluekai',
      'exelator'
    ];

    if (syncingDomains.some(domain_pattern => domain.includes(domain_pattern))) {
      return true;
    }

    return false;
  }

  /**
   * Detect if cookie is unnecessary or excessive
   */
  private detectUnnecessary(cookie: Cookie, vendorInfo: VendorInfo): boolean {
    const name = cookie.name.toLowerCase();

    // Cookies that are often unnecessary
    const unnecessaryPatterns = [
      '_gcl_aw', // Google conversion linker (not always needed)
      '_gcl_dc', // DoubleClick conversion linker
      '_gcl_gb', // Google global conversion
      '_gcl_gf', // Google Floodlight
      '_gcl_ha'  // Google Ads historical
    ];

    if (unnecessaryPatterns.some(pattern => name.includes(pattern))) {
      return true;
    }

    // Multiple tracking cookies from same vendor could indicate excessive tracking
    // (This would need batch analysis to fully implement, just flagging known excessive ones)
    const excessiveVendorPatterns = [
      '__utm', // Legacy GA cookies (if modern _ga* also present)
    ];

    if (excessiveVendorPatterns.some(pattern => name.includes(pattern))) {
      return true;
    }

    return false;
  }

  /**
   * Batch analyze multiple cookies
   */
  analyzeCookies(cookies: Cookie[]): CookieAnalysis[] {
    const analyses = cookies.map(cookie => this.analyzeCookie(cookie));

    // Additional batch analysis for detecting duplicates/excessive cookies
    this.detectExcessiveCookies(analyses);

    return analyses;
  }

  /**
   * Detect excessive cookies from same vendor in batch analysis
   */
  private detectExcessiveCookies(analyses: CookieAnalysis[]): void {
    const vendorCounts = new Map<string, number>();

    // Count cookies per vendor
    for (const analysis of analyses) {
      const vendor = analysis.actualVendor;
      vendorCounts.set(vendor, (vendorCounts.get(vendor) || 0) + 1);
    }

    // Flag cookies as unnecessary if vendor has excessive count
    for (const analysis of analyses) {
      const vendor = analysis.actualVendor;
      const count = vendorCounts.get(vendor) || 0;

      // More than 5 cookies from same vendor is excessive
      if (count > 5 && analysis.category !== 'necessary') {
        analysis.isUnnecessary = true;
        if (!analysis.riskReasons.includes('Excessive cookies from vendor')) {
          analysis.riskReasons.push('Excessive cookies from vendor');
        }
      }
    }
  }
}

interface VendorInfo {
  vendor: string;
  isThirdParty: boolean;
  purpose: string;
  category: 'necessary' | 'functional' | 'analytics' | 'advertising' | 'social' | 'unknown';
}
