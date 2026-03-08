import type { AIMessage } from "$lib/ai/types.js";

/**
 * FileUIPart type compatible with AI Elements MessageAttachment
 */
export interface FileUIPart {
	type: "file";
	filename?: string;
	mediaType?: string;
	url?: string;
}

/**
 * Internal type for image objects extracted from messages
 */
export interface ImageItem {
	imageId?: string;
	imageData?: string;
	mimeType: string;
}

/**
 * Count the number of images in a message
 */
export function getImageCount(message: AIMessage): number {
	if (message.images?.length) return message.images.length;
	if (message.imageIds?.length) return message.imageIds.length;
	if (message.imageId || message.imageUrl || message.imageData) return 1;
	return 0;
}

/**
 * Extract all images from a message as an array
 */
export function getAllImages(message: AIMessage): ImageItem[] {
	if (message.images?.length) return message.images;
	if (message.imageIds?.length)
		return message.imageIds.map(
			(id: string): ImageItem => ({
				imageId: id,
				imageData: undefined,
				mimeType: "",
			})
		);
	if (message.imageId || message.imageData)
		return [
			{
				imageId: message.imageId,
				imageData: message.imageData,
				mimeType: message.mimeType || "",
			},
		];
	return [];
}

/**
 * Convert an ImageItem to FileUIPart format for MessageAttachment
 */
export function imageToFileUIPart(image: ImageItem): FileUIPart {
	let url: string;
	if (image.imageId) {
		url = `/api/images/${image.imageId}`;
	} else if (image.imageData) {
		url = `data:${image.mimeType || "image/png"};base64,${image.imageData}`;
	} else {
		url = "";
	}

	return {
		type: "file",
		mediaType: image.mimeType || "image/png",
		url,
	};
}

/**
 * Get the image URL for a single image from a message
 */
export function getSingleImageUrl(message: AIMessage): string {
	if (message.imageId) {
		return `/api/images/${message.imageId}`;
	}
	if (message.imageUrl) {
		return message.imageUrl;
	}
	if (message.imageData) {
		return `data:${message.mimeType || "image/png"};base64,${message.imageData}`;
	}
	return "";
}
