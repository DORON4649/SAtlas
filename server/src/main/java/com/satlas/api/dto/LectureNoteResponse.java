package com.satlas.api.dto;

import java.time.LocalDateTime;

import com.satlas.entity.LectureNote;

public record LectureNoteResponse(
        Long id,
        Long userId,
        String subjectName,
        String title,
        String contentMarkdown,
        String tags,
        boolean isPinned,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    public static LectureNoteResponse from(LectureNote note) {
        return new LectureNoteResponse(
                note.getId(),
                note.getUserId(),
                note.getSubjectName(),
                note.getTitle(),
                note.getContentMarkdown(),
                note.getTags(),
                note.isPinned(),
                note.getCreatedAt(),
                note.getUpdatedAt());
    }
}
