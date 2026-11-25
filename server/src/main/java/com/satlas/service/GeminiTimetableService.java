package com.satlas.service;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.satlas.ai.AiProvider;
import com.satlas.ai.AiResult;
import com.satlas.ai.AiService;
import com.satlas.api.dto.TimetableDraft;
import com.satlas.entity.User;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * 時間割 PDF を共通 {@link AiService}（Gemini 優先 / クォータ超過時 Ollama 自動フォールバック）経由で解析する。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GeminiTimetableService {

    private static final String PROMPT = """
            添付は日本の大学の履修登録・時間割の PDF です。
            記載されている授業をすべて抽出し、指定の JSON スキーマで返してください。

            ルール:
            - semester: 「前期」「春学期」「第1・2クォーター」は SPRING、「後期」「秋学期」「第3・4クォーター」は FALL、「通年」は FULL_YEAR。
            - dayOfWeek: 月=1, 火=2, 水=3, 木=4, 金=5, 土=6, 日=7 の整数。
            - period: 時限の整数（例: 「3限」→ 3）。2コマ連続の授業は時限ごとに別エントリにする。
            - subject: 科目名を PDF の表記どおりに。
            - campus: キャンパス名が分かる場合のみ（例: 津田沼, 新習志野）。不明なら空文字。
            - room: 教室名を PDF の表記どおりに。不明なら空文字。
            - 曜日・時限が決まっていない授業（集中講義・オンデマンド等）は含めない。
            """;

    private final AiService aiService;
    private final JsonMapper jsonMapper;

    public record ParseOutcome(AiProvider provider, String model, List<TimetableDraft> entries) {
    }

    public ParseOutcome parseTimetablePdf(byte[] pdf, User user) {
        AiResult result = aiService.generateStructuredFromPdf(user, pdf, PROMPT, responseSchema());
        try {
            ParsedTimetable parsed = jsonMapper.readValue(result.text(), ParsedTimetable.class);
            List<TimetableDraft> valid = (parsed.entries() == null)
                    ? List.of()
                    : parsed.entries().stream().filter(GeminiTimetableService::isValid).toList();
            return new ParseOutcome(result.provider(), result.model(), valid);
        } catch (JacksonException e) {
            log.warn("Unexpected AI JSON from {}: {}", result.provider(), result.text());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI の応答を解析できませんでした");
        }
    }

    private static boolean isValid(TimetableDraft d) {
        return d.semester() != null
                && d.dayOfWeek() != null && d.dayOfWeek() >= 1 && d.dayOfWeek() <= 7
                && d.period() != null && d.period() >= 1 && d.period() <= 10
                && d.subject() != null && !d.subject().isBlank();
    }

    /** Gemini responseSchema（OpenAPI サブセット）。 */
    private static Map<String, Object> responseSchema() {
        Map<String, Object> entry = Map.of(
                "type", "OBJECT",
                "properties", Map.of(
                        "semester", Map.of("type", "STRING", "enum", List.of("SPRING", "FALL", "FULL_YEAR")),
                        "dayOfWeek", Map.of("type", "INTEGER", "description", "1=月 ... 7=日"),
                        "period", Map.of("type", "INTEGER"),
                        "subject", Map.of("type", "STRING"),
                        "campus", Map.of("type", "STRING"),
                        "room", Map.of("type", "STRING")),
                "required", List.of("semester", "dayOfWeek", "period", "subject"),
                "propertyOrdering", List.of("semester", "dayOfWeek", "period", "subject", "campus", "room"));
        return Map.of(
                "type", "OBJECT",
                "properties", Map.of("entries", Map.of("type", "ARRAY", "items", entry)),
                "required", List.of("entries"));
    }

    record ParsedTimetable(List<TimetableDraft> entries) {
    }
}
