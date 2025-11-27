# Gemini API Integration

This document explains how to use Google's Gemini API with Binary Annotator Pro.

## Overview

Binary Annotator Pro now supports Google's Gemini API as an AI provider for chat functionality. Gemini provides powerful language models that can help analyze binary files, ECG data, and answer technical questions.

## Setup

### 1. Get a Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key (starts with `AIza...`)

### 2. Configure Binary Annotator Pro

1. Open the application
2. Go to **Settings** (gear icon)
3. Select the **AI Settings** tab
4. Choose **Gemini** from the provider dropdown
5. Enter your API key in the "API Key" field
6. Select your preferred model:
   - **Gemini 3 Pro**: Most intelligent model with world-class multimodal understanding, agentic and coding capabilities
   - **Gemini 2.5 Pro**: Advanced reasoning model for complex problems in code, mathematics, and scientific subjects
   - **Gemini 2.0 Flash**: Fast and intelligent model with versatile capabilities and excellent performance-price ratio
   - **Gemini 2.5 Flash-Lite**: Ultra fast model optimized for cost-effectiveness and high throughput
7. Click **Save Settings**

## Available Models

| Model | Description | Best For |
|-------|-------------|----------|
| `gemini-3-pro` | Most intelligent model | Complex binary analysis, multimodal understanding, advanced coding |
| `gemini-2.5-pro` | Advanced reasoning | Complex problems, large codebases, long context analysis |
| `gemini-2.0-flash` | Fast & intelligent | General use, high-volume tasks, agentic workflows |
| `gemini-2.5-flash-lite` | Ultra fast | High-throughput operations, cost-sensitive applications |

## Features

### What Gemini Can Do

- **Binary File Analysis**: Analyze hex dumps, identify patterns, and suggest structure
- **ECG Data Interpretation**: Help understand ECG file formats and data encoding
- **Pattern Recognition**: Identify magic bytes, headers, and file signatures
- **Reverse Engineering**: Assist in understanding proprietary binary formats
- **RAG Integration**: Use uploaded documentation and previous conversations as context

### Current Limitations

- **No Tool Calling**: Unlike Ollama, Gemini doesn't currently support MCP tool calling in this integration
- **No Thinking Mode**: Gemini doesn't expose reasoning traces like some Ollama models
- **Cloud-Based**: Requires internet connection and API calls are billed

## API Pricing

Gemini API has a free tier with generous quotas:

- **Free Tier**: 60 requests per minute (RPM)
- **Paid Tier**: Higher rate limits available

For current pricing, see: [Google AI Pricing](https://ai.google.dev/pricing)

## Usage Tips

1. **Start with Gemini 2.0 Flash**: Excellent balance of speed, capability, and cost for most use cases
2. **Use Gemini 3 Pro for Complex Tasks**: Best for multimodal analysis, advanced coding, and agentic workflows
3. **Use Gemini 2.5 Pro for Deep Reasoning**: Ideal for complex problems requiring extensive context and reasoning
4. **Use Gemini 2.5 Flash-Lite for High Volume**: Best when you need maximum throughput and cost-effectiveness
5. **Use Specific Prompts**: Be clear about what you want to analyze (e.g., "Analyze these hex bytes at offset 0x100")
6. **Combine with RAG**: Upload vendor documentation for better context
7. **Security**: Your API key is stored locally and sent only to Google's API servers

## API Security

- ✅ API keys are stored locally in your browser
- ✅ Keys are sent only to the backend for API calls
- ✅ Backend sends keys only to Google's official API endpoints
- ✅ Keys are never logged or shared with third parties

## Troubleshooting

### "Gemini API key not configured"

- Make sure you've entered your API key in the settings
- Verify the key starts with `AIza`
- Check that you've saved the settings

### "gemini error: 401"

- Your API key is invalid or expired
- Get a new API key from Google AI Studio

### "gemini error: 429"

- You've exceeded the rate limit
- Wait a moment and try again
- Consider upgrading to a paid tier

### "gemini error: 500"

- Google's API is having issues
- Try again in a few moments
- Switch to Ollama temporarily

## Comparison with Other Providers

| Feature | Ollama | Gemini | OpenAI | Claude |
|---------|--------|--------|--------|--------|
| **Local/Cloud** | Local | Cloud | Cloud | Cloud |
| **Cost** | Free | Freemium | Paid | Paid |
| **MCP Tools** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Thinking Mode** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Privacy** | ✅ Best | ⚠️ Good | ⚠️ Good | ⚠️ Good |
| **Speed** | Fast | Very Fast | Fast | Fast |
| **Quality** | Good | Excellent | Excellent | Excellent |

## Examples

### Analyzing a Hex Dump

```
User: Analyze this hex selection:
FF FF 41 48 4D 45 44 20 00 00 00 01

Gemini: The hex bytes show:
- FF FF: Likely a signature or magic bytes
- 41 48 4D 45 44 20: ASCII "AHMED " (note the space)
- 00 00 00 01: Little-endian integer value 1

This appears to be a custom file format with a vendor identifier.
```

### Identifying Compression

```
User: These bytes look compressed. What compression method might this be?
78 9C ...

Gemini: The bytes starting with 78 9C are the standard zlib header:
- 78: Compression method (deflate) with 32K window
- 9C: Check bits and compression level

This is zlib-compressed data. You can decompress it using the standard zlib algorithm.
```

## Backend Implementation

The Gemini integration uses:

- **Backend Service**: `backend/services/gemini.go`
- **Chat Handler**: Modified `backend/handlers/chat.go`
- **Models**: Updated `backend/models/models.go`
- **Frontend Hook**: `frontend/src/hooks/useAISettings.ts`
- **Settings UI**: `frontend/src/components/SettingsDialog.tsx`

## API Endpoint

Gemini uses the official Google Generative AI API:

```
https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent
```

The integration supports:
- ✅ Streaming responses (SSE format)
- ✅ Conversation history
- ✅ System prompts (prepended to first user message)
- ✅ Multi-turn conversations

## Future Enhancements

Planned improvements:

- [ ] Add function calling / tool support when Gemini API supports it
- [ ] Support for Gemini's multimodal capabilities (image analysis)
- [ ] Token usage tracking and cost estimation
- [ ] Support for Gemini's grounding feature (web search)
- [ ] Caching of frequent prompts to reduce costs

## Support

If you encounter issues with Gemini:

1. Check the browser console for errors
2. Verify your API key is valid
3. Check Google's [API Status](https://status.cloud.google.com/)
4. Try a different model
5. Report issues on GitHub

## References

- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Gemini Models](https://ai.google.dev/models/gemini)
- [API Pricing](https://ai.google.dev/pricing)
