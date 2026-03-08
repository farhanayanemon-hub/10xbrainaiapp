import { readFileSync } from 'fs'
import { join } from 'path'
import { adminSettingsService } from './admin-settings.js'
import { db } from './db/index.js'
import { adminSettings } from './db/schema.js'
import { eq, and } from 'drizzle-orm'

export interface EmailTemplate {
  name: string
  label: string
  description: string
  subject: string
  html: string
  variables: string[]
  isCustom: boolean
}

export interface SavedTemplate {
  subject: string
  html: string
}

const TEMPLATE_DEFINITIONS: Record<string, { label: string; description: string; defaultSubject: string; variables: string[] }> = {
  'welcome-verify-email': {
    label: 'Welcome / Verify Email',
    description: 'Sent when a new user registers. Includes optional email verification link.',
    defaultSubject: 'Welcome to {{platformName}}',
    variables: ['platformName', 'displayName', 'publicOrigin', 'logoUrl', 'logoWidth', 'logoHeight', 'verificationUrl', 'isVerificationRequired'],
  },
  'reset-password': {
    label: 'Password Reset',
    description: 'Sent when a user requests a password reset.',
    defaultSubject: 'Reset Your Password - {{platformName}}',
    variables: ['platformName', 'displayName', 'publicOrigin', 'logoUrl', 'logoWidth', 'logoHeight', 'resetUrl'],
  },
  'otp-verification': {
    label: 'OTP / Verification Code',
    description: 'Sent when an OTP or verification code is generated for the user.',
    defaultSubject: 'Your Verification Code - {{platformName}}',
    variables: ['platformName', 'displayName', 'publicOrigin', 'logoUrl', 'logoWidth', 'logoHeight', 'otpCode', 'expiryMinutes'],
  },
  'plan-purchase': {
    label: 'Plan Purchase Confirmation',
    description: 'Sent when a user successfully purchases or subscribes to a plan.',
    defaultSubject: 'Subscription Confirmed - {{platformName}}',
    variables: ['platformName', 'displayName', 'publicOrigin', 'logoUrl', 'logoWidth', 'logoHeight', 'planName', 'amount', 'billingPeriod', 'nextBillingDate'],
  },
  'credit-purchase': {
    label: 'Credit Purchase Confirmation',
    description: 'Sent when a user purchases extra generation credits.',
    defaultSubject: 'Credits Added - {{platformName}}',
    variables: ['platformName', 'displayName', 'publicOrigin', 'logoUrl', 'logoWidth', 'logoHeight', 'creditPackName', 'creditAmount', 'creditType', 'amount'],
  },
  'subscription-expiry': {
    label: 'Subscription Expiry Warning',
    description: 'Sent when a user\'s subscription is about to expire.',
    defaultSubject: 'Your Subscription is Expiring - {{platformName}}',
    variables: ['platformName', 'displayName', 'publicOrigin', 'logoUrl', 'logoWidth', 'logoHeight', 'planName', 'expiryDate', 'daysRemaining'],
  },
  'plan-upgrade': {
    label: 'Plan Upgrade / Downgrade',
    description: 'Sent when a user upgrades or downgrades their subscription plan.',
    defaultSubject: 'Plan Updated - {{platformName}}',
    variables: ['platformName', 'displayName', 'publicOrigin', 'logoUrl', 'logoWidth', 'logoHeight', 'previousPlan', 'newPlan', 'amount', 'effectiveDate'],
  },
  'general-notice': {
    label: 'General Notice',
    description: 'A flexible template for sending announcements or custom notifications.',
    defaultSubject: '{{subject}} - {{platformName}}',
    variables: ['platformName', 'displayName', 'publicOrigin', 'logoUrl', 'logoWidth', 'logoHeight', 'heading', 'message', 'subject', 'actionUrl', 'actionText'],
  },
}

function settingsKey(templateName: string): string {
  return `email_template_${templateName}`
}

function loadDefaultTemplate(templateName: string): string {
  try {
    const templatePath = join(process.cwd(), 'src', 'lib', 'server', 'sys-email-templates', `${templateName}.html`)
    return readFileSync(templatePath, 'utf-8')
  } catch {
    return ''
  }
}

export class EmailTemplateService {
  static async getTemplate(templateName: string): Promise<EmailTemplate | null> {
    const def = TEMPLATE_DEFINITIONS[templateName]
    if (!def) return null

    const key = settingsKey(templateName)
    const [row] = await db
      .select({ value: adminSettings.value })
      .from(adminSettings)
      .where(and(eq(adminSettings.key, key), eq(adminSettings.category, 'email_templates')))
      .limit(1)

    let subject = def.defaultSubject
    let html = loadDefaultTemplate(templateName)
    let isCustom = false

    if (row?.value) {
      try {
        const saved: SavedTemplate = JSON.parse(row.value)
        subject = saved.subject || subject
        html = saved.html || html
        isCustom = true
      } catch {}
    }

    return {
      name: templateName,
      label: def.label,
      description: def.description,
      subject,
      html,
      variables: def.variables,
      isCustom,
    }
  }

  static async saveTemplate(templateName: string, subject: string, html: string): Promise<void> {
    const def = TEMPLATE_DEFINITIONS[templateName]
    if (!def) throw new Error(`Unknown template: ${templateName}`)

    const value = JSON.stringify({ subject, html } satisfies SavedTemplate)
    const key = settingsKey(templateName)

    await adminSettingsService.setSetting(key, value, 'email_templates', `Email template: ${def.label}`)
  }

  static async resetTemplate(templateName: string): Promise<void> {
    const key = settingsKey(templateName)
    await db
      .delete(adminSettings)
      .where(and(eq(adminSettings.key, key), eq(adminSettings.category, 'email_templates')))
  }

  static async getTemplateList(): Promise<EmailTemplate[]> {
    const templates: EmailTemplate[] = []

    for (const [name, def] of Object.entries(TEMPLATE_DEFINITIONS)) {
      const key = settingsKey(name)
      const [row] = await db
        .select({ value: adminSettings.value })
        .from(adminSettings)
        .where(and(eq(adminSettings.key, key), eq(adminSettings.category, 'email_templates')))
        .limit(1)

      let subject = def.defaultSubject
      let html = ''
      let isCustom = false

      if (row?.value) {
        try {
          const saved: SavedTemplate = JSON.parse(row.value)
          subject = saved.subject || subject
          html = saved.html || ''
          isCustom = true
        } catch {}
      }

      templates.push({
        name,
        label: def.label,
        description: def.description,
        subject,
        html,
        variables: def.variables,
        isCustom,
      })
    }

    return templates
  }

  static getDefaultTemplate(templateName: string): { subject: string; html: string } | null {
    const def = TEMPLATE_DEFINITIONS[templateName]
    if (!def) return null

    return {
      subject: def.defaultSubject,
      html: loadDefaultTemplate(templateName),
    }
  }

  static getTemplateDefinitions() {
    return TEMPLATE_DEFINITIONS
  }
}
