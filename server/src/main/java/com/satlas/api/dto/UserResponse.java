package com.satlas.api.dto;

import java.time.LocalDate;

import com.satlas.entity.Role;
import com.satlas.entity.User;
import com.satlas.security.ApiKeyCryptoService;

/**
 * ユーザー情報。
 * 平文の Gemini API キーは絶対に含めず、登録有無とマスク文字列（例: AIza****）のみを返す。
 */
public record UserResponse(
        Long id,
        String discordId,
        String name,
        String avatarUrl,
        String email,
        Role role,
        String theme,
        String language,
        String prefecture,
        LocalDate birthday,
        boolean hasGeminiApiKey,
        String geminiApiKeyMasked,
        boolean enableOllamaFallback,
        String ollamaBaseUrl,
        String ollamaModel,
        String googleIcalUrl) {

    public static final String DEFAULT_OLLAMA_URL = "http://localhost:11434";
    public static final String DEFAULT_OLLAMA_MODEL = "gemma4:12b";

    public static UserResponse from(User u, ApiKeyCryptoService crypto) {
        String masked = crypto.maskEncrypted(u.getEncryptedGeminiApiKey());
        boolean hasKey = masked != null;
        String ollamaUrl = (u.getOllamaBaseUrl() == null || u.getOllamaBaseUrl().isBlank())
                ? DEFAULT_OLLAMA_URL
                : u.getOllamaBaseUrl();
        String ollamaModel = (u.getOllamaModel() == null || u.getOllamaModel().isBlank())
                ? DEFAULT_OLLAMA_MODEL
                : u.getOllamaModel();
        return new UserResponse(
                u.getId(),
                u.getDiscordId(),
                u.getName(),
                u.getAvatarUrl(),
                u.getEmail(),
                u.getRole(),
                u.getTheme(),
                u.getLanguage(),
                u.getPrefecture(),
                u.getBirthday(),
                hasKey,
                masked,
                u.isEnableOllamaFallback(),
                ollamaUrl,
                ollamaModel,
                u.getGoogleIcalUrl());
    }
}
