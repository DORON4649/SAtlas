package com.satlas.security;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.satlas.config.SatlasProperties;
import com.satlas.entity.User;
import com.satlas.repository.UserRepository;

import lombok.extern.slf4j.Slf4j;

/**
 * Discord OAuth2 ログイン時にユーザー情報を取得し、SAtlas の {@link User} を自動登録・更新する。
 * {@code satlas.discord.guild-id} が設定されている場合は、そのサーバー（ギルド）の参加者のみ許可する。
 */
@Slf4j
@Service
public class DiscordOAuth2UserService extends DefaultOAuth2UserService {

    private static final String DISCORD_API = "https://discord.com/api";

    private final UserRepository userRepository;
    private final SatlasProperties properties;
    private final RestClient discordClient = RestClient.create(DISCORD_API);

    public DiscordOAuth2UserService(UserRepository userRepository, SatlasProperties properties) {
        this.userRepository = userRepository;
        this.properties = properties;
    }

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User discordUser = super.loadUser(userRequest);
        Map<String, Object> attrs = discordUser.getAttributes();

        String discordId = String.valueOf(attrs.get("id"));
        verifyGuildMembership(userRequest.getAccessToken().getTokenValue());

        User user = userRepository.findByDiscordId(discordId).orElseGet(User::new);
        user.setDiscordId(discordId);
        user.setName(resolveDisplayName(attrs));
        user.setAvatarUrl(resolveAvatarUrl(discordId, (String) attrs.get("avatar")));
        if (attrs.get("email") instanceof String email && !email.isBlank()) {
            user.setEmail(email);
        }
        userRepository.save(user);

        return new DefaultOAuth2User(
                Set.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())),
                attrs,
                "id");
    }

    private void verifyGuildMembership(String accessToken) {
        String guildId = properties.discord() == null ? null : properties.discord().guildId();
        if (guildId == null || guildId.isBlank()) {
            return; // ギルド制限なし
        }
        try {
            List<Map<String, Object>> guilds = discordClient.get()
                    .uri("/users/@me/guilds")
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<Map<String, Object>>>() {
                    });
            boolean member = guilds != null && guilds.stream()
                    .anyMatch(g -> Objects.equals(String.valueOf(g.get("id")), guildId));
            if (!member) {
                throw new OAuth2AuthenticationException(new OAuth2Error(
                        "guild_membership_required", "指定の Discord サーバーに参加していません", null));
            }
        } catch (RestClientException e) {
            log.warn("Discord guild check failed", e);
            throw new OAuth2AuthenticationException(new OAuth2Error(
                    "guild_check_failed", "Discord サーバー参加状況を確認できませんでした", null), e);
        }
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
}
