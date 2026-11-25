package com.satlas.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application.yml の {@code satlas.*} をバインドするアプリ固有設定。
 */
@ConfigurationProperties(prefix = "satlas")
public record SatlasProperties(
        String frontendUrl,
        Cors cors,
        Discord discord,
        Security security,
        Gemini gemini,
        Crypto crypto,
        Ollama ollama) {

    /**
     * 開発モード判定。
     * {@code satlas.security.dev-mode} が明示指定されていればその値を使い、
     * 未指定なら {@code DISCORD_CLIENT_ID} が設定済みの場合に自動的に {@code false} にする。
     */
    public boolean isDevMode() {
        if (security != null && security.devMode() != null) {
            return security.devMode();
        }
        return discord == null || discord.clientId() == null || discord.clientId().isBlank();
    }

    public record Cors(List<String> allowedOrigins) {
    }

    public record Discord(String clientId, String guildId) {
    }

    public record Security(Boolean devMode) {
    }

    public record Gemini(String apiKey, String model, String baseUrl) {
    }

    public record Crypto(String secret) {
    }

    public record Ollama(String defaultBaseUrl, String defaultModel) {
    }
}
