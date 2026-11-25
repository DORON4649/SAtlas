package com.satlas.api.dto;

public record AiChatRequest(
        String message,
        AiContextType contextType) {
}
