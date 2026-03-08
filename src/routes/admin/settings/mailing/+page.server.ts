import type { Actions, PageServerLoad } from './$types'
import { fail } from '@sveltejs/kit'
import { getMailingSettings, adminSettingsService } from '$lib/server/admin-settings'
import { settingsStore } from '$lib/server/settings-store'
import { emailService } from '$lib/server/email'
import { EmailTemplateService } from '$lib/server/email-templates.js'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async () => {
  try {
    const [settings, templates] = await Promise.all([
      getMailingSettings(),
      EmailTemplateService.getTemplateList()
    ])

    return {
      settings: {
        smtpHost: settings.smtp_host || "",
        smtpPort: settings.smtp_port || "",
        smtpSecure: settings.smtp_secure || "",
        smtpUser: settings.smtp_user || "",
        smtpPass: settings.smtp_pass || "",
        fromEmail: settings.from_email || "",
        fromName: settings.from_name || ""
      },
      templates: templates.map(t => ({
        name: t.name,
        label: t.label,
        description: t.description,
        subject: t.subject,
        variables: t.variables,
        isCustom: t.isCustom,
      })),
      isDemoMode: isDemoModeEnabled()
    }
  } catch (error) {
    console.error('Failed to load mailing settings:', error);
    return {
      settings: {
        smtpHost: "",
        smtpPort: "",
        smtpSecure: "",
        smtpUser: "",
        smtpPass: "",
        fromEmail: "",
        fromName: ""
      },
      templates: [],
      isDemoMode: isDemoModeEnabled()
    }
  }
}

export const actions: Actions = {
  update: async ({ request }) => {
    if (isDemoModeEnabled()) {
      return fail(403, { error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED });
    }

    const data = await request.formData()

    const smtpHost = data.get('smtpHost')?.toString()
    const smtpPort = data.get('smtpPort')?.toString()
    const smtpSecure = data.get('smtpSecure')?.toString()
    const smtpUser = data.get('smtpUser')?.toString()
    const smtpPass = data.get('smtpPass')?.toString()
    const fromEmail = data.get('fromEmail')?.toString()
    const fromName = data.get('fromName')?.toString()

    if (!smtpHost || !smtpUser || !smtpPass) {
      return fail(400, { error: 'SMTP Host, Username, and Password are required' })
    }

    if (smtpPort && (isNaN(Number(smtpPort)) || Number(smtpPort) <= 0 || Number(smtpPort) > 65535)) {
      return fail(400, { error: 'SMTP Port must be a valid number between 1 and 65535' })
    }

    if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      return fail(400, { error: 'From Email must be a valid email address' })
    }

    try {
      const currentSettings = await getMailingSettings();

      const shouldSaveValue = (newValue: string | undefined, currentValue: string | undefined) => {
        const trimmedNew = (newValue || '').trim();
        const trimmedCurrent = (currentValue || '').trim();
        return trimmedNew && trimmedNew !== trimmedCurrent;
      };

      const settingsToSave = [];

      if (shouldSaveValue(smtpHost, currentSettings.smtp_host)) {
        settingsToSave.push({ key: 'smtp_host', value: smtpHost!.trim(), category: 'mailing', description: 'SMTP server hostname' });
      }
      if (shouldSaveValue(smtpPort, currentSettings.smtp_port)) {
        settingsToSave.push({ key: 'smtp_port', value: smtpPort!.trim(), category: 'mailing', description: 'SMTP server port number' });
      }
      if (shouldSaveValue(smtpSecure, currentSettings.smtp_secure)) {
        settingsToSave.push({ key: 'smtp_secure', value: smtpSecure!.trim(), category: 'mailing', description: 'Use secure connection (true/false)' });
      }
      if (shouldSaveValue(smtpUser, currentSettings.smtp_user)) {
        settingsToSave.push({ key: 'smtp_user', value: smtpUser!.trim(), category: 'mailing', description: 'SMTP username' });
      }
      if (shouldSaveValue(smtpPass, currentSettings.smtp_pass)) {
        settingsToSave.push({ key: 'smtp_pass', value: smtpPass!.trim(), category: 'mailing', description: 'SMTP password (encrypted)' });
      }
      if (shouldSaveValue(fromEmail, currentSettings.from_email)) {
        settingsToSave.push({ key: 'from_email', value: fromEmail!.trim(), category: 'mailing', description: 'From email address' });
      }
      if (shouldSaveValue(fromName, currentSettings.from_name)) {
        settingsToSave.push({ key: 'from_name', value: fromName!.trim(), category: 'mailing', description: 'From display name' });
      }

      if (settingsToSave.length > 0) {
        await adminSettingsService.setSettings(settingsToSave);
      }

      settingsStore.clearCache();
      await emailService.reconfigure();

      return { success: true }
    } catch (error) {
      console.error('Error saving mailing settings:', error)
      return fail(500, { error: 'Failed to save mailing settings. Please try again.' })
    }
  },

  saveTemplate: async ({ request }) => {
    if (isDemoModeEnabled()) {
      return fail(403, { error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED });
    }

    const data = await request.formData()
    const templateName = data.get('templateName')?.toString()
    const subject = data.get('subject')?.toString()
    const html = data.get('html')?.toString()

    if (!templateName || !subject || !html) {
      return fail(400, { error: 'Template name, subject, and HTML content are required', templateError: true })
    }

    try {
      await EmailTemplateService.saveTemplate(templateName, subject, html)
      return { success: true, templateSaved: templateName }
    } catch (error) {
      console.error('Error saving email template:', error)
      return fail(500, { error: 'Failed to save email template', templateError: true })
    }
  },

  resetTemplate: async ({ request }) => {
    if (isDemoModeEnabled()) {
      return fail(403, { error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED });
    }

    const data = await request.formData()
    const templateName = data.get('templateName')?.toString()

    if (!templateName) {
      return fail(400, { error: 'Template name is required', templateError: true })
    }

    try {
      await EmailTemplateService.resetTemplate(templateName)
      return { success: true, templateReset: templateName }
    } catch (error) {
      console.error('Error resetting email template:', error)
      return fail(500, { error: 'Failed to reset email template', templateError: true })
    }
  }
}
