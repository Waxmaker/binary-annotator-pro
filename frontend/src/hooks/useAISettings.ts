import { useState, useEffect, useCallback } from "react";
import { getUserID } from "./useUserID";

export type AIProvider = "ollama" | "openai" | "claude" | "gemini";

export interface AISettings {
  provider: AIProvider;
  ollamaUrl: string;
  ollamaModel: string;
  openaiKey: string;
  openaiModel: string;
  claudeKey: string;
  claudeModel: string;
  geminiKey: string;
  geminiModel: string;
  thinking: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const DEFAULT_SETTINGS: AISettings = {
  provider: "ollama",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "llama2",
  openaiKey: "",
  openaiModel: "gpt-4",
  claudeKey: "",
  claudeModel: "claude-3-5-sonnet-20241022",
  geminiKey: "",
  geminiModel: "gemini-2.0-flash",
  thinking: false,
};

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const userID = getUserID();

  // Load settings from backend
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/ai/settings/${userID}`);

      if (!response.ok) {
        throw new Error("Failed to load AI settings");
      }

      const data = await response.json();

      // Map backend response to frontend settings format
      const loadedSettings: AISettings = {
        provider: data.provider || DEFAULT_SETTINGS.provider,
        ollamaUrl: data.ollama_url || DEFAULT_SETTINGS.ollamaUrl,
        ollamaModel: data.ollama_model || DEFAULT_SETTINGS.ollamaModel,
        openaiKey: "", // API keys stay on backend
        openaiModel: data.openai_model || DEFAULT_SETTINGS.openaiModel,
        claudeKey: "", // API keys stay on backend
        claudeModel: data.claude_model || DEFAULT_SETTINGS.claudeModel,
        geminiKey: "", // API keys stay on backend
        geminiModel: data.gemini_model || DEFAULT_SETTINGS.geminiModel,
        thinking: data.thinking || false,
      };

      setSettings(loadedSettings);
      setIsConfigured(data.is_configured || false);
    } catch (err) {
      console.error("Failed to load AI settings:", err);
      setSettings(DEFAULT_SETTINGS);
      setIsConfigured(false);
    } finally {
      setLoading(false);
    }
  }, [userID]);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Save settings to backend
  const saveSettings = useCallback(
    async (newSettings: AISettings) => {
      try {
        const response = await fetch(`${API_BASE_URL}/ai/settings/${userID}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: newSettings.provider,
            ollama_url: newSettings.ollamaUrl,
            ollama_model: newSettings.ollamaModel,
            openai_key: newSettings.openaiKey || undefined,
            openai_model: newSettings.openaiModel,
            claude_key: newSettings.claudeKey || undefined,
            claude_model: newSettings.claudeModel,
            gemini_key: newSettings.geminiKey || undefined,
            gemini_model: newSettings.geminiModel,
            thinking: newSettings.thinking,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save AI settings");
        }

        // Reload settings from backend to get updated state
        await loadSettings();
      } catch (err) {
        console.error("Failed to save AI settings:", err);
        throw err;
      }
    },
    [userID, loadSettings],
  );

  // Update specific setting
  const updateSetting = useCallback(
    <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
    },
    [settings],
  );

  // Reset to defaults
  const resetSettings = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/ai/settings/${userID}`, {
        method: "DELETE",
      });
      setSettings(DEFAULT_SETTINGS);
      setIsConfigured(false);
    } catch (err) {
      console.error("Failed to reset AI settings:", err);
    }
  }, [userID]);

  return {
    settings,
    isConfigured,
    loading,
    userID,
    saveSettings,
    updateSetting,
    resetSettings,
    reloadSettings: loadSettings,
  };
}
