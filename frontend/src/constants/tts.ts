import type { TTSSettings, TTSModelSettings } from '../types'

export interface TTSModelMeta {
  id: string
  label: string
  supportsInstructions: boolean
  supportsDialogueVoice: boolean
  pricePer1K: number
}

export const TTS_MODELS: TTSModelMeta[] = [
  { id: 'Kokoro-82m', label: 'Kokoro-82m (cheapest)', supportsInstructions: false, supportsDialogueVoice: false, pricePer1K: 0.001 },
  { id: 'gpt-4o-mini-tts', label: 'GPT-4o mini TTS (cheap, streams)', supportsInstructions: true, supportsDialogueVoice: false, pricePer1K: 0.0006 },
  { id: 'tts-1', label: 'OpenAI TTS-1', supportsInstructions: false, supportsDialogueVoice: false, pricePer1K: 0.015 },
  { id: 'tts-1-hd', label: 'OpenAI TTS-1 HD', supportsInstructions: true, supportsDialogueVoice: false, pricePer1K: 0.030 },
  { id: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS (expressive)', supportsInstructions: true, supportsDialogueVoice: true, pricePer1K: 0.051 },
]

export interface TTSVoiceMeta {
  id: string
  label: string
}

export const TTS_VOICES: Record<string, TTSVoiceMeta[]> = {
  'Kokoro-82m': [
    // American English — female
    { id: 'af_heart', label: 'af_heart (US F)' },
    { id: 'af_bella', label: 'af_bella (US F)' },
    { id: 'af_nicole', label: 'af_nicole (US F)' },
    { id: 'af_aoede', label: 'af_aoede (US F)' },
    { id: 'af_kore', label: 'af_kore (US F)' },
    { id: 'af_sarah', label: 'af_sarah (US F)' },
    { id: 'af_nova', label: 'af_nova (US F)' },
    { id: 'af_sky', label: 'af_sky (US F)' },
    { id: 'af_alloy', label: 'af_alloy (US F)' },
    { id: 'af_jessica', label: 'af_jessica (US F)' },
    { id: 'af_river', label: 'af_river (US F)' },
    // American English — male
    { id: 'am_michael', label: 'am_michael (US M)' },
    { id: 'am_fenrir', label: 'am_fenrir (US M)' },
    { id: 'am_puck', label: 'am_puck (US M)' },
    { id: 'am_echo', label: 'am_echo (US M)' },
    { id: 'am_eric', label: 'am_eric (US M)' },
    { id: 'am_liam', label: 'am_liam (US M)' },
    { id: 'am_onyx', label: 'am_onyx (US M)' },
    { id: 'am_santa', label: 'am_santa (US M)' },
    { id: 'am_adam', label: 'am_adam (US M)' },
    // British English
    { id: 'bf_emma', label: 'bf_emma (UK F)' },
    { id: 'bf_isabella', label: 'bf_isabella (UK F)' },
    { id: 'bf_alice', label: 'bf_alice (UK F)' },
    { id: 'bf_lily', label: 'bf_lily (UK F)' },
    { id: 'bm_george', label: 'bm_george (UK M)' },
    { id: 'bm_fable', label: 'bm_fable (UK M)' },
    { id: 'bm_lewis', label: 'bm_lewis (UK M)' },
    { id: 'bm_daniel', label: 'bm_daniel (UK M)' },
    // Japanese
    { id: 'jf_alpha', label: 'jf_alpha (JP F)' },
    { id: 'jf_gongitsune', label: 'jf_gongitsune (JP F)' },
    { id: 'jf_nezumi', label: 'jf_nezumi (JP F)' },
    { id: 'jf_tebukuro', label: 'jf_tebukuro (JP F)' },
    { id: 'jm_kumo', label: 'jm_kumo (JP M)' },
    // Mandarin
    { id: 'zf_xiaobei', label: 'zf_xiaobei (ZH F)' },
    { id: 'zf_xiaoni', label: 'zf_xiaoni (ZH F)' },
    { id: 'zf_xiaoxiao', label: 'zf_xiaoxiao (ZH F)' },
    { id: 'zf_xiaoyi', label: 'zf_xiaoyi (ZH F)' },
    { id: 'zm_yunjian', label: 'zm_yunjian (ZH M)' },
    { id: 'zm_yunxi', label: 'zm_yunxi (ZH M)' },
    { id: 'zm_yunxia', label: 'zm_yunxia (ZH M)' },
    { id: 'zm_yunyang', label: 'zm_yunyang (ZH M)' },
    // Others
    { id: 'ef_dora', label: 'ef_dora (ES F)' },
    { id: 'em_alex', label: 'em_alex (ES M)' },
    { id: 'ff_siwis', label: 'ff_siwis (FR F)' },
    { id: 'hf_alpha', label: 'hf_alpha (HI F)' },
    { id: 'hf_beta', label: 'hf_beta (HI F)' },
    { id: 'hm_omega', label: 'hm_omega (HI M)' },
    { id: 'hm_psi', label: 'hm_psi (HI M)' },
    { id: 'if_sara', label: 'if_sara (IT F)' },
    { id: 'im_nicola', label: 'im_nicola (IT M)' },
    { id: 'pf_dora', label: 'pf_dora (PT F)' },
    { id: 'pm_alex', label: 'pm_alex (PT M)' },
  ],

  'gpt-4o-mini-tts': openAIVoices(),
  'tts-1': openAIVoices(),
  'tts-1-hd': openAIVoices(),

  'gemini-2.5-flash-preview-tts': [
    { id: 'Achernar', label: 'Achernar' },
    { id: 'Achird', label: 'Achird' },
    { id: 'Algenib', label: 'Algenib' },
    { id: 'Algieba', label: 'Algieba' },
    { id: 'Alnilam', label: 'Alnilam' },
    { id: 'Aoede', label: 'Aoede' },
    { id: 'Autonoe', label: 'Autonoe' },
    { id: 'Callirhoe', label: 'Callirhoe' },
    { id: 'Charon', label: 'Charon' },
    { id: 'Despina', label: 'Despina' },
    { id: 'Enceladus', label: 'Enceladus' },
    { id: 'Erinome', label: 'Erinome' },
    { id: 'Fenrir', label: 'Fenrir' },
    { id: 'Gacrux', label: 'Gacrux' },
    { id: 'Iapetus', label: 'Iapetus' },
    { id: 'Kore', label: 'Kore' },
    { id: 'Laomedeia', label: 'Laomedeia' },
    { id: 'Leda', label: 'Leda' },
    { id: 'Orus', label: 'Orus' },
    { id: 'Puck', label: 'Puck' },
    { id: 'Pulcherrima', label: 'Pulcherrima' },
    { id: 'Rasalgethi', label: 'Rasalgethi' },
    { id: 'Sadachbia', label: 'Sadachbia' },
  ],
}

function openAIVoices(): TTSVoiceMeta[] {
  return [
    { id: 'alloy', label: 'alloy' },
    { id: 'ash', label: 'ash' },
    { id: 'ballad', label: 'ballad' },
    { id: 'coral', label: 'coral' },
    { id: 'echo', label: 'echo' },
    { id: 'fable', label: 'fable' },
    { id: 'nova', label: 'nova' },
    { id: 'onyx', label: 'onyx' },
    { id: 'sage', label: 'sage' },
    { id: 'shimmer', label: 'shimmer' },
    { id: 'verse', label: 'verse' },
  ]
}

export const DEFAULT_VOICE_BY_MODEL: Record<string, string> = {
  'Kokoro-82m': 'af_bella',
  'gpt-4o-mini-tts': 'nova',
  'tts-1': 'nova',
  'tts-1-hd': 'nova',
  'gemini-2.5-flash-preview-tts': 'Kore',
}

export const DEFAULT_TTS_SETTINGS: TTSSettings = {
  autoPlay: false,
  activeModel: 'Kokoro-82m',
  perModel: {},
}

export function getModelMeta(modelId: string): TTSModelMeta {
  return TTS_MODELS.find(m => m.id === modelId) || TTS_MODELS[0]
}

export function getModelSettings(tts: TTSSettings | undefined, modelId: string): TTSModelSettings {
  const perModel = tts?.perModel || {}
  const saved = perModel[modelId] || {}
  return {
    voice: saved.voice || DEFAULT_VOICE_BY_MODEL[modelId] || 'nova',
    speed: saved.speed || 1.0,
    instructions: saved.instructions || '',
    dialogueVoice: saved.dialogueVoice || '',
  }
}
