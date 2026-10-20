import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const baseUrl = process.env.OPENPOLICY_ACCEPTANCE_URL?.replace(/\/$/, '');
const apiKey = process.env.OPENPOLICY_FIREBASE_API_KEY;
const projectId = process.env.FIREBASE_PROJECT_ID || 'openpolicy-35f82';
if (!baseUrl || !apiKey) throw new Error('OPENPOLICY_ACCEPTANCE_URL and OPENPOLICY_FIREBASE_API_KEY are required.');

const app = initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth(app);
const firestore = getFirestore(app);
const nonce = crypto.randomBytes(8).toString('hex');
const password = `Op!${crypto.randomBytes(18).toString('base64url')}`;
const identities = [
  { email: `acceptance-consumer-${nonce}@openpolicy.test`, profile: { role: 'CONSUMER', accountType: 'consumer', acceptanceOnly: true } },
  { email: `acceptance-provider-${nonce}@openpolicy.test`, profile: { role: 'PROVIDER', accountType: 'provider', providerStatus: 'ACTIVE', providerUserId: 'user_sierra_1', providerOrganizationId: 'org_sierra', acceptanceOnly: true } }
];
const created: string[] = [];

async function token(email: string) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST', headers: { 'content-type': 'application/json', referer: `${baseUrl}/` },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const body = await response.json() as any;
  if (!response.ok) throw new Error(`Firebase sign-in failed: ${body?.error?.message || response.status}`);
  return body.idToken as string;
}

async function probe(name: string, path: string, idToken: string, expected = 200) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${idToken}` } });
  assert.equal(response.status, expected, `${name}: expected ${expected}, received ${response.status}: ${await response.text()}`);
  return { name, status: response.status };
}

try {
  for (const identity of identities) {
    const user = await auth.createUser({ email: identity.email, password, emailVerified: true, disabled: false });
    created.push(user.uid);
    await firestore.collection('users').doc(user.uid).set({ ...identity.profile, email: identity.email, createdAt: new Date().toISOString() });
  }
  const consumerToken = await token(identities[0].email);
  const providerToken = await token(identities[1].email);
  const results = [
    await probe('consumer challenge list', '/api/challenges', consumerToken),
    await probe('consumer policy vault', '/api/vault/documents', consumerToken),
    await probe('consumer notifications', '/api/notifications', consumerToken),
    await probe('provider organization', '/api/marketplace/my-provider', providerToken),
    await probe('non-admin provider denied user administration', '/api/marketplace/my-provider/users', providerToken, 403),
    await probe('provider commercial account', '/api/commercial/account', providerToken)
  ];
  const crossRole = await fetch(`${baseUrl}/api/marketplace/my-provider`, { headers: { authorization: `Bearer ${consumerToken}` } });
  assert.equal(crossRole.status, 403, 'consumer must not cross into provider organization access');
  results.push({ name: 'consumer denied provider organization', status: crossRole.status });
  console.log(JSON.stringify({ result: 'PASS', revisionUrl: baseUrl, results }, null, 2));
} finally {
  for (const uid of created) {
    await firestore.collection('users').doc(uid).delete().catch(() => undefined);
    await auth.deleteUser(uid).catch(() => undefined);
  }
}
