import { vol } from 'memfs';

import { APISettings } from '../../api/settings';
import { getCodeSigningInfoAsync, signManifestString } from '../codesigning';
import { mockExpoRootChain, mockSelfSigned } from './fixtures/certificates';

jest.mock('@expo/code-signing-certificates', () => ({
  ...(jest.requireActual(
    '@expo/code-signing-certificates'
  ) as typeof import('@expo/code-signing-certificates')),
  generateKeyPair: jest.fn(() =>
    (
      jest.requireActual(
        '@expo/code-signing-certificates'
      ) as typeof import('@expo/code-signing-certificates')
    ).convertKeyPairPEMToKeyPair({
      publicKeyPEM: mockExpoRootChain.publicKeyPEM,
      privateKeyPEM: mockExpoRootChain.privateKeyPEM,
    })
  ),
}));
jest.mock('../../api/getProjectDevelopmentCertificate', () => ({
  getProjectDevelopmentCertificateAsync: jest.fn(() => mockExpoRootChain.developmentCertificate),
}));
jest.mock('../../api/getExpoGoIntermediateCertificate', () => ({
  getExpoGoIntermediateCertificateAsync: jest.fn(
    () => mockExpoRootChain.expoGoIntermediateCertificate
  ),
}));

beforeEach(() => {
  vol.reset();
});

describe(getCodeSigningInfoAsync, () => {
  it('returns null when no expo-expect-signature header is requested', async () => {
    await expect(getCodeSigningInfoAsync({} as any, null, null)).resolves.toBeNull();
  });

  it('throws when expo-expect-signature header has invalid format', async () => {
    await expect(getCodeSigningInfoAsync({} as any, 'hello', null)).rejects.toThrowError(
      'keyid not present in expo-expect-signature header'
    );
    await expect(getCodeSigningInfoAsync({} as any, 'keyid=1', null)).rejects.toThrowError(
      'Invalid value for keyid in expo-expect-signature header: 1'
    );
    await expect(
      getCodeSigningInfoAsync({} as any, 'keyid="hello", alg=1', null)
    ).rejects.toThrowError('Invalid value for alg in expo-expect-signature header');
  });

  describe('expo-root keyid requested', () => {
    describe('online', () => {
      beforeEach(() => {
        APISettings.isOffline = false;
      });

      it('normal case gets a development certificate', async () => {
        const result = await getCodeSigningInfoAsync(
          { extra: { eas: { projectId: 'testprojectid' } } } as any,
          'keyid="expo-root", alg="rsa-v1_5-sha256"',
          undefined
        );
        expect(result).toMatchSnapshot();
      });

      it('requires easProjectId to be configured', async () => {
        const result = await getCodeSigningInfoAsync(
          { extra: { eas: {} } } as any,
          'keyid="expo-root", alg="rsa-v1_5-sha256"',
          undefined
        );
        expect(result).toBeNull();
      });

      it('falls back to cached when offline', async () => {
        const result = await getCodeSigningInfoAsync(
          { extra: { eas: { projectId: 'testprojectid' } } } as any,
          'keyid="expo-root", alg="rsa-v1_5-sha256"',
          undefined
        );
        APISettings.isOffline = true;
        const result2 = await getCodeSigningInfoAsync(
          { extra: { eas: { projectId: 'testprojectid' } } } as any,
          'keyid="expo-root", alg="rsa-v1_5-sha256"',
          undefined
        );
        expect(result2).toEqual(result);
        APISettings.isOffline = false;
      });
    });
  });

  describe('expo-go keyid requested', () => {
    it('throws', async () => {
      await expect(
        getCodeSigningInfoAsync({} as any, 'keyid="expo-go"', null)
      ).rejects.toThrowError(
        'Invalid certificate requested: cannot sign with embedded keyid=expo-go key'
      );
    });
  });

  describe('non expo-root certificate keyid requested', () => {
    it('normal case gets the configured certificate', async () => {
      vol.fromJSON({
        'keys/cert.pem': mockSelfSigned.certificate,
        'keys/private-key.pem': mockSelfSigned.privateKey,
      });

      const result = await getCodeSigningInfoAsync(
        {
          updates: {
            codeSigningCertificate: 'keys/cert.pem',
            codeSigningMetadata: { keyid: 'test', alg: 'rsa-v1_5-sha256' },
          },
        } as any,
        'keyid="test", alg="rsa-v1_5-sha256"',
        undefined
      );
      expect(result).toMatchSnapshot();
    });

    it('throws when it cannot generate the requested keyid due to no code signing configuration in app.json', async () => {
      await expect(
        getCodeSigningInfoAsync(
          {
            updates: { codeSigningCertificate: 'keys/cert.pem' },
          } as any,
          'keyid="test", alg="rsa-v1_5-sha256"',
          undefined
        )
      ).rejects.toThrowError(
        'Must specify "codeSigningMetadata" under the "updates" field of your app config file to use EAS code signing'
      );
    });

    it('throws when it cannot generate the requested keyid due to configured keyid or alg mismatch', async () => {
      await expect(
        getCodeSigningInfoAsync(
          {
            updates: {
              codeSigningCertificate: 'keys/cert.pem',
              codeSigningMetadata: { keyid: 'test2', alg: 'rsa-v1_5-sha256' },
            },
          } as any,
          'keyid="test", alg="rsa-v1_5-sha256"',
          undefined
        )
      ).rejects.toThrowError('keyid mismatch: client=test, project=test2');

      await expect(
        getCodeSigningInfoAsync(
          {
            updates: {
              codeSigningCertificate: 'keys/cert.pem',
              codeSigningMetadata: { keyid: 'test', alg: 'fake' },
            },
          } as any,
          'keyid="test", alg="fake2"',
          undefined
        )
      ).rejects.toThrowError('"alg" field mismatch (client=fake2, project=fake)');
    });

    it('throws when it cannot load configured code signing info', async () => {
      await expect(
        getCodeSigningInfoAsync(
          {
            updates: {
              codeSigningCertificate: 'keys/cert.pem',
              codeSigningMetadata: { keyid: 'test', alg: 'rsa-v1_5-sha256' },
            },
          } as any,
          'keyid="test", alg="rsa-v1_5-sha256"',
          undefined
        )
      ).rejects.toThrowError('Code signing certificate cannot be read from path: keys/cert.pem');
    });
  });
});

describe(signManifestString, () => {
  it('generates signature', () => {
    expect(
      signManifestString('hello', {
        certificateChainForResponse: [],
        certificateForPrivateKey: mockSelfSigned.certificate,
        privateKey: mockSelfSigned.privateKey,
      })
    ).toMatchSnapshot();
  });
  it('validates generated signature against certificate', () => {
    expect(() =>
      signManifestString('hello', {
        certificateChainForResponse: [],
        certificateForPrivateKey: '',
        privateKey: mockSelfSigned.privateKey,
      })
    ).toThrowError('Invalid PEM formatted message.');
  });
});
