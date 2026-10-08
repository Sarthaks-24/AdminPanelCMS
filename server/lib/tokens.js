const crypto = require('crypto');

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function encodeBase62(buffer) {
  let number = BigInt(`0x${buffer.toString('hex')}`);
  let output = '';
  while (number > 0n) { output = ALPHABET[Number(number % 62n)] + output; number /= 62n; }
  return output.padStart(43, '0');
}
function generateToken(type = 'pk') {
  if (!['pk', 'sk'].includes(type)) throw new TypeError('Token type must be pk or sk');
  const token = `${type}_live_${encodeBase62(crypto.randomBytes(32))}`;
  return { token, prefix: prefixOf(token), hash: hashToken(token) };
}
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function prefixOf(token) { return String(token).slice(0, 12); }

module.exports = { generateToken, hashToken, prefixOf };
