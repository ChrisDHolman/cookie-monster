export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  isThirdParty: boolean;
  foundOnUrl: string;
}

export interface Script {
  url: string;
  type: 'inline' | 'external';
  isThirdParty: boolean;
  foundOnUrl: string;
  content?: string;
  category?: ScriptCategory;
}

export enum ScriptCategory {
  Analytics = 'analytics',
  Advertising = 'advertising',
  Social = 'social',
  Marketing = 'marketing',
  Functional = 'functional',
  Unknown = 'unknown'
}

export interface Request {
  url: string;
  type: string;
  isThirdParty: boolean;
  foundOnUrl: string;
}

export interface ScanResult {
  url: string;
  cookies: Cookie[];
  scripts: Script[];
  requests: Request[];
  timestamp: Date;
}

export interface AggregatedScanResults {
  totalCookies: number;
  totalScripts: number;
  totalRequests: number;
  uniqueCookies: Cookie[];
  uniqueScripts: Script[];
  thirdPartyCookies: Cookie[];
  thirdPartyScripts: Script[];
  scanResults: ScanResult[];
  cookieAnalysis?: any[]; // Will be populated by analyzer
}

export interface ConsentTestResult {
  url: string;
  beforeConsent: {
    cookies: Cookie[];
    scripts: Script[];
    requests: Request[];
  };
  afterAcceptAll: {
    cookies: Cookie[];
    scripts: Script[];
    requests: Request[];
  };
  afterRejectAll: {
    cookies: Cookie[];
    scripts: Script[];
    requests: Request[];
  };
  partialConsent?: {
    [category: string]: {
      cookies: Cookie[];
      scripts: Script[];
      requests: Request[];
    };
  };
  consentMechanismFound: boolean;
  consentVendor?: string;
}
