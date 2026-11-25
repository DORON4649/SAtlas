package com.satlas.ai;

import java.util.Base64;
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

import com.satlas.config.SatlasProperties;

import lombok.extern.slf4j.Slf4j;

/**
 * Google Gemini API (generateContent) クライアント。
 * HTTP 429 または RESOURCE_EXHAUSTED を検知した場合は {@link AiQuotaExceededException} を送出する。
 */
@Slf4j
@Component
public class GeminiAiClient {

    private final SatlasProperties properties;
    private final RestClient restClient = RestClient.create();

    public GeminiAiClient(SatlasProperties properties) {
        this.properties = properties;
    }

    public String modelName() {
        return properties.gemini().model();
    }

    public String generateText(String apiKey, String systemPrompt, String userMessage) {
        Map<String, Object> body = new HashMap<>();
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt))));
        }
        body.put("contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", userMessage)))));
        body.put("generationConfig", Map.of("temperature", 0.5));
        return callGenerateContent(apiKey, body);
    }

    public String generateJsonFromPdf(String apiKey, byte[] pdf, String prompt, Map<String, Object> responseSchema) {
        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of(
                        "role", "user",
                        "parts", List.of(
                                Map.of("inlineData", Map.of(
                                        "mimeType", "application/pdf",
                                        "data", Base64.getEncoder().encodeToString(pdf))),
                                Map.of("text", prompt)))),
                "generationConfig", Map.of(
                        "temperature", 0,
                        "responseMimeType", "application/json",
                        "responseSchema", responseSchema));
        return callGenerateContent(apiKey, body);
    }

    private String callGenerateContent(String apiKey, Map<String, Object> body) {
        GeminiResponse response;
        try {
            response = restClient.post()
                    .uri(properties.gemini().baseUrl() + "/models/{model}:generateContent", modelName())
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(GeminiResponse.class);
        } catch (RestClientResponseException e) {
            int code = e.getStatusCode().value();
            String respBody = e.getResponseBodyAsString();
            log.warn("Gemini API error: {} {}", code, respBody);
            if (code == 429 || (respBody != null && respBody.contains("RESOURCE_EXHAUSTED"))) {
                throw new AiQuotaExceededException("Gemini API のレート制限・クォータ上限に達しました", e);
            }
            if (code == 400 || code == 401 || code == 403) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Gemini API キーが無効または権限エラーです (" + code + ")");
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini API エラー (" + code + ")");
        } catch (RestClientException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini API に接続できませんでした");
        }
        return extractText(response);
    }

    private static String extractText(GeminiResponse response) {
        if (response == null || response.candidates() == null || response.candidates().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini から応答がありませんでした");
        }
        Content content = response.candidates().getFirst().content();
        if (content == null || content.parts() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini の応答が空です");
        }
        StringBuilder sb = new StringBuilder();
        content.parts().forEach(p -> {
            if (p.text() != null) {
                sb.append(p.text());
            }
        });
        return sb.toString();
    }

    record GeminiResponse(List<Candidate> candidates) {
    }

    record Candidate(Content content, String finishReason) {
    }

    record Content(List<Part> parts) {
    }

    record Part(String text) {
    }
}
