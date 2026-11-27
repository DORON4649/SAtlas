package com.satlas.entity;

import java.time.LocalDate;
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
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Discord アカウントに紐づく SAtlas ユーザー。 */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, length = 32)
    private String discordId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 512)
    private String avatarUrl;

    @Column(length = 255)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Role role = Role.USER;

    @Column(length = 16)
    private String theme = "dark";

    @Column(length = 8)
    private String language = "ja";

    @Column(length = 32)
    private String prefecture = "chiba";

    private LocalDate birthday;

    /** AES-GCM で暗号化されたユーザー個別の Gemini API キー（平文は絶対にレスポンスへ返さない）。 */
    @Column(name = "encrypted_gemini_api_key", columnDefinition = "TEXT")
    private String encryptedGeminiApiKey;

    /** Gemini のトークン上限・レート制限時にローカル LLM (Ollama) へ自動フォールバックするか。 */
    @Column(name = "enable_ollama_fallback", nullable = false)
    private boolean enableOllamaFallback = false;

    /** ローカル LLM (Ollama) の接続先 URL。 */
    @Column(name = "ollama_base_url", length = 255)
    private String ollamaBaseUrl = "http://localhost:11434";

    /** ローカル LLM (Ollama) で使用するモデル名。 */
    @Column(name = "ollama_model", length = 100)
    private String ollamaModel = "gemma4:12b";

    /** react-grid-layout のレイアウト JSON。 */
    @Column(columnDefinition = "TEXT")
    private String dashboardLayout;

    /** Google カレンダーの非公開 iCal (.ics) URL。 */
    @Column(name = "google_ical_url", columnDefinition = "TEXT")
    private String googleIcalUrl;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
