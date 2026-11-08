import { argon2id, argon2Verify } from 'npm:hash-wasm@4.12.0';
export default {
  argon2id: 2,
  async hash(password: string, options: any) {
    return await argon2id({ password, salt: crypto.getRandomValues(new Uint8Array(16)),
      parallelism: options.parallelism, iterations: options.timeCost, memorySize: options.memoryCost,
      hashLength: 32, outputType: 'encoded' });
  },
  async verify(hash: string, password: string) { return await argon2Verify({ hash, password }); }
};
