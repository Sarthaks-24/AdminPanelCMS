const mongoose = require('mongoose');
const { connectMongo, standardUriFromSrv, isSrvLookupFailure, withDatabaseName } = require('../lib/mongoConnect');

const SRV_URI = 'mongodb+srv://app_user:p%40ss@cluster0.abc123.mongodb.net';
const answers = {
  SRV: [
    { data: '0 0 27017 shard-00-00.abc123.mongodb.net.' },
    { data: '0 0 27017 shard-00-01.abc123.mongodb.net.' },
  ],
  TXT: [{ data: '"authSource=admin&replicaSet=atlas-xyz-shard-0"' }],
};
const query = async (_name, type) => answers[type];

describe('standardUriFromSrv', () => {
  it('rebuilds the standard connection string with TXT options, TLS and encoded credentials', async () => {
    const uri = await standardUriFromSrv(`${SRV_URI}/Portfolio_db?retryWrites=true`, query);
    expect(uri).toBe('mongodb://app_user:p%40ss@shard-00-00.abc123.mongodb.net:27017,shard-00-01.abc123.mongodb.net:27017/Portfolio_db?retryWrites=true&authSource=admin&replicaSet=atlas-xyz-shard-0&tls=true');
  });

  it('refuses hosts outside the cluster domain', async () => {
    const hostile = async (_name, type) => (type === 'SRV' ? [{ data: '0 0 27017 evil.example.com.' }] : []);
    await expect(standardUriFromSrv(SRV_URI, hostile)).rejects.toThrow(/No valid MongoDB hosts/);
  });
});

describe('connection helpers', () => {
  afterEach(() => { vi.restoreAllMocks(); delete process.env.MONGODB_DB; });

  it('only treats SRV lookup errors on srv URIs as fallback cases', () => {
    expect(isSrvLookupFailure(SRV_URI, new Error('querySrv EBADRESP _mongodb._tcp.x'))).toBe(true);
    expect(isSrvLookupFailure(SRV_URI, new Error('bad auth'))).toBe(false);
    expect(isSrvLookupFailure('mongodb://localhost/x', new Error('querySrv EBADRESP'))).toBe(false);
  });

  it('defaults the database name only when the URI has none', () => {
    expect(withDatabaseName(SRV_URI, {}).dbName).toBe('Portfolio_db');
    process.env.MONGODB_DB = 'Custom';
    expect(withDatabaseName(SRV_URI, {}).dbName).toBe('Custom');
    expect(withDatabaseName(`${SRV_URI}/Mine`, {}).dbName).toBeUndefined();
  });

  it('retries with the standard URI after an SRV failure and rethrows other errors', async () => {
    const connect = vi.spyOn(mongoose, 'connect')
      .mockRejectedValueOnce(new Error('querySrv EBADRESP _mongodb._tcp.cluster0.abc123.mongodb.net'))
      .mockResolvedValueOnce({ connection: { host: 'shard-00-00' } });
    vi.spyOn(mongoose, 'disconnect').mockResolvedValue();
    const log = { warn: vi.fn() };
    await connectMongo(SRV_URI, {}, { query, log });
    expect(connect).toHaveBeenCalledTimes(2);
    expect(connect.mock.calls[1][0]).toMatch(/^mongodb:\/\/app_user:p%40ss@shard-00-00/);
    expect(connect.mock.calls[1][1].dbName).toBe('Portfolio_db');
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn.mock.calls[0][0]).not.toMatch(/p%40ss|app_user/);

    connect.mockReset().mockRejectedValueOnce(new Error('bad auth'));
    await expect(connectMongo(SRV_URI, {}, { query, log })).rejects.toThrow('bad auth');
  });
});
