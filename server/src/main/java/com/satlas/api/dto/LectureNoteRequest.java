package com.satlas.api.dto;

public record LectureNoteRequest(
        String subjectName,
        String title,
        String contentMarkdown,
        String tags,
        Boolean isPinned) {
}
