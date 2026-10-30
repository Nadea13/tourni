const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8080/api/v1';
  }
  return 'https://leagueflow-v80x.onrender.com/api/v1';
};

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url?: string | null;
  phone?: string | null;
}

interface RequestOptions extends RequestInit {
  token?: string;
}

export class ApiClient {
  private static token: string | null = null;
  private static cachedProfile: UserProfile | null = null;
  private static profileFetchedAt: number = 0;
  private static profilePromise: Promise<UserProfile> | null = null;
  private static readonly PROFILE_CACHE_TTL = 3 * 60 * 1000; // 3 minutes cache

  public static setToken(token: string | null) {
    this.token = token;
    this.clearProfileCache();
    if (typeof window !== 'undefined') {
      const isHttps = window.location.protocol === 'https:';
      const secureFlag = isHttps ? '; Secure' : '';
      if (token) {
        localStorage.setItem('tourni_access_token', token);
        // Set cookie so Next.js Middleware can read auth state
        document.cookie = `tourni_access_token=${token}; path=/; max-age=604800; SameSite=Lax${secureFlag}`;
      } else {
        localStorage.removeItem('tourni_access_token');
        document.cookie = `tourni_access_token=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
      }
    }
  }

  public static clearProfileCache(): void {
    this.cachedProfile = null;
    this.profileFetchedAt = 0;
    this.profilePromise = null;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('leagueflow_user_profile');
      } catch {
        // Ignore storage exceptions
      }
    }
  }

  public static getCachedProfile(): UserProfile | null {
    if (this.cachedProfile) {
      return this.cachedProfile;
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('leagueflow_user_profile');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.profile && Date.now() - (parsed.timestamp || 0) < this.PROFILE_CACHE_TTL) {
            this.cachedProfile = parsed.profile;
            this.profileFetchedAt = parsed.timestamp;
            return parsed.profile;
          }
        }
      } catch {
        // Ignore storage parse exceptions
      }
    }
    return null;
  }

  public static async getUserProfile(forceRefresh = false): Promise<UserProfile> {
    const now = Date.now();

    // 1. Return in-memory cache if fresh
    if (!forceRefresh && this.cachedProfile && now - this.profileFetchedAt < this.PROFILE_CACHE_TTL) {
      return this.cachedProfile;
    }

    // 2. Fallback check sessionStorage
    if (!forceRefresh && typeof window !== 'undefined' && !this.cachedProfile) {
      const stored = this.getCachedProfile();
      if (stored) return stored;
    }

    // 3. Deduplicate in-flight network request
    if (this.profilePromise) {
      return this.profilePromise;
    }

    this.profilePromise = this.fetch<UserProfile>('/auth/me')
      .then((profile) => {
        this.cachedProfile = profile;
        this.profileFetchedAt = Date.now();
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(
              'leagueflow_user_profile',
              JSON.stringify({
                profile,
                timestamp: this.profileFetchedAt,
              })
            );
          } catch {
            // Storage quota safe
          }
        }
        return profile;
      })
      .catch((err) => {
        // If Rate Limited (429) or network issue, fallback to cached profile if available
        if (this.cachedProfile) {
          console.warn("[ApiClient] Using cached profile after fetch error:", err?.message || err);
          return this.cachedProfile;
        }
        throw err;
      })
      .finally(() => {
        this.profilePromise = null;
      });

    return this.profilePromise;
  }

  public static getToken(): string | null {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('tourni_access_token');
      if (stored) {
        this.token = stored;
        const isHttps = window.location.protocol === 'https:';
        const secureFlag = isHttps ? '; Secure' : '';
        // Keep cookie active and synchronized for Server Actions
        document.cookie = `tourni_access_token=${stored}; path=/; max-age=604800; SameSite=Lax${secureFlag}`;
        return stored;
      }
      // Fallback check cookie
      const match = document.cookie.match(new RegExp('(^| )tourni_access_token=([^;]+)'));
      if (match) {
        this.token = match[2];
        localStorage.setItem('tourni_access_token', match[2]);
        return match[2];
      }
    }
    return this.token;
  }

  public static async fetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const token = options.token || this.getToken();

    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    let res: Response;
    try {
      res = await fetch(url, {
        cache: options.cache ?? 'no-store',
        ...options,
        headers,
      });
    } catch (networkErr: any) {
      throw new ApiError(networkErr?.message || 'Network error', 0);
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new ApiError(errorData.error || `HTTP Error ${res.status}`, res.status, errorData);
    }

    return res.json();
  }
}
