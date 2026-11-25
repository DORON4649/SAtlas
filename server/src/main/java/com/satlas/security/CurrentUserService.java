package com.satlas.security;

import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.satlas.config.SatlasProperties;
import com.satlas.entity.User;
import com.satlas.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * リクエスト中のユーザーを解決する。
 * 開発モード（satlas.security.dev-mode=true）で未ログインの場合は開発用テストユーザーにフォールバックする。
 */
@Service
@RequiredArgsConstructor
public class CurrentUserService {

    public static final String DEV_DISCORD_ID = "dev-user";

    private final UserRepository userRepository;
    private final SatlasProperties properties;

    /** Discord でログイン済みのユーザー（フォールバックなし）。 */
    @Transactional(readOnly = true)
    public Optional<User> findAuthenticatedUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof OAuth2User principal) {
            return userRepository.findByDiscordId(principal.getName());
        }
        return Optional.empty();
    }

    /** API で使うユーザー。未ログインかつ開発モードでなければ 401。 */
    @Transactional
    public User requireUser() {
        return findAuthenticatedUser().orElseGet(() -> {
            if (!isDevMode()) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "ログインが必要です");
            }
            return getOrCreateDevUser();
        });
    }

    public boolean isDevMode() {
        return properties.isDevMode();
    }

    private User getOrCreateDevUser() {
        return userRepository.findByDiscordId(DEV_DISCORD_ID).orElseGet(() -> {
            User dev = new User();
            dev.setDiscordId(DEV_DISCORD_ID);
            dev.setName("開発用テストユーザー");
            dev.setEmail("dev@satlas.local");
            return userRepository.save(dev);
        });
    }
}
