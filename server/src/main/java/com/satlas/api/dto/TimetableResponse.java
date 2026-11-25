package com.satlas.api.dto;

import com.satlas.entity.Semester;
import com.satlas.entity.Timetable;

public record TimetableResponse(
        Long id,
        Integer academicYear,
        Semester semester,
        Integer dayOfWeek,
        Integer period,
        String subject,
        String campus,
        String room,
        String color) {

    public static TimetableResponse from(Timetable t) {
        return new TimetableResponse(t.getId(), t.getAcademicYear(), t.getSemester(), t.getDayOfWeek(),
                t.getPeriod(), t.getSubject(), t.getCampus(), t.getRoom(), t.getColor());
    }
}
