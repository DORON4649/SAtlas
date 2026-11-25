package com.satlas.entity;

import java.time.LocalDateTime;

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

/** メモ。isShared=true のものは他ユーザーにも表示される。 */
@Entity
@Table(name = "memos", indexes = @Index(name = "idx_memo_user", columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
public class Memo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "is_shared", nullable = false)
    private boolean isShared = false;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
