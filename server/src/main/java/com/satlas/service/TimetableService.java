package com.satlas.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.satlas.api.dto.TimetableRequest;
import com.satlas.entity.Semester;
import com.satlas.entity.Timetable;
import com.satlas.repository.TimetableRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TimetableService {

    private final TimetableRepository timetableRepository;

    @Transactional(readOnly = true)
    public List<Timetable> list(Long userId, Integer academicYear, Semester semester) {
        if (academicYear == null) {
            return timetableRepository.findByUserIdOrderByAcademicYearDescDayOfWeekAscPeriodAsc(userId);
        }
        if (semester == null) {
            return timetableRepository.findByUserIdAndAcademicYearOrderByDayOfWeekAscPeriodAsc(userId, academicYear);
        }
        return timetableRepository.findByUserIdAndAcademicYearAndSemesterOrderByDayOfWeekAscPeriodAsc(
                userId, academicYear, semester);
    }

    /** 同じ (年度, 学期, 曜日, 時限) のコマは上書き、それ以外は新規作成。 */
    @Transactional
    public List<Timetable> upsertAll(Long userId, List<TimetableRequest> requests) {
        return requests.stream().map(req -> {
            validate(req);
            Timetable t = timetableRepository
                    .findByUserIdAndAcademicYearAndSemesterAndDayOfWeekAndPeriod(
                            userId, req.academicYear(), req.semester(), req.dayOfWeek(), req.period())
                    .orElseGet(Timetable::new);
            t.setUserId(userId);
            t.setAcademicYear(req.academicYear());
            t.setSemester(req.semester());
            t.setDayOfWeek(req.dayOfWeek());
            t.setPeriod(req.period());
            t.setSubject(req.subject().trim());
            t.setCampus(blankToNull(req.campus()));
            t.setRoom(blankToNull(req.room()));
            t.setColor(blankToNull(req.color()));
            return timetableRepository.save(t);
        }).toList();
    }

    private static void validate(TimetableRequest r) {
        if (r.academicYear() == null || r.semester() == null
                || r.dayOfWeek() == null || r.dayOfWeek() < 1 || r.dayOfWeek() > 7
                || r.period() == null || r.period() < 1 || r.period() > 10
                || r.subject() == null || r.subject().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "academicYear, semester, dayOfWeek(1-7), period(1-10), subject は必須です");
        }
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
