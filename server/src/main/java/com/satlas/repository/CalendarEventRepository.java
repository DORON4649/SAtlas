package com.satlas.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.satlas.entity.CalendarEvent;
import com.satlas.entity.CalendarEventSource;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {

    /**
     * 指定期間 [rangeStart, rangeEnd] に重なる自分の予定＋他ユーザーの共有予定を取得する。
     */
    @Query("""
            select e from CalendarEvent e
            where (e.userId = :userId or e.isShared = true)
              and e.startAt <= :rangeEnd
              and e.endAt >= :rangeStart
            order by e.startAt asc, e.id asc
            """)
    List<CalendarEvent> findVisibleInRange(
            @Param("userId") Long userId,
            @Param("rangeStart") LocalDateTime rangeStart,
            @Param("rangeEnd") LocalDateTime rangeEnd);

    Optional<CalendarEvent> findByIdAndUserId(Long id, Long userId);

    Optional<CalendarEvent> findByUserIdAndSourceAndExternalUid(
            Long userId, CalendarEventSource source, String externalUid);
}
