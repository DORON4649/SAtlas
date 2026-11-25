package com.satlas.api.dto;

import com.satlas.ai.AiProvider;

public record AiChatResponse(
        String reply,
        AiProvider provider,
        String model,
        AiContextType contextType) {
}
