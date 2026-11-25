package com.satlas.api;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.satlas.api.dto.MeResponse;
import com.satlas.api.dto.UserResponse;
import com.satlas.api.dto.UserSettingsRequest;
import com.satlas.entity.User;
import com.satlas.repository.UserRepository;
import com.satlas.security.ApiKeyCryptoService;
import com.satlas.security.CurrentUserService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MeController {

    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final ApiKeyCryptoService apiKeyCryptoService;

    /** ログイン状態の確認（未ログインでも 200 を返す）。 */
    @GetMapping
    public MeResponse me() {
        return currentUserService.findAuthenticatedUser()
                .map(u -> new MeResponse(true, false, UserResponse.from(u, apiKeyCryptoService)))
                .orElseGet(() -> currentUserService.isDevMode()
                        ? new MeResponse(false, true,
                                UserResponse.from(currentUserService.requireUser(), apiKeyCryptoService))
                        : new MeResponse(false, false, null));
    }

    @PatchMapping
    @Transactional
    public UserResponse updateSettings(@RequestBody UserSettingsRequest req) {
        User user = currentUserService.requireUser();
        if (req.theme() != null) {
            user.setTheme(req.theme());
        }
        if (req.language() != null) {
            user.setLanguage(req.language());
        }
        if (req.prefecture() != null) {
            user.setPrefecture(req.prefecture());
        }
        if (req.birthday() != null) {
            user.setBirthday(req.birthday());
        }
        if (req.geminiApiKey() != null) {
            user.setEncryptedGeminiApiKey(
                    req.geminiApiKey().isBlank() ? null : apiKeyCryptoService.encrypt(req.geminiApiKey()));
        }
        if (req.enableOllamaFallback() != null) {
            user.setEnableOllamaFallback(req.enableOllamaFallback());
        }
        if (req.ollamaBaseUrl() != null) {
            user.setOllamaBaseUrl(req.ollamaBaseUrl().isBlank()
                    ? UserResponse.DEFAULT_OLLAMA_URL
                    : req.ollamaBaseUrl().trim());
        }
        if (req.ollamaModel() != null) {
            user.setOllamaModel(req.ollamaModel().isBlank()
                    ? UserResponse.DEFAULT_OLLAMA_MODEL
                    : req.ollamaModel().trim());
        }
        if (req.googleIcalUrl() != null) {
            user.setGoogleIcalUrl(req.googleIcalUrl().isBlank() ? null : req.googleIcalUrl().trim());
        }
        return UserResponse.from(userRepository.save(user), apiKeyCryptoService);
    }
}
