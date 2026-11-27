package com.satlas.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/** 講義ノートページの作成・部分更新（PATCH では null の項目は変更しない）。 */
public record LectureNoteRequest(
        String subjectName,
        String sectionName,
        String sectionColor,
        String title,
        String contentJson,
        @JsonProperty("isPinned") Boolean isPinned) {
}
