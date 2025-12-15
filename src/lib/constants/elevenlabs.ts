// This file contains client-safe constants that can be imported in both server and client code

// ElevenLabs TTS Models
// These are the available text-to-speech models
export const ELEVENLABS_TTS_MODELS = [
	{ id: 'eleven_multilingual_v2', name: 'Eleven Multilingual v2' },
	{ id: 'eleven_flash_v2_5', name: 'Eleven Flash v2.5' },
	{ id: 'eleven_turbo_v2_5', name: 'Eleven Turbo v2.5' },
	{ id: 'eleven_turbo_v2', name: 'Eleven Turbo v2' },
	{ id: 'eleven_flash_v2', name: 'Eleven Flash v2' }
] as const;

// ElevenLabs pre-made voices with their IDs
// These are the default voices available to all users
export const ELEVENLABS_VOICES = [
	{ id: '2EiwWnXFnvU5JabPnv8n', name: 'Clyde', description: 'Great for character use-cases' },
	{ id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', description: 'Easy going and perfect for casual conversations' },
	{ id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Young adult woman with a confident and warm professional tone' },
	{ id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', description: 'Young adult female voice delivers sunny enthusiasm' },
	{ id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'A young Australian male with a confident and energetic tone' },
	{ id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Warm resonance that instantly captivates listeners' },
	{ id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', description: 'Deceptively gravelly, yet unsettling edge' },
	{ id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', description: 'A relaxed, neutral voice' },
	{ id: 'SOYHLrjzK2X1ezoPC6cr', name: 'Harry', description: 'An animated warrior ready to charge forward' },
	{ id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'A young adult with energy and warmth' },
	{ id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'Clear and engaging, friendly woman with a British accent' },
	{ id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', description: 'A professional woman with a pleasing alto pitch' },
	{ id: 'bIHbv24MWmeRgasZH58o', name: 'Will', description: 'Conversational and laid back' },
	{ id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', description: 'Young and popular, playful American female voice' },
	{ id: 'cjVigY5qzO86Huf0OWal', name: 'Eric', description: 'A smooth tenor pitch from a man in his forties' },
	{ id: 'iP95p4xoKVk53GoZ742B', name: 'Chris', description: 'Natural and real, down-to-earth voice' },
	{ id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', description: 'Middle-aged man with a resonant and comforting voice' },
	{ id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'A strong voice perfect for delivering a professional broadcast or news' },
	{ id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'Velvety British female voice perfect for delivering news with warmth and clarity' },
	{ id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'A bright tenor pitch that immediatelly cuts through' },
	{ id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', description: 'Friendly and comforting voice ready to narrate stories' }
] as const;

// ElevenLabs STT Models
// These are the available speech-to-text models
export const ELEVENLABS_STT_MODELS = [
	{ id: 'scribe_v1', name: 'Scribe v1' }
] as const;

// ElevenLabs STS (Speech-to-Speech) Models
// These are the available voice changer models
export const ELEVENLABS_STS_MODELS = [
	{ id: 'eleven_multilingual_sts_v2', name: 'Eleven Multilingual STS v2' },
	{ id: 'eleven_english_sts_v2', name: 'Eleven English STS v2' }
] as const;

// ElevenLabs Music Models
// These are the available music generation models
export const ELEVENLABS_MUSIC_MODELS = [
	{ id: 'music_v1', name: 'Music v1' }
] as const;

// ElevenLabs Sound Effects Models
// These are the available sound effects generation models
export const ELEVENLABS_SOUND_EFFECTS_MODELS = [
	{ id: 'sound_effects_v1', name: 'Sound Effects v1' }
] as const;

// Type exports for use in other modules
export type ElevenLabsTTSModel = (typeof ELEVENLABS_TTS_MODELS)[number];
export type ElevenLabsVoice = (typeof ELEVENLABS_VOICES)[number];
export type ElevenLabsSTTModel = (typeof ELEVENLABS_STT_MODELS)[number];
export type ElevenLabsSTSModel = (typeof ELEVENLABS_STS_MODELS)[number];
export type ElevenLabsMusicModel = (typeof ELEVENLABS_MUSIC_MODELS)[number];
export type ElevenLabsSoundEffectsModel = (typeof ELEVENLABS_SOUND_EFFECTS_MODELS)[number];
