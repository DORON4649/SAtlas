package com.satlas.api.dto;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonProperty;

/** カレンダー予定の作成・部分更新（PATCH では null の項目は変更しない）。 */
public record CalendarEventRequest(
        String title,
        String description,
        LocalDateTime startAt,
        LocalDateTime endAt,
        Boolean allDay,
        @JsonProperty("isShared") Boolean isShared,
        String color) {
}
