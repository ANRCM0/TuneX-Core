import { randomBytes, createCipheriv, createDecipheriv, webcrypto } from "node:crypto";
import * as x509 from "@peculiar/x509";

x509.cryptoProvider.set(webcrypto as unknown as Crypto);
const algorithm = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
export interface TstIdentity { certificate_pem: string; private_key_pem: string; ca_pem: string; peer_uri: string }
export interface TstCredentials { ca_pem: string; ca_key_pem: string; expires_at: string; ingress: TstIdentity; egress: TstIdentity }
export const tstUri = (workspace: number, link: number, node: number, role: string) =>
  `urn:tunex:tst:w:${workspace}:l:${link}:n:${node}:r:${role}`;
const pem = (value: ArrayBuffer) => `-----BEGIN PRIVATE KEY-----\n${Buffer.from(value).toString("base64").match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;

/** One private CA per Link. Certificates authorize exactly one workspace/node/role. */
export async function newTstCredentials(workspace: number, link: number, ingress: number, egress: number,
  now = new Date()): Promise<TstCredentials> {
  const generate = () => webcrypto.subtle.generateKey(algorithm, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;
  const caKeys = await generate();
  const notBefore = new Date(now.getTime() - 300_000);
  const notAfter = new Date(now.getTime() + 7 * 86_400_000);
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
