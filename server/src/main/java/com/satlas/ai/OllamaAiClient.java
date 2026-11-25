package com.satlas.ai;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import lombok.extern.slf4j.Slf4j;

/**
 * ローカル LLM (Ollama) の {@code /api/chat} クライアント。
 */
@Slf4j
@Component
public class OllamaAiClient {

    private final RestClient restClient = RestClient.create();

    public String chat(String baseUrl, String model, String systemPrompt, String userMessage, boolean jsonMode) {
        String normalizedBase = normalizeBaseUrl(baseUrl);
        List<Map<String, String>> messages = new ArrayList<>();
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            messages.add(Map.of("role", "system", "content", systemPrompt));
        }
        messages.add(Map.of("role", "user", "content", userMessage));

        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("stream", false);
        if (jsonMode) {
            body.put("format", "json");
        }

        OllamaChatResponse response;
        try {
            response = restClient.post()
                    .uri(normalizedBase + "/api/chat")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(OllamaChatResponse.class);
        } catch (RestClientResponseException e) {
            log.warn("Ollama API error ({}): {} {}", normalizedBase, e.getStatusCode(), e.getResponseBodyAsString());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Ollama エラー (" + e.getStatusCode().value() + ")：モデル名や起動状態を確認してください");
        } catch (RestClientException e) {
            log.warn("Ollama unreachable ({}): {}", normalizedBase, e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "ローカル LLM (Ollama: " + normalizedBase + ") に接続できませんでした");
        }

        if (response == null || response.message() == null || response.message().content() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Ollama から応答がありませんでした");
        }
        return response.message().content();
    }

    private static String normalizeBaseUrl(String raw) {
        String trimmed = raw == null ? "" : raw.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        try {
            URI uri = URI.create(trimmed);
            String scheme = uri.getScheme();
            if (scheme == null || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))
                    || uri.getHost() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ollama の接続先 URL が不正です");
            }
            return trimmed;
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ollama の接続先 URL が不正です");
        }
    }

    record OllamaChatResponse(OllamaMessage message) {
    }

    record OllamaMessage(String role, String content) {
    }
}
