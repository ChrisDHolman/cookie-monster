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
    
    return {
      cookie,
      actualVendor: vendorInfo.vendor,
      isActuallyThirdParty,
      riskLevel,
      riskReasons,
      purpose: vendorInfo.purpose,
      category: vendorInfo.category
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

    // Analytics
    vendors.set('_ga', { vendor: 'Google Analytics', isThirdParty: true, purpose: 'Analytics tracking', category: 'analytics' });
    vendors.set('_gid', { vendor: 'Google Analytics', isThirdParty: true, purpose: 'Analytics tracking', category: 'analytics' });
    vendors.set('_gat', { vendor: 'Google Analytics', isThirdParty: true, purpose: 'Analytics tracking', category: 'analytics' });
    vendors.set('_gtm', { vendor: 'Google Tag Manager', isThirdParty: true, purpose: 'Tag management', category: 'analytics' });
    vendors.set('_clck', { vendor: 'Microsoft Clarity', isThirdParty: true, purpose: 'Session recording', category: 'analytics' });
    vendors.set('_clsk', { vendor: 'Microsoft Clarity', isThirdParty: true, purpose: 'Session recording', category: 'analytics' });
    vendors.set('clid', { vendor: 'Microsoft Clarity', isThirdParty: true, purpose: 'User identification', category: 'analytics' });
    vendors.set('muid', { vendor: 'Microsoft Bing', isThirdParty: true, purpose: 'User identification', category: 'analytics' });
    vendors.set('anonchk', { vendor: 'Microsoft', isThirdParty: true, purpose: 'Anonymous user check', category: 'analytics' });
    
    // Advertising
    vendors.set('_fbp', { vendor: 'Facebook Pixel', isThirdParty: true, purpose: 'Ad targeting', category: 'advertising' });
    vendors.set('fr', { vendor: 'Facebook', isThirdParty: true, purpose: 'Ad targeting', category: 'advertising' });
    vendors.set('ide', { vendor: 'Google DoubleClick', isThirdParty: true, purpose: 'Ad targeting', category: 'advertising' });
    vendors.set('test_cookie', { vendor: 'Google DoubleClick', isThirdParty: true, purpose: 'Ad testing', category: 'advertising' });
    
    // Social Media
    vendors.set('li_', { vendor: 'LinkedIn', isThirdParty: true, purpose: 'Social tracking', category: 'social' });
    vendors.set('lidc', { vendor: 'LinkedIn', isThirdParty: true, purpose: 'Social tracking', category: 'social' });
    vendors.set('bcookie', { vendor: 'LinkedIn', isThirdParty: true, purpose: 'Browser identification', category: 'social' });
    
    // Marketing/Lead tracking
    vendors.set('snitcher', { vendor: 'Snitcher', isThirdParty: true, purpose: 'B2B visitor tracking', category: 'advertising' });
    vendors.set('_fuid', { vendor: 'Freshworks', isThirdParty: true, purpose: 'User identification', category: 'functional' });
    vendors.set('hubspotutk', { vendor: 'HubSpot', isThirdParty: true, purpose: 'Visitor tracking', category: 'advertising' });
    vendors.set('__hstc', { vendor: 'HubSpot', isThirdParty: true, purpose: 'Visitor tracking', category: 'advertising' });
    
    // Consent Management
    vendors.set('cookieyes', { vendor: 'CookieYes', isThirdParty: true, purpose: 'Consent management', category: 'necessary' });
    vendors.set('cookiebot', { vendor: 'Cookiebot', isThirdParty: true, purpose: 'Consent management', category: 'necessary' });
    vendors.set('onetrust', { vendor: 'OneTrust', isThirdParty: true, purpose: 'Consent management', category: 'necessary' });
    vendors.set('fs-consent', { vendor: 'Consent Manager', isThirdParty: false, purpose: 'Store consent preferences', category: 'necessary' });

    return vendors;
  }

  /**
   * Batch analyze multiple cookies
   */
  analyzeCookies(cookies: Cookie[]): CookieAnalysis[] {
    return cookies.map(cookie => this.analyzeCookie(cookie));
  }
}

interface VendorInfo {
  vendor: string;
  isThirdParty: boolean;
  purpose: string;
  category: 'necessary' | 'functional' | 'analytics' | 'advertising' | 'social' | 'unknown';
}
