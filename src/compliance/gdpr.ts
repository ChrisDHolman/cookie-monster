import { FrameworkRule } from './types';
import { ConsentTestResult } from '../scanner/types';
import { AggregatedScanResults } from '../scanner/types';
import { CookieAnalyzer } from '../scanner/cookieAnalyzer';

export const gdprRules: FrameworkRule[] = [
  {
    id: 'gdpr-001',
    framework: 'gdpr',
    severity: 'critical',
    category: 'Cookie Consent',
    title: 'Non-essential cookies loaded before consent',
    description: 'GDPR requires explicit consent before setting non-essential cookies',
    check: (data: { consent: ConsentTestResult }) => {
      const beforeConsent = data.consent.beforeConsent;
      const analyzer = new CookieAnalyzer();
      const analyses = analyzer.analyzeCookies(beforeConsent.cookies);

      // Only flag cookies that are analytics, advertising, or social
      // Exclude necessary and functional cookies, and consent management cookies
      const nonEssentialCookies = analyses.filter(a =>
        a.category === 'analytics' || a.category === 'advertising' || a.category === 'social'
      );

      return nonEssentialCookies.length > 0;
    },
    recommendation: 'Ensure only strictly necessary cookies are set before user consent. All analytics, marketing, and non-essential cookies should only load after explicit consent.'
  },
  {
    id: 'gdpr-002',
    framework: 'gdpr',
    severity: 'critical',
    category: 'Tracking Scripts',
    title: 'Third-party tracking scripts loaded before consent',
    description: 'Analytics and tracking scripts should not execute before user consent',
    check: (data: { consent: ConsentTestResult }) => {
      const beforeConsent = data.consent.beforeConsent;
      const trackingScripts = beforeConsent.scripts.filter(s => 
        s.isThirdParty && (
          s.url.includes('analytics') || 
          s.url.includes('tracking') ||
          s.url.includes('google-analytics') ||
          s.url.includes('gtag') ||
          s.url.includes('facebook') ||
          s.url.includes('doubleclick')
        )
      );
      return trackingScripts.length > 0;
    },
    recommendation: 'Block all third-party tracking and analytics scripts until user provides explicit consent.'
  },
  {
    id: 'gdpr-003',
    framework: 'gdpr',
    severity: 'critical',
    category: 'Consent Mechanism',
    title: 'No consent mechanism detected',
    description: 'GDPR requires a clear consent mechanism for cookie usage',
    check: (data: { consent: ConsentTestResult; scan: AggregatedScanResults }) => {
      // If no consent mechanism found but cookies/scripts are present
      return !data.consent.consentMechanismFound && 
             (data.scan.uniqueCookies.length > 2 || data.scan.thirdPartyScripts.length > 0);
    },
    recommendation: 'Implement a cookie consent banner that allows users to accept or reject non-essential cookies.'
  },
  {
    id: 'gdpr-004',
    framework: 'gdpr',
    severity: 'warning',
    category: 'Consent Quality',
    title: 'Reject option may not be equally prominent',
    description: 'GDPR requires consent to be freely given, with reject being as easy as accept',
    check: (data: { consent: ConsentTestResult }) => {
      // This is a heuristic - we can't perfectly detect UI prominence
      // But if accept worked and reject didn't, it might indicate dark patterns
      return data.consent.consentMechanismFound && 
             data.consent.afterAcceptAll.cookies.length > data.consent.afterRejectAll.cookies.length + 5;
    },
    recommendation: 'Ensure "Reject All" button is as prominent and easy to click as "Accept All". Avoid dark patterns.'
  },
  {
    id: 'gdpr-005',
    framework: 'gdpr',
    severity: 'warning',
    category: 'Third-Party Cookies',
    title: 'High number of third-party cookies',
    description: 'Excessive third-party cookies may indicate privacy concerns',
    check: (data: { scan: AggregatedScanResults }) => {
      return data.scan.thirdPartyCookies.length > 10;
    },
    recommendation: 'Review and minimize third-party cookie usage. Ensure all third-party cookies are necessary and properly disclosed.'
  },
  {
    id: 'gdpr-006',
    framework: 'gdpr',
    severity: 'critical',
    category: 'Consent Persistence',
    title: 'Cookies persist after rejection',
    description: 'Non-essential cookies should be removed when user rejects them',
    check: (data: { consent: ConsentTestResult }) => {
      const beforeCount = data.consent.beforeConsent.cookies.length;
      const afterReject = data.consent.afterRejectAll.cookies.length;
      
      // After rejection, cookie count should not increase significantly
      return afterReject > beforeCount + 2;
    },
    recommendation: 'Ensure that when users reject cookies, no additional non-essential cookies are set.'
  },
  {
    id: 'gdpr-007',
    framework: 'gdpr',
    severity: 'info',
    category: 'Cookie Duration',
    title: 'Long-lived cookies detected',
    description: 'Cookies with very long expiration times should be justified',
    check: (data: { scan: AggregatedScanResults }) => {
      const now = Date.now() / 1000;
      const twoYears = 2 * 365 * 24 * 60 * 60;
      
      return data.scan.uniqueCookies.some(c => 
        c.expires && (c.expires - now > twoYears)
      );
    },
    recommendation: 'Review cookies with expiration dates longer than 2 years. Ensure they are necessary and properly justified.'
  }
];

export function checkGDPR(scan: AggregatedScanResults, consent: ConsentTestResult): any[] {
  const violations: any[] = [];
  const analyzer = new CookieAnalyzer();

  for (const rule of gdprRules) {
    const isViolation = rule.check({ scan, consent });

    if (isViolation) {
      const affectedItems: string[] = [];

      // Collect affected items based on rule
      if (rule.id === 'gdpr-001') {
        // Only include non-essential cookies
        const analyses = analyzer.analyzeCookies(consent.beforeConsent.cookies);
        const nonEssential = analyses.filter(a =>
          a.category === 'analytics' || a.category === 'advertising' || a.category === 'social'
        );
        affectedItems.push(...nonEssential.map(a => `${a.cookie.name} (${a.actualVendor})`));
      } else if (rule.id === 'gdpr-002') {
        affectedItems.push(...consent.beforeConsent.scripts
          .filter(s => s.isThirdParty)
          .map(s => s.url)
        );
      } else if (rule.id === 'gdpr-005') {
        affectedItems.push(...scan.thirdPartyCookies.map(c => `${c.name} (${c.domain})`));
      }

      violations.push({
        severity: rule.severity,
        framework: rule.framework,
        category: rule.category,
        title: rule.title,
        description: rule.description,
        affectedItems: affectedItems.slice(0, 10), // Limit to 10 items
        recommendation: rule.recommendation
      });
    }
  }

  return violations;
}
