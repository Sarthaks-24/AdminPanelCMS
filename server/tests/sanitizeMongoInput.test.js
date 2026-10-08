const sanitizeMongoInput = require('../middleware/sanitizeMongoInput');
const mongoose = require('mongoose');

describe('sanitizeMongoInput', () => {
  it('removes Mongo operators, dotted paths and prototype-pollution keys recursively', () => {
    const req = { body: JSON.parse('{"$where":"bad","nested":{"safe":1,"a.b":2,"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}},"items":[{"$gt":0,"prototype":1}]}') };
    let nextCalled = false;
    sanitizeMongoInput(req, {}, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(req.body.safe).toBeUndefined();
    expect(req.body.nested.safe).toBe(1);
    expect(Object.keys(req.body)).not.toContain('$where');
    expect(Object.keys(req.body.nested)).toEqual(['safe']);
    expect(req.body.items).toEqual([{}]);
    expect({}.polluted).toBeUndefined();
  });

  it('preserves Date and ObjectId instances recursively', () => {
    const date = new Date('2026-10-08T12:00:00.000Z');
    const id = new mongoose.Types.ObjectId();
    const req = { body: { date, nested: { id } } };
    sanitizeMongoInput(req, {}, () => {});
    expect(req.body.date).toBe(date);
    expect(req.body.date.toISOString()).toBe('2026-10-08T12:00:00.000Z');
    expect(req.body.nested.id).toBe(id);
  });
});
