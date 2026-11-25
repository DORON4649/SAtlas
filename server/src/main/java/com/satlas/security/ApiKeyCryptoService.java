package com.satlas.security;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.stereotype.Service;

import com.satlas.config.SatlasProperties;

import lombok.extern.slf4j.Slf4j;

/**
 * ユーザー個人の API キーを AES-256-GCM で暗号化・復号するサービス。
 * 暗号鍵は {@code SATLAS_CRYPTO_SECRET}（未設定時は開発用デフォルト値）の SHA-256 から導出する。
 */
@Slf4j
@Service
public class ApiKeyCryptoService {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int IV_LENGTH_BYTES = 12;
    private static final int TAG_LENGTH_BITS = 128;
    private static final String PREFIX = "v1:";

    private final SecretKey secretKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public ApiKeyCryptoService(SatlasProperties properties) {
        String secret = (properties.crypto() != null && properties.crypto().secret() != null
                && !properties.crypto().secret().isBlank())
                        ? properties.crypto().secret()
                        : "satlas-dev-default-crypto-secret-change-me";
        this.secretKey = deriveKey(secret);
    }

    public String encrypt(String plainText) {
        if (plainText == null || plainText.isBlank()) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] cipherText = cipher.doFinal(plainText.trim().getBytes(StandardCharsets.UTF_8));

            ByteBuffer buffer = ByteBuffer.allocate(iv.length + cipherText.length);
            buffer.put(iv);
            buffer.put(cipherText);
            return PREFIX + Base64.getEncoder().encodeToString(buffer.array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("API キーの暗号化に失敗しました", e);
        }
    }

    public String decrypt(String encrypted) {
        if (encrypted == null || encrypted.isBlank()) {
            return null;
        }
        try {
            String payload = encrypted.startsWith(PREFIX) ? encrypted.substring(PREFIX.length()) : encrypted;
            byte[] decoded = Base64.getDecoder().decode(payload);
            if (decoded.length <= IV_LENGTH_BYTES) {
                return null;
            }
            byte[] iv = new byte[IV_LENGTH_BYTES];
            byte[] cipherText = new byte[decoded.length - IV_LENGTH_BYTES];
            System.arraycopy(decoded, 0, iv, 0, IV_LENGTH_BYTES);
            System.arraycopy(decoded, IV_LENGTH_BYTES, cipherText, 0, cipherText.length);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] plain = cipher.doFinal(cipherText);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            log.warn("Failed to decrypt stored API key (secret may have changed): {}", e.getMessage());
            return null;
        }
    }

    /** 画面表示用のマスク文字列（例: AIza****）。 */
    public String maskEncrypted(String encrypted) {
        String plain = decrypt(encrypted);
        if (plain == null || plain.isBlank()) {
            return null;
        }
        if (plain.length() <= 4) {
            return "****";
        }
        return plain.substring(0, 4) + "****";
    }

    private static SecretKey deriveKey(String secret) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] keyBytes = digest.digest(secret.getBytes(StandardCharsets.UTF_8));
            return new SecretKeySpec(keyBytes, "AES");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 が利用できません", e);
        }
    }
}
