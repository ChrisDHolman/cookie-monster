import { ComplianceResults } from '../compliance/types';
import { logger } from '../utils/logger';

export interface AISummary {
  executiveSummary: string;
  keyFindings: string[];
  criticalIssues: string[];
  recommendations: string[];
  complianceOutlook: string;
}

export class AISummarizer {
  /**
   * Generate AI-powered summary of compliance scan
   */
  async generateSummary(results: ComplianceResults): Promise<AISummary> {
    try {
      logger.info('Generating AI summary...');

      const prompt = this.buildPrompt(results);
      const response = await this.callClaudeAPI(prompt);
      
      return this.parseResponse(response);
    } catch (error) {
      logger.error('Failed to generate AI summary:', error);
      return this.getFallbackSummary(results);
    }
  }

  /**
   * Build detailed prompt for Claude
   */
  private buildPrompt(results: ComplianceResults): string {
    const cookieAnalysis = results.rawData?.scanResults.cookieAnalysis || [];
    const consentResults = results.rawData?.consentResults;
    
    // Count risk levels
    const riskCounts = {
      critical: cookieAnalysis.filter((a: any) => a.riskLevel === 'critical').length,
      high: cookieAnalysis.filter((a: any) => a.riskLevel === 'high').length,
      medium: cookieAnalysis.filter((a: any) => a.riskLevel === 'medium').length,
      low: cookieAnalysis.filter((a: any) => a.riskLevel === 'low').length
    };

    // Get top vendors
    const vendorCounts = new Map<string, number>();
    cookieAnalysis.forEach((a: any) => {
      const count = vendorCounts.get(a.actualVendor) || 0;
      vendorCounts.set(a.actualVendor, count + 1);
    });
    const topVendors = Array.from(vendorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([vendor, count]) => `${vendor} (${count} cookies)`);

    return `You are a privacy compliance expert analyzing a website's cookie and tracking compliance scan. Provide a professional, actionable executive summary.

SCAN RESULTS FOR: ${results.url}
Scan Date: ${results.timestamp.toLocaleString()}

COMPLIANCE SCORES:
- Overall Score: ${results.overallScore}/100
- GDPR: ${results.frameworkScores.gdpr}/100
- CCPA: ${results.frameworkScores.ccpa}/100
- ePrivacy: ${results.frameworkScores.eprivacy}/100

COOKIE ANALYSIS:
- Total Unique Cookies: ${results.rawData?.scanResults.uniqueCookies.length || 0}
- Third-Party Cookies: ${results.rawData?.scanResults.thirdPartyCookies.length || 0}
- Cookies Before Consent: ${results.details.cookiesBeforeConsent}
- Cookies After Accept: ${consentResults?.afterAcceptAll.cookies.length || 0}

COOKIE RISK BREAKDOWN:
- Critical Risk: ${riskCounts.critical}
- High Risk: ${riskCounts.high}
- Medium Risk: ${riskCounts.medium}
- Low Risk: ${riskCounts.low}

TOP THIRD-PARTY VENDORS:
${topVendors.join('\n')}

TRACKING SCRIPTS:
- Total Scripts: ${results.details.totalScripts}
- Third-Party Scripts: ${results.details.thirdPartyScripts}
- Scripts Before Consent: ${results.details.scriptsBeforeConsent}

CONSENT MECHANISM:
- Found: ${results.details.consentMechanismFound ? 'Yes' : 'No'}
- Vendor: ${results.details.consentVendor || 'Unknown'}

COMPLIANCE ISSUES:
- Total Issues: ${results.summary.totalIssues}
- Critical: ${results.summary.criticalIssues}
- Warnings: ${results.summary.warningIssues}
- Info: ${results.summary.infoIssues}

TOP ISSUES:
${results.issues.slice(0, 5).map(i => `- [${i.severity.toUpperCase()}] ${i.title}`).join('\n')}

Please provide a response in this EXACT JSON format (no markdown, just raw JSON):
{
  "executiveSummary": "2-3 sentence high-level summary of the site's compliance posture",
  "keyFindings": [
    "3-5 bullet points of the most important discoveries"
  ],
  "criticalIssues": [
    "List the most critical compliance problems that need immediate attention"
  ],
  "recommendations": [
    "3-5 specific, actionable recommendations prioritized by impact"
  ],
  "complianceOutlook": "1-2 sentences on whether this site is compliant and what the main risks are"
}

Focus on:
1. Privacy law violations (GDPR, CCPA, ePrivacy)
2. High-risk tracking before consent
3. Vendor transparency issues
4. Security concerns
5. User consent effectiveness

Be direct, professional, and actionable. Use business language suitable for executives.`;
  }

  /**
   * Call Claude API
   */
  private async callClaudeAPI(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract text from response
    const text = data.content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text)
      .join('\n');

    return text;
  }

  /**
   * Parse Claude's response
   */
  private parseResponse(response: string): AISummary {
    try {
      // Remove any markdown code fences if present
      let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const parsed = JSON.parse(cleaned);
      return {
        executiveSummary: parsed.executiveSummary || '',
        keyFindings: parsed.keyFindings || [],
        criticalIssues: parsed.criticalIssues || [],
        recommendations: parsed.recommendations || [],
        complianceOutlook: parsed.complianceOutlook || ''
      };
    } catch (error) {
      logger.error('Failed to parse AI response:', error);
      logger.debug('Raw response:', response);
      throw error;
    }
  }

  /**
   * Fallback summary if AI fails
   */
  private getFallbackSummary(results: ComplianceResults): AISummary {
    const score = results.overallScore;
    let outlook = 'Good';
    if (score < 60) outlook = 'Poor';
    else if (score < 75) outlook = 'Fair';
    else if (score < 90) outlook = 'Good';
    else outlook = 'Excellent';

    return {
      executiveSummary: `This website received a compliance score of ${score}/100 (${outlook}). ${results.summary.criticalIssues} critical issues and ${results.summary.warningIssues} warnings were identified across GDPR, CCPA, and ePrivacy frameworks.`,
      keyFindings: [
        `${results.details.totalCookies} cookies found (${results.details.thirdPartyCookies} third-party)`,
        `${results.details.cookiesBeforeConsent} cookies set before user consent`,
        `${results.details.totalScripts} scripts detected (${results.details.thirdPartyScripts} third-party)`,
        `Consent mechanism: ${results.details.consentMechanismFound ? 'Present' : 'Not found'}`
      ],
      criticalIssues: results.issues
        .filter(i => i.severity === 'critical')
        .slice(0, 3)
        .map(i => i.title),
      recommendations: [
        'Review and minimize cookies set before consent',
        'Ensure all third-party trackers are properly disclosed',
        'Implement or improve cookie consent mechanism',
        'Audit high-risk cookies for compliance'
      ],
      complianceOutlook: `Overall compliance: ${outlook}. ${results.summary.criticalIssues > 0 ? 'Immediate action required on critical issues.' : 'Minor improvements recommended.'}`
    };
  }
}
