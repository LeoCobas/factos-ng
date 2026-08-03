export interface StoredAccessTicket {
  toLoginCredentials(): unknown;
  getTimeUntilExpiration(): number;
}
export interface AccessTicketFactory<T extends StoredAccessTicket> {
  create(credentials: any): T;
}

export class SupabaseArcaTicketStorage<T extends StoredAccessTicket> {
  constructor(
    private readonly supabase: any,
    private readonly bucket: 'wsfe' | 'padron',
    private readonly initialStore: any,
    private readonly factory: AccessTicketFactory<T>,
  ) {}

  async get(_serviceName: string): Promise<T | null> {
    const buckets = this.initialStore?.__factos_ticket_store__
      ? this.initialStore.buckets
      : { [this.bucket]: this.initialStore };
    const credentials = buckets?.[this.bucket];
    if (!credentials) return null;

    try {
      const ticket = this.factory.create(credentials);
      return ticket.getTimeUntilExpiration() > 60_000 ? ticket : null;
    } catch {
      return null;
    }
  }

  async save(ticket: T, _serviceName: string): Promise<void> {
    const { error } = await this.supabase.rpc('merge_arca_ticket_bucket', {
      p_bucket: this.bucket,
      p_ticket: ticket.toLoginCredentials(),
    });
    if (error) throw new Error(`No se pudo guardar el ticket ${this.bucket}: ${error.message}`);
  }

  async delete(_serviceName: string): Promise<void> {
    const { error } = await this.supabase.rpc('merge_arca_ticket_bucket', {
      p_bucket: this.bucket,
      p_ticket: null,
    });
    if (error) throw new Error(`No se pudo borrar el ticket ${this.bucket}: ${error.message}`);
  }
}
