import { X509Certificate, randomBytes,createPublicKey } from 'node:crypto';
import { ControlError } from '../application/errors.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const run = promisify(execFile);
export class NodeCertificateAuthority {
  private readonly openssl:string;private readonly caCert:string;private readonly caKey:string;private readonly stateDirectory:string;
  constructor(openssl: string, caCert: string, caKey: string, stateDirectory: string) { this.openssl=openssl;this.caCert=caCert;this.caKey=caKey;this.stateDirectory=stateDirectory; }
  async sign(nodeId: string, csr: string): Promise<{ certificate: string; ca: string; fingerprint: string; until: number }> {
    const state = resolve(this.stateDirectory); await mkdir(state, { recursive: true, mode: 0o700 });
    const directory = await mkdtemp(join(state, 'csr-'));
    try {
      const input = join(directory, 'request.pem'), output = join(directory, 'certificate.pem'), extensions = join(directory, 'extensions');
      await writeFile(input, csr, { mode: 0o600 });
      await writeFile(extensions, 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=clientAuth\n', { mode: 0o600 });
      await run(this.openssl, ['req', '-in', input, '-verify', '-noout'], { timeout: 10000 });
      const publicKey=await run(this.openssl,['req','-in',input,'-pubkey','-noout'],{timeout:10000});
      const parsedKey=createPublicKey(publicKey.stdout);
      if(parsedKey.asymmetricKeyType!=='ec'||parsedKey.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw new ControlError('INVALID_CONFIG',422,'Phase 1 enrollment requires an ECDSA P-256 key');
      await run(this.openssl, ['x509', '-req', '-in', input, '-out', output, '-CA', this.caCert, '-CAkey', this.caKey, '-set_serial', `0x${randomBytes(16).toString('hex')}`, '-days', '1', '-subj', `/CN=${nodeId}`, '-extfile', extensions], { timeout: 10000 });
      const certificate = await readFile(output, 'utf8'), ca = await readFile(this.caCert, 'utf8');
      const parsed = new X509Certificate(certificate);
      return { certificate, ca, fingerprint: parsed.fingerprint256.replaceAll(':', '').toLowerCase(), until: Date.parse(parsed.validTo) };
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
}
