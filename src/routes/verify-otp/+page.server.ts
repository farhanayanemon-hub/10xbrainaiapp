import { redirect, fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { db, users } from '$lib/server/db/index.js'
import { eq } from 'drizzle-orm'
import { OtpService } from '$lib/server/otp-service.js'
import { sendOtpEmail } from '$lib/server/email.js'
import { authSanitizers } from '$lib/utils/sanitization.js'
import { SecurityLogger } from '$lib/server/security-monitoring.js'

export const load: PageServerLoad = async ({ url, locals }) => {
  const session = await locals.auth()
  if (session?.user) {
    throw redirect(302, '/newchat')
  }

  const email = url.searchParams.get('email')
  if (!email) {
    throw redirect(302, '/register')
  }

  return {
    email: authSanitizers.email(email) || email,
    expiryMinutes: OtpService.getExpiryMinutes(),
  }
}

export const actions: Actions = {
  verify: async ({ request, cookies }) => {
    const data = await request.formData()
    const email = data.get('email')?.toString()
    const code = data.get('code')?.toString()

    if (!email || !code) {
      return fail(400, { error: 'Email and verification code are required', email })
    }

    const sanitizedEmail = authSanitizers.email(email)
    if (!sanitizedEmail) {
      return fail(400, { error: 'Invalid email address', email })
    }

    const result = await OtpService.verifyOtp(sanitizedEmail, code, 'registration')

    if (!result.success) {
      return fail(400, { error: result.error, email: sanitizedEmail })
    }

    try {
      await db
        .update(users)
        .set({ emailVerified: new Date() })
        .where(eq(users.email, sanitizedEmail))

      SecurityLogger.emailVerificationSuccess(sanitizedEmail);
      console.log(`[OTP Verify] Email verified successfully for ${sanitizedEmail}`)
    } catch (err) {
      console.error('[OTP Verify] Failed to update email verification:', err)
      return fail(500, { error: 'Verification failed. Please try again.', email: sanitizedEmail })
    }

    throw redirect(302, '/login?message=Email verified! Please sign in.')
  },

  resend: async ({ request }) => {
    const data = await request.formData()
    const email = data.get('email')?.toString()

    if (!email) {
      return fail(400, { error: 'Email is required', email })
    }

    const sanitizedEmail = authSanitizers.email(email)
    if (!sanitizedEmail) {
      return fail(400, { error: 'Invalid email address', email })
    }

    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.email, sanitizedEmail))
      .limit(1)

    if (!user) {
      return fail(400, { error: 'No account found with this email', email: sanitizedEmail })
    }

    try {
      const otpCode = await OtpService.createOtp(sanitizedEmail, 'registration')

      await sendOtpEmail({
        email: sanitizedEmail,
        name: user.name || sanitizedEmail.split('@')[0],
        otpCode,
        expiryMinutes: OtpService.getExpiryMinutes(),
      })

      console.log(`[OTP Resend] New OTP sent to ${sanitizedEmail}`)
      return { resent: true, email: sanitizedEmail }
    } catch (err) {
      console.error('[OTP Resend] Failed to send OTP:', err)
      return fail(500, { error: 'Failed to send verification code. Please try again.', email: sanitizedEmail })
    }
  },
}
