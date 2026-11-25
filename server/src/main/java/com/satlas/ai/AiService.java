package com.satlas.ai;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.satlas.api.dto.UserResponse;
import com.satlas.config.SatlasProperties;
import com.satlas.entity.User;
import com.satlas.security.ApiKeyCryptoService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * ユーザー個人の Gemini API キー (BYOK) を最優先で実行し、
 * レート制限・クォータ超過 (429 / RESOURCE_EXHAUSTED) またはキー未設定時に
 * {@code enableOllamaFallback == true} であればローカル LLM (Ollama) へ自動フォールバックする AI ルーター。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiService {

    private final GeminiAiClient geminiClient;
    private final OllamaAiClient ollamaClient;
    private final ApiKeyCryptoService apiKeyCryptoService;
    private final SatlasProperties properties;

    public AiResult chat(User user, String systemPrompt, String userMessage) {
        String apiKey = resolveGeminiApiKey(user);
        if (apiKey != null) {
            try {
                String text = geminiClient.generateText(apiKey, systemPrompt, userMessage);
                return new AiResult(text, AiProvider.GEMINI, geminiClient.modelName());
            } catch (AiQuotaExceededException e) {
                if (user.isEnableOllamaFallback()) {
                    log.info("Gemini quota exceeded for user {}; falling back to Ollama", user.getId());
                    return callOllama(user, systemPrompt, userMessage, false);
                }
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Gemini API のレート制限・クォータ上限に達しました。AI設定で Ollama 自動フォールバックを有効にするか、しばらく待ってから再試行してください");
            }
        }

        if (user.isEnableOllamaFallback()) {
            log.info("No Gemini API key for user {}; falling back to Ollama", user.getId());
            return callOllama(user, systemPrompt, userMessage, false);
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Gemini API キーが未設定です。ヘッダーの「AI・API設定」から個人の Gemini API キーを登録するか、Ollama フォールバックを有効にしてください");
    }

    /**
     * PDF からの構造化 JSON 抽出（時間割 PDF 解析など）。
     * Gemini 優先、クォータ超過・キー未設定時に Ollama フォールバックが有効なら JSON モードで代替実行する。
     */
    public AiResult generateStructuredFromPdf(User user, byte[] pdf, String prompt, Map<String, Object> responseSchema) {
        String apiKey = resolveGeminiApiKey(user);
        if (apiKey != null) {
            try {
                String json = geminiClient.generateJsonFromPdf(apiKey, pdf, prompt, responseSchema);
                return new AiResult(json, AiProvider.GEMINI, geminiClient.modelName());
            } catch (AiQuotaExceededException e) {
                if (user.isEnableOllamaFallback()) {
                    log.info("Gemini quota exceeded during PDF import for user {}; falling back to Ollama", user.getId());
                    return fallbackPdfWithOllama(user, pdf, prompt);
                }
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Gemini API のトークン上限に達しました。AI設定で Ollama 自動フォールバックを有効にするか、時間をおいて再試行してください");
            }
        }

        if (user.isEnableOllamaFallback()) {
            log.info("No Gemini API key during PDF import for user {}; falling back to Ollama", user.getId());
            return fallbackPdfWithOllama(user, pdf, prompt);
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Gemini API キーが未設定です（個人の Gemini API キーを登録するか、環境変数 GEMINI_API_KEY / Ollama フォールバックを設定してください）");
    }

    private AiResult fallbackPdfWithOllama(User user, byte[] pdf, String prompt) {
        String extracted = extractReadableSnippet(pdf);
        String systemPrompt = """
                あなたは大学時間割の JSON 抽出アシスタントです。
                必ず {"entries": [{"semester":"SPRING|FALL|FULL_YEAR","dayOfWeek":1,"period":1,"subject":"","campus":"","room":""}]} 形式の JSON のみを返してください。
                """;
        String userPrompt = prompt + "\n\n--- PDF テキスト抜粋 ---\n" + extracted;
        return callOllama(user, systemPrompt, userPrompt, true);
    }

    private AiResult callOllama(User user, String systemPrompt, String userMessage, boolean jsonMode) {
        String baseUrl = resolveOllamaBaseUrl(user);
        String model = resolveOllamaModel(user);
        String text = ollamaClient.chat(baseUrl, model, systemPrompt, userMessage, jsonMode);
        return new AiResult(text, AiProvider.OLLAMA_FALLBACK, model);
    }

    /** ユーザー個人の暗号化キーを最優先し、未登録時のみサーバー環境変数 GEMINI_API_KEY にフォールバック。 */
    private String resolveGeminiApiKey(User user) {
        String userKey = apiKeyCryptoService.decrypt(user.getEncryptedGeminiApiKey());
        if (userKey != null && !userKey.isBlank()) {
            return userKey;
        }
        String envKey = properties.gemini() == null ? null : properties.gemini().apiKey();
        return (envKey != null && !envKey.isBlank()) ? envKey.trim() : null;
    }

    private String resolveOllamaBaseUrl(User user) {
        if (user.getOllamaBaseUrl() != null && !user.getOllamaBaseUrl().isBlank()) {
            return user.getOllamaBaseUrl().trim();
        }
        if (properties.ollama() != null && properties.ollama().defaultBaseUrl() != null
                && !properties.ollama().defaultBaseUrl().isBlank()) {
            return properties.ollama().defaultBaseUrl().trim();
        }
        return UserResponse.DEFAULT_OLLAMA_URL;
    }

    private String resolveOllamaModel(User user) {
        if (user.getOllamaModel() != null && !user.getOllamaModel().isBlank()) {
            return user.getOllamaModel().trim();
        }
        if (properties.ollama() != null && properties.ollama().defaultModel() != null
                && !properties.ollama().defaultModel().isBlank()) {
            return properties.ollama().defaultModel().trim();
        }
        return UserResponse.DEFAULT_OLLAMA_MODEL;
    }

    /** PDF バイト列から可読な文字列片を最大 12,000 文字まで抽出（Ollama テキストフォールバック用）。 */
    private static String extractReadableSnippet(byte[] pdf) {
        String raw = new String(pdf, StandardCharsets.UTF_8);
        String cleaned = raw.replaceAll("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\uFFFD]+", " ")
                .replaceAll("\\s{2,}", " ")
                .trim();
        return cleaned.length() <= 12_000 ? cleaned : cleaned.substring(0, 12_000);
    }
}
