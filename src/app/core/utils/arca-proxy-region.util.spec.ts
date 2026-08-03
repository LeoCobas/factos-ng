import { getArcaProxyHeaders } from './arca-proxy-region.util';

describe('getArcaProxyHeaders', () => {
  it('fuerza arca-proxy a ejecutarse junto a la base en us-east-1', () => {
    expect(getArcaProxyHeaders('token', 'anon-key')).toEqual({
      'Content-Type': 'application/json',
      apikey: 'anon-key',
      Authorization: 'Bearer token',
      'x-region': 'us-east-1',
    });
  });
});
