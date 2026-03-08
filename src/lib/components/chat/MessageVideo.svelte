<script lang="ts">
	interface Props {
		videoId: string;
		class?: string;
	}

	let { videoId, class: className = "" }: Props = $props();
</script>

<div class="border rounded-lg overflow-hidden max-w-2xl {className}">
	<video
		src={`/api/videos/${videoId}`}
		class="w-full h-auto max-h-96"
		controls
		preload="metadata"
		poster=""
	>
		Your browser does not support the video tag.
		<track kind="captions" />
	</video>
</div>
