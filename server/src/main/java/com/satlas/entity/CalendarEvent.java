package com.satlas.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** カレンダー予定（SAtlas 直接登録 または Google カレンダー iCal 同期）。 */
@Entity
@Table(name = "calendar_events", indexes = {
        @Index(name = "idx_cal_user_range", columnList = "user_id, start_at, end_at"),
        @Index(name = "idx_cal_shared_range", columnList = "is_shared, start_at, end_at"),
        @Index(name = "idx_cal_user_uid", columnList = "user_id, source, external_uid")
})
@Getter
@Setter
@NoArgsConstructor
public class CalendarEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "start_at", nullable = false)
    private LocalDateTime startAt;

    @Column(name = "end_at", nullable = false)
    private LocalDateTime endAt;

    @Column(name = "all_day", nullable = false)
    private boolean allDay = false;

    @Column(name = "is_shared", nullable = false)
    private boolean isShared = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CalendarEventSource source = CalendarEventSource.SATLAS;

    @Column(name = "external_uid", length = 255)
    private String externalUid;

    @Column(length = 16)
    private String color;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
