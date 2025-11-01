import { ComplianceResults, ComplianceIssue } from './types';
import { AggregatedScanResults } from '../scanner/types';
import { ConsentTestResult } from '../scanner/types';
import { checkGDPR } from './gdpr';
import { checkCCPA } from './ccpa';
import { checkEPrivacy } from './eprivacy';
import { logger } from '../utils/logger';

export class ComplianceChecker {
  private frameworks: string[];

  constructor(frameworks: string[]) {
    this.frameworks = frameworks;
  }

  /**
   * Analyze compliance across all frameworks
   */
  analyze(scan: AggregatedScanResults, consent: ConsentTestResult): ComplianceResults {
    logger.info('Running compliance checks...');
    
    const issues: ComplianceIssue[] = [];

    // Run checks for each enabled framework
    if (this.frameworks.includes('gdpr')) {
      const gdprIssues = checkGDPR(scan, consent);
      issues.push(...gdprIssues);
    }

    if (this.frameworks.includes('ccpa')) {
      const ccpaIssues = checkCCPA(scan, consent);
      issues.push(...ccpaIssues);
    }

    if (this.frameworks.includes('eprivacy')) {
      const eprivacyIssues = checkEPrivacy(scan, consent);
      issues.push(...eprivacyIssues);
    }

    // Calculate scores
    const frameworkScores = this.calculateScores(issues);
    const overallScore = this.calculateOverallScore(frameworkScores);

    // Summarize issues
    const summary = {
      totalIssues: issues.length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      warningIssues: issues.filter(i => i.severity === 'warning').length,
      infoIssues: issues.filter(i => i.severity === 'info').length
    };

    logger.info(`Compliance check complete: ${summary.totalIssues} issues found`);

    const results: ComplianceResults = {
      url: consent.url,
      timestamp: new Date(),
      overallScore,
      frameworkScores,
      issues,
      summary,
      details: {
        totalCookies: scan.uniqueCookies.length,  // Use unique count
        thirdPartyCookies: scan.thirdPartyCookies.length,
        cookiesBeforeConsent: consent.beforeConsent.cookies.length,
        totalScripts: scan.uniqueScripts.length,  // Use unique count
        thirdPartyScripts: scan.thirdPartyScripts.length,
        scriptsBeforeConsent: consent.beforeConsent.scripts.length,
        consentMechanismFound: consent.consentMechanismFound,
        consentVendor: consent.consentVendor
      },
      rawData: {
        scanResults: scan,
        consentResults: consent
      }
    };

    logger.info(`Added rawData with ${scan.uniqueCookies.length} cookies and ${scan.uniqueScripts.length} scripts`);
    
    return results;
  }

  /**
   * Calculate scores for each framework
   */
  private calculateScores(issues: ComplianceIssue[]): {
    gdpr: number;
    ccpa: number;
    eprivacy: number;
  } {
    const scores = {
      gdpr: 100,
      ccpa: 100,
      eprivacy: 100
    };

    for (const issue of issues) {
      let penalty = 0;
      
      switch (issue.severity) {
        case 'critical':
          penalty = 25;
          break;
        case 'warning':
          penalty = 10;
          break;
        case 'info':
          penalty = 5;
          break;
      }

      scores[issue.framework] = Math.max(0, scores[issue.framework] - penalty);
    }

    return scores;
  }

  /**
   * Calculate overall compliance score
   */
  private calculateOverallScore(frameworkScores: {
    gdpr: number;
    ccpa: number;
    eprivacy: number;
  }): number {
    const enabledFrameworks = this.frameworks.filter(f => 
      ['gdpr', 'ccpa', 'eprivacy'].includes(f)
    );

    if (enabledFrameworks.length === 0) return 100;

    const sum = enabledFrameworks.reduce((acc, framework) => {
      return acc + frameworkScores[framework as keyof typeof frameworkScores];
    }, 0);

    return Math.round(sum / enabledFrameworks.length);
  }
}
