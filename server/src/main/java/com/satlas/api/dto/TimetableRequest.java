package com.satlas.api.dto;

import com.satlas.entity.Semester;

public record TimetableRequest(
        Integer academicYear,
        Semester semester,
        Integer dayOfWeek,
        Integer period,
        String subject,
        String campus,
        String room,
        String color) {
}
