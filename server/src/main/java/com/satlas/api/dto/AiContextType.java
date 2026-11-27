package com.satlas.api.dto;

/** AI チャットに自動添付するコンテキスト種別。 */
public enum AiContextType {
    NONE,
    TODAY_SCHEDULE,
    ASSIGNMENTS,
    /** 開いている講義ノートページ（noteId または noteContent） */
    NOTEBOOK
}
