/**
 * Prompt templates configuration for ChatInterface welcome screen
 */

import {
  BulbIcon,
  CodeIcon,
  AnalyticsIcon,
  MessageCircleIcon,
} from "$lib/icons/index.js";
import * as m from "$lib/../paraglide/messages.js";
import type { Component } from "svelte";

export interface PromptTemplate {
  id: string;
  title: string;
  icon: Component;
  iconColor: string;
  bgColor: string;
  prompt: string;
  description: string;
}

/**
 * Get prompt templates for the welcome screen
 * Returns fresh instances with localized strings
 */
export function getPromptTemplates(): PromptTemplate[] {
  return [
    {
      id: "creative",
      title: m["prompts.creative_writing.title"](),
      icon: BulbIcon,
      iconColor: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
      prompt: m["prompts.creative_writing.description"](),
      description: m["prompts.creative_writing.short_description"](),
    },
    {
      id: "code",
      title: m["prompts.code_review.title"](),
      icon: CodeIcon,
      iconColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      prompt: m["prompts.code_review.description"](),
      description: m["prompts.code_review.short_description"](),
    },
    {
      id: "analysis",
      title: m["prompts.analysis_research.title"](),
      icon: AnalyticsIcon,
      iconColor: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      prompt: m["prompts.analysis_research.description"](),
      description: m["prompts.analysis_research.short_description"](),
    },
    {
      id: "general",
      title: m["prompts.general_discussion.title"](),
      icon: MessageCircleIcon,
      iconColor: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
      prompt: m["prompts.general_discussion.description"](),
      description: m["prompts.general_discussion.short_description"](),
    },
  ];
}
