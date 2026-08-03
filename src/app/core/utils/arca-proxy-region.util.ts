export const ARCA_PROXY_REGION = 'us-east-1';

export function getArcaProxyHeaders(accessToken: string, anonKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    'x-region': ARCA_PROXY_REGION,
  };
}
