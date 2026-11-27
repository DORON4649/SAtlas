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

/**
 * OneNote 風の講義ノートページ。
 * 階層: 科目ノートブック (subjectName) ＞ 色付きセクション (sectionName / sectionColor) ＞ ページ (title)。
 */
@Entity
@Table(name = "lecture_notes", indexes = {
        @Index(name = "idx_lecture_note_user", columnList = "user_id"),
        @Index(name = "idx_lecture_note_user_subject_section", columnList = "user_id, subject_name, section_name")
})
@Getter
@Setter
@NoArgsConstructor
public class LectureNote {

    public static final String DEFAULT_SUBJECT = "未分類";
    public static final String DEFAULT_SECTION = "一般";
    public static final String DEFAULT_SECTION_COLOR = "#6366f1";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "subject_name", nullable = false, length = 120)
    private String subjectName = DEFAULT_SUBJECT;

    @Column(name = "section_name", nullable = false, length = 100)
    private String sectionName = DEFAULT_SECTION;

    @Column(name = "section_color", nullable = false, length = 16)
    private String sectionColor = DEFAULT_SECTION_COLOR;

    @Column(nullable = false, length = 200)
    private String title;

    /** 自由配置コンテナ・テキスト・KaTeX数式・コードセル・手書きストローク・背景スタイルを含む JSON。 */
    @Column(name = "content_json", nullable = false, columnDefinition = "LONGTEXT")
    private String contentJson = "{}";

    @Column(name = "is_pinned", nullable = false)
    private boolean isPinned = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
