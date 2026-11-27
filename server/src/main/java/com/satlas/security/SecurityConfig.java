package com.satlas.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

import com.satlas.config.SatlasProperties;

/**
 * Spring Security 設定。
 * <ul>
 * <li>Web / Desktop 共通 Discord OAuth2: {@code GET /api/auth/discord/login} → JWT 発行</li>
 * <li>JWT 認証: {@code Authorization: Bearer <JWT>} を {@link JwtAuthenticationFilter} で検証</li>
 * <li>ログアウト: {@code POST /api/auth/logout}（204）</li>
 * <li>dev-mode=true の間は /api/** を未ログインでも許可（CurrentUserService が開発ユーザーへフォールバック）</li>
 * </ul>
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
            DiscordOAuth2UserService discordOAuth2UserService,
            JwtAuthenticationFilter jwtAuthenticationFilter,
            SatlasProperties properties) throws Exception {

        boolean devMode = properties.isDevMode();
        String frontendUrl = properties.frontendUrl();

        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"))
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers(
                            "/oauth2/**",
                            "/login/**",
                            "/error",
                            "/api/me",
                            "/api/auth/**",
                            "/api/auth/discord/**").permitAll();
                    if (devMode) {
                        auth.requestMatchers("/api/**").permitAll();
                    }
                    auth.anyRequest().authenticated();
                })
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                // API は未認証時にログイン画面へリダイレクトせず 401 を返す
                .exceptionHandling(ex -> ex.defaultAuthenticationEntryPointFor(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                        PathPatternRequestMatcher.withDefaults().matcher("/api/**")))
                .oauth2Login(oauth -> oauth
                        .userInfoEndpoint(ui -> ui.userService(discordOAuth2UserService))
                        .defaultSuccessUrl(frontendUrl, true)
                        .failureUrl(frontendUrl + "/?login_error=1"))
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)));

        return http.build();
    }
}
