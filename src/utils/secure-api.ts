import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import https from "https";
import { URL } from "url";

interface SecureApiConfig {
  baseURL: string;
  apiKey: string;
  timeout?: number;
  maxContentLength?: number;
  maxBodyLength?: number;
  retries?: number;
  retryDelay?: number;
}

interface RateLimiter {
  [key: string]: {
    requests: number;
    resetTime: number;
  };
}

class SecureApiClient {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter = {};
  private readonly maxRequestsPerMinute = 60;
  private readonly retryDelay: number;
  private readonly maxRetries: number;

  constructor(config: SecureApiConfig) {
    this.retryDelay = config.retryDelay || 1000;
    this.maxRetries = config.retries || 3;

    this.validateConfig(config);

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      maxContentLength: config.maxContentLength || 10485760, // 10MB
      maxBodyLength: config.maxBodyLength || 10485760, // 10MB
      headers: {
        "X-Api-Key": config.apiKey,
        "User-Agent": "Requestarr-Bot/1.0",
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
        ciphers: [
          "ECDHE-RSA-AES128-GCM-SHA256",
          "ECDHE-RSA-AES256-GCM-SHA384",
          "ECDHE-RSA-AES128-SHA256",
          "ECDHE-RSA-AES256-SHA384"
        ].join(":"),
        honorCipherOrder: true,
        secureProtocol: "TLS_method",
      }),
      validateStatus: (status) => status >= 200 && status < 300,
    });

    this.setupInterceptors();
  }

  private validateConfig(config: SecureApiConfig): void {
    if (!config.baseURL) {
      throw new Error("Base URL is required");
    }

    const url = new URL(config.baseURL);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Only HTTP and HTTPS URLs are allowed");
    }

    if (!config.apiKey || config.apiKey.length < 10) {
      throw new Error("Valid API key is required");
    }

    if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
      throw new Error("Timeout must be between 1s and 5min");
    }
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        if (!this.checkRateLimit(config.baseURL || "")) {
          throw new Error("Rate limit exceeded");
        }

        if (config.params) {
          config.params = this.sanitizeParams(config.params);
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => {
        this.validateResponse(response);
        return response;
      },
      async (error) => {
        if (error.config && !error.config.__retryCount) {
          error.config.__retryCount = 0;
        }

        const shouldRetry = this.shouldRetry(error);
        if (shouldRetry && error.config.__retryCount < this.maxRetries) {
          error.config.__retryCount++;
          await this.sleep(this.retryDelay * error.config.__retryCount);
          return this.client.request(error.config);
        }

        return Promise.reject(this.sanitizeError(error));
      }
    );
  }

  private checkRateLimit(baseURL: string): boolean {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    if (!this.rateLimiter[baseURL]) {
      this.rateLimiter[baseURL] = { requests: 0, resetTime: now };
    }

    const limiter = this.rateLimiter[baseURL];

    if (now > limiter.resetTime) {
      limiter.requests = 0;
      limiter.resetTime = now + 60000;
    }

    if (limiter.requests >= this.maxRequestsPerMinute) {
      return false;
    }

    limiter.requests++;
    return true;
  }

  private sanitizeParams(params: any): any {
    const sanitized = { ...params };
    
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'string') {
        sanitized[key] = this.sanitizeString(sanitized[key]);
      }
    }

    return sanitized;
  }

  private sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML/XML
      .replace(/javascript:/gi, '') // Remove JS protocol
      .replace(/vbscript:/gi, '') // Remove VBScript protocol
      .replace(/data:/gi, '') // Remove data protocol
      .trim();
  }

  private validateResponse(response: AxiosResponse): void {
    if (!response.headers['content-type']?.includes('application/json')) {
      console.warn('Unexpected content type:', response.headers['content-type']);
    }

    if (response.data && typeof response.data === 'object') {
      this.sanitizeResponseData(response.data);
    }
  }

  private sanitizeResponseData(data: any): void {
    if (Array.isArray(data)) {
      data.forEach(item => this.sanitizeResponseData(item));
    } else if (data && typeof data === 'object') {
      for (const key in data) {
        if (typeof data[key] === 'string') {
          data[key] = this.sanitizeString(data[key]);
        } else if (typeof data[key] === 'object') {
          this.sanitizeResponseData(data[key]);
        }
      }
    }
  }

  private shouldRetry(error: any): boolean {
    if (!error.response) return true; // Network error
    
    const status = error.response.status;
    return status === 429 || status >= 500; // Rate limited or server error
  }

  private sanitizeError(error: any): Error {
    const sanitizedError = new Error(error.message || 'API request failed');
    
    if (error.response) {
      (sanitizedError as any).status = error.response.status;
      (sanitizedError as any).statusText = error.response.statusText;
    }
    
    return sanitizedError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async get(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    return this.client.get(url, config);
  }

  async post(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    return this.client.post(url, data, config);
  }

  async put(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    return this.client.put(url, data, config);
  }

  async delete(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    return this.client.delete(url, config);
  }
}

// Factory function for creating secure API clients
export function createSecureApiClient(config: SecureApiConfig): SecureApiClient {
  return new SecureApiClient(config);
}

// Validation utilities
export function validateEnvironmentVariable(name: string, value: string | undefined, required: boolean = true): string | undefined {
  if (!value || value.trim() === '') {
    if (required) {
      throw new Error(`Environment variable ${name} is required`);
    }
    return undefined;
  }
  
  if (name.includes('TOKEN') || name.includes('KEY')) {
    if (value.length < 10) {
      throw new Error(`Environment variable ${name} appears to be invalid (too short)`);
    }
  }
  
  if (name.includes('URL')) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error(`Environment variable ${name} must use HTTP or HTTPS`);
      }
    } catch {
      throw new Error(`Environment variable ${name} is not a valid URL`);
    }
  }
  
  return value.trim();
}

// Input validation utilities
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    throw new Error('Search query must be a non-empty string');
  }
  
  if (query.length > 200) {
    throw new Error('Search query too long');
  }
  
  return query
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/[^\w\s\-_.:()\[\]]/g, '') // Allow common search characters
    .trim();
}

export function validateTmdbId(id: string): boolean {
  return /^\d{1,8}$/.test(id);
}

export function validateTvdbId(id: string): boolean {
  return /^\d{1,8}$/.test(id);
}