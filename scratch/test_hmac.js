import crypto from 'crypto';

const bodyText = '{"events":[],"destination":"Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}';
const secret = '78bc44b30bfc1bad5a165fce71834c19';

// 1. Node.js standard HMAC-SHA256 Base64
const expected = crypto.createHmac('sha256', secret).update(bodyText).digest('base64');
console.log("Expected Base64 (Node.js):", expected);

// 2. Web Crypto API replication (similar to Deno's code)
async function testWebCrypto() {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(bodyText)
  );

  const uint8 = new Uint8Array(signed);
  let binary = "";
  for (let i = 0; i < uint8.byteLength; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const result = btoa(binary);
  console.log("Web Crypto Base64 result:", result);
  console.log("Matches?", result === expected);
}

testWebCrypto();
