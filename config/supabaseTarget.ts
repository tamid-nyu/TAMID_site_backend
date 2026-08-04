const PRODUCTION_SUPABASE_PROJECT_REF = 'ggpcovdlthmysfouulpq';
const PRODUCTION_SUPABASE_URL = `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`;

type SupabaseTargetEnvironment = 'local' | 'production' | 'unknown';

export interface SupabaseTargetMetadata {
  url: string | null;
  projectRef: string;
  environment: SupabaseTargetEnvironment;
  isProduction: boolean;
}

const isLocalHostname = (hostname: string): boolean => {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
};

export const getSupabaseTargetMetadata = (
  supabaseUrl = process.env.SUPABASE_URL
): SupabaseTargetMetadata => {
  if (!supabaseUrl) {
    return {
      url: null,
      projectRef: 'unknown',
      environment: 'unknown',
      isProduction: true,
    };
  }

  try {
    const parsedUrl = new URL(supabaseUrl);
    const hostname = parsedUrl.hostname.toLowerCase();

    if (isLocalHostname(hostname)) {
      return {
        url: supabaseUrl,
        projectRef: 'local',
        environment: 'local',
        isProduction: false,
      };
    }

    if (hostname.endsWith('.supabase.co')) {
      const projectRef = hostname.split('.')[0] || 'unknown';
      const isProduction =
        projectRef === PRODUCTION_SUPABASE_PROJECT_REF ||
        parsedUrl.origin === PRODUCTION_SUPABASE_URL;

      return {
        url: supabaseUrl,
        projectRef,
        environment: isProduction ? 'production' : 'unknown',
        isProduction: true,
      };
    }

    return {
      url: supabaseUrl,
      projectRef: 'unknown',
      environment: 'unknown',
      isProduction: true,
    };
  } catch {
    return {
      url: supabaseUrl,
      projectRef: 'unknown',
      environment: 'unknown',
      isProduction: true,
    };
  }
};
