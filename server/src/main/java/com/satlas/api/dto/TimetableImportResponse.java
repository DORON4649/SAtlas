package com.satlas.api.dto;

import java.util.List;

import com.satlas.ai.AiProvider;

/** PDF 解析結果。保存はクライアント確認後に POST /api/timetables で行う。 */
public record TimetableImportResponse(
        String fileName,
        AiProvider provider,
        String model,
        List<TimetableDraft> entries) {
}
