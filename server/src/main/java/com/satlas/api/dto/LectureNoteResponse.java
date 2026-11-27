package com.satlas.api.dto;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.satlas.entity.LectureNote;

public record LectureNoteResponse(
        Long id,
        Long userId,
        String subjectName,
        String sectionName,
        String sectionColor,
        String title,
        String contentJson,
        @JsonProperty("isPinned") boolean isPinned,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    public static LectureNoteResponse from(LectureNote note) {
        return new LectureNoteResponse(
                note.getId(),
                note.getUserId(),
                note.getSubjectName(),
                note.getSectionName(),
                note.getSectionColor(),
                note.getTitle(),
                note.getContentJson(),
                note.isPinned(),
                note.getCreatedAt(),
                note.getUpdatedAt());
    }
}
