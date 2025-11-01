#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { Crawler } from './spider/crawler';
import { CookieScanner } from './scanner/cookieScanner';
import { ConsentTester } from './scanner/consentTester';
import { ComplianceChecker } from './compliance/rules';
import { TerminalReporter } from './reporter/terminal';
import { HtmlReporter } from './reporter/htmlReport';
import { AISummarizer } from './reporter/aiSummarizer';
import { logger } from './utils/logger';

const program = new Command();

program
  .name('compliance-scan')
  .description('Web compliance scanner for GDPR, CCPA, and ePrivacy')
  .version('1.0.0');

program
  .command('scan')
  .description('Scan a website for compliance issues')
  .argument('<url>', 'URL to scan')
  .option('-d, --depth <number>', 'Maximum crawl depth', '3')
  .option('-m, --max-pages <number>', 'Maximum pages to crawl', '100')
  .option('-o, --output <path>', 'Output directory for reports', './reports')
  .option('--no-headless', 'Run browser in headed mode (visible)')
  .option('--delay <ms>', 'Delay between requests in ms', '1000')
  .option('--frameworks <list>', 'Comma-separated compliance frameworks (gdpr,ccpa,eprivacy)', 'gdpr,ccpa,eprivacy')
  .action(async (url: string, options) => {
    try {
      console.log(chalk.blue.bold('\n🔍 Web Compliance Scanner\n'));
      
      // Validate URL
      const targetUrl = new URL(url);
      logger.info(`Starting scan for: ${targetUrl.href}`);
      
      const config = {
        url: targetUrl.href,
        maxDepth: parseInt(options.depth),
        maxPages: parseInt(options.maxPages),
        headless: options.headless,
        delay: parseInt(options.delay),
        outputDir: options.output,
        frameworks: options.frameworks.split(',').map((f: string) => f.trim())
      };

      // Initialize components
      const crawler = new Crawler(config);
      const cookieScanner = new CookieScanner();
      const consentTester = new ConsentTester();
      const complianceChecker = new ComplianceChecker(config.frameworks);
      
      // Phase 1: Crawl the site
      console.log(chalk.cyan('📄 Crawling website...'));
      const pages = await crawler.crawl();
      console.log(chalk.green(`✓ Found ${pages.length} pages\n`));
      
      // Phase 2: Scan for cookies and scripts
      console.log(chalk.cyan('🍪 Scanning for cookies and scripts...'));
      const scanResults = await cookieScanner.scanPages(pages);
      console.log(chalk.green(`✓ Found ${scanResults.totalCookies} cookies, ${scanResults.totalScripts} scripts\n`));
      
      // Phase 3: Test consent mechanisms
      console.log(chalk.cyan('✅ Testing consent mechanisms...'));
      const consentResults = await consentTester.testConsent(targetUrl.href);
      console.log(chalk.green(`✓ Consent testing complete\n`));
      
      // Phase 4: Check compliance
      console.log(chalk.cyan('⚖️  Analyzing compliance...'));
      const complianceResults = complianceChecker.analyze(scanResults, consentResults);
      console.log(chalk.green(`✓ Compliance analysis complete\n`));
      
      // Phase 5: Generate AI summary (always)
      console.log(chalk.cyan('🤖 Generating AI-powered summary...'));
      const summarizer = new AISummarizer();
      let aiSummary = null;
      try {
        aiSummary = await summarizer.generateSummary(complianceResults);
        console.log(chalk.green(`✓ AI summary generated\n`));
      } catch (error) {
        console.log(chalk.yellow(`⚠️  AI summary unavailable (continuing without it)\n`));
        logger.warn('AI summary generation failed:', error);
      }
      
      // Phase 6: Generate reports
      const terminalReporter = new TerminalReporter();
      terminalReporter.display(complianceResults, aiSummary);
      
      const htmlReporter = new HtmlReporter(config.outputDir);
      const reportPath = await htmlReporter.generate(complianceResults, targetUrl.href, aiSummary);
      
      console.log(chalk.blue(`\n📊 Full report saved to: ${reportPath}\n`));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Error during scan:'));
      console.error(error);
      logger.error('Scan failed', error);
      process.exit(1);
    }
  });

program.parse();
