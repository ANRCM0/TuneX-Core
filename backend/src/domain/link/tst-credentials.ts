import { randomBytes, createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, webcrypto, X509Certificate } from "node:crypto";
import * as x509 from "@peculiar/x509";

x509.cryptoProvider.set(webcrypto as unknown as Crypto);
const algorithm = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
export interface TstIdentity { certificate_pem: string; private_key_pem: string; ca_pem: string; peer_uri: string }
export interface TstCredentials { ca_pem: string; ca_key_pem: string; expires_at: string; ingress: TstIdentity; egress: TstIdentity }
export const tstUri = (workspace: number, link: number, node: number, role: string) =>
  `urn:tunex:tst:w:${workspace}:l:${link}:n:${node}:r:${role}`;
export const TST_CERTIFICATE_LIFETIME_MS = 7 * 86_400_000;
export const TST_CERTIFICATE_ROTATION_WINDOW_MS = 86_400_000;
const pem = (value: ArrayBuffer) => `-----BEGIN PRIVATE KEY-----\n${Buffer.from(value).toString("base64").match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`; // secret-scan:allow

export type TstCredentialExpiryState = "active" | "renewal_due" | "expired" | "invalid";

/**
 * Certificate validity is independent from the placement lease. Keep this
 * decision in one place so reconcile, deploy and tests share the same edge
 * boundary. The parser intentionally treats malformed dates as invalid
 * instead of allowing an unbounded credential to survive a bad record.
 */
export function tstCredentialExpiryState(expiresAt: string, now = new Date(), rotationWindowMs = TST_CERTIFICATE_ROTATION_WINDOW_MS): TstCredentialExpiryState {
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) return "invalid";
  const remaining = expiry - now.getTime();
  if (remaining <= 0) return "expired";
  return remaining <= rotationWindowMs ? "renewal_due" : "active";
}

export function shouldRotateTstCredentials(expiresAt: string, now = new Date()): boolean {
  const state = tstCredentialExpiryState(expiresAt, now);
  return state === "renewal_due" || state === "expired" || state === "invalid";
}

export interface TstCredentialContext { workspace: number; link: number; ingressNode: number; egressNode: number }

const publicKeyDER = (key: ReturnType<typeof createPublicKey>) => Buffer.from(key.export({ type: "spki", format: "der" }));

function samePublicKey(left: ReturnType<typeof createPublicKey>, right: ReturnType<typeof createPublicKey>): boolean {
  return publicKeyDER(left).equals(publicKeyDER(right));
}

function uriSans(certificate: X509Certificate): string[] {
  return (certificate.subjectAltName ?? "").split(",").map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("URI:")).map((entry) => entry.slice("URI:".length));
}

/** Validate the sealed bundle's cryptographic binding before it reaches an Agent. */
export function validateTstCredentials(credentials: TstCredentials, context: TstCredentialContext): void {
  try {
    const expiresAt = Date.parse(credentials.expires_at);
    if (!Number.isFinite(expiresAt)) throw new Error("invalid expiry");
    const ca = new X509Certificate(credentials.ca_pem);
    if (!ca.ca || !ca.verify(ca.publicKey)) throw new Error("invalid ca");
    const caPrivate = createPrivateKey(credentials.ca_key_pem);
    if (!samePublicKey(ca.publicKey, createPublicKey(caPrivate))) throw new Error("ca key mismatch");
    const expected = {
      ingress: { node: context.ingressNode, peer: context.egressNode },
      egress: { node: context.egressNode, peer: context.ingressNode },
    } as const;
    for (const role of ["ingress", "egress"] as const) {
      const identity = credentials[role];
      const certificate = new X509Certificate(identity.certificate_pem);
      const ownURI = tstUri(context.workspace, context.link, expected[role].node, role);
      const peerURI = tstUri(context.workspace, context.link, expected[role].peer, role === "ingress" ? "egress" : "ingress");
      const sans = uriSans(certificate);
      if (certificate.ca || !certificate.verify(ca.publicKey) || !samePublicKey(certificate.publicKey, createPublicKey(createPrivateKey(identity.private_key_pem))) ||
        sans.length !== 1 || sans[0] !== ownURI || identity.peer_uri !== peerURI ||
        certificate.checkHost(`tst-node-${expected[role].node}.tunex.invalid`) == null) throw new Error("invalid identity");
      const certificateExpiry = Date.parse(certificate.validTo);
      if (!Number.isFinite(certificateExpiry) || Math.abs(certificateExpiry - expiresAt) > 1000) throw new Error("expiry mismatch");
    }
  } catch {
    throw new Error("invalid_tst_credential");
  }
}

