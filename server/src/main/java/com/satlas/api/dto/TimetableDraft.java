package com.satlas.api.dto;

import com.satlas.entity.Semester;

/** Gemini が PDF から抽出した時間割 1 コマ（保存前の下書き）。dayOfWeek: 1=月 … 7=日。 */
public record TimetableDraft(
        Semester semester,
        Integer dayOfWeek,
        Integer period,
        String subject,
        String campus,
        String room) {
}
