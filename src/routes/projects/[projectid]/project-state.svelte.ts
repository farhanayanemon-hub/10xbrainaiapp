import { toast } from "svelte-sonner";
import * as m from "$lib/../paraglide/messages.js";

export interface Project {
	id: string;
	name: string;
	description: string | null;
	customInstructions: string | null;
	fileCount: number;
	chatCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface ProjectFile {
	id: string;
	filename: string;
	mimeType: string;
	fileSize: number;
	createdAt: string;
}

export interface ProjectChat {
	id: string;
	title: string;
	model: string;
	createdAt: string;
	updatedAt: string;
}

const ALLOWED_MIME_TYPES = [
	'text/plain',
	'text/markdown',
	'text/csv',
	'application/json',
	'text/html',
	'text/css',
	'text/javascript',
	'application/javascript',
	'application/xml',
	'text/xml',
	'text/yaml',
	'application/x-yaml',
];

const MAX_FILE_SIZE = 100 * 1024; // 100KB
const MAX_FILES = 10;

export class ProjectState {
	// Project data
	project = $state<Project | null>(null);
	projectId = $state<string>("");

	// Custom instructions
	customInstructions = $state("");
	isSavingInstructions = $state(false);

	// Files
	files = $state<ProjectFile[]>([]);
	isUploadingFile = $state(false);

	// Project chats
	projectChats = $state<ProjectChat[]>([]);
	isLoadingChats = $state(false);

	// Edit mode
	isEditingName = $state(false);
	editingName = $state("");
	isEditingDescription = $state(false);
	editingDescription = $state("");
	isSavingName = $state(false);
	isSavingDescription = $state(false);

	// Delete
	showDeleteDialog = $state(false);
	isDeleting = $state(false);

	// Derived
	fileCount = $derived(this.files.length);
	canUploadMore = $derived(this.files.length < MAX_FILES);

	constructor(projectId: string, project?: Project) {
		this.projectId = projectId;
		if (project) {
			this.project = project;
			this.customInstructions = project.customInstructions || "";
		}
	}

	async loadFiles() {
		try {
			const response = await fetch(`/api/projects/${this.projectId}/files`);
			if (response.ok) {
				const data = await response.json();
				this.files = data.files;
			}
		} catch (err) {
			console.error("Failed to load project files:", err);
		}
	}

	async loadChats() {
		try {
			this.isLoadingChats = true;
			const response = await fetch(`/api/projects/${this.projectId}/chats`);
			if (response.ok) {
				const data = await response.json();
				this.projectChats = data.chats;
			}
		} catch (err) {
			console.error("Failed to load project chats:", err);
		} finally {
			this.isLoadingChats = false;
		}
	}

	async saveCustomInstructions() {
		try {
			this.isSavingInstructions = true;
			const response = await fetch(`/api/projects/${this.projectId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ customInstructions: this.customInstructions }),
			});

			if (response.ok) {
				const data = await response.json();
				this.project = { ...this.project!, ...data.project };
				toast.success(m['projects.instructions_saved']());
			} else {
				const err = await response.json();
				toast.error(err.error || "Failed to save instructions");
			}
		} catch (err) {
			console.error("Failed to save custom instructions:", err);
			toast.error("Failed to save instructions");
		} finally {
			this.isSavingInstructions = false;
		}
	}

	async uploadFile(file: File) {
		if (!this.canUploadMore) {
			toast.error(m['projects.max_files_reached']());
			return;
		}

		if (file.size > MAX_FILE_SIZE) {
			toast.error(m['projects.file_too_large']());
			return;
		}

		if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.match(/\.(txt|md|csv|json|html|css|js|ts|xml|yaml|yml|py|rb|go|rs|java|c|cpp|h|sh|sql|env|toml|ini|cfg)$/i)) {
			toast.error(m['projects.unsupported_file_type']());
			return;
		}

		try {
			this.isUploadingFile = true;
			const content = await file.text();
			const mimeType = file.type || 'text/plain';

			const response = await fetch(`/api/projects/${this.projectId}/files`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					filename: file.name,
					content,
					mimeType,
				}),
			});

			if (response.ok) {
				const data = await response.json();
				this.files = [...this.files, data.file];
				toast.success(m['projects.file_uploaded']());
			} else {
				const err = await response.json();
				toast.error(err.error || "Failed to upload file");
			}
		} catch (err) {
			console.error("Failed to upload file:", err);
			toast.error("Failed to upload file");
		} finally {
			this.isUploadingFile = false;
		}
	}

	async deleteFile(fileId: string) {
		try {
			const response = await fetch(`/api/projects/${this.projectId}/files/${fileId}`, {
				method: "DELETE",
			});

			if (response.ok) {
				this.files = this.files.filter(f => f.id !== fileId);
				toast.success(m['projects.file_deleted']());
			} else {
				const err = await response.json();
				toast.error(err.error || "Failed to delete file");
			}
		} catch (err) {
			console.error("Failed to delete file:", err);
			toast.error("Failed to delete file");
		}
	}

	async saveName() {
		if (!this.editingName.trim()) {
			toast.error(m['projects.name_required']());
			return;
		}

		try {
			this.isSavingName = true;
			const response = await fetch(`/api/projects/${this.projectId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: this.editingName.trim() }),
			});

			if (response.ok) {
				const data = await response.json();
				this.project = { ...this.project!, ...data.project };
				this.isEditingName = false;
			} else {
				const err = await response.json();
				toast.error(err.error || "Failed to update name");
			}
		} catch (err) {
			console.error("Failed to save name:", err);
			toast.error("Failed to update name");
		} finally {
			this.isSavingName = false;
		}
	}

	async saveDescription() {
		try {
			this.isSavingDescription = true;
			const response = await fetch(`/api/projects/${this.projectId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ description: this.editingDescription.trim() }),
			});

			if (response.ok) {
				const data = await response.json();
				this.project = { ...this.project!, ...data.project };
				this.isEditingDescription = false;
			} else {
				const err = await response.json();
				toast.error(err.error || "Failed to update description");
			}
		} catch (err) {
			console.error("Failed to save description:", err);
			toast.error("Failed to update description");
		} finally {
			this.isSavingDescription = false;
		}
	}

	startEditingName() {
		this.editingName = this.project?.name || "";
		this.isEditingName = true;
	}

	cancelEditingName() {
		this.isEditingName = false;
	}

	startEditingDescription() {
		this.editingDescription = this.project?.description || "";
		this.isEditingDescription = true;
	}

	cancelEditingDescription() {
		this.isEditingDescription = false;
	}

	async deleteProject(): Promise<boolean> {
		try {
			this.isDeleting = true;
			const response = await fetch(`/api/projects/${this.projectId}`, {
				method: "DELETE",
			});

			if (response.ok) {
				toast.success(m['projects.project_deleted']());
				return true;
			} else {
				const err = await response.json();
				toast.error(err.error || "Failed to delete project");
				return false;
			}
		} catch (err) {
			console.error("Failed to delete project:", err);
			toast.error("Failed to delete project");
			return false;
		} finally {
			this.isDeleting = false;
			this.showDeleteDialog = false;
		}
	}

	formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}
}
