import { FrameworkRule } from './types';
import { ConsentTestResult } from '../scanner/types';
import { AggregatedScanResults } from '../scanner/types';

export const eprivacyRules: FrameworkRule[] = [
  {
    id: 'eprivacy-001',
    framework: 'eprivacy',
    severity: 'critical',
    category: 'Cookie Consent',
    title: 'Non-essential cookies set before consent',
    description: 'ePrivacy Directive requires consent before setting non-essential cookies',
    check: (data: { consent: ConsentTestResult }) => {
      // Similar to GDPR but specifically focuses on the cookie aspect
      return data.consent.beforeConsent.cookies.length > 2;
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
      // If many cookies are set before consent, some might be wrongly classified
      return data.consent.beforeConsent.cookies.length > 5;
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
  
  for (const rule of eprivacyRules) {
    const isViolation = rule.check({ scan, consent });
    
    if (isViolation) {
      const affectedItems: string[] = [];
      
      if (rule.id === 'eprivacy-001' || rule.id === 'eprivacy-003') {
        affectedItems.push(...consent.beforeConsent.cookies.map(c => c.name));
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
