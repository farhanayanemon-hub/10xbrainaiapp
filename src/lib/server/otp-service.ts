import { randomInt } from 'crypto'
import { db, otpCodes } from './db/index.js'
import { eq, and, lt } from 'drizzle-orm'

const OTP_EXPIRY_MINUTES = 10
const MAX_ATTEMPTS = 5

export class OtpService {
  static generateCode(): string {
    return randomInt(100000, 999999).toString()
  }

  static async createOtp(email: string, purpose: string = 'registration'): Promise<string> {
    await db.delete(otpCodes).where(
      and(eq(otpCodes.email, email), eq(otpCodes.purpose, purpose))
    )

    const code = this.generateCode()
    const expires = new Date()
    expires.setMinutes(expires.getMinutes() + OTP_EXPIRY_MINUTES)

    await db.insert(otpCodes).values({
      email,
      code,
      purpose,
      expires,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      verified: false,
    })

    return code
  }

  static async verifyOtp(email: string, code: string, purpose: string = 'registration'): Promise<{ success: boolean; error?: string }> {
    const [record] = await db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.email, email), eq(otpCodes.purpose, purpose)))
      .limit(1)

    if (!record) {
      return { success: false, error: 'No verification code found. Please request a new one.' }
    }

    if (new Date() > record.expires) {
      await db.delete(otpCodes).where(eq(otpCodes.id, record.id))
      return { success: false, error: 'Verification code has expired. Please request a new one.' }
    }

    if (record.attempts >= record.maxAttempts) {
      await db.delete(otpCodes).where(eq(otpCodes.id, record.id))
      return { success: false, error: 'Too many attempts. Please request a new code.' }
    }

    if (record.code !== code) {
      await db
        .update(otpCodes)
        .set({ attempts: record.attempts + 1 })
        .where(eq(otpCodes.id, record.id))
      const remaining = record.maxAttempts - record.attempts - 1
      return { success: false, error: `Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` }
    }

    await db.delete(otpCodes).where(eq(otpCodes.id, record.id))

    return { success: true }
  }

  static async cleanupExpired(): Promise<void> {
    await db.delete(otpCodes).where(lt(otpCodes.expires, new Date()))
  }

  static getExpiryMinutes(): number {
    return OTP_EXPIRY_MINUTES
  }
}
