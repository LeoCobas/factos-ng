import { readArcaTicketBucket, writeArcaTicketBucket } from './arca-ticket.util';

describe('arca-ticket.util', () => {
  it('mantiene buckets separados para wsfe y padron', () => {
    const withWsfe = writeArcaTicketBucket(null, 'wsfe', { token: 'wsfe-ticket' });
    const withPadron = writeArcaTicketBucket(withWsfe, 'padron', { token: 'padron-ticket' });

    expect(readArcaTicketBucket(withPadron, 'wsfe')).toEqual({ token: 'wsfe-ticket' });
    expect(readArcaTicketBucket(withPadron, 'padron')).toEqual({ token: 'padron-ticket' });
  });

  it('preserva compatibilidad con ticket legacy para wsfe', () => {
    const legacy = { token: 'legacy-ticket' };

    expect(readArcaTicketBucket(legacy, 'wsfe')).toEqual(legacy);
    expect(readArcaTicketBucket(legacy, 'padron')).toBeNull();
  });

  it('no pierde el ticket legacy de wsfe al escribir el bucket de padron', () => {
    const legacy = { token: 'legacy-ticket' };

    const migrated = writeArcaTicketBucket(legacy, 'padron', { token: 'padron-ticket' });

    expect(readArcaTicketBucket(migrated, 'wsfe')).toEqual(legacy);
    expect(readArcaTicketBucket(migrated, 'padron')).toEqual({ token: 'padron-ticket' });
  });
});
