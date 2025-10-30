export interface ComplianceIssue {
  severity: 'critical' | 'warning' | 'info';
  framework: 'gdpr' | 'ccpa' | 'eprivacy';
  category: string;
  title: string;
  description: string;
  affectedItems: string[];
  recommendation: string;
}

export interface ComplianceResults {
  url: string;
  timestamp: Date;
  overallScore: number; // 0-100
  frameworkScores: {
    gdpr: number;
    ccpa: number;
    eprivacy: number;
  };
  issues: ComplianceIssue[];
  summary: {
    totalIssues: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
  };
  details: {
    totalCookies: number;
    thirdPartyCookies: number;
    cookiesBeforeConsent: number;
    totalScripts: number;
    thirdPartyScripts: number;
    scriptsBeforeConsent: number;
    consentMechanismFound: boolean;
    consentVendor?: string;
  };
  rawData?: {
    scanResults: any;
    consentResults: any;
  };
}

export interface FrameworkRule {
  id: string;
  framework: 'gdpr' | 'ccpa' | 'eprivacy';
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  check: (data: any) => boolean;
  recommendation: string;
}
