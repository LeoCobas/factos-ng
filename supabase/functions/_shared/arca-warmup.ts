interface WsfeWarmupService {
  getMaxRecordsPerRequest(): Promise<unknown>;
}

export async function warmWsfeConnection(service: WsfeWarmupService): Promise<void> {
  await service.getMaxRecordsPerRequest();
}
