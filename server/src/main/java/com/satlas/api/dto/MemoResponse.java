package com.satlas.api.dto;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.satlas.entity.Memo;

public record MemoResponse(
        Long id,
        String content,
        @JsonProperty("isShared") boolean isShared,
        LocalDateTime updatedAt,
        /** 自分のメモかどうか（共有メモの表示用）。 */
        boolean mine) {

    public static MemoResponse from(Memo m, Long currentUserId) {
        return new MemoResponse(m.getId(), m.getContent(), m.isShared(), m.getUpdatedAt(),
                m.getUserId().equals(currentUserId));
    }
}
