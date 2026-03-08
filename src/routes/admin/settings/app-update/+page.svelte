<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import {
    UploadIcon,
    DownloadIcon,
    CheckIcon,
    AlertTriangleIcon,
    ShieldIcon,
    FileIcon,
    LoaderIcon,
  } from "$lib/icons/index.js";

  let fileInput: HTMLInputElement;
  let selectedFile: File | null = $state(null);
  let uploading = $state(false);
  let uploadProgress = $state(0);
  let downloading = $state(false);
  let downloadError = $state("");
  let result: {
    success: boolean;
    message: string;
    details?: {
      filesUpdated: number;
      filesSkipped: number;
      skippedPaths: string[];
      npmInstall: string;
    };
  } | null = $state(null);
  let errorMessage = $state("");

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (!file.name.endsWith(".zip")) {
        errorMessage = "Only .zip files are accepted.";
        selectedFile = null;
        return;
      }
      if (file.size > 500 * 1024 * 1024) {
        errorMessage = "File too large. Maximum size is 500MB.";
        selectedFile = null;
        return;
      }
      selectedFile = file;
      errorMessage = "";
      result = null;
    }
  }

  function clearFile() {
    selectedFile = null;
    errorMessage = "";
    result = null;
    if (fileInput) {
      fileInput.value = "";
    }
  }

  async function uploadFile() {
    if (!selectedFile) return;

    uploading = true;
    uploadProgress = 0;
    errorMessage = "";
    result = null;

    try {
      const formData = new FormData();
      formData.append("zipFile", selectedFile);

      uploadProgress = 30;

      const response = await fetch("/api/admin/app-update", {
        method: "POST",
        body: formData,
      });

      uploadProgress = 80;

      const data = await response.json();

      uploadProgress = 100;

      if (response.ok) {
        result = data;
      } else {
        errorMessage = data.message || "Upload failed. Please try again.";
      }
    } catch (err: any) {
      errorMessage = err.message || "An unexpected error occurred.";
    } finally {
      uploading = false;
    }
  }

  async function downloadBackup() {
    downloading = true;
    downloadError = "";

    try {
      const response = await fetch("/api/admin/app-backup");

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: "Download failed" }));
        downloadError = data.message || "Failed to create backup.";
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      let filename = "app-backup.tar.gz";
      if (disposition) {
        const match = disposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      downloadError = err.message || "An unexpected error occurred.";
    } finally {
      downloading = false;
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-xl font-bold">App Update</h2>
    <p class="text-muted-foreground mt-1">
      Upload a new version of the application code via zip file.
    </p>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <ShieldIcon class="w-5 h-5 text-green-500" />
        What's Preserved During Update
      </Card.Title>
    </Card.Header>
    <Card.Content>
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <h4 class="font-semibold text-green-500 mb-2 flex items-center gap-1">
            <CheckIcon class="w-4 h-4" />
            Preserved (Safe)
          </h4>
          <ul class="space-y-1 text-sm text-muted-foreground">
            <li>Database & all user data</li>
            <li>Environment variables & secrets</li>
            <li>Uploaded media files</li>
            <li>Admin settings & configurations</li>
            <li>Drizzle database config</li>
            <li>Git history</li>
            <li>Backup files</li>
          </ul>
        </div>
        <div>
          <h4
            class="font-semibold text-yellow-500 mb-2 flex items-center gap-1"
          >
            <AlertTriangleIcon class="w-4 h-4" />
            Replaced (Updated)
          </h4>
          <ul class="space-y-1 text-sm text-muted-foreground">
            <li>Source code (src/ directory)</li>
            <li>Static assets</li>
            <li>Package dependencies (package.json)</li>
            <li>Build configuration files</li>
            <li>Svelte & Vite config</li>
          </ul>
        </div>
      </div>
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <DownloadIcon class="w-5 h-5" />
        Download Current Backup
      </Card.Title>
      <Card.Description>
        Download a backup of your current app source code before updating.
        This allows you to restore the previous version if needed.
      </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      <div class="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileIcon class="w-5 h-5 text-primary" />
          </div>
          <div>
            <p class="font-medium text-sm">Current App Source Code</p>
            <p class="text-xs text-muted-foreground">
              Includes src/, static/, configs (excludes node_modules, .git, uploads)
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          disabled={downloading}
          onclick={downloadBackup}
        >
          {#if downloading}
            <LoaderIcon class="w-4 h-4 animate-spin mr-2" />
            Creating...
          {:else}
            <DownloadIcon class="w-4 h-4 mr-2" />
            Download Backup
          {/if}
        </Button>
      </div>

      {#if downloadError}
        <div class="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangleIcon class="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p class="text-sm text-muted-foreground">{downloadError}</p>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <UploadIcon class="w-5 h-5" />
        Upload New Version
      </Card.Title>
      <Card.Description>
        Upload a .zip file containing the updated project. The zip should
        contain a valid SvelteKit project with package.json and src/ directory.
      </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      <div
        class="border-2 border-dashed rounded-lg p-8 text-center transition-colors {selectedFile
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-muted-foreground/50'}"
      >
        {#if selectedFile}
          <div class="space-y-2">
            <FileIcon class="w-10 h-10 mx-auto text-primary" />
            <p class="font-medium">{selectedFile.name}</p>
            <p class="text-sm text-muted-foreground">
              {formatFileSize(selectedFile.size)}
            </p>
            <Button variant="ghost" size="sm" onclick={clearFile}>
              Remove
            </Button>
          </div>
        {:else}
          <div class="space-y-3">
            <UploadIcon class="w-10 h-10 mx-auto text-muted-foreground" />
            <div>
              <p class="font-medium">Drop your zip file here or click to browse</p>
              <p class="text-sm text-muted-foreground mt-1">
                Accepts .zip files up to 500MB
              </p>
            </div>
            <Button
              variant="outline"
              onclick={() => fileInput?.click()}
            >
              Choose File
            </Button>
          </div>
        {/if}

        <input
          bind:this={fileInput}
          type="file"
          accept=".zip"
          class="hidden"
          onchange={handleFileSelect}
        />
      </div>

      {#if uploading}
        <div class="space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span class="flex items-center gap-2">
              <LoaderIcon class="w-4 h-4 animate-spin" />
              {uploadProgress < 80 ? "Uploading and extracting..." : "Installing dependencies..."}
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div class="w-full bg-muted rounded-full h-2">
            <div
              class="bg-primary h-2 rounded-full transition-all duration-500"
              style="width: {uploadProgress}%"
            ></div>
          </div>
        </div>
      {/if}

      {#if errorMessage}
        <div
          class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3"
        >
          <AlertTriangleIcon class="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p class="font-medium text-destructive">Update Failed</p>
            <p class="text-sm text-muted-foreground mt-1">{errorMessage}</p>
          </div>
        </div>
      {/if}

      {#if result?.success}
        <div
          class="bg-green-500/10 border border-green-500/20 rounded-lg p-4 space-y-3"
        >
          <div class="flex items-start gap-3">
            <CheckIcon class="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <p class="font-medium text-green-500">Update Successful!</p>
              <p class="text-sm text-muted-foreground mt-1">{result.message}</p>
            </div>
          </div>
          {#if result.details}
            <div class="flex flex-wrap gap-2 ml-8">
              <Badge variant="secondary">
                {result.details.filesUpdated} files updated
              </Badge>
              <Badge variant="secondary">
                {result.details.filesSkipped} files preserved
              </Badge>
            </div>
          {/if}
        </div>
      {/if}

      <div class="flex justify-end">
        <Button
          disabled={!selectedFile || uploading}
          onclick={uploadFile}
          class="min-w-[140px]"
        >
          {#if uploading}
            <LoaderIcon class="w-4 h-4 animate-spin mr-2" />
            Updating...
          {:else}
            <UploadIcon class="w-4 h-4 mr-2" />
            Upload & Update
          {/if}
        </Button>
      </div>
    </Card.Content>
  </Card.Root>

  <Card.Root class="border-yellow-500/30">
    <Card.Content class="p-4">
      <div class="flex items-start gap-3">
        <AlertTriangleIcon
          class="w-5 h-5 text-yellow-500 shrink-0 mt-0.5"
        />
        <div class="text-sm text-muted-foreground">
          <p class="font-medium text-yellow-500 mb-1">Important Notes</p>
          <ul class="list-disc list-inside space-y-1">
            <li>
              Always backup your current setup before updating.
            </li>
            <li>
              The application will need to be restarted after a successful
              update.
            </li>
            <li>
              If the update causes issues, you can restore from the backup
              created during the update process.
            </li>
            <li>
              Make sure your zip file contains a compatible version of the app.
            </li>
          </ul>
        </div>
      </div>
    </Card.Content>
  </Card.Root>
</div>
