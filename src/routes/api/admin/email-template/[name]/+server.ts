import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { EmailTemplateService } from '$lib/server/email-templates.js';

export const GET: RequestHandler = async ({ params, locals }) => {
  const session = await locals.auth();
  if (!session?.user || session.user.role !== 'admin') {
    throw error(403, 'Forbidden');
  }

  const templateName = params.name;
  if (!templateName) {
    throw error(400, 'Template name is required');
  }

  try {
    const template = await EmailTemplateService.getTemplate(templateName);
    if (!template) {
      throw error(404, 'Template not found');
    }

    const defaultTemplate = EmailTemplateService.getDefaultTemplate(templateName);

    return json({
      name: template.name,
      label: template.label,
      subject: template.subject,
      html: template.html,
      variables: template.variables,
      isCustom: template.isCustom,
      defaultSubject: defaultTemplate?.subject || '',
      defaultHtml: defaultTemplate?.html || '',
    });
  } catch (e: any) {
    if (e?.status) throw e;
    console.error('Error loading template:', e);
    throw error(500, 'Failed to load template');
  }
};
