package com.satlas.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 講義用ノートブック。ユーザー本人のみが閲覧・編集できる。 */
@Entity
@Table(name = "lecture_notes", indexes = {
        @Index(name = "idx_lecture_note_user", columnList = "user_id"),
        @Index(name = "idx_lecture_note_user_subject", columnList = "user_id, subject_name")
})
@Getter
@Setter
@NoArgsConstructor
public class LectureNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "subject_name", nullable = false, length = 120)
    private String subjectName = "未分類";

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "content_markdown", nullable = false, columnDefinition = "LONGTEXT")
    private String contentMarkdown = "";

    @Column(length = 500)
    private String tags;

    @Column(name = "is_pinned", nullable = false)
    private boolean isPinned = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
