import { FrameworkRule } from './types';
import { ConsentTestResult } from '../scanner/types';
import { AggregatedScanResults } from '../scanner/types';
import { CookieAnalyzer } from '../scanner/cookieAnalyzer';

export const eprivacyRules: FrameworkRule[] = [
  {
    id: 'eprivacy-001',
    framework: 'eprivacy',
    severity: 'critical',
    category: 'Cookie Consent',
    title: 'Non-essential cookies set before consent',
    description: 'ePrivacy Directive requires consent before setting non-essential cookies',
    check: (data: { consent: ConsentTestResult }) => {
      const analyzer = new CookieAnalyzer();
      const analyses = analyzer.analyzeCookies(data.consent.beforeConsent.cookies);

      // Only flag cookies that are analytics, advertising, or social
      // Exclude necessary and functional cookies
      const nonEssentialCookies = analyses.filter(a =>
        a.category === 'analytics' || a.category === 'advertising' || a.category === 'social'
      );

      return nonEssentialCookies.length > 0;
    },
    recommendation: 'Only set strictly necessary cookies before obtaining user consent. All other cookies require prior consent.'
  },
  {
    id: 'eprivacy-002',
    framework: 'eprivacy',
    severity: 'critical',
    category: 'Tracking',
    title: 'Tracking technologies active before consent',
    description: 'ePrivacy requires consent before using tracking technologies',
    check: (data: { consent: ConsentTestResult }) => {
      const trackingRequests = data.consent.beforeConsent.requests.filter(r =>
        r.url.includes('analytics') ||
        r.url.includes('tracking') ||
        r.url.includes('pixel') ||
        r.url.includes('collect')
      );
      return trackingRequests.length > 0;
    },
    recommendation: 'Disable all tracking technologies until user provides explicit consent.'
  },
  {
    id: 'eprivacy-003',
    framework: 'eprivacy',
    severity: 'warning',
    category: 'Strictly Necessary',
    title: 'Potential over-classification of strictly necessary cookies',
    description: 'Only cookies essential for site functionality can be exempt from consent',
    check: (data: { consent: ConsentTestResult }) => {
      const analyzer = new CookieAnalyzer();
      const analyses = analyzer.analyzeCookies(data.consent.beforeConsent.cookies);

      // Flag if there are many "unknown" category cookies being set before consent
      // These might be wrongly classified as necessary
      const unknownCookies = analyses.filter(a =>
        a.category === 'unknown' && !a.actualVendor.toLowerCase().includes('consent')
      );

      return unknownCookies.length > 3;
    },
    recommendation: 'Review cookies set before consent. Only authentication, session, and load-balancing cookies qualify as strictly necessary.'
  },
  {
    id: 'eprivacy-004',
    framework: 'eprivacy',
    severity: 'info',
    category: 'Clear Information',
    title: 'Ensure cookie information is clear and comprehensive',
    description: 'ePrivacy requires clear information about cookie usage',
    check: (data: { scan: AggregatedScanResults }) => {
      // If there are many cookies, information should be comprehensive
      return data.scan.uniqueCookies.length > 10;
    },
    recommendation: 'Provide detailed information about each cookie: name, purpose, duration, and whether it is first-party or third-party.'
  },
  {
    id: 'eprivacy-005',
    framework: 'eprivacy',
    severity: 'critical',
    category: 'Consent Withdrawal',
    title: 'Verify easy consent withdrawal mechanism',
    description: 'Users must be able to withdraw consent as easily as they gave it',
    check: (data: { consent: ConsentTestResult }) => {
      // If consent mechanism exists but reject didn't work well
      return data.consent.consentMechanismFound && 
             data.consent.afterRejectAll.cookies.length > data.consent.beforeConsent.cookies.length;
    },
    recommendation: 'Implement an easy-to-use mechanism for users to withdraw their consent at any time.'
  }
];

export function checkEPrivacy(scan: AggregatedScanResults, consent: ConsentTestResult): any[] {
  const violations: any[] = [];
  const analyzer = new CookieAnalyzer();

  for (const rule of eprivacyRules) {
    const isViolation = rule.check({ scan, consent });

    if (isViolation) {
      const affectedItems: string[] = [];

      if (rule.id === 'eprivacy-001') {
        // Only include non-essential cookies
        const analyses = analyzer.analyzeCookies(consent.beforeConsent.cookies);
        const nonEssential = analyses.filter(a =>
          a.category === 'analytics' || a.category === 'advertising' || a.category === 'social'
        );
        affectedItems.push(...nonEssential.map(a => `${a.cookie.name} (${a.actualVendor})`));
      } else if (rule.id === 'eprivacy-003') {
        // Only include unknown category cookies (potential misclassification)
        const analyses = analyzer.analyzeCookies(consent.beforeConsent.cookies);
        const unknownCookies = analyses.filter(a =>
          a.category === 'unknown' && !a.actualVendor.toLowerCase().includes('consent')
        );
        affectedItems.push(...unknownCookies.map(a => a.cookie.name));
      } else if (rule.id === 'eprivacy-002') {
        affectedItems.push(...consent.beforeConsent.requests
          .filter(r => r.url.includes('tracking') || r.url.includes('analytics'))
          .map(r => r.url)
        );
      }

      violations.push({
        severity: rule.severity,
        framework: rule.framework,
        category: rule.category,
        title: rule.title,
        description: rule.description,
        affectedItems: affectedItems.slice(0, 10),
        recommendation: rule.recommendation
      });
    }
  }

  return violations;
}
