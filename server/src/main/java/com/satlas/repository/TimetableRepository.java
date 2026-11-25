package com.satlas.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.satlas.entity.Semester;
import com.satlas.entity.Timetable;

public interface TimetableRepository extends JpaRepository<Timetable, Long> {

    List<Timetable> findByUserIdOrderByAcademicYearDescDayOfWeekAscPeriodAsc(Long userId);

    List<Timetable> findByUserIdAndAcademicYearOrderByDayOfWeekAscPeriodAsc(Long userId, Integer academicYear);

    List<Timetable> findByUserIdAndAcademicYearAndSemesterOrderByDayOfWeekAscPeriodAsc(
            Long userId, Integer academicYear, Semester semester);

    Optional<Timetable> findByUserIdAndAcademicYearAndSemesterAndDayOfWeekAndPeriod(
            Long userId, Integer academicYear, Semester semester, Integer dayOfWeek, Integer period);
}
