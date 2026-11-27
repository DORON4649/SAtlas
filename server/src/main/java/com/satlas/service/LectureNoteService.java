package com.satlas.service;

import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.satlas.api.dto.LectureNoteRequest;
import com.satlas.api.dto.LectureNoteResponse;
import com.satlas.entity.LectureNote;
import com.satlas.repository.LectureNoteRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Slf4j
@Service
@RequiredArgsConstructor
public class LectureNoteService {

    private static final int MAX_TITLE_LENGTH = 200;
    private static final int MAX_SUBJECT_LENGTH = 120;
    private static final int MAX_SECTION_LENGTH = 100;
    /** 手書きストロークを含む JSON のため 8MB まで許容。 */
    private static final int MAX_CONTENT_LENGTH = 8 * 1024 * 1024;
    private static final Pattern HEX_COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");

    private final LectureNoteRepository lectureNoteRepository;
    private final JsonMapper jsonMapper;

    @Transactional(readOnly = true)
    public List<LectureNoteResponse> list(Long userId, String subjectName, String sectionName, String keyword) {
        String normalizedSubject = blankToNull(subjectName);
        String normalizedSection = blankToNull(sectionName);
        String normalizedKeyword = blankToNull(keyword);
        return lectureNoteRepository.searchByUser(userId, normalizedSubject, normalizedSection, normalizedKeyword)
                .stream()
                .map(LectureNoteResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<LectureNote> findOwned(Long userId, Long noteId) {
        if (noteId == null) {
            return Optional.empty();
        }
        return lectureNoteRepository.findByIdAndUserId(noteId, userId);
    }

    @Transactional
    public LectureNoteResponse create(Long userId, LectureNoteRequest req) {
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "リクエスト本文は必須です");
        }
        String title = isBlank(req.title()) ? "無題のページ" : req.title().trim();
        validateLength(title, MAX_TITLE_LENGTH, "タイトルが長すぎます");

        String subjectName = isBlank(req.subjectName()) ? LectureNote.DEFAULT_SUBJECT : req.subjectName().trim();
        validateLength(subjectName, MAX_SUBJECT_LENGTH, "科目名が長すぎます");

        String sectionName = isBlank(req.sectionName()) ? LectureNote.DEFAULT_SECTION : req.sectionName().trim();
        validateLength(sectionName, MAX_SECTION_LENGTH, "セクション名が長すぎます");

        String sectionColor = normalizeColor(req.sectionColor(), LectureNote.DEFAULT_SECTION_COLOR);
        String contentJson = normalizeContentJson(req.contentJson());

        LectureNote note = new LectureNote();
        note.setUserId(userId);
        note.setSubjectName(subjectName);
        note.setSectionName(sectionName);
        note.setSectionColor(sectionColor);
        note.setTitle(title);
        note.setContentJson(contentJson);
        note.setPinned(Boolean.TRUE.equals(req.isPinned()));

        return LectureNoteResponse.from(lectureNoteRepository.save(note));
    }

    @Transactional
    public LectureNoteResponse update(Long userId, Long id, LectureNoteRequest req) {
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "リクエスト本文は必須です");
        }
        LectureNote note = lectureNoteRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ノートが見つかりません"));

        if (req.title() != null) {
            String title = req.title().trim();
            if (title.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title を空にはできません");
            }
            validateLength(title, MAX_TITLE_LENGTH, "タイトルが長すぎます");
            note.setTitle(title);
        }
        if (req.subjectName() != null) {
            String subjectName = req.subjectName().isBlank() ? LectureNote.DEFAULT_SUBJECT : req.subjectName().trim();
            validateLength(subjectName, MAX_SUBJECT_LENGTH, "科目名が長すぎます");
            note.setSubjectName(subjectName);
        }
        if (req.sectionName() != null) {
            String sectionName = req.sectionName().isBlank() ? LectureNote.DEFAULT_SECTION : req.sectionName().trim();
            validateLength(sectionName, MAX_SECTION_LENGTH, "セクション名が長すぎます");
            note.setSectionName(sectionName);
        }
        if (req.sectionColor() != null) {
            note.setSectionColor(normalizeColor(req.sectionColor(), note.getSectionColor()));
        }
        if (req.contentJson() != null) {
            note.setContentJson(normalizeContentJson(req.contentJson()));
        }
        if (req.isPinned() != null) {
            note.setPinned(req.isPinned());
        }

        return LectureNoteResponse.from(lectureNoteRepository.save(note));
    }

    @Transactional
    public void delete(Long userId, Long id) {
        LectureNote note = lectureNoteRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ノートが見つかりません"));
        lectureNoteRepository.delete(note);
    }

    /**
     * ページの contentJson からテキスト・KaTeX 数式・コードセルを抽出し、AI コンテキスト用テキストを生成する。
     * JSON でない平文が渡された場合はそのまま返す。
     */
    public String extractReadableContent(String rawContent) {
        if (isBlank(rawContent)) {
            return "";
        }
        String trimmed = rawContent.trim();
        if (!trimmed.startsWith("{")) {
            return trimmed;
        }
        try {
            JsonNode root = jsonMapper.readTree(trimmed);
            StringBuilder sb = new StringBuilder();
            JsonNode containers = root.path("containers");
            if (containers.isArray()) {
                for (JsonNode c : containers) {
                    String kind = c.path("kind").asString("");
                    switch (kind) {
                        case "text" -> {
                            String text = c.path("text").asString("");
                            if (!text.isBlank()) {
                                sb.append("[テキスト]\n").append(text.trim()).append("\n\n");
                            }
                        }
                        case "math" -> {
                            String expr = c.path("expr").asString("");
                            if (!expr.isBlank()) {
                                sb.append("[数式 (LaTeX)]\n$$").append(expr.trim()).append("$$\n\n");
                            }
                        }
                        case "code" -> {
                            String lang = c.path("language").asString("python");
                            String code = c.path("code").asString("");
                            if (!code.isBlank()) {
                                sb.append("[コードセル: ").append(lang).append("]\n```").append(lang).append("\n")
                                        .append(code.trim()).append("\n```\n\n");
                            }
                        }
                        default -> {
                            // ignore unknown container kind
                        }
                    }
                }
            }
            JsonNode strokes = root.path("strokes");
            if (strokes.isArray() && !strokes.isEmpty()) {
                sb.append("（ページ上に手書きストローク ").append(strokes.size()).append(" 本あり）\n");
            }
            return sb.toString().trim();
        } catch (JacksonException e) {
            log.debug("Failed to parse note contentJson for AI context: {}", e.getMessage());
            return trimmed;
        }
    }

    private String normalizeContentJson(String raw) {
        if (isBlank(raw)) {
            return "{}";
        }
        validateLength(raw, MAX_CONTENT_LENGTH, "ノート本文が大きすぎます");
        try {
            JsonNode node = jsonMapper.readTree(raw);
            if (!node.isObject()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "contentJson は JSON オブジェクトである必要があります");
            }
        } catch (JacksonException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "contentJson が不正な JSON です");
        }
        return raw;
    }

    private static String normalizeColor(String color, String fallback) {
        if (color != null && HEX_COLOR.matcher(color.trim()).matches()) {
            return color.trim();
        }
        return fallback;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String blankToNull(String s) {
        return isBlank(s) ? null : s.trim();
    }

    private static void validateLength(String value, int max, String message) {
        if (value != null && value.length() > max) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }
}
