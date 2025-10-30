export interface CrawlConfig {
  url: string;
  maxDepth: number;
  maxPages: number;
  headless: boolean;
  delay: number;
  outputDir: string;
  frameworks: string[];
}

export interface PageInfo {
  url: string;
  depth: number;
  title: string;
  statusCode: number;
  timestamp: Date;
}

export interface UrlQueueItem {
  url: string;
  depth: number;
  parentUrl?: string;
}

export interface CrawlResult {
  pages: PageInfo[];
  totalPages: number;
  errors: CrawlError[];
}

export interface CrawlError {
  url: string;
  error: string;
  timestamp: Date;
}