/** One private CA per Link. Certificates authorize exactly one workspace/node/role. */
export async function newTstCredentials(workspace: number, link: number, ingress: number, egress: number,
  now = new Date()): Promise<TstCredentials> {
  const generate = () => webcrypto.subtle.generateKey(algorithm, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;
  const caKeys = await generate();
  const notBefore = new Date(now.getTime() - 300_000);
  const notAfter = new Date(now.getTime() + TST_CERTIFICATE_LIFETIME_MS);
  const ca = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: randomBytes(16).toString("hex"), name: `CN=TuneX TST Link ${workspace} ${link}`,
    notBefore, notAfter, signingAlgorithm: algorithm, keys: caKeys,
    extensions: [new x509.BasicConstraintsExtension(true, 0, true),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign, true)],
  });
  const issue = async (node: number, role: "ingress" | "egress", peer: number, peerRole: string) => {
    const keys = await generate();
    const certificate = await x509.X509CertificateGenerator.create({
      serialNumber: randomBytes(16).toString("hex"), subject: `CN=TuneX TST Node ${node}`,
      issuer: ca.subject, notBefore, notAfter, signingAlgorithm: algorithm,
      publicKey: keys.publicKey, signingKey: caKeys.privateKey,
      extensions: [new x509.BasicConstraintsExtension(false, undefined, true),
        new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature, true),
        new x509.ExtendedKeyUsageExtension(["1.3.6.1.5.5.7.3.1", "1.3.6.1.5.5.7.3.2"], true),
        new x509.SubjectAlternativeNameExtension([
          { type: "dns", value: `tst-node-${node}.tunex.invalid` },
          { type: "url", value: tstUri(workspace, link, node, role) },
        ])],
    });
    return { certificate_pem: certificate.toString("pem"),
      private_key_pem: pem(await webcrypto.subtle.exportKey("pkcs8", keys.privateKey)),
      ca_pem: ca.toString("pem"), peer_uri: tstUri(workspace, link, peer, peerRole) };
  };
  return { ca_pem: ca.toString("pem"), ca_key_pem: pem(await webcrypto.subtle.exportKey("pkcs8", caKeys.privateKey)),
    expires_at: notAfter.toISOString(), ingress: await issue(ingress, "ingress", egress, "egress"),
    egress: await issue(egress, "egress", ingress, "ingress") };
}

function masterKey(key: string) {
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error("link_seal_key_required");
  return Buffer.from(key, "hex");
}
const aad = (workspace: number, link: number, generation: number) => Buffer.from(`tunex-tst-credentials/1/${workspace}/${link}/${generation}`);
export function sealTstCredentials(credentials: TstCredentials, key: string, workspace: number, link: number, generation: number) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", masterKey(key), iv);
  cipher.setAAD(aad(workspace, link, generation));
  const body = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return ["tst1", iv.toString("base64url"), body.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}
export function unsealTstCredentials(value: string, key: string, workspace: number, link: number, generation: number): TstCredentials {
  const [version, iv, body, tag, extra] = value.split(".");
  if (version !== "tst1" || !iv || !body || !tag || extra) throw new Error("invalid_tst_credential");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(key), Buffer.from(iv, "base64url"));
  decipher.setAAD(aad(workspace, link, generation)); decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const credentials = JSON.parse(Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8")) as TstCredentials;
  if (!credentials.ingress?.private_key_pem || !credentials.egress?.private_key_pem || !Number.isFinite(Date.parse(credentials.expires_at)))
    throw new Error("invalid_tst_credential");
  return credentials;
}
