/**
 * Copy text to clipboard using the Clipboard API
 * Falls back to document.execCommand for older browsers
 *
 * @param text - The text to copy to clipboard
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	// Try modern Clipboard API first
	if (navigator.clipboard && window.isSecureContext) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// Fall through to fallback
		}
	}

	// Fallback for older browsers or non-secure contexts
	try {
		const textArea = document.createElement("textarea");
		textArea.value = text;

		// Make the textarea invisible but still functional
		textArea.style.position = "fixed";
		textArea.style.left = "-999999px";
		textArea.style.top = "-999999px";
		textArea.setAttribute("aria-hidden", "true");

		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();

		const success = document.execCommand("copy");
		document.body.removeChild(textArea);

		return success;
	} catch {
		return false;
	}
}
