package com.satlas.security;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.satlas.entity.User;

import lombok.extern.slf4j.Slf4j;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 標準 JDK (HMAC-SHA256) のみで動作する SAtlas JWT 発行・検証サービス。
 */
@Slf4j
@Service
public class JwtService {

    private static final String HEADER_JSON = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
    private static final Base64.Encoder B64_ENC = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64_DEC = Base64.getUrlDecoder();

    private final byte[] secretKeyBytes;
    private final long expirationDays;
    private final JsonMapper jsonMapper;

    public JwtService(
            @Value("${satlas.jwt.secret:satlas-dev-default-jwt-secret-change-me}") String secret,
            @Value("${satlas.jwt.expiration-days:30}") long expirationDays,
            JsonMapper jsonMapper) {
        this.secretKeyBytes = secret.getBytes(StandardCharsets.UTF_8);
        this.expirationDays = Math.max(1, expirationDays);
        this.jsonMapper = jsonMapper;
    }

    public String issueToken(User user) {
        Instant now = Instant.now();
        Instant exp = now.plus(expirationDays, ChronoUnit.DAYS);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sub", String.valueOf(user.getId()));
        payload.put("discordId", user.getDiscordId());
        payload.put("name", user.getName());
        payload.put("role", user.getRole().name());
        payload.put("iat", now.getEpochSecond());
        payload.put("exp", exp.getEpochSecond());

        String headerPart = B64_ENC.encodeToString(HEADER_JSON.getBytes(StandardCharsets.UTF_8));
        String payloadPart = B64_ENC.encodeToString(jsonMapper.writeValueAsBytes(payload));
        String signingInput = headerPart + "." + payloadPart;
        String sigPart = B64_ENC.encodeToString(hmacSha256(signingInput));
        return signingInput + "." + sigPart;
    }

    /** 署名と有効期限を検証し、正当なトークンであればユーザー ID (sub) を返す。 */
    public Optional<Long> verifyAndExtractUserId(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            return Optional.empty();
        }
        try {
            byte[] expectedSig = hmacSha256(parts[0] + "." + parts[1]);
            byte[] actualSig = B64_DEC.decode(parts[2]);
            if (!MessageDigest.isEqual(expectedSig, actualSig)) {
                return Optional.empty();
            }
            byte[] payloadBytes = B64_DEC.decode(parts[1]);
            JsonNode claims = jsonMapper.readTree(payloadBytes);
            long exp = claims.path("exp").asLong(0);
            if (exp <= Instant.now().getEpochSecond()) {
                return Optional.empty();
            }
            String sub = claims.path("sub").asString("");
            if (sub.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(Long.parseLong(sub));
        } catch (IllegalArgumentException | JacksonException e) {
            log.debug("Invalid JWT: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private byte[] hmacSha256(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secretKeyBytes, "HmacSHA256"));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA256 署名に失敗しました", e);
        }
    }
}
