package com.satlas.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record MemoRequest(
        String content,
        @JsonProperty("isShared") Boolean isShared) {
}
