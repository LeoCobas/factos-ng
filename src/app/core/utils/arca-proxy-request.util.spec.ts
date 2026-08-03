import { getArcaProxyHeaders } from './arca-proxy-request.util';

describe('getArcaProxyHeaders', () => {
  it('deja que arca-proxy elija la region mas cercana al cliente', () => {
    expect(getArcaProxyHeaders('token', 'anon-key')).toEqual({
      'Content-Type': 'application/json',
      apikey: 'anon-key',
      Authorization: 'Bearer token',
    });
  });
});
