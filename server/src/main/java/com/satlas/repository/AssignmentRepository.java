package com.satlas.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.satlas.entity.Assignment;

public interface AssignmentRepository extends JpaRepository<Assignment, Long> {

    List<Assignment> findByUserIdOrderByCompletedAscDueDateAsc(Long userId);

    List<Assignment> findByUserIdAndCompletedFalseAndDueDateBetweenOrderByDueDateAsc(
            Long userId, LocalDateTime start, LocalDateTime end);

    Optional<Assignment> findByIdAndUserId(Long id, Long userId);
}
