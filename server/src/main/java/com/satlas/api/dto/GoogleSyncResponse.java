package com.satlas.api.dto;

import java.time.LocalDateTime;

public record GoogleSyncResponse(
        int syncedCount,
        int createdCount,
        int updatedCount,
        int sharedCount,
        LocalDateTime syncedAt) {
}
