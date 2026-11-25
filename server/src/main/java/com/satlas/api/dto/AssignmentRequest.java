package com.satlas.api.dto;

import java.time.LocalDateTime;

/** 課題の作成 / 部分更新（PATCH では null の項目は変更しない）。 */
public record AssignmentRequest(
        String title,
        String subject,
        LocalDateTime dueDate,
        Boolean completed) {
}
