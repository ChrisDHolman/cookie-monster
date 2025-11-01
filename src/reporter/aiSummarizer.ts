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
      logger.info('Starting AI summary generation...');

      const prompt = this.buildPrompt(results);
      logger.info('Prompt built, calling Claude API...');
      
      const response = await this.callClaudeAPI(prompt);
      logger.info('API response received, parsing...');
      
      const parsed = this.parseResponse(response);
      logger.info('AI summary generated successfully');
      
      return parsed;
    } catch (error) {
      logger.error('Failed to generate AI summary:', error);
      logger.error('Error details:', error instanceof Error ? error.message : String(error));
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

    // Get cookies loaded before consent with details
    const cookiesBeforeConsent = consentResults?.beforeConsent.cookies.map((c: any) => {
      const analysis = cookieAnalysis.find((a: any) => a.cookie.name === c.name);
      return {
        name: c.name,
        vendor: analysis?.actualVendor || c.domain,
        purpose: analysis?.purpose || 'Unknown',
        risk: analysis?.riskLevel || 'unknown',
        isThirdParty: analysis?.isActuallyThirdParty || c.isThirdParty
      };
    }) || [];

    const highRiskBeforeConsent = cookiesBeforeConsent.filter((c: any) => 
      c.risk === 'critical' || c.risk === 'high'
    );

    // Get scripts loaded before consent
    const scriptsBeforeConsent = consentResults?.beforeConsent.scripts
      .filter((s: any) => s.isThirdParty)
      .map((s: any) => s.url) || [];

    return `You are a privacy and compliance expert conducting a detailed risk assessment. Analyze this website's tracking and cookie implementation with specific focus on compliance violations and privacy risks.

WEBSITE: ${results.url}
SCAN DATE: ${results.timestamp.toLocaleString()}

═══════════════════════════════════════════════════════════════════════════════
COMPLIANCE SCORES & FRAMEWORK ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
Overall Score: ${results.overallScore}/100
- GDPR: ${results.frameworkScores.gdpr}/100
- CCPA: ${results.frameworkScores.ccpa}/100  
- ePrivacy: ${results.frameworkScores.eprivacy}/100

═══════════════════════════════════════════════════════════════════════════════
CRITICAL PRE-CONSENT VIOLATIONS
═══════════════════════════════════════════════════════════════════════════════
Cookies Set BEFORE User Consent: ${results.details.cookiesBeforeConsent}
Scripts Loading BEFORE Consent: ${results.details.scriptsBeforeConsent}

HIGH-RISK COOKIES LOADING BEFORE CONSENT:
${highRiskBeforeConsent.length > 0 ? highRiskBeforeConsent.map((c: any) => 
  `- ${c.name} (${c.vendor}) - ${c.purpose} - Risk: ${c.risk.toUpperCase()}`
).join('\n') : 'None identified'}

TRACKING SCRIPTS LOADING BEFORE CONSENT:
${scriptsBeforeConsent.length > 0 ? scriptsBeforeConsent.slice(0, 10).map((s: any) => `- ${s}`).join('\n') : 'None'}

═══════════════════════════════════════════════════════════════════════════════
COOKIE RISK ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
Total Unique Cookies: ${results.rawData?.scanResults.uniqueCookies.length || 0}
Third-Party Cookies: ${results.rawData?.scanResults.thirdPartyCookies.length || 0}

Risk Distribution:
- Critical Risk: ${riskCounts.critical} cookies
- High Risk: ${riskCounts.high} cookies
- Medium Risk: ${riskCounts.medium} cookies
- Low Risk: ${riskCounts.low} cookies

═══════════════════════════════════════════════════════════════════════════════
THIRD-PARTY VENDOR ECOSYSTEM
═══════════════════════════════════════════════════════════════════════════════
${topVendors.join('\n')}

═══════════════════════════════════════════════════════════════════════════════
CONSENT MECHANISM ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
Consent UI Present: ${results.details.consentMechanismFound ? 'Yes' : 'No'}
Consent Vendor: ${results.details.consentVendor || 'Unknown'}
Cookies After Accept: ${consentResults?.afterAcceptAll.cookies.length || 0}
Cookies After Reject: ${consentResults?.afterRejectAll.cookies.length || 0}

═══════════════════════════════════════════════════════════════════════════════
IDENTIFIED COMPLIANCE VIOLATIONS
═══════════════════════════════════════════════════════════════════════════════
Total Issues: ${results.summary.totalIssues}
- Critical: ${results.summary.criticalIssues}
- Warnings: ${results.summary.warningIssues}
- Info: ${results.summary.infoIssues}

TOP VIOLATIONS:
${results.issues.slice(0, 8).map(i => `[${i.severity.toUpperCase()}] ${i.title} (${i.framework.toUpperCase()})`).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
ANALYSIS REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

Provide a DETAILED, SPECIFIC analysis covering:

1. **Executive Summary**: 
   - What are the 2-3 MOST CRITICAL privacy/compliance problems?
   - What is the actual legal/financial risk exposure?
   - Use specific numbers and vendor names from the data above

2. **Key Findings** (5-7 bullets):
   - Focus on SPECIFIC violations with REAL impact
   - Name actual vendors and their purposes (e.g., "Microsoft Clarity for session recording")
   - Quantify the problems (e.g., "15 high-risk tracking cookies load before consent")
   - Explain WHY each finding matters for compliance

3. **Critical Issues** (3-5 bullets):
   - The MOST URGENT problems requiring immediate action
   - Be specific about what's wrong and what law it violates
   - Focus on pre-consent tracking and high-risk cookies
   - Explain the enforcement/penalty risk

4. **Recommendations** (5-7 bullets):
   - ACTIONABLE, SPECIFIC steps (not generic advice)
   - Prioritized by impact and urgency
   - Include technical implementation suggestions
   - Address the specific vendors and cookies identified above

5. **Compliance Outlook**:
   - Clear verdict: compliant, non-compliant, or partially compliant
   - Specific legal risks under GDPR (€20M/4% revenue), CCPA ($7,500 per violation)
   - Timeline for remediation

CRITICAL INSTRUCTIONS:
- Do NOT repeat generic compliance advice
- Do NOT just restate the numbers - ANALYZE what they mean
- DO name specific vendors and explain their risks
- DO explain the actual privacy implications
- DO prioritize based on legal/financial risk
- Use the actual data provided - reference specific cookies, vendors, and violations
- Be direct about violations - this is a technical compliance report

Return ONLY valid JSON (no markdown, no code fences):
{
  "executiveSummary": "2-3 sentences with SPECIFIC issues and risks from THIS scan",
  "keyFindings": [
    "5-7 specific, data-driven findings with actual vendor names and numbers"
  ],
  "criticalIssues": [
    "3-5 urgent problems with specific legal/technical details"
  ],
  "recommendations": [
    "5-7 actionable steps with technical specifics, prioritized by impact"
  ],
  "complianceOutlook": "2-3 sentences on legal risk, compliance status, and urgency"
}`;
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

    const data: any = await response.json();
    
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
    logger.info('Using fallback summary');
    
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
