package com.satlas.service;

import java.util.List;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.satlas.api.dto.LectureNoteRequest;
import com.satlas.api.dto.LectureNoteResponse;
import com.satlas.entity.LectureNote;
import com.satlas.repository.LectureNoteRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LectureNoteService {

    private static final int MAX_TITLE_LENGTH = 200;
    private static final int MAX_SUBJECT_LENGTH = 120;
    private static final int MAX_TAGS_LENGTH = 500;
    private static final int MAX_CONTENT_LENGTH = 5_000_000;
    private static final String DEFAULT_SUBJECT = "未分類";

    private final LectureNoteRepository lectureNoteRepository;

    @Transactional(readOnly = true)
    public List<LectureNoteResponse> list(Long userId, String subjectName, String keyword) {
        String normalizedSubject = (subjectName == null || subjectName.isBlank()) ? null : subjectName.trim();
        String normalizedKeyword = (keyword == null || keyword.isBlank()) ? null : keyword.trim();
        return lectureNoteRepository.searchByUser(userId, normalizedSubject, normalizedKeyword).stream()
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
        String title = (req.title() == null || req.title().isBlank()) ? "無題のノート" : req.title().trim();
        validateLength(title, MAX_TITLE_LENGTH, "タイトルが長すぎます");

        String subjectName = (req.subjectName() == null || req.subjectName().isBlank())
                ? DEFAULT_SUBJECT
                : req.subjectName().trim();
        validateLength(subjectName, MAX_SUBJECT_LENGTH, "科目名が長すぎます");

        String content = req.contentMarkdown() != null ? req.contentMarkdown() : "";
        validateLength(content, MAX_CONTENT_LENGTH, "ノート本文が長すぎます");

        String tags = normalizeTags(req.tags());
        validateLength(tags, MAX_TAGS_LENGTH, "タグが長すぎます");

        LectureNote note = new LectureNote();
        note.setUserId(userId);
        note.setSubjectName(subjectName);
        note.setTitle(title);
        note.setContentMarkdown(content);
        note.setTags(tags);
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
            String subjectName = req.subjectName().isBlank() ? DEFAULT_SUBJECT : req.subjectName().trim();
            validateLength(subjectName, MAX_SUBJECT_LENGTH, "科目名が長すぎます");
            note.setSubjectName(subjectName);
        }
        if (req.contentMarkdown() != null) {
            validateLength(req.contentMarkdown(), MAX_CONTENT_LENGTH, "ノート本文が長すぎます");
            note.setContentMarkdown(req.contentMarkdown());
        }
        if (req.tags() != null) {
            String tags = normalizeTags(req.tags());
            validateLength(tags, MAX_TAGS_LENGTH, "タグが長すぎます");
            note.setTags(tags);
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

    private String normalizeTags(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim();
    }

    private void validateLength(String value, int max, String message) {
        if (value != null && value.length() > max) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }
}
