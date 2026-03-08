<script lang="ts">
  import { getContext } from "svelte";

  // UI Components
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";

  // Shared components
  import ChatInterface from "$lib/components/ChatInterface.svelte";
  import type { ChatState } from "$lib/components/chat-state.svelte.js";
  import type { SettingsState } from "$lib/stores/settings.svelte.js";
  import * as m from "$lib/../paraglide/messages.js";
  import { removeWebSearchSuffix, supportsWebSearch } from "$lib/constants/web-search.js";

  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  // Get chat state and settings from context (provided by layout)
  const chatState = getContext<ChatState>("chatState");
  const settingsState = getContext<SettingsState>("settings");

  // Track which chat we've loaded to detect navigation changes
  let lastLoadedChatId: string | null = null;

  // Load the specific chat when page loads or when navigating to a different chat
  $effect(() => {
    const chatId = data.chatId;
    const chat = data.chat;

    if (chat && chatId !== lastLoadedChatId) {
      // Check if this is the same chat we're already loading/streaming
      // This prevents race conditions when navigation happens during handleSubmit
      const isSameChat = chatState.currentChatId === chatId;

      // Update tracking
      lastLoadedChatId = chatId;

      // Set chat data from the page load
      chatState.currentChatId = chatId;

      // Detect if the stored model had web search enabled (has :online suffix)
      const storedModel = chat.model;
      const hadWebSearchEnabled = storedModel.endsWith(':online');

      // Strip :online suffix if present (web search enabled chats store model with suffix)
      chatState.selectedModel = removeWebSearchSuffix(storedModel);
      chatState.previousModel = removeWebSearchSuffix(storedModel);

      // Restore web search state based on stored model
      // Only enable if both: stored model had :online AND current model still supports it
      chatState.webSearchEnabled = hadWebSearchEnabled && supportsWebSearch(chatState.selectedModel);

      // Only clear tool selection if this is NOT a fresh chat creation
      if (!chatState.isFreshChat) {
        chatState.clearSelectedTool();
      }

      // Reset the fresh chat flag after handling
      chatState.resetFreshChatFlag();

      // Set branch state for current chat
      chatState.currentChatIsBranch = chat.isBranch || false;
      chatState.currentChatBranchAtIndex = chat.branchAtIndex ?? null;
      chatState.currentChatBranchSourceId = chat.branchSourceChatId ?? null;
      // Look up source chat title from chat history if available
      if (chat.branchSourceChatId) {
        const sourceChat = chatState.chatHistory.find(c => c.id === chat.branchSourceChatId);
        chatState.currentChatBranchSourceTitle = sourceChat?.title ?? null;
      } else {
        chatState.currentChatBranchSourceTitle = null;
      }

      // Only load messages from database if NOT actively loading/streaming
      // This prevents overwriting the in-progress streaming response
      // Also skip if this is the same chat we navigated from (handleSubmit initiated this navigation)
      if (!chatState.isStreamingContent && !chatState.isLoading && !isSameChat) {
        chatState.messages = chat.messages.map((msg: any) => ({
          ...msg,
          content: chatState.cleanMessageContent(msg.content),
        }));
      }
    }
  });
</script>

<svelte:head>
  <title>Chat - {settingsState.siteName}</title>
  <meta name="description" content={settingsState.siteDescription} />
</svelte:head>

<!-- Main Chat Interface -->
<ChatInterface />

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root open={chatState.deletingChatId !== null}>
  <AlertDialog.Content class="z-[100]">
    <AlertDialog.Header>
      <AlertDialog.Title>{m['chat.delete_chat_title']()}</AlertDialog.Title>
      <AlertDialog.Description>
        {m['chat.delete_chat_description']()}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={() => chatState.cancelDelete()}
        >{m['chat.cancel']()}</AlertDialog.Cancel
      >
      <AlertDialog.Action
        onclick={() => chatState.confirmDeleteChat()}
        class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        {m['chat.delete']()}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Model Change Confirmation Dialog -->
<AlertDialog.Root open={chatState.showModelChangeDialog}>
  <AlertDialog.Content class="z-[100]">
    <AlertDialog.Header>
      <AlertDialog.Title>{m['chat.switch_model_title']()}</AlertDialog.Title>
      <AlertDialog.Description>
        {m['chat.switch_model_description']()}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={() => chatState.cancelModelChange()}
        >{m['chat.cancel']()}</AlertDialog.Cancel
      >
      <AlertDialog.Action onclick={() => chatState.confirmModelChange()}>
        {m['chat.start_new_chat']()}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
