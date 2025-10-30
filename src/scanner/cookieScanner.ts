import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { PageInfo } from '../spider/types';
import { Cookie, Script, Request, ScanResult, AggregatedScanResults, ScriptCategory } from './types';
import { logger } from '../utils/logger';
import ora from 'ora';

export class CookieScanner {
  private browser: Browser | null = null;
  private knownTrackers = this.loadKnownTrackers();

  /**
   * Scan multiple pages for cookies and scripts
   */
  async scanPages(pages: PageInfo[]): Promise<AggregatedScanResults> {
    const spinner = ora('Scanning pages...').start();
    const scanResults: ScanResult[] = [];

    try {
      await this.init();

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        spinner.text = `Scanning page ${i + 1}/${pages.length}: ${page.url}`;
        
        try {
          const result = await this.scanPage(page.url);
          scanResults.push(result);
        } catch (error) {
          logger.error(`Failed to scan ${page.url}:`, error);
        }
      }

      spinner.succeed(`Scanned ${scanResults.length} pages`);

      return this.aggregateResults(scanResults);

    } finally {
      await this.cleanup();
    }
  }

  /**
   * Scan a single page
   */
  async scanPage(url: string): Promise<ScanResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const context = await this.browser.newContext();
    const page = await context.newPage();

    const cookies: Cookie[] = [];
    const scripts: Script[] = [];
    const requests: Request[] = [];

    try {
      // Listen to all network requests
      page.on('request', (request) => {
        const requestUrl = request.url();
        const resourceType = request.resourceType();
        
        requests.push({
          url: requestUrl,
          type: resourceType,
          isThirdParty: this.isThirdParty(requestUrl, url),
          foundOnUrl: url
        });
      });

      // Navigate to page
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait a bit for dynamic content
      await page.waitForTimeout(2000);

      // Get cookies
      const pageCookies = await context.cookies();
      for (const cookie of pageCookies) {
        cookies.push({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite as 'Strict' | 'Lax' | 'None',
          isThirdParty: this.isThirdParty(cookie.domain, url),
          foundOnUrl: url
        });
      }

      // Get scripts
      const scriptElements = await page.$$('script');
      for (const scriptEl of scriptElements) {
        const src = await scriptEl.getAttribute('src');
        
        if (src) {
          // External script
          const absoluteUrl = new URL(src, url).href;
          scripts.push({
            url: absoluteUrl,
            type: 'external',
            isThirdParty: this.isThirdParty(absoluteUrl, url),
            foundOnUrl: url,
            category: this.categorizeScript(absoluteUrl)
          });
        } else {
          // Inline script
          const content = await scriptEl.textContent();
          if (content && content.trim().length > 0) {
            scripts.push({
              url: url,
              type: 'inline',
              isThirdParty: false,
              foundOnUrl: url,
              content: content.substring(0, 500), // First 500 chars
              category: this.categorizeScript(content)
            });
          }
        }
      }

      logger.info(`Scanned ${url}: ${cookies.length} cookies, ${scripts.length} scripts`);

      return {
        url,
        cookies,
        scripts,
        requests,
        timestamp: new Date()
      };

    } finally {
      await context.close();
    }
  }

  /**
   * Initialize browser
   */
  private async init(): Promise<void> {
    this.browser = await chromium.launch({ 
      headless: true,
      args: ['--disable-blink-features=AutomationControlled']
    });
  }

  /**
   * Cleanup
   */
  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Check if a URL/domain is third-party
   */
  private isThirdParty(urlOrDomain: string, baseUrl: string): boolean {
    try {
      const baseHostname = new URL(baseUrl).hostname;
      let testHostname: string;

      if (urlOrDomain.startsWith('http')) {
        testHostname = new URL(urlOrDomain).hostname;
      } else {
        // It's a domain
        testHostname = urlOrDomain.startsWith('.') ? urlOrDomain.substring(1) : urlOrDomain;
      }

      // Remove www. for comparison
      const baseNormalized = baseHostname.replace(/^www\./, '');
      const testNormalized = testHostname.replace(/^www\./, '');

      return !testNormalized.endsWith(baseNormalized);
    } catch {
      return false;
    }
  }

  /**
   * Categorize script based on URL or content
   */
  private categorizeScript(urlOrContent: string): ScriptCategory {
    const content = urlOrContent.toLowerCase();

    // Check against known trackers
    for (const [category, patterns] of Object.entries(this.knownTrackers)) {
      for (const pattern of patterns) {
        if (content.includes(pattern)) {
          return category as ScriptCategory;
        }
      }
    }

    return ScriptCategory.Unknown;
  }

  /**
   * Load known tracker patterns
   */
  private loadKnownTrackers(): Record<string, string[]> {
    return {
      analytics: [
        'google-analytics.com',
        'googletagmanager.com',
        'analytics.js',
        'ga.js',
        'gtag',
        'matomo',
        'piwik',
        'mixpanel'
      ],
      advertising: [
        'doubleclick.net',
        'googlesyndication.com',
        'adservice',
        'adsystem',
        'advertising',
        'criteo',
        'outbrain',
        'taboola'
      ],
      social: [
        'facebook.com/tr',
        'facebook.net',
        'connect.facebook',
        'twitter.com/i',
        'linkedin.com/px',
        'snapchat.com/p',
        'pinterest.com/ct'
      ],
      marketing: [
        'hubspot',
        'marketo',
        'mailchimp',
        'pardot',
        'eloqua'
      ]
    };
  }

  /**
   * Aggregate results from multiple pages
   */
  private aggregateResults(scanResults: ScanResult[]): AggregatedScanResults {
    const allCookies: Cookie[] = [];
    const allScripts: Script[] = [];
    const allRequests: Request[] = [];

    for (const result of scanResults) {
      allCookies.push(...result.cookies);
      allScripts.push(...result.scripts);
      allRequests.push(...result.requests);
    }

    // Deduplicate cookies by name and domain
    const uniqueCookies = this.deduplicateCookies(allCookies);
    
    // Deduplicate scripts by URL
    const uniqueScripts = this.deduplicateScripts(allScripts);

    return {
      totalCookies: allCookies.length,
      totalScripts: allScripts.length,
      totalRequests: allRequests.length,
      uniqueCookies,
      uniqueScripts,
      thirdPartyCookies: uniqueCookies.filter(c => c.isThirdParty),
      thirdPartyScripts: uniqueScripts.filter(s => s.isThirdParty),
      scanResults
    };
  }

  /**
   * Deduplicate cookies
   */
  private deduplicateCookies(cookies: Cookie[]): Cookie[] {
    const seen = new Map<string, Cookie>();
    
    for (const cookie of cookies) {
      const key = `${cookie.name}-${cookie.domain}`;
      if (!seen.has(key)) {
        seen.set(key, cookie);
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * Deduplicate scripts
   */
  private deduplicateScripts(scripts: Script[]): Script[] {
    const seen = new Map<string, Script>();
    
    for (const script of scripts) {
      if (!seen.has(script.url)) {
        seen.set(script.url, script);
      }
    }
    
    return Array.from(seen.values());
  }
}
