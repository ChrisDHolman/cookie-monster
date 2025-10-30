import { FrameworkRule } from './types';
import { ConsentTestResult } from '../scanner/types';
import { AggregatedScanResults } from '../scanner/types';

export const ccpaRules: FrameworkRule[] = [
  {
    id: 'ccpa-001',
    framework: 'ccpa',
    severity: 'warning',
    category: 'Data Selling',
    title: 'Potential data selling without opt-out',
    description: 'CCPA requires a "Do Not Sell My Personal Information" link if data is sold',
    check: (data: { scan: AggregatedScanResults }) => {
      // If there are advertising/tracking scripts, they may be selling data
      const adScripts = data.scan.uniqueScripts.filter(s => 
        s.category === 'advertising' || 
        s.url.includes('doubleclick') ||
        s.url.includes('adsystem')
      );
      return adScripts.length > 0;
    },
    recommendation: 'If you sell personal information, provide a clear "Do Not Sell My Personal Information" link. Implement opt-out functionality for California residents.'
  },
  {
    id: 'ccpa-002',
    framework: 'ccpa',
    severity: 'warning',
    category: 'Third-Party Disclosure',
    title: 'Multiple third-party trackers detected',
    description: 'CCPA requires disclosure of personal information shared with third parties',
    check: (data: { scan: AggregatedScanResults }) => {
      return data.scan.thirdPartyScripts.length > 5;
    },
    recommendation: 'Disclose all third parties that receive personal information in your privacy policy. Ensure users can opt-out of this data sharing.'
  },
  {
    id: 'ccpa-003',
    framework: 'ccpa',
    severity: 'info',
    category: 'Consumer Rights',
    title: 'Ensure deletion and access rights are implemented',
    description: 'CCPA grants consumers rights to access and delete their data',
    check: (data: { scan: AggregatedScanResults }) => {
      // If cookies are present, there's likely data collection
      return data.scan.uniqueCookies.length > 3;
    },
    recommendation: 'Implement mechanisms for users to request access to and deletion of their personal information.'
  },
  {
    id: 'ccpa-004',
    framework: 'ccpa',
    severity: 'warning',
    category: 'Cross-Device Tracking',
    title: 'Fingerprinting or cross-device tracking detected',
    description: 'CCPA requires disclosure of cross-device tracking practices',
    check: (data: { scan: AggregatedScanResults }) => {
      const fingerprintingIndicators = data.scan.uniqueScripts.filter(s =>
        s.url.includes('fingerprint') ||
        s.url.includes('device') ||
        s.content?.includes('canvas') ||
        s.content?.includes('webgl')
      );
      return fingerprintingIndicators.length > 0;
    },
    recommendation: 'Disclose any fingerprinting or cross-device tracking in your privacy policy. Allow users to opt-out.'
  }
];

export function checkCCPA(scan: AggregatedScanResults, consent: ConsentTestResult): any[] {
  const violations: any[] = [];
  
  for (const rule of ccpaRules) {
    const isViolation = rule.check({ scan, consent });
    
    if (isViolation) {
      const affectedItems: string[] = [];
      
      if (rule.id === 'ccpa-001') {
        affectedItems.push(...scan.uniqueScripts
          .filter(s => s.category === 'advertising')
          .map(s => s.url)
        );
      } else if (rule.id === 'ccpa-002') {
        affectedItems.push(...scan.thirdPartyScripts.map(s => s.url));
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
