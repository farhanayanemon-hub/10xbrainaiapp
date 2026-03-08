/**
 * Model capabilities utilities for ChatInterface
 * Handles capability detection and display for AI models
 */

import type { AIModelConfig, ArchitectureObject } from "$lib/ai/types.js";
import {
  TypeIcon,
  ImageIcon,
  VideoIcon,
  FileIcon,
  AudioLinesIcon,
  WrenchIcon,
  EyeIcon,
} from "$lib/icons/index.js";
import * as m from "$lib/../paraglide/messages.js";

// Capability types
export type Capability = "text" | "image" | "video" | "file" | "audio" | "tools";

// Capability configuration for display
export const capabilityConfig: Record<
  Capability,
  { icon: any; bgColor: string; iconColor: string; tooltip: string }
> = {
  text: {
    icon: TypeIcon,
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-700 dark:text-blue-300",
    tooltip: m["interface.supports_text"](),
  },
  image: {
    icon: EyeIcon,
    bgColor: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-700 dark:text-green-300",
    tooltip: m["interface.supports_image"](),
  },
  video: {
    icon: VideoIcon,
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-700 dark:text-purple-300",
    tooltip: m["interface.supports_video"](),
  },
  file: {
    icon: FileIcon,
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-700 dark:text-orange-300",
    tooltip: m["interface.file_support"](),
  },
  audio: {
    icon: AudioLinesIcon,
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
    iconColor: "text-pink-700 dark:text-pink-300",
    tooltip: m["interface.supports_audio"](),
  },
  tools: {
    icon: WrenchIcon,
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-700 dark:text-orange-300",
    tooltip: m["interface.supports_tools"](),
  },
};

/**
 * Get capabilities for a model
 * Uses architecture data when available, falls back to boolean flags
 */
export function getCapabilities(model: AIModelConfig): Capability[] {
  const caps: Capability[] = [];

  // Architecture-first approach: Use architecture data when available (OpenRouter models)
  if (model.architecture) {
    // Text capability: Check if model outputs text
    if (model.architecture.output_modalities.includes("text")) {
      caps.push("text");
    }

    // Image capability: Check if model accepts image/file inputs OR supports image generation
    if (
      model.architecture.input_modalities.includes("image") ||
      model.architecture.input_modalities.includes("file") ||
      model.supportsImageGeneration // Still check boolean for image generation
    ) {
      caps.push("image");
    }

    // Video capability: Architecture doesn't specify video, use boolean fallback
    if (model.supportsVideoGeneration) {
      caps.push("video");
    }
  } else {
    // Boolean fallback approach: For providers without architecture data (Google Gemini, etc.)

    // Text capability: Check boolean flag
    if (model.supportsTextGeneration) {
      caps.push("text");
    }

    // Image capability: Check multiple boolean flags
    if (
      model.supportsFunctions ||
      model.supportsImageGeneration ||
      model.supportsImageInput
    ) {
      caps.push("image");
    }

    // Video capability: Check boolean flag
    if (model.supportsVideoGeneration) {
      caps.push("video");
    }
  }

  return caps;
}

/**
 * Get modality styling configuration
 */
export function getModalityConfig(modality: string) {
  const modalityKey = modality.toLowerCase() as Capability;
  return capabilityConfig[modalityKey] || capabilityConfig.text; // Default to text config
}

/**
 * Create synthetic architecture data for models without native architecture data
 */
export function getSyntheticArchitecture(model: AIModelConfig): ArchitectureObject {
  const input_modalities: string[] = [];
  const output_modalities: string[] = [];

  // Map input capabilities to modalities
  if (model.supportsTextInput) input_modalities.push("text");
  if (model.supportsImageInput) input_modalities.push("image");
  if (model.supportsVideoInput) input_modalities.push("video");
  if (model.supportsAudioInput) input_modalities.push("audio");

  // Map output capabilities to modalities
  if (model.supportsTextGeneration) output_modalities.push("text");
  if (model.supportsImageGeneration) output_modalities.push("image");
  if (model.supportsVideoGeneration) output_modalities.push("video");
  if (model.supportsAudioGeneration) output_modalities.push("audio");

  return {
    input_modalities,
    output_modalities,
    tokenizer: model.provider || "Unknown",
    instruct_type: null,
  };
}

// Model data structure for grouped display
export interface ModelDisplayData {
  value: string;
  label: string;
  capabilities: Capability[];
  architecture?: ArchitectureObject;
}

export interface ModelGroup {
  provider: string;
  models: ModelDisplayData[];
}

/**
 * Group models by provider for display
 * Uses Map for O(n) performance instead of O(n²) with .find() in reduce
 */
export function groupModelsByProvider(models: AIModelConfig[]): ModelGroup[] {
  const groupMap = new Map<string, ModelGroup>();

  for (const model of models) {
    const provider = model.provider;
    let group = groupMap.get(provider);

    if (!group) {
      group = { provider, models: [] };
      groupMap.set(provider, group);
    }

    group.models.push({
      value: model.name,
      label: model.displayName,
      capabilities: getCapabilities(model),
      architecture: model.architecture,
    });
  }

  return Array.from(groupMap.values());
}

/**
 * Get input modalities for a model (for display in model selector)
 * Shows what types of input the model can accept, plus tool calling support
 * Skips 'text' since all models support text input
 */
export function getInputModalities(model: AIModelConfig): Capability[] {
  const caps: Capability[] = [];

  // Use architecture data when available
  if (model.architecture?.input_modalities) {
    for (const mod of model.architecture.input_modalities) {
      if (mod === "image" || mod === "file") {
        if (!caps.includes("image")) caps.push("image");
      }
      if (mod === "video") caps.push("video");
      if (mod === "audio") caps.push("audio");
    }
  } else {
    // Fallback to boolean flags
    if (model.supportsImageInput) caps.push("image");
    if (model.supportsVideoInput) caps.push("video");
    if (model.supportsAudioInput) caps.push("audio");
  }

  // Add tools capability if model supports function calling
  if (model.supportsFunctions) caps.push("tools");

  return caps;
}

/**
 * Filter model groups by capability
 */
export function filterModelGroups(
  groups: ModelGroup[],
  models: AIModelConfig[],
  filter: "all" | "images" | "videos"
): ModelGroup[] {
  return groups
    .map((group) => {
      const filteredModels = group.models.filter((model) => {
        const foundModel = models.find((m) => m.name === model.value);
        if (!foundModel) return false;

        switch (filter) {
          case "images":
            return foundModel.supportsImageGeneration === true;
          case "videos":
            return foundModel.supportsVideoGeneration === true;
          case "all":
          default:
            return true;
        }
      });

      return {
        ...group,
        models: filteredModels,
      };
    })
    .filter((group) => group.models.length > 0);
}
