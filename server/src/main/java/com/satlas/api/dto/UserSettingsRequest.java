package com.satlas.api.dto;

import java.time.LocalDate;

/**
 * ユーザー設定の部分更新。
 * null は変更なし、geminiApiKey / googleIcalUrl に空文字を送るとクリア。
 */
public record UserSettingsRequest(
        String theme,
        String language,
        String prefecture,
        LocalDate birthday,
        String geminiApiKey,
        Boolean enableOllamaFallback,
        String ollamaBaseUrl,
        String ollamaModel,
        String googleIcalUrl) {
}
