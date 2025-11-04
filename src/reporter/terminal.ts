import chalk from 'chalk';
import Table from 'cli-table3';
import { ComplianceResults } from '../compliance/types';

export class TerminalReporter {
  /**
   * Display compliance results in terminal
   */
  display(results: ComplianceResults, aiSummary?: any): void {
    console.log('\n' + '='.repeat(80));
    console.log(chalk.bold.blue('  COMPLIANCE SCAN RESULTS'));
    console.log('='.repeat(80) + '\n');

    // AI Summary (if available)
    if (aiSummary) {
      this.displayAISummary(aiSummary);
    }

    // Overall Score
    this.displayOverallScore(results);

    // Framework Scores
    this.displayFrameworkScores(results);

    // Summary Stats
    this.displaySummaryStats(results);

    // Critical Issues
    this.displayCriticalIssues(results);

    // Positive Findings
    this.displayPositiveFindings(results);

    console.log('\n' + '='.repeat(80) + '\n');
  }

  /**
   * Display AI-generated summary
   */
  private displayAISummary(aiSummary: any): void {
    console.log(chalk.bold.cyan('🤖 AI-POWERED COMPLIANCE ASSESSMENT\n'));
    
    console.log(chalk.bold.white('EXECUTIVE SUMMARY'));
    console.log(chalk.white(aiSummary.executiveSummary));
    console.log();
    
    if (aiSummary.cookieSecurityAssessment) {
      console.log(chalk.bold.white('COOKIE SECURITY ASSESSMENT'));
      console.log(chalk.white(aiSummary.cookieSecurityAssessment));
      console.log();
    }
    
    if (aiSummary.preConsentViolations) {
      console.log(chalk.bold.red('PRE-CONSENT TRACKING VIOLATIONS'));
      console.log(chalk.white(aiSummary.preConsentViolations));
      console.log();
    }
    
    if (aiSummary.keyFindings && aiSummary.keyFindings.length > 0) {
      console.log(chalk.bold('Key Findings:'));
      for (const finding of aiSummary.keyFindings) {
        console.log(chalk.blue('  • ') + finding);
      }
      console.log();
    }
    
    if (aiSummary.criticalIssues && aiSummary.criticalIssues.length > 0) {
      console.log(chalk.bold.red('Critical Issues Requiring Immediate Action:'));
      for (const issue of aiSummary.criticalIssues) {
        console.log(chalk.red('  ⚠ ') + issue);
      }
      console.log();
    }
    
    if (aiSummary.recommendations && aiSummary.recommendations.length > 0) {
      console.log(chalk.bold('Priority Recommendations:'));
      for (const rec of aiSummary.recommendations.slice(0, 5)) {
        console.log(chalk.green('  ✓ ') + rec);
      }
      console.log();
    }
    
    if (aiSummary.complianceOutlook) {
      console.log(chalk.bold.yellow('COMPLIANCE OUTLOOK'));
      console.log(chalk.white(aiSummary.complianceOutlook));
      console.log();
    }
    
    console.log('─'.repeat(80) + '\n');
  }

  /**
   * Display overall score with color coding
   */
  private displayOverallScore(results: ComplianceResults): void {
    const score = results.overallScore;
    let scoreColor: any;
    let rating: string;

    if (score >= 90) {
      scoreColor = chalk.green;
      rating = 'Excellent';
    } else if (score >= 75) {
      scoreColor = chalk.blue;
      rating = 'Good';
    } else if (score >= 60) {
      scoreColor = chalk.yellow;
      rating = 'Fair';
    } else {
      scoreColor = chalk.red;
      rating = 'Poor';
    }

    console.log(chalk.bold('Overall Compliance Score: ') + scoreColor.bold(`${score}/100 (${rating})`));
    console.log(chalk.gray(`Scanned: ${results.url}`));
    console.log(chalk.gray(`Date: ${results.timestamp.toLocaleString()}\n`));
  }

