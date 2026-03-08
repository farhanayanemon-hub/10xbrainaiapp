<script lang="ts">
	import { cn } from "$lib/utils";
	import { Streamdown, type StreamdownProps } from "svelte-streamdown";
	import Code from "svelte-streamdown/code"; // Shiki syntax highlighting
	import { mode } from "mode-watcher";
	import type { HTMLAttributes } from "svelte/elements";

	// Import Shiki themes
	import githubLightDefault from "@shikijs/themes/github-light-default";
	import githubDarkDefault from "@shikijs/themes/github-dark-default";

	type Props = {
		content: string;
		class?: string;
	} & Omit<StreamdownProps, "content" | "class"> &
		Omit<HTMLAttributes<HTMLDivElement>, "content">;

	let { content, class: className, ...restProps }: Props = $props();
	let currentTheme = $derived(
		mode.current === "dark" ? "github-dark-default" : "github-light-default"
	);

	/**
	 * Render HTML tokens as escaped text so they display visibly instead of being dropped.
	 * svelte-streamdown silently drops HTML tokens when renderHtml is not enabled,
	 * so we provide a custom renderer that escapes the HTML for safe display.
	 * This allows users to share code snippets like <script> tags without them disappearing.
	 */
	function renderHtmlAsText(token: { raw: string }): string {
		// Escape HTML characters so they render as visible text
		return token.raw
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	/**
	 * Convert single newlines to markdown line breaks (two spaces + newline).
	 * In standard markdown, a single newline is treated as a space within a paragraph.
	 * This function makes newlines behave as users expect (each line on its own line).
	 * Code blocks are preserved as-is to maintain proper formatting.
	 */
	function convertNewlinesToBreaks(text: string): string {
		if (!text) return '';

		// Split by fenced code blocks to preserve them
		const codeBlockRegex = /(```[\s\S]*?```)/g;
		const segments = text.split(codeBlockRegex);

		return segments.map((segment) => {
			if (segment.startsWith('```') && segment.endsWith('```')) {
				return segment; // Preserve code blocks exactly as-is
			}
			// Convert single newlines to markdown line breaks (two spaces + newline)
			// Lookbehind (?<!\n) ensures we don't match the first \n of a double newline
			// Lookahead (?!\n) ensures we don't match the second \n of a double newline
			return segment.replace(/(?<!\n)\n(?!\n)/g, '  \n');
		}).join('');
	}

	// Process content: convert newlines to breaks for proper display
	let processedContent = $derived(convertNewlinesToBreaks(content));
</script>

<div class={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
	<Streamdown
		content={processedContent}
		shikiTheme={currentTheme}
		baseTheme="shadcn"
		components={{ code: Code }}
		shikiThemes={{
			"github-light-default": githubLightDefault,
			"github-dark-default": githubDarkDefault,
		}}
		renderHtml={renderHtmlAsText}
		{...restProps}
	/>
</div>
