import type {
  AccessTicketFactory,
  StoredAccessTicket,
} from './arca-ticket-storage.ts';

export class SupabaseSystemArcaTicketStorage<T extends StoredAccessTicket> {
  constructor(
    private readonly supabase: any,
    private readonly cuit: number,
    private readonly production: boolean,
    private readonly factory: AccessTicketFactory<T>,
  ) {}

  async get(serviceName: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from('arca_system_tickets')
      .select('ticket')
      .eq('service_name', serviceName)
      .eq('cuit', String(this.cuit))
      .eq('production', this.production)
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo leer el ticket ARCA del sistema: ${error.message}`);
    }

    if (!data?.ticket) return null;

    try {
      const ticket = this.factory.create(data.ticket);
      return ticket.getTimeUntilExpiration() > 60_000 ? ticket : null;
    } catch {
      return null;
    }
  }

  async save(ticket: T, serviceName: string): Promise<void> {
    const { error } = await this.supabase.from('arca_system_tickets').upsert(
      {
        service_name: serviceName,
        cuit: String(this.cuit),
        production: this.production,
        ticket: ticket.toLoginCredentials(),
      },
      { onConflict: 'service_name,cuit,production' },
    );

    if (error) {
      throw new Error(`No se pudo guardar el ticket ARCA del sistema: ${error.message}`);
    }
  }

  async delete(serviceName: string): Promise<void> {
    const { error } = await this.supabase
      .from('arca_system_tickets')
      .delete()
      .eq('service_name', serviceName)
      .eq('cuit', String(this.cuit))
      .eq('production', this.production);

    if (error) {
      throw new Error(`No se pudo borrar el ticket ARCA del sistema: ${error.message}`);
    }
  }
}