  /**
   * Display framework-specific scores
   */
  private displayFrameworkScores(results: ComplianceResults): void {
    const table = new Table({
      head: ['Framework', 'Score', 'Status'],
      colWidths: [20, 15, 20]
    });

    const frameworks = [
      { name: 'GDPR', key: 'gdpr' as const },
      { name: 'CCPA', key: 'ccpa' as const },
      { name: 'ePrivacy', key: 'eprivacy' as const }
    ];

    for (const framework of frameworks) {
      const score = results.frameworkScores[framework.key];
      const status = score >= 75 ? chalk.green('✓ Compliant') : chalk.red('✗ Issues Found');
      table.push([
        framework.name,
        score >= 75 ? chalk.green(score.toString()) : chalk.red(score.toString()),
        status
      ]);
    }

    console.log(table.toString() + '\n');
  }

  /**
   * Display summary statistics
   */
  private displaySummaryStats(results: ComplianceResults): void {
    console.log(chalk.bold('📊 Summary Statistics:\n'));

    const stats = [
      { label: 'Unique Cookies', value: results.details.totalCookies, highlight: false },
      { label: 'Third-Party Cookies', value: results.details.thirdPartyCookies, highlight: results.details.thirdPartyCookies > 5 },
      { label: 'Cookies Before Consent', value: results.details.cookiesBeforeConsent, highlight: results.details.cookiesBeforeConsent > 2 },
      { label: 'Unique Scripts', value: results.details.totalScripts, highlight: false },
      { label: 'Third-Party Scripts', value: results.details.thirdPartyScripts, highlight: results.details.thirdPartyScripts > 5 },
      { label: 'Scripts Before Consent', value: results.details.scriptsBeforeConsent, highlight: results.details.scriptsBeforeConsent > 0 }
    ];

    for (const stat of stats) {
      const valueStr = stat.highlight ? chalk.red(stat.value.toString()) : chalk.blue(stat.value.toString());
      console.log(`  ${stat.label}: ${valueStr}`);
    }

    console.log(`  Consent Mechanism: ${results.details.consentMechanismFound ? chalk.green('✓ Found') : chalk.red('✗ Not Found')}`);
    if (results.details.consentVendor) {
      console.log(`  Consent Vendor: ${chalk.blue(results.details.consentVendor)}`);
    }
    console.log();
  }

  /**
   * Display critical issues
   */
  private displayCriticalIssues(results: ComplianceResults): void {
    const criticalIssues = results.issues.filter(i => i.severity === 'critical');
    const warningIssues = results.issues.filter(i => i.severity === 'warning');

    if (criticalIssues.length > 0) {
      console.log(chalk.bold.red(`❌ Critical Issues (${criticalIssues.length}):\n`));
      
      for (const issue of criticalIssues.slice(0, 5)) {
        console.log(chalk.red('  • ') + chalk.bold(issue.title));
        console.log(chalk.gray(`    ${issue.description}`));
        if (issue.affectedItems.length > 0) {
          console.log(chalk.gray(`    Affected: ${issue.affectedItems.slice(0, 3).join(', ')}${issue.affectedItems.length > 3 ? '...' : ''}`));
        }
        console.log();
      }

      if (criticalIssues.length > 5) {
        console.log(chalk.gray(`  ... and ${criticalIssues.length - 5} more critical issues\n`));
      }
    }

    if (warningIssues.length > 0) {
      console.log(chalk.bold.yellow(`⚠️  Warnings (${warningIssues.length}):\n`));
      
      for (const issue of warningIssues.slice(0, 3)) {
        console.log(chalk.yellow('  • ') + issue.title);
      }

      if (warningIssues.length > 3) {
        console.log(chalk.gray(`  ... and ${warningIssues.length - 3} more warnings`));
      }
      console.log();
    }
  }

  /**
   * Display positive findings
   */
  private displayPositiveFindings(results: ComplianceResults): void {
    const positives: string[] = [];

    if (results.details.consentMechanismFound) {
      positives.push('Consent mechanism detected');
    }

    if (results.details.cookiesBeforeConsent <= 2) {
      positives.push('Minimal cookies before consent');
    }

    if (results.details.thirdPartyCookies < 5) {
      positives.push('Limited third-party cookies');
    }

    if (results.overallScore >= 75) {
      positives.push('Good overall compliance score');
    }

    if (positives.length > 0) {
      console.log(chalk.bold.green('✅ Positive Findings:\n'));
      for (const positive of positives) {
        console.log(chalk.green('  ✓ ') + positive);
      }
      console.log();
    }
  }
}
