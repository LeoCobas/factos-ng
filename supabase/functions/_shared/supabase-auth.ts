interface ClaimsAuthClient {
  getClaims(token: string): Promise<{
    data: { claims?: { sub?: unknown } | null } | null;
    error: unknown;
  }>;
}

export async function getVerifiedUserId(auth: ClaimsAuthClient, token: string): Promise<string> {
  const { data, error } = await auth.getClaims(token);
  const userId = data?.claims?.sub;

  if (error || typeof userId !== 'string' || !userId) {
    throw new Error('Sesion invalida');
  }

  return userId;
}
