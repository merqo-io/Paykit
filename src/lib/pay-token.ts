import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const TOKEN_BYTES = 32;
const HASH_SHAPE = /^[0-9a-f]{64}$/;

/** 32 random bytes as base64url: 43 characters, no padding. */
export const payTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** Hex sha256 of a pay token. The only form of the token paykit stores. */
export function hashPayToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * A new pay token and the hash to store for it. The token goes into the
 * customer's link once and is not kept anywhere on paykit's side.
 */
export function mintPayToken(): { token: string; hash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, hash: hashPayToken(token) };
}

/**
 * Whether `token` is the one whose hash is stored. Compares the two digests
 * in constant time. False when nothing is stored, or when what is stored is
 * not a digest.
 */
export function payTokenMatches(
  token: string,
  storedHash: string | null | undefined,
): boolean {
  if (!storedHash || !HASH_SHAPE.test(storedHash)) return false;
  const provided = Buffer.from(hashPayToken(token), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

/**
 * A short, stable stand-in for a token in a rate-limit key. The limiter's
 * table is readable by the service role, so the token itself never goes
 * into it.
 */
export function payTokenKey(token: string): string {
  return hashPayToken(token).slice(0, 16);
}
