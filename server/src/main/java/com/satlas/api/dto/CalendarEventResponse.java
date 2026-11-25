package com.satlas.api.dto;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.satlas.entity.Assignment;
import com.satlas.entity.CalendarEvent;

/**
 * カレンダー統合フィード 1 件分（自分の予定・他人の共有予定・Google iCal 同期予定・課題締切）。
 */
public record CalendarEventResponse(
        /** 一意キー（"event-12" / "assignment-5"） */
        String id,
        /** CalendarEvent の DB ID（課題締切の場合は null） */
        Long eventId,
        /** Assignment の DB ID（通常予定の場合は null） */
        Long assignmentId,
        Long userId,
        String ownerName,
        String title,
        String description,
        LocalDateTime startAt,
        LocalDateTime endAt,
        boolean allDay,
        @JsonProperty("isShared") boolean isShared,
        /** "SATLAS" | "GOOGLE_ICAL" | "ASSIGNMENT" */
        String source,
        String externalUid,
        String color,
        boolean mine,
        boolean editable) {

    public static CalendarEventResponse fromEvent(CalendarEvent e, Long currentUserId, String ownerName) {
        boolean mine = e.getUserId().equals(currentUserId);
        return new CalendarEventResponse(
                "event-" + e.getId(),
                e.getId(),
                null,
                e.getUserId(),
                ownerName,
                e.getTitle(),
                e.getDescription(),
                e.getStartAt(),
                e.getEndAt(),
                e.isAllDay(),
                e.isShared(),
                e.getSource().name(),
                e.getExternalUid(),
                e.getColor(),
                mine,
                mine);
    }

    public static CalendarEventResponse fromAssignment(Assignment a, String ownerName) {
        String desc = (a.getSubject() != null && !a.getSubject().isBlank()) ? "科目: " + a.getSubject() : null;
        return new CalendarEventResponse(
                "assignment-" + a.getId(),
                null,
                a.getId(),
                a.getUserId(),
                ownerName,
                "[締切] " + a.getTitle(),
                desc,
                a.getDueDate(),
                a.getDueDate(),
                false,
                false,
                "ASSIGNMENT",
                null,
                "#f43f5e",
                true,
                false);
    }
}
