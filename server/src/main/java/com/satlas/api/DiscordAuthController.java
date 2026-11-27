package com.satlas.api;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import com.satlas.entity.Role;
import com.satlas.entity.User;
import com.satlas.repository.UserRepository;
import com.satlas.security.CurrentUserService;
import com.satlas.security.JwtService;

import lombok.extern.slf4j.Slf4j;

/**
 * Web / Desktop (Tauri v2 ディープリンク) 両対応の Discord OAuth2 認証コントローラー。
 */
@Slf4j
@RestController
@RequestMapping("/api/auth/discord")
public class DiscordAuthController {

    private static final String DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
    private static final String DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
    private static final String DISCORD_ME_URL = "https://discord.com/api/users/@me";
    private static final long STATE_TTL_SECONDS = 600;

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final RestClient restClient = RestClient.create();
    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, StateEntry> pendingStates = new ConcurrentHashMap<>();

    @Value("${discord.client-id:}")
    private String clientId;

    @Value("${discord.client-secret:}")
    private String clientSecret;

    @Value("${discord.redirect-uri:http://localhost:8080/api/auth/discord/callback}")
    private String redirectUri;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${satlas.discord.max-members:8}")
    private int maxMembers;

    public DiscordAuthController(UserRepository userRepository, JwtService jwtService) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    private record StateEntry(String platform, Instant expiresAt) {
    }

    /**
     * Discord OAuth2 認可 URL へ 302 リダイレクトする。
     *
     * @param platform "web" または "desktop"
     */
    @GetMapping("/login")
    public ResponseEntity<Void> login(@RequestParam(defaultValue = "web") String platform) {
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET が未設定です");
        }

        String normalizedPlatform = "desktop".equalsIgnoreCase(platform) ? "desktop" : "web";
        pruneExpiredStates();

        byte[] raw = new byte[24];
        secureRandom.nextBytes(raw);
        String state = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        pendingStates.put(state, new StateEntry(normalizedPlatform, Instant.now().plusSeconds(STATE_TTL_SECONDS)));

        String authorizeUrl = DISCORD_AUTHORIZE_URL
                + "?client_id=" + encode(clientId)
                + "&redirect_uri=" + encode(redirectUri)
                + "&response_type=code"
                + "&scope=" + encode("identify")
                + "&state=" + encode(state);

        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, authorizeUrl)
                .build();
    }

    /**
     * Discord からのコールバックを受け取り、JWT を発行して Web または Desktop ディープリンクへリダイレクトする。
     */
    @GetMapping("/callback")
    @Transactional
    public ResponseEntity<Void> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {

        StateEntry stateEntry = state != null ? pendingStates.remove(state) : null;
        String platform = stateEntry != null ? stateEntry.platform() : "web";

        if (error != null && !error.isBlank()) {
            return redirectFailure(platform, "oauth_cancelled");
        }
        if (stateEntry == null || stateEntry.expiresAt().isBefore(Instant.now())) {
            return redirectFailure(platform, "invalid_state");
        }
        if (code == null || code.isBlank()) {
            return redirectFailure(platform, "missing_code");
        }

        // 1. 認可コードをアクセストークンへ交換
        String accessToken;
        try {
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("client_id", clientId);
            form.add("client_secret", clientSecret);
            form.add("grant_type", "authorization_code");
            form.add("code", code);
            form.add("redirect_uri", redirectUri);

            Map<String, Object> tokenResp = restClient.post()
                    .uri(DISCORD_TOKEN_URL)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            accessToken = tokenResp == null ? null : (String) tokenResp.get("access_token");
            if (accessToken == null || accessToken.isBlank()) {
                return redirectFailure(platform, "token_exchange_failed");
            }
        } catch (RestClientException e) {
            log.warn("Discord token exchange failed: {}", e.getMessage());
            return redirectFailure(platform, "token_exchange_failed");
        }

        // 2. Discord ユーザー情報取得
        Map<String, Object> profile;
        try {
            profile = restClient.get()
                    .uri(DISCORD_ME_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {
                    });
        } catch (RestClientException e) {
            log.warn("Discord user profile fetch failed: {}", e.getMessage());
            return redirectFailure(platform, "profile_fetch_failed");
        }

        if (profile == null || profile.get("id") == null) {
            return redirectFailure(platform, "profile_empty");
        }

        String discordId = String.valueOf(profile.get("id"));
        String displayName = resolveDisplayName(profile);
        String avatarUrl = resolveAvatarUrl(discordId, (String) profile.get("avatar"));

        // 3. ユーザー検索または新規作成（最大メンバー数チェック対応）
        User user = userRepository.findByDiscordId(discordId).orElse(null);
        if (user == null) {
            if (maxMembers > 0) {
                long existingMembers = userRepository.findAll().stream()
                        .filter(u -> !CurrentUserService.DEV_DISCORD_ID.equals(u.getDiscordId()))
                        .count();
                if (existingMembers >= maxMembers) {
                    return redirectFailure(platform, "member_limit_reached");
                }
            }
            user = new User();
            user.setDiscordId(discordId);
            user.setRole(Role.MEMBER);
        }
        user.setName(displayName);
        user.setAvatarUrl(avatarUrl);
        user = userRepository.save(user);

        // 4. JWT 発行 ＆ プラットフォーム別リダイレクト
        String jwt = jwtService.issueToken(user);
        String target = "desktop".equals(platform)
                ? "satlas://auth/callback?token=" + encode(jwt)
                : stripTrailingSlash(frontendUrl) + "/#auth_token=" + encode(jwt);

        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(target))
                .build();
    }

    private ResponseEntity<Void> redirectFailure(String platform, String reason) {
        String target = "desktop".equals(platform)
                ? "satlas://auth/callback?error=" + encode(reason)
                : stripTrailingSlash(frontendUrl) + "/?login_error=" + encode(reason);
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(target))
                .build();
    }

    private void pruneExpiredStates() {
        Instant now = Instant.now();
        pendingStates.entrySet().removeIf(e -> e.getValue().expiresAt().isBefore(now));
    }

    private static String resolveDisplayName(Map<String, Object> attrs) {
        if (attrs.get("global_name") instanceof String g && !g.isBlank()) {
            return g;
        }
        return String.valueOf(attrs.getOrDefault("username", "Discord User"));
    }

    private static String resolveAvatarUrl(String discordId, String avatarHash) {
        if (avatarHash == null || avatarHash.isBlank()) {
            return null;
        }
        String ext = avatarHash.startsWith("a_") ? "gif" : "png";
        return "https://cdn.discordapp.com/avatars/%s/%s.%s".formatted(discordId, avatarHash, ext);
    }

    private static String encode(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private static String stripTrailingSlash(String url) {
        String s = url == null ? "http://localhost:5173" : url.trim();
        while (s.endsWith("/")) {
            s = s.substring(0, s.length() - 1);
        }
        return s;
    }
}
