export function getArcaProxyHeaders(accessToken: string, anonKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
  };
}
