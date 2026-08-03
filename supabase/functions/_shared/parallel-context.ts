export async function verifyAndLoadContext<T>(
  verifyUser: () => PromiseLike<string>,
  loadContext: () => PromiseLike<T>,
): Promise<{ userId: string; context: T }> {
  const authPromise = Promise.resolve().then(verifyUser);
  const contextPromise = Promise.resolve().then(loadContext);
  const [userId, context] = await Promise.all([authPromise, contextPromise]);

  return { userId, context };
}
