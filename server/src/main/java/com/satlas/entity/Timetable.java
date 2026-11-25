package com.satlas.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 時間割の 1 コマ。dayOfWeek は ISO 準拠（1=月 … 7=日）。 */
@Entity
@Table(name = "timetables",
        uniqueConstraints = @UniqueConstraint(name = "uk_timetable_slot",
                columnNames = { "user_id", "academic_year", "semester", "day_of_week", "period" }),
        indexes = @Index(name = "idx_timetable_user", columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
public class Timetable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "academic_year", nullable = false)
    private Integer academicYear;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Semester semester;

    @Column(name = "day_of_week", nullable = false)
    private Integer dayOfWeek;

    @Column(nullable = false)
    private Integer period;

    @Column(nullable = false, length = 200)
    private String subject;

    @Column(length = 100)
    private String campus;

    @Column(length = 100)
    private String room;

    @Column(length = 16)
    private String color;
}
