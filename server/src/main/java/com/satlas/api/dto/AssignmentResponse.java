package com.satlas.api.dto;

import java.time.LocalDateTime;

import com.satlas.entity.Assignment;

public record AssignmentResponse(
        Long id,
        String title,
        String subject,
        LocalDateTime dueDate,
        boolean completed) {

    public static AssignmentResponse from(Assignment a) {
        return new AssignmentResponse(a.getId(), a.getTitle(), a.getSubject(), a.getDueDate(), a.isCompleted());
    }
}
