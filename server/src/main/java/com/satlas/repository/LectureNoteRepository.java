package com.satlas.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.satlas.entity.LectureNote;

public interface LectureNoteRepository extends JpaRepository<LectureNote, Long> {

    Optional<LectureNote> findByIdAndUserId(Long id, Long userId);

    @Query("""
            select n from LectureNote n
            where n.userId = :userId
              and (:subjectName is null or n.subjectName = :subjectName)
              and (:sectionName is null or n.sectionName = :sectionName)
              and (:keyword is null
                   or lower(n.title) like lower(concat('%', :keyword, '%'))
                   or lower(n.subjectName) like lower(concat('%', :keyword, '%'))
                   or lower(n.sectionName) like lower(concat('%', :keyword, '%'))
                   or lower(n.contentJson) like lower(concat('%', :keyword, '%')))
            order by n.isPinned desc, n.updatedAt desc
            """)
    List<LectureNote> searchByUser(
            @Param("userId") Long userId,
            @Param("subjectName") String subjectName,
            @Param("sectionName") String sectionName,
            @Param("keyword") String keyword);
}
